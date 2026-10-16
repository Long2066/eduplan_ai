import handwritingCatalog from "@/data/vietnamese-handwriting-catalog.json";

export interface StrokeDetail {
  order: number;
  name: string;
  start: string;
  direction: string;
  end: string;
}

export interface LetterMetrics {
  char: string;
  heightCells: number;
  widthCells: number;
  heightGroup: "5_cells" | "4_cells" | "3_cells" | "2.5_cells" | "2_cells";
  gridLines: number;
  strokesCount: number;
  strokes: StrokeDetail[];
  note: string;
  descriptionScript: string;
}

export interface HeightClassification {
  fiveCells: string[];
  fourCells: string[];
  threeCells: string[];
  twoAndHalfCells: string[];
  twoCells: string[];
  teacherQuestion: string;
  studentAnswer: string;
  teacherConclusion: string;
}

// Letter width reference table (cells / ô li)
const LETTER_WIDTH_MAP: Record<string, number> = {
  a: 2.5,
  ă: 2.5,
  â: 2.5,
  b: 2.0,
  c: 2.0,
  d: 2.5,
  đ: 2.5,
  e: 2.0,
  ê: 2.0,
  g: 2.5,
  h: 3.0,
  i: 1.5,
  k: 3.0,
  l: 2.5,
  m: 5.0,
  n: 3.5,
  o: 2.0,
  ô: 2.0,
  ơ: 2.0,
  p: 2.5,
  q: 2.5,
  r: 2.25,
  s: 2.25,
  t: 1.5,
  u: 3.0,
  ư: 3.0,
  v: 2.0,
  x: 3.5,
  y: 2.5,
};

const catalog = handwritingCatalog as Record<
  string,
  {
    letter: string;
    type: string;
    title: string;
    height_cells: number;
    grid_lines: number;
    strokes: StrokeDetail[];
    note: string;
  }
>;

export function normalizeVietnameseLetter(char: string): string {
  const c = char.toLowerCase().trim();
  if (/[aáàảãạ]/.test(c)) return "a";
  if (/[ăắằẳẵặ]/.test(c)) return "ă";
  if (/[âấầẩẫậ]/.test(c)) return "â";
  if (/[eéèẻẽẹ]/.test(c)) return "e";
  if (/[êếềểễệ]/.test(c)) return "ê";
  if (/[iíìỉĩị]/.test(c)) return "i";
  if (/[oóòỏõọ]/.test(c)) return "o";
  if (/[ôốồổỗộ]/.test(c)) return "ô";
  if (/[ơớờởỡợ]/.test(c)) return "ơ";
  if (/[uúùủũụ]/.test(c)) return "u";
  if (/[ưứừửữự]/.test(c)) return "ư";
  if (/[yýỳỷỹỵ]/.test(c)) return "y";
  if (c === "đ") return "đ";
  return c;
}

/**
 * Phân tích thông số kích thước & nét của một con chữ thường.
 */
export function analyzeLetterMetrics(char: string): LetterMetrics | null {
  const normalized = normalizeVietnameseLetter(char);
  const key = `${normalized}_lowercase`;
  const raw = catalog[key];
  if (!raw) return null;

  const height = raw.height_cells;
  let heightGroup: LetterMetrics["heightGroup"] = "2_cells";
  if (["b", "h", "k", "l", "g", "y"].includes(normalized)) {
    heightGroup = "5_cells";
  } else if (["d", "đ", "p", "q"].includes(normalized)) {
    heightGroup = "4_cells";
  } else if (normalized === "t") {
    heightGroup = "3_cells";
  } else if (["r", "s"].includes(normalized)) {
    heightGroup = "2.5_cells";
  } else {
    // a, ă, â, e, ê, i, m, n, o, ô, ơ, u, ư, c, v, x
    heightGroup = "2_cells";
  }

  const widthCells = LETTER_WIDTH_MAP[normalized] ?? 2.0;

  const strokeDesc = raw.strokes
    .map((s) => `nét ${s.order} là ${s.name.toLowerCase()}`)
    .join(", ");

  const descriptionScript = `Chữ ${normalized} cao ${heightGroup === "2_cells" ? "2" : height} ô li, rộng ${widthCells} ô li. Chữ ${normalized} gồm ${raw.strokes.length} nét: ${strokeDesc}.`;

  return {
    char: normalized,
    heightCells: heightGroup === "2_cells" ? 2 : height,
    widthCells,
    heightGroup,
    gridLines: raw.grid_lines,
    strokesCount: raw.strokes.length,
    strokes: raw.strokes,
    note: raw.note,
    descriptionScript,
  };
}

/**
 * Phân loại độ cao các con chữ trong một từ hoặc cụm từ (Hàng 5).
 */
export function analyzeWordLetterHeights(wordOrPhrase: string): HeightClassification {
  const letters = Array.from(
    new Set(
      wordOrPhrase
        .toLowerCase()
        .replace(/[^a-zà-ỹăâđêôơư]/gi, "")
        .split("")
        .map((c) => normalizeVietnameseLetter(c))
    )
  );

  const fiveCells: string[] = [];
  const fourCells: string[] = [];
  const threeCells: string[] = [];
  const twoAndHalfCells: string[] = [];
  const twoCells: string[] = [];

  for (const letter of letters) {
    const metrics = analyzeLetterMetrics(letter);
    if (!metrics) continue;
    switch (metrics.heightGroup) {
      case "5_cells":
        if (!fiveCells.includes(letter)) fiveCells.push(letter);
        break;
      case "4_cells":
        if (!fourCells.includes(letter)) fourCells.push(letter);
        break;
      case "3_cells":
        if (!threeCells.includes(letter)) threeCells.push(letter);
        break;
      case "2.5_cells":
        if (!twoAndHalfCells.includes(letter)) twoAndHalfCells.push(letter);
        break;
      case "2_cells":
        if (!twoCells.includes(letter)) twoCells.push(letter);
        break;
    }
  }

  const questions: string[] = [];
  const answers: string[] = [];
  const conclusionParts: string[] = [];

  if (fiveCells.length > 0) {
    questions.push(`+ Những chữ nào có độ cao 5 ô li?`);
    answers.push(`+ Chữ ${fiveCells.join(", ")} cao 5 ô li.`);
    conclusionParts.push(`chữ ${fiveCells.join(", ")} cao 5 ô li`);
  }
  if (fourCells.length > 0) {
    questions.push(`+ Những chữ nào có độ cao 4 ô li?`);
    answers.push(`+ Chữ ${fourCells.join(", ")} cao 4 ô li.`);
    conclusionParts.push(`chữ ${fourCells.join(", ")} cao 4 ô li`);
  }
  if (threeCells.length > 0) {
    questions.push(`+ Chữ nào có độ cao 3 ô li?`);
    answers.push(`+ Chữ ${threeCells.join(", ")} cao 3 ô li.`);
    conclusionParts.push(`chữ ${threeCells.join(", ")} cao 3 ô li`);
  }
  if (twoAndHalfCells.length > 0) {
    questions.push(`+ Chữ nào có độ cao hơn 2 ô li (2,25 - 2,5 ô li)?`);
    answers.push(`+ Chữ ${twoAndHalfCells.join(", ")} cao ${twoAndHalfCells.some(c => c === "r" || c === "s") ? "2,25" : "2,5"} ô li.`);
    conclusionParts.push(`chữ ${twoAndHalfCells.join(", ")} cao ${twoAndHalfCells.some(c => c === "r" || c === "s") ? "hơn 2 ô li một chút" : "2,5 ô li"}`);
  }
  if (twoCells.length > 0) {
    questions.push(`+ Những chữ nào có độ cao 2 ô li?`);
    answers.push(`+ Các chữ ${twoCells.join(", ")} cao 2 ô li.`);
    conclusionParts.push(`các chữ ${twoCells.join(", ")} cao 2 ô li`);
  }

  const teacherQuestion = questions.join("\n");
  const studentAnswer = answers.join("\n");
  const teacherConclusion = `- GV nhận xét, chốt chuẩn độ cao: “Trong từ “${wordOrPhrase}”, ${conclusionParts.join("; ")}.”`;

  return {
    fiveCells,
    fourCells,
    threeCells,
    twoAndHalfCells,
    twoCells,
    teacherQuestion,
    studentAnswer,
    teacherConclusion,
  };
}

/**
 * Sinh kịch bản hướng dẫn viết vần (vần gốc và các vần biến đổi) cực kỳ chi tiết.
 */
export function generateVowelWritingScript(vowel: string): string {
  const v = vowel.toLowerCase().trim();

  // Canonical Vần Bài 32 an ăn ân
  if (v === "an") {
    return `- GV hướng dẫn cách viết vần an:
+ Đặt bút dưới đường kẻ 3 một chút, viết nét cong kín từ phải sang trái.
+ Từ điểm dừng bút của nét 1, lia bút lên đường kẻ 3, viết nét móc ngược phải sát nét cong kín, đến đường kẻ 2 thì dừng lại.
+ Tại điểm dừng chữ a, ta nối tiếp với nét móc xuôi trái của chữ n và dừng bút tại đường kẻ 1. Sau đó lia bút lên đường kẻ 2 viết tiếp nét móc 2 đầu của chữ n dừng bút tại đường kẻ 2.
-> Ta được vần an.`;
  }
  if (v === "ăn") {
    return `- GV hướng dẫn cách viết vần ăn:
+ Để viết vần ăn, ta đã có vần an. Chỉ cần lia bút lên đầu chữ a của vần an và viết thêm nét cong dưới nhỏ nằm giữa đường kẻ 3 và 4.
-> Ta được vần ăn.`;
  }
  if (v === "ân") {
    return `- GV hướng dẫn cách viết vần ân:
+ Để viết vần ân, ta cũng có sẵn vần an vừa viết. Chỉ cần lia bút lên đầu chữ a viết 1 nét thẳng xiên ngắn trái rồi viết tiếp 1 nét thẳng xiên ngắn phải nối xuống tạo dấu mũ “^” nằm giữa đường kẻ 3 và 4.
-> Ta được vần ân.`;
  }

  // Canonical Vần on ôn ơn
  if (v === "on") {
    return `- GV hướng dẫn cách viết vần on:
+ Đặt bút dưới đường kẻ 3 một chút, viết nét cong kín từ phải sang trái tạo chữ o dừng tại điểm xuất phát.
+ Từ điểm dừng chữ o, lia bút hoặc đưa nét nối sang nét móc xuôi trái của chữ n dừng ở đường kẻ 1, sau đó lia lên đường kẻ 2 viết tiếp nét móc 2 đầu dừng bút tại đường kẻ 2.
-> Ta được vần on.`;
  }
  if (v === "ôn") {
    return `- GV hướng dẫn cách viết vần ôn:
+ Từ vần on đã viết, lia bút lên đầu chữ o viết dấu mũ “^” (gồm 2 nét xiên ngắn) nằm giữa đường kẻ 3 và 4.
-> Ta được vần ôn.`;
  }
  if (v === "ơn") {
    return `- GV hướng dẫn cách viết vần ơn:
+ Từ vần on đã viết, lia bút lên góc trên bên phải chữ o viết nét râu nhỏ chạm đường kẻ 3.
-> Ta được vần ơn.`;
  }

  // Canonical Vần ao eo
  if (v === "ao") {
    return `- GV hướng dẫn cách viết vần ao:
+ Đặt bút dưới đường kẻ 3 một chút, viết nét cong kín và nét móc ngược phải tạo chữ a dừng tại đường kẻ 2.
+ Từ điểm dừng chữ a, lia bút sang dưới đường kẻ 3 một chút viết nét cong kín của chữ o. Chú ý điểm tiếp xúc giữa nét móc chữ a và nét cong chữ o cách nhau vừa phải.
-> Ta được vần ao.`;
  }
  if (v === "eo") {
    return `- GV hướng dẫn cách viết vần eo:
+ Đặt bút trên đường kẻ 1 một chút, đưa nét lượn xiên lên đường kẻ 3 uốn vòng sang trái tạo nét cong chữ e, kéo xuống dừng bút ở đường kẻ 2.
+ Từ điểm dừng chữ e, lia bút sang dưới đường kẻ 3 một chút viết nét cong kín chữ o.
-> Ta được vần eo.`;
  }

  // Tổng quát cho các vần khác: phân tách từng chữ cái
  const chars = v.split("");
  const lines: string[] = [`- GV hướng dẫn cách viết vần ${v}:`];

  for (let i = 0; i < chars.length; i++) {
    const char = chars[i];
    const metric = analyzeLetterMetrics(char);
    if (!metric) continue;

    if (i === 0) {
      const stroke1 = metric.strokes[0];
      const stroke2 = metric.strokes[1];
      lines.push(`+ Đặt bút ${stroke1.start}, viết nét ${stroke1.name.toLowerCase()} ${stroke1.direction}.`);
      if (stroke2) {
        lines.push(`+ Lia bút lên ${stroke2.start}, viết nét ${stroke2.name.toLowerCase()} dừng bút tại ${stroke2.end}.`);
      }
    } else {
      const prevChar = chars[i - 1];
      lines.push(`+ Nối nét từ chữ ${prevChar} sang chữ ${char}: Lia bút đến ${metric.strokes[0].start}, viết nét ${metric.strokes[0].name.toLowerCase()} của chữ ${char}, dừng bút tại ${metric.strokes[metric.strokes.length - 1].end}.`);
    }
  }

  lines.push(`-> Ta được vần ${v}.`);
  return lines.join("\n");
}

/**
 * Nhận diện thanh điệu và vị trí dấu thanh trong tiếng.
 */
interface SyllableToneInfo {
  cleanSyllable: string;
  vowelBase: string;
  tone: "sắc" | "huyền" | "hỏi" | "ngã" | "nặng" | "ngang";
  tonePositionDescription: string;
}

export function detectTone(syllable: string): SyllableToneInfo {
  const s = syllable.toLowerCase();

  let tone: SyllableToneInfo["tone"] = "ngang";
  let cleanSyllable = s;
  let vowelBase = "a";

  if (/[áắấéếíóốớúứý]/.test(s)) {
    tone = "sắc";
  } else if (/[àằầèềìòồờùừỳ]/.test(s)) {
    tone = "huyền";
  } else if (/[ảẳẩẻểỉỏổởủửỷ]/.test(s)) {
    tone = "hỏi";
  } else if (/[ãẵẫẽễĩõỗỡũữỹ]/.test(s)) {
    tone = "ngã";
  } else if (/[ạặậẹệịọộợụựỵ]/.test(s)) {
    tone = "nặng";
  }

  // Tìm nguyên âm mang dấu
  const toneMap: Record<string, string> = {
    á: "a", à: "a", ả: "a", ã: "a", ạ: "a",
    ắ: "ă", ằ: "ă", ẳ: "ă", ẵ: "ă", ặ: "ă",
    ấ: "â", ầ: "â", ẩ: "â", ẫ: "â", ậ: "â",
    é: "e", è: "e", ẻ: "e", ẽ: "e", ẹ: "e",
    ế: "ê", ề: "ê", ể: "ê", ễ: "ê", ệ: "ê",
    í: "i", ì: "i", ỉ: "i", ĩ: "i", ị: "i",
    ó: "o", ò: "o", ỏ: "o", õ: "o", ọ: "o",
    ố: "ô", ồ: "ô", ổ: "ô", ỗ: "ô", ộ: "ô",
    ớ: "ơ", ờ: "ơ", ở: "ơ", ỡ: "ơ", ợ: "ơ",
    ú: "u", ù: "u", ủ: "u", ũ: "u", ụ: "u",
    ứ: "ư", ừ: "ư", ử: "ư", ữ: "ư", ự: "ư",
    ý: "y", ỳ: "y", ỷ: "y", ỹ: "y", ỵ: "y",
  };

  for (const [charWithTone, base] of Object.entries(toneMap)) {
    if (s.includes(charWithTone)) {
      vowelBase = base;
      cleanSyllable = s.replace(charWithTone, base);
      break;
    }
  }

  let tonePositionDescription = "";
  if (tone === "nặng") {
    tonePositionDescription = `Lia bút đặt dấu nặng dưới con chữ ${vowelBase} (dưới đường kẻ 1).`;
  } else if (tone !== "ngang") {
    tonePositionDescription = `Lia bút đặt dấu ${tone} trên đầu con chữ ${vowelBase} (nằm giữa đường kẻ 3 và đường kẻ 4).`;
  }

  return {
    cleanSyllable,
    vowelBase,
    tone,
    tonePositionDescription,
  };
}

/**
 * Sinh kịch bản hướng dẫn viết một tiếng cụ thể chi tiết từng nét.
 */
function generateSyllableWritingScript(syllable: string): string {
  const toneInfo = detectTone(syllable);
  const syl = syllable.toLowerCase();

  // Canonical Tiếng mẫu
  if (syl === "bạn") {
    return `+ Đầu tiên là tiếng “bạn”: Đặt bút giữa đường kẻ 2 ô li đầu tiên, viết nét khuyết trên (đỉnh nét chạm vào đường kẻ 6 ô li thứ hai) kéo thẳng xuống đường kẻ 1, sau đó nối liền với nét móc ngược và nét thắt nhỏ uốn lượn dừng bút gần đường kẻ 3 giữa ô li (chữ b cao 5 ô li).
+ Tại điểm dừng bút, lia bút sang dưới đường kẻ 3 một chút để viết nét cong kín của chữ a; lia bút lên đường kẻ 3 viết tiếp nét móc ngược phải dừng tại đường kẻ 2 (chữ a cao 2 ô li).
+ Tại điểm dừng bút nối liền với nét móc xuôi trái của chữ n dừng ở đường kẻ 1, sau đó lia bút lên đường kẻ 2 viết nét móc 2 đầu dừng bút tại đường kẻ 2 (chữ n cao 2 ô li).
+ Lia bút đặt thanh nặng dưới chữ a (dưới ĐK 1) -> Ta được tiếng “bạn”.`;
  }

  if (syl === "thân") {
    return `+ Viết tiếng “thân”: Đặt bút tại đường kẻ 2 viết nét hất đến đường kẻ 3 dừng lại, sau đó lia bút lên đường kẻ 4 viết nét móc ngược phải dừng ở đường kẻ 2 (chữ t cao 3 ô li).
+ Tại điểm dừng bút, tiếp tục nối nét khuyết trên của chữ h đỉnh chạm vào đường kẻ 6 rồi hạ thẳng xuống dừng ở đường kẻ 1, lia bút lên đường kẻ 2 viết tiếp nét móc 2 đầu dừng bút tại đường kẻ 2 (chữ h cao 5 ô li).
+ Tại điểm dừng bút, lia bút sang dưới đường kẻ 3 viết nét cong kín của chữ a, lia lên đường kẻ 3 viết nét móc ngược dừng ở đường kẻ 2; nối liền nét chữ n. Sau đó lia bút lên đầu chữ a viết dấu mũ “^” giữa đường kẻ 3 và 4 tạo thành chữ â.
-> Ta được tiếng “thân”.`;
  }

  if (syl === "khăn") {
    return `+ Viết tiếng “khăn”: Đặt bút tại đường kẻ 2 viết nét khuyết trên chữ k chạm đường kẻ 6 hạ xuống đường kẻ 1, lia bút lên đường kẻ 2 viết nét móc 2 đầu có thắt giữa dừng tại đường kẻ 2 (chữ k cao 5 ô li).
+ Nối tiếp nét khuyết trên của chữ h cao 5 ô li (đỉnh chạm ĐK 6, hạ ĐK 1, móc 2 đầu dừng ĐK 2).
+ Lia bút dưới ĐK 3 viết vần an (chữ a nối chữ n). Lia bút lên đầu chữ a viết nét cong dưới nhỏ giữa ĐK 3 và 4 tạo vần ăn.
-> Ta được tiếng “khăn”.`;
  }

  if (syl === "rằn") {
    return `+ Viết tiếng “rằn”: Đặt bút trên đường kẻ 1, viết nét xiên lên qua đường kẻ 3 một chút tạo vòng xoắn nhỏ đưa sang phải rồi kéo xuống đường kẻ 2 (chữ r cao 2,25 ô li).
+ Từ điểm dừng chữ r, lia bút dưới đường kẻ 3 viết chữ a và nối tiếp chữ n tạo vần an. Lia bút viết nét cong dưới nhỏ tạo chữ ă.
+ Lia bút đặt dấu huyền trên đầu chữ ă (giữa ĐK 3 và 4) -> Ta được tiếng “rằn”.`;
  }

  // Tổng quát cho các tiếng khác
  const chars = syl.split("");
  const lines: string[] = [`+ Viết tiếng “${syllable}”:`];
  lines.push(`- Đặt bút viết con chữ đầu tiên đúng điểm đặt bút và độ cao.`);
  if (toneInfo.tonePositionDescription) {
    lines.push(`- ${toneInfo.tonePositionDescription}`);
  }
  lines.push(`-> Ta được tiếng “${syllable}”.`);
  return lines.join("\n");
}

/**
 * Sinh kịch bản hướng dẫn viết từ ứng dụng cực kỳ chi tiết theo lời GV (Hàng 6).
 */
export function generateAppliedWordWritingScript(wordOrPhrase: string): string {
  const trimmed = wordOrPhrase.trim();
  const syllables = trimmed.split(/\s+/);

  const lines: string[] = [`- GV hướng dẫn quy trình viết từ “${trimmed}”:`];

  if (syllables.length === 1) {
    lines.push(generateSyllableWritingScript(syllables[0]));
  } else if (syllables.length >= 2) {
    // Tiếng thứ nhất
    lines.push(generateSyllableWritingScript(syllables[0]));
    // Quy định khoảng cách
    lines.push(
      `+ Quy định khoảng cách: “Các em viết tiếng thứ hai cách tiếng thứ nhất một khoảng bằng một thân con chữ o (khoảng 1,5 ô li).”`
    );
    // Tiếng thứ hai
    lines.push(generateSyllableWritingScript(syllables[1]));

    if (syllables.length > 2) {
      for (let i = 2; i < syllables.length; i++) {
        lines.push(
          `+ Khoảng cách tiếp theo bằng một thân con chữ o. ${generateSyllableWritingScript(syllables[i])}`
        );
      }
    }
  }

  // Lời dặn dò chốt quy chuẩn toàn từ
  const heightInfo = analyzeWordLetterHeights(trimmed);
  const parts: string[] = [];
  if (heightInfo.fiveCells.length > 0) parts.push(`chữ ${heightInfo.fiveCells.join(", ")} cao 5 ô li`);
  if (heightInfo.fourCells.length > 0) parts.push(`chữ ${heightInfo.fourCells.join(", ")} cao 4 ô li`);
  if (heightInfo.threeCells.length > 0) parts.push(`chữ ${heightInfo.threeCells.join(", ")} cao 3 ô li`);
  if (heightInfo.twoAndHalfCells.length > 0) parts.push(`chữ ${heightInfo.twoAndHalfCells.join(", ")} cao hơn 2 ô li`);
  if (heightInfo.twoCells.length > 0) parts.push(`các chữ ${heightInfo.twoCells.join(", ")} cao 2 ô li`);

  lines.push(
    `- GV dặn dò: “Như vậy chúng ta đã viết xong từ “${trimmed}”. Các em lưu ý viết chính xác về độ cao các con chữ (${parts.join("; ")}), độ rộng các nét và khoảng cách giữa hai tiếng bằng một thân con chữ o.”`
  );

  return lines.join("\n");
}

/**
 * Sinh trọn bộ 7 Đơn vị Tương tác Kết hợp (Hybrid Interaction Units) cho hoạt động tập viết Tiếng Việt Lớp 1.
 */
export function generateGrade1WritingInteractionUnits(
  targetVowels: string[],
  appliedWords: string[]
): {
  teacherActions: string[];
  studentActions: string[];
} {
  const teacherActions: string[] = [];
  const studentActions: string[] = [];

  const primaryVowel = targetVowels[0] || "an";
  const vowelLetters = primaryVowel.split("");
  const letter1 = vowelLetters[0] || "a";
  const letter2 = vowelLetters[1] || "n";
  const m1 = analyzeLetterMetrics(letter1);
  const m2 = analyzeLetterMetrics(letter2);

  // ─── HÀNG 1: Khám phá & Phân tích cấu tạo con chữ ───
  const q1 = [
    `- GV cho HS quan sát chữ ${letter1} và chữ ${letter2} trên bảng/màn hình:`,
    `+ Để viết vần ${primaryVowel}, chúng ta viết chữ nào trước, chữ nào sau?`,
    `+ Chữ ${letter1} cao mấy ô li? Rộng mấy ô li? Gồm những nét nào?`,
    `+ Chữ ${letter2} cao mấy ô li? Rộng mấy ô li? Gồm những nét nào?`,
  ].join("\n");

  const a1 = [
    `- HS quan sát chữ mẫu và trả lời:`,
    `+ Viết chữ ${letter1} trước, chữ ${letter2} sau.`,
    `+ Chữ ${letter1} cao ${m1?.heightCells || 2} ô li, rộng ${m1?.widthCells || 2.5} ô li; gồm ${m1?.strokesCount || 2} nét (${m1?.strokes.map(s => s.name).join(", ")}).`,
    `+ Chữ ${letter2} cao ${m2?.heightCells || 2} ô li, rộng ${m2?.widthCells || 3.5} ô li; gồm ${m2?.strokesCount || 2} nét (${m2?.strokes.map(s => s.name).join(", ")}).`,
  ].join("\n");

  teacherActions.push(q1);
  studentActions.push(a1);

  // ─── HÀNG 2: Nhận xét & Kết luận ───
  const c1 = `- GV nhận xét, chốt kiến thức: “Chữ ${letter1} cao ${m1?.heightCells || 2} ô li, rộng ${m1?.widthCells || 2.5} ô li, gồm ${m1?.strokesCount || 2} nét. Chữ ${letter2} cao ${m2?.heightCells || 2} ô li, rộng ${m2?.widthCells || 3.5} ô li. Khi viết vần ${primaryVowel}, ta nối nét từ điểm dừng chữ ${letter1} sang nét đầu chữ ${letter2}.”`;
  const s2 = `- HS lắng nghe, ghi nhớ quy chuẩn chữ mẫu.`;

  teacherActions.push(c1);
  studentActions.push(s2);

  // ─── HÀNG 3: Thị phạm quy trình viết vần mẫu ───
  const vowelScripts = targetVowels.map((v) => generateVowelWritingScript(v)).join("\n\n");
  teacherActions.push(vowelScripts);
  studentActions.push(
    `- HS chú ý quan sát GV viết mẫu trên bảng/TV, lắng nghe từng nét đặt bút và mô phỏng nét viết trên không.`
  );

  // ─── HÀNG 4: Luyện viết bảng con vần & Sửa lỗi ───
  teacherActions.push(
    `- GV yêu cầu HS viết vần ${targetVowels.join(", ")} vào bảng con.\n- GV đi từng bàn quan sát, uốn nắn tư thế cầm bút và sửa lỗi kỹ thuật nối nét cho HS.\n- GV chọn 2 bảng đẹp và 1 bảng cần sửa lỗi, nhận xét công khai trước lớp theo 4 tiêu chí: độ cao, độ rộng, nối nét, trình bày sạch.`
  );
  studentActions.push(
    `- HS thực hành viết từng vần vào bảng con theo hiệu lệnh.\n- Giơ bảng con cho GV nhận xét.\n- Lắng nghe góp ý, xóa bảng và sửa lại cho đúng quy chuẩn.`
  );

  // ─── HÀNG 5: Nhận biết từ ứng dụng & Bảng phân loại độ cao con chữ ───
  const primaryWord = appliedWords[0] || "bạn thân";
  const heightAnalysis = analyzeWordLetterHeights(primaryWord);

  const q5 = [
    `- GV chiếu tranh/vật thật giới thiệu từ ứng dụng “${primaryWord}”, cho HS đọc trơn từ 3 lần.`,
    `- GV hướng dẫn HS phân tích độ cao các con chữ trong từ “${primaryWord}”:`,
    heightAnalysis.teacherQuestion,
    heightAnalysis.teacherConclusion,
  ].join("\n");

  const a5 = [
    `- HS quan sát tranh, đọc đồng thanh từ “${primaryWord}”.`,
    `- HS quan sát các con chữ và trả lời:`,
    heightAnalysis.studentAnswer,
    `- HS ghi nhớ tương quan độ cao các con chữ trong từ.`,
  ].join("\n");

  teacherActions.push(q5);
  studentActions.push(a5);

  // ─── HÀNG 6: Hướng dẫn viết từ ứng dụng cực kỳ chi tiết ───
  const wordScripts = appliedWords
    .map((w) => generateAppliedWordWritingScript(w))
    .join("\n\n");
  teacherActions.push(wordScripts);
  studentActions.push(
    `- HS chăm chú quan sát GV viết mẫu từ ứng dụng trên bảng, lắng nghe kĩ điểm đặt bút, uốn lượn nét khuyết/thắt, khoảng cách 1 thân chữ o và luyện viết trên không.`
  );

  // ─── HÀNG 7: Thực hành viết bảng con từ ứng dụng & Viết vở ───
  teacherActions.push(
    `- GV cho HS luyện viết từ “${appliedWords.join(", ")}” vào bảng con -> nhận xét, chỉnh sửa.\n- GV hướng dẫn HS mở vở Tập viết: nhắc nhở tư thế ngồi viết thẳng lưng, khoảng cách từ mắt đến vở 25-30cm, cách cầm bút bằng 3 ngón.\n- Cho HS thực hành viết chữ cái, vần và từ ứng dụng vào vở.\n- GV quan sát, chấm chữa nhanh 5-7 bài, ghi nhận xét động viên.`
  );
  studentActions.push(
    `- HS luyện viết từ vào bảng con, giơ bảng theo hiệu lệnh.\n- Mở vở Tập viết, ngồi đúng tư thế, nắn nót viết từng dòng theo mẫu.\n- Đổi vở theo cặp bàn, nhận xét chéo cho bạn theo đúng 4 tiêu chí: 1. Đúng độ cao; 2. Đúng độ rộng; 3. Đúng khoảng cách và nối nét; 4. Vở sạch đẹp.`
  );

  return {
    teacherActions,
    studentActions,
  };
}

/**
 * Trích xuất các vần mục tiêu từ tiêu đề bài học hoặc ngữ cảnh.
 */
export function extractTargetVowels(text: string): string[] {
  const stopwords = new Set([
    "bài", "tiết", "tiếng", "việt", "lớp", "học", "vần", "tập", "viết", "đọc", "kế", "hoạch", "dạy"
  ]);
  const tokens = text
    .toLowerCase()
    .replace(/[0-9:;,.\-–—/()]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((t) => !stopwords.has(t));

  return tokens.length > 0 ? tokens : ["an", "ăn", "ân"];
}

/**
 * Trích xuất các từ ứng dụng từ dữ kiện nguồn hoặc tiêu đề bài học.
 */
export function extractAppliedWords(evidenceTexts: string[], fallbackTitle = ""): string[] {
  const words: string[] = [];
  const fullText = evidenceTexts.join(" ");

  // Match quoted words or 2-syllable phrases in evidence
  const quotedMatches = fullText.match(/[“"”]([a-zà-ỹăâđêôơư\s]{3,25})[“"”]/gi);
  if (quotedMatches) {
    for (const q of quotedMatches) {
      const clean = q.replace(/[“"”]/g, "").trim();
      if (clean.split(/\s+/).length >= 2 && !words.includes(clean)) {
        words.push(clean);
      }
    }
  }

  if (words.length >= 2) return words.slice(0, 2);

  // Fallback by lesson title or common pairs
  const title = fallbackTitle.toLowerCase();
  if (/an.*ăn.*ân/i.test(title)) return ["bạn thân", "khăn rằn"];
  if (/on.*ôn.*ơn/i.test(title)) return ["sơn ca", "con chồn"];
  if (/ao.*eo/i.test(title)) return ["ngôi sao", "cái kéo"];
  if (/am.*ăm.*âm/i.test(title)) return ["trái cam", "cá mập"];
  if (/au.*âu/i.test(title)) return ["cây cau", "chim sâu"];
  if (/ai.*ay/i.test(title)) return ["hoa mai", "máy bay"];

  return words.length > 0 ? words : ["bạn thân", "khăn rằn"];
}

