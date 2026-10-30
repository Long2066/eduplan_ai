import "server-only";
import { normalizeAiUsage } from "@/lib/generation-telemetry";
import {
  OPENAI_TRANSIENT_RETRIES,
  aiResponseCompletionError,
  normalizeOpenAiError,
  normalizeOpenAiFetchError,
  waitForAiRetry,
} from "@/lib/generation/ai-json-client";
import {
  GENERATION_SAVE_RESERVE_MS,
  GenerationTimeoutError,
  abortSignalForRequest,
  beginGenerationAiCall,
  currentGenerationContext,
  recordGenerationCall,
  remainingGenerationMs,
} from "@/lib/generation/runtime";
import { buildOpenAiOcrRequest } from "@/lib/openai-ocr-request";
import { extractOpenAiResponsesText } from "@/lib/openai-json-request";
import { hashUploadedAsset } from "@/lib/vietnamese-source-inventory";
import {
  readCachedOcrText,
  saveCachedOcrText,
} from "@/lib/vietnamese-source-inventory-store";
import type { LessonInput, UploadedAsset } from "@/types/lesson";
import {
  generationOcrAssetSequence,
  sortGenerationOcrAssets,
} from "@/lib/generation/ocr-asset-order";

export { sortGenerationOcrAssets } from "@/lib/generation/ocr-asset-order";

function positiveEnvNumber(value: string | undefined, fallback: number, minimum: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= minimum ? Math.floor(parsed) : fallback;
}

export const OPENAI_OCR_BATCH_SIZE = Number(process.env.OPENAI_OCR_BATCH_SIZE || 3);
export const OPENAI_OCR_MODEL = (process.env.OPENAI_OCR_MODEL || "gpt-5.6-luna").trim();
export const OPENAI_OCR_FALLBACK_MODEL = (process.env.OPENAI_OCR_FALLBACK_MODEL || "gpt-4o-mini").trim();
export const OPENAI_OCR_REASONING_EFFORT = ["none", "minimal", "low", "medium", "high"]
  .includes(String(process.env.OPENAI_OCR_REASONING_EFFORT))
  ? String(process.env.OPENAI_OCR_REASONING_EFFORT)
  : "none";
export const OPENAI_OCR_MAX_OUTPUT_TOKENS = positiveEnvNumber(
  process.env.OPENAI_OCR_MAX_OUTPUT_TOKENS,
  12_000,
  1_000,
);
export const OPENAI_OCR_REQUEST_TIMEOUT_MS = positiveEnvNumber(
  process.env.OPENAI_OCR_REQUEST_TIMEOUT_MS,
  60_000,
  10_000,
);

export type OpenAiOcrResult = {
  text: string;
  sourceHashes: string[];
  cacheHitCount: number;
  cacheMissCount: number;
};

export type OpenAiOcrAssetResult = {
  text: string;
  sourceHash: string;
  cacheHit: boolean;
  model: string;
};

function parseDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:(.+);base64,(.+)$/);
  if (!match) return null;
  return { mimeType: match[1], data: match[2] };
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

async function ocrImagesWithOpenAi(
  assets: UploadedAsset[],
  apiKey: string,
  batchLabel: string,
  options?: { freeEngine?: "gemini" | "gpt" | string },
) {
  const imageDataUrls = assets.flatMap((asset) => asset.dataUrl && parseDataUrl(asset.dataUrl) ? [asset.dataUrl] : []);
  if (!imageDataUrls.length) return { text: "", model: OPENAI_OCR_MODEL, fallbackUsed: false };

  const isGeminiFree = options?.freeEngine === "gemini";
  type OcrCandidate = {
    model: string;
    provider: "openai" | "ninerouter";
    apiKey: string;
    endpoint: string;
    reasoningEffort: string;
  };

  const candidates: OcrCandidate[] = [];
  if (isGeminiFree) {
    const ninerouterKey = (process.env.NINEROUTER_API_KEY || "sk-30291fde1e5baa54-rmony8-33298b25").trim();
    const ninerouterBaseUrl = (process.env.NINEROUTER_API_BASE_URL || "http://158.178.235.87:20128/v1").replace(/\/+$/, "");
    const geminiModel = (process.env.GEMINI_OCR_MODEL || process.env.FREE_GEMINI_MODEL || "ag/gemini-3.8-flash-high").trim();
    candidates.push({
      model: geminiModel,
      provider: "ninerouter",
      apiKey: ninerouterKey,
      endpoint: `${ninerouterBaseUrl}/chat/completions`,
      reasoningEffort: "none",
    });
    if (apiKey) {
      candidates.push({
        model: OPENAI_OCR_MODEL,
        provider: "openai",
        apiKey,
        endpoint: "https://api.openai.com/v1/chat/completions",
        reasoningEffort: OPENAI_OCR_REASONING_EFFORT,
      });
    }
  } else {
    candidates.push({
      model: OPENAI_OCR_MODEL,
      provider: "openai",
      apiKey,
      endpoint: "https://api.openai.com/v1/chat/completions",
      reasoningEffort: OPENAI_OCR_REASONING_EFFORT,
    });
    if (OPENAI_OCR_FALLBACK_MODEL && OPENAI_OCR_FALLBACK_MODEL !== OPENAI_OCR_MODEL) {
      candidates.push({
        model: OPENAI_OCR_FALLBACK_MODEL,
        provider: "openai",
        apiKey,
        endpoint: "https://api.openai.com/v1/chat/completions",
        reasoningEffort: "none",
      });
    }
  }

  const policy = currentGenerationContext()?.aiPolicy;
  const selectedCandidates = policy?.singleAttempt
    ? [policy.useFallback && candidates.length > 1 ? candidates[1] : candidates[0]]
    : candidates;
  let primaryMessage = "OCR không phản hồi.";
  let lastMessage = primaryMessage;

  for (const [candidateIndex, candidate] of selectedCandidates.entries()) {
    const fallbackUsed = policy?.singleAttempt ? Boolean(policy.useFallback && candidates.length > 1) : candidateIndex > 0;
    const { useResponsesApi, body } = buildOpenAiOcrRequest({
      model: candidate.model,
      imageDataUrls,
      reasoningEffort: candidate.reasoningEffort,
      maxOutputTokens: OPENAI_OCR_MAX_OUTPUT_TOKENS,
    });
    const maxRetries = policy?.singleAttempt || candidates.length > 1 ? 0 : OPENAI_TRANSIENT_RETRIES;

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      const remainingForOcr = remainingGenerationMs() - GENERATION_SAVE_RESERVE_MS;
      if (remainingForOcr < (fallbackUsed ? 10_000 : 5_000)) throw new GenerationTimeoutError();
      const requestTimeoutMs = Math.max(1_000, Math.min(policy?.requestTimeoutMs ?? OPENAI_OCR_REQUEST_TIMEOUT_MS, remainingForOcr));
      const controller = new AbortController();
      let requestTimedOut = false;
      const timeout = setTimeout(() => {
        requestTimedOut = true;
        controller.abort();
      }, requestTimeoutMs);
      const startedAt = Date.now();

      try {
        beginGenerationAiCall();
        const endpoint = candidate.provider === "openai" && useResponsesApi
          ? "https://api.openai.com/v1/responses"
          : candidate.endpoint;
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${candidate.apiKey}` },
          body: JSON.stringify(body),
          signal: abortSignalForRequest(controller),
        });

        if (response.ok) {
          const data = await response.json();
          const completionError = policy?.singleAttempt
            ? aiResponseCompletionError(data, useResponsesApi, OPENAI_OCR_MAX_OUTPUT_TOKENS)
            : null;
          if (completionError) {
            recordGenerationCall({
              scope: "ocr",
              provider: candidate.provider,
              model: candidate.model,
              fallbackUsed,
              outcome: "invalid_output",
              elapsedMs: Date.now() - startedAt,
              ...normalizeAiUsage(data),
            });
            lastMessage = completionError;
            break;
          }
          const text = useResponsesApi
            ? extractOpenAiResponsesText(data).trim()
            : (data.choices?.[0]?.message?.content || "").trim();
          if (text.length >= 20) {
            recordGenerationCall({
              scope: "ocr",
              provider: candidate.provider,
              model: candidate.model,
              fallbackUsed,
              outcome: "success",
              elapsedMs: Date.now() - startedAt,
              ...normalizeAiUsage(data),
            });
            console.info("[EduPlan AI] OCR model completed", {
              model: candidate.model,
              provider: candidate.provider,
              fallbackUsed,
              batchLabel,
              textLength: text.length,
            });
            return { text, model: candidate.model, fallbackUsed };
          }
          recordGenerationCall({
            scope: "ocr",
            provider: candidate.provider,
            model: candidate.model,
            fallbackUsed,
            outcome: "invalid_output",
            elapsedMs: Date.now() - startedAt,
            ...normalizeAiUsage(data),
          });
          lastMessage = `OCR chưa đọc đủ nội dung ở ${batchLabel}. Hãy thử ảnh rõ hơn hoặc crop sát vùng SGK.`;
          break;
        }

        recordGenerationCall({
          scope: "ocr",
          provider: candidate.provider,
          model: candidate.model,
          fallbackUsed,
          outcome: "http_error",
          elapsedMs: Date.now() - startedAt,
          httpStatus: response.status,
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
        });
        lastMessage = normalizeOpenAiError(await response.text(), response.status, Boolean(policy?.singleAttempt));
        if ((response.status === 429 || response.status >= 500) && attempt < maxRetries) {
          await waitForAiRetry(700 * (attempt + 1));
          continue;
        }
        break;
      } catch (error) {
        const generationTimedOut = Boolean(currentGenerationContext()?.controller.signal.aborted);
        recordGenerationCall({
          scope: "ocr",
          provider: candidate.provider,
          model: candidate.model,
          fallbackUsed,
          outcome: requestTimedOut || generationTimedOut ? "timeout" : "network_error",
          elapsedMs: Date.now() - startedAt,
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
        });
        if (generationTimedOut) throw new GenerationTimeoutError();
        lastMessage = normalizeOpenAiFetchError(error, candidate.model, requestTimeoutMs, Boolean(policy?.singleAttempt));
        if (attempt < maxRetries) {
          await waitForAiRetry(700 * (attempt + 1));
          continue;
        }
      } finally {
        clearTimeout(timeout);
      }
    }

    if (candidateIndex === 0) primaryMessage = lastMessage;
    if (candidateIndex < selectedCandidates.length - 1) {
      console.warn("[EduPlan AI] OCR model fallback", {
        failedModel: candidate.model,
        fallbackModel: selectedCandidates[candidateIndex + 1].model,
        batchLabel,
        message: lastMessage,
      });
    }
  }

  if (!policy?.singleAttempt && selectedCandidates.length > 1) {
    throw new Error(`OCR chính: ${primaryMessage}; OCR dự phòng: ${lastMessage}`);
  }
  throw new Error(lastMessage);
}

export async function runOpenAiOcrAsset(
  asset: UploadedAsset,
  index: number,
  totalAssets: number,
  options?: { freeEngine?: "gemini" | "gpt" | string },
): Promise<OpenAiOcrAssetResult> {
  const isGemini = options?.freeEngine === "gemini";
  const defaultModel = isGemini
    ? (process.env.GEMINI_OCR_MODEL || process.env.FREE_GEMINI_MODEL || "ag/gemini-3.8-flash-high").trim()
    : OPENAI_OCR_MODEL;
  const sourceHash = hashUploadedAsset(asset);
  if (process.env.LESSON_SOURCE_CACHE_ENABLED !== "false" && sourceHash) {
    try {
      const cachedText = await readCachedOcrText(sourceHash);
      if (cachedText) {
        return { text: cachedText, sourceHash, cacheHit: true, model: defaultModel };
      }
    } catch (cacheError) {
      console.warn("[EduPlan AI] OCR cache read skipped", {
        assetName: asset.name,
        message: cacheError instanceof Error ? cacheError.message : "Unknown cache error",
      });
    }
  }

  const apiKey = process.env.OPENAI_API_KEY || "";
  if (!apiKey && !isGemini) throw new Error("Thiếu OPENAI_API_KEY trong file .env.");
  const result = await ocrImagesWithOpenAi(
    [asset],
    apiKey,
    `ảnh ${index + 1}/${totalAssets}: ${imageLabel(asset, index)}`,
    options,
  );
  try {
    await saveCachedOcrText(asset, result.text, result.model);
  } catch (cacheError) {
    console.warn("[EduPlan AI] OCR cache write skipped", {
      assetName: asset.name,
      message: cacheError instanceof Error ? cacheError.message : "Unknown cache error",
    });
  }
  return { text: result.text, sourceHash, cacheHit: false, model: result.model };
}

export async function runOpenAiOcr(
  input: LessonInput,
  options?: { freeEngine?: "gemini" | "gpt" | string },
): Promise<OpenAiOcrResult> {
  const effectiveOptions = { freeEngine: options?.freeEngine || input.freeEngine };
  const assets = sortGenerationOcrAssets(
    input.uploadedAssets.filter((asset) => asset.dataUrl && parseDataUrl(asset.dataUrl)),
  );
  if (!assets.length) return { text: "", sourceHashes: [], cacheHitCount: 0, cacheMissCount: 0 };

  const sourceHashes = assets.map(hashUploadedAsset).filter(Boolean);
  const cacheEnabled = process.env.LESSON_SOURCE_CACHE_ENABLED !== "false";
  if (cacheEnabled) {
    const cachedOrGeneratedParts = new Array<string>(assets.length).fill("");
    let cacheHitCount = 0;
    for (const [index, asset] of assets.entries()) {
      const result = await runOpenAiOcrAsset(asset, index, assets.length, effectiveOptions);
      cachedOrGeneratedParts[index] = result.text;
      if (result.cacheHit) cacheHitCount += 1;
    }
    const cachedText = cachedOrGeneratedParts.filter(Boolean).join("\n\n--- HẾT ẢNH ---\n\n").trim();
    if (cachedText.length < 40) {
      throw new Error("OCR không đọc được đủ nội dung từ ảnh. Hãy thử ảnh rõ hơn, ít nhiễu hơn hoặc crop sát vùng SGK.");
    }
    console.info("[EduPlan AI] OCR completed with cache layer", {
      model: OPENAI_OCR_MODEL,
      textLength: cachedText.length,
      cacheHitCount,
      cacheMissCount: assets.length - cacheHitCount,
    });
    return {
      text: cachedText,
      sourceHashes,
      cacheHitCount,
      cacheMissCount: assets.length - cacheHitCount,
    };
  }

  const apiKey = process.env.OPENAI_API_KEY || "";
  if (!apiKey && effectiveOptions.freeEngine !== "gemini") throw new Error("Thiếu OPENAI_API_KEY trong file .env.");
  const batches = chunkAssets(assets, OPENAI_OCR_BATCH_SIZE);
  const ocrParts: string[] = [];
  console.info("[EduPlan AI] OCR started", {
    model: effectiveOptions.freeEngine === "gemini" ? "ag/gemini-3.8-flash-high" : OPENAI_OCR_MODEL,
    imageCount: assets.length,
    batchCount: batches.length,
    order: assets.map((asset, index) => ({
      index: index + 1,
      name: asset.name,
      order: asset.order,
      sequence: generationOcrAssetSequence(asset.name),
    })),
  });

  for (const [batchIndex, batch] of batches.entries()) {
    const batchLabel = `batch ${batchIndex + 1}/${batches.length}`;
    try {
      console.info("[EduPlan AI] OCR batch started", {
        model: effectiveOptions.freeEngine === "gemini" ? "ag/gemini-3.8-flash-high" : OPENAI_OCR_MODEL,
        imageCount: batch.length,
        batchLabel,
      });
      ocrParts.push((await ocrImagesWithOpenAi(batch, apiKey, batchLabel, effectiveOptions)).text);
    } catch (error) {
      if (batch.length > 1) {
        console.warn("[EduPlan AI] OCR batch failed; retrying as single images", {
          batchLabel,
          imageCount: batch.length,
        });
        for (const [imageIndex, asset] of batch.entries()) {
          const singleLabel = `${batchLabel} / ${imageLabel(asset, imageIndex)}`;
          try {
            ocrParts.push((await ocrImagesWithOpenAi([asset], apiKey, singleLabel, effectiveOptions)).text);
          } catch (singleError) {
            const message = singleError instanceof Error
              ? singleError.message
              : "OCR thất bại với một ảnh.";
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
    throw new Error("OCR không đọc được đủ nội dung từ ảnh. Hãy thử ảnh rõ hơn, ít nhiễu hơn hoặc crop sát vùng SGK.");
  }
  console.info("[EduPlan AI] OCR completed", {
    model: effectiveOptions.freeEngine === "gemini" ? "ag/gemini-3.8-flash-high" : OPENAI_OCR_MODEL,
    textLength: text.length,
    batchCount: batches.length,
  });
  return { text, sourceHashes, cacheHitCount: 0, cacheMissCount: assets.length };
}
