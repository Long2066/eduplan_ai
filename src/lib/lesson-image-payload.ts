import type { UploadedAsset } from "@/types/lesson";

export const MAX_LESSON_IMAGE_BYTES = 900_000;
export const MAX_LESSON_IMAGES_TOTAL_BYTES = 2_600_000;

export function dataUrlDecodedBytes(dataUrl: string) {
  const match = dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/\s]+={0,2})$/i);
  if (!match) return null;
  const base64 = match[2].replace(/\s/g, "");
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}

export function validateLessonImagePayload(assets: UploadedAsset[]) {
  let totalBytes = 0;
  for (const asset of assets) {
    if (!asset.dataUrl) return "Dữ liệu ảnh SGK bị thiếu. Vui lòng tải lại ảnh.";
    const bytes = dataUrlDecodedBytes(asset.dataUrl);
    if (bytes === null) return "Dữ liệu ảnh SGK không hợp lệ. Vui lòng tải lại ảnh JPG hoặc PNG.";
    if (bytes > MAX_LESSON_IMAGE_BYTES) return `Ảnh “${asset.name}” quá lớn. Vui lòng tải lại để hệ thống tối ưu ảnh.`;
    totalBytes += bytes;
  }
  if (totalBytes > MAX_LESSON_IMAGES_TOTAL_BYTES) {
    return "Tổng dung lượng ảnh SGK quá lớn. Vui lòng xóa bớt ảnh hoặc chụp gần nội dung bài học hơn.";
  }
  return null;
}
