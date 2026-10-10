import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getFirebaseAdminAuth, getFirebaseDb } from "@/lib/firebase-admin";
import { ensureUserProfile, SESSION_COOKIE_NAME } from "@/lib/auth-server";
import { phoneToInternalEmail } from "@/lib/phone-utils";
import { enforceFreeTrialIpLimit } from "@/lib/ip-abuse-policy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SESSION_EXPIRES_IN = 5 * 24 * 60 * 60 * 1000;
const NO_STORE_HEADERS = { "Cache-Control": "private, no-store, no-cache, max-age=0, must-revalidate" };

export async function POST(request: Request) {
  try {
    const { idToken, password, displayName } = (await request.json()) as {
      idToken?: string;
      password?: string;
      displayName?: string;
    };

    if (!idToken) {
      return NextResponse.json({ error: "Thiếu mã xác thực OTP." }, { status: 400, headers: NO_STORE_HEADERS });
    }

    if (!password || password.length < 6) {
      return NextResponse.json({ error: "Mật khẩu cần tối thiểu 6 ký tự." }, { status: 400, headers: NO_STORE_HEADERS });
    }

    const auth = getFirebaseAdminAuth();
    const decoded = await auth.verifyIdToken(idToken);
    const phoneNumber = decoded.phone_number;

    if (!phoneNumber) {
      return NextResponse.json({ error: "Tài khoản không có số điện thoại hợp lệ." }, { status: 400, headers: NO_STORE_HEADERS });
    }

    const internalEmail = phoneToInternalEmail(phoneNumber);

    // Update user in Firebase Auth with password and internal email
    await auth.updateUser(decoded.uid, {
      email: internalEmail,
      password: password,
      displayName: displayName?.trim() || undefined,
    });

    const profile = await ensureUserProfile(decoded);

    // Save phoneNumber directly to Firestore user document
    const now = new Date();
    await getFirebaseDb().collection("users").doc(decoded.uid).set(
      {
        phoneNumber,
        displayName: displayName?.trim() || profile.displayName || `Người dùng ${phoneNumber.slice(-4)}`,
        presenceState: "online",
        lastSeenAt: now,
        lastOnlineAt: now,
        updatedAt: now,
      },
      { merge: true },
    );

    await enforceFreeTrialIpLimit(request, decoded.uid);

    const sessionCookie = await auth.createSessionCookie(idToken, { expiresIn: SESSION_EXPIRES_IN });
    (await cookies()).set(SESSION_COOKIE_NAME, sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_EXPIRES_IN / 1000,
      path: "/",
    });

    return NextResponse.json({ ok: true }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    console.error("[Phone Register API Error]", error);
    const message = error instanceof Error ? error.message : "Không thể hoàn tất đăng ký số điện thoại.";
    return NextResponse.json({ error: message }, { status: 500, headers: NO_STORE_HEADERS });
  }
}
