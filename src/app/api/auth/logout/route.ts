import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME, verifySessionCookie } from "@/lib/auth-server";
import { getFirebaseDb } from "@/lib/firebase-admin";

const NO_STORE_HEADERS = { "Cache-Control": "private, no-store, no-cache, max-age=0, must-revalidate" };

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const decoded = await verifySessionCookie();
  if (decoded) {
    const now = new Date();
    await getFirebaseDb().collection("users").doc(decoded.uid).set(
      { presenceState: "offline", lastSeenAt: now, lastOfflineAt: now },
      { merge: true },
    ).catch((error) => console.error("[EduPlan AI] Không thể ghi offline khi đăng xuất:", error));
  }

  (await cookies()).set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
  return NextResponse.json({ ok: true }, { headers: NO_STORE_HEADERS });
}
