import { afterEach, describe, expect, it, vi } from "vitest";
import { withGenerationDeadline } from "./runtime";
import { fetchAiJsonContent } from "./ai-json-client";
import type { AiStageStrategy } from "@/lib/model-strategy";

const originalApiKey = process.env.OPENAI_API_KEY;

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalApiKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = originalApiKey;
});

describe("shared AI JSON client", () => {
  it("returns validated JSON content and records the selected model", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify({ lessonTitle: "Bài học" }) } }],
        usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
      }),
    }));
    const strategy: AiStageStrategy = {
      stage: "blueprint",
      provider: "openai",
      model: "gpt-4.1-mini",
      temperature: 0.3,
      timeoutMs: 1_000,
    };

    const result = await withGenerationDeadline(
      "shared-client-test",
      () => fetchAiJsonContent(strategy, [{ role: "user", content: "Return JSON" }]),
      undefined,
      30_000,
    );
    expect(result).toMatchObject({
      content: JSON.stringify({ lessonTitle: "Bài học" }),
      model: "gpt-4.1-mini",
      provider: "openai",
      fallbackUsed: false,
    });
  });
});
