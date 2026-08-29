import { describe, expect, it } from "vitest";
import { lessonDocumentHeading } from "./lesson-document-model";
import { lessonHeadingTitle } from "./lesson-format";
import { makeLesson } from "./vietnamese-fixtures";

describe("lesson document heading", () => {
  it("canonicalizes the SGK title once and reuses it for every period", () => {
    const lesson = makeLesson({
      generalInfo: {
        subject: "Khoa học",
        grade: "Lớp 5",
        lessonTitle: "Bài 2: Ô nhiễm, xói mòn đất và bảo vệ môi trường đất",
        periods: 2,
        duration: 35,
      },
    });
    const period1 = lessonDocumentHeading(lesson, { periodNumber: 1, focus: "Khám phá", activities: lesson.activities });
    const period2 = lessonDocumentHeading(lesson, { periodNumber: 2, focus: "Vận dụng", activities: lesson.activities });

    expect(period1.documentTitle).toBe("KẾ HOẠCH BÀI DẠY");
    expect(period1.lessonTitle).toBe("Bài 2. Ô nhiễm, xói mòn đất và bảo vệ môi trường đất");
    expect(period2.lessonTitle).toBe(period1.lessonTitle);
    expect(lessonHeadingTitle(period1.lessonTitle)).toBe("BÀI 2. Ô NHIỄM, XÓI MÒN ĐẤT VÀ BẢO VỆ MÔI TRƯỜNG ĐẤT");
    expect(period1.periodLabel).toBe("(TIẾT 1)");
    expect(period2.periodLabel).toBe("(TIẾT 2)");
  });

  it("does not invent a lesson prefix or a generic fallback", () => {
    expect(lessonHeadingTitle("Ôn tập cuối học kì")).toBe("ÔN TẬP CUỐI HỌC KÌ");
    expect(lessonHeadingTitle("")).toBe("");
  });
});
