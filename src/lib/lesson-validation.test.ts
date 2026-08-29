import { describe, expect, it } from "vitest";
import { hasBlockingErrors, validateLessonInput } from "./lesson-validation";
import type { LessonInput } from "@/types/lesson";

function input(overrides: Partial<LessonInput> = {}): LessonInput {
  return {
    subject: "Khoa học",
    grade: "Lớp 5",
    lessonTitle: "",
    book: "Kết nối tri thức",
    bookVolume: "auto",
    periods: 1,
    duration: 35,
    hometownProvince: "auto",
    localityNote: "",
    studentProfile: "auto",
    teachingEnvironment: "auto",
    facilities: "auto",
    style: "Dạy thật trên lớp",
    specialRequest: "",
    allowAiInference: true,
    enableDigitalCompetency: false,
    uploadedAssets: [],
    ...overrides,
  };
}

describe("lesson form title validation", () => {
  it("allows a blank title when an SGK image is present for OCR", () => {
    const errors = validateLessonInput(input({
      uploadedAssets: [{ id: "image-1", name: "sgk.png", type: "image", dataUrl: "data:image/png;base64,AA==" }],
    }));
    expect(errors.lessonTitle).toBeUndefined();
    expect(errors.uploadedAssets).toBeUndefined();
    expect(hasBlockingErrors(errors)).toBe(false);
  });

  it("allows no image when a specific title is supplied", () => {
    const errors = validateLessonInput(input({
      lessonTitle: "Bài 2: Ô nhiễm, xói mòn đất và bảo vệ môi trường đất",
    }));
    expect(errors.lessonTitle).toBeUndefined();
    expect(errors.uploadedAssets).toBeUndefined();
    expect(hasBlockingErrors(errors)).toBe(false);
  });

  it.each(["", "Bài học", "Bài học Khoa học", "Khoa học"])(
    "blocks no-image generation with generic title %j",
    (lessonTitle) => {
      const errors = validateLessonInput(input({ lessonTitle }));
      expect(errors.lessonTitle).toContain("vui lòng nhập tên bài cụ thể");
      expect(hasBlockingErrors(errors)).toBe(true);
    },
  );
});
