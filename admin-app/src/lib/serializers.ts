import type { DocumentData, QueryDocumentSnapshot } from "firebase-admin/firestore";

export function toIso(value: unknown) {
  if (!value) return "";
  if (typeof value === "string") return value;
  const maybeTimestamp = value as { toDate?: () => Date };
  if (typeof maybeTimestamp.toDate === "function") return maybeTimestamp.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return "";
}

export function serializeUser(doc: QueryDocumentSnapshot<DocumentData>) {
  const data = doc.data();
  const freeLimit = Number(data.freeLimit ?? 10);
  const usedGenerations = Number(data.usedGenerations ?? 0);
  return {
    uid: doc.id,
    email: String(data.email || ""),
    displayName: String(data.displayName || ""),
    role: data.role === "admin" ? "admin" : "user",
    plan: String(data.plan || "free"),
    emailVerified: Boolean(data.emailVerified),
    disabled: Boolean(data.disabled),
    mustChangePassword: Boolean(data.mustChangePassword),
    freeLimit,
    usedGenerations,
    remainingGenerations: Math.max(0, freeLimit - usedGenerations),
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
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt),
  };
}
