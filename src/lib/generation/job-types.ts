import type { LessonInput, UploadedAsset } from "@/types/lesson";
import type { SubscriptionPlan } from "@/lib/model-strategy";
import type { SecurityGenerationCallMetric } from "@shared/security-contract";

export const GENERATION_JOB_SCHEMA_VERSION = 1;
export const STAGED_GENERATION_PIPELINE_VERSION = "staged-v1";
export const MAX_GENERATION_ARTIFACT_BYTES = 900 * 1024;

export const GENERATION_JOB_STATUSES = [
  "pending",
  "running",
  "waiting_next_step",
  "completed",
  "failed",
  "cancelled",
] as const;

export const GENERATION_JOB_STAGES = [
  "initialize",
  "ocr",
  "source-preparation",
  "blueprint",
  "period-generation",
  "assembly",
  "subject-validation",
  "repair",
  "final-validation",
  "persistence",
  "quota-settlement",
  "completed",
] as const;

export const GENERATION_ARTIFACT_KINDS = [
  "input",
  "ocr-page",
  "ocr",
  "source-context",
  "blueprint",
  "period",
  "assembly",
  "validation",
  "repair",
  "final",
] as const;

export type GenerationJobStatus = (typeof GENERATION_JOB_STATUSES)[number];
export type GenerationJobStage = (typeof GENERATION_JOB_STAGES)[number];
export type GenerationArtifactKind = (typeof GENERATION_ARTIFACT_KINDS)[number];

export type GenerationJobProgress = {
  percent: number;
  message: string;
  completedUnits: number;
  totalUnits: number;
  currentPeriod: number | null;
  totalPeriods: number;
};

export type GenerationJobStageCursor = {
  position: number;
  total: number;
};

export type GenerationJobError = {
  code: string;
  message: string;
  stage: GenerationJobStage;
  retryable: boolean;
};

export type GenerationJobInputSummary = {
  subject: string;
  grade: string;
  lessonTitle: string;
  periods: number;
  assetCount: number;
};

export type GenerationJobQuotaReservation = {
  operationId: string;
  uid: string;
  plan: SubscriptionPlan;
  kind: "generate";
  source: "free" | "trial" | "paid";
  amount: number;
};

export type GenerationJobLease = {
  owner: string;
  expiresAt: Date;
};

export type GenerationJobTelemetryEntry = {
  executionKey: string;
  stage: GenerationJobStage;
  attempt: number;
  recordedAt: Date;
  calls: SecurityGenerationCallMetric[];
};

export type GenerationJobTelemetry = {
  entries: Record<string, GenerationJobTelemetryEntry>;
};

export type GenerationJob = {
  id: string;
  schemaVersion: typeof GENERATION_JOB_SCHEMA_VERSION;
  pipelineVersion: typeof STAGED_GENERATION_PIPELINE_VERSION;
  uid: string;
  status: GenerationJobStatus;
  currentStage: GenerationJobStage;
  progress: GenerationJobProgress;
  stageCursor: GenerationJobStageCursor;
  attempt: number;
  inputSummary: GenerationJobInputSummary;
  inputFingerprint: string;
  quotaReservationId: string | null;
  quotaReservation: GenerationJobQuotaReservation | null;
  telemetry?: GenerationJobTelemetry;
  lease: GenerationJobLease | null;
  lessonId: string | null;
  error: GenerationJobError | null;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
};

export type GenerationJobCreateInput = {
  id?: string;
  uid: string;
  input: LessonInput;
  inputFingerprint?: string;
  quotaReservation?: GenerationJobQuotaReservation | null;
  expiresAt?: Date;
};

export type GenerationJobAssetMetadata = Omit<UploadedAsset, "dataUrl" | "previewUrl">;

export type PersistedGenerationInput = Omit<LessonInput, "uploadedAssets"> & {
  uploadedAssets: GenerationJobAssetMetadata[];
};

export type GenerationArtifactKey = {
  kind: GenerationArtifactKind;
  sequence?: number;
};

export type GenerationJobArtifact<T = unknown> = {
  id: string;
  jobId: string;
  schemaVersion: typeof GENERATION_JOB_SCHEMA_VERSION;
  kind: GenerationArtifactKind;
  sequence: number | null;
  payload: T;
  payloadBytes: number;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
};

function positiveInteger(value: unknown, fallback = 1) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue >= 1
    ? Math.floor(numericValue)
    : fallback;
}

export function summarizeGenerationJobInput(input: LessonInput): GenerationJobInputSummary {
  return {
    subject: input.subject.trim(),
    grade: input.grade.trim(),
    lessonTitle: input.lessonTitle.trim(),
    periods: positiveInteger(input.periods),
    assetCount: Array.isArray(input.uploadedAssets) ? input.uploadedAssets.length : 0,
  };
}

export function initialGenerationJobProgress(periods: number): GenerationJobProgress {
  const totalPeriods = positiveInteger(periods);
  return {
    percent: 0,
    message: "Đang chuẩn bị yêu cầu tạo giáo án.",
    completedUnits: 0,
    totalUnits: Math.max(10, 9 + totalPeriods),
    currentPeriod: null,
    totalPeriods,
  };
}

export function generationArtifactSequence(key: GenerationArtifactKey) {
  return key.kind === "ocr-page" || key.kind === "period" || key.kind === "repair"
    ? positiveInteger(key.sequence)
    : null;
}

export function generationArtifactDocumentId(key: GenerationArtifactKey) {
  const sequence = generationArtifactSequence(key);
  if (sequence !== null) {
    return `${key.kind}-${String(sequence).padStart(4, "0")}`;
  }
  return key.kind;
}

export function generationArtifactPayloadBytes(payload: unknown) {
  const serialized = JSON.stringify(payload);
  if (serialized === undefined) throw new Error("Artifact tạo giáo án không thể tuần tự hóa thành JSON.");
  return new TextEncoder().encode(serialized).byteLength;
}

export function assertGenerationArtifactSize(payload: unknown) {
  const payloadBytes = generationArtifactPayloadBytes(payload);
  if (payloadBytes > MAX_GENERATION_ARTIFACT_BYTES) {
    throw new Error(`Artifact tạo giáo án vượt giới hạn an toàn ${MAX_GENERATION_ARTIFACT_BYTES} byte.`);
  }
  return payloadBytes;
}
