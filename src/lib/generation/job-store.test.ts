import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LessonInput } from "@/types/lesson";

const firebaseMocks = vi.hoisted(() => {
  const state: { exists: boolean; data: Record<string, unknown> } = { exists: false, data: {} };
  const ref = { id: "job-1" };
  const snapshot = {
    get exists() { return state.exists; },
    id: "job-1",
    data: () => state.data,
    get: (field: string) => state.data[field],
  };
  const transaction = {
    get: vi.fn(async () => snapshot),
    create: vi.fn(),
    set: vi.fn(),
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
  acquireGenerationJobLease,
  cancelGenerationJobForUser,
  createGenerationJobIfAbsent,
  deleteGenerationJobTree,
  expireGenerationJobForUser,
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
    expiresAt: new Date("2026-01-08T00:00:00.000Z"),
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
});
