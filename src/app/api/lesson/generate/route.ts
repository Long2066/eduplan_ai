import fs from "fs";
import path from "path";

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
import { getPlanModelStrategy, type AiStageStrategy, type PlanModelStrategy } from "@/lib/model-strategy";
import { commitUsage, releaseUsage, reserveUsage, subscriptionErrorResponse, type UsageReservation } from "@/lib/subscription-policy";
import { activityMinutes, pairedActivityActions, phaseKey, requiredActivityPhases, safeStringArray } from "@/lib/lesson-format";
import { getPedagogyProfile, gradeBandFor } from "@/lib/pedagogy-profiles";
import type {
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
const OPENAI_OCR_BATCH_SIZE = Number(process.env.OPENAI_OCR_BATCH_SIZE || 3);
const OPENAI_OCR_MODEL = process.env.OPENAI_OCR_MODEL || "gpt-4o-mini";
const OPENAI_DEFAULT_MODEL = "gpt-4o-mini";
const OPENAI_FALLBACK_MODEL = process.env.OPENAI_FALLBACK_MODEL || "gpt-4o";
const OPENAI_REQUEST_TIMEOUT_MS = Number(process.env.OPENAI_REQUEST_TIMEOUT_MS || 120000);

function parseDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:(.+);base64,(.+)$/);
  if (!match) return null;
  return { mimeType: match[1], data: match[2] };
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

function normalizeOpenAiFetchError(error: unknown, model: string) {
  const message = error instanceof Error ? error.message : String(error || "fetch failed");
  if (/abort|timeout|timed out/i.test(message)) {
    return `OpenAI xử lý quá lâu và đã hết thời gian chờ (${Math.round(OPENAI_REQUEST_TIMEOUT_MS / 1000)} giây) với model ${model}. Nguyên nhân thường là model reasoning cao + giáo án dài. Hãy thử lại, giảm số tiết/ảnh, hoặc dùng fallback model nhanh hơn.`;
  }
  if (/fetch failed|network|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|socket|terminated/i.test(message)) {
    return `Không kết nối ổn định tới OpenAI khi gọi model ${model}. Có thể do mạng/proxy/firewall, OpenAI rớt kết nối, hoặc request quá lâu. Hãy thử lại sau ít phút hoặc đổi sang model nhanh hơn.`;
  }
  return message;
}

type OpenAiMessage = { role: "system" | "user" | "assistant"; content: string };
type OpenAiJsonRequest = {
  model: string;
  temperature: number;
  messages: OpenAiMessage[];
};

function extractResponsesText(data: unknown) {
  const response = data as {
    output_text?: string;
    output?: Array<{ content?: Array<{ text?: string; type?: string }> }>;
  };
  if (response.output_text) return response.output_text;
  return response.output?.flatMap((item) => item.content || []).map((part) => part.text || "").join("\n").trim() || "";
}

async function fetchAiJsonContent(strategy: AiStageStrategy, messages: OpenAiMessage[]) {
  const attempts: AiStageStrategy[] = [strategy];
  if (strategy.fallbackModel && strategy.fallbackProvider) {
    attempts.push({ ...strategy, provider: strategy.fallbackProvider, model: strategy.fallbackModel });
  }
  let lastMessage = "AI không phản hồi.";
  for (const selected of attempts) {
    const apiKey = selected.provider === "openrouter" ? process.env.OPENROUTER_API_KEY : process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error(selected.provider === "openrouter" ? "Thiếu OPENROUTER_API_KEY trong file .env." : "Thiếu OPENAI_API_KEY trong file .env.");
    for (let attempt = 0; attempt <= OPENAI_TRANSIENT_RETRIES; attempt += 1) {
      const useResponsesApi = selected.provider === "openai" && /^gpt-5/i.test(selected.model);
      const requestBody = useResponsesApi
        ? { model: selected.model, input: messages, reasoning: { effort: process.env.OPENAI_REASONING_EFFORT || "high" }, text: { format: { type: "json_object" } } }
        : { model: selected.model, response_format: { type: "json_object" }, temperature: selected.temperature, messages };
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), OPENAI_REQUEST_TIMEOUT_MS);
      try {
        const headers: Record<string, string> = { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` };
        if (selected.provider === "openrouter") {
          if (process.env.OPENROUTER_APP_URL) headers["HTTP-Referer"] = process.env.OPENROUTER_APP_URL;
          headers["X-Title"] = process.env.OPENROUTER_APP_NAME || "EduPlan AI";
        }
        const endpoint = selected.provider === "openrouter" ? "https://openrouter.ai/api/v1/chat/completions" : useResponsesApi ? "https://api.openai.com/v1/responses" : "https://api.openai.com/v1/chat/completions";
        const response = await fetch(endpoint, { method: "POST", headers, body: JSON.stringify(requestBody), signal: controller.signal });
        if (response.ok) {
          const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
          const content = useResponsesApi ? extractResponsesText(data) : data.choices?.[0]?.message?.content || "";
          if (!content) throw new Error("AI không trả về nội dung giáo án.");
          return { content, model: selected.model, provider: selected.provider };
        }
        const text = await response.text();
        lastMessage = normalizeOpenAiError(text, response.status);
        if ((response.status === 429 || response.status >= 500) && attempt < OPENAI_TRANSIENT_RETRIES) { await wait(900 * (attempt + 1)); continue; }
        break;
      } catch (error) {
        lastMessage = normalizeOpenAiFetchError(error, selected.model);
        if (attempt < OPENAI_TRANSIENT_RETRIES) { await wait(900 * (attempt + 1)); continue; }
      } finally {
        clearTimeout(timeout);
      }
    }
    console.warn("[EduPlan AI] AI stage fallback", { stage: strategy.stage, failedModel: selected.model, message: lastMessage });
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

function openAiImageContent(asset: UploadedAsset, useResponsesApi: boolean) {
  if (!asset.dataUrl || !parseDataUrl(asset.dataUrl)) return null;
  if (useResponsesApi) {
    return {
      type: "input_image",
      image_url: asset.dataUrl,
      detail: "high",
    };
  } else {
    return {
      type: "image_url",
      image_url: {
        url: asset.dataUrl,
        detail: "high",
      },
    };
  }
}

async function ocrImagesWithOpenAi(assets: UploadedAsset[], apiKey: string, batchLabel: string) {
  const useResponsesApi = /^gpt-5/i.test(OPENAI_OCR_MODEL);
  const imageParts = assets.map((asset) => openAiImageContent(asset, useResponsesApi)).filter(Boolean);
  if (!imageParts.length) return "";

  let lastMessage = "OpenAI OCR không phản hồi.";
  for (let attempt = 0; attempt <= OPENAI_TRANSIENT_RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), OPENAI_REQUEST_TIMEOUT_MS);
    let response: Response;

    const requestBody = useResponsesApi
      ? {
          model: OPENAI_OCR_MODEL,
          input: [
            {
              role: "user",
              content: [
                {
                  type: "input_text",
                  text:
                    "Hãy OCR chuẩn các ảnh SGK tiếng Việt theo đúng thứ tự ảnh. Chỉ trích xuất văn bản nhìn thấy trong ảnh, giữ xuống dòng hợp lý, nhận diện tên bài/số bài/yêu cầu cần đạt/nội dung/câu hỏi nếu có. Ngăn cách mỗi ảnh bằng dòng --- HẾT ẢNH ---. Không giải thích và không thêm nội dung ngoài ảnh.",
                },
                ...imageParts,
              ],
            },
          ],
        }
      : {
          model: OPENAI_OCR_MODEL,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text:
                    "Hãy OCR chuẩn các ảnh SGK tiếng Việt theo đúng thứ tự ảnh. Chỉ trích xuất văn bản nhìn thấy trong ảnh, giữ xuống dòng hợp lý, nhận diện tên bài/số bài/yêu cầu cần đạt/nội dung/câu hỏi nếu có. Ngăn cách mỗi ảnh bằng dòng --- HẾT ẢNH ---. Không giải thích và không thêm nội dung ngoài ảnh.",
                },
                ...imageParts,
              ],
            },
          ],
        };

    try {
      response = await fetch(
        useResponsesApi ? "https://api.openai.com/v1/responses" : "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        },
      );
    } catch (error) {
      lastMessage = normalizeOpenAiFetchError(error, OPENAI_OCR_MODEL);
      if (attempt < OPENAI_TRANSIENT_RETRIES) {
        await wait(700 * (attempt + 1));
        continue;
      }
      throw new Error(lastMessage);
    } finally {
      clearTimeout(timeout);
    }

    if (response.ok) {
      const data = await response.json();
      const text = useResponsesApi
        ? extractResponsesText(data).trim()
        : (data.choices?.[0]?.message?.content || "").trim();
      if (text.length >= 20) return text;
      lastMessage = `OpenAI OCR chưa đọc đủ nội dung ở ${batchLabel}. Hãy thử ảnh rõ hơn hoặc crop sát vùng SGK.`;
      throw new Error(lastMessage);
    }

    const text = await response.text();
    lastMessage = normalizeOpenAiError(text, response.status);
    if ((response.status === 429 || response.status >= 500) && attempt < OPENAI_TRANSIENT_RETRIES) {
      await wait(700 * (attempt + 1));
      continue;
    }
    throw new Error(lastMessage);
  }

  throw new Error(lastMessage);
}

async function runOpenAiOcr(input: LessonInput) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Thiếu OPENAI_API_KEY trong file .env.");

  const assets = sortAssetsByFileSequence(input.uploadedAssets.filter((asset) => asset.dataUrl && parseDataUrl(asset.dataUrl)));
  if (!assets.length) return { text: "" };

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
      ocrParts.push(await ocrImagesWithOpenAi(batch, apiKey, batchLabel));
    } catch (error) {
      if (batch.length > 1) {
        console.warn("[EduPlan AI] OCR OpenAI batch failed; retrying as single images", { batchLabel, imageCount: batch.length });
        for (const [imageIndex, asset] of batch.entries()) {
          const singleLabel = `${batchLabel} / ${imageLabel(asset, imageIndex)}`;
          try {
            ocrParts.push(await ocrImagesWithOpenAi([asset], apiKey, singleLabel));
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
  return { text };
}


function isMathSubject(input: LessonInput) {
  return /^(toán|toan)$/i.test((input.subject || "").trim());
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
  return activities.find((activity) => phaseKey(`${activity.phase} ${activity.title}`) === phase) || activities[index] || {};
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
    periods,
  };
}


function mathPeriodBlueprintFor(blueprint: MathLessonBlueprint, periodNumber: number) {
  return blueprint.periods?.find((period) => Number(period.periodNumber) === periodNumber) || blueprint.periods?.[periodNumber - 1];
}



function activityFromMathBlueprint(activity: MathActivityBlueprint, index: number): LessonPlan["activities"][number] {
  const phase = phaseKey(`${activity.phase} ${activity.title}`) || requiredActivityPhases[index] || `Hoạt động ${index + 1}`;
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
    const source = rawActivities.find((activity) => phaseKey(`${activity.phase} ${activity.title}`) === phase) || rawActivities[index] || activityFromMathBlueprint(findActivityBlueprint(periodBlueprint, phase, index), index);
    return normalizeActivity(
      {
        ...source,
        phase,
        title: source.title || findActivityBlueprint(periodBlueprint, phase, index).title || phase,
        objective: source.objective || findActivityBlueprint(periodBlueprint, phase, index).objective || `Tổ chức hoạt động ${phase.toLowerCase()} cho tiết ${periodNumber}.`,
        durationMinutes: source.durationMinutes || findActivityBlueprint(periodBlueprint, phase, index).durationMinutes || mathPhaseDuration(phase, input),
      },
      index,
    );
  });

  return {
    periodNumber,
    focus: rawChunk.focus || periodBlueprint.focus || `Tiết ${periodNumber}: ${title}`,
    outcomes: normalizeOutcomes(rawChunk.outcomes || blueprint.outcomes, `${title} - tiết ${periodNumber}`),
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
  return normalizeMathBlueprint(input, extractJsonValue<MathLessonBlueprint>(result.content));
}

async function generateMathPeriodWithModel(input: LessonInput, ocrText: string, strategy: AiStageStrategy, blueprint: MathLessonBlueprint, period: MathPeriodBlueprint, previousHandoff: MathPeriodChunk["handoff"] | null) {
  const periodNumber = Number(period.periodNumber || 1);
  console.info("[EduPlan AI] Math chunked period started", { model: strategy.model, periodNumber, focus: period.focus });
  const result = await fetchAiJsonContent(strategy, [
    { role: "system", content: "Bạn chỉ trả JSON hợp lệ cho một tiết Toán. Viết đủ dùng dạy thật, nhưng kiểm soát độ dài để tránh timeout." },
    { role: "user", content: buildMathPeriodPrompt(input, ocrText, blueprint, period, previousHandoff) },
  ]);
  return normalizeMathPeriodChunk(input, blueprint, period, extractJsonValue<MathPeriodChunk>(result.content));
}

async function repairMathPeriodWithModel(input: LessonInput, strategy: AiStageStrategy, blueprint: MathLessonBlueprint, period: MathPeriodChunk, issues: string[]) {
  console.info("[EduPlan AI] Math chunked period repair started", { model: strategy.model, periodNumber: period.periodNumber, issueCount: issues.length });
  const result = await fetchAiJsonContent(strategy, [
    { role: "system", content: "Bạn chỉ trả JSON hợp lệ. Nhiệm vụ là sửa một PeriodPlan môn Toán, giữ mạch blueprint và không viết lại toàn bộ bài." },
    { role: "user", content: buildMathPeriodRepairPrompt(input, blueprint, period, issues) },
  ]);
  const periodBlueprint = mathPeriodBlueprintFor(blueprint, Number(period.periodNumber || 1)) || { periodNumber: period.periodNumber, focus: period.focus };
  return normalizeMathPeriodChunk(input, blueprint, periodBlueprint, extractJsonValue<MathPeriodChunk>(result.content));
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
    contextFit: { notes: [...(blueprint.contextFit?.notes || []), ...continuityNotes] }, meta: { style: input.style, modelUsed: model, createdAt: new Date().toISOString() },
  }, model);
}

async function generateMathLessonChunkedWithModel(input: LessonInput, ocrText: string, strategy: PlanModelStrategy) {
  const blueprint = await generateMathBlueprintWithModel(input, ocrText, strategy.blueprint);
  const chunks: MathPeriodChunk[] = [];
  let previousHandoff: MathPeriodChunk["handoff"] | null = null;
  let repairApplied = false;
  for (const period of blueprint.periods || []) {
    let chunk = await generateMathPeriodWithModel(input, ocrText, strategy.detail, blueprint, period, previousHandoff);
    const issues = mathPeriodIssues(chunk);
    if (issues.length) {
      try { chunk = await repairMathPeriodWithModel(input, strategy.repair, blueprint, chunk, issues); repairApplied = true; }
      catch (repairError) { console.warn("[EduPlan AI] Math chunked period repair skipped", { model: strategy.repair.model, periodNumber: chunk.periodNumber, message: repairError instanceof Error ? repairError.message : "Unknown repair error" }); }
    }
    chunks.push(chunk);
    previousHandoff = chunk.handoff || { learned: chunk.focus, unresolvedRisks: blueprint.mathCore?.commonMisconceptions || [], nextBridge: mathPeriodBlueprintFor(blueprint, Number(chunk.periodNumber || 1))?.continuityOut || "Chuyển sang tiết/hoạt động tiếp theo." };
  }
  const lesson = buildMathLessonFromChunks(input, blueprint, chunks, strategy.detail.model);
  const finalPeriodIssues = (lesson.periodPlans || []).flatMap((period) => mathPeriodIssues({ ...period, handoff: undefined }));
  if (finalPeriodIssues.length && !repairApplied) console.warn("[EduPlan AI] Math chunked lesson has remaining period issues", { model: strategy.detail.model, issueCount: finalPeriodIssues.length });
  if (hasStructuralIssues(lesson, input) || isMissingPeriods(lesson, input.periods)) throw new Error("Giáo án Toán chunked chưa đủ cấu trúc sau khi ghép. Vui lòng bấm tạo lại hoặc giảm số tiết/ảnh.");
  const pedagogyAudit = buildPedagogyAudit(lesson, input, repairApplied);
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


function extractJsonValue<T>(text: string) {
  try {
    return JSON.parse(text) as T;
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("OpenAI không trả về JSON hợp lệ.");
    return JSON.parse(match[0]) as T;
  }
}

function extractJson(text: string) {
  return extractJsonValue<LessonPlan>(text);
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

  return {
    generalCompetencies: uniqueItems((general.length ? general : ["Tự chủ và tự học", "Giao tiếp và hợp tác"]).map((item) => expandOutcome(item, lessonTitle, "general"))),
    specificCompetencies: uniqueItems((specific.length ? specific : ["Năng lực đặc thù môn học"]).map((item) => expandOutcome(item, lessonTitle, "specific"))),
    qualities: uniqueItems((qualitiesList.length ? qualitiesList : ["Chăm chỉ", "Trách nhiệm"]).map((item) => expandQuality(item, lessonTitle))),
    knowledgeAndSkills: uniqueItems((knowledge.length ? knowledge : ["Hoàn thành yêu cầu học tập trọng tâm"]).map((item) => expandOutcome(item, lessonTitle, "knowledge"))),
    digitalCompetencies: uniqueItems(digital),
  };
}

function fallbackActivityProduct(activity: LessonPlan["activities"][number], index: number) {
  const key = phaseKey(`${activity.phase} ${activity.title}`);
  if (key === "Khởi động") return "Câu trả lời/chia sẻ ban đầu của học sinh";
  if (key === "Khám phá") return "Kết quả quan sát, thảo luận hoặc phiếu học tập của học sinh";
  if (key === "Luyện tập") return "Bài làm hoặc sản phẩm luyện tập của học sinh";
  if (key === "Vận dụng") return "Ý tưởng/ví dụ vận dụng của học sinh gắn với đời sống";
  return `Sản phẩm học tập của hoạt động ${index + 1}`;
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
    learningProducts: products.length ? products : [fallbackActivityProduct(activity, index)],
  };
}

function normalizeLesson(input: LessonInput, lesson: LessonPlan, model: string): LessonPlan {
  lesson = sanitizeLessonText(lesson);
  const title = lesson.generalInfo?.lessonTitle || input.lessonTitle || "bài học";
  const periodPlans = Array.isArray(lesson.periodPlans)
    ? lesson.periodPlans
        .filter((period) => period && Array.isArray(period.activities))
        .map((period, index) => ({
          periodNumber: Number(period.periodNumber || index + 1),
          focus: period.focus || `Tiết ${index + 1}`,
          outcomes: period.outcomes ? normalizeOutcomes(period.outcomes, `${title} - tiết ${Number(period.periodNumber || index + 1)}`) : undefined,
          activities: period.activities.map(normalizeActivity),
        }))
    : undefined;
  const activities = periodPlans?.length ? periodPlans.flatMap((period) => period.activities) : Array.isArray(lesson.activities) ? lesson.activities.map(normalizeActivity) : [];

  const teacherMat = safeStringArray(lesson.materials?.teacher);
  const studentMat = safeStringArray(lesson.materials?.students);

  return {
    ...lesson,
    generalInfo: {
      subject: lesson.generalInfo?.subject || input.subject,
      grade: lesson.generalInfo?.grade || input.grade,
      lessonTitle: lesson.generalInfo?.lessonTitle || input.lessonTitle || "Bài học",
      book: lesson.generalInfo?.book || bookContext(input),
      periods: Number(lesson.generalInfo?.periods || input.periods || 1),
      duration: Number(lesson.generalInfo?.duration || input.duration || 35),
    },
    outcomes: normalizeOutcomes(lesson.outcomes, title),
    materials: {
      teacher: teacherMat.length ? teacherMat : ["Ảnh SGK/tranh minh họa bài học", "Bảng phụ hoặc phiếu học tập"],
      students: studentMat.length ? studentMat : ["SGK", "Vở ghi hoặc phiếu học tập"],
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
    },
  };
}

async function generateLessonWithStrategy(input: LessonInput, ocrText: string, strategy: PlanModelStrategy) {
  if (isMathSubject(input)) {
    console.info("[EduPlan AI] Math subject detected; using chunked generation", { model: strategy.detail.model, periods: input.periods });
    return generateMathLessonChunkedWithModel(input, ocrText, strategy);
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

async function generateLesson(input: LessonInput, ocrText: string, strategy: PlanModelStrategy) {
  return generateLessonWithStrategy(input, ocrText, strategy);
}

async function saveGeneratedLesson(uid: string, lesson: LessonPlan) {
  const ref = getFirebaseDb().collection("lessons").doc();
  const now = new Date();
  await ref.set({
    ownerId: uid,
    title: lesson.generalInfo?.lessonTitle || "Giáo án chưa đặt tên",
    subject: lesson.generalInfo?.subject || "",
    grade: lesson.generalInfo?.grade || "",
    periods: Number(lesson.generalInfo?.periods || 1),
    lesson,
    createdAt: now,
    updatedAt: now,
    expiresAt: lessonExpiresAt(),
  });
  return ref.id;
}

export async function POST(request: Request) {
  let stage: GenerateResponse["stage"] = "unknown";
  let reservation: UsageReservation | null = null;
  try {
    const user = await requireUser();
    if (!user.emailVerified) {
      return NextResponse.json<GenerateResponse>({ error: "Bạn cần xác minh email trước khi tạo giáo án.", stage }, { status: 403 });
    }

    const input = (await request.json()) as LessonInput;
    const uploadedAssets = Array.isArray(input.uploadedAssets) ? input.uploadedAssets : [];
    if (uploadedAssets.length > 10) {
      return NextResponse.json<GenerateResponse>({ error: "Tối đa 10 ảnh SGK mỗi lần tạo.", stage }, { status: 400 });
    }
    reservation = await reserveUsage(user.uid, "generate", request.headers.get("idempotency-key") || undefined);
    const strategy = getPlanModelStrategy(reservation.plan);
    stage = "ocr";
    const ocrResult = await runOpenAiOcr(input);
    stage = "openai";
    const { lesson, pedagogyAudit } = await generateLesson(input, ocrResult.text, strategy);
    lesson.meta = { ...lesson.meta, plan: reservation.plan };
    const lessonId = await saveGeneratedLesson(user.uid, lesson);
    await commitUsage(reservation, lessonId);
    return NextResponse.json<GenerateResponse>({
      lesson,
      lessonId,
      pedagogyAudit,
      ocrTextLength: ocrResult.text.length,
      modelRouting: { primaryModel: strategy.detail.model, modelUsed: lesson.meta.modelUsed, fallbackUsed: lesson.meta.modelUsed !== strategy.detail.model },
    });
  } catch (error) {
    if (reservation) await releaseUsage(reservation, `generate_failed_${stage}`).catch(() => undefined);
    const policyError = subscriptionErrorResponse(error);
    if (policyError) return NextResponse.json<GenerateResponse>({ ...policyError.body, stage }, { status: policyError.status });
    const rawMessage = error instanceof Error ? error.message : "Không thể tạo giáo án lúc này.";
    const status = error instanceof Error && error.name === "UNAUTHENTICATED" ? 401 : 500;
    const message = stage === "ocr" ? `Lỗi OCR OpenAI: ${rawMessage}` : stage === "openai" ? `Lỗi OpenAI: ${rawMessage}` : rawMessage;
    return NextResponse.json<GenerateResponse>({ error: message, stage }, { status });
  }
}
