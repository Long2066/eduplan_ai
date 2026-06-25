import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminError, requireAdmin, writeAuditLog } from "@/lib/admin-auth";
import { getFirebaseAdminAuth, getFirebaseDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ uid: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const admin = await requireAdmin();
    const { uid } = await context.params;
    const { newPassword, revokeSessions, mustChangePassword } = (await request.json()) as {
      newPassword?: string;
      revokeSessions?: boolean;
      mustChangePassword?: boolean;
    };
    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json({ error: "Mật khẩu mới cần tối thiểu 6 ký tự." }, { status: 400 });
    }

    await getFirebaseAdminAuth().updateUser(uid, { password: newPassword });
    if (revokeSessions) await getFirebaseAdminAuth().revokeRefreshTokens(uid);
    await getFirebaseDb().collection("users").doc(uid).set(
      {
        mustChangePassword: Boolean(mustChangePassword),
        passwordChangedAt: FieldValue.serverTimestamp(),
        passwordChangedBy: admin.uid,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    await writeAuditLog(admin, "CHANGE_USER_PASSWORD", {
      targetUid: uid,
      revokeSessions: Boolean(revokeSessions),
      mustChangePassword: Boolean(mustChangePassword),
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const { message, status } = adminError(error, "Không thể đổi mật khẩu user.");
    return NextResponse.json({ error: message }, { status });
  }
}
