import { NextResponse } from "next/server";
import { createAdminSession, setAdminSessionCookie } from "@/lib/admin-auth";

const NO_STORE_HEADERS = { "Cache-Control": "private, no-store, no-cache, max-age=0, must-revalidate" };

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { idToken } = (await request.json()) as { idToken?: string };
    if (!idToken) return NextResponse.json({ error: "Thiếu ID token." }, { status: 400, headers: NO_STORE_HEADERS });
    const session = await createAdminSession(idToken);
    await setAdminSessionCookie(session);
    return NextResponse.json({ ok: true }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    console.error("[Admin Session Auth Error]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Không thể tạo phiên admin." },
      { status: 401, headers: NO_STORE_HEADERS },
    );
  }
}
