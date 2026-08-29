import { describe, expect, it, vi } from "vitest";
import {
  GenerationTimeoutError,
  currentGenerationContext,
  recordGenerationCall,
  withGenerationDeadline,
} from "./runtime";

describe("generation runtime", () => {
  it("keeps request telemetry inside the active generation context", async () => {
    const result = await withGenerationDeadline("request-1", async () => {
      recordGenerationCall({
        scope: "detail",
        provider: "openai",
        model: "test-model",
        fallbackUsed: false,
        outcome: "success",
        elapsedMs: 10,
        inputTokens: 5,
        outputTokens: 7,
        totalTokens: 12,
      });
      return currentGenerationContext()?.calls.length;
    }, undefined, 1000);

    expect(result).toBe(1);
    expect(currentGenerationContext()).toBeUndefined();
  });

  it("aborts work when the configured deadline is reached", async () => {
    vi.useFakeTimers();
    try {
      const pending = withGenerationDeadline("request-timeout", async () => new Promise<never>(() => undefined), undefined, 25);
      const assertion = expect(pending).rejects.toBeInstanceOf(GenerationTimeoutError);
      await vi.advanceTimersByTimeAsync(25);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });
});
