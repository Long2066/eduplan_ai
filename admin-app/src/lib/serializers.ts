import type { DocumentData, QueryDocumentSnapshot } from "firebase-admin/firestore";

export function toIso(value: unknown) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object" && value !== null && "toDate" in value) return (value as { toDate: () => Date }).toDate().toISOString();
  return "";
}

export const ONLINE_WINDOW_MS = 150_000;

function normalizePlan(value: unknown) {
  return value === "plus" || value === "pro" ? "plus" : "free";
}

function vietnamDayKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export type AdminQuotaSettings = {
  freeDailyLimit: number;
  paidTrialDailyCredits: number;
};

export function serializeUser(doc: QueryDocumentSnapshot<DocumentData>, settings: AdminQuotaSettings = { freeDailyLimit: 3, paidTrialDailyCredits: 10 }) {
  const data = doc.data();
  const today = vietnamDayKey();
  const freeLimit = Math.max(0, Number(settings.freeDailyLimit || 0));
  const usedGenerations = data.freeDailyDayKey === today ? Math.max(0, Number(data.freeDailyUsed || 0)) : 0;
  const paidTrialLimit = Math.max(0, Number(settings.paidTrialDailyCredits || 0));
  const paidTrialUsed = data.paidTrialDailyDayKey === today ? Math.max(0, Number(data.paidTrialDailyUsed || 0)) : 0;
  const disabled = Boolean(data.disabled);
  const blockedReason = String(data.blockedReason || "");
  const blockedReasonDetail = String(data.blockedReasonDetail || "");
  const blockedAt = toIso(data.blockedAt);
  const lastSeenAt = toIso(data.lastSeenAt) || toIso(data.lastLoginAt);
  const lastSeenMs = lastSeenAt ? new Date(lastSeenAt).getTime() : 0;
  const presenceState = data.presenceState === "online" ? "online" : "offline";
  const isOnline = !disabled
    && presenceState === "online"
    && Number.isFinite(lastSeenMs)
    && Date.now() - lastSeenMs <= ONLINE_WINDOW_MS;
  return {
    id: doc.id,
    uid: doc.id,
    email: String(data.email || ""),
    displayName: String(data.displayName || ""),
    photoURL: String(data.photoURL || ""),
    emailVerified: Boolean(data.emailVerified),
    disabled,
    blockedReason,
    blockedReasonDetail,
    blockedAt,
    role: data.role === "admin" ? "admin" : "user",
    plan: normalizePlan(data.plan),
    lastLoginIpHash: String(data.lastLoginIpHash || ""),
    ipLimitOverride: Boolean(data.ipLimitOverride),
    mustChangePassword: Boolean(data.mustChangePassword),
    freeLimit,
    usedGenerations,
    remainingGenerations: Math.max(0, freeLimit - usedGenerations),
    paidTrialLimit,
    paidTrialUsed,
    paidTrialRemaining: Math.max(0, paidTrialLimit - paidTrialUsed),
    activePlan: normalizePlan(data.activePlan || data.plan),
    paidPlan: data.paidPlan ? normalizePlan(data.paidPlan) : "",
    planStatus: String(data.planStatus || "free"),
    packageCredits: Number(data.packageCredits || 0),
    topupCredits: Number(data.topupCredits || 0),
    planExpiresAt: toIso(data.planExpiresAt),
    presenceState,
    isOnline,
    lastSeenAt,
    lastLoginAt: toIso(data.lastLoginAt),
    lastOfflineAt: toIso(data.lastOfflineAt),
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt),
  };
}

export function serializeLesson(doc: QueryDocumentSnapshot<DocumentData>) {
  const data = doc.data();
  return {
    id: doc.id,
    ownerId: String(data.ownerId || ""),
    title: String(data.title || ""),
    subject: String(data.subject || ""),
    grade: String(data.grade || ""),
    periods: Number(data.periods || 1),
    lesson: data.lesson || null,
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt),
    expiresAt: toIso(data.expiresAt),
  };
}

export function serializeAudit(doc: QueryDocumentSnapshot<DocumentData>) {
  const data = doc.data();
  return {
    id: doc.id,
    action: String(data.action || ""),
    adminEmail: String(data.adminEmail || ""),
    adminUid: String(data.adminUid || ""),
    detail: data.detail || {},
    createdAt: toIso(data.createdAt),
  };
}

export function serializeFeedback(doc: QueryDocumentSnapshot<DocumentData>) {
  const data = doc.data();
  return {
    id: doc.id,
    category: String(data.category || "other"),
    status: ["new", "in_progress", "resolved", "ignored", "reviewed"].includes(String(data.status))
      ? String(data.status)
      : "new",
    priority: ["low", "medium", "high"].includes(String(data.priority)) ? String(data.priority) : "medium",
    adminNote: String(data.adminNote || ""),
    message: String(data.message || ""),
    userId: String(data.userId || ""),
    userEmail: String(data.userEmail || ""),
    userName: String(data.userName || ""),
    pageUrl: String(data.pageUrl || ""),
    userAgent: String(data.userAgent || ""),
    pilot: data.pilot && typeof data.pilot === "object" ? data.pilot : null,
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt),
  };
}
