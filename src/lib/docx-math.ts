import JSZip from "jszip";
import katex from "katex";
import { latexToReadableText, normalizeLatexExpression, parseMathContent } from "@/lib/math-content";

const markerPattern = /EDUPLANMATH_(INLINE|DISPLAY)_([A-Za-z0-9_-]+)_END/g;
let markerCounter = 0;
const markerExpressions = new Map<string, string>();

export type DocxMathPart =
  | { type: "text"; value: string }
  | { type: "math-marker"; marker: string; display: boolean; fallback: string };

function markerId() {
  markerCounter += 1;
  return `${Date.now().toString(36)}_${markerCounter.toString(36)}`;
}

export function docxMathParts(value: string): DocxMathPart[] {
  return parseMathContent(value).map((segment) => {
    if (segment.type === "text") return { type: "text", value: segment.value };
    const expression = normalizeLatexExpression(segment.value);
    const display = segment.type === "display-math";
    const marker = `EDUPLANMATH_${display ? "DISPLAY" : "INLINE"}_${markerId()}_END`;
    markerExpressions.set(marker, expression);
    return { type: "math-marker", marker, display, fallback: latexToReadableText(expression) || expression };
  });
}

function extractMathMl(expression: string, display: boolean) {
  const rendered = katex.renderToString(expression, {
    displayMode: display,
    output: "mathml",
    throwOnError: true,
    strict: "error",
    trust: false,
  });
  const match = rendered.match(/<math[\s\S]*?<\/math>/i);
  if (!match) throw new Error("KaTeX không tạo MathML.");
  return match[0]
    .replace(/<annotation[\s\S]*?<\/annotation>/gi, "")
    .replace(/<semantics>\s*([\s\S]*?)\s*<\/semantics>/gi, "$1");
}

async function expressionToOmml(expression: string, displayMode: boolean) {
  const { mml2omml } = await import("mathml2omml");
  const omml = mml2omml(extractMathMl(expression, displayMode));
  if (!/<m:oMath\b/.test(omml)) throw new Error("Bộ chuyển đổi không tạo OMML.");
  return omml;
}

function expressionToOmmlPara(omml: string) {
  return `<m:oMathPara><m:oMathParaPr><m:jc m:val="center"/></m:oMathParaPr>${omml}</m:oMathPara>`;
}

function escapeXml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function containingRunRange(xml: string, markerIndex: number) {
  const candidates = Array.from(xml.slice(0, markerIndex).matchAll(/<w:r(?:\s[^>]*)?>/g));
  const runStart = candidates.at(-1)?.index ?? -1;
  const runEndStart = xml.indexOf("</w:r>", markerIndex);
  return runStart >= 0 && runEndStart >= 0 ? { start: runStart, end: runEndStart + "</w:r>".length } : null;
}

function replaceDisplayMarkerParagraph(xml: string, marker: string, omml: string) {
  const markerIndex = xml.indexOf(marker);
  if (markerIndex < 0) return null;
  const paragraphStartCandidates = Array.from(xml.slice(0, markerIndex).matchAll(/<w:p(?:\s[^>]*)?>/g));
  const paragraphStart = paragraphStartCandidates.at(-1)?.index ?? -1;
  const paragraphEndStart = xml.indexOf("</w:p>", markerIndex);
  const run = containingRunRange(xml, markerIndex);
  if (paragraphStart < 0 || paragraphEndStart < 0 || !run || run.start < paragraphStart || run.end > paragraphEndStart) return null;

  const openingEnd = xml.indexOf(">", paragraphStart) + 1;
  const openingTag = xml.slice(paragraphStart, openingEnd);
  const innerBeforeRun = xml.slice(openingEnd, run.start);
  const paragraphProperties = innerBeforeRun.match(/^<w:pPr>[\s\S]*?<\/w:pPr>/)?.[0] || "";
  const beforeRuns = innerBeforeRun.slice(paragraphProperties.length);
  const afterRuns = xml.slice(run.end, paragraphEndStart);
  const paragraph = (runs: string) => runs.trim() ? `${openingTag}${paragraphProperties}${runs}</w:p>` : "";
  const replacement = `${paragraph(beforeRuns)}<w:p>${expressionToOmmlPara(omml)}</w:p>${paragraph(afterRuns)}`;
  return `${xml.slice(0, paragraphStart)}${replacement}${xml.slice(paragraphEndStart + "</w:p>".length)}`;
}

function replaceMarkerRun(xml: string, marker: string, replacement: string) {
  let output = xml;
  let markerIndex = output.indexOf(marker);
  while (markerIndex >= 0) {
    const run = containingRunRange(output, markerIndex);
    if (!run) {
      output = `${output.slice(0, markerIndex)}${escapeXml(markerExpressions.get(marker) || marker)}${output.slice(markerIndex + marker.length)}`;
    } else {
      output = `${output.slice(0, run.start)}${replacement}${output.slice(run.end)}`;
    }
    markerIndex = output.indexOf(marker);
  }
  return output;
}

export async function injectMathIntoDocx(input: Blob | ArrayBuffer | Uint8Array) {
  const zip = await JSZip.loadAsync(input);
  const documentFile = zip.file("word/document.xml");
  if (!documentFile) throw new Error("DOCX không có word/document.xml.");
  let xml = await documentFile.async("string");

  for (const match of Array.from(xml.matchAll(markerPattern))) {
    const marker = match[0];
    const expression = markerExpressions.get(marker) || "";
    const display = match[1] === "DISPLAY";
    let replacement: string;
    try {
      replacement = await expressionToOmml(expression, display);
      if (display) xml = replaceDisplayMarkerParagraph(xml, marker, replacement) || replaceMarkerRun(xml, marker, replacement);
      else xml = replaceMarkerRun(xml, marker, replacement);
    } catch {
      replacement = `<w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="28"/></w:rPr><w:t xml:space="preserve">${escapeXml(latexToReadableText(expression) || expression)}</w:t></w:r>`;
      xml = replaceMarkerRun(xml, marker, replacement);
    }
    markerExpressions.delete(marker);
  }

  xml = xml.replace(markerPattern, "");
  zip.file("word/document.xml", xml);
  return zip.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
}
