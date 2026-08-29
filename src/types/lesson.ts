export type SelectOrAuto = "auto" | string;
export type LessonStyle = "Cơ bản" | "Dạy thật trên lớp" | "Sáng tạo, sinh động";
export type LessonValidationStatus = "passed" | "needs_adjustment";

export type LessonInput = {
  subject: string;
  grade: string;
  lessonTitle: string;
  book: string;
  bookVolume: SelectOrAuto;
  periods: number;
  duration: 35;
  hometownProvince: SelectOrAuto;
  localityNote: string;
  studentProfile: SelectOrAuto;
  teachingEnvironment: SelectOrAuto;
  facilities: string[] | "auto";
  style: LessonStyle;
  specialRequest: string;
  allowAiInference: boolean;
  enableDigitalCompetency: boolean;
  uploadedAssets: UploadedAsset[];
};

export type UploadedAsset = {
  id: string;
  name: string;
  type: "image" | "pdf" | "file";
  order?: number;
  previewUrl?: string;
  dataUrl?: string;
  mimeType?: string;
};

export type LessonActivityOrganization = "individual" | "pair" | "group" | "whole_class";

export type LessonActivityTimeBreakdown = {
  instructionMinutes?: number;
  distributionMinutes?: number;
  thinkingMinutes?: number;
  workingMinutes?: number;
  presentationMinutes?: number;
  feedbackMinutes?: number;
  consolidationMinutes?: number;
  transitionMinutes?: number;
  flexibleMinutes?: number;
};

export type LessonActivityErrorFeedback = {
  error: string;
  feedback: string[];
};

export type LessonActivity = {
  phase: string;
  title: string;
  objective: string;
  durationMinutes?: number;
  teacherActions: string[];
  studentActions: string[];
  learningProducts?: string[];
  /** Stable identifier used by outcome-to-evidence links. */
  id?: string;
  /** IDs from LessonOutcomes.objectiveMetadata addressed by this activity. */
  objectiveIds?: string[];
  inputOrMaterials?: string[];
  organization?: LessonActivityOrganization;
  successCriteria?: string[];
  expectedAnswer?: string;
  acceptableResponses?: string[];
  commonErrors?: string[];
  teacherFeedback?: string[];
  errorFeedback?: LessonActivityErrorFeedback[];
  supportForStudentsNeedingHelp?: string[];
  extensionForEarlyFinishers?: string[];
  timeBreakdown?: LessonActivityTimeBreakdown;
  /** Internal source mapping for coverage validators; hidden from rendered lesson tables. */
  sourceTaskIds?: string[];
  sourceVisualIds?: string[];
  sourceUnitIds?: string[];
  sourceClusterIds?: string[];
  coveragePurpose?: string;
};

export type LessonSourceUnit = {
  unitId: string;
  label: string;
  kind?: string;
  page?: string;
  required?: boolean;
  allowReuse?: boolean;
  preferredPeriodNumber?: number;
  estimatedMinutes?: number;
  sourceEvidence?: string[];
};

export type LessonLearningCluster = {
  clusterId: string;
  label: string;
  sourceUnitIds: string[];
  periodNumber?: number;
  mustStayTogether?: boolean;
  prerequisiteClusterIds?: string[];
  estimatedMinutes?: number;
  expectedProduct?: string;
};

export type LessonContinuityPlan = {
  sourceUnits: LessonSourceUnit[];
  clusters: LessonLearningCluster[];
  warnings?: string[];
};

export type LessonOutcomeCategory =
  | "generalCompetencies"
  | "specificCompetencies"
  | "qualities"
  | "knowledgeAndSkills"
  | "digitalCompetencies";

export type LessonOutcomeEvidenceLink = {
  activityIds: string[];
  learningProducts: string[];
  successCriteria: string[];
};

export type LessonOutcomeMetadata = {
  id: string;
  category: LessonOutcomeCategory;
  statement: string;
  evidence: LessonOutcomeEvidenceLink;
};

export type LessonOutcomes = {
  generalCompetencies: string[];
  specificCompetencies: string[];
  qualities: string[];
  knowledgeAndSkills: string[];
  digitalCompetencies?: string[];
  /** Optional structured links; legacy string arrays remain the display source. */
  objectiveMetadata?: LessonOutcomeMetadata[];
};

export type PeriodPlan = {
  periodNumber: number;
  focus: string;
  outcomes?: LessonOutcomes;
  activities: LessonActivity[];
  handoff?: {
    learned?: string;
    unresolvedRisks?: string[];
    nextBridge?: string;
  };
};

export type LessonPlan = {
  generalInfo: {
    subject: string;
    grade: string;
    lessonTitle: string;
    book?: string;
    periods: number;
    duration: number;
  };
  outcomes: LessonOutcomes;
  materials: {
    teacher: string[];
    students: string[];
  };
  activities: LessonActivity[];
  periodPlans?: PeriodPlan[];
  assessment: {
    criteria: string[];
    evidence: string[];
    comments: string[];
  };
  adjustments: {
    suitablePoints: string[];
    pointsToAdjust: string[];
    nextLessonDirection: string[];
  };
  contextFit: {
    notes: string[];
  };
  meta: {
    style: string;
    modelUsed: string;
    createdAt: string;
    plan?: "free" | "plus";
    lessonId?: string;
    validationStatus?: LessonValidationStatus;
    validationLabel?: string;
    validationCheckedAt?: string;
    validationBlockingCodes?: string[];
    freeDraft?: boolean;
    vietnameseSourceInventory?: VietnameseSourceInventory;
    naturalSocialSourceInventory?: NaturalSocialSourceInventory;
    continuityPlan?: LessonContinuityPlan;
  };
};

export type PedagogyAuditSeverity = "error" | "warning" | "suggestion";

export type PedagogyAuditSourceType = "uploaded_image" | "uploaded_pdf" | "ocr" | "textbook" | "user_input";

export type PedagogyAuditSourceEvidence = {
  sourceType: PedagogyAuditSourceType;
  reference?: string;
  excerpt?: string;
  confidence?: number;
  verificationStatus?: "verified" | "uncertain" | "unavailable";
};

export type PedagogyAuditFinding = {
  code: string;
  severity: PedagogyAuditSeverity;
  message: string;
  periodNumber?: number;
  activityId?: string;
  activityIndex?: number;
  objectiveId?: string;
  autoFixable?: boolean;
  sources?: PedagogyAuditSourceEvidence[];
};

export type PedagogyAudit = {
  subject: string;
  grade: string;
  status: "passed" | "repaired" | "needs-review";
  issues: string[];
  checks: string[];
  repairApplied: boolean;
  checkedAt: string;
  /** Structured findings for new validators; issues remains for backward compatibility. */
  findings?: PedagogyAuditFinding[];
  /** Vietnamese lesson type detected by classifier (optional, backward compatible) */
  lessonType?: string;
  /** Classifier confidence (optional) */
  classificationConfidence?: "high" | "medium" | "low";
  /** Per-period lesson types when available (optional) */
  periodTypes?: string[];
  /** Dynamic checker criteria for each period (optional, backward compatible) */
  periodChecks?: Array<{
    periodNumber: number;
    lessonType?: string;
    checks: string[];
  }>;
};

export type FormErrors = Partial<Record<keyof LessonInput, string>>;

export type MathActivityBlueprint = {
  phase?: string;
  title?: string;
  objective?: string;
  durationMinutes?: number;
  mathFocus?: string;
  handoffToNext?: string;
  sourceUnitIds?: string[];
  sourceClusterIds?: string[];
};

export type MathPeriodBlueprint = {
  periodNumber?: number;
  focus?: string;
  objectives?: string[];
  prerequisite?: string;
  targetKnowledge?: string;
  continuityIn?: string;
  continuityOut?: string;
  activities?: MathActivityBlueprint[];
};

export type MathLessonBlueprint = {
  lessonTitle?: string;
  lessonOverview?: string;
  mathCore?: {
    problemType?: string;
    knowledgeFocus?: string[];
    representations?: string[];
    commonMisconceptions?: string[];
    checkStrategies?: string[];
    continuityRules?: string[];
  };
  outcomes?: Partial<LessonOutcomes>;
  materials?: {
    teacher?: string[];
    students?: string[];
  };
  assessment?: {
    criteria?: string[];
    evidence?: string[];
    comments?: string[];
  };
  contextFit?: {
    notes?: string[];
  };
  continuityPlan?: LessonContinuityPlan;
  periods?: MathPeriodBlueprint[];
};

export type MathPeriodChunk = PeriodPlan & {
  handoff?: {
    learned?: string;
    unresolvedRisks?: string[];
    nextBridge?: string;
  };
};

// ─── NATURAL & SOCIAL STUDIES-SPECIFIC TYPES ───

export type NaturalSocialLessonType =
  | "family"
  | "school"
  | "local-community"
  | "plants-animals"
  | "human-health"
  | "earth-sky"
  | "mixed";

export type NaturalSocialTopicFocus =
  | "home-environment"
  | "family-members-care"
  | "family-chores"
  | "home-safety"
  | "family-general";

export type NaturalSocialClassification = {
  primaryType: NaturalSocialLessonType;
  topicFocus?: NaturalSocialTopicFocus;
  secondaryTypes: NaturalSocialLessonType[];
  confidence: "high" | "medium" | "low";
  evidence: string[];
  gradeBand: string;
  uncertainties: string[];
};

export type NaturalSocialActivityBlueprint = {
  id?: string;
  phase?: string;
  title?: string;
  objective?: string;
  durationMinutes?: number;
  inquiryFocus?: string;
  observationTarget?: string;
  product?: string;
  handoffToNext?: string;
  objectiveIds?: string[];
  sourceTaskIds?: string[];
  sourceVisualIds?: string[];
  sourceUnitIds?: string[];
  sourceClusterIds?: string[];
  coveragePurpose?: string;
};

export type NaturalSocialPeriodBlueprint = {
  periodNumber?: number;
  focus?: string;
  lessonType?: NaturalSocialLessonType;
  objectives?: string[];
  observationTargets?: string[];
  inquiryQuestion?: string;
  evidencePlan?: string;
  comparisonCriteria?: string[];
  safetyNotes?: string[];
  actionFocus?: string;
  continuityIn?: string;
  continuityOut?: string;
  activities?: NaturalSocialActivityBlueprint[];
};

export type NaturalSocialLessonBlueprint = {
  lessonTitle?: string;
  lessonOverview?: string;
  classification?: NaturalSocialClassification;
  sourceInventory?: NaturalSocialSourceInventory;
  naturalSocialCore?: {
    topic?: string;
    domain?: string;
    observationObjects?: string[];
    inquiryQuestions?: string[];
    evidenceToCollect?: string[];
    comparisonOrClassificationCriteria?: string[];
    actionApplications?: string[];
    safetyNotes?: string[];
    localConnectionRules?: string[];
  };
  outcomes?: Partial<LessonOutcomes>;
  materials?: {
    teacher?: string[];
    students?: string[];
  };
  assessment?: {
    criteria?: string[];
    evidence?: string[];
    comments?: string[];
  };
  contextFit?: {
    notes?: string[];
  };
  continuityPlan?: LessonContinuityPlan;
  periods?: NaturalSocialPeriodBlueprint[];
};

export type NaturalSocialSourceTaskType =
  | "observe_image"
  | "answer_question"
  | "describe_effect"
  | "personal_connection"
  | "sort_sequence"
  | "classify"
  | "role_play"
  | "practice_product"
  | "safety_note"
  | "home_application"
  | "other";

export type NaturalSocialProductKind =
  | "oral"
  | "written"
  | "classification"
  | "sequence"
  | "role-play"
  | "physical-product"
  | "practice"
  | "observation"
  | "action"
  | "other";

export type NaturalSocialSourceVisual = {
  visualId?: string;
  label: string;
  page?: string;
  description?: string;
  specificName?: string;
  habitatPlace?: string;
  environmentCategory?: string;
  expectedObservation?: string;
  effectOrReason?: string;
  isPositiveExample?: boolean;
  required?: boolean;
  sourceEvidence?: string[];
};

export type NaturalSocialSourceQuestion = {
  taskId?: string;
  question: string;
  expectedAnswer?: string;
  visualIds?: string[];
  periodNumber?: number;
  required?: boolean;
  sourceEvidence?: string[];
};

export type NaturalSocialProcedureTask = {
  taskId?: string;
  label: string;
  steps: string[];
  visualIds?: string[];
  periodNumber?: number;
  required?: boolean;
  sourceEvidence?: string[];
};

export type NaturalSocialPracticeTask = {
  taskId?: string;
  label: string;
  materials?: string[];
  steps?: string[];
  expectedProduct?: string;
  periodNumber?: number;
  required?: boolean;
  safetyNotes?: string[];
  sourceEvidence?: string[];
};

export type NaturalSocialSituationTask = {
  taskId?: string;
  label: string;
  characters?: string[];
  prompt?: string;
  expectedResponse?: string;
  periodNumber?: number;
  required?: boolean;
  sourceEvidence?: string[];
};

export type NaturalSocialClassificationTask = {
  taskId?: string;
  label: string;
  categories: string[];
  itemLabels?: string[];
  visualIds?: string[];
  periodNumber?: number;
  required?: boolean;
  requiresSupplementalExamples?: boolean;
  sourceEvidence?: string[];
};

export type NaturalSocialPersonalTask = {
  taskId?: string;
  label: string;
  prompt?: string;
  periodNumber?: number;
  required?: boolean;
  sourceEvidence?: string[];
};

export type NaturalSocialRequiredTask = {
  taskId?: string;
  label: string;
  taskType?: NaturalSocialSourceTaskType;
  periodNumber?: number;
  required?: boolean;
  productKind?: NaturalSocialProductKind;
  sourceText?: string;
  expectedAnswer?: string;
  criteria?: string[];
  sourceEvidence?: string[];
};

export type NaturalSocialSourceInventory = {
  visuals?: NaturalSocialSourceVisual[];
  questions?: NaturalSocialSourceQuestion[];
  procedures?: NaturalSocialProcedureTask[];
  practiceTasks?: NaturalSocialPracticeTask[];
  situations?: NaturalSocialSituationTask[];
  classificationTasks?: NaturalSocialClassificationTask[];
  personalTasks?: NaturalSocialPersonalTask[];
  safetyConstraints?: string[];
  requiredTasks?: NaturalSocialRequiredTask[];
  uncertain?: string[];
};

export type NaturalSocialPeriodChunk = PeriodPlan & {
  handoff?: {
    learned?: string;
    unresolvedRisks?: string[];
    nextBridge?: string;
  };
};

// ─── VIETNAMESE-SPECIFIC TYPES ───

export type VietnameseLessonType =
  | "phonics"
  | "reading"
  | "handwriting"
  | "spelling"
  | "composition"
  | "language-knowledge"
  | "speaking-listening"
  | "mixed";

export type VietnameseLessonClassification = {
  primaryType: VietnameseLessonType;
  secondaryTypes: VietnameseLessonType[];
  confidence: "high" | "medium" | "low";
  evidence: string[];
  gradeBand: string;
  uncertainties: string[];
};

export type VietnameseActivityBlueprint = {
  phase?: string;
  title?: string;
  objective?: string;
  durationMinutes?: number;
  focusSkills?: string[];
  handoffToNext?: string;
  sourceTaskIds?: string[];
  sourceUnitIds?: string[];
  sourceClusterIds?: string[];
};

export type VietnamesePeriodBlueprint = {
  periodNumber?: number;
  focus?: string;
  lessonType?: VietnameseLessonType;
  objectives?: string[];
  sourceEvidence?: string;
  targetSkills?: string[];
  continuityIn?: string;
  continuityOut?: string;
  activities?: VietnameseActivityBlueprint[];
  /** Checker flags: only check capabilities that are truly relevant */
  requiresReading?: boolean;
  requiresWriting?: boolean;
  requiresSpeakingListening?: boolean;
  requiresLanguageKnowledge?: boolean;
  requiresPhonics?: boolean;
};

export type VietnameseSourceInventory = {
  readingText?: string[];
  readingVocabulary?: string[];
  longSentences?: Array<{
    sentence: string;
    pauseMarked?: string;
    note?: string;
  }>;
  readingQuestions?: Array<{
    question: string;
    expectedAnswer?: string;
    evidence?: string[];
  }>;
  spellingText?: string;
  phonicsTasks?: Array<{
    prompt: string;
    items: string[];
    answers?: string[];
  }>;
  punctuationSentences?: Array<{
    sentence: string;
    answer: string;
  }>;
  writingPrompt?: {
    sentenceCount?: string;
    objectNames?: string[];
    prompts?: string[];
  };
  materialsByPeriod?: Array<{
    periodNumber: number;
    materials: string[];
  }>;
  requiredTasks?: Array<{
    taskId?: string;
    label: string;
    taskType?:
      | "startup"
      | "reading-fluency"
      | "reading-question"
      | "memorization"
      | "vocabulary"
      | "phonics"
      | "spelling"
      | "punctuation"
      | "sentence-writing"
      | "composition"
      | "language-knowledge"
      | "speaking"
      | "listening"
      | "extension"
      | "other";
    periodNumber?: number;
    sourceText?: string;
    required?: boolean;
    productKind?: "oral" | "written" | "reading" | "memorized" | "answer" | "classification" | "spelling" | "phonics" | "punctuation" | "other";
    expectedAnswer?: string;
    criteria?: string[];
    sourceEvidence?: string[];
  }>;
  uncertain?: string[];
};

export type VietnameseLessonBlueprint = {
  lessonTitle?: string;
  lessonOverview?: string;
  classification?: VietnameseLessonClassification;
  sourceInventory?: VietnameseSourceInventory;
  outcomes?: Partial<LessonOutcomes>;
  materials?: {
    teacher?: string[];
    students?: string[];
  };
  assessment?: {
    criteria?: string[];
    evidence?: string[];
    comments?: string[];
  };
  contextFit?: {
    notes?: string[];
  };
  continuityPlan?: LessonContinuityPlan;
  periods?: VietnamesePeriodBlueprint[];
};

export type VietnamesePeriodChunk = PeriodPlan & {
  handoff?: {
    learned?: string;
    unresolvedRisks?: string[];
    nextBridge?: string;
  };
};
