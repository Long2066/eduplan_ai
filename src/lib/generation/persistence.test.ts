import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LessonPlan } from "@/types/lesson";

const firebaseMocks = vi.hoisted(() => {
  type DocState = {
    exists: boolean;
    data: Record<string, unknown>;
  };

  const docs = new Map<string, DocState>();

  function getDocState(collectionName: string, docId: string): DocState {
    const key = `${collectionName}/${docId}`;
    const existing = docs.get(key);
    if (existing) return existing;
    const initial: DocState = { exists: false, data: {} };
    docs.set(key, initial);
    return initial;
  }

  const createDocRef = (collectionName: string, docId: string) => ({
    id: docId,
    path: `${collectionName}/${docId}`,
    collectionName,
  });

  const transaction = {
    get: vi.fn(async (ref: { collectionName?: string; id: string; path?: string }) => {
      const col = ref.collectionName || (ref.path ? ref.path.split("/")[0] : "lessons");
      const state = getDocState(col, ref.id);
      return {
        id: ref.id,
        get exists() {
          return state.exists;
        },
        data: () => ({ ...state.data }),
        get: (field: string) => state.data[field],
      };
    }),
    create: vi.fn((ref: { collectionName?: string; id: string; path?: string }, payload: Record<string, unknown>) => {
      const col = ref.collectionName || (ref.path ? ref.path.split("/")[0] : "lessons");
      const state = getDocState(col, ref.id);
      state.exists = true;
      state.data = { ...payload };
    }),
  };

  const doc = vi.fn((collectionName: string, docId: string) => createDocRef(collectionName, docId));
  const collection = vi.fn((collectionName: string) => ({
    doc: (docId: string) => doc(collectionName, docId),
  }));

  const db = {
    collection,
    runTransaction: vi.fn(async (callback: (tx: typeof transaction) => unknown) => callback(transaction)),
  };

  return { docs, getDocState, transaction, doc, collection, db };
});

vi.mock("@/lib/firebase-admin", () => ({
  getFirebaseDb: () => firebaseMocks.db,
}));
vi.mock("@/lib/auth-server", () => ({
  lessonExpiresAt: () => new Date("2026-08-22T00:00:00.000Z"),
}));

import {
  persistStagedGeneratedLesson,
  stagedLessonDocumentId,
  type StagedLessonPersistenceGuard,
} from "./persistence";
import { GenerationJobConflictError } from "./job-store";

function lesson(): LessonPlan {
  return {
    generalInfo: {
      school: "",
      department: "",
      teacher: "",
      lessonTitle: "Phép cộng",
      subject: "Toán",
      grade: "Lớp 3",
      duration: 35,
      periods: 2,
      date: "",
    },
    objectives: [],
    equipment: [],
    periodPlans: [],
  } as unknown as LessonPlan;
}

function activeJobData(overrides: Record<string, unknown> = {}) {
  return {
    uid: "user-1",
    status: "running",
    currentStage: "persistence",
    expiresAt: new Date(Date.now() + 60_000),
    lease: {
      owner: "worker-1",
      expiresAt: new Date(Date.now() + 60_000),
    },
    leaseEpoch: 3,
    ...overrides,
  };
}

describe("staged lesson persistence", () => {
  beforeEach(() => {
    firebaseMocks.docs.clear();
    vi.clearAllMocks();
  });

  it("uses a deterministic lesson document ID and preserves the canonical lessons schema (v1 call)", async () => {
    const generatedLesson = lesson();
    generatedLesson.generalInfo.lessonTitle = "Bài 2 – Phép cộng";
    const lessonId = await persistStagedGeneratedLesson("user-1", "job-1", generatedLesson);

    expect(lessonId).toBe("staged-job-1");
    expect(firebaseMocks.doc).toHaveBeenCalledWith("lessons", "staged-job-1");
    expect(firebaseMocks.doc).not.toHaveBeenCalledWith("generationJobs", "job-1");
    expect(firebaseMocks.transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({ id: "staged-job-1" }),
      expect.objectContaining({
        ownerId: "user-1",
        title: "Bài 2. Phép cộng",
        subject: "Toán",
        grade: "Lớp 3",
        periods: 2,
        lesson: expect.objectContaining({
          generalInfo: expect.objectContaining({ lessonTitle: "Bài 2. Phép cộng" }),
        }),
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
        expiresAt: new Date("2026-08-22T00:00:00.000Z"),
      }),
    );
  });

  it("rejects a generic title before opening a Firestore transaction", async () => {
    const genericLesson = lesson();
    genericLesson.generalInfo.lessonTitle = "Bài học Toán";

    await expect(persistStagedGeneratedLesson("user-1", "job-1", genericLesson))
      .rejects.toMatchObject({ code: "LESSON_TITLE_UNRESOLVED", status: 422 });
    expect(firebaseMocks.db.runTransaction).not.toHaveBeenCalled();
    expect(firebaseMocks.transaction.create).not.toHaveBeenCalled();
  });

  it("treats an existing owned document as a successful retry without writing again (v1)", async () => {
    const lessonState = firebaseMocks.getDocState("lessons", "staged-job-1");
    lessonState.exists = true;
    lessonState.data = { ownerId: "user-1" };

    await expect(persistStagedGeneratedLesson("user-1", "job-1", lesson()))
      .resolves.toBe("staged-job-1");
    expect(firebaseMocks.transaction.create).not.toHaveBeenCalled();
  });

  it("does not reuse a deterministic document owned by another user", async () => {
    const lessonState = firebaseMocks.getDocState("lessons", "staged-job-1");
    lessonState.exists = true;
    lessonState.data = { ownerId: "user-2" };

    await expect(persistStagedGeneratedLesson("user-1", "job-1", lesson()))
      .rejects.toThrow("người dùng khác");
    expect(firebaseMocks.transaction.create).not.toHaveBeenCalled();
  });

  it("rejects unsafe job IDs", () => {
    expect(() => stagedLessonDocumentId("bad/id")).toThrow("không hợp lệ");
  });

  describe("v2 persistence fencing guard", () => {
    const guard: StagedLessonPersistenceGuard = {
      owner: "worker-1",
      epoch: 3,
    };

    it("verifies generation job and creates lesson in the same transaction when guard succeeds", async () => {
      const jobState = firebaseMocks.getDocState("generationJobs", "job-1");
      jobState.exists = true;
      jobState.data = activeJobData();

      const lessonId = await persistStagedGeneratedLesson("user-1", "job-1", lesson(), guard);

      expect(lessonId).toBe("staged-job-1");
      expect(firebaseMocks.transaction.get).toHaveBeenCalledWith(
        expect.objectContaining({ id: "job-1" }),
      );
      expect(firebaseMocks.transaction.get).toHaveBeenCalledWith(
        expect.objectContaining({ id: "staged-job-1" }),
      );
      expect(firebaseMocks.transaction.create).toHaveBeenCalledOnce();
    });

    it("allows idempotent return for existing owned lesson if guard succeeds without creating again", async () => {
      const jobState = firebaseMocks.getDocState("generationJobs", "job-1");
      jobState.exists = true;
      jobState.data = activeJobData();

      const lessonState = firebaseMocks.getDocState("lessons", "staged-job-1");
      lessonState.exists = true;
      lessonState.data = { ownerId: "user-1" };

      await expect(persistStagedGeneratedLesson("user-1", "job-1", lesson(), guard))
        .resolves.toBe("staged-job-1");
      expect(firebaseMocks.transaction.create).not.toHaveBeenCalled();
    });

    it("rejects when job does not exist", async () => {
      await expect(persistStagedGeneratedLesson("user-1", "job-1", lesson(), guard))
        .rejects.toMatchObject({
          name: "GENERATION_JOB_CONFLICT",
          code: "GENERATION_JOB_LEASE_LOST",
        });
      expect(firebaseMocks.transaction.create).not.toHaveBeenCalled();
    });

    it("rejects when job belongs to another user", async () => {
      const jobState = firebaseMocks.getDocState("generationJobs", "job-1");
      jobState.exists = true;
      jobState.data = activeJobData({ uid: "user-2" });

      await expect(persistStagedGeneratedLesson("user-1", "job-1", lesson(), guard))
        .rejects.toMatchObject({ code: "GENERATION_JOB_LEASE_LOST" });
      expect(firebaseMocks.transaction.create).not.toHaveBeenCalled();
    });

    it("rejects cancelled, failed, or completed jobs", async () => {
      for (const status of ["cancelled", "failed", "completed"] as const) {
        firebaseMocks.docs.clear();
        const jobState = firebaseMocks.getDocState("generationJobs", "job-1");
        jobState.exists = true;
        jobState.data = activeJobData({ status });

        await expect(persistStagedGeneratedLesson("user-1", "job-1", lesson(), guard))
          .rejects.toMatchObject({ code: "GENERATION_JOB_LEASE_LOST" });
        expect(firebaseMocks.transaction.create).not.toHaveBeenCalled();
      }
    });

    it("rejects when current stage is not persistence", async () => {
      const jobState = firebaseMocks.getDocState("generationJobs", "job-1");
      jobState.exists = true;
      jobState.data = activeJobData({ currentStage: "final-validation" });

      await expect(persistStagedGeneratedLesson("user-1", "job-1", lesson(), guard))
        .rejects.toMatchObject({ code: "GENERATION_JOB_LEASE_LOST" });
      expect(firebaseMocks.transaction.create).not.toHaveBeenCalled();
    });

    it("rejects expired job", async () => {
      const jobState = firebaseMocks.getDocState("generationJobs", "job-1");
      jobState.exists = true;
      jobState.data = activeJobData({ expiresAt: new Date(Date.now() - 1000) });

      await expect(persistStagedGeneratedLesson("user-1", "job-1", lesson(), guard))
        .rejects.toMatchObject({ code: "GENERATION_JOB_LEASE_LOST" });
      expect(firebaseMocks.transaction.create).not.toHaveBeenCalled();
    });

    it("rejects expired lease or lease owner mismatch", async () => {
      const jobState = firebaseMocks.getDocState("generationJobs", "job-1");
      jobState.exists = true;
      jobState.data = activeJobData({
        lease: {
          owner: "worker-2",
          expiresAt: new Date(Date.now() + 60_000),
        },
      });

      await expect(persistStagedGeneratedLesson("user-1", "job-1", lesson(), guard))
        .rejects.toMatchObject({ code: "GENERATION_JOB_LEASE_LOST" });

      jobState.data = activeJobData({
        lease: {
          owner: "worker-1",
          expiresAt: new Date(Date.now() - 1000),
        },
      });

      await expect(persistStagedGeneratedLesson("user-1", "job-1", lesson(), guard))
        .rejects.toMatchObject({ code: "GENERATION_JOB_LEASE_LOST" });
      expect(firebaseMocks.transaction.create).not.toHaveBeenCalled();
    });

    it("rejects stale lease epoch", async () => {
      const jobState = firebaseMocks.getDocState("generationJobs", "job-1");
      jobState.exists = true;
      jobState.data = activeJobData({ leaseEpoch: 2 });

      await expect(persistStagedGeneratedLesson("user-1", "job-1", lesson(), guard))
        .rejects.toMatchObject({ code: "GENERATION_JOB_LEASE_LOST" });
      expect(firebaseMocks.transaction.create).not.toHaveBeenCalled();
    });

    it("fails closed on conflict between read and write if transaction re-evaluates updated cancelled state", async () => {
      let runCount = 0;
      const jobState = firebaseMocks.getDocState("generationJobs", "job-1");
      jobState.exists = true;
      jobState.data = activeJobData();

      firebaseMocks.db.runTransaction.mockImplementationOnce(async (callback: (tx: any) => unknown) => {
        runCount++;
        // Emulate conflict: job is cancelled before write commit, causing retry where job is cancelled
        jobState.data = activeJobData({ status: "cancelled" });
        return callback(firebaseMocks.transaction);
      });

      await expect(persistStagedGeneratedLesson("user-1", "job-1", lesson(), guard))
        .rejects.toMatchObject({ code: "GENERATION_JOB_LEASE_LOST" });
      expect(runCount).toBe(1);
      expect(firebaseMocks.transaction.create).not.toHaveBeenCalled();
    });

    it("supports Firestore Timestamp objects for expiry comparisons", async () => {
      const jobState = firebaseMocks.getDocState("generationJobs", "job-1");
      jobState.exists = true;
      jobState.data = activeJobData({
        expiresAt: { toDate: () => new Date(Date.now() + 60_000) },
        lease: {
          owner: "worker-1",
          expiresAt: { toDate: () => new Date(Date.now() + 60_000) },
        },
      });

      const lessonId = await persistStagedGeneratedLesson("user-1", "job-1", lesson(), guard);
      expect(lessonId).toBe("staged-job-1");
    });
  });
});

