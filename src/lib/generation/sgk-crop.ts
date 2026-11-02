import sharp from "sharp";
import { getTaphuanBookByKey, taphuanCatalog } from "@/lib/taphuan-catalog";
import { fetchTaphuanReaderPages, fetchTaphuanPageBuffer } from "@/lib/taphuan-reader";
import { getCachedAiGatewaySettings } from "@/lib/model-strategy";
import type {
  DetectedVisualBox,
  LessonActivity,
  LessonActivityVisual,
  UploadedAsset,
} from "@/types/lesson";

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
  const paddingPercent = options.paddingPercent ?? 0.06; // 6% an toàn viền
  const targetMaxWidth = options.maxWidth ?? 320; // Phù hợp độ rộng cột GV ~6.5cm trong Word DOCX

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

    // Bổ sung Smart Padding để không chém lẹm dấu thanh, nét chữ và đường kẻ ô li
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
      : await pipeline.jpeg({ quality: 78, mozjpeg: true }).toBuffer();
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

// ─── PHƯƠNG ÁN A: BẢN ĐỒ VÙNG HỌC LIỆU DỰ PHÒNG CHUẨN SƯ PHẠM (PEDAGOGICAL FALLBACKS) ───
// Tuyệt đối KHÔNG cắt văn bản đọc, câu hỏi bài tập hay danh sách từ ngữ thành ảnh.
// Chỉ cắt: Tranh minh họa, Mẫu chữ ô li, Mô hình toán học, Sơ đồ/lược đồ.

export const STANDARD_GRADE1_REGIONS: Record<string, NormalizedBoundingBox> = {
  warmup_recognition: { ymin: 60, xmin: 60, ymax: 330, xmax: 880 }, // Tranh nhận biết
  phonics_model: { ymin: 330, xmin: 60, ymax: 560, xmax: 880 },      // Mô hình vần
  handwriting_sample: { ymin: 820, xmin: 80, ymax: 960, xmax: 920 }, // Mẫu chữ viết chuẩn ô li
  speaking_listening: { ymin: 520, xmin: 80, ymax: 940, xmax: 920 }, // Tranh chủ đề luyện nói
};

export const STANDARD_GRADE2_5_REGIONS: Record<string, NormalizedBoundingBox> = {
  reading_header_illustration: { ymin: 50, xmin: 60, ymax: 360, xmax: 940 }, // Tranh minh họa bài đọc
  handwriting_sample: { ymin: 60, xmin: 80, ymax: 450, xmax: 920 },           // Mẫu chữ viết hoa chuẩn
  speaking_illustration: { ymin: 220, xmin: 80, ymax: 720, xmax: 920 },        // Tranh chủ đề luyện nói
};

export const STANDARD_MATH_REGIONS: Record<string, NormalizedBoundingBox> = {
  warmup_problem: { ymin: 50, xmin: 60, ymax: 340, xmax: 940 }, // Tranh tình huống mở đầu
  concept_visual: { ymin: 340, xmin: 60, ymax: 580, xmax: 940 },// Que tính / Khối lập phương / Tia số
};

export const STANDARD_NATURAL_SOCIAL_REGIONS: Record<string, NormalizedBoundingBox> = {
  warmup_situation: { ymin: 50, xmin: 60, ymax: 340, xmax: 940 },    // Tranh tình huống khởi động
  observation_figures: { ymin: 340, xmin: 60, ymax: 680, xmax: 940 }, // Cụm hình quan sát thực tế
  experiment_practice: { ymin: 680, xmin: 60, ymax: 960, xmax: 940 }, // Sơ đồ thí nghiệm
};

export const STANDARD_HISTORY_GEO_REGIONS: Record<string, NormalizedBoundingBox> = {
  map_diagram: { ymin: 50, xmin: 60, ymax: 520, xmax: 940 },          // Lược đồ / Bản đồ
  historical_artifacts: { ymin: 500, xmin: 60, ymax: 940, xmax: 940 }, // Ảnh tư liệu hiện vật di tích
};

export const STANDARD_ETHICS_REGIONS: Record<string, NormalizedBoundingBox> = {
  scenario_illustration: { ymin: 60, xmin: 60, ymax: 540, xmax: 940 }, // Tranh tình huống
};

export const VISION_LAYOUT_PROMPT = `Bạn là chuyên gia phân tích bố cục trang Sách Giáo Khoa (SGK) Tiểu học Việt Nam.
Nhiệm vụ: Hãy phát hiện vị trí tọa độ Bounding Box [ymin, xmin, ymax, xmax] (thang đo chuẩn hóa từ 0 đến 1000) của các HỌC LIỆU HÌNH ẢNH / MINH HỌA TRỰC QUAN có trong trang sách này để đưa vào kế hoạch bài dạy.

QUY TẮC PHÂN LOẠI HỌC LIỆU HÌNH ẢNH:
1. "illustration": Tranh vẽ minh họa (tranh khởi động, tranh nhận biết bài học, tranh tình huống đời sống, tranh luyện nói, tranh kể chuyện theo tranh).
2. "handwriting_sample": Mẫu chữ viết tay ô li (chữ cái, vần, từ hoặc câu được viết trên lưới dòng kẻ ô li 2 li / 4 li để học sinh tập viết).
3. "math_model": Mô hình trực quan môn Toán (que tính, khối lập phương, tia số, bảng số, đồng hồ, cân đĩa, hình vẽ các đồ vật đếm).
4. "diagram": Lược đồ, bản đồ môn Lịch sử - Địa lí, sơ đồ thí nghiệm, sơ đồ cấu tạo môn Khoa học / Tự nhiên và Xã hội.

QUY TẮC BẮT BUỘC (LOẠI TRỪ):
- TUYỆT ĐỐI KHÔNG LẤY:
  + Đoạn văn bản đọc, câu chuyện dài, bài thơ (đây là chữ, không phải hình ảnh).
  + Các dòng câu hỏi, bài tập, yêu cầu bài học thuần chữ.
  + Tiêu đề bài học ở đầu trang, số trang ở chân trang, logo NXB.
- Tọa độ [ymin, xmin, ymax, xmax] (từ 0 đến 1000) phải ôm sát viền hình vẽ hoặc khung mẫu chữ, KHÔNG bao gồm lề trống rộng và KHÔNG quét dải ngang sang phần chữ bên cạnh.

Trả về DUY NHẤT một khối JSON hợp lệ theo cú pháp:
{
  "visuals": [
    {
      "type": "illustration" | "handwriting_sample" | "math_model" | "diagram",
      "label": "Mô tả ngắn gọn nội dung (VD: Tranh nhận biết bé và con ba ba; hoặc: Mẫu chữ ô li vần an)",
      "box": [ymin, xmin, ymax, xmax]
    }
  ]
}`;

const visualDetectionMemoryCache = new Map<string, DetectedVisualBox[]>();

/**
 * PHƯƠNG ÁN B: Nhận diện Bounding Box thực tế bằng AI Vision
 * Phát hiện vị trí từng tranh vẽ minh họa, mẫu chữ ô li trên trang SGK.
 */
export async function detectVisualElementsWithAi(
  asset: UploadedAsset,
  context: { subject?: string; grade?: number } = {},
): Promise<DetectedVisualBox[]> {
  if (Array.isArray(asset.detectedVisuals) && asset.detectedVisuals.length > 0) {
    return asset.detectedVisuals;
  }

  const dataUrl = asset.dataUrl;
  if (!dataUrl || !dataUrl.startsWith("data:image/")) {
    return [];
  }

  const cacheKey = asset.id || dataUrl.slice(0, 80) + dataUrl.length;
  if (visualDetectionMemoryCache.has(cacheKey)) {
    const cached = visualDetectionMemoryCache.get(cacheKey)!;
    asset.detectedVisuals = cached;
    return cached;
  }

  try {
    const gateway = getCachedAiGatewaySettings();
    const useGateway = gateway.enabled && Boolean(gateway.baseUrl) && gateway.routingMode !== "openai_only";
    const apiKey = gateway.apiKey || process.env.NINEROUTER_API_KEY || process.env.OPENAI_API_KEY || "";

    if (!apiKey && !useGateway) {
      return [];
    }

    const endpoint = useGateway
      ? `${gateway.baseUrl.replace(/\/+$/, "")}/chat/completions`
      : "https://api.openai.com/v1/chat/completions";

    const model = useGateway
      ? (gateway.freeOcrModel || "gemini-3.1-flash-image")
      : (process.env.OPENAI_OCR_MODEL || "gpt-5.6-luna");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: VISION_LAYOUT_PROMPT },
              { type: "image_url", image_url: { url: dataUrl, detail: "high" } },
            ],
          },
        ],
        temperature: 0.1,
        max_tokens: 1200,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      return [];
    }

    const data = await res.json();
    const rawContent = data.choices?.[0]?.message?.content || "";
    let cleanJson = rawContent.trim();
    const matchFence = cleanJson.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (matchFence) {
      cleanJson = matchFence[1].trim();
    }

    const parsed = JSON.parse(cleanJson);
    if (Array.isArray(parsed?.visuals)) {
      const results: DetectedVisualBox[] = [];
      for (const item of parsed.visuals) {
        if (Array.isArray(item.box) && item.box.length === 4) {
          const [ymin, xmin, ymax, xmax] = item.box.map((v: any) =>
            Math.max(0, Math.min(1000, Number(v) || 0)),
          );
          if (ymax > ymin && xmax > xmin) {
            results.push({
              type: item.type || "illustration",
              label: String(item.label || "Hình minh họa SGK").trim(),
              box: { ymin, xmin, ymax, xmax },
            });
          }
        }
      }
      if (results.length > 0) {
        visualDetectionMemoryCache.set(cacheKey, results);
        asset.detectedVisuals = results;
        return results;
      }
    }
  } catch (err) {
    // Non-blocking: fallback gracefully
  }

  return [];
}

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
 * Gắn ảnh SGK chuẩn xác vào đúng hoạt động và đúng bước của GV.
 * Kết hợp Phương án B (AI Vision Bounding Box) và Phương án A (Chuẩn hóa sư phạm không cắt chữ).
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

    const grade = Number(options.grade || 1);
    const subject = (options.subject || "Tiếng Việt").toLowerCase();

    // Chạy AI Vision phát hiện Bounding Box cho các ảnh SGK
    await Promise.all(
      imageAssets.map((asset) => detectVisualElementsWithAi(asset, { subject, grade })),
    );

    const periodNum = options.periodNumber ?? 1;
    const pIndex = Math.min(Math.max(0, periodNum - 1), imageAssets.length - 1);
    const page1Asset = imageAssets.length > 2 ? imageAssets[pIndex] : imageAssets[0];
    const page2Asset = imageAssets.length > 2
      ? (imageAssets[Math.min(pIndex + 1, imageAssets.length - 1)] || imageAssets[pIndex])
      : (imageAssets.length > 1 ? imageAssets[1] : imageAssets[0]);

    const isMath = /toán/i.test(subject);
    const isScience = /tự nhiên|xã hội|khoa học|tnxh/i.test(subject);
    const isHistoryGeo = /lịch sử|địa lí|địa lý/i.test(subject);
    const isEthics = /đạo đức|trải nghiệm|tin học|công nghệ/i.test(subject);

    const updatedActivities: LessonActivity[] = [];

    for (let i = 0; i < activities.length; i++) {
      const act = { ...activities[i] };
      const textDesc = `${act.phase || ""} ${act.title || ""} ${act.objective || ""} ${(act.teacherActions || []).join(" ")}`.toLowerCase();

      // ─── QUY TẮC A: LOẠI TRỪ CẮT VĂN BẢN ĐỌC & BÀI TẬP THUẦN CHỮ THÀNH ẢNH ───
      const isPureTextReading = (
        /luyện đọc|đọc câu|đọc đoạn|đọc thầm|đọc thành tiếng|tìm hiểu bài|trả lời câu hỏi|luyện từ và câu|chính tả|nghe viết|tập chép|dãy từ|từ ngữ ứng dụng/i.test(textDesc)
        && !/mẫu chữ|chữ mẫu|viết bảng|chữ hoa|ô li|tranh|quan sát tranh|khởi động/i.test(textDesc)
      );
      const isPureTextExercise = (
        /bài tập 1|bài tập 2|bài tập 3|làm bài tập|phiếu học tập|thực hành bài/i.test(textDesc)
        && !/mô hình|que tính|khối lập phương|tia số|hình vẽ|tranh|sơ đồ/i.test(textDesc)
      );

      if (isPureTextReading || isPureTextExercise) {
        // Đúng chuẩn sư phạm: Text văn bản đọc và câu hỏi bài tập phải ở dạng gõ text, không chèn ảnh chụp cắt sách!
        updatedActivities.push(act);
        continue;
      }

      let targetBox: NormalizedBoundingBox | null = null;
      let targetAsset: UploadedAsset = page1Asset;
      let caption = "";
      let stepIndex = 0;

      // Hàm tìm visual phù hợp trong AI detected visuals của các trang
      const findDetectedVisual = (type: string, filter?: RegExp) => {
        for (const asset of [targetAsset, page1Asset, page2Asset]) {
          const list = asset.detectedVisuals || [];
          const found = list.find((v) => v.type === type && (!filter || filter.test(v.label)));
          if (found) return { asset, visual: found };
        }
        return null;
      };

      // ─── 1. MÔN TOÁN ───
      if (isMath) {
        if (/khởi động|bài toán mở đầu|tình huống/i.test(textDesc)) {
          targetAsset = page1Asset;
          const aiDetected = findDetectedVisual("illustration", /tình huống|mở đầu|khởi động/i) || findDetectedVisual("illustration");
          if (aiDetected) {
            targetBox = aiDetected.visual.box;
            targetAsset = aiDetected.asset;
            caption = `Tranh tình huống: ${aiDetected.visual.label}`;
          } else {
            targetBox = STANDARD_MATH_REGIONS.warmup_problem;
            caption = "Tranh tình huống bài toán mở đầu SGK";
          }
          stepIndex = findTargetStepIndex(act.teacherActions, [
            /chiếu tranh|quan sát tranh|chiếu.*tivi|chiếu.*bảng|mở tranh/i,
            /bài toán|tình huống/i,
            /khởi động/i,
          ]);
        } else if (/khám phá|kiến thức mới|mô hình|que tính|khối lập phương|tia số|bảng số/i.test(textDesc)) {
          targetAsset = page1Asset;
          const aiDetected = findDetectedVisual("math_model") || findDetectedVisual("illustration", /mô hình|que tính|khối/i);
          if (aiDetected) {
            targetBox = aiDetected.visual.box;
            targetAsset = aiDetected.asset;
            caption = `Mô hình trực quan: ${aiDetected.visual.label}`;
          } else {
            targetBox = STANDARD_MATH_REGIONS.concept_visual;
            caption = "Mô hình trực quan kiến thức mới SGK";
          }
          stepIndex = findTargetStepIndex(act.teacherActions, [
            /chiếu mô hình|quan sát mô hình|que tính|khối lập phương|tia số|bảng số/i,
            /khám phá/i,
          ]);
        }
      }
      // ─── 2. MÔN TỰ NHIÊN VÀ XÃ HỘI & KHOA HỌC ───
      else if (isScience) {
        if (/khởi động|tình huống mở đầu/i.test(textDesc)) {
          targetAsset = page1Asset;
          const aiDetected = findDetectedVisual("illustration", /khởi động|tình huống/i) || findDetectedVisual("illustration");
          if (aiDetected) {
            targetBox = aiDetected.visual.box;
            targetAsset = aiDetected.asset;
            caption = `Tranh khởi động: ${aiDetected.visual.label}`;
          } else {
            targetBox = STANDARD_NATURAL_SOCIAL_REGIONS.warmup_situation;
            caption = "Tranh tình huống khởi động SGK";
          }
          stepIndex = findTargetStepIndex(act.teacherActions, [
            /chiếu tranh|quan sát tranh|chiếu.*tivi|mở tranh/i,
            /tình huống/i,
            /khởi động/i,
          ]);
        } else if (/khám phá|quan sát hình|hình 1|hình 2|sơ đồ/i.test(textDesc)) {
          targetAsset = page1Asset;
          const aiDetected = findDetectedVisual("diagram") || findDetectedVisual("illustration");
          if (aiDetected) {
            targetBox = aiDetected.visual.box;
            targetAsset = aiDetected.asset;
            caption = `Hình ảnh quan sát / sơ đồ: ${aiDetected.visual.label}`;
          } else {
            targetBox = STANDARD_NATURAL_SOCIAL_REGIONS.observation_figures;
            caption = "Hình ảnh quan sát / sơ đồ SGK";
          }
          stepIndex = findTargetStepIndex(act.teacherActions, [
            /sơ đồ|hình 1|hình 2|hình 3|quan sát hình|chiếu hình/i,
            /quan sát/i,
            /khám phá/i,
          ]);
        } else if (/thực hành|thí nghiệm|phiếu điều tra|xử lí/i.test(textDesc)) {
          targetAsset = page1Asset;
          const aiDetected = findDetectedVisual("diagram", /thí nghiệm|thực hành/i);
          if (aiDetected) {
            targetBox = aiDetected.visual.box;
            targetAsset = aiDetected.asset;
            caption = `Sơ đồ thí nghiệm: ${aiDetected.visual.label}`;
          } else {
            targetBox = STANDARD_NATURAL_SOCIAL_REGIONS.experiment_practice;
            caption = "Sơ đồ thực hành / thí nghiệm SGK";
          }
          stepIndex = findTargetStepIndex(act.teacherActions, [
            /thí nghiệm|phiếu|xử lí/i,
            /thực hành/i,
          ]);
        }
      }
      // ─── 3. MÔN LỊCH SỬ VÀ ĐỊA LÍ ───
      else if (isHistoryGeo) {
        if (/lược đồ|bản đồ|sơ đồ/i.test(textDesc)) {
          targetAsset = page1Asset;
          const aiDetected = findDetectedVisual("diagram", /lược đồ|bản đồ/i) || findDetectedVisual("diagram");
          if (aiDetected) {
            targetBox = aiDetected.visual.box;
            targetAsset = aiDetected.asset;
            caption = `Lược đồ / Bản đồ: ${aiDetected.visual.label}`;
          } else {
            targetBox = STANDARD_HISTORY_GEO_REGIONS.map_diagram;
            caption = "Lược đồ / Bản đồ SGK";
          }
          stepIndex = findTargetStepIndex(act.teacherActions, [/lược đồ|bản đồ|sơ đồ|quan sát/i]);
        } else if (/tư liệu|hiện vật|di tích|khám phá/i.test(textDesc)) {
          targetAsset = page1Asset;
          const aiDetected = findDetectedVisual("illustration", /hiện vật|di tích|tư liệu/i);
          if (aiDetected) {
            targetBox = aiDetected.visual.box;
            targetAsset = aiDetected.asset;
            caption = `Ảnh tư liệu hiện vật: ${aiDetected.visual.label}`;
          } else {
            targetBox = STANDARD_HISTORY_GEO_REGIONS.historical_artifacts;
            caption = "Ảnh tư liệu / Hiện vật lịch sử SGK";
          }
          stepIndex = findTargetStepIndex(act.teacherActions, [/tư liệu|hiện vật|di tích|quan sát/i]);
        }
      }
      // ─── 4. MÔN ĐẠO ĐỨC, HĐTN, TIN HỌC, CÔNG NGHỆ ───
      else if (isEthics) {
        if (/khởi động|tình huống|tiểu phẩm|quan sát tranh/i.test(textDesc)) {
          targetAsset = page1Asset;
          const aiDetected = findDetectedVisual("illustration");
          if (aiDetected) {
            targetBox = aiDetected.visual.box;
            targetAsset = aiDetected.asset;
            caption = `Tranh tình huống: ${aiDetected.visual.label}`;
          } else {
            targetBox = STANDARD_ETHICS_REGIONS.scenario_illustration;
            caption = "Tranh tình huống SGK";
          }
          stepIndex = findTargetStepIndex(act.teacherActions, [/tình huống|quan sát tranh|khởi động/i]);
        }
      }
      // ─── 5. MÔN TIẾNG VIỆT LỚP 1 ───
      else if (grade === 1) {
        if (/khởi động|nhận diện|nhận biết|tranh khởi động/i.test(textDesc)) {
          targetAsset = page1Asset;
          const aiDetected = findDetectedVisual("illustration", /nhận biết|khởi động/i) || findDetectedVisual("illustration");
          if (aiDetected) {
            targetBox = aiDetected.visual.box;
            targetAsset = aiDetected.asset;
            caption = `Tranh nhận biết: ${aiDetected.visual.label}`;
          } else {
            targetBox = STANDARD_GRADE1_REGIONS.warmup_recognition;
            caption = "Tranh nhận biết SGK";
          }
          stepIndex = findTargetStepIndex(act.teacherActions, [
            /chiếu tranh|quan sát tranh|nhận biết|bức tranh|khởi động/i,
          ]);
        } else if (/cấu tạo vần|ghép âm|ghép tiếng|đánh vần|mô hình vần|khám phá vần/i.test(textDesc)) {
          targetAsset = page1Asset;
          targetBox = STANDARD_GRADE1_REGIONS.phonics_model;
          caption = "Mô hình vần và ghép tiếng SGK";
          stepIndex = findTargetStepIndex(act.teacherActions, [
            /mô hình vần|khung vần|ghép âm|phân tích vần/i,
            /đánh vần|đọc trơn/i,
          ]);
        } else if (/tập viết|viết bảng|viết vở|mẫu chữ|hướng dẫn viết|luyện viết|viết vần|viết từ/i.test(textDesc)) {
          targetAsset = page1Asset;
          const aiDetected = findDetectedVisual("handwriting_sample") || findDetectedVisual("illustration", /viết|ô li|chữ/i);
          if (aiDetected) {
            targetBox = aiDetected.visual.box;
            targetAsset = aiDetected.asset;
            caption = `Mẫu chữ viết chuẩn: ${aiDetected.visual.label}`;
          } else {
            targetBox = STANDARD_GRADE1_REGIONS.handwriting_sample;
            caption = "Mẫu chữ viết chuẩn ô li SGK";
          }
          stepIndex = findTargetStepIndex(act.teacherActions, [
            /chiếu câu ứng dụng|chiếu chữ mẫu|chiếu lên tivi|câu ứng dụng/i,
            /viết mẫu|hướng dẫn viết|mẫu chữ/i,
            /viết bảng|bảng con/i,
          ]);
        } else if (/nói và nghe|luyện nói|kể chuyện/i.test(textDesc)) {
          targetAsset = page2Asset;
          const aiDetected = findDetectedVisual("illustration", /nói|kể chuyện/i);
          if (aiDetected) {
            targetBox = aiDetected.visual.box;
            targetAsset = aiDetected.asset;
            caption = `Tranh luyện nói: ${aiDetected.visual.label}`;
          } else {
            targetBox = STANDARD_GRADE1_REGIONS.speaking_listening;
            caption = "Tranh chủ đề luyện nói SGK";
          }
          stepIndex = findTargetStepIndex(act.teacherActions, [/nói và nghe|luyện nói|kể chuyện|bức tranh/i]);
        }
      }
      // ─── 6. MÔN TIẾNG VIỆT LỚP 2–5 ───
      else {
        if (/khởi động|tranh minh họa|nhận biết/i.test(textDesc)) {
          targetAsset = page1Asset;
          const aiDetected = findDetectedVisual("illustration");
          if (aiDetected) {
            targetBox = aiDetected.visual.box;
            targetAsset = aiDetected.asset;
            caption = `Tranh minh họa: ${aiDetected.visual.label}`;
          } else {
            targetBox = STANDARD_GRADE2_5_REGIONS.reading_header_illustration;
            caption = "Tranh minh họa SGK";
          }
          stepIndex = findTargetStepIndex(act.teacherActions, [/chiếu tranh|quan sát tranh|minh họa|khởi động/i]);
        } else if (/tập viết|viết chữ hoa|chữ hoa|mẫu chữ/i.test(textDesc)) {
          targetAsset = page1Asset;
          const aiDetected = findDetectedVisual("handwriting_sample") || findDetectedVisual("illustration", /chữ hoa|viết/i);
          if (aiDetected) {
            targetBox = aiDetected.visual.box;
            targetAsset = aiDetected.asset;
            caption = `Mẫu chữ viết hoa: ${aiDetected.visual.label}`;
          } else {
            targetBox = STANDARD_GRADE2_5_REGIONS.handwriting_sample;
            caption = "Mẫu chữ viết hoa SGK";
          }
          stepIndex = findTargetStepIndex(act.teacherActions, [/chiếu chữ mẫu|chữ hoa|mẫu chữ|viết mẫu|hướng dẫn viết/i]);
        } else if (/nói và nghe|luyện nói|kể chuyện|trao đổi|trình bày/i.test(textDesc)) {
          targetAsset = page2Asset;
          const aiDetected = findDetectedVisual("illustration", /nói|kể chuyện|trao đổi/i);
          if (aiDetected) {
            targetBox = aiDetected.visual.box;
            targetAsset = aiDetected.asset;
            caption = `Tranh luyện nói: ${aiDetected.visual.label}`;
          } else {
            targetBox = STANDARD_GRADE2_5_REGIONS.speaking_illustration;
            caption = "Tranh chủ đề luyện nói SGK";
          }
          stepIndex = findTargetStepIndex(act.teacherActions, [/nói và nghe|luyện nói|kể chuyện|trình bày/i]);
        }
      }

      if (targetBox && targetAsset?.dataUrl) {
        const crop = await cropImageWithPadding(targetAsset.dataUrl, targetBox, {
          paddingPercent: options.paddingPercent ?? 0.06,
          maxWidth: 320,
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
