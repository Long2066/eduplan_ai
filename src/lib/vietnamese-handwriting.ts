import handwritingCatalog from "@/data/vietnamese-handwriting-catalog.json";
import type { LessonActivityVisual } from "@/types/lesson";

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

export function getHandwritingVisualsForLetters(letters: string[]): LessonActivityVisual[] {
  const visuals: LessonActivityVisual[] = [];
  const seen = new Set<string>();

  for (const raw of letters) {
    const char = raw.trim();
    if (!char || seen.has(char)) continue;
    seen.add(char);

    const isUpper = char === char.toUpperCase() && char !== char.toLowerCase();
    const entry = getHandwritingEntry(char, isUpper ? "uppercase" : "lowercase");
    if (!entry) continue;

    visuals.push({
      id: `hw-${entry.letter}-${entry.type}`,
      caption: `Mẫu chữ ${entry.letter} (${entry.type === "uppercase" ? "chữ hoa" : "chữ thường"}) - Độ cao ${entry.height_cells} ô li`,
      dataUrl: entry.image_url,
      alt: entry.title,
      widthPx: 240,
    });
  }

  return visuals;
}

export function extractTargetLettersFromWritingText(writingText: string): string[] {
  // Normalize and extract individual distinct letters or compound letters
  const tokens = writingText.replace(/[,;:.!?]/g, " ").split(/\s+/).filter(Boolean);
  const result: string[] = [];
  const seen = new Set<string>();

  for (const token of tokens) {
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
