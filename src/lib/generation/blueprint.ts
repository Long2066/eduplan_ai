import "server-only";
import { extractAiJsonValue } from "@/lib/ai-json";
import { fetchAiJsonContent } from "@/lib/generation/ai-json-client";
import { generationSubjectKind } from "@/lib/generation/subject-routing";
import { sourceTruthPromptContext, type SourceTruth } from "@/lib/generation/source-truth";
import {
  LessonTitleResolutionError,
  requireResolvedLessonTitle,
  resolveLessonTitle,
} from "@/lib/lesson-title";
import type { StagedSourceContext } from "@/lib/generation/source-preparation";
import { classifyNaturalSocialLesson } from "@/lib/natural-social-pedagogy";
import {
  mergeNaturalSocialSourceInventories,
  sanitizeNaturalSocialSourceInventoryForLesson,
} from "@/lib/natural-social-source-inventory";
import {
  buildMathBlueprintPrompt,
  buildNaturalSocialBlueprintPrompt,
  buildVietnameseBlueprintPrompt,
} from "@/lib/subject-prompts";
import { classifyVietnameseLesson } from "@/lib/vietnamese-pedagogy";
import {
  buildVietnameseSourceInventoryPromptContext,
  mergeVietnameseSourceInventories,
} from "@/lib/vietnamese-source-inventory";
import type { PlanModelStrategy } from "@/lib/model-strategy";
import type { AiGenerationResult, AiStageStrategy, AiProvider } from "@/lib/model-strategy";
import type {
  LessonInput,
  MathLessonBlueprint,
  NaturalSocialLessonBlueprint,
  NaturalSocialSourceInventory,
  VietnameseLessonBlueprint,
} from "@/types/lesson";

export type StagedBlueprintArtifact = {
  subjectKind: ReturnType<typeof generationSubjectKind>;
  mode: "chunked" | "direct-generation";
  model: string | null;
  provider: "openai" | "openrouter" | null;
  fallbackUsed: boolean;
  promptSource: "ocr" | "ocr-and-cache" | "input-only";
  sourceTruth?: SourceTruth;
  classification?: unknown;
  sourceInventory?: NaturalSocialSourceInventory | VietnameseLessonBlueprint["sourceInventory"];
  sourceFacts?: Record<string, unknown>;
  lessonMap?: Record<string, unknown>;
  blueprintPipeline?: {
    sourceFacts: BlueprintPipelineCall;
    lessonMap: BlueprintPipelineCall;
    finalBlueprint: BlueprintPipelineCall;
  };
  blueprint: MathLessonBlueprint | NaturalSocialLessonBlueprint | VietnameseLessonBlueprint | {
    subject: string;
    lessonTitle: string;
    periods: number;
    directGeneration: true;
  };
};

type BlueprintPipelineCall = {
  model: string;
  provider: AiProvider;
  fallbackUsed: boolean;
};

type BlueprintPipelineResult<T> = {
  sourceFacts: Record<string, unknown>;
  lessonMap: Record<string, unknown>;
  blueprint: T;
  model: string;
  provider: AiProvider;
  fallbackUsed: boolean;
  pipeline: StagedBlueprintArtifact["blueprintPipeline"];
};

function positiveInteger(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function envPositiveInteger(name: string, fallback: number) {
  return positiveInteger(process.env[name], fallback);
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function nonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function pipelineCall(result: AiGenerationResult): BlueprintPipelineCall {
  return {
    model: result.model,
    provider: result.provider,
    fallbackUsed: result.fallbackUsed,
  };
}

function combinedModels(calls: BlueprintPipelineCall[]) {
  return [...new Set(calls.map((call) => call.model).filter(Boolean))].join(" + ");
}

function combinedFallbackUsed(calls: BlueprintPipelineCall[]) {
  return calls.some((call) => call.fallbackUsed);
}

function blueprintSubstepStrategy(
  strategy: AiStageStrategy,
  timeoutMs: number,
  maxOutputTokens: number,
): AiStageStrategy {
  return {
    ...strategy,
    timeoutMs,
    maxOutputTokens,
    fallbackTimeoutMs: strategy.fallbackModel
      ? Math.min(strategy.fallbackTimeoutMs || timeoutMs, timeoutMs)
      : undefined,
    fallbackMaxOutputTokens: strategy.fallbackModel
      ? Math.min(strategy.fallbackMaxOutputTokens || maxOutputTokens, maxOutputTokens)
      : undefined,
  };
}

function compactSourceText(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > 8000 ? `${normalized.slice(0, 8000)}...` : normalized;
}

function buildSourceFactsPrompt(
  input: LessonInput,
  subjectKind: StagedBlueprintArtifact["subjectKind"],
  sourceText: string,
  classification: unknown,
  cachedInventory: unknown,
) {
  return `Hãy thực hiện REQUEST 1/3 của blueprint pipeline: ĐỌC NGUỒN VÀ KHÓA SỰ THẬT.

Quy tắc:
- Chỉ trích xuất dữ kiện từ ảnh SGK/OCR và form người dùng; chưa lập giáo án, chưa viết hoạt động dạy học.
- Không tự đổi môn, lớp, số tiết. Nếu ảnh SGK mâu thuẫn với form, ghi vào uncertainties/conflicts.
- Nếu thiếu dữ kiện nghiêm trọng, ghi vào fatalIssues nhưng vẫn trả JSON hợp lệ.
- Output phải ngắn, có cấu trúc, đủ làm căn cứ cho request sau.

Thông tin form:
${JSON.stringify({
  subject: input.subject,
  grade: input.grade,
  lessonTitle: input.lessonTitle || "",
  book: input.book,
  bookVolume: input.bookVolume,
  periods: positiveInteger(input.periods, 1),
  duration: positiveInteger(input.duration, 35),
  subjectKind,
  classification,
  cachedInventory,
})}

SOURCE_TRUTH_JSON và nội dung nguồn:
${compactSourceText(sourceText)}

Schema JSON cần trả:
{
  "subject": string,
  "grade": string,
  "lessonTitle": string,
  "periods": number,
  "duration": number,
  "sourceEvidence": [{ "id": string, "kind": string, "label": string, "page": string, "text": string, "required": boolean }],
  "objectivesFromSource": string[],
  "coreContent": string[],
  "tasksFromSource": [{ "id": string, "label": string, "expectedProduct": string, "expectedAnswer": string, "page": string, "required": boolean }],
  "visualsFromSource": [{ "id": string, "label": string, "page": string, "purpose": string }],
  "uncertainties": string[],
  "conflicts": string[],
  "fatalIssues": string[]
}`;
}

function buildLessonMapPrompt(
  input: LessonInput,
  subjectKind: StagedBlueprintArtifact["subjectKind"],
  sourceFacts: Record<string, unknown>,
  classification: unknown,
) {
  return `Hãy thực hiện REQUEST 2/3 của blueprint pipeline: LẬP BẢN ĐỒ LOGIC BÀI HỌC.

Quy tắc:
- Chỉ dùng SOURCE_FACTS_JSON đã khóa bên dưới; không đọc lại từ đầu, không tự đổi sự thật nguồn.
- Chưa viết giáo án chi tiết. Chỉ tạo mạch kiến thức, mục tiêu và phân bổ tiết.
- periods phải đủ đúng ${positiveInteger(input.periods, 1)} tiết.
- Mỗi tiết phải có trọng tâm riêng, có prerequisite/continuityIn/continuityOut để nối mạch.
- Phân bổ sourceEvidence/task/visual theo đúng tiết; không dùng cùng nhiệm vụ bắt buộc để lấp nhiều tiết nếu không ghi allowReuse.

Thông tin khóa:
${JSON.stringify({
  subject: input.subject,
  grade: input.grade,
  lessonTitle: input.lessonTitle || "",
  periods: positiveInteger(input.periods, 1),
  duration: positiveInteger(input.duration, 35),
  subjectKind,
  classification,
})}

SOURCE_FACTS_JSON:
${JSON.stringify(sourceFacts)}

Schema JSON cần trả:
{
  "lessonTitle": string,
  "lessonOverview": string,
  "logicSpine": string[],
  "outcomes": { "generalCompetencies": string[], "specificCompetencies": string[], "qualities": string[], "knowledgeAndSkills": string[] },
  "sourceAllocation": [{ "sourceId": string, "periodNumber": number, "purpose": string, "allowReuse": boolean }],
  "continuityPlan": {
    "sourceUnits": [{ "unitId": string, "label": string, "kind": string, "page": string, "required": boolean, "allowReuse": boolean, "preferredPeriodNumber": number, "estimatedMinutes": number, "sourceEvidence": string[] }],
    "clusters": [{ "clusterId": string, "label": string, "sourceUnitIds": string[], "periodNumber": number, "mustStayTogether": boolean, "prerequisiteClusterIds": string[], "estimatedMinutes": number, "expectedProduct": string }],
    "warnings": string[]
  },
  "periods": [{
    "periodNumber": number,
    "focus": string,
    "objectives": string[],
    "targetKnowledge": string,
    "sourceIds": string[],
    "continuityIn": string,
    "continuityOut": string,
    "assessmentEvidence": string[]
  }],
  "risks": string[]
}`;
}

function buildLockedBlueprintContext(
  input: LessonInput,
  sourceTruth: SourceTruth | undefined,
  sourceFacts: Record<string, unknown>,
  lessonMap: Record<string, unknown>,
) {
  return `DỮ LIỆU ĐÃ KHÓA CHO REQUEST 3/3.

Ràng buộc bắt buộc:
- Chỉ tạo blueprint sư phạm cuối từ SOURCE_FACTS_JSON và LESSON_MAP_JSON.
- Không tự đổi môn/lớp/tên bài/số tiết/mục tiêu/mạch bài đã khóa.
- Nếu cần sáng tạo, chỉ sáng tạo cách tổ chức pha học; không sáng tác lệch nội dung nguồn.
- Blueprint cuối phải đủ schema của prompt môn học và đủ ${positiveInteger(input.periods, 1)} tiết.
- Mỗi tiết vẫn có 4 pha: Khởi động, Khám phá, Luyện tập, Vận dụng.

SOURCE_TRUTH_JSON:
${JSON.stringify(sourceTruth || null)}

SOURCE_FACTS_JSON:
${JSON.stringify(sourceFacts)}

LESSON_MAP_JSON:
${JSON.stringify(lessonMap)}`;
}

function assertNonEmptyObject(value: Record<string, unknown>, label: string) {
  if (!Object.keys(value).length) {
    throw new Error(`Blueprint pipeline lỗi: ${label} rỗng, không đủ dữ liệu để giữ logic bài học.`);
  }
}

function assertLessonMap(input: LessonInput, lessonMap: Record<string, unknown>) {
  assertNonEmptyObject(lessonMap, "lessonMap");
  const periods = Array.isArray(lessonMap.periods) ? lessonMap.periods.map(objectValue) : [];
  const expected = positiveInteger(input.periods, 1);
  if (periods.length !== expected) {
    throw new Error(`Blueprint pipeline lỗi: lessonMap phải có đúng ${expected} tiết nhưng nhận ${periods.length}.`);
  }
  periods.forEach((period, index) => {
    const actual = positiveInteger(period.periodNumber, 0);
    if (actual !== index + 1) {
      throw new Error(`Blueprint pipeline lỗi: lessonMap tiết ${index + 1} thiếu periodNumber đúng.`);
    }
    if (!nonEmptyString(period.focus)) {
      throw new Error(`Blueprint pipeline lỗi: lessonMap tiết ${index + 1} thiếu trọng tâm.`);
    }
  });
}

function lockedPipelineLessonTitle(
  input: LessonInput,
  sourceTruth: SourceTruth | undefined,
) {
  const resolution = resolveLessonTitle({
    subject: input.subject,
    candidates: [
      { value: sourceTruth?.lessonTitle, source: "source-truth", confidence: sourceTruth?.lessonIdentity?.confidence || 0.95 },
      { value: input.lessonTitle, source: "user-input", confidence: 0.95 },
    ],
  });
  return requireResolvedLessonTitle(resolution);
}

function withLockedTitle<T>(value: T, title: string): T {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new LessonTitleResolutionError();
  }
  return { ...(value as Record<string, unknown>), lessonTitle: title } as T;
}

async function runBlueprintPipeline<T>(
  input: LessonInput,
  subjectKind: StagedBlueprintArtifact["subjectKind"],
  sourceText: string,
  sourceTruth: SourceTruth | undefined,
  classification: unknown,
  cachedInventory: unknown,
  strategy: PlanModelStrategy,
  finalSystemMessage: string,
  finalPrompt: (lockedContext: string) => string,
): Promise<BlueprintPipelineResult<T>> {
  const lockedTitle = lockedPipelineLessonTitle(input, sourceTruth);
  const effectiveInput = { ...input, lessonTitle: lockedTitle };
  const sourceFactsStrategy = blueprintSubstepStrategy(
    strategy.blueprint,
    envPositiveInteger("BLUEPRINT_SOURCE_FACTS_TIMEOUT_MS", 45_000),
    envPositiveInteger("BLUEPRINT_SOURCE_FACTS_MAX_OUTPUT_TOKENS", 6_000),
  );
  const lessonMapStrategy = blueprintSubstepStrategy(
    strategy.blueprint,
    envPositiveInteger("BLUEPRINT_LESSON_MAP_TIMEOUT_MS", 45_000),
    envPositiveInteger("BLUEPRINT_LESSON_MAP_MAX_OUTPUT_TOKENS", 7_000),
  );

  const sourceFactsResult = await fetchAiJsonContent(sourceFactsStrategy, [
    {
      role: "system",
      content: "Bạn chỉ trả JSON hợp lệ. Request 1/3: khóa sự thật nguồn từ ảnh SGK/OCR, tuyệt đối chưa soạn giáo án.",
    },
    { role: "user", content: buildSourceFactsPrompt(effectiveInput, subjectKind, sourceText, classification, cachedInventory) },
  ]);
  const sourceFacts = withLockedTitle(
    objectValue(extractAiJsonValue<Record<string, unknown>>(sourceFactsResult.content)),
    lockedTitle,
  );
  assertNonEmptyObject(sourceFacts, "sourceFacts");

  const lessonMapResult = await fetchAiJsonContent(lessonMapStrategy, [
    {
      role: "system",
      content: "Bạn chỉ trả JSON hợp lệ. Request 2/3: lập bản đồ logic bài học từ sourceFacts đã khóa, chưa viết giáo án.",
    },
    { role: "user", content: buildLessonMapPrompt(effectiveInput, subjectKind, sourceFacts, classification) },
  ]);
  const lessonMap = withLockedTitle(
    objectValue(extractAiJsonValue<Record<string, unknown>>(lessonMapResult.content)),
    lockedTitle,
  );
  assertLessonMap(effectiveInput, lessonMap);

  const lockedContext = buildLockedBlueprintContext(effectiveInput, sourceTruth, sourceFacts, lessonMap);
  const finalResult = await fetchAiJsonContent(strategy.blueprint, [
    {
      role: "system",
      content: finalSystemMessage,
    },
    {
      role: "user",
      content: `${finalPrompt(lockedContext)}

Ràng buộc pipeline bổ sung:
- Đây là REQUEST 3/3. Không đọc lại bài từ đầu; chỉ dùng dữ liệu đã khóa trong SOURCE_FACTS_JSON và LESSON_MAP_JSON.
- Tên bài bất biến là "${lockedTitle}"; phải ghi đúng nguyên văn vào lessonTitle.
- Không thay đổi số tiết, thứ tự tiết, trọng tâm tiết hoặc phân bổ nguồn đã khóa.
- Nếu prompt môn học yêu cầu sourceInventory/continuityPlan, hãy tạo từ sourceFacts và lessonMap, không tạo ID mâu thuẫn.`,
    },
  ]);
  const finalBlueprint = withLockedTitle(extractAiJsonValue<T>(finalResult.content), lockedTitle);
  const calls = [pipelineCall(sourceFactsResult), pipelineCall(lessonMapResult), pipelineCall(finalResult)];
  return {
    sourceFacts,
    lessonMap,
    blueprint: finalBlueprint,
    model: combinedModels(calls) || finalResult.model,
    provider: finalResult.provider,
    fallbackUsed: combinedFallbackUsed(calls),
    pipeline: {
      sourceFacts: calls[0],
      lessonMap: calls[1],
      finalBlueprint: calls[2],
    },
  };
}

export async function generateStagedBlueprint(
  input: LessonInput,
  ocrText: string,
  sourceContext: StagedSourceContext,
  strategy: PlanModelStrategy,
): Promise<StagedBlueprintArtifact> {
  const subjectKind = generationSubjectKind(input);
  const sourceTruth = sourceContext.sourceTruth;
  const groundedSourceText = sourceTruthPromptContext(sourceTruth, ocrText);
  if (subjectKind === "math") {
    const result = await runBlueprintPipeline<MathLessonBlueprint>(
      input,
      subjectKind,
      groundedSourceText,
      sourceTruth,
      null,
      null,
      strategy,
      "Bạn chỉ trả JSON hợp lệ. Request 3/3: tạo blueprint môn Toán tiểu học từ sourceFacts và lessonMap đã khóa; chưa viết giáo án đầy đủ.",
      (lockedContext) => buildMathBlueprintPrompt(input, lockedContext),
    );
    return {
      subjectKind,
      mode: "chunked",
      model: result.model,
      provider: result.provider,
      fallbackUsed: result.fallbackUsed,
      promptSource: ocrText ? "ocr" : "input-only",
      sourceTruth,
      sourceFacts: result.sourceFacts,
      lessonMap: result.lessonMap,
      blueprintPipeline: result.pipeline,
      blueprint: result.blueprint,
    };
  }

  if (subjectKind === "vietnamese") {
    const cachedInventory = sourceContext.vietnamese?.inventory;
    const sourceAwareText = buildVietnameseSourceInventoryPromptContext(groundedSourceText, cachedInventory);
    const classification = classifyVietnameseLesson(input, sourceAwareText);
    const result = await runBlueprintPipeline<VietnameseLessonBlueprint>(
      input,
      subjectKind,
      sourceAwareText,
      sourceTruth,
      classification,
      cachedInventory,
      strategy,
      "Bạn chỉ trả JSON hợp lệ. Request 3/3: tạo blueprint môn Tiếng Việt tiểu học theo classifier và dữ liệu đã khóa; chưa viết giáo án đầy đủ.",
      (lockedContext) => buildVietnameseBlueprintPrompt(input, lockedContext, classification),
    );
    const blueprint = result.blueprint;
    const sourceInventory = mergeVietnameseSourceInventories(cachedInventory, blueprint.sourceInventory);
    return {
      subjectKind,
      mode: "chunked",
      model: result.model,
      provider: result.provider,
      fallbackUsed: result.fallbackUsed,
      promptSource: cachedInventory ? "ocr-and-cache" : ocrText ? "ocr" : "input-only",
      sourceTruth,
      classification,
      sourceInventory,
      sourceFacts: result.sourceFacts,
      lessonMap: result.lessonMap,
      blueprintPipeline: result.pipeline,
      blueprint: { ...blueprint, classification, sourceInventory },
    };
  }

  if (subjectKind === "natural-social") {
    const cachedInventory = sourceContext.naturalSocial?.inventory;
    const classification = classifyNaturalSocialLesson(input, groundedSourceText);
    const result = await runBlueprintPipeline<NaturalSocialLessonBlueprint>(
      input,
      subjectKind,
      groundedSourceText,
      sourceTruth,
      classification,
      cachedInventory,
      strategy,
      "Bạn chỉ trả JSON hợp lệ. Request 3/3: tạo blueprint môn Tự nhiên và Xã hội theo dữ liệu đã khóa; chưa viết giáo án đầy đủ.",
      (lockedContext) => buildNaturalSocialBlueprintPrompt(input, lockedContext, classification, cachedInventory),
    );
    const blueprint = result.blueprint;
    const sourceInventory = sanitizeNaturalSocialSourceInventoryForLesson(
      input,
      mergeNaturalSocialSourceInventories(cachedInventory, blueprint.sourceInventory),
      classification,
    );
    return {
      subjectKind,
      mode: "chunked",
      model: result.model,
      provider: result.provider,
      fallbackUsed: result.fallbackUsed,
      promptSource: cachedInventory ? "ocr-and-cache" : ocrText ? "ocr" : "input-only",
      sourceTruth,
      classification,
      sourceInventory,
      sourceFacts: result.sourceFacts,
      lessonMap: result.lessonMap,
      blueprintPipeline: result.pipeline,
      blueprint: { ...blueprint, classification, sourceInventory },
    };
  }

  const lockedTitle = lockedPipelineLessonTitle(input, sourceTruth);
  return {
    subjectKind,
    mode: "direct-generation",
    model: null,
    provider: null,
    fallbackUsed: false,
    promptSource: ocrText ? "ocr" : "input-only",
    sourceTruth,
    blueprint: {
      subject: input.subject,
      lessonTitle: lockedTitle,
      periods: Math.max(1, Number(input.periods || 1)),
      directGeneration: true,
    },
  };
}
