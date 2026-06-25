import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth-server";
import { getFirebaseAdminAuth, getFirebaseDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";

export async function PATCH(request: Request) {
  try {
    const user = await requireUser();
    const { displayName } = (await request.json()) as { displayName?: string };
    const nextDisplayName = (displayName || "").trim().slice(0, 80);
    if (!nextDisplayName) return NextResponse.json({ error: "Họ tên không được để trống." }, { status: 400 });

    await getFirebaseAdminAuth().updateUser(user.uid, { displayName: nextDisplayName });
    await getFirebaseDb().collection("users").doc(user.uid).set(
      {
        displayName: nextDisplayName,
        updatedAt: new Date(),
      },
      { merge: true },
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    const status = error instanceof Error && error.name === "UNAUTHENTICATED" ? 401 : 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Không thể cập nhật hồ sơ." },
      { status },
    );
  }
}
