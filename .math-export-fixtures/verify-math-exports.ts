import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import JSZip from "jszip";
import { Packer } from "docx";
import { buildLessonDocxDocument } from "@/lib/export-docx";
import { injectMathIntoDocx } from "@/lib/docx-math";
import { mathFixtureLesson } from "./math-fixture";

const outputDir = join(process.cwd(), ".math-export-fixtures");
const docxPath = join(outputDir, "math-fixture.docx");

const { mkdir } = await import("node:fs/promises");
await mkdir(outputDir, { recursive: true });

const packed = await Packer.toBuffer(buildLessonDocxDocument(mathFixtureLesson));
const docxBlob = await injectMathIntoDocx(packed);
const docxBuffer = Buffer.from(await docxBlob.arrayBuffer());
const zip = await JSZip.loadAsync(docxBuffer);
const xml = await zip.file("word/document.xml")?.async("string");
if (!xml || !xml.includes("<m:oMath") || !xml.includes("<m:oMathPara") || xml.includes("EDUPLANMATH_")) throw new Error("DOCX chưa có OMML inline/display hoàn chỉnh.");
for (const preservedText of ["Tính được", "và nhận biết", "GV nêu phép tính", "HS trả lời"]) {
  if (!xml.includes(preservedText)) throw new Error(`DOCX làm mất văn bản quanh công thức: ${preservedText}`);
}
await writeFile(docxPath, docxBuffer);

console.log(JSON.stringify({ docxPath, docxBytes: docxBuffer.length, equations: (xml.match(/<m:oMath\b/g) || []).length }, null, 2));
