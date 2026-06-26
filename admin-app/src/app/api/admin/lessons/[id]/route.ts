import { NextResponse } from "next/server";
import { adminError, requireAdmin, writeAuditLog } from "@/lib/admin-auth";
import { getFirebaseDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const admin = await requireAdmin();
    const { id } = await context.params;
    const ref = getFirebaseDb().collection("lessons").doc(id);
    const snapshot = await ref.get();
    if (!snapshot.exists) return NextResponse.json({ error: "Không tìm thấy giáo án." }, { status: 404 });

    await ref.delete();
    await writeAuditLog(admin, "lesson.delete", {
      lessonId: id,
      ownerId: snapshot.get("ownerId") || "",
      title: snapshot.get("title") || "",
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const { message, status } = adminError(error, "Không thể xóa giáo án.");
    return NextResponse.json({ error: message }, { status });
  }
}
