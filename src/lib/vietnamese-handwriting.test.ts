import { describe, expect, it } from "vitest";
import {
  extractTargetLettersFromWritingText,
  formatHandwritingInstruction,
  getHandwritingEntry,
  getHandwritingVisualsForLetters,
} from "./vietnamese-handwriting";

describe("vietnamese-handwriting", () => {
  it("retrieves lowercase letter entry with accurate metadata", () => {
    const entryA = getHandwritingEntry("a", "lowercase");
    expect(entryA).toBeDefined();
    expect(entryA?.letter).toBe("a");
    expect(entryA?.height_cells).toBe(2);
    expect(entryA?.grid_lines).toBe(5);
    expect(entryA?.strokes.length).toBe(2);
    expect(entryA?.strokes[0].name).toBe("Cong kín");
    expect(entryA?.image_url).toBe("/handwriting/lower_a.png");
  });

  it("retrieves uppercase letter entry with accurate metadata", () => {
    const entryB = getHandwritingEntry("B", "uppercase");
    expect(entryB).toBeDefined();
    expect(entryB?.letter).toBe("B");
    expect(entryB?.height_cells).toBe(5);
    expect(entryB?.grid_lines).toBe(8);
    expect(entryB?.image_url).toBe("/handwriting/upper_b.png");
  });

  it("formats handwriting instructions into structured pedagogical guide", () => {
    const entryA = getHandwritingEntry("a", "lowercase");
    expect(entryA).toBeDefined();
    const formatted = formatHandwritingInstruction(entryA!);
    expect(formatted).toContain("* Hướng dẫn viết Chữ a thường:");
    expect(formatted).toContain("Độ cao: 2 ô li (5 đường kẻ)");
    expect(formatted).toContain("- Nét 1 (Cong kín): Đặt bút ở dưới đường kẻ 3 một chút");
    expect(formatted).toContain("- Nét 2 (Móc ngược phải)");
  });

  it("extracts distinct target letters from writing input phrase", () => {
    const letters = extractTargetLettersFromWritingText("an, ăn, ân, bạn thân");
    expect(letters).toContain("a");
    expect(letters).toContain("ă");
    expect(letters).toContain("â");
    expect(letters).toContain("n");
    expect(letters).toContain("b");
    expect(letters).toContain("t");
    expect(letters).toContain("h");
  });

  it("creates LessonActivityVisual objects for export and preview", () => {
    const visuals = getHandwritingVisualsForLetters(["a", "b"]);
    expect(visuals.length).toBe(2);
    expect(visuals[0].dataUrl).toBe("/handwriting/lower_a.png");
    expect(visuals[0].widthPx).toBe(240);
    expect(visuals[1].dataUrl).toBe("/handwriting/lower_b.png");
  });
});
