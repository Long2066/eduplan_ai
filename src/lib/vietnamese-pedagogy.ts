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
      "Nghe/nhận diện âm, vần hoặc chữ mục tiêu",
      "Phân tích cấu tạo tiếng (âm đầu, vần, thanh)",
      "Ghép tiếng/đọc tiếng, từ chứa âm-vần mới",
      "Viết chữ/tiếng/từ có âm-vần mới",
      "Dùng tiếng/từ mới trong câu hoặc ngữ cảnh đơn giản",
    ],
    conditionalActivities: [
      "Đọc đoạn ứng dụng có âm-vần vừa học",
      "Trò chơi phân biệt âm-vần dễ nhầm",
    ],
    learningProducts: [
      "Tiếng/từ đọc đúng (kiểm tra cá nhân)",
      "Chữ/tiếng viết đúng mẫu trên bảng con/vở",
      "Câu nói có tiếng mới",
    ],
    commonErrors: [
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
