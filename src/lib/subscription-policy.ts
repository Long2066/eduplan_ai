import "server-only";

import { createHash, randomUUID } from "crypto";
import { Timestamp, type DocumentData } from "firebase-admin/firestore";
import { getFirebaseDb } from "@/lib/firebase-admin";
import { normalizeSubscriptionPlan, type SubscriptionPlan } from "@/lib/model-strategy";

export type UsageKind = "generate";
export type PlanStatus = "free" | "trial" | "paid" | "expired";
export type PlanCardState = "active" | "available" | "trial_available" | "exhausted" | "expired" | "purchase_required";
export type PlanCatalogItem = {
  id: SubscriptionPlan;
  name: string;
  badge: string;
  title: string;
  priceVnd: number;
  listPriceVnd: number;
  includedCredits: number;
  generationCost: number;
  dailyLimit?: number;
  trialGenerations: number;
  description: string;
  benefits: string[];
  cta: string;
  hint?: string;
};

export const FREE_DAILY_LIMIT = 3;
export const PAID_TRIAL_DAILY_CREDITS = 10;

export type SubscriptionSettings = {
  freeDailyLimit: number;
  paidTrialDailyCredits: number;
};

export const DEFAULT_SUBSCRIPTION_SETTINGS: SubscriptionSettings = {
  freeDailyLimit: FREE_DAILY_LIMIT,
  paidTrialDailyCredits: PAID_TRIAL_DAILY_CREDITS,
};

export const PLAN_CATALOG: Record<SubscriptionPlan, PlanCatalogItem> = {
  free: {
    id: "free",
    name: "Miễn phí",
    badge: "MIỄN PHÍ",
    title: "Miễn phí – Đủ dùng để bắt đầu",
    priceVnd: 0,
    listPriceVnd: 0,
    includedCredits: 0,
    generationCost: 0,
    dailyLimit: FREE_DAILY_LIMIT,
    trialGenerations: 0,
    description: "Phù hợp để trải nghiệm EduPlan và soạn nhanh các giáo án cơ bản mà không cần thanh toán.",
    benefits: ["Sử dụng AI GPT-4.1-mini.", "3 lượt tạo mỗi ngày.", "Tự động reset lúc 00:00.", "Đầy đủ cấu trúc và bộ kiểm tra sư phạm.", "Lưu lịch sử và xuất giáo án Word.", "Phù hợp để trải nghiệm và soạn các bài học cơ bản."],
    cta: "Tiếp tục miễn phí",
    hint: "Muốn nội dung mạch lạc, chuyên sâu và ổn định hơn? Hãy nâng cấp gói Trả phí.",
  },
  plus: {
    id: "plus",
    name: "Trả phí",
    badge: "PHỔ BIẾN NHẤT",
    title: "Trả phí – Chất lượng cao cho giáo viên",
    priceVnd: 59_000,
    listPriceVnd: 79_000,
    includedCredits: 50,
    generationCost: 10,
    trialGenerations: 0,
    description: "Phù hợp với giáo viên thường xuyên soạn bài và muốn có giáo án rõ ràng, tự nhiên, bám sát yêu cầu mà vẫn tiết kiệm chi phí.",
    benefits: ["Sử dụng model AI cao cấp.", "Nội dung mạch lạc và ổn định hơn gói Miễn phí.", "Bám sát mục tiêu, hoạt động và đánh giá.", "Diễn đạt tự nhiên, giúp giảm thời gian chỉnh sửa.", "Quyền sử dụng trong 30 ngày.", "Soạn tối đa 5 giáo án với 50 tín dụng.", "Đầy đủ công cụ lưu và xuất giáo án."],
    cta: "Nâng cấp Trả phí – 59.000đ",
    hint: "Chỉ khoảng 11.800đ cho một giáo án mới.",
  },
};

export type PlanCard = PlanCatalogItem & { state: PlanCardState; selectable: boolean; active: boolean; reason: string; remaining: number; expiresAt: string | null; paid: boolean };
export type SubscriptionStatus = { activePlan: SubscriptionPlan; planStatus: PlanStatus; cards: PlanCard[]; free: { used: number; limit: number; remaining: number; dayKey: string; resetAt: string }; credits: { package: number; topup: number; total: number; expiresAt: string | null }; trials: { plusRemaining: number; plusUsed: number; plusLimit: number; resetAt: string; proRemaining: number } };
export type UsageReservation = { operationId: string; uid: string; plan: SubscriptionPlan; kind: UsageKind; source: "free" | "trial" | "paid"; amount: number };
export type UsageMetadata = { userEmail?: string; subject?: string };
export type UsageTelemetry = Record<string, unknown>;

export class SubscriptionPolicyError extends Error {
  status: number;
  code: string;
  constructor(message: string, code = "SUBSCRIPTION_BLOCKED", status = 409) { super(message); this.name = "SUBSCRIPTION_POLICY"; this.code = code; this.status = status; }
}

const timezone = process.env.APP_TIMEZONE || "Asia/Ho_Chi_Minh";
const dayFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" });
export function vietnamDayKey(date = new Date()) { return dayFormatter.format(date); }
export function nextVietnamMidnight(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return new Date(Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day) + 1, -7));
}
function numberValue(value: unknown, fallback = 0) { const parsed = Number(value); return Number.isFinite(parsed) ? Math.max(0, parsed) : fallback; }
function boundedSetting(value: unknown, fallback: number) { return Math.min(1000, Math.floor(numberValue(value, fallback))); }
export function normalizeSubscriptionSettings(data: DocumentData = {}): SubscriptionSettings {
  return {
    freeDailyLimit: boundedSetting(data.defaultFreeLimit, FREE_DAILY_LIMIT),
    paidTrialDailyCredits: boundedSetting(data.paidTrialDailyCredits, PAID_TRIAL_DAILY_CREDITS),
  };
}
export async function getSubscriptionSettings() {
  const snapshot = await getFirebaseDb().collection("app_settings").doc("system").get();
  return normalizeSubscriptionSettings(snapshot.data() || {});
}
function dateValue(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (value instanceof Timestamp) return value.toDate();
  if (value && typeof value === "object" && "toDate" in value && typeof (value as { toDate?: unknown }).toDate === "function") return (value as { toDate(): Date }).toDate();
  if (typeof value === "string" || typeof value === "number") { const date = new Date(value); return Number.isFinite(date.getTime()) ? date : null; }
  return null;
}
function normalizedSnapshot(data: DocumentData, now: Date, settings: SubscriptionSettings) {
  const activePlan = normalizeSubscriptionPlan(data.activePlan ?? data.plan);
  const paidPlan = normalizeSubscriptionPlan(data.paidPlan ?? (data.planStatus === "paid" ? activePlan : "free"));
  const expiresAt = dateValue(data.planExpiresAt);
  // Ownership is an invariant of `paidPlan + planExpiresAt`. Credits and the
  // currently selected model must never downgrade or erase this entitlement.
  const hasPaidEntitlement = paidPlan !== "free" && Boolean(expiresAt && expiresAt > now);
  const today = vietnamDayKey(now);
  const paidTrialDayKey = String(data.paidTrialDailyDayKey || "");
  const paidTrialUsed = paidTrialDayKey === today ? numberValue(data.paidTrialDailyUsed, 0) : 0;
  const paidTrialRemaining = Math.max(0, settings.paidTrialDailyCredits - paidTrialUsed);
  const usesPaidEntitlement = activePlan === paidPlan && hasPaidEntitlement;
  const expired = activePlan !== "free" && activePlan === paidPlan && !hasPaidEntitlement;
  const trial = activePlan === "plus" && !usesPaidEntitlement && !expired && settings.paidTrialDailyCredits > 0;
  return { activePlan, paidPlan, hasPaidEntitlement, planStatus: (usesPaidEntitlement ? "paid" : trial ? "trial" : expired ? "expired" : "free") as PlanStatus, dayKey: String(data.freeDailyDayKey || ""), freeLimit: settings.freeDailyLimit, freeUsed: numberValue(data.freeDailyUsed, 0), paidTrialUsed, paidTrialRemaining, paidTrialLimit: settings.paidTrialDailyCredits, packageCredits: numberValue(data.packageCredits, 0), topupCredits: numberValue(data.topupCredits, 0), expiresAt };
}
export function initialSubscriptionFields(_isNewAccount = true) {
  return { activePlan: "free", paidPlan: "free", planStatus: "free", freeDailyLimit: FREE_DAILY_LIMIT, freeDailyUsed: 0, freeDailyDayKey: vietnamDayKey(), paidTrialDailyLimit: PAID_TRIAL_DAILY_CREDITS, paidTrialDailyUsed: 0, paidTrialDailyDayKey: vietnamDayKey(), packageCredits: 0, topupCredits: 0, creditsExpireAt: null, planStartedAt: null, planExpiresAt: null, trials: { plusRemaining: 0, proRemaining: 0 } };
}
export function buildSubscriptionStatus(data: DocumentData, now = new Date(), settings = DEFAULT_SUBSCRIPTION_SETTINGS): SubscriptionStatus {
  const snapshot = normalizedSnapshot(data, now, settings);
  const today = vietnamDayKey(now);
  const freeUsed = snapshot.dayKey === today ? snapshot.freeUsed : 0;
  const freeRemaining = Math.max(0, snapshot.freeLimit - freeUsed);
  const resetAt = nextVietnamMidnight(now).toISOString();
  // Keep the owned balance visible even while Free is selected. Reaching zero
  // only blocks new generations; ownership continues until plan expiry.
  const packageCredits = snapshot.hasPaidEntitlement ? snapshot.packageCredits : 0;
  const topupCredits = snapshot.hasPaidEntitlement ? snapshot.topupCredits : 0;
  const totalCredits = packageCredits + topupCredits;
  const cards = (Object.values(PLAN_CATALOG) as PlanCatalogItem[]).map((catalog): PlanCard => {
    if (catalog.id === "free") {
      const available = freeRemaining > 0;
      const active = snapshot.activePlan === "free";
      return { ...catalog, active, paid: false, remaining: freeRemaining, expiresAt: null, selectable: available, state: active ? "active" : available ? "available" : "exhausted", reason: available ? `Còn ${freeRemaining}/${snapshot.freeLimit} lượt hôm nay` : "Đã hết lượt hôm nay, tự mở lại lúc 00:00" };
    }
    const trialRemaining = snapshot.paidTrialRemaining;
    const ownsPaidPlan = catalog.id === snapshot.paidPlan && snapshot.hasPaidEntitlement;
    if (ownsPaidPlan) {
      const active = snapshot.activePlan === catalog.id;
      const enoughCredits = totalCredits >= catalog.generationCost;
      return { ...catalog, active, paid: true, remaining: totalCredits, expiresAt: snapshot.expiresAt?.toISOString() || null, selectable: true, state: active ? "active" : "available", reason: enoughCredits ? `Còn ${totalCredits} tín dụng` : "Gói vẫn còn hạn · Đã hết tín dụng" };
    }
    const expired = catalog.id === snapshot.paidPlan && !snapshot.hasPaidEntitlement && Boolean(snapshot.expiresAt);
    if (expired) {
      return { ...catalog, active: false, paid: false, remaining: 0, expiresAt: snapshot.expiresAt?.toISOString() || null, selectable: false, state: "expired", reason: "Gói đã hết hạn, vui lòng gia hạn" };
    }
    if (snapshot.paidTrialLimit > 0) {
      const active = snapshot.activePlan === catalog.id && snapshot.planStatus === "trial";
      const selectable = trialRemaining >= catalog.generationCost;
      return { ...catalog, active, paid: false, remaining: trialRemaining, expiresAt: null, selectable, state: active ? "active" : selectable ? "trial_available" : "exhausted", reason: selectable ? `Còn ${trialRemaining}/${snapshot.paidTrialLimit} tín dụng trải nghiệm hôm nay` : "Đã hết tín dụng trải nghiệm, tự mở lại lúc 00:00" };
    }
    return { ...catalog, active: false, paid: false, remaining: 0, expiresAt: snapshot.expiresAt?.toISOString() || null, selectable: false, state: "purchase_required", reason: "Nâng cấp để mở khóa model AI cao cấp" };
  });
  return { activePlan: snapshot.activePlan, planStatus: snapshot.planStatus, cards, free: { used: freeUsed, limit: snapshot.freeLimit, remaining: freeRemaining, dayKey: today, resetAt }, credits: { package: packageCredits, topup: topupCredits, total: totalCredits, expiresAt: snapshot.expiresAt?.toISOString() || null }, trials: { plusRemaining: snapshot.paidTrialRemaining, plusUsed: snapshot.paidTrialUsed, plusLimit: snapshot.paidTrialLimit, resetAt, proRemaining: 0 } };
}
export async function getSubscriptionStatus(uid: string) { const db = getFirebaseDb(); const [snapshot, settings] = await Promise.all([db.collection("users").doc(uid).get(), getSubscriptionSettings()]); return buildSubscriptionStatus(snapshot.data() || initialSubscriptionFields(false), new Date(), settings); }
function operationDocId(uid: string, key: string, kind: UsageKind) { return createHash("sha256").update(`${uid}:${kind}:${key}`).digest("hex"); }
function ledgerRef(operationId: string, suffix: string) { return getFirebaseDb().collection("entitlementLedger").doc(`${operationId}_${suffix}`); }

function applyReservationRefund(update: DocumentData, data: DocumentData, operation: DocumentData) {
  const source = operation.source as UsageReservation["source"];
  const breakdown = operation.breakdown || {};
  if (source === "free" && data.freeDailyDayKey === vietnamDayKey()) {
    update.freeDailyUsed = Math.max(0, numberValue(update.freeDailyUsed ?? data.freeDailyUsed) - 1);
  } else if (source === "trial" && data.paidTrialDailyDayKey === vietnamDayKey()) {
    update.paidTrialDailyUsed = Math.max(0, numberValue(update.paidTrialDailyUsed ?? data.paidTrialDailyUsed) - numberValue(operation.amount));
  } else if (source === "paid") {
    update.packageCredits = numberValue(update.packageCredits ?? data.packageCredits) + numberValue(breakdown.packageTaken);
    update.topupCredits = numberValue(update.topupCredits ?? data.topupCredits) + numberValue(breakdown.topupTaken);
  }
}

async function releaseExpiredReservations(uid: string) {
  const db = getFirebaseDb();
  const candidates = await db.collection("generationOperations")
    .where("uid", "==", uid)
    .limit(100)
    .get();
  const nowMs = Date.now();
  const expired = candidates.docs
    .filter((doc) => {
      const data = doc.data() || {};
      const expiresAt = data.expiresAt?.toDate?.() || data.expiresAt;
      return data.status === "reserved" && expiresAt instanceof Date && expiresAt.getTime() <= nowMs;
    })
    .slice(0, 20);
  for (const doc of expired) {
    await db.runTransaction(async (tx) => {
      const operationSnapshot = await tx.get(doc.ref);
      if (!operationSnapshot.exists || operationSnapshot.get("status") !== "reserved") return;
      const userRef = db.collection("users").doc(uid);
      const userSnapshot = await tx.get(userRef);
      if (!userSnapshot.exists) return;
      const operation = operationSnapshot.data() || {};
      const update: DocumentData = { updatedAt: new Date() };
      applyReservationRefund(update, userSnapshot.data() || {}, operation);
      const now = new Date();
      tx.update(userRef, update);
      tx.update(doc.ref, { status: "released", releasedAt: now, releaseReason: "reservation_expired" });
      tx.create(ledgerRef(doc.id, "release"), { uid, operationId: doc.id, plan: operation.plan, kind: operation.kind, source: operation.source, amount: operation.amount, type: "release", actor: "system", reason: "reservation_expired", createdAt: now });
    });
  }
}

export async function reserveUsage(uid: string, kind: UsageKind, idempotencyKey?: string, metadata: UsageMetadata = {}): Promise<UsageReservation> {
  await releaseExpiredReservations(uid).catch((error) => console.warn("[EduPlan AI] Expired usage reservation cleanup skipped", { uid, message: error instanceof Error ? error.message : "Unknown cleanup error" }));
  const db = getFirebaseDb(); const key = (idempotencyKey || randomUUID()).slice(0, 180); const operationId = operationDocId(uid, key, kind); const operationRef = db.collection("generationOperations").doc(operationId); const userRef = db.collection("users").doc(uid);
  return db.runTransaction(async (tx) => {
    const existing = await tx.get(operationRef);
    if (existing.exists) { const op = existing.data() || {}; if (op.status === "reserved" || op.status === "committed") return { operationId, uid, plan: normalizeSubscriptionPlan(op.plan), kind, source: op.source, amount: numberValue(op.amount) } as UsageReservation; throw new SubscriptionPolicyError("Yêu cầu này đã kết thúc và không thể dùng lại.", "IDEMPOTENCY_CONFLICT"); }
    const userSnapshot = await tx.get(userRef); if (!userSnapshot.exists) throw new SubscriptionPolicyError("Không tìm thấy hồ sơ người dùng.", "PROFILE_NOT_FOUND", 404);
    const settingsSnapshot = await tx.get(db.collection("app_settings").doc("system"));
    const settings = normalizeSubscriptionSettings(settingsSnapshot.data() || {});
    const data = userSnapshot.data() || {}; const status = buildSubscriptionStatus(data, new Date(), settings); const plan = status.activePlan; let source: UsageReservation["source"]; let amount = 1; let breakdown: { packageTaken: number; topupTaken: number } | null = null; const update: DocumentData = { updatedAt: new Date() }; let before = 0;
    if (plan === "free") { if (status.free.remaining < 1) throw new SubscriptionPolicyError(`Bạn đã hết ${status.free.limit} lượt miễn phí hôm nay. Lượt sẽ tự mở lại lúc 00:00.`, "FREE_DAILY_EXHAUSTED"); source = "free"; before = status.free.remaining; update.freeDailyDayKey = status.free.dayKey; update.freeDailyUsed = status.free.used + 1; }
    else if (status.planStatus === "trial") { amount = PLAN_CATALOG[plan].generationCost; const remaining = status.trials.plusRemaining; if (remaining < amount) throw new SubscriptionPolicyError("Bạn đã hết tín dụng trải nghiệm gói Trả phí hôm nay. Tín dụng sẽ tự mở lại lúc 00:00.", "TRIAL_EXHAUSTED"); source = "trial"; before = remaining; update.paidTrialDailyDayKey = status.free.dayKey; update.paidTrialDailyUsed = status.trials.plusUsed + amount; }
    else if (status.planStatus === "paid") { source = "paid"; amount = PLAN_CATALOG[plan].generationCost; if (status.credits.total < amount) throw new SubscriptionPolicyError(`Bạn cần ${amount} tín dụng nhưng hiện chỉ còn ${status.credits.total}.`, "INSUFFICIENT_CREDITS"); const packageTaken = Math.min(status.credits.package, amount); const topupTaken = amount - packageTaken; breakdown = { packageTaken, topupTaken }; before = status.credits.total; update.packageCredits = status.credits.package - packageTaken; update.topupCredits = status.credits.topup - topupTaken; }
    else throw new SubscriptionPolicyError("Gói đã hết hạn. Vui lòng gia hạn để tiếp tục sử dụng.", "PLAN_EXPIRED");
    const reservation: UsageReservation = { operationId, uid, plan, kind, source, amount }; const now = new Date(); tx.update(userRef, update); tx.create(operationRef, { ...reservation, status: "reserved", keyHash: createHash("sha256").update(key).digest("hex"), breakdown, userEmail: String(metadata.userEmail || "").slice(0, 320), subject: String(metadata.subject || "").slice(0, 120), reservedAt: now, expiresAt: new Date(now.getTime() + 30 * 60 * 1000) }); tx.create(ledgerRef(operationId, "reserve"), { uid, operationId, type: "reserve", kind, plan, source, amount, before, after: before - amount, actor: "system", reason: `${kind}_reserved`, createdAt: now }); return reservation;
  });
}
export async function commitUsage(reservation: UsageReservation, lessonId?: string, telemetry: UsageTelemetry = {}) {
  const db = getFirebaseDb(); const ref = db.collection("generationOperations").doc(reservation.operationId);
  await db.runTransaction(async (tx) => { const snapshot = await tx.get(ref); if (!snapshot.exists) throw new SubscriptionPolicyError("Không tìm thấy lượt sử dụng đã giữ.", "RESERVATION_NOT_FOUND", 404); const op = snapshot.data() || {}; if (op.status === "committed") return; if (op.status !== "reserved") throw new SubscriptionPolicyError("Lượt sử dụng không còn ở trạng thái chờ.", "RESERVATION_ENDED"); const now = new Date(); tx.update(ref, { status: "committed", committedAt: now, lessonId: lessonId || null, telemetry }); tx.create(ledgerRef(reservation.operationId, "consume"), { ...reservation, lessonId: lessonId || null, type: "consume", actor: "system", reason: `${reservation.kind}_completed`, createdAt: now }); });
}
export async function releaseUsage(reservation: UsageReservation, reason = "operation_failed", telemetry: UsageTelemetry = {}) {
  const db = getFirebaseDb(); const operationRef = db.collection("generationOperations").doc(reservation.operationId); const userRef = db.collection("users").doc(reservation.uid);
  await db.runTransaction(async (tx) => { const operationSnapshot = await tx.get(operationRef); if (!operationSnapshot.exists || operationSnapshot.get("status") !== "reserved") return; const userSnapshot = await tx.get(userRef); if (!userSnapshot.exists) return; const update: DocumentData = { updatedAt: new Date() }; applyReservationRefund(update, userSnapshot.data() || {}, operationSnapshot.data() || {}); const now = new Date(); tx.update(userRef, update); tx.update(operationRef, { status: "released", releasedAt: now, releaseReason: reason, telemetry }); tx.create(ledgerRef(reservation.operationId, "release"), { ...reservation, type: "release", actor: "system", reason, createdAt: now }); });
}
export async function activatePlan(uid: string, requestedPlan: unknown) {
  const plan = normalizeSubscriptionPlan(requestedPlan); const db = getFirebaseDb(); const userRef = db.collection("users").doc(uid);
  await db.runTransaction(async (tx) => { const snapshot = await tx.get(userRef); if (!snapshot.exists) throw new SubscriptionPolicyError("Không tìm thấy hồ sơ người dùng.", "PROFILE_NOT_FOUND", 404); const settingsSnapshot = await tx.get(db.collection("app_settings").doc("system")); const status = buildSubscriptionStatus(snapshot.data() || {}, new Date(), normalizeSubscriptionSettings(settingsSnapshot.data() || {})); const card = status.cards.find((item) => item.id === plan); if (!card?.selectable) throw new SubscriptionPolicyError(card?.reason || "Gói này chưa khả dụng.", "PLAN_NOT_AVAILABLE"); const planStatus: PlanStatus = plan === "free" ? "free" : card.paid ? "paid" : "trial"; const now = new Date();
    // Selecting a model is intentionally isolated from paidPlan, credits and
    // expiry fields. Those entitlement fields may only change in grant,
    // purchase, explicit admin revoke, or credit accounting transactions.
    tx.update(userRef, { activePlan: plan, plan, planStatus, updatedAt: now }); tx.create(db.collection("entitlementLedger").doc(), { uid, type: "adjust", plan, amount: 0, actor: "system", reason: planStatus === "trial" ? "trial_activated" : "plan_selected", createdAt: now }); });
  return getSubscriptionStatus(uid);
}
export function subscriptionErrorResponse(error: unknown) { return error instanceof SubscriptionPolicyError ? { status: error.status, body: { error: error.message, code: error.code } } : null; }
