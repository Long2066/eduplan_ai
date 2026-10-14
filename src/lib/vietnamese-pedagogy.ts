/**
 * vietnamese-pedagogy.ts
 *
 * Rule-based classifier for Vietnamese (Tiếng Việt) lesson types
 * and lesson-type-specific pedagogy profiles.
 *
 * Runs BEFORE the AI model so classification is testable, explainable
 * and deterministic. The blueprint AI may refine within evidence bounds
 * but must record reasons.
 */

import type {
  LessonInput,
  VietnameseLessonType,
  VietnameseLessonClassification,
} from "@/types/lesson";
import { gradeBandFor } from "./pedagogy-profiles";

// ─── LESSON-TYPE SIGNAL PATTERNS ───

type SignalRule = {
  type: VietnameseLessonType;
  /** High-specificity keywords found in lesson title */
  titleKeywords: RegExp;
  /** Supporting keywords found in OCR body */
  ocrKeywords: RegExp;
  /** Weight for scoring; higher = stronger signal */
  weight: number;
  /** Only applicable for certain grade bands */
  gradeBands?: string[];
};

const signalRules: SignalRule[] = [
  // ── phonics (lớp 1, some lớp 2) ──
  {
    type: "phonics",
    titleKeywords: /\b(âm|chữ|vần|học vần|bài\s+\d+[.:]\s*(âm|chữ|vần))/i,
    ocrKeywords: /ghép (tiếng|vần)|đánh vần|phân tích tiếng|tiếng\s+mới|âm\s+đầu|vần\s+(mới|ôn)|nối tiếng/i,
    weight: 10,
    gradeBands: ["Lớp 1-2"],
  },
  // ── handwriting ──
  {
    type: "handwriting",
    titleKeywords: /tập viết|viết chữ|chữ hoa|chữ viết thường|nét (cơ bản|chữ)/i,
    ocrKeywords: /nét (móc|thắt|khuyết|cong|sổ|ngang)|cỡ chữ|dòng kẻ|tô chữ|điểm đặt bút|viết đúng mẫu/i,
    weight: 9,
  },
  // ── spelling ──
  {
    type: "spelling",
    titleKeywords: /chính tả|nghe[- ]viết|nhớ[- ]viết|tập chép/i,
    ocrKeywords: /nghe[- ]viết|nhớ[- ]viết|viết đúng|phân biệt (ch\/tr|s\/x|d\/gi|l\/n|r\/d|ng\/ngh|g\/gh|c\/k|ă\/â|ơ\/ô)|quy tắc chính tả|từ khó/i,
    weight: 9,
  },
  // ── language-knowledge ──
  {
    type: "language-knowledge",
    titleKeywords: /luyện từ và câu|từ và câu|mở rộng vốn từ|dấu (câu|chấm|phẩy|hỏi|chấm than|hai chấm)|từ (loại|đồng nghĩa|trái nghĩa|nhiều nghĩa|đồng âm|ghép|láy)|kiểu câu|câu (kể|hỏi|cảm|khiến|ghép|đơn|mở rộng)/i,
    ocrKeywords: /danh từ|động từ|tính từ|đại từ|quan hệ từ|chủ ngữ|vị ngữ|trạng ngữ|bổ ngữ|dấu (chấm|phẩy|hỏi|than|hai chấm|gạch ngang)|câu (kể|hỏi|cảm|khiến)/i,
    weight: 9,
  },
  // ── speaking-listening ──
  {
    type: "speaking-listening",
    titleKeywords: /nói và nghe|kể chuyện|nghe[- ]kể|thuyết trình|trao đổi|nói (theo|về)|nghe (hiểu|và)/i,
    ocrKeywords: /kể lại|nghe bạn kể|nói trước lớp|trình bày|chia sẻ ý kiến|lượt lời|người nghe|người nói|tiêu chí nói/i,
    weight: 8,
  },
  // ── composition ──
  {
    type: "composition",
    titleKeywords: /tập làm văn|viết (đoạn|bài|thư|đơn|báo cáo)|lập dàn ý|viết (kể|tả|cảm nghĩ|miêu tả|biểu cảm|thuyết minh)|viết sáng tạo/i,
    ocrKeywords: /dàn (ý|bài)|câu mở đầu|câu kết|đoạn văn|bài văn|viết theo (đề|gợi ý)|chỉnh sửa bài|tiêu chí viết/i,
    weight: 8,
  },
  // ── reading (broadest, lowest priority) ──
  {
    type: "reading",
    titleKeywords: /tập đọc|đọc hiểu|bài đọc|đọc (mở rộng|nâng cao)|đọc:|luyện đọc|bài\s+\d+[.:]/i,
    ocrKeywords: /đọc (thầm|thành tiếng|nối tiếp|phân vai|diễn cảm)|câu hỏi|ý chính|chi tiết|nhân vật|bài (thơ|văn|đọc)|nội dung (bài|đoạn)/i,
    weight: 6,
  },
];

// ─── CLASSIFIER ───

function normalizeText(text: string): string {
  return text
    .normalize("NFC")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * Strip Vietnamese diacritics so "chinh ta" matches "chính tả".
 * This is a coarse normalization for classifier resilience, not for display.
 */
function stripDiacritics(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f\u0323\u031b]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase();
}

/**
 * Create a diacritics-free version of a regex for fallback matching.
 */
function stripRegexDiacritics(regex: RegExp): RegExp {
  const stripped = stripDiacritics(regex.source);
  return new RegExp(stripped, regex.flags);
}

type ScoredType = {
  type: VietnameseLessonType;
  score: number;
  evidence: string[];
};

export function isVietnameseSubjectName(subject: unknown): boolean {
  return /^(tiếng\s*việt|tieng\s*viet)$/i.test(String(subject || "").trim());
}

export function classifyVietnameseLesson(
  input: LessonInput,
  ocrText: string,
): VietnameseLessonClassification {
  const gradeBand = gradeBandFor(input.grade);
  const title = normalizeText(`${input.lessonTitle || ""} ${input.subject || ""}`);
  const ocr = normalizeText(ocrText || "");
  const specialRequest = normalizeText(input.specialRequest || "");

  // Also prepare stripped-diacritics versions for fallback matching
  const titleStripped = stripDiacritics(`${input.lessonTitle || ""} ${input.subject || ""}`);
  const ocrStripped = stripDiacritics(ocrText || "");

  const scores = new Map<VietnameseLessonType, ScoredType>();

  for (const rule of signalRules) {
    // Skip rules that don't apply to this grade band
    if (rule.gradeBands && !rule.gradeBands.includes(gradeBand)) continue;

    const entry: ScoredType = scores.get(rule.type) || { type: rule.type, score: 0, evidence: [] };

    // Title match is strongest signal (try NFC first, then stripped)
    if (rule.titleKeywords.test(title)) {
      const match = title.match(rule.titleKeywords);
      entry.score += rule.weight * 2;
      entry.evidence.push(`Tên bài khớp: "${match?.[0] || rule.type}"`);
    } else {
      const strippedPattern = stripRegexDiacritics(rule.titleKeywords);
      if (strippedPattern.test(titleStripped)) {
        const match = titleStripped.match(strippedPattern);
        entry.score += Math.ceil(rule.weight * 1.5);
        entry.evidence.push(`Tên bài khớp (không dấu): "${match?.[0] || rule.type}"`);
      }
    }

    // OCR body match (try NFC first, then stripped)
    if (rule.ocrKeywords.test(ocr)) {
      const match = ocr.match(rule.ocrKeywords);
      entry.score += rule.weight;
      entry.evidence.push(`Nội dung ảnh khớp: "${match?.[0] || rule.type}"`);
    } else {
      const strippedPattern = stripRegexDiacritics(rule.ocrKeywords);
      if (strippedPattern.test(ocrStripped)) {
        const match = ocrStripped.match(strippedPattern);
        entry.score += Math.ceil(rule.weight * 0.7);
        entry.evidence.push(`Nội dung ảnh khớp (không dấu): "${match?.[0] || rule.type}"`);
      }
    }

    // Special request match (lighter weight)
    if (rule.ocrKeywords.test(specialRequest) || rule.titleKeywords.test(specialRequest)) {
      entry.score += Math.ceil(rule.weight * 0.5);
      entry.evidence.push("Yêu cầu đặc biệt khớp");
    }

    if (entry.score > 0) {
      scores.set(rule.type, entry);
    }
  }

  // Sort by score descending
  const ranked = [...scores.values()].sort((a, b) => b.score - a.score);

  // No signals at all
  if (!ranked.length) {
    return {
      primaryType: "mixed",
      secondaryTypes: [],
      confidence: "low",
      evidence: ["Không tìm thấy dấu hiệu kiểu bài rõ ràng từ tên bài và nội dung ảnh."],
      gradeBand,
      uncertainties: ["Không đủ tín hiệu để phân loại; sẽ dùng checklist tổng quát."],
    };
  }

  const top = ranked[0];
  const secondaries = ranked
    .slice(1)
    .filter((s) => s.score >= 5)
    .map((s) => s.type);

  // Determine confidence
  let confidence: "high" | "medium" | "low";
  const gap = ranked.length > 1 ? top.score - ranked[1].score : top.score;
  if (top.score >= 15 && gap >= 8) {
    confidence = "high";
  } else if (top.score >= 8) {
    confidence = "medium";
  } else {
    confidence = "low";
  }

  const uncertainties: string[] = [];
  if (confidence === "low") {
    uncertainties.push("Tín hiệu yếu; checker sẽ chỉ kiểm tra năng lực có bằng chứng.");
  }
  if (secondaries.length > 1) {
    uncertainties.push(`Bài có thể tích hợp nhiều kiểu: ${secondaries.join(", ")}.`);
  }

  return {
    primaryType: confidence === "low" ? "mixed" : top.type,
    secondaryTypes: secondaries,
    confidence,
    evidence: top.evidence,
    gradeBand,
    uncertainties,
  };
}

// ─── LESSON-TYPE PROFILES ───

export type VietnameseLessonTypeProfile = {
  type: VietnameseLessonType;
  label: string;
  /** Mandatory micro-activities in sequence order */
  mandatorySequence: string[];
  /** Conditional activities that appear only when relevant */
  conditionalActivities: string[];
  /** Expected learning products */
  learningProducts: string[];
  /** Common errors specific to this lesson type */
  commonErrors: string[];
  /** Assessment criteria specific to this type */
  assessmentCriteria: string[];
  /** Checker keywords: things that MUST be present */
  checkerMustHave: RegExp;
  /** Checker keywords: things that should NOT be required for this type */
  checkerNotRequired: string[];
  /** Grade-specific notes */
  gradeNotes: Record<string, string[]>;
};

export const vietnameseLessonTypeProfiles: Record<VietnameseLessonType, VietnameseLessonTypeProfile> = {
  phonics: {
    type: "phonics",
    label: "Học âm / vần / chữ",
    mandatorySequence: [
      "Nghe/nhận diện âm, vần hoặc chữ mục tiêu qua tranh và câu nhận biết SGK",
      "Phân tích cấu tạo vần (chỉ rõ âm chính và âm cuối; phân biệt các vần trong bài)",
      "Đánh vần và đọc trơn vần mới (mẫu GV, đọc cá nhân/nhóm/cả lớp)",
      "Ghép tiếng mới theo mô hình 2 bước: âm đầu + vần = tiếng cơ sở; sau đó tiếng cơ sở + thanh = tiếng có thanh",
      "Đọc tiếng, từ ngữ ứng dụng nguyên văn SGK (giải nghĩa từ)",
      "Viết chữ/vần và từ ngữ (bảng con trước, vở tập viết sau; tuân thủ quy chuẩn nét viết)",
      "Đọc câu/đoạn ứng dụng nguyên văn SGK",
      "Nói và nghe theo chủ đề tranh SGK",
    ],
    conditionalActivities: [
      "Đọc đoạn ứng dụng có âm-vần vừa học",
      "Trò chơi phân biệt âm-vần dễ nhầm",
    ],
    learningProducts: [
      "Vần đọc trơn và phân tích đúng âm chính, âm cuối",
      "Tiếng ghép đúng theo mô hình 2 bước (kiểm tra cá nhân)",
      "Tiếng/từ đọc đúng nguyên văn SGK",
      "Chữ/tiếng viết đúng mẫu trên bảng con/vở",
      "Câu nói và nghe đúng chủ đề tranh SGK",
    ],
    commonErrors: [
      "Ghép tiếng nhảy cóc một bước (b + an = bạn) thay vì 2 bước (b + an = ban; ban + nặng = bạn)",
      "Thiếu phân tích cấu tạo vần (âm chính và âm cuối)",
      "Bịa chữ hoặc thay từ SGK (như đổi bàn thành bạn, đổi chả sợ thành chẳng sợ)",
      "Nhầm âm đầu dễ lẫn: l/n, ch/tr, s/x, r/d/gi",
      "Nhầm vần gần: an/ang, ăn/ăng, ơn/ơng",
      "Viết sai nét, sai cỡ chữ, sai vị trí dấu thanh",
      "Đọc ê a từng âm không ghép trôi",
    ],
    assessmentCriteria: [
      "Đọc đúng tiếng/từ chứa âm-vần mới",
      "Viết đúng mẫu, đúng dòng kẻ",
      "Ghép được tiếng mới từ âm-vần đã học",
    ],
    checkerMustHave: /âm|vần|tiếng|ghép|phân tích (tiếng|cấu tạo)|đánh vần/i,
    checkerNotRequired: ["đọc hiểu văn bản dài", "lập dàn ý", "viết đoạn", "thuyết trình"],
    gradeNotes: {
      "Lớp 1-2": [
        "Lớp 1 học âm-chữ-vần mới là trọng tâm; lớp 2 chủ yếu ôn và mở rộng.",
        "Dùng thẻ chữ, bảng cài, tranh minh họa, đọc đồng thanh/cá nhân.",
        "Viết trên bảng con trước, sau đó vào vở.",
      ],
    },
  },

  reading: {
    type: "reading",
    label: "Đọc (Tập đọc / Đọc hiểu)",
    mandatorySequence: [
      "Trước khi đọc: khởi động, dự đoán, giới thiệu văn bản/tác giả nếu cần",
      "Đọc thành tiếng/đọc thầm có nhiệm vụ (đọc nối tiếp, đọc phân vai, luyện từ khó/câu dài)",
      "Đọc hiểu: tìm chi tiết, giải nghĩa từ trong ngữ cảnh, trả lời câu hỏi theo tầng",
      "Sau khi đọc: nêu ý chính/cảm nhận/liên hệ bản thân",
    ],
    conditionalActivities: [
      "Luyện đọc diễn cảm (khi văn bản phù hợp và lớp 3+)",
      "Đọc phân vai (khi có đối thoại)",
      "Kể lại/tóm tắt (khi phù hợp mục tiêu)",
    ],
    learningProducts: [
      "Đọc đúng, rõ, biết ngắt nghỉ",
      "Câu trả lời đọc hiểu có bằng chứng",
      "Ý chính/cảm nhận ngắn bằng lời hoặc viết",
    ],
    commonErrors: [
      "Đọc trôi nhưng không hiểu chi tiết, ý chính",
      "Trả lời bằng cách chép nguyên văn bản mà không diễn đạt lại",
      "Nhầm nghĩa từ vì tách khỏi ngữ cảnh",
      "Bỏ qua bằng chứng, trả lời cảm tính",
    ],
    assessmentCriteria: [
      "Đọc đúng tốc độ, rõ tiếng, biết ngắt nghỉ phù hợp",
      "Tìm được chi tiết/dẫn chứng trong văn bản",
      "Nêu được ý chính hoặc cảm nhận dựa trên văn bản",
    ],
    checkerMustHave: /ngữ liệu|văn bản|bài đọc|bài thơ|đoạn (văn|trích)|câu hỏi|chi tiết|đọc/i,
    checkerNotRequired: ["ghép vần", "viết đoạn hoàn chỉnh", "dàn ý", "quy tắc chính tả"],
    gradeNotes: {
      "Lớp 1-2": [
        "Đọc đúng, đọc trơn, trả lời câu hỏi bám tranh và chi tiết dễ nhận ra.",
        "Câu hỏi ngắn, có lựa chọn hoặc gợi ý cho HS yếu.",
      ],
      "Lớp 3": [
        "Chuyển từ học đọc sang đọc để học; câu hỏi suy luận đơn giản.",
        "Bắt đầu giải nghĩa từ trong ngữ cảnh.",
      ],
      "Lớp 4-5": [
        "Đọc hiểu đa tầng: chi tiết, ý chính, biện pháp nghệ thuật, thông điệp.",
        "Nêu bằng chứng, so sánh, liên hệ bản thân.",
      ],
    },
  },

  handwriting: {
    type: "handwriting",
    label: "Tập viết",
    mandatorySequence: [
      "Quan sát mẫu chữ/nét trên bảng hoặc vở mẫu",
      "Phân tích nét cấu tạo, điểm đặt bút, dừng bút, nối nét",
      "GV viết mẫu, HS quan sát và nhận xét",
      "HS luyện viết trên bảng con/vở",
      "Đối chiếu tiêu chí, tự soát, sửa tư thế cầm bút",
    ],
    conditionalActivities: [
      "Viết ứng dụng: từ, cụm từ, câu có chữ vừa học",
    ],
    learningProducts: [
      "Chữ viết đúng mẫu, đúng cỡ, đúng dòng kẻ",
      "Tư thế ngồi, cầm bút đúng",
    ],
    commonErrors: [
      "Sai nét cong, nét khuyết, nét móc",
      "Viết không đúng cỡ chữ hoặc khoảng cách",
      "Sai vị trí dấu thanh",
      "Tư thế cầm bút, ngồi viết không đúng",
    ],
    assessmentCriteria: [
      "Viết đúng mẫu chữ, nét, cỡ và khoảng cách",
      "Tư thế ngồi, cầm bút đúng quy cách",
      "Viết đều, sạch, rõ ràng",
    ],
    checkerMustHave: /mẫu (chữ|viết)|nét|cỡ chữ|dòng kẻ|điểm đặt bút|tập viết|viết (đúng|mẫu)|tư thế/i,
    checkerNotRequired: ["đọc hiểu", "câu hỏi đọc", "lập ý", "nói và nghe", "chính tả nghe viết"],
    gradeNotes: {
      "Lớp 1-2": [
        "Lớp 1 viết chữ thường, nét cơ bản; lớp 2 viết chữ hoa.",
        "Dùng bảng con, viết mẫu, nhận xét mẫu trước khi HS viết vào vở.",
      ],
      "Lớp 3": [
        "Viết chữ hoa ứng dụng, viết cụm từ/câu.",
      ],
    },
  },

  spelling: {
    type: "spelling",
    label: "Chính tả",
    mandatorySequence: [
      "Chuẩn bị: đọc/nghe đoạn viết, tìm từ khó, phân tích âm-vần dễ lẫn",
      "Nghe viết hoặc nhớ viết theo quy trình",
      "Soát lỗi: HS tự soát, đổi bài soát hoặc GV chấm nhanh",
      "Bài tập chính tả: phân biệt âm-vần, điền từ, sửa lỗi",
      "Sửa lỗi cá nhân, ghi nhớ quy tắc",
    ],
    conditionalActivities: [
      "Trò chơi phân biệt chính tả nếu còn thời gian",
    ],
    learningProducts: [
      "Bài chính tả viết đúng, sạch, đúng tốc độ",
      "Bài tập phân biệt đúng",
      "Danh sách từ khó cá nhân",
    ],
    commonErrors: [
      "Nhầm phụ âm đầu: ch/tr, s/x, d/gi/r, l/n",
      "Nhầm vần: an/ang, ăn/ăng, ươn/ương",
      "Thiếu hoặc sai dấu thanh",
      "Viết hoa sai quy tắc",
    ],
    assessmentCriteria: [
      "Viết đúng chính tả theo yêu cầu bài",
      "Tự phát hiện và sửa lỗi",
      "Phân biệt đúng cặp âm-vần dễ lẫn",
    ],
    checkerMustHave: /chính tả|nghe[- ]viết|nhớ[- ]viết|từ khó|soát (lỗi|bài)|phân biệt|quy tắc/i,
    checkerNotRequired: ["đọc hiểu văn bản", "ý chính", "cảm nhận", "lập dàn ý", "thuyết trình"],
    gradeNotes: {
      "Lớp 1-2": [
        "Chủ yếu tập chép và nghe-viết câu ngắn, đoạn ngắn.",
        "Từ khó cần phân tích rõ âm-vần trước khi viết.",
      ],
      "Lớp 3": ["Nhớ-viết xuất hiện; đoạn dài hơn; bài tập chính tả phân biệt."],
      "Lớp 4-5": ["Nghe-viết đoạn dài hơn; bài tập chính tả gắn kiến thức từ vựng."],
    },
  },

  composition: {
    type: "composition",
    label: "Viết (Tập làm văn / Viết đoạn-bài)",
    mandatorySequence: [
      "Phân tích yêu cầu đề và ngữ liệu mẫu nếu có",
      "Tìm ý / lập dàn ý theo khung gợi ý",
      "Viết bản nháp / viết đoạn",
      "Đọc soát, chỉnh sửa theo tiêu chí (tự sửa hoặc đồng đẳng)",
      "Chia sẻ sản phẩm viết",
    ],
    conditionalActivities: [
      "Viết lại bản hoàn chỉnh sau chỉnh sửa (khi bố trí đủ thời gian)",
    ],
    learningProducts: [
      "Dàn ý / sơ đồ ý",
      "Đoạn/bài viết theo yêu cầu",
      "Bản chỉnh sửa (nếu có)",
    ],
    commonErrors: [
      "Viết không đúng yêu cầu đề",
      "Thiếu câu mở đầu hoặc câu kết",
      "Ý lộn xộn, không theo trình tự",
      "Dùng từ lặp, câu cụt, thiếu từ nối",
      "Không chỉnh sửa, coi bản đầu là sản phẩm cuối",
    ],
    assessmentCriteria: [
      "Viết đúng kiểu bài, đủ ý theo dàn ý",
      "Câu đúng ngữ pháp, có từ nối, dấu câu đúng",
      "Có chỉnh sửa sau khi đọc lại hoặc nhận góp ý",
    ],
    checkerMustHave: /viết (đoạn|bài|thư|đơn)|dàn (ý|bài)|câu (mở|kết)|lập ý|tìm ý|chỉnh sửa|tiêu chí viết/i,
    checkerNotRequired: ["luyện đọc thành tiếng", "ghép vần", "đọc diễn cảm", "chính tả nghe viết"],
    gradeNotes: {
      "Lớp 1-2": [
        "Viết 1-3 câu theo mẫu/gợi ý; lớp 2 bắt đầu viết đoạn 3-5 câu.",
        "Cần khung câu, từ gợi ý, mẫu cụ thể.",
      ],
      "Lớp 3": [
        "Viết đoạn 5-7 câu; lập ý đơn giản; bắt đầu có chỉnh sửa.",
      ],
      "Lớp 4-5": [
        "Viết bài hoàn chỉnh; lập dàn ý; quy trình viết rõ: tìm ý → viết → sửa.",
        "Tiêu chí đánh giá bài viết rõ ràng.",
      ],
    },
  },

  "language-knowledge": {
    type: "language-knowledge",
    label: "Luyện từ và câu / Kiến thức tiếng Việt",
    mandatorySequence: [
      "Khám phá ngữ liệu: quan sát, đọc ví dụ/đoạn có hiện tượng ngôn ngữ",
      "Nhận xét, so sánh, phát hiện đặc điểm / quy tắc",
      "GV chốt kiến thức / quy tắc",
      "Luyện nhận diện: tìm, phân loại, xác định trong ngữ liệu mới",
      "Luyện sử dụng: đặt câu, viết đoạn ngắn, sửa lỗi dùng từ/câu",
    ],
    conditionalActivities: [
      "Trò chơi ngôn ngữ: sơ đồ từ, ghép từ, đố từ",
      "Mở rộng vốn từ theo chủ đề",
    ],
    learningProducts: [
      "Bài tập nhận diện đúng",
      "Câu/đoạn viết sử dụng đúng kiến thức vừa học",
      "Sơ đồ từ hoặc bảng phân loại",
    ],
    commonErrors: [
      "Nhớ tên quy tắc nhưng không nhận ra trong ngữ cảnh",
      "Đặt câu đúng quy tắc nhưng vô nghĩa hoặc thiếu tự nhiên",
      "Nhầm từ loại, kiểu câu vì chưa phân biệt chức năng",
    ],
    assessmentCriteria: [
      "Nhận diện đúng hiện tượng ngôn ngữ trong ngữ liệu",
      "Sử dụng đúng từ/câu/dấu câu trong viết hoặc nói",
      "Sửa được lỗi dùng từ, đặt câu thường gặp",
    ],
    checkerMustHave: /từ (loại|đồng|trái|nhiều nghĩa|ghép|láy|mới)|dấu (câu|chấm|phẩy)|kiểu câu|câu (kể|hỏi|cảm|khiến)|chủ ngữ|vị ngữ|ngữ liệu|quy tắc|luyện từ/i,
    checkerNotRequired: ["đọc hiểu văn bản dài", "viết bài hoàn chỉnh", "kể chuyện", "chính tả nghe viết"],
    gradeNotes: {
      "Lớp 1-2": ["Mở rộng vốn từ theo chủ đề, đặt câu đơn giản, dấu chấm/dấu phẩy."],
      "Lớp 3": ["Từ loại cơ bản, kiểu câu đơn, dấu câu đa dạng hơn."],
      "Lớp 4-5": ["Từ loại đầy đủ, câu ghép, thành phần câu, từ nhiều nghĩa, biện pháp tu từ đơn giản."],
    },
  },

  "speaking-listening": {
    type: "speaking-listening",
    label: "Nói và nghe",
    mandatorySequence: [
      "Chuẩn bị nội dung/tiêu chí nói-nghe",
      "Nói/nghe theo lượt (cá nhân, cặp, nhóm)",
      "Người nghe có nhiệm vụ: hỏi lại, nhận xét, ghi chú",
      "Hỏi-đáp / phản hồi sau khi nói",
      "Tự điều chỉnh theo tiêu chí và góp ý",
    ],
    conditionalActivities: [
      "Đóng vai, kể chuyện theo tranh/gợi ý",
      "Thuyết trình ngắn trước lớp (lớp 4-5)",
    ],
    learningProducts: [
      "Phần trình bày nói (đánh giá theo tiêu chí)",
      "Câu hỏi/phản hồi của người nghe",
      "Phiếu tự đánh giá hoặc đánh giá đồng đẳng",
    ],
    commonErrors: [
      "Nói lan man, không theo trình tự",
      "Người nghe thụ động, không có nhiệm vụ",
      "Ngại nói trước lớp, nói nhỏ, nói cụt",
      "Hỏi-đáp chỉ hình thức, không có phản hồi thật",
    ],
    assessmentCriteria: [
      "Nói đủ ý, rõ ràng, đúng trình tự",
      "Nghe hiểu, hỏi lại hoặc nhận xét phù hợp",
      "Tự điều chỉnh cách nói sau phản hồi",
    ],
    checkerMustHave: /nói (và nghe|trước|theo)|kể (chuyện|lại)|nghe (bạn|kể|và)|trình bày|lượt lời|người (nghe|nói)|trao đổi|chia sẻ ý kiến/i,
    checkerNotRequired: ["viết đoạn", "lập dàn ý", "đọc hiểu chi tiết", "chính tả", "ghép vần"],
    gradeNotes: {
      "Lớp 1-2": [
        "Kể lại câu chuyện ngắn theo tranh, nói 2-3 câu về chủ đề.",
        "Nghe hiểu câu hỏi đơn giản, trả lời bằng câu.",
      ],
      "Lớp 3": ["Kể có trình tự, nói có ý chính, nghe và hỏi lại."],
      "Lớp 4-5": ["Thuyết trình ngắn, trao đổi có lý lẽ, phản hồi lịch sự."],
    },
  },

  mixed: {
    type: "mixed",
    label: "Tích hợp / Chủ đề",
    mandatorySequence: [
      "Xác định năng lực trọng tâm của từng tiết trong blueprint",
      "Mỗi tiết theo chuỗi của kiểu bài chính được gán",
    ],
    conditionalActivities: [
      "Tích hợp kĩ năng phụ ở mức tự nhiên, không ép",
    ],
    learningProducts: [
      "Theo kiểu bài chính của từng tiết",
    ],
    commonErrors: [
      "Nhồi quá nhiều kĩ năng vào một tiết",
      "Mỗi kĩ năng chỉ được lướt qua, không sâu",
      "Các tiết lặp cùng mục tiêu",
    ],
    assessmentCriteria: [
      "Từng tiết đạt tiêu chí của kiểu bài chính",
    ],
    checkerMustHave: /./i, // mixed always passes basic check; per-period checks apply
    checkerNotRequired: [],
    gradeNotes: {},
  },
};

// ─── HELPER: get checklist for a classification ───

export function getVietnameseChecklist(
  classification: VietnameseLessonClassification,
): string[] {
  const profile = vietnameseLessonTypeProfiles[classification.primaryType];
  if (!profile) return [];

  const checks: string[] = [];
  checks.push(`Kiểu bài: ${profile.label} (${classification.confidence})`);

  for (const step of profile.mandatorySequence) {
    checks.push(`☐ ${step}`);
  }

  const gradeChecks = profile.gradeNotes[classification.gradeBand] || [];
  for (const note of gradeChecks) {
    checks.push(`☐ [${classification.gradeBand}] ${note}`);
  }

  return checks;
}

// ─── HELPER: get checker flags for a period ───

export function getCheckerFlagsForType(lessonType: VietnameseLessonType): {
  requiresReading: boolean;
  requiresWriting: boolean;
  requiresSpeakingListening: boolean;
  requiresLanguageKnowledge: boolean;
  requiresPhonics: boolean;
} {
  return {
    requiresReading: lessonType === "reading",
    requiresWriting: lessonType === "composition" || lessonType === "handwriting" || lessonType === "spelling",
    requiresSpeakingListening: lessonType === "speaking-listening",
    requiresLanguageKnowledge: lessonType === "language-knowledge",
    requiresPhonics: lessonType === "phonics",
  };
}

// ─── GRADE-SPECIFIC DETAILED WORKFLOWS (LỚP 1–5) ───

export type VietnameseGradeWorkflow = {
  id: string;
  grade: number;
  label: string;
  applicableTypes: VietnameseLessonType[];
  stepsSummary: string[];
  mandatoryStepsByPeriod?: Record<number, string[]>;
  pedagogicalFocus: string[];
};

export const vietnameseGradeWorkflows: Record<string, VietnameseGradeWorkflow> = {
  // LỚP 1
  "grade1-phonics-2p": {
    id: "grade1-phonics-2p",
    grade: 1,
    label: "Lớp 1: Dạng bài Âm - Chữ - Vần (2 tiết)",
    applicableTypes: ["phonics", "handwriting"],
    stepsSummary: [
      "Tiết 1: 1. Ôn và khởi động; 2. Nhận biết (quan sát tranh, câu nhận biết, giới thiệu âm/chữ/vần mới); 3. Đọc (luyện đọc âm/vần, đánh vần, đọc trơn tiếng/từ khóa); 4. Viết bảng (GV viết mẫu quy trình, HS viết bảng con, nhận xét sửa lỗi).",
      "Tiết 2: 1. Viết vở (tô/viết âm, chữ, vần, từ ngữ vào Vở tập viết); 2. Đọc câu/đoạn (đọc thầm tìm tiếng chứa vần mới, GV đọc mẫu, HS luyện đọc và trả lời câu hỏi); 3. Nói theo tranh (quan sát tranh, thảo luận nhóm, trả lời câu hỏi hoặc đóng vai); 4. Củng cố (tìm từ ngữ mới, đặt câu, dặn dò).",
    ],
    mandatoryStepsByPeriod: {
      1: [
        "Khởi động: trò chơi ôn bài cũ, tạo tâm thế",
        "Nhận biết: quan sát tranh, nghe/đọc câu nhận biết, chỉ ra âm/chữ/vần mới",
        "Luyện đọc: đọc âm/vần mới, đánh vần, ghép tiếng, đọc trơn tiếng/từ khóa",
        "Luyện viết bảng: GV viết mẫu điểm đặt bút/nét nối/cỡ chữ, HS viết bảng con",
      ],
      2: [
        "Luyện viết vở: tô và viết âm/chữ/vần/từ ngữ vào Vở tập viết, đúng tư thế",
        "Luyện đọc câu/đoạn: đọc thầm tìm tiếng có vần mới, GV đọc mẫu, luyện đọc trơn và tìm hiểu nội dung đơn giản",
        "Nói theo tranh: thảo luận nhóm, nói 1-2 câu theo chủ đề tranh hoặc đóng vai",
        "Vận dụng/Củng cố: tìm tiếng/từ mới ngoài bài, dặn dò thực hành",
      ],
    },
    pedagogicalFocus: [
      "Lớp 1 học vần: không dùng câu hỏi suy luận sâu hay phân tích tu từ",
      "Viết bảng con ở tiết 1, viết vào vở tập viết ở tiết 2",
      "Đọc từ âm/vần → tiếng → từ ngữ → câu/đoạn ứng dụng",
      "Hoạt động nói gắn trực tiếp với tranh và chủ đề gần gũi",
    ],
  },
  "grade1-reading-4p": {
    id: "grade1-reading-4p",
    grade: 1,
    label: "Lớp 1: Dạng bài Đọc hiểu văn bản (4 tiết - Tập 2)",
    applicableTypes: ["reading", "composition", "spelling"],
    stepsSummary: [
      "Tiết 1: Ôn/khởi động → GV đọc mẫu toàn văn bản → HS luyện đọc từ khó, đọc nối tiếp câu/đoạn, giải nghĩa từ khó, đọc toàn bài.",
      "Tiết 2: Trả lời câu hỏi đọc hiểu (làm việc nhóm/lớp) → Viết vào vở câu trả lời (hướng dẫn viết hoa, dấu câu).",
      "Tiết 3: Chọn từ ngữ để hoàn thiện câu và viết vào vở → Quan sát tranh và nói/kể chuyện (dùng từ gợi ý, đóng vai kể lại).",
      "Tiết 4: Nghe viết (hướng dẫn chữ dễ sai, đọc từng cụm từ viết chính tả đoạn ngắn, soát lỗi) → Làm bài tập/mở rộng → Củng cố.",
    ],
    mandatoryStepsByPeriod: {
      1: ["Ôn và khởi động", "Luyện đọc thành tiếng: đọc mẫu, đọc nối tiếp câu/đoạn, sửa phát âm từ khó"],
      2: ["Trả lời câu hỏi đọc hiểu văn bản", "Viết vào vở câu trả lời đúng quy cách chữ hoa và dấu câu"],
      3: ["Chọn từ ngữ hoàn thiện câu và viết vào vở", "Quan sát tranh và nói/kể chuyện"],
      4: ["Nghe viết chính tả đoạn ngắn và soát lỗi", "Bài tập chính tả/mở rộng và củng cố"],
    },
    pedagogicalFocus: [
      "Tiết 1 tập trung đọc đúng, đọc trơn văn bản",
      "Tiết 2 tập trung đọc hiểu và viết câu trả lời",
      "Tiết 3 luyện tập dùng từ ngữ và nói theo tranh",
      "Tiết 4 rèn nghe - viết và củng cố toàn bài",
    ],
  },
  "grade1-review-2p": {
    id: "grade1-review-2p",
    grade: 1,
    label: "Lớp 1: Dạng bài Ôn tập và Kể chuyện (2 tiết)",
    applicableTypes: ["phonics", "speaking-listening", "mixed"],
    stepsSummary: [
      "Tiết 1: Khởi động → Đọc âm, tiếng, từ ngữ ôn tập → Đọc câu/đoạn ứng dụng → Tô và viết cụm từ ứng dụng/chữ số vào vở.",
      "Tiết 2: Kể chuyện (GV kể toàn bộ lần 1; GV kể từng đoạn kèm câu hỏi lần 2; HS dựa tranh/gợi ý kể lại từng đoạn hoặc cả câu chuyện) → Củng cố.",
    ],
    mandatoryStepsByPeriod: {
      1: ["Khởi động", "Đọc âm, tiếng, từ ngữ", "Đọc câu/đoạn", "Viết cụm từ ứng dụng vào vở"],
      2: ["Nghe kể chuyện 2 lượt (toàn bộ và từng đoạn)", "HS kể lại theo tranh gợi ý", "Củng cố/liên hệ"],
    },
    pedagogicalFocus: [
      "Tiết 1 ôn luyện kĩ năng đọc và viết cơ bản",
      "Tiết 2 rèn nghe - kể chuyện: bắt buộc GV kể mẫu 2 lượt rõ ràng",
    ],
  },

  // LỚP 2
  "grade2-reading": {
    id: "grade2-reading",
    grade: 2,
    label: "Lớp 2: Mạch Đọc văn bản",
    applicableTypes: ["reading"],
    stepsSummary: [
      "1. Khởi động: quan sát tranh, nghe bài hát/video ngắn liên quan chủ đề bài đọc.",
      "2. Đọc văn bản: GV giới thiệu/đọc mẫu toàn bài; hướng dẫn luyện đọc từ ngữ khó, câu dài; chia đoạn; HS luyện đọc nối tiếp đoạn, đọc nhóm, đọc toàn bài.",
      "3. Trả lời câu hỏi: làm việc cá nhân/nhóm trả lời câu hỏi đọc hiểu; GV mở rộng nhẹ nhàng, hỗ trợ HS yếu.",
      "4. Luyện tập sau bài đọc: bài tập từ ngữ/câu hoặc luyện đọc lại, đọc thầm theo yêu cầu.",
    ],
    pedagogicalFocus: [
      "Luyện đọc câu dài có ngắt nghỉ /; giải nghĩa từ ngữ đơn giản trong ngữ cảnh",
      "Sau trả lời câu hỏi có thể mở rộng liên hệ thực tế phù hợp",
      "HS yếu được hỗ trợ câu hỏi ngắn; HS đọc trơn đọc to rõ",
    ],
  },
  "grade2-composition": {
    id: "grade2-composition",
    grade: 2,
    label: "Lớp 2: Mạch Luyện viết đoạn",
    applicableTypes: ["composition"],
    stepsSummary: [
      "1. Hoạt động mở đầu: trò chơi/hát dẫn dắt giới thiệu bài.",
      "2. Hoạt động hình thành kiến thức: Hoạt động 1 (Nói theo tranh/gợi ý trước khi viết) → Hoạt động 2 (Hướng dẫn viết đoạn văn: làm việc chung đọc yêu cầu, làm việc nhóm trao đổi ý, viết cá nhân vào vở, đổi bài soát lỗi, nhận xét sửa bài).",
      "3. Củng cố, dặn dò: nhận xét tiết học, nhắc nhở chỉnh sửa.",
    ],
    pedagogicalFocus: [
      "Phải cho HS nói trước khi viết đoạn 3–5 câu",
      "Có khung gợi ý câu hỏi/từ ngữ trợ giúp",
      "HS viết xong có bước đổi vở soát lỗi hoặc tự soát",
    ],
  },
  "grade2-handwriting": {
    id: "grade2-handwriting",
    grade: 2,
    label: "Lớp 2: Mạch Tập viết (Chữ hoa & Ứng dụng)",
    applicableTypes: ["handwriting"],
    stepsSummary: [
      "1. Viết chữ hoa: quan sát mẫu chữ hoa (độ cao, độ rộng, các nét), quan sát GV viết mẫu/trình chiếu, HS viết bảng con/giấy nháp, tự nhận xét và viết vào Vở tập viết.",
      "2. Viết ứng dụng: đọc câu ứng dụng, quan sát GV viết mẫu từ chứa chữ hoa đầu câu, hướng dẫn khoảng cách nét nối/dấu chấm cuối câu, HS viết vào Vở tập viết, nhận xét góp ý.",
    ],
    pedagogicalFocus: [
      "Phân tích nét và cỡ chữ của chữ hoa mục tiêu",
      "GV viết mẫu trên bảng trước khi HS thực hành",
      "Kết hợp viết chữ hoa rời và viết câu ứng dụng có chữ hoa",
    ],
  },
  "grade2-spelling": {
    id: "grade2-spelling",
    grade: 2,
    label: "Lớp 2: Mạch Viết chính tả (Nghe - viết & Bài tập)",
    applicableTypes: ["spelling"],
    stepsSummary: [
      "1. Nghe - viết: nêu yêu cầu, đọc cả đoạn, gọi HS đọc lại, hướng dẫn từ khó/chữ dễ sai, đọc từng cụm từ ngắn cho HS viết, đọc lại toàn đoạn soát bài, đổi vở soát lỗi, GV chữa bài trên lớp.",
      "2. Hoàn thành bài tập chính tả: bài tập phân biệt âm/vần/dấu thanh (chung hoặc lựa chọn a/b), chữa bài và chốt đáp án đúng.",
    ],
    pedagogicalFocus: [
      "Đọc từng cụm từ ngắn 2-3 chữ vừa sức học sinh lớp 2",
      "Phân tích từ khó trước khi bắt đầu nghe viết",
      "Có bước đổi vở kiểm tra chéo và bài tập phân biệt âm/vần",
    ],
  },
  "grade2-reading-extension": {
    id: "grade2-reading-extension",
    grade: 2,
    label: "Lớp 2: Mạch Đọc mở rộng",
    applicableTypes: ["reading", "speaking-listening"],
    stepsSummary: [
      "1. Hoạt động mở đầu: kiểm tra chuẩn bị bài đọc của HS, dẫn dắt vào tiết học.",
      "2. Hoạt động đọc mở rộng: HS chia sẻ tên bài/câu chuyện đã chuẩn bị → đọc thầm/đọc nhóm 4 → viết nội dung quan trọng/thú vị vào phiếu đọc sách → thi đọc trước lớp → GV hỏi mở rộng (Vì sao em chọn? Em thích nhất điều gì? Rút ra bài học gì?).",
      "3. Củng cố, dặn dò: hướng dẫn tìm sách đọc ở góc thư viện, dặn dò tiết sau.",
    ],
    pedagogicalFocus: [
      "Tập cho HS thói quen ghi phiếu đọc sách đơn giản",
      "Chia sẻ sách báo đã đọc với bạn cùng lớp",
    ],
  },

  // LỚP 3
  "grade3-reading": {
    id: "grade3-reading",
    grade: 3,
    label: "Lớp 3: Quy trình dạy Tiết Đọc",
    applicableTypes: ["reading"],
    stepsSummary: [
      "1. Khởi động: tranh ảnh, câu hỏi, trò chơi, bài hát, chia sẻ trải nghiệm gắn với chủ điểm bài đọc.",
      "2. Khám phá văn bản: Hoạt động 1 (Luyện đọc thành tiếng: đọc mẫu, chia đoạn, đọc nối tiếp câu/đoạn, luyện từ khó/câu dài, đọc nhóm); Hoạt động 2 (Tìm hiểu nghĩa từ ngữ: qua tranh ảnh, ngữ cảnh, đặt câu); Hoạt động 3 (Đọc hiểu văn bản: đọc thầm, tìm thông tin, trả lời câu hỏi trực tiếp, suy luận nội dung, nhân vật, bài học).",
      "3. Luyện tập: hệ thống hóa nội dung, luyện tập từ ngữ/câu gắn với bài đọc, hoàn thành phiếu học tập hoặc bài tập SGK.",
      "4. Vận dụng: liên hệ bản thân/thực tế, nói điều học được, viết 1-2 câu cảm nghĩ, tìm thêm thông tin.",
    ],
    mandatoryStepsByPeriod: {
      1: [
        "Khởi động: tạo tâm thế kết nối chủ điểm bài đọc",
        "Luyện đọc thành tiếng: đọc mẫu, chia đoạn, đọc nối tiếp câu/đoạn, luyện phát âm từ khó và câu dài",
        "Tìm hiểu nghĩa từ ngữ: giải nghĩa từ ngữ qua ngữ cảnh, tranh ảnh hoặc đặt câu",
      ],
      2: [
        "Đọc hiểu văn bản: đọc thầm, trả lời hệ thống câu hỏi tìm chi tiết, nội dung, nhân vật, bài học",
        "Luyện tập sau bài đọc: bài tập củng cố từ ngữ hoặc câu văn gắn với bài đọc",
        "Vận dụng: liên hệ bản thân, viết 1-2 câu cảm nghĩ hoặc việc làm phù hợp",
      ],
    },
    pedagogicalFocus: [
      "Tách bạch 3 hoạt động trong Khám phá: Luyện đọc thành tiếng → Nghĩa từ ngữ → Đọc hiểu",
      "Cấu trúc tuần học lớp 3 thường tích hợp: Đọc + Nói-nghe (3 tiết đầu) hoặc Đọc + Viết chữ hoa/Đọc mở rộng (4 tiết sau)",
      "Vận dụng yêu cầu liên hệ bản thân hoặc viết 1-2 câu cảm nghĩ",
    ],
  },
  "grade3-spelling": {
    id: "grade3-spelling",
    grade: 3,
    label: "Lớp 3: Mạch Viết chính tả và bài tập chính tả",
    applicableTypes: ["spelling"],
    stepsSummary: [
      "1. Nghe - viết (nhìn - viết / nhớ - viết): nêu yêu cầu, đọc đoạn mẫu, hướng dẫn từ khó/chữ dễ sai (tên riêng, dấu thanh, âm đầu), đọc từng cụm từ, soát lỗi.",
      "2. Hoàn thành bài tập chính tả: luyện tập củng cố viết đúng âm, vần, dấu thanh, tên riêng, dấu câu (bài tập bắt buộc + bài tập lựa chọn).",
      "3. Củng cố, chữa bài: nhận xét bài viết, sửa lỗi phổ biến.",
    ],
    pedagogicalFocus: [
      "Rèn luyện kĩ năng nghe - viết chính xác, đúng tốc độ lớp 3",
      "Phân biệt các âm/vần dễ lẫn (ch/tr, s/x, d/gi/r, l/n, dấu hỏi/ngã)",
    ],
  },
  "grade3-language-knowledge": {
    id: "grade3-language-knowledge",
    grade: 3,
    label: "Lớp 3: Mạch Luyện từ và câu",
    applicableTypes: ["language-knowledge"],
    stepsSummary: [
      "1. Khởi động: trò chơi hoặc tình huống dẫn dắt vào bài học từ ngữ/câu.",
      "2. Khám phá & Nhận biết: quan sát ngữ liệu, phân tích mẫu câu/từ ngữ, nhận biết đặc điểm ngữ pháp (mở rộng vốn từ, dấu câu, biện pháp so sánh).",
      "3. Thực hành, luyện tập: làm bài tập vận dụng (tìm từ, đặt câu, điền dấu câu, viết câu có hình ảnh so sánh).",
      "4. Vận dụng: sử dụng từ ngữ/câu vừa học vào giao tiếp hoặc viết câu văn ngắn.",
    ],
    pedagogicalFocus: [
      "Lớp 3 trọng tâm: mở rộng vốn từ theo chủ điểm, dấu chấm/phẩy/hỏi/than, biện pháp tu từ so sánh",
      "Học sinh phải được tự đặt câu và vận dụng, không chỉ làm bài tập điền khuyết",
    ],
  },
  "grade3-composition": {
    id: "grade3-composition",
    grade: 3,
    label: "Lớp 3: Mạch Tập làm văn / Luyện viết đoạn văn",
    applicableTypes: ["composition"],
    stepsSummary: [
      "1. Khởi động: dẫn dắt tạo hứng thú theo đề tài bài viết (kể, tả, cảm nghĩ, giới thiệu).",
      "2. Chuẩn bị viết (Nói trước khi viết): quan sát tranh/gợi ý/trải nghiệm bản thân, thảo luận nhóm, tìm ý và sắp xếp ý.",
      "3. Thực hành viết đoạn văn: HS viết đoạn văn ngắn (5-7 câu) vào vở theo yêu cầu đề bài.",
      "4. Đọc soát & Chỉnh sửa: đọc lại đoạn văn, tự soát lỗi chính tả/dùng từ, đổi vở góp ý cho bạn, GV nhận xét tuyên dương.",
    ],
    pedagogicalFocus: [
      "Tổ chức cho HS nói và chia sẻ ý tưởng trước khi bắt tay vào viết",
      "Đoạn văn ngắn 5-7 câu, chú ý mở đoạn, các câu phát triển ý và kết đoạn",
      "Rèn thói quen tự soát lỗi dấu câu và chữ hoa đầu câu",
    ],
  },

  // LỚP 4
  "grade4-reading-7steps": {
    id: "grade4-reading-7steps",
    grade: 4,
    label: "Lớp 4: Quy trình 7 bước dạy Bài Đọc",
    applicableTypes: ["reading"],
    stepsSummary: [
      "Bước 1: Khởi động, kết nối (tạo hứng thú bằng tranh/câu hỏi/trò chơi/video/chia sẻ trải nghiệm).",
      "Bước 2: Đọc mẫu và hướng dẫn giọng đọc (GV/HS đọc tốt đọc mẫu, hướng dẫn giọng, tốc độ, ngắt nghỉ, nhấn giọng).",
      "Bước 3: Luyện đọc đúng (đọc nối tiếp câu/đoạn/khổ, sửa phát âm, ngắt nghỉ câu dài, luyện cặp/nhóm).",
      "Bước 4: Giải nghĩa từ ngữ (ngữ cảnh, tranh ảnh, từ điển, đặt câu, tìm từ gần nghĩa/trái nghĩa).",
      "Bước 5: Tìm hiểu bài (trả lời câu hỏi đọc hiểu, tìm chi tiết, hiểu nội dung/nhân vật/ý nghĩa, GV chốt ý).",
      "Bước 6: Luyện đọc lại, đọc diễn cảm (chọn đoạn tiêu biểu, đọc cá nhân/cặp/nhóm, chú ý cảm xúc/nhịp thơ/mạch lạc).",
      "Bước 7: Vận dụng sau đọc (liên hệ cuộc sống, nói điều học được, viết cảm nghĩ, tìm hiểu thêm thông tin).",
    ],
    mandatoryStepsByPeriod: {
      1: [
        "Bước 1: Khởi động, kết nối tạo hứng thú vào bài học",
        "Bước 2: Đọc mẫu và định hướng giọng đọc (tốc độ, ngắt nghỉ, nhấn giọng)",
        "Bước 3: Luyện đọc đúng (nối tiếp câu/đoạn/khổ, sửa phát âm, ngắt nghỉ câu dài)",
        "Bước 4: Giải nghĩa từ ngữ (ngữ cảnh, từ điển, từ gần/trái nghĩa)",
      ],
      2: [
        "Bước 5: Tìm hiểu bài (trả lời hệ thống câu hỏi đọc hiểu, tìm chi tiết, nội dung chính)",
        "Bước 6: Luyện đọc lại, đọc diễn cảm (chọn đoạn tiêu biểu, thể hiện cảm xúc, phân vai)",
        "Bước 7: Vận dụng sau đọc (liên hệ cuộc sống, viết cảm nghĩ, hành động thực tế)",
      ],
    },
    pedagogicalFocus: [
      "Bắt buộc có Bước 6: Luyện đọc lại và đọc diễn cảm đoạn tiêu biểu",
      "Bước 4 giải nghĩa từ qua ngữ cảnh và từ điển/từ gần nghĩa",
      "Đọc hiểu bám bằng chứng chi tiết và rút ra ý nghĩa đoạn/bài",
    ],
  },
  "grade4-speaking-listening-7steps": {
    id: "grade4-speaking-listening-7steps",
    grade: 4,
    label: "Lớp 4: Quy trình 7 bước Nói và Nghe",
    applicableTypes: ["speaking-listening"],
    stepsSummary: [
      "1. Khởi động, giới thiệu chủ đề nói.",
      "2. Xác định yêu cầu nói và nghe (đọc SGK, xác định chủ đề, nói rõ ràng mạch lạc, nhìn người nghe, nhiệm vụ người nghe).",
      "3. Chuẩn bị ý nói (quan sát tranh, gợi ý, nhớ lại trải nghiệm, ghi chú ngắn).",
      "4. Thực hành nói (trình bày cá nhân, cặp đôi hoặc nhóm trước lớp; GV quan sát hỗ trợ).",
      "5. Nghe và phản hồi (lắng nghe tôn trọng, nhận xét, hỏi lại, bổ sung ý kiến lịch sự).",
      "6. Nhận xét, đánh giá (GV và HS đánh giá theo tiêu chí đã thống nhất).",
      "7. Vận dụng (áp dụng kĩ năng nói-nghe vào đời sống, giao tiếp ở nhà).",
    ],
    pedagogicalFocus: [
      "Quy định rõ tiêu chí cả cho NGƯỜI NÓI và NGƯỜI NGHE",
      "Người nghe có nhiệm vụ lắng nghe, hỏi lại, nhận xét lịch sự",
    ],
  },
  "grade4-language-knowledge": {
    id: "grade4-language-knowledge",
    grade: 4,
    label: "Lớp 4: Mạch Luyện từ và câu",
    applicableTypes: ["language-knowledge"],
    stepsSummary: [
      "1. Khởi động: trò chơi tạo tình huống ngôn ngữ.",
      "2. Hình thành kiến thức: phân tích ngữ liệu mẫu, rút ra ghi nhớ về từ loại (danh từ, động từ, tính từ) hoặc quy tắc dấu câu, biện pháp nhân hóa.",
      "3. Luyện tập: thực hành bài tập nhận diện, phân loại và đặt câu.",
      "4. Vận dụng: viết đoạn văn ngắn có sử dụng kiến thức từ/câu vừa học.",
    ],
    pedagogicalFocus: [
      "Quy nạp từ ngữ liệu thực tế trước khi rút ra ghi nhớ",
      "Nhận biết và vận dụng các biện pháp tu từ (nhân hóa) và từ loại trong ngữ cảnh",
    ],
  },
  "grade4-composition-process": {
    id: "grade4-composition-process",
    grade: 4,
    label: "Lớp 4: Mạch Viết đoạn văn, bài văn theo quy trình",
    applicableTypes: ["composition"],
    stepsSummary: [
      "1. Khởi động & Xác định yêu cầu đề bài: phân tích đề, xác định thể loại (kể chuyện, miêu tả con vật/cây cối, viết đoạn nêu ý kiến).",
      "2. Chuẩn bị & Tìm ý: quan sát đối tượng, ghi chép chi tiết, lập dàn ý 3 phần (Mở bài, Thân bài, Kết bài).",
      "3. Thực hành viết: viết đoạn văn/bài văn hoàn chỉnh, chú ý liên kết câu và từ ngữ gợi tả/gợi cảm.",
      "4. Đọc soát & Chỉnh sửa: đối chiếu tiêu chí đánh giá, soát lỗi chính tả/ngữ pháp/dùng từ, đổi bài góp ý.",
    ],
    pedagogicalFocus: [
      "Dạy viết theo quy trình: Chuẩn bị/Tìm ý → Lập dàn ý → Viết bài → Chỉnh sửa",
      "Rèn luyện kĩ năng liên kết câu và sử dụng hình ảnh so sánh, nhân hóa",
    ],
  },
  "grade4-reading-extension": {
    id: "grade4-reading-extension",
    grade: 4,
    label: "Lớp 4: Mạch Đọc mở rộng",
    applicableTypes: ["reading", "speaking-listening"],
    stepsSummary: [
      "1. Khởi động: giới thiệu chủ điểm đọc mở rộng.",
      "2. Chia sẻ & Giới thiệu bài đọc: HS chia sẻ tên bài thơ/câu chuyện/bài văn đã đọc theo chủ điểm.",
      "3. Ghi chép & Đọc hiểu: hoàn thành Phiếu đọc sách (tên bài, tác giả, chi tiết yêu thích, cảm nhận).",
      "4. Trao đổi & Thảo luận: thi đọc đoạn hay, trao đổi về thông điệp và ý nghĩa bài đọc.",
    ],
    pedagogicalFocus: [
      "Phát triển thói quen đọc sách độc lập và ghi chép nhật ký/phiếu đọc sách",
      "Khuyến khích chia sẻ cảm xúc và bình luận về nhân vật/chi tiết",
    ],
  },

  // LỚP 5
  "grade5-reading-8steps": {
    id: "grade5-reading-8steps",
    grade: 5,
    label: "Lớp 5: Quy trình 8 bước dạy Bài Đọc",
    applicableTypes: ["reading"],
    stepsSummary: [
      "Bước 1: Khởi động, kết nối vào bài (tranh ảnh, câu hỏi, trò chơi, tình huống kết nối chủ điểm).",
      "Bước 2: Đọc mẫu, định hướng giọng đọc (xác định cảm xúc: vui tươi/xúc động/trang trọng; tốc độ, nhấn giọng).",
      "Bước 3: Đọc nối tiếp đoạn/khổ (luyện từ khó, câu dài, hướng dẫn ngắt nghỉ, nhấn giọng).",
      "Bước 4: Giải nghĩa từ ngữ, hình ảnh (dựa chú thích/ngữ cảnh, tìm từ đồng nghĩa/trái nghĩa, đặt câu, hình ảnh trực quan).",
      "Bước 5: Tìm hiểu nội dung bài đọc (trả lời câu hỏi đọc hiểu, tìm thông tin, giải thích chi tiết, nhận xét suy luận).",
      "Bước 6: Nêu nội dung, ý nghĩa của văn bản (xác định nội dung chính, thông điệp tác giả muốn gửi gắm, GV chốt ngắn gọn).",
      "Bước 7: Luyện đọc lại, đọc diễn cảm (chọn đoạn tiêu biểu, đọc phân vai/cá nhân, giọng đọc phù hợp, thể hiện cảm xúc).",
      "Bước 8: Vận dụng sau đọc (nói điều học được, liên hệ bản thân, viết cảm nghĩ, hành động việc làm phù hợp).",
    ],
    mandatoryStepsByPeriod: {
      1: [
        "Bước 1: Khởi động, kết nối vào bài tạo hứng thú và định hướng chủ điểm",
        "Bước 2: Đọc mẫu, định hướng giọng đọc (xác định cảm xúc: vui tươi/xúc động/trang trọng, tốc độ, nhấn giọng)",
        "Bước 3: Đọc nối tiếp đoạn/khổ (luyện từ khó, câu dài, hướng dẫn ngắt nghỉ, nhấn giọng)",
        "Bước 4: Giải nghĩa từ ngữ, hình ảnh (dựa chú thích/ngữ cảnh, tìm từ đồng nghĩa/trái nghĩa, tranh ảnh minh họa)",
      ],
      2: [
        "Bước 5: Tìm hiểu nội dung bài đọc (trả lời câu hỏi đọc hiểu, tìm thông tin, giải thích chi tiết, nhận xét suy luận)",
        "Bước 6: Nêu nội dung, ý nghĩa của văn bản (xác định nội dung chính, thông điệp tác giả gửi gắm, GV chốt ngắn gọn)",
        "Bước 7: Luyện đọc lại, đọc diễn cảm (chọn đoạn tiêu biểu, đọc phân vai/cá nhân, giọng đọc phù hợp, thể hiện cảm xúc)",
        "Bước 8: Vận dụng sau đọc (nói điều học được, liên hệ bản thân, viết cảm nghĩ, hành động việc làm phù hợp)",
      ],
    },
    pedagogicalFocus: [
      "Bước 6 tách riêng: Nêu nội dung, ý nghĩa và thông điệp của văn bản",
      "Bước 7 đọc diễn cảm nâng cao (thể hiện sắc thái cảm xúc, nhịp điệu, phân vai)",
      "Bước 5 đòi hỏi suy luận, nhận xét, liên hệ thực tế nhiều hơn các lớp dưới",
    ],
  },
  "grade5-speaking-listening-7steps": {
    id: "grade5-speaking-listening-7steps",
    grade: 5,
    label: "Lớp 5: Quy trình 7 bước Nói và Nghe",
    applicableTypes: ["speaking-listening"],
    stepsSummary: [
      "1. Giới thiệu chủ đề nói và nghe (tình huống, mục đích giao tiếp).",
      "2. Xác định yêu cầu và tiêu chí (nói đúng chủ đề, mạch lạc, tự tin; người nghe chăm chú, ghi chép).",
      "3. Chuẩn bị ý nói (quan sát tranh, trải nghiệm, tìm thông tin, lập dàn ý ngắn).",
      "4. Thực hành nói (nói theo cặp/nhóm/trước lớp; trình bày ý kiến, tranh luận/thuyết trình đơn giản).",
      "5. Nghe và phản hồi (lắng nghe, đặt câu hỏi phản biện, bổ sung ý kiến lịch sự).",
      "6. Nhận xét, đánh giá (tuyên dương, góp ý theo tiêu chí rõ ràng).",
      "7. Vận dụng (thực hành giao tiếp trong học tập và đời sống).",
    ],
    pedagogicalFocus: [
      "Mức độ nói và nghe cao hơn: trình bày quan điểm, giải thích lí lẽ, phản hồi văn minh",
    ],
  },
  "grade5-language-knowledge": {
    id: "grade5-language-knowledge",
    grade: 5,
    label: "Lớp 5: Mạch Luyện từ và câu",
    applicableTypes: ["language-knowledge"],
    stepsSummary: [
      "1. Khởi động: trò chơi ngôn ngữ kết nối kiến thức.",
      "2. Khám phá kiến thức mới: phân tích ví dụ ngữ liệu, rút ra bản chất (từ đồng nghĩa/trái nghĩa/đồng âm/nhiều nghĩa, đại từ, quan hệ từ, câu ghép).",
      "3. Luyện tập thực hành: nhận diện, giải nghĩa, phân biệt và đặt câu trong văn cảnh.",
      "4. Vận dụng: viết đoạn văn ngắn vận dụng kiến thức từ/câu đã học.",
    ],
    pedagogicalFocus: [
      "Mức độ phân tích ngữ nghĩa sâu hơn (phân biệt nghĩa gốc/nghĩa chuyển, sắc thái biểu cảm)",
      "Vận dụng câu ghép và quan hệ từ để liên kết câu mạch lạc",
    ],
  },
  "grade5-composition-process": {
    id: "grade5-composition-process",
    grade: 5,
    label: "Lớp 5: Mạch Viết bài văn hoàn chỉnh theo quy trình",
    applicableTypes: ["composition"],
    stepsSummary: [
      "1. Khởi động & Tìm hiểu đề: xác định yêu cầu trọng tâm, thể loại (tả cảnh, tả người, viết đoạn văn thể hiện tình cảm/cảm xúc, viết bài văn giải thích/thuyết phục).",
      "2. Tìm ý & Lập dàn ý: lựa chọn chi tiết tiêu biểu, lập dàn ý 3 phần chi tiết có phân nhánh.",
      "3. Thực hành viết bài: viết bài văn hoàn chỉnh, sử dụng từ ngữ gợi cảm, hình ảnh so sánh, nhân hóa, bày tỏ quan điểm.",
      "4. Đọc soát, hoàn thiện & Đánh giá: tự soát lỗi, chỉnh sửa diễn đạt, đổi bài nhận xét theo bảng tiêu chí rõ ràng.",
    ],
    pedagogicalFocus: [
      "Yêu cầu bài văn có cảm xúc chân thật, quan điểm rõ ràng và dẫn chứng thuyết phục",
      "Bố cục chặt chẽ: mở bài gián tiếp, thân bài phát triển nhiều đoạn, kết bài mở rộng",
    ],
  },
  "grade5-reading-extension": {
    id: "grade5-reading-extension",
    grade: 5,
    label: "Lớp 5: Mạch Đọc mở rộng",
    applicableTypes: ["reading", "speaking-listening"],
    stepsSummary: [
      "1. Khởi động: giới thiệu đề tài đọc mở rộng.",
      "2. Báo cáo & Chia sẻ kết quả đọc: giới thiệu tác phẩm, tác giả, thể loại và thông điệp cốt lõi.",
      "3. Đọc trích đoạn & Thảo luận: đọc diễn cảm đoạn văn/thơ tâm đắc, chia sẻ bài học rút ra.",
      "4. Hoàn thiện Phiếu đọc sách & Vận dụng: ghi chép suy ngẫm, lan tỏa thói quen đọc sách.",
    ],
    pedagogicalFocus: [
      "Nâng cao năng lực tự học và tự đọc tài liệu đa dạng",
      "Khả năng tóm tắt, khái quát ý nghĩa và đánh giá thông điệp tác phẩm",
    ],
  },
};

/**
 * Trả về quy trình chuẩn phù hợp nhất với lớp và kiểu bài Tiếng Việt đã phân loại.
 */
export function getVietnameseGradeWorkflow(
  input: LessonInput,
  classification: VietnameseLessonClassification,
): VietnameseGradeWorkflow | null {
  const gradeNum = parseInt(String(input.grade || "").replace(/\D/g, ""), 10);
  const type = classification.primaryType;
  const periods = Math.max(1, Number(input.periods || 1));
  const title = (input.lessonTitle || "").toLowerCase();

  if (gradeNum === 1) {
    if (type === "phonics" || /âm|vần|chữ/i.test(title)) {
      return vietnameseGradeWorkflows["grade1-phonics-2p"];
    }
    if (periods >= 3 || /tập\s*2|đọc hiểu|bài đọc/i.test(title)) {
      return vietnameseGradeWorkflows["grade1-reading-4p"];
    }
    if (/ôn tập|kể chuyện/i.test(title)) {
      return vietnameseGradeWorkflows["grade1-review-2p"];
    }
    return vietnameseGradeWorkflows["grade1-phonics-2p"];
  }

  if (gradeNum === 2) {
    if (type === "handwriting" || /tập viết|chữ hoa/i.test(title)) {
      return vietnameseGradeWorkflows["grade2-handwriting"];
    }
    if (type === "spelling" || /chính tả|nghe[- ]viết/i.test(title)) {
      return vietnameseGradeWorkflows["grade2-spelling"];
    }
    if (type === "composition" || /viết đoạn/i.test(title)) {
      return vietnameseGradeWorkflows["grade2-composition"];
    }
    if (/đọc mở rộng/i.test(title)) {
      return vietnameseGradeWorkflows["grade2-reading-extension"];
    }
    return vietnameseGradeWorkflows["grade2-reading"];
  }

  if (gradeNum === 3) {
    if (type === "spelling" || /chính tả|nghe[- ]viết/i.test(title)) {
      return vietnameseGradeWorkflows["grade3-spelling"];
    }
    if (type === "language-knowledge" || /từ và câu|mở rộng vốn từ/i.test(title)) {
      return vietnameseGradeWorkflows["grade3-language-knowledge"];
    }
    if (type === "composition" || /viết đoạn|tập làm văn/i.test(title)) {
      return vietnameseGradeWorkflows["grade3-composition"];
    }
    return vietnameseGradeWorkflows["grade3-reading"];
  }

  if (gradeNum === 4) {
    if (type === "speaking-listening" || /nói và nghe|kể chuyện/i.test(title)) {
      return vietnameseGradeWorkflows["grade4-speaking-listening-7steps"];
    }
    if (type === "composition" || /viết đoạn|bài văn/i.test(title)) {
      return vietnameseGradeWorkflows["grade4-composition-process"];
    }
    if (type === "language-knowledge" || /từ và câu/i.test(title)) {
      return vietnameseGradeWorkflows["grade4-language-knowledge"];
    }
    if (/đọc mở rộng/i.test(title)) {
      return vietnameseGradeWorkflows["grade4-reading-extension"];
    }
    return vietnameseGradeWorkflows["grade4-reading-7steps"];
  }

  if (gradeNum === 5) {
    if (type === "speaking-listening" || /nói và nghe|kể chuyện/i.test(title)) {
      return vietnameseGradeWorkflows["grade5-speaking-listening-7steps"];
    }
    if (type === "composition" || /viết bài văn|tả cảnh|tả người/i.test(title)) {
      return vietnameseGradeWorkflows["grade5-composition-process"];
    }
    if (type === "language-knowledge" || /từ và câu|từ đồng nghĩa|câu ghép/i.test(title)) {
      return vietnameseGradeWorkflows["grade5-language-knowledge"];
    }
    if (/đọc mở rộng/i.test(title)) {
      return vietnameseGradeWorkflows["grade5-reading-extension"];
    }
    return vietnameseGradeWorkflows["grade5-reading-8steps"];
  }

  return null;
}

// ─── TEACHING SCRIPT TEMPLATES ───

import teachingScriptsData from "@/data/vietnamese-teaching-scripts.json";

export type TeachingScriptTemplate = {
  label: string;
  description: string;
  activityStructure: unknown[];
};

/**
 * Phân loại phần bài (sub-type) cho bài Lớp 1 có nhiều phần.
 * Ví dụ bài "an ăn ân" có phần ĐỌC (tiết 1), phần VIẾT, phần NÓI.
 */
export type LessonSubType =
  | "grade1_phonics_read"    // Phần ĐỌC: nhận biết, phân tích, đánh vần, đọc tiếng/từ (tiết 1)
  | "grade1_phonics_write"   // Phần VIẾT: HD viết vần + từ ứng dụng (tiết viết riêng hoặc phần viết)
  | "grade1_phonics_read_p2" // Phần ĐỌC câu/đoạn + NÓI NGHE (tiết 2)
  | "grade1_reading"         // Đọc hiểu văn bản Tập 2
  | "default";               // Không có template riêng

/**
 * Nhận diện sub-type từ focus/lessonType của period.
 */
export function classifyLessonSubType(
  grade: number,
  lessonType: string,
  periodFocus: string,
  periodNumber: number,
): LessonSubType {
  if (grade !== 1) return "default";

  const focus = (periodFocus || "").toLowerCase();
  const type = (lessonType || "").toLowerCase();

  // Bài phonics hoặc handwriting lớp 1
  if (type === "phonics" || type === "handwriting" || /âm|vần|chữ/.test(focus)) {
    // Phần VIẾT rõ ràng
    if (/viết|tập viết|viết vần|viết từ|hướng dẫn viết|luyện viết/.test(focus)) {
      return "grade1_phonics_write";
    }
    // Tiết 2 thường là: viết vở + đọc câu/đoạn + nói
    if (periodNumber === 2) {
      // Nếu focus nói rõ viết vở
      if (/viết vở|vở tập viết/.test(focus)) return "grade1_phonics_read_p2";
      // Default tiết 2 = đọc câu/đoạn + nói
      return "grade1_phonics_read_p2";
    }
    // Tiết 1 = nhận biết, phân tích, đánh vần, đọc tiếng
    return "grade1_phonics_read";
  }

  // Bài đọc hiểu lớp 1
  if (type === "reading" || /đọc hiểu|tập 2|bài đọc/.test(focus)) {
    return "grade1_reading";
  }

  return "default";
}

/**
 * Lấy teaching script template cho sub-type.
 */
export function getTeachingScriptTemplate(subType: LessonSubType): TeachingScriptTemplate | null {
  const templates = (teachingScriptsData as { templates: Record<string, TeachingScriptTemplate> }).templates;
  return templates[subType] || null;
}

/**
 * Lấy few-shot examples cho sub-type.
 */
export function getFewShotExamples(subType: LessonSubType): { teacherAction: string; studentAction: string }[] {
  const data = teachingScriptsData as {
    fewShotExamples: Record<string, { pairs: { teacherAction: string; studentAction: string }[] }>;
  };
  if (subType === "grade1_phonics_write") {
    // Gộp cả 2 bộ mẫu viết vần + viết từ
    const vanPairs = data.fewShotExamples["grade1_write_van"]?.pairs || [];
    const tuPairs = data.fewShotExamples["grade1_write_tu"]?.pairs || [];
    return [...vanPairs.slice(0, 3), ...tuPairs.slice(0, 2)];
  }
  return [];
}

/**
 * Lấy quality rules bắt buộc cho deep script.
 */
export function getDeepScriptRules(): string[] {
  const data = teachingScriptsData as { qualityRules: { deepScriptMandatory: string[]; writingSpecific: string[] } };
  return data.qualityRules.deepScriptMandatory;
}

/**
 * Lấy writing-specific rules.
 */
export function getWritingSpecificRules(): string[] {
  const data = teachingScriptsData as { qualityRules: { writingSpecific: string[] } };
  return data.qualityRules.writingSpecific;
}
