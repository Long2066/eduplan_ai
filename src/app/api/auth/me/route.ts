import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await currentUser();
  return NextResponse.json(
    { user },
    { headers: { "Cache-Control": "private, no-store, no-cache, max-age=0, must-revalidate" } },
  );
}
