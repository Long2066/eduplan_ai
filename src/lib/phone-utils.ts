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

export function phoneToInternalEmail(phone: string): string {
  const normalized = normalizePhoneNumber(phone);
  const digits = normalized.replace(/\D/g, "");
  return `phone_${digits}@phone.eduplan.vn`;
}

export function isInternalPhoneEmail(email?: string): boolean {
  return Boolean(email && email.startsWith("phone_") && email.endsWith("@phone.eduplan.vn"));
}
