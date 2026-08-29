import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GenerationJob } from "./job-types";

const storeMocks = vi.hoisted(() => ({
  deleteGenerationJobTree: vi.fn(),
  expireGenerationJobForUser: vi.fn(),
  listExpiredGenerationJobs: vi.fn(),
  readGenerationJobArtifact: vi.fn(),
}));
const storageMocks = vi.hoisted(() => ({
  deletePersistedGenerationInput: vi.fn(),
}));
const usageMocks = vi.hoisted(() => ({
  releaseUsage: vi.fn(),
}));

vi.mock("@/lib/generation/job-store", () => storeMocks);
vi.mock("@/lib/generation/input-storage", () => storageMocks);
vi.mock("@/lib/subscription-policy", () => usageMocks);

import {
  cleanupExpiredGenerationJobs,
  cleanupGenerationJobInput,
  cleanupTerminalGenerationJobInput,
  expireStagedGenerationJobIfNeeded,
} from "./lifecycle";

function job(overrides: Partial<GenerationJob> = {}): GenerationJob {
  return {
    id: "job-1",
    schemaVersion: 1,
    pipelineVersion: "staged-v1",
    uid: "user-1",
    status: "waiting_next_step",
    currentStage: "ocr",
    progress: {
      percent: 10,
      message: "Ready",
      completedUnits: 1,
      totalUnits: 10,
      currentPeriod: null,
      totalPeriods: 1,
    },
    stageCursor: { position: 0, total: 1 },
    attempt: 0,
    inputSummary: {
      subject: "Toán",
      grade: "Lớp 3",
      lessonTitle: "Phép cộng",
      periods: 1,
      assetCount: 1,
    },
    inputFingerprint: "fingerprint",
    quotaReservationId: "operation-1",
    quotaReservation: {
      operationId: "operation-1",
      uid: "user-1",
      plan: "free",
      kind: "generate",
      source: "free",
      amount: 1,
    },
    lease: null,
    lessonId: null,
    error: null,
    createdAt: new Date("2026-08-15T00:00:00.000Z"),
    updatedAt: new Date("2026-08-15T00:00:00.000Z"),
    expiresAt: new Date("2026-08-22T00:00:00.000Z"),
    ...overrides,
  };
}

describe("generation job lifecycle cleanup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storageMocks.deletePersistedGenerationInput.mockResolvedValue(undefined);
    usageMocks.releaseUsage.mockResolvedValue(undefined);
    storeMocks.listExpiredGenerationJobs.mockResolvedValue([]);
    storeMocks.deleteGenerationJobTree.mockResolvedValue(undefined);
  });

  it("deletes persisted input through the owned input artifact", async () => {
    const persisted = { uploadedAssets: [{ storagePath: "owned.png" }] };
    storeMocks.readGenerationJobArtifact.mockResolvedValue({ payload: persisted });

    await cleanupGenerationJobInput(job());

    expect(storageMocks.deletePersistedGenerationInput).toHaveBeenCalledWith(
      "user-1",
      "job-1",
      persisted,
    );
  });

  it("only performs lazy cleanup for terminal jobs", async () => {
    await cleanupTerminalGenerationJobInput(job());
    expect(storeMocks.readGenerationJobArtifact).not.toHaveBeenCalled();

    storeMocks.readGenerationJobArtifact.mockResolvedValue({ payload: { uploadedAssets: [] } });
    await cleanupTerminalGenerationJobInput(job({ status: "completed", currentStage: "completed" }));
    expect(storageMocks.deletePersistedGenerationInput).toHaveBeenCalledOnce();
  });

  it("releases quota and cleans input for an expired job", async () => {
    const expired = job({
      status: "failed",
      error: {
        code: "GENERATION_JOB_EXPIRED",
        message: "Expired",
        stage: "ocr",
        retryable: false,
      },
    });
    storeMocks.expireGenerationJobForUser.mockResolvedValue({ job: expired, changed: true });
    storeMocks.readGenerationJobArtifact.mockResolvedValue({ payload: { uploadedAssets: [] } });

    const result = await expireStagedGenerationJobIfNeeded("user-1", "job-1");

    expect(result?.status).toBe("failed");
    expect(usageMocks.releaseUsage).toHaveBeenCalledWith(
      expired.quotaReservation,
      "staged_generation_job_expired",
      expect.objectContaining({ jobId: "job-1", stage: "ocr" }),
    );
    expect(storageMocks.deletePersistedGenerationInput).toHaveBeenCalledOnce();
  });

  it("retries expired settlement safely even when the store transition already happened", async () => {
    const expired = job({
      status: "failed",
      error: {
        code: "GENERATION_JOB_EXPIRED",
        message: "Expired",
        stage: "ocr",
        retryable: false,
      },
    });
    storeMocks.expireGenerationJobForUser.mockResolvedValue({ job: expired, changed: false });
    storeMocks.readGenerationJobArtifact.mockResolvedValue({ payload: { uploadedAssets: [] } });

    await expireStagedGenerationJobIfNeeded("user-1", "job-1");

    expect(usageMocks.releaseUsage).toHaveBeenCalledOnce();
    expect(storageMocks.deletePersistedGenerationInput).toHaveBeenCalledOnce();
  });

  it("scans overdue jobs and isolates cleanup failures", async () => {
    const active = job({ id: "job-active" });
    const completed = job({
      id: "job-completed",
      status: "completed",
      currentStage: "completed",
    });
    storeMocks.listExpiredGenerationJobs.mockResolvedValue([active, completed]);
    storeMocks.expireGenerationJobForUser.mockResolvedValue({
      job: {
        ...active,
        status: "failed",
        error: {
          code: "GENERATION_JOB_EXPIRED",
          message: "Expired",
          stage: "ocr",
          retryable: false,
        },
      },
      changed: true,
    });
    storeMocks.readGenerationJobArtifact
      .mockResolvedValueOnce({ payload: { uploadedAssets: [] } })
      .mockRejectedValueOnce(new Error("firestore unavailable"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const result = await cleanupExpiredGenerationJobs();

    expect(result).toEqual({ scanned: 2, settled: 1, cleaned: 1, deleted: 1, failed: 1 });
    expect(storeMocks.deleteGenerationJobTree).toHaveBeenCalledWith("job-active");
    expect(consoleError).toHaveBeenCalledWith(
      "[EduPlan AI] Expired generation cleanup failed",
      expect.objectContaining({ jobId: "job-completed" }),
    );
    consoleError.mockRestore();
  });
});
