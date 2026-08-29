import type { LessonPlan, LessonValidationStatus, PedagogyAuditFinding } from "@/types/lesson";

export const LESSON_PASSED_LABEL = "Đạt chuẩn";
export const LESSON_NEEDS_ADJUSTMENT_LABEL = "Giáo án cần điều chỉnh lại theo nhu cầu trước khi dạy thật";

export function lessonValidationStatusLabel(status: LessonValidationStatus | undefined) {
  return status === "needs_adjustment" ? LESSON_NEEDS_ADJUSTMENT_LABEL : LESSON_PASSED_LABEL;
}

export function lessonValidationStatusShortLabel(status: LessonValidationStatus | undefined) {
  return status === "needs_adjustment" ? "Cần điều chỉnh" : "Đạt chuẩn";
}

export function lessonNeedsAdjustment(lesson: LessonPlan | null | undefined) {
  return lesson?.meta?.validationStatus === "needs_adjustment";
}

export function lessonValidationLabel(lesson: LessonPlan | null | undefined) {
  return lesson?.meta?.validationLabel || lessonValidationStatusLabel(lesson?.meta?.validationStatus);
}

export function lessonValidationSummary(lesson: LessonPlan) {
  const status = lesson.meta?.validationStatus || "passed";
  return {
    validationStatus: status,
    validationLabel: lesson.meta?.validationLabel || lessonValidationStatusLabel(status),
    freeDraft: Boolean(lesson.meta?.freeDraft),
    validationBlockingCodes: lesson.meta?.validationBlockingCodes || [],
    validationCheckedAt: lesson.meta?.validationCheckedAt || "",
  };
}

export function withLessonValidationStatus(
  lesson: LessonPlan,
  options: {
    status: LessonValidationStatus;
    checkedAt?: string;
    blockingCodes?: string[];
    freeDraft?: boolean;
  },
): LessonPlan {
  const blockingCodes = Array.from(new Set(options.blockingCodes || []));
  return {
    ...lesson,
    meta: {
      ...lesson.meta,
      validationStatus: options.status,
      validationLabel: lessonValidationStatusLabel(options.status),
      ...(options.checkedAt ? { validationCheckedAt: options.checkedAt } : {}),
      validationBlockingCodes: blockingCodes,
      ...(options.freeDraft ? { freeDraft: true } : {}),
    },
  };
}

export function findingCodes(findings: PedagogyAuditFinding[]) {
  return Array.from(new Set(findings.map((finding) => finding.code)));
}
