import { NextResponse } from "next/server";
import type { QueryDocumentSnapshot } from "firebase-admin/firestore";
import { adminError, requireAdmin } from "@/lib/admin-auth";
import { getFirebaseAdminAuth, getFirebaseDb } from "@/lib/firebase-admin";
import { toIso } from "@/lib/serializers";

export const runtime = "nodejs";

type GenerationRow = {
  id: string;
  uid: string;
  userEmail: string;
  subject: string;
  createdAt: string;
  status: "success" | "failed" | "processing";
  modelUsed: string;
  ocrModelUsed: string;
  fallbackUsed: boolean;
  elapsedMs: number;
  totalTokens: number;
};

function serializeGeneration(doc: QueryDocumentSnapshot): GenerationRow {
  const status = String(doc.get("status") || "reserved");
  const createdAt = doc.get("committedAt") || doc.get("releasedAt") || doc.get("reservedAt");
  const telemetry = (doc.get("telemetry") || {}) as {
    totalElapsedMs?: number;
    routing?: {
      generationModelsUsed?: string[];
      generationPrimaryModel?: string;
      generationFallbackUsed?: boolean;
      ocrModelsUsed?: string[];
      ocrPrimaryModel?: string;
      ocrFallbackUsed?: boolean;
    };
    summary?: { totalTokens?: number };
  };
  return {
    id: doc.id,
    uid: String(doc.get("uid") || ""),
    userEmail: String(doc.get("userEmail") || ""),
    subject: String(doc.get("subject") || ""),
    createdAt: toIso(createdAt),
    status: status === "committed" ? "success" : status === "released" ? "failed" : "processing",
    modelUsed: telemetry.routing?.generationModelsUsed?.join(", ") || telemetry.routing?.generationPrimaryModel || "",
    ocrModelUsed: telemetry.routing?.ocrModelsUsed?.join(", ") || telemetry.routing?.ocrPrimaryModel || "",
    fallbackUsed: Boolean(telemetry.routing?.generationFallbackUsed || telemetry.routing?.ocrFallbackUsed),
    elapsedMs: Math.max(0, Number(telemetry.totalElapsedMs || 0)),
    totalTokens: Math.max(0, Number(telemetry.summary?.totalTokens || 0)),
  };
}

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const query = (searchParams.get("q") || "").trim().toLowerCase();
    const subject = (searchParams.get("subject") || "").trim().toLowerCase();
    const status = (searchParams.get("status") || "all").trim().toLowerCase();
    const from = searchParams.get("from") || "";
    const to = searchParams.get("to") || "";

    const snapshot = await getFirebaseDb()
      .collection("generationOperations")
      .orderBy("reservedAt", "desc")
      .limit(200)
      .get();

    let generations = snapshot.docs
      .filter((doc) => String(doc.get("kind") || "generate") === "generate")
      .map(serializeGeneration);

    const missingEmails = [...new Set(generations.filter((item) => !item.userEmail && item.uid).map((item) => item.uid))];
    if (missingEmails.length) {
      const result = await getFirebaseAdminAuth().getUsers(missingEmails.map((uid) => ({ uid })));
      const emailByUid = new Map(result.users.map((profile) => [profile.uid, profile.email || ""]));
      generations = generations.map((item) => item.userEmail ? item : { ...item, userEmail: emailByUid.get(item.uid) || item.uid });
    }

    const totals = new Map<string, number>();
    for (const item of generations) {
      if (item.status === "success") totals.set(item.userEmail, (totals.get(item.userEmail) || 0) + 1);
    }

    if (query) generations = generations.filter((item) => `${item.userEmail} ${item.subject}`.toLowerCase().includes(query));
    if (subject) generations = generations.filter((item) => item.subject.toLowerCase().includes(subject));
    if (["success", "failed", "processing"].includes(status)) generations = generations.filter((item) => item.status === status);
    if (from) {
      const fromTime = new Date(`${from}T00:00:00`).getTime();
      generations = generations.filter((item) => new Date(item.createdAt).getTime() >= fromTime);
    }
    if (to) {
      const toTime = new Date(`${to}T23:59:59`).getTime();
      generations = generations.filter((item) => new Date(item.createdAt).getTime() <= toTime);
    }

    return NextResponse.json({
      generations: generations.map((item) => ({ ...item, totalCreated: totals.get(item.userEmail) || 0 })),
    });
  } catch (error) {
    const { message, status } = adminError(error, "Không thể tải lịch sử tạo giáo án.");
    return NextResponse.json({ error: message }, { status });
  }
}
