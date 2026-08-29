import { describe, expect, it } from "vitest";
import type { LessonInput } from "@/types/lesson";
import {
  deletePersistedGenerationInput,
  lessonInputFromPersisted,
  persistGenerationInput,
} from "./input-storage";

function lessonInput(): LessonInput {
  return {
    subject: "Toán",
    grade: "Lớp 3",
    lessonTitle: "Phép cộng",
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
    uploadedAssets: [{
      id: "asset-1",
      name: "page.png",
      type: "image",
      order: 1,
      dataUrl: "data:image/png;base64,YWJj",
      previewUrl: "blob:preview",
    }],
  };
}

describe("generation input persistence", () => {
  it("persists only image metadata without Firebase Storage or base64", async () => {
    const persisted = await persistGenerationInput("user-1", "job-1", lessonInput());

    expect(persisted.uploadedAssets[0]).toEqual({
      id: "asset-1",
      name: "page.png",
      type: "image",
      order: 1,
      mimeType: "image/png",
    });
  });

  it("reconstructs lesson input metadata for post-OCR stages", async () => {
    const persisted = await persistGenerationInput("user-1", "job-1", lessonInput());
    const restored = lessonInputFromPersisted(persisted);

    expect(restored.uploadedAssets).toEqual(persisted.uploadedAssets);
    expect(restored.uploadedAssets[0]).not.toHaveProperty("dataUrl");
  });

  it("needs no terminal image cleanup", async () => {
    const persisted = await persistGenerationInput("user-1", "job-1", lessonInput());
    await expect(deletePersistedGenerationInput("user-1", "job-1", persisted)).resolves.toBeUndefined();
  });
});
