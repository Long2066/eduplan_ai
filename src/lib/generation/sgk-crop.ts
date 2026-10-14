import sharp from "sharp";
import type { LessonActivity, LessonActivityVisual, UploadedAsset } from "@/types/lesson";

export type NormalizedBoundingBox = {
  /** 0 to 1 or 0 to 1000 */
  ymin: number;
  xmin: number;
  ymax: number;
  xmax: number;
};

export type CropOptions = {
  paddingPercent?: number;
  maxWidth?: number;
  format?: "png" | "jpeg";
};

export function parseDataUrlToBuffer(dataUrl: string): { buffer: Buffer; mimeType: string } | null {
  if (!dataUrl || typeof dataUrl !== "string") return null;
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  try {
    return {
      mimeType: match[1],
      buffer: Buffer.from(match[2], "base64"),
    };
  } catch {
    return null;
  }
}

export function bufferToDataUrl(buffer: Buffer, mimeType = "image/png"): string {
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

/**
 * Cắt ảnh SGK theo bounding box với Smart Padding (chống chém cụt nét chữ/dấu thanh)
 * và tự động co dãn vừa vặn cột GV trong bảng 2 cột DOCX.
 */
export async function cropImageWithPadding(
  imageInput: Buffer | string,
  box: NormalizedBoundingBox,
  options: CropOptions = {},
): Promise<{ buffer: Buffer; dataUrl: string; width: number; height: number } | null> {
  const paddingPercent = options.paddingPercent ?? 0.08; // 8% an toàn viền
  const targetMaxWidth = options.maxWidth ?? 480; // Phù hợp độ rộng cột GV ~6.5cm

  let inputBuffer: Buffer;
  if (typeof imageInput === "string") {
    const parsed = parseDataUrlToBuffer(imageInput);
    if (!parsed) return null;
    inputBuffer = parsed.buffer;
  } else {
    inputBuffer = imageInput;
  }

  try {
    const image = sharp(inputBuffer);
    const metadata = await image.metadata();
    const origWidth = metadata.width || 800;
    const origHeight = metadata.height || 1000;

    // Chuẩn hóa tọa độ: nếu box ở thang 0-1000, đưa về 0-1
    let ymin = box.ymin > 1 ? box.ymin / 1000 : box.ymin;
    let xmin = box.xmin > 1 ? box.xmin / 1000 : box.xmin;
    let ymax = box.ymax > 1 ? box.ymax / 1000 : box.ymax;
    let xmax = box.xmax > 1 ? box.xmax / 1000 : box.xmax;

    // Đảm bảo min < max
    if (ymin > ymax) [ymin, ymax] = [ymax, ymin];
    if (xmin > xmax) [xmin, xmax] = [xmax, xmin];

    // Chuyển sang pixel thực tế
    let left = Math.round(xmin * origWidth);
    let top = Math.round(ymin * origHeight);
    let right = Math.round(xmax * origWidth);
    let bottom = Math.round(ymax * origHeight);

    const boxW = right - left;
    const boxH = bottom - top;

    // Bổ sung Smart Padding để không chém lẹm dấu thanh và đuôi chữ
    const padX = Math.round(boxW * paddingPercent);
    const padY = Math.round(boxH * paddingPercent);

    left = Math.max(0, Math.min(origWidth - 1, left - padX));
    top = Math.max(0, Math.min(origHeight - 1, top - padY));
    right = Math.min(origWidth, Math.max(left + 1, right + padX));
    bottom = Math.min(origHeight, Math.max(top + 1, bottom + padY));

    const cropWidth = Math.min(origWidth - left, Math.max(1, right - left));
    const cropHeight = Math.min(origHeight - top, Math.max(1, bottom - top));

    let pipeline = sharp(inputBuffer).extract({
      left,
      top,
      width: cropWidth,
      height: cropHeight,
    });

    // Resize nếu lớn hơn maxWidth để giữ bảng DOCX không bị vỡ cột
    let outWidth = cropWidth;
    let outHeight = cropHeight;
    if (cropWidth > targetMaxWidth) {
      outWidth = targetMaxWidth;
      outHeight = Math.round((cropHeight * targetMaxWidth) / cropWidth);
      pipeline = pipeline.resize(outWidth, outHeight, { fit: "inside" });
    }

    const outBuffer = await pipeline.png({ quality: 90, compressionLevel: 8 }).toBuffer();
    const dataUrl = bufferToDataUrl(outBuffer, "image/png");

    return {
      buffer: outBuffer,
      dataUrl,
      width: outWidth,
      height: outHeight,
    };
  } catch (err) {
    console.error("[sgk-crop] Lỗi khi cắt ảnh SGK:", err);
    return null;
  }
}

/**
 * Bản đồ vùng chuẩn của bài học SGK (áp dụng mẫu điển hình lớp 1 KNTT)
 * Các tọa độ chuẩn hóa [ymin, xmin, ymax, xmax] trên trang sách
 */
export const STANDARD_GRADE1_REGIONS: Record<string, NormalizedBoundingBox> = {
  // Tranh nhận biết / khởi động (nửa trên trang trái)
  warmup_recognition: { ymin: 40, xmin: 50, ymax: 320, xmax: 950 },
  // Mô hình vần và khung ghép tiếng (phần giữa trang trái)
  phonics_model: { ymin: 330, xmin: 50, ymax: 560, xmax: 950 },
  // Dãy tiếng và từ ngữ ứng dụng (nửa dưới trang trái)
  vocabulary_words: { ymin: 570, xmin: 50, ymax: 820, xmax: 950 },
  // Khung mẫu chữ viết ô li (dưới cùng trang trái)
  handwriting_sample: { ymin: 830, xmin: 50, ymax: 970, xmax: 950 },
  // Đoạn đọc ứng dụng (nửa trên trang phải)
  reading_passage: { ymin: 50, xmin: 50, ymax: 480, xmax: 950 },
  // Tranh luyện nói và nghe (nửa dưới trang phải)
  speaking_listening: { ymin: 500, xmin: 50, ymax: 950, xmax: 950 },
};

/**
 * Bản đồ vùng chuẩn của SGK Lớp 2–5 KNTT
 */
export const STANDARD_GRADE2_5_REGIONS: Record<string, NormalizedBoundingBox> = {
  // Tranh minh họa đầu bài đọc / khởi động
  reading_header_illustration: { ymin: 40, xmin: 50, ymax: 380, xmax: 950 },
  // Khung văn bản đọc / đoạn chính tả
  reading_main_text: { ymin: 390, xmin: 50, ymax: 750, xmax: 950 },
  // Hệ thống câu hỏi đọc hiểu / bài tập / luyện từ và câu
  reading_questions_exercises: { ymin: 760, xmin: 50, ymax: 980, xmax: 950 },
  // Tranh chủ đề luyện nói / viết sáng tạo
  speaking_illustration: { ymin: 200, xmin: 50, ymax: 700, xmax: 950 },
};

/**
 * Phân tích và tự động gắn ảnh cắt SGK vào đúng hoạt động của cột GV
 */
export async function attachSgkCropsToActivities(
  activities: LessonActivity[],
  assets: UploadedAsset[],
  options: { grade?: number; lessonType?: string } = {},
): Promise<LessonActivity[]> {
  const imageAssets = (assets || []).filter(
    (a) => a.type === "image" && a.dataUrl && a.dataUrl.startsWith("data:image/"),
  );

  if (imageAssets.length === 0) {
    return activities;
  }

  // Sắp xếp assets theo thứ tự trang (trang 1 = trang trái, trang 2 = trang phải nếu có)
  const page1Asset = imageAssets[0];
  const page2Asset = imageAssets.length > 1 ? imageAssets[1] : imageAssets[0];
  const grade = options.grade ?? 1;

  const updatedActivities: LessonActivity[] = [];

  for (let i = 0; i < activities.length; i++) {
    const act = { ...activities[i] };
    const textDesc = `${act.phase} ${act.title} ${act.objective}`.toLowerCase();

    let targetBox: NormalizedBoundingBox | null = null;
    let targetAsset: UploadedAsset = page1Asset;
    let caption = "";

    if (grade === 1) {
      if (/khởi động|nhận diện|nhận biết|tranh khởi động/i.test(textDesc)) {
        targetBox = STANDARD_GRADE1_REGIONS.warmup_recognition;
        targetAsset = page1Asset;
        caption = "Tranh nhận biết SGK";
      } else if (/cấu tạo vần|ghép âm|ghép tiếng|đánh vần|mô hình vần|khám phá vần/i.test(textDesc)) {
        targetBox = STANDARD_GRADE1_REGIONS.phonics_model;
        targetAsset = page1Asset;
        caption = "Mô hình vần và ghép tiếng SGK";
      } else if (/từ ngữ ứng dụng|luyện đọc tiếng|từ ứng dụng|tiếng mới|đọc từ/i.test(textDesc)) {
        targetBox = STANDARD_GRADE1_REGIONS.vocabulary_words;
        targetAsset = page1Asset;
        caption = "Dãy tiếng và từ ngữ ứng dụng SGK";
      } else if (/tập viết|viết bảng|viết vở|mẫu chữ|hướng dẫn viết|luyện viết|viết vần|viết từ/i.test(textDesc)) {
        targetBox = STANDARD_GRADE1_REGIONS.handwriting_sample;
        targetAsset = page1Asset;
        caption = "Mẫu chữ viết chuẩn ô li SGK";
      } else if (/đoạn đọc|câu ứng dụng|đọc hiểu|đọc câu|đọc đoạn/i.test(textDesc)) {
        targetBox = STANDARD_GRADE1_REGIONS.reading_passage;
        targetAsset = page2Asset;
        caption = "Đoạn văn đọc ứng dụng SGK";
      } else if (/nói và nghe|luyện nói|xin lỗi|chủ đề nói|kể chuyện/i.test(textDesc)) {
        targetBox = STANDARD_GRADE1_REGIONS.speaking_listening;
        targetAsset = page2Asset;
        caption = "Tranh chủ đề luyện nói SGK";
      }
    } else {
      // Grade 2-5
      if (/khởi động|tranh minh họa|nhận biết/i.test(textDesc)) {
        targetBox = STANDARD_GRADE2_5_REGIONS.reading_header_illustration;
        targetAsset = page1Asset;
        caption = "Tranh minh họa SGK";
      } else if (/đọc văn bản|luyện đọc|chính tả|nghe viết|tập chép/i.test(textDesc)) {
        targetBox = STANDARD_GRADE2_5_REGIONS.reading_main_text;
        targetAsset = page1Asset;
        caption = "Văn bản SGK";
      } else if (/tìm hiểu bài|câu hỏi|bài tập|luyện từ và câu/i.test(textDesc)) {
        targetBox = STANDARD_GRADE2_5_REGIONS.reading_questions_exercises;
        targetAsset = page2Asset;
        caption = "Hệ thống câu hỏi / bài tập SGK";
      } else if (/nói và nghe|luyện nói|kể chuyện|trao đổi|trình bày/i.test(textDesc)) {
        targetBox = STANDARD_GRADE2_5_REGIONS.speaking_illustration;
        targetAsset = page2Asset;
        caption = "Tranh chủ đề luyện nói SGK";
      }
    }

    if (targetBox && targetAsset?.dataUrl) {
      const crop = await cropImageWithPadding(targetAsset.dataUrl, targetBox, {
        paddingPercent: 0.06,
        maxWidth: 320, // Rộng ~6cm trong cột bảng Word
      });

      if (crop) {
        const visual: LessonActivityVisual = {
          id: `vis_${act.id || i}_${Date.now()}`,
          caption,
          dataUrl: crop.dataUrl,
          widthPx: crop.width,
          heightPx: crop.height,
          sourcePage: targetAsset.name || "SGK",
          alt: caption,
        };
        act.teacherVisuals = [visual];
      }
    }

    updatedActivities.push(act);
  }

  return updatedActivities;
}
