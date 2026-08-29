import { NextResponse } from "next/server";
import { adminError, requireAdmin, writeAuditLog } from "@/lib/admin-auth";
import { getFirebaseDb } from "@/lib/firebase-admin";
import {
  MAX_SECURITY_EVENT_NOTE_LENGTH,
  normalizeSecurityEventNote,
  normalizeSecurityEventStatus,
} from "@shared/security-contract";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ eventId: string }>;
};

function safeEventId(value: string) {
  const id = value.trim();
  return id && !id.includes("/") && id.length <= 200 ? id : "";
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const admin = await requireAdmin();
    const { eventId: rawEventId } = await context.params;
    const eventId = safeEventId(rawEventId);
    if (!eventId) return NextResponse.json({ error: "Security event không hợp lệ." }, { status: 400 });

    const body = await request.json() as { status?: unknown; note?: unknown };
    const status = normalizeSecurityEventStatus(body.status);
    if (body.status !== status) {
      return NextResponse.json({ error: "Trạng thái xử lý không hợp lệ." }, { status: 400 });
    }
    if (typeof body.note === "string" && body.note.length > MAX_SECURITY_EVENT_NOTE_LENGTH * 2) {
      return NextResponse.json({ error: "Ghi chú xử lý quá dài." }, { status: 400 });
    }
    const note = normalizeSecurityEventNote(body.note);
    const db = getFirebaseDb();
    const ref = db.collection("securityEvents").doc(eventId);
    const snapshot = await ref.get();
    if (!snapshot.exists) return NextResponse.json({ error: "Không tìm thấy security event." }, { status: 404 });

    const now = new Date();
    await ref.set({
      reviewStatus: status,
      reviewNote: note,
      reviewedAt: now,
      reviewedByUid: admin.uid,
      reviewedByEmail: admin.email,
      updatedAt: now,
    }, { merge: true });
    await writeAuditLog(admin, "security.event_review", {
      eventId,
      targetUid: String(snapshot.get("uid") || ""),
      eventType: String(snapshot.get("type") || ""),
      status,
      note,
    });
    return NextResponse.json({
      ok: true,
      review: {
        status,
        note,
        reviewedAt: now.toISOString(),
        reviewedByEmail: admin.email,
      },
    });
  } catch (error) {
    const { message, status } = adminError(error, "Không thể cập nhật security event.");
    return NextResponse.json({ error: message }, { status });
  }
}
