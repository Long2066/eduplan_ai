import { activityMinutes } from "@/lib/lesson-format";
import { isNaturalSocialSubjectName, normalizeNaturalSocialText } from "@/lib/natural-social-pedagogy";
import type {
  LessonActivity,
  LessonInput,
  LessonPlan,
  NaturalSocialProductKind,
  NaturalSocialRequiredTask,
  NaturalSocialSourceInventory,
  NaturalSocialSourceTaskType,
  PedagogyAuditFinding,
  PeriodPlan,
} from "@/types/lesson";

type CoverageRule = {
  code: string;
  severity: PedagogyAuditFinding["severity"];
  autoFixable: boolean;
};

type NaturalSocialCoverageTask = NaturalSocialRequiredTask & {
  taskType: NaturalSocialSourceTaskType;
  productKind: NaturalSocialProductKind;
  visualIds?: string[];
  steps?: string[];
  safetyNotes?: string[];
};

export const naturalSocialCoverageRules = {
  missingSourceVisual: { code: "NSXH-COVERAGE-01", severity: "error", autoFixable: true },
  missingSourceQuestion: { code: "NSXH-COVERAGE-02", severity: "warning", autoFixable: true },
  missingSourceProcedure: { code: "NSXH-COVERAGE-03", severity: "error", autoFixable: true },
  practiceProductMismatch: { code: "NSXH-COVERAGE-04", severity: "error", autoFixable: true },
  unsupportedClassification: { code: "NSXH-COVERAGE-05", severity: "error", autoFixable: true },
  missingPersonalConnection: { code: "NSXH-COVERAGE-06", severity: "warning", autoFixable: true },
  missingSituationResponse: { code: "NSXH-COVERAGE-07", severity: "error", autoFixable: true },
  missingExpectedAnswer: { code: "NSXH-COVERAGE-08", severity: "warning", autoFixable: true },
  missingTaskProductOrCriteria: { code: "NSXH-COVERAGE-09", severity: "warning", autoFixable: true },
  missingReserveTime: { code: "NSXH-COVERAGE-10", severity: "warning", autoFixable: true },
  unsafePracticeMissingGuardrail: { code: "NSXH-COVERAGE-11", severity: "warning", autoFixable: true },
  sourcePageMismatch: { code: "NSXH-COVERAGE-12", severity: "error", autoFixable: true },
  missingHabitatDistinction: { code: "NSXH-COVERAGE-13", severity: "error", autoFixable: true },
  duplicatedClassificationTask: { code: "NSXH-COVERAGE-14", severity: "warning", autoFixable: true },
  specificNameNotPreserved: { code: "NSXH-COVERAGE-15", severity: "error", autoFixable: true },
} as const satisfies Record<string, CoverageRule>;

const taskTypePatterns: Record<NaturalSocialSourceTaskType, RegExp> = {
  observe_image: /quan sát|tranh|hình|ảnh|mô tả|nhìn thấy|chi tiết|nêu.*thấy/i,
  answer_question: /câu hỏi|trả lời|nêu|theo em|vì sao|tại sao|nhận xét|em sẽ|con thấy/i,
  describe_effect: /tác dụng|giúp|lợi ích|vì sao|kết quả|hạn chế|phòng tránh|bảo vệ|giữ/i,
  personal_connection: /em đã|bản thân|ở nhà em|việc em làm|việc em đã làm|nói với bạn|chia sẻ với bạn|em thường/i,
  sort_sequence: /sắp xếp|trình tự|quy trình|thứ tự|trước tiên|tiếp theo|sau đó|cuối cùng|bước/i,
  classify: /phân loại|xếp nhóm|hai cột|bảng hai cột|nên làm|không nên|chưa nên|đúng|sai|tiêu chí/i,
  role_play: /đóng vai|xử lí tình huống|xử lý tình huống|nếu là|em sẽ nói|góp ý|nhân vật|vai/i,
  practice_product: /làm|cắt|dán|trang trí|tạo|gấp|lắp|thực hành|sản phẩm|vật liệu|hoàn thiện/i,
  safety_note: /an toàn|không tự ý|người lớn|cẩn thận|dao|kéo|hóa chất|chất tẩy|nguy hiểm/i,
  home_application: /về nhà|ở nhà|người thân|thực hiện|vận dụng|hằng ngày|gia đình|cam kết/i,
  other: /./,
};

const stopWords = new Set([
  "anh",
  "bai",
  "bang",
  "cac",
  "cau",
  "cho",
  "cua",
  "duoc",
  "dung",
  "em",
  "giao",
  "gv",
  "hay",
  "hinh",
  "hoac",
  "hoc",
  "hs",
  "khi",
  "lop",
  "mot",
  "neu",
  "nhiem",
  "nhung",
  "noi",
  "qua",
  "quan",
  "sach",
  "sat",
  "sgk",
  "tiet",
  "the",
  "theo",
  "thuc",
  "tranh",
  "trong",
  "tu",
  "va",
  "viec",
  "voi",
  "yeu",
]);

function finding(rule: CoverageRule, message: string, location: Partial<PedagogyAuditFinding> = {}): PedagogyAuditFinding {
  return { code: rule.code, severity: rule.severity, autoFixable: rule.autoFixable, message, ...location };
}

function asStringList(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(asStringList);
  if (typeof value === "string") return value.trim() ? [value.trim()] : [];
  if (typeof value === "number" || typeof value === "boolean") return [String(value)];
  return [];
}

function optionalString(value: unknown) {
  return asStringList(value)[0] || undefined;
}

function asBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function comparableText(value: string) {
  return normalizeNaturalSocialText(value)
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function contentWords(value: string) {
  return comparableText(value)
    .split(" ")
    .filter((word) => word.length >= 3 && !stopWords.has(word));
}

function labelWords(value: string) {
  return comparableText(value)
    .split(" ")
    .filter((word) => word.length >= 2 && !stopWords.has(word));
}

function textOverlap(left: string, right: string) {
  const leftWords = new Set(contentWords(left));
  const rightWords = new Set(contentWords(right));
  if (!leftWords.size || !rightWords.size) return 0;
  const hits = [...rightWords].filter((word) => leftWords.has(word)).length;
  return hits / rightWords.size;
}

function meaningfulPhraseHit(text: string, phrases: string[]) {
  const comparable = comparableText(text);
  return phrases.some((phrase) => {
    const words = contentWords(phrase);
    if (words.length >= 2 && comparable.includes(words.join(" "))) return true;
    if (words.length >= 3) {
      const hitCount = words.filter((word) => comparable.includes(word)).length;
      return hitCount >= Math.ceil(words.length * 0.75);
    }
    return false;
  });
}

function allLabelWordsPresent(text: string, label: string) {
  const words = labelWords(label);
  if (!words.length) return true;
  const comparable = comparableText(text);
  return words.every((word) => comparable.includes(word));
}

function exactLabelPhrasePresent(text: string, label: string) {
  const labelTokens = labelWords(label);
  if (!labelTokens.length) return false;
  const textTokens = comparableText(text).split(" ").filter(Boolean);
  return textTokens.some((_, start) =>
    labelTokens.every((token, offset) => textTokens[start + offset] === token),
  );
}

function periods(lesson: LessonPlan): PeriodPlan[] {
  return lesson.periodPlans?.length
    ? lesson.periodPlans
    : [{ periodNumber: 1, focus: lesson.generalInfo.lessonTitle, outcomes: lesson.outcomes, activities: lesson.activities }];
}

function activityText(activity: LessonActivity) {
  return [
    activity.phase,
    activity.title,
    activity.objective,
    ...(activity.inputOrMaterials || []),
    ...(activity.teacherActions || []),
    ...(activity.studentActions || []),
    ...(activity.learningProducts || []),
    ...(activity.successCriteria || []),
    activity.expectedAnswer || "",
    ...(activity.acceptableResponses || []),
    ...(activity.commonErrors || []),
    ...(activity.teacherFeedback || []),
    ...(activity.supportForStudentsNeedingHelp || []),
    ...(activity.extensionForEarlyFinishers || []),
    ...(activity.sourceTaskIds || []),
    ...(activity.sourceVisualIds || []),
    activity.coveragePurpose || "",
  ].join(" ");
}

function lessonText(lesson: LessonPlan) {
  return [
    lesson.generalInfo.lessonTitle,
    ...(lesson.materials?.teacher || []),
    ...(lesson.materials?.students || []),
    ...(lesson.activities || []).map(activityText),
    ...(lesson.periodPlans || []).flatMap((period) => (period.activities || []).map(activityText)),
  ].join(" ");
}

function taskText(task: NaturalSocialCoverageTask) {
  return [
    task.label,
    task.sourceText || "",
    task.expectedAnswer || "",
    ...(task.criteria || []),
    ...(task.sourceEvidence || []),
    ...(task.steps || []),
  ].join(" ");
}

function taskPhrases(task: NaturalSocialCoverageTask) {
  return [
    task.label,
    task.sourceText || "",
    task.expectedAnswer || "",
    ...(task.criteria || []),
    ...(task.sourceEvidence || []),
    ...(task.steps || []),
  ].filter(Boolean);
}

function taskProductKind(task: NaturalSocialCoverageTask): NaturalSocialProductKind {
  if (task.productKind) return task.productKind;
  if (task.taskType === "practice_product") return "physical-product";
  if (task.taskType === "sort_sequence") return "sequence";
  if (task.taskType === "classify") return "classification";
  if (task.taskType === "role_play") return "role-play";
  if (task.taskType === "observe_image") return "observation";
  if (task.taskType === "home_application") return "action";
  return "oral";
}

function defaultProductKindForTaskType(taskType: NaturalSocialSourceTaskType): NaturalSocialProductKind {
  if (taskType === "practice_product") return "physical-product";
  if (taskType === "sort_sequence") return "sequence";
  if (taskType === "classify") return "classification";
  if (taskType === "role_play") return "role-play";
  if (taskType === "observe_image") return "observation";
  if (taskType === "home_application") return "action";
  return "oral";
}

function normalizeSourceTaskType(value: unknown, label = ""): NaturalSocialSourceTaskType {
  const raw = String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (raw === "question" || raw === "questions" || raw === "answer" || raw === "qa") return "answer_question";
  if (raw === "practice" || raw === "product" || raw === "hands_on" || raw === "make_product") return "practice_product";
  if (raw === "presentation" || raw === "present" || raw === "share" || raw === "speaking") return "personal_connection";
  if (raw === "sequence" || raw === "procedure" || raw === "sort") return "sort_sequence";
  if (raw === "classification" || raw === "grouping") return "classify";
  if (raw === "situation" || raw === "roleplay") return "role_play";
  if (raw === "observe" || raw === "visual" || raw === "image") return "observe_image";
  if (raw === "home" || raw === "application") return "home_application";
  if (([
    "observe_image",
    "answer_question",
    "describe_effect",
    "personal_connection",
    "sort_sequence",
    "classify",
    "role_play",
    "practice_product",
    "safety_note",
    "home_application",
    "other",
  ] as string[]).includes(raw)) return raw as NaturalSocialSourceTaskType;

  if (/giới thiệu|chia sẻ|liên hệ|trường em|lớp em|gia đình em|bản thân/i.test(label)) return "personal_connection";
  if (/câu hỏi|trả lời|xác định|nêu|vì sao|theo em/i.test(label)) return "answer_question";
  if (/hoàn thiện|thực hành|làm|sản phẩm|phiếu|mô hình|vẽ/i.test(label)) return "practice_product";
  if (/sắp xếp|trình tự|quy trình|thứ tự/i.test(label)) return "sort_sequence";
  if (/phân loại|xếp nhóm|bảng/i.test(label)) return "classify";
  if (/đóng vai|xử lí tình huống|xử lý tình huống/i.test(label)) return "role_play";
  if (/quan sát|tranh|hình ảnh/i.test(label)) return "observe_image";
  return "other";
}

function normalizeProductKind(value: unknown, taskType: NaturalSocialSourceTaskType): NaturalSocialProductKind {
  const raw = String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (raw === "oral" || raw === "lời_nói" || raw === "loi_noi" || raw.includes("lời_nói")) return "oral";
  if (raw === "written" || raw === "phiếu" || raw === "phieu" || raw.includes("phiếu") || raw.includes("ghi")) return "written";
  if (raw === "presentation" || raw === "video" || raw.includes("trình_bày") || raw.includes("gioi_thieu")) return "oral";
  if ((["oral", "written", "classification", "sequence", "role-play", "physical-product", "practice", "observation", "action", "other"] as string[]).includes(raw)) {
    return raw as NaturalSocialProductKind;
  }
  return defaultProductKindForTaskType(taskType);
}

function normalizeRequiredTask(task: NaturalSocialRequiredTask, index: number): NaturalSocialCoverageTask | null {
  const label = optionalString(task.label);
  if (!label || task.required === false) return null;
  const taskType = normalizeSourceTaskType(task.taskType, label);
  return {
    ...task,
    taskId: optionalString(task.taskId) || `required-${index + 1}`,
    label,
    taskType,
    productKind: normalizeProductKind(task.productKind, taskType),
    periodNumber: task.periodNumber ? Number(task.periodNumber) : undefined,
    sourceText: optionalString(task.sourceText),
    expectedAnswer: optionalString(task.expectedAnswer),
    criteria: asStringList(task.criteria),
    sourceEvidence: asStringList(task.sourceEvidence),
  };
}

function generatedTasks(sourceInventory: NaturalSocialSourceInventory): NaturalSocialCoverageTask[] {
  const tasks: NaturalSocialCoverageTask[] = [];

  (sourceInventory.visuals || []).forEach((visual, index) => {
    if (!visual.label || visual.required === false) return;
    const visualId = visual.visualId || `visual-${index + 1}`;
    tasks.push({
      taskId: visualId,
      label: visual.label,
      taskType: "observe_image",
      productKind: "observation",
      visualIds: [visualId],
      sourceText: [
        visual.page ? `Trang ${visual.page}` : "",
        visual.specificName,
        visual.description,
        visual.habitatPlace ? `Nơi sống: ${visual.habitatPlace}` : "",
        visual.environmentCategory ? `Môi trường sống: ${visual.environmentCategory}` : "",
        visual.expectedObservation,
        visual.effectOrReason,
      ].filter(Boolean).join("; "),
      expectedAnswer: [
        visual.expectedObservation,
        visual.habitatPlace ? `Nơi sống: ${visual.habitatPlace}` : "",
        visual.environmentCategory ? `Môi trường sống: ${visual.environmentCategory}` : "",
        visual.effectOrReason,
      ].filter(Boolean).join("; "),
      sourceEvidence: visual.sourceEvidence,
      required: true,
    });
    if (visual.effectOrReason) {
      tasks.push({
        taskId: `${visualId}-effect`,
        label: `Nêu tác dụng/lí do của ${visual.label}`,
        taskType: "describe_effect",
        productKind: "oral",
        visualIds: [visualId],
        sourceText: visual.effectOrReason,
        expectedAnswer: visual.effectOrReason,
        required: true,
      });
    }
  });

  (sourceInventory.questions || []).forEach((question, index) => {
    if (!question.question || question.required === false) return;
    tasks.push({
      taskId: question.taskId || `question-${index + 1}`,
      label: question.question,
      taskType: "answer_question",
      productKind: "oral",
      visualIds: question.visualIds,
      periodNumber: question.periodNumber,
      sourceText: [...(question.visualIds || []), ...(question.sourceEvidence || [])].join("; "),
      expectedAnswer: question.expectedAnswer,
      sourceEvidence: question.sourceEvidence,
      required: true,
    });
  });

  (sourceInventory.procedures || []).forEach((procedure, index) => {
    if (!procedure.label || procedure.required === false) return;
    tasks.push({
      taskId: procedure.taskId || `procedure-${index + 1}`,
      label: procedure.label,
      taskType: "sort_sequence",
      productKind: "sequence",
      visualIds: procedure.visualIds,
      periodNumber: procedure.periodNumber,
      sourceText: procedure.steps.join("; "),
      expectedAnswer: procedure.steps.join(" -> "),
      steps: procedure.steps,
      sourceEvidence: procedure.sourceEvidence,
      required: true,
    });
  });

  (sourceInventory.practiceTasks || []).forEach((practice, index) => {
    if (!practice.label || practice.required === false) return;
    tasks.push({
      taskId: practice.taskId || `practice-${index + 1}`,
      label: practice.label,
      taskType: "practice_product",
      productKind: "physical-product",
      periodNumber: practice.periodNumber,
      sourceText: [
        ...(practice.materials || []),
        ...(practice.steps || []),
        practice.expectedProduct || "",
      ].join("; "),
      expectedAnswer: practice.expectedProduct,
      steps: practice.steps,
      safetyNotes: practice.safetyNotes,
      sourceEvidence: practice.sourceEvidence,
      required: true,
    });
  });

  (sourceInventory.situations || []).forEach((situation, index) => {
    if (!situation.label || situation.required === false) return;
    tasks.push({
      taskId: situation.taskId || `situation-${index + 1}`,
      label: situation.label,
      taskType: "role_play",
      productKind: "role-play",
      periodNumber: situation.periodNumber,
      sourceText: [...(situation.characters || []), situation.prompt || "", ...(situation.sourceEvidence || [])].join("; "),
      expectedAnswer: situation.expectedResponse,
      sourceEvidence: situation.sourceEvidence,
      required: true,
    });
  });

  (sourceInventory.classificationTasks || []).forEach((classification, index) => {
    if (!classification.label || classification.required === false) return;
    tasks.push({
      taskId: classification.taskId || `classification-${index + 1}`,
      label: classification.label,
      taskType: "classify",
      productKind: "classification",
      visualIds: classification.visualIds,
      periodNumber: classification.periodNumber,
      sourceText: [...classification.categories, ...(classification.itemLabels || [])].join("; "),
      criteria: classification.categories,
      sourceEvidence: classification.sourceEvidence,
      required: true,
    });
  });

  (sourceInventory.personalTasks || []).forEach((personal, index) => {
    if (!personal.label || personal.required === false) return;
    tasks.push({
      taskId: personal.taskId || `personal-${index + 1}`,
      label: personal.label,
      taskType: "personal_connection",
      productKind: "oral",
      periodNumber: personal.periodNumber,
      sourceText: personal.prompt || "",
      sourceEvidence: personal.sourceEvidence,
      required: true,
    });
  });

  return tasks;
}

function requiredTasks(sourceInventory?: NaturalSocialSourceInventory): NaturalSocialCoverageTask[] {
  if (!sourceInventory) return [];
  const explicit = (sourceInventory.requiredTasks || [])
    .map(normalizeRequiredTask)
    .filter((task): task is NaturalSocialCoverageTask => Boolean(task));
  const generated = generatedTasks(sourceInventory);
  const seen = new Set<string>();
  return [...explicit, ...generated].filter((task) => {
    const key = `${task.taskType}|${task.periodNumber || 0}|${comparableText(task.taskId || task.label)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function matchingActivities(task: NaturalSocialCoverageTask, scope: PeriodPlan) {
  const pattern = taskTypePatterns[task.taskType] || taskTypePatterns.other;
  const comparableTaskText = taskText(task);
  const phrases = taskPhrases(task);
  return (scope.activities || []).flatMap((activity, activityIndex) => {
    const text = activityText(activity);
    const explicitTaskHit = Boolean(task.taskId && activity.sourceTaskIds?.includes(task.taskId));
    const explicitVisualHit = Boolean(task.visualIds?.some((id) => activity.sourceVisualIds?.includes(id)));
    const labelHit = allLabelWordsPresent(text, task.label);
    const phraseHit = meaningfulPhraseHit(text, phrases);
    const overlap = textOverlap(text, comparableTaskText);
    const typeHit = pattern.test(text);

    if (explicitTaskHit || explicitVisualHit) return [{ activity, activityIndex, text, overlap: Math.max(overlap, 1) }];
    if (task.taskType === "observe_image") {
      if (typeHit && labelHit && (phraseHit || overlap >= 0.55)) return [{ activity, activityIndex, text, overlap }];
      return [];
    }
    if (task.taskType === "practice_product" || task.taskType === "sort_sequence" || task.taskType === "role_play" || task.taskType === "classify") {
      if (typeHit && (phraseHit || overlap >= 0.2)) return [{ activity, activityIndex, text, overlap }];
      return [];
    }
    if (typeHit && (phraseHit || overlap >= 0.16 || contentWords(comparableTaskText).length <= 3)) {
      return [{ activity, activityIndex, text, overlap }];
    }
    return [];
  });
}

function hasExpectedAnswerEvidence(task: NaturalSocialCoverageTask, matches: ReturnType<typeof matchingActivities>) {
  const expected = task.expectedAnswer || "";
  if (!expected.trim()) return true;
  return matches.some(({ activity, text }) => {
    const answerText = [activity.expectedAnswer || "", ...(activity.acceptableResponses || []), text].join(" ");
    return meaningfulPhraseHit(answerText, [expected]) || textOverlap(answerText, expected) >= 0.24;
  });
}

function productAndCriteriaArePresent(matches: ReturnType<typeof matchingActivities>) {
  return matches.some(({ activity }) =>
    Boolean(activity.learningProducts?.some((item) => item.trim()))
    && Boolean(activity.successCriteria?.some((item) => item.trim())),
  );
}

function hasPhysicalPracticeEvidence(matches: ReturnType<typeof matchingActivities>) {
  return matches.some(({ text }) =>
    /làm|cắt|dán|tạo|gấp|lắp|thực hành|hoàn thiện|mang đến lớp|dụng cụ/i.test(text),
  );
}

function hasProcedureStepEvidence(task: NaturalSocialCoverageTask, matches: ReturnType<typeof matchingActivities>) {
  const steps = (task.steps || []).filter((step) => step.trim());
  if (steps.length <= 1) return true;
  const hitCount = steps.filter((step) =>
    matches.some(({ text }) => meaningfulPhraseHit(text, [step]) || textOverlap(text, step) >= 0.34),
  ).length;
  return hitCount >= Math.max(2, Math.ceil(steps.length * 0.6));
}

function hasRolePlayResponseEvidence(matches: ReturnType<typeof matchingActivities>) {
  return matches.some(({ text }) => /đóng vai|nếu là|em sẽ nói|nói gì|góp ý|khuyên|trao đổi vai|vai/i.test(text));
}

function hasPersonalConnectionEvidence(matches: ReturnType<typeof matchingActivities>) {
  return matches.some(({ text }) => /em đã|bản thân|ở nhà em|việc em làm|việc em đã làm|nói với bạn|chia sẻ với bạn|em thường/i.test(text));
}

function missingTaskRule(task: NaturalSocialCoverageTask): CoverageRule {
  if (task.taskType === "observe_image") return naturalSocialCoverageRules.missingSourceVisual;
  if (task.taskType === "sort_sequence") return naturalSocialCoverageRules.missingSourceProcedure;
  if (task.taskType === "practice_product") return naturalSocialCoverageRules.practiceProductMismatch;
  if (task.taskType === "role_play") return naturalSocialCoverageRules.missingSituationResponse;
  if (task.taskType === "personal_connection") return naturalSocialCoverageRules.missingPersonalConnection;
  return naturalSocialCoverageRules.missingSourceQuestion;
}

function labelFor(task: NaturalSocialCoverageTask) {
  if (task.periodNumber) return `Tiết ${task.periodNumber}`;
  return "Giáo án";
}

function hasOnlyPositiveSourceVisuals(sourceInventory?: NaturalSocialSourceInventory) {
  const visuals = (sourceInventory?.visuals || []).filter((visual) => visual.required !== false);
  return visuals.length >= 2 && visuals.every((visual) => visual.isPositiveExample === true);
}

function hasExplicitSupplementalExamples(text: string) {
  return /tranh bổ sung|hình bổ sung|thẻ bổ sung|ví dụ bổ sung|do gv chuẩn bị|giáo viên chuẩn bị thêm/i.test(text);
}

function hasUnsupportedOppositionClassification(text: string) {
  return /(phân loại|xếp nhóm|hai cột|bảng hai cột).{0,120}(chưa giúp|không giúp|chưa nên|không nên|nên\/không nên|đúng\/sai|tốt\/chưa tốt|có hại|sai)/i.test(text)
    || /(chưa giúp|không giúp|chưa nên|không nên|nên\/không nên|đúng\/sai|tốt\/chưa tốt|có hại|sai).{0,120}(phân loại|xếp nhóm|hai cột|bảng hai cột)/i.test(text);
}

function expandPageRange(startValue: string | undefined, endValue?: string) {
  const start = Number(startValue);
  const end = Number(endValue || startValue);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return [];
  const lower = Math.min(start, end);
  const upper = Math.max(start, end);
  return Array.from({ length: upper - lower + 1 }, (_, index) => String(lower + index));
}

function pageNumbers(value: string, options: { allowBare?: boolean } = {}) {
  const source = String(value || "");
  const prefixedPages = Array.from(source.matchAll(/(?:trang|tr\.)\s*(\d{1,3})(?:\s*[-–]\s*(\d{1,3}))?/gi))
    .flatMap((match) => expandPageRange(match[1], match[2]));
  const barePages = options.allowBare && /^\s*\d{1,3}(?:\s*[-–]\s*\d{1,3})?\s*$/.test(source)
    ? Array.from(source.matchAll(/(\d{1,3})(?:\s*[-–]\s*(\d{1,3}))?/g)).flatMap((match) => expandPageRange(match[1], match[2]))
    : [];
  return Array.from(new Set([...prefixedPages, ...barePages]));
}

function sourcePageFindings(
  lesson: LessonPlan,
  sourceInventory?: NaturalSocialSourceInventory,
): PedagogyAuditFinding[] {
  const visuals = sourceInventory?.visuals || [];
  if (!visuals.length) return [];
  const visualsById = new Map(
    visuals.flatMap((visual) => visual.visualId ? [[visual.visualId, visual] as const] : []),
  );
  return periods(lesson).flatMap((period) =>
    (period.activities || []).flatMap((activity, activityIndex) => {
      const text = activityText(activity);
      const mentionedPages = pageNumbers(text);
      if (!mentionedPages.length) return [];
      const boundVisuals = Array.from(new Set(activity.sourceVisualIds || []))
        .map((visualId) => visualsById.get(visualId))
        .filter((visual): visual is NonNullable<typeof visual> => Boolean(visual));
      const candidates = boundVisuals.length
        ? boundVisuals
        : visuals.filter((visual) => exactLabelPhrasePresent(text, visual.specificName || visual.label));
      return candidates.flatMap((visual) => {
        const expectedPages = pageNumbers(visual.page || "", { allowBare: true });
        if (!expectedPages.length) return [];
        const visualName = visual.specificName || visual.label;
        const pageOk = mentionedPages.some((page) => expectedPages.includes(page));
        if (pageOk) return [];
        return [finding(
          naturalSocialCoverageRules.sourcePageMismatch,
          `${period.periodNumber ? `Tiết ${period.periodNumber}` : "Giáo án"} gắn “${visualName}” với trang ${mentionedPages.join(", ")} nhưng inventory SGK ghi ở trang ${visual.page}.`,
          { periodNumber: period.periodNumber, activityIndex },
        )];
      });
    }),
  );
}

function habitatDistinctionFindings(
  lesson: LessonPlan,
  sourceInventory?: NaturalSocialSourceInventory,
): PedagogyAuditFinding[] {
  const visuals = (sourceInventory?.visuals || []).filter((visual) => visual.habitatPlace && visual.environmentCategory && visual.required !== false);
  if (!visuals.length) return [];
  return visuals.flatMap((visual) => {
    const visualName = visual.specificName || visual.label;
    const visualTask: NaturalSocialCoverageTask = {
      taskId: visual.visualId || visualName,
      label: visualName,
      taskType: "observe_image",
      productKind: "observation",
      visualIds: visual.visualId ? [visual.visualId] : undefined,
      sourceText: [
        visual.description,
        visual.habitatPlace,
        visual.environmentCategory,
        visual.expectedObservation,
      ].filter(Boolean).join("; "),
      expectedAnswer: [visual.habitatPlace, visual.environmentCategory].filter(Boolean).join("; "),
      required: true,
    };
    const matches = periods(lesson).flatMap((period) =>
      matchingActivities(visualTask, period).map((match) => ({ ...match, periodNumber: period.periodNumber })),
    );
    if (!matches.length) return [];
    const hasBoth = matches.some(({ text }) =>
      meaningfulPhraseHit(text, [visual.habitatPlace || ""])
      && meaningfulPhraseHit(text, [visual.environmentCategory || ""]),
    );
    if (hasBoth) return [];
    return [finding(
      naturalSocialCoverageRules.missingHabitatDistinction,
      `Nhiệm vụ về “${visualName}” chưa phân biệt đủ nơi sống cụ thể (“${visual.habitatPlace}”) và môi trường sống (“${visual.environmentCategory}”).`,
      { periodNumber: matches[0]?.periodNumber, activityIndex: matches[0]?.activityIndex },
    )];
  });
}

function specificNameFindings(
  lesson: LessonPlan,
  sourceInventory?: NaturalSocialSourceInventory,
): PedagogyAuditFinding[] {
  const visuals = (sourceInventory?.visuals || []).filter((visual) => visual.specificName && labelWords(visual.specificName).length >= 2 && visual.required !== false);
  if (!visuals.length) return [];
  const text = lessonText(lesson);
  return visuals.flatMap((visual) => {
    const specificName = visual.specificName || "";
    if (allLabelWordsPresent(text, specificName)) return [];
    const genericWords = labelWords(specificName).slice(0, 1);
    const mentionsGeneric = genericWords.some((word) => comparableText(text).includes(word));
    if (!mentionsGeneric) return [];
    return [finding(
      naturalSocialCoverageRules.specificNameNotPreserved,
      `Inventory SGK ghi tên cụ thể “${specificName}”; giáo án không được rút gọn thành tên chung vì có thể làm sai môi trường sống.`,
    )];
  });
}

function duplicateClassificationFindings(lesson: LessonPlan): PedagogyAuditFinding[] {
  const classificationText = (activity: LessonActivity) => [
    activity.phase,
    activity.title,
    activity.objective,
    ...(activity.teacherActions || []),
    ...(activity.studentActions || []),
    ...(activity.learningProducts || []),
  ].join(" ");
  const isClassification = (text: string) =>
    /(phân loại|xếp nhóm|bảng phân loại|sơ đồ|ba nhóm|3 nhóm|trên cạn|dưới nước|vừa trên cạn)/i.test(text);

  return periods(lesson).flatMap((period) => {
    const candidates = (period.activities || [])
      .map((activity, activityIndex) => ({ activity, activityIndex, text: classificationText(activity) }))
      .filter((item) => isClassification(item.text));
    const findings: PedagogyAuditFinding[] = [];
    for (let index = 1; index < candidates.length; index += 1) {
      const previous = candidates[index - 1];
      const current = candidates[index];
      const overlap = textOverlap(current.text, previous.text);
      const sameHabitatGroups = /trên cạn/i.test(current.text) && /dưới nước/i.test(current.text)
        && /trên cạn/i.test(previous.text) && /dưới nước/i.test(previous.text);
      if (overlap >= 0.42 || sameHabitatGroups) {
        findings.push(finding(
          naturalSocialCoverageRules.duplicatedClassificationTask,
          `${period.periodNumber ? `Tiết ${period.periodNumber}` : "Giáo án"} có hai hoạt động phân loại gần trùng nhau; nên đổi hoạt động sau thành liên hệ địa phương, sơ đồ mở rộng hoặc xử lí tình huống.`,
          { periodNumber: period.periodNumber, activityIndex: current.activityIndex },
        ));
      }
    }
    return findings;
  });
}

function periodReserveFindings(lesson: LessonPlan, input: LessonInput) {
  const duration = Number(input.duration || lesson.generalInfo.duration || 35);
  if (duration !== 35) return [];
  return periods(lesson).flatMap((period) => {
    const total = (period.activities || []).reduce((sum, activity, index) => sum + activityMinutes(activity, index), 0);
    if (total <= 33) return [];
    return [finding(
      naturalSocialCoverageRules.missingReserveTime,
      `${period.periodNumber ? `Tiết ${period.periodNumber}` : "Giáo án"} có ${total} phút hoạt động; tiết TNXH 35 phút nên chừa 2-3 phút dự phòng cho chuyển nhóm, phát/thu học liệu và xử lí tình huống.`,
      { periodNumber: period.periodNumber },
    )];
  });
}

function practiceSafetyFindings(
  task: NaturalSocialCoverageTask,
  matches: ReturnType<typeof matchingActivities>,
): PedagogyAuditFinding[] {
  const safetyText = [...(task.safetyNotes || []), task.sourceText || "", task.label].join(" ");
  if (!/dao|kéo|hóa chất|chất tẩy|lửa|điện|nóng|sắc|nguy hiểm/i.test(safetyText)) return [];
  const hasSafety = matches.some(({ text }) => /an toàn|người lớn|không tự ý|gv làm mẫu|chuẩn bị sẵn|cẩn thận|tránh|không dùng/i.test(text));
  if (hasSafety) return [];
  return [finding(
    naturalSocialCoverageRules.unsafePracticeMissingGuardrail,
    `${labelFor(task)} nhiệm vụ “${task.label}” có yếu tố cần an toàn nhưng giáo án chưa ghi rõ người lớn/GV chuẩn bị hoặc thao tác an toàn.`,
    { periodNumber: task.periodNumber, activityIndex: matches[0]?.activityIndex },
  )];
}

export function validateNaturalSocialTaskCoverage(
  lesson: LessonPlan,
  input: LessonInput,
  sourceInventory?: NaturalSocialSourceInventory,
): PedagogyAuditFinding[] {
  if (!isNaturalSocialSubjectName(input.subject || lesson.generalInfo.subject)) return [];

  const findings: PedagogyAuditFinding[] = [
    ...periodReserveFindings(lesson, input),
    ...sourcePageFindings(lesson, sourceInventory),
    ...habitatDistinctionFindings(lesson, sourceInventory),
    ...specificNameFindings(lesson, sourceInventory),
    ...duplicateClassificationFindings(lesson),
  ];
  const tasks = requiredTasks(sourceInventory);
  const lessonPeriods = periods(lesson);

  for (const task of tasks) {
    const targetPeriods = task.periodNumber
      ? lessonPeriods.filter((period) => Number(period.periodNumber) === Number(task.periodNumber))
      : lessonPeriods;
    const scopes = targetPeriods.length ? targetPeriods : lessonPeriods;
    const matches = scopes.flatMap((scope) =>
      matchingActivities(task, scope).map((match) => ({ ...match, periodNumber: scope.periodNumber })),
    );
    const label = labelFor(task);

    if (!matches.length) {
      findings.push(finding(
        missingTaskRule(task),
        `${label} thiếu hoạt động bao phủ nhiệm vụ SGK bắt buộc: “${task.label}”.`,
        { periodNumber: task.periodNumber },
      ));
      continue;
    }

    if (task.taskType === "answer_question" || task.taskType === "describe_effect") {
      if (!hasExpectedAnswerEvidence(task, matches)) {
        findings.push(finding(
          naturalSocialCoverageRules.missingExpectedAnswer,
          `${label} có nhiệm vụ “${task.label}” nhưng chưa đưa đáp án dự kiến/ý chấp nhận được vào hoạt động.`,
          { periodNumber: task.periodNumber, activityIndex: matches[0]?.activityIndex },
        ));
      }
    }

    if (task.taskType === "sort_sequence" && !hasProcedureStepEvidence(task, matches)) {
      findings.push(finding(
        naturalSocialCoverageRules.missingSourceProcedure,
        `${label} có nhiệm vụ “${task.label}” nhưng chưa thể hiện đủ các bước/trình tự cốt lõi của SGK.`,
        { periodNumber: task.periodNumber, activityIndex: matches[0]?.activityIndex },
      ));
    }

    if (task.taskType === "practice_product" && !hasPhysicalPracticeEvidence(matches)) {
      findings.push(finding(
        naturalSocialCoverageRules.practiceProductMismatch,
        `${label} nhiệm vụ “${task.label}” là thực hành/tạo sản phẩm; không được thay bằng chỉ nói, vẽ cam kết hoặc quan sát mẫu.`,
        { periodNumber: task.periodNumber, activityIndex: matches[0]?.activityIndex },
      ));
    }

    if (task.taskType === "role_play" && !hasRolePlayResponseEvidence(matches)) {
      findings.push(finding(
        naturalSocialCoverageRules.missingSituationResponse,
        `${label} nhiệm vụ tình huống “${task.label}” cần phần HS nói/xử lí/đóng vai rõ ràng.`,
        { periodNumber: task.periodNumber, activityIndex: matches[0]?.activityIndex },
      ));
    }

    if (task.taskType === "personal_connection" && !hasPersonalConnectionEvidence(matches)) {
      findings.push(finding(
        naturalSocialCoverageRules.missingPersonalConnection,
        `${label} nhiệm vụ “${task.label}” cần học sinh nêu việc bản thân đã làm hoặc trải nghiệm thật, không chỉ cam kết sẽ làm.`,
        { periodNumber: task.periodNumber, activityIndex: matches[0]?.activityIndex },
      ));
    }

    if (!productAndCriteriaArePresent(matches)) {
      findings.push(finding(
        naturalSocialCoverageRules.missingTaskProductOrCriteria,
        `${label} nhiệm vụ “${task.label}” chưa có đủ sản phẩm chính và tiêu chí đánh giá quan sát được.`,
        { periodNumber: task.periodNumber, activityIndex: matches[0]?.activityIndex },
      ));
    }

    findings.push(...practiceSafetyFindings(task, matches));
  }

  const text = lessonText(lesson);
  if (hasOnlyPositiveSourceVisuals(sourceInventory) && hasUnsupportedOppositionClassification(text) && !hasExplicitSupplementalExamples(text)) {
    findings.push(finding(
      naturalSocialCoverageRules.unsupportedClassification,
      "Giáo án tạo hoạt động phân loại có nhóm đối lập nhưng inventory cho thấy các tranh nguồn đều là ví dụ tích cực; cần dùng tranh bổ sung hoặc đổi thành nêu việc làm và tác dụng.",
    ));
  }

  const seen = new Set<string>();
  return findings.filter((item) => {
    const key = `${item.code}|${item.periodNumber || 0}|${item.activityIndex ?? -1}|${item.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function objectArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item))
    : [];
}

export function normalizeNaturalSocialSourceInventory(value: unknown): NaturalSocialSourceInventory | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const raw = value as Record<string, unknown>;
  const inventory: NaturalSocialSourceInventory = {
    visuals: objectArray(raw.visuals).flatMap((item, index) => {
      const label = optionalString(item.label);
      if (!label) return [];
      return [{
        visualId: optionalString(item.visualId) || `visual-${index + 1}`,
        label,
        page: optionalString(item.page),
        description: optionalString(item.description),
        specificName: optionalString(item.specificName),
        habitatPlace: optionalString(item.habitatPlace),
        environmentCategory: optionalString(item.environmentCategory),
        expectedObservation: optionalString(item.expectedObservation),
        effectOrReason: optionalString(item.effectOrReason),
        isPositiveExample: asBoolean(item.isPositiveExample),
        required: item.required === false ? false : undefined,
        sourceEvidence: asStringList(item.sourceEvidence),
      }];
    }),
    questions: objectArray(raw.questions).flatMap((item, index) => {
      const question = optionalString(item.question);
      if (!question) return [];
      return [{
        taskId: optionalString(item.taskId) || `question-${index + 1}`,
        question,
        expectedAnswer: optionalString(item.expectedAnswer),
        visualIds: asStringList(item.visualIds),
        periodNumber: item.periodNumber ? Number(item.periodNumber) : undefined,
        required: item.required === false ? false : undefined,
        sourceEvidence: asStringList(item.sourceEvidence),
      }];
    }),
    procedures: objectArray(raw.procedures).flatMap((item, index) => {
      const label = optionalString(item.label);
      const steps = asStringList(item.steps);
      if (!label || !steps.length) return [];
      return [{
        taskId: optionalString(item.taskId) || `procedure-${index + 1}`,
        label,
        steps,
        visualIds: asStringList(item.visualIds),
        periodNumber: item.periodNumber ? Number(item.periodNumber) : undefined,
        required: item.required === false ? false : undefined,
        sourceEvidence: asStringList(item.sourceEvidence),
      }];
    }),
    practiceTasks: objectArray(raw.practiceTasks).flatMap((item, index) => {
      const label = optionalString(item.label);
      if (!label) return [];
      return [{
        taskId: optionalString(item.taskId) || `practice-${index + 1}`,
        label,
        materials: asStringList(item.materials),
        steps: asStringList(item.steps),
        expectedProduct: optionalString(item.expectedProduct),
        periodNumber: item.periodNumber ? Number(item.periodNumber) : undefined,
        required: item.required === false ? false : undefined,
        safetyNotes: asStringList(item.safetyNotes),
        sourceEvidence: asStringList(item.sourceEvidence),
      }];
    }),
    situations: objectArray(raw.situations).flatMap((item, index) => {
      const label = optionalString(item.label);
      if (!label) return [];
      return [{
        taskId: optionalString(item.taskId) || `situation-${index + 1}`,
        label,
        characters: asStringList(item.characters),
        prompt: optionalString(item.prompt),
        expectedResponse: optionalString(item.expectedResponse),
        periodNumber: item.periodNumber ? Number(item.periodNumber) : undefined,
        required: item.required === false ? false : undefined,
        sourceEvidence: asStringList(item.sourceEvidence),
      }];
    }),
    classificationTasks: objectArray(raw.classificationTasks).flatMap((item, index) => {
      const label = optionalString(item.label);
      const categories = asStringList(item.categories);
      if (!label || !categories.length) return [];
      return [{
        taskId: optionalString(item.taskId) || `classification-${index + 1}`,
        label,
        categories,
        itemLabels: asStringList(item.itemLabels),
        visualIds: asStringList(item.visualIds),
        periodNumber: item.periodNumber ? Number(item.periodNumber) : undefined,
        required: item.required === false ? false : undefined,
        requiresSupplementalExamples: asBoolean(item.requiresSupplementalExamples),
        sourceEvidence: asStringList(item.sourceEvidence),
      }];
    }),
    personalTasks: objectArray(raw.personalTasks).flatMap((item, index) => {
      const label = optionalString(item.label);
      if (!label) return [];
      return [{
        taskId: optionalString(item.taskId) || `personal-${index + 1}`,
        label,
        prompt: optionalString(item.prompt),
        periodNumber: item.periodNumber ? Number(item.periodNumber) : undefined,
        required: item.required === false ? false : undefined,
        sourceEvidence: asStringList(item.sourceEvidence),
      }];
    }),
    safetyConstraints: asStringList(raw.safetyConstraints),
    requiredTasks: objectArray(raw.requiredTasks).flatMap((item, index) => {
      const task = normalizeRequiredTask(item as NaturalSocialRequiredTask, index);
      return task ? [task] : [];
    }),
    uncertain: asStringList(raw.uncertain),
  };

  const hasContent = Boolean(
    inventory.visuals?.length
    || inventory.questions?.length
    || inventory.procedures?.length
    || inventory.practiceTasks?.length
    || inventory.situations?.length
    || inventory.classificationTasks?.length
    || inventory.personalTasks?.length
    || inventory.requiredTasks?.length
    || inventory.safetyConstraints?.length
    || inventory.uncertain?.length,
  );
  return hasContent ? inventory : undefined;
}
