import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth-server";
import { getFirebaseAdminAuth, getFirebaseDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";

const MAX_AVATAR_SIZE = 300 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const form = await request.formData();
    const avatar = form.get("avatar");

    if (!(avatar instanceof File)) return NextResponse.json({ error: "Vui lòng chọn ảnh đại diện." }, { status: 400 });
    if (!ALLOWED_TYPES.has(avatar.type)) return NextResponse.json({ error: "Ảnh đại diện phải là JPG, PNG hoặc WebP." }, { status: 415 });
    if (avatar.size < 1 || avatar.size > MAX_AVATAR_SIZE) return NextResponse.json({ error: "Ảnh đại diện sau tối ưu phải nhỏ hơn 300 KB." }, { status: 413 });

    const bytes = Buffer.from(await avatar.arrayBuffer());
    const photoURL = `data:${avatar.type};base64,${bytes.toString("base64")}`;
    await getFirebaseDb().collection("users").doc(user.uid).set({
      photoURL,
      avatarStoragePath: null,
      updatedAt: new Date(),
    }, { merge: true });

    // Firebase Auth giới hạn photoURL ngắn hơn nhiều so với data URL; hồ sơ ứng dụng trong Firestore là nguồn hiển thị chính.
    await getFirebaseAdminAuth().updateUser(user.uid, { photoURL: null }).catch(() => undefined);
    return NextResponse.json({ ok: true, photoURL });
  } catch (error) {
    const status = error instanceof Error && error.name === "UNAUTHENTICATED" ? 401 : 500;
    const message = status === 401
      ? "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại."
      : "Không thể cập nhật ảnh đại diện lúc này. Vui lòng thử lại.";
    console.error("Avatar update failed:", error);
    return NextResponse.json({ error: message }, { status });
  }
}
