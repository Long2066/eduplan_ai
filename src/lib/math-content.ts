import katex from "katex";

export type MathContentSegment = {
  type: "text" | "inline-math" | "display-math";
  value: string;
};

export type MathContentIssue = {
  code: "legacy-delimiter" | "unclosed-delimiter" | "empty-expression" | "unsafe-command" | "invalid-latex" | "raw-latex" | "plain-formula";
  message: string;
  expression?: string;
};

const forbiddenLatexCommand = /\\(?:def|gdef|edef|xdef|newcommand|renewcommand|providecommand|include|input|write|openout|read|csname|htmlClass|htmlId|htmlStyle|htmlData|href|url)\b/i;
const rawLatexCommand = /\\(?:frac|dfrac|tfrac|sqrt|times|div|cdot|pm|leq|geq|neq|begin\s*\{(?:array|aligned|matrix|cases)\})/;
const plainFormulaPattern = /(?:^|[\s:;(])(?:(?:[A-Za-z]\s*=\s*)?\d+(?:[.,]\d+)?\s*(?:[+×÷=<>]|<=|>=|!=)\s*\d+(?:[.,]\d+)?|\d+(?:[.,]\d+)?\s*[−–—-]\s*\d+(?:[.,]\d+)?\s*=)/;

function normalizeUnicodeSquareRoot(value: string) {
  return value
    .replace(/√\s*\(([^()]+)\)/g, String.raw`\sqrt{$1}`)
    .replace(/√\s*([A-Za-z0-9]+(?:[.,][0-9]+)?)/g, String.raw`\sqrt{$1}`);
}

export function normalizeLatexExpression(expression: string) {
  return normalizeUnicodeSquareRoot(expression)
    .replace(/[−–—]/g, "-")
    .replace(/×/g, String.raw`\times `)
    .replace(/÷/g, String.raw`\div `)
    .replace(/≤/g, String.raw`\leq `)
    .replace(/≥/g, String.raw`\geq `)
    .replace(/≠/g, String.raw`\neq `)
    .replace(/±/g, String.raw`\pm `)
    .replace(/°/g, String.raw`^\circ`)
    .replace(/[ \t]+/g, " ")
    .trim();
}

export function parseMathContent(source: string): MathContentSegment[] {
  const value = String(source || "");
  if (!value) return [{ type: "text", value: "" }];
  const segments: MathContentSegment[] = [];
  let cursor = 0;

  while (cursor < value.length) {
    const inlineStart = value.indexOf(String.raw`\(`, cursor);
    const displayStart = value.indexOf(String.raw`\[`, cursor);
    const starts = [
      inlineStart >= 0 ? { index: inlineStart, type: "inline-math" as const, close: String.raw`\)` } : null,
      displayStart >= 0 ? { index: displayStart, type: "display-math" as const, close: String.raw`\]` } : null,
    ].filter((item): item is NonNullable<typeof item> => Boolean(item));

    if (!starts.length) {
      segments.push({ type: "text", value: value.slice(cursor) });
      break;
    }
    starts.sort((left, right) => left.index - right.index);
    const start = starts[0];
    if (start.index > cursor) segments.push({ type: "text", value: value.slice(cursor, start.index) });
    const contentStart = start.index + 2;
    const closeIndex = value.indexOf(start.close, contentStart);
    if (closeIndex < 0) {
      segments.push({ type: "text", value: value.slice(start.index) });
      break;
    }
    segments.push({ type: start.type, value: value.slice(contentStart, closeIndex) });
    cursor = closeIndex + 2;
  }
  return segments.length ? segments : [{ type: "text", value }];
}

export function hasMathContent(value: string) {
  return parseMathContent(value).some((segment) => segment.type !== "text");
}

function delimiterIssues(value: string) {
  const issues: MathContentIssue[] = [];
  const stack: Array<{ close: string; label: string }> = [];
  for (let index = 0; index < value.length - 1; index += 1) {
    const token = value.slice(index, index + 2);
    if (token === String.raw`\(`) stack.push({ close: String.raw`\)`, label: "\\(...\\)" });
    else if (token === String.raw`\[`) stack.push({ close: String.raw`\]`, label: "\\[...\\]" });
    else if (token === String.raw`\)` || token === String.raw`\]`) {
      const expected = stack.pop();
      if (!expected || expected.close !== token) issues.push({ code: "unclosed-delimiter", message: `Delimiter LaTeX đóng ${token} không khớp.` });
    }
  }
  stack.forEach((item) => issues.push({ code: "unclosed-delimiter", message: `Delimiter LaTeX ${item.label} chưa được đóng.` }));
  return issues;
}

export function validateMathContent(value: string, options: { requireDelimitedFormulas?: boolean } = {}) {
  const source = String(value || "");
  const issues: MathContentIssue[] = [];
  if (/(^|[^\\])\$\$?|```(?:latex|tex|math)?/i.test(source)) {
    issues.push({ code: "legacy-delimiter", message: "Không dùng $...$, $$...$$ hoặc code fence; hãy dùng \\(...\\) / \\[...\\]." });
  }
  issues.push(...delimiterIssues(source));

  for (const segment of parseMathContent(source)) {
    if (segment.type === "text") {
      if (rawLatexCommand.test(segment.value)) issues.push({ code: "raw-latex", message: "Có lệnh LaTeX nằm ngoài delimiter \\(...\\) hoặc \\[...\\]." });
      if (options.requireDelimitedFormulas && plainFormulaPattern.test(segment.value)) issues.push({ code: "plain-formula", message: "Có phép tính/công thức còn ở dạng text; hãy bọc bằng delimiter LaTeX chuẩn." });
      continue;
    }
    const expression = normalizeLatexExpression(segment.value);
    if (!expression) {
      issues.push({ code: "empty-expression", message: "Có vùng công thức LaTeX rỗng." });
      continue;
    }
    if (forbiddenLatexCommand.test(expression)) {
      issues.push({ code: "unsafe-command", message: "Công thức chứa lệnh LaTeX không được hỗ trợ hoặc không an toàn.", expression });
      continue;
    }
    try {
      katex.renderToString(expression, { displayMode: segment.type === "display-math", output: "mathml", throwOnError: true, strict: "error", trust: false });
    } catch (error) {
      issues.push({ code: "invalid-latex", message: `Cú pháp LaTeX không hợp lệ: ${error instanceof Error ? error.message : "không thể render"}.`, expression });
    }
  }
  return issues;
}

export function normalizeMathContent(value: string) {
  return parseMathContent(value).map((segment) => {
    if (segment.type === "text") return segment.value;
    const delimiters = segment.type === "inline-math" ? [String.raw`\(`, String.raw`\)`] : [String.raw`\[`, String.raw`\]`];
    return `${delimiters[0]}${normalizeLatexExpression(segment.value)}${delimiters[1]}`;
  }).join("");
}

export function normalizeMathContentDeep<T>(value: T): T {
  if (typeof value === "string") return normalizeMathContent(value) as T;
  if (Array.isArray(value)) return value.map((item) => normalizeMathContentDeep(item)) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, normalizeMathContentDeep(item)])) as T;
  }
  return value;
}

export function latexToReadableText(expression: string) {
  let value = normalizeLatexExpression(expression);
  let previous = "";
  while (previous !== value) {
    previous = value;
    value = value
      .replace(/\\(?:d|t)?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, "($1)/($2)")
      .replace(/\\sqrt\s*\{([^{}]*)\}/g, "√($1)")
      .replace(/\^\s*\{([^{}]*)\}/g, "^($1)")
      .replace(/_\s*\{([^{}]*)\}/g, "_($1)");
  }
  return value
    .replace(/\\times\b/g, "×").replace(/\\div\b/g, "÷").replace(/\\cdot\b/g, "·")
    .replace(/\\leq\b/g, "≤").replace(/\\geq\b/g, "≥").replace(/\\neq\b/g, "≠")
    .replace(/\\pm\b/g, "±").replace(/\\circ\b/g, "°")
    .replace(/\\(?:mathrm|text)\s*\{([^{}]*)\}/g, "$1").replace(/\\[,;:!]/g, " ")
    .replace(/\\(?:left|right)\b/g, "").replace(/\\[A-Za-z]+/g, "").replace(/[{}]/g, "")
    .replace(/\s+/g, " ").trim();
}

export function mathContentToReadableText(value: string) {
  return parseMathContent(value).map((segment) => segment.type === "text" ? segment.value : latexToReadableText(segment.value)).join("");
}
