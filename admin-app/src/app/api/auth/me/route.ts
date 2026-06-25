import { NextResponse } from "next/server";
import { currentAdmin } from "@/lib/admin-auth";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ admin: await currentAdmin() });
}
