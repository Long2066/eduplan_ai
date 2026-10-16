import { describe, expect, it } from "vitest";
import {
  analyzeLetterMetrics,
  analyzeWordLetterHeights,
  generateVowelWritingScript,
  generateAppliedWordWritingScript,
  generateGrade1WritingInteractionUnits,
  detectTone,
} from "./vietnamese-stroke-engine";

describe("vietnamese-stroke-engine", () => {
  it("analyzes letter metrics accurately with grid lines and strokes", () => {
    const a = analyzeLetterMetrics("a");
    expect(a).not.toBeNull();
    expect(a?.heightCells).toBe(2);
    expect(a?.widthCells).toBe(2.5);
    expect(a?.strokesCount).toBe(2);
    expect(a?.descriptionScript).toContain("Chữ a cao 2 ô li");

    const b = analyzeLetterMetrics("b");
    expect(b).not.toBeNull();
    expect(b?.heightCells).toBe(5);
    expect(b?.heightGroup).toBe("5_cells");

    const t = analyzeLetterMetrics("t");
    expect(t).not.toBeNull();
    expect(t?.heightCells).toBe(3);
    expect(t?.heightGroup).toBe("3_cells");

    const r = analyzeLetterMetrics("r");
    expect(r).not.toBeNull();
    expect(r?.heightCells).toBe(2.25);
    expect(r?.heightGroup).toBe("2.5_cells");
  });

  it("classifies letter heights in applied words correctly", () => {
    const analysis = analyzeWordLetterHeights("bạn thân");
    expect(analysis.fiveCells).toEqual(expect.arrayContaining(["b", "h"]));
    expect(analysis.threeCells).toEqual(expect.arrayContaining(["t"]));
    expect(analysis.twoCells).toEqual(expect.arrayContaining(["a", "n"]));
    expect(analysis.teacherQuestion).toContain("5 ô li");
    expect(analysis.teacherQuestion).toContain("3 ô li");
    expect(analysis.teacherConclusion).toContain("b, h cao 5 ô li");
  });

  it("generates detailed vowel writing scripts with stroke coordinates", () => {
    const scriptAn = generateVowelWritingScript("an");
    expect(scriptAn).toContain("đường kẻ 3");
    expect(scriptAn).toContain("đường kẻ 2");
    expect(scriptAn).toContain("đường kẻ 1");
    expect(scriptAn).toContain("vần an");

    const scriptAn2 = generateVowelWritingScript("ăn");
    expect(scriptAn2).toContain("nét cong dưới nhỏ nằm giữa đường kẻ 3 và 4");

    const scriptAn3 = generateVowelWritingScript("ân");
    expect(scriptAn3).toContain("dấu mũ “^”");
  });

  it("detects tone and placement correctly", () => {
    const ban = detectTone("bạn");
    expect(ban.tone).toBe("nặng");
    expect(ban.tonePositionDescription).toContain("dưới con chữ a");

    const ran = detectTone("rằn");
    expect(ban.tone).toBe("nặng");
    expect(ran.tone).toBe("huyền");
    expect(ran.tonePositionDescription).toContain("trên đầu con chữ ă");
  });

  it("generates applied word writing script with spacing rule and letter details", () => {
    const script = generateAppliedWordWritingScript("bạn thân");
    expect(script).toContain("nét khuyết trên");
    expect(script).toContain("đường kẻ 6");
    expect(script).toContain("khoảng bằng một thân con chữ o");
    expect(script).toContain("tiếng “bạn”");
    expect(script).toContain("tiếng “thân”");
    expect(script).toContain("b, h cao 5 ô li");
  });

  it("generates 7 complete interaction units for Grade 1 writing", () => {
    const units = generateGrade1WritingInteractionUnits(["an", "ăn", "ân"], ["bạn thân", "khăn rằn"]);
    expect(units.teacherActions.length).toBe(7);
    expect(units.studentActions.length).toBe(7);

    // Unit 1: Discover & analyze letter shapes
    expect(units.teacherActions[0]).toContain("Để viết vần an");
    expect(units.studentActions[0]).toContain("Viết chữ a trước");

    // Unit 2: Conclusion
    expect(units.teacherActions[1]).toContain("GV nhận xét, chốt kiến thức");

    // Unit 3: Vowel writing demonstration
    expect(units.teacherActions[2]).toContain("GV hướng dẫn cách viết vần an");
    expect(units.studentActions[2]).toContain("mô phỏng nét viết trên không");

    // Unit 4: Slate practice
    expect(units.teacherActions[3]).toContain("bảng con");

    // Unit 5: Word heights classification
    expect(units.teacherActions[4]).toContain("bạn thân");
    expect(units.teacherActions[4]).toContain("5 ô li");

    // Unit 6: Word writing demonstration
    expect(units.teacherActions[5]).toContain("thân con chữ o");

    // Unit 7: Notebook practice and peer assessment
    expect(units.teacherActions[6]).toContain("vở Tập viết");
    expect(units.studentActions[6]).toContain("4 tiêu chí");
  });
});
