import { NextResponse } from "next/server";
import { adminError, requireAdmin } from "@/lib/admin-auth";
import { getFirebaseDb } from "@/lib/firebase-admin";
import { serializeAudit } from "@/lib/serializers";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireAdmin();
    const snapshot = await getFirebaseDb()
      .collection("admin_audit_logs")
      .orderBy("createdAt", "desc")
      .limit(100)
      .get();
    return NextResponse.json({ logs: snapshot.docs.map(serializeAudit) });
  } catch (error) {
    const { message, status } = adminError(error, "Không thể tải audit log.");
    return NextResponse.json({ error: message }, { status });
  }
}
