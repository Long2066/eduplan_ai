import { describe, expect, it } from "vitest";
import { generationInputFingerprint, validateGenerationJobInput } from "./job-input";
import type { LessonInput } from "@/types/lesson";

function value(overrides: Record<string, unknown> = {}) {
  return {
    subject: "Khoa học",
    grade: "Lớp 5",
    lessonTitle: "",
    book: "Kết nối tri thức",
    bookVolume: "auto",
    periods: 1,
    duration: 35,
    uploadedAssets: [],
    ...overrides,
  };
}

describe("generation job lesson-title input", () => {
  it("allows an image to supply a blank title through OCR", () => {
    const input = validateGenerationJobInput(value({
      uploadedAssets: [{ id: "asset-1", name: "sgk.png", type: "image", dataUrl: "data:image/png;base64,AA==" }],
    }));
    expect(input.lessonTitle).toBe("");
    expect(input.uploadedAssets).toHaveLength(1);
  });

  it("allows a specific manual title without images", () => {
    const input = validateGenerationJobInput(value({
      lessonTitle: "Bài 2 - Ô nhiễm, xói mòn đất và bảo vệ môi trường đất",
    }));
    expect(input.lessonTitle).toContain("Bài 2");
    expect(input.uploadedAssets).toEqual([]);
  });

  it.each(["", "Bài học", "Bài học Khoa học", "Khoa học"])(
    "rejects generic no-image identity %j before reservation",
    (lessonTitle) => {
      expect(() => validateGenerationJobInput(value({ lessonTitle }))).toThrow(expect.objectContaining({
        code: "LESSON_TITLE_UNRESOLVED",
        status: 422,
      }));
    },
  );

  it("fingerprints a legacy input whose uploadedAssets field is missing", () => {
    const { uploadedAssets: _uploadedAssets, ...legacy } = value({ lessonTitle: "Ôn tập cuối học kì" });
    expect(() => generationInputFingerprint(legacy as unknown as LessonInput)).not.toThrow();
  });
});
