import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { adminError, requireAdmin, writeAuditLog } from "@/lib/admin-auth";
import { getFirebaseDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";

const statuses = new Set(["new", "in_progress", "resolved", "ignored", "reviewed"]);
const priorities = new Set(["low", "medium", "high"]);

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const admin = await requireAdmin();
    const { id } = await context.params;
    const payload = (await request.json()) as { status?: string; priority?: string; adminNote?: string };
    const ref = getFirebaseDb().collection("feedback").doc(id);
    const snapshot = await ref.get();
    if (!snapshot.exists) return NextResponse.json({ error: "Không tìm thấy góp ý." }, { status: 404 });

    const update: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (payload.status && statuses.has(payload.status)) update.status = payload.status;
    if (payload.priority && priorities.has(payload.priority)) update.priority = payload.priority;
    if (typeof payload.adminNote === "string") update.adminNote = payload.adminNote.trim().slice(0, 2000);

    await ref.set(
      update,
      { merge: true },
    );
    await writeAuditLog(admin, "feedback.update", { feedbackId: id, fields: Object.keys(update) });
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
