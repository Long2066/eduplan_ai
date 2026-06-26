import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminError, requireAdmin, writeAuditLog } from "@/lib/admin-auth";
import { getFirebaseAdminAuth, getFirebaseDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ uid: string }>;
};

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
    };
    const update: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (typeof body.displayName === "string") update.displayName = body.displayName.trim();
    if (body.role === "user" || body.role === "admin") update.role = body.role;
    if (Number.isFinite(Number(body.freeLimit))) update.freeLimit = Math.max(0, Number(body.freeLimit));
    if (Number.isFinite(Number(body.usedGenerations))) update.usedGenerations = Math.max(0, Number(body.usedGenerations));
    if (typeof body.disabled === "boolean") update.disabled = body.disabled;

    await getFirebaseDb().collection("users").doc(uid).set(update, { merge: true });
    if (typeof body.displayName === "string" || typeof body.disabled === "boolean") {
      await getFirebaseAdminAuth().updateUser(uid, {
        displayName: typeof body.displayName === "string" ? body.displayName.trim() : undefined,
        disabled: typeof body.disabled === "boolean" ? body.disabled : undefined,
      });
    }
    await writeAuditLog(admin, "UPDATE_USER", { targetUid: uid, fields: Object.keys(update) });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const { message, status } = adminError(error, "Không thể cập nhật user.");
    return NextResponse.json({ error: message }, { status });
  }
}
