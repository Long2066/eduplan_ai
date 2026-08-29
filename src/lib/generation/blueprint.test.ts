import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PlanModelStrategy } from "@/lib/model-strategy";
import type { LessonInput } from "@/types/lesson";

const aiMocks = vi.hoisted(() => ({ fetchAiJsonContent: vi.fn() }));
vi.mock("@/lib/generation/ai-json-client", () => aiMocks);

import { generateStagedBlueprint } from "./blueprint";

function lessonInput(subject: string): LessonInput {
  return {
    subject,
    grade: "Lớp 3",
    lessonTitle: "Bài 12. Phép cộng có nhớ",
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
    uploadedAssets: [],
  };
}

const strategy = {
  plan: "free",
  blueprint: { stage: "blueprint", provider: "openai", model: "test-model", temperature: 0.3 },
  detail: { stage: "detail", provider: "openai", model: "test-model", temperature: 0.5 },
  repair: { stage: "repair", provider: "openai", model: "test-model", temperature: 0.4 },
} satisfies PlanModelStrategy;

function aiResult(content: unknown, model = "test-model") {
  return {
    content: JSON.stringify(content),
    model,
    provider: "openai" as const,
    fallbackUsed: false,
  };
}

function sourceFactsPayload(subject: string) {
  return {
    subject,
    grade: "Lớp 3",
    lessonTitle: "Bài 12. Phép cộng có nhớ",
    periods: 2,
    duration: 35,
    sourceEvidence: [{ id: "src-1", kind: "task", label: "Nhiệm vụ 1", page: "10", text: "Nội dung ảnh SGK", required: true }],
    objectivesFromSource: ["Nhận biết nội dung chính."],
    coreContent: ["Nội dung trọng tâm"],
    tasksFromSource: [{ id: "task-1", label: "Làm nhiệm vụ", expectedProduct: "Câu trả lời", expectedAnswer: "", page: "10", required: true }],
    visualsFromSource: [],
    uncertainties: [],
    conflicts: [],
    fatalIssues: [],
  };
}

function lessonMapPayload() {
  return {
    lessonTitle: "Bài 12. Phép cộng có nhớ",
    lessonOverview: "Mạch bài học",
    logicSpine: ["Nhận diện", "Thực hành"],
    outcomes: { generalCompetencies: [], specificCompetencies: [], qualities: [], knowledgeAndSkills: ["Hoàn thành nhiệm vụ."] },
    sourceAllocation: [{ sourceId: "task-1", periodNumber: 1, purpose: "Khám phá", allowReuse: false }],
    continuityPlan: {
      sourceUnits: [{ unitId: "u1", label: "Nhiệm vụ", kind: "task", page: "10", required: true, allowReuse: false, preferredPeriodNumber: 1, estimatedMinutes: 10, sourceEvidence: ["task-1"] }],
      clusters: [{ clusterId: "c1", label: "Cụm nhiệm vụ", sourceUnitIds: ["u1"], periodNumber: 1, mustStayTogether: true, prerequisiteClusterIds: [], estimatedMinutes: 10, expectedProduct: "Câu trả lời" }],
      warnings: [],
    },
    periods: [
      { periodNumber: 1, focus: "Tiết 1", objectives: ["Nhận diện"], targetKnowledge: "Kiến thức 1", sourceIds: ["task-1"], continuityIn: "Mở đầu", continuityOut: "Sang tiết 2", assessmentEvidence: ["Câu trả lời"] },
      { periodNumber: 2, focus: "Tiết 2", objectives: ["Thực hành"], targetKnowledge: "Kiến thức 2", sourceIds: [], continuityIn: "Từ tiết 1", continuityOut: "Hoàn thành", assessmentEvidence: ["Sản phẩm"] },
    ],
    risks: [],
  };
}

function sourceTruth(subject: string) {
  return {
    version: 1 as const,
    subject,
    grade: "Lớp 3",
    lessonTitle: "Bài 12. Phép cộng có nhớ",
    periods: 2,
    sourceHashes: [],
    ocrExcerpt: "Nội dung ảnh SGK",
    pageNumbers: [],
    titleCandidates: [],
    tasks: [],
    visuals: [],
    uncertain: [],
  };
}

describe("staged generation blueprint", () => {
  beforeEach(() => vi.clearAllMocks());

  it("keeps non-chunked subjects on the legacy direct-generation path", async () => {
    const result = await generateStagedBlueprint(
      lessonInput("Đạo đức"),
      "",
      { subjectKind: "default", ocrSourceHashes: [], sourceTruth: sourceTruth("Đạo đức"), warnings: [] },
      strategy,
    );
    expect(result).toMatchObject({
      subjectKind: "default",
      mode: "direct-generation",
      blueprint: { directGeneration: true, periods: 2 },
    });
    expect(aiMocks.fetchAiJsonContent).not.toHaveBeenCalled();
  });

  it("uses the existing math blueprint prompt and model stage", async () => {
    aiMocks.fetchAiJsonContent
      .mockResolvedValueOnce(aiResult(sourceFactsPayload("Toán"), "facts-model"))
      .mockResolvedValueOnce(aiResult(lessonMapPayload(), "map-model"))
      .mockResolvedValueOnce(aiResult({ lessonTitle: "Phép cộng", periods: [{ periodNumber: 1 }, { periodNumber: 2 }] }, "blueprint-model"));
    const result = await generateStagedBlueprint(
      lessonInput("Toán"),
      "Nội dung ảnh SGK",
      { subjectKind: "math", ocrSourceHashes: [], sourceTruth: sourceTruth("Toán"), warnings: [] },
      strategy,
    );
    expect(result).toMatchObject({ subjectKind: "math", mode: "chunked", model: "facts-model + map-model + blueprint-model" });
    expect(aiMocks.fetchAiJsonContent).toHaveBeenCalledTimes(3);
    expect(aiMocks.fetchAiJsonContent.mock.calls[0][1]).toEqual(expect.arrayContaining([expect.objectContaining({
      role: "user",
      content: expect.stringContaining("REQUEST 1/3"),
    })]));
    expect(aiMocks.fetchAiJsonContent.mock.calls[1][1]).toEqual(expect.arrayContaining([expect.objectContaining({
      role: "user",
      content: expect.stringContaining("REQUEST 2/3"),
    })]));
    expect(aiMocks.fetchAiJsonContent.mock.calls[2][0]).toBe(strategy.blueprint);
    expect(aiMocks.fetchAiJsonContent.mock.calls[2][1]).toEqual(expect.arrayContaining([expect.objectContaining({
      role: "user",
      content: expect.stringContaining("LESSON_MAP_JSON"),
    })]));
    expect(result.sourceTruth).toMatchObject({ subject: "Toán" });
    expect(result.sourceFacts).toMatchObject({
      subject: "Toán",
      lessonTitle: "Bài 12. Phép cộng có nhớ",
    });
    expect(result.lessonMap).toMatchObject({ lessonTitle: "Bài 12. Phép cộng có nhớ" });
    expect(result.blueprint).toMatchObject({ lessonTitle: "Bài 12. Phép cộng có nhớ" });
    expect(result.blueprintPipeline?.lessonMap.model).toBe("map-model");
  });

  it("merges cached Vietnamese source inventory into the generated blueprint", async () => {
    aiMocks.fetchAiJsonContent
      .mockResolvedValueOnce(aiResult(sourceFactsPayload("Tiếng Việt")))
      .mockResolvedValueOnce(aiResult(lessonMapPayload()))
      .mockResolvedValueOnce(aiResult({ sourceInventory: { readingVocabulary: ["từ mới"] }, periods: [{ periodNumber: 1 }, { periodNumber: 2 }] }));
    const result = await generateStagedBlueprint(
      lessonInput("Tiếng Việt"),
      "Nội dung đọc",
      {
        subjectKind: "vietnamese",
        ocrSourceHashes: [],
        sourceTruth: sourceTruth("Tiếng Việt"),
        warnings: [],
        vietnamese: {
          lessonKey: "lesson-key",
          verifiedStatus: "verified",
          sourceHashes: [],
          inventory: { readingText: ["Đoạn đọc"] },
        },
      },
      strategy,
    );
    expect(result.subjectKind).toBe("vietnamese");
    expect(result.sourceInventory).toMatchObject({
      readingText: ["Đoạn đọc"],
      readingVocabulary: ["từ mới"],
    });
    expect(aiMocks.fetchAiJsonContent).toHaveBeenCalledTimes(3);
  });

  it("rejects a lesson map that does not preserve the requested period count", async () => {
    aiMocks.fetchAiJsonContent
      .mockResolvedValueOnce(aiResult(sourceFactsPayload("Toán")))
      .mockResolvedValueOnce(aiResult({ ...lessonMapPayload(), periods: [{ periodNumber: 1, focus: "Chỉ có một tiết" }] }));

    await expect(generateStagedBlueprint(
      lessonInput("Toán"),
      "Nội dung ảnh SGK",
      { subjectKind: "math", ocrSourceHashes: [], sourceTruth: sourceTruth("Toán"), warnings: [] },
      strategy,
    )).rejects.toThrow("lessonMap phải có đúng 2 tiết");
  });
});
