import "server-only";
import { extractAiJsonValue } from "@/lib/ai-json";
import { normalizeAiUsage } from "@/lib/generation-telemetry";
import {
  GENERATION_SAVE_RESERVE_MS,
  GenerationTimeoutError,
  abortSignalForRequest,
  beginGenerationAiCall,
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

function parseSyntacticallyCompleteJson<T>(raw: string): T {
  const trimmed = raw.trim();
  let candidate = trimmed;
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced) candidate = fenced[1].trim();
  if ((!candidate.startsWith("{") || !candidate.endsWith("}")) && (!candidate.startsWith("[") || !candidate.endsWith("]"))) {
    throw new Error("AI trả về phản hồi bị cắt ngang hoặc không trọn vẹn cú pháp JSON. Hãy tạo lại ở bước kế tiếp.");
  }
  try {
    const parsed = JSON.parse(candidate) as unknown;
    if (!parsed || typeof parsed !== "object") {
      throw new Error("Cấu trúc phản hồi AI phải là object hoặc array hợp lệ.");
    }
    return parsed as T;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Cú pháp JSON không hoàn chỉnh.";
    throw new Error(`AI trả về phản hồi chưa đúng cú pháp JSON nguyên vẹn (${message}).`);
  }
}

export function aiResponseCompletionError(data: unknown, useResponsesApi: boolean, maxOutputTokens?: number) {
  const response = data && typeof data === "object" ? data as {
    error?: unknown;
    incomplete_details?: unknown;
    output?: Array<{ status?: unknown }>;
    choices?: Array<{ finish_reason?: unknown; message?: { refusal?: unknown } }>;
  } : {};
  if (response.error) return "Nhà cung cấp AI trả về lỗi thay vì nội dung đã hoàn tất.";
  if (useResponsesApi) {
    const details = inspectOpenAiResponsesOutput(data);
    if (details.status === "incomplete") return describeOpenAiResponsesEmptyOutput(data, maxOutputTokens);
    if (details.status !== "completed" || response.incomplete_details
      || response.output?.some((item) => item.status != null && item.status !== "completed")) {
      return `AI chưa xác nhận hoàn tất phản hồi (status: ${details.status}).`;
    }
  } else {
    const choice = response.choices?.[0];
    if (choice?.finish_reason === "length") {
      return "AI đã chạm giới hạn token đầu ra trước khi hoàn tất nội dung (finish_reason: length).";
    }
    if (choice?.finish_reason !== "stop" || choice.message?.refusal) {
      return `AI chưa xác nhận hoàn tất nội dung (finish_reason: ${String(choice?.finish_reason ?? "unknown")}).`;
    }
  }
  return null;
}

export function normalizeOpenAiError(raw: string, status?: number, singleAttempt = false, provider?: string) {
  const providerName = provider === "gateway" ? "AI Gateway" : "OpenAI";
  console.error("[EduPlan AI] OpenAI API error response:", { status, raw });
  if (status && status >= 500) {
    return singleAttempt
      ? `${providerName} đang lỗi tạm thời hoặc quá tải (5xx). Vui lòng thử lại ở yêu cầu kế tiếp.`
      : `${providerName} đang lỗi tạm thời hoặc quá tải (5xx). App đã thử lại tự động; vui lòng bấm tạo lại sau ít phút nếu lỗi còn xảy ra.`;
  }
  if (/rate.?limit|429/i.test(raw)) {
    return `${providerName} đang bị giới hạn tốc độ/quota. Hãy chờ một lát rồi thử lại${provider === "gateway" ? " hoặc đổi model OCR trong Admin." : " hoặc kiểm tra billing/quota của OpenAI key."}`;
  }
  if (/invalid_api_key|incorrect api key|401|Unauthorized/i.test(raw)) {
    return `${providerName} API key không hợp lệ hoặc không có quyền truy cập model hiện tại.`;
  }
  if (/insufficient_quota/i.test(raw)) {
    return `${providerName} key đã hết quota hoặc chưa bật billing. Hãy kiểm tra tài khoản ${providerName}.`;
  }
  if (/<html|<!DOCTYPE html|cloudflare/i.test(raw)) {
    return "AI Gateway/OpenAI trả về trang lỗi HTML. Đây thường là lỗi dịch vụ tạm thời, không phải lỗi nội dung giáo án.";
  }
  return raw || `OpenAI failed with ${status || "unknown status"}`;
}

export function normalizeOpenAiFetchError(
  error: unknown,
  model: string,
  timeoutMs = OPENAI_REQUEST_TIMEOUT_MS,
  singleAttempt = false,
) {
  const message = error instanceof Error ? error.message : String(error || "fetch failed");
  if (/abort|timeout|timed out/i.test(message)) {
    const nextStep = singleAttempt
      ? "Hãy thử lại ở yêu cầu kế tiếp."
      : "Hệ thống sẽ thử tuyến dự phòng nếu có.";
    return `AI xử lý quá lâu và đã hết thời gian chờ (${Math.round(timeoutMs / 1000)} giây) với model ${model}. ${nextStep}`;
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
  const policy = currentGenerationContext()?.aiPolicy;
  const selectedAttempts = policy?.singleAttempt
    ? [policy.useFallback && attempts.length > 1 ? attempts[1] : attempts[0]]
    : attempts;
  let primaryMessage = "AI không phản hồi.";
  let lastMessage = primaryMessage;
  for (let selectedIndex = 0; selectedIndex < selectedAttempts.length; selectedIndex += 1) {
    const selected = selectedAttempts[selectedIndex];
    const fallbackUsed = policy?.singleAttempt
      ? Boolean(policy.useFallback && attempts.length > 1)
      : selectedIndex > 0;
    const apiKey = selected.provider === "openrouter"
      ? process.env.OPENROUTER_API_KEY
      : selected.provider === "gateway"
        ? (selected.gatewayApiKey || process.env.NINEROUTER_API_KEY || "sk-30291fde1e5baa54-rmony8-33298b25")
        : process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error(selected.provider === "openrouter"
        ? "Thiếu OPENROUTER_API_KEY trong file .env."
        : "Thiếu OPENAI_API_KEY trong file .env.");
    }
    const configuredRetries = selected.provider === "openrouter"
      ? openRouterTransientRetries()
      : OPENAI_TRANSIENT_RETRIES;
    const configuredTimeoutMs = policy?.requestTimeoutMs ?? (selected.provider === "openrouter"
      ? openRouterRequestTimeoutMs(selected.stage)
      : selected.timeoutMs || OPENAI_REQUEST_TIMEOUT_MS);
    const remainingBeforeAttempt = remainingGenerationMs() - GENERATION_SAVE_RESERVE_MS;
    if (remainingBeforeAttempt < (fallbackUsed ? MIN_FALLBACK_BUDGET_MS : 5_000)) {
      lastMessage = "Không còn đủ thời gian an toàn để gọi model AI tiếp theo.";
      break;
    }
    const requestTimeoutMs = Math.max(1_000, Math.min(configuredTimeoutMs, remainingBeforeAttempt));
    const maxRetries = policy?.singleAttempt || fallbackUsed || attempts.length > 1 ? 0 : configuredRetries;
    const maxOutputTokens = selected.maxOutputTokens;
    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      const useResponsesApi = usesOpenAiResponsesApi(selected);
      const openRouterTokens = selected.provider === "openrouter"
        ? Math.min(openRouterMaxTokens(selected.stage), maxOutputTokens || 16_000)
        : undefined;
      const requestBody = useResponsesApi
        ? buildOpenAiResponsesJsonRequest(selected, messages)
        : {
            model: selected.model,
            stream: false,
            response_format: { type: "json_object" },
            ...(selected.provider === "openrouter" ? {
              max_tokens: openRouterTokens,
              provider: openRouterProviderPreferences(),
            } : (maxOutputTokens ? { max_tokens: maxOutputTokens } : {})),
            ...(selected.reasoningEffort ? { reasoning_effort: selected.reasoningEffort } : (selected.provider === "gateway" ? { reasoning_effort: "low" } : {})),
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
        const gatewayBaseUrl = (selected.gatewayBaseUrl || process.env.NINEROUTER_API_BASE_URL || "http://158.178.235.87:20128/v1").replace(/\/+$/, "");
        const endpoint = selected.provider === "openrouter"
          ? "https://openrouter.ai/api/v1/chat/completions"
          : selected.provider === "gateway"
            ? `${gatewayBaseUrl}/chat/completions`
            : useResponsesApi
              ? "https://api.openai.com/v1/responses"
              : "https://api.openai.com/v1/chat/completions";
        beginGenerationAiCall();
        const response = await fetch(endpoint, {
          method: "POST",
          headers,
          body: JSON.stringify(requestBody),
          signal: abortSignalForRequest(controller),
        });
        if (response.ok) {
          const data = (await response.json()) as {
            status?: string;
            choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
            usage?: Record<string, unknown>;
          };
          const completionError = policy?.singleAttempt
            ? aiResponseCompletionError(data, useResponsesApi, selected.maxOutputTokens)
            : null;

          if (completionError) {
            recordGenerationCall({
              scope: selected.stage, provider: selected.provider, model: selected.model, fallbackUsed,
              outcome: "invalid_output", elapsedMs: Date.now() - startedAt, ...normalizeAiUsage(data),
            });
            lastMessage = completionError;
            break;
          }

          const content = useResponsesApi
            ? extractOpenAiResponsesText(data)
            : data.choices?.[0]?.message?.content || "";

          if (content) {
            try {
              if (policy?.singleAttempt) {
                parseSyntacticallyCompleteJson<unknown>(content);
              } else {
                extractAiJsonValue<unknown>(content);
              }
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
        lastMessage = normalizeOpenAiError(text, response.status, Boolean(policy?.singleAttempt), selected.provider);
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
        lastMessage = normalizeOpenAiFetchError(error, selected.model, requestTimeoutMs, Boolean(policy?.singleAttempt));
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
  if (!policy?.singleAttempt && attempts.length > 1 && primaryMessage !== lastMessage) {
    throw new Error(`Model chính: ${primaryMessage}; model dự phòng: ${lastMessage}`);
  }
  throw new Error(lastMessage);
}
