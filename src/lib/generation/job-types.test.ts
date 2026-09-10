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
    expect(generationArtifactDocumentId({ kind: "period-blueprint", sequence: 2 })).toBe("period-blueprint-0002");
    expect(generationArtifactDocumentId({ kind: "period-phase", sequence: 5 })).toBe("period-phase-0005");
    expect(generationArtifactDocumentId({ kind: "phase-repair", sequence: 6 })).toBe("phase-repair-0006");
    expect(generationArtifactDocumentId({ kind: "period" })).toBe("period-0001");
    expect(generationArtifactSequence({ kind: "period" })).toBe(1);
    expect(generationArtifactSequence({ kind: "ocr", sequence: 9 })).toBeNull();
    expect(generationArtifactSequence({ kind: "repair", sequence: Number.POSITIVE_INFINITY })).toBe(1);
  });

  it("calculates staged-v2 progress units and flat phase index correctly without slashes", () => {
    // staged-v1 backward compatibility
    expect(initialGenerationJobProgress(2).totalUnits).toBe(11);
    // staged-v2 fine-grained units: 13 + 5 * periods
    expect(initialGenerationJobProgress(2, "staged-v2").totalUnits).toBe(23);

    // flat phase index formula: (period - 1) * 4 + phaseIndex + 1
    const flatIndex = (period: number, phaseIndex: number) => (period - 1) * 4 + phaseIndex + 1;
    expect(flatIndex(1, 0)).toBe(1); // Tiết 1 Pha 1 (Khởi động)
    expect(flatIndex(1, 3)).toBe(4); // Tiết 1 Pha 4 (Vận dụng)
    expect(flatIndex(2, 0)).toBe(5); // Tiết 2 Pha 1 (Khởi động)
    expect(flatIndex(2, 3)).toBe(8); // Tiết 2 Pha 4 (Vận dụng)

    const docId = generationArtifactDocumentId({ kind: "period-phase", sequence: flatIndex(2, 0) });
    expect(docId).toBe("period-phase-0005");
    expect(docId).not.toContain("/");
  });

  it("normalizes invalid period counts", () => {
    const input = lessonInput();
    input.periods = Number.NaN;
    expect(summarizeGenerationJobInput(input).periods).toBe(1);
    expect(initialGenerationJobProgress(Number.NaN)).toMatchObject({ totalPeriods: 1, totalUnits: 10 });
    expect(initialGenerationJobProgress(Number.NaN, "staged-v2")).toMatchObject({ totalPeriods: 1, totalUnits: 18 });
  });

  it("rejects artifacts too close to the Firestore document limit", () => {
    expect(() => assertGenerationArtifactSize({ content: "x".repeat(MAX_GENERATION_ARTIFACT_BYTES) })).toThrow(/vượt giới hạn/);
  });
});
