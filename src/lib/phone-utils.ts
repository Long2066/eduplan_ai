export function normalizePhoneNumber(raw: string): string {
  const cleaned = raw.trim().replace(/[\s.\-()]/g, "");
  if (!cleaned) return "";
  if (cleaned.startsWith("+")) return cleaned;
  if (cleaned.startsWith("84")) return `+${cleaned}`;
  if (cleaned.startsWith("0")) return `+84${cleaned.slice(1)}`;
  return `+84${cleaned}`;
}

export function isValidPhoneNumber(phone: string): boolean {
  return /^\+[1-9]\d{8,14}$/.test(phone);
}
