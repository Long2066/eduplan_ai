import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StagedBlueprintArtifact } from "./blueprint";
import type { PlanModelStrategy } from "@/lib/model-strategy";
import type { LessonInput } from "@/types/lesson";

const aiMocks = vi.hoisted(() => ({ fetchAiJsonContent: vi.fn() }));

vi.mock("@/lib/generation/ai-json-client", () => ({
  fetchAiJsonContent: aiMocks.fetchAiJsonContent,
}));

import { generateStagedPeriod } from "./period-generation";

const strategy = {
  plan: "free",
  blueprint: { stage: "blueprint", provider: "openai", model: "blueprint-model", temperature: 0.3 },
  detail: { stage: "detail", provider: "openai", model: "detail-model", temperature: 0.5 },
  repair: { stage: "repair", provider: "openai", model: "repair-model", temperature: 0.3 },
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

function artifact(
  subjectKind: StagedBlueprintArtifact["subjectKind"],
  blueprint: StagedBlueprintArtifact["blueprint"],
  overrides: Partial<StagedBlueprintArtifact> = {},
): StagedBlueprintArtifact {
  return {
    subjectKind,
    mode: subjectKind === "default" ? "direct-generation" : "chunked",
    model: "blueprint-model",
    provider: "openai",
    fallbackUsed: false,
    promptSource: "ocr",
    blueprint,
    ...overrides,
  };
}

function aiPeriod(periodNumber = 1) {
  return JSON.stringify({
    periodNumber,
    focus: `Trọng tâm tiết ${periodNumber}`,
    activities: [{ phase: "Khởi động", title: "Mở đầu", teacherActions: ["GV giao nhiệm vụ"], studentActions: ["HS thực hiện"] }],
    handoff: { learned: `Đã học tiết ${periodNumber}`, unresolvedRisks: [], nextBridge: "Học tiếp" },
  });
}

describe("staged period generation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    aiMocks.fetchAiJsonContent.mockResolvedValue({
      content: aiPeriod(1),
      model: "detail-model",
      provider: "openai",
      fallbackUsed: false,
    });
  });

  it("normalizes a missing math descriptor and generates only the requested period", async () => {
    aiMocks.fetchAiJsonContent.mockResolvedValue({
      content: aiPeriod(2), model: "detail-model", provider: "openai", fallbackUsed: false,
    });

    const result = await generateStagedPeriod(
      lessonInput(),
      "Nội dung ảnh SGK",
      artifact("math", {}),
      2,
      { learned: "Đã xong tiết 1", nextBridge: "Sang tiết 2" },
      strategy,
    );

    expect(result.periodNumber).toBe(2);
    expect(result.period.periodNumber).toBe(2);
    expect(result.handoff?.learned).toBe("Đã học tiết 2");
    expect(aiMocks.fetchAiJsonContent).toHaveBeenCalledOnce();
    const messages = aiMocks.fetchAiJsonContent.mock.calls[0][1];
    expect(messages[1].content).toContain('"periodNumber":2');
    expect(messages[1].content).toContain("Đã xong tiết 1");
  });

  it("uses the stored Vietnamese classification when a period descriptor is incomplete", async () => {
    const result = await generateStagedPeriod(
      lessonInput("Tiếng Việt"),
      "Bài đọc trong SGK",
      artifact("vietnamese", { periods: [{}] }, { classification: { primaryType: "reading" } }),
      1,
      null,
      strategy,
    );

    expect(result.subjectKind).toBe("vietnamese");
    const messages = aiMocks.fetchAiJsonContent.mock.calls[0][1];
    expect(messages[0].content).toContain("kiểu bài reading");
    expect(messages[1].content).toContain('"lessonType":"reading"');
  });

  it("uses the stored Natural and Social Studies classification", async () => {
    const result = await generateStagedPeriod(
      lessonInput("Tự nhiên và Xã hội"),
      "Tranh gia đình",
      artifact("natural-social", { periods: [{}] }, { classification: { primaryType: "family" } }),
      1,
      null,
      strategy,
    );

    expect(result.subjectKind).toBe("natural-social");
    const messages = aiMocks.fetchAiJsonContent.mock.calls[0][1];
    expect(messages[0].content).toContain("chủ đề family");
    expect(messages[1].content).toContain('"lessonType":"family"');
  });

  it("extracts one period from a default-subject LessonPlan response", async () => {
    aiMocks.fetchAiJsonContent.mockResolvedValue({
      content: JSON.stringify({
        periodPlans: [
          JSON.parse(aiPeriod(1)),
          JSON.parse(aiPeriod(2)),
        ],
      }),
      model: "fallback-model",
      provider: "openrouter",
      fallbackUsed: true,
    });

    const result = await generateStagedPeriod(
      lessonInput("Đạo đức"),
      "Nội dung bài học",
      artifact("default", { subject: "Đạo đức", lessonTitle: "Bài 3. Quan tâm hàng xóm láng giềng", periods: 2, directGeneration: true }),
      2,
      null,
      strategy,
    );

    expect(result.period.periodNumber).toBe(2);
    expect(result.provider).toBe("openrouter");
    expect(result.fallbackUsed).toBe(true);
    const messages = aiMocks.fetchAiJsonContent.mock.calls[0][1];
    expect(messages[1].content).toContain("Chỉ tạo riêng tiết 2/2");
  });

  it("fails retryably when AI returns a period without activities", async () => {
    aiMocks.fetchAiJsonContent.mockResolvedValue({
      content: '{"periodNumber":1,"focus":"Thiếu hoạt động"}',
      model: "detail-model",
      provider: "openai",
      fallbackUsed: false,
    });

    await expect(generateStagedPeriod(
      lessonInput(),
      "Nội dung ảnh SGK",
      artifact("math", { periods: [{ periodNumber: 1 }] }),
      1,
      null,
      strategy,
    )).rejects.toThrow("chưa trả đủ hoạt động cho tiết 1");
  });
});
