import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LessonInput } from "@/types/lesson";

const firebaseMocks = vi.hoisted(() => {
  const state: {
    exists: boolean;
    data: Record<string, unknown>;
    artifacts: Record<string, { exists: boolean; data: Record<string, unknown> }>;
  } = { exists: false, data: {}, artifacts: {} };

  const artifactRef = (docId: string) => ({
    id: docId,
    get: vi.fn(async () => {
      const art = state.artifacts[docId];
      return {
        get exists() { return Boolean(art?.exists); },
        id: docId,
        data: () => art?.data || {},
        get: (field: string) => art?.data?.[field],
      };
    }),
  });

  const ref = {
    id: "job-1",
    get: vi.fn(async () => snapshot),
    collection: vi.fn((_subCol: string) => ({
      doc: vi.fn((docId: string) => artifactRef(docId)),
    })),
  };

  const snapshot = {
    get exists() { return state.exists; },
    id: "job-1",
    data: () => state.data,
    get: (field: string) => state.data[field],
  };

  const transaction = {
    get: vi.fn(async (targetRef: { id: string }) => {
      if (targetRef.id === "job-1") return snapshot;
      const art = state.artifacts[targetRef.id];
      return {
        get exists() { return Boolean(art?.exists); },
        id: targetRef.id,
        data: () => art?.data || {},
        get: (field: string) => art?.data?.[field],
      };
    }),
    create: vi.fn(),
    set: vi.fn((targetRef: { id: string }, value: Record<string, unknown>, options?: { merge?: boolean }) => {
      if (targetRef.id === "job-1") {
        state.data = options?.merge ? { ...state.data, ...value } : value;
      } else {
        const existing = state.artifacts[targetRef.id]?.data || {};
        state.artifacts[targetRef.id] = {
          exists: true,
          data: options?.merge ? { ...existing, ...value } : value,
        };
      }
    }),
  };
  const doc = vi.fn(() => ref);
  const collection = vi.fn(() => ({ doc }));
  const db = {
    collection,
    runTransaction: vi.fn(async (callback: (tx: typeof transaction) => unknown) => callback(transaction)),
    recursiveDelete: vi.fn(),
  };
  return { state, ref, snapshot, transaction, doc, collection, db };
});

vi.mock("@/lib/firebase-admin", () => ({
  getFirebaseDb: () => firebaseMocks.db,
}));

import {
  acquireGenerationCheckpointLease,
  acquireGenerationJobLease,
  cancelGenerationJobForUser,
  commitGenerationJobCheckpoint,
  createGenerationJobIfAbsent,
  deleteGenerationJobTree,
  expireGenerationJobForUser,
  getGenerationJob,
} from "./job-store";

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

function persistedJob(overrides: Record<string, unknown> = {}) {
  return {
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
    attempt: 0,
    inputSummary: { subject: "Toán", grade: "Lớp 3", lessonTitle: "Phép cộng", periods: 1, assetCount: 0 },
    inputFingerprint: "fingerprint-1",
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
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    ...overrides,
  };
}

describe("generation job store", () => {
  beforeEach(() => {
    firebaseMocks.state.exists = false;
    firebaseMocks.state.data = {};
    firebaseMocks.transaction.get.mockClear();
    firebaseMocks.transaction.create.mockClear();
    firebaseMocks.transaction.set.mockClear();
    firebaseMocks.doc.mockClear();
    firebaseMocks.db.recursiveDelete.mockReset().mockResolvedValue(undefined);
  });

  it("creates a deterministic job only once inside a transaction", async () => {
    const created = await createGenerationJobIfAbsent({
      id: "job-1",
      uid: "user-1",
      input: lessonInput(),
      inputFingerprint: "fingerprint-1",
    });
    expect(created.created).toBe(true);
    expect(created.job.id).toBe("job-1");
    expect(firebaseMocks.transaction.create).toHaveBeenCalledOnce();

    firebaseMocks.state.exists = true;
    firebaseMocks.state.data = persistedJob();
    const existing = await createGenerationJobIfAbsent({
      id: "job-1",
      uid: "user-1",
      input: lessonInput(),
      inputFingerprint: "fingerprint-1",
    });
    expect(existing.created).toBe(false);
    expect(existing.job.inputFingerprint).toBe("fingerprint-1");
  });

  it("does not reveal or cancel a job owned by another user", async () => {
    firebaseMocks.state.exists = true;
    firebaseMocks.state.data = persistedJob();
    await expect(cancelGenerationJobForUser("job-1", "user-2")).resolves.toBeNull();
    expect(firebaseMocks.transaction.set).not.toHaveBeenCalled();
  });

  it("prevents a second worker from taking an active lease", async () => {
    firebaseMocks.state.exists = true;
    firebaseMocks.state.data = persistedJob({
      lease: { owner: "worker-1", expiresAt: new Date(Date.now() + 60_000) },
    });
    await expect(acquireGenerationJobLease("job-1", "user-1", "worker-2"))
      .resolves.toBeNull();
    expect(firebaseMocks.transaction.set).not.toHaveBeenCalled();
  });

  it("marks an owned job cancelled and clears its lease", async () => {
    firebaseMocks.state.exists = true;
    firebaseMocks.state.data = persistedJob({
      lease: { owner: "worker-1", expiresAt: new Date(Date.now() + 60_000) },
    });
    const result = await cancelGenerationJobForUser("job-1", "user-1");
    expect(result?.job.status).toBe("cancelled");
    expect(firebaseMocks.transaction.set).toHaveBeenCalledWith(
      firebaseMocks.ref,
      expect.objectContaining({ status: "cancelled", lease: null }),
      { merge: true },
    );
  });

  it("marks an overdue active job failed and clears its lease", async () => {
    firebaseMocks.state.exists = true;
    firebaseMocks.state.data = persistedJob({
      expiresAt: new Date(Date.now() - 60_000),
      lease: { owner: "worker-1", expiresAt: new Date(Date.now() + 60_000) },
    });

    const result = await expireGenerationJobForUser("job-1", "user-1");

    expect(result?.changed).toBe(true);
    expect(result?.job.status).toBe("failed");
    expect(result?.job.error?.code).toBe("GENERATION_JOB_EXPIRED");
    expect(firebaseMocks.transaction.set).toHaveBeenCalledWith(
      firebaseMocks.ref,
      expect.objectContaining({
        status: "failed",
        lease: null,
        error: expect.objectContaining({ code: "GENERATION_JOB_EXPIRED" }),
      }),
      { merge: true },
    );
  });

  it("does not expire a job before its deadline", async () => {
    firebaseMocks.state.exists = true;
    firebaseMocks.state.data = persistedJob({
      expiresAt: new Date(Date.now() + 60_000),
    });

    const result = await expireGenerationJobForUser("job-1", "user-1");

    expect(result?.changed).toBe(false);
    expect(firebaseMocks.transaction.set).not.toHaveBeenCalled();
  });

  it("recursively deletes an expired job and all artifact subcollections", async () => {
    await deleteGenerationJobTree("job-1");

    expect(firebaseMocks.db.recursiveDelete).toHaveBeenCalledWith(firebaseMocks.ref);
  });

  describe("fenced checkpoint lease and atomic commits", () => {
    it("increments monotonic leaseEpoch and returns latest snapshot", async () => {
      firebaseMocks.state.exists = true;
      firebaseMocks.state.data = persistedJob({
        leaseEpoch: 2,
        pipelineVersion: "staged-v2",
        currentStage: "section-outcomes",
      });

      const acquired = await acquireGenerationCheckpointLease("job-1", "user-1", "worker-1", 60_000);
      expect(acquired).not.toBeNull();
      expect(acquired?.epoch).toBe(3);
      expect(acquired?.job.leaseEpoch).toBe(3);
      expect(acquired?.job.lease?.owner).toBe("worker-1");
      expect(acquired?.job.currentStage).toBe("section-outcomes");
      expect(firebaseMocks.transaction.set).toHaveBeenCalledWith(
        firebaseMocks.ref,
        expect.objectContaining({ leaseEpoch: 3, lease: expect.objectContaining({ owner: "worker-1" }) }),
        { merge: true },
      );
    });

    it("blocks lease acquisition if job is terminal or expired", async () => {
      firebaseMocks.state.exists = true;
      firebaseMocks.state.data = persistedJob({ status: "cancelled" });
      await expect(acquireGenerationCheckpointLease("job-1", "user-1", "worker-1")).resolves.toBeNull();

      firebaseMocks.state.data = persistedJob({ status: "completed" });
      await expect(acquireGenerationCheckpointLease("job-1", "user-1", "worker-1")).resolves.toBeNull();

      firebaseMocks.state.data = persistedJob({
        status: "running",
        expiresAt: new Date(Date.now() - 1000),
      });
      await expect(acquireGenerationCheckpointLease("job-1", "user-1", "worker-1")).resolves.toBeNull();
    });

    it("commits artifacts and job patch atomically when fenced lease and cursor match", async () => {
      firebaseMocks.state.exists = true;
      firebaseMocks.state.data = persistedJob({
        status: "running",
        currentStage: "section-outcomes",
        stageCursor: { position: 0, total: 1 },
        lease: { owner: "worker-1", expiresAt: new Date(Date.now() + 60_000) },
        leaseEpoch: 4,
        unitAttempts: { "section-outcomes:0": 1 },
      });

      const committed = await commitGenerationJobCheckpoint("job-1", "user-1", "worker-1", 4, {
        expectedStage: "section-outcomes",
        expectedPosition: 0,
        artifacts: [
          {
            key: { kind: "section-outcomes" },
            payload: { outcomes: ["Biết làm phép cộng"] },
          },
        ],
        patch: {
          currentStage: "section-materials",
          stageCursor: { position: 0, total: 1 },
          progress: {
            percent: 25,
            message: "Mục I đã hoàn thành",
            completedUnits: 3,
            totalUnits: 18,
            currentPeriod: null,
            totalPeriods: 1,
            currentPhase: undefined,
          },
        },
      });

      expect(committed).toBe(true);
      expect(firebaseMocks.state.data.currentStage).toBe("section-materials");
      expect(firebaseMocks.state.artifacts["section-outcomes"]).toBeDefined();
      expect(firebaseMocks.state.artifacts["section-outcomes"]?.data.payload).toEqual({
        outcomes: ["Biết làm phép cộng"],
      });
    });

    it("supports empty artifacts for durable attempt and error tracking checkpoints", async () => {
      firebaseMocks.state.exists = true;
      firebaseMocks.state.data = persistedJob({
        status: "running",
        currentStage: "period-phase",
        stageCursor: { position: 1, total: 4 },
        lease: { owner: "worker-1", expiresAt: new Date(Date.now() + 60_000) },
        leaseEpoch: 5,
        unitAttempts: {},
      });

      const committed = await commitGenerationJobCheckpoint("job-1", "user-1", "worker-1", 5, {
        expectedStage: "period-phase",
        expectedPosition: 1,
        artifacts: [],
        patch: {
          unitAttempts: { "period-phase:1": 1 },
        },
      });

      expect(committed).toBe(true);
      expect(firebaseMocks.state.data.unitAttempts).toEqual({ "period-phase:1": 1 });
    });

    it("rejects commit when stale epoch, mismatched owner, or expired lease attempts to write", async () => {
      firebaseMocks.state.exists = true;
      firebaseMocks.state.data = persistedJob({
        status: "running",
        currentStage: "period-phase",
        stageCursor: { position: 1, total: 4 },
        lease: { owner: "worker-1", expiresAt: new Date(Date.now() + 60_000) },
        leaseEpoch: 6,
      });

      // Stale epoch (e.g. 5 vs current 6)
      const staleResult = await commitGenerationJobCheckpoint("job-1", "user-1", "worker-1", 5, {
        expectedStage: "period-phase",
        expectedPosition: 1,
        patch: { status: "failed" },
      });
      expect(staleResult).toBe(false);

      // Mismatched owner
      const wrongOwner = await commitGenerationJobCheckpoint("job-1", "user-1", "worker-2", 6, {
        expectedStage: "period-phase",
        expectedPosition: 1,
        patch: { status: "failed" },
      });
      expect(wrongOwner).toBe(false);

      // Expired lease
      firebaseMocks.state.data = persistedJob({
        status: "running",
        currentStage: "period-phase",
        stageCursor: { position: 1, total: 4 },
        lease: { owner: "worker-1", expiresAt: new Date(Date.now() - 500) },
        leaseEpoch: 6,
      });
      const expiredLease = await commitGenerationJobCheckpoint("job-1", "user-1", "worker-1", 6, {
        expectedStage: "period-phase",
        expectedPosition: 1,
        patch: { status: "failed" },
      });
      expect(expiredLease).toBe(false);
    });

    it("rejects commit when job is cancelled or cursor advanced concurrently", async () => {
      firebaseMocks.state.exists = true;
      firebaseMocks.state.data = persistedJob({
        status: "cancelled",
        currentStage: "period-phase",
        stageCursor: { position: 1, total: 4 },
        lease: { owner: "worker-1", expiresAt: new Date(Date.now() + 60_000) },
        leaseEpoch: 7,
      });

      const cancelledResult = await commitGenerationJobCheckpoint("job-1", "user-1", "worker-1", 7, {
        expectedStage: "period-phase",
        expectedPosition: 1,
        patch: { status: "running" },
      });
      expect(cancelledResult).toBe(false);

      firebaseMocks.state.data = persistedJob({
        status: "running",
        currentStage: "period-phase",
        stageCursor: { position: 2, total: 4 }, // position already moved
        lease: { owner: "worker-1", expiresAt: new Date(Date.now() + 60_000) },
        leaseEpoch: 7,
      });

      const cursorMismatch = await commitGenerationJobCheckpoint("job-1", "user-1", "worker-1", 7, {
        expectedStage: "period-phase",
        expectedPosition: 1,
        patch: { stageCursor: { position: 2, total: 4 } },
      });
      expect(cursorMismatch).toBe(false);
    });

    it("normalizes and preserves stored pipeline versions without overwriting existing v1", async () => {
      firebaseMocks.state.exists = true;
      firebaseMocks.state.data = persistedJob({
        pipelineVersion: "staged-v1",
      });
      const jobV1 = await getGenerationJob("job-1");
      expect(jobV1?.pipelineVersion).toBe("staged-v1");

      firebaseMocks.state.data = persistedJob({
        pipelineVersion: "staged-v2",
      });
      const jobV2 = await getGenerationJob("job-1");
      expect(jobV2?.pipelineVersion).toBe("staged-v2");
    });
  });
});
