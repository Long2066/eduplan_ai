import "server-only";

import { createHash, randomBytes } from "crypto";
import { FieldValue, Timestamp, type DocumentData, type Transaction } from "firebase-admin/firestore";
import { getFirebaseDb } from "@/lib/firebase-admin";
import { createPayosDescription, createPayosOrderCode, resolvePaymentProvider, type PaymentProvider } from "@/lib/payment-checkout";
import { createPayosPaymentLink, getPayosConfig, PayosClientError, verifyPayosWebhookSignature, type PayosWebhookPayload } from "@/lib/payos-client";
import { PLAN_CATALOG, buildSubscriptionStatus, type SubscriptionStatus } from "@/lib/subscription-policy";
import { normalizeSubscriptionPlan, type SubscriptionPlan } from "@/lib/model-strategy";

export type PurchaseType = "package" | "topup";
export type PaymentStatus = "creating" | "awaiting_payment" | "provider_failed" | "pending_review" | "approved" | "rejected" | "expired";
export type ApprovalMode = "automatic" | "manual";
export type PaymentCheck = { key: "amount" | "content" | "time" | "transaction" | "duplicate"; passed: boolean; certain: boolean; detail: string };
export type CheckoutInput = { purchaseType: PurchaseType; targetPlan?: unknown; amountVnd?: unknown };

export class PaymentError extends Error {
  status: number;
  code: string;
  constructor(message: string, code = "PAYMENT_ERROR", status = 400) { super(message); this.name = "PaymentError"; this.code = code; this.status = status; }
}

const checkoutMinutes = Number(process.env.PAYMENT_CHECKOUT_TTL_MINUTES || 30);
const subscriptionDays = Number(process.env.SUBSCRIPTION_DAYS || 30);
const creditPrice = Number(process.env.CREDIT_PRICE_VND || 1000);
const topupMinimum = Number(process.env.TOPUP_MIN_AMOUNT_VND || 25_000);

function normalizeText(value: unknown) { return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d").replace(/[^a-z0-9]/gi, "").toUpperCase(); }
function dateValue(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (value instanceof Timestamp) return value.toDate();
  if (value && typeof value === "object" && "toDate" in value && typeof (value as { toDate?: unknown }).toDate === "function") return (value as { toDate(): Date }).toDate();
  if (typeof value === "string" || typeof value === "number") { const date = new Date(value); return Number.isFinite(date.getTime()) ? date : null; }
  return null;
}
export function isReusablePayosCheckout(data: DocumentData, now = new Date()) {
  const expiresAt = dateValue(data.expiresAt);
  return data.provider === "payos"
    && ["creating", "awaiting_payment", "pending_review"].includes(String(data.status || ""))
    && Boolean(expiresAt && expiresAt > now);
}
async function clearActivePayosCheckout(uid: string, paymentId: string) {
  const db = getFirebaseDb();
  const activeRef = db.collection("paymentActiveCheckouts").doc(uid);
  await db.runTransaction(async (tx) => {
    const active = await tx.get(activeRef);
    if (active.exists && active.get("paymentId") === paymentId) tx.delete(activeRef);
  }).catch(() => undefined);
}
function publicBankConfig() {
  const bankName = process.env.BANK_NAME || ""; const accountName = process.env.BANK_ACCOUNT_NAME || ""; const accountNumber = process.env.BANK_ACCOUNT_NUMBER || ""; const qrImageUrl = process.env.BANK_QR_IMAGE_URL || "";
  return { bankName, accountName, accountNumber, qrImageUrl, configured: Boolean(bankName && accountName && accountNumber) };
}
function paymentBankData(data: DocumentData) {
  const stored = data.bank && typeof data.bank === "object" ? data.bank as Record<string, unknown> : null;
  if (!stored) return publicBankConfig();
  const bankName = String(stored.bankName || "");
  const accountName = String(stored.accountName || "");
  const accountNumber = String(stored.accountNumber || "");
  return { bankName, accountName, accountNumber, qrImageUrl: String(stored.qrImageUrl || ""), configured: Boolean(bankName && accountName && accountNumber) };
}
function paymentPublicData(id: string, data: DocumentData) {
  return { id, provider: (data.provider || "bank_transfer") as PaymentProvider, purchaseType: data.purchaseType as PurchaseType, targetPlan: normalizeSubscriptionPlan(data.targetPlan), amountVnd: Number(data.amountVnd || 0), credits: Number(data.credits || 0), orderCode: Number(data.orderCode || 0) || null, paymentLinkId: String(data.paymentLinkId || ""), checkoutUrl: String(data.checkoutUrl || ""), qrCode: String(data.qrCode || ""), transferContent: String(data.transferContent || ""), senderName: String(data.senderName || ""), status: data.status as PaymentStatus, approvalMode: (data.approvalMode || null) as ApprovalMode | null, safeReason: String(data.safeReason || ""), checks: (data.checks || []) as PaymentCheck[], createdAt: dateValue(data.createdAt)?.toISOString() || null, expiresAt: dateValue(data.expiresAt)?.toISOString() || null, approvedAt: dateValue(data.approvedAt)?.toISOString() || null, bank: paymentBankData(data) };
}
export function paymentErrorResponse(error: unknown) { return error instanceof PaymentError ? { status: error.status, body: { error: error.message, code: error.code } } : null; }
function ownedPaidCard(status: SubscriptionStatus) {
  return status.cards.find((card) => card.paid && card.id === "plus");
}
function validateTopup(status: SubscriptionStatus, amountVnd: number) {
  if (!ownedPaidCard(status) || !status.credits.expiresAt) throw new PaymentError("Chỉ tài khoản có gói Trả phí còn hạn mới có thể mua thêm tín dụng.", "TOPUP_REQUIRES_ACTIVE_PAID_PLAN", 409);
  if (!Number.isFinite(amountVnd) || amountVnd < topupMinimum || amountVnd % creditPrice !== 0) throw new PaymentError(`Số tiền mua thêm tối thiểu ${topupMinimum.toLocaleString("vi-VN")}đ và phải là bội số ${creditPrice.toLocaleString("vi-VN")}đ.`, "INVALID_TOPUP_AMOUNT");
}

export async function createCheckout(uid: string, displayName: string, input: CheckoutInput) {
  const db = getFirebaseDb();
  const purchaseType = input.purchaseType === "topup" ? "topup" : input.purchaseType === "package" ? "package" : null;
  if (!purchaseType) throw new PaymentError("Loại giao dịch không hợp lệ.", "INVALID_PURCHASE_TYPE");
  const senderName = String(displayName || "").trim();
  if (senderName.length < 2) throw new PaymentError("Tài khoản chưa có tên hoặc email hợp lệ để tạo thanh toán.", "BUYER_NAME_REQUIRED");
  const userSnapshot = await db.collection("users").doc(uid).get();
  if (!userSnapshot.exists) throw new PaymentError("Không tìm thấy hồ sơ người dùng.", "PROFILE_NOT_FOUND", 404);
  const status = buildSubscriptionStatus(userSnapshot.data() || {});
  let targetPlan: SubscriptionPlan; let amountVnd: number; let credits: number;
  if (purchaseType === "package") {
    targetPlan = input.targetPlan === "pro" || input.targetPlan === "plus" ? "plus" : "free";
    if (targetPlan === "free") throw new PaymentError("Chỉ gói trả phí mới cần tạo thanh toán.", "INVALID_TARGET_PLAN");
    amountVnd = PLAN_CATALOG[targetPlan].priceVnd; credits = PLAN_CATALOG[targetPlan].includedCredits;
  } else { const paidCard = ownedPaidCard(status); amountVnd = Number(input.amountVnd); validateTopup(status, amountVnd); if (!paidCard) throw new PaymentError("Gói trả phí đã hết hạn.", "TOPUP_REQUIRES_ACTIVE_PAID_PLAN", 409); targetPlan = paidCard.id; credits = amountVnd / creditPrice; }

  let config;
  try {
    resolvePaymentProvider();
    config = getPayosConfig();
  } catch (error) {
    if (error instanceof PayosClientError) throw new PaymentError(error.message, error.code, error.status);
    throw new PaymentError(error instanceof Error ? error.message : "payOS chưa sẵn sàng.", "PAYOS_ONLY", 503);
  }
  const provider = "payos" as const;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + checkoutMinutes * 60_000);
  const commonData = { uid, provider, purchaseType, targetPlan, amountVnd, credits, senderName, targetExpiresAt: purchaseType === "topup" ? dateValue(status.credits.expiresAt) : null, createdAt: now, updatedAt: now, expiresAt };

  const checkoutRef = db.collection("paymentRequests").doc();
  const activeRef = db.collection("paymentActiveCheckouts").doc(uid);
  let orderCode = 0;
  let reusedCheckoutId = "";
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = createPayosOrderCode(Date.now(), randomBytes(1)[0]);
    const orderRef = db.collection("paymentOrderCodes").doc(String(candidate));
    try {
      await db.runTransaction(async (tx) => {
        const active = await tx.get(activeRef);
        const activePaymentId = String(active.get("paymentId") || "");
        if (activePaymentId) {
          const activePayment = await tx.get(db.collection("paymentRequests").doc(activePaymentId));
          if (activePayment.exists && activePayment.get("uid") === uid && isReusablePayosCheckout(activePayment.data() || {}, now)) {
            reusedCheckoutId = activePayment.id;
            return;
          }
        }
        const existing = await tx.get(orderRef);
        if (existing.exists) throw new PaymentError("Mã đơn payOS vừa được sử dụng.", "PAYOS_ORDER_COLLISION", 409);
        tx.create(orderRef, { checkoutId: checkoutRef.id, uid, orderCode: candidate, createdAt: now });
        tx.create(checkoutRef, { ...commonData, orderCode: candidate, transferContent: createPayosDescription(candidate), status: "creating", safeReason: "Đang tạo liên kết thanh toán payOS." });
        tx.set(activeRef, { uid, paymentId: checkoutRef.id, expiresAt, updatedAt: now });
      });
      if (reusedCheckoutId) return getPaymentForUser(uid, reusedCheckoutId);
      orderCode = candidate;
      break;
    } catch (error) {
      if (!(error instanceof PaymentError) || error.code !== "PAYOS_ORDER_COLLISION") throw error;
    }
  }
  if (!orderCode) throw new PaymentError("Không thể tạo mã đơn payOS, vui lòng thử lại.", "PAYOS_ORDER_UNAVAILABLE", 503);

  const description = createPayosDescription(orderCode);
  try {
    const link = await createPayosPaymentLink({
      orderCode,
      amount: amountVnd,
      description,
      expiredAt: Math.floor(expiresAt.getTime() / 1000),
      buyerName: senderName,
      items: [{ name: purchaseType === "package" ? "Gói Trả phí EduPlan AI" : `${credits} tín dụng EduPlan AI`, quantity: 1, price: amountVnd }],
    }, config);
    await checkoutRef.update({
      paymentLinkId: link.paymentLinkId,
      checkoutUrl: link.checkoutUrl,
      qrCode: link.qrCode,
      transferContent: link.description || description,
      bank: {
        bankName: process.env.PAYOS_BANK_NAME || "Ngân hàng liên kết payOS",
        accountName: link.accountName,
        accountNumber: link.accountNumber,
        qrImageUrl: "",
        bin: link.bin,
      },
      status: "awaiting_payment",
      safeReason: "Đang chờ payOS xác nhận giao dịch.",
      updatedAt: new Date(),
    });
    return paymentPublicData(checkoutRef.id, (await checkoutRef.get()).data() || {});
  } catch (error) {
    await checkoutRef.update({ status: "provider_failed", safeReason: "Không thể tạo liên kết payOS. Vui lòng thử lại.", updatedAt: new Date() }).catch(() => undefined);
    await clearActivePayosCheckout(uid, checkoutRef.id);
    if (error instanceof PayosClientError) throw new PaymentError(error.message, error.code, error.status);
    throw error;
  }
}

export async function getPaymentForUser(uid: string, id: string) {
  const db = getFirebaseDb();
  const snapshot = await db.collection("paymentRequests").doc(id).get();
  if (!snapshot.exists || snapshot.get("uid") !== uid) throw new PaymentError("Không tìm thấy giao dịch.", "PAYMENT_NOT_FOUND", 404);
  const data = snapshot.data() || {}; const expiresAt = dateValue(data.expiresAt);
  if (data.status === "awaiting_payment" && expiresAt && expiresAt < new Date()) { await snapshot.ref.update({ status: "expired", safeReason: "Yêu cầu thanh toán đã hết hạn.", updatedAt: new Date() }); await clearActivePayosCheckout(uid, snapshot.id); return paymentPublicData(snapshot.id, { ...data, status: "expired", safeReason: "Yêu cầu thanh toán đã hết hạn." }); }
  if (isReusablePayosCheckout(data)) {
    await db.collection("paymentActiveCheckouts").doc(uid).create({ uid, paymentId: snapshot.id, expiresAt, updatedAt: new Date() }).catch(() => undefined);
  }
  return paymentPublicData(snapshot.id, data);
}

export function validatePayosPayment(checkout: DocumentData, webhookData: Record<string, unknown>, fingerprintAvailable: boolean) {
  const expectedAmount = Number(checkout.amountVnd || 0);
  const actualAmount = Number(webhookData.amount || 0);
  const expectedContent = normalizeText(checkout.transferContent);
  const actualContent = normalizeText(webhookData.description);
  const expectedLinkId = String(checkout.paymentLinkId || "");
  const actualLinkId = String(webhookData.paymentLinkId || "");
  const reference = String(webhookData.reference || "").trim();
  const activeState = ["awaiting_payment", "pending_review"].includes(String(checkout.status || ""));
  const checks: PaymentCheck[] = [
    { key: "amount", passed: actualAmount === expectedAmount, certain: Number.isFinite(actualAmount) && actualAmount > 0, detail: actualAmount === expectedAmount ? "Số tiền payOS khớp chính xác." : "Số tiền payOS không khớp yêu cầu." },
    { key: "content", passed: Boolean(expectedContent && actualContent === expectedContent), certain: Boolean(actualContent), detail: actualContent === expectedContent ? "Nội dung payOS khớp mã đơn." : "Nội dung payOS không khớp mã đơn." },
    { key: "time", passed: activeState, certain: true, detail: activeState ? "Đơn đang ở trạng thái nhận thanh toán." : "Đơn không còn ở trạng thái nhận thanh toán." },
    { key: "transaction", passed: Boolean(reference && actualLinkId && (!expectedLinkId || actualLinkId === expectedLinkId)), certain: Boolean(reference && actualLinkId), detail: reference && actualLinkId === expectedLinkId ? "Mã giao dịch và link payOS hợp lệ." : "Thiếu hoặc sai mã giao dịch/link payOS." },
    { key: "duplicate", passed: fingerprintAvailable, certain: true, detail: fingerprintAvailable ? "Giao dịch payOS chưa được sử dụng." : "Giao dịch payOS đã được dùng cho đơn khác." },
  ];
  return { checks, allPassed: checks.every((check) => check.passed && check.certain) };
}

function grantEntitlement(tx: Transaction, userRef: FirebaseFirestore.DocumentReference, paymentRef: FirebaseFirestore.DocumentReference, data: DocumentData, mode: ApprovalMode, actor: string) {
  const now = new Date(); const targetPlan = normalizeSubscriptionPlan(data.targetPlan); const credits = Number(data.credits || 0);
  if (data.purchaseType === "package") { const expiresAt = new Date(now.getTime() + subscriptionDays * 24 * 60 * 60_000); tx.update(userRef, { activePlan: targetPlan, paidPlan: targetPlan, plan: targetPlan, planStatus: "paid", packageCredits: credits, topupCredits: 0, planStartedAt: now, planExpiresAt: expiresAt, creditsExpireAt: expiresAt, updatedAt: now }); }
  else tx.update(userRef, { topupCredits: FieldValue.increment(credits), updatedAt: now });
  const ledgerRef = getFirebaseDb().collection("entitlementLedger").doc(); tx.create(ledgerRef, { uid: data.uid, paymentId: paymentRef.id, type: "grant", plan: targetPlan, source: data.purchaseType, amount: credits, actor, reason: `${data.purchaseType}_${mode}_approved`, createdAt: now });
  tx.update(paymentRef, { status: "approved", approvalMode: mode, approvedAt: now, approvedBy: actor, approvedLedgerId: ledgerRef.id, safeReason: "Thanh toán đã được xác nhận và quyền lợi đã được cộng.", updatedAt: now });
}


export async function processPayosWebhook(payload: PayosWebhookPayload) {
  const config = getPayosConfig();
  if (!payload || typeof payload !== "object" || !payload.data || !verifyPayosWebhookSignature(payload.data, String(payload.signature || ""), config.checksumKey)) {
    throw new PaymentError("Chữ ký webhook payOS không hợp lệ.", "PAYOS_INVALID_SIGNATURE", 401);
  }
  if (payload.code !== "00" || payload.success !== true || String(payload.data.code || "") !== "00") {
    return { outcome: "ignored" as const, reason: "payOS gửi sự kiện không thành công." };
  }

  const orderCode = Number(payload.data.orderCode);
  if (!Number.isSafeInteger(orderCode) || orderCode <= 0) return { outcome: "ignored" as const, reason: "Webhook không có orderCode hợp lệ." };
  const db = getFirebaseDb();
  const orderSnapshot = await db.collection("paymentOrderCodes").doc(String(orderCode)).get();
  if (!orderSnapshot.exists) return { outcome: "ignored" as const, reason: "Webhook kiểm tra hoặc orderCode không thuộc hệ thống." };

  const paymentId = String(orderSnapshot.get("checkoutId") || "");
  if (!paymentId) return { outcome: "ignored" as const, reason: "Không tìm thấy ánh xạ đơn thanh toán." };
  const paymentRef = db.collection("paymentRequests").doc(paymentId);
  const reference = String(payload.data.reference || "").trim();
  const paymentLinkId = String(payload.data.paymentLinkId || "").trim();
  const fingerprint = createHash("sha256").update(`${reference}|${paymentLinkId}|${orderCode}`).digest("hex");
  const fingerprintRef = db.collection("payosTransactionFingerprints").doc(fingerprint);
  let outcome: "approved" | "review" | "ignored" = "ignored";
  let approvedUid: string = "";

  await db.runTransaction(async (tx) => {
    const paymentSnapshot = await tx.get(paymentRef);
    if (!paymentSnapshot.exists) return;
    const payment = paymentSnapshot.data() || {};
    if (payment.status === "approved") { approvedUid = String(payment.uid || ""); outcome = "approved"; return; }
    if (payment.provider !== "payos" || Number(payment.orderCode) !== orderCode) return;

    const fingerprintSnapshot = await tx.get(fingerprintRef);
    const fingerprintAvailable = !fingerprintSnapshot.exists || fingerprintSnapshot.get("paymentId") === paymentId;
    const verdict = validatePayosPayment(payment, payload.data, fingerprintAvailable);
    const now = new Date();
    const providerResult = {
      orderCode,
      paymentLinkId,
      reference,
      amount: Number(payload.data.amount || 0),
      description: String(payload.data.description || ""),
      transactionDateTime: String(payload.data.transactionDateTime || ""),
    };

    if (!verdict.allPassed) {
      tx.update(paymentRef, { status: "pending_review", checks: verdict.checks, payos: providerResult, safeReason: "Giao dịch payOS cần Admin kiểm tra vì có thông tin chưa khớp.", webhookReceivedAt: now, updatedAt: now });
      outcome = "review";
      return;
    }

    const userRef = db.collection("users").doc(String(payment.uid || ""));
    const userSnapshot = await tx.get(userRef);
    if (!userSnapshot.exists) throw new PaymentError("Không tìm thấy hồ sơ người dùng.", "PROFILE_NOT_FOUND", 404);
    if (payment.purchaseType === "topup") {
      const status = buildSubscriptionStatus(userSnapshot.data() || {});
      const paidCard = ownedPaidCard(status);
      if (!paidCard || paidCard.id !== normalizeSubscriptionPlan(payment.targetPlan)) throw new PaymentError("Gói đích đã thay đổi hoặc hết hạn; cần Admin kiểm tra.", "TOPUP_PLAN_CHANGED", 409);
    }
    if (!fingerprintSnapshot.exists) tx.create(fingerprintRef, { paymentId, uid: payment.uid, orderCode, reference, paymentLinkId, createdAt: now });
    tx.update(paymentRef, { checks: verdict.checks, payos: providerResult, autoApprovalReady: true, webhookReceivedAt: now, updatedAt: now });
    grantEntitlement(tx, userRef, paymentRef, payment, "automatic", "payos:webhook");
    approvedUid = String(payment.uid || "");
    outcome = "approved";
  });

  if (approvedUid) await clearActivePayosCheckout(approvedUid, paymentId);
  return { outcome, paymentId };
}
