import { NextResponse } from "next/server";
import { adminError, requireAdmin } from "@/lib/admin-auth";
import { getFirebaseDb } from "@/lib/firebase-admin";
import { serializeLesson } from "@/lib/serializers";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireAdmin();
    const snapshot = await getFirebaseDb().collection("lessons").limit(200).get();
    const lessons = snapshot.docs.map(serializeLesson).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    return NextResponse.json({ lessons });
  } catch (error) {
    const { message, status } = adminError(error, "Không thể tải thống kê giáo án.");
    return NextResponse.json({ error: message }, { status });
  }
}
