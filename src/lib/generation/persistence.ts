import "server-only";
import { lessonExpiresAt } from "@/lib/auth-server";
import { getFirebaseDb } from "@/lib/firebase-admin";
import { lessonValidationSummary } from "@/lib/lesson-validation-status";
import { assertSpecificLessonTitle } from "@/lib/lesson-title";
import type { LessonPlan } from "@/types/lesson";

function stripUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => stripUndefinedDeep(item)) as T;
  if (value instanceof Date) return value;
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).flatMap(([key, item]) => (
        item === undefined ? [] : [[key, stripUndefinedDeep(item)]]
      )),
    ) as T;
  }
  return value;
}

export function stagedLessonDocumentId(jobId: string) {
  const normalizedJobId = jobId.trim();
  if (!normalizedJobId || normalizedJobId.includes("/")) {
    throw new Error("Generation job ID không hợp lệ để lưu giáo án.");
  }
  return `staged-${normalizedJobId}`;
}

export async function persistStagedGeneratedLesson(
  uid: string,
  jobId: string,
  lesson: LessonPlan,
) {
  const canonicalTitle = assertSpecificLessonTitle(
    lesson.generalInfo.lessonTitle,
    lesson.generalInfo.subject,
  );
  const canonicalLesson: LessonPlan = {
    ...lesson,
    generalInfo: {
      ...lesson.generalInfo,
      lessonTitle: canonicalTitle,
    },
  };
  const db = getFirebaseDb();
  const lessonId = stagedLessonDocumentId(jobId);
  const lessonRef = db.collection("lessons").doc(lessonId);

  await db.runTransaction(async (transaction) => {
    const existing = await transaction.get(lessonRef);
    if (existing.exists) {
      if (existing.get("ownerId") !== uid) {
        throw new Error("ID giáo án đã thuộc về người dùng khác.");
      }
      return;
    }

    const now = new Date();
    const validation = lessonValidationSummary(canonicalLesson);
    const payload = stripUndefinedDeep({
      ownerId: uid,
      title: canonicalTitle,
      subject: canonicalLesson.generalInfo.subject,
      grade: canonicalLesson.generalInfo.grade,
      periods: Math.max(1, Number(canonicalLesson.generalInfo.periods || 1)),
      ...validation,
      lesson: canonicalLesson,
      createdAt: now,
      updatedAt: now,
      expiresAt: lessonExpiresAt(),
    });
    transaction.create(lessonRef, payload);
  });

  return lessonRef.id;
}
