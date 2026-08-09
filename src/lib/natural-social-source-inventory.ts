import { createHash } from "node:crypto";
import { normalizeNaturalSocialSourceInventory } from "@/lib/natural-social-task-coverage";
import type { LessonInput, NaturalSocialSourceInventory } from "@/types/lesson";

export const NATURAL_SOCIAL_SOURCE_INVENTORY_SCHEMA_VERSION = 1;

export const naturalSocialSourceComponentKeys = [
  "visuals",
  "questions",
  "procedures",
  "practiceTasks",
  "situations",
  "classificationTasks",
  "personalTasks",
  "safetyConstraints",
  "requiredTasks",
] as const;

export type NaturalSocialSourceComponentKey = typeof naturalSocialSourceComponentKeys[number];
export type NaturalSocialSourceComponentStatus = "verified" | "needs_review" | "missing";

export type NaturalSocialSourceComponentState = {
  status: NaturalSocialSourceComponentStatus;
  itemCount: number;
  sourceHashes: string[];
};

export type NaturalSocialSourceInventoryCacheRecord = {
  schemaVersion: number;
  lessonKey: string;
  subject: string;
  grade: string;
  book: string;
  bookVolume: string;
  lessonTitle: string;
  verifiedStatus: NaturalSocialSourceComponentStatus;
  components: Record<NaturalSocialSourceComponentKey, NaturalSocialSourceComponentState>;
  sourceHashes: string[];
  inventory: NaturalSocialSourceInventory;
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

function nonEmpty(value: unknown) {
  return cleanSpaces(value).length > 0;
}

function countComponentItems(inventory: NaturalSocialSourceInventory, key: NaturalSocialSourceComponentKey) {
  switch (key) {
    case "visuals":
      return Array.isArray(inventory.visuals) ? inventory.visuals.filter((item) => nonEmpty(item.label)).length : 0;
    case "questions":
      return Array.isArray(inventory.questions) ? inventory.questions.filter((item) => nonEmpty(item.question)).length : 0;
    case "procedures":
      return Array.isArray(inventory.procedures) ? inventory.procedures.filter((item) => nonEmpty(item.label) || item.steps?.length).length : 0;
    case "practiceTasks":
      return Array.isArray(inventory.practiceTasks) ? inventory.practiceTasks.filter((item) => nonEmpty(item.label)).length : 0;
    case "situations":
      return Array.isArray(inventory.situations) ? inventory.situations.filter((item) => nonEmpty(item.label) || nonEmpty(item.prompt)).length : 0;
    case "classificationTasks":
      return Array.isArray(inventory.classificationTasks) ? inventory.classificationTasks.filter((item) => nonEmpty(item.label) || item.categories?.length).length : 0;
    case "personalTasks":
      return Array.isArray(inventory.personalTasks) ? inventory.personalTasks.filter((item) => nonEmpty(item.label) || nonEmpty(item.prompt)).length : 0;
    case "safetyConstraints":
      return asStringList(inventory.safetyConstraints).length;
    case "requiredTasks":
      return Array.isArray(inventory.requiredTasks) ? inventory.requiredTasks.filter((item) => nonEmpty(item.label)).length : 0;
    default:
      return 0;
  }
}

function firstLonger(left?: string, right?: string) {
  const leftClean = cleanSpaces(left);
  const rightClean = cleanSpaces(right);
  if (!leftClean) return rightClean;
  if (!rightClean) return leftClean;
  return rightClean.length > leftClean.length ? rightClean : leftClean;
}

function mergeStringList(left: unknown, right: unknown) {
  return uniqueStrings([...asStringList(left), ...asStringList(right)]);
}

function mergeByKey<T extends Record<string, unknown>>(
  left: T[] | undefined,
  right: T[] | undefined,
  keyOf: (item: T) => string,
  mergeItem: (left: T, right: T) => T,
) {
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

function mergeSourceItem<T extends Record<string, unknown>>(left: T, right: T): T {
  const merged = { ...left } as Record<string, unknown>;
  for (const [key, value] of Object.entries(right)) {
    if (value === undefined || value === null) continue;
    if (typeof value === "string" && !value.trim()) continue;
    if (Array.isArray(value) && !value.length) continue;
    merged[key] = value;
  }
  for (const key of ["sourceEvidence", "visualIds", "steps", "materials", "safetyNotes", "categories", "itemLabels", "characters", "criteria"]) {
    if (key in left || key in right) merged[key] = mergeStringList(left[key], right[key]);
  }
  for (const key of ["description", "expectedObservation", "effectOrReason", "expectedAnswer", "prompt", "expectedResponse", "sourceText", "label", "question"]) {
    if (key in left || key in right) merged[key] = firstLonger(String(left[key] || ""), String(right[key] || ""));
  }
  return merged as T;
}

function itemKey(item: Record<string, unknown>, idKeys: string[], textKeys: string[]) {
  for (const key of idKeys) {
    const value = comparableText(item[key]);
    if (value) return value;
  }
  return textKeys.map((key) => comparableText(item[key])).filter(Boolean).join("|");
}

export function naturalSocialSourceInventoryLessonKey(input: Pick<LessonInput, "subject" | "grade" | "book" | "bookVolume" | "lessonTitle">) {
  const raw = [
    comparableText(input.subject || "Tự nhiên và Xã hội"),
    comparableText(input.grade),
    comparableText(input.book),
    comparableText(input.bookVolume),
    comparableText(input.lessonTitle),
  ].join("|");
  return `nsxh_${sha256(raw).slice(0, 40)}`;
}

export function hasStableNaturalSocialSourceInventoryKey(input: Pick<LessonInput, "lessonTitle">) {
  const title = comparableText(input.lessonTitle);
  if (title.length < 4) return false;
  return !/^(auto|tu nhan dien|de trong|bai hoc|bai tu nhien va xa hoi|khong xac dinh)$/.test(title);
}

export function cleanNaturalSocialSourceInventory(raw: unknown): NaturalSocialSourceInventory | undefined {
  return normalizeNaturalSocialSourceInventory(raw);
}

export function hasUsableNaturalSocialSourceInventory(inventory: NaturalSocialSourceInventory | undefined) {
  if (!inventory) return false;
  return naturalSocialSourceComponentKeys.some((key) => countComponentItems(inventory, key) > 0);
}

export function mergeNaturalSocialSourceInventories(
  base?: NaturalSocialSourceInventory,
  incoming?: NaturalSocialSourceInventory,
): NaturalSocialSourceInventory | undefined {
  const left = cleanNaturalSocialSourceInventory(base);
  const right = cleanNaturalSocialSourceInventory(incoming);
  if (!left) return right;
  if (!right) return left;

  const merged: NaturalSocialSourceInventory = {
    visuals: mergeByKey(
      left.visuals as Record<string, unknown>[] | undefined,
      right.visuals as Record<string, unknown>[] | undefined,
      (item) => itemKey(item, ["visualId"], ["label", "page"]),
      mergeSourceItem,
    ) as NaturalSocialSourceInventory["visuals"],
    questions: mergeByKey(
      left.questions as Record<string, unknown>[] | undefined,
      right.questions as Record<string, unknown>[] | undefined,
      (item) => itemKey(item, ["taskId"], ["question"]),
      mergeSourceItem,
    ) as NaturalSocialSourceInventory["questions"],
    procedures: mergeByKey(
      left.procedures as Record<string, unknown>[] | undefined,
      right.procedures as Record<string, unknown>[] | undefined,
      (item) => itemKey(item, ["taskId"], ["label"]),
      mergeSourceItem,
    ) as NaturalSocialSourceInventory["procedures"],
    practiceTasks: mergeByKey(
      left.practiceTasks as Record<string, unknown>[] | undefined,
      right.practiceTasks as Record<string, unknown>[] | undefined,
      (item) => itemKey(item, ["taskId"], ["label"]),
      mergeSourceItem,
    ) as NaturalSocialSourceInventory["practiceTasks"],
    situations: mergeByKey(
      left.situations as Record<string, unknown>[] | undefined,
      right.situations as Record<string, unknown>[] | undefined,
      (item) => itemKey(item, ["taskId"], ["label", "prompt"]),
      mergeSourceItem,
    ) as NaturalSocialSourceInventory["situations"],
    classificationTasks: mergeByKey(
      left.classificationTasks as Record<string, unknown>[] | undefined,
      right.classificationTasks as Record<string, unknown>[] | undefined,
      (item) => itemKey(item, ["taskId"], ["label"]),
      mergeSourceItem,
    ) as NaturalSocialSourceInventory["classificationTasks"],
    personalTasks: mergeByKey(
      left.personalTasks as Record<string, unknown>[] | undefined,
      right.personalTasks as Record<string, unknown>[] | undefined,
      (item) => itemKey(item, ["taskId"], ["label", "prompt"]),
      mergeSourceItem,
    ) as NaturalSocialSourceInventory["personalTasks"],
    safetyConstraints: uniqueStrings([...(left.safetyConstraints || []), ...(right.safetyConstraints || [])]),
    requiredTasks: mergeByKey(
      left.requiredTasks as Record<string, unknown>[] | undefined,
      right.requiredTasks as Record<string, unknown>[] | undefined,
      (item) => itemKey(item, ["taskId"], ["label", "sourceText"]),
      mergeSourceItem,
    ) as NaturalSocialSourceInventory["requiredTasks"],
    uncertain: uniqueStrings([...(left.uncertain || []), ...(right.uncertain || [])]),
  };

  return cleanNaturalSocialSourceInventory(merged);
}

export function summarizeNaturalSocialSourceComponents(
  inventory: NaturalSocialSourceInventory,
  sourceHashes: string[] = [],
): Record<NaturalSocialSourceComponentKey, NaturalSocialSourceComponentState> {
  return Object.fromEntries(naturalSocialSourceComponentKeys.map((key) => {
    const itemCount = countComponentItems(inventory, key);
    return [key, {
      status: itemCount > 0 ? "verified" : "missing",
      itemCount,
      sourceHashes: itemCount > 0 ? uniqueStrings(sourceHashes) : [],
    } satisfies NaturalSocialSourceComponentState];
  })) as Record<NaturalSocialSourceComponentKey, NaturalSocialSourceComponentState>;
}

export function buildNaturalSocialSourceInventoryRecord(
  input: Pick<LessonInput, "subject" | "grade" | "book" | "bookVolume" | "lessonTitle">,
  inventory: NaturalSocialSourceInventory | undefined,
  sourceHashes: string[] = [],
): NaturalSocialSourceInventoryCacheRecord | null {
  const cleaned = cleanNaturalSocialSourceInventory(inventory);
  if (!cleaned || !hasUsableNaturalSocialSourceInventory(cleaned)) return null;
  const components = summarizeNaturalSocialSourceComponents(cleaned, sourceHashes);
  const missingCount = naturalSocialSourceComponentKeys.filter((key) => components[key].status === "missing").length;
  return {
    schemaVersion: NATURAL_SOCIAL_SOURCE_INVENTORY_SCHEMA_VERSION,
    lessonKey: naturalSocialSourceInventoryLessonKey(input),
    subject: cleanSpaces(input.subject || "Tự nhiên và Xã hội"),
    grade: cleanSpaces(input.grade),
    book: cleanSpaces(input.book),
    bookVolume: cleanSpaces(input.bookVolume),
    lessonTitle: cleanSpaces(input.lessonTitle),
    verifiedStatus: missingCount ? "needs_review" : "verified",
    components,
    sourceHashes: uniqueStrings(sourceHashes),
    inventory: cleaned,
  };
}
