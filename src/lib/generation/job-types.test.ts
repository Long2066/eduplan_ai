import { describe, expect, it } from "vitest";
import {
  MAX_GENERATION_ARTIFACT_BYTES,
  assertGenerationArtifactSize,
  generationArtifactDocumentId,
  generationArtifactSequence,
  initialGenerationJobProgress,
  summarizeGenerationJobInput,
} from "./job-types";
import type { LessonInput } from "@/types/lesson";

function lessonInput(): LessonInput {
  return {
    subject: "Toán",
    grade: "Lớp 3",
    lessonTitle: "Phép cộng",
    book: "Kết nối tri thức",
    bookVolume: "auto",
    periods: 2,
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
    uploadedAssets: [{ id: "asset-1", name: "page.png", type: "image", dataUrl: "data:image/png;base64,abc" }],
  };
}

describe("generation job types", () => {
  it("stores only small input metadata on the main job document", () => {
    expect(summarizeGenerationJobInput(lessonInput())).toEqual({
      subject: "Toán",
      grade: "Lớp 3",
      lessonTitle: "Phép cộng",
      periods: 2,
      assetCount: 1,
    });
    expect(initialGenerationJobProgress(2).totalUnits).toBe(11);
  });

  it("creates stable artifact document ids", () => {
    expect(generationArtifactDocumentId({ kind: "ocr" })).toBe("ocr");
    expect(generationArtifactDocumentId({ kind: "period", sequence: 3 })).toBe("period-0003");
    expect(generationArtifactDocumentId({ kind: "repair", sequence: 2 })).toBe("repair-0002");
    expect(generationArtifactDocumentId({ kind: "ocr-page", sequence: 2 })).toBe("ocr-page-0002");
    expect(generationArtifactDocumentId({ kind: "period" })).toBe("period-0001");
    expect(generationArtifactSequence({ kind: "period" })).toBe(1);
    expect(generationArtifactSequence({ kind: "ocr", sequence: 9 })).toBeNull();
    expect(generationArtifactSequence({ kind: "repair", sequence: Number.POSITIVE_INFINITY })).toBe(1);
  });

  it("normalizes invalid period counts", () => {
    const input = lessonInput();
    input.periods = Number.NaN;
    expect(summarizeGenerationJobInput(input).periods).toBe(1);
    expect(initialGenerationJobProgress(Number.NaN)).toMatchObject({ totalPeriods: 1, totalUnits: 10 });
  });

  it("rejects artifacts too close to the Firestore document limit", () => {
    expect(() => assertGenerationArtifactSize({ content: "x".repeat(MAX_GENERATION_ARTIFACT_BYTES) })).toThrow(/vượt giới hạn/);
  });
});
