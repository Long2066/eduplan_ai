import { beforeEach, describe, expect, it, vi } from "vitest";

const firebaseMocks = vi.hoisted(() => {
  const data: Record<string, unknown> = {};
  const artifactSnapshot = {
    exists: false,
    id: "input",
    data: () => data,
    get: (field: string) => data[field],
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
  };
  const jobsCollection = {
    doc: vi.fn(() => jobRef),
  };
  const transaction = {
    get: vi.fn(async () => artifactSnapshot),
    set: vi.fn((_ref: unknown, value: Record<string, unknown>) => {
      Object.assign(data, value);
    }),
  };
  const db = {
    collection: vi.fn(() => jobsCollection),
    runTransaction: vi.fn(async (callback: (tx: typeof transaction) => unknown) => callback(transaction)),
  };
  return { data, artifactSnapshot, artifactRef, transaction, db };
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
