import { describe, expect, it } from "vitest";
import {
  canonicalizeLessonTitle,
  extractOcrLessonTitleEvidence,
  isGenericLessonTitle,
  isSpecificLessonTitle,
  resolveLessonTitle,
} from "@/lib/lesson-title";

describe("canonicalizeLessonTitle", () => {
  it.each([
    ["Bài 2: Ô nhiễm, xói mòn đất", "Bài 2. Ô nhiễm, xói mòn đất"],
    ["Bài 2 - Ô nhiễm, xói mòn đất", "Bài 2. Ô nhiễm, xói mòn đất"],
    ["BÀI 2 – Ô NHIỄM, XÓI MÒN ĐẤT", "Bài 2. Ô NHIỄM, XÓI MÒN ĐẤT"],
    ["Bài 2\nÔ nhiễm, xói mòn đất", "Bài 2. Ô nhiễm, xói mòn đất"],
    ["Ôn tập cuối học kì", "Ôn tập cuối học kì"],
  ])("canonicalizes %s", (input, expected) => {
    expect(canonicalizeLessonTitle(input)).toBe(expected);
  });
});

describe("generic lesson titles", () => {
  it.each([
    "Bài học",
    "BÀI HỌC KHOA HỌC",
    "Bài học Toán",
    "Bai hoc Tieng Viet",
    "Bài học Tự nhiên và Xã hội",
    "Khoa học",
    "Bài 2",
    "Bài 2. Khoa học",
  ])("rejects %s", (title) => {
    expect(isGenericLessonTitle(title, "Khoa học")).toBe(true);
  });

  it.each([
    "Bài 2. Ô nhiễm, xói mòn đất và bảo vệ môi trường đất",
    "Ôn tập cuối học kì",
    "Chủ đề 3. Cộng đồng địa phương",
    "Bài học về môi trường đất",
  ])("keeps a specific title %s", (title) => {
    expect(isSpecificLessonTitle(title, "Khoa học")).toBe(true);
  });
});

describe("extractOcrLessonTitleEvidence", () => {
  it("joins Bài, number, and the following title without selecting exercise lines", () => {
    const candidates = extractOcrLessonTitleEvidence(`KHOA HỌC 5\nBài\n2\nÔ nhiễm, xói mòn đất và bảo vệ môi trường đất\nQuan sát hình và trả lời câu hỏi\nBài 1. Hãy nêu nguyên nhân gây ô nhiễm đất?\nBài 2. Viết biện pháp bảo vệ đất?`);
    expect(candidates[0]).toMatchObject({
      title: "Bài 2. Ô nhiễm, xói mòn đất và bảo vệ môi trường đất",
      source: "ocr-heading",
      evidence: ["Bài", "2", "Ô nhiễm, xói mòn đất và bảo vệ môi trường đất"],
    });
    expect(candidates.some((candidate) => /Hãy nêu|Viết biện pháp/.test(candidate.title))).toBe(false);
  });

  it("does not join a lesson number with text across an OCR image boundary", () => {
    const candidates = extractOcrLessonTitleEvidence("Bài 2\n--- HẾT ẢNH ---\nÔ nhiễm, xói mòn đất và bảo vệ môi trường đất");
    expect(candidates).toEqual([]);
  });

  it.each([
    "Bài 4. Đọc: Cánh cửa nhớ bà",
    "Bài 3. Viết: Quan sát đồ vật",
  ])("keeps a Vietnamese lesson heading %s", (heading) => {
    expect(extractOcrLessonTitleEvidence(heading)[0]?.title).toBe(heading);
  });

  it("extracts an uppercase one-line heading", () => {
    const candidates = extractOcrLessonTitleEvidence("BÀI 10: CÙNG KHÁM PHÁ QUANG CẢNH XUNG QUANH\nNội dung bài học");
    expect(candidates[0]?.title).toBe("Bài 10. CÙNG KHÁM PHÁ QUANG CẢNH XUNG QUANH");
  });
});

describe("resolveLessonTitle", () => {
  it("lets a clear OCR heading win over conflicting input and AI", () => {
    const result = resolveLessonTitle({
      subject: "Khoa học",
      ocrText: "Bài 2\nÔ nhiễm, xói mòn đất và bảo vệ môi trường đất",
      candidates: [
        { value: "Bài 4. Năng lượng", source: "user-input" },
        { value: "Bài học Khoa học", source: "generated-output" },
      ],
    });
    expect(result).toMatchObject({ status: "resolved", source: "ocr-heading", title: "Bài 2. Ô nhiễm, xói mòn đất và bảo vệ môi trường đất" });
  });

  it("lets specific input win over generic AI output", () => {
    const result = resolveLessonTitle({
      subject: "Toán",
      candidates: [
        { value: "Bài 12: Phân số", source: "user-input" },
        { value: "Bài học Toán", source: "generated-output" },
      ],
    });
    expect(result.title).toBe("Bài 12. Phân số");
  });

  it("lets source facts win over generic downstream artifacts", () => {
    const result = resolveLessonTitle({
      subject: "Tiếng Việt",
      candidates: [
        { value: "Bài 3. Thanh âm của gió", source: "source-facts" },
        { value: "Bài học Tiếng Việt", source: "lesson-map" },
        { value: "Bài học Tiếng Việt", source: "blueprint" },
      ],
    });
    expect(result.title).toBe("Bài 3. Thanh âm của gió");
  });

  it("returns unresolved instead of inventing a title", () => {
    const result = resolveLessonTitle({
      subject: "Khoa học",
      ocrText: "Quan sát tranh và thảo luận.",
      candidates: [{ value: "Bài học Khoa học", source: "generated-output" }],
    });
    expect(result.status).toBe("unresolved");
    expect(result.title).toBe("");
  });
});
