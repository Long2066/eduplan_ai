import "server-only";
import {
  cancelGenerationJobForUser,
  createGenerationJobIfAbsent,
  generationJobTtlMs,
  getGenerationJob,
  getGenerationJobForUser,
  updateGenerationJob,
  writeGenerationJobArtifact,
} from "@/lib/generation/job-store";
import {
  GenerationJobRequestError,
  generationInputFingerprint,
  generationJobDocumentId,
} from "@/lib/generation/job-input";
import {
  deletePersistedGenerationInput,
  persistGenerationInput,
} from "@/lib/generation/input-storage";
import {
  cleanupGenerationJobInput,
  cleanupTerminalGenerationJobInput,
  expireStagedGenerationJobIfNeeded,
  generationJobLifecycleTelemetry,
} from "@/lib/generation/lifecycle";
import { releaseUsage, reserveUsage, type UsageReservation } from "@/lib/subscription-policy";
import type {
  GenerationJob,
  GenerationJobQuotaReservation,
  PersistedGenerationInput,
} from "@/lib/generation/job-types";
import type { LessonInput } from "@/types/lesson";
import type { GenerationSecurityContext } from "@shared/security-contract";

type GenerationJobUser = {
  uid: string;
  email: string;
};

function assertMatchingInput(job: GenerationJob, fingerprint: string) {
  if (job.inputFingerprint !== fingerprint) {
    throw new GenerationJobRequestError(
      "idempotency-key này đã được dùng cho một yêu cầu tạo giáo án khác.",
      "IDEMPOTENCY_INPUT_CONFLICT",
      409,
    );
  }
}

function asJobReservation(reservation: UsageReservation): GenerationJobQuotaReservation {
  return { ...reservation };
}

function readyProgress(job: GenerationJob) {
  const completedUnits = Math.max(1, job.progress.completedUnits);
  return {
    ...job.progress,
    completedUnits,
    percent: Math.min(99, Math.round((completedUnits / job.progress.totalUnits) * 100)),
    message: "Dữ liệu đầu vào đã sẵn sàng. Đang chờ bước OCR.",
  };
}

export async function createStagedGenerationJob(
  user: GenerationJobUser,
  input: LessonInput,
  idempotencyKey: string,
  security?: GenerationSecurityContext,
) {
  const jobId = generationJobDocumentId(user.uid, idempotencyKey);
  const fingerprint = generationInputFingerprint(input);
  const existing = await getGenerationJob(jobId);
  if (existing) {
    if (existing.uid !== user.uid) {
      throw new GenerationJobRequestError("Yêu cầu tạo giáo án không hợp lệ.", "GENERATION_JOB_CONFLICT", 409);
    }
    assertMatchingInput(existing, fingerprint);
    return { job: existing, created: false };
  }

  let reservation: UsageReservation | null = null;
  let persistedInput: PersistedGenerationInput | null = null;
  let jobCreated = false;
  try {
    reservation = await reserveUsage(user.uid, "generate", idempotencyKey, {
      userEmail: user.email,
      subject: input.subject,
      reservationTtlMs: generationJobTtlMs(),
      security,
    });
    const creation = await createGenerationJobIfAbsent({
      id: jobId,
      uid: user.uid,
      input,
      inputFingerprint: fingerprint,
      quotaReservation: asJobReservation(reservation),
    });
    if (!creation.created) {
      // The reservation belongs to the job that won the create transaction.
      // A conflicting retry must never refund that active job.
      reservation = null;
      assertMatchingInput(creation.job, fingerprint);
      return { job: creation.job, created: false };
    }
    jobCreated = true;

    persistedInput = await persistGenerationInput(user.uid, jobId, input);
    await writeGenerationJobArtifact(jobId, { kind: "input" }, persistedInput);
    const progress = readyProgress(creation.job);
    await updateGenerationJob(jobId, {
      status: "waiting_next_step",
      currentStage: "ocr",
      progress,
      error: null,
    });
    return {
      created: true,
      job: {
        ...creation.job,
        status: "waiting_next_step" as const,
        currentStage: "ocr" as const,
        progress,
        updatedAt: new Date(),
      },
    };
  } catch (error) {
    if (persistedInput) {
      await deletePersistedGenerationInput(user.uid, jobId, persistedInput).catch(() => undefined);
    }
    if (jobCreated) {
      await updateGenerationJob(jobId, {
        status: "failed",
        lease: null,
        error: {
          code: "INPUT_PERSISTENCE_FAILED",
          message: "Không thể chuẩn bị dữ liệu đầu vào cho yêu cầu tạo giáo án.",
          stage: "initialize",
          retryable: true,
        },
      }).catch(() => undefined);
    }
    if (reservation) {
      await releaseUsage(reservation, "staged_input_persistence_failed", {
        jobId,
        stage: "initialize",
      }).catch((releaseError) => {
        console.error("[EduPlan AI] Staged reservation release failed", {
          jobId,
          message: releaseError instanceof Error ? releaseError.message : "Unknown release error",
        });
      });
    }
    throw error;
  }
}

export async function getStagedGenerationJob(uid: string, jobId: string) {
  const job = await getGenerationJobForUser(jobId, uid);
  if (!job) {
    throw new GenerationJobRequestError("Không tìm thấy yêu cầu tạo giáo án.", "GENERATION_JOB_NOT_FOUND", 404);
  }
  if (!["completed", "failed", "cancelled"].includes(job.status) && job.expiresAt.getTime() <= Date.now()) {
    const expired = await expireStagedGenerationJobIfNeeded(uid, jobId);
    if (expired) return expired;
  }
  await cleanupTerminalGenerationJobInput(job).catch((error) => {
    console.warn("[EduPlan AI] Terminal generation input cleanup will retry later", {
      jobId,
      message: error instanceof Error ? error.message : "Unknown cleanup error",
    });
  });
  return job;
}

export async function cancelStagedGenerationJob(uid: string, jobId: string) {
  const result = await cancelGenerationJobForUser(jobId, uid);
  if (!result) {
    throw new GenerationJobRequestError("Không tìm thấy yêu cầu tạo giáo án.", "GENERATION_JOB_NOT_FOUND", 404);
  }

  if (result.job.quotaReservation) {
    await releaseUsage(
      result.job.quotaReservation,
      "staged_generation_cancelled",
      generationJobLifecycleTelemetry(result.job, "cancelled"),
    );
  }

  try {
    await cleanupGenerationJobInput(result.job);
  } catch (error) {
    console.warn("[EduPlan AI] Cancelled generation input cleanup skipped", {
      jobId,
      message: error instanceof Error ? error.message : "Unknown cleanup error",
    });
  }

  return result.job;
}

export function serializeGenerationJob(job: GenerationJob) {
  return {
    id: job.id,
    schemaVersion: job.schemaVersion,
    pipelineVersion: job.pipelineVersion,
    status: job.status,
    currentStage: job.currentStage,
    progress: job.progress,
    stageCursor: job.stageCursor,
    attempt: job.attempt,
    inputSummary: job.inputSummary,
    lessonId: job.lessonId,
    error: job.error,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
    expiresAt: job.expiresAt.toISOString(),
  };
}
