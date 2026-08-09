import { describe, expect, it } from "vitest";
import {
  latexToReadableText,
  mathContentToReadableText,
  normalizeMathContent,
  normalizeMathContentDeep,
  parseMathContent,
  validateMathContent,
} from "./math-content";

describe("math-content", () => {
  it("parses Vietnamese text with inline and display formulas", () => {
    const value = String.raw`Tính \(x + 5 = 12\), rồi trình bày \[\frac{3}{4}+\frac{1}{4}=1\]`;
    expect(parseMathContent(value)).toEqual([
      { type: "text", value: "Tính " },
      { type: "inline-math", value: "x + 5 = 12" },
      { type: "text", value: ", rồi trình bày " },
      { type: "display-math", value: String.raw`\frac{3}{4}+\frac{1}{4}=1` },
    ]);
  });

  it("normalizes Unicode operators only inside formulas", () => {
    const input = String.raw`Khoảng 3–5 phút: \(6 × 4 ≥ 20\)`;
    expect(normalizeMathContent(input)).toBe(String.raw`Khoảng 3–5 phút: \(6 \times 4 \geq 20\)`);
  });

  it("accepts common primary math and vertical arithmetic", () => {
    const value = String.raw`\(\sqrt{25}=5\), \(60^\circ\), \(20\,\mathrm{cm}^2\) \[\begin{array}{r}165\\+126\\\hline291\end{array}\]`;
    expect(validateMathContent(value)).toEqual([]);
  });

  it("reports legacy, unclosed and invalid expressions", () => {
    expect(validateMathContent("$x+1$").some((issue) => issue.code === "legacy-delimiter")).toBe(true);
    expect(validateMathContent(String.raw`\(x+1`).some((issue) => issue.code === "unclosed-delimiter")).toBe(true);
    expect(validateMathContent(String.raw`\(\frac{1}\)`).some((issue) => issue.code === "invalid-latex")).toBe(true);
  });

  it("detects plain formulas without flagging time ranges", () => {
    expect(validateMathContent("GV yêu cầu tính 2 + 3 = 5.", { requireDelimitedFormulas: true }).some((issue) => issue.code === "plain-formula")).toBe(true);
    expect(validateMathContent("Hoạt động kéo dài 3-5 phút.", { requireDelimitedFormulas: true })).toEqual([]);
  });

  it("survives JSON escaping and multiple inline formulas", () => {
    const source = String.raw`So sánh \(a_1 \in A\) và \(a_1 \neq b_2\).`;
    const parsed = JSON.parse(JSON.stringify({ value: source })) as { value: string };
    expect(parsed.value).toBe(source);
    expect(parseMathContent(parsed.value).filter((segment) => segment.type === "inline-math")).toHaveLength(2);
    expect(validateMathContent(parsed.value)).toEqual([]);
  });

  it("deep-normalizes only string values without changing schema", () => {
    const source = {
      lesson: String.raw`Tính \(6 × 4 ≥ 20\)`,
      activities: [{ durationMinutes: 5, text: String.raw`\(12 ÷ 3 = 4\)` }],
      enabled: true,
    };
    expect(normalizeMathContentDeep(source)).toEqual({
      lesson: String.raw`Tính \(6 \times 4 \geq 20\)`,
      activities: [{ durationMinutes: 5, text: String.raw`\(12 \div 3 = 4\)` }],
      enabled: true,
    });
  });

  it("leaves legacy plain text without delimiters unchanged", () => {
    const value = "Học sinh dùng thước đo cạnh dài 5 cm.";
    expect(normalizeMathContent(value)).toBe(value);
    expect(parseMathContent(value)).toEqual([{ type: "text", value }]);
  });

  it("creates readable fallback without raw commands", () => {
    expect(latexToReadableText(String.raw`\frac{3}{4} \times 20\,\mathrm{cm}`)).toContain("(3)/(4) × 20 cm");
    expect(mathContentToReadableText(String.raw`Kết quả \(\sqrt{25}=5\)`)).toBe("Kết quả √(25)=5");
  });
});
