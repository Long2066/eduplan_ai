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
import { sanitizeNaturalSocialSourceInventoryForLesson } from "@/lib/natural-social-source-inventory";
import { bookContext } from "@/lib/subject-prompts";
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

function cloneOutcomes(outcomes: LessonOutcomes): LessonOutcomes {
  return {
    generalCompetencies: [...outcomes.generalCompetencies],
    specificCompetencies: [...outcomes.specificCompetencies],
    qualities: [...outcomes.qualities],
    knowledgeAndSkills: [...outcomes.knowledgeAndSkills],
    ...(outcomes.digitalCompetencies ? { digitalCompetencies: [...outcomes.digitalCompetencies] } : {}),
    ...(outcomes.objectiveMetadata
      ? {
          objectiveMetadata: outcomes.objectiveMetadata.map((meta) => ({
            ...meta,
            evidence: {
              activityIds: [...meta.evidence.activityIds],
              learningProducts: [...meta.evidence.learningProducts],
              successCriteria: [...meta.evidence.successCriteria],
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
      : [];

  return {
    generalCompetencies: uniqueStrings(byCategory.generalCompetencies),
    specificCompetencies: uniqueStrings(byCategory.specificCompetencies),
    qualities: uniqueStrings(byCategory.qualities),
    knowledgeAndSkills,
    ...(byCategory.digitalCompetencies.length
      ? { digitalCompetencies: uniqueStrings(byCategory.digitalCompetencies) }
      : {}),
    ...(metadataList.length
      ? {
          objectiveMetadata: metadataList.map((meta) => ({
            ...meta,
            evidence: {
              activityIds: [...meta.evidence.activityIds],
              learningProducts: [...meta.evidence.learningProducts],
              successCriteria: [...meta.evidence.successCriteria],
            },
          })),
        }
      : {}),
  };
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
    sourceTaskIds: phaseArt.sourceIds || [],
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
    materials: {
      teacher: [...materials.materials.teacher],
      students: [...materials.materials.students],
    },
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
    continuityPlan: lessonMap.lessonMap.continuityPlan,
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

export function assembleStagedSections(
  options: AssembleStagedSectionsOptions,
): StagedSectionsAssembly {
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

    for (const phaseArt of periodPhases) {
      if (!phaseArt.activity.phase || phaseArt.activity.phase === phaseArt.phase) {
        phaseArt.activity.phase = STAGED_PHASE_LABELS[phaseArt.phase] || phaseArt.phase;
      }
    }
    phasesByPeriod.set(p, periodPhases);
  }

  // 5. Build PeriodPlan and StagedPeriodArtifact for each period
  const periodPlans: PeriodPlan[] = [];
  const periodArtifacts: StagedPeriodArtifact[] = [];

  for (let pNum = 1; pNum <= expectedPeriods; pNum++) {
    const pBpArt = orderedPeriodBlueprints.find((bp) => bp.periodNumber === pNum)!;
    const periodPhases = phasesByPeriod.get(pNum) || [];
    const activities: LessonActivity[] = periodPhases.map((art) => art.activity);

    const lastPhase = periodPhases[periodPhases.length - 1];
    const handoffLearned = lastPhase?.handoff?.knowledge?.length
      ? lastPhase.handoff.knowledge.join("; ")
      : pBpArt.periodBlueprint.targetKnowledge || "";

    const handoff = {
      learned: handoffLearned,
      unresolvedRisks: [...(lastPhase?.handoff?.pending || [])],
      nextBridge: lastPhase?.handoff?.bridge || pBpArt.periodBlueprint.continuityOut || "",
    };

    const periodOutcomes = buildPeriodOutcomes(outcomes.outcomes, pBpArt);

    const periodPlan: PeriodPlan = {
      periodNumber: pNum,
      focus: pBpArt.periodBlueprint.focus,
      outcomes: periodOutcomes,
      activities,
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

  const continuityPlan = lessonMap.lessonMap.continuityPlan;

  // 8. Assemble full LessonPlan conforming to schema
  const lesson: LessonPlan = {
    generalInfo: {
      subject: input.subject,
      grade: input.grade,
      lessonTitle: title,
      book: bookContext(input),
      periods: expectedPeriods,
      duration: positiveInteger(input.duration, 35),
    },
    outcomes: cloneOutcomes(outcomes.outcomes),
    materials: {
      teacher: [...materials.materials.teacher],
      students: [...materials.materials.students],
    },
    activities: periodPlans.flatMap((period) => period.activities),
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

  // 9. Build compact Blueprint artifact
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

  // 10. Build StagedAssemblyArtifact
  const assemblyArtifact: StagedAssemblyArtifact = {
    subjectKind,
    periodCount: expectedPeriods,
    repairApplied,
    models,
    providers,
    fallbackUsed,
    lesson,
  };

  return {
    assembly: assemblyArtifact,
    blueprint: blueprintArtifact,
    periods: periodArtifacts,
  };
}
