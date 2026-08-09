export const ADMIN_MANUAL_BLOCK_REASON = "admin_manual";
export const IP_ACCOUNT_LIMIT_REASON = "ip_account_limit";
export const BLOCK_REASON_MAX_LENGTH = 500;
export const SUPPORT_PHONE = "0342 733 640";
export const IP_ACCOUNT_LIMIT_MESSAGE = "Bạn đang sử dụng quá nhiều tài khoản để truy cập, vui lòng chỉ sử dụng 1 tài khoản để truy cập. Trân trọng.";

export function normalizeBlockReasonDetail(value: unknown) {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, BLOCK_REASON_MAX_LENGTH);
}

export function accountBlockedMessage(blockedReason: unknown, blockedReasonDetail?: unknown) {
  const reason = String(blockedReason || "");
  if (reason === IP_ACCOUNT_LIMIT_REASON) return IP_ACCOUNT_LIMIT_MESSAGE;

  const detail = normalizeBlockReasonDetail(blockedReasonDetail);
  if (detail) {
    return `Tài khoản đã bị khóa. Lý do từ quản trị viên: ${detail}. Nếu cần hỗ trợ, vui lòng liên hệ ${SUPPORT_PHONE}.`;
  }

  return `Tài khoản của bạn bị khóa, vui lòng liên hệ hỗ trợ kĩ thuật ${SUPPORT_PHONE} nếu bạn cho là bị nhầm lẫn.`;
}
