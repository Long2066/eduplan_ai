import "server-only";
import { getFirebaseDb } from "@/lib/firebase-admin";
import {
  buildVietnameseSourceInventoryRecord,
  cleanVietnameseSourceInventory,
  hashUploadedAsset,
  hasStableVietnameseSourceInventoryKey,
  hasUsableVietnameseSourceInventory,
  mergeVietnameseSourceInventories,
  vietnameseSourceInventoryLessonKey,
  type VietnameseSourceInventoryCacheRecord,
} from "@/lib/vietnamese-source-inventory";
import type { LessonInput, UploadedAsset, VietnameseSourceInventory } from "@/types/lesson";

const OCR_CACHE_COLLECTION = "lessonOcrCache";
const VIETNAMESE_SOURCE_COLLECTION = "vietnameseSourceInventories";
const OCR_CACHE_SCHEMA_VERSION = 1;

type OcrCacheRecord = {
  schemaVersion: number;
  assetHash: string;
  text: string;
  model: string;
  assetName?: string;
  mimeType?: string;
  createdAt?: Date;
  updatedAt?: Date;
  lastUsedAt?: Date;
};

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

function ocrCacheDocId(assetHash: string) {
  return `sha_${assetHash}`;
}

export async function readCachedOcrText(assetHash: string): Promise<string | null> {
  if (!cacheEnabled() || !assetHash) return null;
  const ref = getFirebaseDb().collection(OCR_CACHE_COLLECTION).doc(ocrCacheDocId(assetHash));
  const snapshot = await ref.get();
  if (!snapshot.exists) return null;
  const data = snapshot.data() as Partial<OcrCacheRecord> | undefined;
  const text = typeof data?.text === "string" ? data.text.trim() : "";
  if (!text) return null;
  await ref.set({ lastUsedAt: new Date() }, { merge: true }).catch(() => undefined);
  return text;
}

export async function saveCachedOcrText(asset: UploadedAsset, text: string, model: string): Promise<void> {
  if (!cacheEnabled()) return;
  const assetHash = hashUploadedAsset(asset);
  if (!assetHash || !text.trim()) return;
  const ref = getFirebaseDb().collection(OCR_CACHE_COLLECTION).doc(ocrCacheDocId(assetHash));
  const now = new Date();
  const snapshot = await ref.get();
  await ref.set(stripUndefinedDeep({
    schemaVersion: OCR_CACHE_SCHEMA_VERSION,
    assetHash,
    text: text.trim(),
    model,
    assetName: asset.name,
    mimeType: asset.mimeType,
    createdAt: snapshot.exists ? snapshot.data()?.createdAt : now,
    updatedAt: now,
    lastUsedAt: now,
  } satisfies OcrCacheRecord), { merge: true });
}

export function hashUploadedAssets(assets: UploadedAsset[]) {
  return assets.map(hashUploadedAsset).filter(Boolean);
}

export async function readVietnameseSourceInventory(
  input: Pick<LessonInput, "subject" | "grade" | "book" | "bookVolume" | "lessonTitle">,
): Promise<VietnameseSourceInventoryCacheRecord | null> {
  if (!cacheEnabled()) return null;
  if (!hasStableVietnameseSourceInventoryKey(input)) return null;
  const lessonKey = vietnameseSourceInventoryLessonKey(input);
  const snapshot = await getFirebaseDb().collection(VIETNAMESE_SOURCE_COLLECTION).doc(lessonKey).get();
  if (!snapshot.exists) return null;
  const data = snapshot.data() as Partial<VietnameseSourceInventoryCacheRecord> | undefined;
  const inventory = cleanVietnameseSourceInventory(data?.inventory);
  if (!inventory || !hasUsableVietnameseSourceInventory(inventory)) return null;
  const record = buildVietnameseSourceInventoryRecord(input, inventory, data?.sourceHashes || []);
  return record ? { ...record, verifiedStatus: data?.verifiedStatus || record.verifiedStatus } : null;
}

export async function upsertVietnameseSourceInventory(
  input: Pick<LessonInput, "subject" | "grade" | "book" | "bookVolume" | "lessonTitle">,
  incomingInventory: VietnameseSourceInventory | undefined,
  sourceHashes: string[] = [],
): Promise<VietnameseSourceInventoryCacheRecord | null> {
  if (!cacheEnabled()) return null;
  if (!hasStableVietnameseSourceInventoryKey(input)) return null;
  const cleanedIncoming = cleanVietnameseSourceInventory(incomingInventory);
  if (!cleanedIncoming || !hasUsableVietnameseSourceInventory(cleanedIncoming)) return null;

  const lessonKey = vietnameseSourceInventoryLessonKey(input);
  const ref = getFirebaseDb().collection(VIETNAMESE_SOURCE_COLLECTION).doc(lessonKey);
  const snapshot = await ref.get();
  const existing = snapshot.exists ? snapshot.data() as Partial<VietnameseSourceInventoryCacheRecord> : undefined;
  const merged = mergeVietnameseSourceInventories(
    cleanVietnameseSourceInventory(existing?.inventory),
    cleanedIncoming,
  );
  if (!merged) return null;
  const allSourceHashes = Array.from(new Set([...(existing?.sourceHashes || []), ...sourceHashes].filter(Boolean)));
  const record = buildVietnameseSourceInventoryRecord(input, merged, allSourceHashes);
  if (!record) return null;
  const now = new Date();
  await ref.set(stripUndefinedDeep({
    ...record,
    createdAt: existing?.["createdAt" as keyof typeof existing] || now,
    updatedAt: now,
  }), { merge: true });
  return record;
}
