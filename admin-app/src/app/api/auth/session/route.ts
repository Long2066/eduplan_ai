import { NextResponse } from "next/server";
import { createAdminSession, setAdminSessionCookie } from "@/lib/admin-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { idToken } = (await request.json()) as { idToken?: string };
    if (!idToken) return NextResponse.json({ error: "Thiếu ID token." }, { status: 400 });
    const session = await createAdminSession(idToken);
    await setAdminSessionCookie(session);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Không thể tạo phiên admin." },
      { status: 401 },
    );
  }
}
