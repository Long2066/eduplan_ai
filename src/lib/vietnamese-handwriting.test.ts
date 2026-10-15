import { describe, expect, it } from "vitest";
import {
  attachHandwritingVisualsToActivities,
  extractTargetLettersFromWritingText,
  formatHandwritingInstruction,
  getHandwritingEntry,
  getHandwritingVisualsForLetters,
  isActivityReallyWriting,
} from "./vietnamese-handwriting";
import type { LessonActivity } from "@/types/lesson";

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

  it("isActivityReallyWriting rejects warmup and reading, only accepts explicit writing activities", () => {
    expect(
      isActivityReallyWriting({
        phase: "Khởi động",
        title: "1. Khởi động: Ôn nhanh vần an, ăn, ân (5 phút)",
      })
    ).toBe(false);

    expect(
      isActivityReallyWriting({
        phase: "Khám phá",
        title: "2. Khám phá đoạn ứng dụng: Đàn gà bên mẹ (10 phút)",
      })
    ).toBe(false);

    expect(
      isActivityReallyWriting({
        phase: "Luyện tập",
        title: "3. Luyện tập: Luyện đọc đoạn và củng cố vần (10 phút)",
      })
    ).toBe(false);

    expect(
      isActivityReallyWriting({
        phase: "Khám phá",
        title: "Hướng dẫn viết vần an, ăn, ân",
      })
    ).toBe(true);

    expect(
      isActivityReallyWriting({
        phase: "Luyện tập",
        title: "Tập viết chữ và từ ứng dụng vào vở",
      })
    ).toBe(true);
  });

  it("attachHandwritingVisualsToActivities strictly extracts target letters from lessonTitle, avoiding arbitrary words", () => {
    const activities: LessonActivity[] = [
      {
        id: "act_warmup",
        phase: "Khởi động",
        title: "1. Khởi động: Ôn nhanh vần an, ăn, ân (5 phút)",
        objective: "Ôn nhận biết, luyện viết nhanh vần",
        teacherActions: [],
        studentActions: [],
      },
      {
        id: "act_reading",
        phase: "Khám phá",
        title: "Khám phá đoạn ứng dụng: Đàn gà bên mẹ",
        objective: "Luyện đọc đoạn, luyện viết từ ngữ",
        teacherActions: [],
        studentActions: [],
      },
      {
        id: "act_writing",
        phase: "Khám phá",
        title: "Khám phá: Hướng dẫn viết vần an, ăn, ân",
        objective: "Viết đúng mẫu vần an, ăn, ân",
        teacherActions: [],
        studentActions: [],
      },
    ];

    const result = attachHandwritingVisualsToActivities(
      activities,
      "Bài 31. an ăn ân",
      "Tập viết vần an, ăn, ân"
    );

    expect(result[0].teacherVisuals).toBeUndefined();
    expect(result[1].teacherVisuals).toBeUndefined();

    // The writing activity must have visuals for target letters: 'a', 'ă', 'â' or 'n'
    expect(result[2].teacherVisuals).toBeDefined();
    expect(result[2].teacherVisuals?.length).toBeGreaterThan(0);
    const captions = result[2].teacherVisuals?.map((v) => v.caption).join(" ") || "";
    expect(captions).toContain("Mẫu chữ a");
    expect(captions).not.toContain("Mẫu chữ k");
    expect(captions).not.toContain("Mẫu chữ h");
    expect(captions).not.toContain("Mẫu chữ đ");
  });
});
