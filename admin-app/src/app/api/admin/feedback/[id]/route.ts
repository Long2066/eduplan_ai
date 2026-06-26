import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { adminError, requireAdmin, writeAuditLog } from "@/lib/admin-auth";
import { getFirebaseDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const admin = await requireAdmin();
    const { id } = await context.params;
    const payload = (await request.json()) as { status?: string };
    const status = payload.status === "reviewed" ? "reviewed" : "new";
    const ref = getFirebaseDb().collection("feedback").doc(id);
    const snapshot = await ref.get();
    if (!snapshot.exists) return NextResponse.json({ error: "Không tìm thấy góp ý." }, { status: 404 });

    await ref.set(
      {
        status,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    await writeAuditLog(admin, "feedback.update", { feedbackId: id, status });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const { message, status } = adminError(error, "Không thể cập nhật góp ý.");
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const admin = await requireAdmin();
    const { id } = await context.params;
    const ref = getFirebaseDb().collection("feedback").doc(id);
    const snapshot = await ref.get();
    if (!snapshot.exists) return NextResponse.json({ error: "Không tìm thấy góp ý." }, { status: 404 });

    await ref.delete();
    await writeAuditLog(admin, "feedback.delete", {
      feedbackId: id,
      userEmail: snapshot.get("userEmail") || "",
      category: snapshot.get("category") || "",
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const { message, status } = adminError(error, "Không thể xóa góp ý.");
    return NextResponse.json({ error: message }, { status });
  }
}
