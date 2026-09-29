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

const pseudoMaterialInstructionPattern =
  /^(?:phương án thay thế|kế hoạch dự phòng|dự phòng khi|nhiệm vụ\s+(?:trao đổi|vận dụng|học tập|ở nhà|về nhà|rèn luyện|nhóm|cá nhân)|hướng dẫn\s+(?:về nhà|chuẩn bị)|lưu ý sư phạm|dặn dò|cách tổ chức|tiến trình|hoạt động của)/i;

const materialActionCutoffPattern =
  /[;,]\s*(?:(?:dùng\s+)?để\s+(?:gv|hs|tổ chức|thực hiện|tổng hợp|đánh dấu|chốt|kéo-thả|ghép|làm)|(?:gv|hs)\s+(?:dùng|chiếu|mời|quan sát|thực hiện|kéo-thả|trao đổi|trả lời|làm việc)|mở\s+slide|không\s+sử\s+dụng|nếu\s+wifi|khi\s+mất\s+mạng|khi\s+không\s+dùng\s+mạng).*$/i;

const materialActionColonPattern =
  /:\s*(?:(?:gv|hs)\s+(?:chiếu|quan sát|mời|nêu|tổ chức|hướng dẫn|thực hiện|làm việc|trao đổi)|quan sát\b|khoanh\b|nối\b|đánh dấu\b|câu hỏi\b|kéo-thả\b|để\s+gv|để\s+hs).*$/i;

const materialTrailingPurposePattern =
  /\s+(?:(?:dùng\s+)?để\s+(?:tổng hợp|chốt|tổ chức|thực hiện|đánh dấu|kéo-thả|phục vụ|minh họa|hỗ trợ|phân hóa|làm việc|trao đổi|hs|gv)|(?:cho|để)\s+(?:hs|gv|học sinh|giáo viên)\s+(?:làm việc|thực hiện|hoạt động|trao đổi|quan sát|học tập)).*$/i;

const noisyContextPattern =
  /\b(?:ở\s+khu\s+chung\s+cư\/nhà\s+phố|của\s+lớp\s+học\s+trường\s+thành\s+phố|tại\s+gia\s+đình\s+thành\s+thị|khi\s+không\s+dùng\s+mạng|khi\s+mất\s+mạng|nếu\s+wifi\s+không\s+ổn\s+định|mẫu\s+phân\s+hóa)\b/gi;

export function sanitizeMaterialItem(raw: string): string | null {
  if (!raw || typeof raw !== "string") return null;

  let cleaned = raw
    .replace(/^[-*–—•\s\d.]+\s*/, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned || pseudoMaterialInstructionPattern.test(cleaned)) {
    return null;
  }

  // Remove trailing clauses after semicolon/comma that describe pedagogical actions
  cleaned = cleaned.replace(materialActionCutoffPattern, "").trim();

  // If there is a colon followed by activity instructions, drop the instruction part
  if (materialActionColonPattern.test(cleaned)) {
    cleaned = cleaned.split(":")[0].trim();
  }

  // Remove trailing "để tổng hợp / để chốt / để HS làm việc..."
  cleaned = cleaned.replace(materialTrailingPurposePattern, "").trim();

  // Remove environment buzzwords
  cleaned = cleaned.replace(noisyContextPattern, "").trim();

  // Simplify verbose lists of examples after "gồm:"
  if (/\s+gồm\s*:/i.test(cleaned)) {
    cleaned = cleaned.split(/\s+gồm\s*:/i)[0].trim();
  }

  // Simplify overly descriptive computer/TV strings
  if (/^máy tính(?:\s+giáo viên)?\s+kết nối\s+tv/i.test(cleaned)) {
    cleaned = "Máy tính, ti vi / màn chiếu, bài trình chiếu (slide)";
  } else if (/^slide khởi động/i.test(cleaned)) {
    cleaned = "Bài trình chiếu (slide) / hình ảnh minh họa";
  } else if (/^sgk hoặc bản in các hình/i.test(cleaned)) {
    cleaned = "SGK hoặc tranh ảnh minh họa";
  }

  // Clean trailing punctuation and spaces
  cleaned = cleaned.replace(/[,;:.–—\s]+$/, "").trim();

  // Must have at least 3 characters and not be a pure verb/instruction
  if (cleaned.length < 3 || /^(?:gv|giáo viên|hs|học sinh)\b/i.test(cleaned)) {
    return null;
  }

  return cleaned;
}

export function sanitizeMaterialList(rawItems: unknown): string[] {
  const items = safeStringArray(rawItems);
  const result: string[] = [];
  const seen = new Set<string>();

  for (const item of items) {
    const cleaned = sanitizeMaterialItem(item);
    if (!cleaned) continue;

    const lower = cleaned.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);
    result.push(cleaned);
  }

  return result.slice(0, 8);
}

export function sanitizeMaterials(materials?: { teacher?: string[]; students?: string[] }): {
  teacher: string[];
  students: string[];
} {
  return {
    teacher: sanitizeMaterialList(materials?.teacher),
    students: sanitizeMaterialList(materials?.students),
  };
}
