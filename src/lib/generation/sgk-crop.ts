import sharp from "sharp";
import { getTaphuanBookByKey, taphuanCatalog } from "@/lib/taphuan-catalog";
import { fetchTaphuanReaderPages, fetchTaphuanPageBuffer } from "@/lib/taphuan-reader";
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

export type AttachSgkCropOptions = {
  subject?: string;
  grade?: number;
  lessonType?: string;
  periodNumber?: number;
  paddingPercent?: number;
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
 * Cắt ảnh SGK theo bounding box với Smart Padding (chống chém cụt nét chữ, đề bài, dấu thanh)
 * và tự động co dãn vừa vặn cột GV trong bảng 2 cột DOCX (~6.5cm - 7.5cm).
 */
export async function cropImageWithPadding(
  imageInput: Buffer | string,
  box: NormalizedBoundingBox,
  options: CropOptions = {},
): Promise<{ buffer: Buffer; dataUrl: string; width: number; height: number } | null> {
  const paddingPercent = options.paddingPercent ?? 0.08; // 8% an toàn viền
  const targetMaxWidth = options.maxWidth ?? 340; // Phù hợp độ rộng cột GV ~6.5cm trong Word DOCX

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

    // Bổ sung Smart Padding để không chém lẹm dấu thanh, số thứ tự và đường kẻ ô li
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

    // Resize nếu lớn hơn maxWidth để giữ bảng DOCX không bị bung cột
    let outWidth = cropWidth;
    let outHeight = cropHeight;
    if (cropWidth > targetMaxWidth) {
      outWidth = targetMaxWidth;
      outHeight = Math.round((cropHeight * targetMaxWidth) / cropWidth);
      pipeline = pipeline.resize(outWidth, outHeight, { fit: "inside" });
    }

    const isPng = options.format === "png";
    const outBuffer = isPng
      ? await pipeline.png({ quality: 85, compressionLevel: 8 }).toBuffer()
      : await pipeline.jpeg({ quality: 75, mozjpeg: true }).toBuffer();
    const dataUrl = bufferToDataUrl(outBuffer, isPng ? "image/png" : "image/jpeg");

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

// ─── 1. BẢN ĐỒ VÙNG CHUẨN TIẾNG VIỆT LỚP 1 (KNTT) ───
export const STANDARD_GRADE1_REGIONS: Record<string, NormalizedBoundingBox> = {
  warmup_recognition: { ymin: 40, xmin: 50, ymax: 320, xmax: 950 },
  phonics_model: { ymin: 330, xmin: 50, ymax: 560, xmax: 950 },
  vocabulary_words: { ymin: 570, xmin: 50, ymax: 820, xmax: 950 },
  handwriting_sample: { ymin: 830, xmin: 50, ymax: 970, xmax: 950 },
  reading_passage: { ymin: 50, xmin: 50, ymax: 480, xmax: 950 },
  speaking_listening: { ymin: 500, xmin: 50, ymax: 950, xmax: 950 },
};

// ─── 2. BẢN ĐỒ VÙNG CHUẨN TIẾNG VIỆT LỚP 2–5 ───
export const STANDARD_GRADE2_5_REGIONS: Record<string, NormalizedBoundingBox> = {
  reading_header_illustration: { ymin: 40, xmin: 50, ymax: 380, xmax: 950 },
  reading_main_text: { ymin: 390, xmin: 50, ymax: 750, xmax: 950 },
  reading_questions_exercises: { ymin: 760, xmin: 50, ymax: 980, xmax: 950 },
  handwriting_sample: { ymin: 40, xmin: 50, ymax: 500, xmax: 950 },
  speaking_illustration: { ymin: 200, xmin: 50, ymax: 700, xmax: 950 },
};

// ─── 3. BẢN ĐỒ VÙNG CHUẨN MÔN TOÁN (LỚP 1–5) ───
export const STANDARD_MATH_REGIONS: Record<string, NormalizedBoundingBox> = {
  warmup_problem: { ymin: 40, xmin: 50, ymax: 360, xmax: 950 }, // Bài toán mở đầu / Tình huống
  concept_visual: { ymin: 340, xmin: 50, ymax: 600, xmax: 950 }, // Que tính / Khối lập phương / Tia số
  exercise_1: { ymin: 580, xmin: 50, ymax: 800, xmax: 950 },     // Bài tập 1
  exercise_2: { ymin: 780, xmin: 50, ymax: 980, xmax: 950 },     // Bài tập 2 / 3
  page2_exercises: { ymin: 50, xmin: 50, ymax: 600, xmax: 950 }, // Bài tập trang 2 / Luyện tập
  applied_math: { ymin: 600, xmin: 50, ymax: 980, xmax: 950 },   // Vận dụng / Trò chơi toán
};

// ─── 4. BẢN ĐỒ VÙNG CHUẨN TỰ NHIÊN VÀ XÃ HỘI & KHOA HỌC (LỚP 1–5) ───
export const STANDARD_NATURAL_SOCIAL_REGIONS: Record<string, NormalizedBoundingBox> = {
  warmup_situation: { ymin: 40, xmin: 50, ymax: 350, xmax: 950 },   // Tranh khởi động
  observation_figures: { ymin: 340, xmin: 50, ymax: 720, xmax: 950 },// Cụm hình quan sát 1, 2, 3
  experiment_practice: { ymin: 700, xmin: 50, ymax: 980, xmax: 950 },// Sơ đồ thí nghiệm / xử lí
  page2_practice: { ymin: 50, xmin: 50, ymax: 600, xmax: 950 },     // Thực hành trang 2
  application: { ymin: 600, xmin: 50, ymax: 980, xmax: 950 },       // Vận dụng / Liên hệ
};

// ─── 5. BẢN ĐỒ VÙNG CHUẨN LỊCH SỬ VÀ ĐỊA LÍ (LỚP 4–5) ───
export const STANDARD_HISTORY_GEO_REGIONS: Record<string, NormalizedBoundingBox> = {
  map_diagram: { ymin: 40, xmin: 50, ymax: 520, xmax: 950 },         // Lược đồ / Bản đồ
  historical_artifacts: { ymin: 500, xmin: 50, ymax: 950, xmax: 950 },// Ảnh tư liệu hiện vật, di tích
  page2_exercises: { ymin: 50, xmin: 50, ymax: 700, xmax: 950 },     // Câu hỏi khám phá trang 2
};

// ─── 6. BẢN ĐỒ VÙNG CHUẨN ĐẠO ĐỨC, HĐTN, TIN HỌC, CÔNG NGHỆ ───
export const STANDARD_ETHICS_REGIONS: Record<string, NormalizedBoundingBox> = {
  scenario_illustration: { ymin: 50, xmin: 50, ymax: 550, xmax: 950 },// Tranh tình huống / Quy trình
  practice_tasks: { ymin: 520, xmin: 50, ymax: 980, xmax: 950 },       // Thực hành xử lí / Thao tác
};

export async function ensureAssetDataUrl(asset: UploadedAsset, defaultGrade?: number): Promise<UploadedAsset> {
  if (asset.dataUrl && asset.dataUrl.startsWith("data:image/")) {
    return asset;
  }

  let bookKey = asset.taphuanBookKey;
  let page = asset.taphuanPage;

  if (!page && asset.name) {
    const m = asset.name.match(/(?:trang|page)\s*(\d+)/i);
    if (m) page = parseInt(m[1], 10);
  }

  if (!bookKey && asset.name) {
    const matchedBook = taphuanCatalog.find((b) => asset.name.includes(b.title) || asset.name.includes(b.key));
    if (matchedBook) bookKey = matchedBook.key;
  }

  if (!bookKey && defaultGrade) {
    const fallbackBook = taphuanCatalog.find((b) => b.grade === `Lớp ${defaultGrade}` && b.subject === "Tiếng Việt");
    if (fallbackBook) bookKey = fallbackBook.key;
  }

  if (bookKey && page && page > 0) {
    try {
      const book = getTaphuanBookByKey(bookKey);
      if (book) {
        const pages = await fetchTaphuanReaderPages(book.readerUrl);
        if (page <= pages.length) {
          const { buffer, contentType } = await fetchTaphuanPageBuffer(pages[page - 1]);
          const dataUrl = bufferToDataUrl(buffer, contentType || "image/png");
          return { ...asset, dataUrl };
        }
      }
    } catch (err) {
      console.warn("[sgk-crop] Không thể tải lại ảnh taphuan cho asset:", asset.name, err);
    }
  }

  return asset;
}

/**
 * Tìm chỉ số bước hành động của GV trong teacherActions tương ứng với từ khóa
 */
function findTargetStepIndex(actions: string[] | undefined, patterns: RegExp[]): number {
  if (!actions || !actions.length) return 0;
  for (const pattern of patterns) {
    const idx = actions.findIndex((action) => pattern.test(action));
    if (idx !== -1) return idx;
  }
  return 0;
}

/**
 * Phân tích và tự động gắn ảnh cắt SGK vào đúng hoạt động và đúng bước tương ứng của cột GV.
 * Áp dụng cho ALL bất kì môn nào, bài nào (Tiếng Việt, Toán, TNXH, Khoa học, Lịch sử - Địa lí, Đạo đức...).
 */
export async function attachSgkCropsToActivities(
  activities: LessonActivity[],
  assets: UploadedAsset[],
  options: AttachSgkCropOptions = {},
): Promise<LessonActivity[]> {
  try {
    const resolvedAssets = await Promise.all(
      (assets || []).map((a) => ensureAssetDataUrl(a, options.grade)),
    );
  const imageAssets = resolvedAssets.filter(
    (a) => a.type === "image" && a.dataUrl && a.dataUrl.startsWith("data:image/"),
  );

  if (imageAssets.length === 0) {
    return activities;
  }

  const periodNum = options.periodNumber ?? 1;
  const pIndex = Math.min(Math.max(0, periodNum - 1), imageAssets.length - 1);
  const page1Asset = imageAssets.length > 2 ? imageAssets[pIndex] : imageAssets[0];
  const page2Asset = imageAssets.length > 2
    ? (imageAssets[Math.min(pIndex + 1, imageAssets.length - 1)] || imageAssets[pIndex])
    : (imageAssets.length > 1 ? imageAssets[1] : imageAssets[0]);

  const grade = Number(options.grade || 1);
  const subject = (options.subject || "Tiếng Việt").toLowerCase();

  const isMath = /toán/i.test(subject);
  const isScience = /tự nhiên|xã hội|khoa học|tnxh/i.test(subject);
  const isHistoryGeo = /lịch sử|địa lí|địa lý/i.test(subject);
  const isEthics = /đạo đức|trải nghiệm|tin học|công nghệ/i.test(subject);

  const updatedActivities: LessonActivity[] = [];

  for (let i = 0; i < activities.length; i++) {
    const act = { ...activities[i] };
    const textDesc = `${act.phase || ""} ${act.title || ""} ${act.objective || ""} ${(act.teacherActions || []).join(" ")}`.toLowerCase();

    let targetBox: NormalizedBoundingBox | null = null;
    let targetAsset: UploadedAsset = page1Asset;
    let caption = "";
    let stepIndex = 0;

    // ─── 1. MÔN TOÁN ───
    if (isMath) {
      if (/khởi động|bài toán mở đầu|tình huống/i.test(textDesc)) {
        targetBox = STANDARD_MATH_REGIONS.warmup_problem;
        targetAsset = page1Asset;
        caption = "Tranh tình huống bài toán mở đầu SGK";
        stepIndex = findTargetStepIndex(act.teacherActions, [
          /chiếu tranh|quan sát tranh|chiếu.*tivi|chiếu.*bảng|mở tranh/i,
          /bài toán|tình huống/i,
          /khởi động/i,
        ]);
      } else if (/khám phá|kiến thức mới|mô hình|que tính|khối lập phương|tia số|bảng số/i.test(textDesc)) {
        targetBox = STANDARD_MATH_REGIONS.concept_visual;
        targetAsset = page1Asset;
        caption = "Mô hình trực quan kiến thức mới SGK";
        stepIndex = findTargetStepIndex(act.teacherActions, [
          /chiếu mô hình|quan sát mô hình|que tính|khối lập phương|tia số|bảng số/i,
          /khám phá/i,
        ]);
      } else if (/bài tập 1|bài 1|phép tính 1|thực hành|hoạt động/i.test(textDesc)) {
        targetBox = STANDARD_MATH_REGIONS.exercise_1;
        targetAsset = page1Asset;
        caption = "Bài tập 1 SGK";
        stepIndex = findTargetStepIndex(act.teacherActions, [
          /bài tập 1|bài 1|phép tính 1/i,
          /thực hành|bài tập/i,
        ]);
      } else if (/bài tập 2|bài 2|bài tập 3|bài 3/i.test(textDesc)) {
        targetBox = STANDARD_MATH_REGIONS.exercise_2;
        targetAsset = page1Asset;
        caption = "Bài tập 2 SGK";
        stepIndex = findTargetStepIndex(act.teacherActions, [
          /bài tập 2|bài 2|bài tập 3|bài 3/i,
          /bài tập/i,
        ]);
      } else if (/vận dụng|trò chơi|thực tế/i.test(textDesc)) {
        targetBox = STANDARD_MATH_REGIONS.applied_math;
        targetAsset = page2Asset;
        caption = "Bài toán vận dụng thực tế SGK";
        stepIndex = findTargetStepIndex(act.teacherActions, [
          /trò chơi|thực tế|bài toán/i,
          /vận dụng/i,
        ]);
      }
    }
    // ─── 2. MÔN TỰ NHIÊN VÀ XÃ HỘI & KHOA HỌC ───
    else if (isScience) {
      if (/khởi động|tình huống mở đầu/i.test(textDesc)) {
        targetBox = STANDARD_NATURAL_SOCIAL_REGIONS.warmup_situation;
        targetAsset = page1Asset;
        caption = "Tranh tình huống khởi động SGK";
        stepIndex = findTargetStepIndex(act.teacherActions, [
          /chiếu tranh|quan sát tranh|chiếu.*tivi|mở tranh/i,
          /tình huống/i,
          /khởi động/i,
        ]);
      } else if (/khám phá|quan sát hình|hình 1|hình 2|sơ đồ/i.test(textDesc)) {
        targetBox = STANDARD_NATURAL_SOCIAL_REGIONS.observation_figures;
        targetAsset = page1Asset;
        caption = "Hình ảnh quan sát / sơ đồ SGK";
        stepIndex = findTargetStepIndex(act.teacherActions, [
          /sơ đồ|hình 1|hình 2|hình 3|quan sát hình|chiếu hình/i,
          /quan sát/i,
          /khám phá/i,
        ]);
      } else if (/thực hành|thí nghiệm|phiếu điều tra|xử lí/i.test(textDesc)) {
        targetBox = STANDARD_NATURAL_SOCIAL_REGIONS.experiment_practice;
        targetAsset = page1Asset;
        caption = "Sơ đồ thực hành / thí nghiệm SGK";
        stepIndex = findTargetStepIndex(act.teacherActions, [
          /thí nghiệm|phiếu|xử lí/i,
          /thực hành/i,
        ]);
      } else if (/vận dụng|bảo vệ|an toàn|liên hệ/i.test(textDesc)) {
        targetBox = STANDARD_NATURAL_SOCIAL_REGIONS.application;
        targetAsset = page2Asset;
        caption = "Tranh tình huống vận dụng đời sống SGK";
        stepIndex = findTargetStepIndex(act.teacherActions, [
          /hành động|liên hệ/i,
          /vận dụng/i,
        ]);
      }
    }
    // ─── 3. MÔN LỊCH SỬ VÀ ĐỊA LÍ ───
    else if (isHistoryGeo) {
      if (/lược đồ|bản đồ|sơ đồ/i.test(textDesc)) {
        targetBox = STANDARD_HISTORY_GEO_REGIONS.map_diagram;
        targetAsset = page1Asset;
        caption = "Lược đồ / Bản đồ SGK";
        stepIndex = findTargetStepIndex(act.teacherActions, [
          /lược đồ|bản đồ|sơ đồ|quan sát/i,
        ]);
      } else if (/tư liệu|hiện vật|di tích|khám phá/i.test(textDesc)) {
        targetBox = STANDARD_HISTORY_GEO_REGIONS.historical_artifacts;
        targetAsset = page1Asset;
        caption = "Ảnh tư liệu / Hiện vật lịch sử SGK";
        stepIndex = findTargetStepIndex(act.teacherActions, [
          /tư liệu|hiện vật|di tích|quan sát/i,
        ]);
      } else {
        targetBox = STANDARD_HISTORY_GEO_REGIONS.page2_exercises;
        targetAsset = page2Asset;
        caption = "Hệ thống câu hỏi / bài tập SGK";
        stepIndex = findTargetStepIndex(act.teacherActions, [
          /câu hỏi|bài tập|thảo luận/i,
        ]);
      }
    }
    // ─── 4. MÔN ĐẠO ĐỨC, HĐTN, TIN HỌC, CÔNG NGHỆ ───
    else if (isEthics) {
      if (/khởi động|tình huống|tiểu phẩm/i.test(textDesc)) {
        targetBox = STANDARD_ETHICS_REGIONS.scenario_illustration;
        targetAsset = page1Asset;
        caption = "Tranh tình huống SGK";
        stepIndex = findTargetStepIndex(act.teacherActions, [
          /tình huống|quan sát tranh|khởi động/i,
        ]);
      } else {
        targetBox = STANDARD_ETHICS_REGIONS.practice_tasks;
        targetAsset = page1Asset;
        caption = "Hình ảnh thực hành thao tác SGK";
        stepIndex = findTargetStepIndex(act.teacherActions, [
          /thực hành|thao tác|xử lí/i,
        ]);
      }
    }
    // ─── 5. MÔN TIẾNG VIỆT LỚP 1 ───
    else if (grade === 1) {
      if (/khởi động|nhận diện|nhận biết|tranh khởi động/i.test(textDesc)) {
        targetBox = STANDARD_GRADE1_REGIONS.warmup_recognition;
        targetAsset = page1Asset;
        caption = "Tranh nhận biết SGK";
        stepIndex = findTargetStepIndex(act.teacherActions, [
          /chiếu tranh|quan sát tranh|nhận biết|bức tranh|khởi động/i,
        ]);
      } else if (/cấu tạo vần|ghép âm|ghép tiếng|đánh vần|mô hình vần|khám phá vần/i.test(textDesc)) {
        targetBox = STANDARD_GRADE1_REGIONS.phonics_model;
        targetAsset = page1Asset;
        caption = "Mô hình vần và ghép tiếng SGK";
        stepIndex = findTargetStepIndex(act.teacherActions, [
          /mô hình vần|khung vần|ghép âm|phân tích vần/i,
          /đánh vần|đọc trơn/i,
        ]);
      } else if (/từ ngữ ứng dụng|luyện đọc tiếng|từ ứng dụng|tiếng mới|đọc từ/i.test(textDesc)) {
        targetBox = STANDARD_GRADE1_REGIONS.vocabulary_words;
        targetAsset = page1Asset;
        caption = "Dãy tiếng và từ ngữ ứng dụng SGK";
        stepIndex = findTargetStepIndex(act.teacherActions, [
          /từ ngữ ứng dụng|tiếng mới|đọc từ|dãy từ|từ ứng dụng/i,
        ]);
      } else if (/tập viết|viết bảng|viết vở|mẫu chữ|hướng dẫn viết|luyện viết|câu ứng dụng|viết vần|viết từ/i.test(textDesc)) {
        targetBox = STANDARD_GRADE1_REGIONS.handwriting_sample;
        targetAsset = page1Asset;
        caption = "Mẫu chữ viết chuẩn ô li SGK";
        // Gắn vào bước chiếu câu ứng dụng / chữ mẫu / hướng dẫn viết
        stepIndex = findTargetStepIndex(act.teacherActions, [
          /chiếu câu ứng dụng|chiếu chữ mẫu|chiếu lên tivi|câu ứng dụng/i,
          /viết mẫu|hướng dẫn viết|mẫu chữ/i,
          /viết bảng|bảng con/i,
        ]);
      } else if (/đoạn đọc|câu ứng dụng|đọc hiểu|đọc câu|đọc đoạn/i.test(textDesc)) {
        targetBox = STANDARD_GRADE1_REGIONS.reading_passage;
        targetAsset = page2Asset;
        caption = "Đoạn văn đọc ứng dụng SGK";
        stepIndex = findTargetStepIndex(act.teacherActions, [
          /đoạn đọc|bài đọc|văn bản|đoạn văn|câu văn|luyện đọc/i,
        ]);
      } else if (/nói và nghe|luyện nói|xin lỗi|chủ đề nói|kể chuyện/i.test(textDesc)) {
        targetBox = STANDARD_GRADE1_REGIONS.speaking_listening;
        targetAsset = page2Asset;
        caption = "Tranh chủ đề luyện nói SGK";
        stepIndex = findTargetStepIndex(act.teacherActions, [
          /nói và nghe|luyện nói|kể chuyện|bức tranh/i,
        ]);
      }
    }
    // ─── 6. MÔN TIẾNG VIỆT LỚP 2–5 ───
    else {
      if (/khởi động|tranh minh họa|nhận biết/i.test(textDesc)) {
        targetBox = STANDARD_GRADE2_5_REGIONS.reading_header_illustration;
        targetAsset = page1Asset;
        caption = "Tranh minh họa SGK";
        stepIndex = findTargetStepIndex(act.teacherActions, [
          /chiếu tranh|quan sát tranh|minh họa|khởi động/i,
        ]);
      } else if (/tập viết|viết chữ hoa|chữ hoa|mẫu chữ/i.test(textDesc)) {
        targetBox = STANDARD_GRADE2_5_REGIONS.handwriting_sample;
        targetAsset = page1Asset;
        caption = "Mẫu chữ viết hoa SGK";
        stepIndex = findTargetStepIndex(act.teacherActions, [
          /chiếu chữ mẫu|chữ hoa|mẫu chữ|viết mẫu|hướng dẫn viết/i,
        ]);
      } else if (/đọc văn bản|luyện đọc|chính tả|nghe viết|tập chép/i.test(textDesc)) {
        targetBox = STANDARD_GRADE2_5_REGIONS.reading_main_text;
        targetAsset = page1Asset;
        caption = "Văn bản SGK";
        stepIndex = findTargetStepIndex(act.teacherActions, [
          /văn bản|bài đọc|đoạn đọc|luyện đọc/i,
        ]);
      } else if (/tìm hiểu bài|câu hỏi|bài tập|luyện từ và câu/i.test(textDesc)) {
        targetBox = STANDARD_GRADE2_5_REGIONS.reading_questions_exercises;
        targetAsset = page2Asset;
        caption = "Hệ thống câu hỏi / bài tập SGK";
        stepIndex = findTargetStepIndex(act.teacherActions, [
          /câu hỏi|bài tập|thảo luận/i,
        ]);
      } else if (/nói và nghe|luyện nói|kể chuyện|trao đổi|trình bày/i.test(textDesc)) {
        targetBox = STANDARD_GRADE2_5_REGIONS.speaking_illustration;
        targetAsset = page2Asset;
        caption = "Tranh chủ đề luyện nói SGK";
        stepIndex = findTargetStepIndex(act.teacherActions, [
          /nói và nghe|luyện nói|kể chuyện|trình bày/i,
        ]);
      }
    }

    if (targetBox && targetAsset?.dataUrl) {
      const crop = await cropImageWithPadding(targetAsset.dataUrl, targetBox, {
        paddingPercent: options.paddingPercent ?? 0.08,
        maxWidth: 340,
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
          targetStepIndex: stepIndex,
        };
        act.teacherVisuals = [visual];
      }
    }

    updatedActivities.push(act);
  }

  return updatedActivities;
  } catch (err) {
    console.warn("[sgk-crop] Gắn ảnh SGK bị lỗi nhẹ, an toàn giữ nguyên hoạt động:", err);
    return activities;
  }
}
