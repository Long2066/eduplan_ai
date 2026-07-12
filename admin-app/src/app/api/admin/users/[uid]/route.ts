import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminError, requireAdmin, writeAuditLog } from "@/lib/admin-auth";
import { getFirebaseAdminAuth, getFirebaseDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ uid: string }>;
};

function isMissingAuthUser(error: unknown) {
  return typeof error === "object"
    && error !== null
    && "code" in error
    && (error as { code?: string }).code === "auth/user-not-found";
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const admin = await requireAdmin();
    const { uid } = await context.params;
    const body = (await request.json()) as {
      displayName?: string;
      role?: "user" | "admin";
      freeLimit?: number;
      usedGenerations?: number;
      disabled?: boolean;
      emailVerified?: boolean;
      ipLimitOverride?: boolean;
      grantPlan?: "plus" | "pro";
      grantCredits?: number;
      revokePlan?: boolean;
      deductCredits?: number;
    };

    /* ── Manual plan grant ── */
    if (body.grantPlan === "plus" || body.grantPlan === "pro") {
      const db = getFirebaseDb();
      const plan = body.grantPlan;
      const credits = plan === "pro" ? 50 : 50;
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60_000);
      const userRef = db.collection("users").doc(uid);
      const ledgerRef = db.collection("entitlementLedger").doc();
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(userRef);
        if (!snap.exists) throw new Error("Không tìm thấy user.");
        tx.update(userRef, {
          activePlan: plan,
          paidPlan: plan,
          plan,
          planStatus: "paid",
          packageCredits: credits,
          topupCredits: 0,
          planStartedAt: now,
          planExpiresAt: expiresAt,
          creditsExpireAt: expiresAt,
          updatedAt: now,
        });
        tx.create(ledgerRef, {
          uid,
          type: "grant",
          plan,
          source: "admin_manual",
          amount: credits,
          actor: admin.email,
          reason: `Admin kích hoạt gói ${plan} thủ công`,
          createdAt: now,
        });
      });
      await writeAuditLog(admin, "user.grant_plan", { targetUid: uid, plan, credits, expiresAt: expiresAt.toISOString() });
      return NextResponse.json({ ok: true, granted: { plan, credits, expiresAt: expiresAt.toISOString() } });
    }

    /* ── Manual credit top-up ── */
    if (typeof body.grantCredits === "number" && body.grantCredits > 0) {
      const amount = Math.round(body.grantCredits);
      const db = getFirebaseDb();
      const userRef = db.collection("users").doc(uid);
      const ledgerRef = db.collection("entitlementLedger").doc();
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(userRef);
        if (!snap.exists) throw new Error("Không tìm thấy user.");
        const data = snap.data() || {};
        const paidPlan = String(data.paidPlan || "");
        const expires = data.planExpiresAt?.toDate?.();
        if (!paidPlan || paidPlan === "free" || !expires || expires <= new Date()) {
          throw new Error("User chưa có gói Plus/Pro còn hạn. Hãy kích hoạt gói trước khi cộng tín dụng.");
        }
        tx.update(userRef, {
          topupCredits: Number(data.topupCredits || 0) + amount,
          updatedAt: new Date(),
        });
        tx.create(ledgerRef, {
          uid,
          type: "grant",
          plan: paidPlan,
          source: "admin_manual_topup",
          amount,
          actor: admin.email,
          reason: `Admin cộng ${amount} tín dụng thủ công`,
          createdAt: new Date(),
        });
      });
      await writeAuditLog(admin, "user.grant_credits", { targetUid: uid, amount });
      return NextResponse.json({ ok: true, granted: { credits: amount } });
    }

    /* ── Revoke plan ── */
    if (body.revokePlan === true) {
      const db = getFirebaseDb();
      const userRef = db.collection("users").doc(uid);
      const ledgerRef = db.collection("entitlementLedger").doc();
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(userRef);
        if (!snap.exists) throw new Error("Không tìm thấy user.");
        const data = snap.data() || {};
        const oldPlan = String(data.paidPlan || data.activePlan || "free");
        tx.update(userRef, {
          activePlan: "free",
          paidPlan: "",
          plan: "free",
          planStatus: "free",
          packageCredits: 0,
          topupCredits: 0,
          planStartedAt: null,
          planExpiresAt: null,
          creditsExpireAt: null,
          updatedAt: new Date(),
        });
        tx.create(ledgerRef, {
          uid,
          type: "revoke",
          plan: oldPlan,
          source: "admin_manual",
          amount: 0,
          actor: admin.email,
          reason: `Admin tước quyền gói ${oldPlan}`,
          createdAt: new Date(),
        });
      });
      await writeAuditLog(admin, "user.revoke_plan", { targetUid: uid });
      return NextResponse.json({ ok: true });
    }

    /* ── Deduct credits ── */
    if (typeof body.deductCredits === "number" && body.deductCredits > 0) {
      const amount = Math.round(body.deductCredits);
      const db = getFirebaseDb();
      const userRef = db.collection("users").doc(uid);
      const ledgerRef = db.collection("entitlementLedger").doc();
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(userRef);
        if (!snap.exists) throw new Error("Không tìm thấy user.");
        const data = snap.data() || {};
        let pkg = Number(data.packageCredits || 0);
        let top = Number(data.topupCredits || 0);
        const total = pkg + top;
        if (total < amount) throw new Error(`User chỉ còn ${total} tín dụng, không đủ trừ ${amount}.`);
        let remaining = amount;
        const fromPkg = Math.min(remaining, pkg);
        pkg -= fromPkg; remaining -= fromPkg;
        top -= remaining;
        tx.update(userRef, { packageCredits: pkg, topupCredits: top, updatedAt: new Date() });
        tx.create(ledgerRef, {
          uid,
          type: "deduct",
          plan: String(data.paidPlan || data.activePlan || "free"),
          source: "admin_manual_deduct",
          amount: -amount,
          actor: admin.email,
          reason: `Admin trừ ${amount} tín dụng thủ công`,
          createdAt: new Date(),
        });
      });
      await writeAuditLog(admin, "user.deduct_credits", { targetUid: uid, amount });
      return NextResponse.json({ ok: true });
    }

    /* ── Standard field updates ── */
    const update: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (typeof body.displayName === "string") update.displayName = body.displayName.trim();
    if (body.role === "user" || body.role === "admin") update.role = body.role;
    if (Number.isFinite(Number(body.freeLimit))) update.freeLimit = Math.max(0, Number(body.freeLimit));
    if (Number.isFinite(Number(body.usedGenerations))) update.usedGenerations = Math.max(0, Number(body.usedGenerations));
    if (typeof body.disabled === "boolean") {
      update.disabled = body.disabled;
      if (!body.disabled) update.blockedReason = "";
    }
    if (typeof body.emailVerified === "boolean") update.emailVerified = body.emailVerified;
    if (typeof body.ipLimitOverride === "boolean") update.ipLimitOverride = body.ipLimitOverride;

    await getFirebaseDb().collection("users").doc(uid).set(update, { merge: true });
    if (typeof body.displayName === "string" || typeof body.disabled === "boolean" || typeof body.emailVerified === "boolean") {
      await getFirebaseAdminAuth().updateUser(uid, {
        displayName: typeof body.displayName === "string" ? body.displayName.trim() : undefined,
        disabled: typeof body.disabled === "boolean" ? body.disabled : undefined,
        emailVerified: typeof body.emailVerified === "boolean" ? body.emailVerified : undefined,
      });
    }
    if (body.disabled === true) await getFirebaseAdminAuth().revokeRefreshTokens(uid);
    await writeAuditLog(admin, "UPDATE_USER", { targetUid: uid, fields: Object.keys(update) });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const { message, status } = adminError(error, "Không thể cập nhật user.");
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const admin = await requireAdmin();
    const { uid } = await context.params;
    if (uid === admin.uid) {
      return NextResponse.json({ error: "Không thể xóa chính tài khoản admin đang đăng nhập." }, { status: 400 });
    }

    const db = getFirebaseDb();
    const userRef = db.collection("users").doc(uid);
    const snapshot = await userRef.get();
    if (!snapshot.exists) return NextResponse.json({ error: "Không tìm thấy user." }, { status: 404 });

    try {
      await getFirebaseAdminAuth().deleteUser(uid);
    } catch (deleteError) {
      if (!isMissingAuthUser(deleteError)) throw deleteError;
    }
    await userRef.delete();
    await writeAuditLog(admin, "user.delete", {
      targetUid: uid,
      targetEmail: snapshot.get("email") || "",
      targetRole: snapshot.get("role") || "",
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const { message, status } = adminError(error, "Không thể xóa user.");
    return NextResponse.json({ error: message }, { status });
  }
}
