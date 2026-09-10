import { AsyncLocalStorage } from "node:async_hooks";
import type { GenerationCallMetric } from "@/lib/generation-telemetry";

export const GENERATION_SOFT_TIMEOUT_MS = Math.min(280_000, Number(process.env.GENERATION_SOFT_TIMEOUT_MS || 270_000));
export const GENERATION_SAVE_RESERVE_MS = 12_000;

export type GenerationAiPolicy = {
  singleAttempt: true;
  useFallback: boolean;
  requestTimeoutMs?: number;
};

export type GenerationContext = {
  requestId: string;
  startedAt: number;
  deadlineAt: number;
  controller: AbortController;
  fallbackModels: Set<string>;
  calls: GenerationCallMetric[];
  /** Section jobs schedule retries in fresh HTTP requests, not inside this deadline. */
  aiPolicy?: GenerationAiPolicy;
  aiCallsStarted?: number;
};

const generationContextStore = new AsyncLocalStorage<GenerationContext>();

export class GenerationTimeoutError extends Error {
  constructor() {
    super("Quá trình tạo giáo án vượt thời gian xử lý an toàn. Các phần đã lưu được giữ lại; vui lòng thử tiếp tục.");
    this.name = "GENERATION_TIMEOUT";
  }
}

export function currentGenerationContext() {
  return generationContextStore.getStore();
}

export function recordGenerationCall(metric: GenerationCallMetric) {
  currentGenerationContext()?.calls.push(metric);
}

export function beginGenerationAiCall() {
  const context = currentGenerationContext();
  if (!context?.aiPolicy?.singleAttempt) return;
  if (context.controller.signal.aborted || context.deadlineAt <= Date.now()) throw new GenerationTimeoutError();
  if ((context.aiCallsStarted || 0) >= 1) {
    throw new Error("Mỗi bước chia nhỏ chỉ được gọi AI một lần. Hãy tiếp tục bằng request kế tiếp.");
  }
  context.aiCallsStarted = (context.aiCallsStarted || 0) + 1;
}

export function remainingGenerationMs() {
  const context = currentGenerationContext();
  return context ? context.deadlineAt - Date.now() : Number.POSITIVE_INFINITY;
}

function hasGenerationBudget(minWorkMs: number) {
  return remainingGenerationMs() - GENERATION_SAVE_RESERVE_MS >= minWorkMs;
}

export function canStartAiRepair(scope: string, minWorkMs: number, details: Record<string, unknown> = {}) {
  if (hasGenerationBudget(minWorkMs)) return true;
  console.info("[EduPlan AI] AI repair skipped by time budget", {
    requestId: currentGenerationContext()?.requestId,
    scope,
    remainingMs: Math.max(0, Math.round(remainingGenerationMs())),
    requiredWorkMs: minWorkMs,
    saveReserveMs: GENERATION_SAVE_RESERVE_MS,
    ...details,
  });
  return false;
}

export function abortSignalForRequest(controller: AbortController) {
  const signal = currentGenerationContext()?.controller.signal;
  if (!signal) return controller.signal;
  if (signal.aborted) controller.abort();
  else signal.addEventListener("abort", () => controller.abort(), { once: true });
  return controller.signal;
}

export async function withGenerationDeadline<T>(
  requestId: string,
  operation: () => Promise<T>,
  onContext?: (context: GenerationContext) => void,
  timeoutMs = GENERATION_SOFT_TIMEOUT_MS,
): Promise<T> {
  const controller = new AbortController();
  const context: GenerationContext = {
    requestId,
    startedAt: Date.now(),
    deadlineAt: Date.now() + timeoutMs,
    controller,
    fallbackModels: new Set<string>(),
    calls: [],
  };
  onContext?.(context);
  return generationContextStore.run(context, async () => {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<never>((_, reject) => {
      timeout = setTimeout(() => {
        controller.abort();
        reject(new GenerationTimeoutError());
      }, timeoutMs);
    });
    try {
      return await Promise.race([operation(), deadline]);
    } finally {
      controller.abort();
      if (timeout) clearTimeout(timeout);
    }
  });
}
