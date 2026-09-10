import { describe, expect, it, vi } from "vitest";
import {
  generateStagedSourceFacts,
  generateStagedOutcomes,
  generateStagedLessonMap,
  generateStagedPeriodBlueprint,
  generateStagedMaterials,
  generateStagedAssessment,
} from "@/lib/generation/section-generation";
import { generateStagedPhase, repairStagedPhase } from "@/lib/generation/phase-generation";
import * as aiClient from "@/lib/generation/ai-json-client";
import type { LessonInput } from "@/types/lesson";
import type { PlanModelStrategy } from "@/lib/model-strategy";

const mockInput: LessonInput = {
  subject: "Toán",
  grade: "Lớp 3",
  lessonTitle: "Hình tam giác",
  book: "Cánh Diều",
  bookVolume: "Tập 1",
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
  uploadedAssets: [],
};

const mockStrategy: PlanModelStrategy = {
  plan: "plus",
  blueprint: { stage: "blueprint", provider: "openai", model: "mock-model", temperature: 0.3 },
  detail: { stage: "detail", provider: "openai", model: "mock-model", temperature: 0.5 },
  repair: { stage: "repair", provider: "openai", model: "mock-model", temperature: 0.3 },
};

describe("staged-v2 generation & repair functions", () => {
  it("generates source facts with locked title", async () => {
    vi.spyOn(aiClient, "fetchAiJsonContent").mockResolvedValueOnce({
      content: JSON.stringify({
        lessonTitle: "Hình tam giác",
        coreContent: ["3 đỉnh, 3 cạnh"],
        objectivesFromSource: ["Nhận biết tam giác"],
        sourceEvidence: [{ id: "src-1", kind: "task", label: "Bài 1", text: "Nêu đỉnh", page: "1", required: true, allowReuse: false }],
        uncertainties: [],
        conflicts: [],
        fatalIssues: [],
      }),
      model: "mock-model",
      provider: "openai",
      fallbackUsed: false,
    });

    const res = await generateStagedSourceFacts({
      input: mockInput,
      ocrText: "Hình tam giác",
      sourceContext: {
        subjectKind: "math",
        ocrSourceHashes: ["h1"],
        sourceTruth: {
          version: 1,
          subject: "Toán",
          grade: "Lớp 3",
          lessonTitle: "Hình tam giác",
          periods: 1,
          sourceHashes: ["h1"],
          ocrExcerpt: "",
          pageNumbers: ["1"],
          titleCandidates: ["Hình tam giác"],
          tasks: [],
          visuals: [],
          uncertain: [],
        },
        warnings: [],
      },
      strategy: mockStrategy,
    });

    expect(res.identity.lessonTitle).toBe("Hình tam giác");
    expect(res.facts.sourceEvidence).toHaveLength(1);
    expect(res.anchor.hash).toBeDefined();
  });

  it("repairs a phase in a single bounded AI call", async () => {
    vi.spyOn(aiClient, "fetchAiJsonContent").mockResolvedValueOnce({
      content: JSON.stringify({
        activity: {
          id: "p1-warmup",
          phase: "Khởi động",
          title: "Khởi động sửa",
          objective: "Tạo hứng thú",
          durationMinutes: 5,
          teacherActions: ["GV đặt câu đố"],
          studentActions: ["HS trả lời"],
          learningProducts: ["Câu trả lời"],
          objectiveIds: ["obj-1"],
        },
        materialIds: ["mat-1"],
        sourceIds: [],
        handoff: {
          activityId: "p1-warmup",
          knowledge: ["Nhận diện"],
          products: [],
          pending: [],
          bridge: "Vào bài",
          objectiveIds: ["obj-1"],
          sourceIds: [],
          materialIds: ["mat-1"],
        },
      }),
      model: "mock-repair",
      provider: "openai",
      fallbackUsed: false,
    });

    const currentPhase: any = {
      version: 2,
      kind: "period-phase",
      identity: { subject: "Toán", grade: "Lớp 3", lessonTitle: "Hình tam giác", periods: 1, duration: 35, sourceHashes: [] },
      anchor: { revision: 1, hash: "prev-hash" },
      periodNumber: 1,
      phase: "warmup",
      activity: { id: "p1-warmup", phase: "Khởi động", title: "Khởi động cũ", objective: "", teacherActions: [], studentActions: [] },
      materialIds: [],
      sourceIds: [],
      handoff: {},
    };

    const repairRes = await repairStagedPhase({
      currentPhase,
      issues: [{ code: "SEC-PHASE-ACTIONS-EMPTY", message: "Thiếu hoạt động", path: "activity" }],
      input: mockInput,
      sourceFacts: { identity: currentPhase.identity } as any,
      outcomes: { outcomes: { objectiveMetadata: [{ id: "obj-1" }] } } as any,
      materials: { items: [{ id: "mat-1" }] } as any,
      lessonMap: {} as any,
      periodBlueprint: {} as any,
      phase: "warmup",
      previousPhase: null,
      strategy: mockStrategy,
    });

    expect(repairRes.repaired).toBe(true);
    expect(repairRes.artifact.anchor.revision).toBe(2);
    expect(repairRes.artifact.activity.teacherActions).toHaveLength(1);
  });
});
