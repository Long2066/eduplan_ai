import { afterEach, describe, expect, it, vi } from "vitest";
import { withGenerationDeadline } from "./runtime";
import { fetchAiJsonContent } from "./ai-json-client";
import type { AiStageStrategy } from "@/lib/model-strategy";

const originalApiKey = process.env.OPENAI_API_KEY;

const originalRouterKey = process.env.OPENROUTER_API_KEY;

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalApiKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = originalApiKey;
  if (originalRouterKey === undefined) delete process.env.OPENROUTER_API_KEY;
  else process.env.OPENROUTER_API_KEY = originalRouterKey;
});

describe("shared AI JSON client", () => {
  it("returns validated JSON content and records the selected model", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify({ lessonTitle: "Bài học" }) }, finish_reason: "stop" }],
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

  it("selects fallback model directly on subsequent HTTP when useFallback=true under singleAttempt", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "{\"fallback\":true}" }, finish_reason: "stop" }],
        usage: { prompt_tokens: 5, completion_tokens: 5, total_tokens: 10 },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const strategy: AiStageStrategy = {
      stage: "blueprint",
      provider: "openai",
      model: "primary-model",
      fallbackModel: "fallback-model",
      fallbackProvider: "openai",
      temperature: 0.2,
    };

    const result = await withGenerationDeadline(
      "fallback-request",
      () => fetchAiJsonContent(strategy, [{ role: "user", content: "Run" }]),
      (context) => {
        context.aiPolicy = { singleAttempt: true, useFallback: true };
      },
      60_000,
    );

    expect(result.model).toBe("fallback-model");
    expect(result.fallbackUsed).toBe(true);
    expect(fetchMock).toHaveBeenCalledOnce();
    const calledBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(calledBody.model).toBe("fallback-model");
  });

  it("strictly rejects chat completion with finish_reason: length under singleAttempt", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "{\"incomplete\": true" }, finish_reason: "length" }],
      }),
    }));

    const strategy: AiStageStrategy = {
      stage: "detail",
      provider: "openai",
      model: "gpt-4.1-mini",
      temperature: 0.5,
    };

    await expect(withGenerationDeadline(
      "length-reject-test",
      () => fetchAiJsonContent(strategy, [{ role: "user", content: "Gen" }]),
      (context) => {
        context.aiPolicy = { singleAttempt: true, useFallback: false };
      },
      30_000,
    )).rejects.toThrow(/chạm giới hạn token/);
  });

  it("strictly rejects Responses API with status: incomplete under singleAttempt", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "incomplete",
        incomplete_details: { reason: "max_output_tokens" },
        output_text: "{\"cut_off\": true",
      }),
    }));

    const strategy: AiStageStrategy = {
      stage: "detail",
      provider: "openai",
      model: "gpt-5.4-mini",
      temperature: 0.5,
    };

    await expect(withGenerationDeadline(
      "responses-reject-test",
      () => fetchAiJsonContent(strategy, [{ role: "user", content: "Gen" }]),
      (context) => {
        context.aiPolicy = { singleAttempt: true, useFallback: false };
      },
      30_000,
    )).rejects.toThrow(/hết|dừng trước khi hoàn tất/);
  });

  it("strictly rejects cut-off JSON requiring repair under singleAttempt without repairing it", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "{\"items\": [\"a\", \"b\"" }, finish_reason: "stop" }],
      }),
    }));

    const strategy: AiStageStrategy = {
      stage: "detail",
      provider: "openai",
      model: "gpt-4.1-mini",
      temperature: 0.5,
    };

    await expect(withGenerationDeadline(
      "no-repair-test",
      () => fetchAiJsonContent(strategy, [{ role: "user", content: "Gen" }]),
      (context) => {
        context.aiPolicy = { singleAttempt: true, useFallback: false };
      },
      30_000,
    )).rejects.toThrow(/cắt ngang hoặc không trọn vẹn cú pháp JSON/);
  });

  it("accepts syntactically complete JSON inside optional markdown code fence", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{
          message: { content: "```json\n{\"fenced\": true, \"count\": 3}\n```" },
          finish_reason: "stop",
        }],
      }),
    }));

    const strategy: AiStageStrategy = {
      stage: "blueprint",
      provider: "openai",
      model: "gpt-4.1-mini",
      temperature: 0.3,
    };

    const result = await withGenerationDeadline(
      "fenced-test",
      () => fetchAiJsonContent(strategy, [{ role: "user", content: "Gen" }]),
      (context) => {
        context.aiPolicy = { singleAttempt: true, useFallback: false };
      },
      30_000,
    );

    expect(result.content).toContain("\"fenced\": true");
  });

  it("caps OpenRouter max_tokens according to stage strategy tokens and respects shape", async () => {
    process.env.OPENROUTER_API_KEY = "test-router-key";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "{\"router\": true}" }, finish_reason: "stop" }],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const strategy: AiStageStrategy = {
      stage: "blueprint",
      provider: "openrouter",
      model: "anthropic/claude-3.5-sonnet",
      temperature: 0.2,
      maxOutputTokens: 2500,
    };

    await withGenerationDeadline(
      "openrouter-shape-test",
      () => fetchAiJsonContent(strategy, [{ role: "user", content: "Router" }]),
      (context) => {
        context.aiPolicy = { singleAttempt: true, useFallback: false };
      },
      30_000,
    );

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, requestInit] = fetchMock.mock.calls[0];
    expect(url).toBe("https://openrouter.ai/api/v1/chat/completions");
    const parsed = JSON.parse(requestInit.body);
    expect(parsed.max_tokens).toBe(2500);
    expect(parsed.provider).toEqual({ require_parameters: true, allow_fallbacks: true });
  });

  it("produces truthful error without claiming automatic retry when singleAttempt policy is active", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      text: async () => "Service Unavailable",
    }));

    const strategy: AiStageStrategy = {
      stage: "detail",
      provider: "openai",
      model: "gpt-4.1-mini",
      temperature: 0.5,
    };

    let caughtMessage = "";
    try {
      await withGenerationDeadline(
        "truthful-error-test",
        () => fetchAiJsonContent(strategy, [{ role: "user", content: "Run" }]),
        (context) => {
          context.aiPolicy = { singleAttempt: true, useFallback: false };
        },
        30_000,
      );
    } catch (error) {
      caughtMessage = (error as Error).message;
    }
    expect(caughtMessage).not.toContain("App đã thử lại tự động");
    expect(caughtMessage).toContain("Vui lòng thử lại ở yêu cầu kế tiếp");
  });
});
