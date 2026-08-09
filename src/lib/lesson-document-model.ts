import { activityMinutes, pairedActivityActions, safeStringArray } from "@/lib/lesson-format";
import type { LessonActivity, LessonActivityErrorFeedback, LessonPlan, PeriodPlan } from "@/types/lesson";

export type ActivityDocumentDetail = {
  label: string;
  text: string;
  tone: "neutral" | "success" | "support" | "extension";
};

export type ActivityDocumentBlock = {
  heading: string;
  objective: string;
  products: string;
  details: ActivityDocumentDetail[];
  actionPairs: Array<{ teacher: string; student: string }>;
};

export type ActivityDocumentOptions = {
  compact?: boolean;
  concise?: boolean;
};

export function gradeLabel(grade: string) {
  return /^lớp\s+/i.test(grade.trim()) ? grade.trim() : `LỚP ${grade}`;
}

export function normalizedPeriods(lesson: LessonPlan): PeriodPlan[] {
  if (lesson.periodPlans?.length) return lesson.periodPlans;
  return [{ periodNumber: 1, focus: "Tiến trình dạy học", activities: lesson.activities }];
}

function clean(value?: string) {
  return (value || "").trim().replace(/\s+/g, " ");
}

function firstClean(value: unknown) {
  return safeStringArray(value).map(clean).find(Boolean) || "";
}

function compactText(value: string, maxLength = 180) {
  const text = clean(value);
  if (text.length <= maxLength) return text;
  const sentenceEnd = text.search(/[.!?](\s|$)/);
  if (sentenceEnd >= 60 && sentenceEnd + 1 <= maxLength) return text.slice(0, sentenceEnd + 1).trim();
  return `${text.slice(0, maxLength - 1).trim().replace(/[;,:\-–—]+$/, "")}…`;
}

function compactProducts(activity: LessonActivity) {
  const product = firstClean(activity.learningProducts);
  if (product) return compactText(product, 160);
  return compactText(firstClean(activity.successCriteria), 160);
}

function conciseProducts(activity: LessonActivity) {
  const product = firstClean(activity.learningProducts);
  const criteria = safeStringArray(activity.successCriteria).map(clean).filter(Boolean).join("; ");
  if (product && criteria) return compactText(`${product}; đánh giá: ${criteria}`, 220);
  if (product) return compactText(product, 180);
  return compactText(criteria, 180);
}

function activityName(activity: LessonActivity) {
  const phase = clean(activity.phase);
  const title = clean(activity.title);
  if (!phase) return title || "Hoạt động";
  if (!title || title.toLowerCase() === phase.toLowerCase()) return phase;
  if (title.toLowerCase().includes(phase.toLowerCase())) return title;
  return `${phase}: ${title}`;
}

function organizationLabel(value: LessonActivity["organization"]) {
  const labels = {
    individual: "Cá nhân",
    pair: "Cặp đôi",
    group: "Nhóm",
    whole_class: "Toàn lớp",
  } as const;
  return value ? labels[value] : "";
}

function detail(
  label: string,
  values: unknown,
  tone: ActivityDocumentDetail["tone"] = "neutral",
): ActivityDocumentDetail | null {
  const text = safeStringArray(values).map(clean).filter(Boolean).join("; ");
  return text ? { label, text, tone } : null;
}

function activityDetails(activity: LessonActivity, options: ActivityDocumentOptions = {}) {
  if (options.compact || options.concise) return [];
  const errorFeedback = Array.isArray(activity.errorFeedback)
    ? activity.errorFeedback
        .map((item: LessonActivityErrorFeedback) => {
          const feedback = safeStringArray(item.feedback).map(clean).filter(Boolean).join("; ");
          return clean(item.error) && feedback ? `${clean(item.error)} → ${feedback}` : "";
        })
        .filter(Boolean)
    : safeStringArray(activity.errorFeedback);
  return [
    detail("Học liệu/đầu vào", activity.inputOrMaterials),
    detail("Cách tổ chức", [organizationLabel(activity.organization)]),
    detail("Tiêu chí thành công", activity.successCriteria, "success"),
    detail("Đáp án dự kiến", [activity.expectedAnswer, ...safeStringArray(activity.acceptableResponses)]),
    detail("Lỗi thường gặp", activity.commonErrors),
    detail("Phản hồi của GV", [...safeStringArray(activity.teacherFeedback), ...errorFeedback]),
    detail("Hỗ trợ HS cần giúp đỡ", activity.supportForStudentsNeedingHelp, "support"),
    detail("Mở rộng cho HS hoàn thành sớm", activity.extensionForEarlyFinishers, "extension"),
  ].filter((item): item is ActivityDocumentDetail => Boolean(item));
}

export function activityDocumentBlock(activity: LessonActivity, index: number, options: ActivityDocumentOptions = {}): ActivityDocumentBlock {
  const minutes = activityMinutes(activity, index);

  return {
    heading: `${index + 1}. ${activityName(activity)} (${minutes} phút)`,
    objective: clean(activity.objective) || "Giúp học sinh hoàn thành mục tiêu học tập của hoạt động.",
    products: options.compact
      ? compactProducts(activity)
      : options.concise
        ? conciseProducts(activity)
      : safeStringArray(activity.learningProducts).map(clean).filter(Boolean).join("; ") || "",
    details: activityDetails(activity, options),
    actionPairs: pairedActivityActions(activity),
  };
}
