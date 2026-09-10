import {
  GENERATION_JOB_STAGES,
  GENERATION_JOB_STATUSES,
  type GenerationJobError,
  type GenerationJobProgress,
  type GenerationJobStage,
  type GenerationJobStageCursor,
  type GenerationJobStatus,
} from "@/lib/generation/job-types";
import { sortGenerationOcrAssets } from "@/lib/generation/ocr-asset-order";
import { createServerAuthSession } from "@/lib/auth-client";
import type { LessonInput, LessonPlan, UploadedAsset } from "@/types/lesson";

export type ClientGenerationProgress = Omit<GenerationJobProgress, "currentPhase"> & {
  currentPhase?: string | null;
};

export type ClientGenerationJob = {
  id: string;
  schemaVersion: number;
  pipelineVersion: string;
  status: GenerationJobStatus;
  currentStage: GenerationJobStage;
  progress: ClientGenerationProgress;
  stageCursor: GenerationJobStageCursor;
  attempt: number;
  unitAttempts?: Record<string, number>;
  inputSummary: {
    subject: string;
    grade: string;
    lessonTitle: string;
    periods: number;
    assetCount: number;
  };
  lessonId: string | null;
  error: GenerationJobError | null;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
};

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function nonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

export function isClientGenerationJob(value: unknown): value is ClientGenerationJob {
  if (!record(value)) return false;
  const { progress, stageCursor, inputSummary, error, unitAttempts } = value;
  return typeof value.id === "string" && value.id.trim().length > 0
    && nonNegativeInteger(value.schemaVersion) && value.schemaVersion > 0
    && typeof value.pipelineVersion === "string" && value.pipelineVersion.trim().length > 0
    && GENERATION_JOB_STATUSES.includes(value.status as GenerationJobStatus)
    && GENERATION_JOB_STAGES.includes(value.currentStage as GenerationJobStage)
    && record(stageCursor) && nonNegativeInteger(stageCursor.position) && nonNegativeInteger(stageCursor.total)
    && stageCursor.position <= stageCursor.total
    && nonNegativeInteger(value.attempt)
    && record(progress) && typeof progress.message === "string"
    && typeof progress.percent === "number" && Number.isFinite(progress.percent)
    && nonNegativeInteger(progress.completedUnits) && nonNegativeInteger(progress.totalUnits)
    && nonNegativeInteger(progress.totalPeriods)
    && (progress.currentPeriod === null || (nonNegativeInteger(progress.currentPeriod) && progress.currentPeriod > 0))
    && (progress.currentPhase == null || typeof progress.currentPhase === "string")
    && record(inputSummary)
    && [inputSummary.subject, inputSummary.grade, inputSummary.lessonTitle].every((item) => typeof item === "string")
    && nonNegativeInteger(inputSummary.periods) && inputSummary.periods > 0
    && nonNegativeInteger(inputSummary.assetCount)
    && (value.lessonId === null || (typeof value.lessonId === "string" && value.lessonId.length > 0))
    && (error === null || (record(error) && typeof error.code === "string"
      && typeof error.message === "string" && typeof error.retryable === "boolean"
      && GENERATION_JOB_STAGES.includes(error.stage as GenerationJobStage)))
    && (unitAttempts === undefined || (record(unitAttempts) && Object.values(unitAttempts).every(nonNegativeInteger)))
    && [value.createdAt, value.updatedAt, value.expiresAt].every((item) => typeof item === "string" && Number.isFinite(Date.parse(item)));
}

export type StagedGenerationResult = {
  job: ClientGenerationJob;
  lessonId: string;
  lesson: LessonPlan;
};

type Fetcher = typeof fetch;

type ClientRequestOptions = {
  authToken: string;
  fetcher?: Fetcher;
  signal?: AbortSignal;
};

type ContinueOptions = ClientRequestOptions & {
  job: ClientGenerationJob;
  ocrAssets?: UploadedAsset[];
  onJob?: (job: ClientGenerationJob) => void;
  maxAutomaticRetries?: number;
  retryDelayMs?: number;
};

type StartOptions = ClientRequestOptions & {
  payload: string;
  idempotencyKey: string;
  onJob?: (job: ClientGenerationJob) => void;
  maxAutomaticRetries?: number;
  retryDelayMs?: number;
};

type ResumeOptions = ClientRequestOptions & {
  jobId: string;
  ocrAssets?: UploadedAsset[];
  onJob?: (job: ClientGenerationJob) => void;
  maxAutomaticRetries?: number;
  retryDelayMs?: number;
};

export class StagedGenerationApiError extends Error {
  code: string;
  status: number;
  details?: unknown;
  quotaRefunded?: boolean;
  retryable?: boolean;

  constructor(
    message: string,
    code = "STAGED_GENERATION_REQUEST_FAILED",
    status = 500,
    details?: unknown,
    quotaRefunded?: boolean,
    retryable?: boolean,
  ) {
    super(message);
    this.name = "STAGED_GENERATION_API_ERROR";
    this.code = code;
    this.status = status;
    this.details = details;
    this.quotaRefunded = quotaRefunded;
    this.retryable = retryable;
  }
}

export class StagedGenerationTerminalError extends Error {
  job: ClientGenerationJob;

  constructor(job: ClientGenerationJob) {
    super(
      job.error?.message
      || (job.status === "cancelled"
        ? "Yêu cầu tạo giáo án đã được hủy."
        : "Yêu cầu tạo giáo án không thể hoàn tất."),
    );
    this.name = "STAGED_GENERATION_TERMINAL_ERROR";
    this.job = job;
  }
}

function authHeaders(authToken: string, extra: HeadersInit = {}) {
  return {
    ...extra,
    Authorization: "Bearer " + authToken,
  };
}

async function requestJson<T>(
  url: string,
  init: RequestInit,
  fetcher: Fetcher = fetch,
  allowSessionBootstrap = true,
): Promise<T> {
  let response: Response;
  try {
    init.signal?.throwIfAborted();
    response = await fetcher(url, init);
  } catch (error) {
    if (init.signal?.aborted) throw error;
    throw new StagedGenerationApiError(
      error instanceof Error ? error.message : "Không thể kết nối máy chủ.",
      "NETWORK_ERROR",
      0,
    );
  }

  const bearerToken = new Headers(init.headers).get("Authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (response.status === 401 && allowSessionBootstrap && bearerToken) {
    await createServerAuthSession({
      user: { getIdToken: async () => bearerToken },
      fetcher: (sessionUrl, sessionInit) => fetcher(sessionUrl, { ...sessionInit, signal: init.signal }),
    });
    return requestJson<T>(url, init, fetcher, false);
  }

  let result: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(await response.text());
    if (!record(parsed)) throw new Error("Expected an object");
    result = parsed;
  } catch (error) {
    if (init.signal?.aborted) throw error;
    throw new StagedGenerationApiError(
      response.status === 504
        ? "Máy chủ đã hết thời gian xử lý bước hiện tại."
        : "Máy chủ trả phản hồi không hợp lệ (HTTP " + response.status + ").",
      response.status === 504 ? "GENERATION_STEP_TIMEOUT" : "INVALID_SERVER_RESPONSE",
      response.status,
    );
  }

  if (!response.ok) {
    const errorDetails = result.details ?? result.errorDetails;
    const quotaRefunded = typeof result.quotaRefunded === "boolean" ? result.quotaRefunded : undefined;
    const retryable = typeof result.retryable === "boolean" ? result.retryable : undefined;
    throw new StagedGenerationApiError(
      typeof result.error === "string" ? result.error : "Yêu cầu thất bại (HTTP " + response.status + ").",
      typeof result.code === "string" ? result.code : "STAGED_GENERATION_REQUEST_FAILED",
      response.status,
      errorDetails,
      quotaRefunded,
      retryable,
    );
  }
  if (url.startsWith("/api/lesson/generation-jobs") && !isClientGenerationJob(result.job)) {
    throw new StagedGenerationApiError("Máy chủ trả tiến trình không hợp lệ. Điểm lưu hiện tại vẫn được giữ lại.", "INVALID_SERVER_RESPONSE", response.status);
  }
  return result as T;
}

export async function createStagedGenerationJobClient(options: StartOptions) {
  const result = await requestJson<{ job: ClientGenerationJob; created: boolean }>(
    "/api/lesson/generation-jobs",
    {
      method: "POST",
      headers: authHeaders(options.authToken, {
        "Content-Type": "application/json",
        "Idempotency-Key": options.idempotencyKey,
      }),
      body: options.payload,
      cache: "no-store",
      signal: options.signal,
    },
    options.fetcher,
  );
  return result;
}

export async function getStagedGenerationJobClient(
  jobId: string,
  options: ClientRequestOptions,
) {
  const result = await requestJson<{ job: ClientGenerationJob }>(
    "/api/lesson/generation-jobs/" + encodeURIComponent(jobId),
    {
      method: "GET",
      headers: authHeaders(options.authToken),
      cache: "no-store",
      signal: options.signal,
    },
    options.fetcher,
  );
  return result.job;
}

export async function advanceStagedGenerationJobClient(
  jobId: string,
  options: ClientRequestOptions & { ocrAsset?: UploadedAsset },
) {
  const hasOcrAsset = Boolean(options.ocrAsset);
  const result = await requestJson<{ job: ClientGenerationJob }>(
    "/api/lesson/generation-jobs/" + encodeURIComponent(jobId) + "/advance",
    {
      method: "POST",
      headers: authHeaders(options.authToken, hasOcrAsset ? { "Content-Type": "application/json" } : {}),
      ...(hasOcrAsset ? { body: JSON.stringify({ asset: options.ocrAsset }) } : {}),
      cache: "no-store",
      signal: options.signal,
    },
    options.fetcher,
  );
  return result.job;
}

export async function cancelStagedGenerationJobClient(
  jobId: string,
  options: ClientRequestOptions,
) {
  const result = await requestJson<{ job: ClientGenerationJob }>(
    "/api/lesson/generation-jobs/" + encodeURIComponent(jobId) + "/cancel",
    {
      method: "POST",
      headers: authHeaders(options.authToken),
      cache: "no-store",
      signal: options.signal,
    },
    options.fetcher,
  );
  return result.job;
}

export async function loadStagedGeneratedLessonClient(
  lessonId: string,
  options: ClientRequestOptions,
) {
  const result = await requestJson<{ lessonId: string; lesson: LessonPlan }>(
    "/api/lessons/" + encodeURIComponent(lessonId),
    {
      method: "GET",
      headers: authHeaders(options.authToken),
      cache: "no-store",
      signal: options.signal,
    },
    options.fetcher,
  );
  return result.lesson;
}

function terminalStatus(status: GenerationJobStatus) {
  return status === "completed" || status === "failed" || status === "cancelled";
}

function retryableRequestError(error: unknown) {
  if (!(error instanceof StagedGenerationApiError)) return false;
  if (typeof error.retryable === "boolean") return error.retryable;
  return error.status === 0
    || error.status >= 500
    || [
      "GENERATION_JOB_BUSY",
      "GENERATION_JOB_LEASE_LOST",
      "GENERATION_STEP_TIMEOUT",
      "GENERATION_STEP_FAILED",
    ].includes(error.code);
}

export function jobPositionKey(
  job: Pick<ClientGenerationJob, "currentStage" | "stageCursor">,
) {
  return `${job.currentStage}:${job.stageCursor.position}`;
}

function waitForRetry(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason || new DOMException("Aborted", "AbortError"));
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(signal.reason || new DOMException("Aborted", "AbortError"));
    }, { once: true });
  });
}

export function isJobBlockedByNonRetryableError(
  job: Pick<ClientGenerationJob, "currentStage" | "error">,
): boolean {
  if (!job.error || job.error.retryable !== false) return false;
  // If the job has reached quota settlement, allow settlement to finalize or refund
  // even if an earlier content stage generated a non-retryable error.
  if (job.currentStage === "quota-settlement") {
    return job.error.stage === "quota-settlement";
  }
  return true;
}

export async function continueStagedGeneration(
  options: ContinueOptions,
): Promise<StagedGenerationResult> {
  const maxAutomaticRetries = Math.max(0, options.maxAutomaticRetries ?? 3);
  const retryDelayMs = Math.max(0, options.retryDelayMs ?? 800);
  let job = options.job;
  let ocrAssets = sortGenerationOcrAssets(options.ocrAssets || []);
  let positionKey = jobPositionKey(job);
  let retriesAtPosition = 0;
  options.onJob?.(job);

  while (!terminalStatus(job.status)) {
    if (isJobBlockedByNonRetryableError(job)) {
      throw new StagedGenerationTerminalError(job);
    }
    try {
      const ocrAsset = job.currentStage === "ocr"
        ? ocrAssets[job.stageCursor.position]
        : undefined;
      if (job.currentStage === "ocr" && job.stageCursor.position < job.stageCursor.total && !ocrAsset) {
        throw new StagedGenerationApiError(
          `Cần tải lại ảnh SGK ${job.stageCursor.position + 1}/${job.stageCursor.total} để tiếp tục OCR.`,
          "GENERATION_OCR_ASSET_REQUIRED",
          409,
        );
      }
      const nextJob = await advanceStagedGenerationJobClient(job.id, { ...options, ocrAsset });
      const nextPositionKey = jobPositionKey(nextJob);
      if (nextPositionKey === positionKey) {
        retriesAtPosition += 1;
        if (terminalStatus(nextJob.status) || isJobBlockedByNonRetryableError(nextJob)) {
          job = nextJob;
          options.onJob?.(job);
          throw new StagedGenerationTerminalError(job);
        }
        if (retriesAtPosition > maxAutomaticRetries) {
          job = nextJob;
          options.onJob?.(job);
          throw new StagedGenerationApiError(
            nextJob.error?.message || "Quá nhiều lần thử liên tiếp không có tiến triển mới tại bước hiện tại.",
            nextJob.error?.code || "GENERATION_STALLED_AT_STEP",
            422,
          );
        }
      } else {
        retriesAtPosition = 0;
      }
      positionKey = nextPositionKey;
      job = nextJob;
      if (job.currentStage !== "ocr") ocrAssets = [];
      options.onJob?.(job);
    } catch (error) {
      if (error instanceof StagedGenerationTerminalError) throw error;
      if (!retryableRequestError(error) || retriesAtPosition >= maxAutomaticRetries) throw error;
      retriesAtPosition += 1;
      await waitForRetry(retryDelayMs * retriesAtPosition, options.signal);
      job = await getStagedGenerationJobClient(job.id, options);
      const nextPositionKey = jobPositionKey(job);
      if (nextPositionKey !== positionKey) {
        retriesAtPosition = 0;
      }
      positionKey = nextPositionKey;
      options.onJob?.(job);
    }
  }

  if (job.status !== "completed") throw new StagedGenerationTerminalError(job);
  if (!job.lessonId) {
    throw new StagedGenerationApiError(
      "Generation job đã hoàn tất nhưng thiếu ID giáo án.",
      "COMPLETED_LESSON_ID_MISSING",
      500,
    );
  }
  const lesson = await loadStagedGeneratedLessonClient(job.lessonId, options);
  return { job, lessonId: job.lessonId, lesson };
}

export async function startStagedGeneration(
  options: StartOptions,
): Promise<StagedGenerationResult> {
  let ocrAssets: UploadedAsset[] = [];
  try {
    const input = JSON.parse(options.payload) as Partial<LessonInput>;
    ocrAssets = Array.isArray(input.uploadedAssets) ? input.uploadedAssets : [];
  } catch {
    // The create endpoint returns the structured invalid JSON error.
  }
  const created = await createStagedGenerationJobClient(options);
  const { payload: _payload, idempotencyKey: _idempotencyKey, ...continueOptions } = options;
  return continueStagedGeneration({ ...continueOptions, job: created.job, ocrAssets });
}

export async function resumeStagedGeneration(
  options: ResumeOptions,
): Promise<StagedGenerationResult> {
  const job = await getStagedGenerationJobClient(options.jobId, options);
  return continueStagedGeneration({ ...options, job, ocrAssets: options.ocrAssets });
}
