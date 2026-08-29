import type {
  GenerationJobError,
  GenerationJobProgress,
  GenerationJobStage,
  GenerationJobStageCursor,
  GenerationJobStatus,
} from "@/lib/generation/job-types";
import { sortGenerationOcrAssets } from "@/lib/generation/ocr-asset-order";
import type { LessonInput, LessonPlan, UploadedAsset } from "@/types/lesson";

export type ClientGenerationJob = {
  id: string;
  schemaVersion: number;
  pipelineVersion: string;
  status: GenerationJobStatus;
  currentStage: GenerationJobStage;
  progress: GenerationJobProgress;
  stageCursor: GenerationJobStageCursor;
  attempt: number;
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

  constructor(message: string, code = "STAGED_GENERATION_REQUEST_FAILED", status = 500) {
    super(message);
    this.name = "STAGED_GENERATION_API_ERROR";
    this.code = code;
    this.status = status;
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
): Promise<T> {
  let response: Response;
  try {
    response = await fetcher(url, init);
  } catch (error) {
    if (init.signal?.aborted) throw error;
    throw new StagedGenerationApiError(
      error instanceof Error ? error.message : "Không thể kết nối máy chủ.",
      "NETWORK_ERROR",
      0,
    );
  }

  const responseText = await response.text();
  let result: Record<string, unknown> = {};
  if (responseText) {
    try {
      result = JSON.parse(responseText) as Record<string, unknown>;
    } catch {
      throw new StagedGenerationApiError(
        response.status === 504
          ? "Máy chủ đã hết thời gian xử lý bước hiện tại."
          : "Máy chủ trả phản hồi không hợp lệ (HTTP " + response.status + ").",
        response.status === 504 ? "GENERATION_STEP_TIMEOUT" : "INVALID_SERVER_RESPONSE",
        response.status,
      );
    }
  }

  if (!response.ok) {
    throw new StagedGenerationApiError(
      typeof result.error === "string" ? result.error : "Yêu cầu thất bại (HTTP " + response.status + ").",
      typeof result.code === "string" ? result.code : "STAGED_GENERATION_REQUEST_FAILED",
      response.status,
    );
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
  return error.status === 0
    || error.status >= 500
    || [
      "GENERATION_JOB_BUSY",
      "GENERATION_JOB_LEASE_LOST",
      "GENERATION_JOB_TERMINAL",
      "GENERATION_STEP_TIMEOUT",
      "GENERATION_STEP_FAILED",
    ].includes(error.code);
}

function jobPositionKey(job: ClientGenerationJob) {
  return job.currentStage + ":" + job.stageCursor.position + ":" + job.status;
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
      retriesAtPosition = nextPositionKey === positionKey ? retriesAtPosition : 0;
      positionKey = nextPositionKey;
      job = nextJob;
      if (job.currentStage !== "ocr") ocrAssets = [];
      options.onJob?.(job);
    } catch (error) {
      if (!retryableRequestError(error) || retriesAtPosition >= maxAutomaticRetries) throw error;
      retriesAtPosition += 1;
      await waitForRetry(retryDelayMs * retriesAtPosition, options.signal);
      job = await getStagedGenerationJobClient(job.id, options);
      const nextPositionKey = jobPositionKey(job);
      if (nextPositionKey !== positionKey) retriesAtPosition = 0;
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
