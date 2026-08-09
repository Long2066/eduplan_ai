import type { LessonActivity, LessonInput, LessonPlan, PedagogyAuditFinding } from "@/types/lesson";

const mechanicalTextPattern = /thực hiện được qua|sử dụng kiến thức,?\s*kĩ năng đặc thù|sử dụng kiến thức đặc thù|kiến thức đặc thù|nội dung học tập đặc thù|được hình thành qua|thông qua hoạt động|\.\s*:/i;
const unsafeUncertaintyPattern = /cần\s+(?:gv|giáo viên\s+)?xác minh|cần xác minh|ocr\s+chưa\s+rõ|kiểm tra lại\s+sgk|đối chiếu\s+(?:bằng|lại|theo)\s+sgk(?:\s+bản\s+in)?|chốt\s+theo\s+sgk|theo\s+sgk\s+bản\s+in/i;
const overAnalysisPattern = /giải thích tác dụng|phân tích tác dụng|hiệu quả của nhịp|phân tích sâu|phân tích nghệ thuật|biện pháp nghệ thuật|phép lặp/i;
const extensionTaskPattern = /hỏi người thân|về nhà|sưu tầm|phỏng vấn|ngoài sgk|nếu còn thời gian|khi còn thời gian/i;
const extensionLabelPattern = /hoạt động mở rộng|thực hiện khi còn thời gian/i;
const projectedOnlyDigitalPattern = /gv|giáo viên|trình chiếu|máy chiếu|màn chiếu|quan sát tranh chiếu|xem video|xem slide/i;
const studentDigitalActionPattern = /thao tác|sử dụng|tìm kiếm|truy cập|gõ|nhập|tạo|chỉnh sửa|lưu|chia sẻ|ghi âm|thu âm|chụp|quay/i;

const vietnameseAiRepairCodes = new Set([
  "TV-COVERAGE-01",
  "TV-COVERAGE-02",
  "TV-COVERAGE-03",
  "TV-QUALITY-01",
  "TV-QUALITY-02",
  "TV-QUALITY-10",
  "TV-QUALITY-23",
  "TV-QUALITY-33",
  "TV-QUALITY-39",
  "TV-QUALITY-44",
  "LQ-STRUCTURE-01",
  "LQ-STRUCTURE-02",
  "LQ-ACTIVITY-01",
  "LQ-ACTIVITY-02",
]);

function cleanText(value: string) {
  return String(value || "")
    .replace(/\.\s*:/g, ":")
    .replace(/\([^)]*(?:cần\s+(?:gv|giáo viên\s+)?xác minh|cần xác minh|ocr\s+chưa\s+rõ|kiểm tra lại\s+sgk|đối chiếu\s+(?:bằng|lại|theo)\s+sgk(?:\s+bản\s+in)?)[^)]*\)/gi, "")
    .replace(/(?:GV\s+)?chốt\s+theo\s+SGK\.?/gi, "Ghi chú chuẩn bị: GV đối chiếu ảnh SGK trước giờ dạy.")
    .replace(/(?:cần\s+(?:GV|giáo viên\s+)?xác minh|cần xác minh|OCR\s+chưa\s+rõ|kiểm tra lại\s+SGK|đối chiếu\s+(?:bằng|lại|theo)\s+SGK(?:\s+bản\s+in)?|theo\s+SGK\s+bản\s+in)\.?/gi, "Ghi chú chuẩn bị: GV đối chiếu ảnh SGK trước giờ dạy.")
    .replace(/\s*[:：]?\s*thực hiện được qua[^.;。]*[.;。]?/gi, "")
    .replace(/\s*[:：]?\s*sử dụng kiến thức,?\s*kĩ năng đặc thù[^.;。]*[.;。]?/gi, "")
    .replace(/\s*[:：]?\s*sử dụng kiến thức đặc thù[^.;。]*[.;。]?/gi, "")
    .replace(/kiến thức đặc thù|nội dung học tập đặc thù|được hình thành qua các hoạt động|được hình thành qua|qua các hoạt động học tập/gi, "")
    .replace(overAnalysisPattern, "nêu lí do đơn giản")
    .replace(/\bOCR\b/gi, "ảnh SGK")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();
}

function cleanStringArray(items: unknown, maxItems?: number) {
  const values = Array.isArray(items) ? items : typeof items === "string" ? [items] : [];
  const seen = new Set<string>();
  const cleaned: string[] = [];
  for (const item of values) {
    const text = cleanText(String(item || ""));
    const key = text.toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    cleaned.push(text);
  }
  return typeof maxItems === "number" ? cleaned.slice(0, maxItems) : cleaned;
}

function productKind(activity: LessonActivity) {
  const text = [
    activity.phase,
    activity.title,
    activity.objective,
    ...(activity.teacherActions || []),
    ...(activity.studentActions || []),
    ...(activity.learningProducts || []),
    activity.expectedAnswer || "",
  ].join(" ").toLowerCase();
  if (/nghe[- ]?viết|nhớ[- ]?viết|chính tả/.test(text)) return "spelling";
  if (/dấu chấm|dấu chấm hỏi|dấu câu|điền dấu/.test(text)) return "punctuation";
  if (/ch\/tr|c\/k|ac\/at|âm|vần|điền âm|điền vần/.test(text)) return "phonics";
  if (/3\s*[-–—]\s*5\s*câu|viết đoạn|viết.{0,20}\d+\s*câu/.test(text)) return "writing";
  if (/đọc thành tiếng|luyện đọc|ngắt nghỉ|giọng đọc/.test(text)) return "reading";
  if (/nói|kể|trình bày|chia sẻ/.test(text)) return "speaking";
  if (/trả lời|tìm chi tiết|đọc hiểu|câu hỏi/.test(text)) return "answer";
  return "generic";
}

function defaultCriteria(activity: LessonActivity) {
  switch (productKind(activity)) {
    case "spelling":
      return ["Viết đủ đoạn, đúng phần lớn tiếng.", "Viết hoa, dùng dấu câu và trình bày sạch."];
    case "punctuation":
      return ["Điền đúng dấu chấm hoặc dấu chấm hỏi.", "Đọc lại câu sau khi điền dấu phù hợp."];
    case "phonics":
      return ["Điền đúng âm/vần hoặc từ theo yêu cầu.", "Đọc được từ/cụm từ sau khi hoàn thành."];
    case "writing":
      return ["Viết đủ số câu, trọn ý.", "Dùng đúng dấu câu cơ bản."];
    case "reading":
      return ["Đọc đúng tiếng, rõ lời.", "Biết ngắt nghỉ ở câu dài."];
    case "speaking":
      return ["Nói đủ ý, rõ câu.", "Biết nghe và phản hồi ngắn phù hợp."];
    case "answer":
      return ["Trả lời đúng ý.", "Nêu được chi tiết liên quan."];
    default:
      return ["Hoàn thành đúng yêu cầu chính.", "Trình bày rõ, dễ theo dõi."];
  }
}

function cleanCriteria(activity: LessonActivity) {
  const cleaned = cleanStringArray(activity.successCriteria, 2);
  const hasMechanical = cleaned.some((item) => mechanicalTextPattern.test(item) || /có một bằng chứng|ba từ khóa/i.test(item));
  return (hasMechanical || cleaned.length === 0 ? defaultCriteria(activity) : [...cleaned, ...defaultCriteria(activity)]).slice(0, 2);
}

function isFocalActivity(activity: LessonActivity) {
  return /khám phá|luyện tập/i.test(`${activity.phase} ${activity.title}`);
}

function labelExtension(item: string) {
  const cleaned = cleanText(item);
  if (!extensionTaskPattern.test(cleaned) || extensionLabelPattern.test(cleaned)) return cleaned;
  return `Thực hiện khi còn thời gian: ${cleaned}`;
}

function cleanActivity(activity: LessonActivity, index: number): LessonActivity {
  const focal = isFocalActivity(activity);
  return {
    ...activity,
    phase: cleanText(activity.phase || `Hoạt động ${index + 1}`),
    title: cleanText(activity.title || activity.phase || `Hoạt động ${index + 1}`),
    objective: cleanText(activity.objective || "Giúp học sinh hoàn thành nhiệm vụ học tập."),
    teacherActions: cleanStringArray(activity.teacherActions).map(labelExtension),
    studentActions: cleanStringArray(activity.studentActions),
    inputOrMaterials: cleanStringArray(activity.inputOrMaterials, 6),
    learningProducts: cleanStringArray(activity.learningProducts, 1),
    successCriteria: cleanCriteria(activity),
    expectedAnswer: cleanText(activity.expectedAnswer || ""),
    acceptableResponses: cleanStringArray(activity.acceptableResponses, 4),
    commonErrors: cleanStringArray(activity.commonErrors, 3),
    teacherFeedback: cleanStringArray(activity.teacherFeedback, 3),
    supportForStudentsNeedingHelp: focal ? cleanStringArray(activity.supportForStudentsNeedingHelp, 1) : [],
    extensionForEarlyFinishers: focal ? cleanStringArray(activity.extensionForEarlyFinishers, 1).map(labelExtension) : [],
  };
}

function keepDigitalCompetency(item: string) {
  const text = item.toLowerCase();
  return !projectedOnlyDigitalPattern.test(text) || studentDigitalActionPattern.test(text);
}

function cleanOutcomes(lesson: LessonPlan) {
  const outcomes = lesson.outcomes;
  return {
    ...outcomes,
    generalCompetencies: cleanStringArray(outcomes.generalCompetencies, 2),
    specificCompetencies: cleanStringArray(outcomes.specificCompetencies, 3),
    qualities: cleanStringArray(outcomes.qualities, 2),
    knowledgeAndSkills: cleanStringArray(outcomes.knowledgeAndSkills, 6),
    digitalCompetencies: cleanStringArray(outcomes.digitalCompetencies).filter(keepDigitalCompetency),
  };
}

export function applyVietnameseMechanicalRepair(lesson: LessonPlan, _input?: LessonInput): LessonPlan {
  const periodPlans = lesson.periodPlans?.map((period) => ({
    ...period,
    focus: cleanText(period.focus),
    outcomes: period.outcomes ? {
      ...period.outcomes,
      generalCompetencies: cleanStringArray(period.outcomes.generalCompetencies, 2),
      specificCompetencies: cleanStringArray(period.outcomes.specificCompetencies, 3),
      qualities: cleanStringArray(period.outcomes.qualities, 2),
      knowledgeAndSkills: cleanStringArray(period.outcomes.knowledgeAndSkills, 6),
      digitalCompetencies: cleanStringArray(period.outcomes.digitalCompetencies).filter(keepDigitalCompetency),
    } : undefined,
    activities: (period.activities || []).map(cleanActivity),
  }));

  return {
    ...lesson,
    outcomes: cleanOutcomes(lesson),
    materials: {
      teacher: cleanStringArray(lesson.materials?.teacher, 8),
      students: cleanStringArray(lesson.materials?.students, 8),
    },
    activities: periodPlans?.length
      ? periodPlans.flatMap((period) => period.activities)
      : (lesson.activities || []).map(cleanActivity),
    periodPlans,
    assessment: {
      criteria: cleanStringArray(lesson.assessment?.criteria, 8),
      evidence: cleanStringArray(lesson.assessment?.evidence, 8),
      comments: cleanStringArray(lesson.assessment?.comments, 8),
    },
    contextFit: {
      notes: cleanStringArray(lesson.contextFit?.notes, 8).filter((item) => !unsafeUncertaintyPattern.test(item)),
    },
  };
}

export function vietnameseAiRepairFindings(findings: PedagogyAuditFinding[]) {
  return findings.filter((finding) => (
    finding.severity === "error"
    && finding.autoFixable === true
    && vietnameseAiRepairCodes.has(finding.code)
  ));
}

export function isMechanicalVietnameseFinding(finding: PedagogyAuditFinding) {
  return finding.autoFixable === true && !vietnameseAiRepairCodes.has(finding.code);
}
