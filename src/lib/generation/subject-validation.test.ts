import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StagedAssemblyArtifact } from "./assembly";
import type { StagedBlueprintArtifact } from "./blueprint";
import type { LessonInput, LessonPlan, PedagogyAuditFinding } from "@/types/lesson";

const checkerMocks = vi.hoisted(() => ({
  buildPedagogyAudit: vi.fn(),
  mathPeriodIssues: vi.fn(),
  naturalSocialPeriodIssues: vi.fn(),
  vietnamesePeriodIssues: vi.fn(),
}));

const coverageMocks = vi.hoisted(() => ({
  validateNaturalSocialTaskCoverage: vi.fn(),
  validateVietnameseTaskCoverage: vi.fn(),
}));

vi.mock("@/lib/subject-checkers", () => ({
  buildPedagogyAudit: checkerMocks.buildPedagogyAudit,
  mathPeriodIssues: checkerMocks.mathPeriodIssues,
  naturalSocialPeriodIssues: checkerMocks.naturalSocialPeriodIssues,
  vietnamesePeriodIssues: checkerMocks.vietnamesePeriodIssues,
  periodHasRequiredPhases: (activities: Array<{ phase?: string }>) => {
    const phases = new Set(activities.map((activity) => activity.phase));
    return ["Khởi động", "Khám phá", "Luyện tập", "Vận dụng"].every((phase) => phases.has(phase));
  },
}));
vi.mock("@/lib/natural-social-task-coverage", () => ({
  normalizeNaturalSocialSourceInventory: (value: unknown) => value,
  validateNaturalSocialTaskCoverage: coverageMocks.validateNaturalSocialTaskCoverage,
}));
vi.mock("@/lib/vietnamese-task-coverage", () => ({
  validateVietnameseTaskCoverage: coverageMocks.validateVietnameseTaskCoverage,
}));

import { validateStagedLesson } from "./subject-validation";

function lessonInput(subject = "Đạo đức"): LessonInput {
  return {
    subject,
    grade: "Lớp 3",
    lessonTitle: "Bài 3. Giữ lời hứa",
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

function activity(phase: string, periodNumber: number) {
  return {
    phase,
    title: `${phase} tiết ${periodNumber}`,
    objective: "Học sinh thực hiện nhiệm vụ",
    durationMinutes: 8,
    teacherActions: ["GV giao nhiệm vụ cụ thể"],
    studentActions: ["HS thực hiện nhiệm vụ cụ thể"],
    learningProducts: ["Câu trả lời"],
    successCriteria: ["Hoàn thành đúng"],
  };
}

function lesson(subject = "Đạo đức"): LessonPlan {
  const periodPlans = [1, 2].map((periodNumber) => ({
    periodNumber,
    focus: `Tiết ${periodNumber}`,
    outcomes: {
      generalCompetencies: ["Học sinh tự chủ trong học tập"],
      specificCompetencies: ["Học sinh thực hiện nhiệm vụ môn học"],
      qualities: ["Học sinh thể hiện trách nhiệm"],
      knowledgeAndSkills: [`Học sinh nêu được nội dung tiết ${periodNumber}`],
    },
    activities: ["Khởi động", "Khám phá", "Luyện tập", "Vận dụng"]
      .map((phase) => activity(phase, periodNumber)),
  }));
  return {
    generalInfo: { subject, grade: "Lớp 3", lessonTitle: "Bài 3. Giữ lời hứa", periods: 2, duration: 35 },
    outcomes: {
      generalCompetencies: ["Học sinh tự chủ trong học tập"],
      specificCompetencies: ["Học sinh thực hiện nhiệm vụ môn học"],
      qualities: ["Học sinh thể hiện trách nhiệm"],
      knowledgeAndSkills: ["Học sinh nêu được nội dung bài học"],
    },
    materials: { teacher: ["Tranh"], students: ["SGK"] },
    activities: periodPlans.flatMap((period) => period.activities),
    periodPlans,
    assessment: { criteria: [], evidence: [], comments: [] },
    adjustments: { suitablePoints: [], pointsToAdjust: [], nextLessonDirection: [] },
    contextFit: { notes: [] },
    meta: { style: "Dạy thật trên lớp", modelUsed: "model", createdAt: "2026-01-01T00:00:00.000Z" },
  };
}

function blueprint(
  subjectKind: StagedBlueprintArtifact["subjectKind"],
  value: StagedBlueprintArtifact["blueprint"] = { subject: "Đạo đức", lessonTitle: "Bài 3. Quan tâm hàng xóm láng giềng", periods: 2, directGeneration: true },
): StagedBlueprintArtifact {
  return {
    subjectKind,
    mode: subjectKind === "default" ? "direct-generation" : "chunked",
    model: "blueprint-model",
    provider: "openai",
    fallbackUsed: false,
    promptSource: "ocr",
    blueprint: value,
  };
}

function assembly(subjectKind: StagedAssemblyArtifact["subjectKind"], value: LessonPlan): StagedAssemblyArtifact {
  return {
    subjectKind,
    periodCount: 2,
    repairApplied: false,
    models: ["detail-model"],
    providers: ["openai"],
    fallbackUsed: false,
    lesson: value,
  };
}

function finding(overrides: Partial<PedagogyAuditFinding> = {}): PedagogyAuditFinding {
  return {
    code: "QUALITY-01",
    severity: "error",
    message: "Lỗi có thể sửa",
    autoFixable: true,
    ...overrides,
  };
}

describe("staged subject validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    checkerMocks.buildPedagogyAudit.mockReturnValue({
      subject: "Đạo đức",
      grade: "Lớp 3",
      status: "passed",
      issues: [],
      checks: [],
      repairApplied: false,
      checkedAt: "2026-01-01T00:00:00.000Z",
      findings: [],
    });
    checkerMocks.mathPeriodIssues.mockReturnValue([]);
    checkerMocks.naturalSocialPeriodIssues.mockReturnValue([]);
    checkerMocks.vietnamesePeriodIssues.mockReturnValue([]);
    coverageMocks.validateNaturalSocialTaskCoverage.mockReturnValue([]);
    coverageMocks.validateVietnameseTaskCoverage.mockReturnValue([]);
  });

  it("routes a structurally clean default lesson directly to final validation", () => {
    const input = lessonInput();
    const result = validateStagedLesson(input, assembly("default", lesson()), blueprint("default"));

    expect(result.route).toBe("final-validation");
    expect(result.summary).toEqual({ total: 0, errors: 0, warnings: 0, suggestions: 0, repairableErrors: 0 });
    expect(result.repairTargets).toEqual([]);
    expect(result.audit.status).toBe("passed");
  });

  it("maps a scoped repairable error only to its affected period", () => {
    checkerMocks.buildPedagogyAudit.mockReturnValue({
      subject: "Toán", grade: "Lớp 3", status: "needs-review", issues: [], checks: [], repairApplied: false,
      checkedAt: "2026-01-01T00:00:00.000Z",
      findings: [finding({ periodNumber: 2 }), finding({ code: "WARN-01", severity: "warning", autoFixable: true })],
    });
    const input = lessonInput("Toán");
    const result = validateStagedLesson(input, assembly("math", lesson("Toán")), blueprint("math", { periods: [] }));

    expect(result.route).toBe("repair");
    expect(result.summary).toMatchObject({ total: 2, errors: 1, warnings: 1, repairableErrors: 1 });
    expect(result.repairTargets).toEqual([{ periodNumber: 2, findingCodes: ["QUALITY-01"], findingCount: 1 }]);
  });

  it("routes rescueable subject warnings through repair before final validation", () => {
    coverageMocks.validateNaturalSocialTaskCoverage.mockReturnValue([
      finding({
        code: "NSXH-COVERAGE-08",
        severity: "warning",
        message: "Thiếu đáp án dự kiến cho nhiệm vụ SGK",
        autoFixable: true,
        periodNumber: 1,
      }),
    ]);
    const input = lessonInput("Tự nhiên và Xã hội");
    const result = validateStagedLesson(
      input,
      assembly("natural-social", lesson("Tự nhiên và Xã hội")),
      blueprint("natural-social", { periods: [{ periodNumber: 1, lessonType: "family" }, { periodNumber: 2, lessonType: "school" }] }),
    );

    expect(result.route).toBe("repair");
    expect(result.summary).toMatchObject({ errors: 0, warnings: 1, repairableErrors: 1 });
    expect(result.repairTargets).toEqual([{ periodNumber: 1, findingCodes: ["NSXH-COVERAGE-08"], findingCount: 1 }]);
  });

  it("maps a global repairable error to every period", () => {
    checkerMocks.buildPedagogyAudit.mockReturnValue({
      subject: "Đạo đức", grade: "Lớp 3", status: "needs-review", issues: [], checks: [], repairApplied: false,
      checkedAt: "2026-01-01T00:00:00.000Z", findings: [finding()],
    });
    const input = lessonInput();
    const result = validateStagedLesson(input, assembly("default", lesson()), blueprint("default"));

    expect(result.repairTargets.map((target) => target.periodNumber)).toEqual([1, 2]);
  });

  it("reports a generic title as non-repairable staged identity failure", () => {
    const genericLesson = lesson();
    genericLesson.generalInfo.lessonTitle = "Bài học Đạo đức";
    const result = validateStagedLesson(
      lessonInput(),
      assembly("default", genericLesson),
      blueprint("default"),
    );

    expect(result.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "STAGED-TITLE-01", severity: "error", autoFixable: false }),
    ]));
    expect(result.repairTargets).toEqual([]);
  });

  it("reports a title that differs from locked source truth", () => {
    const stagedBlueprint = blueprint("default");
    stagedBlueprint.sourceTruth = {
      version: 1,
      subject: "Đạo đức",
      grade: "Lớp 3",
      lessonTitle: "Bài 4. Tôn trọng người khác",
      periods: 2,
      sourceHashes: [],
      ocrExcerpt: "",
      pageNumbers: [],
      titleCandidates: ["Bài 4. Tôn trọng người khác"],
      tasks: [],
      visuals: [],
      uncertain: [],
    };
    const result = validateStagedLesson(
      lessonInput(),
      assembly("default", lesson()),
      stagedBlueprint,
    );

    expect(result.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "STAGED-TITLE-02", severity: "error", autoFixable: false }),
    ]));
    expect(result.repairTargets).toEqual([]);
  });

  it("uses the Vietnamese blueprint descriptor and task coverage validator", () => {
    checkerMocks.vietnamesePeriodIssues.mockReturnValue(["TV-STRUCT-01: Thiếu pha"]);
    coverageMocks.validateVietnameseTaskCoverage.mockReturnValue([
      finding({ code: "TV-COVERAGE-01", periodNumber: 1 }),
    ]);
    const input = lessonInput("Tiếng Việt");
    const result = validateStagedLesson(
      input,
      assembly("vietnamese", lesson("Tiếng Việt")),
      blueprint("vietnamese", { periods: [{ periodNumber: 1, lessonType: "reading" }, { periodNumber: 2, lessonType: "spelling" }] }),
    );

    expect(checkerMocks.vietnamesePeriodIssues).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ periodNumber: 1 }),
      expect.objectContaining({ lessonType: "reading" }),
      input,
    );
    expect(coverageMocks.validateVietnameseTaskCoverage).toHaveBeenCalledOnce();
    expect(result.audit.issues).toContain("Tiết 1: TV-STRUCT-01: Thiếu pha");
    expect(result.repairTargets[0]).toMatchObject({ periodNumber: 1 });
    expect(result.repairTargets[0].findingCodes).toEqual(expect.arrayContaining(["TV-COVERAGE-01", "TV-STRUCT-01"]));
  });

  it("runs math and Natural and Social Studies period-specific checkers", () => {
    checkerMocks.mathPeriodIssues.mockReturnValue(["Thiếu biểu diễn"]);
    const mathInput = lessonInput("Toán");
    const mathResult = validateStagedLesson(
      mathInput,
      assembly("math", lesson("Toán")),
      blueprint("math", { periods: [] }),
    );
    expect(checkerMocks.mathPeriodIssues).toHaveBeenCalledTimes(2);
    expect(mathResult.audit.issues).toContain("Tiết 1: Thiếu biểu diễn");
    expect(mathResult.repairTargets[0].findingCodes).toContain("MATH-PERIOD");

    vi.clearAllMocks();
    checkerMocks.buildPedagogyAudit.mockReturnValue({
      subject: "Tự nhiên và Xã hội", grade: "Lớp 3", status: "passed", issues: [], checks: [], repairApplied: false,
      checkedAt: "2026-01-01T00:00:00.000Z", findings: [],
    });
    checkerMocks.naturalSocialPeriodIssues.mockReturnValue(["NSXH-QUALITY-01: Thiếu quan sát"]);
    coverageMocks.validateNaturalSocialTaskCoverage.mockReturnValue([]);
    const naturalInput = lessonInput("Tự nhiên và Xã hội");
    const naturalResult = validateStagedLesson(
      naturalInput,
      assembly("natural-social", lesson("Tự nhiên và Xã hội")),
      blueprint("natural-social", { periods: [{ periodNumber: 1, lessonType: "family" }, { periodNumber: 2, lessonType: "school" }] }),
    );
    expect(checkerMocks.naturalSocialPeriodIssues).toHaveBeenCalledTimes(2);
    expect(coverageMocks.validateNaturalSocialTaskCoverage).toHaveBeenCalledOnce();
    expect(naturalResult.audit.issues).toContain("Tiết 1: NSXH-QUALITY-01: Thiếu quan sát");
    expect(naturalResult.repairTargets[0].findingCodes).toContain("NSXH-QUALITY-01");
  });

  it("creates a repair target when a period loses a required phase", () => {
    const brokenLesson = lesson();
    brokenLesson.periodPlans![0].activities = brokenLesson.periodPlans![0].activities.slice(0, 3);
    brokenLesson.activities = brokenLesson.periodPlans!.flatMap((period) => period.activities);
    const input = lessonInput();
    const result = validateStagedLesson(input, assembly("default", brokenLesson), blueprint("default"));

    expect(result.findings).toContainEqual(expect.objectContaining({
      code: "STAGED-STRUCT-05",
      periodNumber: 1,
      autoFixable: true,
    }));
    expect(result.route).toBe("repair");
  });
});
