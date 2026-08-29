import "server-only";
import {
  deleteGenerationJobTree,
  expireGenerationJobForUser,
  listExpiredGenerationJobs,
  readGenerationJobArtifact,
} from "@/lib/generation/job-store";
import { deletePersistedGenerationInput } from "@/lib/generation/input-storage";
import { releaseUsage } from "@/lib/subscription-policy";
import type {
  GenerationJob,
  PersistedGenerationInput,
} from "@/lib/generation/job-types";
import { MAX_GENERATION_SECURITY_CALLS, summarizeSecurityGenerationCalls } from "@shared/security-contract";

export function generationJobLifecycleTelemetry(job: GenerationJob, outcome: "cancelled" | "expired") {
  const calls = Object.values(job.telemetry?.entries || {})
    .flatMap((entry) => entry.calls)
    .slice(-MAX_GENERATION_SECURITY_CALLS);
  return {
    version: 2,
    pipelineVersion: job.pipelineVersion,
    jobId: job.id,
    stage: job.currentStage,
    outcome,
    summary: summarizeSecurityGenerationCalls(calls),
    calls,
  };
}

export async function cleanupGenerationJobInput(job: GenerationJob) {
  const inputArtifact = await readGenerationJobArtifact<PersistedGenerationInput>(
    job.id,
    { kind: "input" },
  );
  await deletePersistedGenerationInput(job.uid, job.id, inputArtifact?.payload || null);
}

export async function cleanupTerminalGenerationJobInput(job: GenerationJob) {
  if (!["completed", "failed", "cancelled"].includes(job.status)) return;
  await cleanupGenerationJobInput(job);
}

export async function expireStagedGenerationJobIfNeeded(uid: string, jobId: string) {
  const result = await expireGenerationJobForUser(jobId, uid);
  if (!result) return null;
  const job = result.job;
  if (job.error?.code !== "GENERATION_JOB_EXPIRED") return job;

  if (job.quotaReservation) {
    await releaseUsage(
      job.quotaReservation,
      "staged_generation_job_expired",
      generationJobLifecycleTelemetry(job, "expired"),
    );
  }
  await cleanupGenerationJobInput(job);
  return job;
}

export async function cleanupExpiredGenerationJobs(limit = 50) {
  const candidates = await listExpiredGenerationJobs(limit);
  const result = {
    scanned: candidates.length,
    settled: 0,
    cleaned: 0,
    deleted: 0,
    failed: 0,
  };

  for (const job of candidates) {
    try {
      if (["completed", "failed", "cancelled"].includes(job.status)) {
        if (job.error?.code === "GENERATION_JOB_EXPIRED") {
          await expireStagedGenerationJobIfNeeded(job.uid, job.id);
          result.settled += 1;
        } else {
          await cleanupTerminalGenerationJobInput(job);
        }
      } else {
        await expireStagedGenerationJobIfNeeded(job.uid, job.id);
        result.settled += 1;
      }
      result.cleaned += 1;
      await deleteGenerationJobTree(job.id);
      result.deleted += 1;
    } catch (error) {
      result.failed += 1;
      console.error("[EduPlan AI] Expired generation cleanup failed", {
        jobId: job.id,
        message: error instanceof Error ? error.message : "Unknown cleanup error",
      });
    }
  }

  return result;
}
