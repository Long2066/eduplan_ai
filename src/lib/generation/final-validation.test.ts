import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StagedAssemblyArtifact } from "./assembly";
import type { StagedBlueprintArtifact } from "./blueprint";
import type { LessonInput, LessonPlan, PedagogyAuditFinding } from "@/types/lesson";

const validationMocks = vi.hoisted(() => ({ validateStagedLesson: vi.fn() }));

vi.mock("@/lib/generation/subject-validation", () => ({
  validateStagedLesson: validationMocks.validateStagedLesson,
}));

import { finalizeStagedLesson } from "./final-validation";

function input(subject = "Toán"): LessonInput {
  return {
    subject,
    grade: "Lớp 3",
    lessonTitle: "Phép cộng",
    book: "Kết nối tri thức",
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
  };
}

function lesson(subject = "Toán"): LessonPlan {
  return {
    generalInfo: { subject, grade: "Lớp 3", lessonTitle: "Phép cộng", periods: 1, duration: 35 },
    outcomes: { generalCompetencies: [], specificCompetencies: [], qualities: [], knowledgeAndSkills: [] },
    materials: { teacher: [], students: [] },
    activities: [],
    periodPlans: [],
    assessment: { criteria: [], evidence: [], comments: [] },
    adjustments: { suitablePoints: [], pointsToAdjust: [], nextLessonDirection: [] },
    contextFit: { notes: [] },
    meta: { style: "Dạy thật trên lớp", modelUsed: "model", createdAt: "2026-01-01T00:00:00.000Z", plan: "free" },
  };
}

function assembly(repairApplied = false, plan: "free" | "plus" = "free"): StagedAssemblyArtifact {
  const assembledLesson = lesson();
  assembledLesson.meta.plan = plan;
  return {
    subjectKind: "math",
    periodCount: 1,
    repairApplied,
    models: ["model"],
    providers: ["openai"],
    fallbackUsed: false,
    lesson: assembledLesson,
  };
}

function blueprint(): StagedBlueprintArtifact {
  return {
    subjectKind: "math",
    mode: "chunked",
    model: "model",
    provider: "openai",
    fallbackUsed: false,
    promptSource: "ocr",
    blueprint: { periods: [] },
  };
}

function validation(findings: PedagogyAuditFinding[] = [], issues: string[] = []) {
  return {
    subjectKind: "math" as const,
    checkedAt: "2026-01-02T00:00:00.000Z",
    route: "final-validation" as const,
    summary: {
      total: findings.length,
      errors: findings.filter((finding) => finding.severity === "error").length,
      warnings: findings.filter((finding) => finding.severity === "warning").length,
      suggestions: findings.filter((finding) => finding.severity === "suggestion").length,
      repairableErrors: 0,
    },
    findings,
    repairTargets: [],
    audit: {
      subject: "Toán",
      grade: "Lớp 3",
      status: findings.length || issues.length ? "needs-review" as const : "passed" as const,
      issues,
      checks: [],
      repairApplied: false,
      checkedAt: "2026-01-02T00:00:00.000Z",
      findings,
    },
  };
}

describe("staged final validation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("allows persistence when no blocking error remains", () => {
    validationMocks.validateStagedLesson.mockReturnValue(validation());
    const assembled = assembly();
    const result = finalizeStagedLesson(input(), assembled, blueprint());

    expect(result).toMatchObject({
      decision: "persist",
      canPersist: true,
      repairApplied: false,
      blockingCodes: [],
      validatedAt: "2026-01-02T00:00:00.000Z",
    });
    expect(result.audit.status).toBe("passed");
    expect(result.lesson).toMatchObject({
      meta: {
        validationStatus: "passed",
        validationLabel: "Đạt chuẩn",
      },
    });
  });

  it("allows persistence with warnings but keeps needs-review audit status", () => {
    const warning: PedagogyAuditFinding = {
      code: "WARN-01", severity: "warning", message: "Nên rà soát thêm", autoFixable: true,
    };
    validationMocks.validateStagedLesson.mockReturnValue(validation([warning]));
    const result = finalizeStagedLesson(input(), assembly(true), blueprint());

    expect(result.canPersist).toBe(true);
    expect(result.repairApplied).toBe(true);
    expect(result.audit.status).toBe("needs-review");
    expect(result.audit.repairApplied).toBe(true);
  });

  it("does not treat fatal-listed warnings as fatal blockers", () => {
    const warning: PedagogyAuditFinding = {
      code: "NSXH-COVERAGE-08",
      severity: "warning",
      message: "Thiếu đáp án dự kiến cho nhiệm vụ SGK",
      autoFixable: true,
    };
    validationMocks.validateStagedLesson.mockReturnValue(validation([warning]));
    const result = finalizeStagedLesson(input(), assembly(true, "free"), blueprint());

    expect(result).toMatchObject({
      decision: "persist",
      canPersist: true,
      fatalCodes: [],
      blockingCodes: [],
    });
    expect(result.lesson.meta).toMatchObject({
      validationStatus: "needs_adjustment",
    });
  });

  it("rejects persistence when any error remains", () => {
    const error: PedagogyAuditFinding = {
      code: "MATH-QUALITY-01", severity: "error", message: "Thiếu nội dung toán", autoFixable: false,
    };
    validationMocks.validateStagedLesson.mockReturnValue(validation([error]));
    const result = finalizeStagedLesson(input(), assembly(true), blueprint());

    expect(result).toMatchObject({
      decision: "reject",
      canPersist: false,
      blockingCodes: ["MATH-QUALITY-01"],
    });
    expect(result.summary.errors).toBe(1);
    expect(result.audit.status).toBe("needs-review");
  });

  it("allows a free draft when only non-fatal blocking errors remain", () => {
    const error: PedagogyAuditFinding = {
      code: "MATH-PERIOD",
      severity: "error",
      message: "Hoạt động cần chỉnh thêm",
      autoFixable: true,
    };
    validationMocks.validateStagedLesson.mockReturnValue(validation([error]));
    const result = finalizeStagedLesson(input(), assembly(true, "free"), blueprint());

    expect(result).toMatchObject({
      decision: "draft",
      canPersist: true,
      fatalCodes: [],
      blockingCodes: ["MATH-PERIOD"],
    });
    expect(result.lesson.meta).toMatchObject({
      validationStatus: "needs_adjustment",
      freeDraft: true,
    });
  });

  it("allows a paid needs-adjustment draft when only non-fatal blocking errors remain", () => {
    const error: PedagogyAuditFinding = {
      code: "MATH-PERIOD",
      severity: "error",
      message: "Hoạt động cần chỉnh thêm",
      autoFixable: true,
    };
    validationMocks.validateStagedLesson.mockReturnValue(validation([error]));
    const result = finalizeStagedLesson(input(), assembly(true, "plus"), blueprint());

    expect(result).toMatchObject({
      decision: "draft",
      canPersist: true,
      blockingCodes: ["MATH-PERIOD"],
      fatalCodes: [],
    });
    expect(result.lesson.meta).toMatchObject({
      validationStatus: "needs_adjustment",
    });
    expect(result.lesson.meta.freeDraft).toBeUndefined();
  });

  it("rejects free lessons when a fatal code remains", () => {
    const error: PedagogyAuditFinding = {
      code: "STAGED-STRUCT-04",
      severity: "error",
      message: "Tiết chưa có hoạt động",
      autoFixable: true,
      periodNumber: 1,
    };
    validationMocks.validateStagedLesson.mockReturnValue(validation([error]));
    const result = finalizeStagedLesson(input(), assembly(true, "free"), blueprint());

    expect(result).toMatchObject({
      decision: "reject",
      canPersist: false,
      fatalCodes: ["STAGED-STRUCT-04"],
    });
  });

  it("never persists a generic or unresolved lesson title", () => {
    const error: PedagogyAuditFinding = {
      code: "STAGED-TITLE-01",
      severity: "error",
      message: "Tên bài chưa được xác định cụ thể",
      autoFixable: false,
    };
    validationMocks.validateStagedLesson.mockReturnValue(validation([error]));
    const result = finalizeStagedLesson(input(), assembly(false, "plus"), blueprint());

    expect(result).toMatchObject({
      decision: "reject",
      canPersist: false,
      fatalCodes: ["STAGED-TITLE-01"],
      blockingCodes: ["STAGED-TITLE-01"],
    });
  });

  it("never persists a generic title even if the prior validator misses it", () => {
    validationMocks.validateStagedLesson.mockReturnValue(validation());
    const assembled = assembly(false, "plus");
    assembled.lesson.generalInfo.lessonTitle = "Bài học Toán";
    const result = finalizeStagedLesson(input(), assembled, blueprint());

    expect(result).toMatchObject({
      decision: "reject",
      canPersist: false,
      fatalCodes: ["STAGED-TITLE-01"],
      blockingCodes: ["STAGED-TITLE-01"],
      summary: { errors: 1 },
    });
    expect(result.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "STAGED-TITLE-01", autoFixable: false }),
    ]));
  });

  it("never persists a title that differs from locked source truth", () => {
    validationMocks.validateStagedLesson.mockReturnValue(validation());
    const lockedBlueprint = blueprint();
    lockedBlueprint.sourceTruth = {
      version: 1,
      subject: "Toán",
      grade: "Lớp 3",
      lessonTitle: "Bài 2. Phép cộng trong phạm vi 1000",
      periods: 1,
      titleCandidates: [],
      tasks: [],
      visuals: [],
      uncertain: [],
      sourceHashes: [],
      ocrExcerpt: "",
      pageNumbers: [],
    };
    const result = finalizeStagedLesson(input(), assembly(false, "plus"), lockedBlueprint);

    expect(result).toMatchObject({
      decision: "reject",
      canPersist: false,
      fatalCodes: ["STAGED-TITLE-02"],
      blockingCodes: ["STAGED-TITLE-02"],
    });
  });

  it("does not treat repairable subject structure issues as fatal", () => {
    const error: PedagogyAuditFinding = {
      code: "NSXH-STRUCT-02",
      severity: "error",
      message: "Yêu cầu cần đạt còn sơ sài",
      autoFixable: true,
      periodNumber: 1,
    };
    validationMocks.validateStagedLesson.mockReturnValue(validation([error]));
    const assembled = assembly(true, "free");
    assembled.subjectKind = "natural-social";
    assembled.lesson.generalInfo.subject = "Tự nhiên và Xã hội";
    const result = finalizeStagedLesson(input("Tự nhiên và Xã hội"), assembled, {
      ...blueprint(),
      subjectKind: "natural-social",
    });

    expect(result).toMatchObject({
      decision: "draft",
      canPersist: true,
      fatalCodes: [],
      blockingCodes: ["NSXH-STRUCT-02"],
    });
  });

  it("rejects mismatched assembly data before running validators", () => {
    const mismatched = assembly();
    mismatched.lesson.generalInfo.subject = "Tiếng Việt";
    expect(() => finalizeStagedLesson(input(), mismatched, blueprint()))
      .toThrow("môn học trong giáo án không khớp");
    expect(validationMocks.validateStagedLesson).not.toHaveBeenCalled();
  });
});
