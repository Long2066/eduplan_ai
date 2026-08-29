import { NextResponse } from "next/server";
import { adminError, requireAdmin } from "@/lib/admin-auth";
import { getFirebaseDb } from "@/lib/firebase-admin";
import { toIso } from "@/lib/serializers";
import {
  aggregateSecurityDashboard,
  type SecurityAccessRecord,
  type SecurityEventRecord,
  type SecurityOperationRecord,
  type SecurityUserProfile,
} from "@/lib/security";
import { normalizeSecurityEventStatus, normalizeSecurityHash } from "@shared/security-contract";

export const runtime = "nodejs";

const WINDOW_OPTIONS = new Set([1, 7, 30]);
const LIMITS = {
  operations: 2_000,
  accesses: 2_000,
  events: 500,
  users: 2_000,
};

function normalizePlanStatus(data: Record<string, unknown>) {
  const expiresAt = data.planExpiresAt && typeof data.planExpiresAt === "object" && "toDate" in data.planExpiresAt
    ? (data.planExpiresAt as { toDate: () => Date }).toDate()
    : null;
  if (String(data.planStatus || "") === "paid" && (!expiresAt || expiresAt.getTime() > Date.now())) return "paid";
  if (String(data.planStatus || "") === "trial") return "trial";
  return "free";
}

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const requestedWindow = Number(searchParams.get("window") || 7);
    const windowDays = WINDOW_OPTIONS.has(requestedWindow) ? requestedWindow : 7;
    const toDate = new Date();
    const fromDate = new Date(toDate.getTime() - windowDays * 24 * 60 * 60_000);
    const db = getFirebaseDb();

    const [operationSnapshot, accessSnapshot, eventSnapshot, userSnapshot] = await Promise.all([
      db.collection("generationOperations")
        .where("reservedAt", ">=", fromDate)
        .orderBy("reservedAt", "desc")
        .limit(LIMITS.operations)
        .get(),
      db.collection("freeTrialIpAccess")
        .orderBy("lastSeenAt", "desc")
        .limit(LIMITS.accesses)
        .get(),
      db.collection("securityEvents")
        .orderBy("createdAt", "desc")
        .limit(LIMITS.events)
        .get(),
      db.collection("users")
        .limit(LIMITS.users)
        .get(),
    ]);

    const users: SecurityUserProfile[] = userSnapshot.docs.map((doc) => {
      const data = doc.data() as Record<string, unknown>;
      return {
        uid: doc.id,
        email: String(data.email || ""),
        displayName: String(data.displayName || ""),
        role: data.role === "admin" ? "admin" : "user",
        planStatus: normalizePlanStatus(data),
        disabled: Boolean(data.disabled),
        ipLimitOverride: Boolean(data.ipLimitOverride),
      };
    });

    const accesses: SecurityAccessRecord[] = accessSnapshot.docs.map((doc) => ({
      id: doc.id,
      uid: String(doc.get("uid") || ""),
      ipHash: normalizeSecurityHash(doc.get("ipHash")),
      status: String(doc.get("status") || "allowed"),
      firstSeenAt: toIso(doc.get("firstSeenAt")),
      lastSeenAt: toIso(doc.get("lastSeenAt")),
    })).filter((access) => Boolean(access.uid && access.ipHash));

    const operations: SecurityOperationRecord[] = operationSnapshot.docs
      .filter((doc) => String(doc.get("kind") || "generate") === "generate")
      .map((doc) => ({
        id: doc.id,
        uid: String(doc.get("uid") || ""),
        status: String(doc.get("status") || "reserved"),
        reservedAt: toIso(doc.get("reservedAt")),
        security: doc.get("security"),
        telemetry: doc.get("telemetry"),
      }));

    const events: SecurityEventRecord[] = eventSnapshot.docs.map((doc) => ({
      id: doc.id,
      uid: String(doc.get("uid") || ""),
      type: String(doc.get("type") || "unknown"),
      ipHash: normalizeSecurityHash(doc.get("ipHash")),
      relatedUids: Array.isArray(doc.get("relatedUids"))
        ? doc.get("relatedUids").map((value: unknown) => String(value || "")).filter(Boolean).slice(0, 50)
        : [],
      reviewStatus: normalizeSecurityEventStatus(doc.get("reviewStatus")),
      reviewNote: String(doc.get("reviewNote") || "").slice(0, 500),
      reviewedAt: toIso(doc.get("reviewedAt")),
      reviewedByEmail: String(doc.get("reviewedByEmail") || ""),
      createdAt: toIso(doc.get("createdAt")),
    }));

    return NextResponse.json(aggregateSecurityDashboard({
      users,
      accesses,
      operations,
      events,
      windowDays,
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
      limits: LIMITS,
    }));
  } catch (error) {
    const { message, status } = adminError(error, "Không thể tải dữ liệu bảo mật.");
    return NextResponse.json({ error: message }, { status });
  }
}
