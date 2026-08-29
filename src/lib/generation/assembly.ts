import "server-only";
import type { StagedBlueprintArtifact } from "@/lib/generation/blueprint";
import type { StagedPeriodArtifact } from "@/lib/generation/period-generation";
import {
  requireResolvedLessonTitle,
  resolveLessonTitle,
} from "@/lib/lesson-title";
import { sanitizeNaturalSocialSourceInventoryForLesson } from "@/lib/natural-social-source-inventory";
import { bookContext } from "@/lib/subject-prompts";
import type { SubscriptionPlan } from "@/lib/model-strategy";
import type {
  LessonActivity,
  LessonInput,
  LessonOutcomes,
  LessonPlan,
  NaturalSocialLessonBlueprint,
  PeriodPlan,
  VietnameseLessonBlueprint,
} from "@/types/lesson";

export type StagedAssemblyArtifact = {
  subjectKind: StagedBlueprintArtifact["subjectKind"];
  periodCount: number;
  repairApplied: boolean;
  models: string[];
  providers: Array<"openai" | "openrouter">;
  fallbackUsed: boolean;
  lesson: LessonPlan;
};

type JsonObject = Record<string, unknown>;

const ADJUSTMENT_PLACEHOLDER = "........................................................................................................................................";

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

function uniqueStrings(values: string[]) {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = value.toLocaleLowerCase("vi").replace(/\s+/g, " ").trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function uniqueValues<T>(values: T[]) {
  return Array.from(new Set(values));
}

function outcomesFrom(value: unknown): LessonOutcomes {
  const raw = objectValue(value);
  const objectiveMetadata = Array.isArray(raw.objectiveMetadata)
    ? raw.objectiveMetadata
    : [];
  return {
    generalCompetencies: stringArray(raw.generalCompetencies),
    specificCompetencies: stringArray(raw.specificCompetencies),
    qualities: stringArray(raw.qualities),
    knowledgeAndSkills: stringArray(raw.knowledgeAndSkills),
    digitalCompetencies: stringArray(raw.digitalCompetencies),
    ...(objectiveMetadata.length ? { objectiveMetadata: objectiveMetadata as LessonOutcomes["objectiveMetadata"] } : {}),
  };
}

function mergeOutcomes(primary: unknown, periods: PeriodPlan[]): LessonOutcomes {
  const primaryOutcomes = outcomesFrom(primary);
  const periodOutcomes = periods.map((period) => outcomesFrom(period.outcomes));
  const mergedMetadata = [
    ...(primaryOutcomes.objectiveMetadata || []),
    ...periodOutcomes.flatMap((outcomes) => outcomes.objectiveMetadata || []),
  ];
  const metadataIds = new Set<string>();
  return {
    generalCompetencies: uniqueStrings([
      ...primaryOutcomes.generalCompetencies,
      ...periodOutcomes.flatMap((outcomes) => outcomes.generalCompetencies),
    ]),
    specificCompetencies: uniqueStrings([
      ...primaryOutcomes.specificCompetencies,
      ...periodOutcomes.flatMap((outcomes) => outcomes.specificCompetencies),
    ]),
    qualities: uniqueStrings([
      ...primaryOutcomes.qualities,
      ...periodOutcomes.flatMap((outcomes) => outcomes.qualities),
    ]),
    knowledgeAndSkills: uniqueStrings([
      ...primaryOutcomes.knowledgeAndSkills,
      ...periodOutcomes.flatMap((outcomes) => outcomes.knowledgeAndSkills),
    ]),
    digitalCompetencies: uniqueStrings([
      ...(primaryOutcomes.digitalCompetencies || []),
      ...periodOutcomes.flatMap((outcomes) => outcomes.digitalCompetencies || []),
    ]),
    ...(mergedMetadata.length ? {
      objectiveMetadata: mergedMetadata.filter((item) => {
        const id = nonEmptyString(item.id);
        if (!id || metadataIds.has(id)) return false;
        metadataIds.add(id);
        return true;
      }),
    } : {}),
  };
}

function materialDefaults(subjectKind: StagedBlueprintArtifact["subjectKind"]) {
  if (subjectKind === "math") {
    return {
      teacher: ["Ảnh SGK/tranh bài toán", "Bảng phụ hoặc phiếu tóm tắt", "Thẻ số/thẻ dữ kiện"],
      students: ["SGK", "Vở Toán", "Bảng con hoặc phiếu học tập"],
    };
  }
  if (subjectKind === "vietnamese") {
    return {
      teacher: ["Ảnh SGK/tranh minh họa", "Bảng phụ, thẻ từ hoặc phiếu học tập"],
      students: ["SGK Tiếng Việt", "Vở ghi/vở bài tập", "Bảng con hoặc phiếu học tập"],
    };
  }
  if (subjectKind === "natural-social") {
    return {
      teacher: ["Ảnh SGK/tranh minh họa", "Vật thật hoặc mô hình an toàn", "Phiếu/bảng quan sát"],
      students: ["SGK", "Vở hoặc phiếu học tập", "Bút màu/thẻ học tập"],
    };
  }
  return {
    teacher: ["Ảnh SGK/tranh minh họa bài học", "Bảng phụ hoặc phiếu học tập"],
    students: ["SGK", "Vở ghi hoặc phiếu học tập"],
  };
}

function validateAndOrderPeriods(
  input: LessonInput,
  blueprint: StagedBlueprintArtifact,
  periodArtifacts: StagedPeriodArtifact[],
) {
  const total = positiveInteger(input.periods);
  if (periodArtifacts.length !== total) {
    throw new Error(`Không thể ghép giáo án: cần đủ ${total} tiết nhưng chỉ tìm thấy ${periodArtifacts.length}.`);
  }

  const seen = new Set<number>();
  const ordered = periodArtifacts.slice().sort((left, right) => left.periodNumber - right.periodNumber);
  return ordered.map((artifact, index): PeriodPlan => {
    const expectedNumber = index + 1;
    if (artifact.subjectKind !== blueprint.subjectKind) {
      throw new Error(`Không thể ghép giáo án: artifact tiết ${expectedNumber} không khớp môn học của blueprint.`);
    }
    if (seen.has(artifact.periodNumber)) {
      throw new Error(`Không thể ghép giáo án: periodNumber ${artifact.periodNumber} bị trùng.`);
    }
    seen.add(artifact.periodNumber);
    if (artifact.periodNumber !== expectedNumber || artifact.period.periodNumber !== expectedNumber) {
      throw new Error(`Không thể ghép giáo án: thứ tự tiết không liên tục tại tiết ${expectedNumber}.`);
    }
    if (!Array.isArray(artifact.period.activities) || !artifact.period.activities.length) {
      throw new Error(`Không thể ghép giáo án: tiết ${expectedNumber} chưa có hoạt động.`);
    }
    return {
      ...artifact.period,
      periodNumber: expectedNumber,
      focus: nonEmptyString(artifact.period.focus) || `Tiết ${expectedNumber}: ${input.lessonTitle || input.subject}`,
      activities: artifact.period.activities as LessonActivity[],
      handoff: artifact.handoff || artifact.period.handoff || undefined,
    };
  });
}

function contextNotes(
  blueprint: JsonObject,
  subjectKind: StagedBlueprintArtifact["subjectKind"],
  periods: PeriodPlan[],
) {
  const notes = stringArray(objectValue(blueprint.contextFit).notes);
  if (subjectKind === "natural-social") {
    const core = objectValue(blueprint.naturalSocialCore);
    notes.push(...stringArray(core.safetyNotes).map((note) => `Lưu ý an toàn: ${note}`));
    notes.push(...stringArray(core.localConnectionRules).map((note) => `Địa phương hóa: ${note}`));
  }
  periods.forEach((period) => {
    const continuity = period.handoff?.nextBridge || period.handoff?.learned;
    if (continuity) notes.push(`Tiết ${period.periodNumber}: ${continuity}`);
  });
  return uniqueStrings(notes);
}

export function assembleStagedLesson(
  input: LessonInput,
  blueprintArtifact: StagedBlueprintArtifact,
  periodArtifacts: StagedPeriodArtifact[],
  plan: SubscriptionPlan,
  repairApplied = false,
): StagedAssemblyArtifact {
  const blueprint = objectValue(blueprintArtifact.blueprint);
  const orderedArtifacts = periodArtifacts.slice().sort((left, right) => left.periodNumber - right.periodNumber);
  const periods = validateAndOrderPeriods(input, blueprintArtifact, orderedArtifacts);
  const models = uniqueStrings([
    blueprintArtifact.model || "",
    ...orderedArtifacts.map((artifact) => artifact.model),
  ].filter(Boolean));
  const providers = uniqueValues([
    ...(blueprintArtifact.provider ? [blueprintArtifact.provider] : []),
    ...orderedArtifacts.map((artifact) => artifact.provider),
  ]);
  const fallbackMaterials = materialDefaults(blueprintArtifact.subjectKind);
  const rawMaterials = objectValue(blueprint.materials);
  const teacherMaterials = stringArray(rawMaterials.teacher);
  const studentMaterials = stringArray(rawMaterials.students);
  const rawAssessment = objectValue(blueprint.assessment);
  const title = requireResolvedLessonTitle(resolveLessonTitle({
    subject: input.subject,
    candidates: [
      {
        value: blueprintArtifact.sourceTruth?.lessonTitle,
        source: "source-truth",
        confidence: blueprintArtifact.sourceTruth?.lessonIdentity?.confidence || 0.95,
      },
      { value: input.lessonTitle, source: "user-input", confidence: 0.95 },
      { value: blueprintArtifact.sourceFacts?.lessonTitle, source: "source-facts", confidence: 0.9 },
      { value: blueprintArtifact.lessonMap?.lessonTitle, source: "lesson-map", confidence: 0.85 },
      { value: blueprint.lessonTitle, source: "blueprint", confidence: 0.8 },
    ],
  }));
  const modelUsed = orderedArtifacts[orderedArtifacts.length - 1]?.model
    || blueprintArtifact.model
    || "unknown";
  const sourceInventory = blueprintArtifact.subjectKind === "natural-social"
    ? sanitizeNaturalSocialSourceInventoryForLesson(
        input,
        blueprint.sourceInventory || blueprintArtifact.sourceInventory,
        blueprintArtifact.classification as any,
      )
    : blueprint.sourceInventory || blueprintArtifact.sourceInventory;
  const continuityPlan = blueprint.continuityPlan;

  const lesson: LessonPlan = {
    generalInfo: {
      subject: input.subject,
      grade: input.grade,
      lessonTitle: title,
      book: bookContext(input),
      periods: periods.length,
      duration: positiveInteger(input.duration, 35),
    },
    outcomes: mergeOutcomes(blueprint.outcomes, periods),
    materials: {
      teacher: teacherMaterials.length ? teacherMaterials : fallbackMaterials.teacher,
      students: studentMaterials.length ? studentMaterials : fallbackMaterials.students,
    },
    activities: periods.flatMap((period) => period.activities),
    periodPlans: periods,
    assessment: {
      criteria: stringArray(rawAssessment.criteria),
      evidence: stringArray(rawAssessment.evidence),
      comments: stringArray(rawAssessment.comments),
    },
    adjustments: {
      suitablePoints: [ADJUSTMENT_PLACEHOLDER],
      pointsToAdjust: [ADJUSTMENT_PLACEHOLDER],
      nextLessonDirection: [ADJUSTMENT_PLACEHOLDER],
    },
    contextFit: {
      notes: contextNotes(blueprint, blueprintArtifact.subjectKind, periods),
    },
    meta: {
      style: input.style,
      modelUsed,
      createdAt: new Date().toISOString(),
      plan,
      ...(blueprintArtifact.subjectKind === "vietnamese" && sourceInventory
        ? { vietnameseSourceInventory: sourceInventory as VietnameseLessonBlueprint["sourceInventory"] }
        : {}),
      ...(blueprintArtifact.subjectKind === "natural-social" && sourceInventory
        ? { naturalSocialSourceInventory: sourceInventory as NaturalSocialLessonBlueprint["sourceInventory"] }
        : {}),
      ...(continuityPlan ? { continuityPlan: continuityPlan as LessonPlan["meta"]["continuityPlan"] } : {}),
    },
  };

  return {
    subjectKind: blueprintArtifact.subjectKind,
    periodCount: periods.length,
    repairApplied,
    models,
    providers,
    fallbackUsed: blueprintArtifact.fallbackUsed || periodArtifacts.some((artifact) => artifact.fallbackUsed),
    lesson,
  };
}
