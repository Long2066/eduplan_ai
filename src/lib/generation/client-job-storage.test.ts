import { describe, expect, it, vi } from "vitest";
import type { ClientGenerationJob } from "./client-orchestrator";
import {
  ACTIVE_STAGED_JOB_STORAGE_KEY,
  clearActiveStagedGeneration,
  readActiveStagedGeneration,
  saveActiveStagedGeneration,
} from "./client-job-storage";

function job(): ClientGenerationJob {
  return {
    id: "job-1",
    schemaVersion: 1,
    pipelineVersion: "staged-v1",
    status: "waiting_next_step",
    currentStage: "ocr",
    progress: {
      percent: 10,
      message: "Đang OCR",
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
      assetCount: 0,
    },
    lessonId: null,
    error: null,
    createdAt: "2026-08-15T00:00:00.000Z",
    updatedAt: "2026-08-15T00:00:00.000Z",
    expiresAt: "2026-08-22T00:00:00.000Z",
  };
}

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: vi.fn((key: string) => values.get(key) || null),
    setItem: vi.fn((key: string, value: string) => values.set(key, value)),
    removeItem: vi.fn((key: string) => values.delete(key)),
  };
}

describe("active staged generation storage", () => {
  it("saves and restores the latest job snapshot for the same user", () => {
    const storage = memoryStorage();
    saveActiveStagedGeneration("user-1", job(), storage);

    expect(readActiveStagedGeneration("user-1", storage)?.job.id).toBe("job-1");
    expect(storage.setItem).toHaveBeenCalledWith(
      ACTIVE_STAGED_JOB_STORAGE_KEY,
      expect.stringContaining('"job-1"'),
    );
  });

  it("clears stale data belonging to another user", () => {
    const storage = memoryStorage();
    saveActiveStagedGeneration("user-1", job(), storage);

    expect(readActiveStagedGeneration("user-2", storage)).toBeNull();
    expect(storage.removeItem).toHaveBeenCalledWith(ACTIVE_STAGED_JOB_STORAGE_KEY);
  });

  it("only clears the matching active job", () => {
    const storage = memoryStorage();
    saveActiveStagedGeneration("user-1", job(), storage);

    clearActiveStagedGeneration("user-1", "job-2", storage);
    expect(readActiveStagedGeneration("user-1", storage)).not.toBeNull();
    clearActiveStagedGeneration("user-1", "job-1", storage);
    expect(readActiveStagedGeneration("user-1", storage)).toBeNull();
  });
});
