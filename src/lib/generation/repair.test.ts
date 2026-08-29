import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StagedBlueprintArtifact } from "./blueprint";
import type { StagedPeriodArtifact } from "./period-generation";
import type { PlanModelStrategy } from "@/lib/model-strategy";
import type { LessonInput, PedagogyAuditFinding, PeriodPlan } from "@/types/lesson";

const aiMocks = vi.hoisted(() => ({ fetchAiJsonContent: vi.fn() }));
const validationMocks = vi.hoisted(() => ({ validateStagedLesson: vi.fn() }));

vi.mock("@/lib/generation/ai-json-client", () => ({
  fetchAiJsonContent: aiMocks.fetchAiJsonContent,
}));
vi.mock("@/lib/generation/subject-validation", () => ({
  validateStagedLesson: validationMocks.validateStagedLesson,
}));

import { reassembleStagedRepairs, repairStagedPeriod } from "./repair";

const strategy = {
  plan: "plus",
  blueprint: { stage: "blueprint", provider: "openai", model: "blueprint-model", temperature: 0.3 },
  detail: { stage: "detail", provider: "openai", model: "detail-model", temperature: 0.5 },
  repair: { stage: "repair", provider: "openai", model: "repair-model", temperature: 0.4 },
} satisfies PlanModelStrategy;

function lessonInput(subject = "Toán"): LessonInput {
  return {
    subject,
    grade: "Lớp 3",
    lessonTitle: "Bài học thử nghiệm",
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

function blueprint(
  subjectKind: StagedBlueprintArtifact["subjectKind"],
  value: StagedBlueprintArtifact["blueprint"],
  overrides: Partial<StagedBlueprintArtifact> = {},
): StagedBlueprintArtifact {
  return {
    subjectKind,
    mode: subjectKind === "default" ? "direct-generation" : "chunked",
    model: "blueprint-model",
    provider: "openai",
    fallbackUsed: false,
    promptSource: "ocr",
    blueprint: value,
    ...overrides,
  };
}

function currentPeriod(periodNumber = 1): PeriodPlan {
  return {
    periodNumber,
    focus: `Trọng tâm tiết ${periodNumber}`,
    outcomes: {
      generalCompetencies: ["Tự chủ"],
      specificCompetencies: ["Năng lực môn học"],
      qualities: ["Chăm chỉ"],
      knowledgeAndSkills: ["Nêu được nội dung bài học"],
    },
    activities: [{
      phase: "Khởi động",
      title: "Bản cũ",
      objective: "Khởi động bài học",
      teacherActions: ["GV giao nhiệm vụ"],
      studentActions: ["HS thực hiện"],
    }],
    handoff: { learned: "Kiến thức cũ", nextBridge: "Sang tiết tiếp theo" },
  };
}

function repairedJson(periodNumber = 1) {
  return JSON.stringify({
    periodNumber,
    focus: `Trọng tâm tiết ${periodNumber}`,
    activities: [{
      phase: "Khởi động",
      title: "Bản đã sửa",
      objective: "Khởi động đúng yêu cầu",
      teacherActions: ["GV giao nhiệm vụ rõ ràng"],
      studentActions: ["HS thực hiện nhiệm vụ rõ ràng"],
    }],
    handoff: { learned: "Kiến thức đã sửa", unresolvedRisks: [], nextBridge: "Tiếp tục bài học" },
  });
}

function finding(periodNumber = 1): PedagogyAuditFinding {
  return {
    code: "QUALITY-01",
    severity: "error",
    message: "Thiếu hoạt động cụ thể",
    periodNumber,
    autoFixable: true,
  };
}

function periodArtifact(periodNumber: number): StagedPeriodArtifact {
  const period = currentPeriod(periodNumber);
  return {
    subjectKind: "math",
    periodNumber,
    model: "detail-model",
    provider: "openai",
    fallbackUsed: false,
    period,
    handoff: period.handoff || null,
  };
}

describe("staged period repair", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    aiMocks.fetchAiJsonContent.mockResolvedValue({
      content: repairedJson(),
      model: "repair-model",
      provider: "openai",
      fallbackUsed: false,
    });
    validationMocks.validateStagedLesson.mockReturnValue({ summary: { errors: 0 } });
  });

  it("repairs one Math period with the existing subject prompt", async () => {
    const current = currentPeriod();
    current.activities[0] = {
      ...current.activities[0],
      id: "activity-1",
      objectiveIds: ["objective-1"],
      sourceTaskIds: ["task-1"],
      sourceVisualIds: ["visual-1"],
    };
    const repairedPayload = JSON.parse(repairedJson()) as { activities: Array<Record<string, unknown>> };
    repairedPayload.activities[0] = {
      ...repairedPayload.activities[0],
      objectiveIds: ["objective-injected"],
      sourceTaskIds: ["task-injected"],
      sourceVisualIds: ["visual-injected"],
    };
    aiMocks.fetchAiJsonContent.mockResolvedValue({
      content: JSON.stringify(repairedPayload),
      model: "repair-model",
      provider: "openai",
      fallbackUsed: false,
    });
    const result = await repairStagedPeriod(
      lessonInput(),
      "Nội dung ảnh SGK",
      blueprint("math", { periods: [{ periodNumber: 1, focus: "Phép cộng" }] }),
      current,
      null,
      [finding()],
      1,
      strategy,
    );

    expect(result).toMatchObject({
      subjectKind: "math",
      targetIndex: 1,
      periodNumber: 1,
      findingCodes: ["QUALITY-01"],
      model: "repair-model",
    });
    expect(result.period.activities[0].title).toBe("Bản đã sửa");
    expect(result.period.activities[0]).toMatchObject({
      id: "activity-1",
      objectiveIds: ["objective-1"],
      sourceTaskIds: ["task-1"],
      sourceVisualIds: ["visual-1"],
    });
    expect(result.period.outcomes).toEqual(currentPeriod().outcomes);
    const messages = aiMocks.fetchAiJsonContent.mock.calls[0][1];
    expect(messages[0].content).toContain("PeriodPlan môn Toán");
    expect(messages[1].content).toContain("QUALITY-01");
  });

  it.each([
    ["vietnamese", "Tiếng Việt", "PeriodPlan Tiếng Việt"],
    ["natural-social", "Tự nhiên và Xã hội", "PeriodPlan Tự nhiên và Xã hội"],
  ] as const)("uses the %s subject-specific repair prompt", async (subjectKind, subject, systemText) => {
    await repairStagedPeriod(
      lessonInput(subject),
      "Nội dung ảnh SGK",
      blueprint(subjectKind, { periods: [{ periodNumber: 1 }] }, { classification: { primaryType: "mixed" } }),
      currentPeriod(),
      null,
      [finding()],
      1,
      strategy,
    );

    const messages = aiMocks.fetchAiJsonContent.mock.calls[0][1];
    expect(messages[0].content).toContain(systemText);
    expect(messages[1].content).toContain("QUALITY-01");
  });

  it("extracts a repaired default period from a LessonPlan response", async () => {
    aiMocks.fetchAiJsonContent.mockResolvedValue({
      content: JSON.stringify({ periodPlans: [JSON.parse(repairedJson(1)), JSON.parse(repairedJson(2))] }),
      model: "fallback-model",
      provider: "openrouter",
      fallbackUsed: true,
    });
    const result = await repairStagedPeriod(
      lessonInput("Đạo đức"),
      "Nội dung ảnh SGK",
      blueprint("default", { subject: "Đạo đức", lessonTitle: "Bài 3. Quan tâm hàng xóm láng giềng", periods: 2, directGeneration: true }),
      currentPeriod(2),
      { learned: "Đã hoàn thành tiết 1", nextBridge: "Sang tiết 2" },
      [finding(2)],
      2,
      strategy,
    );

    expect(result.periodNumber).toBe(2);
    expect(result.provider).toBe("openrouter");
    expect(result.fallbackUsed).toBe(true);
    const messages = aiMocks.fetchAiJsonContent.mock.calls[0][1];
    expect(messages[1].content).toContain("Sửa riêng PeriodPlan");
    expect(messages[1].content).toContain("Nội dung ảnh SGK");
    expect(messages[1].content).toContain("Đã hoàn thành tiết 1");
  });

  it("rejects an AI repair that removes all activities", async () => {
    aiMocks.fetchAiJsonContent.mockResolvedValue({
      content: '{"periodNumber":1,"focus":"Không đủ"}',
      model: "repair-model",
      provider: "openai",
      fallbackUsed: false,
    });
    await expect(repairStagedPeriod(
      lessonInput(),
      "OCR",
      blueprint("math", { periods: [] }),
      currentPeriod(),
      null,
      [finding()],
      1,
      strategy,
    )).rejects.toThrow("chưa trả đủ hoạt động sau khi sửa tiết 1");
  });

  it("replaces repaired periods and marks the new assembly as repaired", () => {
    validationMocks.validateStagedLesson
      .mockReturnValueOnce({ summary: { errors: 1 } })
      .mockReturnValueOnce({ summary: { errors: 0 } });
    const originals = [periodArtifact(1), periodArtifact(2)];
    const repaired = {
      ...periodArtifact(2),
      targetIndex: 1,
      findingCodes: ["QUALITY-01"],
      findingCount: 1,
      model: "repair-model",
      period: { ...currentPeriod(2), activities: [{ ...currentPeriod(2).activities[0], title: "Tiết 2 đã sửa" }] },
    };
    const result = reassembleStagedRepairs(
      lessonInput(),
      blueprint("math", { periods: [] }),
      originals,
      [repaired],
      "plus",
    );

    expect(result.repairApplied).toBe(true);
    expect(result.lesson.periodPlans?.[0].activities[0].title).toBe("Bản cũ");
    expect(result.lesson.periodPlans?.[1].activities[0].title).toBe("Tiết 2 đã sửa");
    expect(result.lesson.meta.modelUsed).toBe("repair-model");
  });

  it("keeps the original assembly when AI repair increases blocking errors", () => {
    validationMocks.validateStagedLesson
      .mockReturnValueOnce({ summary: { errors: 1 } })
      .mockReturnValueOnce({ summary: { errors: 2 } });
    const originals = [periodArtifact(1), periodArtifact(2)];
    const repaired = {
      ...periodArtifact(2),
      targetIndex: 1,
      findingCodes: ["QUALITY-01"],
      findingCount: 1,
      model: "repair-model",
      period: { ...currentPeriod(2), activities: [{ ...currentPeriod(2).activities[0], title: "Bản sửa tệ hơn" }] },
    };

    const result = reassembleStagedRepairs(
      lessonInput(),
      blueprint("math", { periods: [] }),
      originals,
      [repaired],
      "plus",
    );

    expect(result.repairApplied).toBe(false);
    expect(result.lesson.periodPlans?.[1].activities[0].title).toBe("Bản cũ");
  });

  it("keeps the original assembly when AI repair does not reduce blocking errors", () => {
    validationMocks.validateStagedLesson
      .mockReturnValueOnce({ summary: { errors: 1 } })
      .mockReturnValueOnce({ summary: { errors: 1 } });
    const originals = [periodArtifact(1), periodArtifact(2)];
    const repaired = {
      ...periodArtifact(2),
      targetIndex: 1,
      findingCodes: ["QUALITY-01"],
      findingCount: 1,
      model: "repair-model",
      period: { ...currentPeriod(2), activities: [{ ...currentPeriod(2).activities[0], title: "Bản sửa không cải thiện" }] },
    };

    const result = reassembleStagedRepairs(
      lessonInput(),
      blueprint("math", { periods: [] }),
      originals,
      [repaired],
      "plus",
    );

    expect(result.repairApplied).toBe(false);
    expect(result.lesson.periodPlans?.[1].activities[0].title).toBe("Bản cũ");
  });
});
