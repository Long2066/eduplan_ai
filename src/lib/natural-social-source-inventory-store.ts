import "server-only";
import { getFirebaseDb } from "@/lib/firebase-admin";
import {
  buildNaturalSocialSourceInventoryRecord,
  cleanNaturalSocialSourceInventory,
  hasStableNaturalSocialSourceInventoryKey,
  hasUsableNaturalSocialSourceInventory,
  mergeNaturalSocialSourceInventories,
  naturalSocialSourceInventoryLessonKey,
  type NaturalSocialSourceInventoryCacheRecord,
} from "@/lib/natural-social-source-inventory";
import type { LessonInput, NaturalSocialSourceInventory } from "@/types/lesson";

const NATURAL_SOCIAL_SOURCE_COLLECTION = "naturalSocialSourceInventories";

function cacheEnabled() {
  return process.env.LESSON_SOURCE_CACHE_ENABLED !== "false";
}

function stripUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => stripUndefinedDeep(item)) as T;
  if (value instanceof Date) return value;
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).flatMap(([key, item]) => (
        item === undefined ? [] : [[key, stripUndefinedDeep(item)]]
      )),
    ) as T;
  }
  return value;
}

export async function readNaturalSocialSourceInventory(
  input: Pick<LessonInput, "subject" | "grade" | "book" | "bookVolume" | "lessonTitle">,
): Promise<NaturalSocialSourceInventoryCacheRecord | null> {
  if (!cacheEnabled()) return null;
  if (!hasStableNaturalSocialSourceInventoryKey(input)) return null;
  const lessonKey = naturalSocialSourceInventoryLessonKey(input);
  const snapshot = await getFirebaseDb().collection(NATURAL_SOCIAL_SOURCE_COLLECTION).doc(lessonKey).get();
  if (!snapshot.exists) return null;
  const data = snapshot.data() as Partial<NaturalSocialSourceInventoryCacheRecord> | undefined;
  const inventory = cleanNaturalSocialSourceInventory(data?.inventory);
  if (!inventory || !hasUsableNaturalSocialSourceInventory(inventory)) return null;
  const record = buildNaturalSocialSourceInventoryRecord(input, inventory, data?.sourceHashes || []);
  return record ? { ...record, verifiedStatus: data?.verifiedStatus || record.verifiedStatus } : null;
}

export async function upsertNaturalSocialSourceInventory(
  input: Pick<LessonInput, "subject" | "grade" | "book" | "bookVolume" | "lessonTitle">,
  incomingInventory: NaturalSocialSourceInventory | undefined,
  sourceHashes: string[] = [],
): Promise<NaturalSocialSourceInventoryCacheRecord | null> {
  if (!cacheEnabled()) return null;
  if (!hasStableNaturalSocialSourceInventoryKey(input)) return null;
  const cleanedIncoming = cleanNaturalSocialSourceInventory(incomingInventory);
  if (!cleanedIncoming || !hasUsableNaturalSocialSourceInventory(cleanedIncoming)) return null;

  const lessonKey = naturalSocialSourceInventoryLessonKey(input);
  const ref = getFirebaseDb().collection(NATURAL_SOCIAL_SOURCE_COLLECTION).doc(lessonKey);
  const snapshot = await ref.get();
  const existing = snapshot.exists ? snapshot.data() as Partial<NaturalSocialSourceInventoryCacheRecord> : undefined;
  const merged = mergeNaturalSocialSourceInventories(
    cleanNaturalSocialSourceInventory(existing?.inventory),
    cleanedIncoming,
  );
  if (!merged) return null;
  const allSourceHashes = Array.from(new Set([...(existing?.sourceHashes || []), ...sourceHashes].filter(Boolean)));
  const record = buildNaturalSocialSourceInventoryRecord(input, merged, allSourceHashes);
  if (!record) return null;
  const now = new Date();
  await ref.set(stripUndefinedDeep({
    ...record,
    createdAt: existing?.["createdAt" as keyof typeof existing] || now,
    updatedAt: now,
  }), { merge: true });
  return record;
}
