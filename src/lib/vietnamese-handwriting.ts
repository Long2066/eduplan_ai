import handwritingCatalog from "@/data/vietnamese-handwriting-catalog.json";
import type { LessonActivity, LessonActivityVisual } from "@/types/lesson";

export interface HandwritingStroke {
  order: number;
  name: string;
  start: string;
  direction: string;
  end: string;
}

export interface HandwritingEntry {
  letter: string;
  type: "lowercase" | "uppercase";
  title: string;
  height_cells: number;
  grid_lines: number;
  strokes: HandwritingStroke[];
  note: string;
  image_url: string;
  source_doc: string;
  source_card: string;
}

const catalog = handwritingCatalog as Record<string, HandwritingEntry>;

export function getHandwritingEntry(
  letter: string,
  type: "lowercase" | "uppercase" = "lowercase"
): HandwritingEntry | undefined {
  const normalizedChar = letter.trim();
  const key = `${normalizedChar}_${type}`;
  if (catalog[key]) return catalog[key];

  // Try case-insensitive fallback
  const fallbackKey = Object.keys(catalog).find(
    (k) => k.toLowerCase() === key.toLowerCase()
  );
  return fallbackKey ? catalog[fallbackKey] : undefined;
}

export function formatHandwritingInstruction(entry: HandwritingEntry): string {
  const strokeDescriptions = entry.strokes
    .map(
      (s) =>
        `- Nét ${s.order} (${s.name}): Đặt bút ở ${s.start}, viết ${s.direction}, dừng bút ở ${s.end}.`
    )
    .join("\n");

  return [
    `* Hướng dẫn viết ${entry.title}:`,
    `- Độ cao: ${entry.height_cells} ô li (${entry.grid_lines} đường kẻ).`,
    strokeDescriptions,
    entry.note ? `- Lưu ý: ${entry.note}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function loadLocalImageAsBase64(imageUrl: string): string | null {
  if (typeof window !== "undefined") return null;
  try {
    const fs = eval("require")("fs");
    const path = eval("require")("path");
    const cleanPath = imageUrl.replace(/^\/?(public\/)?/, "");
    const fullPath = path.join(process.cwd(), "public", cleanPath);
    if (fs.existsSync(fullPath)) {
      const buffer = fs.readFileSync(fullPath);
      return `data:image/png;base64,${buffer.toString("base64")}`;
    }
  } catch {
    // fallback
  }
  return null;
}

export function getHandwritingVisualsForLetters(
  letters: string[],
  options?: { embedBase64?: boolean }
): LessonActivityVisual[] {
  const visuals: LessonActivityVisual[] = [];
  const seen = new Set<string>();

  for (const raw of letters) {
    const char = raw.trim();
    if (!char || seen.has(char)) continue;
    seen.add(char);

    const isUpper = char === char.toUpperCase() && char !== char.toLowerCase();
    const entry = getHandwritingEntry(char, isUpper ? "uppercase" : "lowercase");
    if (!entry) continue;

    const b64 = options?.embedBase64 ? loadLocalImageAsBase64(entry.image_url) : null;

    visuals.push({
      id: `hw-${entry.letter}-${entry.type}`,
      caption: `Mẫu chữ ${entry.letter} (${entry.type === "uppercase" ? "chữ hoa" : "chữ thường"}) - Độ cao ${entry.height_cells} ô li`,
      dataUrl: b64 || entry.image_url,
      alt: entry.title,
      widthPx: 240,
    });
  }

  return visuals;
}

const INSTRUCTION_STOPWORDS = new Set([
  "bài", "tiết", "luyện", "tập", "viết", "bảng", "con", "vở",
  "học", "vần", "đúng", "quy", "trình", "các", "chữ", "cho",
  "với", "trong", "thực", "hành", "mẫu", "theo", "hướng", "dẫn",
  "giáo", "viên", "sinh", "hoạt", "động", "bước"
]);

export function extractTargetLettersFromWritingText(writingText: string): string[] {
  // Normalize and filter instructional stopwords
  const rawTokens = writingText.replace(/[,;:.!?()\/\\-]/g, " ").split(/\s+/).filter(Boolean);
  const meaningfulTokens = rawTokens.filter((t) => !INSTRUCTION_STOPWORDS.has(t.toLowerCase()));
  const candidateTokens = meaningfulTokens.length > 0 ? meaningfulTokens : rawTokens;

  const result: string[] = [];
  const seen = new Set<string>();

  for (const token of candidateTokens) {
    for (const char of token) {
      const lower = char.toLowerCase();
      if (catalog[`${lower}_lowercase`] && !seen.has(lower)) {
        seen.add(lower);
        result.push(lower);
      }
    }
  }

  return result;
}

/**
 * Auto-attach handwriting reference visuals to writing activities.
 * 
 * IMPORTANT: Phân biệt 2 loại ảnh trong giáo án:
 * 1. Ảnh mẫu chữ viết (handwriting): tự động chèn từ catalog PNG khi activity là luyện viết.
 *    Label: "Mẫu chữ viết chuẩn". Source: public/handwriting/*.png
 * 2. Ảnh SGK crop: cắt từ ảnh SGK user upload khi OCR. Được xử lý riêng trong
 *    upload pipeline (image-crop), KHÔNG phải ở đây. Label: "Ảnh SGK minh họa".
 * 
 * ponytail: Khi có pipeline crop ảnh SGK, thêm attachSgkCropVisualsToActivities() riêng.
 */
export function attachHandwritingVisualsToActivities(
  activities: (LessonActivity & { [key: string]: any })[],
  lessonTitle: string,
  focus?: string,
  options?: { embedBase64?: boolean }
): LessonActivity[] {
  return activities.map((act) => {
    const text = `${act.phase || ""} ${act.title || ""} ${act.objective || ""}`.toLowerCase();
    const isWritingActivity = /viết bảng|viết vở|tập viết|luyện viết|mẫu chữ/i.test(text);
    if (!isWritingActivity) return act as LessonActivity;

    if (act.teacherVisuals?.some((v: any) => v.id && String(v.id).startsWith("hw-"))) {
      return act as LessonActivity;
    }

    const contextText = `${act.title || ""} ${act.objective || ""} ${focus || ""} ${lessonTitle || ""}`;
    const letters = extractTargetLettersFromWritingText(contextText);
    if (letters.length === 0) return act as LessonActivity;

    const visuals = getHandwritingVisualsForLetters(letters.slice(0, 3), options);
    if (visuals.length === 0) return act as LessonActivity;

    return {
      ...act,
      teacherVisuals: [...(act.teacherVisuals || []), ...visuals],
    } as LessonActivity;
  });
}

