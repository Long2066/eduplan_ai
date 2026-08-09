import type { LessonInput, UploadedAsset } from "@/types/lesson";

export const MAX_GENERATION_REQUEST_BYTES = 3_500_000;
export const MAX_OPTIMIZED_IMAGE_BYTES = 850_000;
const MAX_IMAGE_DIMENSION = 1600;
const MIN_IMAGE_DIMENSION = 900;
const INITIAL_JPEG_QUALITY = 0.82;
const MIN_JPEG_QUALITY = 0.55;

export function utf8ByteLength(value: string) {
  return new TextEncoder().encode(value).byteLength;
}

export function dataUrlByteLength(dataUrl: string) {
  const commaIndex = dataUrl.indexOf(",");
  if (commaIndex < 0) return 0;
  const base64 = dataUrl.slice(commaIndex + 1).replace(/\s/g, "");
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}

export function createGenerationInput(input: LessonInput): LessonInput {
  return {
    ...input,
    uploadedAssets: input.uploadedAssets.map(({ previewUrl: _previewUrl, ...asset }) => asset),
  };
}

export function serializeGenerationInput(input: LessonInput) {
  const payload = JSON.stringify(createGenerationInput(input));
  return { payload, bytes: utf8ByteLength(payload) };
}

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Không thể đọc ảnh. Vui lòng chọn ảnh JPG hoặc PNG khác."));
    };
    image.src = objectUrl;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error("Không thể tối ưu ảnh này.")),
      "image/jpeg",
      quality,
    );
  });
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Không thể đọc ảnh sau khi tối ưu."));
    reader.readAsDataURL(blob);
  });
}

function dimensionsWithin(width: number, height: number, maxDimension: number) {
  const scale = Math.min(1, maxDimension / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export async function optimizeLessonImage(file: File) {
  const image = await loadImage(file);
  let maxDimension = MAX_IMAGE_DIMENSION;
  let quality = INITIAL_JPEG_QUALITY;
  let bestBlob: Blob | null = null;

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const { width, height } = dimensionsWithin(image.naturalWidth, image.naturalHeight, maxDimension);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("Trình duyệt không thể xử lý ảnh này.");

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(image, 0, 0, width, height);
    const blob = await canvasToBlob(canvas, quality);
    if (!bestBlob || blob.size < bestBlob.size) bestBlob = blob;
    if (blob.size <= MAX_OPTIMIZED_IMAGE_BYTES) return blobToDataUrl(blob);

    if (quality > MIN_JPEG_QUALITY) {
      quality = Math.max(MIN_JPEG_QUALITY, quality - 0.07);
    } else if (maxDimension > MIN_IMAGE_DIMENSION) {
      maxDimension = Math.max(MIN_IMAGE_DIMENSION, Math.round(maxDimension * 0.82));
      quality = 0.72;
    }
  }

  if (bestBlob && bestBlob.size <= MAX_OPTIMIZED_IMAGE_BYTES) return blobToDataUrl(bestBlob);
  throw new Error("Ảnh vẫn quá lớn sau khi tối ưu. Vui lòng chụp gần nội dung bài học hơn hoặc chia thành nhiều ảnh.");
}

export async function optimizeAvatarImage(file: File) {
  const image = await loadImage(file);
  let maxDimension = 1024;
  let quality = 0.84;
  let bestBlob: Blob | null = null;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const { width, height } = dimensionsWithin(image.naturalWidth, image.naturalHeight, maxDimension);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("Trình duyệt không thể xử lý ảnh đại diện này.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(image, 0, 0, width, height);
    const blob = await canvasToBlob(canvas, quality);
    if (!bestBlob || blob.size < bestBlob.size) bestBlob = blob;
    if (blob.size <= 300 * 1024) return new File([blob], "avatar.jpg", { type: "image/jpeg", lastModified: Date.now() });
    quality = Math.max(0.58, quality - 0.08);
    if (quality <= 0.58) maxDimension = Math.max(640, Math.round(maxDimension * 0.82));
  }

  if (!bestBlob || bestBlob.size > 300 * 1024) throw new Error("Không thể giảm ảnh đại diện xuống dung lượng an toàn. Vui lòng chọn ảnh khác.");
  return new File([bestBlob], "avatar.jpg", { type: "image/jpeg", lastModified: Date.now() });
}

export function assetPreviewUrl(asset: UploadedAsset) {
  return asset.previewUrl || asset.dataUrl || "";
}
