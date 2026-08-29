import "server-only";

export type SubscriptionPlan = "free" | "plus";
export type LegacySubscriptionPlan = SubscriptionPlan | "pro";
export type AiProvider = "openai" | "openrouter";
export type AiStage = "blueprint" | "detail" | "repair";
export type OpenAiReasoningEffort = "minimal" | "low" | "medium" | "high";

export type AiStageStrategy = {
  stage: AiStage;
  provider: AiProvider;
  model: string;
  fallbackProvider?: AiProvider;
  fallbackModel?: string;
  fallbackReasoningEffort?: OpenAiReasoningEffort;
  fallbackTimeoutMs?: number;
  fallbackMaxOutputTokens?: number;
  temperature: number;
  reasoningEffort?: OpenAiReasoningEffort;
  timeoutMs?: number;
  maxOutputTokens?: number;
};

export type AiGenerationResult = {
  content: string;
  model: string;
  provider: AiProvider;
  fallbackUsed: boolean;
};

export type PlanModelStrategy = {
  plan: SubscriptionPlan;
  blueprint: AiStageStrategy;
  detail: AiStageStrategy;
  repair: AiStageStrategy;
};

export function normalizeSubscriptionPlan(value: unknown): SubscriptionPlan {
  return value === "plus" || value === "pro" ? "plus" : "free";
}

function reasoningEffort(value: string | undefined, fallback: OpenAiReasoningEffort): OpenAiReasoningEffort {
  return value === "minimal" || value === "low" || value === "medium" || value === "high" ? value : fallback;
}

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function openAiStage(
  stage: AiStage,
  model: string,
  temperature: number,
  fallbackModel?: string,
  effort?: OpenAiReasoningEffort,
  timeoutMs?: number,
  maxOutputTokens?: number,
  fallbackEffort?: OpenAiReasoningEffort,
  fallbackTimeoutMs?: number,
  fallbackMaxOutputTokens?: number,
): AiStageStrategy {
  return {
    stage,
    provider: "openai",
    model,
    fallbackProvider: fallbackModel ? "openai" : undefined,
    fallbackModel,
    fallbackReasoningEffort: fallbackModel ? fallbackEffort : undefined,
    fallbackTimeoutMs: fallbackModel ? fallbackTimeoutMs : undefined,
    fallbackMaxOutputTokens: fallbackModel ? fallbackMaxOutputTokens : undefined,
    temperature,
    reasoningEffort: effort,
    timeoutMs,
    maxOutputTokens,
  };
}

export function getPlanModelStrategy(planValue: unknown): PlanModelStrategy {
  const plan = normalizeSubscriptionPlan(planValue);
  if (plan === "free") {
    const model = (process.env.FREE_OPENAI_MODEL || "gpt-5.4-mini").trim();
    const fallbackModel = (process.env.FREE_OPENAI_FALLBACK_MODEL || process.env.OPENAI_FALLBACK_MODEL || "").trim() || undefined;
    const safeFallbackModel = fallbackModel && fallbackModel !== model ? fallbackModel : undefined;
    const generationEffort = reasoningEffort(process.env.FREE_OPENAI_REASONING_EFFORT, "low");
    const repairModel = (process.env.FREE_REPAIR_MODEL || "gpt-5.6-terra").trim();
    const configuredRepairFallback = (process.env.FREE_REPAIR_FALLBACK_MODEL || "gpt-5.4-mini").trim();
    const repairFallbackModel = configuredRepairFallback && configuredRepairFallback !== repairModel
      ? configuredRepairFallback
      : undefined;
    const repairEffort = reasoningEffort(process.env.FREE_REPAIR_REASONING_EFFORT, "medium");
    const repairTimeoutMs = positiveInteger(process.env.FREE_REPAIR_TIMEOUT_MS, 60_000);
    const repairMaxOutputTokens = positiveInteger(process.env.FREE_REPAIR_MAX_OUTPUT_TOKENS, 12_000);
    return {
      plan,
      blueprint: openAiStage("blueprint", model, 0.35, safeFallbackModel, generationEffort),
      detail: openAiStage("detail", model, 0.6, safeFallbackModel, generationEffort),
      repair: openAiStage(
        "repair",
        repairModel,
        0.35,
        repairFallbackModel,
        repairEffort,
        repairTimeoutMs,
        repairMaxOutputTokens,
        "low",
        60_000,
        12_000,
      ),
    };
  }

  const model = (process.env.PLUS_MODEL || "gpt-5.6-terra").trim();
  const configuredFallback = (process.env.PLUS_FALLBACK_MODEL || process.env.OPENAI_FALLBACK_MODEL || "gpt-5.4-mini").trim();
  const fallbackModel = configuredFallback && configuredFallback !== model ? configuredFallback : undefined;
  const prefix = "PLUS";
  const blueprintEffort = reasoningEffort(process.env[`${prefix}_BLUEPRINT_REASONING_EFFORT`] || process.env[`${prefix}_REASONING_EFFORT`], "low");
  const detailEffort = reasoningEffort(process.env[`${prefix}_DETAIL_REASONING_EFFORT`] || process.env[`${prefix}_REASONING_EFFORT`], "low");
  const repairEffort = reasoningEffort(process.env[`${prefix}_REPAIR_REASONING_EFFORT`] || process.env[`${prefix}_REASONING_EFFORT`], "medium");
  const fallbackEffort = reasoningEffort(process.env.PLUS_FALLBACK_REASONING_EFFORT, "low");
  const fallbackTimeoutMs = positiveInteger(process.env.PLUS_FALLBACK_TIMEOUT_MS, 60_000);
  const fallbackMaxOutputTokens = positiveInteger(process.env.PLUS_FALLBACK_MAX_OUTPUT_TOKENS, 12_000);
  const blueprintTimeoutMs = positiveInteger(process.env.PLUS_BLUEPRINT_TIMEOUT_MS, 90_000);
  const detailTimeoutMs = positiveInteger(process.env.PLUS_DETAIL_TIMEOUT_MS, 90_000);
  const repairTimeoutMs = positiveInteger(process.env.PLUS_REPAIR_TIMEOUT_MS, 60_000);
  const blueprintMaxOutputTokens = positiveInteger(process.env.PLUS_BLUEPRINT_MAX_OUTPUT_TOKENS, 12_000);
  const detailMaxOutputTokens = positiveInteger(process.env.PLUS_DETAIL_MAX_OUTPUT_TOKENS, 16_000);
  const repairMaxOutputTokens = positiveInteger(process.env.PLUS_REPAIR_MAX_OUTPUT_TOKENS, 12_000);
  return {
    plan,
    blueprint: openAiStage("blueprint", model, 0.35, fallbackModel, blueprintEffort, blueprintTimeoutMs, blueprintMaxOutputTokens, fallbackEffort, fallbackTimeoutMs, fallbackMaxOutputTokens),
    detail: openAiStage("detail", model, 0.6, fallbackModel, detailEffort, detailTimeoutMs, detailMaxOutputTokens, fallbackEffort, fallbackTimeoutMs, fallbackMaxOutputTokens),
    repair: openAiStage("repair", model, 0.45, fallbackModel, repairEffort, repairTimeoutMs, repairMaxOutputTokens, fallbackEffort, fallbackTimeoutMs, fallbackMaxOutputTokens),
  };
}
