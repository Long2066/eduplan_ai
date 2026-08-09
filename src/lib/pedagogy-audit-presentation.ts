import type { PedagogyAudit } from "@/types/lesson";

export const vietnameseLessonTypeLabels: Record<string, string> = {
  phonics: "Học âm – vần – chữ",
  reading: "Đọc / Đọc hiểu",
  handwriting: "Tập viết",
  spelling: "Chính tả",
  composition: "Viết đoạn – bài",
  "language-knowledge": "Luyện từ và câu",
  "speaking-listening": "Nói và nghe",
  mixed: "Bài học tích hợp",
};

export const classificationConfidenceLabels: Record<"high" | "medium" | "low", string> = {
  high: "Tin cậy cao",
  medium: "Tin cậy vừa",
  low: "Cần đối chiếu",
};

export type AuditIssueGroup = {
  periodNumber?: number;
  label: string;
  issues: string[];
};

export type AuditPeriodPresentation = {
  periodNumber: number;
  lessonType?: string;
  lessonTypeLabel: string;
  checks: string[];
};

export function lessonTypeLabel(type?: string): string {
  if (!type) return "Chưa xác định";
  return vietnameseLessonTypeLabels[type] || type;
}

export function confidenceLabel(confidence?: PedagogyAudit["classificationConfidence"]): string | null {
  return confidence ? classificationConfidenceLabels[confidence] : null;
}

export function cleanAuditCheck(check: string): string {
  return check
    .replace(/^☐\s*/, "")
    .replace(/^Kiểu bài:\s*.+?\s*\((?:high|medium|low)\)\s*$/i, "")
    .trim();
}

export function visibleAuditChecks(checks?: string[]): string[] {
  return (checks || []).map(cleanAuditCheck).filter(Boolean);
}

export function groupAuditIssues(issues?: string[]): AuditIssueGroup[] {
  const groups = new Map<string, AuditIssueGroup>();

  for (const rawIssue of issues || []) {
    const issue = String(rawIssue || "").trim();
    if (!issue) continue;
    const periodMatch = issue.match(/^Tiết\s+(\d+)\s*:\s*(.+)$/i);
    const periodNumber = periodMatch ? Number(periodMatch[1]) : undefined;
    const message = (periodMatch?.[2] || issue).trim();
    const key = periodNumber ? `period-${periodNumber}` : "general";
    const existing = groups.get(key) || {
      periodNumber,
      label: periodNumber ? `Tiết ${periodNumber}` : "Toàn bài",
      issues: [],
    };
    if (!existing.issues.includes(message)) existing.issues.push(message);
    groups.set(key, existing);
  }

  return [...groups.values()].sort((left, right) => {
    if (left.periodNumber === undefined) return -1;
    if (right.periodNumber === undefined) return 1;
    return left.periodNumber - right.periodNumber;
  });
}

export function auditPeriodPresentations(audit: PedagogyAudit): AuditPeriodPresentation[] {
  if (audit.periodChecks?.length) {
    return audit.periodChecks
      .map((period, index) => ({
        periodNumber: Number(period.periodNumber || index + 1),
        lessonType: period.lessonType,
        lessonTypeLabel: lessonTypeLabel(period.lessonType),
        checks: visibleAuditChecks(period.checks),
      }))
      .sort((left, right) => left.periodNumber - right.periodNumber);
  }

  return (audit.periodTypes || []).map((lessonType, index) => ({
    periodNumber: index + 1,
    lessonType,
    lessonTypeLabel: lessonTypeLabel(lessonType),
    checks: [],
  }));
}

export function isVietnameseAudit(audit: PedagogyAudit): boolean {
  return /^(tiếng\s*việt|tieng\s*viet)$/i.test((audit.subject || "").trim()) || Boolean(audit.lessonType || audit.periodTypes?.length);
}

export function isUncertainVietnameseAudit(audit: PedagogyAudit): boolean {
  return isVietnameseAudit(audit) && (audit.classificationConfidence === "low" || audit.lessonType === "mixed");
}
