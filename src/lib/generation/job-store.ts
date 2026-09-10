import "server-only";
import { getFirebaseDb } from "@/lib/firebase-admin";
import { MAX_GENERATION_SECURITY_CALLS, normalizeSecurityGenerationCalls } from "@shared/security-contract";
import {
  GENERATION_JOB_SCHEMA_VERSION,
  STAGED_GENERATION_PIPELINE_VERSION,
  STAGED_V1_PIPELINE_VERSION,
  STAGED_V2_PIPELINE_VERSION,
  assertGenerationArtifactSize,
  generationArtifactDocumentId,
  generationArtifactSequence,
  initialGenerationJobProgress,
  summarizeGenerationJobInput,
  type GenerationArtifactKey,
  type GenerationJob,
  type GenerationJobArtifact,
  type GenerationJobCreateInput,
  type GenerationJobError,
  type GenerationJobLease,
  type GenerationJobProgress,
  type GenerationJobQuotaReservation,
  type GenerationJobStageCursor,
  type GenerationJobStage,
  type GenerationJobStatus,
  type GenerationJobTelemetryEntry,
} from "@/lib/generation/job-types";

export const GENERATION_JOBS_COLLECTION = "generationJobs";
export const GENERATION_JOB_ARTIFACTS_COLLECTION = "artifacts";

const DEFAULT_GENERATION_JOB_TTL_HOURS = 168;

export type GenerationJobPatch = Partial<Pick<
  GenerationJob,
  "status" | "currentStage" | "progress" | "stageCursor" | "attempt" | "unitAttempts" | "inputFingerprint" | "quotaReservationId"
  | "quotaReservation" | "telemetry" | "lease" | "lessonId" | "error" | "expiresAt"
>>;

export type GenerationJobCheckpoint = {
  expectedStage: GenerationJobStage;
  expectedPosition: number;
  artifacts?: Array<{ key: GenerationArtifactKey; payload: unknown }>;
  patch: GenerationJobPatch;
};

export type GenerationCheckpointLease = {
  job: GenerationJob;
  epoch: number;
  lease: GenerationJobLease;
};

export class GenerationJobConflictError extends Error {
  code: string;

  constructor(message: string, code = "GENERATION_JOB_CONFLICT") {
    super(message);
    this.name = "GENERATION_JOB_CONFLICT";
    this.code = code;
  }
}

export function generationJobTtlMs() {
  const configuredHours = Number(process.env.GENERATION_JOB_TTL_HOURS || DEFAULT_GENERATION_JOB_TTL_HOURS);
  const hours = Number.isFinite(configuredHours) && configuredHours >= 1
    ? Math.floor(configuredHours)
    : DEFAULT_GENERATION_JOB_TTL_HOURS;
  return hours * 60 * 60 * 1000;
}

function assertSafeDocumentId(value: string, label: string) {
  const trimmed = value.trim();
  if (!trimmed || trimmed.includes("/") || trimmed.length > 200) {
    throw new Error(`${label} không hợp lệ.`);
  }
  return trimmed;
}

function asDate(value: unknown, fallback = new Date(0)) {
  if (value instanceof Date) return value;
  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    return value.toDate();
  }
  return fallback;
}

function stripUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => item === undefined ? null : stripUndefinedDeep(item)) as T;
  }
  if (value instanceof Date) return value;
  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    return value;
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).flatMap(([key, item]) => (
        item === undefined ? [] : [[key, stripUndefinedDeep(item)]]
      )),
    ) as T;
  }
  return value;
}

function normalizeJobTelemetry(value: unknown): NonNullable<GenerationJob["telemetry"]> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { entries: {} };
  const rawEntries = (value as { entries?: unknown }).entries;
  if (!rawEntries || typeof rawEntries !== "object" || Array.isArray(rawEntries)) return { entries: {} };
  const entries: Record<string, GenerationJobTelemetryEntry> = {};
  let remaining = MAX_GENERATION_SECURITY_CALLS;
  for (const [key, rawValue] of Object.entries(rawEntries).slice(-80)) {
    if (remaining <= 0 || !rawValue || typeof rawValue !== "object" || Array.isArray(rawValue)) break;
    const raw = rawValue as Record<string, unknown>;
    const calls = normalizeSecurityGenerationCalls(raw.calls).slice(0, remaining);
    remaining -= calls.length;
    entries[key] = {
      executionKey: String(raw.executionKey || key).slice(0, 240),
      stage: String(raw.stage || "initialize") as GenerationJobStage,
      attempt: Math.max(0, Number(raw.attempt || 0)),
      recordedAt: asDate(raw.recordedAt),
      calls,
    };
  }
  return { entries };
}

function generationSchemaVersion(value: unknown): typeof GENERATION_JOB_SCHEMA_VERSION {
  if (value == null || value === GENERATION_JOB_SCHEMA_VERSION) return GENERATION_JOB_SCHEMA_VERSION;
  throw new GenerationJobConflictError("Phiên bản dữ liệu tạo giáo án chưa được hỗ trợ.", "GENERATION_SCHEMA_UNSUPPORTED");
}

function generationPipelineVersion(value: unknown): GenerationJob["pipelineVersion"] {
  if (value == null || value === STAGED_V1_PIPELINE_VERSION) return STAGED_V1_PIPELINE_VERSION;
  if (value === STAGED_V2_PIPELINE_VERSION) return STAGED_V2_PIPELINE_VERSION;
  throw new GenerationJobConflictError("Phiên bản quy trình tạo giáo án chưa được hỗ trợ.", "GENERATION_PIPELINE_UNSUPPORTED");
}

function normalizeLeaseEpoch(value: unknown): number | undefined {
  if (value == null) return undefined;
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) return value;
  throw new GenerationJobConflictError("Mã khóa tạo giáo án không hợp lệ.", "GENERATION_LEASE_EPOCH_INVALID");
}

function normalizeUnitAttempts(value: unknown): Record<string, number> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return Object.fromEntries(Object.entries(value).filter(([, attempt]) => (
    typeof attempt === "number" && Number.isSafeInteger(attempt) && attempt >= 0
  ))) as Record<string, number>;
}

function normalizeJob(id: string, data: Record<string, unknown>): GenerationJob {
  const inputSummary = data.inputSummary as GenerationJob["inputSummary"];
  const progress = data.progress as GenerationJobProgress;
  const rawStageCursor = data.stageCursor as Partial<GenerationJobStageCursor> | null | undefined;
  const rawReservation = data.quotaReservation as Partial<GenerationJobQuotaReservation> | null | undefined;
  const rawLease = data.lease as { owner?: unknown; expiresAt?: unknown } | null | undefined;
  const quotaReservation = rawReservation?.operationId ? {
    operationId: String(rawReservation.operationId),
    uid: String(rawReservation.uid || data.uid || ""),
    plan: rawReservation.plan as GenerationJobQuotaReservation["plan"],
    kind: "generate" as const,
    source: rawReservation.source as GenerationJobQuotaReservation["source"],
    amount: Math.max(0, Number(rawReservation.amount || 0)),
  } : null;
  const leaseExpiresAt = asDate(rawLease?.expiresAt);
  const lease = rawLease?.owner && leaseExpiresAt.getTime() > 0 ? {
    owner: String(rawLease.owner),
    expiresAt: leaseExpiresAt,
  } satisfies GenerationJobLease : null;
  return {
    id,
    schemaVersion: generationSchemaVersion(data.schemaVersion),
    pipelineVersion: generationPipelineVersion(data.pipelineVersion),
    uid: String(data.uid || ""),
    status: data.status as GenerationJobStatus,
    currentStage: data.currentStage as GenerationJobStage,
    progress,
    stageCursor: {
      position: Math.max(0, Number(rawStageCursor?.position || 0)),
      total: Math.max(0, Number(rawStageCursor?.total || 0)),
    },
    attempt: Math.max(0, Number(data.attempt || 0)),
    unitAttempts: normalizeUnitAttempts(data.unitAttempts),
    inputSummary,
    inputFingerprint: String(data.inputFingerprint || ""),
    quotaReservationId: data.quotaReservationId
      ? String(data.quotaReservationId)
      : quotaReservation?.operationId || null,
    quotaReservation,
    telemetry: normalizeJobTelemetry(data.telemetry),
    lease,
    leaseEpoch: normalizeLeaseEpoch(data.leaseEpoch),
    lessonId: data.lessonId ? String(data.lessonId) : null,
    error: (data.error || null) as GenerationJobError | null,
    createdAt: asDate(data.createdAt),
    updatedAt: asDate(data.updatedAt),
    expiresAt: asDate(data.expiresAt),
  };
}

function jobRef(jobId: string) {
  return getFirebaseDb().collection(GENERATION_JOBS_COLLECTION).doc(assertSafeDocumentId(jobId, "Generation job ID"));
}

function artifactRef(jobId: string, key: GenerationArtifactKey) {
  return jobRef(jobId)
    .collection(GENERATION_JOB_ARTIFACTS_COLLECTION)
    .doc(generationArtifactDocumentId(key));
}

function newGenerationJob(input: GenerationJobCreateInput, id: string, now: Date): GenerationJob {
  const pipelineVersion = generationPipelineVersion(input.pipelineVersion ?? STAGED_GENERATION_PIPELINE_VERSION);
  const inputSummary = summarizeGenerationJobInput(input.input);
  return {
    id,
    schemaVersion: GENERATION_JOB_SCHEMA_VERSION,
    pipelineVersion,
    uid: input.uid,
    status: "pending",
    currentStage: "initialize",
    progress: initialGenerationJobProgress(inputSummary.periods, pipelineVersion),
    stageCursor: { position: 0, total: inputSummary.assetCount },
    attempt: 0,
    unitAttempts: {},
    inputSummary,
    inputFingerprint: input.inputFingerprint || "",
    quotaReservationId: input.quotaReservation?.operationId || null,
    quotaReservation: input.quotaReservation || null,
    telemetry: { entries: {} },
    lease: null,
    leaseEpoch: 0,
    lessonId: null,
    error: null,
    createdAt: now,
    updatedAt: now,
    expiresAt: input.expiresAt || new Date(now.getTime() + generationJobTtlMs()),
  };
}

export async function createGenerationJob(input: GenerationJobCreateInput) {
  const result = await createGenerationJobIfAbsent(input);
  return result.job;
}

export async function createGenerationJobIfAbsent(input: GenerationJobCreateInput) {
  const now = new Date();
  const collection = getFirebaseDb().collection(GENERATION_JOBS_COLLECTION);
  const ref = input.id
    ? collection.doc(assertSafeDocumentId(input.id, "Generation job ID"))
    : collection.doc();
  const job = newGenerationJob(input, ref.id, now);
  return getFirebaseDb().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (snapshot.exists) {
      return {
        job: normalizeJob(snapshot.id, snapshot.data() as Record<string, unknown>),
        created: false,
      };
    }
    const { id: _id, ...persistedJob } = job;
    transaction.create(ref, stripUndefinedDeep(persistedJob));
    return { job, created: true };
  });
}

export async function getGenerationJob(jobId: string) {
  const snapshot = await jobRef(jobId).get();
  if (!snapshot.exists) return null;
  return normalizeJob(snapshot.id, snapshot.data() as Record<string, unknown>);
}

export async function getGenerationJobForUser(jobId: string, uid: string) {
  const job = await getGenerationJob(jobId);
  return job?.uid === uid ? job : null;
}

export async function listExpiredGenerationJobs(limit = 50) {
  const safeLimit = Math.min(200, Math.max(1, Math.floor(Number(limit) || 50)));
  const snapshot = await getFirebaseDb()
    .collection(GENERATION_JOBS_COLLECTION)
    .where("expiresAt", "<=", new Date())
    .limit(safeLimit)
    .get();
  return snapshot.docs.map((doc) => normalizeJob(
    doc.id,
    doc.data() as Record<string, unknown>,
  ));
}

export async function deleteGenerationJobTree(jobId: string) {
  await getFirebaseDb().recursiveDelete(jobRef(jobId));
}

export async function updateGenerationJob(jobId: string, patch: GenerationJobPatch) {
  await jobRef(jobId).set(stripUndefinedDeep({ ...patch, updatedAt: new Date() }), { merge: true });
}

export async function cancelGenerationJobForUser(jobId: string, uid: string) {
  const ref = jobRef(jobId);
  return getFirebaseDb().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists || snapshot.get("uid") !== uid) return null;
    const job = normalizeJob(snapshot.id, snapshot.data() as Record<string, unknown>);
    if (job.status === "completed") {
      throw new GenerationJobConflictError("Giáo án đã hoàn thành nên không thể hủy.", "GENERATION_JOB_COMPLETED");
    }
    if (job.status === "cancelled") return { job, changed: false };

    const now = new Date();
    const nextJob: GenerationJob = {
      ...job,
      status: "cancelled",
      lease: null,
      error: {
        code: "CANCELLED_BY_USER",
        message: "Yêu cầu tạo giáo án đã được người dùng hủy.",
        stage: job.currentStage,
        retryable: false,
      },
      progress: { ...job.progress, message: "Đã hủy yêu cầu tạo giáo án." },
      updatedAt: now,
    };
    transaction.set(ref, stripUndefinedDeep({
      status: nextJob.status,
      lease: null,
      error: nextJob.error,
      progress: nextJob.progress,
      updatedAt: now,
    }), { merge: true });
    return { job: nextJob, changed: true };
  });
}

export async function expireGenerationJobForUser(jobId: string, uid: string) {
  const ref = jobRef(jobId);
  return getFirebaseDb().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists || snapshot.get("uid") !== uid) return null;
    const job = normalizeJob(snapshot.id, snapshot.data() as Record<string, unknown>);
    if (["completed", "failed", "cancelled"].includes(job.status) || job.expiresAt.getTime() > Date.now()) {
      return { job, changed: false };
    }

    const now = new Date();
    const nextJob: GenerationJob = {
      ...job,
      status: "failed",
      lease: null,
      error: {
        code: "GENERATION_JOB_EXPIRED",
        message: "Yêu cầu tạo giáo án đã hết hạn trước khi hoàn tất.",
        stage: job.currentStage,
        retryable: false,
      },
      progress: {
        ...job.progress,
        message: "Yêu cầu tạo giáo án đã hết hạn; lượt sử dụng sẽ được hoàn lại.",
      },
      updatedAt: now,
    };
    transaction.set(ref, stripUndefinedDeep({
      status: nextJob.status,
      lease: null,
      error: nextJob.error,
      progress: nextJob.progress,
      updatedAt: now,
    }), { merge: true });
    return { job: nextJob, changed: true };
  });
}

export async function acquireGenerationCheckpointLease(
  jobId: string,
  uid: string,
  owner: string,
  ttlMs = 90_000,
): Promise<GenerationCheckpointLease | null> {
  const ref = jobRef(jobId);
  const safeOwner = assertSafeDocumentId(owner, "Generation lease owner");
  const safeTtlMs = Number.isFinite(ttlMs) ? Math.min(300_000, Math.max(10_000, Math.floor(ttlMs))) : 90_000;
  return getFirebaseDb().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists || snapshot.get("uid") !== uid) return null;
    const job = normalizeJob(snapshot.id, snapshot.data() as Record<string, unknown>);
    const now = new Date();
    if (["completed", "failed", "cancelled"].includes(job.status)) return null;
    if (job.expiresAt.getTime() <= now.getTime()) return null;
    if (job.lease && job.lease.owner !== safeOwner && job.lease.expiresAt.getTime() > now.getTime()) return null;

    const currentEpoch = typeof job.leaseEpoch === "number" ? job.leaseEpoch : 0;
    if (currentEpoch >= Number.MAX_SAFE_INTEGER) {
      throw new GenerationJobConflictError("Mã khóa tạo giáo án đã chạm ngưỡng tối đa.", "GENERATION_LEASE_EPOCH_OVERFLOW");
    }
    const nextEpoch = currentEpoch + 1;
    const lease: GenerationJobLease = { owner: safeOwner, expiresAt: new Date(now.getTime() + safeTtlMs) };
    const latestJob: GenerationJob = {
      ...job,
      lease,
      leaseEpoch: nextEpoch,
      updatedAt: now,
    };
    transaction.set(ref, stripUndefinedDeep({
      lease,
      leaseEpoch: nextEpoch,
      updatedAt: now,
    }), { merge: true });
    return {
      job: latestJob,
      epoch: nextEpoch,
      lease,
    };
  });
}

export async function acquireGenerationJobLease(
  jobId: string,
  uid: string,
  owner: string,
  ttlMs = 90_000,
) {
  const ref = jobRef(jobId);
  const safeOwner = assertSafeDocumentId(owner, "Generation lease owner");
  const safeTtlMs = Number.isFinite(ttlMs) ? Math.min(300_000, Math.max(10_000, Math.floor(ttlMs))) : 90_000;
  return getFirebaseDb().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists || snapshot.get("uid") !== uid) return null;
    const job = normalizeJob(snapshot.id, snapshot.data() as Record<string, unknown>);
    const now = new Date();
    if (["completed", "failed", "cancelled"].includes(job.status)) return null;
    if (job.expiresAt.getTime() <= now.getTime()) return null;
    if (job.lease && job.lease.owner !== safeOwner && job.lease.expiresAt.getTime() > now.getTime()) return null;

    const lease: GenerationJobLease = { owner: safeOwner, expiresAt: new Date(now.getTime() + safeTtlMs) };
    transaction.set(ref, { lease, updatedAt: now }, { merge: true });
    return lease;
  });
}

export async function releaseGenerationJobLease(jobId: string, uid: string, owner: string) {
  const ref = jobRef(jobId);
  const safeOwner = assertSafeDocumentId(owner, "Generation lease owner");
  return getFirebaseDb().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists || snapshot.get("uid") !== uid) return false;
    const lease = snapshot.get("lease") as { owner?: unknown } | null | undefined;
    if (!lease || String(lease.owner || "") !== safeOwner) return false;
    transaction.set(ref, { lease: null, updatedAt: new Date() }, { merge: true });
    return true;
  });
}

export async function updateLeasedGenerationJob(
  jobId: string,
  uid: string,
  owner: string,
  patch: GenerationJobPatch,
) {
  const ref = jobRef(jobId);
  const safeOwner = assertSafeDocumentId(owner, "Generation lease owner");
  return getFirebaseDb().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists || snapshot.get("uid") !== uid) return false;
    const job = normalizeJob(snapshot.id, snapshot.data() as Record<string, unknown>);
    const now = new Date();
    if (["completed", "failed", "cancelled"].includes(job.status)) return false;
    if (job.expiresAt.getTime() <= now.getTime()) return false;
    if (!job.lease || job.lease.owner !== safeOwner || job.lease.expiresAt.getTime() <= now.getTime()) return false;
    transaction.set(ref, stripUndefinedDeep({ ...patch, updatedAt: now }), { merge: true });
    return true;
  });
}

export async function commitGenerationJobCheckpoint(
  jobId: string,
  uid: string,
  owner: string,
  epoch: number,
  checkpoint: GenerationJobCheckpoint,
): Promise<boolean> {
  const ref = jobRef(jobId);
  const safeOwner = assertSafeDocumentId(owner, "Generation lease owner");
  if (typeof epoch !== "number" || !Number.isSafeInteger(epoch) || epoch <= 0) {
    return false;
  }

  // Early validation of size and sequence before opening transaction
  const preparedArtifacts = (checkpoint.artifacts || []).map((artifact) => {
    const payloadBytes = assertGenerationArtifactSize(artifact.payload);
    const sequence = generationArtifactSequence(artifact.key);
    return {
      ref: artifactRef(jobId, artifact.key),
      kind: artifact.key.kind,
      sequence,
      payload: artifact.payload,
      payloadBytes,
    };
  });

  return getFirebaseDb().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists || snapshot.get("uid") !== uid) return false;
    const job = normalizeJob(snapshot.id, snapshot.data() as Record<string, unknown>);
    const now = new Date();

    if (["completed", "failed", "cancelled"].includes(job.status)) return false;
    if (job.expiresAt.getTime() <= now.getTime()) return false;
    if (!job.lease || job.lease.owner !== safeOwner || job.lease.expiresAt.getTime() <= now.getTime()) return false;
    if (job.leaseEpoch !== epoch) return false;
    if (job.currentStage !== checkpoint.expectedStage || job.stageCursor.position !== checkpoint.expectedPosition) {
      return false;
    }

    // Read existing artifact snapshots concurrently to preserve creation timestamps
    const artifactSnapshots = await Promise.all(preparedArtifacts.map((prepared) => transaction.get(prepared.ref)));

    // Re-check deadlines after async artifact reads to guarantee stale workers whose lease
    // or job expired during network/read delay never perform writes
    const postReadNow = new Date();
    if (job.expiresAt.getTime() <= postReadNow.getTime()) return false;
    if (job.lease.expiresAt.getTime() <= postReadNow.getTime()) return false;

    // Artifact expiry must NEVER outlive the parent job
    const artifactExpiresAt = new Date(Math.min(
      job.expiresAt.getTime(),
      postReadNow.getTime() + generationJobTtlMs(),
    ));

    for (let index = 0; index < preparedArtifacts.length; index += 1) {
      const prepared = preparedArtifacts[index];
      const existingArtifactSnapshot = artifactSnapshots[index];
      if (existingArtifactSnapshot.exists) {
        generationSchemaVersion(existingArtifactSnapshot.get("schemaVersion"));
      }
      transaction.set(prepared.ref, stripUndefinedDeep({
        schemaVersion: GENERATION_JOB_SCHEMA_VERSION,
        jobId,
        kind: prepared.kind,
        sequence: prepared.sequence,
        payload: prepared.payload,
        payloadBytes: prepared.payloadBytes,
        createdAt: existingArtifactSnapshot.exists ? existingArtifactSnapshot.get("createdAt") : postReadNow,
        updatedAt: postReadNow,
        expiresAt: artifactExpiresAt,
      }));
    }

    transaction.set(ref, stripUndefinedDeep({
      ...checkpoint.patch,
      updatedAt: postReadNow,
    }), { merge: true });

    return true;
  });
}

export async function writeGenerationJobArtifact<T>(jobId: string, key: GenerationArtifactKey, payload: T) {
  const payloadBytes = assertGenerationArtifactSize(payload);
  const sequence = generationArtifactSequence(key);
  const jRef = jobRef(jobId);
  const aRef = artifactRef(jobId, key);

  await getFirebaseDb().runTransaction(async (transaction) => {
    const parentJobSnapshot = await transaction.get(jRef);
    if (!parentJobSnapshot.exists) {
      throw new GenerationJobConflictError(
        "Không thể lưu trữ artifact khi yêu cầu tạo giáo án không tồn tại.",
        "GENERATION_JOB_NOT_FOUND",
      );
    }
    const parentJob = normalizeJob(parentJobSnapshot.id, parentJobSnapshot.data() as Record<string, unknown>);
    const now = new Date();

    if (["completed", "failed", "cancelled"].includes(parentJob.status)) {
      throw new GenerationJobConflictError(
        "Yêu cầu tạo giáo án đã ở trạng thái kết thúc.",
        "GENERATION_JOB_TERMINAL",
      );
    }
    if (parentJob.expiresAt.getTime() <= now.getTime()) {
      throw new GenerationJobConflictError(
        "Yêu cầu tạo giáo án đã hết hạn.",
        "GENERATION_JOB_EXPIRED",
      );
    }
    if (parentJob.pipelineVersion === STAGED_V2_PIPELINE_VERSION && key.kind !== "input") {
      throw new GenerationJobConflictError(
        "Quy trình staged-v2 yêu cầu lưu artifact qua commitGenerationJobCheckpoint.",
        "GENERATION_CHECKPOINT_REQUIRED",
      );
    }

    const artifactSnapshot = await transaction.get(aRef);
    if (artifactSnapshot.exists) {
      generationSchemaVersion(artifactSnapshot.get("schemaVersion"));
    }

    const postReadNow = new Date();
    if (parentJob.expiresAt.getTime() <= postReadNow.getTime()) {
      throw new GenerationJobConflictError(
        "Yêu cầu tạo giáo án đã hết hạn trong quá trình lưu trữ artifact.",
        "GENERATION_JOB_EXPIRED",
      );
    }

    // Artifact TTL is bounded by parent job TTL
    const artifactExpiresAt = new Date(Math.min(
      parentJob.expiresAt.getTime(),
      postReadNow.getTime() + generationJobTtlMs(),
    ));

    transaction.set(aRef, stripUndefinedDeep({
      schemaVersion: GENERATION_JOB_SCHEMA_VERSION,
      jobId,
      kind: key.kind,
      sequence,
      payload,
      payloadBytes,
      createdAt: artifactSnapshot.exists ? artifactSnapshot.get("createdAt") : postReadNow,
      updatedAt: postReadNow,
      expiresAt: artifactExpiresAt,
    }));
  });

  return aRef.id;
}

export async function readGenerationJobArtifact<T>(jobId: string, key: GenerationArtifactKey) {
  const snapshot = await artifactRef(jobId, key).get();
  if (!snapshot.exists) return null;
  const data = snapshot.data() as Record<string, unknown>;
  const schemaVersion = generationSchemaVersion(data.schemaVersion);
  return {
    id: snapshot.id,
    jobId: String(data.jobId || jobId),
    schemaVersion,
    kind: key.kind,
    sequence: data.sequence == null ? null : Math.max(1, Number(data.sequence)),
    payload: data.payload as T,
    payloadBytes: Math.max(0, Number(data.payloadBytes || 0)),
    createdAt: asDate(data.createdAt),
    updatedAt: asDate(data.updatedAt),
    expiresAt: asDate(data.expiresAt),
  } satisfies GenerationJobArtifact<T>;
}
