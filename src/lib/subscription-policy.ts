import "server-only";

import { createHash, randomUUID } from "crypto";
import { Timestamp, type DocumentData } from "firebase-admin/firestore";
import { getFirebaseDb } from "@/lib/firebase-admin";
import { normalizeSubscriptionPlan, type SubscriptionPlan } from "@/lib/model-strategy";

export type UsageKind = "generate" | "refine";
export type PlanStatus = "free" | "trial" | "paid" | "expired";
export type PlanCardState = "active" | "available" | "trial_available" | "exhausted" | "expired" | "purchase_required";
export type PlanCatalogItem = { id: SubscriptionPlan; name: string; priceVnd: number; includedCredits: number; generationCost: number; refineCost: number; dailyLimit?: number; trialGenerations: number; benefits: string[] };

export const PLAN_CATALOG: Record<SubscriptionPlan, PlanCatalogItem> = {
  free: { id: "free", name: "Free", priceVnd: 0, includedCredits: 0, generationCost: 0, refineCost: 0, dailyLimit: 10, trialGenerations: 0, benefits: ["10 lượt tạo hoặc tinh chỉnh mỗi ngày", "Reset tự động lúc 00:00", "Đầy đủ công cụ soạn và xuất giáo án", "AI tối ưu chi phí qua OpenRouter", "Khung avatar trắng tinh giản"] },
  plus: { id: "plus", name: "Plus", priceVnd: 79_000, includedCredits: 50, generationCost: 10, refineCost: 5, trialGenerations: 2, benefits: ["50 tín dụng trong 30 ngày", "10 tín dụng cho một giáo án", "Tinh chỉnh chỉ 5 tín dụng", "Model GPT-5.4-mini", "Khung avatar vàng lấp lánh"] },
  pro: { id: "pro", name: "Pro", priceVnd: 150_000, includedCredits: 50, generationCost: 12, refineCost: 5, trialGenerations: 1, benefits: ["50 tín dụng trong 30 ngày", "12 tín dụng cho một giáo án", "Tinh chỉnh chỉ 5 tín dụng", "Model GPT-5.4 mạnh nhất", "Khung avatar bạch kim cao cấp"] },
};

export type PlanCard = PlanCatalogItem & { state: PlanCardState; selectable: boolean; active: boolean; reason: string; remaining: number; expiresAt: string | null; paid: boolean };
export type SubscriptionStatus = { activePlan: SubscriptionPlan; planStatus: PlanStatus; cards: PlanCard[]; free: { used: number; limit: number; remaining: number; dayKey: string; resetAt: string }; credits: { package: number; topup: number; total: number; expiresAt: string | null }; trials: { plusRemaining: number; proRemaining: number } };
export type UsageReservation = { operationId: string; uid: string; plan: SubscriptionPlan; kind: UsageKind; source: "free" | "trial" | "paid"; amount: number };

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
function dateValue(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (value instanceof Timestamp) return value.toDate();
  if (value && typeof value === "object" && "toDate" in value && typeof (value as { toDate?: unknown }).toDate === "function") return (value as { toDate(): Date }).toDate();
  if (typeof value === "string" || typeof value === "number") { const date = new Date(value); return Number.isFinite(date.getTime()) ? date : null; }
  return null;
}
function normalizedSnapshot(data: DocumentData, now: Date) {
  const activePlan = normalizeSubscriptionPlan(data.activePlan ?? data.plan);
  const paidPlan = normalizeSubscriptionPlan(data.paidPlan ?? (data.planStatus === "paid" ? activePlan : "free"));
  const expiresAt = dateValue(data.planExpiresAt);
  const hasPaidEntitlement = paidPlan !== "free" && Boolean(expiresAt && expiresAt > now);
  const activeTrialRemaining = activePlan === "plus" ? numberValue(data.trials?.plusRemaining, 0) : activePlan === "pro" ? numberValue(data.trials?.proRemaining, 0) : 0;
  const paid = activePlan !== "free" && activePlan === paidPlan && hasPaidEntitlement;
  const trial = activePlan !== "free" && !paid && activeTrialRemaining > 0;
  const expired = activePlan !== "free" && activePlan === paidPlan && !hasPaidEntitlement;
  return { activePlan, paidPlan, hasPaidEntitlement, planStatus: (paid ? "paid" : trial ? "trial" : expired ? "expired" : "free") as PlanStatus, paid, dayKey: String(data.freeDailyDayKey || ""), freeLimit: numberValue(data.freeDailyLimit ?? data.freeLimit, 10), freeUsed: numberValue(data.freeDailyUsed, 0), packageCredits: numberValue(data.packageCredits, 0), topupCredits: numberValue(data.topupCredits, 0), plusTrial: numberValue(data.trials?.plusRemaining, 0), proTrial: numberValue(data.trials?.proRemaining, 0), expiresAt };
}
export function initialSubscriptionFields(isNewAccount = true) {
  return { activePlan: "free", paidPlan: "free", planStatus: "free", freeDailyLimit: 10, freeDailyUsed: 0, freeDailyDayKey: vietnamDayKey(), packageCredits: 0, topupCredits: 0, creditsExpireAt: null, planStartedAt: null, planExpiresAt: null, trials: { plusRemaining: isNewAccount ? 2 : 0, proRemaining: isNewAccount ? 1 : 0 } };
}
export function buildSubscriptionStatus(data: DocumentData, now = new Date()): SubscriptionStatus {
  const snapshot = normalizedSnapshot(data, now);
  const today = vietnamDayKey(now);
  const freeUsed = snapshot.dayKey === today ? snapshot.freeUsed : 0;
  const freeRemaining = Math.max(0, snapshot.freeLimit - freeUsed);
  const packageCredits = snapshot.paid ? snapshot.packageCredits : 0;
  const topupCredits = snapshot.paid ? snapshot.topupCredits : 0;
  const totalCredits = packageCredits + topupCredits;
  const cards = (Object.values(PLAN_CATALOG) as PlanCatalogItem[]).map((catalog): PlanCard => {
    if (catalog.id === "free") {
      const available = freeRemaining > 0;
      const active = snapshot.activePlan === "free" && available;
      return { ...catalog, active, paid: false, remaining: freeRemaining, expiresAt: null, selectable: available, state: active ? "active" : available ? "available" : "exhausted", reason: available ? `Còn ${freeRemaining}/${snapshot.freeLimit} lượt hôm nay` : "Đã hết lượt hôm nay, tự mở lại lúc 00:00" };
    }
    const trialRemaining = catalog.id === "plus" ? snapshot.plusTrial : snapshot.proTrial;
    const ownsPaidPlan = catalog.id === snapshot.paidPlan && snapshot.hasPaidEntitlement;
    const enoughCredits = totalCredits >= catalog.generationCost;
    if (ownsPaidPlan) {
      const active = snapshot.activePlan === catalog.id && enoughCredits;
      return { ...catalog, active, paid: true, remaining: totalCredits, expiresAt: snapshot.expiresAt?.toISOString() || null, selectable: enoughCredits, state: active ? "active" : enoughCredits ? "available" : "exhausted", reason: enoughCredits ? `Còn ${totalCredits} tín dụng` : "Không đủ tín dụng để tạo giáo án" };
    }
    if (trialRemaining > 0) {
      const active = snapshot.activePlan === catalog.id && snapshot.planStatus === "trial";
      return { ...catalog, active, paid: false, remaining: trialRemaining, expiresAt: null, selectable: true, state: active ? "active" : "trial_available", reason: `Còn ${trialRemaining} lượt trải nghiệm` };
    }
    const expired = catalog.id === snapshot.paidPlan && !snapshot.hasPaidEntitlement && Boolean(snapshot.expiresAt);
    return { ...catalog, active: false, paid: false, remaining: 0, expiresAt: snapshot.expiresAt?.toISOString() || null, selectable: false, state: expired ? "expired" : "purchase_required", reason: expired ? "Gói đã hết hạn, vui lòng gia hạn" : "Đã hết trải nghiệm, cần mua gói" };
  });
  return { activePlan: snapshot.activePlan, planStatus: snapshot.planStatus, cards, free: { used: freeUsed, limit: snapshot.freeLimit, remaining: freeRemaining, dayKey: today, resetAt: nextVietnamMidnight(now).toISOString() }, credits: { package: packageCredits, topup: topupCredits, total: totalCredits, expiresAt: snapshot.expiresAt?.toISOString() || null }, trials: { plusRemaining: snapshot.plusTrial, proRemaining: snapshot.proTrial } };
}
export async function getSubscriptionStatus(uid: string) { const snapshot = await getFirebaseDb().collection("users").doc(uid).get(); return buildSubscriptionStatus(snapshot.data() || initialSubscriptionFields(false)); }
function operationDocId(uid: string, key: string, kind: UsageKind) { return createHash("sha256").update(`${uid}:${kind}:${key}`).digest("hex"); }
function ledgerRef(operationId: string, suffix: string) { return getFirebaseDb().collection("entitlementLedger").doc(`${operationId}_${suffix}`); }

export async function reserveUsage(uid: string, kind: UsageKind, idempotencyKey?: string): Promise<UsageReservation> {
  const db = getFirebaseDb(); const key = (idempotencyKey || randomUUID()).slice(0, 180); const operationId = operationDocId(uid, key, kind); const operationRef = db.collection("generationOperations").doc(operationId); const userRef = db.collection("users").doc(uid);
  return db.runTransaction(async (tx) => {
    const existing = await tx.get(operationRef);
    if (existing.exists) { const op = existing.data() || {}; if (op.status === "reserved" || op.status === "committed") return { operationId, uid, plan: normalizeSubscriptionPlan(op.plan), kind, source: op.source, amount: numberValue(op.amount) } as UsageReservation; throw new SubscriptionPolicyError("Yêu cầu này đã kết thúc và không thể dùng lại.", "IDEMPOTENCY_CONFLICT"); }
    const userSnapshot = await tx.get(userRef); if (!userSnapshot.exists) throw new SubscriptionPolicyError("Không tìm thấy hồ sơ người dùng.", "PROFILE_NOT_FOUND", 404);
    const data = userSnapshot.data() || {}; const status = buildSubscriptionStatus(data); const plan = status.activePlan; let source: UsageReservation["source"]; let amount = 1; let breakdown: { packageTaken: number; topupTaken: number } | null = null; const update: DocumentData = { updatedAt: new Date() }; let before = 0;
    if (plan === "free") { if (status.free.remaining < 1) throw new SubscriptionPolicyError("Bạn đã hết 10 lượt miễn phí hôm nay. Lượt sẽ tự mở lại lúc 00:00.", "FREE_DAILY_EXHAUSTED"); source = "free"; before = status.free.remaining; update.freeDailyDayKey = status.free.dayKey; update.freeDailyUsed = status.free.used + 1; }
    else if (status.planStatus === "trial") { if (kind === "refine") throw new SubscriptionPolicyError("Gói dùng thử không hỗ trợ tinh chỉnh. Vui lòng mua gói để nhận tín dụng.", "REFINE_REQUIRES_CREDITS"); const remaining = plan === "plus" ? status.trials.plusRemaining : status.trials.proRemaining; if (remaining < 1) throw new SubscriptionPolicyError("Bạn đã hết lượt trải nghiệm của gói này.", "TRIAL_EXHAUSTED"); source = "trial"; before = remaining; update[`trials.${plan}Remaining`] = remaining - 1; }
    else if (status.planStatus === "paid") { source = "paid"; amount = kind === "generate" ? PLAN_CATALOG[plan].generationCost : PLAN_CATALOG[plan].refineCost; if (status.credits.total < amount) throw new SubscriptionPolicyError(`Bạn cần ${amount} tín dụng nhưng hiện chỉ còn ${status.credits.total}.`, "INSUFFICIENT_CREDITS"); const packageTaken = Math.min(status.credits.package, amount); const topupTaken = amount - packageTaken; breakdown = { packageTaken, topupTaken }; before = status.credits.total; update.packageCredits = status.credits.package - packageTaken; update.topupCredits = status.credits.topup - topupTaken; }
    else throw new SubscriptionPolicyError("Gói đã hết hạn. Vui lòng gia hạn để tiếp tục sử dụng.", "PLAN_EXPIRED");
    const reservation: UsageReservation = { operationId, uid, plan, kind, source, amount }; const now = new Date(); tx.update(userRef, update); tx.create(operationRef, { ...reservation, status: "reserved", keyHash: createHash("sha256").update(key).digest("hex"), breakdown, reservedAt: now, expiresAt: new Date(now.getTime() + 30 * 60 * 1000) }); tx.create(ledgerRef(operationId, "reserve"), { uid, operationId, type: "reserve", kind, plan, source, amount, before, after: before - amount, actor: "system", reason: `${kind}_reserved`, createdAt: now }); return reservation;
  });
}
export async function commitUsage(reservation: UsageReservation, lessonId?: string) {
  const db = getFirebaseDb(); const ref = db.collection("generationOperations").doc(reservation.operationId);
  await db.runTransaction(async (tx) => { const snapshot = await tx.get(ref); if (!snapshot.exists) throw new SubscriptionPolicyError("Không tìm thấy lượt sử dụng đã giữ.", "RESERVATION_NOT_FOUND", 404); const op = snapshot.data() || {}; if (op.status === "committed") return; if (op.status !== "reserved") throw new SubscriptionPolicyError("Lượt sử dụng không còn ở trạng thái chờ.", "RESERVATION_ENDED"); const now = new Date(); tx.update(ref, { status: "committed", committedAt: now, lessonId: lessonId || null }); tx.create(ledgerRef(reservation.operationId, "consume"), { ...reservation, lessonId: lessonId || null, type: "consume", actor: "system", reason: `${reservation.kind}_completed`, createdAt: now }); });
}
export async function releaseUsage(reservation: UsageReservation, reason = "operation_failed") {
  const db = getFirebaseDb(); const operationRef = db.collection("generationOperations").doc(reservation.operationId); const userRef = db.collection("users").doc(reservation.uid);
  await db.runTransaction(async (tx) => { const operationSnapshot = await tx.get(operationRef); if (!operationSnapshot.exists || operationSnapshot.get("status") !== "reserved") return; const userSnapshot = await tx.get(userRef); if (!userSnapshot.exists) return; const data = userSnapshot.data() || {}; const update: DocumentData = { updatedAt: new Date() }; const breakdown = operationSnapshot.get("breakdown") || {}; if (reservation.source === "free" && data.freeDailyDayKey === vietnamDayKey()) update.freeDailyUsed = Math.max(0, numberValue(data.freeDailyUsed) - 1); else if (reservation.source === "trial") update[`trials.${reservation.plan}Remaining`] = numberValue(data.trials?.[`${reservation.plan}Remaining`]) + 1; else if (reservation.source === "paid") { update.packageCredits = numberValue(data.packageCredits) + numberValue(breakdown.packageTaken); update.topupCredits = numberValue(data.topupCredits) + numberValue(breakdown.topupTaken); } const now = new Date(); tx.update(userRef, update); tx.update(operationRef, { status: "released", releasedAt: now, releaseReason: reason }); tx.create(ledgerRef(reservation.operationId, "release"), { ...reservation, type: "release", actor: "system", reason, createdAt: now }); });
}
export async function activatePlan(uid: string, requestedPlan: unknown) {
  const plan = normalizeSubscriptionPlan(requestedPlan); const db = getFirebaseDb(); const userRef = db.collection("users").doc(uid);
  await db.runTransaction(async (tx) => { const snapshot = await tx.get(userRef); if (!snapshot.exists) throw new SubscriptionPolicyError("Không tìm thấy hồ sơ người dùng.", "PROFILE_NOT_FOUND", 404); const status = buildSubscriptionStatus(snapshot.data() || {}); const card = status.cards.find((item) => item.id === plan); if (!card?.selectable) throw new SubscriptionPolicyError(card?.reason || "Gói này chưa khả dụng.", "PLAN_NOT_AVAILABLE"); const planStatus: PlanStatus = plan === "free" ? "free" : card.paid ? "paid" : "trial"; const now = new Date(); tx.update(userRef, { activePlan: plan, plan: plan, planStatus, updatedAt: now }); tx.create(db.collection("entitlementLedger").doc(), { uid, type: "adjust", plan, amount: 0, actor: "system", reason: planStatus === "trial" ? "trial_activated" : "plan_selected", createdAt: now }); });
  return getSubscriptionStatus(uid);
}
export function subscriptionErrorResponse(error: unknown) { return error instanceof SubscriptionPolicyError ? { status: error.status, body: { error: error.message, code: error.code } } : null; }
