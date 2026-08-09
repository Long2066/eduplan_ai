export const terminalPaymentStatuses = new Set(["approved", "rejected", "expired", "provider_failed"]);

export function isTerminalPaymentStatus(status: string) {
  return terminalPaymentStatuses.has(status);
}

export function paymentStorageKey(uid: string) {
  return `eduplan:active-payos:${uid}`;
}

export function formatPaymentCountdown(totalSeconds: number) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}
