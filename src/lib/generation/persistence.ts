import "server-only";
import { lessonExpiresAt } from "@/lib/auth-server";
import { getFirebaseDb } from "@/lib/firebase-admin";
import { lessonValidationSummary } from "@/lib/lesson-validation-status";
import { assertSpecificLessonTitle } from "@/lib/lesson-title";
import type { LessonPlan } from "@/types/lesson";

import {
  GENERATION_JOBS_COLLECTION,
  GenerationJobConflictError,
} from "@/lib/generation/job-store";

export type StagedLessonPersistenceGuard = {
  owner: string;
  epoch: number;
};

const ACTIVE_JOB_STATUSES = new Set(["pending", "running", "waiting_next_step"]);

function toMillis(value: unknown): number {
  if (value instanceof Date) return value.getTime();
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof (value as { toDate?: () => unknown }).toDate === "function"
  ) {
    const d = (value as { toDate: () => unknown }).toDate();
    if (d instanceof Date) return d.getTime();
  }
  return 0;
}

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
  guard?: StagedLessonPersistenceGuard,
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
  const jobRef = guard ? db.collection(GENERATION_JOBS_COLLECTION).doc(jobId) : null;

  await db.runTransaction(async (transaction) => {
    if (guard && jobRef) {
      const jobSnap = await transaction.get(jobRef);
      if (!jobSnap.exists) {
        throw new GenerationJobConflictError(
          "Yêu cầu tạo giáo án không tồn tại hoặc đã hết hiệu lực.",
          "GENERATION_JOB_LEASE_LOST",
        );
      }

      const jobUid = String(jobSnap.get("uid") || "");
      if (jobUid !== uid) {
        throw new GenerationJobConflictError(
          "Yêu cầu tạo giáo án không thuộc quyền sở hữu của tài khoản hiện tại.",
          "GENERATION_JOB_LEASE_LOST",
        );
      }

      const status = String(jobSnap.get("status") || "");
      if (!ACTIVE_JOB_STATUSES.has(status)) {
        throw new GenerationJobConflictError(
          "Yêu cầu tạo giáo án không ở trạng thái hoạt động.",
          "GENERATION_JOB_LEASE_LOST",
        );
      }

      const currentStage = String(jobSnap.get("currentStage") || "");
      if (currentStage !== "persistence") {
        throw new GenerationJobConflictError(
          "Giai đoạn tạo giáo án hiện tại không cho phép lưu trữ giáo án.",
          "GENERATION_JOB_LEASE_LOST",
        );
      }

      const now = Date.now();
      const jobExpiresAt = toMillis(jobSnap.get("expiresAt"));
      if (jobExpiresAt <= now) {
        throw new GenerationJobConflictError(
          "Yêu cầu tạo giáo án đã hết thời gian hiệu lực.",
          "GENERATION_JOB_LEASE_LOST",
        );
      }

      const lease = (jobSnap.get("lease") || null) as { owner?: unknown; expiresAt?: unknown } | null;
      const leaseOwner = typeof lease?.owner === "string" ? lease.owner : "";
      const leaseExpiresAt = toMillis(lease?.expiresAt);

      if (!leaseOwner || leaseOwner !== guard.owner || leaseExpiresAt <= now) {
        throw new GenerationJobConflictError(
          "Khóa thực thi tạo giáo án đã hết hạn hoặc thuộc worker khác.",
          "GENERATION_JOB_LEASE_LOST",
        );
      }

      const leaseEpoch = jobSnap.get("leaseEpoch");
      if (leaseEpoch !== guard.epoch) {
        throw new GenerationJobConflictError(
          "Phiên khóa thực thi tạo giáo án không khớp.",
          "GENERATION_JOB_LEASE_LOST",
        );
      }
    }

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

