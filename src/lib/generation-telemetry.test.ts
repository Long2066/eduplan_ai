import { describe, expect, it } from "vitest";
import { normalizeAiUsage, summarizeGenerationCalls, type GenerationCallMetric } from "./generation-telemetry";

describe("generation telemetry", () => {
  it("normalizes Responses and Chat Completions token usage", () => {
    expect(normalizeAiUsage({ usage: { input_tokens: 100, output_tokens: 40, total_tokens: 140 } }))
      .toEqual({ inputTokens: 100, outputTokens: 40, totalTokens: 140 });
    expect(normalizeAiUsage({ usage: { prompt_tokens: 70, completion_tokens: 30 } }))
      .toEqual({ inputTokens: 70, outputTokens: 30, totalTokens: 100 });
  });

  it("counts failures and fallback calls without charging failed-token totals", () => {
    const calls: GenerationCallMetric[] = [
      { scope: "detail", provider: "openai", model: "gpt-5.6-terra", fallbackUsed: false, outcome: "http_error", elapsedMs: 1000, httpStatus: 500, inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      { scope: "detail", provider: "openai", model: "gpt-5.4-mini", fallbackUsed: true, outcome: "success", elapsedMs: 2000, inputTokens: 120, outputTokens: 80, totalTokens: 200 },
    ];

    expect(summarizeGenerationCalls(calls)).toEqual({
      callCount: 2,
      successfulCallCount: 1,
      failedCallCount: 1,
      fallbackCallCount: 1,
      inputTokens: 120,
      outputTokens: 80,
      totalTokens: 200,
      elapsedMs: 3000,
    });
  });
});
