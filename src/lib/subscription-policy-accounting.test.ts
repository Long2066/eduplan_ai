import { beforeEach, describe, expect, it, vi } from "vitest";

const firebaseMocks = vi.hoisted(() => {
  const state = {
    operationStatus: "reserved",
    user: {
      freeDailyUsed: 1,
      freeDailyDayKey: "2026-08-15",
    } as Record<string, unknown>,
  };
  type Ref = { collectionName: string; id: string };
  const collection = vi.fn((collectionName: string) => ({
    doc: vi.fn((id: string) => ({ collectionName, id }) satisfies Ref),
  }));
  const transaction = {
    get: vi.fn(async (ref: Ref) => {
      if (ref.collectionName === "generationOperations") {
        return {
          exists: true,
          data: () => ({
            status: state.operationStatus,
            source: "free",
            amount: 1,
            plan: "free",
            kind: "generate",
          }),
          get: (field: string) => field === "status" ? state.operationStatus : undefined,
        };
      }
      return {
        exists: true,
        data: () => state.user,
        get: (field: string) => state.user[field],
      };
    }),
    update: vi.fn((ref: Ref, patch: Record<string, unknown>) => {
      if (ref.collectionName === "generationOperations" && typeof patch.status === "string") {
        state.operationStatus = patch.status;
      }
    }),
    create: vi.fn(),
  };
  const db = {
    collection,
    runTransaction: vi.fn(async (callback: (tx: typeof transaction) => unknown) => callback(transaction)),
  };
  return { state, transaction, collection, db };
});

vi.mock("@/lib/firebase-admin", () => ({
  getFirebaseDb: () => firebaseMocks.db,
}));

import { commitUsage, releaseUsage, type UsageReservation } from "./subscription-policy";

const reservation: UsageReservation = {
  operationId: "operation-1",
  uid: "user-1",
  plan: "free",
  kind: "generate",
  source: "free",
  amount: 1,
};

describe("usage settlement idempotency", () => {
  beforeEach(() => {
    firebaseMocks.state.operationStatus = "reserved";
    firebaseMocks.state.user = {
      freeDailyUsed: 1,
      freeDailyDayKey: "2026-08-15",
    };
    vi.clearAllMocks();
  });

  it("does not consume or write a second ledger entry when commit is retried", async () => {
    await commitUsage(reservation, "staged-job-1", { jobId: "job-1" });
    await commitUsage(reservation, "staged-job-1", { jobId: "job-1" });

    expect(firebaseMocks.state.operationStatus).toBe("committed");
    expect(firebaseMocks.transaction.create).toHaveBeenCalledTimes(1);
    expect(firebaseMocks.transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({ collectionName: "entitlementLedger" }),
      expect.objectContaining({ type: "consume", lessonId: "staged-job-1" }),
    );
  });

  it("does not refund or write a second ledger entry when release is retried", async () => {
    await releaseUsage(reservation, "staged_final_validation_rejected", { jobId: "job-1" });
    const writesAfterFirstRelease = firebaseMocks.transaction.update.mock.calls.length;
    await releaseUsage(reservation, "staged_final_validation_rejected", { jobId: "job-1" });

    expect(firebaseMocks.state.operationStatus).toBe("released");
    expect(firebaseMocks.transaction.create).toHaveBeenCalledTimes(1);
    expect(firebaseMocks.transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({ collectionName: "entitlementLedger" }),
      expect.objectContaining({ type: "release", reason: "staged_final_validation_rejected" }),
    );
    expect(firebaseMocks.transaction.update).toHaveBeenCalledTimes(writesAfterFirstRelease);
  });
});
