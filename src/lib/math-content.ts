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

function repairOverEscapedMathSource(value: string) {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, "")
    .replace(/\\+\u0332/g, "")
    .replace(/\\\\\(/g, String.raw`\(`)
    .replace(/\\\\\)/g, String.raw`\)`)
    .replace(/\\\\\[/g, String.raw`\[`)
    .replace(/\\\\\]/g, String.raw`\]`);
}

function repairOverEscapedLatexCommands(value: string) {
  return value.replace(/\\+\u0332/g, "").replace(/\\\\([A-Za-z])/g, "\\$1");
}

function numericValue(value: string) {
  return Number(
    value
      .replace(/(\d)(?:\{,\}|\\\\[,;:!]|\\[,;:!])(\d{3}\b)/g, "$1$2")
      .replace(/\{,\}/g, ".")
      .replace(/\\[,;:!]/g, "")
      .replace(/\s+/g, "")
      .replace(",", "."),
  );
}

const arithmeticNumberChunk = String.raw`-?\d+(?:(?:\{,\}|\\\\[,;:!]|\\[,;:!]|\s)\d{3})*(?:[.,]\d+)?`;
const arithmeticOperatorChunk = String.raw`\\times|\\div|[+×÷:]|[−–—-]`;
const arithmeticSidePattern = new RegExp(
  String.raw`^(?:\s*\(*\s*${arithmeticNumberChunk}\s*\)*\s*(?:${arithmeticOperatorChunk})\s*)*\s*\(*\s*${arithmeticNumberChunk}\s*\)*\s*$`,
);
const arithmeticTokenPattern = new RegExp(
  String.raw`(?<![+\-×÷:(=\s])-?\d+(?:(?:\{,\}|\\\\[,;:!]|\\[,;:!]|\s)\d{3})*(?:[.,]\d+)?|\d+(?:(?:\{,\}|\\\\[,;:!]|\\[,;:!]|\s)\d{3})*(?:[.,]\d+)?|\\times|\\div|[+×÷:()]|[−–—-]`,
  "g",
);
const negatedEquationContextPattern = /(?:không\s*phải(?:\s*bằng|\s*là)?|thay\s*vì|chứ\s*không\s*phải|tránh\s*(?:viết|nhầm|ghi)|nếu\s*(?:hs|học\s*sinh|em)\s*(?:nhầm|sai|viết\s*sai|tính\s*sai|làm\s*sai)|(?:hs|học\s*sinh|em)?\s*(?:dễ|thường|có\s*thể)?\s*nhầm\s*(?:thành|là|rằng)?|sai\s*thường\s*gặp|lỗi\s*(?:sai|thường\s*gặp|dự\s*kiến|hs\s*dễ\s*mắc)|dự\s*kiến\s*lỗi|sai\s*lầm|sai\s*sót)\s*[:：]?\s*$/iu;
const negatedEquationPostContextPattern = /^\s*(?:[,;.]\s*)?(?:chứ\s*không\s*phải|không\s*phải(?:\s*bằng|\s*là)?|thay\s*vì|tránh\s*(?:viết|nhầm|ghi)|\((?:sai|chưa\s*đúng|không\s*đúng|nhầm)[^)]*\)|là\s*(?:sai|chưa\s*đúng|không\s*đúng)|(?:chưa\s*đúng|không\s*đúng|sai\b))/iu;
const remainderPostContextPattern = /^\s*(?:\\text\s*\{)?\s*(?:[,;.]\s*)?\(?\s*dư\b/iu;
const percentagePostContextPattern = /^\s*(?:\\?%|\\text\s*\{\s*%\}|\s*phần\s*trăm)/iu;
const approximationContextPattern = /(?:làm\s*tròn|ước\s*lượng|xấp\s*xỉ|gần\s*bằng|khoảng)\s*[:：]?\s*$/iu;

function computeArithmeticExpression(expression: string): number | null {
  if (!arithmeticSidePattern.test(expression)) return null;
  const rawTokens = expression.match(arithmeticTokenPattern) || [];
  if (!rawTokens.length) return null;

  const evalFlat = (tokens: Array<number | string>): number | null => {
    if (tokens.length === 0 || tokens.length % 2 === 0) return null;
    const first = tokens[0];
    if (typeof first !== "number" || !Number.isFinite(first)) return null;
    let current = first;
    const values: number[] = [];
    const ops: string[] = [];
    for (let index = 1; index < tokens.length; index += 2) {
      const op = String(tokens[index] ?? "");
      const right = tokens[index + 1];
      if (typeof right !== "number" || !Number.isFinite(right)) return null;
      if (op === "×" || op === String.raw`\times`) {
        current *= right;
      } else if (op === "÷" || op === ":" || op === String.raw`\div`) {
        if (right === 0) return null;
        current /= right;
      } else if (op === "+" || /[−–—-]/.test(op)) {
        values.push(current);
        ops.push(/[−–—-]/.test(op) ? "-" : "+");
        current = right;
      } else {
        return null;
      }
    }
    values.push(current);
    return values.slice(1).reduce((total, val, idx) => (ops[idx] === "-" ? total - val : total + val), values[0] ?? 0);
  };

  const stack: Array<Array<number | string>> = [[]];
  for (const token of rawTokens) {
    if (token === "(") {
      stack.push([]);
    } else if (token === ")") {
      if (stack.length <= 1) return null;
      const group = stack.pop()!;
      const groupVal = evalFlat(group);
      if (groupVal === null) return null;
      stack[stack.length - 1].push(groupVal);
    } else if (/^-?\d/.test(token)) {
      const num = numericValue(token);
      if (!Number.isFinite(num)) return null;
      stack[stack.length - 1].push(num);
    } else {
      stack[stack.length - 1].push(token);
    }
  }
  if (stack.length !== 1) return null;
  const top = stack[0];
  if (top.length < 1) return null;
  return evalFlat(top);
}

const chainedEquationSideChunk = String.raw`(?:(?:\(\s*)*${arithmeticNumberChunk}(?:\s*\))*(?:\s*(?:${arithmeticOperatorChunk})\s*(?:\(\s*)*${arithmeticNumberChunk}(?:\s*\))*)*)`;
const chainedEquationRunPattern = new RegExp(
  String.raw`(?<![?:A-Za-z_…\d])(?<![?:A-Za-z_…]+\s*(?:\\times|\\div|[+×÷:]|[−–—-])\s*)${chainedEquationSideChunk}(?:\s*=\s*${chainedEquationSideChunk})+(?![?:A-Za-z_…\d])(?!\s*(?:\\times|\\div|[+×÷:]|[−–—-])\s*[?:A-Za-z_…])`,
  "g",
);

export function findSimpleArithmeticMismatch(value: string) {
  const rawCleaned = repairOverEscapedMathSource(String(value || ""));
  // Replace colon labels like "Bài 2: 92 + 74" or "Cách 1 : 68 + 207" and LaTeX blank placeholders before scanning
  const cleaned = rawCleaned
    .replace(/\\\(|\\\)|\\\[|\\\]/g, " ")
    .replace(/(\d)(?:\{,\}|\\\\[,;:!]|\\[,;:!])(\d{3}\b)/g, "$1$2")
    .replace(/(\d)(?:\{,\}|\\\\[,;:!]|\\[,;:!])(\d{3}\b)/g, "$1$2")
    .replace(/(\d)\{,\}(\d)/g, "$1.$2")
    .replace(/\\(?:dots|ldots|cdots|square|Box|text\s*\{\s*\?\s*\})|\[\s*\?\s*\]|\(\s*\?\s*\)|\.{3,}|_{2,}|…/gu, " ? ")
    .replace(
      /(?:bài|câu|ý|phần|nhiệm vụ|nhóm|tổ|cách|bước|mẫu|ví dụ|phiếu|hình|tiết|đợt|lần|tỉ lệ|tỉ số)\s*\d+\s*:/giu,
      "; ",
    )
    .replace(/(?:^|[.;(\n\r[-])\s*\d+\s*:\s+/gu, "; ");
  for (const match of cleaned.matchAll(chainedEquationRunPattern)) {
    const startIdx = match.index ?? 0;
    const endIdx = startIdx + match[0].length;
    const beforeSlice = cleaned.slice(Math.max(0, startIdx - 40), startIdx);
    const afterSlice = cleaned.slice(endIdx, Math.min(cleaned.length, endIdx + 40));
    // Skip partial matches that are adjacent to another arithmetic operator, =, ?, or variable
    if (/(?:\\times|\\div|[+×÷:=?]|[−–—-])\s*$/u.test(beforeSlice) || /^\s*(?:\\times|\\div|[+×÷:=?]|[−–—-])/u.test(afterSlice)) {
      continue;
    }
    // Skip division with remainder (e.g. 17 : 3 = 5 (dư 2) or 17 : 3 = 5 dư 2)
    if (remainderPostContextPattern.test(afterSlice)) {
      continue;
    }
    // Skip percentages (e.g. 3 : 4 = 75% or 0,25 = 25%)
    if (percentagePostContextPattern.test(afterSlice)) {
      continue;
    }
    const fullRun = match[0].replace(/[.,;]+$/g, "").trim();
    const prefixContext = cleaned.slice(Math.max(0, startIdx - 70), startIdx).trim();
    const postfixContext = cleaned.slice(endIdx, Math.min(cleaned.length, endIdx + 70));
    if (
      negatedEquationContextPattern.test(prefixContext) ||
      negatedEquationPostContextPattern.test(postfixContext) ||
      approximationContextPattern.test(prefixContext)
    ) {
      continue;
    }
    const sides = fullRun.split("=").map((s) => s.trim()).filter(Boolean);
    if (sides.length < 2) continue;
    const evaluatedSides = sides.map((side) => ({
      side,
      hasOperator: /(?:\\times|\\div|[+×÷:]|[−–—-])/.test(side.replace(/^-/, "")),
      value: computeArithmeticExpression(side),
    }));
    if (evaluatedSides.some((item) => item.value === null)) continue;
    if (!evaluatedSides.some((item) => item.hasOperator)) continue;
    const first = evaluatedSides[0]!;
    for (let i = 1; i < evaluatedSides.length; i += 1) {
      const current = evaluatedSides[i]!;
      if (Math.abs((first.value ?? 0) - (current.value ?? 0)) > 1e-9) {
        const exprSide = first.hasOperator ? first : current;
        const otherSide = exprSide === first ? current : first;
        return {
          equation: `${first.side} = ${current.side}`,
          expression: exprSide.side,
          stated: otherSide.side,
          computed: exprSide.value!,
        };
      }
    }
  }
  return null;
}

function normalizeUnicodeSquareRoot(value: string) {
  return value
    .replace(/√\s*\(([^()]+)\)/g, String.raw`\sqrt{$1}`)
    .replace(/√\s*([A-Za-z0-9]+(?:[.,][0-9]+)?)/g, String.raw`\sqrt{$1}`);
}

export function normalizeLatexExpression(expression: string) {
  return normalizeUnicodeSquareRoot(repairOverEscapedLatexCommands(expression))
    .replace(/(\d)\{,\}(\d{3}\b)/g, String.raw`$1\,$2`)
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
  const value = repairOverEscapedMathSource(String(source || ""));
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
  const source = repairOverEscapedMathSource(String(value || ""));
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

function autoWrapPlainMathInText(text: string): string {
  const repaired = repairOverEscapedMathSource(text);
  // 1. Convert legacy single-dollar $...$ formulas when contents contain math operators/commands
  const dollarFixed = repaired.replace(
    /(^|[^\\])\$([^$\n]{1,120}?)\$(?!\$)/g,
    (match, prefix: string, inner: string) => {
      if (/(?:\\(?:frac|times|div|sqrt|leq|geq|neq)|\d\s*(?:[+×÷=<>]|[−–—-])\s*\d|[A-Za-z]\s*=\s*[A-Za-z0-9])/u.test(inner)) {
        return `${prefix}\\(${normalizeLatexExpression(inner)}\\)`;
      }
      return match;
    },
  );
  // 2. Wrap plain arithmetic/algebraic formulas in text segments without touching time ranges like "3-5 phút"
  const plainFormulaGlobal = new RegExp(
    String.raw`(^|[\s:;(\["“])((?:[A-Za-z]\s*=\s*)?(?:\(\s*)?${arithmeticNumberChunk}(?:\s*\))?(?:\s*(?:\\times|\\div|[+×÷:<>]|<=|>=|!=|[−–—-])\s*(?:\(\s*)?${arithmeticNumberChunk}(?:\s*\))?)+\s*=\s*(?:\(\s*)?${arithmeticNumberChunk}(?:\s*\))?(?:\s*(?:=|\+|[−–—-]|\\times|\\div|[×÷:])\s*(?:\(\s*)?${arithmeticNumberChunk}(?:\s*\))?)*|(?:[A-Za-z]\s*=\s*)?${arithmeticNumberChunk}\s*(?:[+×÷=<>]|<=|>=|!=)\s*${arithmeticNumberChunk}(?:\s*(?:[+×÷=<>]|<=|>=|!=|[−–—-])\s*${arithmeticNumberChunk})*)`,
    "gu",
  );
  return dollarFixed.replace(plainFormulaGlobal, (match, prefix: string, formula: string) => {
    const trimmed = formula.trim();
    if (!trimmed) return match;
    return `${prefix}\\(${normalizeLatexExpression(trimmed)}\\)`;
  });
}

export function normalizeMathContent(value: string) {
  return parseMathContent(repairOverEscapedMathSource(value)).map((segment) => {
    if (segment.type === "text") return autoWrapPlainMathInText(segment.value);
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
