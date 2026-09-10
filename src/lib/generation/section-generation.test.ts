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
import { validateStagedSectionPrefix, stagedArtifactAnchor } from "@/lib/generation/section-validation";
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
    const validation = validateStagedSectionPrefix({ input: mockInput, sourceFacts: res });
    expect(validation.issues.filter((i) => i.code === "SEC-HASH-MISMATCH")).toHaveLength(0);
  });

  it("repairs a phase in a single bounded AI call with valid anchor", async () => {
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
    expect(repairRes.artifact.anchor.hash).toBe(stagedArtifactAnchor(repairRes.artifact, 2).hash);
  });

  it("ensures all generated section artifacts match validation hash contracts", async () => {
    // 1. Source facts
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
    const sourceFacts = await generateStagedSourceFacts({
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

    // 2. Outcomes
    vi.spyOn(aiClient, "fetchAiJsonContent").mockResolvedValueOnce({
      content: JSON.stringify({
        generalObjectives: ["Nhận biết tam giác"],
        competencies: { general: ["Tự chủ"], specific: ["Tư duy toán học"] },
        qualities: ["Chăm chỉ"],
        objectiveMetadata: [{ id: "obj-1", category: "competency", text: "Nhận biết tam giác", statement: "Nhận biết tam giác", verb: "Nhận biết" }],
      }),
      model: "mock-model",
      provider: "openai",
      fallbackUsed: false,
    });
    const outcomes = await generateStagedOutcomes({ input: mockInput, sourceFacts, strategy: mockStrategy });

    // 3. Lesson map
    vi.spyOn(aiClient, "fetchAiJsonContent").mockResolvedValueOnce({
      content: JSON.stringify({
        totalPeriods: 1,
        macroFlow: ["Khám phá"],
        periods: [{ periodNumber: 1, title: "Tiết 1", focus: "Khám phá tam giác", mainObjectiveIds: ["obj-1"], sourceIds: ["src-1"] }],
      }),
      model: "mock-model",
      provider: "openai",
      fallbackUsed: false,
    });
    const lessonMap = await generateStagedLessonMap({ input: mockInput, sourceFacts, outcomes, strategy: mockStrategy });

    // 4. Period blueprint
    vi.spyOn(aiClient, "fetchAiJsonContent").mockResolvedValueOnce({
      content: JSON.stringify({
        periodNumber: 1,
        focus: "Khám phá tam giác",
        objectiveIds: ["obj-1"],
        sourceEvidenceIds: ["src-1"],
        phases: [
          { phase: "warmup", activityId: "p1-warmup", title: "Khởi động", durationMinutes: 5, objectiveIds: ["obj-1"], learningProducts: ["HS trả lời"], handoffToNext: "Khám phá" },
          { phase: "explore", activityId: "p1-explore", title: "Khám phá", durationMinutes: 15, objectiveIds: ["obj-1"], learningProducts: ["Hình vẽ"], handoffToNext: "Luyện tập" },
          { phase: "practice", activityId: "p1-practice", title: "Luyện tập", durationMinutes: 10, objectiveIds: ["obj-1"], learningProducts: ["Bài tập"], handoffToNext: "Vận dụng" },
          { phase: "apply", activityId: "p1-apply", title: "Vận dụng", durationMinutes: 5, objectiveIds: ["obj-1"], learningProducts: ["Sản phẩm"], handoffToNext: "Kết thúc" },
        ],
      }),
      model: "mock-model",
      provider: "openai",
      fallbackUsed: false,
    });
    const periodBlueprint = await generateStagedPeriodBlueprint({ input: mockInput, sourceFacts, outcomes, lessonMap, periodNumber: 1, strategy: mockStrategy });

    // 5. Materials
    vi.spyOn(aiClient, "fetchAiJsonContent").mockResolvedValueOnce({
      content: JSON.stringify({
        items: [{ id: "mat-1", name: "Thước kẻ", category: "teacher", purpose: "Vẽ hình", linkedObjectiveIds: ["obj-1"] }],
      }),
      model: "mock-model",
      provider: "openai",
      fallbackUsed: false,
    });
    const materials = await generateStagedMaterials({ input: mockInput, sourceFacts, outcomes, lessonMap, periodBlueprints: [periodBlueprint], strategy: mockStrategy });

    // 6. Phase
    vi.spyOn(aiClient, "fetchAiJsonContent").mockResolvedValueOnce({
      content: JSON.stringify({
        activity: {
          id: "p1-warmup",
          phase: "Khởi động",
          title: "Khởi động",
          objective: "Tạo hứng thú",
          durationMinutes: 5,
          teacherActions: ["GV đặt câu hỏi"],
          studentActions: ["HS quan sát"],
          learningProducts: ["Câu trả lời"],
          objectiveIds: ["obj-1"],
        },
        materialIds: ["mat-1"],
        sourceIds: ["src-1"],
        handoff: {
          activityId: "p1-warmup",
          knowledge: ["Tam giác"],
          products: ["Câu trả lời"],
          pending: [],
          bridge: "Vào khám phá",
          objectiveIds: ["obj-1"],
          sourceIds: ["src-1"],
          materialIds: ["mat-1"],
        },
      }),
      model: "mock-model",
      provider: "openai",
      fallbackUsed: false,
    });
    const phase = await generateStagedPhase({
      input: mockInput,
      sourceFacts,
      outcomes,
      lessonMap,
      materials,
      periodBlueprint,
      phase: "warmup",
      previousPhase: null,
      strategy: mockStrategy,
    });

    // 7. Assessment
    vi.spyOn(aiClient, "fetchAiJsonContent").mockResolvedValueOnce({
      content: JSON.stringify({
        assessment: {
          methods: ["Quan sát"],
          tools: ["Bảng kiểm"],
          criteria: [{ objectiveId: "obj-1", criterion: "Nhận biết 3 cạnh", method: "Quan sát", tool: "Bảng kiểm" }],
        },
        alignment: [{ objectiveId: "obj-1", activityIds: ["p1-warmup"], materialIds: ["mat-1"], sourceIds: ["src-1"], learningProducts: ["Câu trả lời"], successCriteria: ["Đúng"] }],
      }),
      model: "mock-model",
      provider: "openai",
      fallbackUsed: false,
    });
    const assessment = await generateStagedAssessment({
      input: mockInput,
      sourceFacts,
      outcomes,
      lessonMap,
      periodBlueprints: [periodBlueprint],
      materials,
      phases: [phase],
      strategy: mockStrategy,
    });

    const validation = validateStagedSectionPrefix({
      input: mockInput,
      sourceFacts,
      outcomes,
      lessonMap,
      periodBlueprints: [periodBlueprint],
      materials,
      phases: [phase],
      assessment,
    });

    const hashErrors = validation.issues.filter((i) => i.code === "SEC-HASH-MISMATCH");
    expect(hashErrors).toEqual([]);
    expect(validation.issues).toEqual([]);
    expect(validation.passed).toBe(true);
  });
});
