import { describe, expect, it } from "vitest";
import type { LessonInput } from "@/types/lesson";
import { createGenerationInput, dataUrlByteLength, serializeGenerationInput } from "./client-image-processing";
import { dataUrlDecodedBytes, validateLessonImagePayload } from "./lesson-image-payload";

const dataUrl = "data:image/jpeg;base64,AQIDBA==";

function inputWithPreview(): LessonInput {
  return {
    subject: "Toán",
    grade: "Lớp 1",
    lessonTitle: "Bài test",
    book: "Kết nối tri thức với cuộc sống",
    bookVolume: "auto",
    periods: 1,
    duration: 35,
    hometownProvince: "auto",
    localityNote: "",
    studentProfile: "auto",
    teachingEnvironment: "auto",
    facilities: "auto",
    style: "Cơ bản",
    specialRequest: "",
    allowAiInference: true,
    enableDigitalCompetency: false,
    uploadedAssets: [{ id: "a1", name: "page.jpg", type: "image", order: 1, previewUrl: dataUrl, dataUrl, mimeType: "image/jpeg" }],
  };
}

describe("generation image payload", () => {
  it("calculates decoded data URL bytes", () => {
    expect(dataUrlByteLength(dataUrl)).toBe(4);
    expect(dataUrlDecodedBytes(dataUrl)).toBe(4);
  });

  it("removes preview data without mutating form state", () => {
    const input = inputWithPreview();
    const clean = createGenerationInput(input);
    expect(clean.uploadedAssets[0].previewUrl).toBeUndefined();
    expect(clean.uploadedAssets[0].dataUrl).toBe(dataUrl);
    expect(input.uploadedAssets[0].previewUrl).toBe(dataUrl);
  });

  it("serializes exactly one image copy", () => {
    const { payload, bytes } = serializeGenerationInput(inputWithPreview());
    expect(payload.match(/data:image\/jpeg;base64/g)).toHaveLength(1);
    expect(bytes).toBe(new TextEncoder().encode(payload).byteLength);
  });

  it("rejects invalid image data", () => {
    const input = inputWithPreview();
    input.uploadedAssets[0].dataUrl = "blob:invalid";
    expect(validateLessonImagePayload(input.uploadedAssets)).toContain("không hợp lệ");
  });
});
