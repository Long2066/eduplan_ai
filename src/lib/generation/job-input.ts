import "server-only";
import { createHash } from "node:crypto";
import { validateLessonImagePayload } from "@/lib/lesson-image-payload";
import { LESSON_TITLE_REQUIRED_MESSAGE, isSpecificLessonTitle } from "@/lib/lesson-title";
import type { LessonInput, UploadedAsset } from "@/types/lesson";

export class GenerationJobRequestError extends Error {
  status: number;
  code: string;

  constructor(message: string, code: string, status = 400) {
    super(message);
    this.name = "GENERATION_JOB_REQUEST";
    this.code = code;
    this.status = status;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => canonicalize(item));
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .flatMap((key) => value[key] === undefined ? [] : [[key, canonicalize(value[key])]]),
    );
  }
  return value;
}

export function requireGenerationIdempotencyKey(value: string | null) {
  const key = value?.trim() || "";
  if (key.length < 8 || key.length > 180 || /[\u0000-\u001f\u007f]/.test(key)) {
    throw new GenerationJobRequestError(
      "Thiếu hoặc sai idempotency-key cho yêu cầu tạo giáo án.",
      "INVALID_IDEMPOTENCY_KEY",
    );
  }
  return key;
}

export function generationJobDocumentId(uid: string, idempotencyKey: string) {
  return createHash("sha256")
    .update(`generation-job:${uid}:${idempotencyKey}`)
    .digest("hex");
}

export function generationInputFingerprint(input: LessonInput) {
  const uploadedAssets = (Array.isArray(input.uploadedAssets) ? input.uploadedAssets : []).map((asset) => {
    const { previewUrl: _previewUrl, ...stableAsset } = asset;
    return stableAsset;
  });
  const serialized = JSON.stringify(canonicalize({ ...input, uploadedAssets }));
  return createHash("sha256").update(serialized).digest("hex");
}

export function validateGenerationJobInput(value: unknown): LessonInput {
  if (!isRecord(value)) {
    throw new GenerationJobRequestError("Dữ liệu tạo giáo án không hợp lệ.", "INVALID_GENERATION_INPUT");
  }

  for (const field of ["subject", "grade"] as const) {
    if (typeof value[field] !== "string" || !value[field].trim()) {
      throw new GenerationJobRequestError(`Thiếu trường ${field}.`, "INVALID_GENERATION_INPUT");
    }
  }

  if (value.lessonTitle !== undefined && typeof value.lessonTitle !== "string") {
    throw new GenerationJobRequestError("Trường lessonTitle không hợp lệ.", "INVALID_GENERATION_INPUT");
  }
  const lessonTitle = typeof value.lessonTitle === "string" ? value.lessonTitle.trim() : "";

  const periods = Number(value.periods);
  if (!Number.isFinite(periods) || periods < 1) {
    throw new GenerationJobRequestError("Số tiết của giáo án không hợp lệ.", "INVALID_GENERATION_INPUT");
  }

  const uploadedAssets = value.uploadedAssets === undefined ? [] : value.uploadedAssets;
  if (!Array.isArray(uploadedAssets)) {
    throw new GenerationJobRequestError("Danh sách ảnh SGK không hợp lệ.", "INVALID_GENERATION_INPUT");
  }
  if (uploadedAssets.length > 10) {
    throw new GenerationJobRequestError("Tối đa 10 ảnh SGK mỗi lần tạo.", "TOO_MANY_GENERATION_ASSETS");
  }

  for (const asset of uploadedAssets) {
    if (!isRecord(asset)
      || typeof asset.id !== "string"
      || typeof asset.name !== "string"
      || typeof asset.dataUrl !== "string") {
      throw new GenerationJobRequestError("Thông tin ảnh SGK không hợp lệ.", "INVALID_GENERATION_ASSET");
    }
  }

  const imagePayloadError = validateLessonImagePayload(uploadedAssets as UploadedAsset[]);
  if (imagePayloadError) {
    throw new GenerationJobRequestError(imagePayloadError, "INVALID_GENERATION_ASSET", 413);
  }
  if (!uploadedAssets.length && !isSpecificLessonTitle(lessonTitle, String(value.subject || ""))) {
    throw new GenerationJobRequestError(
      LESSON_TITLE_REQUIRED_MESSAGE,
      "LESSON_TITLE_UNRESOLVED",
      422,
    );
  }

  return { ...value, lessonTitle, periods: Math.floor(periods), uploadedAssets } as LessonInput;
}

export function validateGenerationOcrAsset(value: unknown): UploadedAsset {
  if (!isRecord(value)
    || typeof value.id !== "string"
    || typeof value.name !== "string"
    || typeof value.dataUrl !== "string") {
    throw new GenerationJobRequestError("Thông tin ảnh OCR không hợp lệ.", "INVALID_GENERATION_OCR_ASSET");
  }

  const asset = value as UploadedAsset;
  const imagePayloadError = validateLessonImagePayload([asset]);
  if (imagePayloadError) {
    throw new GenerationJobRequestError(imagePayloadError, "INVALID_GENERATION_OCR_ASSET", 413);
  }
  return asset;
}
