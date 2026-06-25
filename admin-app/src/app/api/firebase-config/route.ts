import { NextResponse } from "next/server";
import { getFirebasePublicConfig } from "@/lib/firebase-admin";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ config: getFirebasePublicConfig() });
}
