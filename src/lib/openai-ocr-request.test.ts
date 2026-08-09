import { describe, expect, it } from "vitest";
import { buildOpenAiOcrRequest } from "./openai-ocr-request";

const image = "data:image/jpeg;base64,abc";

describe("OpenAI OCR request", () => {
  it("uses Luna Responses API with no reasoning and high image detail", () => {
    const request = buildOpenAiOcrRequest({
      model: "gpt-5.6-luna",
      imageDataUrls: [image],
      reasoningEffort: "none",
      maxOutputTokens: 12_000,
    });

    expect(request.useResponsesApi).toBe(true);
    expect(request.body).toMatchObject({
      model: "gpt-5.6-luna",
      reasoning: { effort: "none" },
      max_output_tokens: 12_000,
      input: [{ content: [{ type: "input_text" }, { type: "input_image", image_url: image, detail: "high" }] }],
    });
  });

  it("keeps GPT-4o-mini fallback on chat completions with high detail", () => {
    const request = buildOpenAiOcrRequest({
      model: "gpt-4o-mini",
      imageDataUrls: [image],
      reasoningEffort: "none",
      maxOutputTokens: 12_000,
    });

    expect(request.useResponsesApi).toBe(false);
    expect(request.body).toMatchObject({
      model: "gpt-4o-mini",
      max_tokens: 12_000,
      messages: [{ content: [{ type: "text" }, { type: "image_url", image_url: { url: image, detail: "high" } }] }],
    });
    expect(request.body).not.toHaveProperty("reasoning");
  });
});
