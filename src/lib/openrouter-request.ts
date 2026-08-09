import type { AiStage } from "./model-strategy";

const DEFAULT_OPENROUTER_BLUEPRINT_TIMEOUT_MS = 70000;
const DEFAULT_OPENROUTER_DETAIL_TIMEOUT_MS = 80000;
const MAX_OPENROUTER_TIMEOUT_MS = 90000;
const DEFAULT_OPENROUTER_TRANSIENT_RETRIES = 0;
const MAX_OPENROUTER_TRANSIENT_RETRIES = 1;

function boundedInteger(value: string | undefined, fallback: number, minimum: number, maximum: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.trunc(parsed)));
}
export function openRouterRequestTimeoutMs(stage: AiStage = "detail", env: NodeJS.ProcessEnv = process.env) {
  const stageVariable = stage === "blueprint"
    ? env.OPENROUTER_BLUEPRINT_TIMEOUT_MS
    : env.OPENROUTER_DETAIL_TIMEOUT_MS;
  const fallback = stage === "blueprint"
    ? DEFAULT_OPENROUTER_BLUEPRINT_TIMEOUT_MS
    : DEFAULT_OPENROUTER_DETAIL_TIMEOUT_MS;
  return boundedInteger(stageVariable || env.OPENROUTER_REQUEST_TIMEOUT_MS, fallback, 1000, MAX_OPENROUTER_TIMEOUT_MS);
}

export function openRouterTransientRetries(env: NodeJS.ProcessEnv = process.env) {
  return boundedInteger(env.OPENROUTER_TRANSIENT_RETRIES, DEFAULT_OPENROUTER_TRANSIENT_RETRIES, 0, MAX_OPENROUTER_TRANSIENT_RETRIES);
}

export function openRouterMaxTokens(stage: AiStage, env: NodeJS.ProcessEnv = process.env) {
  const variable = stage === "blueprint" ? env.OPENROUTER_BLUEPRINT_MAX_TOKENS : env.OPENROUTER_DETAIL_MAX_TOKENS;
  const fallback = stage === "blueprint" ? 4500 : stage === "detail" ? 8000 : 10000;
  return boundedInteger(variable, fallback, 512, 16000);
}

export function openRouterProviderPreferences() {
  return {
    require_parameters: true,
    allow_fallbacks: true,
  };
}

export function isOpenRouterTransientStatus(status: number) {
  return status === 408 || status === 409 || status === 429 || status >= 500;
}

export function isOpenRouterTransientError(error: unknown) {
  const message = error instanceof Error ? `${error.name} ${error.message}` : String(error || "");
  return /abort|timeout|timed out|fetch failed|network|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|socket|terminated/i.test(message);
}

