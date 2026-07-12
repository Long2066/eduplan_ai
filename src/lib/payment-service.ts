import "server-only";

import { createHash, randomBytes } from "crypto";
import { FieldValue, Timestamp, type DocumentData, type Transaction } from "firebase-admin/firestore";
import { getFirebaseDb } from "@/lib/firebase-admin";
import { PLAN_CATALOG, buildSubscriptionStatus, type SubscriptionStatus } from "@/lib/subscription-policy";
import type { SubscriptionPlan } from "@/lib/model-strategy";

export type PurchaseType = "package" | "topup";
export type PaymentStatus = "awaiting_proof" | "precheck_failed" | "pending_review" | "approved" | "rejected" | "expired";
export type ApprovalMode = "automatic" | "manual";
export type PaymentCheck = { key: "amount" | "content" | "sender" | "time" | "transaction" | "duplicate"; passed: boolean; certain: boolean; detail: string };
export type PaymentOcr = { amount: number | null; contentCode: string; senderName: string; transferredAt: string | null; bankTransactionId: string; bankName: string; confidence: number; rawText?: string };
export type CheckoutInput = { purchaseType: PurchaseType; targetPlan?: unknown; amountVnd?: unknown; senderName: string };

export class PaymentError extends Error {
  status: number;
  code: string;
  constructor(message: string, code = "PAYMENT_ERROR", status = 400) { super(message); this.name = "PaymentError"; this.code = code; this.status = status; }
}

const checkoutMinutes = Number(process.env.PAYMENT_CHECKOUT_TTL_MINUTES || 30);
const beforeMinutes = Number(process.env.PAYMENT_TIME_WINDOW_BEFORE_MINUTES || 5);
const afterMinutes = Number(process.env.PAYMENT_TIME_WINDOW_AFTER_MINUTES || 30);
const subscriptionDays = Number(process.env.SUBSCRIPTION_DAYS || 30);
const creditPrice = Number(process.env.CREDIT_PRICE_VND || 1000);
const topupMinimum = Number(process.env.TOPUP_MIN_AMOUNT_VND || 25_000);

function normalizeText(value: unknown) { return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d").replace(/[^a-z0-9]/gi, "").toUpperCase(); }
function usernameForCode(value: string) { return normalizeText(value).slice(0, 16) || "EDUPLAN"; }
function randomCodePart() { const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ"; const bytes = randomBytes(5); return `${Array.from(bytes.slice(0, 4), (byte) => letters[byte % letters.length]).join("")}${bytes[4] % 10}`; }
function dateValue(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (value instanceof Timestamp) return value.toDate();
  if (value && typeof value === "object" && "toDate" in value && typeof (value as { toDate?: unknown }).toDate === "function") return (value as { toDate(): Date }).toDate();
  if (typeof value === "string" || typeof value === "number") { const date = new Date(value); return Number.isFinite(date.getTime()) ? date : null; }
  return null;
}
function publicBankConfig() {
  const bankName = process.env.BANK_NAME || ""; const accountName = process.env.BANK_ACCOUNT_NAME || ""; const accountNumber = process.env.BANK_ACCOUNT_NUMBER || ""; const qrImageUrl = process.env.BANK_QR_IMAGE_URL || "";
  return { bankName, accountName, accountNumber, qrImageUrl, configured: Boolean(bankName && accountName && accountNumber) };
}
function paymentPublicData(id: string, data: DocumentData) {
  return { id, purchaseType: data.purchaseType as PurchaseType, targetPlan: data.targetPlan as SubscriptionPlan, amountVnd: Number(data.amountVnd || 0), credits: Number(data.credits || 0), transferContent: String(data.transferContent || ""), senderName: String(data.senderName || ""), status: data.status as PaymentStatus, approvalMode: (data.approvalMode || null) as ApprovalMode | null, safeReason: String(data.safeReason || ""), checks: (data.checks || []) as PaymentCheck[], createdAt: dateValue(data.createdAt)?.toISOString() || null, expiresAt: dateValue(data.expiresAt)?.toISOString() || null, approvedAt: dateValue(data.approvedAt)?.toISOString() || null, bank: publicBankConfig() };
}
export function paymentErrorResponse(error: unknown) { return error instanceof PaymentError ? { status: error.status, body: { error: error.message, code: error.code } } : null; }
function validateTopup(status: SubscriptionStatus, amountVnd: number) {
  if (status.activePlan === "free" || status.planStatus !== "paid" || !status.credits.expiresAt) throw new PaymentError("Chỉ tài khoản Plus/Pro trả phí còn hạn mới có thể mua thêm tín dụng.", "TOPUP_REQUIRES_ACTIVE_PAID_PLAN", 409);
  if (!Number.isFinite(amountVnd) || amountVnd < topupMinimum || amountVnd % creditPrice !== 0) throw new PaymentError(`Số tiền mua thêm tối thiểu ${topupMinimum.toLocaleString("vi-VN")}đ và phải là bội số ${creditPrice.toLocaleString("vi-VN")}đ.`, "INVALID_TOPUP_AMOUNT");
}

export async function createCheckout(uid: string, displayName: string, input: CheckoutInput) {
  const db = getFirebaseDb();
  const purchaseType = input.purchaseType === "topup" ? "topup" : input.purchaseType === "package" ? "package" : null;
  if (!purchaseType) throw new PaymentError("Loại giao dịch không hợp lệ.", "INVALID_PURCHASE_TYPE");
  const senderName = String(input.senderName || "").trim();
  if (senderName.length < 2) throw new PaymentError("Vui lòng nhập đúng tên người chuyển khoản.", "SENDER_NAME_REQUIRED");
  const userSnapshot = await db.collection("users").doc(uid).get();
  if (!userSnapshot.exists) throw new PaymentError("Không tìm thấy hồ sơ người dùng.", "PROFILE_NOT_FOUND", 404);
  const status = buildSubscriptionStatus(userSnapshot.data() || {});
  let targetPlan: SubscriptionPlan; let amountVnd: number; let credits: number;
  if (purchaseType === "package") {
    targetPlan = input.targetPlan === "pro" ? "pro" : input.targetPlan === "plus" ? "plus" : "free";
    if (targetPlan === "free") throw new PaymentError("Chỉ Plus hoặc Pro cần tạo thanh toán.", "INVALID_TARGET_PLAN");
    amountVnd = PLAN_CATALOG[targetPlan].priceVnd; credits = PLAN_CATALOG[targetPlan].includedCredits;
  } else { targetPlan = status.activePlan; amountVnd = Number(input.amountVnd); validateTopup(status, amountVnd); credits = amountVnd / creditPrice; }
  const bank = publicBankConfig();
  if (!bank.configured) throw new PaymentError("Thông tin nhận chuyển khoản đang được cập nhật. Vui lòng quay lại sau.", "BANK_NOT_CONFIGURED", 503);
  const checkoutRef = db.collection("paymentRequests").doc(); const username = usernameForCode(displayName || uid); let transferContent = "";
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = `${username} ${randomCodePart()}`; const codeRef = db.collection("paymentCodes").doc(createHash("sha256").update(candidate).digest("hex"));
    try { await db.runTransaction(async (tx) => { const existing = await tx.get(codeRef); if (existing.exists) throw new PaymentError("Mã vừa được sử dụng.", "PAYMENT_CODE_COLLISION", 409); tx.create(codeRef, { checkoutId: checkoutRef.id, uid, code: candidate, createdAt: new Date() }); }); transferContent = candidate; break; }
    catch (error) { if (!(error instanceof PaymentError) || error.code !== "PAYMENT_CODE_COLLISION") throw error; }
  }
  if (!transferContent) throw new PaymentError("Không thể tạo mã thanh toán, vui lòng thử lại.", "PAYMENT_CODE_UNAVAILABLE", 503);
  const now = new Date(); const expiresAt = new Date(now.getTime() + checkoutMinutes * 60_000);
  await checkoutRef.create({ uid, purchaseType, targetPlan, amountVnd, credits, senderName, transferContent, targetExpiresAt: purchaseType === "topup" ? dateValue(status.credits.expiresAt) : null, status: "awaiting_proof", createdAt: now, updatedAt: now, expiresAt });
  return paymentPublicData(checkoutRef.id, (await checkoutRef.get()).data() || {});
}

export async function getPaymentForUser(uid: string, id: string) {
  const snapshot = await getFirebaseDb().collection("paymentRequests").doc(id).get();
  if (!snapshot.exists || snapshot.get("uid") !== uid) throw new PaymentError("Không tìm thấy giao dịch.", "PAYMENT_NOT_FOUND", 404);
  const data = snapshot.data() || {}; const expiresAt = dateValue(data.expiresAt);
  if (data.status === "awaiting_proof" && expiresAt && expiresAt < new Date()) { await snapshot.ref.update({ status: "expired", safeReason: "Yêu cầu thanh toán đã hết thời gian tải bill.", updatedAt: new Date() }); return paymentPublicData(snapshot.id, { ...data, status: "expired", safeReason: "Yêu cầu thanh toán đã hết thời gian tải bill." }); }
  return paymentPublicData(snapshot.id, data);
}

export function validatePaymentProof(checkout: DocumentData, ocr: PaymentOcr, fingerprintAvailable: boolean) {
  const createdAt = dateValue(checkout.createdAt); const transferredAt = dateValue(ocr.transferredAt); const expectedAmount = Number(checkout.amountVnd || 0); const expectedCode = normalizeText(checkout.transferContent); const expectedSender = normalizeText(checkout.senderName); const actualSender = normalizeText(ocr.senderName); const actualCode = normalizeText(ocr.contentCode || ocr.rawText);
  const timePassed = Boolean(createdAt && transferredAt && transferredAt.getTime() >= createdAt.getTime() - beforeMinutes * 60_000 && transferredAt.getTime() <= createdAt.getTime() + afterMinutes * 60_000); const senderPassed = Boolean(expectedSender && actualSender && (actualSender.includes(expectedSender) || expectedSender.includes(actualSender)));
  const checks: PaymentCheck[] = [
    { key: "amount", passed: ocr.amount === expectedAmount, certain: ocr.amount !== null, detail: ocr.amount === expectedAmount ? "Số tiền khớp chính xác." : "Số tiền không khớp yêu cầu." },
    { key: "content", passed: Boolean(expectedCode && actualCode.includes(expectedCode)), certain: Boolean(ocr.contentCode || ocr.rawText), detail: actualCode.includes(expectedCode) ? "Nội dung chuyển khoản khớp mã." : "Không tìm thấy đúng mã chuyển khoản." },
    { key: "sender", passed: senderPassed, certain: Boolean(actualSender), detail: senderPassed ? "Tên người chuyển khớp." : "Tên người chuyển chưa khớp." },
    { key: "time", passed: timePassed, certain: Boolean(transferredAt), detail: timePassed ? "Thời gian nằm trong cửa sổ cho phép." : "Thời gian không nằm trong khoảng -5/+30 phút." },
    { key: "transaction", passed: Boolean(ocr.bankTransactionId), certain: Boolean(ocr.bankTransactionId), detail: ocr.bankTransactionId ? "Đã nhận diện mã giao dịch ngân hàng." : "Chưa nhận diện được mã giao dịch." },
    { key: "duplicate", passed: fingerprintAvailable, certain: true, detail: fingerprintAvailable ? "Bill chưa từng được sử dụng." : "Bill hoặc giao dịch đã được sử dụng." },
  ];
  const allPassed = checks.every((check) => check.passed && check.certain) && ocr.confidence >= 0.8; const hardMismatch = checks.some((check) => check.certain && !check.passed && ["amount", "content", "time", "duplicate"].includes(check.key));
  return { checks, allPassed, hardMismatch, status: allPassed ? "approved" as const : hardMismatch ? "precheck_failed" as const : "pending_review" as const };
}

function grantEntitlement(tx: Transaction, userRef: FirebaseFirestore.DocumentReference, paymentRef: FirebaseFirestore.DocumentReference, data: DocumentData, mode: ApprovalMode, actor: string) {
  const now = new Date(); const targetPlan = data.targetPlan as SubscriptionPlan; const credits = Number(data.credits || 0);
  if (data.purchaseType === "package") { const expiresAt = new Date(now.getTime() + subscriptionDays * 24 * 60 * 60_000); tx.update(userRef, { activePlan: targetPlan, paidPlan: targetPlan, plan: targetPlan, planStatus: "paid", packageCredits: credits, topupCredits: 0, planStartedAt: now, planExpiresAt: expiresAt, creditsExpireAt: expiresAt, updatedAt: now }); }
  else tx.update(userRef, { topupCredits: FieldValue.increment(credits), updatedAt: now });
  const ledgerRef = getFirebaseDb().collection("entitlementLedger").doc(); tx.create(ledgerRef, { uid: data.uid, paymentId: paymentRef.id, type: "grant", plan: targetPlan, source: data.purchaseType, amount: credits, actor, reason: `${data.purchaseType}_${mode}_approved`, createdAt: now });
  tx.update(paymentRef, { status: "approved", approvalMode: mode, approvedAt: now, approvedBy: actor, approvedLedgerId: ledgerRef.id, safeReason: "Thanh toán đã được xác nhận và quyền lợi đã được cộng.", updatedAt: now });
}

export async function approvePayment(paymentId: string, mode: ApprovalMode, actor = "system") {
  const db = getFirebaseDb(); const paymentRef = db.collection("paymentRequests").doc(paymentId);
  await db.runTransaction(async (tx) => {
    const paymentSnapshot = await tx.get(paymentRef); if (!paymentSnapshot.exists) throw new PaymentError("Không tìm thấy giao dịch.", "PAYMENT_NOT_FOUND", 404); const data = paymentSnapshot.data() || {};
    if (data.status === "approved") return; if (mode === "automatic" && data.autoApprovalReady !== true) throw new PaymentError("Bill chưa vượt toàn bộ kiểm tra tự động.", "PAYMENT_NOT_READY", 409); if (!["pending_review", "awaiting_proof", "precheck_failed"].includes(data.status)) throw new PaymentError("Giao dịch không thể được duyệt ở trạng thái hiện tại.", "PAYMENT_STATE_CONFLICT", 409);
    const userRef = db.collection("users").doc(data.uid); const userSnapshot = await tx.get(userRef); if (!userSnapshot.exists) throw new PaymentError("Không tìm thấy hồ sơ người dùng.", "PROFILE_NOT_FOUND", 404);
    if (data.purchaseType === "topup") { const status = buildSubscriptionStatus(userSnapshot.data() || {}); if (status.activePlan !== data.targetPlan || status.planStatus !== "paid") throw new PaymentError("Gói đích đã thay đổi hoặc hết hạn; cần Admin kiểm tra.", "TOPUP_PLAN_CHANGED", 409); }
    grantEntitlement(tx, userRef, paymentRef, data, mode, actor);
  });
  const snapshot = await paymentRef.get(); return paymentPublicData(snapshot.id, snapshot.data() || {});
}

export async function saveProofResult(paymentId: string, uid: string, proof: { storagePath: string; sha256: string; transactionFingerprint: string }, ocr: PaymentOcr) {
  const db = getFirebaseDb(); const paymentRef = db.collection("paymentRequests").doc(paymentId); const hashRef = db.collection("paymentProofFingerprints").doc(`sha_${proof.sha256}`); const transactionRef = db.collection("paymentProofFingerprints").doc(`tx_${proof.transactionFingerprint}`); let autoApprove = false;
  await db.runTransaction(async (tx) => {
    const paymentSnapshot = await tx.get(paymentRef); if (!paymentSnapshot.exists || paymentSnapshot.get("uid") !== uid) throw new PaymentError("Không tìm thấy giao dịch.", "PAYMENT_NOT_FOUND", 404); const data = paymentSnapshot.data() || {};
    if (data.status === "approved") return; if (data.status !== "awaiting_proof") throw new PaymentError("Giao dịch không còn nhận bill mới.", "PAYMENT_STATE_CONFLICT", 409); const expiresAt = dateValue(data.expiresAt); if (expiresAt && expiresAt < new Date()) throw new PaymentError("Yêu cầu thanh toán đã hết hạn.", "PAYMENT_EXPIRED", 409);
    const hashSnapshot = await tx.get(hashRef); const txSnapshot = await tx.get(transactionRef); const fingerprintAvailable = !hashSnapshot.exists && !txSnapshot.exists; const verdict = validatePaymentProof(data, ocr, fingerprintAvailable); const now = new Date();
    if (fingerprintAvailable) { tx.create(hashRef, { paymentId, uid, kind: "sha256", createdAt: now }); tx.create(transactionRef, { paymentId, uid, kind: "bank_transaction", createdAt: now }); }
    tx.update(paymentRef, { storagePath: proof.storagePath, proofSha256: proof.sha256, transactionFingerprint: proof.transactionFingerprint, ocr, checks: verdict.checks, status: verdict.status, autoApprovalReady: verdict.allPassed, safeReason: verdict.allPassed ? "Bill đã vượt toàn bộ kiểm tra tự động." : verdict.hardMismatch ? "Bill không khớp một hoặc nhiều thông tin bắt buộc." : "Bill cần Admin kiểm tra thêm trước khi cộng quyền lợi.", proofSubmittedAt: now, updatedAt: now }); autoApprove = verdict.allPassed;
  });
  if (autoApprove) return approvePayment(paymentId, "automatic"); return getPaymentForUser(uid, paymentId);
}
