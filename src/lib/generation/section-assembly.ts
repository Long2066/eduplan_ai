import "server-only";
import type { StagedAssemblyArtifact } from "@/lib/generation/assembly";
import type { StagedBlueprintArtifact } from "@/lib/generation/blueprint";
import type { StagedPeriodArtifact } from "@/lib/generation/period-generation";
import { assertStagedSections } from "@/lib/generation/section-validation";
import {
  STAGED_PHASES,
  STAGED_PHASE_LABELS,
  type AssembleStagedSectionsOptions,
  type StagedCompactPeriodBlueprint,
  type StagedPeriodBlueprintArtifact,
  type StagedPhaseArtifact,
  type StagedPhaseName,
  type StagedSectionsAssembly,
} from "@/lib/generation/section-types";
import { requireResolvedLessonTitle, resolveLessonTitle } from "@/lib/lesson-title";
import { ensureNonEmptyOutcomes, sanitizeMaterials } from "@/lib/lesson-format";
import { sanitizeNaturalSocialSourceInventoryForLesson } from "@/lib/natural-social-source-inventory";
import { bookContext } from "@/lib/subject-prompts";
import { attachHandwritingVisualsToActivities } from "@/lib/vietnamese-handwriting";
import { attachSgkCropsToActivities } from "@/lib/generation/sgk-crop";
import { ensureLessonDigitalCompetencies } from "@/lib/digital-competency";
import { normalizeMathContentDeep } from "@/lib/math-content";
import { balanceAndNormalizePhaseActivity } from "@/lib/generation/phase-generation";
import type {
  LessonActivity,
  LessonInput,
  LessonOutcomeCategory,
  LessonOutcomeMetadata,
  LessonOutcomes,
  LessonPlan,
  MathActivityBlueprint,
  MathLessonBlueprint,
  MathPeriodBlueprint,
  NaturalSocialActivityBlueprint,
  NaturalSocialLessonBlueprint,
  NaturalSocialPeriodBlueprint,
  PeriodPlan,
  VietnameseActivityBlueprint,
  VietnameseLessonBlueprint,
  VietnameseLessonType,
  VietnamesePeriodBlueprint,
} from "@/types/lesson";

const ADJUSTMENT_PLACEHOLDER =
  "........................................................................................................................................";

function positiveInteger(value: unknown, fallback = 1): number {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue >= 1
    ? Math.floor(numericValue)
    : fallback;
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const val of values) {
    const trimmed = (val || "").trim();
    if (!trimmed) continue;
    const key = trimmed.toLocaleLowerCase("vi").replace(/\s+/g, " ");
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }
  return result;
}

function uniqueValues<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

function sanitizeStigmatizingLabelsDeep<T>(value: T): T {
  if (typeof value === "string") {
    return value
      .replace(/\bhọc sinh yếu\b/gi, "học sinh cần hỗ trợ")
      .replace(/\bHS yếu\b/g, "HS cần hỗ trợ")
      .replace(/\bhs yếu\b/gi, "HS cần hỗ trợ")
      .replace(/gv tổ chức hoạt động bám ngữ liệu và trọng tâm/gi, "GV dẫn dắt và nêu yêu cầu trọng tâm của hoạt động")
      .replace(/gv giao nhiệm vụ cụ thể/gi, "GV nêu câu hỏi gợi mở và hướng dẫn các bước thực hiện")
      .replace(/hs quan sát,?\s*đọc,?\s*nghe ngữ liệu/gi, "HS chú ý quan sát hình ảnh/ngữ liệu và xác định thông tin chính")
      .replace(/hs thực hiện nhiệm vụ và tạo sản phẩm/gi, "HS trao đổi cùng bạn, hoàn thành yêu cầu học tập và ghi kết quả")
      .replace(/gv hỗ trợ học sinh theo lỗi thường gặp/gi, "GV quan sát, gợi mở và hướng dẫn HS tự đối chiếu, điều chỉnh")
      .replace(/hs thực hiện nhiệm vụ theo hướng dẫn/gi, "HS suy nghĩ, trao đổi và hoàn thành yêu cầu học tập cụ thể")
      .replace(/hs thực hiện nhiệm vụ tương ứng/gi, "HS tích cực tham gia trả lời câu hỏi và thực hiện thao tác học tập")
      .replace(/hs phản hồi theo hướng dẫn/gi, "HS trình bày câu trả lời trước lớp và nhận xét bài làm của bạn") as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeStigmatizingLabelsDeep(item)) as T;
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, sanitizeStigmatizingLabelsDeep(v)]),
    ) as T;
  }
  return value;
}

function cloneOutcomes(outcomes: LessonOutcomes): LessonOutcomes {
  return {
    generalCompetencies: [...(outcomes.generalCompetencies || [])],
    specificCompetencies: [...(outcomes.specificCompetencies || [])],
    qualities: [...(outcomes.qualities || [])],
    knowledgeAndSkills: [...(outcomes.knowledgeAndSkills || [])],
    ...(outcomes.digitalCompetencies ? { digitalCompetencies: [...outcomes.digitalCompetencies] } : {}),
    ...(outcomes.objectiveMetadata
      ? {
          objectiveMetadata: outcomes.objectiveMetadata.map((meta) => ({
            ...meta,
            evidence: {
              activityIds: [...(meta.evidence?.activityIds || [])],
              learningProducts: [...(meta.evidence?.learningProducts || [])],
              successCriteria: [...(meta.evidence?.successCriteria || [])],
            },
          })),
        }
      : {}),
  };
}

function buildPeriodOutcomes(
  lockedOutcomes: LessonOutcomes,
  periodBlueprint: StagedPeriodBlueprintArtifact,
): LessonOutcomes {
  const targetIds = new Set(periodBlueprint.periodBlueprint.objectiveIds);
  const metadataList = (lockedOutcomes.objectiveMetadata || []).filter((meta) =>
    targetIds.has(meta.id),
  );

  const byCategory: Record<LessonOutcomeCategory, string[]> = {
    generalCompetencies: [],
    specificCompetencies: [],
    qualities: [],
    knowledgeAndSkills: [],
    digitalCompetencies: [],
  };

  for (const meta of metadataList) {
    const category = meta.category;
    if (byCategory[category]) {
      byCategory[category].push(meta.statement);
    }
  }

  const knowledgeAndSkills = byCategory.knowledgeAndSkills.length
    ? uniqueStrings(byCategory.knowledgeAndSkills)
    : periodBlueprint.periodBlueprint.targetKnowledge
      ? [periodBlueprint.periodBlueprint.targetKnowledge]
      : lockedOutcomes.knowledgeAndSkills;

  const generalCompetencies = byCategory.generalCompetencies.length
    ? uniqueStrings(byCategory.generalCompetencies)
    : lockedOutcomes.generalCompetencies;

  const specificCompetencies = byCategory.specificCompetencies.length
    ? uniqueStrings(byCategory.specificCompetencies)
    : lockedOutcomes.specificCompetencies;

  const qualities = byCategory.qualities.length
    ? uniqueStrings(byCategory.qualities)
    : lockedOutcomes.qualities;

  const digitalCompetencies = byCategory.digitalCompetencies.length
    ? uniqueStrings(byCategory.digitalCompetencies)
    : (lockedOutcomes.digitalCompetencies || []);

  const rawPeriodOutcomes: LessonOutcomes = {
    generalCompetencies: uniqueStrings(generalCompetencies || []),
    specificCompetencies: uniqueStrings(specificCompetencies || []),
    qualities: uniqueStrings(qualities || []),
    knowledgeAndSkills: uniqueStrings(knowledgeAndSkills || []),
    ...(digitalCompetencies.length
      ? { digitalCompetencies: uniqueStrings(digitalCompetencies) }
      : {}),
    ...(metadataList.length
      ? {
          objectiveMetadata: metadataList.map((meta) => ({
            ...meta,
            evidence: {
              activityIds: [...(meta.evidence?.activityIds || [])],
              learningProducts: [...(meta.evidence?.learningProducts || [])],
              successCriteria: [...(meta.evidence?.successCriteria || [])],
            },
          })),
        }
      : {}),
  };

  return ensureNonEmptyOutcomes(rawPeriodOutcomes, periodBlueprint.periodBlueprint.focus);
}

function buildMathActivityBlueprints(
  phases: StagedPhaseArtifact[],
): MathActivityBlueprint[] {
  return phases.map((phaseArt) => ({
    phase: STAGED_PHASE_LABELS[phaseArt.phase] || phaseArt.phase,
    title: phaseArt.activity.title || "",
    objective: phaseArt.activity.objective || "",
    durationMinutes: phaseArt.activity.durationMinutes,
    mathFocus: phaseArt.activity.title || "",
    handoffToNext: phaseArt.handoff?.bridge || "",
    sourceUnitIds: phaseArt.activity.sourceUnitIds?.length ? phaseArt.activity.sourceUnitIds : (phaseArt.sourceIds || []),
    sourceClusterIds: phaseArt.activity.sourceClusterIds || [],
  }));
}

function buildVietnameseActivityBlueprints(
  phases: StagedPhaseArtifact[],
): VietnameseActivityBlueprint[] {
  return phases.map((phaseArt) => ({
    phase: STAGED_PHASE_LABELS[phaseArt.phase] || phaseArt.phase,
    title: phaseArt.activity.title || "",
    objective: phaseArt.activity.objective || "",
    durationMinutes: phaseArt.activity.durationMinutes,
    focusSkills: phaseArt.handoff?.knowledge || [],
    handoffToNext: phaseArt.handoff?.bridge || "",
    sourceUnitIds: phaseArt.activity.sourceUnitIds?.length ? phaseArt.activity.sourceUnitIds : (phaseArt.sourceIds || []),
    sourceClusterIds: phaseArt.activity.sourceClusterIds || [],
  }));
}

function buildNaturalSocialActivityBlueprints(
  phases: StagedPhaseArtifact[],
): NaturalSocialActivityBlueprint[] {
  return phases.map((phaseArt) => ({
    id: phaseArt.activity.id,
    phase: STAGED_PHASE_LABELS[phaseArt.phase] || phaseArt.phase,
    title: phaseArt.activity.title || "",
    objective: phaseArt.activity.objective || "",
    durationMinutes: phaseArt.activity.durationMinutes,
    inquiryFocus: phaseArt.activity.title || "",
    product: phaseArt.handoff?.products?.join("; ") || "",
    handoffToNext: phaseArt.handoff?.bridge || "",
    objectiveIds: phaseArt.activity.objectiveIds || [],
    sourceTaskIds: phaseArt.activity.sourceTaskIds?.length ? phaseArt.activity.sourceTaskIds : (phaseArt.sourceIds || []),
    sourceUnitIds: phaseArt.activity.sourceUnitIds?.length ? phaseArt.activity.sourceUnitIds : (phaseArt.sourceIds || []),
    sourceClusterIds: phaseArt.activity.sourceClusterIds || [],
  }));
}

function buildSubjectPeriodBlueprints(
  subjectKind: StagedBlueprintArtifact["subjectKind"],
  periodBlueprints: StagedPeriodBlueprintArtifact[],
  phasesByPeriod: Map<number, StagedPhaseArtifact[]>,
): MathPeriodBlueprint[] | VietnamesePeriodBlueprint[] | NaturalSocialPeriodBlueprint[] {
  if (subjectKind === "math") {
    return periodBlueprints.map((bpArt): MathPeriodBlueprint => {
      const bp = bpArt.periodBlueprint;
      const phases = phasesByPeriod.get(bpArt.periodNumber) || [];
      return {
        periodNumber: bpArt.periodNumber,
        focus: bp.focus,
        objectives: [...bp.objectiveIds],
        targetKnowledge: bp.targetKnowledge,
        continuityIn: bp.continuityIn,
        continuityOut: bp.continuityOut,
        activities: buildMathActivityBlueprints(phases),
      };
    });
  }

  if (subjectKind === "vietnamese") {
    return periodBlueprints.map((bpArt): VietnamesePeriodBlueprint => {
      const bp = bpArt.periodBlueprint;
      const phases = phasesByPeriod.get(bpArt.periodNumber) || [];
      const lessonType = (bp.lessonType || "mixed") as VietnameseLessonType;
      return {
        periodNumber: bpArt.periodNumber,
        focus: bp.focus,
        lessonType,
        objectives: [...bp.objectiveIds],
        targetSkills: bp.targetKnowledge ? [bp.targetKnowledge] : [],
        continuityIn: bp.continuityIn,
        continuityOut: bp.continuityOut,
        activities: buildVietnameseActivityBlueprints(phases),
      };
    });
  }

  if (subjectKind === "natural-social") {
    return periodBlueprints.map((bpArt): NaturalSocialPeriodBlueprint => {
      const bp = bpArt.periodBlueprint;
      const phases = phasesByPeriod.get(bpArt.periodNumber) || [];
      return {
        periodNumber: bpArt.periodNumber,
        focus: bp.focus,
        objectives: [...bp.objectiveIds],
        continuityIn: bp.continuityIn,
        continuityOut: bp.continuityOut,
        activities: buildNaturalSocialActivityBlueprints(phases),
      };
    });
  }

  return periodBlueprints.map((bpArt) => {
    const bp = bpArt.periodBlueprint;
    const phases = phasesByPeriod.get(bpArt.periodNumber) || [];
    return {
      periodNumber: bpArt.periodNumber,
      focus: bp.focus,
      objectives: [...bp.objectiveIds],
      targetKnowledge: bp.targetKnowledge,
      continuityIn: bp.continuityIn,
      continuityOut: bp.continuityOut,
      activities: buildMathActivityBlueprints(phases),
    };
  });
}

function buildCompactBlueprint(
  subjectKind: StagedBlueprintArtifact["subjectKind"],
  lessonTitle: string,
  options: AssembleStagedSectionsOptions,
  phasesByPeriod: Map<number, StagedPhaseArtifact[]>,
): MathLessonBlueprint | VietnameseLessonBlueprint | NaturalSocialLessonBlueprint {
  const { outcomes, materials, assessment, lessonMap, periodBlueprints } = options;
  const periods = buildSubjectPeriodBlueprints(subjectKind, periodBlueprints, phasesByPeriod);

  const baseBlueprint = {
    lessonTitle,
    lessonOverview: lessonMap.lessonMap.lessonOverview,
    outcomes: cloneOutcomes(outcomes.outcomes),
    materials: sanitizeMaterials(materials.materials),
    assessment: {
      criteria: [...assessment.assessment.criteria],
      evidence: [...assessment.assessment.evidence],
      comments: [...assessment.assessment.comments],
    },
    contextFit: {
      notes: uniqueStrings([
        ...lessonMap.lessonMap.logicSpine,
        ...periodBlueprints.flatMap((p) => p.periodBlueprint.teachingNotes || []),
      ]),
    },
    continuityPlan: lessonMap.lessonMap.continuityPlan
      ? structuredClone(lessonMap.lessonMap.continuityPlan)
      : undefined,
  };

  if (subjectKind === "math") {
    return {
      ...baseBlueprint,
      periods: periods as MathPeriodBlueprint[],
    } as MathLessonBlueprint;
  }

  if (subjectKind === "vietnamese") {
    return {
      ...baseBlueprint,
      classification: options.sourceFacts.classification,
      sourceInventory: options.sourceFacts.sourceInventory,
      periods: periods as VietnamesePeriodBlueprint[],
    } as VietnameseLessonBlueprint;
  }

  if (subjectKind === "natural-social") {
    return {
      ...baseBlueprint,
      classification: options.sourceFacts.classification,
      sourceInventory: options.sourceFacts.sourceInventory,
      periods: periods as NaturalSocialPeriodBlueprint[],
    } as NaturalSocialLessonBlueprint;
  }

  return {
    ...baseBlueprint,
    periods,
  } as MathLessonBlueprint;
}

function populateOutcomeEvidence(
  outcomes: LessonOutcomes | undefined,
  activities: LessonActivity[],
): LessonOutcomes | undefined {
  if (!outcomes?.objectiveMetadata?.length || !activities.length) return outcomes;
  const fallbackAct = activities[Math.min(1, activities.length - 1)] || activities[0]!;
  return {
    ...outcomes,
    objectiveMetadata: outcomes.objectiveMetadata.map((meta) => {
      const matchedActs = activities.filter(
        (act) => Array.isArray(act.objectiveIds) && act.objectiveIds.includes(meta.id),
      );
      const effectiveActs = matchedActs.length > 0 ? matchedActs : [fallbackAct];
      const activityIds = uniqueStrings([
        ...(meta.evidence?.activityIds || []),
        ...effectiveActs.map((act) => act.id || "").filter(Boolean),
      ]);
      const learningProducts = uniqueStrings([
        ...(meta.evidence?.learningProducts || []),
        ...effectiveActs.flatMap((act) => act.learningProducts || []),
      ]);
      const successCriteria = uniqueStrings([
        ...(meta.evidence?.successCriteria || []),
        ...effectiveActs.flatMap((act) => act.successCriteria || []),
      ]);
      return {
        ...meta,
        evidence: {
          activityIds: activityIds.length ? activityIds : [fallbackAct.id || "p1-explore"],
          learningProducts: learningProducts.length ? learningProducts : ["Sản phẩm học tập của học sinh"],
          successCriteria: successCriteria.length ? successCriteria : ["Hoàn thành đúng yêu cầu học tập"],
        },
      };
    }),
  };
}

function normalizePeriodActivityDurations(
  activities: LessonActivity[],
  expectedDuration: number,
): LessonActivity[] {
  if (!activities.length) return activities;
  const target = Math.max(20, Number(expectedDuration) || 35);
  const currentTotal = activities.reduce((sum, act) => sum + (Number(act.durationMinutes) || 0), 0);
  if (currentTotal === target) return activities;
  const cloned = activities.map((act, idx) => ({
    ...act,
    durationMinutes: Number(act.durationMinutes) > 0
      ? Math.round(Number(act.durationMinutes))
      : idx === 1 ? 13 : idx === 2 ? 12 : 5,
  }));
  let delta = target - cloned.reduce((sum, act) => sum + act.durationMinutes, 0);
  const order = [2, 1, 3, 0].filter((i) => i < cloned.length);
  for (const idx of order) {
    if (delta === 0) break;
    const minAllowed = idx === 1 || idx === 2 ? 6 : 3;
    const act = cloned[idx]!;
    const nextVal = Math.max(minAllowed, act.durationMinutes + delta);
    delta -= (nextVal - act.durationMinutes);
    act.durationMinutes = nextVal;
    if (act.timeBreakdown) {
      delete act.timeBreakdown;
    }
  }
  return cloned;
}

export async function assembleStagedSections(
  options: AssembleStagedSectionsOptions,
): Promise<StagedSectionsAssembly> {
  // 1. Enforce strict staged-v2 invariant assertion
  assertStagedSections(options);

  const {
    input,
    plan,
    repairApplied = false,
    sourceFacts,
    outcomes,
    materials,
    assessment,
    lessonMap,
    periodBlueprints,
    phases,
  } = options;

  const subjectKind = sourceFacts.subjectKind;
  const expectedPeriods = positiveInteger(input.periods, 1);

  // 2. Resolve final lesson title preserving sourceTruth confidence hierarchy
  const title = requireResolvedLessonTitle(
    resolveLessonTitle({
      subject: input.subject,
      candidates: [
        {
          value: sourceFacts.sourceTruth?.lessonTitle,
          source: "source-truth",
          confidence: sourceFacts.sourceTruth?.lessonIdentity?.confidence || 0.95,
        },
        { value: input.lessonTitle, source: "user-input", confidence: 0.95 },
        { value: sourceFacts.facts.lessonTitle, source: "source-facts", confidence: 0.9 },
        { value: lessonMap.lessonMap.lessonTitle, source: "lesson-map", confidence: 0.85 },
      ],
    }),
  );

  // 3. Collect ordered period blueprints
  const orderedPeriodBlueprints = [...periodBlueprints].sort(
    (a, b) => a.periodNumber - b.periodNumber,
  );

  // 4. Group and sort phases by period and canonical phase sequence
  const phaseRank: Record<StagedPhaseName, number> = {
    warmup: 0,
    explore: 1,
    practice: 2,
    apply: 3,
  };

  const phasesByPeriod = new Map<number, StagedPhaseArtifact[]>();
  for (let p = 1; p <= expectedPeriods; p++) {
    const periodPhases = phases
      .filter((art) => art.periodNumber === p)
      .sort((a, b) => (phaseRank[a.phase] ?? 99) - (phaseRank[b.phase] ?? 99));

    phasesByPeriod.set(p, periodPhases);
  }

  // 5. Build PeriodPlan and StagedPeriodArtifact for each period
  const periodPlans: PeriodPlan[] = [];
  const periodArtifacts: StagedPeriodArtifact[] = [];

  for (let pNum = 1; pNum <= expectedPeriods; pNum++) {
    const pBpArt = orderedPeriodBlueprints.find((bp) => bp.periodNumber === pNum)!;
    const periodPhases = phasesByPeriod.get(pNum) || [];
    const activities: LessonActivity[] = periodPhases.map((art) => {
      const cloned = balanceAndNormalizePhaseActivity(
        { ...art.activity },
        art.phase,
        subjectKind,
      );
      if (!cloned.phase || cloned.phase === art.phase) {
        cloned.phase = STAGED_PHASE_LABELS[art.phase] || art.phase;
      }
      if ((!cloned.sourceUnitIds || cloned.sourceUnitIds.length === 0) && art.sourceIds?.length) {
        cloned.sourceUnitIds = [...art.sourceIds];
      }
      return cloned;
    });

    const hasSgkImages = (input.uploadedAssets || []).some(
      (a) =>
        a.type === "image" &&
        ((a.dataUrl && a.dataUrl.startsWith("data:image/")) ||
          Boolean(a.taphuanBookKey || a.taphuanPage || (a.name && /trang|page/i.test(a.name)))),
    );

    let processedActivities = activities;
    const gradeNum = parseInt(String(input.grade || "").replace(/\D/g, ""), 10) || 1;
    const resolvedSubject = input.subject || "";

    if (hasSgkImages) {
      processedActivities = await attachSgkCropsToActivities(
        activities,
        input.uploadedAssets,
        {
          subject: resolvedSubject,
          grade: gradeNum,
          lessonType: pBpArt.periodBlueprint.lessonType,
          periodNumber: pBpArt.periodNumber,
        },
      );
    } else if (subjectKind === "vietnamese") {
      processedActivities = attachHandwritingVisualsToActivities(
        activities,
        title,
        pBpArt.periodBlueprint.focus,
        { embedBase64: true },
      );
    }

    // Normalize period activity durations to exact input.duration (default 35 min)
    const targetDuration = positiveInteger(input.duration, 35);
    let normalizedPeriodActivities = normalizePeriodActivityDurations(processedActivities, targetDuration);

    // Ensure continuityPlan clusters & units assigned to this period are referenced by period activities
    const periodClusters = (lessonMap.lessonMap.continuityPlan?.clusters || []).filter(
      (c) => (c.periodNumber || 1) === pNum,
    );
    const periodUnits = (lessonMap.lessonMap.continuityPlan?.sourceUnits || []).filter(
      (u) => (u.preferredPeriodNumber || 1) === pNum,
    );
    if (normalizedPeriodActivities.length > 0) {
      const targetAct = normalizedPeriodActivities[Math.min(1, normalizedPeriodActivities.length - 1)]!;
      const usedClusters = new Set(normalizedPeriodActivities.flatMap((a) => a.sourceClusterIds || []));
      const missingClusters = periodClusters.map((c) => c.clusterId).filter((id) => id && !usedClusters.has(id));
      if (missingClusters.length > 0) {
        targetAct.sourceClusterIds = uniqueStrings([...(targetAct.sourceClusterIds || []), ...missingClusters]);
      }
      const usedUnits = new Set(normalizedPeriodActivities.flatMap((a) => a.sourceUnitIds || []));
      const missingUnits = uniqueStrings([
        ...periodUnits.map((u) => u.unitId),
        ...periodClusters.flatMap((c) => c.sourceUnitIds || []),
      ]).filter((id) => id && !usedUnits.has(id));
      if (missingUnits.length > 0) {
        targetAct.sourceUnitIds = uniqueStrings([...(targetAct.sourceUnitIds || []), ...missingUnits]);
      }
    }

    const lastPhase = periodPhases[periodPhases.length - 1];
    const handoffLearned = lastPhase?.handoff?.knowledge?.length
      ? lastPhase.handoff.knowledge.join("; ")
      : pBpArt.periodBlueprint.targetKnowledge || `Hoàn thành nội dung trọng tâm Tiết ${pNum}`;

    const handoff = {
      learned: handoffLearned || `Hoàn thành nội dung trọng tâm Tiết ${pNum}`,
      unresolvedRisks: [...(lastPhase?.handoff?.pending || [])],
      nextBridge: lastPhase?.handoff?.bridge || pBpArt.periodBlueprint.continuityOut || `Chuyển tiếp sang hoạt động tiếp theo sau Tiết ${pNum}`,
    };

    const periodOutcomes = populateOutcomeEvidence(
      buildPeriodOutcomes(outcomes.outcomes, pBpArt),
      normalizedPeriodActivities,
    )!;

    const periodPlan: PeriodPlan = {
      periodNumber: pNum,
      focus: pBpArt.periodBlueprint.focus,
      outcomes: periodOutcomes,
      activities: normalizedPeriodActivities,
      handoff,
    };
    periodPlans.push(periodPlan);

    const periodModels = periodPhases.map((ph) => ph.model).filter(Boolean);
    const periodProviders = periodPhases.map((ph) => ph.provider).filter(Boolean);
    const periodFallbackUsed = periodPhases.some((ph) => ph.fallbackUsed) || pBpArt.fallbackUsed;

    periodArtifacts.push({
      subjectKind,
      periodNumber: pNum,
      model: periodModels[periodModels.length - 1] || pBpArt.model || "unknown",
      provider: periodProviders[periodProviders.length - 1] || pBpArt.provider || "openai",
      fallbackUsed: periodFallbackUsed,
      period: periodPlan,
      handoff,
    });
  }

  // 6. Aggregate models and providers across all section artifacts
  const allSectionArtifacts = [
    sourceFacts,
    outcomes,
    lessonMap,
    ...periodBlueprints,
    materials,
    ...phases,
    assessment,
  ];

  const models = uniqueStrings(
    allSectionArtifacts.map((art) => art.model).filter((m): m is string => Boolean(m)),
  );

  const providers = uniqueValues(
    allSectionArtifacts
      .map((art) => art.provider)
      .filter((p): p is "openai" | "openrouter" => Boolean(p)),
  );

  const fallbackUsed = allSectionArtifacts.some((art) => art.fallbackUsed);
  const modelUsed = models[models.length - 1] || "unknown";

  // 7. Sanitize/prepare source inventory and continuity plan
  const sourceInventory =
    subjectKind === "natural-social"
      ? sanitizeNaturalSocialSourceInventoryForLesson(
          input,
          sourceFacts.sourceInventory,
          sourceFacts.classification as any,
        )
      : sourceFacts.sourceInventory;

  const continuityPlan = lessonMap.lessonMap.continuityPlan
    ? structuredClone(lessonMap.lessonMap.continuityPlan)
    : undefined;
  if (continuityPlan) {
    if (Array.isArray(continuityPlan.sourceUnits)) {
      continuityPlan.sourceUnits = continuityPlan.sourceUnits.map((u) => ({
        ...u,
        allowReuse: u.allowReuse === true || expectedPeriods > 1,
      }));
    }
    if (Array.isArray(continuityPlan.clusters)) {
      continuityPlan.clusters = continuityPlan.clusters.map((c) => {
        const pNum = Math.min(expectedPeriods, Math.max(1, Number(c.periodNumber) || 1));
        const usedInPeriods = new Set<number>();
        periodPlans.forEach((pp) => {
          const hasCluster = (pp.activities || []).some((a) => (a.sourceClusterIds || []).includes(c.clusterId));
          if (hasCluster) usedInPeriods.add(pp.periodNumber);
        });
        return {
          ...c,
          periodNumber: usedInPeriods.size === 1 ? [...usedInPeriods][0] : pNum,
          mustStayTogether: usedInPeriods.size > 1 ? false : c.mustStayTogether,
          estimatedMinutes: Math.min(15, Number(c.estimatedMinutes) || 12),
        };
      });
    }
  }

  // 8. Assemble full LessonPlan conforming to schema
  const allPeriodActivities = periodPlans.flatMap((period) => period.activities);
  const topOutcomes = populateOutcomeEvidence(
    ensureNonEmptyOutcomes(cloneOutcomes(outcomes.outcomes), title),
    allPeriodActivities,
  )!;
  const lesson: LessonPlan = {
    generalInfo: {
      subject: input.subject,
      grade: input.grade,
      lessonTitle: title,
      book: bookContext(input),
      periods: expectedPeriods,
      duration: positiveInteger(input.duration, 35),
    },
    outcomes: topOutcomes,
    materials: sanitizeMaterials(materials.materials),
    activities: allPeriodActivities,
    periodPlans,
    assessment: {
      criteria: [...assessment.assessment.criteria],
      evidence: [...assessment.assessment.evidence],
      comments: [...assessment.assessment.comments],
    },
    adjustments: {
      suitablePoints: [ADJUSTMENT_PLACEHOLDER],
      pointsToAdjust: [ADJUSTMENT_PLACEHOLDER],
      nextLessonDirection: [ADJUSTMENT_PLACEHOLDER],
    },
    contextFit: {
      notes: uniqueStrings([
        ...lessonMap.lessonMap.logicSpine,
        ...periodBlueprints.flatMap((p) => p.periodBlueprint.teachingNotes || []),
        ...periodPlans
          .map((p) => {
            const bridge = p.handoff?.nextBridge || p.handoff?.learned;
            return bridge ? `Tiết ${p.periodNumber}: ${bridge}` : "";
          })
          .filter(Boolean),
      ]),
    },
    meta: {
      style: input.style,
      modelUsed,
      createdAt: new Date().toISOString(),
      plan,
      ...(subjectKind === "vietnamese" && sourceInventory
        ? { vietnameseSourceInventory: sourceInventory as VietnameseLessonBlueprint["sourceInventory"] }
        : {}),
      ...(subjectKind === "natural-social" && sourceInventory
        ? { naturalSocialSourceInventory: sourceInventory as NaturalSocialLessonBlueprint["sourceInventory"] }
        : {}),
      ...(continuityPlan ? { continuityPlan: continuityPlan as LessonPlan["meta"]["continuityPlan"] } : {}),
    },
  };

  // 9. Enrich with digital competencies if enabled and sanitize stigmatizing labels
  const digitalEnriched = sanitizeStigmatizingLabelsDeep(ensureLessonDigitalCompetencies(input, lesson));
  const phaseNames: StagedPhaseName[] = ["warmup", "explore", "practice", "apply"];
  if (Array.isArray(digitalEnriched.periodPlans) && digitalEnriched.periodPlans.length > 0) {
    const targetDuration = positiveInteger(input.duration, 35);
    digitalEnriched.periodPlans = digitalEnriched.periodPlans.map((pp) => {
      const normalizedActs = normalizePeriodActivityDurations(
        (pp.activities || []).map((act, idx) =>
          balanceAndNormalizePhaseActivity(act, phaseNames[idx] || "practice", subjectKind),
        ),
        targetDuration,
      );
      return {
        ...pp,
        outcomes: populateOutcomeEvidence(pp.outcomes, normalizedActs) || pp.outcomes,
        activities: normalizedActs,
      };
    });
    digitalEnriched.activities = digitalEnriched.periodPlans.flatMap((pp) => pp.activities);
    digitalEnriched.outcomes = populateOutcomeEvidence(digitalEnriched.outcomes, digitalEnriched.activities) || digitalEnriched.outcomes;
  } else if (Array.isArray(digitalEnriched.activities)) {
    digitalEnriched.activities = digitalEnriched.activities.map((act, idx) =>
      balanceAndNormalizePhaseActivity(act, phaseNames[idx % 4] || "practice", subjectKind),
    );
  }
  const finalLesson = subjectKind === "math"
    ? normalizeMathContentDeep(digitalEnriched)
    : digitalEnriched;

  const syncedPeriodArtifacts = periodArtifacts.map((art, index) => ({
    ...art,
    period: finalLesson.periodPlans?.[index] || art.period,
  }));

  // 10. Build compact Blueprint artifact
  const compactBlueprint = buildCompactBlueprint(
    subjectKind,
    title,
    options,
    phasesByPeriod,
  );

  const blueprintArtifact: StagedBlueprintArtifact = {
    subjectKind,
    mode: "chunked",
    model: sourceFacts.model,
    provider: sourceFacts.provider,
    fallbackUsed: sourceFacts.fallbackUsed || lessonMap.fallbackUsed,
    promptSource: sourceFacts.promptSource,
    sourceTruth: sourceFacts.sourceTruth,
    classification: sourceFacts.classification,
    sourceInventory,
    sourceFacts: sourceFacts.facts as unknown as Record<string, unknown>,
    lessonMap: lessonMap.lessonMap as unknown as Record<string, unknown>,
    blueprint: compactBlueprint,
  };

  // 11. Build StagedAssemblyArtifact
  const assemblyArtifact: StagedAssemblyArtifact = {
    subjectKind,
    periodCount: expectedPeriods,
    repairApplied,
    models,
    providers,
    fallbackUsed,
    lesson: finalLesson,
  };

  return {
    assembly: assemblyArtifact,
    blueprint: blueprintArtifact,
    periods: syncedPeriodArtifacts,
  };
}
