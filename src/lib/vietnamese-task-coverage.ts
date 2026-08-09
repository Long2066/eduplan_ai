import type {
  LessonActivity,
  LessonInput,
  LessonPlan,
  PedagogyAuditFinding,
  PeriodPlan,
  VietnameseSourceInventory,
} from "@/types/lesson";

type VietnameseCoverageTask = NonNullable<VietnameseSourceInventory["requiredTasks"]>[number];

const taskCoverageRules = {
  missingRequiredTaskActivity: { code: "TV-COVERAGE-01", severity: "error", autoFixable: true },
  missingRequiredTaskAnswer: { code: "TV-COVERAGE-02", severity: "error", autoFixable: true },
  productModeMismatch: { code: "TV-COVERAGE-03", severity: "warning", autoFixable: true },
  missingTaskProductOrCriteria: { code: "TV-COVERAGE-04", severity: "warning", autoFixable: true },
} as const;

type CoverageRule = typeof taskCoverageRules[keyof typeof taskCoverageRules];

function finding(rule: CoverageRule, message: string, location: Partial<PedagogyAuditFinding> = {}): PedagogyAuditFinding {
  return { code: rule.code, severity: rule.severity, autoFixable: rule.autoFixable, message, ...location };
}

function asStringList(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(asStringList);
  if (typeof value === "string") return value.trim() ? [value.trim()] : [];
  if (typeof value === "number" || typeof value === "boolean") return [String(value)];
  return [];
}

function comparableText(value: string) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const stopWords = new Set([
  "anh", "bai", "ban", "bang", "cac", "cau", "cho", "cua", "duoc", "dung", "giao", "hoc", "hoc sinh",
  "hoac", "khi", "lop", "mot", "nhiem", "noi", "qua", "sach", "sgk", "tiet", "trong", "tu", "va", "viec", "voi", "yeu",
]);

function contentWords(value: string) {
  return comparableText(value)
    .split(" ")
    .filter((word) => word.length >= 3 && !stopWords.has(word));
}

function textOverlap(left: string, right: string) {
  const leftWords = new Set(contentWords(left));
  const rightWords = new Set(contentWords(right));
  if (!leftWords.size || !rightWords.size) return 0;
  const hits = [...leftWords].filter((word) => rightWords.has(word)).length;
  return hits / Math.min(leftWords.size, rightWords.size);
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
  ].join(" ");
}

function taskText(task: VietnameseCoverageTask) {
  return [
    task.label,
    task.sourceText || "",
    task.expectedAnswer || "",
    ...(task.sourceEvidence || []),
    ...(task.criteria || []),
  ].join(" ");
}

function taskTypePattern(task: VietnameseCoverageTask) {
  switch (task.taskType) {
    case "startup":
      return /khởi động|kể|chia sẻ|dự đoán|quan sát/i;
    case "reading-fluency":
      return /đọc mẫu|luyện đọc|đọc thành tiếng|đọc nối tiếp|đọc thầm|ngắt nghỉ|giọng đọc/i;
    case "reading-question":
      return /câu hỏi|hỏi|trả lời|đọc hiểu|tìm chi tiết|vì sao|theo lời|nêu/i;
    case "memorization":
      return /học thuộc|thuộc lòng|đọc thuộc|đọc nhẩm|che dần|từ khóa/i;
    case "vocabulary":
      return /từ khó|giải nghĩa|hiểu nghĩa|từ ngữ/i;
    case "phonics":
      return /âm|vần|ch\/tr|c\/k|ac\/at|điền|phân biệt|ghép tiếng/i;
    case "spelling":
      return /nghe[- ]?viết|nhớ[- ]?viết|chính tả|soát lỗi/i;
    case "punctuation":
      return /dấu chấm|dấu chấm hỏi|dấu câu|điền dấu/i;
    case "sentence-writing":
      return /đặt câu|viết câu|viết hai câu|viết 2 câu|nói.{0,20}câu|vào vở|bảng con|phiếu/i;
    case "composition":
      return /tìm ý|lập ý|viết đoạn|viết bài|viết 3|viết 5|đọc soát|chỉnh sửa/i;
    case "language-knowledge":
      return /từ chỉ|từ ngữ|phân loại|xếp nhóm|đặt câu|luyện từ|câu/i;
    case "speaking":
      return /nói|kể|trình bày|chia sẻ|trao đổi/i;
    case "listening":
      return /nghe|người nghe|ghi chú|hỏi lại|nhận xét/i;
    case "extension":
      return /vận dụng|mở rộng|khi còn thời gian|về nhà/i;
    default:
      return /./;
  }
}

function taskProductKind(task: VietnameseCoverageTask): NonNullable<VietnameseCoverageTask["productKind"]> {
  if (task.productKind) return task.productKind;
  if (task.taskType === "sentence-writing" || task.taskType === "composition") return "written";
  if (task.taskType === "memorization") return "memorized";
  if (task.taskType === "reading-question") return "answer";
  if (task.taskType === "reading-fluency") return "reading";
  if (task.taskType === "spelling") return "spelling";
  if (task.taskType === "phonics") return "phonics";
  if (task.taskType === "punctuation") return "punctuation";
  if (task.taskType === "language-knowledge") return "classification";
  if (task.taskType === "speaking" || task.taskType === "startup" || task.taskType === "listening") return "oral";
  return "other";
}

function generatedTasksFromInventory(sourceInventory: VietnameseSourceInventory): VietnameseCoverageTask[] {
  const generated: VietnameseCoverageTask[] = [];
  for (const question of sourceInventory.readingQuestions || []) {
    if (!question.question?.trim()) continue;
    generated.push({
      label: question.question,
      taskType: "reading-question",
      required: true,
      productKind: "answer",
      expectedAnswer: question.expectedAnswer,
      sourceEvidence: question.evidence,
    });
  }
  if (sourceInventory.spellingText?.trim()) {
    generated.push({
      label: "Nghe - viết/chính tả đúng đoạn trong SGK",
      taskType: "spelling",
      required: true,
      productKind: "spelling",
      sourceText: sourceInventory.spellingText,
    });
  }
  for (const task of sourceInventory.phonicsTasks || []) {
    if (!task.prompt && !task.items?.length) continue;
    generated.push({
      label: task.prompt || `Bài âm/vần: ${(task.items || []).join(", ")}`,
      taskType: "phonics",
      required: true,
      productKind: "phonics",
      sourceText: [...(task.items || []), ...(task.answers || [])].join("; "),
      expectedAnswer: (task.answers || []).join("; "),
    });
  }
  if (sourceInventory.punctuationSentences?.length) {
    generated.push({
      label: "Điền dấu câu theo các câu trong SGK",
      taskType: "punctuation",
      required: true,
      productKind: "punctuation",
      sourceText: sourceInventory.punctuationSentences.map((item) => item.sentence).join("; "),
      expectedAnswer: sourceInventory.punctuationSentences.map((item) => item.answer).join("; "),
    });
  }
  if (sourceInventory.writingPrompt?.sentenceCount || sourceInventory.writingPrompt?.prompts?.length) {
    generated.push({
      label: sourceInventory.writingPrompt.sentenceCount || "Viết câu/đoạn theo yêu cầu SGK",
      taskType: /câu/i.test(sourceInventory.writingPrompt.sentenceCount || "") ? "sentence-writing" : "composition",
      required: true,
      productKind: "written",
      sourceText: [
        sourceInventory.writingPrompt.sentenceCount || "",
        ...(sourceInventory.writingPrompt.objectNames || []),
        ...(sourceInventory.writingPrompt.prompts || []),
      ].join("; "),
    });
  }
  return generated;
}

function requiredTasks(sourceInventory?: VietnameseSourceInventory): VietnameseCoverageTask[] {
  if (!sourceInventory) return [];
  const explicit = (sourceInventory.requiredTasks || []).filter((task) => task?.label && task.required !== false);
  const generated = generatedTasksFromInventory(sourceInventory);
  const seen = new Set<string>();
  return [...explicit, ...generated].filter((task) => {
    const key = `${task.taskType || "other"}|${comparableText(task.label)}|${task.periodNumber || 0}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function matchingActivities(task: VietnameseCoverageTask, scope: PeriodPlan) {
  const taskComparable = taskText(task);
  const pattern = taskTypePattern(task);
  return (scope.activities || []).flatMap((activity, activityIndex) => {
    const text = activityText(activity);
    const typeHit = pattern.test(text);
    const overlap = textOverlap(text, taskComparable);
    const requiresExplicitTypeSignal = task.taskType === "memorization";
    if (requiresExplicitTypeSignal && !typeHit) return [];
    if (!typeHit && overlap < 0.18) return [];
    return [{ activity, activityIndex, text, overlap }];
  });
}

function hasWrittenProductEvidence(activity: LessonActivity) {
  return /viết|ghi|vào vở|bảng con|phiếu|bài viết|câu viết|đặt câu/i.test([
    activity.objective,
    ...(activity.teacherActions || []),
    ...(activity.studentActions || []),
    ...(activity.learningProducts || []),
    activity.expectedAnswer || "",
    ...(activity.acceptableResponses || []),
  ].join(" "));
}

function hasExpectedAnswerEvidence(task: VietnameseCoverageTask, matches: ReturnType<typeof matchingActivities>) {
  const expected = task.expectedAnswer || "";
  if (!expected.trim()) return true;
  return matches.some(({ activity, text }) => {
    const answerText = [activity.expectedAnswer || "", ...(activity.acceptableResponses || []), text].join(" ");
    return textOverlap(answerText, expected) >= 0.24 || comparableText(answerText).includes(comparableText(expected).slice(0, 28));
  });
}

function productAndCriteriaArePresent(matches: ReturnType<typeof matchingActivities>) {
  return matches.some(({ activity }) =>
    Boolean(activity.learningProducts?.some((item) => item.trim()))
    && Boolean(activity.successCriteria?.some((item) => item.trim())),
  );
}

export function validateVietnameseTaskCoverage(
  lesson: LessonPlan,
  input: LessonInput,
  sourceInventory?: VietnameseSourceInventory,
): PedagogyAuditFinding[] {
  const tasks = requiredTasks(sourceInventory);
  if (!tasks.length) return [];

  const lessonPeriods = periods(lesson);
  const findings: PedagogyAuditFinding[] = [];

  for (const task of tasks) {
    const targetPeriods = task.periodNumber
      ? lessonPeriods.filter((period) => Number(period.periodNumber) === Number(task.periodNumber))
      : lessonPeriods;
    const scopes = targetPeriods.length ? targetPeriods : lessonPeriods;
    const matches = scopes.flatMap((scope) =>
      matchingActivities(task, scope).map((match) => ({ ...match, periodNumber: scope.periodNumber })),
    );
    const kind = taskProductKind(task);
    const label = task.periodNumber ? `Tiết ${task.periodNumber}` : "Giáo án";

    if (!matches.length) {
      findings.push(finding(
        taskCoverageRules.missingRequiredTaskActivity,
        `${label} thiếu hoạt động bao phủ nhiệm vụ SGK bắt buộc: “${task.label}”.`,
        { periodNumber: task.periodNumber },
      ));
      continue;
    }

    if ((task.taskType === "reading-question" || task.taskType === "phonics" || task.taskType === "punctuation") && !hasExpectedAnswerEvidence(task, matches)) {
      findings.push(finding(
        taskCoverageRules.missingRequiredTaskAnswer,
        `${label} có nhiệm vụ “${task.label}” nhưng chưa đưa đáp án dự kiến/chi tiết chấp nhận được vào hoạt động.`,
        { periodNumber: task.periodNumber, activityIndex: matches[0]?.activityIndex },
      ));
    }

    if ((kind === "written" || kind === "spelling" || kind === "punctuation") && !matches.some(({ activity }) => hasWrittenProductEvidence(activity))) {
      findings.push(finding(
        taskCoverageRules.productModeMismatch,
        `${label} nhiệm vụ “${task.label}” cần sản phẩm viết nhưng hoạt động chưa thể hiện HS viết vào vở, bảng con hoặc phiếu.`,
        { periodNumber: task.periodNumber, activityIndex: matches[0]?.activityIndex },
      ));
    }

    if (!productAndCriteriaArePresent(matches)) {
      findings.push(finding(
        taskCoverageRules.missingTaskProductOrCriteria,
        `${label} nhiệm vụ “${task.label}” chưa có đủ sản phẩm chính và tiêu chí đánh giá quan sát được.`,
        { periodNumber: task.periodNumber, activityIndex: matches[0]?.activityIndex },
      ));
    }
  }

  const seen = new Set<string>();
  return findings.filter((item) => {
    const key = `${item.code}|${item.periodNumber || 0}|${item.activityIndex ?? -1}|${item.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
