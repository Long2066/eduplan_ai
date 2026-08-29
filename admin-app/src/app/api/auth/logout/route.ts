import { NextResponse } from "next/server";
import { clearAdminSessionCookie } from "@/lib/admin-auth";

const NO_STORE_HEADERS = { "Cache-Control": "private, no-store, no-cache, max-age=0, must-revalidate" };

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  await clearAdminSessionCookie();
  return NextResponse.json({ ok: true }, { headers: NO_STORE_HEADERS });
}
