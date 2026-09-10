import { describe, expect, it } from "vitest";
import { assembleStagedSections } from "./section-assembly";
import {
  STAGED_PHASES,
  stagedActivityId,
  type AssembleStagedSectionsOptions,
  type StagedAssessmentArtifact,
  type StagedLessonMapArtifact,
  type StagedMaterialsArtifact,
  type StagedOutcomesArtifact,
  type StagedPeriodBlueprintArtifact,
  type StagedPhaseArtifact,
  type StagedSourceFactsArtifact,
} from "./section-types";
import { makeStagedAnchor, getStagedArtifactPayload } from "./section-validation";
import type { LessonInput, LessonOutcomes } from "@/types/lesson";

function createTestInput(overrides: Partial<LessonInput> = {}): LessonInput {
  return {
    subject: "Toán",
    grade: "Lớp 3",
    lessonTitle: "Bài 10: Bảng nhân 7",
    book: "Cánh Diều",
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
    uploadedAssets: [],
    ...overrides,
  };
}

/** Compute anchor from the exact payload the validator uses for hash verification */
function anchorFromPayload<T extends { kind: string }>(artifact: T): ReturnType<typeof makeStagedAnchor> {
  return makeStagedAnchor(getStagedArtifactPayload(artifact as any));
}

function createFixtureArtifacts(input: LessonInput): AssembleStagedSectionsOptions {
  const identity = {
    subject: input.subject,
    grade: input.grade,
    lessonTitle: input.lessonTitle || "Bài học",
    periods: input.periods,
    duration: input.duration,
    sourceHashes: ["hash-src-1"],
  };

  const sourceFacts: StagedSourceFactsArtifact = {
    version: 2,
    kind: "source-facts",
    subjectKind: "math",
    identity,
    anchor: makeStagedAnchor({}), // placeholder
    dependencies: {},
    model: "gpt-4o-mini",
    provider: "openai",
    fallbackUsed: false,
    promptSource: "ocr",
    sourceTruth: {
      version: 1,
      subject: input.subject,
      grade: input.grade,
      lessonTitle: input.lessonTitle || "Bài 10: Bảng nhân 7",
      periods: input.periods,
      sourceHashes: ["hash-src-1"],
      ocrExcerpt: "Trang 24...",
      pageNumbers: ["24", "25"],
      titleCandidates: [input.lessonTitle || "Bài 10: Bảng nhân 7"],
      tasks: [],
      visuals: [],
      uncertain: [],
    },
    facts: {
      lessonTitle: input.lessonTitle || "Bài 10: Bảng nhân 7",
      coreContent: ["Bảng nhân 7"],
      objectivesFromSource: ["Biết lập bảng nhân 7"],
      sourceEvidence: [
        {
          id: "src-task-1",
          kind: "task",
          label: "Nhiệm vụ 1",
          text: "Tính nhẩm",
          page: "24",
          required: true,
          allowReuse: false,
        },
      ],
      uncertainties: [],
      conflicts: [],
      fatalIssues: [],
    },
  };
  sourceFacts.anchor = anchorFromPayload(sourceFacts);

  const outcomes: StagedOutcomesArtifact = {
    version: 2,
    kind: "section-outcomes",
    subjectKind: "math",
    identity,
    anchor: makeStagedAnchor({}),
    dependencies: { source: sourceFacts.anchor },
    model: "gpt-4o",
    provider: "openai",
    fallbackUsed: false,
    outcomes: {
      generalCompetencies: ["Tự chủ và tự học"],
      specificCompetencies: ["Năng lực tư duy và lập luận toán học"],
      qualities: ["Chăm chỉ"],
      knowledgeAndSkills: ["Hình thành bảng nhân 7"],
      digitalCompetencies: [],
      objectiveMetadata: [
        {
          id: "obj-1",
          category: "knowledgeAndSkills",
          statement: "Hình thành bảng nhân 7 và giải bài toán liên quan.",
          evidence: {
            activityIds: ["p1-warmup", "p1-explore", "p1-practice", "p1-apply"],
            learningProducts: ["Bảng nhân 7 đã lập"],
            successCriteria: ["Học sinh đọc đúng bảng nhân 7"],
          },
        },
      ],
    },
  };
  outcomes.anchor = anchorFromPayload(outcomes);

  const lessonMap: StagedLessonMapArtifact = {
    version: 2,
    kind: "lesson-map",
    subjectKind: "math",
    identity,
    anchor: makeStagedAnchor({}),
    dependencies: { source: sourceFacts.anchor, outcomes: outcomes.anchor },
    model: "gpt-4o",
    provider: "openai",
    fallbackUsed: false,
    lessonMap: {
      lessonTitle: input.lessonTitle || "Bài 10: Bảng nhân 7",
      lessonOverview: "Tổng quan bài học bảng nhân 7",
      logicSpine: ["Khởi động", "Khám phá bảng nhân", "Luyện tập", "Vận dụng thực tế"],
      sourceAllocation: [
        {
          sourceId: "src-task-1",
          periodNumber: 1,
          purpose: "Hình thành phép tính",
          allowReuse: false,
        },
      ],
      continuityPlan: {
        sourceUnits: [],
        clusters: [],
      },
      periods: [
        {
          periodNumber: 1,
          focus: "Lập và ghi nhớ bảng nhân 7",
          objectiveIds: ["obj-1"],
          sourceIds: ["src-task-1"],
          targetKnowledge: "Bảng nhân 7",
          continuityIn: "Bảng nhân 6",
          continuityOut: "Bảng chia 7",
          assessmentEvidence: ["Phiếu bài tập"],
        },
      ],
      risks: [],
    },
  };
  lessonMap.anchor = anchorFromPayload(lessonMap);

  const periodBlueprints: StagedPeriodBlueprintArtifact[] = [
    {
      version: 2,
      kind: "period-blueprint",
      subjectKind: "math",
      identity,
      anchor: makeStagedAnchor({}),
      dependencies: { outcomes: outcomes.anchor, lessonMap: lessonMap.anchor },
      model: "gpt-4o",
      provider: "openai",
      fallbackUsed: false,
      periodNumber: 1,
      periodBlueprint: {
        periodNumber: 1,
        focus: "Trọng tâm tiết 1",
        lessonType: "standard",
        objectiveIds: ["obj-1"],
        targetKnowledge: "Kiến thức trọng tâm bảng nhân 7",
        continuityIn: "Đã học bảng nhân 6",
        continuityOut: "Chuẩn bị bảng chia 7",
        teachingNotes: ["Lưu ý học sinh đếm thêm 7"],
        phases: [
          {
            phase: "warmup",
            activityId: "p1-warmup",
            title: "Trò chơi đếm thêm 7",
            objectiveIds: ["obj-1"],
            sourceIds: ["src-task-1"],
            sourceUnitIds: [],
            sourceClusterIds: [],
            durationMinutes: 5,
            learningProducts: ["Câu trả lời của HS"],
            handoffToNext: "Nối vào khám phá",
            pedagogyFocus: "Kích hoạt",
          },
          {
            phase: "explore",
            activityId: "p1-explore",
            title: "Hình thành bảng nhân 7",
            objectiveIds: ["obj-1"],
            sourceIds: ["src-task-1"],
            sourceUnitIds: [],
            sourceClusterIds: [],
            durationMinutes: 15,
            learningProducts: ["Bảng nhân 7"],
            handoffToNext: "Nối vào luyện tập",
            pedagogyFocus: "Khám phá",
          },
          {
            phase: "practice",
            activityId: "p1-practice",
            title: "Thực hành tính nhẩm",
            objectiveIds: ["obj-1"],
            sourceIds: ["src-task-1"],
            sourceUnitIds: [],
            sourceClusterIds: [],
            durationMinutes: 10,
            learningProducts: ["Vở bài tập"],
            handoffToNext: "Nối vào vận dụng",
            pedagogyFocus: "Luyện tập",
          },
          {
            phase: "apply",
            activityId: "p1-apply",
            title: "Vận dụng giải toán thực tế",
            objectiveIds: ["obj-1"],
            sourceIds: ["src-task-1"],
            sourceUnitIds: [],
            sourceClusterIds: [],
            durationMinutes: 5,
            learningProducts: ["Lời giải bài toán"],
            handoffToNext: "Kết thúc",
            pedagogyFocus: "Vận dụng",
          },
        ],
      },
    },
  ];
  periodBlueprints[0].anchor = anchorFromPayload(periodBlueprints[0]);

  const materials: StagedMaterialsArtifact = {
    version: 2,
    kind: "section-materials",
    subjectKind: "math",
    identity,
    anchor: makeStagedAnchor({}),
    dependencies: { source: sourceFacts.anchor, outcomes: outcomes.anchor, lessonMap: lessonMap.anchor },
    model: "gpt-4o",
    provider: "openai",
    fallbackUsed: false,
    materials: {
      teacher: ["Bộ thẻ số", "Mô hình trực quan"],
      students: ["SGK Toán 3", "Vở bài tập Toán"],
    },
    items: [
      {
        id: "mat-1",
        owner: "teacher",
        label: "Bộ thẻ số",
        sourceIds: ["src-task-1"],
        objectiveIds: ["obj-1"],
      },
    ],
  };
  materials.anchor = anchorFromPayload(materials);

  const phaseDurations = { warmup: 5, explore: 15, practice: 10, apply: 5 };
  const phaseKnowledge = {
    warmup: ["Nhớ lại phép cộng lặp"],
    explore: ["7 x 1 = 7", "7 x 2 = 14", "Khái niệm bảng nhân 7"],
    practice: ["Kĩ năng tính nhẩm nhân 7"],
    apply: ["Ứng dụng vào đời sống"],
  };

  let prevArtifact: StagedPhaseArtifact | null = null;
  const phases: StagedPhaseArtifact[] = [];

  for (const phaseName of STAGED_PHASES) {
    const actId = stagedActivityId(1, phaseName);
    const currentArt: StagedPhaseArtifact = {
      version: 2,
      kind: "period-phase",
      subjectKind: "math",
      identity,
      anchor: makeStagedAnchor({}),
      dependencies: {
        outcomes: outcomes.anchor,
        materials: materials.anchor,
        periodBlueprint: periodBlueprints[0].anchor,
        ...(prevArtifact ? { previousPhase: prevArtifact.anchor } : {}),
      },
      model: phaseName === "apply" ? "claude-3-5-sonnet" : "gpt-4o",
      provider: phaseName === "apply" ? "openrouter" : "openai",
      fallbackUsed: phaseName === "apply",
      periodNumber: 1,
      phase: phaseName,
      activity: {
        id: actId,
        phase: phaseName,
        title: `Hoạt động ${phaseName}`,
        objective: "Đạt mục tiêu bài học",
        durationMinutes: phaseDurations[phaseName],
        teacherActions: ["GV giao nhiệm vụ"],
        studentActions: ["HS thực hiện nhiệm vụ"],
        objectiveIds: ["obj-1"],
        learningProducts: ["Sản phẩm học tập"],
        successCriteria: [],
      },
      materialIds: ["mat-1"],
      sourceIds: ["src-task-1"],
      input: {
        previousActivityId: prevArtifact ? prevArtifact.activity.id : null,
        previousHandoffHash: prevArtifact ? prevArtifact.anchor.hash : null,
        knowledge: prevArtifact ? prevArtifact.handoff.knowledge : [],
        products: prevArtifact ? prevArtifact.handoff.products : [],
        pending: [],
        bridge: prevArtifact ? prevArtifact.handoff.bridge : "",
      },
      handoff: {
        activityId: actId,
        knowledge: phaseKnowledge[phaseName],
        products: [`Sản phẩm của ${phaseName}`],
        pending: phaseName === "apply" ? ["Củng cố thêm cho HS chậm"] : [],
        bridge: `Chuyển tiếp từ ${phaseName}`,
        objectiveIds: ["obj-1"],
        sourceIds: ["src-task-1"],
        materialIds: ["mat-1"],
      },
    };
    currentArt.anchor = anchorFromPayload(currentArt);
    phases.push(currentArt);
    prevArtifact = currentArt;
  }

  const assessment: StagedAssessmentArtifact = {
    version: 2,
    kind: "section-assessment",
    subjectKind: "math",
    identity,
    anchor: makeStagedAnchor({}),
    dependencies: { outcomes: outcomes.anchor, materials: materials.anchor, phases: phases.map((p) => p.anchor) },
    model: "gpt-4o",
    provider: "openai",
    fallbackUsed: false,
    assessment: {
      criteria: ["Đọc và tính nhẩm thành thạo bảng nhân 7"],
      evidence: ["Phiếu bài tập số 1"],
      comments: ["Học sinh tích cực tham gia"],
    },
    alignment: [
      {
        objectiveId: "obj-1",
        activityIds: ["p1-warmup", "p1-explore", "p1-practice", "p1-apply"],
        materialIds: ["mat-1"],
        sourceIds: ["src-task-1"],
        learningProducts: ["Bảng nhân 7"],
        successCriteria: ["Đọc đúng bảng nhân 7"],
      },
    ],
  };
  assessment.anchor = anchorFromPayload(assessment);

  return {
    input,
    plan: "plus",
    repairApplied: false,
    sourceFacts,
    outcomes,
    lessonMap,
    periodBlueprints,
    materials,
    phases,
    assessment,
  };
}

describe("assembleStagedSections", () => {
  it("assembles valid staged-v2 sections into complete LessonPlan, Blueprint, and Period artifacts", () => {
    const input = createTestInput();
    const options = createFixtureArtifacts(input);

    const result = assembleStagedSections(options);

    // Verify root result structure
    expect(result).toBeDefined();
    expect(result.assembly).toBeDefined();
    expect(result.blueprint).toBeDefined();
    expect(result.periods).toHaveLength(1);

    // Verify Assembly artifact
    const { assembly } = result;
    expect(assembly.subjectKind).toBe("math");
    expect(assembly.periodCount).toBe(1);
    expect(assembly.fallbackUsed).toBe(true); // Since apply phase had fallbackUsed = true
    expect(assembly.models).toContain("gpt-4o");
    expect(assembly.models).toContain("claude-3-5-sonnet");
    expect(assembly.providers).toContain("openai");
    expect(assembly.providers).toContain("openrouter");

    // Verify exact outcomes copying (immutable, no merge/defaults)
    const { lesson } = assembly;
    expect(lesson.generalInfo.lessonTitle).toBe("Bài 10. Bảng nhân 7");
    expect(lesson.generalInfo.periods).toBe(1);
    expect(lesson.generalInfo.duration).toBe(35);
    expect(lesson.outcomes.knowledgeAndSkills).toEqual(["Hình thành bảng nhân 7"]);
    expect(lesson.outcomes.objectiveMetadata).toHaveLength(1);
    expect(lesson.outcomes.objectiveMetadata![0].id).toBe("obj-1");

    // Verify exact materials copying
    expect(lesson.materials.teacher).toEqual(["Bộ thẻ số", "Mô hình trực quan"]);
    expect(lesson.materials.students).toEqual(["SGK Toán 3", "Vở bài tập Toán"]);

    // Verify assessment copying
    expect(lesson.assessment.criteria).toEqual(["Đọc và tính nhẩm thành thạo bảng nhân 7"]);

    // Verify adjustments placeholders unchanged
    expect(lesson.adjustments.suitablePoints[0]).toMatch(/^\.{10,}/);
    expect(lesson.adjustments.pointsToAdjust[0]).toMatch(/^\.{10,}/);
    expect(lesson.adjustments.nextLessonDirection[0]).toMatch(/^\.{10,}/);

    // Verify activities order: warmup -> explore -> practice -> apply
    expect(lesson.activities).toHaveLength(4);
    expect(lesson.activities[0].phase).toBe("Khởi động");
    expect(lesson.activities[1].phase).toBe("Khám phá");
    expect(lesson.activities[2].phase).toBe("Luyện tập");
    expect(lesson.activities[3].phase).toBe("Vận dụng");

    // Verify PeriodPlan
    expect(lesson.periodPlans).toHaveLength(1);
    const period1 = lesson.periodPlans![0];
    expect(period1.periodNumber).toBe(1);
    expect(period1.focus).toBe("Trọng tâm tiết 1");
    expect(period1.handoff?.learned).toBe("Ứng dụng vào đời sống");
    expect(period1.handoff?.unresolvedRisks).toEqual(["Củng cố thêm cho HS chậm"]);
    expect(period1.handoff?.nextBridge).toBe("Chuyển tiếp từ apply");

    // Verify PeriodPlan outcomes mapped strictly by objectiveIds
    expect(period1.outcomes?.knowledgeAndSkills).toEqual([
      "Hình thành bảng nhân 7 và giải bài toán liên quan.",
    ]);

    // Verify Compact Blueprint
    const bp = result.blueprint;
    expect(bp.subjectKind).toBe("math");
    expect(bp.mode).toBe("chunked");
    expect(bp.sourceTruth).toBeDefined();
    expect((bp.blueprint as any).periods).toHaveLength(1);
    expect((bp.blueprint as any).periods[0].activities).toHaveLength(4);
  });

  it("throws validation error if assertStagedSections detects invariant breach", () => {
    const input = createTestInput();
    const options = createFixtureArtifacts(input);

    // Tamper with an objectiveId in a phase to breach validation
    options.phases[0].activity.objectiveIds = ["non-existent-obj"];

    expect(() => assembleStagedSections(options)).toThrowError(/Kiểm định staged-v2 thất bại/);
  });

  it("maps Vietnamese subject-specific blueprint fields correctly without any casts", () => {
    const input = createTestInput({ subject: "Tiếng Việt" });
    const options = createFixtureArtifacts(input);

    // Update subject identity
    options.sourceFacts.subjectKind = "vietnamese";
    options.sourceFacts.identity.subject = "Tiếng Việt";
    options.outcomes.subjectKind = "vietnamese";
    options.outcomes.identity.subject = "Tiếng Việt";
    options.lessonMap.subjectKind = "vietnamese";
    options.lessonMap.identity.subject = "Tiếng Việt";
    options.periodBlueprints[0].subjectKind = "vietnamese";
    options.periodBlueprints[0].identity.subject = "Tiếng Việt";
    options.periodBlueprints[0].periodBlueprint.lessonType = "reading";
    options.periodBlueprints[0].anchor = anchorFromPayload(options.periodBlueprints[0]);
    options.materials.subjectKind = "vietnamese";
    options.materials.identity.subject = "Tiếng Việt";
    options.assessment.subjectKind = "vietnamese";
    options.assessment.identity.subject = "Tiếng Việt";
    for (const ph of options.phases) {
      ph.subjectKind = "vietnamese";
      ph.identity.subject = "Tiếng Việt";
      ph.dependencies.periodBlueprint = options.periodBlueprints[0].anchor;
    }

    const result = assembleStagedSections(options);
    expect(result.assembly.subjectKind).toBe("vietnamese");
    expect(result.blueprint.subjectKind).toBe("vietnamese");
    const vtBp = result.blueprint.blueprint as any;
    expect(vtBp.periods[0].lessonType).toBe("reading");
    expect(vtBp.periods[0].activities[0].focusSkills).toBeDefined();
  });
});
