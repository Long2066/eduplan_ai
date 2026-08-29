import type { LessonActivity } from "@/types/lesson";
import { canonicalizeLessonTitle } from "@/lib/lesson-title";
import { canonicalLessonPhase, lessonPhaseOrder } from "@/lib/lesson-phase-quality";

export const requiredActivityPhases = lessonPhaseOrder;

export function canonicalLessonTitle(title: string) {
  return canonicalizeLessonTitle(title);
}

export function lessonHeadingTitle(title: string) {
  return canonicalLessonTitle(title).toLocaleUpperCase("vi");
}

export function phaseKey(value: string) {
  return canonicalLessonPhase(value);
}

export function activityPhaseKey(activity: { phase?: string; title?: string }) {
  const explicitPhase = phaseKey(activity.phase || "");
  return explicitPhase || phaseKey(activity.title || "");
}

export function canonicalizeOrderedActivityPhases(activities: LessonActivity[]) {
  if (activities.length < requiredActivityPhases.length) return activities;
  return activities.map((activity, index) => index < requiredActivityPhases.length
    ? { ...activity, phase: requiredActivityPhases[index] }
    : activity);
}

export function activityMinutes(activity: LessonActivity, index: number) {
  if (activity.durationMinutes && Number.isFinite(activity.durationMinutes)) return activity.durationMinutes;
  const key = activityPhaseKey(activity);
  if (key === "Khởi động") return 5;
  if (key === "Khám phá") return 15;
  if (key === "Luyện tập") return 10;
  if (key === "Vận dụng") return 5;
  return index === 0 ? 5 : 7;
}

function cleanActionText(value: string) {
  const trimmed = (value || "").trim();
  if (trimmed.includes("\n")) {
    return trimmed
      .replace(/^[-–—•\s]+/, "")
      .replace(/\r\n/g, "\n");
  }
  return trimmed
    .replace(/^[-–—•\s]+/, "")
    .replace(/\s+/g, " ");
}

const internalActivityMetadataPattern = /^(học liệu\/đầu vào|học liệu|đầu vào|cách tổ chức|tiêu chí thành công|đáp án dự kiến|lỗi thường gặp|phản hồi của gv|hỗ trợ hs cần giúp đỡ|mở rộng cho hs hoàn thành sớm)\s*[:：-]/i;

function cleanRenderableActionText(value: string) {
  return cleanActionText(value)
    .replace(/^(?:\*+\s*)?cách tiến hành\s*[:：-]\s*/i, "")
    .trim();
}

function renderableActionArray(value: unknown) {
  return safeStringArray(value)
    .map(cleanRenderableActionText)
    .filter((item) => item && !internalActivityMetadataPattern.test(item));
}

export function normalizeActionActor(value: string | undefined, actor: "GV" | "HS", fallback: string) {
  const cleaned = cleanActionText(value || fallback);
  const withoutActor = cleaned
    .replace(/^(gv|giáo viên|giao vien|hs|học sinh|hoc sinh)\s*[:：,.\-–—]?\s*/i, "")
    .trim();
  const action = withoutActor || cleanActionText(fallback).replace(/^(gv|hs)\s*[:：,.\-–—]?\s*/i, "").trim();
  return `${actor} ${action}`.trim();
}

function studentFallbackForTeacherAction(teacherAction: string, stepNumber: number) {
  const teacher = teacherAction.toLowerCase();
  if (/chốt|kết luận|chuyển\s+(sang|vào|ý)|liên hệ.*(bài|mục|hoạt động)|giới thiệu.*(phần|hoạt động|nội dung)/i.test(teacher)) {
    return "HS lắng nghe, ghi nhớ ý chính và sẵn sàng chuyển sang hoạt động tiếp theo.";
  }
  if (/nhận xét|khen|động viên|tuyên dương|góp ý|sửa lỗi|chỉnh sửa|bổ sung/i.test(teacher)) {
    return "HS lắng nghe nhận xét, tự điều chỉnh và bổ sung ý kiến khi cần.";
  }
  if (/giao.*(về nhà|hoàn thiện ở nhà|chuẩn bị)|dặn dò|nhắc hs.*(về nhà|chuẩn bị)/i.test(teacher)) {
    return "HS ghi nhớ nhiệm vụ về nhà và chuẩn bị thực hiện theo yêu cầu.";
  }
  if (/thu phiếu|thu bài|kiểm tra nhanh|đối chiếu|chữa bài/i.test(teacher)) {
    return "HS nộp sản phẩm, đối chiếu kết quả và lắng nghe góp ý của GV.";
  }
  if (/đặt câu hỏi|câu hỏi|hỏi hs|gợi mở/i.test(teacher)) {
    return "HS suy nghĩ, trả lời câu hỏi và bổ sung ý kiến cho bạn.";
  }
  if (/yêu cầu|giao nhiệm vụ|hướng dẫn|tổ chức|phát phiếu|làm việc|thảo luận|trao đổi|tìm|xác định|viết|tính|vẽ|lập|hoàn thành|trình bày|đóng vai/i.test(teacher)) {
    return "HS thực hiện nhiệm vụ, hoàn thành sản phẩm học tập và báo cáo kết quả.";
  }
  return `HS theo dõi hướng dẫn của GV và tham gia bước ${stepNumber} của hoạt động.`;
}

export function safeStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => safeStringArray(item)).map((item) => item.trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    if (trimmed.includes("\n")) {
      return trimmed
        .split("\n")
        .map((line) => line.replace(/^[-*–—•\s\d.]+\s*/, "").trim())
        .filter(Boolean);
    }
    return [trimmed];
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return [String(value)];
  }
  if (value && typeof value === "object") {
    return Object.values(value).flatMap((item) => safeStringArray(item));
  }
  return [];
}

export function pairedActivityActions(activity: LessonActivity) {
  const teacherActions = renderableActionArray(activity.teacherActions);
  const studentActions = renderableActionArray(activity.studentActions);
  const size = Math.max(teacherActions.length, studentActions.length, 1);

  return Array.from({ length: size }, (_, index) => {
    const teacher = normalizeActionActor(
      teacherActions[index],
      "GV",
      `GV tiếp tục hướng dẫn, quan sát và hỗ trợ học sinh hoàn thành bước ${index + 1} của hoạt động.`,
    );
    const student = normalizeActionActor(
      studentActions[index],
      "HS",
      studentFallbackForTeacherAction(teacher, index + 1),
    );

    return { teacher, student };
  });
}
