import "server-only";

export type GenerationCallMetric = {
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

export function normalizeAiUsage(data: unknown) {
  const usage = data && typeof data === "object" && "usage" in data
    ? (data as { usage?: Record<string, unknown> }).usage || {}
    : {};
  const inputTokens = Number(usage.input_tokens ?? usage.prompt_tokens ?? 0);
  const outputTokens = Number(usage.output_tokens ?? usage.completion_tokens ?? 0);
  const reportedTotal = Number(usage.total_tokens ?? 0);
  return {
    inputTokens: Number.isFinite(inputTokens) ? Math.max(0, inputTokens) : 0,
    outputTokens: Number.isFinite(outputTokens) ? Math.max(0, outputTokens) : 0,
    totalTokens: Number.isFinite(reportedTotal) && reportedTotal > 0
      ? reportedTotal
      : Math.max(0, inputTokens || 0) + Math.max(0, outputTokens || 0),
  };
}

export function summarizeGenerationCalls(calls: GenerationCallMetric[]) {
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
