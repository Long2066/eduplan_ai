import "server-only";
import { normalizeAiUsage } from "@/lib/generation-telemetry";
import {
  OPENAI_TRANSIENT_RETRIES,
  normalizeOpenAiError,
  normalizeOpenAiFetchError,
  waitForAiRetry,
} from "@/lib/generation/ai-json-client";
import {
  GENERATION_SAVE_RESERVE_MS,
  GenerationTimeoutError,
  abortSignalForRequest,
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

async function ocrImagesWithOpenAi(assets: UploadedAsset[], apiKey: string, batchLabel: string) {
  const imageDataUrls = assets.flatMap((asset) => asset.dataUrl && parseDataUrl(asset.dataUrl) ? [asset.dataUrl] : []);
  if (!imageDataUrls.length) return { text: "", model: OPENAI_OCR_MODEL, fallbackUsed: false };

  const models = [OPENAI_OCR_MODEL];
  if (OPENAI_OCR_FALLBACK_MODEL && OPENAI_OCR_FALLBACK_MODEL !== OPENAI_OCR_MODEL) {
    models.push(OPENAI_OCR_FALLBACK_MODEL);
  }
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
      let requestTimedOut = false;
      const timeout = setTimeout(() => {
        requestTimedOut = true;
        controller.abort();
      }, requestTimeoutMs);
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
            ? extractOpenAiResponsesText(data).trim()
            : (data.choices?.[0]?.message?.content || "").trim();
          if (text.length >= 20) {
            recordGenerationCall({
              scope: "ocr",
              provider: "openai",
              model,
              fallbackUsed,
              outcome: "success",
              elapsedMs: Date.now() - startedAt,
              ...normalizeAiUsage(data),
            });
            console.info("[EduPlan AI] OCR model completed", {
              model,
              fallbackUsed,
              batchLabel,
              textLength: text.length,
            });
            return { text, model, fallbackUsed };
          }
          recordGenerationCall({
            scope: "ocr",
            provider: "openai",
            model,
            fallbackUsed,
            outcome: "invalid_output",
            elapsedMs: Date.now() - startedAt,
            ...normalizeAiUsage(data),
          });
          lastMessage = `OpenAI OCR chưa đọc đủ nội dung ở ${batchLabel}. Hãy thử ảnh rõ hơn hoặc crop sát vùng SGK.`;
          break;
        }

        recordGenerationCall({
          scope: "ocr",
          provider: "openai",
          model,
          fallbackUsed,
          outcome: "http_error",
          elapsedMs: Date.now() - startedAt,
          httpStatus: response.status,
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
        });
        lastMessage = normalizeOpenAiError(await response.text(), response.status);
        if ((response.status === 429 || response.status >= 500) && attempt < maxRetries) {
          await waitForAiRetry(700 * (attempt + 1));
          continue;
        }
        break;
      } catch (error) {
        const generationTimedOut = Boolean(currentGenerationContext()?.controller.signal.aborted);
        recordGenerationCall({
          scope: "ocr",
          provider: "openai",
          model,
          fallbackUsed,
          outcome: requestTimedOut || generationTimedOut ? "timeout" : "network_error",
          elapsedMs: Date.now() - startedAt,
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
        });
        if (generationTimedOut) throw new GenerationTimeoutError();
        lastMessage = normalizeOpenAiFetchError(error, model, requestTimeoutMs);
        if (attempt < maxRetries) {
          await waitForAiRetry(700 * (attempt + 1));
          continue;
        }
      } finally {
        clearTimeout(timeout);
      }
    }

    if (modelIndex === 0) primaryMessage = lastMessage;
    if (modelIndex < models.length - 1) {
      console.warn("[EduPlan AI] OCR model fallback", {
        failedModel: model,
        fallbackModel: models[modelIndex + 1],
        batchLabel,
        message: lastMessage,
      });
    }
  }

  throw new Error(models.length > 1 ? `OCR chính: ${primaryMessage}; OCR dự phòng: ${lastMessage}` : lastMessage);
}

export async function runOpenAiOcrAsset(
  asset: UploadedAsset,
  index: number,
  totalAssets: number,
): Promise<OpenAiOcrAssetResult> {
  const sourceHash = hashUploadedAsset(asset);
  if (process.env.LESSON_SOURCE_CACHE_ENABLED !== "false" && sourceHash) {
    try {
      const cachedText = await readCachedOcrText(sourceHash);
      if (cachedText) {
        return { text: cachedText, sourceHash, cacheHit: true, model: OPENAI_OCR_MODEL };
      }
    } catch (cacheError) {
      console.warn("[EduPlan AI] OCR cache read skipped", {
        assetName: asset.name,
        message: cacheError instanceof Error ? cacheError.message : "Unknown cache error",
      });
    }
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Thiếu OPENAI_API_KEY trong file .env.");
  const result = await ocrImagesWithOpenAi(
    [asset],
    apiKey,
    `ảnh ${index + 1}/${totalAssets}: ${imageLabel(asset, index)}`,
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

export async function runOpenAiOcr(input: LessonInput): Promise<OpenAiOcrResult> {
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
      const result = await runOpenAiOcrAsset(asset, index, assets.length);
      cachedOrGeneratedParts[index] = result.text;
      if (result.cacheHit) cacheHitCount += 1;
    }
    const cachedText = cachedOrGeneratedParts.filter(Boolean).join("\n\n--- HẾT ẢNH ---\n\n").trim();
    if (cachedText.length < 40) {
      throw new Error("OpenAI OCR không đọc được đủ nội dung từ ảnh. Hãy thử ảnh rõ hơn, ít nhiễu hơn hoặc crop sát vùng SGK.");
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

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Thiếu OPENAI_API_KEY trong file .env.");
  const batches = chunkAssets(assets, OPENAI_OCR_BATCH_SIZE);
  const ocrParts: string[] = [];
  console.info("[EduPlan AI] OCR OpenAI started", {
    model: OPENAI_OCR_MODEL,
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
      console.info("[EduPlan AI] OCR OpenAI batch started", {
        model: OPENAI_OCR_MODEL,
        imageCount: batch.length,
        batchLabel,
      });
      ocrParts.push((await ocrImagesWithOpenAi(batch, apiKey, batchLabel)).text);
    } catch (error) {
      if (batch.length > 1) {
        console.warn("[EduPlan AI] OCR OpenAI batch failed; retrying as single images", {
          batchLabel,
          imageCount: batch.length,
        });
        for (const [imageIndex, asset] of batch.entries()) {
          const singleLabel = `${batchLabel} / ${imageLabel(asset, imageIndex)}`;
          try {
            ocrParts.push((await ocrImagesWithOpenAi([asset], apiKey, singleLabel)).text);
          } catch (singleError) {
            const message = singleError instanceof Error
              ? singleError.message
              : "OpenAI OCR thất bại với một ảnh.";
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
  console.info("[EduPlan AI] OCR OpenAI completed", {
    model: OPENAI_OCR_MODEL,
    textLength: text.length,
    batchCount: batches.length,
  });
  return { text, sourceHashes, cacheHitCount: 0, cacheMissCount: assets.length };
}
