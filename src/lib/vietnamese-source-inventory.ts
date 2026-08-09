import { createHash } from "node:crypto";
import type { LessonInput, UploadedAsset, VietnameseSourceInventory } from "@/types/lesson";

export const VIETNAMESE_SOURCE_INVENTORY_SCHEMA_VERSION = 1;

export const vietnameseSourceComponentKeys = [
  "readingText",
  "readingVocabulary",
  "longSentences",
  "readingQuestions",
  "spellingText",
  "phonicsTasks",
  "punctuationSentences",
  "writingPrompt",
  "materialsByPeriod",
  "requiredTasks",
] as const;

export type VietnameseSourceComponentKey = typeof vietnameseSourceComponentKeys[number];
export type VietnameseSourceComponentStatus = "verified" | "needs_review" | "missing";

export type VietnameseSourceComponentState = {
  status: VietnameseSourceComponentStatus;
  itemCount: number;
  sourceHashes: string[];
};

export type VietnameseSourceInventoryCacheRecord = {
  schemaVersion: number;
  lessonKey: string;
  subject: string;
  grade: string;
  book: string;
  bookVolume: string;
  lessonTitle: string;
  verifiedStatus: VietnameseSourceComponentStatus;
  components: Record<VietnameseSourceComponentKey, VietnameseSourceComponentState>;
  sourceHashes: string[];
  inventory: VietnameseSourceInventory;
};

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function asStringList(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(asStringList);
  if (typeof value === "string") return value.trim() ? [value.trim()] : [];
  if (typeof value === "number" || typeof value === "boolean") return [String(value)];
  return [];
}

function cleanSpaces(value: unknown) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function comparableText(value: unknown) {
  return cleanSpaces(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueStrings(items: unknown[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of items.flatMap(asStringList)) {
    const key = comparableText(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(cleanSpaces(item));
  }
  return result;
}

function firstLonger(left?: string, right?: string) {
  const leftClean = cleanSpaces(left);
  const rightClean = cleanSpaces(right);
  if (!leftClean) return rightClean;
  if (!rightClean) return leftClean;
  return rightClean.length > leftClean.length ? rightClean : leftClean;
}

function countComponentItems(inventory: VietnameseSourceInventory, key: VietnameseSourceComponentKey) {
  switch (key) {
    case "readingText":
      return asStringList(inventory.readingText).length;
    case "readingVocabulary":
      return asStringList(inventory.readingVocabulary).length;
    case "longSentences":
      return Array.isArray(inventory.longSentences) ? inventory.longSentences.filter((item) => item?.sentence || item?.pauseMarked).length : 0;
    case "readingQuestions":
      return Array.isArray(inventory.readingQuestions) ? inventory.readingQuestions.filter((item) => item?.question).length : 0;
    case "spellingText":
      return cleanSpaces(inventory.spellingText).length ? 1 : 0;
    case "phonicsTasks":
      return Array.isArray(inventory.phonicsTasks) ? inventory.phonicsTasks.filter((item) => item?.prompt || item?.items?.length || item?.answers?.length).length : 0;
    case "punctuationSentences":
      return Array.isArray(inventory.punctuationSentences) ? inventory.punctuationSentences.filter((item) => item?.sentence || item?.answer).length : 0;
    case "writingPrompt":
      return inventory.writingPrompt && (
        cleanSpaces(inventory.writingPrompt.sentenceCount).length
        || asStringList(inventory.writingPrompt.objectNames).length
        || asStringList(inventory.writingPrompt.prompts).length
      ) ? 1 : 0;
    case "materialsByPeriod":
      return Array.isArray(inventory.materialsByPeriod) ? inventory.materialsByPeriod.filter((item) => item?.periodNumber || item?.materials?.length).length : 0;
    case "requiredTasks":
      return Array.isArray(inventory.requiredTasks) ? inventory.requiredTasks.filter((item) => item?.label).length : 0;
    default:
      return 0;
  }
}

export function hashUploadedAsset(asset: UploadedAsset) {
  const dataUrl = cleanSpaces(asset.dataUrl);
  const parsed = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (parsed) return sha256(`${parsed[1]}:${parsed[2].replace(/\s+/g, "")}`);
  const fallback = [asset.id, asset.name, asset.mimeType, asset.previewUrl].map(cleanSpaces).join("|");
  return fallback.trim() ? sha256(fallback) : "";
}

export function vietnameseSourceInventoryLessonKey(input: Pick<LessonInput, "subject" | "grade" | "book" | "bookVolume" | "lessonTitle">) {
  const raw = [
    comparableText(input.subject || "Tiếng Việt"),
    comparableText(input.grade),
    comparableText(input.book),
    comparableText(input.bookVolume),
    comparableText(input.lessonTitle),
  ].join("|");
  return `tv_${sha256(raw).slice(0, 40)}`;
}

export function hasStableVietnameseSourceInventoryKey(input: Pick<LessonInput, "lessonTitle">) {
  const title = comparableText(input.lessonTitle);
  if (title.length < 4) return false;
  return !/^(auto|tu nhan dien|de trong|bai hoc|bai tieng viet|khong xac dinh)$/.test(title);
}

export function cleanVietnameseSourceInventory(raw: unknown): VietnameseSourceInventory | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const inventory = raw as VietnameseSourceInventory;
  const cleaned: VietnameseSourceInventory = {
    readingText: uniqueStrings(inventory.readingText || []),
    readingVocabulary: uniqueStrings(inventory.readingVocabulary || []),
    longSentences: Array.isArray(inventory.longSentences)
      ? inventory.longSentences.map((item) => ({
          sentence: cleanSpaces(item?.sentence),
          pauseMarked: cleanSpaces(item?.pauseMarked),
          note: cleanSpaces(item?.note),
        })).filter((item) => item.sentence || item.pauseMarked || item.note)
      : [],
    readingQuestions: Array.isArray(inventory.readingQuestions)
      ? inventory.readingQuestions.map((item) => ({
          question: cleanSpaces(item?.question),
          expectedAnswer: cleanSpaces(item?.expectedAnswer),
          evidence: uniqueStrings(item?.evidence || []),
        })).filter((item) => item.question || item.expectedAnswer || item.evidence.length)
      : [],
    spellingText: cleanSpaces(inventory.spellingText),
    phonicsTasks: Array.isArray(inventory.phonicsTasks)
      ? inventory.phonicsTasks.map((item) => ({
          prompt: cleanSpaces(item?.prompt),
          items: uniqueStrings(item?.items || []),
          answers: uniqueStrings(item?.answers || []),
        })).filter((item) => item.prompt || item.items.length || item.answers.length)
      : [],
    punctuationSentences: Array.isArray(inventory.punctuationSentences)
      ? inventory.punctuationSentences.map((item) => ({
          sentence: cleanSpaces(item?.sentence),
          answer: cleanSpaces(item?.answer),
        })).filter((item) => item.sentence || item.answer)
      : [],
    writingPrompt: inventory.writingPrompt
      ? {
          sentenceCount: cleanSpaces(inventory.writingPrompt.sentenceCount),
          objectNames: uniqueStrings(inventory.writingPrompt.objectNames || []),
          prompts: uniqueStrings(inventory.writingPrompt.prompts || []),
        }
      : undefined,
    materialsByPeriod: Array.isArray(inventory.materialsByPeriod)
      ? inventory.materialsByPeriod.map((item) => ({
          periodNumber: Number(item?.periodNumber || 0),
          materials: uniqueStrings(item?.materials || []),
        })).filter((item) => item.periodNumber > 0 || item.materials.length)
      : [],
    requiredTasks: Array.isArray(inventory.requiredTasks)
      ? inventory.requiredTasks.map((item) => ({
          taskId: cleanSpaces(item?.taskId),
          label: cleanSpaces(item?.label),
          taskType: item?.taskType,
          periodNumber: Number(item?.periodNumber || 0) || undefined,
          sourceText: cleanSpaces(item?.sourceText),
          required: item?.required === false ? false : true,
          productKind: item?.productKind,
          expectedAnswer: cleanSpaces(item?.expectedAnswer),
          criteria: uniqueStrings(item?.criteria || []),
          sourceEvidence: uniqueStrings(item?.sourceEvidence || []),
        })).filter((item) => item.label)
      : [],
    uncertain: uniqueStrings(inventory.uncertain || []),
  };

  return hasUsableVietnameseSourceInventory(cleaned) || cleaned.uncertain?.length ? cleaned : undefined;
}

function mergeByKey<T>(left: T[] | undefined, right: T[] | undefined, keyOf: (item: T) => string, mergeItem: (left: T, right: T) => T): T[] {
  const result: T[] = [];
  const byKey = new Map<string, number>();
  for (const item of [...(left || []), ...(right || [])]) {
    const key = keyOf(item);
    if (!key) continue;
    const existingIndex = byKey.get(key);
    if (existingIndex === undefined) {
      byKey.set(key, result.length);
      result.push(item);
    } else {
      result[existingIndex] = mergeItem(result[existingIndex], item);
    }
  }
  return result;
}

export function mergeVietnameseSourceInventories(
  base?: VietnameseSourceInventory,
  incoming?: VietnameseSourceInventory,
): VietnameseSourceInventory | undefined {
  const left = cleanVietnameseSourceInventory(base);
  const right = cleanVietnameseSourceInventory(incoming);
  if (!left) return right;
  if (!right) return left;

  const merged: VietnameseSourceInventory = {
    readingText: uniqueStrings([...(left.readingText || []), ...(right.readingText || [])]),
    readingVocabulary: uniqueStrings([...(left.readingVocabulary || []), ...(right.readingVocabulary || [])]),
    longSentences: mergeByKey(
      left.longSentences,
      right.longSentences,
      (item) => comparableText(item.sentence || item.pauseMarked),
      (existing, next) => ({
        sentence: firstLonger(existing.sentence, next.sentence),
        pauseMarked: firstLonger(existing.pauseMarked, next.pauseMarked),
        note: firstLonger(existing.note, next.note),
      }),
    ),
    readingQuestions: mergeByKey(
      left.readingQuestions,
      right.readingQuestions,
      (item) => comparableText(item.question),
      (existing, next) => ({
        question: firstLonger(existing.question, next.question),
        expectedAnswer: firstLonger(existing.expectedAnswer, next.expectedAnswer),
        evidence: uniqueStrings([...(existing.evidence || []), ...(next.evidence || [])]),
      }),
    ),
    spellingText: firstLonger(left.spellingText, right.spellingText),
    phonicsTasks: mergeByKey(
      left.phonicsTasks,
      right.phonicsTasks,
      (item) => comparableText(`${item.prompt}|${(item.items || []).join("|")}`),
      (existing, next) => ({
        prompt: firstLonger(existing.prompt, next.prompt),
        items: uniqueStrings([...(existing.items || []), ...(next.items || [])]),
        answers: uniqueStrings([...(existing.answers || []), ...(next.answers || [])]),
      }),
    ),
    punctuationSentences: mergeByKey(
      left.punctuationSentences,
      right.punctuationSentences,
      (item) => comparableText(item.sentence || item.answer),
      (existing, next) => ({
        sentence: firstLonger(existing.sentence, next.sentence),
        answer: firstLonger(existing.answer, next.answer),
      }),
    ),
    writingPrompt: {
      sentenceCount: firstLonger(left.writingPrompt?.sentenceCount, right.writingPrompt?.sentenceCount),
      objectNames: uniqueStrings([...(left.writingPrompt?.objectNames || []), ...(right.writingPrompt?.objectNames || [])]),
      prompts: uniqueStrings([...(left.writingPrompt?.prompts || []), ...(right.writingPrompt?.prompts || [])]),
    },
    materialsByPeriod: mergeByKey(
      left.materialsByPeriod,
      right.materialsByPeriod,
      (item) => String(item.periodNumber || 0),
      (existing, next) => ({
        periodNumber: existing.periodNumber || next.periodNumber,
        materials: uniqueStrings([...(existing.materials || []), ...(next.materials || [])]),
      }),
    ),
    requiredTasks: mergeByKey(
      left.requiredTasks,
      right.requiredTasks,
      (item) => comparableText(item.taskId || `${item.taskType || "other"}|${item.periodNumber || 0}|${item.label}`),
      (existing, next) => ({
        ...existing,
        ...next,
        taskId: firstLonger(existing.taskId, next.taskId),
        label: firstLonger(existing.label, next.label),
        sourceText: firstLonger(existing.sourceText, next.sourceText),
        expectedAnswer: firstLonger(existing.expectedAnswer, next.expectedAnswer),
        criteria: uniqueStrings([...(existing.criteria || []), ...(next.criteria || [])]),
        sourceEvidence: uniqueStrings([...(existing.sourceEvidence || []), ...(next.sourceEvidence || [])]),
        required: existing.required === false && next.required === false ? false : true,
      }),
    ),
    uncertain: uniqueStrings([...(left.uncertain || []), ...(right.uncertain || [])]),
  };

  return cleanVietnameseSourceInventory(merged);
}

export function summarizeVietnameseSourceComponents(
  inventory: VietnameseSourceInventory | undefined,
  sourceHashes: string[] = [],
): Record<VietnameseSourceComponentKey, VietnameseSourceComponentState> {
  const cleaned = cleanVietnameseSourceInventory(inventory) || {};
  return Object.fromEntries(vietnameseSourceComponentKeys.map((key) => {
    const itemCount = countComponentItems(cleaned, key);
    return [key, {
      status: itemCount > 0 ? "verified" : "missing",
      itemCount,
      sourceHashes: uniqueStrings(sourceHashes),
    }];
  })) as Record<VietnameseSourceComponentKey, VietnameseSourceComponentState>;
}

export function hasUsableVietnameseSourceInventory(inventory: VietnameseSourceInventory | undefined) {
  if (!inventory) return false;
  return vietnameseSourceComponentKeys.some((key) => key !== "materialsByPeriod" && countComponentItems(inventory, key) > 0);
}

export function vietnameseSourceVerifiedStatus(inventory: VietnameseSourceInventory | undefined): VietnameseSourceComponentStatus {
  if (!hasUsableVietnameseSourceInventory(inventory)) return "missing";
  return inventory?.uncertain?.length ? "needs_review" : "verified";
}

export function buildVietnameseSourceInventoryRecord(
  input: Pick<LessonInput, "subject" | "grade" | "book" | "bookVolume" | "lessonTitle">,
  inventory: VietnameseSourceInventory,
  sourceHashes: string[] = [],
): VietnameseSourceInventoryCacheRecord | null {
  const cleaned = cleanVietnameseSourceInventory(inventory);
  if (!cleaned || !hasUsableVietnameseSourceInventory(cleaned)) return null;
  return {
    schemaVersion: VIETNAMESE_SOURCE_INVENTORY_SCHEMA_VERSION,
    lessonKey: vietnameseSourceInventoryLessonKey(input),
    subject: cleanSpaces(input.subject || "Tiếng Việt"),
    grade: cleanSpaces(input.grade),
    book: cleanSpaces(input.book),
    bookVolume: cleanSpaces(input.bookVolume),
    lessonTitle: cleanSpaces(input.lessonTitle),
    verifiedStatus: vietnameseSourceVerifiedStatus(cleaned),
    components: summarizeVietnameseSourceComponents(cleaned, sourceHashes),
    sourceHashes: uniqueStrings(sourceHashes),
    inventory: cleaned,
  };
}

export function buildVietnameseSourceInventoryPromptContext(
  ocrText: string,
  cachedInventory?: VietnameseSourceInventory,
) {
  const cleanedInventory = cleanVietnameseSourceInventory(cachedInventory);
  if (!cleanedInventory || !hasUsableVietnameseSourceInventory(cleanedInventory)) return ocrText;

  const cacheContext = [
    "KHO NGỮ LIỆU SGK ĐÃ XÁC MINH (chỉ dùng làm nguồn SGK sạch, không phải giáo án cũ):",
    JSON.stringify(cleanedInventory, null, 2),
    "Yêu cầu: ưu tiên kho ngữ liệu đã xác minh khi trích câu hỏi/đáp án/ngữ liệu; vẫn sinh mới kịch bản dạy học, không lặp lại giáo án cũ.",
  ].join("\n");

  return [cacheContext, ocrText?.trim() ? `NỘI DUNG ẢNH/OCR MỚI:\n${ocrText.trim()}` : ""]
    .filter(Boolean)
    .join("\n\n");
}
