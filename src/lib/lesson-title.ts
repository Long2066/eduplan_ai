export const LESSON_TITLE_REQUIRED_MESSAGE = "Không xác định được tên bài. Vui lòng nhập Tên bài hoặc tải ảnh có tiêu đề rõ hơn.";

export type LessonTitleSource =
  | "ocr-heading"
  | "user-input"
  | "source-truth"
  | "source-facts"
  | "lesson-map"
  | "blueprint"
  | "generated-output"
  | "legacy";

export type LessonTitleEvidence = {
  raw: string;
  title: string;
  source: "ocr-heading";
  confidence: number;
  evidence: string[];
  lineStart: number;
  lineEnd: number;
};

export type LessonTitleCandidate = {
  value: unknown;
  source: LessonTitleSource;
  confidence?: number;
  evidence?: string[];
};

export type LessonTitleResolution = {
  status: "resolved" | "unresolved";
  title: string;
  source: LessonTitleSource | null;
  confidence: number;
  reason: string;
  evidence: string[];
};

const GENERIC_SUBJECT_NAMES = new Set([
  "am nhac", "cong nghe", "dao duc", "giao duc the chat", "hoat dong trai nghiem",
  "khoa hoc", "lich su va dia li", "lich su va dia ly", "lich su dia li", "lich su dia ly",
  "mi thuat", "mon hoc", "my thuat", "ngoai ngu", "the duc", "tieng anh", "tieng viet",
  "tin hoc", "toan", "toan hoc", "tu nhien va xa hoi",
]);
const TASK_LEAD_PATTERN = /^(?:bài\s*tập|câu\s*\d+|hãy|nêu|kể|tính|giải|quan\s*sát|thảo\s*luận|chia\s*sẻ|chọn|nối|điền|đánh\s*dấu|trả\s*lời|luyện\s*tập|vận\s*dụng|khởi\s*động|khám\s*phá|(?:đọc|viết)\s+(?:đoạn|câu|bài|vào|lại|các?|một|những|tên|số|phần)\b)\b/iu;
const SECTION_PATTERN = /^(?:yêu\s*cầu\s*cần\s*đạt|mục\s*tiêu|nội\s*dung|hoạt\s*động|câu\s*hỏi|bài\s*tập|trang\s*\d+)\b/iu;
const OCR_PAGE_MARKER_PATTERN = /^---\s*hết ảnh\s*---$/iu;

function cleanText(value: unknown) {
  return String(value ?? "").normalize("NFC").replace(/[\u00a0\u2007\u202f]/g, " ").replace(/[\t ]+/g, " ").trim();
}

export function foldLessonTitle(value: unknown) {
  return cleanText(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D")
    .toLocaleLowerCase("vi").replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

export function canonicalizeLessonTitle(value: unknown) {
  const cleaned = cleanText(value).replace(/\s*\r?\n\s*/g, " ")
    .replace(/^(?:tên\s*bài|tên\s*bài\s*học|lesson\s*title)\s*[:：-]\s*/iu, "").trim();
  if (!cleaned) return "";
  const numbered = cleaned.match(/^bài\s*(?:số\s*)?(\d+[a-z]?)(?:\s*[.:;\-–—)]\s*|\s+)(.+)$/iu);
  if (!numbered) return cleaned;
  const name = cleanText(numbered[2]).replace(/^[.:;\-–—)\s]+/, "").trim();
  return name ? `Bài ${numbered[1].toLocaleUpperCase("vi")}. ${name}` : `Bài ${numbered[1].toLocaleUpperCase("vi")}`;
}

export function isGenericLessonTitle(value: unknown, subject = ""): boolean {
  const folded = foldLessonTitle(canonicalizeLessonTitle(value));
  if (!folded) return true;
  const numbered = folded.match(/^bai\s+\d+[a-z]?(?:\s+(.+))?$/);
  if (numbered) return !numbered[1] || isGenericLessonTitle(numbered[1], subject);
  if (new Set(["bai", "bai day", "bai hoc", "bai hoc chua xac dinh", "chua xac dinh", "khong ro", "khong xac dinh", "lesson", "ten bai", "ten bai hoc"]).has(folded)) return true;
  const subjectName = foldLessonTitle(subject);
  if (folded === subjectName || GENERIC_SUBJECT_NAMES.has(folded)) return true;
  const genericSuffix = folded.match(/^bai hoc(?: mon)?\s+(.+)$/)?.[1] || "";
  return Boolean(genericSuffix) && (genericSuffix === subjectName || GENERIC_SUBJECT_NAMES.has(genericSuffix));
}

export function isSpecificLessonTitle(value: unknown, subject = "") {
  const canonical = canonicalizeLessonTitle(value);
  return Boolean(canonical) && !isGenericLessonTitle(canonical, subject);
}

function isAllCapsHeading(value: string) {
  const letters = value.replace(/[^A-Za-zÀ-ỹĐđ]/g, "");
  return letters.length >= 4 && letters === letters.toLocaleUpperCase("vi");
}

function viableHeadingName(value: string) {
  const name = cleanText(value).replace(/^[.:;\-–—)\s]+/, "").trim();
  return name.length >= 3 && name.length <= 220 && !/[?？]$/.test(name) && !TASK_LEAD_PATTERN.test(name)
    && !SECTION_PATTERN.test(name) && !isGenericLessonTitle(name);
}

function candidateConfidence(lineIndex: number, allCaps: boolean, twoLine: boolean) {
  let confidence = twoLine ? 0.9 : 0.78;
  if (lineIndex <= 12) confidence += 0.08;
  else if (lineIndex > 30) confidence -= 0.12;
  if (allCaps) confidence += 0.06;
  return Math.max(0, Math.min(0.99, Number(confidence.toFixed(2))));
}

export function extractOcrLessonTitleEvidence(ocrText: string): LessonTitleEvidence[] {
  const lines = String(ocrText || "").split(/\r?\n/).map((raw, rawIndex) => ({
    raw: cleanText(raw),
    rawIndex,
    marker: OCR_PAGE_MARKER_PATTERN.test(cleanText(raw)),
  })).filter((item) => item.raw);
  const candidates: LessonTitleEvidence[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const current = lines[index];
    if (current.marker) continue;
    if (/^bài\s*$/iu.test(current.raw)) {
      const numberLine = lines[index + 1];
      const nameLine = lines[index + 2];
      const number = numberLine && !numberLine.marker
        ? numberLine.raw.match(/^(?:số\s*)?(\d+[a-z]?)\s*[.:;\-–—)]?$/iu)
        : null;
      if (number && nameLine && !nameLine.marker && viableHeadingName(nameLine.raw)) {
        const title = canonicalizeLessonTitle(`Bài ${number[1]}. ${nameLine.raw}`);
        candidates.push({ raw: `${current.raw}\n${numberLine.raw}\n${nameLine.raw}`, title, source: "ocr-heading", confidence: candidateConfidence(index, isAllCapsHeading(nameLine.raw), true), evidence: [current.raw, numberLine.raw, nameLine.raw], lineStart: current.rawIndex + 1, lineEnd: nameLine.rawIndex + 1 });
        index += 2;
      }
      continue;
    }
    const standalone = current.raw.match(/^bài\s*(?:số\s*)?(\d+[a-z]?)\s*[.:;\-–—)]?$/iu);
    if (standalone) {
      const next = lines[index + 1];
      if (!next || next.marker || !viableHeadingName(next.raw)) continue;
      const title = canonicalizeLessonTitle(`Bài ${standalone[1]}. ${next.raw}`);
      candidates.push({ raw: `${current.raw}\n${next.raw}`, title, source: "ocr-heading", confidence: candidateConfidence(index, isAllCapsHeading(current.raw) || isAllCapsHeading(next.raw), true), evidence: [current.raw, next.raw], lineStart: current.rawIndex + 1, lineEnd: next.rawIndex + 1 });
      continue;
    }
    const parts = current.raw.match(/^bài\s*(?:số\s*)?(\d+[a-z]?)(?:\s*[.:;\-–—)]\s*|\s+)(.+)$/iu);
    if (parts && viableHeadingName(parts[2])) {
      const title = canonicalizeLessonTitle(current.raw);
      candidates.push({ raw: current.raw, title, source: "ocr-heading", confidence: candidateConfidence(index, isAllCapsHeading(current.raw), false), evidence: [current.raw], lineStart: current.rawIndex + 1, lineEnd: current.rawIndex + 1 });
    } else if (index <= 12 && /^(?:chủ\s*đề|ôn\s*tập)\b/iu.test(current.raw) && viableHeadingName(current.raw)) {
      candidates.push({ raw: current.raw, title: canonicalizeLessonTitle(current.raw), source: "ocr-heading", confidence: Math.min(0.95, 0.82 + (isAllCapsHeading(current.raw) ? 0.08 : 0)), evidence: [current.raw], lineStart: current.rawIndex + 1, lineEnd: current.rawIndex + 1 });
    }
  }
  const deduped = new Map<string, LessonTitleEvidence>();
  for (const candidate of candidates) {
    const key = foldLessonTitle(candidate.title);
    if (!deduped.has(key) || deduped.get(key)!.confidence < candidate.confidence) deduped.set(key, candidate);
  }
  return [...deduped.values()].sort((left, right) => right.confidence - left.confidence || left.lineStart - right.lineStart);
}

const SOURCE_PRIORITY: Record<LessonTitleSource, number> = {
  "ocr-heading": 700, "user-input": 600, "source-truth": 500, "source-facts": 400,
  "lesson-map": 300, "blueprint": 200, "generated-output": 100, "legacy": 50,
};

export function lessonTitlesEqual(left: unknown, right: unknown) {
  return foldLessonTitle(canonicalizeLessonTitle(left)) === foldLessonTitle(canonicalizeLessonTitle(right));
}

export function resolveLessonTitle(options: { subject?: string; ocrText?: string; candidates?: LessonTitleCandidate[] }): LessonTitleResolution {
  const subject = options.subject || "";
  const normalized = [
    ...extractOcrLessonTitleEvidence(options.ocrText || "").map((candidate) => ({ value: candidate.title, source: candidate.source as LessonTitleSource, confidence: candidate.confidence, evidence: candidate.evidence })),
    ...(options.candidates || []),
  ].map((candidate, index) => ({ title: canonicalizeLessonTitle(candidate.value), source: candidate.source, confidence: Math.max(0, Math.min(1, candidate.confidence ?? 0.9)), evidence: (candidate.evidence || []).map(cleanText).filter(Boolean), index }))
    .filter((candidate) => isSpecificLessonTitle(candidate.title, subject))
    .filter((candidate) => candidate.source !== "ocr-heading" || candidate.confidence >= 0.8)
    .sort((left, right) => SOURCE_PRIORITY[right.source] - SOURCE_PRIORITY[left.source] || right.confidence - left.confidence || left.index - right.index);
  const topOcr = normalized.filter((candidate) => candidate.source === "ocr-heading");
  if (topOcr.length > 1) {
    const conflict = topOcr.find((candidate) => !lessonTitlesEqual(candidate.title, topOcr[0].title) && Math.abs(candidate.confidence - topOcr[0].confidence) < 0.04);
    if (conflict) {
      const user = normalized.find((candidate) => candidate.source === "user-input");
      const matched = user && [topOcr[0], conflict].find((candidate) => lessonTitlesEqual(candidate.title, user.title));
      if (matched) return { status: "resolved", title: matched.title, source: "ocr-heading", confidence: matched.confidence, reason: "Tiêu đề người dùng khớp heading OCR.", evidence: matched.evidence };
      return { status: "unresolved", title: "", source: null, confidence: 0, reason: "OCR có nhiều heading tên bài mâu thuẫn nên không thể khóa an toàn.", evidence: [...topOcr[0].evidence, ...conflict.evidence] };
    }
  }
  const selected = normalized[0];
  return selected
    ? { status: "resolved", title: selected.title, source: selected.source, confidence: selected.confidence, reason: `Đã khóa tên bài từ nguồn ${selected.source}.`, evidence: selected.evidence }
    : { status: "unresolved", title: "", source: null, confidence: 0, reason: LESSON_TITLE_REQUIRED_MESSAGE, evidence: [] };
}

export class LessonTitleResolutionError extends Error {
  readonly code = "LESSON_TITLE_UNRESOLVED";
  readonly status = 422;
  constructor(message = LESSON_TITLE_REQUIRED_MESSAGE) { super(message); this.name = "LESSON_TITLE_UNRESOLVED"; }
}

export function requireResolvedLessonTitle(resolution: LessonTitleResolution) {
  if (resolution.status !== "resolved" || !isSpecificLessonTitle(resolution.title)) throw new LessonTitleResolutionError();
  return resolution.title;
}

export function assertSpecificLessonTitle(value: unknown, subject = "") {
  const title = canonicalizeLessonTitle(value);
  if (!isSpecificLessonTitle(title, subject)) throw new LessonTitleResolutionError();
  return title;
}
