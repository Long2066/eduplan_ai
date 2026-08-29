import "server-only";
import { extractAiJsonValue } from "@/lib/ai-json";
import { normalizeAiUsage } from "@/lib/generation-telemetry";
import {
  GENERATION_SAVE_RESERVE_MS,
  GenerationTimeoutError,
  abortSignalForRequest,
  currentGenerationContext,
  recordGenerationCall,
  remainingGenerationMs,
} from "@/lib/generation/runtime";
import type { AiGenerationResult, AiStageStrategy } from "@/lib/model-strategy";
import {
  buildOpenAiResponsesJsonRequest,
  describeOpenAiResponsesEmptyOutput,
  extractOpenAiResponsesText,
  inspectOpenAiResponsesOutput,
  usesOpenAiResponsesApi,
  type OpenAiJsonMessage,
} from "@/lib/openai-json-request";
import {
  isOpenRouterTransientError,
  isOpenRouterTransientStatus,
  openRouterMaxTokens,
  openRouterProviderPreferences,
  openRouterRequestTimeoutMs,
  openRouterTransientRetries,
} from "@/lib/openrouter-request";

export const OPENAI_TRANSIENT_RETRIES = 2;
const OPENAI_REQUEST_TIMEOUT_MS = Number(process.env.OPENAI_REQUEST_TIMEOUT_MS || 120_000);
const MIN_FALLBACK_BUDGET_MS = 25_000;

export function waitForAiRetry(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function normalizeOpenAiError(raw: string, status?: number) {
  console.error("[EduPlan AI] OpenAI API error response:", { status, raw });
  if (status && status >= 500) {
    return "OpenAI đang lỗi tạm thời hoặc quá tải (5xx/Cloudflare). App đã thử lại tự động; vui lòng bấm tạo lại sau ít phút nếu lỗi còn xảy ra.";
  }
  if (/rate.?limit|429/i.test(raw)) {
    return "OpenAI đang bị giới hạn tốc độ/quota. Hãy chờ một lát rồi thử lại hoặc kiểm tra billing/quota của OpenAI key.";
  }
  if (/invalid_api_key|incorrect api key|401|Unauthorized/i.test(raw)) {
    return "OpenAI API key trong .env.local không hợp lệ hoặc không có quyền truy cập model hiện tại.";
  }
  if (/insufficient_quota/i.test(raw)) {
    return "OpenAI key đã hết quota hoặc chưa bật billing. Hãy kiểm tra tài khoản OpenAI.";
  }
  if (/<html|<!DOCTYPE html|cloudflare/i.test(raw)) {
    return "OpenAI trả về trang lỗi HTML từ Cloudflare. Đây thường là lỗi dịch vụ tạm thời, không phải lỗi nội dung giáo án.";
  }
  return raw || `OpenAI failed with ${status || "unknown status"}`;
}

export function normalizeOpenAiFetchError(error: unknown, model: string, timeoutMs = OPENAI_REQUEST_TIMEOUT_MS) {
  const message = error instanceof Error ? error.message : String(error || "fetch failed");
  if (/abort|timeout|timed out/i.test(message)) {
    return `AI xử lý quá lâu và đã hết thời gian chờ (${Math.round(timeoutMs / 1000)} giây) với model ${model}. Hệ thống sẽ thử tuyến dự phòng nếu có.`;
  }
  if (/fetch failed|network|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|socket|terminated/i.test(message)) {
    return `Không kết nối ổn định tới nhà cung cấp AI khi gọi model ${model}. Hãy thử lại sau ít phút.`;
  }
  return message;
}

export async function fetchAiJsonContent(
  strategy: AiStageStrategy,
  messages: OpenAiJsonMessage[],
): Promise<AiGenerationResult> {
  const attempts: AiStageStrategy[] = [strategy];
  if (strategy.fallbackModel && strategy.fallbackProvider
    && (strategy.fallbackModel !== strategy.model || strategy.fallbackProvider !== strategy.provider)) {
    attempts.push({
      ...strategy,
      provider: strategy.fallbackProvider,
      model: strategy.fallbackModel,
      reasoningEffort: strategy.fallbackReasoningEffort ?? strategy.reasoningEffort,
      timeoutMs: strategy.fallbackTimeoutMs ?? strategy.timeoutMs,
      maxOutputTokens: strategy.fallbackMaxOutputTokens ?? strategy.maxOutputTokens,
    });
  }
  let primaryMessage = "AI không phản hồi.";
  let lastMessage = primaryMessage;
  for (let selectedIndex = 0; selectedIndex < attempts.length; selectedIndex += 1) {
    const selected = attempts[selectedIndex];
    const fallbackUsed = selectedIndex > 0;
    const apiKey = selected.provider === "openrouter" ? process.env.OPENROUTER_API_KEY : process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error(selected.provider === "openrouter"
        ? "Thiếu OPENROUTER_API_KEY trong file .env."
        : "Thiếu OPENAI_API_KEY trong file .env.");
    }
    const configuredRetries = selected.provider === "openrouter"
      ? openRouterTransientRetries()
      : OPENAI_TRANSIENT_RETRIES;
    const configuredTimeoutMs = selected.provider === "openrouter"
      ? openRouterRequestTimeoutMs(selected.stage)
      : selected.timeoutMs || OPENAI_REQUEST_TIMEOUT_MS;
    const remainingBeforeAttempt = remainingGenerationMs() - GENERATION_SAVE_RESERVE_MS;
    if (remainingBeforeAttempt < (fallbackUsed ? MIN_FALLBACK_BUDGET_MS : 5_000)) {
      lastMessage = "Không còn đủ thời gian an toàn để gọi model AI tiếp theo.";
      break;
    }
    const requestTimeoutMs = Math.max(1_000, Math.min(configuredTimeoutMs, remainingBeforeAttempt));
    const maxRetries = fallbackUsed || attempts.length > 1 ? 0 : configuredRetries;
    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      const useResponsesApi = usesOpenAiResponsesApi(selected);
      const requestBody = useResponsesApi
        ? buildOpenAiResponsesJsonRequest(selected, messages)
        : {
            model: selected.model,
            response_format: { type: "json_object" },
            ...(selected.provider === "openrouter" ? {
              max_tokens: openRouterMaxTokens(selected.stage),
              provider: openRouterProviderPreferences(),
            } : {}),
            temperature: selected.temperature,
            messages,
          };
      const controller = new AbortController();
      let requestTimedOut = false;
      const timeout = setTimeout(() => {
        requestTimedOut = true;
        controller.abort();
      }, requestTimeoutMs);
      const startedAt = Date.now();
      try {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        };
        if (selected.provider === "openrouter") {
          if (process.env.OPENROUTER_APP_URL) headers["HTTP-Referer"] = process.env.OPENROUTER_APP_URL;
          headers["X-Title"] = process.env.OPENROUTER_APP_NAME || "EduPlan AI";
        }
        const endpoint = selected.provider === "openrouter"
          ? "https://openrouter.ai/api/v1/chat/completions"
          : useResponsesApi
            ? "https://api.openai.com/v1/responses"
            : "https://api.openai.com/v1/chat/completions";
        const response = await fetch(endpoint, {
          method: "POST",
          headers,
          body: JSON.stringify(requestBody),
          signal: abortSignalForRequest(controller),
        });
        if (response.ok) {
          const data = (await response.json()) as {
            choices?: Array<{ message?: { content?: string } }>;
            usage?: Record<string, unknown>;
          };
          const content = useResponsesApi
            ? extractOpenAiResponsesText(data)
            : data.choices?.[0]?.message?.content || "";
          if (content) {
            try {
              extractAiJsonValue<unknown>(content);
              recordGenerationCall({
                scope: selected.stage,
                provider: selected.provider,
                model: selected.model,
                fallbackUsed,
                outcome: "success",
                elapsedMs: Date.now() - startedAt,
                ...normalizeAiUsage(data),
              });
              if (fallbackUsed) currentGenerationContext()?.fallbackModels.add(selected.model);
              console.info("[EduPlan AI] AI stage completed", {
                requestId: currentGenerationContext()?.requestId,
                stage: selected.stage,
                provider: selected.provider,
                model: selected.model,
                fallbackUsed,
                elapsedMs: Date.now() - startedAt,
              });
              return { content, model: selected.model, provider: selected.provider, fallbackUsed };
            } catch (parseError) {
              recordGenerationCall({
                scope: selected.stage,
                provider: selected.provider,
                model: selected.model,
                fallbackUsed,
                outcome: "invalid_output",
                elapsedMs: Date.now() - startedAt,
                ...normalizeAiUsage(data),
              });
              lastMessage = parseError instanceof Error ? parseError.message : "AI trả về JSON không hợp lệ.";
              console.warn("[EduPlan AI] Invalid AI JSON triggers fallback", {
                requestId: currentGenerationContext()?.requestId,
                stage: selected.stage,
                model: selected.model,
                contentLength: content.length,
              });
              break;
            }
          }
          recordGenerationCall({
            scope: selected.stage,
            provider: selected.provider,
            model: selected.model,
            fallbackUsed,
            outcome: "invalid_output",
            elapsedMs: Date.now() - startedAt,
            ...normalizeAiUsage(data),
          });
          lastMessage = useResponsesApi
            ? describeOpenAiResponsesEmptyOutput(data, selected.maxOutputTokens)
            : "AI không trả về nội dung giáo án.";
          console.warn("[EduPlan AI] Empty AI response triggers fallback", {
            requestId: currentGenerationContext()?.requestId,
            stage: selected.stage,
            model: selected.model,
            maxOutputTokens: selected.maxOutputTokens,
            ...(useResponsesApi ? inspectOpenAiResponsesOutput(data) : {}),
          });
          break;
        }
        const text = await response.text();
        recordGenerationCall({
          scope: selected.stage,
          provider: selected.provider,
          model: selected.model,
          fallbackUsed,
          outcome: "http_error",
          elapsedMs: Date.now() - startedAt,
          httpStatus: response.status,
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
        });
        lastMessage = normalizeOpenAiError(text, response.status);
        const retryable = selected.provider === "openrouter"
          ? isOpenRouterTransientStatus(response.status)
          : response.status === 429 || response.status >= 500;
        if (retryable && attempt < maxRetries
          && remainingGenerationMs() > requestTimeoutMs + GENERATION_SAVE_RESERVE_MS) {
          await waitForAiRetry(900 * (attempt + 1));
          continue;
        }
        break;
      } catch (error) {
        const generationTimedOut = Boolean(currentGenerationContext()?.controller.signal.aborted);
        recordGenerationCall({
          scope: selected.stage,
          provider: selected.provider,
          model: selected.model,
          fallbackUsed,
          outcome: requestTimedOut || generationTimedOut ? "timeout" : "network_error",
          elapsedMs: Date.now() - startedAt,
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
        });
        if (generationTimedOut) throw new GenerationTimeoutError();
        lastMessage = normalizeOpenAiFetchError(error, selected.model, requestTimeoutMs);
        const retryable = selected.provider !== "openrouter" || isOpenRouterTransientError(error);
        if (retryable && attempt < maxRetries
          && remainingGenerationMs() > requestTimeoutMs + GENERATION_SAVE_RESERVE_MS) {
          await waitForAiRetry(900 * (attempt + 1));
          continue;
        }
      } finally {
        clearTimeout(timeout);
      }
    }
    if (selectedIndex === 0) primaryMessage = lastMessage;
    console.warn("[EduPlan AI] AI stage fallback", {
      requestId: currentGenerationContext()?.requestId,
      stage: strategy.stage,
      failedModel: selected.model,
      message: lastMessage,
      remainingMs: remainingGenerationMs(),
    });
  }
  if (attempts.length > 1 && primaryMessage !== lastMessage) {
    throw new Error(`Model chính: ${primaryMessage}; model dự phòng: ${lastMessage}`);
  }
  throw new Error(lastMessage);
}
