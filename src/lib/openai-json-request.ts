import "server-only";

import type { AiStageStrategy } from "./model-strategy";

export type OpenAiJsonMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export function usesOpenAiResponsesApi(strategy: AiStageStrategy) {
  return strategy.provider === "openai" && /^gpt-5/i.test(strategy.model);
}

export function buildOpenAiResponsesJsonRequest(
  strategy: AiStageStrategy,
  messages: OpenAiJsonMessage[],
) {
  return {
    model: strategy.model,
    input: messages,
    reasoning: { effort: strategy.reasoningEffort || "medium" },
    text: { format: { type: "json_object" as const } },
    ...(strategy.maxOutputTokens ? { max_output_tokens: strategy.maxOutputTokens } : {}),
  };
}
