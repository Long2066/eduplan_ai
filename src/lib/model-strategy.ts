import "server-only";
import { getFirebaseDb } from "@/lib/firebase-admin";
import {
  DEFAULT_AI_GATEWAY_SETTINGS,
  normalizeAiGatewaySettings,
  type AiGatewaySettings,
} from "@shared/ai-gateway-catalog";

export type SubscriptionPlan = "free" | "plus";
export type LegacySubscriptionPlan = SubscriptionPlan | "pro";
export type AiProvider = "openai" | "openrouter" | "gateway";
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
  gatewayBaseUrl?: string;
  gatewayApiKey?: string;
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

let cachedGatewaySettings: { data: AiGatewaySettings; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 15_000;

export async function getLiveAiGatewaySettings(): Promise<AiGatewaySettings> {
  const now = Date.now();
  if (cachedGatewaySettings && now - cachedGatewaySettings.fetchedAt < CACHE_TTL_MS) {
    return cachedGatewaySettings.data;
  }
  try {
    const snapshot = await getFirebaseDb().collection("app_settings").doc("system").get();
    const settings = normalizeAiGatewaySettings(snapshot.data()?.aiGateway);
    cachedGatewaySettings = { data: settings, fetchedAt: now };
    return settings;
  } catch {
    return cachedGatewaySettings?.data || { ...DEFAULT_AI_GATEWAY_SETTINGS };
  }
}

export function getCachedAiGatewaySettings(): AiGatewaySettings {
  return cachedGatewaySettings?.data || { ...DEFAULT_AI_GATEWAY_SETTINGS };
}

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

export function getPlanModelStrategy(planValue: unknown, options?: { gateway?: AiGatewaySettings }): PlanModelStrategy {
  const plan = normalizeSubscriptionPlan(planValue);
  const gateway = options?.gateway || getCachedAiGatewaySettings();

  if (gateway.enabled && gateway.baseUrl && gateway.routingMode !== "openai_only") {
    const isGatewayOnly = gateway.routingMode === "gateway_only";
    const gatewayBaseUrl = gateway.baseUrl.replace(/\/+$/, "");
    const gatewayApiKey = gateway.apiKey;
    const defaultOpenAiFallback = plan === "free" ? (gateway.openaiFreeModel || gateway.openaiModel || "gpt-5.4-mini") : (gateway.openaiPlusModel || "gpt-5.6-terra");

    if (plan === "free") {
      const freeModel = gateway.freeModel || "gemini-3.5-flash-lite";
      return {
        plan,
        blueprint: {
          stage: "blueprint",
          provider: "gateway",
          model: freeModel,
          fallbackProvider: isGatewayOnly ? undefined : "openai",
          fallbackModel: isGatewayOnly ? undefined : defaultOpenAiFallback,
          temperature: 0.35,
          reasoningEffort: "low",
          timeoutMs: 90_000,
          maxOutputTokens: 12_000,
          gatewayBaseUrl,
          gatewayApiKey,
        },
        detail: {
          stage: "detail",
          provider: "gateway",
          model: freeModel,
          fallbackProvider: isGatewayOnly ? undefined : "openai",
          fallbackModel: isGatewayOnly ? undefined : defaultOpenAiFallback,
          temperature: 0.6,
          reasoningEffort: "low",
          timeoutMs: 90_000,
          maxOutputTokens: 16_000,
          gatewayBaseUrl,
          gatewayApiKey,
        },
        repair: {
          stage: "repair",
          provider: "gateway",
          model: freeModel,
          fallbackProvider: isGatewayOnly ? undefined : "openai",
          fallbackModel: isGatewayOnly ? undefined : "gpt-5.6-terra",
          temperature: 0.35,
          reasoningEffort: "low",
          timeoutMs: 60_000,
          maxOutputTokens: 12_000,
          gatewayBaseUrl,
          gatewayApiKey,
        },
      };
    }

    // Plus plan through Gateway
    const plusModel = gateway.plusModel || "gpt-5.6-terra";
    return {
      plan,
      blueprint: {
        stage: "blueprint",
        provider: "gateway",
        model: plusModel,
        fallbackProvider: isGatewayOnly ? undefined : "openai",
        fallbackModel: isGatewayOnly ? undefined : (gateway.openaiPlusModel || "gpt-5.6-terra"),
        temperature: 0.35,
        reasoningEffort: "low",
        timeoutMs: 90_000,
        maxOutputTokens: 12_000,
        gatewayBaseUrl,
        gatewayApiKey,
      },
      detail: {
        stage: "detail",
        provider: "gateway",
        model: plusModel,
        fallbackProvider: isGatewayOnly ? undefined : "openai",
        fallbackModel: isGatewayOnly ? undefined : (gateway.openaiPlusModel || "gpt-5.6-terra"),
        temperature: 0.6,
        reasoningEffort: "low",
        timeoutMs: 90_000,
        maxOutputTokens: 16_000,
        gatewayBaseUrl,
        gatewayApiKey,
      },
      repair: {
        stage: "repair",
        provider: "gateway",
        model: plusModel,
        fallbackProvider: isGatewayOnly ? undefined : "openai",
        fallbackModel: isGatewayOnly ? undefined : "gpt-5.6-terra",
        temperature: 0.45,
        reasoningEffort: "low",
        timeoutMs: 60_000,
        maxOutputTokens: 12_000,
        gatewayBaseUrl,
        gatewayApiKey,
      },
    };
  }

  // Pure OpenAI mode (default / fallback)
  if (plan === "free") {
    const model = (process.env.FREE_OPENAI_MODEL || gateway.openaiFreeModel || gateway.openaiModel || "gpt-5.4-mini").trim();
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

  const model = (process.env.PLUS_MODEL || gateway.openaiPlusModel || "gpt-5.6-terra").trim();
  const blueprintModel = (process.env.PLUS_BLUEPRINT_MODEL || model).trim();
  const detailModel = (process.env.PLUS_DETAIL_MODEL || model).trim();
  const repairModel = (process.env.PLUS_REPAIR_MODEL || model).trim();
  const configuredFallback = (process.env.PLUS_FALLBACK_MODEL || process.env.OPENAI_FALLBACK_MODEL || "gpt-5.4-mini").trim();
  const getFallback = (stageModel: string) =>
    configuredFallback && configuredFallback !== stageModel ? configuredFallback : undefined;
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
    blueprint: openAiStage("blueprint", blueprintModel, 0.35, getFallback(blueprintModel), blueprintEffort, blueprintTimeoutMs, blueprintMaxOutputTokens, fallbackEffort, fallbackTimeoutMs, fallbackMaxOutputTokens),
    detail: openAiStage("detail", detailModel, 0.6, getFallback(detailModel), detailEffort, detailTimeoutMs, detailMaxOutputTokens, fallbackEffort, fallbackTimeoutMs, fallbackMaxOutputTokens),
    repair: openAiStage("repair", repairModel, 0.45, getFallback(repairModel), repairEffort, repairTimeoutMs, repairMaxOutputTokens, fallbackEffort, fallbackTimeoutMs, fallbackMaxOutputTokens),
  };
}
