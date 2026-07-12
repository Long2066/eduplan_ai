import { NextResponse } from "next/server";
import { adminError, requireAdmin, writeAuditLog } from "@/lib/admin-auth";
import { getFirebaseDb } from "@/lib/firebase-admin";
import { toIso } from "@/lib/serializers";

export const runtime = "nodejs";

function serializePayment(doc: FirebaseFirestore.QueryDocumentSnapshot) {
  const data = doc.data();
  return {
    id: doc.id,
    uid: String(data.uid || ""),
    purchaseType: String(data.purchaseType || ""),
    targetPlan: String(data.targetPlan || ""),
    amountVnd: Number(data.amountVnd || 0),
    credits: Number(data.credits || 0),
    senderName: String(data.senderName || ""),
    transferContent: String(data.transferContent || ""),
    status: String(data.status || "awaiting_proof"),
    approvalMode: String(data.approvalMode || ""),
    safeReason: String(data.safeReason || ""),
    checks: Array.isArray(data.checks) ? data.checks : [],
    ocr: data.ocr || null,
    storagePath: String(data.storagePath || ""),
    createdAt: toIso(data.createdAt),
    approvedAt: toIso(data.approvedAt),
    updatedAt: toIso(data.updatedAt),
  };
}

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "all";
    const snapshot = await getFirebaseDb().collection("paymentRequests").orderBy("createdAt", "desc").limit(300).get();
    let payments = snapshot.docs.map(serializePayment);
    if (status !== "all") payments = payments.filter((payment) => payment.status === status);
    return NextResponse.json({ payments });
  } catch (error) {
    const { message, status } = adminError(error, "Không thể tải lịch sử thanh toán.");
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(request: Request) {
  try {
    const admin = await requireAdmin();
    const body = (await request.json()) as { paymentId?: string; action?: "approve" | "reject" };
    if (!body.paymentId || !body.action) return NextResponse.json({ error: "Thiếu giao dịch hoặc thao tác." }, { status: 400 });
    const db = getFirebaseDb();
    const paymentRef = db.collection("paymentRequests").doc(body.paymentId);
    await db.runTransaction(async (tx) => {
      const payment = await tx.get(paymentRef);
      if (!payment.exists) throw new Error("Không tìm thấy giao dịch.");
      const data = payment.data() || {};
      if (data.status === "approved" || data.status === "rejected") throw new Error("Giao dịch đã kết thúc.");
      const now = new Date();
      if (body.action === "reject") {
        tx.update(paymentRef, { status: "rejected", approvalMode: "manual", approvedBy: admin.email, safeReason: "Admin đã từ chối giao dịch sau khi đối soát.", updatedAt: now });
        return;
      }
      const userRef = db.collection("users").doc(String(data.uid));
      const user = await tx.get(userRef);
      if (!user.exists) throw new Error("Không tìm thấy người dùng nhận quyền lợi.");
      const targetPlan = data.targetPlan === "pro" ? "pro" : "plus";
      const credits = Number(data.credits || 0);
      if (data.purchaseType === "package") {
        const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60_000);
        tx.update(userRef, { activePlan: targetPlan, paidPlan: targetPlan, plan: targetPlan, planStatus: "paid", packageCredits: credits, topupCredits: 0, planStartedAt: now, planExpiresAt: expiresAt, creditsExpireAt: expiresAt, updatedAt: now });
      } else {
        const userData = user.data() || {};
        const expires = userData.planExpiresAt?.toDate?.();
        if (userData.paidPlan !== targetPlan || !expires || expires <= now) throw new Error("Gói của user đã đổi hoặc hết hạn; không thể cộng top-up.");
        tx.update(userRef, { topupCredits: Number(userData.topupCredits || 0) + credits, updatedAt: now });
      }
      const ledgerRef = db.collection("entitlementLedger").doc();
      tx.create(ledgerRef, { uid: data.uid, paymentId: paymentRef.id, type: "grant", plan: targetPlan, source: data.purchaseType, amount: credits, actor: admin.email, reason: `${data.purchaseType}_manual_approved`, createdAt: now });
      tx.update(paymentRef, { status: "approved", approvalMode: "manual", approvedAt: now, approvedBy: admin.email, approvedLedgerId: ledgerRef.id, safeReason: "Admin đã duyệt và quyền lợi đã được cộng.", updatedAt: now });
    });
    await writeAuditLog(admin, `payment.${body.action}`, { paymentId: body.paymentId });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const { message, status } = adminError(error, "Không thể xử lý giao dịch.");
    return NextResponse.json({ error: message }, { status });
  }
}
