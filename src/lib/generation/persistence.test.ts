import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LessonPlan } from "@/types/lesson";

const firebaseMocks = vi.hoisted(() => {
  const state = { exists: false, ownerId: "" };
  const ref = { id: "staged-job-1" };
  const snapshot = {
    get exists() { return state.exists; },
    get: (field: string) => field === "ownerId" ? state.ownerId : undefined,
  };
  const transaction = {
    get: vi.fn(async () => snapshot),
    create: vi.fn(),
  };
  const doc = vi.fn(() => ref);
  const collection = vi.fn(() => ({ doc }));
  const db = {
    collection,
    runTransaction: vi.fn(async (callback: (tx: typeof transaction) => unknown) => callback(transaction)),
  };
  return { state, ref, transaction, doc, collection, db };
});

vi.mock("@/lib/firebase-admin", () => ({
  getFirebaseDb: () => firebaseMocks.db,
}));
vi.mock("@/lib/auth-server", () => ({
  lessonExpiresAt: () => new Date("2026-08-22T00:00:00.000Z"),
}));

import { persistStagedGeneratedLesson, stagedLessonDocumentId } from "./persistence";

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

describe("staged lesson persistence", () => {
  beforeEach(() => {
    firebaseMocks.state.exists = false;
    firebaseMocks.state.ownerId = "";
    vi.clearAllMocks();
  });

  it("uses a deterministic lesson document ID and preserves the canonical lessons schema", async () => {
    const generatedLesson = lesson();
    generatedLesson.generalInfo.lessonTitle = "Bài 2 – Phép cộng";
    const lessonId = await persistStagedGeneratedLesson("user-1", "job-1", generatedLesson);

    expect(lessonId).toBe("staged-job-1");
    expect(firebaseMocks.doc).toHaveBeenCalledWith("staged-job-1");
    expect(firebaseMocks.transaction.create).toHaveBeenCalledWith(
      firebaseMocks.ref,
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

  it("treats an existing owned document as a successful retry without writing again", async () => {
    firebaseMocks.state.exists = true;
    firebaseMocks.state.ownerId = "user-1";

    await expect(persistStagedGeneratedLesson("user-1", "job-1", lesson()))
      .resolves.toBe("staged-job-1");
    expect(firebaseMocks.transaction.create).not.toHaveBeenCalled();
  });

  it("does not reuse a deterministic document owned by another user", async () => {
    firebaseMocks.state.exists = true;
    firebaseMocks.state.ownerId = "user-2";

    await expect(persistStagedGeneratedLesson("user-1", "job-1", lesson()))
      .rejects.toThrow("người dùng khác");
    expect(firebaseMocks.transaction.create).not.toHaveBeenCalled();
  });

  it("rejects unsafe job IDs", () => {
    expect(() => stagedLessonDocumentId("bad/id")).toThrow("không hợp lệ");
  });
});
