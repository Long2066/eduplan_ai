import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GenerationJob, PersistedGenerationInput } from "./job-types";
import type { LessonInput } from "@/types/lesson";

const storeMocks = vi.hoisted(() => ({
  cancelGenerationJobForUser: vi.fn(),
  createGenerationJobIfAbsent: vi.fn(),
  generationJobTtlMs: vi.fn(() => 7 * 24 * 60 * 60 * 1000),
  getGenerationJob: vi.fn(),
  getGenerationJobForUser: vi.fn(),
  readGenerationJobArtifact: vi.fn(),
  updateGenerationJob: vi.fn(),
  writeGenerationJobArtifact: vi.fn(),
}));

const storageMocks = vi.hoisted(() => ({
  deletePersistedGenerationInput: vi.fn(),
  persistGenerationInput: vi.fn(),
}));

const usageMocks = vi.hoisted(() => ({
  releaseUsage: vi.fn(),
  reserveUsage: vi.fn(),
}));

const lifecycleMocks = vi.hoisted(() => ({
  cleanupGenerationJobInput: vi.fn(),
  cleanupTerminalGenerationJobInput: vi.fn(),
  expireStagedGenerationJobIfNeeded: vi.fn(),
  generationJobLifecycleTelemetry: vi.fn((job: { id: string; currentStage: string }, outcome: string) => ({
    version: 2,
    jobId: job.id,
    stage: job.currentStage,
    outcome,
    summary: {},
    calls: [],
  })),
}));

vi.mock("@/lib/generation/job-store", () => storeMocks);
vi.mock("@/lib/generation/input-storage", () => storageMocks);
vi.mock("@/lib/generation/lifecycle", () => lifecycleMocks);
vi.mock("@/lib/subscription-policy", () => usageMocks);

import { generationInputFingerprint } from "./job-input";
import {
  cancelStagedGenerationJob,
  createStagedGenerationJob,
  getStagedGenerationJob,
} from "./job-service";

function lessonInput(): LessonInput {
  return {
    subject: "Toán",
    grade: "Lớp 3",
    lessonTitle: "Phép cộng",
    book: "Kết nối tri thức",
    bookVolume: "auto",
    periods: 1,
    duration: 35,
    hometownProvince: "auto",
    localityNote: "",
    studentProfile: "auto",
    teachingEnvironment: "auto",
    facilities: "auto",
    style: "Dạy thật trên lớp",
    specialRequest: "",
    allowAiInference: true,
    enableDigitalCompetency: false,
    uploadedAssets: [],
  };
}

function generationJob(overrides: Partial<GenerationJob> = {}): GenerationJob {
  const input = lessonInput();
  return {
    id: "job-1",
    schemaVersion: 1,
    pipelineVersion: "staged-v1",
    uid: "user-1",
    status: "pending",
    currentStage: "initialize",
    progress: {
      percent: 0,
      message: "Đang chuẩn bị yêu cầu tạo giáo án.",
      completedUnits: 0,
      totalUnits: 10,
      currentPeriod: null,
      totalPeriods: 1,
    },
    stageCursor: { position: 0, total: 0 },
    attempt: 0,
    inputSummary: { subject: "Toán", grade: "Lớp 3", lessonTitle: "Phép cộng", periods: 1, assetCount: 0 },
    inputFingerprint: generationInputFingerprint(input),
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
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    expiresAt: new Date("2026-01-08T00:00:00.000Z"),
    ...overrides,
  };
}

describe("generation job service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storeMocks.getGenerationJob.mockResolvedValue(null);
    storeMocks.getGenerationJobForUser.mockResolvedValue(null);
    storeMocks.updateGenerationJob.mockResolvedValue(undefined);
    storeMocks.writeGenerationJobArtifact.mockResolvedValue("input");
    storageMocks.deletePersistedGenerationInput.mockResolvedValue(undefined);
    storageMocks.persistGenerationInput.mockResolvedValue({ ...lessonInput(), uploadedAssets: [] } satisfies PersistedGenerationInput);
    usageMocks.reserveUsage.mockResolvedValue(generationJob().quotaReservation);
    usageMocks.releaseUsage.mockResolvedValue(undefined);
    lifecycleMocks.cleanupGenerationJobInput.mockResolvedValue(undefined);
    lifecycleMocks.cleanupTerminalGenerationJobInput.mockResolvedValue(undefined);
    lifecycleMocks.expireStagedGenerationJobIfNeeded.mockResolvedValue(null);
  });

  it("returns the same job without reserving another usage for an idempotent retry", async () => {
    const existing = generationJob();
    storeMocks.getGenerationJob.mockResolvedValue(existing);
    const result = await createStagedGenerationJob(
      { uid: "user-1", email: "teacher@example.com" },
      lessonInput(),
      "request-123",
    );
    expect(result).toEqual({ job: existing, created: false });
    expect(usageMocks.reserveUsage).not.toHaveBeenCalled();
    expect(storageMocks.persistGenerationInput).not.toHaveBeenCalled();
  });

  it("rejects reuse of an idempotency key with different input", async () => {
    storeMocks.getGenerationJob.mockResolvedValue(generationJob({ inputFingerprint: "different" }));
    await expect(createStagedGenerationJob(
      { uid: "user-1", email: "teacher@example.com" },
      lessonInput(),
      "request-123",
    )).rejects.toMatchObject({ code: "IDEMPOTENCY_INPUT_CONFLICT", status: 409 });
    expect(usageMocks.reserveUsage).not.toHaveBeenCalled();
  });

  it("does not refund the winning job when concurrent inputs reuse one key", async () => {
    storeMocks.createGenerationJobIfAbsent.mockResolvedValue({
      job: generationJob({ inputFingerprint: "different" }),
      created: false,
    });
    await expect(createStagedGenerationJob(
      { uid: "user-1", email: "teacher@example.com" },
      lessonInput(),
      "request-123",
    )).rejects.toMatchObject({ code: "IDEMPOTENCY_INPUT_CONFLICT", status: 409 });
    expect(usageMocks.reserveUsage).toHaveBeenCalledOnce();
    expect(usageMocks.releaseUsage).not.toHaveBeenCalled();
  });

  it("uploads input and advances a newly created job to the OCR boundary", async () => {
    storeMocks.createGenerationJobIfAbsent.mockImplementation(async (input: { id: string; inputFingerprint: string }) => ({
      job: generationJob({ id: input.id, inputFingerprint: input.inputFingerprint }),
      created: true,
    }));
    const result = await createStagedGenerationJob(
      { uid: "user-1", email: "teacher@example.com" },
      lessonInput(),
      "request-123",
    );
    expect(result.job).toMatchObject({ status: "waiting_next_step", currentStage: "ocr" });
    expect(usageMocks.reserveUsage).toHaveBeenCalledWith(
      "user-1",
      "generate",
      "request-123",
      expect.objectContaining({ reservationTtlMs: 7 * 24 * 60 * 60 * 1000 }),
    );
    expect(storeMocks.writeGenerationJobArtifact).toHaveBeenCalledWith(
      result.job.id,
      { kind: "input" },
      expect.objectContaining({ uploadedAssets: [] }),
    );
    expect(storeMocks.updateGenerationJob).toHaveBeenCalledWith(
      result.job.id,
      expect.objectContaining({ status: "waiting_next_step", currentStage: "ocr" }),
    );
  });

  it("marks the job failed and refunds usage when input persistence fails", async () => {
    storeMocks.createGenerationJobIfAbsent.mockImplementation(async (input: { id: string; inputFingerprint: string }) => ({
      job: generationJob({ id: input.id, inputFingerprint: input.inputFingerprint }),
      created: true,
    }));
    storageMocks.persistGenerationInput.mockRejectedValue(new Error("storage unavailable"));
    await expect(createStagedGenerationJob(
      { uid: "user-1", email: "teacher@example.com" },
      lessonInput(),
      "request-123",
    )).rejects.toThrow("storage unavailable");
    expect(storeMocks.updateGenerationJob).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ status: "failed" }),
    );
    expect(usageMocks.releaseUsage).toHaveBeenCalledWith(
      expect.objectContaining({ operationId: "operation-1" }),
      "staged_input_persistence_failed",
      expect.objectContaining({ stage: "initialize" }),
    );
  });

  it("enforces ownership and refunds a cancelled job", async () => {
    await expect(getStagedGenerationJob("user-2", "job-1"))
      .rejects.toMatchObject({ code: "GENERATION_JOB_NOT_FOUND", status: 404 });

    const cancelled = generationJob({ status: "cancelled" });
    storeMocks.cancelGenerationJobForUser.mockResolvedValue({ job: cancelled, changed: true });
    storeMocks.readGenerationJobArtifact.mockResolvedValue({ payload: { ...lessonInput(), uploadedAssets: [] } });
    const result = await cancelStagedGenerationJob("user-1", "job-1");
    expect(result.status).toBe("cancelled");
    expect(usageMocks.releaseUsage).toHaveBeenCalledWith(
      cancelled.quotaReservation,
      "staged_generation_cancelled",
      expect.objectContaining({ jobId: "job-1" }),
    );
    expect(lifecycleMocks.cleanupGenerationJobInput).toHaveBeenCalledWith(cancelled);
  });

  it("expires an overdue job before returning it to the client", async () => {
    const overdue = generationJob({
      status: "waiting_next_step",
      currentStage: "ocr",
      expiresAt: new Date(Date.now() - 60_000),
    });
    const expired = generationJob({
      status: "failed",
      currentStage: "ocr",
      expiresAt: overdue.expiresAt,
      error: {
        code: "GENERATION_JOB_EXPIRED",
        message: "Expired",
        stage: "ocr",
        retryable: false,
      },
    });
    storeMocks.getGenerationJobForUser.mockResolvedValue(overdue);
    lifecycleMocks.expireStagedGenerationJobIfNeeded.mockResolvedValue(expired);

    const result = await getStagedGenerationJob("user-1", "job-1");

    expect(result).toBe(expired);
    expect(lifecycleMocks.expireStagedGenerationJobIfNeeded).toHaveBeenCalledWith("user-1", "job-1");
    expect(lifecycleMocks.cleanupTerminalGenerationJobInput).not.toHaveBeenCalled();
  });
});
