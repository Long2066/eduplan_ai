import "server-only";
import type { StagedAssemblyArtifact } from "@/lib/generation/assembly";
import type { StagedBlueprintArtifact } from "@/lib/generation/blueprint";
import {
  validateStagedLesson,
  type StagedValidationArtifact,
} from "@/lib/generation/subject-validation";
import { findingCodes, withLessonValidationStatus } from "@/lib/lesson-validation-status";
import { isSpecificLessonTitle, lessonTitlesEqual } from "@/lib/lesson-title";
import { normalizeSubscriptionPlan } from "@/lib/model-strategy";
import type { LessonInput, LessonPlan, PedagogyAuditFinding } from "@/types/lesson";

export type StagedFinalArtifact = {
  subjectKind: StagedBlueprintArtifact["subjectKind"];
  validatedAt: string;
  decision: "persist" | "draft" | "reject";
  canPersist: boolean;
  repairApplied: boolean;
  fatalCodes: string[];
  blockingCodes: string[];
  summary: StagedValidationArtifact["summary"];
  findings: PedagogyAuditFinding[];
  audit: StagedValidationArtifact["audit"];
  lesson: LessonPlan;
};

const FATAL_EXACT_CODES = new Set([
  "NSXH-COVERAGE-01",
  "NSXH-COVERAGE-05",
  "NSXH-COVERAGE-12",
  "NSXH-COVERAGE-15",
  "NSXH-QUALITY-06",
  "NSXH-QUALITY-17",
  "MATH-QUALITY-01",
  "MATH-QUALITY-13",
  "STAGED-STRUCT-01",
  "STAGED-STRUCT-04",
  "STAGED-TITLE-01",
  "STAGED-TITLE-02",
]);

function isFatalFinding(finding: PedagogyAuditFinding) {
  if (finding.severity !== "error") return false;
  return FATAL_EXACT_CODES.has(finding.code);
}

function finalTitleFindings(
  input: LessonInput,
  assembly: StagedAssemblyArtifact,
  blueprint: StagedBlueprintArtifact,
): PedagogyAuditFinding[] {
  const title = assembly.lesson.generalInfo.lessonTitle;
  if (!isSpecificLessonTitle(title, input.subject)) {
    return [{
      code: "STAGED-TITLE-01",
      severity: "error",
      message: "Tên bài chưa được xác định cụ thể; không được dùng tiêu đề chung theo tên môn.",
      autoFixable: false,
    }];
  }
  const lockedTitle = blueprint.sourceTruth?.lessonTitle;
  if (isSpecificLessonTitle(lockedTitle, input.subject) && !lessonTitlesEqual(title, lockedTitle)) {
    return [{
      code: "STAGED-TITLE-02",
      severity: "error",
      message: "Tên bài trong giáo án không khớp tiêu đề đã khóa từ ảnh SGK/dữ liệu nguồn.",
      autoFixable: false,
    }];
  }
  return [];
}

function dedupeFindings(findings: PedagogyAuditFinding[]) {
  const seen = new Set<string>();
  return findings.filter((finding) => {
    const key = `${finding.code}|${finding.severity}|${finding.periodNumber || 0}|${finding.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function finalizeStagedLesson(
  input: LessonInput,
  assembly: StagedAssemblyArtifact,
  blueprint: StagedBlueprintArtifact,
): StagedFinalArtifact {
  if (assembly.subjectKind !== blueprint.subjectKind) {
    throw new Error("Không thể kiểm tra cuối: assembly không khớp môn học của blueprint.");
  }
  if (assembly.lesson.generalInfo.subject !== input.subject) {
    throw new Error("Không thể kiểm tra cuối: môn học trong giáo án không khớp dữ liệu đầu vào.");
  }

  const validation = validateStagedLesson(input, assembly, blueprint);
  const findings = dedupeFindings([
    ...validation.findings,
    ...finalTitleFindings(input, assembly, blueprint),
  ]);
  const summary = {
    total: findings.length,
    errors: findings.filter((finding) => finding.severity === "error").length,
    warnings: findings.filter((finding) => finding.severity === "warning").length,
    suggestions: findings.filter((finding) => finding.severity === "suggestion").length,
    repairableErrors: validation.summary.repairableErrors,
  };
  const blockingFindings = findings.filter((finding) => finding.severity === "error");
  const fatalFindings = findings.filter(isFatalFinding);
  const plan = normalizeSubscriptionPlan(assembly.lesson.meta?.plan);
  const needsAdjustmentDraft = blockingFindings.length > 0 && fatalFindings.length === 0;
  const canPersist = fatalFindings.length === 0;
  const repairApplied = Boolean(assembly.repairApplied);
  const stillNeedsReview = validation.audit.issues.length > 0
    || findings.some((finding) => finding.severity === "warning");
  const validationStatus = blockingFindings.length || stillNeedsReview ? "needs_adjustment" : "passed";
  const lesson = withLessonValidationStatus(assembly.lesson, {
    status: validationStatus,
    checkedAt: validation.checkedAt,
    blockingCodes: findingCodes(blockingFindings),
    freeDraft: plan === "free" && needsAdjustmentDraft,
  });
  return {
    subjectKind: blueprint.subjectKind,
    validatedAt: validation.checkedAt,
    decision: canPersist ? needsAdjustmentDraft ? "draft" : "persist" : "reject",
    canPersist,
    repairApplied,
    fatalCodes: findingCodes(fatalFindings),
    blockingCodes: findingCodes(blockingFindings),
    summary,
    findings,
    audit: {
      ...validation.audit,
      status: canPersist && !stillNeedsReview
        ? repairApplied
          ? "repaired"
          : "passed"
        : "needs-review",
      findings,
      repairApplied,
    },
    lesson,
  };
}
