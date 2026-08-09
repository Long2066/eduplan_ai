import { describe, expect, it } from "vitest";
import { buildOpenAiResponsesJsonRequest, usesOpenAiResponsesApi } from "./openai-json-request";
import type { AiStageStrategy } from "./model-strategy";

const detailStrategy: AiStageStrategy = {
  stage: "detail",
  provider: "openai",
  model: "gpt-5.6-terra",
  temperature: 0.6,
  reasoningEffort: "low",
  maxOutputTokens: 16_000,
};

describe("OpenAI Responses JSON request", () => {
  it("keeps Terra on the Responses API contract", () => {
    expect(usesOpenAiResponsesApi(detailStrategy)).toBe(true);
    expect(usesOpenAiResponsesApi({ ...detailStrategy, model: "gpt-4.1-mini" })).toBe(false);
  });

  it("includes stage reasoning, JSON output format and output limit", () => {
    const messages = [{ role: "user" as const, content: "Soạn giáo án" }];

    expect(buildOpenAiResponsesJsonRequest(detailStrategy, messages)).toEqual({
      model: "gpt-5.6-terra",
      input: messages,
      reasoning: { effort: "low" },
      text: { format: { type: "json_object" } },
      max_output_tokens: 16_000,
    });
  });
});
