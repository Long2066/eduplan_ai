import { describe, expect, it } from "vitest";
import {
  computeStagedDataHash,
  makeStagedAnchor,
  validateStagedSections,
  assertStagedSections,
  getStagedSourceFactsPayload,
  getStagedOutcomesPayload,
  getStagedLessonMapPayload,
  getStagedPeriodBlueprintPayload,
  getStagedMaterialsPayload,
  getStagedPhasePayload,
  getStagedAssessmentPayload,
} from "@/lib/generation/section-validation";
import { assembleStagedSections } from "@/lib/generation/section-assembly";
import type {
  StagedAssessmentArtifact,
  StagedLessonMapArtifact,
  StagedMaterialsArtifact,
  StagedOutcomesArtifact,
  StagedPeriodBlueprintArtifact,
  StagedPhaseArtifact,
  StagedSectionArtifacts,
  StagedSourceFactsArtifact,
} from "@/lib/generation/section-types";
import type { LessonInput } from "@/types/lesson";

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

function createValidSectionFixtures(): StagedSectionArtifacts & { input: LessonInput } {
  const identity = {
    subject: "Toán",
    grade: "Lớp 3",
    lessonTitle: "Hình tam giác",
    periods: 1,
    duration: 35,
    sourceHashes: ["hash-1"],
  };

  const facts = {
    lessonTitle: "Hình tam giác",
    coreContent: ["Nhận biết ba đỉnh, ba cạnh của hình tam giác."],
    objectivesFromSource: ["Nhận biết góc, đỉnh, cạnh."],
    sourceEvidence: [
      { id: "src-1", kind: "task" as const, label: "Bài 1", text: "Quan sát hình", page: "12", required: true, allowReuse: false },
      { id: "src-2", kind: "visual" as const, label: "Hình 1", text: "Tranh tam giác", page: "12", required: true, allowReuse: false },
    ],
    uncertainties: [],
    conflicts: [],
    fatalIssues: [],
  };
  const sourceAnchor = makeStagedAnchor({ facts, promptSource: "ocr" });
  const sourceFacts: StagedSourceFactsArtifact = {
    version: 2,
    kind: "source-facts",
    subjectKind: "math",
    identity,
    anchor: sourceAnchor,
    dependencies: {},
    model: "gpt-5.4-mini",
    provider: "openai",
    fallbackUsed: false,
    sourceTruth: {
      version: 1,
      subject: "Toán",
      grade: "Lớp 3",
      lessonTitle: "Hình tam giác",
      periods: 1,
      sourceHashes: ["hash-1"],
      ocrExcerpt: "",
      pageNumbers: ["12"],
      titleCandidates: ["Hình tam giác"],
      tasks: [],
      visuals: [],
      uncertain: [],
    },
    promptSource: "ocr",
    facts,
  };

  const outcomesPayload = {
    generalCompetencies: ["Tự chủ và tự học"],
    specificCompetencies: ["Năng lực tư duy và lập luận toán học"],
    qualities: ["Chăm chỉ"],
    knowledgeAndSkills: ["Nhận biết cạnh, đỉnh tam giác"],
    objectiveMetadata: [
      {
        id: "obj-1",
        category: "specificCompetencies" as const,
        statement: "Nhận biết được đỉnh, cạnh của hình tam giác.",
        evidence: { activityIds: ["p1-warmup", "p1-explore"], learningProducts: ["Chỉ đúng đỉnh"], successCriteria: ["Chính xác"] },
      },
      {
        id: "obj-2",
        category: "specificCompetencies" as const,
        statement: "Vẽ và ghép được hình tam giác đơn giản.",
        evidence: { activityIds: ["p1-practice", "p1-apply"], learningProducts: ["Hình tam giác"], successCriteria: ["Đúng hình"] },
      },
    ],
  };
  const outcomesAnchor = makeStagedAnchor({ outcomes: outcomesPayload });
  const outcomes: StagedOutcomesArtifact = {
    version: 2,
    kind: "section-outcomes",
    subjectKind: "math",
    identity,
    anchor: outcomesAnchor,
    dependencies: { source: sourceAnchor },
    model: "gpt-5.4-mini",
    provider: "openai",
    fallbackUsed: false,
    outcomes: outcomesPayload,
  };

  const lessonMapPayload = {
    lessonTitle: "Hình tam giác",
    lessonOverview: "Bài học 1 tiết giúp nhận biết và vẽ tam giác.",
    logicSpine: ["Trực quan đến thao tác"],
    sourceAllocation: [{ sourceId: "src-1", periodNumber: 1, purpose: "Khám phá", allowReuse: false }],
    continuityPlan: { sourceUnits: [], clusters: [] },
    periods: [{
      periodNumber: 1,
      focus: "Đặc điểm hình tam giác",
      objectiveIds: ["obj-1", "obj-2"],
      sourceIds: ["src-1", "src-2"],
      targetKnowledge: "Tam giác có 3 cạnh, 3 đỉnh",
      continuityIn: "Đầu bài",
      continuityOut: "Cuối bài",
      assessmentEvidence: ["Sản phẩm chỉ hình"],
    }],
    risks: [],
  };
  const mapAnchor = makeStagedAnchor({ lessonMap: lessonMapPayload });
  const lessonMap: StagedLessonMapArtifact = {
    version: 2,
    kind: "lesson-map",
    subjectKind: "math",
    identity,
    anchor: mapAnchor,
    dependencies: { source: sourceAnchor, outcomes: outcomesAnchor },
    model: "gpt-5.4-mini",
    provider: "openai",
    fallbackUsed: false,
    lessonMap: lessonMapPayload,
  };

  const bpPayload = {
    periodNumber: 1,
    focus: "Đặc điểm hình tam giác",
    lessonType: "standard",
    objectiveIds: ["obj-1", "obj-2"],
    targetKnowledge: "Tam giác có 3 cạnh, 3 đỉnh",
    continuityIn: "Đầu bài",
    continuityOut: "Cuối bài",
    teachingNotes: [],
    phases: [
      { phase: "warmup" as const, activityId: "p1-warmup", title: "Khởi động vui", objectiveIds: ["obj-1"], sourceIds: [], sourceUnitIds: [], sourceClusterIds: [], durationMinutes: 5, learningProducts: [], handoffToNext: "", pedagogyFocus: "" },
      { phase: "explore" as const, activityId: "p1-explore", title: "Khám phá tam giác", objectiveIds: ["obj-1"], sourceIds: ["src-1"], sourceUnitIds: [], sourceClusterIds: [], durationMinutes: 15, learningProducts: [], handoffToNext: "", pedagogyFocus: "" },
      { phase: "practice" as const, activityId: "p1-practice", title: "Luyện tập vẽ", objectiveIds: ["obj-2"], sourceIds: ["src-2"], sourceUnitIds: [], sourceClusterIds: [], durationMinutes: 10, learningProducts: [], handoffToNext: "", pedagogyFocus: "" },
      { phase: "apply" as const, activityId: "p1-apply", title: "Vận dụng ghép tranh", objectiveIds: ["obj-2"], sourceIds: [], sourceUnitIds: [], sourceClusterIds: [], durationMinutes: 5, learningProducts: [], handoffToNext: "", pedagogyFocus: "" },
    ],
  };
  const bpAnchor = makeStagedAnchor({ periodNumber: 1, periodBlueprint: bpPayload });
  const periodBlueprints: StagedPeriodBlueprintArtifact[] = [{
    version: 2,
    kind: "period-blueprint",
    subjectKind: "math",
    identity,
    anchor: bpAnchor,
    dependencies: { outcomes: outcomesAnchor, lessonMap: mapAnchor },
    model: "gpt-5.4-mini",
    provider: "openai",
    fallbackUsed: false,
    periodNumber: 1,
    periodBlueprint: bpPayload,
  }];

  const matPayload = {
    materials: {
      teacher: ["Bộ hình học phẳng", "Bảng phụ"],
      students: ["Thước kẻ, bút chì", "Giấy nháp"],
    },
    items: [
      { id: "mat-1", owner: "teacher" as const, label: "Bộ hình học", sourceIds: ["src-1"], objectiveIds: ["obj-1"] },
      { id: "mat-2", owner: "students" as const, label: "Thước kẻ", sourceIds: ["src-2"], objectiveIds: ["obj-2"] },
    ],
  };
  const matAnchor = makeStagedAnchor(matPayload);
  const materials: StagedMaterialsArtifact = {
    version: 2,
    kind: "section-materials",
    subjectKind: "math",
    identity,
    anchor: matAnchor,
    dependencies: { source: sourceAnchor, outcomes: outcomesAnchor, lessonMap: mapAnchor },
    model: "gpt-5.4-mini",
    provider: "openai",
    fallbackUsed: false,
    materials: matPayload.materials,
    items: matPayload.items,
  };

  const p1WarmupPayload = {
    activity: {
      id: "p1-warmup",
      phase: "Khởi động",
      title: "Khởi động vui",
      objective: "Gợi mở hứng thú",
      durationMinutes: 5,
      teacherActions: ["Cho học sinh hát bài hát về hình học."],
      studentActions: ["Hát và vận động theo nhạc."],
      learningProducts: ["Tinh thần sẵn sàng"],
      objectiveIds: ["obj-1"],
      successCriteria: [],
    },
    materialIds: ["mat-1"],
    sourceIds: [],
    handoff: {
      activityId: "p1-warmup",
      knowledge: ["Nhận biết sơ bộ hình có 3 cạnh"],
      products: ["Câu trả lời miệng"],
      pending: ["Tìm hiểu tên gọi chính xác"],
      bridge: "Các em có muốn biết tên gọi chính xác không?",
      objectiveIds: ["obj-1"],
      sourceIds: [],
      materialIds: ["mat-1"],
    },
  };
  const p1WarmupInput = { previousActivityId: null, previousHandoffHash: null, knowledge: [], products: [], pending: [], bridge: "Bắt đầu tiết." };
  const p1WarmupAnchor = makeStagedAnchor({ periodNumber: 1, phase: "warmup" as const, activity: p1WarmupPayload.activity, materialIds: p1WarmupPayload.materialIds, sourceIds: p1WarmupPayload.sourceIds, input: p1WarmupInput, handoff: p1WarmupPayload.handoff });
  const p1Warmup: StagedPhaseArtifact = {
    version: 2,
    kind: "period-phase",
    subjectKind: "math",
    identity,
    anchor: p1WarmupAnchor,
    dependencies: { outcomes: outcomesAnchor, materials: matAnchor, periodBlueprint: bpAnchor },
    model: "gpt-5.4-mini",
    provider: "openai",
    fallbackUsed: false,
    periodNumber: 1,
    phase: "warmup",
    activity: p1WarmupPayload.activity,
    materialIds: ["mat-1"],
    sourceIds: [],
    input: p1WarmupInput,
    handoff: p1WarmupPayload.handoff,
  };

  const p1ExplorePayload = {
    activity: {
      id: "p1-explore",
      phase: "Khám phá",
      title: "Khám phá tam giác",
      objective: "Nhận biết 3 đỉnh, 3 cạnh",
      durationMinutes: 15,
      teacherActions: ["Đưa mẫu tam giác và hướng dẫn đếm đỉnh."],
      studentActions: ["Quan sát mẫu, chỉ vào từng đỉnh và cạnh."],
      learningProducts: ["Chỉ đúng đỉnh và cạnh"],
      objectiveIds: ["obj-1"],
      successCriteria: [],
    },
    materialIds: ["mat-1"],
    sourceIds: ["src-1"],
    handoff: {
      activityId: "p1-explore",
      knowledge: ["Hình tam giác có 3 đỉnh và 3 cạnh"],
      products: ["Ghi chép vào vở"],
      pending: ["Thực hành vẽ tam giác"],
      bridge: "Bây giờ chúng ta cùng luyện tập vẽ hình tam giác.",
      objectiveIds: ["obj-1"],
      sourceIds: ["src-1"],
      materialIds: ["mat-1"],
    },
  };
  const p1ExploreInput = {
    previousActivityId: "p1-warmup",
    previousHandoffHash: p1WarmupAnchor.hash,
    knowledge: p1WarmupPayload.handoff.knowledge,
    products: p1WarmupPayload.handoff.products,
    pending: p1WarmupPayload.handoff.pending,
    bridge: p1WarmupPayload.handoff.bridge,
  };
  const p1ExploreAnchor = makeStagedAnchor({ periodNumber: 1, phase: "explore" as const, activity: p1ExplorePayload.activity, materialIds: ["mat-1"], sourceIds: ["src-1"], input: p1ExploreInput, handoff: p1ExplorePayload.handoff });
  const p1Explore: StagedPhaseArtifact = {
    version: 2,
    kind: "period-phase",
    subjectKind: "math",
    identity,
    anchor: p1ExploreAnchor,
    dependencies: { outcomes: outcomesAnchor, materials: matAnchor, periodBlueprint: bpAnchor, previousPhase: p1WarmupAnchor },
    model: "gpt-5.4-mini",
    provider: "openai",
    fallbackUsed: false,
    periodNumber: 1,
    phase: "explore",
    activity: p1ExplorePayload.activity,
    materialIds: ["mat-1"],
    sourceIds: ["src-1"],
    input: p1ExploreInput,
    handoff: p1ExplorePayload.handoff,
  };

  const p1PracticePayload = {
    activity: {
      id: "p1-practice",
      phase: "Luyện tập",
      title: "Luyện tập vẽ",
      objective: "Dùng thước vẽ tam giác",
      durationMinutes: 10,
      teacherActions: ["Yêu cầu học sinh làm bài tập 1."],
      studentActions: ["Dùng thước nối 3 điểm tạo thành tam giác."],
      learningProducts: ["Hình tam giác trong vở"],
      objectiveIds: ["obj-2"],
      successCriteria: [],
    },
    materialIds: ["mat-2"],
    sourceIds: ["src-2"],
    handoff: {
      activityId: "p1-practice",
      knowledge: ["Biết cách nối 3 điểm để vẽ tam giác"],
      products: ["Vở vẽ tam giác"],
      pending: ["Áp dụng vào cuộc sống"],
      bridge: "Các em hãy tìm hình tam giác xung quanh nhé.",
      objectiveIds: ["obj-2"],
      sourceIds: ["src-2"],
      materialIds: ["mat-2"],
    },
  };
  const p1PracticeInput = {
    previousActivityId: "p1-explore",
    previousHandoffHash: p1ExploreAnchor.hash,
    knowledge: p1ExplorePayload.handoff.knowledge,
    products: p1ExplorePayload.handoff.products,
    pending: p1ExplorePayload.handoff.pending,
    bridge: p1ExplorePayload.handoff.bridge,
  };
  const p1PracticeAnchor = makeStagedAnchor({ periodNumber: 1, phase: "practice" as const, activity: p1PracticePayload.activity, materialIds: ["mat-2"], sourceIds: ["src-2"], input: p1PracticeInput, handoff: p1PracticePayload.handoff });
  const p1Practice: StagedPhaseArtifact = {
    version: 2,
    kind: "period-phase",
    subjectKind: "math",
    identity,
    anchor: p1PracticeAnchor,
    dependencies: { outcomes: outcomesAnchor, materials: matAnchor, periodBlueprint: bpAnchor, previousPhase: p1ExploreAnchor },
    model: "gpt-5.4-mini",
    provider: "openai",
    fallbackUsed: false,
    periodNumber: 1,
    phase: "practice",
    activity: p1PracticePayload.activity,
    materialIds: ["mat-2"],
    sourceIds: ["src-2"],
    input: p1PracticeInput,
    handoff: p1PracticePayload.handoff,
  };

  const p1ApplyPayload = {
    activity: {
      id: "p1-apply",
      phase: "Vận dụng",
      title: "Vận dụng ghép tranh",
      objective: "Tìm và ghép hình tam giác trong thực tế",
      durationMinutes: 5,
      teacherActions: ["Tổ chức trò chơi ai nhanh hơn."],
      studentActions: ["Tìm đồ vật có dạng tam giác xung quanh lớp."],
      learningProducts: ["Danh sách đồ vật tìm được"],
      objectiveIds: ["obj-2"],
      successCriteria: [],
    },
    materialIds: ["mat-2"],
    sourceIds: [],
    handoff: {
      activityId: "p1-apply",
      knowledge: ["Nhận diện biển báo, mái nhà có dạng tam giác"],
      products: ["Phiếu vận dụng"],
      pending: [],
      bridge: "Hoàn thành bài học xuất sắc.",
      objectiveIds: ["obj-2"],
      sourceIds: [],
      materialIds: ["mat-2"],
    },
  };
  const p1ApplyInput = {
    previousActivityId: "p1-practice",
    previousHandoffHash: p1PracticeAnchor.hash,
    knowledge: p1PracticePayload.handoff.knowledge,
    products: p1PracticePayload.handoff.products,
    pending: p1PracticePayload.handoff.pending,
    bridge: p1PracticePayload.handoff.bridge,
  };
  const p1ApplyAnchor = makeStagedAnchor({ periodNumber: 1, phase: "apply" as const, activity: p1ApplyPayload.activity, materialIds: ["mat-2"], sourceIds: [], input: p1ApplyInput, handoff: p1ApplyPayload.handoff });
  const p1Apply: StagedPhaseArtifact = {
    version: 2,
    kind: "period-phase",
    subjectKind: "math",
    identity,
    anchor: p1ApplyAnchor,
    dependencies: { outcomes: outcomesAnchor, materials: matAnchor, periodBlueprint: bpAnchor, previousPhase: p1PracticeAnchor },
    model: "gpt-5.4-mini",
    provider: "openai",
    fallbackUsed: false,
    periodNumber: 1,
    phase: "apply",
    activity: p1ApplyPayload.activity,
    materialIds: ["mat-2"],
    sourceIds: [],
    input: p1ApplyInput,
    handoff: p1ApplyPayload.handoff,
  };

  const assessPayload = {
    assessment: {
      criteria: ["Nhận biết đúng đỉnh và cạnh", "Vẽ đúng tam giác"],
      evidence: ["Bài vẽ trong vở", "Câu trả lời của HS"],
      comments: ["Đa số học sinh nắm chắc kiến thức"],
    },
    alignment: [
      {
        objectiveId: "obj-1",
        activityIds: ["p1-warmup", "p1-explore"],
        materialIds: ["mat-1"],
        sourceIds: ["src-1"],
        learningProducts: ["Chỉ đúng đỉnh"],
        successCriteria: ["Chính xác"],
      },
      {
        objectiveId: "obj-2",
        activityIds: ["p1-practice", "p1-apply"],
        materialIds: ["mat-2"],
        sourceIds: ["src-2"],
        learningProducts: ["Hình vẽ tam giác"],
        successCriteria: ["Đúng hình dạng"],
      },
    ],
  };
  const assessAnchor = makeStagedAnchor(assessPayload);
  const assessment: StagedAssessmentArtifact = {
    version: 2,
    kind: "section-assessment",
    subjectKind: "math",
    identity,
    anchor: assessAnchor,
    dependencies: { outcomes: outcomesAnchor, materials: matAnchor, phases: [p1WarmupAnchor, p1ExploreAnchor, p1PracticeAnchor, p1ApplyAnchor] },
    model: "gpt-5.4-mini",
    provider: "openai",
    fallbackUsed: false,
    assessment: assessPayload.assessment,
    alignment: assessPayload.alignment,
  };

  return {
    input: mockInput,
    sourceFacts,
    outcomes,
    lessonMap,
    periodBlueprints,
    materials,
    phases: [p1Warmup, p1Explore, p1Practice, p1Apply],
    assessment,
  };
}

describe("staged-v2 validation and assembly", () => {
  it("passes validation for valid and anchored artifacts", () => {
    const fixtures = createValidSectionFixtures();
    const result = validateStagedSections(fixtures);
    expect(result.passed).toBe(true);
    expect(result.issues).toEqual([]);
    expect(() => assertStagedSections(fixtures)).not.toThrow();
  });

  it("detects mismatched anchor dependency and unaddressed objectives", () => {
    const fixtures = createValidSectionFixtures();
    fixtures.outcomes.dependencies.source = { revision: 1, hash: "tampered-hash" };
    fixtures.outcomes.outcomes.objectiveMetadata.push({
      id: "obj-unaddressed",
      category: "specificCompetencies",
      statement: "Năng lực bị bỏ sót hoàn toàn",
      evidence: { activityIds: [], learningProducts: [], successCriteria: [] },
    });

    const result = validateStagedSections(fixtures);
    expect(result.passed).toBe(false);
    expect(result.issues.some((i) => i.code === "SEC-DEP-OUTCOMES-SRC")).toBe(true);
    expect(result.issues.some((i) => i.code === "SEC-OBJ-UNCOVERED")).toBe(true);
  });

  it("assembles valid LessonPlan maintaining existing schema without mutating locked outcomes", () => {
    const fixtures = createValidSectionFixtures();
    const { assembly, blueprint, periods } = assembleStagedSections({
      ...fixtures,
      plan: "plus",
    });

    expect(assembly.periodCount).toBe(1);
    expect(assembly.lesson.generalInfo.lessonTitle).toBe("Hình tam giác");
    expect(assembly.lesson.outcomes.objectiveMetadata).toHaveLength(2);
    expect(assembly.lesson.periodPlans?.[0].activities).toHaveLength(4);
    expect(assembly.lesson.adjustments.suitablePoints[0]).toContain("...");
    expect(periods).toHaveLength(1);
    expect(blueprint.blueprint.lessonTitle).toBe("Hình tam giác");
  });
});
