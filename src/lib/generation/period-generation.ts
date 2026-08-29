import "server-only";
import { extractAiJsonValue } from "@/lib/ai-json";
import type { StagedBlueprintArtifact } from "@/lib/generation/blueprint";
import { fetchAiJsonContent } from "@/lib/generation/ai-json-client";
import { sourceTruthPromptContext } from "@/lib/generation/source-truth";
import {
  buildMathPeriodPrompt,
  buildNaturalSocialPeriodPrompt,
  buildSubjectPrompt,
  buildSubjectSystemRole,
  buildVietnamesePeriodPrompt,
} from "@/lib/subject-prompts";
import type { PlanModelStrategy } from "@/lib/model-strategy";
import type {
  LessonInput,
  LessonPlan,
  MathLessonBlueprint,
  MathPeriodBlueprint,
  NaturalSocialLessonBlueprint,
  NaturalSocialLessonType,
  NaturalSocialPeriodBlueprint,
  PeriodPlan,
  VietnameseLessonBlueprint,
  VietnameseLessonType,
  VietnamesePeriodBlueprint,
} from "@/types/lesson";

export type StagedPeriodArtifact = {
  subjectKind: StagedBlueprintArtifact["subjectKind"];
  periodNumber: number;
  model: string;
  provider: "openai" | "openrouter";
  fallbackUsed: boolean;
  period: PeriodPlan;
  handoff: PeriodPlan["handoff"] | null;
};

type JsonObject = Record<string, unknown>;

const VIETNAMESE_LESSON_TYPES = new Set<VietnameseLessonType>([
  "reading",
  "handwriting",
  "spelling",
  "composition",
  "language-knowledge",
  "speaking-listening",
  "mixed",
]);

const NATURAL_SOCIAL_LESSON_TYPES = new Set<NaturalSocialLessonType>([
  "family",
  "school",
  "local-community",
  "plants-animals",
  "human-health",
  "earth-sky",
  "mixed",
]);

function objectValue(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonObject
    : {};
}

function positiveInteger(value: unknown, fallback = 1) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue >= 1
    ? Math.floor(numericValue)
    : fallback;
}

function nonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.map(nonEmptyString).filter((item): item is string => Boolean(item))
    : [];
}

function classificationPrimaryType(value: unknown) {
  return nonEmptyString(objectValue(value).primaryType);
}

function blueprintPeriods(blueprint: JsonObject) {
  return Array.isArray(blueprint.periods)
    ? blueprint.periods.map(objectValue)
    : [];
}

function periodBlueprintAt(blueprint: JsonObject, periodNumber: number) {
  const periods = blueprintPeriods(blueprint);
  return periods.find((period) => positiveInteger(period.periodNumber, 0) === periodNumber)
    || periods[periodNumber - 1]
    || {};
}

function normalizeMathBlueprint(
  input: LessonInput,
  artifact: StagedBlueprintArtifact,
): MathLessonBlueprint {
  const raw = objectValue(artifact.blueprint);
  const total = positiveInteger(input.periods);
  return {
    ...raw,
    periods: Array.from({ length: total }, (_, index): MathPeriodBlueprint => {
      const periodNumber = index + 1;
      const period = periodBlueprintAt(raw, periodNumber);
      return {
        ...period,
        periodNumber,
        focus: nonEmptyString(period.focus) || `Tiết ${periodNumber}: ${input.lessonTitle || input.subject}`,
        objectives: stringArray(period.objectives),
        activities: Array.isArray(period.activities) ? period.activities as MathPeriodBlueprint["activities"] : [],
      };
    }),
  } as MathLessonBlueprint;
}

function normalizeVietnameseBlueprint(
  input: LessonInput,
  artifact: StagedBlueprintArtifact,
): VietnameseLessonBlueprint {
  const raw = objectValue(artifact.blueprint);
  const total = positiveInteger(input.periods);
  const rawClassification = raw.classification || artifact.classification;
  const classifiedType = classificationPrimaryType(rawClassification);
  const fallbackType = classifiedType && VIETNAMESE_LESSON_TYPES.has(classifiedType as VietnameseLessonType)
    ? classifiedType as VietnameseLessonType
    : "mixed";
  return {
    ...raw,
    classification: rawClassification as VietnameseLessonBlueprint["classification"],
    sourceInventory: (raw.sourceInventory || artifact.sourceInventory) as VietnameseLessonBlueprint["sourceInventory"],
    periods: Array.from({ length: total }, (_, index): VietnamesePeriodBlueprint => {
      const periodNumber = index + 1;
      const period = periodBlueprintAt(raw, periodNumber);
      const rawType = nonEmptyString(period.lessonType);
      const lessonType = rawType && VIETNAMESE_LESSON_TYPES.has(rawType as VietnameseLessonType)
        ? rawType as VietnameseLessonType
        : fallbackType;
      return {
        ...period,
        periodNumber,
        focus: nonEmptyString(period.focus) || `Tiết ${periodNumber}: ${input.lessonTitle || input.subject}`,
        lessonType,
        objectives: stringArray(period.objectives),
        targetSkills: stringArray(period.targetSkills),
        activities: Array.isArray(period.activities) ? period.activities as VietnamesePeriodBlueprint["activities"] : [],
      };
    }),
  } as VietnameseLessonBlueprint;
}

function normalizeNaturalSocialBlueprint(
  input: LessonInput,
  artifact: StagedBlueprintArtifact,
): NaturalSocialLessonBlueprint {
  const raw = objectValue(artifact.blueprint);
  const total = positiveInteger(input.periods);
  const rawClassification = raw.classification || artifact.classification;
  const classifiedType = classificationPrimaryType(rawClassification);
  const fallbackType = classifiedType && NATURAL_SOCIAL_LESSON_TYPES.has(classifiedType as NaturalSocialLessonType)
    ? classifiedType as NaturalSocialLessonType
    : "mixed";
  return {
    ...raw,
    classification: rawClassification as NaturalSocialLessonBlueprint["classification"],
    sourceInventory: (raw.sourceInventory || artifact.sourceInventory) as NaturalSocialLessonBlueprint["sourceInventory"],
    periods: Array.from({ length: total }, (_, index): NaturalSocialPeriodBlueprint => {
      const periodNumber = index + 1;
      const period = periodBlueprintAt(raw, periodNumber);
      const rawType = nonEmptyString(period.lessonType);
      const lessonType = rawType && NATURAL_SOCIAL_LESSON_TYPES.has(rawType as NaturalSocialLessonType)
        ? rawType as NaturalSocialLessonType
        : fallbackType;
      return {
        ...period,
        periodNumber,
        focus: nonEmptyString(period.focus) || `Tiết ${periodNumber}: ${input.lessonTitle || input.subject}`,
        lessonType,
        objectives: stringArray(period.objectives),
        observationTargets: stringArray(period.observationTargets),
        comparisonCriteria: stringArray(period.comparisonCriteria),
        safetyNotes: stringArray(period.safetyNotes),
        activities: Array.isArray(period.activities) ? period.activities as NaturalSocialPeriodBlueprint["activities"] : [],
      };
    }),
  } as NaturalSocialLessonBlueprint;
}

function defaultPeriodPrompt(
  input: LessonInput,
  ocrText: string,
  periodNumber: number,
  previousHandoff: PeriodPlan["handoff"] | null,
) {
  return `${buildSubjectPrompt(input, ocrText)}

YÊU CẦU GẦN NHẤT CHO PIPELINE NHIỀU BƯỚC (ưu tiên cao hơn yêu cầu LessonPlan toàn bài ở trên):
- Chỉ tạo riêng tiết ${periodNumber}/${positiveInteger(input.periods)} trong request này.
- Chỉ trả một JSON PeriodPlan, không trả LessonPlan toàn bài và không sinh các tiết khác.
- periodNumber bắt buộc bằng ${periodNumber}.
- Tiết này vẫn phải đủ đúng quy trình hiện hành, có outcomes và activities dùng dạy thật.
- activities phải là mảng không rỗng và giữ đủ các pha bắt buộc của prompt.
- Bàn giao từ tiết trước: ${previousHandoff ? JSON.stringify(previousHandoff) : "Đây là tiết mở đầu."}
- Cuối JSON thêm handoff { learned, unresolvedRisks, nextBridge } để request kế tiếp giữ mạch.

Schema trả về: { "periodNumber": number, "focus": string, "outcomes": object, "activities": array, "handoff": { "learned": string, "unresolvedRisks": string[], "nextBridge": string } }`;
}

function candidatePeriod(value: unknown, periodNumber: number) {
  const root = objectValue(value);
  const wrappedPeriod = objectValue(root.period);
  if (Object.keys(wrappedPeriod).length) return wrappedPeriod;

  const periodPlans = Array.isArray(root.periodPlans)
    ? root.periodPlans.map(objectValue)
    : [];
  if (periodPlans.length) {
    return periodPlans.find((period) => positiveInteger(period.periodNumber, 0) === periodNumber)
      || periodPlans[periodNumber - 1]
      || {};
  }
  return root;
}

function normalizeHandoff(value: unknown): PeriodPlan["handoff"] | null {
  const raw = objectValue(value);
  const learned = nonEmptyString(raw.learned);
  const unresolvedRisks = stringArray(raw.unresolvedRisks);
  const nextBridge = nonEmptyString(raw.nextBridge);
  if (!learned && !unresolvedRisks.length && !nextBridge) return null;
  return { learned, unresolvedRisks, nextBridge };
}

function normalizeGeneratedPeriod(
  value: unknown,
  periodNumber: number,
  fallbackFocus: string,
): { period: PeriodPlan; handoff: PeriodPlan["handoff"] | null } {
  const raw = candidatePeriod(value, periodNumber);
  const activities = Array.isArray(raw.activities) ? raw.activities : [];
  if (!activities.length) {
    throw new Error(`AI chưa trả đủ hoạt động cho tiết ${periodNumber}. Vui lòng thử lại bước này.`);
  }
  const handoff = normalizeHandoff(raw.handoff);
  return {
    period: {
      ...raw,
      periodNumber,
      focus: nonEmptyString(raw.focus) || fallbackFocus,
      activities,
      handoff: handoff || undefined,
    } as PeriodPlan,
    handoff,
  };
}

export async function generateStagedPeriod(
  input: LessonInput,
  ocrText: string,
  blueprintArtifact: StagedBlueprintArtifact,
  periodNumber: number,
  previousHandoff: PeriodPlan["handoff"] | null,
  strategy: PlanModelStrategy,
): Promise<StagedPeriodArtifact> {
  const safePeriodNumber = Math.min(positiveInteger(input.periods), positiveInteger(periodNumber));
  const groundedSourceText = sourceTruthPromptContext(blueprintArtifact.sourceTruth, ocrText);
  let systemPrompt: string;
  let userPrompt: string;
  let fallbackFocus = `Tiết ${safePeriodNumber}: ${input.lessonTitle || input.subject}`;

  if (blueprintArtifact.subjectKind === "math") {
    const blueprint = normalizeMathBlueprint(input, blueprintArtifact);
    const period = blueprint.periods?.[safePeriodNumber - 1] || { periodNumber: safePeriodNumber, focus: fallbackFocus };
    fallbackFocus = period.focus || fallbackFocus;
    systemPrompt = "Bạn chỉ trả JSON hợp lệ cho một tiết Toán. Viết đủ dùng dạy thật, nhưng kiểm soát độ dài để tránh timeout.";
    userPrompt = buildMathPeriodPrompt(input, groundedSourceText, blueprint, period, previousHandoff);
  } else if (blueprintArtifact.subjectKind === "vietnamese") {
    const blueprint = normalizeVietnameseBlueprint(input, blueprintArtifact);
    const period = blueprint.periods?.[safePeriodNumber - 1] || { periodNumber: safePeriodNumber, focus: fallbackFocus, lessonType: "mixed" };
    fallbackFocus = period.focus || fallbackFocus;
    systemPrompt = `Bạn chỉ trả JSON hợp lệ cho một tiết Tiếng Việt. Bám đúng kiểu bài ${period.lessonType || "mixed"}, viết đủ dùng dạy thật và kiểm soát độ dài.`;
    userPrompt = buildVietnamesePeriodPrompt(input, groundedSourceText, blueprint, period, previousHandoff);
  } else if (blueprintArtifact.subjectKind === "natural-social") {
    const blueprint = normalizeNaturalSocialBlueprint(input, blueprintArtifact);
    const period = blueprint.periods?.[safePeriodNumber - 1] || { periodNumber: safePeriodNumber, focus: fallbackFocus, lessonType: "mixed" };
    fallbackFocus = period.focus || fallbackFocus;
    systemPrompt = `Bạn chỉ trả JSON hợp lệ cho một tiết Tự nhiên và Xã hội. Bám đúng chủ đề ${period.lessonType || "mixed"}, viết đủ dùng dạy thật và kiểm soát độ dài.`;
    userPrompt = buildNaturalSocialPeriodPrompt(input, groundedSourceText, blueprint, period, previousHandoff);
  } else {
    systemPrompt = buildSubjectSystemRole(input);
    userPrompt = defaultPeriodPrompt(input, groundedSourceText, safePeriodNumber, previousHandoff);
  }

  const result = await fetchAiJsonContent(strategy.detail, [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ]);
  const generated = extractAiJsonValue<PeriodPlan | { period: PeriodPlan } | LessonPlan>(result.content);
  const normalized = normalizeGeneratedPeriod(generated, safePeriodNumber, fallbackFocus);
  return {
    subjectKind: blueprintArtifact.subjectKind,
    periodNumber: safePeriodNumber,
    model: result.model,
    provider: result.provider,
    fallbackUsed: result.fallbackUsed,
    period: normalized.period,
    handoff: normalized.handoff,
  };
}
