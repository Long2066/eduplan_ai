import { NextResponse } from "next/server";
import { adminError, requireAdmin } from "@/lib/admin-auth";
import { getFirebaseDb } from "@/lib/firebase-admin";
import { serializeFeedback } from "@/lib/serializers";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category") || "";
    const status = searchParams.get("status") || "";
    const priority = searchParams.get("priority") || "";
    const from = searchParams.get("from") || "";
    const to = searchParams.get("to") || "";

    const snapshot = await getFirebaseDb()
      .collection("feedback")
      .orderBy("createdAt", "desc")
      .limit(500)
      .get();

    let feedback = snapshot.docs.map(serializeFeedback);
    if (category && category !== "all") feedback = feedback.filter((item) => item.category === category);
    if (status && status !== "all") feedback = feedback.filter((item) => item.status === status);
    if (priority && priority !== "all") feedback = feedback.filter((item) => item.priority === priority);
    if (from) {
      const fromTime = new Date(`${from}T00:00:00`).getTime();
      feedback = feedback.filter((item) => new Date(item.createdAt).getTime() >= fromTime);
    }
    if (to) {
      const toTime = new Date(`${to}T23:59:59`).getTime();
      feedback = feedback.filter((item) => new Date(item.createdAt).getTime() <= toTime);
    }

    return NextResponse.json({ feedback });
  } catch (error) {
    const { message, status } = adminError(error, "Không thể tải góp ý.");
    return NextResponse.json({ error: message }, { status });
  }
}
