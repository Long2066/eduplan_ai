import { describe, expect, it } from "vitest";
import {
  isOpenRouterTransientError,
  isOpenRouterTransientStatus,
  openRouterMaxTokens,
  openRouterProviderPreferences,
  openRouterRequestTimeoutMs,
  openRouterTransientRetries,
} from "./openrouter-request";

describe("OpenRouter MiniMax request settings", () => {
  it("uses stage deadlines and no blind retry by default", () => {
    const env = {} as NodeJS.ProcessEnv;
    expect(openRouterRequestTimeoutMs("blueprint", env)).toBe(70000);
    expect(openRouterRequestTimeoutMs("detail", env)).toBe(80000);
    expect(openRouterTransientRetries(env)).toBe(0);
  });

  it("caps timeout and retry count to safe values", () => {
    const env = { NODE_ENV: "test", OPENROUTER_REQUEST_TIMEOUT_MS: "999999", OPENROUTER_TRANSIENT_RETRIES: "9" } as NodeJS.ProcessEnv;
    expect(openRouterRequestTimeoutMs("detail", env)).toBe(90000);
    expect(openRouterTransientRetries(env)).toBe(1);
  });

  it("honors stage-specific timeout variables", () => {
    const env = { NODE_ENV: "test", OPENROUTER_BLUEPRINT_TIMEOUT_MS: "45000", OPENROUTER_DETAIL_TIMEOUT_MS: "65000" } as NodeJS.ProcessEnv;
    expect(openRouterRequestTimeoutMs("blueprint", env)).toBe(45000);
    expect(openRouterRequestTimeoutMs("detail", env)).toBe(65000);
  });

  it("requires JSON-compatible endpoints while allowing provider fallback", () => {
    expect(openRouterProviderPreferences()).toEqual({ require_parameters: true, allow_fallbacks: true });
  });

  it("uses bounded output budgets by stage", () => {
    expect(openRouterMaxTokens("blueprint", {} as NodeJS.ProcessEnv)).toBe(4500);
    expect(openRouterMaxTokens("detail", {} as NodeJS.ProcessEnv)).toBe(8000);
    expect(openRouterMaxTokens("repair", {} as NodeJS.ProcessEnv)).toBe(10000);
  });

  it("retries only transient statuses and request errors", () => {
    expect(isOpenRouterTransientStatus(429)).toBe(true);
    expect(isOpenRouterTransientStatus(503)).toBe(true);
    expect(isOpenRouterTransientStatus(401)).toBe(false);
    expect(isOpenRouterTransientError(new DOMException("Timed out", "AbortError"))).toBe(true);
    expect(isOpenRouterTransientError(new Error("invalid api key"))).toBe(false);
  });
});
