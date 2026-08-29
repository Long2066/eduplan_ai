import { afterEach, describe, expect, it } from "vitest";
import { getPlanModelStrategy, normalizeSubscriptionPlan } from "./model-strategy";

const MANAGED_KEYS = [
  "FREE_OPENAI_MODEL",
  "FREE_OPENAI_FALLBACK_MODEL",
  "FREE_OPENAI_REASONING_EFFORT",
  "FREE_REPAIR_MODEL",
  "FREE_REPAIR_FALLBACK_MODEL",
  "FREE_REPAIR_REASONING_EFFORT",
  "FREE_REPAIR_TIMEOUT_MS",
  "FREE_REPAIR_MAX_OUTPUT_TOKENS",
  "FREE_BLUEPRINT_MODEL",
  "FREE_DETAIL_MODEL",
  "FREE_FALLBACK_MODEL",
  "PLUS_MODEL",
  "PRO_MODEL",
  "PLUS_FALLBACK_MODEL",
  "PLUS_FALLBACK_REASONING_EFFORT",
  "PLUS_FALLBACK_TIMEOUT_MS",
  "PLUS_FALLBACK_MAX_OUTPUT_TOKENS",
  "PRO_FALLBACK_MODEL",
  "OPENAI_FALLBACK_MODEL",
  "OPENAI_REASONING_EFFORT",
  "PLUS_REASONING_EFFORT",
  "PLUS_BLUEPRINT_REASONING_EFFORT",
  "PLUS_DETAIL_REASONING_EFFORT",
  "PLUS_REPAIR_REASONING_EFFORT",
  "PLUS_BLUEPRINT_TIMEOUT_MS",
  "PLUS_DETAIL_TIMEOUT_MS",
  "PLUS_REPAIR_TIMEOUT_MS",
  "PLUS_BLUEPRINT_MAX_OUTPUT_TOKENS",
  "PLUS_DETAIL_MAX_OUTPUT_TOKENS",
  "PLUS_REPAIR_MAX_OUTPUT_TOKENS",
  "PRO_REASONING_EFFORT",
  "PRO_BLUEPRINT_REASONING_EFFORT",
  "PRO_DETAIL_REASONING_EFFORT",
  "PRO_REPAIR_REASONING_EFFORT",
] as const;

const originalEnv = Object.fromEntries(MANAGED_KEYS.map((key) => [key, process.env[key]]));

afterEach(() => {
  for (const key of MANAGED_KEYS) {
    const value = originalEnv[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});
describe("getPlanModelStrategy", () => {
  it("uses fast Free generation with a quality escalation for repair", () => {
    for (const key of MANAGED_KEYS) delete process.env[key];

    const strategy = getPlanModelStrategy("free");
    expect(strategy.plan).toBe("free");
    for (const stage of [strategy.blueprint, strategy.detail]) {
      expect(stage.provider).toBe("openai");
      expect(stage.model).toBe("gpt-5.4-mini");
      expect(stage.reasoningEffort).toBe("low");
      expect(stage.fallbackProvider).toBeUndefined();
      expect(stage.fallbackModel).toBeUndefined();
    }
    expect(strategy.repair).toMatchObject({
      provider: "openai",
      model: "gpt-5.6-terra",
      fallbackProvider: "openai",
      fallbackModel: "gpt-5.4-mini",
      reasoningEffort: "medium",
      timeoutMs: 60_000,
      maxOutputTokens: 12_000,
    });
    expect([strategy.blueprint.stage, strategy.detail.stage, strategy.repair.stage])
      .toEqual(["blueprint", "detail", "repair"]);
  });

  it("ignores legacy Free OpenRouter envs so production cannot route Free to slow Minimax", () => {
    for (const key of MANAGED_KEYS) delete process.env[key];
    process.env.FREE_BLUEPRINT_MODEL = "minimax/minimax-m3";
    process.env.FREE_DETAIL_MODEL = "minimax/minimax-m3";
    process.env.FREE_FALLBACK_MODEL = "gpt-4.1-mini";

    const strategy = getPlanModelStrategy("free");
    for (const stage of [strategy.blueprint, strategy.detail]) {
      expect(stage.provider).toBe("openai");
      expect(stage.model).toBe("gpt-5.4-mini");
    }
    expect(strategy.repair.model).toBe("gpt-5.6-terra");
  });

  it("allows a dedicated Free generation reasoning effort", () => {
    for (const key of MANAGED_KEYS) delete process.env[key];
    process.env.FREE_OPENAI_REASONING_EFFORT = "medium";

    const strategy = getPlanModelStrategy("free");

    expect(strategy.blueprint.reasoningEffort).toBe("medium");
    expect(strategy.detail.reasoningEffort).toBe("medium");
  });

  it("allows a dedicated Free repair model and safety limits", () => {
    for (const key of MANAGED_KEYS) delete process.env[key];
    process.env.FREE_REPAIR_MODEL = "gpt-5.6-luna";
    process.env.FREE_REPAIR_FALLBACK_MODEL = "gpt-5.4-mini";
    process.env.FREE_REPAIR_REASONING_EFFORT = "low";
    process.env.FREE_REPAIR_TIMEOUT_MS = "45000";
    process.env.FREE_REPAIR_MAX_OUTPUT_TOKENS = "10000";

    const strategy = getPlanModelStrategy("free");

    expect(strategy.repair).toMatchObject({
      model: "gpt-5.6-luna",
      fallbackModel: "gpt-5.4-mini",
      reasoningEffort: "low",
      timeoutMs: 45_000,
      maxOutputTokens: 10_000,
    });
  });

  it.each(["plus", "pro"] as const)("routes every %s stage through the paid Plus strategy", (plan) => {
    for (const key of MANAGED_KEYS) delete process.env[key];

    const strategy = getPlanModelStrategy(plan);
    expect(strategy.plan).toBe("plus");
    for (const stage of [strategy.blueprint, strategy.detail, strategy.repair]) {
      expect(stage.provider).toBe("openai");
      expect(stage.model).toBe("gpt-5.6-terra");
      expect(stage.fallbackModel).toBe("gpt-5.4-mini");
      expect(stage.fallbackProvider).toBe("openai");
    }
    expect([strategy.blueprint.stage, strategy.detail.stage, strategy.repair.stage])
      .toEqual(["blueprint", "detail", "repair"]);
  });

  it("normalizes legacy Pro identifiers to Plus", () => {
    expect(normalizeSubscriptionPlan("pro")).toBe("plus");
    expect(normalizeSubscriptionPlan("plus")).toBe("plus");
    expect(normalizeSubscriptionPlan("unknown")).toBe("free");
  });

  it("uses the paid reasoning defaults for legacy Pro", () => {
    for (const key of MANAGED_KEYS) delete process.env[key];

    const strategy = getPlanModelStrategy("pro");

    expect(strategy.plan).toBe("plus");
    expect(strategy.blueprint.model).toBe("gpt-5.6-terra");
    expect(strategy.detail.model).toBe("gpt-5.6-terra");
    expect(strategy.repair.model).toBe("gpt-5.6-terra");
    expect(strategy.blueprint.reasoningEffort).toBe("low");
    expect(strategy.detail.reasoningEffort).toBe("low");
    expect(strategy.repair.reasoningEffort).toBe("medium");
    expect(strategy.blueprint).toMatchObject({ timeoutMs: 90_000, maxOutputTokens: 12_000 });
    expect(strategy.detail).toMatchObject({ timeoutMs: 90_000, maxOutputTokens: 16_000 });
    expect(strategy.repair).toMatchObject({ timeoutMs: 60_000, maxOutputTokens: 12_000 });
    for (const stage of [strategy.blueprint, strategy.detail, strategy.repair]) {
      expect(stage).toMatchObject({
        fallbackReasoningEffort: "low",
        fallbackTimeoutMs: 60_000,
        fallbackMaxOutputTokens: 12_000,
      });
    }
  });

  it("allows stage-specific paid reasoning effort overrides", () => {
    for (const key of MANAGED_KEYS) delete process.env[key];
    process.env.PLUS_BLUEPRINT_REASONING_EFFORT = "low";
    process.env.PLUS_DETAIL_REASONING_EFFORT = "medium";
    process.env.PLUS_REPAIR_REASONING_EFFORT = "high";

    const strategy = getPlanModelStrategy("pro");

    expect(strategy.blueprint.reasoningEffort).toBe("low");
    expect(strategy.detail.reasoningEffort).toBe("medium");
    expect(strategy.repair.reasoningEffort).toBe("high");
  });

  it("allows safe stage timeout and output-limit overrides", () => {
    for (const key of MANAGED_KEYS) delete process.env[key];
    process.env.PLUS_BLUEPRINT_TIMEOUT_MS = "45000";
    process.env.PLUS_DETAIL_MAX_OUTPUT_TOKENS = "18000";

    const strategy = getPlanModelStrategy("plus");

    expect(strategy.blueprint.timeoutMs).toBe(45_000);
    expect(strategy.detail.maxOutputTokens).toBe(18_000);
  });

  it("allows independent fallback reasoning, timeout and output-limit overrides", () => {
    for (const key of MANAGED_KEYS) delete process.env[key];
    process.env.PLUS_FALLBACK_REASONING_EFFORT = "minimal";
    process.env.PLUS_FALLBACK_TIMEOUT_MS = "75000";
    process.env.PLUS_FALLBACK_MAX_OUTPUT_TOKENS = "14000";

    const strategy = getPlanModelStrategy("plus");

    expect(strategy.blueprint).toMatchObject({
      fallbackReasoningEffort: "minimal",
      fallbackTimeoutMs: 75_000,
      fallbackMaxOutputTokens: 14_000,
    });
  });
});

