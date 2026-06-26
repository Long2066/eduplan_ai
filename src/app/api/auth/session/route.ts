import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME, ensureUserProfile } from "@/lib/auth-server";
import { getFirebaseAdminAuth } from "@/lib/firebase-admin";

export const runtime = "nodejs";

const SESSION_EXPIRES_IN = 5 * 24 * 60 * 60 * 1000;

export async function POST(request: Request) {
  try {
    const { idToken } = (await request.json()) as { idToken?: string };
    if (!idToken) return NextResponse.json({ error: "Thiếu ID token." }, { status: 400 });

    const auth = getFirebaseAdminAuth();
    const decoded = await auth.verifyIdToken(idToken);
    const userRecord = await auth.getUser(decoded.uid);
    if (userRecord.disabled) {
      return NextResponse.json(
        { error: "Tài khoản của bạn bị khóa, vui lòng liên hệ hỗ trợ kĩ thuật 0342 733 640 nếu bạn cho là bị nhầm lẫn." },
        { status: 403 },
      );
    }
    await ensureUserProfile(decoded);
    const sessionCookie = await auth.createSessionCookie(idToken, { expiresIn: SESSION_EXPIRES_IN });

    (await cookies()).set(SESSION_COOKIE_NAME, sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_EXPIRES_IN / 1000,
      path: "/",
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Không thể tạo phiên đăng nhập." },
      { status: 401 },
    );
  }
}
