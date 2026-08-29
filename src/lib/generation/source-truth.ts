import {
  extractOcrLessonTitleEvidence,
  resolveLessonTitle,
  type LessonTitleEvidence,
  type LessonTitleResolution,
} from "@/lib/lesson-title";
import type {
  LessonInput,
  NaturalSocialSourceInventory,
  VietnameseSourceInventory,
} from "@/types/lesson";

export type SourceTruthTask = {
  id: string;
  label: string;
  kind: string;
  periodNumber?: number;
  expectedAnswer?: string;
  source: "ocr" | "natural-social-inventory" | "vietnamese-inventory";
  evidence?: string[];
};

export type SourceTruthVisual = {
  id: string;
  label: string;
  page?: string;
  description?: string;
  source: "ocr" | "natural-social-inventory";
  evidence?: string[];
};

export type SourceTruth = {
  version: 1;
  subject: string;
  grade: string;
  lessonTitle: string;
  periods: number;
  sourceHashes: string[];
  ocrExcerpt: string;
  pageNumbers: string[];
  /** Kept as strings so staged-v1 artifacts remain readable across deploys. */
  titleCandidates: string[];
  titleEvidence?: LessonTitleEvidence[];
  lessonIdentity?: LessonTitleResolution;
  tasks: SourceTruthTask[];
  visuals: SourceTruthVisual[];
  uncertain: string[];
};

function clean(value: unknown) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function uniqueStrings(values: unknown[]) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values.map(clean).filter(Boolean)) {
    const key = value.toLocaleLowerCase("vi");
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }
  return result;
}

function lines(value: string) {
  return String(value || "")
    .split(/\r?\n/)
    .map(clean)
    .filter((line) => line.length >= 3);
}

function pageNumbers(ocrText: string) {
  return uniqueStrings(Array.from(ocrText.matchAll(/(?:trang|tr\.)\s*(\d{1,3})/gi)).map((match) => match[1]));
}


const ocrTaskPattern = /(?:\?|hãy|nêu|kể|viết|đọc|tính|giải|quan sát|thảo luận|chia sẻ|luyện tập|vận dụng|bài\s*\d+|câu\s*\d+)/i;
const ocrVisualPattern = /(?:hình|tranh|ảnh|bảng|lược đồ|sơ đồ)\s*\d*|quan sát/i;

function ocrTasks(ocrText: string): SourceTruthTask[] {
  return lines(ocrText)
    .filter((line) => ocrTaskPattern.test(line))
    .slice(0, 24)
    .map((line, index) => ({
      id: `ocr-task-${index + 1}`,
      label: line,
      kind: /quan sát|hình|tranh|ảnh/i.test(line) ? "observe" : /viết/i.test(line) ? "write" : /đọc/i.test(line) ? "read" : "task",
      source: "ocr" as const,
      evidence: [line],
    }));
}

function ocrVisuals(ocrText: string): SourceTruthVisual[] {
  return lines(ocrText)
    .filter((line) => ocrVisualPattern.test(line))
    .slice(0, 16)
    .map((line, index) => ({
      id: `ocr-visual-${index + 1}`,
      label: line,
      description: line,
      source: "ocr" as const,
      evidence: [line],
    }));
}

function naturalSocialTasks(inventory?: NaturalSocialSourceInventory): SourceTruthTask[] {
  if (!inventory) return [];
  return [
    ...(inventory.requiredTasks || []).map((task, index) => ({
      id: task.taskId || `nsxh-required-${index + 1}`,
      label: clean(task.label),
      kind: task.taskType || "required",
      periodNumber: task.periodNumber,
      expectedAnswer: clean(task.expectedAnswer),
      source: "natural-social-inventory" as const,
      evidence: uniqueStrings([task.sourceText, ...(task.sourceEvidence || [])]),
    })),
    ...(inventory.questions || []).map((task, index) => ({
      id: task.taskId || `nsxh-question-${index + 1}`,
      label: clean(task.question),
      kind: "answer_question",
      periodNumber: task.periodNumber,
      expectedAnswer: clean(task.expectedAnswer),
      source: "natural-social-inventory" as const,
      evidence: uniqueStrings(task.sourceEvidence || []),
    })),
    ...(inventory.practiceTasks || []).map((task, index) => ({
      id: task.taskId || `nsxh-practice-${index + 1}`,
      label: clean(task.label),
      kind: "practice_product",
      periodNumber: task.periodNumber,
      expectedAnswer: clean(task.expectedProduct),
      source: "natural-social-inventory" as const,
      evidence: uniqueStrings([...(task.materials || []), ...(task.steps || []), ...(task.sourceEvidence || [])]),
    })),
  ].filter((task) => task.label);
}

function naturalSocialVisuals(inventory?: NaturalSocialSourceInventory): SourceTruthVisual[] {
  return (inventory?.visuals || []).map((visual, index) => ({
    id: visual.visualId || `nsxh-visual-${index + 1}`,
    label: clean(visual.specificName || visual.label),
    page: clean(visual.page),
    description: clean(visual.description || visual.expectedObservation),
    source: "natural-social-inventory" as const,
    evidence: uniqueStrings(visual.sourceEvidence || []),
  })).filter((visual) => visual.label);
}

function vietnameseTasks(inventory?: VietnameseSourceInventory): SourceTruthTask[] {
  if (!inventory) return [];
  return [
    ...(inventory.requiredTasks || []).map((task, index) => ({
      id: task.taskId || `tv-required-${index + 1}`,
      label: clean(task.label),
      kind: task.taskType || "required",
      periodNumber: task.periodNumber,
      expectedAnswer: clean(task.expectedAnswer),
      source: "vietnamese-inventory" as const,
      evidence: uniqueStrings([task.sourceText, ...(task.sourceEvidence || [])]),
    })),
    ...(inventory.readingQuestions || []).map((task, index) => ({
      id: `tv-question-${index + 1}`,
      label: clean(task.question),
      kind: "reading-question",
      expectedAnswer: clean(task.expectedAnswer),
      source: "vietnamese-inventory" as const,
      evidence: uniqueStrings(task.evidence || []),
    })),
  ].filter((task) => task.label);
}

export function buildSourceTruth(options: {
  input: LessonInput;
  ocrText?: string;
  sourceHashes?: string[];
  naturalSocialInventory?: NaturalSocialSourceInventory;
  vietnameseInventory?: VietnameseSourceInventory;
}): SourceTruth {
  const ocrText = options.ocrText || "";
  const titleEvidence = extractOcrLessonTitleEvidence(ocrText);
  const lessonIdentity = resolveLessonTitle({
    subject: options.input.subject,
    ocrText,
    candidates: [{ value: options.input.lessonTitle, source: "user-input", confidence: 0.95 }],
  });
  return {
    version: 1,
    subject: clean(options.input.subject),
    grade: clean(options.input.grade),
    lessonTitle: lessonIdentity.status === "resolved" ? lessonIdentity.title : "",
    periods: Math.max(1, Number(options.input.periods || 1)),
    sourceHashes: uniqueStrings(options.sourceHashes || []),
    ocrExcerpt: clean(ocrText).slice(0, 8000),
    pageNumbers: pageNumbers(ocrText),
    titleCandidates: uniqueStrings(
      titleEvidence.map((candidate) => candidate.title),
    ).slice(0, 8),
    titleEvidence,
    lessonIdentity,
    tasks: [
      ...naturalSocialTasks(options.naturalSocialInventory),
      ...vietnameseTasks(options.vietnameseInventory),
      ...ocrTasks(ocrText),
    ],
    visuals: [
      ...naturalSocialVisuals(options.naturalSocialInventory),
      ...ocrVisuals(ocrText),
    ],
    uncertain: uniqueStrings([
      ...(options.naturalSocialInventory?.uncertain || []),
      ...(options.vietnameseInventory?.uncertain || []),
      ...(!ocrText.trim() ? ["Không có OCR text để đối chiếu nguồn SGK."] : []),
      ...(lessonIdentity.status === "unresolved" ? [lessonIdentity.reason] : []),
    ]),
  };
}

export function sourceTruthPromptContext(sourceTruth: SourceTruth | undefined, fallbackOcrText = "") {
  if (!sourceTruth) return fallbackOcrText;
  const compact = {
    subject: sourceTruth.subject,
    grade: sourceTruth.grade,
    lessonTitle: sourceTruth.lessonTitle,
    lessonIdentity: sourceTruth.lessonIdentity || null,
    periods: sourceTruth.periods,
    pageNumbers: sourceTruth.pageNumbers,
    titleCandidates: (sourceTruth.titleCandidates || []).slice(0, 6),
    titleEvidence: (sourceTruth.titleEvidence || []).slice(0, 6).map((candidate) => ({
      title: candidate.title,
      confidence: candidate.confidence,
      evidence: candidate.evidence,
      lineStart: candidate.lineStart,
      lineEnd: candidate.lineEnd,
    })),
    tasks: (sourceTruth.tasks || []).slice(0, 32).map((task) => ({
      id: task.id,
      label: task.label,
      kind: task.kind,
      periodNumber: task.periodNumber,
      expectedAnswer: task.expectedAnswer,
      source: task.source,
    })),
    visuals: (sourceTruth.visuals || []).slice(0, 24).map((visual) => ({
      id: visual.id,
      label: visual.label,
      page: visual.page,
      description: visual.description,
      source: visual.source,
    })),
    uncertain: sourceTruth.uncertain || [],
  };
  return [
    "SOURCE_TRUTH_JSON - nguồn chân lý đã chuẩn hóa từ ảnh/OCR/cache, ưu tiên cao hơn suy luận chủ đề:",
    JSON.stringify(compact),
    "OCR_EXCERPT:",
    sourceTruth.ocrExcerpt || fallbackOcrText.slice(0, 8000),
  ].join("\n");
}
