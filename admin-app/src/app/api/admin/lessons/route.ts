import { NextResponse } from "next/server";
import { adminError, requireAdmin } from "@/lib/admin-auth";
import { getFirebaseDb } from "@/lib/firebase-admin";
import { serializeLesson } from "@/lib/serializers";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const query = (searchParams.get("q") || "").trim().toLowerCase();
    const subject = (searchParams.get("subject") || "").trim().toLowerCase();
    const grade = (searchParams.get("grade") || "").trim().toLowerCase();
    const from = searchParams.get("from") || "";
    const to = searchParams.get("to") || "";
    const snapshot = await getFirebaseDb().collection("lessons").limit(200).get();
    let lessons = snapshot.docs.map(serializeLesson);
    if (query) {
      lessons = lessons.filter((lesson) =>
        `${lesson.title} ${lesson.ownerId} ${lesson.subject} ${lesson.grade}`.toLowerCase().includes(query),
      );
    }
    if (subject) lessons = lessons.filter((lesson) => lesson.subject.toLowerCase().includes(subject));
    if (grade) lessons = lessons.filter((lesson) => lesson.grade.toLowerCase().includes(grade));
    if (from) {
      const fromTime = new Date(`${from}T00:00:00`).getTime();
      lessons = lessons.filter((lesson) => new Date(lesson.createdAt).getTime() >= fromTime);
    }
    if (to) {
      const toTime = new Date(`${to}T23:59:59`).getTime();
      lessons = lessons.filter((lesson) => new Date(lesson.createdAt).getTime() <= toTime);
    }
    lessons.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    return NextResponse.json({ lessons });
  } catch (error) {
    const { message, status } = adminError(error, "Không thể tải thống kê giáo án.");
    return NextResponse.json({ error: message }, { status });
  }
}
