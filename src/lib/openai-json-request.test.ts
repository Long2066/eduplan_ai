import { describe, expect, it } from "vitest";
import {
  buildOpenAiResponsesJsonRequest,
  describeOpenAiResponsesEmptyOutput,
  extractOpenAiResponsesText,
  inspectOpenAiResponsesOutput,
  usesOpenAiResponsesApi,
} from "./openai-json-request";
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

  it("extracts text from top-level and nested Responses output", () => {
    expect(extractOpenAiResponsesText({ output_text: '{"ok":true}' })).toBe('{"ok":true}');
    expect(extractOpenAiResponsesText({
      output: [{ type: "message", content: [{ type: "output_text", text: '{"lesson":1}' }] }],
    })).toBe('{"lesson":1}');
  });

  it("diagnoses reasoning-token exhaustion instead of reporting generic empty output", () => {
    const response = {
      status: "incomplete",
      incomplete_details: { reason: "max_output_tokens" },
      usage: { output_tokens: 6000, output_tokens_details: { reasoning_tokens: 6000 } },
      output: [{ type: "reasoning" }],
    };

    expect(inspectOpenAiResponsesOutput(response)).toEqual({
      status: "incomplete",
      incompleteReason: "max_output_tokens",
      reasoningTokens: 6000,
      outputItemTypes: ["reasoning"],
    });
    expect(describeOpenAiResponsesEmptyOutput(response, 6000))
      .toContain("6000 token dùng cho suy luận");
  });
});
