import type { ClientGenerationJob } from "@/lib/generation/client-orchestrator";

export const ACTIVE_STAGED_JOB_STORAGE_KEY = "eduplan-ai.active-staged-generation.v1";

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export type StoredStagedGeneration = {
  uid: string;
  job: ClientGenerationJob;
  savedAt: string;
};

function browserStorage(): StorageLike | null {
  return typeof window === "undefined" ? null : window.localStorage;
}

export function saveActiveStagedGeneration(
  uid: string,
  job: ClientGenerationJob,
  storage: StorageLike | null = browserStorage(),
) {
  if (!storage) return;
  const value: StoredStagedGeneration = {
    uid,
    job,
    savedAt: new Date().toISOString(),
  };
  storage.setItem(ACTIVE_STAGED_JOB_STORAGE_KEY, JSON.stringify(value));
}

export function readActiveStagedGeneration(
  uid: string,
  storage: StorageLike | null = browserStorage(),
) {
  if (!storage) return null;
  const raw = storage.getItem(ACTIVE_STAGED_JOB_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredStagedGeneration>;
    if (parsed.uid !== uid || !parsed.job?.id || typeof parsed.job.id !== "string") {
      storage.removeItem(ACTIVE_STAGED_JOB_STORAGE_KEY);
      return null;
    }
    return parsed as StoredStagedGeneration;
  } catch {
    storage.removeItem(ACTIVE_STAGED_JOB_STORAGE_KEY);
    return null;
  }
}

export function clearActiveStagedGeneration(
  uid: string,
  jobId?: string,
  storage: StorageLike | null = browserStorage(),
) {
  if (!storage) return;
  const current = readActiveStagedGeneration(uid, storage);
  if (!current) return;
  if (jobId && current.job.id !== jobId) return;
  storage.removeItem(ACTIVE_STAGED_JOB_STORAGE_KEY);
}
