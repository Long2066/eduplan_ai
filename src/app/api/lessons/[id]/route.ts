import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth-server";
import { getFirebaseDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const doc = await getFirebaseDb().collection("lessons").doc(id).get();
    if (!doc.exists) return NextResponse.json({ error: "Không tìm thấy giáo án." }, { status: 404 });
    if (doc.get("ownerId") !== user.uid) return NextResponse.json({ error: "Bạn không có quyền mở giáo án này." }, { status: 403 });

    return NextResponse.json({ lessonId: doc.id, lesson: doc.get("lesson") });
  } catch (error) {
    const status = error instanceof Error && error.name === "UNAUTHENTICATED" ? 401 : 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Không thể mở giáo án." },
      { status },
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const ref = getFirebaseDb().collection("lessons").doc(id);
    const doc = await ref.get();
    if (!doc.exists) return NextResponse.json({ ok: true });
    if (doc.get("ownerId") !== user.uid) return NextResponse.json({ error: "Bạn không có quyền xóa giáo án này." }, { status: 403 });
    await ref.delete();
    return NextResponse.json({ ok: true });
  } catch (error) {
    const status = error instanceof Error && error.name === "UNAUTHENTICATED" ? 401 : 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Không thể xóa giáo án." },
      { status },
    );
  }
}
