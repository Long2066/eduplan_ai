export const SECURITY_SCHEMA_VERSION = 1 as const;
export const SECURITY_HASH_HEX_LENGTH = 64;
export const SECURITY_HASH_PREVIEW_LENGTH = 12;
export const MAX_SECURITY_EVENT_NOTE_LENGTH = 500;
export const MAX_GENERATION_SECURITY_CALLS = 160;

export const GENERATION_PIPELINES = ["direct", "staged"] as const;
export const SECURITY_EVENT_TYPES = [
  "ip_account_limit",
  "generation_duplicate_input",
  "generation_failure_spike",
  "generation_token_spike",
] as const;
export const SECURITY_EVENT_REVIEW_STATUSES = ["open", "reviewed", "dismissed"] as const;
export const SECURITY_RISK_LEVELS = ["low", "medium", "high", "critical"] as const;
export const SECURITY_REASON_CODES = [
  "ip_cluster_accounts",
  "ip_limit_event",
  "uid_multiple_ips",
  "generation_release_rate",
  "generation_failed_calls",
  "generation_token_volume",
  "duplicate_input_across_accounts",
] as const;

export type GenerationPipeline = (typeof GENERATION_PIPELINES)[number];
export type SecurityEventType = (typeof SECURITY_EVENT_TYPES)[number];
export type SecurityEventReviewStatus = (typeof SECURITY_EVENT_REVIEW_STATUSES)[number];
export type SecurityRiskLevel = (typeof SECURITY_RISK_LEVELS)[number];
export type SecurityReasonCode = (typeof SECURITY_REASON_CODES)[number];

export type GenerationSecurityContext = {
  schemaVersion: typeof SECURITY_SCHEMA_VERSION;
  pipeline: GenerationPipeline;
  ipHash: string;
  inputFingerprint: string;
};

export type SecurityGenerationCallMetric = {
  scope: "ocr" | "blueprint" | "detail" | "repair";
  provider: "openai" | "openrouter";
  model: string;
  fallbackUsed: boolean;
  outcome: "success" | "http_error" | "network_error" | "timeout" | "invalid_output";
  elapsedMs: number;
  httpStatus?: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
};

export type SecurityGenerationCallSummary = {
  callCount: number;
  successfulCallCount: number;
  failedCallCount: number;
  fallbackCallCount: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  elapsedMs: number;
};

export type SecurityRiskReason = {
  code: SecurityReasonCode;
  weight: number;
  label: string;
  detail: string;
};

export type SecurityEventReview = {
  status: SecurityEventReviewStatus;
  note: string;
  reviewedAt?: string;
  reviewedByUid?: string;
  reviewedByEmail?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function safeCount(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.round(numeric)) : 0;
}

export function isSecurityHash(value: unknown): value is string {
  return typeof value === "string" && new RegExp(`^[a-f0-9]{${SECURITY_HASH_HEX_LENGTH}}$`, "i").test(value);
}

export function normalizeSecurityHash(value: unknown) {
  return isSecurityHash(value) ? value.toLowerCase() : "";
}

export function securityHashPreview(value: unknown) {
  const normalized = normalizeSecurityHash(value);
  return normalized ? `${normalized.slice(0, SECURITY_HASH_PREVIEW_LENGTH)}…` : "—";
}

export function normalizeSecurityEventStatus(value: unknown): SecurityEventReviewStatus {
  return SECURITY_EVENT_REVIEW_STATUSES.includes(value as SecurityEventReviewStatus)
    ? value as SecurityEventReviewStatus
    : "open";
}

export function normalizeSecurityEventNote(value: unknown) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, MAX_SECURITY_EVENT_NOTE_LENGTH);
}

export function normalizeGenerationSecurityContext(value: unknown): GenerationSecurityContext | null {
  if (!isRecord(value)) return null;
  const pipeline = GENERATION_PIPELINES.includes(value.pipeline as GenerationPipeline)
    ? value.pipeline as GenerationPipeline
    : null;
  if (!pipeline) return null;
  return {
    schemaVersion: SECURITY_SCHEMA_VERSION,
    pipeline,
    ipHash: normalizeSecurityHash(value.ipHash),
    inputFingerprint: normalizeSecurityHash(value.inputFingerprint),
  };
}

export function normalizeSecurityGenerationCall(value: unknown): SecurityGenerationCallMetric | null {
  if (!isRecord(value)) return null;
  const scope = ["ocr", "blueprint", "detail", "repair"].includes(String(value.scope))
    ? String(value.scope) as SecurityGenerationCallMetric["scope"]
    : null;
  const provider = ["openai", "openrouter"].includes(String(value.provider))
    ? String(value.provider) as SecurityGenerationCallMetric["provider"]
    : null;
  const outcome = ["success", "http_error", "network_error", "timeout", "invalid_output"].includes(String(value.outcome))
    ? String(value.outcome) as SecurityGenerationCallMetric["outcome"]
    : null;
  if (!scope || !provider || !outcome) return null;
  const httpStatus = safeCount(value.httpStatus);
  return {
    scope,
    provider,
    model: String(value.model || "").slice(0, 160),
    fallbackUsed: Boolean(value.fallbackUsed),
    outcome,
    elapsedMs: safeCount(value.elapsedMs),
    ...(httpStatus ? { httpStatus } : {}),
    inputTokens: safeCount(value.inputTokens),
    outputTokens: safeCount(value.outputTokens),
    totalTokens: safeCount(value.totalTokens),
  };
}

export function normalizeSecurityGenerationCalls(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .slice(-MAX_GENERATION_SECURITY_CALLS)
    .map(normalizeSecurityGenerationCall)
    .filter((call): call is SecurityGenerationCallMetric => Boolean(call));
}

export function summarizeSecurityGenerationCalls(calls: SecurityGenerationCallMetric[]): SecurityGenerationCallSummary {
  const successful = calls.filter((call) => call.outcome === "success");
  return {
    callCount: calls.length,
    successfulCallCount: successful.length,
    failedCallCount: calls.length - successful.length,
    fallbackCallCount: calls.filter((call) => call.fallbackUsed).length,
    inputTokens: successful.reduce((sum, call) => sum + call.inputTokens, 0),
    outputTokens: successful.reduce((sum, call) => sum + call.outputTokens, 0),
    totalTokens: successful.reduce((sum, call) => sum + call.totalTokens, 0),
    elapsedMs: calls.reduce((sum, call) => sum + call.elapsedMs, 0),
  };
}

export function securityRiskLevel(score: number): SecurityRiskLevel {
  if (score >= 80) return "critical";
  if (score >= 50) return "high";
  if (score >= 25) return "medium";
  return "low";
}
