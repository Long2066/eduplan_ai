import { NextResponse } from "next/server";
import { currentAdmin } from "@/lib/admin-auth";

const NO_STORE_HEADERS = { "Cache-Control": "private, no-store, no-cache, max-age=0, must-revalidate" };

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ admin: await currentAdmin() }, { headers: NO_STORE_HEADERS });
}
