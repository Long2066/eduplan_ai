import type { StagedAssemblyArtifact } from "@/lib/generation/assembly";
import type { StagedBlueprintArtifact } from "@/lib/generation/blueprint";
import type { StagedPeriodArtifact } from "@/lib/generation/period-generation";
import type { StagedSourceContext } from "@/lib/generation/source-preparation";
import type { SourceTruth } from "@/lib/generation/source-truth";
import type { AiGenerationResult, PlanModelStrategy, SubscriptionPlan } from "@/lib/model-strategy";
import type {
  LessonActivity, LessonContinuityPlan, LessonInput, LessonOutcomes, LessonPlan,
  NaturalSocialClassification, NaturalSocialSourceInventory,
  VietnameseLessonClassification, VietnameseSourceInventory,
} from "@/types/lesson";

export const STAGED_PHASES = ["warmup", "explore", "practice", "apply"] as const;
export type StagedPhaseName = typeof STAGED_PHASES[number];
export const STAGED_PHASE_LABELS: Record<StagedPhaseName, string> = {
  warmup: "Khởi động", explore: "Khám phá", practice: "Luyện tập", apply: "Vận dụng",
};
export type StagedAnchor = { revision: number; hash: string };
export type StagedSourceIdentity = {
  subject: string; grade: string; lessonTitle: string; periods: number; duration: number; sourceHashes: string[];
};
export type StagedAnchorDependencies = {
  source?: StagedAnchor; outcomes?: StagedAnchor; lessonMap?: StagedAnchor; materials?: StagedAnchor;
  periodBlueprint?: StagedAnchor; previousPhase?: StagedAnchor;
  periodBlueprints?: StagedAnchor[]; phases?: StagedAnchor[];
};
export type StagedContentKind = "source-facts" | "section-outcomes" | "lesson-map" | "period-blueprint"
  | "section-materials" | "period-phase" | "section-assessment";
export type StagedContentArtifact<K extends StagedContentKind> = Omit<AiGenerationResult, "content"> & {
  version: 2; kind: K; subjectKind: StagedBlueprintArtifact["subjectKind"];
  identity: StagedSourceIdentity; anchor: StagedAnchor; dependencies: StagedAnchorDependencies;
};
export type StagedSourceEvidence = {
  id: string; kind: "task" | "visual" | "text" | "inference"; label: string; text: string;
  page: string; required: boolean; allowReuse: boolean;
};
export type StagedSourceFacts = {
  lessonTitle: string; coreContent: string[]; objectivesFromSource: string[];
  sourceEvidence: StagedSourceEvidence[]; uncertainties: string[]; conflicts: string[]; fatalIssues: string[];
};
export type StagedSourceFactsArtifact = StagedContentArtifact<"source-facts"> & {
  sourceTruth: SourceTruth; promptSource: StagedBlueprintArtifact["promptSource"];
  classification?: VietnameseLessonClassification | NaturalSocialClassification;
  sourceInventory?: VietnameseSourceInventory | NaturalSocialSourceInventory;
  facts: StagedSourceFacts;
};
export type StagedOutcomesArtifact = StagedContentArtifact<"section-outcomes"> & {
  outcomes: LessonOutcomes & { objectiveMetadata: NonNullable<LessonOutcomes["objectiveMetadata"]> };
};
export type StagedLessonMapPeriod = {
  periodNumber: number; focus: string; objectiveIds: string[]; sourceIds: string[]; targetKnowledge: string;
  continuityIn: string; continuityOut: string; assessmentEvidence: string[];
};
export type StagedLessonMap = {
  lessonTitle: string; lessonOverview: string; logicSpine: string[];
  sourceAllocation: Array<{ sourceId: string; periodNumber: number; purpose: string; allowReuse: boolean }>;
  continuityPlan: LessonContinuityPlan; periods: StagedLessonMapPeriod[]; risks: string[];
};
export type StagedLessonMapArtifact = StagedContentArtifact<"lesson-map"> & { lessonMap: StagedLessonMap };
export type StagedPhaseBlueprint = {
  phase: StagedPhaseName; activityId: string; title: string; objectiveIds: string[]; sourceIds: string[];
  sourceUnitIds: string[]; sourceClusterIds: string[]; durationMinutes: number; learningProducts: string[];
  handoffToNext: string; pedagogyFocus: string;
};
export type StagedCompactPeriodBlueprint = {
  periodNumber: number; focus: string; lessonType: string; objectiveIds: string[]; targetKnowledge: string;
  continuityIn: string; continuityOut: string; teachingNotes: string[]; phases: StagedPhaseBlueprint[];
};
export type StagedPeriodBlueprintArtifact = StagedContentArtifact<"period-blueprint"> & {
  periodNumber: number; periodBlueprint: StagedCompactPeriodBlueprint;
};
export type StagedMaterial = {
  id: string; owner: "teacher" | "students"; label: string; sourceIds: string[]; objectiveIds: string[];
};
export type StagedMaterialsArtifact = StagedContentArtifact<"section-materials"> & {
  materials: LessonPlan["materials"]; items: StagedMaterial[];
};
export type StagedPhaseHandoff = {
  activityId: string; knowledge: string[]; products: string[]; pending: string[]; bridge: string;
  objectiveIds: string[]; sourceIds: string[]; materialIds: string[];
};
export type StagedPhaseInput = {
  previousActivityId: string | null; previousHandoffHash: string | null;
  knowledge: string[]; products: string[]; pending: string[]; bridge: string;
};
/** Reference metadata stays internal; activity remains the existing Word/PDF schema. */
export type StagedPhaseArtifact = StagedContentArtifact<"period-phase"> & {
  periodNumber: number; phase: StagedPhaseName; activity: LessonActivity & { id: string; durationMinutes: number; objectiveIds: string[]; learningProducts: string[]; successCriteria: string[] };
  materialIds: string[]; sourceIds: string[]; input: StagedPhaseInput; handoff: StagedPhaseHandoff;
};
export type StagedAssessmentAlignment = {
  objectiveId: string; activityIds: string[]; materialIds: string[]; sourceIds: string[];
  learningProducts: string[]; successCriteria: string[];
};
export type StagedAssessmentArtifact = StagedContentArtifact<"section-assessment"> & {
  assessment: LessonPlan["assessment"]; alignment: StagedAssessmentAlignment[];
};
export type StagedSectionArtifacts = {
  sourceFacts: StagedSourceFactsArtifact; outcomes: StagedOutcomesArtifact; lessonMap: StagedLessonMapArtifact;
  periodBlueprints: StagedPeriodBlueprintArtifact[]; materials: StagedMaterialsArtifact;
  phases: StagedPhaseArtifact[]; assessment: StagedAssessmentArtifact;
};
export type StagedSectionArtifact = StagedSourceFactsArtifact | StagedOutcomesArtifact | StagedLessonMapArtifact
  | StagedPeriodBlueprintArtifact | StagedMaterialsArtifact | StagedPhaseArtifact | StagedAssessmentArtifact;
export type StagedSectionIssue = {
  code: string; message: string; path: string; periodNumber?: number; phase?: StagedPhaseName;
  activityId?: string; objectiveId?: string;
};
export type StagedSectionValidation = { passed: boolean; issues: StagedSectionIssue[] };
export type StagedSectionBaseOptions = {
  input: LessonInput;
  strategy: PlanModelStrategy;
  feedback?: string;
};
export type StagedSectionPrefixOptions = {
  input: LessonInput;
  sourceFacts: StagedSourceFactsArtifact;
  outcomes?: StagedOutcomesArtifact;
  lessonMap?: StagedLessonMapArtifact;
  periodBlueprints?: StagedPeriodBlueprintArtifact[];
  materials?: StagedMaterialsArtifact;
  phases?: StagedPhaseArtifact[];
  assessment?: StagedAssessmentArtifact;
};
export type GenerateStagedSourceFactsOptions = StagedSectionBaseOptions & { ocrText: string; sourceContext: StagedSourceContext };
export type GenerateStagedOutcomesOptions = StagedSectionBaseOptions & Pick<StagedSectionArtifacts, "sourceFacts">;
export type GenerateStagedLessonMapOptions = GenerateStagedOutcomesOptions & Pick<StagedSectionArtifacts, "outcomes">;
export type GenerateStagedPeriodBlueprintOptions = GenerateStagedLessonMapOptions
  & Pick<StagedSectionArtifacts, "lessonMap"> & { periodNumber: number };
export type GenerateStagedMaterialsOptions = GenerateStagedLessonMapOptions
  & Pick<StagedSectionArtifacts, "lessonMap" | "periodBlueprints">;
export type GenerateStagedPhaseOptions = GenerateStagedLessonMapOptions
  & Pick<StagedSectionArtifacts, "materials" | "lessonMap"> & {
    periodBlueprint: StagedPeriodBlueprintArtifact; phase: StagedPhaseName; previousPhase: StagedPhaseArtifact | null;
  };
export type RepairStagedPhaseOptions = GenerateStagedPhaseOptions & {
  currentPhase: StagedPhaseArtifact; issues: StagedSectionIssue[];
};
export type RepairStagedPhaseResult = { artifact: StagedPhaseArtifact; repaired: boolean; issues: StagedSectionIssue[] };
export type GenerateStagedAssessmentOptions = StagedSectionBaseOptions & Omit<StagedSectionArtifacts, "assessment">;
export type AssembleStagedSectionsOptions = StagedSectionArtifacts & {
  input: LessonInput; plan: SubscriptionPlan; repairApplied?: boolean;
};
export type StagedSectionsAssembly = {
  assembly: StagedAssemblyArtifact; blueprint: StagedBlueprintArtifact; periods: StagedPeriodArtifact[];
};
export function stagedActivityId(periodNumber: number, phase: StagedPhaseName): string {
  return `p${periodNumber}-${phase}`;
}


