import { NextResponse } from "next/server";
import { accountBlockedMessage } from "@/lib/account-block";
import { SESSION_COOKIE_NAME, ensureUserProfile } from "@/lib/auth-server";
import { getFirebaseAdminAuth, getFirebaseDb } from "@/lib/firebase-admin";
import { enforceFreeTrialIpLimit, IP_ACCOUNT_LIMIT_MESSAGE } from "@/lib/ip-abuse-policy";
import { cookies } from "next/headers";

const SESSION_EXPIRES_IN = 5 * 24 * 60 * 60 * 1000;
const NO_STORE_HEADERS = { "Cache-Control": "private, no-store, no-cache, max-age=0, must-revalidate" };

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function clearSessionCookieLocal() {
  (await cookies()).set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
}

export async function POST(request: Request) {
  try {
    const { idToken } = (await request.json()) as { idToken?: string };
    if (!idToken) {
      return NextResponse.json({ error: "Thiếu ID token." }, { status: 400, headers: NO_STORE_HEADERS });
    }

    const auth = getFirebaseAdminAuth();
    const decoded = await auth.verifyIdToken(idToken);
    const profile = await ensureUserProfile(decoded);
    if (Boolean(profile.disabled)) {
      await clearSessionCookieLocal();
      return NextResponse.json(
        {
          error: accountBlockedMessage(profile.blockedReason, profile.blockedReasonDetail),
          code: "ACCOUNT_DISABLED",
        },
        { status: 403, headers: NO_STORE_HEADERS },
      );
    }

    await enforceFreeTrialIpLimit(request, decoded.uid);
    const now = new Date();
    await getFirebaseDb().collection("users").doc(decoded.uid).set(
      { presenceState: "online", lastSeenAt: now, lastOnlineAt: now },
      { merge: true },
    );
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
    await clearSessionCookieLocal();
    console.error("[Session Auth Error]", error);
    const message = error instanceof Error ? error.message : "Không thể tạo phiên đăng nhập.";
    const status = message === IP_ACCOUNT_LIMIT_MESSAGE
      || (error instanceof Error && error.name === "ACCOUNT_DISABLED")
      ? 403
      : 401;
    return NextResponse.json(
      { error: message, code: error instanceof Error ? error.name : "SESSION_ERROR" },
      { status, headers: NO_STORE_HEADERS },
    );
  }
}
