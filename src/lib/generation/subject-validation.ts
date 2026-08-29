import "server-only";
import type { StagedAssemblyArtifact } from "@/lib/generation/assembly";
import type { StagedBlueprintArtifact } from "@/lib/generation/blueprint";
import { repairableStagedFindings } from "@/lib/lesson-repair-policy";
import {
  isSpecificLessonTitle,
  lessonTitlesEqual,
} from "@/lib/lesson-title";
import { sanitizeNaturalSocialSourceInventoryForLesson } from "@/lib/natural-social-source-inventory";
import { validateNaturalSocialTaskCoverage } from "@/lib/natural-social-task-coverage";
import {
  buildPedagogyAudit,
  mathPeriodIssues,
  naturalSocialPeriodIssues,
  periodHasRequiredPhases,
  vietnamesePeriodIssues,
} from "@/lib/subject-checkers";
import { validateVietnameseTaskCoverage } from "@/lib/vietnamese-task-coverage";
import type {
  LessonInput,
  LessonPlan,
  NaturalSocialPeriodBlueprint,
  PedagogyAudit,
  PedagogyAuditFinding,
  VietnamesePeriodBlueprint,
} from "@/types/lesson";

export type StagedValidationRepairTarget = {
  periodNumber: number;
  findingCodes: string[];
  findingCount: number;
};

export type StagedValidationArtifact = {
  subjectKind: StagedBlueprintArtifact["subjectKind"];
  checkedAt: string;
  route: "repair" | "final-validation";
  summary: {
    total: number;
    errors: number;
    warnings: number;
    suggestions: number;
    repairableErrors: number;
  };
  findings: PedagogyAuditFinding[];
  repairTargets: StagedValidationRepairTarget[];
  audit: PedagogyAudit;
};

type JsonObject = Record<string, unknown>;

function objectValue(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonObject
    : {};
}

function positiveInteger(value: unknown, fallback = 1) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue >= 1
    ? Math.floor(numericValue)
    : fallback;
}

function blueprintPeriods(artifact: StagedBlueprintArtifact) {
  const blueprint = objectValue(artifact.blueprint);
  return Array.isArray(blueprint.periods)
    ? blueprint.periods.map(objectValue)
    : [];
}

function blueprintPeriodAt(artifact: StagedBlueprintArtifact, periodNumber: number) {
  const periods = blueprintPeriods(artifact);
  return periods.find((period) => positiveInteger(period.periodNumber, 0) === periodNumber)
    || periods[periodNumber - 1]
    || {};
}

function structuralFinding(
  code: string,
  message: string,
  autoFixable: boolean,
  location: Partial<PedagogyAuditFinding> = {},
): PedagogyAuditFinding {
  return { code, severity: "error", message, autoFixable, ...location };
}

function structuralFindings(lesson: LessonPlan, input: LessonInput) {
  const findings: PedagogyAuditFinding[] = [];
  const expectedPeriods = positiveInteger(input.periods);
  const periods = lesson.periodPlans || [];
  if (periods.length !== expectedPeriods || lesson.generalInfo.periods !== expectedPeriods) {
    findings.push(structuralFinding(
      "STAGED-STRUCT-01",
      `Giáo án cần đủ ${expectedPeriods} tiết nhưng cấu trúc hiện tại không khớp số tiết yêu cầu.`,
      false,
    ));
  }

  const mergedActivities = periods.flatMap((period) => period.activities || []);
  if (JSON.stringify(lesson.activities || []) !== JSON.stringify(mergedActivities)) {
    findings.push(structuralFinding(
      "STAGED-STRUCT-02",
      "Danh sách activities toàn bài chưa khớp thứ tự hoạt động trong periodPlans.",
      true,
    ));
  }

  const topLevelOutcomeCount = [
    ...(lesson.outcomes?.generalCompetencies || []),
    ...(lesson.outcomes?.specificCompetencies || []),
    ...(lesson.outcomes?.qualities || []),
    ...(lesson.outcomes?.knowledgeAndSkills || []),
  ].filter((item) => String(item || "").trim()).length;
  if (!topLevelOutcomeCount) {
    findings.push(structuralFinding(
      "STAGED-STRUCT-03",
      "Giáo án thiếu Yêu cầu cần đạt ở cấp toàn bài.",
      true,
    ));
  }

  periods.forEach((period, index) => {
    const periodNumber = positiveInteger(period.periodNumber, index + 1);
    if (!Array.isArray(period.activities) || !period.activities.length) {
      findings.push(structuralFinding(
        "STAGED-STRUCT-04",
        `Tiết ${periodNumber} chưa có hoạt động dạy học.`,
        true,
        { periodNumber },
      ));
      return;
    }
    if (!periodHasRequiredPhases(period.activities)) {
      findings.push(structuralFinding(
        "STAGED-STRUCT-05",
        `Tiết ${periodNumber} chưa đủ 4 pha Khởi động, Khám phá, Luyện tập, Vận dụng.`,
        true,
        { periodNumber },
      ));
    }
    const periodOutcomeCount = [
      ...(period.outcomes?.generalCompetencies || []),
      ...(period.outcomes?.specificCompetencies || []),
      ...(period.outcomes?.qualities || []),
      ...(period.outcomes?.knowledgeAndSkills || []),
    ].filter((item) => String(item || "").trim()).length;
    if (!periodOutcomeCount) {
      findings.push(structuralFinding(
        "STAGED-STRUCT-06",
        `Tiết ${periodNumber} thiếu Yêu cầu cần đạt riêng.`,
        true,
        { periodNumber },
      ));
    }
  });

  const lessonTitle = lesson.generalInfo?.lessonTitle;
  if (!isSpecificLessonTitle(lessonTitle, input.subject)) {
    findings.push(structuralFinding(
      "STAGED-TITLE-01",
      "Tên bài chưa được xác định cụ thể; không được dùng tiêu đề chung theo tên môn.",
      false,
    ));
  }

  return findings;
}

function lockedTitleFindings(
  lesson: LessonPlan,
  blueprint: StagedBlueprintArtifact,
) {
  const lockedTitle = blueprint.sourceTruth?.lessonTitle;
  if (!isSpecificLessonTitle(lockedTitle, lesson.generalInfo.subject)) return [];
  if (lessonTitlesEqual(lesson.generalInfo.lessonTitle, lockedTitle)) return [];
  return [structuralFinding(
    "STAGED-TITLE-02",
    "Tên bài trong giáo án không khớp tiêu đề đã khóa từ ảnh SGK/dữ liệu nguồn.",
    false,
  )];
}

function subjectFindingCode(issue: string, fallback: string) {
  return issue.trim().match(/^([A-Z][A-Z0-9-]+)(?::|\s)/)?.[1] || fallback;
}

function subjectPeriodValidation(
  lesson: LessonPlan,
  input: LessonInput,
  blueprint: StagedBlueprintArtifact,
): { issues: string[]; findings: PedagogyAuditFinding[] } {
  const issues: string[] = [];
  const findings: PedagogyAuditFinding[] = [];
  const addIssues = (periodNumber: number, scopedIssues: string[], fallbackCode: string) => {
    scopedIssues.forEach((issue) => {
      issues.push(`Tiết ${periodNumber}: ${issue}`);
      findings.push({
        code: subjectFindingCode(issue, fallbackCode),
        severity: "error",
        message: issue,
        periodNumber,
        autoFixable: true,
      });
    });
  };
  if (blueprint.subjectKind === "math") {
    (lesson.periodPlans || []).forEach((period) => {
      addIssues(period.periodNumber, mathPeriodIssues(period), "MATH-PERIOD");
    });
  } else if (blueprint.subjectKind === "vietnamese") {
    (lesson.periodPlans || []).forEach((period) => {
      const descriptor = blueprintPeriodAt(blueprint, period.periodNumber) as VietnamesePeriodBlueprint;
      addIssues(period.periodNumber, vietnamesePeriodIssues(period, descriptor, input), "TV-PERIOD");
    });
  } else if (blueprint.subjectKind === "natural-social") {
    (lesson.periodPlans || []).forEach((period) => {
      const descriptor = blueprintPeriodAt(blueprint, period.periodNumber) as NaturalSocialPeriodBlueprint;
      addIssues(period.periodNumber, naturalSocialPeriodIssues(period, descriptor, input), "NSXH-PERIOD");
    });
  }
  return { issues, findings };
}

function dedupeFindings(findings: PedagogyAuditFinding[]) {
  const seen = new Set<string>();
  return findings.filter((finding) => {
    const key = [
      finding.code,
      finding.severity,
      finding.periodNumber || 0,
      finding.activityId || "",
      finding.activityIndex ?? "",
      finding.objectiveId || "",
      finding.message,
    ].join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function repairTargets(lesson: LessonPlan, findings: PedagogyAuditFinding[]) {
  const repairable = repairableStagedFindings(findings);
  const periodNumbers = (lesson.periodPlans || []).map((period) => period.periodNumber);
  const targetMap = new Map<number, PedagogyAuditFinding[]>();
  repairable.forEach((finding) => {
    const targets = finding.periodNumber && periodNumbers.includes(finding.periodNumber)
      ? [finding.periodNumber]
      : periodNumbers;
    targets.forEach((periodNumber) => {
      targetMap.set(periodNumber, [...(targetMap.get(periodNumber) || []), finding]);
    });
  });
  return Array.from(targetMap.entries())
    .sort(([left], [right]) => left - right)
    .map(([periodNumber, scopedFindings]) => ({
      periodNumber,
      findingCodes: Array.from(new Set(scopedFindings.map((finding) => finding.code))),
      findingCount: scopedFindings.length,
    }));
}

export function validateStagedLesson(
  input: LessonInput,
  assembly: StagedAssemblyArtifact,
  blueprint: StagedBlueprintArtifact,
): StagedValidationArtifact {
  if (assembly.subjectKind !== blueprint.subjectKind) {
    throw new Error("Không thể kiểm định giáo án: assembly không khớp môn học của blueprint.");
  }
  const lesson = assembly.lesson;
  const baseAudit = buildPedagogyAudit(lesson, input, false);
  const coverageFindings = blueprint.subjectKind === "vietnamese"
    ? validateVietnameseTaskCoverage(lesson, input, lesson.meta.vietnameseSourceInventory)
    : blueprint.subjectKind === "natural-social"
      ? validateNaturalSocialTaskCoverage(
          lesson,
          input,
          sanitizeNaturalSocialSourceInventoryForLesson(
            input,
            lesson.meta.naturalSocialSourceInventory,
            blueprint.classification as any,
          ),
        )
      : [];
  const coreFindings = dedupeFindings([
    ...structuralFindings(lesson, input),
    ...lockedTitleFindings(lesson, blueprint),
    ...(baseAudit.findings || []),
    ...coverageFindings,
  ]);
  const subjectValidation = subjectPeriodValidation(lesson, input, blueprint);
  const subjectFindings = subjectValidation.findings.filter((subjectFinding) =>
    !coreFindings.some((coreFinding) =>
      coreFinding.code === subjectFinding.code
      && (coreFinding.periodNumber === undefined || coreFinding.periodNumber === subjectFinding.periodNumber),
    ),
  );
  const findings = dedupeFindings([...coreFindings, ...subjectFindings]);
  const issues = Array.from(new Set([...(baseAudit.issues || []), ...subjectValidation.issues]));
  const targets = repairTargets(lesson, findings);
  const summary = {
    total: findings.length,
    errors: findings.filter((finding) => finding.severity === "error").length,
    warnings: findings.filter((finding) => finding.severity === "warning").length,
    suggestions: findings.filter((finding) => finding.severity === "suggestion").length,
    repairableErrors: repairableStagedFindings(findings).length,
  };
  const checkedAt = new Date().toISOString();
  const audit: PedagogyAudit = {
    ...baseAudit,
    status: issues.length || summary.errors ? "needs-review" : "passed",
    issues,
    findings,
    repairApplied: false,
    checkedAt,
  };
  return {
    subjectKind: blueprint.subjectKind,
    checkedAt,
    route: targets.length ? "repair" : "final-validation",
    summary,
    findings,
    repairTargets: targets,
    audit,
  };
}
