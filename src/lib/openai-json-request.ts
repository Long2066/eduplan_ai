import "server-only";

import type { AiStageStrategy } from "./model-strategy";

export type OpenAiJsonMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type OpenAiResponsesPayload = {
  status?: string;
  incomplete_details?: { reason?: string } | null;
  output_text?: string;
  output?: Array<{
    type?: string;
    content?: Array<{ type?: string; text?: string }>;
  }>;
  usage?: {
    output_tokens_details?: { reasoning_tokens?: number };
  };
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

function asOpenAiResponsesPayload(data: unknown): OpenAiResponsesPayload {
  return data && typeof data === "object" ? data as OpenAiResponsesPayload : {};
}

export function extractOpenAiResponsesText(data: unknown) {
  const response = asOpenAiResponsesPayload(data);
  if (typeof response.output_text === "string" && response.output_text.trim()) {
    return response.output_text.trim();
  }
  return response.output
    ?.flatMap((item) => item.content || [])
    .map((part) => typeof part.text === "string" ? part.text : "")
    .filter(Boolean)
    .join("\n")
    .trim() || "";
}

export function inspectOpenAiResponsesOutput(data: unknown) {
  const response = asOpenAiResponsesPayload(data);
  const reasoningTokens = Number(response.usage?.output_tokens_details?.reasoning_tokens || 0);
  return {
    status: response.status || "unknown",
    incompleteReason: response.incomplete_details?.reason || undefined,
    reasoningTokens: Number.isFinite(reasoningTokens) ? Math.max(0, reasoningTokens) : 0,
    outputItemTypes: Array.from(new Set((response.output || []).map((item) => item.type).filter((type): type is string => Boolean(type)))),
  };
}

export function describeOpenAiResponsesEmptyOutput(data: unknown, maxOutputTokens?: number) {
  const details = inspectOpenAiResponsesOutput(data);
  if (details.status === "incomplete" && details.incompleteReason === "max_output_tokens") {
    const limit = maxOutputTokens ? `${maxOutputTokens} token đầu ra` : "giới hạn token đầu ra";
    const reasoning = details.reasoningTokens > 0 ? `, trong đó ${details.reasoningTokens} token dùng cho suy luận` : "";
    return `AI đã dùng hết ${limit}${reasoning} trước khi hoàn tất JSON giáo án.`;
  }
  if (details.status === "incomplete") {
    return `AI dừng trước khi hoàn tất JSON giáo án (${details.incompleteReason || "không rõ nguyên nhân"}).`;
  }
  return "AI không trả về nội dung giáo án.";
}
