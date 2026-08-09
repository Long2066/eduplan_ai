import fs from "fs";
import path from "path";
import { AsyncLocalStorage } from "node:async_hooks";

// Force load .env.local to override host system environment variables
try {
  const envLocalPath = path.resolve(process.cwd(), ".env.local");
  if (fs.existsSync(envLocalPath)) {
    const envContent = fs.readFileSync(envLocalPath, "utf8");
    const envVars = envContent.split("\n");
    for (const line of envVars) {
      const match = line.trim().match(/^([^#\s=]+)\s*=\s*(.*)$/);
      if (match) {
        const key = match[1];
        let val = match[2].trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        process.env[key] = val;
      }
    }
  }
} catch (e) {
  console.error("Failed to force load .env.local:", e);
}

import { NextResponse } from "next/server";
import { lessonExpiresAt, requireUser } from "@/lib/auth-server";
import { getFirebaseDb } from "@/lib/firebase-admin";
import { getPlanModelStrategy, type AiGenerationResult, type AiStageStrategy, type PlanModelStrategy } from "@/lib/model-strategy";
import { buildOpenAiResponsesJsonRequest, usesOpenAiResponsesApi, type OpenAiJsonMessage } from "@/lib/openai-json-request";
import { buildOpenAiOcrRequest } from "@/lib/openai-ocr-request";
import { normalizeAiUsage, summarizeGenerationCalls, type GenerationCallMetric } from "@/lib/generation-telemetry";
import { validateLessonImagePayload } from "@/lib/lesson-image-payload";
import { commitUsage, releaseUsage, reserveUsage, subscriptionErrorResponse, type UsageReservation } from "@/lib/subscription-policy";
import {
  activityMinutes,
  activityPhaseKey,
  canonicalizeOrderedActivityPhases,
  pairedActivityActions,
  phaseKey,
  requiredActivityPhases,
  safeStringArray,
} from "@/lib/lesson-format";
import { normalizeMathContentDeep } from "@/lib/math-content";
import { validateMathLesson } from "@/lib/math-quality-validator";
import { validateNaturalSocialLesson } from "@/lib/natural-social-quality-validator";
import { normalizeNaturalSocialSourceInventory, validateNaturalSocialTaskCoverage } from "@/lib/natural-social-task-coverage";
import { mergeNaturalSocialSourceInventories } from "@/lib/natural-social-source-inventory";
import {
  readNaturalSocialSourceInventory,
  upsertNaturalSocialSourceInventory,
} from "@/lib/natural-social-source-inventory-store";
import {
  applyNaturalSocialStartupGuardrails,
  selectNaturalSocialStartup,
} from "@/lib/natural-social-startup";
import { validateVietnameseLesson } from "@/lib/vietnamese-quality-validator";
import { validateVietnameseTaskCoverage } from "@/lib/vietnamese-task-coverage";
import { applyVietnameseMechanicalRepair, vietnameseAiRepairFindings } from "@/lib/vietnamese-mechanical-repair";
import {
  buildVietnameseSourceInventoryPromptContext,
  hashUploadedAsset,
  mergeVietnameseSourceInventories,
} from "@/lib/vietnamese-source-inventory";
import {
  readCachedOcrText,
  readVietnameseSourceInventory,
  saveCachedOcrText,
  upsertVietnameseSourceInventory,
} from "@/lib/vietnamese-source-inventory-store";
import { validateLessonQuality } from "@/lib/lesson-quality-validator";
import { validateLessonTime } from "@/lib/lesson-time-validator";
import {
  buildMathContinuityPlan,
  buildNaturalSocialContinuityPlan,
  buildVietnameseContinuityPlan,
  validateLessonContinuity,
} from "@/lib/lesson-continuity";
import {
  findingsForPeriod,
  formatRepairFinding,
  MAX_LESSON_REPAIR_ROUNDS,
  runQualityRepairLoop,
} from "@/lib/lesson-repair-policy";
import { extractAiJsonValue } from "@/lib/ai-json";
import {
  isOpenRouterTransientError,
  isOpenRouterTransientStatus,
  openRouterMaxTokens,
  openRouterProviderPreferences,
  openRouterRequestTimeoutMs,
  openRouterTransientRetries,
} from "@/lib/openrouter-request";
import { getPedagogyProfile, gradeBandFor } from "@/lib/pedagogy-profiles";
import {
  classifyNaturalSocialLesson,
  getNaturalSocialChecklist,
  getNaturalSocialPedagogyProfile,
  isNaturalSocialSubjectName,
  isNaturalSocialTopicFocus,
  naturalSocialLessonTypeProfiles,
  naturalSocialSourceInventoryText,
} from "@/lib/natural-social-pedagogy";
import { classifyVietnameseLesson, getVietnameseChecklist, isVietnameseSubjectName, vietnameseLessonTypeProfiles } from "@/lib/vietnamese-pedagogy";
import type {
  LessonActivityErrorFeedback,
  LessonInput,
  LessonOutcomes,
  LessonPlan,
  PedagogyAudit,
  PeriodPlan,
  UploadedAsset,
  MathLessonBlueprint,
  MathPeriodBlueprint,
  MathPeriodChunk,
  MathActivityBlueprint,
  NaturalSocialActivityBlueprint,
  NaturalSocialClassification,
  NaturalSocialLessonBlueprint,
  NaturalSocialSourceInventory,
  NaturalSocialLessonType,
  NaturalSocialPeriodBlueprint,
  NaturalSocialPeriodChunk,
  VietnameseLessonType,
  VietnameseLessonClassification,
  VietnameseLessonBlueprint,
  VietnamesePeriodBlueprint,
  VietnamesePeriodChunk,
  VietnameseActivityBlueprint,
} from "@/types/lesson";


import {
  curriculumGuidance,
  startupGuidance,
  creativeTeachingGuidance,
  deepTeachingScriptGuidance,
  qualityGuidance,
  bookContext,
  localityContext,
  isLocalLessonContext,
  elementaryLocalityGuidance,
  learningContextGuidance,
  pedagogyProfileGuidance,
  buildSubjectSystemRole,
  buildSubjectPrompt,
  buildSubjectRepairPrompt,
  buildMathBlueprintPrompt,
  buildMathPeriodPrompt,
  buildMathPeriodRepairPrompt,
  buildNaturalSocialBlueprintPrompt,
  buildNaturalSocialPeriodPrompt,
  buildNaturalSocialPeriodRepairPrompt,
  buildVietnameseBlueprintPrompt,
  buildVietnamesePeriodPrompt,
  buildVietnamesePeriodRepairPrompt,
} from "@/lib/subject-prompts";

import {
  periodHasRequiredPhases,
  hasEqualActionPairs,
  hasWeaklyPairedActions,
  maxActionPairsForDuration,
  hasTooManyActionPairs,
  hasDetailedOutcomeGroup,
  subjectPedagogyIssues,
  subjectPedagogyRepairGuidance,
  hasSubjectPedagogySignals,
  buildPedagogyAudit,
  mathPeriodIssues,
  naturalSocialPeriodIssues,
  vietnamesePeriodIssues,
} from "@/lib/subject-checkers";

export const maxDuration = 300;

type GenerateResponse = {
  lesson?: LessonPlan;
  lessonId?: string;
  error?: string;
  stage?: "ocr" | "openai" | "unknown";
  ocrTextLength?: number;
  pedagogyAudit?: PedagogyAudit;
  modelRouting?: {
    primaryModel: string;
    modelUsed: string;
    fallbackUsed: boolean;
  };
};

const OPENAI_TRANSIENT_RETRIES = 2;
function positiveEnvNumber(value: string | undefined, fallback: number, minimum: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= minimum ? Math.floor(parsed) : fallback;
}
const OPENAI_OCR_BATCH_SIZE = Number(process.env.OPENAI_OCR_BATCH_SIZE || 3);
const OPENAI_OCR_MODEL = (process.env.OPENAI_OCR_MODEL || "gpt-5.6-luna").trim();
const OPENAI_OCR_FALLBACK_MODEL = (process.env.OPENAI_OCR_FALLBACK_MODEL || "gpt-4o-mini").trim();
const OPENAI_OCR_REASONING_EFFORT = ["none", "minimal", "low", "medium", "high"].includes(String(process.env.OPENAI_OCR_REASONING_EFFORT))
  ? String(process.env.OPENAI_OCR_REASONING_EFFORT)
  : "none";
const OPENAI_OCR_MAX_OUTPUT_TOKENS = positiveEnvNumber(process.env.OPENAI_OCR_MAX_OUTPUT_TOKENS, 12_000, 1_000);
const OPENAI_OCR_REQUEST_TIMEOUT_MS = positiveEnvNumber(process.env.OPENAI_OCR_REQUEST_TIMEOUT_MS, 60_000, 10_000);
const OPENAI_REQUEST_TIMEOUT_MS = Number(process.env.OPENAI_REQUEST_TIMEOUT_MS || 120000);
const GENERATION_SOFT_TIMEOUT_MS = Math.min(280000, Number(process.env.GENERATION_SOFT_TIMEOUT_MS || 270000));
const GENERATION_SAVE_RESERVE_MS = 12000;
const MIN_FALLBACK_BUDGET_MS = 25000;
const MIN_PERIOD_REPAIR_BUDGET_MS = Number(process.env.MIN_PERIOD_REPAIR_BUDGET_MS || 70000);
const MIN_QUALITY_REPAIR_BUDGET_MS = Number(process.env.MIN_QUALITY_REPAIR_BUDGET_MS || 85000);

type GenerationContext = {
  requestId: string;
  startedAt: number;
  deadlineAt: number;
  controller: AbortController;
  fallbackModels: Set<string>;
  calls: GenerationCallMetric[];
};

const generationContextStore = new AsyncLocalStorage<GenerationContext>();

function currentGenerationContext() {
  return generationContextStore.getStore();
}

function recordGenerationCall(metric: GenerationCallMetric) {
  currentGenerationContext()?.calls.push(metric);
}

function readOpenRouterTimeoutMs(stage: AiStageStrategy["stage"]) {
  return openRouterRequestTimeoutMs(stage);
}

function readOpenRouterRetries() {
  return openRouterTransientRetries();
}

function remainingGenerationMs() {
  return currentGenerationContext() ? currentGenerationContext()!.deadlineAt - Date.now() : Number.POSITIVE_INFINITY;
}

function hasGenerationBudget(minWorkMs: number) {
  return remainingGenerationMs() - GENERATION_SAVE_RESERVE_MS >= minWorkMs;
}

function canStartAiRepair(scope: string, minWorkMs: number, details: Record<string, unknown> = {}) {
  if (hasGenerationBudget(minWorkMs)) return true;
  console.info("[EduPlan AI] AI repair skipped by time budget", {
    requestId: currentGenerationContext()?.requestId,
    scope,
    remainingMs: Math.max(0, Math.round(remainingGenerationMs())),
    requiredWorkMs: minWorkMs,
    saveReserveMs: GENERATION_SAVE_RESERVE_MS,
    ...details,
  });
  return false;
}

function abortSignalForRequest(controller: AbortController) {
  const signal = currentGenerationContext()?.controller.signal;
  if (!signal) return controller.signal;
  if (signal.aborted) controller.abort();
  else signal.addEventListener("abort", () => controller.abort(), { once: true });
  return controller.signal;
}

function parseDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:(.+);base64,(.+)$/);
  if (!match) return null;
  return { mimeType: match[1], data: match[2] };
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class GenerationTimeoutError extends Error {
  constructor() {
    super("Quá trình tạo giáo án vượt thời gian xử lý an toàn. Lượt sử dụng đã được hoàn lại; vui lòng thử lại.");
    this.name = "GENERATION_TIMEOUT";
  }
}

async function withGenerationDeadline<T>(
  requestId: string,
  operation: () => Promise<T>,
  onContext?: (context: GenerationContext) => void,
): Promise<T> {
  const controller = new AbortController();
  const context: GenerationContext = {
    requestId,
    startedAt: Date.now(),
    deadlineAt: Date.now() + GENERATION_SOFT_TIMEOUT_MS,
    controller,
    fallbackModels: new Set<string>(),
    calls: [],
  };
  onContext?.(context);
  return generationContextStore.run(context, async () => {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<never>((_, reject) => {
      timeout = setTimeout(() => {
        controller.abort();
        reject(new GenerationTimeoutError());
      }, GENERATION_SOFT_TIMEOUT_MS);
    });
    try {
      return await Promise.race([operation(), deadline]);
    } finally {
      controller.abort();
      if (timeout) clearTimeout(timeout);
    }
  });
}

function normalizeOpenAiError(raw: string, status?: number) {
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

function normalizeOpenAiFetchError(error: unknown, model: string, timeoutMs = OPENAI_REQUEST_TIMEOUT_MS) {
  const message = error instanceof Error ? error.message : String(error || "fetch failed");
  if (/abort|timeout|timed out/i.test(message)) {
    return `AI xử lý quá lâu và đã hết thời gian chờ (${Math.round(timeoutMs / 1000)} giây) với model ${model}. Hệ thống sẽ thử tuyến dự phòng nếu có.`;
  }
  if (/fetch failed|network|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|socket|terminated/i.test(message)) {
    return `Không kết nối ổn định tới nhà cung cấp AI khi gọi model ${model}. Hãy thử lại sau ít phút.`;
  }
  return message;
}

type OpenAiMessage = OpenAiJsonMessage;
type OpenAiJsonRequest = {
  model: string;
  temperature: number;
  messages: OpenAiMessage[];
};

type GenerateLessonOptions = {
  vietnameseSourceInventory?: VietnameseLessonBlueprint["sourceInventory"];
  naturalSocialSourceInventory?: NaturalSocialSourceInventory;
};

function extractResponsesText(data: unknown) {
  const response = data as {
    output_text?: string;
    output?: Array<{ content?: Array<{ text?: string; type?: string }> }>;
  };
  if (response.output_text) return response.output_text;
  return response.output?.flatMap((item) => item.content || []).map((part) => part.text || "").join("\n").trim() || "";
}

async function fetchAiJsonContent(strategy: AiStageStrategy, messages: OpenAiMessage[]): Promise<AiGenerationResult> {
  const attempts: AiStageStrategy[] = [strategy];
  if (strategy.fallbackModel && strategy.fallbackProvider && (strategy.fallbackModel !== strategy.model || strategy.fallbackProvider !== strategy.provider)) {
    attempts.push({ ...strategy, provider: strategy.fallbackProvider, model: strategy.fallbackModel });
  }
  let primaryMessage = "AI không phản hồi.";
  let lastMessage = primaryMessage;
  for (let selectedIndex = 0; selectedIndex < attempts.length; selectedIndex += 1) {
    const selected = attempts[selectedIndex];
    const fallbackUsed = selectedIndex > 0;
    const apiKey = selected.provider === "openrouter" ? process.env.OPENROUTER_API_KEY : process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error(selected.provider === "openrouter" ? "Thiếu OPENROUTER_API_KEY trong file .env." : "Thiếu OPENAI_API_KEY trong file .env.");
    const configuredRetries = selected.provider === "openrouter" ? readOpenRouterRetries() : OPENAI_TRANSIENT_RETRIES;
    const configuredTimeoutMs = selected.provider === "openrouter" ? readOpenRouterTimeoutMs(selected.stage) : selected.timeoutMs || OPENAI_REQUEST_TIMEOUT_MS;
    const remainingBeforeAttempt = remainingGenerationMs() - GENERATION_SAVE_RESERVE_MS;
    if (remainingBeforeAttempt < (fallbackUsed ? MIN_FALLBACK_BUDGET_MS : 5000)) {
      lastMessage = "Không còn đủ thời gian an toàn để gọi model AI tiếp theo.";
      break;
    }
    const requestTimeoutMs = Math.max(1000, Math.min(configuredTimeoutMs, remainingBeforeAttempt));
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
      const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
      const startedAt = Date.now();
      try {
        const headers: Record<string, string> = { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` };
        if (selected.provider === "openrouter") {
          if (process.env.OPENROUTER_APP_URL) headers["HTTP-Referer"] = process.env.OPENROUTER_APP_URL;
          headers["X-Title"] = process.env.OPENROUTER_APP_NAME || "EduPlan AI";
        }
        const endpoint = selected.provider === "openrouter" ? "https://openrouter.ai/api/v1/chat/completions" : useResponsesApi ? "https://api.openai.com/v1/responses" : "https://api.openai.com/v1/chat/completions";
        const response = await fetch(endpoint, { method: "POST", headers, body: JSON.stringify(requestBody), signal: abortSignalForRequest(controller) });
        if (response.ok) {
          const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }>; usage?: Record<string, unknown> };
          const content = useResponsesApi ? extractResponsesText(data) : data.choices?.[0]?.message?.content || "";
          if (content) {
            try {
              extractAiJsonValue<unknown>(content);
              recordGenerationCall({ scope: selected.stage, provider: selected.provider, model: selected.model, fallbackUsed, outcome: "success", elapsedMs: Date.now() - startedAt, ...normalizeAiUsage(data) });
              if (fallbackUsed) currentGenerationContext()?.fallbackModels.add(selected.model);
              console.info("[EduPlan AI] AI stage completed", { requestId: currentGenerationContext()?.requestId, stage: selected.stage, provider: selected.provider, model: selected.model, fallbackUsed, elapsedMs: Date.now() - startedAt });
              return { content, model: selected.model, provider: selected.provider, fallbackUsed };
            } catch (parseError) {
              recordGenerationCall({ scope: selected.stage, provider: selected.provider, model: selected.model, fallbackUsed, outcome: "invalid_output", elapsedMs: Date.now() - startedAt, ...normalizeAiUsage(data) });
              lastMessage = parseError instanceof Error ? parseError.message : "AI trả về JSON không hợp lệ.";
              console.warn("[EduPlan AI] Invalid AI JSON triggers fallback", { requestId: currentGenerationContext()?.requestId, stage: selected.stage, model: selected.model, contentLength: content.length });
              break;
            }
          }
          recordGenerationCall({ scope: selected.stage, provider: selected.provider, model: selected.model, fallbackUsed, outcome: "invalid_output", elapsedMs: Date.now() - startedAt, ...normalizeAiUsage(data) });
          lastMessage = "AI không trả về nội dung giáo án.";
          break;
        }
        const text = await response.text();
        recordGenerationCall({ scope: selected.stage, provider: selected.provider, model: selected.model, fallbackUsed, outcome: "http_error", elapsedMs: Date.now() - startedAt, httpStatus: response.status, inputTokens: 0, outputTokens: 0, totalTokens: 0 });
        lastMessage = normalizeOpenAiError(text, response.status);
        const retryable = selected.provider === "openrouter"
          ? isOpenRouterTransientStatus(response.status)
          : response.status === 429 || response.status >= 500;
        if (retryable && attempt < maxRetries && remainingGenerationMs() > requestTimeoutMs + GENERATION_SAVE_RESERVE_MS) {
          await wait(900 * (attempt + 1));
          continue;
        }
        break;
      } catch (error) {
        recordGenerationCall({ scope: selected.stage, provider: selected.provider, model: selected.model, fallbackUsed, outcome: "network_error", elapsedMs: Date.now() - startedAt, inputTokens: 0, outputTokens: 0, totalTokens: 0 });
        if (currentGenerationContext()?.controller.signal.aborted) throw new GenerationTimeoutError();
        lastMessage = normalizeOpenAiFetchError(error, selected.model, requestTimeoutMs);
        const retryable = selected.provider !== "openrouter" || isOpenRouterTransientError(error);
        if (retryable && attempt < maxRetries && remainingGenerationMs() > requestTimeoutMs + GENERATION_SAVE_RESERVE_MS) {
          await wait(900 * (attempt + 1));
          continue;
        }
      } finally {
        clearTimeout(timeout);
      }
    }
    if (selectedIndex === 0) primaryMessage = lastMessage;
    console.warn("[EduPlan AI] AI stage fallback", { requestId: currentGenerationContext()?.requestId, stage: strategy.stage, failedModel: selected.model, message: lastMessage, remainingMs: remainingGenerationMs() });
  }
  if (attempts.length > 1 && primaryMessage !== lastMessage) {
    throw new Error(`Model chính: ${primaryMessage}; model dự phòng: ${lastMessage}`);
  }
  throw new Error(lastMessage);
}

function chunkAssets(assets: UploadedAsset[], size: number) {
  const chunks: UploadedAsset[][] = [];
  for (let index = 0; index < assets.length; index += size) {
    chunks.push(assets.slice(index, index + size));
  }
  return chunks;
}

function imageLabel(asset: UploadedAsset, index: number) {
  return asset.name || `ảnh ${index + 1}`;
}

function sequenceFromFileName(name?: string) {
  const baseName = (name || "").replace(/\.[^.]+$/, "");
  const exactNumber = baseName.match(/^\s*0*(\d+)\s*$/);
  if (exactNumber) return Number(exactNumber[1]);

  const labeledNumber = baseName.match(/(?:^|[\s._-])(?:trang|page|p|sgk|anh|ảnh)?\s*0*(\d+)(?=$|[\s._-])/i);
  return labeledNumber ? Number(labeledNumber[1]) : null;
}

function sortAssetsByFileSequence(assets: UploadedAsset[]) {
  return assets
    .map((asset, uploadIndex) => ({
      asset,
      uploadIndex,
      order: typeof asset.order === "number" && Number.isFinite(asset.order) ? asset.order : null,
      sequence: sequenceFromFileName(asset.name),
    }))
    .sort((a, b) => {
      if (a.order !== null && b.order !== null && a.order !== b.order) return a.order - b.order;
      if (a.order !== null && b.order === null) return -1;
      if (a.order === null && b.order !== null) return 1;
      if (a.sequence !== null && b.sequence !== null && a.sequence !== b.sequence) return a.sequence - b.sequence;
      if (a.sequence !== null && b.sequence === null) return -1;
      if (a.sequence === null && b.sequence !== null) return 1;
      return a.uploadIndex - b.uploadIndex;
    })
    .map((item) => item.asset);
}

async function ocrImagesWithOpenAi(assets: UploadedAsset[], apiKey: string, batchLabel: string) {
  const imageDataUrls = assets.flatMap((asset) => asset.dataUrl && parseDataUrl(asset.dataUrl) ? [asset.dataUrl] : []);
  if (!imageDataUrls.length) return { text: "", model: OPENAI_OCR_MODEL, fallbackUsed: false };

  const models = [OPENAI_OCR_MODEL];
  if (OPENAI_OCR_FALLBACK_MODEL && OPENAI_OCR_FALLBACK_MODEL !== OPENAI_OCR_MODEL) models.push(OPENAI_OCR_FALLBACK_MODEL);
  let primaryMessage = "OpenAI OCR không phản hồi.";
  let lastMessage = primaryMessage;

  for (const [modelIndex, model] of models.entries()) {
    const fallbackUsed = modelIndex > 0;
    const { useResponsesApi, body } = buildOpenAiOcrRequest({
      model,
      imageDataUrls,
      reasoningEffort: model === OPENAI_OCR_MODEL ? OPENAI_OCR_REASONING_EFFORT : "none",
      maxOutputTokens: OPENAI_OCR_MAX_OUTPUT_TOKENS,
    });
    const maxRetries = models.length > 1 ? 0 : OPENAI_TRANSIENT_RETRIES;

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      const remainingForOcr = remainingGenerationMs() - GENERATION_SAVE_RESERVE_MS;
      if (remainingForOcr < (fallbackUsed ? 10_000 : 5_000)) throw new GenerationTimeoutError();
      const requestTimeoutMs = Math.max(1_000, Math.min(OPENAI_OCR_REQUEST_TIMEOUT_MS, remainingForOcr));
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
      const startedAt = Date.now();

      try {
        const response = await fetch(
          useResponsesApi ? "https://api.openai.com/v1/responses" : "https://api.openai.com/v1/chat/completions",
          {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
            body: JSON.stringify(body),
            signal: abortSignalForRequest(controller),
          },
        );

        if (response.ok) {
          const data = await response.json();
          const text = useResponsesApi
            ? extractResponsesText(data).trim()
            : (data.choices?.[0]?.message?.content || "").trim();
          if (text.length >= 20) {
            recordGenerationCall({ scope: "ocr", provider: "openai", model, fallbackUsed, outcome: "success", elapsedMs: Date.now() - startedAt, ...normalizeAiUsage(data) });
            console.info("[EduPlan AI] OCR model completed", { model, fallbackUsed, batchLabel, textLength: text.length });
            return { text, model, fallbackUsed };
          }
          recordGenerationCall({ scope: "ocr", provider: "openai", model, fallbackUsed, outcome: "invalid_output", elapsedMs: Date.now() - startedAt, ...normalizeAiUsage(data) });
          lastMessage = `OpenAI OCR chưa đọc đủ nội dung ở ${batchLabel}. Hãy thử ảnh rõ hơn hoặc crop sát vùng SGK.`;
          break;
        }

        recordGenerationCall({ scope: "ocr", provider: "openai", model, fallbackUsed, outcome: "http_error", elapsedMs: Date.now() - startedAt, httpStatus: response.status, inputTokens: 0, outputTokens: 0, totalTokens: 0 });
        lastMessage = normalizeOpenAiError(await response.text(), response.status);
        if ((response.status === 429 || response.status >= 500) && attempt < maxRetries) {
          await wait(700 * (attempt + 1));
          continue;
        }
        break;
      } catch (error) {
        recordGenerationCall({ scope: "ocr", provider: "openai", model, fallbackUsed, outcome: "network_error", elapsedMs: Date.now() - startedAt, inputTokens: 0, outputTokens: 0, totalTokens: 0 });
        if (currentGenerationContext()?.controller.signal.aborted) throw new GenerationTimeoutError();
        lastMessage = normalizeOpenAiFetchError(error, model, requestTimeoutMs);
        if (attempt < maxRetries) {
          await wait(700 * (attempt + 1));
          continue;
        }
      } finally {
        clearTimeout(timeout);
      }
    }

    if (modelIndex === 0) primaryMessage = lastMessage;
    if (modelIndex < models.length - 1) {
      console.warn("[EduPlan AI] OCR model fallback", { failedModel: model, fallbackModel: models[modelIndex + 1], batchLabel, message: lastMessage });
    }
  }

  throw new Error(models.length > 1 ? `OCR chính: ${primaryMessage}; OCR dự phòng: ${lastMessage}` : lastMessage);
}

async function runOpenAiOcr(input: LessonInput) {
  const assets = sortAssetsByFileSequence(input.uploadedAssets.filter((asset) => asset.dataUrl && parseDataUrl(asset.dataUrl)));
  if (!assets.length) return { text: "", sourceHashes: [] as string[], cacheHitCount: 0, cacheMissCount: 0 };

  const sourceHashes = assets.map(hashUploadedAsset).filter(Boolean);
  const cacheEnabled = process.env.LESSON_SOURCE_CACHE_ENABLED !== "false";

  if (cacheEnabled) {
    const cachedOrGeneratedParts = new Array<string>(assets.length).fill("");
    const missingAssets: Array<{ asset: UploadedAsset; index: number; hash: string }> = [];
    let cacheHitCount = 0;

    for (const [index, asset] of assets.entries()) {
      const hash = hashUploadedAsset(asset);
      let cachedText: string | null = null;
      if (hash) {
        try {
          cachedText = await readCachedOcrText(hash);
        } catch (cacheError) {
          console.warn("[EduPlan AI] OCR cache read skipped", { assetName: asset.name, message: cacheError instanceof Error ? cacheError.message : "Unknown cache error" });
        }
      }
      if (cachedText) {
        cachedOrGeneratedParts[index] = cachedText;
        cacheHitCount += 1;
      } else {
        missingAssets.push({ asset, index, hash });
      }
    }

    if (missingAssets.length) {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) throw new Error("Thiếu OPENAI_API_KEY trong file .env.");
      console.info("[EduPlan AI] OCR OpenAI started for cache misses", {
        model: OPENAI_OCR_MODEL,
        imageCount: assets.length,
        cacheHitCount,
        cacheMissCount: missingAssets.length,
        order: assets.map((asset, index) => ({ index: index + 1, name: asset.name, order: asset.order, sequence: sequenceFromFileName(asset.name) })),
      });
      for (const { asset, index } of missingAssets) {
        const singleLabel = `ảnh ${index + 1}/${assets.length}: ${imageLabel(asset, index)}`;
        const result = await ocrImagesWithOpenAi([asset], apiKey, singleLabel);
        cachedOrGeneratedParts[index] = result.text;
        try {
          await saveCachedOcrText(asset, result.text, result.model);
        } catch (cacheError) {
          console.warn("[EduPlan AI] OCR cache write skipped", { assetName: asset.name, message: cacheError instanceof Error ? cacheError.message : "Unknown cache error" });
        }
      }
    } else {
      console.info("[EduPlan AI] OCR cache hit for all uploaded assets", { imageCount: assets.length, cacheHitCount });
    }

    const cachedText = cachedOrGeneratedParts.filter(Boolean).join("\n\n--- HẾT ẢNH ---\n\n").trim();
    if (cachedText.length < 40) {
      throw new Error("OpenAI OCR không đọc được đủ nội dung từ ảnh. Hãy thử ảnh rõ hơn, ít nhiễu hơn hoặc crop sát vùng SGK.");
    }
    console.info("[EduPlan AI] OCR completed with cache layer", { model: OPENAI_OCR_MODEL, textLength: cachedText.length, cacheHitCount, cacheMissCount: missingAssets.length });
    return { text: cachedText, sourceHashes, cacheHitCount, cacheMissCount: missingAssets.length };
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Thiếu OPENAI_API_KEY trong file .env.");

  const batches = chunkAssets(assets, OPENAI_OCR_BATCH_SIZE);
  const ocrParts: string[] = [];
  console.info("[EduPlan AI] OCR OpenAI started", {
    model: OPENAI_OCR_MODEL,
    imageCount: assets.length,
    batchCount: batches.length,
    order: assets.map((asset, index) => ({ index: index + 1, name: asset.name, order: asset.order, sequence: sequenceFromFileName(asset.name) })),
  });

  for (const [batchIndex, batch] of batches.entries()) {
    const batchLabel = `batch ${batchIndex + 1}/${batches.length}`;
    try {
      console.info("[EduPlan AI] OCR OpenAI batch started", { model: OPENAI_OCR_MODEL, imageCount: batch.length, batchLabel });
      ocrParts.push((await ocrImagesWithOpenAi(batch, apiKey, batchLabel)).text);
    } catch (error) {
      if (batch.length > 1) {
        console.warn("[EduPlan AI] OCR OpenAI batch failed; retrying as single images", { batchLabel, imageCount: batch.length });
        for (const [imageIndex, asset] of batch.entries()) {
          const singleLabel = `${batchLabel} / ${imageLabel(asset, imageIndex)}`;
          try {
            ocrParts.push((await ocrImagesWithOpenAi([asset], apiKey, singleLabel)).text);
          } catch (singleError) {
            const message = singleError instanceof Error ? singleError.message : "OpenAI OCR thất bại với một ảnh.";
            throw new Error(`${message} Ảnh nghi ngờ: ${imageLabel(asset, imageIndex)}.`);
          }
        }
        continue;
      }
      throw error;
    }
  }

  const text = ocrParts.filter(Boolean).join("\n\n--- HẾT BATCH ẢNH ---\n\n").trim();
  if (text.length < 40) {
    throw new Error("OpenAI OCR không đọc được đủ nội dung từ ảnh. Hãy thử ảnh rõ hơn, ít nhiễu hơn hoặc crop sát vùng SGK.");
  }

  console.info("[EduPlan AI] OCR OpenAI completed", { model: OPENAI_OCR_MODEL, textLength: text.length, batchCount: batches.length });
  return { text, sourceHashes, cacheHitCount: 0, cacheMissCount: assets.length };
}


function isMathSubject(input: LessonInput) {
  return /^(toán|toan)$/i.test((input.subject || "").trim());
}

function isVietnameseSubject(input: LessonInput) {
  return isVietnameseSubjectName(input.subject);
}

function isNaturalSocialSubject(input: LessonInput) {
  return isNaturalSocialSubjectName(input.subject);
}

function promptOcrContext(ocrText: string, maxLength = 15000) {
  const text = (ocrText || "").trim();
  if (text.length <= maxLength) return text;
  const headLength = Math.floor(maxLength * 0.68);
  const tailLength = maxLength - headLength;
  return `${text.slice(0, headLength)}

...[Đã rút gọn phần giữa của nội dung ảnh SGK để giảm timeout; giữ phần đầu và phần cuối để đối chiếu mạch bài]...

${text.slice(-tailLength)}`;
}

function asStringList(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item || "").trim()).filter(Boolean) : [];
}

function mathPhaseDuration(phase: string, input: LessonInput): number {
  const duration = Number(input.duration || 35);
  const key = phaseKey(phase);
  if (key === "Khởi động") return Math.max(3, Math.min(5, Math.round(duration * 0.12)));
  if (key === "Khám phá") return Math.max(13, Math.min(17, Math.round(duration * 0.45)));
  if (key === "Luyện tập") return Math.max(8, Math.min(11, Math.round(duration * 0.28)));
  if (key === "Vận dụng") return Math.max(3, duration - mathPhaseDuration("Khởi động", input) - mathPhaseDuration("Khám phá", input) - mathPhaseDuration("Luyện tập", input));
  return 5;
}

function findActivityBlueprint(period: MathPeriodBlueprint, phase: string, index: number) {
  const activities = Array.isArray(period.activities) ? period.activities : [];
  return activities.find((activity) => activityPhaseKey(activity) === phase) || activities[index] || {};
}

function normalizeMathBlueprint(input: LessonInput, rawBlueprint: MathLessonBlueprint): MathLessonBlueprint {
  const expectedPeriods = Math.max(1, Number(input.periods || 1));
  const rawPeriods = Array.isArray(rawBlueprint.periods) ? rawBlueprint.periods : [];
  const lessonTitle = rawBlueprint.lessonTitle?.trim() || input.lessonTitle || "Bài học Toán";
  const periods = Array.from({ length: expectedPeriods }, (_, index) => {
    const periodNumber = index + 1;
    const rawPeriod = rawPeriods.find((period) => Number(period.periodNumber) === periodNumber) || rawPeriods[index] || {};
    const focus = rawPeriod.focus?.trim() || (expectedPeriods > 1 ? `Tiết ${periodNumber}: trọng tâm ${lessonTitle}` : `Trọng tâm ${lessonTitle}`);
    return {
      periodNumber,
      focus,
      objectives: asStringList(rawPeriod.objectives).length ? asStringList(rawPeriod.objectives) : [`Hình thành và luyện tập trọng tâm Toán của ${focus}.`],
      prerequisite: rawPeriod.prerequisite || "Kiến thức nền được ôn qua hoạt động khởi động.",
      targetKnowledge: rawPeriod.targetKnowledge || focus,
      continuityIn: rawPeriod.continuityIn || (periodNumber === 1 ? "Bắt đầu từ trải nghiệm, tranh/ảnh trong SGK và kiến thức nền đã học." : `Nối tiếp kết quả học tập của tiết ${periodNumber - 1}.`),
      continuityOut: rawPeriod.continuityOut || (periodNumber < expectedPeriods ? `Chuẩn bị cho trọng tâm tiết ${periodNumber + 1}.` : "Chốt bài và vận dụng vào tình huống gần gũi."),
      activities: requiredActivityPhases.map((phase, activityIndex) => {
        const activity = findActivityBlueprint(rawPeriod, phase, activityIndex);
        return {
          phase,
          title: activity.title || phase,
          objective: activity.objective || `Tổ chức hoạt động ${phase.toLowerCase()} bám trọng tâm ${focus}.`,
          durationMinutes: Number(activity.durationMinutes || mathPhaseDuration(phase, input)),
          mathFocus: activity.mathFocus || rawPeriod.targetKnowledge || focus,
          handoffToNext: activity.handoffToNext || (activityIndex < requiredActivityPhases.length - 1 ? `Chuyển từ ${phase} sang ${requiredActivityPhases[activityIndex + 1]}.` : rawPeriod.continuityOut || "Chốt tiết học."),
          sourceUnitIds: safeStringArray(activity.sourceUnitIds),
          sourceClusterIds: safeStringArray(activity.sourceClusterIds),
        };
      }),
    };
  });

  return {
    lessonTitle,
    lessonOverview: rawBlueprint.lessonOverview || `Giáo án Toán ${lessonTitle} được sinh theo blueprint để giữ mạch logic giữa các tiết/hoạt động.`,
    mathCore: {
      problemType: rawBlueprint.mathCore?.problemType || "Dạng toán xác định từ ảnh SGK.",
      knowledgeFocus: asStringList(rawBlueprint.mathCore?.knowledgeFocus).length ? asStringList(rawBlueprint.mathCore?.knowledgeFocus) : ["Xác định dữ kiện, quan hệ toán học, phép tính/quy trình và kiểm tra kết quả."],
      representations: asStringList(rawBlueprint.mathCore?.representations).length ? asStringList(rawBlueprint.mathCore?.representations) : ["Sơ đồ/tóm tắt trực quan phù hợp bài học", "Bảng hoặc hình vẽ khi cần"],
      commonMisconceptions: asStringList(rawBlueprint.mathCore?.commonMisconceptions).length ? asStringList(rawBlueprint.mathCore?.commonMisconceptions) : ["Nhầm dữ kiện, quan hệ giữa các đại lượng, phép tính hoặc đơn vị."],
      checkStrategies: asStringList(rawBlueprint.mathCore?.checkStrategies).length ? asStringList(rawBlueprint.mathCore?.checkStrategies) : ["Đối chiếu kết quả với dữ kiện ban đầu", "Kiểm tra đơn vị và ý nghĩa thực tế của đáp số"],
      continuityRules: asStringList(rawBlueprint.mathCore?.continuityRules).length ? asStringList(rawBlueprint.mathCore?.continuityRules) : ["Mỗi hoạt động phải nối tiếp sản phẩm học tập của hoạt động trước.", "Không lặp lại cùng một cách khởi động giữa các tiết."],
    },
    outcomes: rawBlueprint.outcomes || {},
    materials: {
      teacher: asStringList(rawBlueprint.materials?.teacher).length ? asStringList(rawBlueprint.materials?.teacher) : ["Ảnh SGK/tranh bài toán", "Bảng phụ hoặc phiếu tóm tắt", "Thẻ số/thẻ dữ kiện"],
      students: asStringList(rawBlueprint.materials?.students).length ? asStringList(rawBlueprint.materials?.students) : ["SGK", "Vở Toán", "Bảng con hoặc phiếu học tập"],
    },
    assessment: {
      criteria: asStringList(rawBlueprint.assessment?.criteria).length ? asStringList(rawBlueprint.assessment?.criteria) : ["Xác định đúng dữ kiện, yêu cầu và quan hệ toán học.", "Trình bày được cách làm, phép tính và kiểm tra kết quả."],
      evidence: asStringList(rawBlueprint.assessment?.evidence).length ? asStringList(rawBlueprint.assessment?.evidence) : ["Phiếu học tập/bài làm của học sinh", "Câu trả lời giải thích cách làm và bước kiểm tra"],
      comments: asStringList(rawBlueprint.assessment?.comments).length ? asStringList(rawBlueprint.assessment?.comments) : ["Nhận xét quá trình phân tích đề, lựa chọn phép tính và kiểm tra kết quả."],
    },
    contextFit: {
      notes: asStringList(rawBlueprint.contextFit?.notes),
    },
    continuityPlan: buildMathContinuityPlan(periods, expectedPeriods, rawBlueprint.continuityPlan),
    periods,
  };
}


function mathPeriodBlueprintFor(blueprint: MathLessonBlueprint, periodNumber: number) {
  return blueprint.periods?.find((period) => Number(period.periodNumber) === periodNumber) || blueprint.periods?.[periodNumber - 1];
}



function activityFromMathBlueprint(activity: MathActivityBlueprint, index: number): LessonPlan["activities"][number] {
  const phase = activityPhaseKey(activity) || requiredActivityPhases[index] || `Hoạt động ${index + 1}`;
  return {
    phase,
    title: activity.title || phase,
    objective: activity.objective || `Giúp học sinh hoàn thành hoạt động ${phase.toLowerCase()}.`,
    durationMinutes: activity.durationMinutes || 5,
    teacherActions: [
      `GV tổ chức hoạt động ${phase.toLowerCase()} bám trọng tâm Toán, yêu cầu học sinh quan sát dữ kiện và nêu cách nghĩ ban đầu.`,
      "GV gợi hỏi để học sinh xác định dữ kiện, yêu cầu, quan hệ toán học và cách kiểm tra kết quả.",
    ],
    studentActions: [
      "HS quan sát, nêu dữ kiện, trao đổi cách hiểu và chia sẻ dự đoán ban đầu.",
      "HS trả lời câu hỏi, hoàn thành nhiệm vụ ngắn và đối chiếu kết quả với yêu cầu bài toán.",
    ],
    learningProducts: [`Sản phẩm học tập của hoạt động ${phase.toLowerCase()}: câu trả lời, tóm tắt hoặc bài làm ngắn của học sinh.`],
    sourceUnitIds: safeStringArray(activity.sourceUnitIds),
    sourceClusterIds: safeStringArray(activity.sourceClusterIds),
  };
}

function normalizeMathPeriodChunk(
  input: LessonInput,
  blueprint: MathLessonBlueprint,
  periodBlueprint: MathPeriodBlueprint,
  rawChunk: MathPeriodChunk,
): MathPeriodChunk {
  const periodNumber = Number(rawChunk.periodNumber || periodBlueprint.periodNumber || 1);
  const title = blueprint.lessonTitle || input.lessonTitle || "Bài học Toán";
  const rawActivities = Array.isArray(rawChunk.activities) ? rawChunk.activities : [];
  const activities = requiredActivityPhases.map((phase, index) => {
    const activityBlueprint = findActivityBlueprint(periodBlueprint, phase, index);
    const source = rawActivities.find((activity) => activityPhaseKey(activity) === phase) || rawActivities[index] || activityFromMathBlueprint(activityBlueprint, index);
    return normalizeActivity(
      {
        ...source,
        phase,
        title: source.title || activityBlueprint.title || phase,
        objective: source.objective || activityBlueprint.objective || `Tổ chức hoạt động ${phase.toLowerCase()} cho tiết ${periodNumber}.`,
        durationMinutes: source.durationMinutes || activityBlueprint.durationMinutes || mathPhaseDuration(phase, input),
        sourceUnitIds: safeStringArray(source.sourceUnitIds).length ? safeStringArray(source.sourceUnitIds) : asStringList(activityBlueprint.sourceUnitIds),
        sourceClusterIds: safeStringArray(source.sourceClusterIds).length ? safeStringArray(source.sourceClusterIds) : asStringList(activityBlueprint.sourceClusterIds),
      },
      index,
    );
  });

  return {
    periodNumber,
    focus: rawChunk.focus || periodBlueprint.focus || `Tiết ${periodNumber}: ${title}`,
    outcomes: normalizeNaturalSocialOutcomes(rawChunk.outcomes || blueprint.outcomes, `${title} - tiết ${periodNumber}`),
    activities,
    handoff: rawChunk.handoff || {
      learned: periodBlueprint.continuityOut || `Học sinh hoàn thành trọng tâm tiết ${periodNumber}.`,
      unresolvedRisks: blueprint.mathCore?.commonMisconceptions || [],
      nextBridge: periodBlueprint.continuityOut || "Chuyển sang hoạt động/tiết tiếp theo.",
    },
  };
}


async function generateMathBlueprintWithModel(input: LessonInput, ocrText: string, strategy: AiStageStrategy) {
  console.info("[EduPlan AI] Math chunked blueprint started", { model: strategy.model, periods: input.periods });
  const result = await fetchAiJsonContent(strategy, [
    { role: "system", content: "Bạn chỉ trả JSON hợp lệ. Nhiệm vụ là tạo blueprint môn Toán tiểu học để các bước sau sinh từng tiết/hoạt động liền mạch, không viết giáo án đầy đủ ở bước này." },
    { role: "user", content: buildMathBlueprintPrompt(input, ocrText) },
  ]);
  return normalizeMathBlueprint(input, extractJson<MathLessonBlueprint>(result.content));
}

async function generateMathPeriodWithModel(input: LessonInput, ocrText: string, strategy: AiStageStrategy, blueprint: MathLessonBlueprint, period: MathPeriodBlueprint, previousHandoff: MathPeriodChunk["handoff"] | null) {
  const periodNumber = Number(period.periodNumber || 1);
  console.info("[EduPlan AI] Math chunked period started", { model: strategy.model, periodNumber, focus: period.focus });
  const result = await fetchAiJsonContent(strategy, [
    { role: "system", content: "Bạn chỉ trả JSON hợp lệ cho một tiết Toán. Viết đủ dùng dạy thật, nhưng kiểm soát độ dài để tránh timeout." },
    { role: "user", content: buildMathPeriodPrompt(input, ocrText, blueprint, period, previousHandoff) },
  ]);
  return normalizeMathPeriodChunk(input, blueprint, period, extractJson<MathPeriodChunk>(result.content));
}

async function repairMathPeriodWithModel(input: LessonInput, strategy: AiStageStrategy, blueprint: MathLessonBlueprint, period: MathPeriodChunk, issues: string[]) {
  console.info("[EduPlan AI] Math chunked period repair started", { model: strategy.model, periodNumber: period.periodNumber, issueCount: issues.length });
  const result = await fetchAiJsonContent(strategy, [
    { role: "system", content: "Bạn chỉ trả JSON hợp lệ. Nhiệm vụ là sửa một PeriodPlan môn Toán, giữ mạch blueprint và không viết lại toàn bộ bài." },
    { role: "user", content: buildMathPeriodRepairPrompt(input, blueprint, period, issues) },
  ]);
  const periodBlueprint = mathPeriodBlueprintFor(blueprint, Number(period.periodNumber || 1)) || { periodNumber: period.periodNumber, focus: period.focus };
  return normalizeMathPeriodChunk(input, blueprint, periodBlueprint, extractJson<MathPeriodChunk>(result.content));
}

function buildMathLessonFromChunks(input: LessonInput, blueprint: MathLessonBlueprint, chunks: MathPeriodChunk[], model: string): LessonPlan {
  const title = blueprint.lessonTitle || input.lessonTitle || "Bài học Toán";
  const orderedChunks = chunks.slice().sort((left, right) => Number(left.periodNumber || 0) - Number(right.periodNumber || 0)).map((chunk, index) => ({ ...chunk, periodNumber: Number(chunk.periodNumber || index + 1), outcomes: normalizeOutcomes(chunk.outcomes || blueprint.outcomes, `${title} - tiết ${Number(chunk.periodNumber || index + 1)}`), activities: (chunk.activities || []).map(normalizeActivity) }));
  const continuityNotes = orderedChunks.map((chunk) => chunk.handoff?.nextBridge || chunk.handoff?.learned || "").filter(Boolean).map((note, index) => `Tiết ${orderedChunks[index]?.periodNumber || index + 1}: ${note}`);
  return normalizeLesson(input, {
    generalInfo: { subject: "Toán", grade: input.grade, lessonTitle: title, book: bookContext(input), periods: Number(input.periods || orderedChunks.length || 1), duration: Number(input.duration || 35) },
    outcomes: normalizeOutcomes(blueprint.outcomes, title),
    materials: { teacher: blueprint.materials?.teacher?.length ? blueprint.materials.teacher : ["Ảnh SGK/tranh bài toán", "Bảng phụ hoặc phiếu tóm tắt", "Thẻ số/thẻ dữ kiện"], students: blueprint.materials?.students?.length ? blueprint.materials.students : ["SGK", "Vở Toán", "Bảng con hoặc phiếu học tập"] },
    activities: orderedChunks.flatMap((chunk) => chunk.activities || []), periodPlans: orderedChunks,
    assessment: { criteria: blueprint.assessment?.criteria || [], evidence: blueprint.assessment?.evidence || [], comments: blueprint.assessment?.comments || [] },
    adjustments: { suitablePoints: ["........................................................................................................................................"], pointsToAdjust: ["........................................................................................................................................"], nextLessonDirection: ["........................................................................................................................................"] },
    contextFit: { notes: [...(blueprint.contextFit?.notes || []), ...continuityNotes] }, meta: { style: input.style, modelUsed: model, createdAt: new Date().toISOString(), continuityPlan: blueprint.continuityPlan },
  }, model);
}

async function generateMathLessonChunkedWithModel(input: LessonInput, ocrText: string, strategy: PlanModelStrategy) {
  const blueprint = await generateMathBlueprintWithModel(input, ocrText, strategy.blueprint);
  const periods = blueprint.periods || [];
  let chunks: MathPeriodChunk[] = [];
  let previousHandoff: MathPeriodChunk["handoff"] | null = null;
  for (const period of periods) {
    const chunk = await generateMathPeriodWithModel(input, ocrText, strategy.detail, blueprint, period, previousHandoff);
    chunks.push(chunk);
    previousHandoff = chunk.handoff || null;
  }
  let repairApplied = false;

  if (strategy.plan !== "free" && canStartAiRepair("math-period-repair", MIN_PERIOD_REPAIR_BUDGET_MS, { periodCount: chunks.length })) {
    const repaired = await Promise.all(chunks.map(async (chunk) => {
      const issues = mathPeriodIssues(chunk);
      if (!issues.length) return { chunk, repaired: false };
      if (!canStartAiRepair("math-period-repair-item", MIN_PERIOD_REPAIR_BUDGET_MS, { periodNumber: chunk.periodNumber, issueCount: issues.length })) return { chunk, repaired: false };
      try {
        return { chunk: await repairMathPeriodWithModel(input, strategy.repair, blueprint, chunk, issues), repaired: true };
      } catch (repairError) {
        console.warn("[EduPlan AI] Math chunked period repair skipped", { model: strategy.repair.model, periodNumber: chunk.periodNumber, message: repairError instanceof Error ? repairError.message : "Unknown repair error" });
        return { chunk, repaired: false };
      }
    }));
    chunks = repaired.map((item) => item.chunk);
    repairApplied = repaired.some((item) => item.repaired);
  } else {
    const issueCount = chunks.reduce((total, chunk) => total + mathPeriodIssues(chunk).length, 0);
    if (issueCount) console.info("[EduPlan AI] Math repair deferred to audit", { plan: strategy.plan, issueCount, reason: strategy.plan === "free" ? "free-plan" : "time-budget" });
  }

  const lesson = buildMathLessonFromChunks(input, blueprint, chunks, strategy.detail.model);
  const finalPeriodIssues = (lesson.periodPlans || []).flatMap((period) => mathPeriodIssues({ ...period, handoff: undefined }));
  if (finalPeriodIssues.length && !repairApplied) console.warn("[EduPlan AI] Math chunked lesson has remaining period issues", { model: strategy.detail.model, issueCount: finalPeriodIssues.length });
  if (hasStructuralIssues(lesson, input) || isMissingPeriods(lesson, input.periods)) throw new Error("Giáo án Toán chunked chưa đủ cấu trúc sau khi ghép. Vui lòng bấm tạo lại hoặc giảm số tiết/ảnh.");
  const pedagogyAudit = buildPedagogyAudit(lesson, input, repairApplied);
  return { lesson, pedagogyAudit };
}

// ─── NATURAL & SOCIAL STUDIES CHUNKED GENERATION ───

function isNaturalSocialLessonType(value: unknown): value is NaturalSocialLessonType {
  return typeof value === "string" && value in naturalSocialLessonTypeProfiles;
}

function naturalSocialPhaseDuration(phase: string, input: LessonInput): number {
  const duration = Number(input.duration || 35);
  const key = phaseKey(phase);
  if (duration === 35) {
    if (key === "Khởi động") return 3;
    if (key === "Khám phá") return 14;
    if (key === "Luyện tập") return 10;
    if (key === "Vận dụng") return 6;
  }
  if (key === "Khởi động") return Math.max(3, Math.min(5, Math.round(duration * 0.12)));
  if (key === "Khám phá") return Math.max(13, Math.min(17, Math.round(duration * 0.45)));
  if (key === "Luyện tập") return Math.max(8, Math.min(11, Math.round(duration * 0.28)));
  if (key === "Vận dụng") {
    return Math.max(3,
      duration
      - naturalSocialPhaseDuration("Khởi động", input)
      - naturalSocialPhaseDuration("Khám phá", input)
      - naturalSocialPhaseDuration("Luyện tập", input));
  }
  return 5;
}

function findNaturalSocialActivityBlueprint(period: NaturalSocialPeriodBlueprint, phase: string, index: number): NaturalSocialActivityBlueprint {
  const activities = Array.isArray(period.activities) ? period.activities : [];
  return activities.find((activity) => activityPhaseKey(activity) === phase) || activities[index] || {};
}

function normalizeNaturalSocialClassification(
  rawClassification: NaturalSocialClassification | undefined,
  fallback: NaturalSocialClassification,
): NaturalSocialClassification {
  const modelPrimaryType = isNaturalSocialLessonType(rawClassification?.primaryType) ? rawClassification.primaryType : undefined;
  const primaryType = fallback.confidence === "high" && fallback.primaryType !== "mixed"
    ? fallback.primaryType
    : modelPrimaryType || fallback.primaryType;
  const secondaryTypes = (Array.isArray(rawClassification?.secondaryTypes) ? rawClassification.secondaryTypes : fallback.secondaryTypes)
    .filter(isNaturalSocialLessonType)
    .filter((type, index, list) => type !== primaryType && list.indexOf(type) === index);
  const rawConfidence = rawClassification?.confidence;
  const confidence = rawConfidence === "high" || rawConfidence === "medium" || rawConfidence === "low"
    ? rawConfidence
    : fallback.confidence;
  return {
    primaryType,
    ...(primaryType === "family"
      ? {
          topicFocus: fallback.topicFocus && fallback.topicFocus !== "family-general"
            ? fallback.topicFocus
            : isNaturalSocialTopicFocus(rawClassification?.topicFocus)
              ? rawClassification.topicFocus
              : fallback.topicFocus || "family-general",
        }
      : {}),
    secondaryTypes,
    confidence,
    evidence: asStringList(rawClassification?.evidence).length ? asStringList(rawClassification?.evidence) : fallback.evidence,
    gradeBand: fallback.gradeBand,
    uncertainties: asStringList(rawClassification?.uncertainties).length ? asStringList(rawClassification?.uncertainties) : fallback.uncertainties,
  };
}

function normalizeNaturalSocialBlueprint(
  input: LessonInput,
  rawBlueprint: NaturalSocialLessonBlueprint,
  classification: NaturalSocialClassification,
): NaturalSocialLessonBlueprint {
  const expectedPeriods = Math.max(1, Number(input.periods || 1));
  const rawPeriods = Array.isArray(rawBlueprint.periods) ? rawBlueprint.periods : [];
  const normalizedClassification = normalizeNaturalSocialClassification(rawBlueprint.classification, classification);
  const profile = getNaturalSocialPedagogyProfile(normalizedClassification);
  const homeEnvironment = normalizedClassification.primaryType === "family" && normalizedClassification.topicFocus === "home-environment";
  const lessonTitle = rawBlueprint.lessonTitle?.trim() || input.lessonTitle || "Bài học Tự nhiên và Xã hội";
  const core = rawBlueprint.naturalSocialCore || {};
  const sourceInventory = normalizeNaturalSocialSourceInventory(rawBlueprint.sourceInventory);
  const periods = Array.from({ length: expectedPeriods }, (_, index): NaturalSocialPeriodBlueprint => {
    const periodNumber = index + 1;
    const rawPeriod = rawPeriods.find((period) => Number(period.periodNumber) === periodNumber) || rawPeriods[index] || {};
    const lessonType = isNaturalSocialLessonType(rawPeriod.lessonType) ? rawPeriod.lessonType : normalizedClassification.primaryType;
    const periodProfile = getNaturalSocialPedagogyProfile({
      primaryType: lessonType,
      topicFocus: normalizedClassification.topicFocus,
    }) || profile;
    const focus = rawPeriod.focus?.trim() || (expectedPeriods > 1 ? `Tiết ${periodNumber}: trọng tâm ${lessonTitle}` : `Trọng tâm ${lessonTitle}`);
    return {
      periodNumber,
      focus,
      lessonType,
      objectives: asStringList(rawPeriod.objectives).length
        ? asStringList(rawPeriod.objectives)
        : [
            `Quan sát được đối tượng/hình ảnh chính trong ${focus}.`,
            "Mô tả được đặc điểm nổi bật bằng lời hoặc phiếu học tập.",
            "So sánh hoặc phân loại được theo tiêu chí đơn giản.",
            "Nêu được một việc làm vận dụng vào đời sống hằng ngày.",
          ],
      observationTargets: asStringList(rawPeriod.observationTargets).length
        ? asStringList(rawPeriod.observationTargets)
        : asStringList(core.observationObjects).length
          ? asStringList(core.observationObjects)
          : periodProfile.observationTargets,
      inquiryQuestion: rawPeriod.inquiryQuestion || asStringList(core.inquiryQuestions)[0] || "Con quan sát thấy gì và điều đó giúp con hiểu bài như thế nào?",
      evidencePlan: rawPeriod.evidencePlan || asStringList(core.evidenceToCollect)[0] || "HS hoàn thành phiếu/bảng quan sát hoặc thẻ phân loại ngắn.",
      comparisonCriteria: asStringList(rawPeriod.comparisonCriteria).length
        ? asStringList(rawPeriod.comparisonCriteria)
        : asStringList(core.comparisonOrClassificationCriteria).length
          ? asStringList(core.comparisonOrClassificationCriteria)
          : homeEnvironment
            ? ["Đặc điểm quan sát được", "Công dụng hoặc sự phù hợp của phòng - đồ dùng"]
            : ["Đặc điểm quan sát được", "Việc nên làm/chưa nên làm khi bài yêu cầu"],
      safetyNotes: asStringList(rawPeriod.safetyNotes).length
        ? asStringList(rawPeriod.safetyNotes)
        : asStringList(core.safetyNotes).length
          ? asStringList(core.safetyNotes)
          : ["Chỉ sử dụng tranh, vật thật sạch/an toàn hoặc mô hình; GV nhắc HS không tự ý chạm, nếm, ngửi vật lạ."],
      actionFocus: rawPeriod.actionFocus || asStringList(core.actionApplications)[0] || periodProfile.applicationMoves[0] || "Thực hiện một việc làm phù hợp ở nhà, trường hoặc địa phương.",
      continuityIn: rawPeriod.continuityIn || (periodNumber === 1 ? "Bắt đầu từ trải nghiệm gần gũi và tranh/ảnh SGK." : `Nối tiếp sản phẩm quan sát của tiết ${periodNumber - 1}.`),
      continuityOut: rawPeriod.continuityOut || (periodNumber < expectedPeriods ? `Chuẩn bị câu hỏi/phiếu quan sát cho tiết ${periodNumber + 1}.` : "Chốt kiến thức và chuyển thành hành động vận dụng."),
      activities: requiredActivityPhases.map((phase, activityIndex) => {
        const activity = findNaturalSocialActivityBlueprint(rawPeriod, phase, activityIndex);
        return {
          id: activity.id || `ns-p${periodNumber}-a${activityIndex + 1}`,
          phase,
          title: activity.title || phase,
          objective: activity.objective || `Tổ chức hoạt động ${phase.toLowerCase()} bám trọng tâm ${focus}.`,
          durationMinutes: Number(activity.durationMinutes || naturalSocialPhaseDuration(phase, input)),
          inquiryFocus: activity.inquiryFocus || rawPeriod.inquiryQuestion || asStringList(core.inquiryQuestions)[activityIndex] || periodProfile.inquirySequence[Math.min(activityIndex, periodProfile.inquirySequence.length - 1)],
          observationTarget: activity.observationTarget || asStringList(rawPeriod.observationTargets)[0] || asStringList(core.observationObjects)[0] || periodProfile.observationTargets[0],
          product: activity.product || periodProfile.learningProducts[Math.min(activityIndex, periodProfile.learningProducts.length - 1)] || "Sản phẩm học tập quan sát được.",
          handoffToNext: activity.handoffToNext || (activityIndex < requiredActivityPhases.length - 1 ? `Chuyển từ ${phase} sang ${requiredActivityPhases[activityIndex + 1]}.` : rawPeriod.continuityOut || "Chốt tiết học."),
          objectiveIds: safeStringArray(activity.objectiveIds),
          sourceTaskIds: safeStringArray(activity.sourceTaskIds),
          sourceVisualIds: safeStringArray(activity.sourceVisualIds),
          sourceUnitIds: safeStringArray(activity.sourceUnitIds),
          sourceClusterIds: safeStringArray(activity.sourceClusterIds),
          coveragePurpose: activity.coveragePurpose,
        };
      }),
    };
  });

  return {
    lessonTitle,
    lessonOverview: rawBlueprint.lessonOverview || `Giáo án Tự nhiên và Xã hội ${lessonTitle} được sinh theo blueprint quan sát - bằng chứng - hành động.`,
    classification: normalizedClassification,
    ...(sourceInventory ? { sourceInventory } : {}),
    naturalSocialCore: {
      topic: core.topic || lessonTitle,
      domain: core.domain || profile.domain,
      observationObjects: asStringList(core.observationObjects).length ? asStringList(core.observationObjects) : profile.observationTargets,
      inquiryQuestions: asStringList(core.inquiryQuestions).length
        ? asStringList(core.inquiryQuestions)
        : homeEnvironment
          ? ["Con quan sát thấy đặc điểm gì ở ngôi nhà/quang cảnh?", "Các kiểu nhà hoặc các phòng giống và khác nhau ở điểm nào?", "Đồ dùng nào phù hợp với từng phòng và vì sao?"]
          : ["Con quan sát thấy gì?", "Các đối tượng giống và khác nhau ở điểm nào?", "Em vận dụng điều vừa học như thế nào?"],
      evidenceToCollect: asStringList(core.evidenceToCollect).length ? asStringList(core.evidenceToCollect) : ["Phiếu/bảng quan sát", "Câu trả lời hoặc thẻ phân loại của học sinh"],
      comparisonOrClassificationCriteria: asStringList(core.comparisonOrClassificationCriteria).length
        ? asStringList(core.comparisonOrClassificationCriteria)
        : homeEnvironment
          ? ["Đặc điểm ngôi nhà/quang cảnh", "Công dụng hoặc sự phù hợp của phòng - đồ dùng"]
          : ["Đặc điểm quan sát được", "Tiêu chí phù hợp với nhiệm vụ SGK"],
      actionApplications: asStringList(core.actionApplications).length ? asStringList(core.actionApplications) : profile.applicationMoves,
      safetyNotes: asStringList(core.safetyNotes).length ? asStringList(core.safetyNotes) : ["Dùng tranh, mô hình hoặc vật thật sạch/an toàn; không yêu cầu HS nếm, ngửi trực tiếp, chạm vật lạ hoặc thực hiện thao tác nguy hiểm."],
      localConnectionRules: asStringList(core.localConnectionRules).length ? asStringList(core.localConnectionRules) : ["Chỉ dùng ví dụ địa phương cụ thể khi form/ảnh SGK cung cấp; nếu thiếu dữ liệu, để GV thay bằng ví dụ thật của nơi học sinh sống."],
    },
    outcomes: rawBlueprint.outcomes || {},
    materials: {
      teacher: asStringList(rawBlueprint.materials?.teacher).length ? asStringList(rawBlueprint.materials?.teacher) : ["Ảnh SGK/tranh minh họa", "Vật thật hoặc mô hình an toàn", "Phiếu/bảng quan sát"],
      students: asStringList(rawBlueprint.materials?.students).length ? asStringList(rawBlueprint.materials?.students) : ["SGK", "Bút màu/thẻ học tập", "Vở hoặc phiếu học tập"],
    },
    assessment: {
      criteria: asStringList(rawBlueprint.assessment?.criteria).length ? asStringList(rawBlueprint.assessment?.criteria) : profile.assessmentCriteria,
      evidence: asStringList(rawBlueprint.assessment?.evidence).length ? asStringList(rawBlueprint.assessment?.evidence) : profile.learningProducts,
      comments: asStringList(rawBlueprint.assessment?.comments).length ? asStringList(rawBlueprint.assessment?.comments) : ["Nhận xét dựa trên quan sát, sản phẩm học tập và hành động vận dụng của học sinh."],
    },
    contextFit: { notes: asStringList(rawBlueprint.contextFit?.notes) },
    continuityPlan: buildNaturalSocialContinuityPlan(sourceInventory, expectedPeriods, rawBlueprint.continuityPlan),
    periods,
  };
}

function naturalSocialPeriodBlueprintFor(blueprint: NaturalSocialLessonBlueprint, periodNumber: number) {
  return blueprint.periods?.find((period) => Number(period.periodNumber) === periodNumber) || blueprint.periods?.[periodNumber - 1];
}

function activityFromNaturalSocialBlueprint(
  activity: NaturalSocialActivityBlueprint,
  index: number,
  lessonType: NaturalSocialLessonType,
  topicFocus?: NaturalSocialClassification["topicFocus"],
): LessonPlan["activities"][number] {
  const phase = activityPhaseKey(activity) || requiredActivityPhases[index] || `Hoạt động ${index + 1}`;
  const profile = getNaturalSocialPedagogyProfile({ primaryType: lessonType, topicFocus });
  const product = activity.product || profile.learningProducts[Math.min(index, profile.learningProducts.length - 1)] || `Sản phẩm TNXH của hoạt động ${phase.toLowerCase()}.`;
  const observationTarget = activity.observationTarget || profile.observationTargets[0] || "tranh/ảnh SGK";
  const inquiryFocus = activity.inquiryFocus || profile.inquirySequence[Math.min(index, profile.inquirySequence.length - 1)] || "Quan sát và mô tả đối tượng gần gũi.";
  return {
    id: activity.id,
    phase,
    title: activity.title || phase,
    objective: activity.objective || `Giúp học sinh hoàn thành hoạt động ${phase.toLowerCase()} theo mạch quan sát - mô tả - vận dụng.`,
    durationMinutes: activity.durationMinutes || 5,
    teacherActions: [
      `GV cho HS quan sát ${observationTarget}, nêu câu hỏi: "${inquiryFocus}"`,
      "GV giao nhiệm vụ chỉ/chọn thẻ/nói hoặc ghi rất ngắn để lưu bằng chứng quan sát, sau đó chia sẻ theo cặp/nhóm.",
    ],
    studentActions: [
      `HS quan sát ${observationTarget}, nêu đặc điểm nhìn thấy và dự đoán ban đầu.`,
      "HS chỉ, chọn thẻ, nói hoặc hoàn thành phiếu rất ngắn, trình bày kết quả và lắng nghe nhận xét.",
    ],
    inputOrMaterials: [observationTarget],
    learningProducts: [product],
    objectiveIds: safeStringArray(activity.objectiveIds),
    sourceTaskIds: safeStringArray(activity.sourceTaskIds),
    sourceVisualIds: safeStringArray(activity.sourceVisualIds),
    sourceUnitIds: safeStringArray(activity.sourceUnitIds),
    sourceClusterIds: safeStringArray(activity.sourceClusterIds),
    coveragePurpose: activity.coveragePurpose,
  };
}

function naturalSocialActivityKind(activity: LessonPlan["activities"][number]) {
  const text = JSON.stringify(activity).toLowerCase();
  if (/phân loại|nhóm|tiêu chí|so sánh|giống|khác/.test(text)) return "classification";
  if (/thực hành|rửa tay|an toàn|vệ sinh|chăm sóc|bảo vệ|cam kết|việc nên làm/.test(text)) return "action";
  if (/điều tra|khảo sát|hỏi người thân|ghi lại|báo cáo/.test(text)) return "investigation";
  if (/quan sát|mô tả|tranh|vật thật|mô hình|đặc điểm/.test(text)) return "observation";
  return "generic";
}

function naturalSocialDefaultCriteria(activity: LessonPlan["activities"][number]) {
  switch (naturalSocialActivityKind(activity)) {
    case "classification":
      return ["Phân loại hoặc so sánh theo tiêu chí rõ.", "Nêu được ít nhất một đặc điểm làm căn cứ."];
    case "action":
      return ["Chọn được việc nên làm phù hợp.", "Nêu được cách thực hiện an toàn trong đời sống."];
    case "investigation":
      return ["Ghi lại được kết quả quan sát/điều tra ngắn.", "Trình bày kết quả rõ, đúng trọng tâm."];
    case "observation":
      return ["Quan sát và mô tả được đặc điểm chính.", "Dựa vào tranh/vật thật để trả lời."];
    default:
      return ["Hoàn thành đúng nhiệm vụ TNXH.", "Có sản phẩm học tập rõ ràng."];
  }
}

function naturalSocialFallbackProduct(activity: LessonPlan["activities"][number], index: number) {
  const phase = activityPhaseKey(activity);
  if (phase === "Khởi động") return "Câu trả lời/dự đoán ban đầu của học sinh";
  if (phase === "Khám phá") return "Phiếu hoặc bảng quan sát của học sinh";
  if (phase === "Luyện tập") return "Bảng so sánh, thẻ phân loại hoặc kết quả thực hành";
  if (phase === "Vận dụng") return "Sản phẩm vận dụng ngắn gắn trực tiếp với nhiệm vụ vừa học";
  return `Sản phẩm học tập TNXH của hoạt động ${index + 1}`;
}

function sanitizeNaturalSocialVisibleString(value: string) {
  return String(value || "")
    .replace(/\b(?:S|V|Q|L)\d+\b\s*[:.\-]?\s*/g, "")
    .replace(/\.\s*:/g, ":")
    .replace(/\.\s*;/g, ".")
    .replace(/;\s*[.;]/g, ";")
    .replace(/\s*[:：]?\s*thực hiện được qua[^.;。]*[.;。]?/gi, "")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();
}

function sanitizeNaturalSocialVisibleList(value: unknown) {
  return safeStringArray(value).map(sanitizeNaturalSocialVisibleString).filter(Boolean);
}

function normalizeNaturalSocialActivity(
  activity: LessonPlan["activities"][number],
  index: number,
  input: LessonInput,
  lessonType: NaturalSocialLessonType = "mixed",
  topicFocus?: NaturalSocialClassification["topicFocus"],
) {
  const profile = getNaturalSocialPedagogyProfile({ primaryType: lessonType, topicFocus });
  const normalized = normalizeActivity({
    ...activity,
    phase: sanitizeNaturalSocialVisibleString(activity.phase),
    title: sanitizeNaturalSocialVisibleString(activity.title),
    objective: sanitizeNaturalSocialVisibleString(activity.objective),
    teacherActions: sanitizeNaturalSocialVisibleList(activity.teacherActions),
    studentActions: sanitizeNaturalSocialVisibleList(activity.studentActions),
    inputOrMaterials: sanitizeNaturalSocialVisibleList(activity.inputOrMaterials),
    learningProducts: sanitizeNaturalSocialVisibleList(activity.learningProducts),
    successCriteria: sanitizeNaturalSocialVisibleList(activity.successCriteria),
    expectedAnswer: sanitizeNaturalSocialVisibleString(activity.expectedAnswer || ""),
    acceptableResponses: sanitizeNaturalSocialVisibleList(activity.acceptableResponses),
    commonErrors: sanitizeNaturalSocialVisibleList(activity.commonErrors),
    teacherFeedback: sanitizeNaturalSocialVisibleList(activity.teacherFeedback),
    errorFeedback: Array.isArray(activity.errorFeedback)
      ? activity.errorFeedback.map((item) => ({
          error: sanitizeNaturalSocialVisibleString(item.error),
          feedback: sanitizeNaturalSocialVisibleList(item.feedback),
        }))
      : activity.errorFeedback,
    supportForStudentsNeedingHelp: sanitizeNaturalSocialVisibleList(activity.supportForStudentsNeedingHelp),
    extensionForEarlyFinishers: sanitizeNaturalSocialVisibleList(activity.extensionForEarlyFinishers),
    coveragePurpose: sanitizeNaturalSocialVisibleString(activity.coveragePurpose || ""),
  }, index);
  const phase = activityPhaseKey(normalized);
  const isFocal = phase === "Khám phá" || phase === "Luyện tập";
  const products = safeStringArray(normalized.learningProducts);
  const criteria = safeStringArray(normalized.successCriteria);
  const commonErrors = safeStringArray(normalized.commonErrors);
  const teacherFeedback = safeStringArray(normalized.teacherFeedback);
  return {
    ...normalized,
    durationMinutes: normalized.durationMinutes || naturalSocialPhaseDuration(phase || normalized.phase, input),
    inputOrMaterials: safeStringArray(normalized.inputOrMaterials).length
      ? safeStringArray(normalized.inputOrMaterials).slice(0, 6)
      : ["Tranh/ảnh SGK hoặc vật thật an toàn liên quan bài học"],
    organization: normalized.organization || (isFocal ? "group" : "whole_class"),
    learningProducts: (products.length ? products : [naturalSocialFallbackProduct(normalized, index)]).slice(0, 1),
    successCriteria: (criteria.length ? criteria : naturalSocialDefaultCriteria(normalized)).slice(0, 2),
    commonErrors: (commonErrors.length ? commonErrors : profile.commonMisconceptions).slice(0, 3),
    teacherFeedback: (teacherFeedback.length ? teacherFeedback : ["GV gợi hỏi để HS quay lại bằng chứng quan sát, chỉnh tiêu chí phân loại và nêu hành động phù hợp."]).slice(0, 3),
    sourceTaskIds: safeStringArray(normalized.sourceTaskIds).slice(0, 8),
    sourceVisualIds: safeStringArray(normalized.sourceVisualIds).slice(0, 8),
    sourceUnitIds: safeStringArray(normalized.sourceUnitIds).slice(0, 12),
    sourceClusterIds: safeStringArray(normalized.sourceClusterIds).slice(0, 8),
    coveragePurpose: normalized.coveragePurpose,
    supportForStudentsNeedingHelp: isFocal
      ? (safeStringArray(normalized.supportForStudentsNeedingHelp).length
          ? safeStringArray(normalized.supportForStudentsNeedingHelp)
          : ["HS cần hỗ trợ: GV cho chọn thẻ/tranh, dùng câu hỏi ngắn và mẫu câu 'Em quan sát thấy...'."])
      : [],
    extensionForEarlyFinishers: isFocal
      ? (safeStringArray(normalized.extensionForEarlyFinishers).length
          ? safeStringArray(normalized.extensionForEarlyFinishers)
          : ["HS hoàn thành sớm: tìm thêm một ví dụ gần gũi hoặc giải thích vì sao chọn tiêu chí/hành động đó."])
      : [],
  };
}

function rebalanceNaturalSocialPeriodActivities(input: LessonInput, activities: LessonPlan["activities"]) {
  const total = activities.reduce((sum, activity) => sum + Number(activity.durationMinutes || 0), 0);
  const duration = Number(input.duration || 35);
  if (duration === 35) {
    if (total >= 32 && total <= 33) return activities;
  } else if (total === duration) return activities;
  return activities.map((activity) => ({
    ...activity,
    durationMinutes: naturalSocialPhaseDuration(activityPhaseKey(activity) || activity.phase, input),
  }));
}

function normalizeNaturalSocialPeriodChunk(
  input: LessonInput,
  blueprint: NaturalSocialLessonBlueprint,
  periodBlueprint: NaturalSocialPeriodBlueprint,
  rawChunk: NaturalSocialPeriodChunk,
): NaturalSocialPeriodChunk {
  const periodNumber = Number(rawChunk.periodNumber || periodBlueprint.periodNumber || 1);
  const title = blueprint.lessonTitle || input.lessonTitle || "Bài học Tự nhiên và Xã hội";
  const lessonType = periodBlueprint.lessonType || blueprint.classification?.primaryType || "mixed";
  const rawActivities = Array.isArray(rawChunk.activities) ? rawChunk.activities : [];
  const activities = requiredActivityPhases.map((phase, index) => {
    const source = rawActivities.find((activity) => activityPhaseKey(activity) === phase)
      || rawActivities[index]
      || activityFromNaturalSocialBlueprint(
        findNaturalSocialActivityBlueprint(periodBlueprint, phase, index),
        index,
        lessonType,
        blueprint.classification?.topicFocus,
      );
    const activityBlueprint = findNaturalSocialActivityBlueprint(periodBlueprint, phase, index);
    const normalizedActivity = normalizeNaturalSocialActivity({
      ...source,
      id: source.id || activityBlueprint.id || `ns-p${periodNumber}-a${index + 1}`,
      phase,
      title: source.title || activityBlueprint.title || phase,
      objective: source.objective || activityBlueprint.objective || `Tổ chức hoạt động ${phase.toLowerCase()} cho tiết ${periodNumber}.`,
      durationMinutes: source.durationMinutes || activityBlueprint.durationMinutes || naturalSocialPhaseDuration(phase, input),
      objectiveIds: safeStringArray(source.objectiveIds).length ? safeStringArray(source.objectiveIds) : asStringList(activityBlueprint.objectiveIds),
      sourceTaskIds: safeStringArray(source.sourceTaskIds).length ? safeStringArray(source.sourceTaskIds) : asStringList(activityBlueprint.sourceTaskIds),
      sourceVisualIds: safeStringArray(source.sourceVisualIds).length ? safeStringArray(source.sourceVisualIds) : asStringList(activityBlueprint.sourceVisualIds),
      sourceUnitIds: safeStringArray(source.sourceUnitIds).length ? safeStringArray(source.sourceUnitIds) : asStringList(activityBlueprint.sourceUnitIds),
      sourceClusterIds: safeStringArray(source.sourceClusterIds).length ? safeStringArray(source.sourceClusterIds) : asStringList(activityBlueprint.sourceClusterIds),
      coveragePurpose: source.coveragePurpose || activityBlueprint.coveragePurpose,
    }, index, input, lessonType, blueprint.classification?.topicFocus);
    if (phase === "Khởi động") {
      const startupSuggestion = selectNaturalSocialStartup({
        input,
        lessonType,
        topicFocus: blueprint.classification?.topicFocus,
        periodNumber,
        lessonTitle: title,
        focus: periodBlueprint.focus,
        inquiryQuestion: periodBlueprint.inquiryQuestion,
        observationTargets: periodBlueprint.observationTargets,
        sourceInventory: blueprint.sourceInventory,
      });
      return applyNaturalSocialStartupGuardrails(normalizedActivity, input, startupSuggestion);
    }
    return normalizedActivity;
  });
  const balancedActivities = rebalanceNaturalSocialPeriodActivities(
    input,
    canonicalizeOrderedActivityPhases(activities),
  );

  return {
    periodNumber,
    focus: rawChunk.focus || periodBlueprint.focus || `Tiết ${periodNumber}: ${title}`,
    outcomes: normalizeOutcomes(rawChunk.outcomes || blueprint.outcomes, `${title} - tiết ${periodNumber}`),
    activities: balancedActivities,
    handoff: rawChunk.handoff || {
      learned: periodBlueprint.continuityOut || `Học sinh hoàn thành trọng tâm tiết ${periodNumber}.`,
      unresolvedRisks: getNaturalSocialPedagogyProfile({ primaryType: lessonType, topicFocus: blueprint.classification?.topicFocus }).commonMisconceptions,
      nextBridge: periodBlueprint.continuityOut || "Chuyển sang hoạt động/tiết tiếp theo.",
    },
  };
}

async function generateNaturalSocialBlueprintWithModel(
  input: LessonInput,
  ocrText: string,
  strategy: AiStageStrategy,
  classification: NaturalSocialClassification,
  cachedSourceInventory?: NaturalSocialSourceInventory,
) {
  console.info("[EduPlan AI] Natural-social chunked blueprint started", { model: strategy.model, periods: input.periods, lessonType: classification.primaryType, confidence: classification.confidence });
  const result = await fetchAiJsonContent(strategy, [
    { role: "system", content: "Bạn chỉ trả JSON hợp lệ. Tạo blueprint môn Tự nhiên và Xã hội tiểu học theo mạch quan sát - bằng chứng - hành động; chưa viết giáo án đầy đủ." },
    { role: "user", content: buildNaturalSocialBlueprintPrompt(input, ocrText, classification, cachedSourceInventory) },
  ]);
  return normalizeNaturalSocialBlueprint(input, extractJson<NaturalSocialLessonBlueprint>(result.content), classification);
}

async function generateNaturalSocialPeriodWithModel(
  input: LessonInput,
  ocrText: string,
  strategy: AiStageStrategy,
  blueprint: NaturalSocialLessonBlueprint,
  period: NaturalSocialPeriodBlueprint,
  previousHandoff: NaturalSocialPeriodChunk["handoff"] | null,
) {
  const periodNumber = Number(period.periodNumber || 1);
  console.info("[EduPlan AI] Natural-social chunked period started", { model: strategy.model, periodNumber, lessonType: period.lessonType, focus: period.focus });
  const result = await fetchAiJsonContent(strategy, [
    { role: "system", content: `Bạn chỉ trả JSON hợp lệ cho một tiết Tự nhiên và Xã hội. Bám đúng chủ đề ${period.lessonType || "mixed"}, viết đủ dùng dạy thật và kiểm soát độ dài.` },
    { role: "user", content: buildNaturalSocialPeriodPrompt(input, ocrText, blueprint, period, previousHandoff) },
  ]);
  return normalizeNaturalSocialPeriodChunk(input, blueprint, period, extractJson<NaturalSocialPeriodChunk>(result.content));
}

async function repairNaturalSocialPeriodWithModel(
  input: LessonInput,
  strategy: AiStageStrategy,
  blueprint: NaturalSocialLessonBlueprint,
  period: NaturalSocialPeriodChunk,
  issues: string[],
) {
  console.info("[EduPlan AI] Natural-social chunked period repair started", { model: strategy.model, periodNumber: period.periodNumber, issueCount: issues.length });
  const result = await fetchAiJsonContent(strategy, [
    { role: "system", content: "Bạn chỉ trả JSON hợp lệ. Sửa riêng một PeriodPlan Tự nhiên và Xã hội theo mạch quan sát - bằng chứng - hành động; không viết lại toàn bộ bài." },
    { role: "user", content: buildNaturalSocialPeriodRepairPrompt(input, blueprint, period, issues) },
  ]);
  const periodBlueprint = naturalSocialPeriodBlueprintFor(blueprint, Number(period.periodNumber || 1))
    || { periodNumber: period.periodNumber, focus: period.focus, lessonType: blueprint.classification?.primaryType || "mixed" };
  return normalizeNaturalSocialPeriodChunk(input, blueprint, periodBlueprint, extractJson<NaturalSocialPeriodChunk>(result.content));
}

function buildNaturalSocialLessonFromChunks(
  input: LessonInput,
  blueprint: NaturalSocialLessonBlueprint,
  chunks: NaturalSocialPeriodChunk[],
  model: string,
): LessonPlan {
  const title = blueprint.lessonTitle || input.lessonTitle || "Bài học Tự nhiên và Xã hội";
  const orderedChunks = chunks
    .slice()
    .sort((left, right) => Number(left.periodNumber || 0) - Number(right.periodNumber || 0))
    .map((chunk, index) => {
      const periodNumber = Number(chunk.periodNumber || index + 1);
      const periodBlueprint = naturalSocialPeriodBlueprintFor(blueprint, periodNumber);
      const periodType = periodBlueprint?.lessonType || blueprint.classification?.primaryType || "mixed";
      const activities = rebalanceNaturalSocialPeriodActivities(
        input,
        canonicalizeOrderedActivityPhases((chunk.activities || []).map((activity, activityIndex) => {
          const normalizedActivity = normalizeNaturalSocialActivity(activity, activityIndex, input, periodType, blueprint.classification?.topicFocus);
          if (activityPhaseKey(normalizedActivity) !== "Khởi động") return normalizedActivity;
          const startupSuggestion = selectNaturalSocialStartup({
            input,
            lessonType: periodType,
            topicFocus: blueprint.classification?.topicFocus,
            periodNumber,
            lessonTitle: title,
            focus: periodBlueprint?.focus || chunk.focus,
            inquiryQuestion: periodBlueprint?.inquiryQuestion,
            observationTargets: periodBlueprint?.observationTargets,
            sourceInventory: blueprint.sourceInventory,
          });
          return applyNaturalSocialStartupGuardrails(normalizedActivity, input, startupSuggestion);
        })),
      );
      return {
        ...chunk,
        periodNumber,
        outcomes: normalizeNaturalSocialOutcomes(chunk.outcomes || blueprint.outcomes, `${title} - tiết ${periodNumber}`),
        activities,
      };
    });
  const continuityNotes = orderedChunks.map((chunk) => chunk.handoff?.nextBridge || chunk.handoff?.learned || "").filter(Boolean).map((note, index) => `Tiết ${orderedChunks[index]?.periodNumber || index + 1}: ${note}`);
  const coreNotes = [
    ...(blueprint.contextFit?.notes || []),
    ...(blueprint.naturalSocialCore?.safetyNotes || []).map((note) => `Lưu ý an toàn: ${note}`),
    ...(blueprint.naturalSocialCore?.localConnectionRules || []).map((note) => `Địa phương hóa: ${note}`),
    ...continuityNotes,
  ];
  return normalizeLesson(input, {
    generalInfo: { subject: "Tự nhiên và Xã hội", grade: input.grade, lessonTitle: title, book: bookContext(input), periods: Number(input.periods || orderedChunks.length || 1), duration: Number(input.duration || 35) },
    outcomes: normalizeNaturalSocialOutcomes(blueprint.outcomes, title),
    materials: { teacher: blueprint.materials?.teacher?.length ? blueprint.materials.teacher : ["Ảnh SGK/tranh minh họa", "Vật thật hoặc mô hình an toàn", "Phiếu/bảng quan sát"], students: blueprint.materials?.students?.length ? blueprint.materials.students : ["SGK", "Vở hoặc phiếu học tập", "Bút màu/thẻ học tập"] },
    activities: orderedChunks.flatMap((chunk) => chunk.activities || []),
    periodPlans: orderedChunks,
    assessment: { criteria: blueprint.assessment?.criteria || [], evidence: blueprint.assessment?.evidence || [], comments: blueprint.assessment?.comments || [] },
    adjustments: { suitablePoints: ["........................................................................................................................................"], pointsToAdjust: ["........................................................................................................................................"], nextLessonDirection: ["........................................................................................................................................"] },
    contextFit: { notes: coreNotes },
    meta: {
      style: input.style,
      modelUsed: model,
      createdAt: new Date().toISOString(),
      ...(blueprint.sourceInventory ? { naturalSocialSourceInventory: blueprint.sourceInventory } : {}),
      ...(blueprint.continuityPlan ? { continuityPlan: blueprint.continuityPlan } : {}),
    },
  }, model);
}

function naturalSocialRepairBlueprint(input: LessonInput, lesson: LessonPlan): NaturalSocialLessonBlueprint {
  const classification = classifyNaturalSocialLesson(input, naturalSocialSourceInventoryText(lesson.meta?.naturalSocialSourceInventory));
  return normalizeNaturalSocialBlueprint(input, {
    lessonTitle: lesson.generalInfo.lessonTitle,
    classification,
    sourceInventory: lesson.meta?.naturalSocialSourceInventory,
    outcomes: lesson.outcomes,
    materials: lesson.materials,
    assessment: lesson.assessment,
    contextFit: lesson.contextFit,
    continuityPlan: lesson.meta?.continuityPlan,
    periods: (lesson.periodPlans || []).map((period) => ({
      periodNumber: period.periodNumber,
      focus: period.focus,
      lessonType: classifyNaturalSocialLesson(
        { ...input, lessonTitle: period.focus || input.lessonTitle },
        naturalSocialSourceInventoryText(lesson.meta?.naturalSocialSourceInventory),
      ).primaryType,
      objectives: period.outcomes?.knowledgeAndSkills || [],
      activities: period.activities.map((activity) => ({
        phase: activity.phase,
        title: activity.title,
        objective: activity.objective,
        durationMinutes: activity.durationMinutes,
        sourceTaskIds: activity.sourceTaskIds,
        sourceVisualIds: activity.sourceVisualIds,
        sourceUnitIds: activity.sourceUnitIds,
        sourceClusterIds: activity.sourceClusterIds,
      })),
    })),
  }, classification);
}

function buildNaturalSocialChunkedAudit(
  lesson: LessonPlan,
  input: LessonInput,
  blueprint: NaturalSocialLessonBlueprint,
  repairApplied: boolean,
): PedagogyAudit {
  const audit = buildPedagogyAudit(lesson, input, repairApplied);
  const classification = blueprint.classification || classifyNaturalSocialLesson(input, naturalSocialSourceInventoryText(blueprint.sourceInventory));
  const periodTypes = (blueprint.periods || []).map((period) => period.lessonType || classification.primaryType);
  const periodChecks = periodTypes.map((lessonType, index) => ({
    periodNumber: Number(blueprint.periods?.[index]?.periodNumber || index + 1),
    lessonType,
    checks: getNaturalSocialChecklist({ ...classification, primaryType: lessonType }),
  }));
  const remainingIssues = (lesson.periodPlans || []).flatMap((period, index) => {
    const blueprintPeriod = naturalSocialPeriodBlueprintFor(blueprint, Number(period.periodNumber || index + 1));
    return naturalSocialPeriodIssues(period, blueprintPeriod, input).map((issue) => `Tiết ${Number(period.periodNumber || index + 1)}: ${issue}`);
  });
  const issues = Array.from(new Set([...audit.issues, ...remainingIssues]));
  return {
    ...audit,
    lessonType: classification.primaryType,
    classificationConfidence: classification.confidence,
    periodTypes,
    periodChecks,
    issues,
    checks: getNaturalSocialChecklist(classification),
    status: issues.length || audit.status === "needs-review"
      ? "needs-review"
      : repairApplied
        ? "repaired"
        : "passed",
  };
}

async function generateNaturalSocialLessonChunkedWithModel(
  input: LessonInput,
  ocrText: string,
  strategy: PlanModelStrategy,
  sourceInventoryOverride?: NaturalSocialSourceInventory,
) {
  const classification = classifyNaturalSocialLesson(input, ocrText);
  const generatedBlueprint = await generateNaturalSocialBlueprintWithModel(input, ocrText, strategy.blueprint, classification, sourceInventoryOverride);
  const mergedSourceInventory = mergeNaturalSocialSourceInventories(sourceInventoryOverride, generatedBlueprint.sourceInventory);
  const blueprint = mergedSourceInventory
    ? {
        ...generatedBlueprint,
        sourceInventory: mergedSourceInventory,
        continuityPlan: buildNaturalSocialContinuityPlan(mergedSourceInventory, input.periods, generatedBlueprint.continuityPlan),
      }
    : generatedBlueprint;
  const periods = blueprint.periods || [];
  let chunks: NaturalSocialPeriodChunk[] = [];
  let previousHandoff: NaturalSocialPeriodChunk["handoff"] | null = null;
  for (const period of periods) {
    const chunk = await generateNaturalSocialPeriodWithModel(input, ocrText, strategy.detail, blueprint, period, previousHandoff);
    chunks.push(chunk);
    previousHandoff = chunk.handoff || null;
  }
  let repairApplied = false;

  if (strategy.plan !== "free" && canStartAiRepair("natural-social-period-repair", MIN_PERIOD_REPAIR_BUDGET_MS, { periodCount: chunks.length })) {
    const repaired = await Promise.all(chunks.map(async (chunk, index) => {
      const period = periods[index] || naturalSocialPeriodBlueprintFor(blueprint, Number(chunk.periodNumber || index + 1)) || {};
      const issues = naturalSocialPeriodIssues(chunk, period, input);
      if (!issues.length) return { chunk, repaired: false };
      if (!canStartAiRepair("natural-social-period-repair-item", MIN_PERIOD_REPAIR_BUDGET_MS, { periodNumber: chunk.periodNumber, issueCount: issues.length })) return { chunk, repaired: false };
      try {
        return { chunk: await repairNaturalSocialPeriodWithModel(input, strategy.repair, blueprint, chunk, issues), repaired: true };
      } catch (repairError) {
        console.warn("[EduPlan AI] Natural-social chunked period repair skipped", { model: strategy.repair.model, periodNumber: chunk.periodNumber, message: repairError instanceof Error ? repairError.message : "Unknown repair error" });
        return { chunk, repaired: false };
      }
    }));
    chunks = repaired.map((item) => item.chunk);
    repairApplied = repaired.some((item) => item.repaired);
  } else {
    const issueCount = chunks.reduce((total, chunk, index) => {
      const period = periods[index] || naturalSocialPeriodBlueprintFor(blueprint, Number(chunk.periodNumber || index + 1)) || {};
      return total + naturalSocialPeriodIssues(chunk, period, input).length;
    }, 0);
    if (issueCount) console.info("[EduPlan AI] Natural-social repair deferred to audit", { plan: strategy.plan, issueCount, lessonType: classification.primaryType, reason: strategy.plan === "free" ? "free-plan" : "time-budget" });
  }

  const lesson = buildNaturalSocialLessonFromChunks(input, blueprint, chunks, strategy.detail.model);
  if (hasStructuralIssues(lesson, input) || isMissingPeriods(lesson, input.periods)) {
    const validationPeriods = periodsForValidation(lesson);
    console.error("[EduPlan AI] Natural-social chunked structural validation failed", {
      requestId: currentGenerationContext()?.requestId,
      expectedPeriodCount: Number(input.periods || 1),
      actualPeriodCount: validationPeriods.length,
      periods: validationPeriods.map((period) => {
        const activities = period.activities || [];
        const resolvedPhases = activities.map((activity) => activityPhaseKey(activity));
        return {
          periodNumber: period.periodNumber,
          activityCount: activities.length,
          missingPhases: requiredActivityPhases.filter((phase) => !resolvedPhases.includes(phase)),
          activities: activities.map((activity) => ({
            phase: activity.phase,
            title: activity.title,
            resolvedPhase: activityPhaseKey(activity),
          })),
        };
      }),
    });
    throw new Error("Giáo án Tự nhiên và Xã hội chunked chưa đủ cấu trúc sau khi ghép. Vui lòng bấm tạo lại hoặc giảm số tiết/ảnh.");
  }
  const pedagogyAudit = buildNaturalSocialChunkedAudit(lesson, input, blueprint, repairApplied);
  if (pedagogyAudit.issues.length) console.warn("[EduPlan AI] Natural-social chunked lesson has remaining issues", { model: strategy.detail.model, issueCount: pedagogyAudit.issues.length, lessonType: pedagogyAudit.lessonType });
  return { lesson, pedagogyAudit };
}

// ─── VIETNAMESE CHUNKED GENERATION ───

function isVietnameseLessonType(value: unknown): value is VietnameseLessonType {
  return typeof value === "string" && value in vietnameseLessonTypeProfiles;
}

function vietnamesePhaseDuration(phase: string, input: LessonInput, lessonType: VietnameseLessonType = "mixed"): number {
  const duration = Number(input.duration || 35);
  const key = phaseKey(phase);
  if (duration === 35) {
    const targets: Record<VietnameseLessonType, Record<string, number>> = {
      phonics: { "Khởi động": 3, "Khám phá": 12, "Luyện tập": 13, "Vận dụng": 4 },
      reading: { "Khởi động": 3, "Khám phá": 13, "Luyện tập": 12, "Vận dụng": 4 },
      handwriting: { "Khởi động": 3, "Khám phá": 9, "Luyện tập": 16, "Vận dụng": 4 },
      spelling: { "Khởi động": 3, "Khám phá": 6, "Luyện tập": 19, "Vận dụng": 4 },
      composition: { "Khởi động": 3, "Khám phá": 7, "Luyện tập": 18, "Vận dụng": 4 },
      "language-knowledge": { "Khởi động": 3, "Khám phá": 9, "Luyện tập": 16, "Vận dụng": 4 },
      "speaking-listening": { "Khởi động": 3, "Khám phá": 9, "Luyện tập": 16, "Vận dụng": 4 },
      mixed: { "Khởi động": 3, "Khám phá": 14, "Luyện tập": 11, "Vận dụng": 4 },
    };
    return targets[lessonType]?.[key] || targets.mixed[key] || 5;
  }
  const reserveMinutes = duration >= 35 ? 2 : 0;
  const targetMinutes = Math.max(1, duration - reserveMinutes);
  if (key === "Khởi động") return Math.max(3, Math.min(5, Math.round(targetMinutes * 0.12)));
  if (key === "Khám phá") return Math.max(13, Math.min(17, Math.round(targetMinutes * 0.45)));
  if (key === "Luyện tập") return Math.max(8, Math.min(11, Math.round(targetMinutes * 0.28)));
  if (key === "Vận dụng") {
    return Math.max(3,
      targetMinutes
      - vietnamesePhaseDuration("Khởi động", input)
      - vietnamesePhaseDuration("Khám phá", input)
      - vietnamesePhaseDuration("Luyện tập", input));
  }
  return 5;
}

function findVietnameseActivityBlueprint(period: VietnamesePeriodBlueprint, phase: string, index: number): VietnameseActivityBlueprint {
  const activities = Array.isArray(period.activities) ? period.activities : [];
  return activities.find((activity) => activityPhaseKey(activity) === phase) || activities[index] || {};
}

function vietnamesePeriodBlueprintFor(blueprint: VietnameseLessonBlueprint, periodNumber: number) {
  return blueprint.periods?.find((period) => Number(period.periodNumber) === periodNumber) || blueprint.periods?.[periodNumber - 1];
}

function normalizeVietnameseClassification(
  rawClassification: VietnameseLessonClassification | undefined,
  fallback: VietnameseLessonClassification,
): VietnameseLessonClassification {
  const classifierIsDecisive = fallback.primaryType !== "mixed" && fallback.confidence !== "low";
  const modelPrimaryType = isVietnameseLessonType(rawClassification?.primaryType) ? rawClassification.primaryType : undefined;
  // A clear classifier result stays authoritative. When signals are ambiguous,
  // allow the blueprint model to resolve the type from full SGK context.
  const primaryType = classifierIsDecisive ? fallback.primaryType : modelPrimaryType || fallback.primaryType;
  const secondaryTypes = (Array.isArray(rawClassification?.secondaryTypes) ? rawClassification.secondaryTypes : fallback.secondaryTypes)
    .filter(isVietnameseLessonType)
    .filter((type, index, list) => type !== primaryType && list.indexOf(type) === index);
  const rawConfidence = rawClassification?.confidence;
  const confidence = classifierIsDecisive
    ? fallback.confidence
    : rawConfidence === "high" || rawConfidence === "medium" || rawConfidence === "low"
      ? rawConfidence
      : fallback.confidence;
  return {
    primaryType,
    secondaryTypes,
    confidence,
    evidence: classifierIsDecisive || !asStringList(rawClassification?.evidence).length ? fallback.evidence : asStringList(rawClassification?.evidence),
    gradeBand: fallback.gradeBand,
    uncertainties: asStringList(rawClassification?.uncertainties).length ? asStringList(rawClassification?.uncertainties) : fallback.uncertainties,
  };
}

function normalizeVietnameseSourceInventory(sourceInventory: VietnameseLessonBlueprint["sourceInventory"]): VietnameseLessonBlueprint["sourceInventory"] {
  if (!sourceInventory || typeof sourceInventory !== "object") return undefined;
  return {
    readingText: asStringList(sourceInventory.readingText),
    readingVocabulary: asStringList(sourceInventory.readingVocabulary),
    longSentences: Array.isArray(sourceInventory.longSentences)
      ? sourceInventory.longSentences.map((item) => ({
          sentence: asStringList(item?.sentence)[0] || "",
          pauseMarked: asStringList(item?.pauseMarked)[0] || "",
          note: asStringList(item?.note)[0] || "",
        })).filter((item) => item.sentence || item.pauseMarked || item.note)
      : [],
    readingQuestions: Array.isArray(sourceInventory.readingQuestions)
      ? sourceInventory.readingQuestions.map((item) => ({
          question: asStringList(item?.question)[0] || "",
          expectedAnswer: asStringList(item?.expectedAnswer)[0] || "",
          evidence: asStringList(item?.evidence),
        })).filter((item) => item.question || item.expectedAnswer || item.evidence.length)
      : [],
    spellingText: asStringList(sourceInventory.spellingText)[0] || "",
    phonicsTasks: Array.isArray(sourceInventory.phonicsTasks)
      ? sourceInventory.phonicsTasks.map((item) => ({
          prompt: asStringList(item?.prompt)[0] || "",
          items: asStringList(item?.items),
          answers: asStringList(item?.answers),
        })).filter((item) => item.prompt || item.items.length || item.answers.length)
      : [],
    punctuationSentences: Array.isArray(sourceInventory.punctuationSentences)
      ? sourceInventory.punctuationSentences.map((item) => ({
          sentence: asStringList(item?.sentence)[0] || "",
          answer: asStringList(item?.answer)[0] || "",
        })).filter((item) => item.sentence || item.answer)
      : [],
    writingPrompt: sourceInventory.writingPrompt
      ? {
          sentenceCount: asStringList(sourceInventory.writingPrompt.sentenceCount)[0] || "",
          objectNames: asStringList(sourceInventory.writingPrompt.objectNames),
          prompts: asStringList(sourceInventory.writingPrompt.prompts),
        }
      : undefined,
    materialsByPeriod: Array.isArray(sourceInventory.materialsByPeriod)
      ? sourceInventory.materialsByPeriod.map((item) => ({
          periodNumber: Number(item?.periodNumber || 0),
          materials: asStringList(item?.materials),
        })).filter((item) => item.periodNumber > 0 || item.materials.length)
      : [],
    requiredTasks: Array.isArray(sourceInventory.requiredTasks)
      ? sourceInventory.requiredTasks.map((item, index) => ({
          taskId: asStringList(item?.taskId)[0] || `tv-task-${index + 1}`,
          label: asStringList(item?.label)[0] || "",
          taskType: asStringList(item?.taskType)[0] as NonNullable<NonNullable<VietnameseLessonBlueprint["sourceInventory"]>["requiredTasks"]>[number]["taskType"],
          periodNumber: Number(item?.periodNumber || 0) || undefined,
          sourceText: asStringList(item?.sourceText)[0] || "",
          required: item?.required === false ? false : true,
          productKind: asStringList(item?.productKind)[0] as NonNullable<NonNullable<VietnameseLessonBlueprint["sourceInventory"]>["requiredTasks"]>[number]["productKind"],
          expectedAnswer: asStringList(item?.expectedAnswer)[0] || "",
          criteria: asStringList(item?.criteria),
          sourceEvidence: asStringList(item?.sourceEvidence),
        })).filter((item) => item.label)
      : [],
    uncertain: asStringList(sourceInventory.uncertain),
  };
}

function normalizeVietnameseBlueprint(
  input: LessonInput,
  rawBlueprint: VietnameseLessonBlueprint,
  classification: VietnameseLessonClassification,
): VietnameseLessonBlueprint {
  const expectedPeriods = Math.max(1, Number(input.periods || 1));
  const rawPeriods = Array.isArray(rawBlueprint.periods) ? rawBlueprint.periods : [];
  const normalizedClassification = normalizeVietnameseClassification(rawBlueprint.classification, classification);
  const lessonTitle = rawBlueprint.lessonTitle?.trim() || input.lessonTitle || "Bài học Tiếng Việt";
  const periods = Array.from({ length: expectedPeriods }, (_, index): VietnamesePeriodBlueprint => {
    const periodNumber = index + 1;
    const rawPeriod = rawPeriods.find((period) => Number(period.periodNumber) === periodNumber) || rawPeriods[index] || {};
    const lessonType = isVietnameseLessonType(rawPeriod.lessonType) ? rawPeriod.lessonType : normalizedClassification.primaryType;
    const focus = rawPeriod.focus?.trim() || (expectedPeriods > 1 ? `Tiết ${periodNumber}: trọng tâm ${lessonTitle}` : `Trọng tâm ${lessonTitle}`);
    const checkerFlags = getVietnameseChecklist({ ...normalizedClassification, primaryType: lessonType });
    return {
      periodNumber,
      focus,
      lessonType,
      objectives: asStringList(rawPeriod.objectives).length ? asStringList(rawPeriod.objectives) : [`Hoàn thành trọng tâm ${vietnameseLessonTypeProfiles[lessonType].label.toLowerCase()} của ${focus}.`],
      sourceEvidence: rawPeriod.sourceEvidence || "Bám ngữ liệu, tranh và nhiệm vụ trong ảnh SGK; không tự bịa phần chưa rõ.",
      targetSkills: asStringList(rawPeriod.targetSkills).length ? asStringList(rawPeriod.targetSkills) : checkerFlags,
      continuityIn: rawPeriod.continuityIn || (periodNumber === 1 ? "Bắt đầu từ trải nghiệm ngôn ngữ, tranh/ảnh trong SGK và kiến thức nền." : `Nối tiếp sản phẩm học tập của tiết ${periodNumber - 1}.`),
      continuityOut: rawPeriod.continuityOut || (periodNumber < expectedPeriods ? `Chuẩn bị ngữ liệu/kĩ năng cho tiết ${periodNumber + 1}.` : "Chốt kĩ năng ngôn ngữ và vận dụng vào giao tiếp/đời sống."),
      activities: requiredActivityPhases.map((phase, activityIndex) => {
        const activity = findVietnameseActivityBlueprint(rawPeriod, phase, activityIndex);
        return {
          phase,
          title: activity.title || phase,
          objective: activity.objective || `Tổ chức hoạt động ${phase.toLowerCase()} bám trọng tâm ${focus}.`,
          durationMinutes: Number(activity.durationMinutes || vietnamesePhaseDuration(phase, input, lessonType)),
          focusSkills: asStringList(activity.focusSkills).length ? asStringList(activity.focusSkills) : asStringList(rawPeriod.targetSkills),
          handoffToNext: activity.handoffToNext || (activityIndex < requiredActivityPhases.length - 1 ? `Chuyển từ ${phase} sang ${requiredActivityPhases[activityIndex + 1]}.` : rawPeriod.continuityOut || "Chốt tiết học."),
          sourceTaskIds: safeStringArray(activity.sourceTaskIds),
          sourceUnitIds: safeStringArray(activity.sourceUnitIds),
          sourceClusterIds: safeStringArray(activity.sourceClusterIds),
        };
      }),
    };
  });

  return {
    lessonTitle,
    lessonOverview: rawBlueprint.lessonOverview || `Giáo án Tiếng Việt ${lessonTitle} được sinh theo blueprint chuyên biệt kiểu bài để giữ đúng mạch kĩ năng giữa các tiết.`,
    classification: normalizedClassification,
    sourceInventory: normalizeVietnameseSourceInventory(rawBlueprint.sourceInventory),
    outcomes: rawBlueprint.outcomes || {},
    materials: {
      teacher: asStringList(rawBlueprint.materials?.teacher).length ? asStringList(rawBlueprint.materials?.teacher) : ["Ảnh SGK/tranh minh họa", "Bảng phụ, thẻ từ hoặc phiếu học tập"],
      students: asStringList(rawBlueprint.materials?.students).length ? asStringList(rawBlueprint.materials?.students) : ["SGK Tiếng Việt", "Vở ghi/vở bài tập", "Bảng con hoặc phiếu học tập"],
    },
    assessment: {
      criteria: asStringList(rawBlueprint.assessment?.criteria).length ? asStringList(rawBlueprint.assessment?.criteria) : vietnameseLessonTypeProfiles[normalizedClassification.primaryType].assessmentCriteria,
      evidence: asStringList(rawBlueprint.assessment?.evidence).length ? asStringList(rawBlueprint.assessment?.evidence) : vietnameseLessonTypeProfiles[normalizedClassification.primaryType].learningProducts,
      comments: asStringList(rawBlueprint.assessment?.comments).length ? asStringList(rawBlueprint.assessment?.comments) : ["Nhận xét dựa trên quá trình thực hiện nhiệm vụ và sản phẩm ngôn ngữ quan sát được."],
    },
    contextFit: { notes: asStringList(rawBlueprint.contextFit?.notes) },
    continuityPlan: buildVietnameseContinuityPlan(
      normalizeVietnameseSourceInventory(rawBlueprint.sourceInventory),
      expectedPeriods,
      rawBlueprint.continuityPlan,
    ),
    periods,
  };
}

function activityFromVietnameseBlueprint(activity: VietnameseActivityBlueprint, index: number, lessonType: VietnameseLessonType): LessonPlan["activities"][number] {
  const phase = activityPhaseKey(activity) || requiredActivityPhases[index] || `Hoạt động ${index + 1}`;
  const profile = vietnameseLessonTypeProfiles[lessonType];
  const expectedProduct = profile.learningProducts[Math.min(index, profile.learningProducts.length - 1)] || `Sản phẩm ngôn ngữ của hoạt động ${phase.toLowerCase()}.`;
  return {
    phase,
    title: activity.title || phase,
    objective: activity.objective || `Giúp học sinh hoàn thành hoạt động ${phase.toLowerCase()} theo kiểu bài ${profile.label}.`,
    durationMinutes: activity.durationMinutes || 5,
    teacherActions: [
      `GV tổ chức hoạt động ${phase.toLowerCase()} bám ngữ liệu và trọng tâm ${profile.label.toLowerCase()}.`,
      "GV giao nhiệm vụ cụ thể, nêu tiêu chí và hỗ trợ học sinh theo lỗi ngôn ngữ thường gặp.",
    ],
    studentActions: [
      "HS quan sát/đọc/nghe ngữ liệu, nêu nhận xét hoặc dự đoán phù hợp nhiệm vụ.",
      "HS thực hiện nhiệm vụ, tạo sản phẩm ngôn ngữ và đối chiếu theo tiêu chí.",
    ],
    learningProducts: [expectedProduct],
    sourceTaskIds: safeStringArray(activity.sourceTaskIds),
    sourceUnitIds: safeStringArray(activity.sourceUnitIds),
    sourceClusterIds: safeStringArray(activity.sourceClusterIds),
  };
}

function normalizeVietnamesePeriodChunk(
  input: LessonInput,
  blueprint: VietnameseLessonBlueprint,
  periodBlueprint: VietnamesePeriodBlueprint,
  rawChunk: VietnamesePeriodChunk,
): VietnamesePeriodChunk {
  const periodNumber = Number(rawChunk.periodNumber || periodBlueprint.periodNumber || 1);
  const title = blueprint.lessonTitle || input.lessonTitle || "Bài học Tiếng Việt";
  const lessonType = periodBlueprint.lessonType || blueprint.classification?.primaryType || "mixed";
  const rawActivities = Array.isArray(rawChunk.activities) ? rawChunk.activities : [];
  const activities = requiredActivityPhases.map((phase, index) => {
    const source = rawActivities.find((activity) => activityPhaseKey(activity) === phase)
      || rawActivities[index]
      || activityFromVietnameseBlueprint(findVietnameseActivityBlueprint(periodBlueprint, phase, index), index, lessonType);
    const activityBlueprint = findVietnameseActivityBlueprint(periodBlueprint, phase, index);
    return normalizeVietnameseActivity({
      ...source,
      phase,
      title: source.title || activityBlueprint.title || phase,
      objective: source.objective || activityBlueprint.objective || `Tổ chức hoạt động ${phase.toLowerCase()} cho tiết ${periodNumber}.`,
      durationMinutes: source.durationMinutes || activityBlueprint.durationMinutes || vietnamesePhaseDuration(phase, input, lessonType),
      sourceTaskIds: safeStringArray(source.sourceTaskIds).length ? safeStringArray(source.sourceTaskIds) : asStringList(activityBlueprint.sourceTaskIds),
      sourceUnitIds: safeStringArray(source.sourceUnitIds).length ? safeStringArray(source.sourceUnitIds) : asStringList(activityBlueprint.sourceUnitIds),
      sourceClusterIds: safeStringArray(source.sourceClusterIds).length ? safeStringArray(source.sourceClusterIds) : asStringList(activityBlueprint.sourceClusterIds),
    }, index, lessonType, input, blueprint.sourceInventory);
  });
  const balancedActivities = rebalanceVietnamesePeriodActivities(input, lessonType, activities);

  return {
    periodNumber,
    focus: rawChunk.focus || periodBlueprint.focus || `Tiết ${periodNumber}: ${title}`,
    outcomes: normalizeVietnameseOutcomes(rawChunk.outcomes || blueprint.outcomes, `${title} - tiết ${periodNumber}`),
    activities: balancedActivities,
    handoff: rawChunk.handoff || {
      learned: periodBlueprint.continuityOut || `Học sinh hoàn thành trọng tâm tiết ${periodNumber}.`,
      unresolvedRisks: vietnameseLessonTypeProfiles[lessonType].commonErrors,
      nextBridge: periodBlueprint.continuityOut || "Chuyển sang hoạt động/tiết tiếp theo.",
    },
  };
}

async function generateVietnameseBlueprintWithModel(input: LessonInput, ocrText: string, strategy: AiStageStrategy, classification: VietnameseLessonClassification) {
  console.info("[EduPlan AI] Vietnamese chunked blueprint started", { model: strategy.model, periods: input.periods, lessonType: classification.primaryType, confidence: classification.confidence });
  const result = await fetchAiJsonContent(strategy, [
    { role: "system", content: "Bạn chỉ trả JSON hợp lệ. Tạo blueprint môn Tiếng Việt tiểu học theo đúng kiểu bài đã được classifier xác định; chưa viết giáo án đầy đủ." },
    { role: "user", content: buildVietnameseBlueprintPrompt(input, ocrText, classification) },
  ]);
  return normalizeVietnameseBlueprint(input, extractJson<VietnameseLessonBlueprint>(result.content), classification);
}

async function generateVietnamesePeriodWithModel(
  input: LessonInput,
  ocrText: string,
  strategy: AiStageStrategy,
  blueprint: VietnameseLessonBlueprint,
  period: VietnamesePeriodBlueprint,
  previousHandoff: VietnamesePeriodChunk["handoff"] | null,
) {
  const periodNumber = Number(period.periodNumber || 1);
  console.info("[EduPlan AI] Vietnamese chunked period started", { model: strategy.model, periodNumber, lessonType: period.lessonType, focus: period.focus });
  const result = await fetchAiJsonContent(strategy, [
    { role: "system", content: `Bạn chỉ trả JSON hợp lệ cho một tiết Tiếng Việt. Bám đúng kiểu bài ${period.lessonType || "mixed"}, viết đủ dùng dạy thật và kiểm soát độ dài.` },
    { role: "user", content: buildVietnamesePeriodPrompt(input, ocrText, blueprint, period, previousHandoff) },
  ]);
  return normalizeVietnamesePeriodChunk(input, blueprint, period, extractJson<VietnamesePeriodChunk>(result.content));
}

async function repairVietnamesePeriodWithModel(
  input: LessonInput,
  strategy: AiStageStrategy,
  blueprint: VietnameseLessonBlueprint,
  period: VietnamesePeriodChunk,
  issues: string[],
) {
  console.info("[EduPlan AI] Vietnamese chunked period repair started", { model: strategy.model, periodNumber: period.periodNumber, issueCount: issues.length });
  const result = await fetchAiJsonContent(strategy, [
    { role: "system", content: "Bạn chỉ trả JSON hợp lệ. Sửa riêng một PeriodPlan Tiếng Việt theo đúng kiểu bài; không viết lại toàn bộ bài và không nhồi thêm kĩ năng không liên quan." },
    { role: "user", content: buildVietnamesePeriodRepairPrompt(input, blueprint, period, issues) },
  ]);
  const periodBlueprint = vietnamesePeriodBlueprintFor(blueprint, Number(period.periodNumber || 1)) || { periodNumber: period.periodNumber, focus: period.focus, lessonType: blueprint.classification?.primaryType || "mixed" };
  return normalizeVietnamesePeriodChunk(input, blueprint, periodBlueprint, extractJson<VietnamesePeriodChunk>(result.content));
}

function buildVietnameseLessonFromChunks(input: LessonInput, blueprint: VietnameseLessonBlueprint, chunks: VietnamesePeriodChunk[], model: string): LessonPlan {
  const title = blueprint.lessonTitle || input.lessonTitle || "Bài học Tiếng Việt";
  const orderedChunks = chunks
    .slice()
    .sort((left, right) => Number(left.periodNumber || 0) - Number(right.periodNumber || 0))
    .map((chunk, index) => {
      const periodNumber = Number(chunk.periodNumber || index + 1);
      const periodType = vietnamesePeriodBlueprintFor(blueprint, periodNumber)?.lessonType || blueprint.classification?.primaryType || "mixed";
      const activities = rebalanceVietnamesePeriodActivities(
        input,
        periodType,
        (chunk.activities || []).map((activity, activityIndex) => normalizeVietnameseActivity(activity, activityIndex, periodType, input, blueprint.sourceInventory)),
      );
      return {
        ...chunk,
        periodNumber,
        outcomes: normalizeVietnameseOutcomes(chunk.outcomes || blueprint.outcomes, `${title} - tiết ${periodNumber}`),
        activities,
      };
    });
  const continuityNotes = orderedChunks.map((chunk) => chunk.handoff?.nextBridge || chunk.handoff?.learned || "").filter(Boolean).map((note, index) => `Tiết ${orderedChunks[index]?.periodNumber || index + 1}: ${note}`);
  return normalizeLesson(input, {
    generalInfo: { subject: "Tiếng Việt", grade: input.grade, lessonTitle: title, book: bookContext(input), periods: Number(input.periods || orderedChunks.length || 1), duration: Number(input.duration || 35) },
    outcomes: normalizeVietnameseOutcomes(blueprint.outcomes, title),
    materials: { teacher: blueprint.materials?.teacher?.length ? blueprint.materials.teacher : ["Ảnh SGK/tranh minh họa", "Bảng phụ, thẻ từ hoặc phiếu học tập"], students: blueprint.materials?.students?.length ? blueprint.materials.students : ["SGK Tiếng Việt", "Vở ghi/vở bài tập", "Bảng con hoặc phiếu học tập"] },
    activities: orderedChunks.flatMap((chunk) => chunk.activities || []),
    periodPlans: orderedChunks,
    assessment: { criteria: blueprint.assessment?.criteria || [], evidence: blueprint.assessment?.evidence || [], comments: blueprint.assessment?.comments || [] },
    adjustments: { suitablePoints: ["........................................................................................................................................"], pointsToAdjust: ["........................................................................................................................................"], nextLessonDirection: ["........................................................................................................................................"] },
    contextFit: { notes: [...(blueprint.contextFit?.notes || []), ...continuityNotes] },
    meta: { style: input.style, modelUsed: model, createdAt: new Date().toISOString(), vietnameseSourceInventory: blueprint.sourceInventory, continuityPlan: blueprint.continuityPlan },
  }, model);
}

function buildVietnameseChunkedAudit(
  lesson: LessonPlan,
  input: LessonInput,
  blueprint: VietnameseLessonBlueprint,
  repairApplied: boolean,
): PedagogyAudit {
  const audit = buildPedagogyAudit(lesson, input, repairApplied);
  const classification = blueprint.classification || classifyVietnameseLesson(input, JSON.stringify(lesson));
  const periodTypes = (blueprint.periods || []).map((period) => period.lessonType || classification.primaryType);
  const periodChecks = periodTypes.map((lessonType, index) => ({
    periodNumber: Number(blueprint.periods?.[index]?.periodNumber || index + 1),
    lessonType,
    checks: getVietnameseChecklist({ ...classification, primaryType: lessonType }),
  }));
  const remainingIssues = (lesson.periodPlans || []).flatMap((period, index) => {
    const blueprintPeriod = vietnamesePeriodBlueprintFor(blueprint, Number(period.periodNumber || index + 1));
    return vietnamesePeriodIssues(period, blueprintPeriod, input).map((issue) => `Tiết ${Number(period.periodNumber || index + 1)}: ${issue}`);
  });
  const coverageIssues = validateVietnameseTaskCoverage(lesson, input, blueprint.sourceInventory).map(formatRepairFinding);
  const issues = Array.from(new Set([...audit.issues, ...remainingIssues, ...coverageIssues]));
  return {
    ...audit,
    lessonType: classification.primaryType,
    classificationConfidence: classification.confidence,
    periodTypes,
    periodChecks,
    issues,
    checks: getVietnameseChecklist(classification),
    status: issues.length || audit.status === "needs-review"
      ? "needs-review"
      : repairApplied
        ? "repaired"
        : "passed",
  };
}

async function generateVietnameseLessonChunkedWithModel(
  input: LessonInput,
  ocrText: string,
  strategy: PlanModelStrategy,
  cachedSourceInventory?: VietnameseLessonBlueprint["sourceInventory"],
) {
  const sourceAwareText = buildVietnameseSourceInventoryPromptContext(ocrText, cachedSourceInventory);
  const classification = classifyVietnameseLesson(input, sourceAwareText);
  const blueprint = await generateVietnameseBlueprintWithModel(input, sourceAwareText, strategy.blueprint, classification);
  blueprint.sourceInventory = mergeVietnameseSourceInventories(cachedSourceInventory, blueprint.sourceInventory);
  blueprint.continuityPlan = buildVietnameseContinuityPlan(blueprint.sourceInventory, input.periods, blueprint.continuityPlan);
  const periods = blueprint.periods || [];
  let chunks: VietnamesePeriodChunk[] = [];
  let previousHandoff: VietnamesePeriodChunk["handoff"] | null = null;
  for (const period of periods) {
    const chunk = await generateVietnamesePeriodWithModel(input, sourceAwareText, strategy.detail, blueprint, period, previousHandoff);
    chunks.push(chunk);
    previousHandoff = chunk.handoff || null;
  }
  let repairApplied = false;

  if (strategy.plan !== "free" && canStartAiRepair("vietnamese-period-repair", MIN_PERIOD_REPAIR_BUDGET_MS, { periodCount: chunks.length })) {
    const repaired = await Promise.all(chunks.map(async (chunk, index) => {
      const period = periods[index] || vietnamesePeriodBlueprintFor(blueprint, Number(chunk.periodNumber || index + 1)) || {};
      const issues = vietnamesePeriodIssues(chunk, period, input);
      if (!issues.length) return { chunk, repaired: false };
      if (!canStartAiRepair("vietnamese-period-repair-item", MIN_PERIOD_REPAIR_BUDGET_MS, { periodNumber: chunk.periodNumber, issueCount: issues.length })) return { chunk, repaired: false };
      try {
        return { chunk: await repairVietnamesePeriodWithModel(input, strategy.repair, blueprint, chunk, issues), repaired: true };
      } catch (repairError) {
        console.warn("[EduPlan AI] Vietnamese chunked period repair skipped", { model: strategy.repair.model, periodNumber: chunk.periodNumber, message: repairError instanceof Error ? repairError.message : "Unknown repair error" });
        return { chunk, repaired: false };
      }
    }));
    chunks = repaired.map((item) => item.chunk);
    repairApplied = repaired.some((item) => item.repaired);
  } else {
    const issueCount = chunks.reduce((total, chunk, index) => {
      const period = periods[index] || vietnamesePeriodBlueprintFor(blueprint, Number(chunk.periodNumber || index + 1)) || {};
      return total + vietnamesePeriodIssues(chunk, period, input).length;
    }, 0);
    if (issueCount) console.info("[EduPlan AI] Vietnamese repair deferred to audit", { plan: strategy.plan, issueCount, lessonType: classification.primaryType, reason: strategy.plan === "free" ? "free-plan" : "time-budget" });
  }

  const lesson = buildVietnameseLessonFromChunks(input, blueprint, chunks, strategy.detail.model);
  if (hasStructuralIssues(lesson, input) || isMissingPeriods(lesson, input.periods)) {
    throw new Error("Giáo án Tiếng Việt chunked chưa đủ cấu trúc sau khi ghép. Vui lòng bấm tạo lại hoặc giảm số tiết/ảnh.");
  }
  const pedagogyAudit = buildVietnameseChunkedAudit(lesson, input, blueprint, repairApplied);
  if (pedagogyAudit.issues.length) console.warn("[EduPlan AI] Vietnamese chunked lesson has remaining issues", { model: strategy.detail.model, issueCount: pedagogyAudit.issues.length, lessonType: pedagogyAudit.lessonType });
  return { lesson, pedagogyAudit };
}


function periodsForValidation(lesson: LessonPlan) {
  if (lesson.periodPlans?.length) return lesson.periodPlans;
  return [{ periodNumber: 1, focus: "Tiến trình dạy học", activities: lesson.activities || [] }];
}


function isSparseLesson(lesson: LessonPlan, input?: LessonInput) {
  return hasStructuralIssues(lesson, input) || hasQualityIssues(lesson, input);
}

function hasStructuralIssues(lesson: LessonPlan, input?: LessonInput) {
  if (!Array.isArray(lesson.activities) || lesson.activities.length < 4) return true;
  const periods = periodsForValidation(lesson);
  if (!periods.length || periods.some((period) => !periodHasRequiredPhases(period.activities || []))) return true;
  if (input && Number(input.periods) > 1 && periods.length < Number(input.periods)) return true;
  return false;
}

function hasDetailedOutcomes(lesson: LessonPlan) {
  return hasDetailedOutcomeGroup(lesson.outcomes);
}

function hasPeriodSpecificOutcomes(lesson: LessonPlan, input?: LessonInput) {
  const expectedPeriods = Number(input?.periods || lesson.generalInfo?.periods || 1);
  if (expectedPeriods <= 1) return true;
  const periods = periodsForValidation(lesson);
  if (periods.length < expectedPeriods) return false;
  const serialized = periods.map((period) => JSON.stringify(period.outcomes || {}));
  const hasMissingOrWeakOutcomes = periods.some((period) => !period.outcomes || !hasDetailedOutcomeGroup(period.outcomes));
  const allSame = new Set(serialized).size <= 1;
  return !hasMissingOrWeakOutcomes && !allSame;
}

function hasLearningContextSignals(lesson: LessonPlan, input: LessonInput) {
  const contextSelected =
    input.teachingEnvironment !== "auto" ||
    input.studentProfile !== "auto" ||
    input.facilities !== "auto" ||
    input.hometownProvince !== "auto" ||
    Boolean(input.localityNote.trim());
  if (!contextSelected) return true;

  const text = JSON.stringify({
    materials: lesson.materials,
    activities: lesson.activities,
    contextFit: lesson.contextFit,
  });
  const facilitySignals =
    /TV|máy chiếu|wifi|bảng tương tác|loa|video|slide|bản đồ số|tranh in|thẻ|vật thật|phiếu học tập|bảng phụ|quan sát thực tế|sân trường|địa phương|nông thôn|thành thị|vùng núi|điểm trường/i;
  return facilitySignals.test(text);
}

function hasQualityIssues(lesson: LessonPlan, input?: LessonInput) {
  if (!hasDetailedOutcomes(lesson)) return true;
  if (!hasPeriodSpecificOutcomes(lesson, input)) return true;
  if (input && !hasLearningContextSignals(lesson, input)) return true;
  if (input && !hasSubjectPedagogySignals(lesson, input)) return true;
  const periods = periodsForValidation(lesson);

  const style = input?.style || "Dạy thật trên lớp";
  const highQuality = style === "Sáng tạo, sinh động";
  return periods.some((period) => period.activities.some((activity, index) => {
    const teacherText = (activity.teacherActions || []).join(" ");
    const studentText = (activity.studentActions || []).join(" ");
    const combinedText = `${activity.phase} ${activity.title} ${activity.objective} ${teacherText} ${studentText} ${(activity.learningProducts || []).join(" ")}`;
    const hasTeachingScriptSignals = /tình huống|câu hỏi|dự kiến|chốt|sản phẩm|luật chơi|phiếu|nhóm|đời sống|nhận xét|hỗ trợ/i.test(combinedText);
    const hasCreativeTechnique = !highQuality || /trò chơi|khăn trải bàn|mảnh ghép|phòng tranh|thẻ tín hiệu|đóng vai|dự đoán|thử thách|hộp bí mật|góc ý kiến|STEM|STEAM|video|tranh|phiếu nhiệm vụ/i.test(combinedText);
    return (
      !hasEqualActionPairs(activity) ||
      hasWeaklyPairedActions(activity) ||
      hasTooManyActionPairs(activity, index) ||
      !activity.durationMinutes ||
      activityMinutes(activity, index) <= 0 ||
      !activity.learningProducts?.length ||
      !hasTeachingScriptSignals ||
      !hasCreativeTechnique
    );
  }));
}

function isMissingPeriods(lesson: LessonPlan, expectedPeriods: number) {
  return expectedPeriods > 1 && (!lesson.periodPlans || lesson.periodPlans.length < expectedPeriods);
}


function extractJson<T>(text: string) {
  return extractAiJsonValue<T>(text);
}

function sanitizeLessonText<T>(value: T): T {
  const raw = JSON.stringify(value)
    .replace(/tranh\s*\/\s*SGK\s*\/\s*OCR/gi, "tranh trong SGK")
    .replace(/SGK\s*\/\s*OCR/gi, "SGK")
    .replace(/theo\s+OCR/gi, "trong ảnh SGK")
    .replace(/từ\s+OCR/gi, "từ ảnh SGK")
    .replace(/nội dung\s+OCR/gi, "nội dung ảnh SGK")
    .replace(/\bOCR\b/g, "ảnh SGK");
  return JSON.parse(raw) as T;
}

function expandQuality(item: string, lessonTitle: string) {
  const trimmed = item.trim();
  if (trimmed.length >= 32) return trimmed;
  const title = lessonTitle || "bài học";
  if (/nhân ái/i.test(trimmed)) return `Nhân ái: biết quan tâm, lắng nghe, chia sẻ và có lời nói, việc làm phù hợp để giúp đỡ người khác trong các tình huống gắn với ${title}.`;
  if (/trách nhiệm/i.test(trimmed)) return `Trách nhiệm: chủ động thực hiện nhiệm vụ học tập, biết nhận phần việc phù hợp và có ý thức vận dụng điều đã học vào hành vi hằng ngày.`;
  if (/chăm chỉ/i.test(trimmed)) return `Chăm chỉ: tích cực quan sát tranh/ảnh trong SGK, tham gia thảo luận, hoàn thành phiếu/nhiệm vụ học tập và mạnh dạn chia sẻ kết quả.`;
  if (/trung thực/i.test(trimmed)) return `Trung thực: nêu đúng suy nghĩ của bản thân, biết nhận xét hành vi đúng - chưa đúng dựa trên tình huống bài học và không nói theo bạn một cách máy móc.`;
  if (/yêu nước/i.test(trimmed)) return `Yêu nước: biết trân trọng những giá trị tốt đẹp trong gia đình, nhà trường và cộng đồng qua nội dung ${title}.`;
  return `${trimmed}: thể hiện bằng hành vi cụ thể trong quá trình học tập, thảo luận, thực hành và vận dụng nội dung ${title} vào đời sống.`;
}

function expandOutcome(item: string, lessonTitle: string, category: "knowledge" | "general" | "specific") {
  const trimmed = item.trim();
  if (trimmed.length >= 40 && /:|biết|thực hiện|trình bày|trao đổi|vận dụng|đề xuất|quan sát|hoàn thành/i.test(trimmed)) return trimmed;
  const title = lessonTitle || "bài học";
  if (category === "knowledge") return `${trimmed}: thực hiện được qua câu trả lời, bài tập hoặc sản phẩm học tập phù hợp với yêu cầu của ${title}.`;
  if (category === "general") return `${trimmed}: chủ động nhận nhiệm vụ, trao đổi với bạn và trình bày kết quả học tập gắn với ${title}.`;
  return `${trimmed}: sử dụng kiến thức, kĩ năng đặc thù của môn học để hoàn thành nhiệm vụ trong ${title} và liên hệ tình huống phù hợp.`;
}

function uniqueItems(items: string[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.toLowerCase().replace(/\s+/g, " ").trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeOutcomes(outcomes: Partial<LessonOutcomes> | undefined, lessonTitle: string): LessonOutcomes {
  const general = safeStringArray(outcomes?.generalCompetencies);
  const specific = safeStringArray(outcomes?.specificCompetencies);
  const qualitiesList = safeStringArray(outcomes?.qualities);
  const knowledge = safeStringArray(outcomes?.knowledgeAndSkills);
  const digital = safeStringArray(outcomes?.digitalCompetencies);
  const objectiveMetadata = Array.isArray(outcomes?.objectiveMetadata)
    ? outcomes.objectiveMetadata.map((item) => ({
        ...item,
        id: String(item.id || "").trim(),
        statement: String(item.statement || "").trim(),
        evidence: {
          activityIds: safeStringArray(item.evidence?.activityIds),
          learningProducts: safeStringArray(item.evidence?.learningProducts),
          successCriteria: safeStringArray(item.evidence?.successCriteria),
        },
      })).filter((item) => item.id && item.statement)
    : [];

  return {
    generalCompetencies: uniqueItems((general.length ? general : ["Tự chủ và tự học", "Giao tiếp và hợp tác"]).map((item) => expandOutcome(item, lessonTitle, "general"))),
    specificCompetencies: uniqueItems((specific.length ? specific : ["Năng lực đặc thù môn học"]).map((item) => expandOutcome(item, lessonTitle, "specific"))),
    qualities: uniqueItems((qualitiesList.length ? qualitiesList : ["Chăm chỉ", "Trách nhiệm"]).map((item) => expandQuality(item, lessonTitle))),
    knowledgeAndSkills: uniqueItems((knowledge.length ? knowledge : ["Hoàn thành yêu cầu học tập trọng tâm"]).map((item) => expandOutcome(item, lessonTitle, "knowledge"))),
    digitalCompetencies: uniqueItems(digital),
    ...(objectiveMetadata.length ? { objectiveMetadata } : {}),
  };
}

function normalizeNaturalSocialOutcomes(outcomes: Partial<LessonOutcomes> | undefined, lessonTitle: string): LessonOutcomes {
  const normalized = normalizeOutcomes(outcomes, lessonTitle);
  const clean = (items: string[] | undefined) => (items || []).map(sanitizeNaturalSocialVisibleString).filter(Boolean);
  return {
    ...normalized,
    generalCompetencies: clean(normalized.generalCompetencies),
    specificCompetencies: clean(normalized.specificCompetencies),
    qualities: clean(normalized.qualities),
    knowledgeAndSkills: clean(normalized.knowledgeAndSkills),
    digitalCompetencies: clean(normalized.digitalCompetencies),
    ...(normalized.objectiveMetadata?.length
      ? {
          objectiveMetadata: normalized.objectiveMetadata.map((item) => ({
            ...item,
            statement: sanitizeNaturalSocialVisibleString(item.statement),
            evidence: {
              ...item.evidence,
              learningProducts: clean(item.evidence.learningProducts),
              successCriteria: clean(item.evidence.successCriteria),
            },
          })),
        }
      : {}),
  };
}

const vietnameseOutcomeVerbPattern = /^(?:Đọc|Hiểu|Tìm|Xác định|Sắp xếp|Nêu|Lựa chọn|Đặt câu|Viết|Tự sửa)\b/iu;
const vietnameseTemplatePhrasePattern = /ba từ khóa|có một bằng chứng|giải thích tác dụng|phân tích tác dụng|hiệu quả của nhịp|phép lặp|phân tích nghệ thuật/i;
const vietnameseSafePreparationNote = "Ghi chú chuẩn bị: GV đối chiếu ảnh SGK trước giờ dạy.";
const vietnameseRawUncertaintyPattern = /cần\s+(?:gv|giáo viên\s+)?xác minh|cần xác minh|ocr\s+chưa\s+rõ|kiểm tra lại\s+sgk|đối chiếu\s+(?:bằng|lại|theo)\s+sgk(?:\s+bản\s+in)?|chốt\s+theo\s+sgk|theo\s+sgk\s+bản\s+in/i;

function sanitizeVietnameseUncertaintyText(value: string) {
  return value
    .replace(/\([^)]*(?:cần\s+(?:gv|giáo viên\s+)?xác minh|cần xác minh|ocr\s+chưa\s+rõ|kiểm tra lại\s+sgk|đối chiếu\s+(?:bằng|lại|theo)\s+sgk(?:\s+bản\s+in)?)[^)]*\)/gi, "")
    .replace(/\[[^\]]*(?:cần\s+(?:gv|giáo viên\s+)?xác minh|cần xác minh|ocr\s+chưa\s+rõ|kiểm tra lại\s+sgk|đối chiếu\s+(?:bằng|lại|theo)\s+sgk(?:\s+bản\s+in)?)[^\]]*\]/gi, "")
    .replace(/(?:GV\s+)?chốt\s+theo\s+SGK\.?/gi, vietnameseSafePreparationNote)
    .replace(/(?:cần\s+(?:GV|giáo viên\s+)?xác minh|cần xác minh|OCR\s+chưa\s+rõ|kiểm tra lại\s+SGK|đối chiếu\s+(?:bằng|lại|theo)\s+SGK(?:\s+bản\s+in)?|theo\s+SGK\s+bản\s+in)\.?/gi, vietnameseSafePreparationNote)
    .replace(/(?:Ghi chú chuẩn bị:\s*){2,}/gi, "Ghi chú chuẩn bị: ");
}

function sanitizeVietnameseString(value: string) {
  return sanitizeVietnameseUncertaintyText(String(value || ""))
    .replace(/\.\s*:/g, ":")
    .replace(/\s*[:：]?\s*thực hiện được qua[^.;。]*[.;。]?/gi, "")
    .replace(/\s*[:：]?\s*sử dụng kiến thức,?\s*kĩ năng đặc thù[^.;。]*[.;。]?/gi, "")
    .replace(/\s*[:：]?\s*sử dụng kiến thức đặc thù[^.;。]*[.;。]?/gi, "")
    .replace(/kiến thức đặc thù|nội dung học tập đặc thù|được hình thành qua các hoạt động|được hình thành qua|qua các hoạt động học tập/gi, "")
    .replace(/\bOCR\b/gi, "ảnh SGK")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();
}

function sanitizeVietnameseLessonText<T>(value: T): T {
  if (typeof value === "string") return sanitizeVietnameseString(value) as T;
  if (Array.isArray(value)) return value.map((item) => sanitizeVietnameseLessonText(item)) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, sanitizeVietnameseLessonText(item)]),
    ) as T;
  }
  return value;
}

function comparableVietnameseText(value: string) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function vietnameseContentWords(value: string) {
  const stopWords = new Set(["bai", "ban", "bang", "cac", "cau", "cho", "cua", "duoc", "dung", "giao", "hoc", "hoc sinh", "hoac", "khi", "lop", "mot", "nang", "neu", "noi", "qua", "sach", "sgk", "the", "theo", "tiet", "trong", "tu", "va", "voi", "yeu"]);
  return comparableVietnameseText(value).split(" ").filter((word) => word.length >= 3 && !stopWords.has(word));
}

function vietnameseTextOverlap(left: string, right: string) {
  const leftWords = new Set(vietnameseContentWords(left));
  const rightWords = new Set(vietnameseContentWords(right));
  if (!leftWords.size || !rightWords.size) return 0;
  const hits = [...leftWords].filter((word) => rightWords.has(word)).length;
  return hits / Math.min(leftWords.size, rightWords.size);
}

function normalizeVietnameseOutcomeStatement(item: string, fallback: string) {
  const cleaned = sanitizeVietnameseString(item).replace(/^[-–—•\s\d.]+/, "").trim();
  if (vietnameseOutcomeVerbPattern.test(cleaned)) return cleaned;
  if (/^biết\s+/i.test(cleaned) && /đọc|ngắt nghỉ|viết|dùng|trả lời|nêu/i.test(cleaned)) {
    return `Nêu ${cleaned.replace(/^biết\s+/i, "").trim()}`.replace(/\s+/g, " ");
  }
  return fallback;
}

function vietnameseOutcomeFallbacks(lessonTitle: string) {
  const title = lessonTitle || "bài học";
  return [
    `Đọc đúng hoặc nghe hiểu ngữ liệu chính của ${title}.`,
    "Tìm được thông tin, từ ngữ hoặc yêu cầu trọng tâm trong ngữ liệu.",
    "Nêu được câu trả lời ngắn phù hợp với nhiệm vụ.",
    "Viết hoặc hoàn thành bài tập ngôn ngữ theo yêu cầu.",
  ];
}

function boundedUnique(items: string[], minimum: number, maximum: number, fallbacks: string[]) {
  const result = uniqueItems(items.map(sanitizeVietnameseString).filter(Boolean));
  for (const fallback of fallbacks) {
    if (result.length >= minimum) break;
    if (!result.some((item) => comparableVietnameseText(item) === comparableVietnameseText(fallback))) result.push(fallback);
  }
  return result.slice(0, maximum);
}

function keepVietnameseDigitalCompetency(item: string) {
  const text = comparableVietnameseText(item);
  const hasDigitalTool = /cong cu so|thiet bi so|hoc lieu so|du lieu so|noi dung so|may tinh|may tinh bang|dien thoai|phan mem|ung dung|internet|truc tuyen|tep|file|anh so|video|am thanh|ghi am|thu am|slide|canva|powerpoint|word|google|ai/.test(text);
  const hasStudentOperation = /thao tac|su dung|tim kiem|truy cap|chon|keo tha|go|nhap|tao|chinh sua|sap xep|luu|chia se|ghi am|thu am|chup|quay|dien vao/.test(text);
  const projectedOnly = /gv|giao vien|trinh chieu|may chieu|man chieu|quan sat tranh chieu|quan sat anh chieu|xem video|xem slide/.test(text)
    && !hasStudentOperation;
  return hasDigitalTool && hasStudentOperation && !projectedOnly;
}

function normalizeVietnameseOutcomes(outcomes: Partial<LessonOutcomes> | undefined, lessonTitle: string): LessonOutcomes {
  const knowledgeFallbacks = vietnameseOutcomeFallbacks(lessonTitle);
  const rawKnowledge = safeStringArray(outcomes?.knowledgeAndSkills);
  const knowledge = boundedUnique(
    (rawKnowledge.length ? rawKnowledge : knowledgeFallbacks).map((item, index) => normalizeVietnameseOutcomeStatement(item, knowledgeFallbacks[index % knowledgeFallbacks.length])),
    4,
    6,
    knowledgeFallbacks,
  );

  const rawGeneral = safeStringArray(outcomes?.generalCompetencies);
  const general = boundedUnique(
    rawGeneral.length ? rawGeneral : [
      "Tự chủ và tự học: nhận nhiệm vụ, chuẩn bị đồ dùng và hoàn thành phần việc được giao.",
      "Giao tiếp và hợp tác: trao đổi ngắn với bạn khi đọc, viết, nói hoặc nghe.",
    ],
    1,
    2,
    ["Tự chủ và tự học: nhận nhiệm vụ và hoàn thành phần việc được giao."],
  );

  const rawSpecific = safeStringArray(outcomes?.specificCompetencies)
    .map(sanitizeVietnameseString)
    .filter((item) => item && !knowledge.some((target) => vietnameseTextOverlap(item, target) >= 0.75));
  const specific = boundedUnique(
    rawSpecific.length ? rawSpecific : ["Năng lực ngôn ngữ: đọc, viết, nói và nghe theo yêu cầu của bài học."],
    1,
    3,
    ["Năng lực ngôn ngữ: sử dụng tiếng Việt rõ ràng trong nhiệm vụ đọc, viết, nói và nghe."],
  );

  const rawQualities = safeStringArray(outcomes?.qualities);
  const qualities = boundedUnique(
    rawQualities.length ? rawQualities : ["Chăm chỉ: tích cực luyện đọc, viết, nói hoặc nghe trong giờ học."],
    1,
    2,
    ["Chăm chỉ: hoàn thành nhiệm vụ ngôn ngữ được giao."],
  );

  const normalized: LessonOutcomes = {
    generalCompetencies: general,
    specificCompetencies: specific,
    qualities,
    knowledgeAndSkills: knowledge,
    digitalCompetencies: uniqueItems(safeStringArray(outcomes?.digitalCompetencies).map(sanitizeVietnameseString).filter(keepVietnameseDigitalCompetency)),
  };
  if (Array.isArray(outcomes?.objectiveMetadata) && outcomes.objectiveMetadata.length) {
    normalized.objectiveMetadata = outcomes.objectiveMetadata;
  }
  return normalized;
}

function fallbackActivityProduct(activity: LessonPlan["activities"][number], index: number) {
  const key = activityPhaseKey(activity);
  if (key === "Khởi động") return "Câu trả lời/chia sẻ ban đầu của học sinh";
  if (key === "Khám phá") return "Kết quả quan sát, thảo luận hoặc phiếu học tập của học sinh";
  if (key === "Luyện tập") return "Bài làm hoặc sản phẩm luyện tập của học sinh";
  if (key === "Vận dụng") return "Ý tưởng/ví dụ vận dụng của học sinh gắn với đời sống";
  return `Sản phẩm học tập của hoạt động ${index + 1}`;
}

function normalizeActivityErrorFeedback(value: unknown): LessonActivityErrorFeedback[] {
  if (!Array.isArray(value)) {
    const feedback = safeStringArray(value);
    return feedback.length ? [{ error: "Lỗi thường gặp", feedback }] : [];
  }

  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      const feedback = safeStringArray(item);
      return feedback.length ? [{ error: "Lỗi thường gặp", feedback }] : [];
    }

    const record = item as { error?: unknown; feedback?: unknown };
    const error = safeStringArray(record.error)[0] || "Lỗi thường gặp";
    const feedback = safeStringArray(record.feedback);
    return feedback.length ? [{ error, feedback }] : [];
  });
}

function balanceActionPairs(activity: LessonPlan["activities"][number], index: number) {
  const pairs = pairedActivityActions(activity);

  return {
    teacherActions: pairs.map((pair, actionIndex) => pair.teacher || `GV hướng dẫn học sinh hoàn thành bước ${actionIndex + 1} của hoạt động ${activity.phase || index + 1}.`),
    studentActions: pairs.map((pair, actionIndex) => pair.student || `HS theo dõi hướng dẫn của GV và tham gia bước ${actionIndex + 1} của hoạt động.`),
  };
}

function normalizeActivity(activity: LessonPlan["activities"][number], index: number) {
  const actionPairs = balanceActionPairs(activity, index);
  const products = safeStringArray(activity.learningProducts);
  return {
    ...activity,
    phase: activity.phase || `Hoạt động ${index + 1}`,
    title: activity.title || activity.phase || `Hoạt động ${index + 1}`,
    objective: activity.objective || "Giúp học sinh hoàn thành mục tiêu học tập của hoạt động.",
    durationMinutes: activity.durationMinutes || activityMinutes(activity, index),
    teacherActions: actionPairs.teacherActions,
    studentActions: actionPairs.studentActions,
    inputOrMaterials: safeStringArray(activity.inputOrMaterials),
    learningProducts: products.length ? products : [fallbackActivityProduct(activity, index)],
    successCriteria: safeStringArray(activity.successCriteria),
    acceptableResponses: safeStringArray(activity.acceptableResponses),
    commonErrors: safeStringArray(activity.commonErrors),
    teacherFeedback: safeStringArray(activity.teacherFeedback),
    errorFeedback: normalizeActivityErrorFeedback(activity.errorFeedback),
    supportForStudentsNeedingHelp: safeStringArray(activity.supportForStudentsNeedingHelp),
    extensionForEarlyFinishers: safeStringArray(activity.extensionForEarlyFinishers),
    objectiveIds: safeStringArray(activity.objectiveIds),
    sourceTaskIds: safeStringArray(activity.sourceTaskIds),
    sourceVisualIds: safeStringArray(activity.sourceVisualIds),
    sourceUnitIds: safeStringArray(activity.sourceUnitIds),
    sourceClusterIds: safeStringArray(activity.sourceClusterIds),
  };
}

function vietnameseActivityTaskText(activity: LessonPlan["activities"][number]) {
  return [
    activity.phase,
    activity.title,
    activity.objective,
    ...(activity.teacherActions || []),
    ...(activity.studentActions || []),
    ...(activity.learningProducts || []),
    ...(activity.successCriteria || []),
    activity.expectedAnswer || "",
    ...(activity.acceptableResponses || []),
  ].join(" ");
}

type VietnameseProductKind =
  | "spelling"
  | "phonics"
  | "proper-noun"
  | "punctuation"
  | "question-writing"
  | "composition"
  | "storytelling"
  | "speaking"
  | "reading-fluency"
  | "reading-comprehension"
  | "language-knowledge"
  | "riddle"
  | "generic";

function vietnameseActivityFullText(activity: LessonPlan["activities"][number]) {
  return `${vietnameseActivityTaskText(activity)} ${(activity.inputOrMaterials || []).join(" ")}`;
}

function vietnameseProductKind(activity: LessonPlan["activities"][number]): VietnameseProductKind {
  const text = comparableVietnameseText(vietnameseActivityFullText(activity));
  if (/cau do|giai do|do vui/.test(text)) return "riddle";
  if (/nghe viet|nho viet|chinh ta|doan viet|soat loi/.test(text)) return "spelling";
  if (/ten dia danh|ten rieng|viet hoa ten|viet hoa dung ten|dia danh/.test(text)) return "proper-noun";
  if (/(viet|dat|lap).{0,20}cau hoi/.test(text)) return "question-writing";
  if (/dau cham|dau cham hoi|dau cau|sau cau|6 cau|dien dau/.test(text)) return "punctuation";
  if (/ch tr|c k|ac at|am van|dien am|dien van|phan biet am|phan biet van|the chu|the tu/.test(text)) return "phonics";
  if (/3 5 cau|viet.{0,25}[0-9]+ cau|viet doan|lap y|viet cau ve|viet lai cau/.test(text)) return "composition";
  if (/ke chuyen|ke lai cau chuyen|tranh truyen|noi va nghe/.test(text)) return "storytelling";
  if (/noi|trinh bay|chia se|trao doi truoc lop/.test(text)) return "speaking";
  if (/luyen doc|doc thanh tieng|doc noi tiep|ngat nghi|doc mau|giong doc|toc do doc/.test(text)) return "reading-fluency";
  if (/tra loi|tim chi tiet|y chinh|vi sao|tai sao|doc hieu|cau hoi/.test(text)) return "reading-comprehension";
  if (/luyen tu|mo rong von tu|tu dong nghia|truong nghia|dat cau|danh tu|dong tu|tinh tu|cau ke|cau cam|cau khien/.test(text)) return "language-knowledge";
  return "generic";
}

function vietnameseDefaultCriteria(activity: LessonPlan["activities"][number]) {
  switch (vietnameseProductKind(activity)) {
    case "spelling":
      return ["Viết đủ đoạn, đúng phần lớn tiếng.", "Viết hoa, dùng dấu câu và trình bày sạch."];
    case "proper-noun":
      return ["Viết hoa đúng từng bộ phận của tên riêng.", "Ghi đúng tên địa danh/tên riêng theo yêu cầu."];
    case "punctuation":
      return ["Điền đúng dấu chấm hoặc dấu chấm hỏi.", "Đọc lại câu sau khi điền dấu phù hợp."];
    case "question-writing":
      return ["Viết được câu hỏi rõ ý.", "Viết hoa đầu câu và dùng đúng dấu chấm hỏi."];
    case "phonics":
      return ["Điền đúng âm/vần hoặc từ theo yêu cầu.", "Đọc được từ/cụm từ sau khi hoàn thành."];
    case "composition":
      return ["Viết đủ số câu, trọn ý.", "Dùng đúng dấu câu cơ bản."];
    case "storytelling":
      return ["Kể đúng trình tự sự việc chính.", "Lời kể rõ ràng, biết nghe và nhận xét ngắn."];
    case "speaking":
      return ["Nói đủ ý, rõ câu.", "Biết nghe và phản hồi ngắn phù hợp."];
    case "reading-fluency":
      return ["Đọc đúng tiếng, rõ lời.", "Biết ngắt nghỉ ở câu dài."];
    case "reading-comprehension":
      return ["Trả lời đúng ý.", "Nêu được chi tiết liên quan."];
    case "language-knowledge":
      return ["Làm đúng bài tập từ/câu theo yêu cầu.", "Dùng được từ hoặc kiểu câu vừa học."];
    case "riddle":
      return ["Ghi hoặc nêu đúng đáp án câu đố.", "Nói rõ đáp án bằng một câu ngắn."];
    default:
      return ["Hoàn thành đúng yêu cầu chính.", "Trình bày rõ, dễ theo dõi."];
  }
}

function vietnameseCriterionConflictsWithProduct(criterion: string, kind: VietnameseProductKind) {
  const text = comparableVietnameseText(criterion);
  if (/co mot bang chung|giai thich tac dung|phan tich tac dung|hieu qua cua nhip|phan tich nghe thuat/.test(text)) return true;
  if (kind === "spelling") return /bang chung|ngat nghi|doc dung tieng|tra loi dung y|chi tiet lien quan/.test(text);
  if (kind === "proper-noun") return /ngat nghi|bang chung|doc thanh tieng|ke dung trinh tu|viet du so cau/.test(text);
  if (kind === "punctuation") return /ngat nghi|bang chung|viet du doan|ke dung trinh tu|noi du y/.test(text);
  if (kind === "question-writing") return /ngat nghi|bang chung|viet du doan|dien dung am|ke dung trinh tu/.test(text);
  if (kind === "phonics") return /bang chung|ngat nghi|viet du doan|ke dung trinh tu|noi du y/.test(text);
  if (kind === "composition") return /ngat nghi|bang chung|dien dung am|doc dung tieng/.test(text);
  if (kind === "storytelling" || kind === "speaking") return /ngat nghi|dien dung am|viet du doan|viet hoa dung tung bo phan/.test(text);
  if (kind === "reading-fluency") return /dien dung am|viet du doan|dung dau cham|ke dung trinh tu|viet hoa dung tung bo phan/.test(text);
  if (kind === "reading-comprehension") return /dien dung am|viet du doan|ngat nghi o cau dai|ke dung trinh tu|viet hoa dung tung bo phan/.test(text);
  return false;
}

function sanitizeVietnameseCriteria(criteria: string[], activity: LessonPlan["activities"][number]) {
  const cleaned = uniqueItems(criteria.map(sanitizeVietnameseString).filter(Boolean));
  const hasTemplate = cleaned.some((item) => vietnameseTemplatePhrasePattern.test(item));
  const kind = vietnameseProductKind(activity);
  const usable = hasTemplate ? [] : cleaned.filter((item) => !vietnameseCriterionConflictsWithProduct(item, kind));
  return uniqueItems([...usable, ...vietnameseDefaultCriteria(activity)]).slice(0, 2);
}

function sanitizeVietnameseDifferentiation(items: string[], activity: LessonPlan["activities"][number], kind: "support" | "extension") {
  const cleaned = uniqueItems(items.map(sanitizeVietnameseString).filter(Boolean));
  const hasTemplate = cleaned.some((item) => vietnameseTemplatePhrasePattern.test(item));
  if (!cleaned.length && kind === "support") return [];
  if (!cleaned.length && kind === "extension") return [];
  if (hasTemplate && kind === "support") {
    return ["HS cần hỗ trợ: GV gợi ý từ/câu trong ngữ liệu và cho trả lời bằng khung câu ngắn."];
  }
  if (hasTemplate && kind === "extension") {
    return ["HS hoàn thành tốt: nêu thêm một ý hoặc đặt thêm một câu phù hợp nhiệm vụ."];
  }
  return cleaned.slice(0, 1);
}

function isGenericVietnameseMaterial(material: string) {
  return /^(sgk|sách giáo khoa|vở|bút|bảng con|phiếu học tập|ảnh sgk|tranh trong sgk|máy chiếu)$/i.test(material.trim());
}

function vietnameseMaterialMatchesActivity(material: string, taskText: string) {
  if (isGenericVietnameseMaterial(material)) return true;
  const materialText = comparableVietnameseText(material);
  const activityText = comparableVietnameseText(taskText);
  if (!materialText) return false;
  if (/nghe|chinh ta|doan viet|bang phu nghe/i.test(materialText)) return /nghe|viet|chinh ta|soat/i.test(activityText);
  if (/ch\/tr|c\/k|ac\/at|am|van|the tu|the chu/i.test(materialText)) return /ch\/tr|c\/k|ac\/at|am|van|chu|tu|chinh ta/i.test(activityText);
  if (/mua|mien bac|mien nam|noi mua/i.test(materialText)) return /mua|mien bac|mien nam|noi|xep|ghep/i.test(activityText);
  if (/tranh bai doc|bai doc|van ban/i.test(materialText)) return /doc|van ban|doan|cau hoi|tu kho/i.test(activityText);
  if (/do vat|hinh do vat|goi ten/i.test(materialText)) return /do vat|hinh|goi ten|ten/i.test(activityText);
  return true;
}

function filterVietnameseActivityMaterials(activity: LessonPlan["activities"][number]) {
  const materials = uniqueItems(safeStringArray(activity.inputOrMaterials).map(sanitizeVietnameseString).filter(Boolean));
  if (!materials.length) return [];
  const taskText = vietnameseActivityTaskText(activity);
  const filtered = materials.filter((material) => vietnameseMaterialMatchesActivity(material, taskText));
  return (filtered.length ? filtered : materials.filter(isGenericVietnameseMaterial)).slice(0, 6);
}

function filterTopLevelVietnameseMaterials(materials: string[], activities: LessonPlan["activities"]) {
  const activityText = comparableVietnameseText(activities.map((activity) => [
    vietnameseActivityTaskText(activity),
    ...(activity.inputOrMaterials || []),
  ].join(" ")).join(" "));
  const filtered = uniqueItems(materials.map(sanitizeVietnameseString).filter(Boolean)).filter((material) => {
    if (isGenericVietnameseMaterial(material)) return true;
    const words = vietnameseContentWords(material);
    if (!words.length) return false;
    const hits = words.filter((word) => activityText.includes(word)).length;
    return hits >= Math.min(2, words.length);
  });
  return filtered.slice(0, 8);
}

function compactVietnameseList(label: string, items: string[], maxItems = 8) {
  const cleaned = uniqueItems(items.map(sanitizeVietnameseString).filter(Boolean)).slice(0, maxItems);
  return cleaned.length ? `${label}: ${cleaned.join("; ")}` : "";
}

function vietnameseQuestionAnswerLines(sourceInventory: NonNullable<VietnameseLessonBlueprint["sourceInventory"]>, activity: LessonPlan["activities"][number]) {
  const questions = Array.isArray(sourceInventory.readingQuestions) ? sourceInventory.readingQuestions : [];
  if (!questions.length) return [];
  const activityText = vietnameseActivityFullText(activity);
  const matched = questions.filter((item) => vietnameseTextOverlap(activityText, `${item.question} ${item.expectedAnswer}`) >= 0.18);
  const selected = (matched.length ? matched : questions).slice(0, 3);
  return selected.map((item) => {
    const evidence = asStringList(item.evidence).length ? ` Chi tiết: ${asStringList(item.evidence).join("; ")}` : "";
    return [`Câu hỏi: ${item.question}`, item.expectedAnswer ? `Đáp án: ${item.expectedAnswer}` : "", evidence].filter(Boolean).join(" ");
  });
}

function vietnameseSourceHintsForActivity(
  sourceInventory: VietnameseLessonBlueprint["sourceInventory"] | undefined,
  activity: LessonPlan["activities"][number],
) {
  if (!sourceInventory) return { inputOrMaterials: [] as string[], expectedAnswer: "", acceptableResponses: [] as string[] };
  const kind = vietnameseProductKind(activity);
  const inputOrMaterials: string[] = [];
  const answerLines: string[] = [];
  const acceptableResponses: string[] = [];

  if (kind === "reading-fluency") {
    const longSentences = (sourceInventory.longSentences || [])
      .map((item) => item.pauseMarked || item.sentence)
      .filter(Boolean);
    const readingText = compactVietnameseList("Ngữ liệu đọc", sourceInventory.readingText || [], 3);
    const vocabulary = compactVietnameseList("Từ khó/từ cần giải nghĩa", sourceInventory.readingVocabulary || [], 8);
    const sentences = compactVietnameseList("Câu dài luyện đọc", longSentences, 4);
    inputOrMaterials.push(readingText, vocabulary, sentences);
  }

  if (kind === "reading-comprehension") {
    const lines = vietnameseQuestionAnswerLines(sourceInventory, activity);
    inputOrMaterials.push(...lines.map((line) => `Ngữ liệu đọc hiểu: ${line}`));
    answerLines.push(...lines);
  }

  if (kind === "spelling") {
    if (sourceInventory.spellingText) inputOrMaterials.push(`Đoạn nghe-viết: ${sourceInventory.spellingText}`);
    answerLines.push("Bài chính tả: viết đúng đoạn đã nêu, đúng chữ, đúng dấu câu và trình bày sạch.");
  }

  if (kind === "phonics" || kind === "proper-noun") {
    for (const task of sourceInventory.phonicsTasks || []) {
      if (task.prompt || task.items?.length) {
        inputOrMaterials.push([task.prompt ? `Yêu cầu: ${task.prompt}` : "", compactVietnameseList("Từ/cụm từ", task.items || [], 12)].filter(Boolean).join(" "));
      }
      if (task.answers?.length) answerLines.push(compactVietnameseList("Đáp án", task.answers, 12));
    }
  }

  if (kind === "punctuation" || kind === "question-writing") {
    const sentences = (sourceInventory.punctuationSentences || []).slice(0, 8);
    inputOrMaterials.push(...sentences.map((item, index) => `Câu ${index + 1}: ${item.sentence}`));
    answerLines.push(...sentences.map((item, index) => `Câu ${index + 1}: ${item.answer || item.sentence}`));
  }

  if (kind === "composition" || kind === "speaking" || kind === "storytelling") {
    const writingPrompt = sourceInventory.writingPrompt;
    if (writingPrompt?.sentenceCount) inputOrMaterials.push(`Yêu cầu viết/nói: ${writingPrompt.sentenceCount}`);
    inputOrMaterials.push(compactVietnameseList("Gợi ý", writingPrompt?.prompts || [], 6));
    const objects = compactVietnameseList("Tên sự vật/đồ vật dự kiến", writingPrompt?.objectNames || [], 10);
    inputOrMaterials.push(objects);
    if (objects) answerLines.push(objects);
  }

  const expectedAnswer = uniqueItems(answerLines.map(sanitizeVietnameseString).filter(Boolean)).slice(0, 4).join(" ");
  return {
    inputOrMaterials: uniqueItems(inputOrMaterials.map(sanitizeVietnameseString).filter(Boolean)).slice(0, 8),
    expectedAnswer,
    acceptableResponses: uniqueItems(acceptableResponses.map(sanitizeVietnameseString).filter(Boolean)).slice(0, 4),
  };
}

function labelVietnameseExtensionAction(action: string) {
  const cleaned = sanitizeVietnameseString(action);
  if (!/hoi nguoi than|ve nha|suu tam|phong van|mo rong|neu con thoi gian|khi con thoi gian|ngoai sgk/i.test(comparableVietnameseText(cleaned))) return cleaned;
  if (/hoat dong mo rong|thuc hien khi con thoi gian/i.test(comparableVietnameseText(cleaned))) return cleaned;
  if (/^GV\b/.test(cleaned)) return cleaned.replace(/^GV\s+/i, "GV nêu hoạt động mở rộng của giáo viên: ");
  return `Thực hiện khi còn thời gian: ${cleaned}`;
}

function vietnameseGradeNumber(input?: LessonInput) {
  const match = String(input?.grade || "").match(/\d+/);
  return match ? Number(match[0]) : undefined;
}

function ensureVietnameseStoryListeningRounds<T extends LessonPlan["activities"][number]>(
  activity: T,
  input: LessonInput | undefined,
  lessonType: VietnameseLessonType,
): T {
  const grade = vietnameseGradeNumber(input);
  if (grade && grade > 3) return activity;
  const kind = vietnameseProductKind(activity);
  if (lessonType !== "speaking-listening" && kind !== "storytelling") return activity;
  const text = comparableVietnameseText(vietnameseActivityFullText(activity));
  if (!/ke chuyen|tranh truyen|noi va nghe/.test(text)) return activity;
  const hasFirstRound = /lan 1|luot 1|lan thu nhat|luot thu nhat/.test(text);
  const hasSecondRound = /lan 2|luot 2|lan thu hai|luot thu hai/.test(text);
  if (hasFirstRound && hasSecondRound) return activity;

  const teacherActions = safeStringArray(activity.teacherActions);
  const studentActions = safeStringArray(activity.studentActions);
  const insertAt = Math.min(1, teacherActions.length);
  const nextTeacherActions = [
    ...teacherActions.slice(0, insertAt),
    "GV cho HS nghe hoặc kể mẫu lần 1 để nắm nội dung chính của câu chuyện.",
    "GV cho HS nghe hoặc kể mẫu lần 2, nhắc HS chú ý trình tự sự việc, giọng kể và chi tiết chính.",
    ...teacherActions.slice(insertAt),
  ];
  const nextStudentActions = [
    ...studentActions.slice(0, insertAt),
    "HS nghe lần 1, nêu nhân vật hoặc sự việc chính.",
    "HS nghe lần 2, sắp xếp lại trình tự và chuẩn bị kể bằng lời của mình.",
    ...studentActions.slice(insertAt),
  ];
  return { ...activity, teacherActions: nextTeacherActions, studentActions: nextStudentActions } as T;
}

function normalizeVietnameseActivity(
  activity: LessonPlan["activities"][number],
  index: number,
  lessonType: VietnameseLessonType = "mixed",
  input?: LessonInput,
  sourceInventory?: VietnameseLessonBlueprint["sourceInventory"],
) {
  const sourceHints = vietnameseSourceHintsForActivity(sourceInventory, activity);
  const rawExpectedAnswer = safeStringArray(activity.expectedAnswer)[0] || "";
  const normalized = sanitizeVietnameseLessonText(normalizeActivity({
    ...activity,
    inputOrMaterials: uniqueItems([...sourceHints.inputOrMaterials, ...safeStringArray(activity.inputOrMaterials)]),
    expectedAnswer: !rawExpectedAnswer || vietnameseRawUncertaintyPattern.test(rawExpectedAnswer)
      ? sourceHints.expectedAnswer || rawExpectedAnswer
      : rawExpectedAnswer,
    acceptableResponses: uniqueItems([...sourceHints.acceptableResponses, ...safeStringArray(activity.acceptableResponses)]),
  }, index));
  const phase = activityPhaseKey(normalized);
  const isFocal = phase === "Khám phá" || phase === "Luyện tập";
  const products = uniqueItems(safeStringArray(normalized.learningProducts).map(sanitizeVietnameseString).filter(Boolean));
  const result = ensureVietnameseStoryListeningRounds({
    ...normalized,
    durationMinutes: normalized.durationMinutes || activityMinutes(normalized, index),
    teacherActions: safeStringArray(normalized.teacherActions).map(labelVietnameseExtensionAction),
    studentActions: safeStringArray(normalized.studentActions).map(sanitizeVietnameseString),
    inputOrMaterials: filterVietnameseActivityMaterials(normalized),
    learningProducts: (products.length ? products : [fallbackActivityProduct(normalized, index)]).slice(0, 1),
    successCriteria: sanitizeVietnameseCriteria(safeStringArray(normalized.successCriteria), normalized),
    acceptableResponses: safeStringArray(normalized.acceptableResponses).map(sanitizeVietnameseString).slice(0, 4),
    commonErrors: safeStringArray(normalized.commonErrors).map(sanitizeVietnameseString).slice(0, 3),
    teacherFeedback: safeStringArray(normalized.teacherFeedback).map(sanitizeVietnameseString).slice(0, 3),
    errorFeedback: normalizeActivityErrorFeedback(normalized.errorFeedback).slice(0, 3),
    supportForStudentsNeedingHelp: isFocal ? sanitizeVietnameseDifferentiation(safeStringArray(normalized.supportForStudentsNeedingHelp), normalized, "support") : [],
    extensionForEarlyFinishers: isFocal ? sanitizeVietnameseDifferentiation(safeStringArray(normalized.extensionForEarlyFinishers), normalized, "extension") : [],
  }, input, lessonType);
  return result;
}

function hasVietnameseMinimumTime(activities: LessonPlan["activities"], lessonType: VietnameseLessonType) {
  const matchingMinutes = (pattern: RegExp) =>
    activities
      .filter((activity) => pattern.test(vietnameseActivityFullText(activity)))
      .reduce((max, activity) => Math.max(max, Number(activity.timeBreakdown?.workingMinutes || activity.durationMinutes || 0)), 0);
  if (lessonType === "reading" && activities.some((activity) => /đọc mẫu|luyện đọc|đọc thành tiếng|đọc nối tiếp|ngắt nghỉ|giọng đọc|tốc độ đọc/i.test(vietnameseActivityFullText(activity)))) {
    return matchingMinutes(/đọc mẫu|luyện đọc|đọc thành tiếng|đọc nối tiếp|ngắt nghỉ|giọng đọc|tốc độ đọc/i) >= 10;
  }
  if (lessonType === "spelling") return matchingMinutes(/nghe[- ]?viết|nhớ[- ]?viết|chính tả/i) >= 10;
  if (lessonType === "composition") return matchingMinutes(/3\s*[-–—]\s*5\s*câu|viết.{0,30}\d+\s*câu|viết đoạn/i) >= 13;
  if (lessonType === "language-knowledge" && activities.some((activity) => /6\s*câu|sáu\s*câu|dấu chấm|dấu chấm hỏi/i.test(vietnameseActivityTaskText(activity)))) {
    return matchingMinutes(/6\s*câu|sáu\s*câu|dấu chấm|dấu chấm hỏi/i) >= 8;
  }
  return true;
}

function rebalanceVietnamesePeriodActivities(
  input: LessonInput,
  lessonType: VietnameseLessonType,
  activities: LessonPlan["activities"],
) {
  if (Number(input.duration || 35) !== 35) return activities;
  const total = activities.reduce((sum, activity) => sum + Number(activity.durationMinutes || 0), 0);
  const shouldUseTypeTargets = total < 32 || total > 33 || !hasVietnameseMinimumTime(activities, lessonType);
  if (!shouldUseTypeTargets) return activities;
  return activities.map((activity) => ({
    ...activity,
    durationMinutes: vietnamesePhaseDuration(activityPhaseKey(activity) || activity.phase, input, lessonType),
  }));
}

function normalizeLesson(input: LessonInput, lesson: LessonPlan, model: string): LessonPlan {
  lesson = sanitizeLessonText(lesson);
  if (isVietnameseSubject(input)) lesson = sanitizeVietnameseLessonText(lesson);
  const title = lesson.generalInfo?.lessonTitle || input.lessonTitle || "bài học";
  const vietnameseSubject = isVietnameseSubject(input);
  const naturalSocialSubject = isNaturalSocialSubject(input);
  const lessonWideVietnameseType = vietnameseSubject ? classifyVietnameseLesson(input, JSON.stringify(lesson)).primaryType : "mixed";
  const naturalSocialClassification = naturalSocialSubject
    ? classifyNaturalSocialLesson(input, naturalSocialSourceInventoryText(lesson.meta?.naturalSocialSourceInventory))
    : undefined;
  const lessonWideNaturalSocialType = naturalSocialClassification?.primaryType || "mixed";
  const periodPlans = Array.isArray(lesson.periodPlans)
    ? lesson.periodPlans
        .filter((period) => period && Array.isArray(period.activities))
        .map((period, index) => {
          const periodNumber = Number(period.periodNumber || index + 1);
          const periodType = vietnameseSubject
            ? classifyVietnameseLesson({ ...input, lessonTitle: period.focus || input.lessonTitle }, JSON.stringify(period)).primaryType || lessonWideVietnameseType
            : "mixed";
          const naturalSocialPeriodType = naturalSocialSubject
            ? classifyNaturalSocialLesson(
                { ...input, lessonTitle: period.focus || input.lessonTitle },
                naturalSocialSourceInventoryText(lesson.meta?.naturalSocialSourceInventory),
              ).primaryType || lessonWideNaturalSocialType
            : "mixed";
          const normalizedActivities = vietnameseSubject
            ? rebalanceVietnamesePeriodActivities(
                input,
                periodType,
                period.activities.map((activity, activityIndex) => normalizeVietnameseActivity(activity, activityIndex, periodType, input)),
              )
            : naturalSocialSubject
              ? rebalanceNaturalSocialPeriodActivities(
                  input,
                  period.activities.map((activity, activityIndex) => normalizeNaturalSocialActivity(
                    activity,
                    activityIndex,
                    input,
                    naturalSocialPeriodType,
                    naturalSocialClassification?.topicFocus,
                  )),
                )
            : period.activities.map(normalizeActivity);
          return {
            periodNumber,
            focus: period.focus || `Tiết ${index + 1}`,
            outcomes: period.outcomes
              ? vietnameseSubject
                ? normalizeVietnameseOutcomes(period.outcomes, `${title} - tiết ${periodNumber}`)
                : naturalSocialSubject
                  ? normalizeNaturalSocialOutcomes(period.outcomes, `${title} - tiết ${periodNumber}`)
                  : normalizeOutcomes(period.outcomes, `${title} - tiết ${periodNumber}`)
              : undefined,
            activities: normalizedActivities,
            handoff: period.handoff
              ? {
                  learned: safeStringArray(period.handoff.learned)[0] || undefined,
                  unresolvedRisks: safeStringArray(period.handoff.unresolvedRisks),
                  nextBridge: safeStringArray(period.handoff.nextBridge)[0] || undefined,
                }
              : undefined,
          };
        })
    : undefined;
  const activities = periodPlans?.length
    ? periodPlans.flatMap((period) => period.activities)
    : Array.isArray(lesson.activities)
      ? vietnameseSubject
        ? rebalanceVietnamesePeriodActivities(
            input,
            lessonWideVietnameseType,
            lesson.activities.map((activity, index) => normalizeVietnameseActivity(activity, index, lessonWideVietnameseType, input)),
          )
        : naturalSocialSubject
          ? rebalanceNaturalSocialPeriodActivities(
              input,
              lesson.activities.map((activity, index) => normalizeNaturalSocialActivity(
                activity,
                index,
                input,
                lessonWideNaturalSocialType,
                naturalSocialClassification?.topicFocus,
              )),
            )
        : lesson.activities.map(normalizeActivity)
      : [];

  const rawTeacherMat = safeStringArray(lesson.materials?.teacher);
  const rawStudentMat = safeStringArray(lesson.materials?.students);
  const teacherMat = vietnameseSubject ? filterTopLevelVietnameseMaterials(rawTeacherMat, activities) : rawTeacherMat;
  const studentMat = vietnameseSubject ? filterTopLevelVietnameseMaterials(rawStudentMat, activities) : rawStudentMat;

  const normalizedLesson: LessonPlan = {
    ...lesson,
    generalInfo: {
      subject: lesson.generalInfo?.subject || input.subject,
      grade: lesson.generalInfo?.grade || input.grade,
      lessonTitle: lesson.generalInfo?.lessonTitle || input.lessonTitle || "Bài học",
      book: lesson.generalInfo?.book || bookContext(input),
      periods: Math.max(1, Number(input.periods || lesson.generalInfo?.periods || 1)),
      duration: Number(lesson.generalInfo?.duration || input.duration || 35),
    },
    outcomes: vietnameseSubject
      ? normalizeVietnameseOutcomes(lesson.outcomes, title)
      : naturalSocialSubject
        ? normalizeNaturalSocialOutcomes(lesson.outcomes, title)
        : normalizeOutcomes(lesson.outcomes, title),
    materials: {
      teacher: teacherMat.length ? teacherMat : vietnameseSubject ? ["SGK"] : naturalSocialSubject ? ["Ảnh SGK/tranh minh họa", "Vật thật hoặc mô hình an toàn", "Phiếu/bảng quan sát"] : ["Ảnh SGK/tranh minh họa bài học", "Bảng phụ hoặc phiếu học tập"],
      students: studentMat.length ? studentMat : vietnameseSubject ? ["SGK", "Vở", "Bảng con"] : naturalSocialSubject ? ["SGK", "Vở hoặc phiếu học tập", "Bút màu/thẻ học tập"] : ["SGK", "Vở ghi hoặc phiếu học tập"],
    },
    activities,
    periodPlans,
    assessment: {
      criteria: safeStringArray(lesson.assessment?.criteria),
      evidence: safeStringArray(lesson.assessment?.evidence),
      comments: safeStringArray(lesson.assessment?.comments),
    },
    adjustments: {
      suitablePoints: safeStringArray(lesson.adjustments?.suitablePoints).length ? safeStringArray(lesson.adjustments.suitablePoints) : ["........................................................................................................................................"],
      pointsToAdjust: safeStringArray(lesson.adjustments?.pointsToAdjust).length ? safeStringArray(lesson.adjustments.pointsToAdjust) : ["........................................................................................................................................"],
      nextLessonDirection: safeStringArray(lesson.adjustments?.nextLessonDirection).length ? safeStringArray(lesson.adjustments.nextLessonDirection) : ["........................................................................................................................................"],
    },
    contextFit: {
      notes: safeStringArray(lesson.contextFit?.notes),
    },
    meta: {
      style: lesson.meta?.style || input.style,
      modelUsed: model,
      createdAt: new Date().toISOString(),
      ...(vietnameseSubject && lesson.meta?.vietnameseSourceInventory ? { vietnameseSourceInventory: lesson.meta.vietnameseSourceInventory } : {}),
      ...(naturalSocialSubject && lesson.meta?.naturalSocialSourceInventory ? { naturalSocialSourceInventory: lesson.meta.naturalSocialSourceInventory } : {}),
      ...(lesson.meta?.continuityPlan ? { continuityPlan: lesson.meta.continuityPlan } : {}),
    },
  };

  return isMathSubject(input) ? normalizeMathContentDeep(normalizedLesson) : normalizedLesson;
}

function lessonQualityFindings(lesson: LessonPlan, input: LessonInput) {
  return [
    ...validateLessonQuality(lesson),
    ...validateLessonTime(lesson),
    ...validateLessonContinuity(lesson, input),
    ...(/^(toán|toan)$/i.test(input.subject.trim()) ? validateMathLesson(lesson, input) : []),
    ...(isVietnameseSubjectName(input.subject) ? validateVietnameseLesson(lesson, input) : []),
    ...(isVietnameseSubjectName(input.subject) ? validateVietnameseTaskCoverage(lesson, input, lesson.meta?.vietnameseSourceInventory) : []),
    ...(isNaturalSocialSubject(input) ? validateNaturalSocialLesson(lesson, input) : []),
    ...(isNaturalSocialSubject(input) ? validateNaturalSocialTaskCoverage(lesson, input, lesson.meta?.naturalSocialSourceInventory) : []),
  ];
}

function mathRepairBlueprint(input: LessonInput, lesson: LessonPlan): MathLessonBlueprint {
  return normalizeMathBlueprint(input, {
    lessonTitle: lesson.generalInfo.lessonTitle,
    outcomes: lesson.outcomes,
    materials: lesson.materials,
    assessment: lesson.assessment,
    contextFit: lesson.contextFit,
    continuityPlan: lesson.meta?.continuityPlan,
    periods: (lesson.periodPlans || []).map((period) => ({
      periodNumber: period.periodNumber,
      focus: period.focus,
      objectives: period.outcomes?.knowledgeAndSkills || [],
      activities: period.activities.map((activity) => ({
        phase: activity.phase,
        title: activity.title,
        objective: activity.objective,
        durationMinutes: activity.durationMinutes,
        sourceUnitIds: activity.sourceUnitIds,
        sourceClusterIds: activity.sourceClusterIds,
      })),
    })),
  });
}

function vietnameseRepairBlueprint(input: LessonInput, lesson: LessonPlan): VietnameseLessonBlueprint {
  const classification = classifyVietnameseLesson(input, JSON.stringify(lesson));
  return normalizeVietnameseBlueprint(input, {
    lessonTitle: lesson.generalInfo.lessonTitle,
    classification,
    sourceInventory: lesson.meta?.vietnameseSourceInventory,
    outcomes: lesson.outcomes,
    materials: lesson.materials,
    assessment: lesson.assessment,
    contextFit: lesson.contextFit,
    continuityPlan: lesson.meta?.continuityPlan,
    periods: (lesson.periodPlans || []).map((period) => ({
      periodNumber: period.periodNumber,
      focus: period.focus,
      lessonType: classification.primaryType,
      objectives: period.outcomes?.knowledgeAndSkills || [],
      activities: period.activities.map((activity) => ({
        phase: activity.phase,
        title: activity.title,
        objective: activity.objective,
        durationMinutes: activity.durationMinutes,
        sourceTaskIds: activity.sourceTaskIds,
        sourceUnitIds: activity.sourceUnitIds,
        sourceClusterIds: activity.sourceClusterIds,
      })),
    })),
  }, classification);
}

async function repairMathLessonByFindings(
  lesson: LessonPlan,
  input: LessonInput,
  strategy: PlanModelStrategy,
  findings: ReturnType<typeof lessonQualityFindings>,
) {
  const periods = lesson.periodPlans?.length
    ? lesson.periodPlans
    : [{ periodNumber: 1, focus: lesson.generalInfo.lessonTitle, outcomes: lesson.outcomes, activities: lesson.activities }];
  let repairSucceeded = false;
  const repairedPeriods: PeriodPlan[] = [];

  for (const period of periods) {
    const scopedFindings = findingsForPeriod(findings, period.periodNumber);
    if (!scopedFindings.length) {
      repairedPeriods.push(period);
      continue;
    }
    try {
      const chunk: MathPeriodChunk = {
        periodNumber: period.periodNumber,
        focus: period.focus,
        outcomes: period.outcomes || lesson.outcomes,
        activities: period.activities,
        handoff: period.handoff,
      };
      const repairBlueprint = mathRepairBlueprint(input, lesson);
      const result = await fetchAiJsonContent(strategy.repair, [
        { role: "system", content: buildSubjectSystemRole(input) },
        { role: "user", content: buildMathPeriodRepairPrompt(input, repairBlueprint, chunk, scopedFindings.map(formatRepairFinding)) },
      ]);
      const periodBlueprint = mathPeriodBlueprintFor(repairBlueprint, period.periodNumber)
        || { periodNumber: period.periodNumber, focus: period.focus };
      const normalized = normalizeMathPeriodChunk(
        input,
        repairBlueprint,
        periodBlueprint,
        extractJson<MathPeriodChunk>(result.content),
      );
      repairedPeriods.push({
        periodNumber: normalized.periodNumber,
        focus: normalized.focus,
        outcomes: normalized.outcomes,
        activities: normalized.activities,
        handoff: normalized.handoff,
      });
      repairSucceeded = true;
    } catch (error) {
      console.warn(`[EduPlan AI] Math quality repair failed for period ${period.periodNumber}`, { message: error instanceof Error ? error.message : "Unknown repair error" });
      repairedPeriods.push(period);
    }
  }

  if (!repairSucceeded) return null;
  return normalizeLesson(input, { ...lesson, activities: repairedPeriods.flatMap((period) => period.activities), periodPlans: repairedPeriods }, strategy.repair.model);
}

async function repairVietnameseLessonByFindings(
  lesson: LessonPlan,
  input: LessonInput,
  strategy: PlanModelStrategy,
  findings: ReturnType<typeof lessonQualityFindings>,
) {
  const periods = lesson.periodPlans?.length
    ? lesson.periodPlans
    : [{ periodNumber: 1, focus: lesson.generalInfo.lessonTitle, outcomes: lesson.outcomes, activities: lesson.activities }];
  let repairSucceeded = false;
  const repairedPeriods: PeriodPlan[] = [];

  for (const period of periods) {
    const scopedFindings = findingsForPeriod(findings, period.periodNumber);
    if (!scopedFindings.length) {
      repairedPeriods.push(period);
      continue;
    }
    try {
      const chunk: VietnamesePeriodChunk = {
        periodNumber: period.periodNumber,
        focus: period.focus,
        outcomes: period.outcomes || lesson.outcomes,
        activities: period.activities,
        handoff: period.handoff,
      };
      const repairBlueprint = vietnameseRepairBlueprint(input, lesson);
      const result = await fetchAiJsonContent(strategy.repair, [
        { role: "system", content: buildSubjectSystemRole(input) },
        { role: "user", content: buildVietnamesePeriodRepairPrompt(input, repairBlueprint, chunk, scopedFindings.map(formatRepairFinding)) },
      ]);
      const periodBlueprint = vietnamesePeriodBlueprintFor(repairBlueprint, period.periodNumber)
        || { periodNumber: period.periodNumber, focus: period.focus, lessonType: repairBlueprint.classification?.primaryType || "mixed" };
      const normalized = normalizeVietnamesePeriodChunk(
        input,
        repairBlueprint,
        periodBlueprint,
        extractJson<VietnamesePeriodChunk>(result.content),
      );
      repairedPeriods.push({
        periodNumber: normalized.periodNumber,
        focus: normalized.focus,
        outcomes: normalized.outcomes,
        activities: normalized.activities,
        handoff: normalized.handoff,
      });
      repairSucceeded = true;
    } catch (error) {
      console.warn(`[EduPlan AI] Vietnamese quality repair failed for period ${period.periodNumber}`, { message: error instanceof Error ? error.message : "Unknown repair error" });
      repairedPeriods.push(period);
    }
  }

  if (!repairSucceeded) return null;
  return normalizeLesson(input, { ...lesson, activities: repairedPeriods.flatMap((period) => period.activities), periodPlans: repairedPeriods }, strategy.repair.model);
}

async function repairNaturalSocialLessonByFindings(
  lesson: LessonPlan,
  input: LessonInput,
  strategy: PlanModelStrategy,
  findings: ReturnType<typeof lessonQualityFindings>,
) {
  const periods = lesson.periodPlans?.length
    ? lesson.periodPlans
    : [{ periodNumber: 1, focus: lesson.generalInfo.lessonTitle, outcomes: lesson.outcomes, activities: lesson.activities }];
  let repairSucceeded = false;
  const repairedPeriods: PeriodPlan[] = [];

  for (const period of periods) {
    const scopedFindings = findingsForPeriod(findings, period.periodNumber);
    if (!scopedFindings.length) {
      repairedPeriods.push(period);
      continue;
    }
    try {
      const chunk: NaturalSocialPeriodChunk = {
        periodNumber: period.periodNumber,
        focus: period.focus,
        outcomes: period.outcomes || lesson.outcomes,
        activities: period.activities,
        handoff: period.handoff,
      };
      const repairBlueprint = naturalSocialRepairBlueprint(input, lesson);
      const result = await fetchAiJsonContent(strategy.repair, [
        { role: "system", content: buildSubjectSystemRole(input) },
        { role: "user", content: buildNaturalSocialPeriodRepairPrompt(input, repairBlueprint, chunk, scopedFindings.map(formatRepairFinding)) },
      ]);
      const periodBlueprint = naturalSocialPeriodBlueprintFor(repairBlueprint, period.periodNumber)
        || { periodNumber: period.periodNumber, focus: period.focus, lessonType: repairBlueprint.classification?.primaryType || "mixed" };
      const normalized = normalizeNaturalSocialPeriodChunk(
        input,
        repairBlueprint,
        periodBlueprint,
        extractJson<NaturalSocialPeriodChunk>(result.content),
      );
      repairedPeriods.push({
        periodNumber: normalized.periodNumber,
        focus: normalized.focus,
        outcomes: normalized.outcomes,
        activities: normalized.activities,
        handoff: normalized.handoff,
      });
      repairSucceeded = true;
    } catch (error) {
      console.warn(`[EduPlan AI] Natural-social quality repair failed for period ${period.periodNumber}`, { message: error instanceof Error ? error.message : "Unknown repair error" });
      repairedPeriods.push(period);
    }
  }

  if (!repairSucceeded) return null;
  return normalizeLesson(input, { ...lesson, activities: repairedPeriods.flatMap((period) => period.activities), periodPlans: repairedPeriods }, strategy.repair.model);
}

async function repairDefaultLessonByFindings(
  lesson: LessonPlan,
  input: LessonInput,
  ocrText: string,
  strategy: PlanModelStrategy,
  findings: ReturnType<typeof lessonQualityFindings>,
) {
  try {
    const repaired = await fetchAiJsonContent(strategy.repair, [
      { role: "system", content: buildSubjectSystemRole(input) },
      { role: "user", content: buildSubjectRepairPrompt(lesson, input, ocrText, findings.map(formatRepairFinding).join("\n")) },
    ]);
    const repairedLesson = extractJson<LessonPlan>(repaired.content);
    const candidate = normalizeLesson(input, {
      ...repairedLesson,
      meta: {
        ...repairedLesson.meta,
        continuityPlan: lesson.meta?.continuityPlan,
        vietnameseSourceInventory: lesson.meta?.vietnameseSourceInventory,
        naturalSocialSourceInventory: lesson.meta?.naturalSocialSourceInventory,
      },
    }, repaired.model);
    if (hasStructuralIssues(candidate, input) || isMissingPeriods(candidate, input.periods)) return null;
    return candidate;
  } catch (error) {
    console.warn("[EduPlan AI] Default quality repair failed", { message: error instanceof Error ? error.message : "Unknown repair error" });
    return null;
  }
}

function buildPostRepairPedagogyAudit(lesson: LessonPlan, input: LessonInput, repairApplied: boolean): PedagogyAudit {
  return isVietnameseSubject(input)
    ? buildVietnameseChunkedAudit(
        lesson,
        input,
        vietnameseRepairBlueprint(input, lesson),
        repairApplied,
      )
    : isNaturalSocialSubject(input)
      ? buildNaturalSocialChunkedAudit(
          lesson,
          input,
          naturalSocialRepairBlueprint(input, lesson),
          repairApplied,
        )
      : buildPedagogyAudit(lesson, input, repairApplied);
}

async function applyLessonQualityRepair(
  lesson: LessonPlan,
  input: LessonInput,
  ocrText: string,
  strategy: PlanModelStrategy,
  repairAlreadyApplied: boolean,
) {
  let initialLesson = lesson;
  let mechanicalRepairApplied = false;
  if (isVietnameseSubject(input)) {
    const mechanicallyRepaired = normalizeLesson(
      input,
      applyVietnameseMechanicalRepair(initialLesson, input),
      initialLesson.meta?.modelUsed || strategy.detail.model,
    );
    mechanicalRepairApplied = JSON.stringify(mechanicallyRepaired) !== JSON.stringify(initialLesson);
    initialLesson = mechanicallyRepaired;
    if (mechanicalRepairApplied) {
      console.info("[EduPlan AI] Vietnamese mechanical repair applied before AI repair", {
        requestId: currentGenerationContext()?.requestId,
        remainingIssueCount: lessonQualityFindings(initialLesson, input).length,
      });
    }
  }

  if (!canStartAiRepair("global-quality-repair", MIN_QUALITY_REPAIR_BUDGET_MS, {
    issueCount: lessonQualityFindings(initialLesson, input).length,
    subject: input.subject,
    plan: strategy.plan,
  })) {
    const repairApplied = repairAlreadyApplied || mechanicalRepairApplied;
    return {
      lesson: initialLesson,
      pedagogyAudit: buildPostRepairPedagogyAudit(initialLesson, input, repairApplied),
    };
  }

  const result = await runQualityRepairLoop({
    initialValue: initialLesson,
    validate: (currentLesson) => lessonQualityFindings(currentLesson, input),
    repairableFindings: isVietnameseSubject(input) ? vietnameseAiRepairFindings : undefined,
    repair: async (currentLesson, findings) => {
      if (!canStartAiRepair("global-quality-repair-round", MIN_QUALITY_REPAIR_BUDGET_MS, {
        issueCount: findings.length,
        subject: input.subject,
        plan: strategy.plan,
      })) return null;
      if (findings.some((finding) => finding.periodNumber === undefined)) {
        return repairDefaultLessonByFindings(currentLesson, input, ocrText, strategy, findings);
      }
      if (isMathSubject(input)) return repairMathLessonByFindings(currentLesson, input, strategy, findings);
      if (isNaturalSocialSubject(input)) return repairNaturalSocialLessonByFindings(currentLesson, input, strategy, findings);
      if (isVietnameseSubject(input)) return repairVietnameseLessonByFindings(currentLesson, input, strategy, findings);
      return repairDefaultLessonByFindings(currentLesson, input, ocrText, strategy, findings);
    },
    maxRounds: MAX_LESSON_REPAIR_ROUNDS - (repairAlreadyApplied ? 1 : 0),
  });
  const repairApplied = repairAlreadyApplied || mechanicalRepairApplied || result.repairApplied;
  const pedagogyAudit = buildPostRepairPedagogyAudit(result.value, input, repairApplied);
  return { lesson: result.value, pedagogyAudit };
}

async function generateLessonWithStrategy(input: LessonInput, ocrText: string, strategy: PlanModelStrategy, options: GenerateLessonOptions = {}) {
  if (isMathSubject(input)) {
    console.info("[EduPlan AI] Math subject detected; using chunked generation", { model: strategy.detail.model, periods: input.periods });
    return generateMathLessonChunkedWithModel(input, ocrText, strategy);
  }

  if (isVietnameseSubject(input)) {
    console.info("[EduPlan AI] Vietnamese subject detected; using classifier-driven chunked generation", { model: strategy.detail.model, periods: input.periods });
    return generateVietnameseLessonChunkedWithModel(input, ocrText, strategy, options.vietnameseSourceInventory);
  }

  if (isNaturalSocialSubject(input)) {
    console.info("[EduPlan AI] Natural-social subject detected; using inquiry-driven chunked generation", { model: strategy.detail.model, periods: input.periods });
    return generateNaturalSocialLessonChunkedWithModel(input, ocrText, strategy, options.naturalSocialSourceInventory);
  }

  const generated = await fetchAiJsonContent(strategy.detail, [
    { role: "system", content: buildSubjectSystemRole(input) },
    { role: "user", content: buildSubjectPrompt(input, ocrText) },
  ]);
  let lesson = normalizeLesson(input, extractJson(generated.content), generated.model);
  const originalLesson = lesson;
  let repairApplied = false;
  if (hasStructuralIssues(lesson, input) || hasQualityIssues(lesson, input) || isMissingPeriods(lesson, input.periods)) {
    try {
      const repaired = await fetchAiJsonContent(strategy.repair, [
        { role: "system", content: "Bạn chỉ trả JSON hợp lệ theo schema LessonPlan. Nhiệm vụ là sửa giáo án sơ sài thành giáo án chi tiết, sinh động, bám CTGDPT 2018." },
        { role: "user", content: buildSubjectRepairPrompt(lesson, input, ocrText, subjectPedagogyRepairGuidance(lesson, input)) },
      ]);
      const repairedLesson = normalizeLesson(input, extractJson(repaired.content), repaired.model);
      if (hasStructuralIssues(repairedLesson, input) || isMissingPeriods(repairedLesson, input.periods)) lesson = originalLesson;
      else { lesson = repairedLesson; repairApplied = true; }
    } catch (repairError) {
      console.warn("[EduPlan AI] AI repair skipped", { message: repairError instanceof Error ? repairError.message : "Unknown repair error" });
      if (hasStructuralIssues(lesson, input) || isMissingPeriods(lesson, input.periods)) throw new Error("Giáo án AI trả về chưa đủ cấu trúc yêu cầu. Vui lòng bấm tạo lại hoặc giảm số ảnh/số tiết để AI xử lý ổn định hơn.");
    }
  }
  if (hasStructuralIssues(lesson, input) || isMissingPeriods(lesson, input.periods)) throw new Error("Giáo án AI trả về chưa đủ cấu trúc yêu cầu sau khi tự sửa. Vui lòng bấm tạo lại hoặc giảm số ảnh/số tiết.");
  const pedagogyAudit = buildPedagogyAudit(lesson, input, repairApplied);
  return { lesson, pedagogyAudit };
}

async function generateLesson(input: LessonInput, ocrText: string, strategy: PlanModelStrategy, options: GenerateLessonOptions = {}) {
  const generated = await generateLessonWithStrategy(input, ocrText, strategy, options);
  if (strategy.plan === "free") {
    console.info("[EduPlan AI] FREE global quality repair skipped", {
      requestId: currentGenerationContext()?.requestId,
      issueCount: lessonQualityFindings(generated.lesson, input).length,
    });
    return generated;
  }
  return applyLessonQualityRepair(
    generated.lesson,
    input,
    ocrText,
    strategy,
    Boolean(generated.pedagogyAudit.repairApplied),
  );
}

function stripUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => stripUndefinedDeep(item)) as T;
  if (value instanceof Date) return value;
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).flatMap(([key, item]) => (
        item === undefined ? [] : [[key, stripUndefinedDeep(item)]]
      )),
    ) as T;
  }
  return value;
}

async function saveGeneratedLesson(uid: string, lesson: LessonPlan) {
  const ref = getFirebaseDb().collection("lessons").doc();
  const now = new Date();
  await ref.set(stripUndefinedDeep({
    ownerId: uid,
    title: lesson.generalInfo?.lessonTitle || "Giáo án chưa đặt tên",
    subject: lesson.generalInfo?.subject || "",
    grade: lesson.generalInfo?.grade || "",
    periods: Number(lesson.generalInfo?.periods || 1),
    lesson,
    createdAt: now,
    updatedAt: now,
    expiresAt: lessonExpiresAt(),
  }));
  return ref.id;
}

function buildOperationTelemetry(options: {
  outcome: "success" | "failed";
  startedAt: number;
  stage: GenerateResponse["stage"];
  strategy: PlanModelStrategy | null;
  context: GenerationContext | null;
  periods?: number;
  ocrTextLength?: number;
  ocrCacheHitCount?: number;
  ocrCacheMissCount?: number;
}) {
  const calls = options.context?.calls || [];
  const successfulModels = (scope: GenerationCallMetric["scope"]) => Array.from(new Set(
    calls.filter((call) => call.scope === scope && call.outcome === "success").map((call) => call.model),
  ));
  return {
    version: 1,
    outcome: options.outcome,
    stage: options.stage || "unknown",
    totalElapsedMs: Date.now() - options.startedAt,
    periods: Math.max(1, Number(options.periods || 1)),
    routing: {
      generationPrimaryModel: options.strategy?.detail.model || "",
      generationFallbackModel: options.strategy?.detail.fallbackModel || "",
      generationModelsUsed: successfulModels("detail"),
      generationFallbackUsed: calls.some((call) => call.scope !== "ocr" && call.fallbackUsed && call.outcome === "success"),
      ocrPrimaryModel: OPENAI_OCR_MODEL,
      ocrFallbackModel: OPENAI_OCR_FALLBACK_MODEL,
      ocrModelsUsed: successfulModels("ocr"),
      ocrFallbackUsed: calls.some((call) => call.scope === "ocr" && call.fallbackUsed && call.outcome === "success"),
    },
    ocr: {
      textLength: Math.max(0, Number(options.ocrTextLength || 0)),
      cacheHitCount: Math.max(0, Number(options.ocrCacheHitCount || 0)),
      cacheMissCount: Math.max(0, Number(options.ocrCacheMissCount || 0)),
    },
    summary: summarizeGenerationCalls(calls),
    calls,
  };
}

export async function POST(request: Request) {
  const requestStartedAt = Date.now();
  const requestState: { stage: NonNullable<GenerateResponse["stage"]> } = { stage: "unknown" };
  let reservation: UsageReservation | null = null;
  let strategy: PlanModelStrategy | null = null;
  const telemetryHolder: { current: GenerationContext | null } = { current: null };
  let requestedPeriods = 1;
  let ocrStats = { textLength: 0, cacheHitCount: 0, cacheMissCount: 0 };
  try {
    const user = await requireUser();
    if (!user.emailVerified) {
      return NextResponse.json<GenerateResponse>({ error: "Bạn cần xác minh email trước khi tạo giáo án.", stage: requestState.stage }, { status: 403 });
    }

    const input = (await request.json()) as LessonInput;
    requestedPeriods = Math.max(1, Number(input.periods || 1));
    const uploadedAssets = Array.isArray(input.uploadedAssets) ? input.uploadedAssets : [];
    if (uploadedAssets.length > 10) {
      return NextResponse.json<GenerateResponse>({ error: "Tối đa 10 ảnh SGK mỗi lần tạo.", stage: requestState.stage }, { status: 400 });
    }
    const imagePayloadError = validateLessonImagePayload(uploadedAssets);
    if (imagePayloadError) {
      return NextResponse.json<GenerateResponse>({ error: imagePayloadError, stage: requestState.stage }, { status: 413 });
    }
    const requestId = request.headers.get("idempotency-key") || crypto.randomUUID();
    reservation = await reserveUsage(user.uid, "generate", requestId, {
      userEmail: user.email,
      subject: input.subject,
    });
    const selectedStrategy = getPlanModelStrategy(reservation.plan);
    strategy = selectedStrategy;
    const { lesson, pedagogyAudit, ocrTextLength } = await withGenerationDeadline(requestId, async () => {
      requestState.stage = "ocr";
      let cachedVietnameseInventory: Awaited<ReturnType<typeof readVietnameseSourceInventory>> = null;
      let cachedNaturalSocialInventory: Awaited<ReturnType<typeof readNaturalSocialSourceInventory>> = null;
      if (isVietnameseSubject(input)) {
        try {
          cachedVietnameseInventory = await readVietnameseSourceInventory(input);
          if (cachedVietnameseInventory?.inventory) {
            console.info("[EduPlan AI] Vietnamese verified source inventory loaded", {
              requestId,
              lessonKey: cachedVietnameseInventory.lessonKey,
              verifiedStatus: cachedVietnameseInventory.verifiedStatus,
            });
          }
        } catch (cacheError) {
          console.warn("[EduPlan AI] Vietnamese source inventory read skipped", { requestId, message: cacheError instanceof Error ? cacheError.message : "Unknown cache error" });
        }
      }
      if (isNaturalSocialSubject(input)) {
        try {
          cachedNaturalSocialInventory = await readNaturalSocialSourceInventory(input);
          if (cachedNaturalSocialInventory?.inventory) {
            console.info("[EduPlan AI] Natural-social verified source inventory loaded", {
              requestId,
              lessonKey: cachedNaturalSocialInventory.lessonKey,
              verifiedStatus: cachedNaturalSocialInventory.verifiedStatus,
            });
          }
        } catch (cacheError) {
          console.warn("[EduPlan AI] Natural-social source inventory read skipped", { requestId, message: cacheError instanceof Error ? cacheError.message : "Unknown cache error" });
        }
      }
      const ocrResult = await runOpenAiOcr(input);
      ocrStats = {
        textLength: ocrResult.text.length,
        cacheHitCount: ocrResult.cacheHitCount,
        cacheMissCount: ocrResult.cacheMissCount,
      };
      requestState.stage = "openai";
      const generated = await generateLesson(input, ocrResult.text, selectedStrategy, {
        vietnameseSourceInventory: cachedVietnameseInventory?.inventory,
        naturalSocialSourceInventory: cachedNaturalSocialInventory?.inventory,
      });
      if (isVietnameseSubject(input)) {
        const mergedInventory = mergeVietnameseSourceInventories(
          cachedVietnameseInventory?.inventory,
          generated.lesson.meta?.vietnameseSourceInventory,
        );
        if (mergedInventory) {
          generated.lesson.meta = { ...generated.lesson.meta, vietnameseSourceInventory: mergedInventory };
          try {
            const inventoryKeyInput = {
              ...input,
              lessonTitle: generated.lesson.generalInfo?.lessonTitle || input.lessonTitle,
            };
            const savedInventory = await upsertVietnameseSourceInventory(inventoryKeyInput, mergedInventory, [
              ...(cachedVietnameseInventory?.sourceHashes || []),
              ...(ocrResult.sourceHashes || []),
            ]);
            if (savedInventory?.inventory) {
              generated.lesson.meta = { ...generated.lesson.meta, vietnameseSourceInventory: savedInventory.inventory };
              console.info("[EduPlan AI] Vietnamese source inventory upserted", {
                requestId,
                lessonKey: savedInventory.lessonKey,
                verifiedStatus: savedInventory.verifiedStatus,
              });
            }
          } catch (cacheError) {
            console.warn("[EduPlan AI] Vietnamese source inventory write skipped", { requestId, message: cacheError instanceof Error ? cacheError.message : "Unknown cache error" });
          }
        }
      }
      if (isNaturalSocialSubject(input)) {
        const mergedInventory = mergeNaturalSocialSourceInventories(
          cachedNaturalSocialInventory?.inventory,
          generated.lesson.meta?.naturalSocialSourceInventory,
        );
        if (mergedInventory) {
          generated.lesson.meta = { ...generated.lesson.meta, naturalSocialSourceInventory: mergedInventory };
          try {
            const inventoryKeyInput = {
              ...input,
              lessonTitle: generated.lesson.generalInfo?.lessonTitle || input.lessonTitle,
            };
            const savedInventory = await upsertNaturalSocialSourceInventory(inventoryKeyInput, mergedInventory, [
              ...(cachedNaturalSocialInventory?.sourceHashes || []),
              ...(ocrResult.sourceHashes || []),
            ]);
            if (savedInventory?.inventory) {
              generated.lesson.meta = { ...generated.lesson.meta, naturalSocialSourceInventory: savedInventory.inventory };
              console.info("[EduPlan AI] Natural-social source inventory upserted", {
                requestId,
                lessonKey: savedInventory.lessonKey,
                verifiedStatus: savedInventory.verifiedStatus,
              });
            }
          } catch (cacheError) {
            console.warn("[EduPlan AI] Natural-social source inventory write skipped", { requestId, message: cacheError instanceof Error ? cacheError.message : "Unknown cache error" });
          }
        }
      }
      return {
        ...generated,
        ocrTextLength: ocrResult.text.length,
      };
    }, (context) => { telemetryHolder.current = context; });
    const generationCalls: GenerationCallMetric[] = telemetryHolder.current?.calls.filter((call) => call.scope !== "ocr" && call.outcome === "success") || [];
    const detailModels = Array.from(new Set(generationCalls.filter((call) => call.scope === "detail").map((call) => call.model)));
    const fallbackUsed = generationCalls.some((call) => call.fallbackUsed);
    const modelUsed = detailModels.join(", ") || lesson.meta.modelUsed;
    lesson.meta = { ...lesson.meta, modelUsed, plan: reservation.plan };
    const lessonId = await saveGeneratedLesson(user.uid, lesson);
    await commitUsage(reservation, lessonId, buildOperationTelemetry({
      outcome: "success",
      startedAt: requestStartedAt,
      stage: requestState.stage,
      strategy,
      context: telemetryHolder.current,
      periods: requestedPeriods,
      ocrTextLength: ocrStats.textLength,
      ocrCacheHitCount: ocrStats.cacheHitCount,
      ocrCacheMissCount: ocrStats.cacheMissCount,
    }));
    return NextResponse.json<GenerateResponse>({
      lesson,
      lessonId,
      pedagogyAudit,
      ocrTextLength,
      modelRouting: { primaryModel: strategy.detail.model, modelUsed, fallbackUsed },
    });
  } catch (error) {
    if (reservation) await releaseUsage(reservation, `generate_failed_${requestState.stage}`, buildOperationTelemetry({
      outcome: "failed",
      startedAt: requestStartedAt,
      stage: requestState.stage,
      strategy,
      context: telemetryHolder.current,
      periods: requestedPeriods,
      ocrTextLength: ocrStats.textLength,
      ocrCacheHitCount: ocrStats.cacheHitCount,
      ocrCacheMissCount: ocrStats.cacheMissCount,
    })).catch(() => undefined);
    const policyError = subscriptionErrorResponse(error);
    if (policyError) return NextResponse.json<GenerateResponse>({ ...policyError.body, stage: requestState.stage }, { status: policyError.status });
    const rawMessage = error instanceof Error ? error.message : "Không thể tạo giáo án lúc này.";
    const status = error instanceof GenerationTimeoutError ? 504 : error instanceof Error && error.name === "UNAUTHENTICATED" ? 401 : 500;
    const errorStage: GenerateResponse["stage"] = requestState.stage;
    const message = errorStage === "ocr" ? `Lỗi OCR OpenAI: ${rawMessage}` : errorStage === "openai" ? `Lỗi AI: ${rawMessage}` : rawMessage;
    return NextResponse.json<GenerateResponse>({ error: message, stage: errorStage }, { status });
  }
}
