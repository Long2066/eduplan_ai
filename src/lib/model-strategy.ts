import "server-only";

export type SubscriptionPlan = "free" | "plus" | "pro";
export type AiProvider = "openai" | "openrouter";
export type AiStage = "blueprint" | "detail" | "repair" | "refine";

export type AiStageStrategy = {
  stage: AiStage;
  provider: AiProvider;
  model: string;
  fallbackProvider?: AiProvider;
  fallbackModel?: string;
  temperature: number;
};

export type PlanModelStrategy = {
  plan: SubscriptionPlan;
  blueprint: AiStageStrategy;
  detail: AiStageStrategy;
  repair: AiStageStrategy;
  refine: AiStageStrategy;
};

export function normalizeSubscriptionPlan(value: unknown): SubscriptionPlan {
  return value === "plus" || value === "pro" ? value : "free";
}

function openAiStage(stage: AiStage, model: string, temperature: number, fallbackModel?: string): AiStageStrategy {
  return { stage, provider: "openai", model, fallbackProvider: fallbackModel ? "openai" : undefined, fallbackModel, temperature };
}

function openRouterStage(stage: AiStage, model: string, temperature: number, fallbackModel?: string): AiStageStrategy {
  return { stage, provider: "openrouter", model, fallbackProvider: fallbackModel ? "openrouter" : undefined, fallbackModel, temperature };
}

export function getPlanModelStrategy(planValue: unknown): PlanModelStrategy {
  const plan = normalizeSubscriptionPlan(planValue);
  if (plan === "free") {
    const blueprintModel = process.env.FREE_BLUEPRINT_MODEL || "google/gemma-4-26b-a4b-it:free";
    const detailModel = process.env.FREE_DETAIL_MODEL || "google/gemma-4-26b-a4b-it:free";
    const refineModel = process.env.FREE_REFINE_MODEL || detailModel;
    const fallbackModel = process.env.FREE_FALLBACK_MODEL || "meta-llama/llama-3.3-70b-instruct:free";
    return {
      plan,
      blueprint: openRouterStage("blueprint", blueprintModel, 0.35, fallbackModel),
      detail: openRouterStage("detail", detailModel, 0.6, fallbackModel),
      repair: openRouterStage("repair", detailModel, 0.45, fallbackModel),
      refine: openRouterStage("refine", refineModel, 0.55, fallbackModel),
    };
  }

  const model = plan === "plus" ? process.env.PLUS_MODEL || "gpt-5.4-mini" : process.env.PRO_MODEL || "gpt-5.4";
  const fallbackModel = plan === "plus"
    ? process.env.PLUS_FALLBACK_MODEL || process.env.OPENAI_FALLBACK_MODEL || undefined
    : process.env.PRO_FALLBACK_MODEL || process.env.PLUS_MODEL || "gpt-5.4-mini";
  return {
    plan,
    blueprint: openAiStage("blueprint", model, 0.35, fallbackModel),
    detail: openAiStage("detail", model, 0.6, fallbackModel),
    repair: openAiStage("repair", model, 0.45, fallbackModel),
    refine: openAiStage("refine", model, 0.55, fallbackModel),
  };
}
