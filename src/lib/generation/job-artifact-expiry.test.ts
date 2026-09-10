import { beforeEach, describe, expect, it, vi } from "vitest";

const firebaseMocks = vi.hoisted(() => {
  const data: Record<string, unknown> = {};
  const jobData: Record<string, unknown> = {
    uid: "user-1",
    status: "pending",
    pipelineVersion: "staged-v1",
    expiresAt: new Date("2026-08-20T00:00:00.000Z"),
  };
  const artifactSnapshot = {
    exists: false,
    id: "input",
    data: () => data,
    get: (field: string) => data[field],
  };
  const jobSnapshot = {
    exists: true,
    id: "job-1",
    data: () => jobData,
    get: (field: string) => jobData[field],
  };
  const artifactRef = {
    id: "input",
    get: vi.fn(async () => artifactSnapshot),
  };
  const artifactsCollection = {
    doc: vi.fn(() => artifactRef),
  };
  const jobRef = {
    id: "job-1",
    collection: vi.fn(() => artifactsCollection),
    get: vi.fn(async () => jobSnapshot),
  };
  const jobsCollection = {
    doc: vi.fn(() => jobRef),
  };
  const transaction = {
    get: vi.fn(async (ref: { id: string }) => (ref.id === "job-1" ? jobSnapshot : artifactSnapshot)),
    set: vi.fn((_ref: unknown, value: Record<string, unknown>) => {
      Object.assign(data, value);
    }),
  };
  const db = {
    collection: vi.fn(() => jobsCollection),
    runTransaction: vi.fn(async (callback: (tx: typeof transaction) => unknown) => callback(transaction)),
  };
  return { data, jobData, artifactSnapshot, jobSnapshot, artifactRef, jobRef, transaction, db };
});

vi.mock("@/lib/firebase-admin", () => ({
  getFirebaseDb: () => firebaseMocks.db,
}));

import {
  readGenerationJobArtifact,
  writeGenerationJobArtifact,
} from "./job-store";

describe("generation artifact expiry", () => {
  beforeEach(() => {
    for (const key of Object.keys(firebaseMocks.data)) delete firebaseMocks.data[key];
    firebaseMocks.artifactSnapshot.exists = false;
    firebaseMocks.jobSnapshot.exists = true;
    firebaseMocks.jobData.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    firebaseMocks.jobData.status = "pending";
    firebaseMocks.jobData.pipelineVersion = "staged-v1";
    vi.clearAllMocks();
  });

  it("writes an expiresAt value so Firestore collection-group TTL can remove artifacts", async () => {
    await writeGenerationJobArtifact("job-1", { kind: "input" }, { subject: "Toán" });

    expect(firebaseMocks.transaction.set).toHaveBeenCalledWith(
      firebaseMocks.artifactRef,
      expect.objectContaining({
        kind: "input",
        expiresAt: expect.any(Date),
      }),
    );
    const written = firebaseMocks.transaction.set.mock.calls[0][1];
    expect((written.expiresAt as Date).getTime()).toBeLessThanOrEqual(
      (firebaseMocks.jobData.expiresAt as Date).getTime(),
    );
  });

  it("returns the persisted artifact expiry", async () => {
    const expiresAt = new Date("2026-08-22T00:00:00.000Z");
    Object.assign(firebaseMocks.data, {
      jobId: "job-1",
      kind: "input",
      payload: { subject: "Toán" },
      payloadBytes: 20,
      createdAt: new Date("2026-08-15T00:00:00.000Z"),
      updatedAt: new Date("2026-08-15T00:00:00.000Z"),
      expiresAt,
    });
    firebaseMocks.artifactSnapshot.exists = true;

    const artifact = await readGenerationJobArtifact("job-1", { kind: "input" });

    expect(artifact?.expiresAt).toEqual(expiresAt);
  });
});
