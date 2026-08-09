import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth-server";
import { getFirebaseDb } from "@/lib/firebase-admin";

const NO_STORE_HEADERS = { "Cache-Control": "private, no-store, no-cache, max-age=0, must-revalidate" };

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = (await request.json().catch(() => ({}))) as { state?: unknown };
    if (body.state !== "online" && body.state !== "offline") {
      return NextResponse.json(
        { error: "Trạng thái hoạt động không hợp lệ." },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    const now = new Date();
    await getFirebaseDb().collection("users").doc(user.uid).set(
      {
        presenceState: body.state,
        lastSeenAt: now,
        ...(body.state === "online" ? { lastOnlineAt: now } : { lastOfflineAt: now }),
      },
      { merge: true },
    );

    return NextResponse.json(
      { ok: true, state: body.state, lastSeenAt: now.toISOString() },
      { headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không thể cập nhật trạng thái hoạt động.";
    const status = error instanceof Error && error.name === "UNAUTHENTICATED"
      ? 401
      : error instanceof Error && error.name === "ACCOUNT_DISABLED"
        ? 403
        : 500;
    return NextResponse.json({ error: message }, { status, headers: NO_STORE_HEADERS });
  }
}
