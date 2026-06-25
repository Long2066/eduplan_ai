import { activityMinutes, pairedActivityActions, phaseKey } from "@/lib/lesson-format";
import type { LessonActivity, LessonPlan, PeriodPlan } from "@/types/lesson";

export type ActivityDocumentBlock = {
  heading: string;
  objective: string;
  products: string;
  actionPairs: Array<{ teacher: string; student: string }>;
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

function activityName(activity: LessonActivity) {
  const phase = clean(activity.phase);
  const title = clean(activity.title);
  if (!phase) return title || "Hoạt động";
  if (!title || title.toLowerCase() === phase.toLowerCase()) return phase;
  if (title.toLowerCase().includes(phase.toLowerCase())) return title;
  return `${phase}: ${title}`;
}

function fallbackProduct(activity: LessonActivity, index: number) {
  const key = phaseKey(`${activity.phase} ${activity.title}`);
  if (key === "Khởi động") return "Câu trả lời/chia sẻ ban đầu của học sinh.";
  if (key === "Khám phá") return "Kết quả quan sát, thảo luận hoặc phiếu học tập của học sinh.";
  if (key === "Luyện tập") return "Bài làm hoặc sản phẩm luyện tập của học sinh.";
  if (key === "Vận dụng") return "Ý tưởng/ví dụ vận dụng của học sinh gắn với đời sống.";
  return `Sản phẩm học tập của hoạt động ${index + 1}.`;
}

export function activityDocumentBlock(activity: LessonActivity, index: number): ActivityDocumentBlock {
  const minutes = activityMinutes(activity, index);

  return {
    heading: `${index + 1}. ${activityName(activity)} (${minutes} phút)`,
    objective: clean(activity.objective) || "Giúp học sinh hoàn thành mục tiêu học tập của hoạt động.",
    products: activity.learningProducts?.filter(Boolean).join("; ") || fallbackProduct(activity, index),
    actionPairs: pairedActivityActions(activity),
  };
}
