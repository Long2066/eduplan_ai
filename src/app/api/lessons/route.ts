import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { lessonExpiresAt, requireUser } from "@/lib/auth-server";
import { getFirebaseDb } from "@/lib/firebase-admin";
import type { LessonPlan } from "@/types/lesson";

export const runtime = "nodejs";

type SaveLessonRequest = {
  lessonId?: string;
  lesson?: LessonPlan;
};

function lessonSummary(lesson: LessonPlan) {
  return {
    title: lesson.generalInfo?.lessonTitle || "Giáo án chưa đặt tên",
    subject: lesson.generalInfo?.subject || "",
    grade: lesson.generalInfo?.grade || "",
    periods: Number(lesson.generalInfo?.periods || 1),
  };
}

function serializeDoc(id: string, data: FirebaseFirestore.DocumentData) {
  return {
    id,
    title: data.title || "",
    subject: data.subject || "",
    grade: data.grade || "",
    periods: data.periods || 1,
    createdAt: data.createdAt?.toDate?.()?.toISOString?.() || data.createdAt || "",
    updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() || data.updatedAt || "",
    expiresAt: data.expiresAt?.toDate?.()?.toISOString?.() || data.expiresAt || "",
  };
}

export async function GET() {
  try {
    const user = await requireUser();
    const snapshot = await getFirebaseDb()
      .collection("lessons")
      .where("ownerId", "==", user.uid)
      .limit(50)
      .get();
    const now = Date.now();
    const batch = getFirebaseDb().batch();
    let expiredCount = 0;
    const activeDocs = snapshot.docs.filter((doc) => {
      const expiresAt = doc.get("expiresAt")?.toDate?.()?.getTime?.() ?? new Date(doc.get("expiresAt") || 0).getTime();
      const expired = Boolean(expiresAt && expiresAt <= now);
      if (expired) {
        batch.delete(doc.ref);
        expiredCount += 1;
      }
      return !expired;
    });
    if (expiredCount) await batch.commit();

    const lessons = activeDocs
      .sort((left, right) => {
        const leftUpdated = left.get("updatedAt")?.toDate?.()?.getTime?.() ?? 0;
        const rightUpdated = right.get("updatedAt")?.toDate?.()?.getTime?.() ?? 0;
        return rightUpdated - leftUpdated;
      });

    return NextResponse.json({
      lessons: lessons.map((doc) => serializeDoc(doc.id, doc.data())),
    });
  } catch (error) {
    const status = error instanceof Error && error.name === "UNAUTHENTICATED" ? 401 : 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Không thể tải lịch sử giáo án." },
      { status },
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const { lessonId, lesson } = (await request.json()) as SaveLessonRequest;
    if (!lesson) return NextResponse.json({ error: "Thiếu giáo án cần lưu." }, { status: 400 });

    const db = getFirebaseDb();
    const now = new Date();
    const summary = lessonSummary(lesson);
    const ref = lessonId ? db.collection("lessons").doc(lessonId) : db.collection("lessons").doc();
    const existing = await ref.get();
    if (existing.exists && existing.get("ownerId") !== user.uid) {
      return NextResponse.json({ error: "Bạn không có quyền cập nhật giáo án này." }, { status: 403 });
    }

    await ref.set(
      {
        ownerId: user.uid,
        ...summary,
        lesson,
        updatedAt: now,
        createdAt: existing.exists ? existing.get("createdAt") || now : now,
        expiresAt: existing.exists ? existing.get("expiresAt") || lessonExpiresAt() : lessonExpiresAt(),
        savedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    return NextResponse.json({ lessonId: ref.id });
  } catch (error) {
    const status = error instanceof Error && error.name === "UNAUTHENTICATED" ? 401 : 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Không thể lưu giáo án." },
      { status },
    );
  }
}
