import { activityPhaseKey } from "@/lib/lesson-format";
import {
  classifyVietnameseLesson,
  isVietnameseSubjectName,
  vietnameseLessonTypeProfiles,
} from "@/lib/vietnamese-pedagogy";
import type {
  LessonActivity,
  LessonInput,
  LessonPlan,
  PedagogyAuditFinding,
  VietnameseLessonType,
} from "@/types/lesson";

type VietnameseRule = {
  code: string;
  severity: PedagogyAuditFinding["severity"];
  autoFixable: boolean;
};

type Scope = {
  periodNumber?: number;
  focus?: string;
  activities: LessonActivity[];
};

type ActivityLocation = {
  activity: LessonActivity;
  activityIndex: number;
  periodNumber?: number;
};

type Requirement = {
  pattern: RegExp;
  description: string;
};

export const vietnameseQualityRules = {
  missingConcreteMaterial: { code: "TV-QUALITY-01", severity: "error", autoFixable: false },
  textbookOnlyReference: { code: "TV-QUALITY-02", severity: "error", autoFixable: false },
  missingTypeSequence: { code: "TV-QUALITY-03", severity: "warning", autoFixable: true },
  missingTypeProduct: { code: "TV-QUALITY-04", severity: "warning", autoFixable: true },
  missingTypeCriteria: { code: "TV-QUALITY-05", severity: "warning", autoFixable: true },
  missingErrorFeedback: { code: "TV-QUALITY-06", severity: "warning", autoFixable: true },
  missingExpectedResponse: { code: "TV-QUALITY-07", severity: "warning", autoFixable: true },
  gradeMismatch: { code: "TV-QUALITY-08", severity: "warning", autoFixable: true },
  unrelatedSkillOverload: { code: "TV-QUALITY-09", severity: "suggestion", autoFixable: true },
  missingListenerTask: { code: "TV-QUALITY-10", severity: "error", autoFixable: true },
  passiveStudentAction: { code: "TV-QUALITY-11", severity: "warning", autoFixable: true },
  insufficientClassificationEvidence: { code: "TV-QUALITY-12", severity: "suggestion", autoFixable: false },
  outcomeCountMismatch: { code: "TV-QUALITY-13", severity: "warning", autoFixable: true },
  dialogueScripting: { code: "TV-QUALITY-14", severity: "warning", autoFixable: true },
  assumedContext: { code: "TV-QUALITY-15", severity: "warning", autoFixable: true },
  missingCompositionPlaceholders: { code: "TV-QUALITY-16", severity: "warning", autoFixable: true },
  synonymSemanticMismatch: { code: "TV-QUALITY-17", severity: "error", autoFixable: true },
  mechanicalOutcomeWording: { code: "TV-QUALITY-18", severity: "warning", autoFixable: true },
  repeatedPeriodMaterial: { code: "TV-QUALITY-19", severity: "warning", autoFixable: true },
  overloadedActivityAssessment: { code: "TV-QUALITY-20", severity: "warning", autoFixable: true },
  nonMeasurableOutcomeVerb: { code: "TV-QUALITY-21", severity: "warning", autoFixable: true },
  badDotColonPunctuation: { code: "TV-QUALITY-22", severity: "warning", autoFixable: true },
  teacherStudentSequenceMismatch: { code: "TV-QUALITY-23", severity: "warning", autoFixable: true },
  repeatedMechanicalPhrase: { code: "TV-QUALITY-24", severity: "warning", autoFixable: true },
  duplicateGeneralCompetency: { code: "TV-QUALITY-25", severity: "warning", autoFixable: true },
  unrelatedQuality: { code: "TV-QUALITY-26", severity: "warning", autoFixable: true },
  unusedDeclaredMaterial: { code: "TV-QUALITY-27", severity: "warning", autoFixable: true },
  outcomeWithoutActivityEvidence: { code: "TV-QUALITY-28", severity: "warning", autoFixable: true },
  missingMainProduct: { code: "TV-QUALITY-29", severity: "warning", autoFixable: true },
  answerTermOutsideMaterial: { code: "TV-QUALITY-30", severity: "warning", autoFixable: true },
  durationExceeded: { code: "TV-QUALITY-31", severity: "warning", autoFixable: true },
  lessonTitleMismatch: { code: "TV-QUALITY-32", severity: "warning", autoFixable: true },
  duplicateActivityDemand: { code: "TV-QUALITY-33", severity: "warning", autoFixable: true },
  overusedDifferentiationTemplate: { code: "TV-QUALITY-34", severity: "warning", autoFixable: true },
  grade2OverAnalysis: { code: "TV-QUALITY-35", severity: "warning", autoFixable: true },
  missingReadingFluencyDetails: { code: "TV-QUALITY-36", severity: "warning", autoFixable: true },
  insufficientTypeTime: { code: "TV-QUALITY-37", severity: "warning", autoFixable: true },
  duplicateSpecificCompetency: { code: "TV-QUALITY-38", severity: "warning", autoFixable: true },
  sourceTaskMissingConcreteAnswer: { code: "TV-QUALITY-39", severity: "error", autoFixable: true },
  unsafeUncertaintyText: { code: "TV-QUALITY-40", severity: "warning", autoFixable: true },
  projectedOnlyDigitalCompetency: { code: "TV-QUALITY-41", severity: "warning", autoFixable: true },
  unlabeledExtensionTask: { code: "TV-QUALITY-42", severity: "warning", autoFixable: true },
  productCriteriaMismatch: { code: "TV-QUALITY-43", severity: "warning", autoFixable: true },
  missingStoryListeningRounds: { code: "TV-QUALITY-44", severity: "warning", autoFixable: true },
} as const satisfies Record<string, VietnameseRule>;

const typeRequirements: Record<Exclude<VietnameseLessonType, "mixed">, Requirement[]> = {
  phonics: [
    { pattern: /nghe|nhận diện|phân biệt.{0,30}(âm|vần|chữ)/i, description: "nghe/nhận diện âm-vần-chữ mục tiêu" },
    { pattern: /phân tích (tiếng|cấu tạo)|âm đầu|vần.{0,20}thanh/i, description: "phân tích cấu tạo tiếng" },
    { pattern: /ghép (tiếng|vần)|đánh vần|đọc (tiếng|từ)/i, description: "ghép và đọc tiếng/từ mới" },
    { pattern: /viết.{0,30}(chữ|tiếng|từ)|bảng con|tập viết/i, description: "luyện viết chữ/tiếng mới" },
    { pattern: /(đặt|nói|dùng).{0,30}(câu|ngữ cảnh).{0,30}(tiếng|từ)|câu.{0,30}(tiếng|từ) mới/i, description: "dùng tiếng/từ mới trong câu hoặc ngữ cảnh" },
  ],
  reading: [
    { pattern: /dự đoán|quan sát tranh|trước khi đọc|giới thiệu (bài|văn bản|tác giả)/i, description: "hoạt động trước khi đọc" },
    { pattern: /đọc (mẫu|thành tiếng|thầm|nối tiếp|phân vai|diễn cảm)|luyện đọc/i, description: "luyện đọc thành tiếng hoặc đọc thầm có nhiệm vụ" },
    { pattern: /chi tiết|dẫn chứng|bằng chứng|tìm trong (đoạn|bài|văn bản)|giải nghĩa từ/i, description: "đọc hiểu bám chi tiết hoặc từ trong ngữ cảnh" },
    { pattern: /ý chính|nội dung (chính|bài)|thông điệp|cảm nhận|liên hệ bản thân/i, description: "hoạt động sau đọc: ý chính, cảm nhận hoặc liên hệ" },
  ],
  handwriting: [
    { pattern: /quan sát.{0,30}(mẫu chữ|chữ mẫu)|mẫu (chữ|viết)/i, description: "quan sát mẫu chữ" },
    { pattern: /nét|điểm đặt bút|dừng bút|nối nét|cỡ chữ|dòng kẻ/i, description: "phân tích cấu tạo và quy trình viết" },
    { pattern: /gv viết mẫu|giáo viên viết mẫu|viết mẫu|làm mẫu/i, description: "giáo viên viết mẫu" },
    { pattern: /hs.{0,30}(luyện viết|viết)|bảng con|viết vào vở/i, description: "học sinh luyện viết" },
    { pattern: /đối chiếu|tự soát|sửa.{0,20}(tư thế|cầm bút|chữ)|tư thế.{0,20}cầm bút/i, description: "tự soát và sửa tư thế/chữ viết" },
  ],
  spelling: [
    { pattern: /từ khó|phân tích.{0,20}(âm|vần)|chuẩn bị.{0,30}(đoạn|bài) viết/i, description: "chuẩn bị từ khó và âm-vần dễ lẫn" },
    { pattern: /nghe[- ]viết|nhớ[- ]viết|tập chép/i, description: "quy trình nghe-viết, nhớ-viết hoặc tập chép" },
    { pattern: /soát (lỗi|bài)|đổi (bài|vở)|tự soát/i, description: "soát lỗi bài viết" },
    { pattern: /bài tập chính tả|phân biệt.{0,30}(âm|vần|ch\/tr|s\/x|d\/gi|l\/n)|điền.{0,20}(âm|vần)/i, description: "bài tập phân biệt chính tả" },
    { pattern: /sửa lỗi|ghi nhớ.{0,30}(quy tắc|từ khó)|sổ tay/i, description: "sửa lỗi cá nhân và ghi nhớ" },
  ],
  composition: [
    { pattern: /phân tích.{0,30}(đề|yêu cầu)|đọc đề|xác định yêu cầu/i, description: "phân tích yêu cầu đề" },
    { pattern: /tìm ý|lập (dàn ý|ý)|sơ đồ ý|sắp xếp ý/i, description: "tìm và sắp xếp ý" },
    { pattern: /viết (bản nháp|nháp|đoạn|bài|thư|đơn)/i, description: "viết nháp hoặc viết đoạn/bài" },
    { pattern: /đọc (lại|soát)|chỉnh sửa|sửa bài|góp ý|đánh giá đồng đẳng/i, description: "đọc soát và chỉnh sửa" },
    { pattern: /chia sẻ.{0,30}(bài|đoạn|sản phẩm)|đọc bài.{0,20}(trước lớp|cho bạn)|trưng bày/i, description: "chia sẻ sản phẩm viết" },
  ],
  "language-knowledge": [
    { pattern: /ngữ liệu|ví dụ|đoạn (văn|trích)|câu (mẫu|ví dụ)|quan sát.{0,30}(từ|câu)/i, description: "khám phá ngữ liệu cụ thể" },
    { pattern: /nhận xét|so sánh|phát hiện.{0,30}(đặc điểm|quy tắc)/i, description: "nhận xét và phát hiện đặc điểm" },
    { pattern: /gv chốt|giáo viên chốt|quy tắc|ghi nhớ|kết luận.{0,30}(kiến thức|đặc điểm)/i, description: "chốt kiến thức hoặc quy tắc" },
    { pattern: /tìm|phân loại|xác định|nhận diện/i, description: "luyện nhận diện" },
    { pattern: /đặt câu|viết đoạn|sửa lỗi.{0,20}(dùng từ|câu)|sử dụng.{0,20}(từ|câu|dấu)/i, description: "luyện sử dụng trong ngữ cảnh mới" },
  ],
  "speaking-listening": [
    { pattern: /chuẩn bị.{0,30}(nội dung|ý)|tiêu chí (nói|nghe)|lập ý/i, description: "chuẩn bị nội dung và tiêu chí nói-nghe" },
    { pattern: /nói (và nghe|trước|theo)|kể (chuyện|lại)|trình bày|chia sẻ ý kiến/i, description: "hoạt động nói theo lượt" },
    { pattern: /người nghe|nhiệm vụ nghe|ghi chú|nghe bạn/i, description: "nhiệm vụ cụ thể cho người nghe" },
    { pattern: /hỏi lại|hỏi[- ]đáp|phản hồi|nhận xét.{0,20}(bạn|phần nói)/i, description: "hỏi-đáp hoặc phản hồi" },
    { pattern: /tự điều chỉnh|nói lại|chỉnh sửa.{0,20}(cách nói|phần nói)|rút kinh nghiệm/i, description: "điều chỉnh phần nói theo góp ý" },
  ],
};

const productSignals: Record<Exclude<VietnameseLessonType, "mixed">, RegExp> = {
  phonics: /tiếng|từ|chữ|câu nói/i,
  reading: /đọc đúng|phần đọc|câu trả lời|chi tiết|ý chính|cảm nhận/i,
  handwriting: /chữ viết|bài viết|dòng chữ|tư thế/i,
  spelling: /bài chính tả|bài viết|bài tập phân biệt|từ khó|lỗi/i,
  composition: /dàn ý|sơ đồ ý|đoạn|bài viết|bản chỉnh sửa/i,
  "language-knowledge": /bài tập|câu|đoạn|bảng phân loại|sơ đồ từ/i,
  "speaking-listening": /phần trình bày|bài nói|câu hỏi|phản hồi|phiếu (tự|đánh giá)/i,
};

const criteriaSignals: Record<Exclude<VietnameseLessonType, "mixed">, RegExp> = {
  phonics: /đọc đúng|ghép được|viết đúng/i,
  reading: /đọc đúng|rõ|ngắt nghỉ|tìm được.{0,20}(chi tiết|dẫn chứng)|nêu được.{0,20}(ý chính|cảm nhận)/i,
  handwriting: /đúng mẫu|đúng cỡ|đúng dòng kẻ|khoảng cách|tư thế/i,
  spelling: /đúng chính tả|tự.{0,10}(phát hiện|sửa)|phân biệt đúng/i,
  composition: /đúng yêu cầu|đủ ý|trình tự|ngữ pháp|từ nối|dấu câu|chỉnh sửa/i,
  "language-knowledge": /nhận diện đúng|sử dụng đúng|sửa được lỗi|phân loại đúng/i,
  "speaking-listening": /đủ ý|rõ ràng|đúng trình tự|hỏi lại|nhận xét phù hợp|điều chỉnh/i,
};

const focusSignals: Record<Exclude<VietnameseLessonType, "mixed">, RegExp> = {
  phonics: /âm|vần|ghép tiếng|đánh vần|đọc tiếng|viết chữ/i,
  reading: /đọc|văn bản|bài thơ|chi tiết|ý chính/i,
  handwriting: /mẫu chữ|nét|cỡ chữ|dòng kẻ|luyện viết/i,
  spelling: /chính tả|nghe[- ]viết|nhớ[- ]viết|tập chép|từ khó/i,
  composition: /tìm ý|dàn ý|viết (đoạn|bài|thư|đơn)|chỉnh sửa/i,
  "language-knowledge": /ngữ liệu|từ loại|dấu câu|kiểu câu|đặt câu|phân loại/i,
  "speaking-listening": /nói|nghe|kể chuyện|trình bày|người nghe/i,
};

const unrelatedSignals: Record<Exclude<VietnameseLessonType, "mixed">, RegExp[]> = {
  phonics: [/đọc hiểu.{0,30}(ý chính|thông điệp)/i, /lập dàn ý|viết đoạn.{0,20}[5-9] câu/i, /thuyết trình/i],
  reading: [/ghép vần|đánh vần/i, /quy tắc chính tả|nghe[- ]viết/i, /lập dàn ý.{0,30}viết bài/i],
  handwriting: [/đọc hiểu|ý chính văn bản/i, /lập dàn ý/i, /nói và nghe|kể chuyện/i, /nghe[- ]viết/i],
  spelling: [/đọc hiểu|ý chính|thông điệp/i, /lập dàn ý|viết đoạn/i, /thuyết trình|kể chuyện/i],
  composition: [/ghép vần|đánh vần/i, /đọc diễn cảm/i, /nghe[- ]viết|quy tắc chính tả/i],
  "language-knowledge": [/đọc hiểu văn bản|nêu ý chính/i, /viết bài hoàn chỉnh/i, /nghe[- ]viết/i, /kể chuyện/i],
  "speaking-listening": [/viết đoạn|lập dàn ý bài viết/i, /đọc hiểu chi tiết/i, /nghe[- ]viết|quy tắc chính tả/i, /ghép vần/i],
};

const outcomeGroups = ["generalCompetencies", "specificCompetencies", "qualities", "knowledgeAndSkills", "digitalCompetencies"] as const;

const measurableOutcomeVerbPattern = /^(?:Đọc|Hiểu|Tìm|Xác định|Sắp xếp|Nêu|Lựa chọn|Đặt câu|Viết|Tự sửa)\b/iu;
const measurableOutcomeVerbExamples = "Đọc/Hiểu/Tìm/Xác định/Sắp xếp/Nêu/Lựa chọn/Đặt câu/Viết/Tự sửa";
const mechanicalOutcomePattern = /thực hiện được qua|sử dụng kiến thức,?\s*kĩ năng đặc thù|sử dụng kiến thức đặc thù|kiến thức đặc thù|nội dung học tập đặc thù|được hình thành qua|qua các hoạt động|thông qua hoạt động|\.\s*:/i;
const repeatedMechanicalPhrasePattern = /thực hiện được qua|sử dụng kiến thức,?\s*kĩ năng đặc thù|sử dụng kiến thức đặc thù|kiến thức đặc thù|nội dung học tập đặc thù|hoàn thành nhiệm vụ học tập|được hình thành qua|thông qua hoạt động|phát triển năng lực phẩm chất|đáp ứng yêu cầu cần đạt/i;
const badDotColonPattern = /\.\s*:/;
const differentiationTemplatePattern = /ba từ khóa|có một bằng chứng|giải thích tác dụng|phân tích tác dụng/i;
const grade2OverAnalysisPattern = /giải thích tác dụng|phân tích tác dụng|hiệu quả của nhịp|phân tích sâu|phân tích nghệ thuật|biện pháp nghệ thuật|phép lặp|hàm ý|hình ảnh nghệ thuật/i;
const unsafeUncertaintyPattern = /cần\s+(?:gv|giáo viên\s+)?xác minh|cần xác minh|ocr\s+chưa\s+rõ|kiểm tra lại\s+sgk|đối chiếu\s+(?:bằng|lại|theo)\s+sgk(?:\s+bản\s+in)?|chốt\s+theo\s+sgk|theo\s+sgk\s+bản\s+in/i;
const extensionTaskPattern = /hỏi người thân|về nhà|sưu tầm|phỏng vấn|ngoài sgk|nếu còn thời gian|khi còn thời gian/i;
const extensionLabelPattern = /hoạt động mở rộng|thực hiện khi còn thời gian/i;
const projectedOnlyDigitalPattern = /gv|giáo viên|trình chiếu|máy chiếu|màn chiếu|quan sát tranh chiếu|xem video|xem slide/i;
const studentDigitalActionPattern = /thao tác|sử dụng|tìm kiếm|truy cập|gõ|nhập|tạo|chỉnh sửa|lưu|chia sẻ|ghi âm|thu âm|chụp|quay/i;
const morningSynonymPattern = /ban mai|sáng sớm|bình minh|sớm mai|rạng sáng/i;
const movementSynonymPattern = /khuân|vác|lôi|bê|xách|kéo|đẩy/i;
const soundSemanticLabelPattern = /(?:từ|nhóm|trường nghĩa|đồng nghĩa).{0,90}(?:âm thanh|tiếng động|tiếng kêu|tiếng vang)|(?:âm thanh|tiếng động|tiếng kêu|tiếng vang).{0,90}(?:từ|nhóm|đồng nghĩa)/i;
const negatedSoundLabelPattern = /không.{0,30}(?:phải|là|thuộc).{0,50}(?:âm thanh|tiếng động|tiếng kêu|tiếng vang)/i;
const genericPeriodMaterialPattern = /^(?:sgk|sách giáo khoa|vở|bút|vở ghi|vở bài tập|bảng con|bảng phụ|phiếu học tập|thẻ từ|ảnh sgk|tranh minh họa|máy chiếu|loa)$/i;
const genericProductPattern = /^(?:sản phẩm học tập|kết quả hoạt động|nội dung thảo luận|bảng tổng hợp|phiếu học tập|bài làm)$/i;
const qualityContextTerms = [
  "yêu nước",
  "quê hương",
  "đất nước",
  "biển đảo",
  "bảo vệ môi trường",
  "môi trường",
  "thiên nhiên",
  "gia đình",
  "Bác Hồ",
  "an toàn giao thông",
  "động vật",
  "cây xanh",
  "cây cối",
];
const vietnameseStopWords = new Set([
  "anh", "bai", "ban", "bang", "bang", "bo", "cac", "can", "cau", "cho", "cua", "dat", "de", "den", "duoc", "dung",
  "giao", "giao", "hoc", "hoac", "hocsinh", "khi", "lop", "mot", "muc", "nang", "neu", "noi", "qua", "sach", "sgk",
  "sinh", "the", "theo", "thuc", "tiet", "trong", "tu", "vao", "va", "voi", "yeu",
]);

const actionIntentPatterns: Array<{ key: string; pattern: RegExp }> = [
  { key: "observe", pattern: /quan sát|dự đoán/i },
  { key: "read", pattern: /\bđọc|luyện đọc|đọc nối tiếp|đọc thầm|đọc thành tiếng/i },
  { key: "find", pattern: /\btìm|xác định|gạch chân|chỉ ra/i },
  { key: "answer", pattern: /hỏi|trả lời|nêu|giải thích|lựa chọn/i },
  { key: "write", pattern: /\bviết|đặt câu|điền|ghi vào|ghi lại/i },
  { key: "sort", pattern: /sắp xếp|phân loại|xếp nhóm/i },
  { key: "discuss", pattern: /thảo luận|trao đổi|làm việc nhóm|làm việc cặp/i },
  { key: "present", pattern: /trình bày|chia sẻ|báo cáo|nói trước lớp|kể lại/i },
  { key: "self-check", pattern: /tự sửa|tự soát|đọc soát|chỉnh sửa|soát lỗi/i },
];

function finding(rule: VietnameseRule, message: string, location: Partial<PedagogyAuditFinding> = {}): PedagogyAuditFinding {
  return { code: rule.code, severity: rule.severity, autoFixable: rule.autoFixable, message, ...location };
}

function scopes(lesson: LessonPlan): Scope[] {
  if (lesson.periodPlans?.length) {
    return lesson.periodPlans.map((period) => ({
      periodNumber: period.periodNumber,
      focus: period.focus,
      activities: period.activities || [],
    }));
  }
  return [{ focus: lesson.generalInfo.lessonTitle, activities: lesson.activities || [] }];
}

function allActivityLocations(scope: Scope): ActivityLocation[] {
  return scope.activities.map((activity, activityIndex) => ({ activity, activityIndex, periodNumber: scope.periodNumber }));
}

function activityText(activity: LessonActivity) {
  return [
    activity.phase,
    activity.title,
    activity.objective,
    ...(activity.inputOrMaterials || []),
    ...(activity.teacherActions || []),
    ...(activity.studentActions || []),
    ...(activity.learningProducts || []),
    ...(activity.successCriteria || []),
    activity.expectedAnswer || "",
    ...(activity.acceptableResponses || []),
    ...(activity.commonErrors || []),
    ...(activity.teacherFeedback || []),
    ...(activity.errorFeedback || []).flatMap((item) => [item.error, ...item.feedback]),
    ...(activity.supportForStudentsNeedingHelp || []),
    ...(activity.extensionForEarlyFinishers || []),
  ].join(" ");
}

function scopeText(scope: Scope) {
  return scope.activities.map(activityText).join(" ");
}

function scopeLabel(scope: Scope) {
  return scope.periodNumber ? `Tiết ${scope.periodNumber}` : "Giáo án";
}

function concreteMaterialText(lesson: LessonPlan, scope: Scope) {
  return [
    ...scope.activities.flatMap((activity) => [
      ...(activity.inputOrMaterials || []),
      ...(activity.teacherActions || []),
      ...(activity.studentActions || []),
      activity.expectedAnswer || "",
    ]),
    ...(scope.periodNumber ? [] : [...lesson.materials.teacher, ...lesson.materials.students]),
  ].join(" ");
}

function hasConcreteVietnameseMaterial(text: string) {
  if (/“[^”]{2,}”|"[^"]{2,}"|'[^']{2,}'/.test(text)) return true;
  return /(?:âm|vần|chữ|tiếng|từ khó|từ mục tiêu|câu mẫu|đoạn viết|đoạn văn|bài thơ|bài đọc|văn bản|tranh|mẫu chữ|ngữ liệu)\s*[:：-]\s*[\p{L}\d]/iu.test(text)
    || /\b(?:ch\/tr|s\/x|d\/gi|r\/d|l\/n|ng\/ngh|g\/gh|c\/k)\b/i.test(text);
}

function expectedResponseNeeded(activity: LessonActivity) {
  return /câu hỏi|hỏi:|yêu cầu.{0,30}(nêu|trả lời|tìm|giải thích)|tìm.{0,30}(chi tiết|từ|câu)|đặt câu/i.test(activityText(activity));
}

function hasExpectedResponse(activity: LessonActivity) {
  return Boolean(activity.expectedAnswer?.trim())
    || Boolean(activity.acceptableResponses?.some((item) => item.trim()))
    || (activity.studentActions || []).some((action) => /trả lời\s*[:：]|nêu\s*[:：]|tìm được\s*[:：]|đáp án\s*[:：]|chi tiết\s*[:：]/i.test(action));
}

function comparableText(value: string) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function contentWords(value: string) {
  return comparableText(value)
    .split(" ")
    .filter((word) => word.length >= 3 && !vietnameseStopWords.has(word));
}

function allLessonTextEntries(lesson: LessonPlan) {
  const periodOutcomeEntries = (lesson.periodPlans || []).flatMap((period) => [
    period.focus,
    ...outcomeGroups.flatMap((category) => period.outcomes?.[category] || []),
    ...period.activities.map(activityText),
  ]);
  return [
    lesson.generalInfo.lessonTitle,
    lesson.generalInfo.subject,
    lesson.generalInfo.grade,
    lesson.generalInfo.book || "",
    ...outcomeGroups.flatMap((category) => lesson.outcomes?.[category] || []),
    ...(lesson.materials?.teacher || []),
    ...(lesson.materials?.students || []),
    ...lesson.activities.map(activityText),
    ...periodOutcomeEntries,
    ...(lesson.assessment?.criteria || []),
    ...(lesson.assessment?.evidence || []),
    ...(lesson.assessment?.comments || []),
    ...(lesson.contextFit?.notes || []),
  ].filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function allLessonText(lesson: LessonPlan) {
  return allLessonTextEntries(lesson).join(" ");
}

function repeatedMechanicalPhrase(lesson: LessonPlan) {
  const counts = new Map<string, string>();
  for (const entry of allLessonTextEntries(lesson)) {
    if (!repeatedMechanicalPhrasePattern.test(entry)) continue;
    const key = comparableText(entry);
    if (!key) continue;
    if (counts.has(key)) return counts.get(key) || entry;
    counts.set(key, entry.trim());
  }
  return "";
}

function materialParts(value: string) {
  return String(value || "")
    .split(/[,;；、]|\s+và\s+/i)
    .map((part) => part.replace(/[.。]+$/g, "").trim())
    .filter(Boolean);
}

function isGenericMaterialName(value: string) {
  const trimmed = value.replace(/[.。]+$/g, "").trim();
  if (!trimmed) return true;
  if (genericPeriodMaterialPattern.test(trimmed)) return true;
  return materialKey(trimmed).length < 6;
}

function declaredSpecificMaterials(lesson: LessonPlan) {
  const seen = new Set<string>();
  return [...(lesson.materials?.teacher || []), ...(lesson.materials?.students || [])]
    .flatMap(materialParts)
    .filter((material) => !isGenericMaterialName(material))
    .filter((material) => {
      const key = materialKey(material);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function materialMentionedInText(material: string, haystack: string) {
  const key = comparableText(material);
  if (!key) return true;
  if (haystack.includes(key)) return true;
  const words = contentWords(material);
  if (!words.length) return true;
  const hits = words.filter((word) => haystack.includes(word)).length;
  return hits >= Math.min(2, words.length);
}

function unusedDeclaredMaterials(lesson: LessonPlan) {
  const activityHaystack = comparableText(scopes(lesson).flatMap((scope) => scope.activities.map(activityText)).join(" "));
  return declaredSpecificMaterials(lesson).filter((material) => !materialMentionedInText(material, activityHaystack));
}

function duplicateGeneralCompetencyPeriods(lesson: LessonPlan) {
  const seen = new Map<string, number>();
  const duplicates: Array<{ periodNumber: number; previousPeriod: number }> = [];
  (lesson.periodPlans || []).forEach((period) => {
    const competencies = period.outcomes?.generalCompetencies || [];
    if (!competencies.length) return;
    const key = competencies.map(comparableText).filter(Boolean).join(" | ");
    if (!key) return;
    const previousPeriod = seen.get(key);
    if (previousPeriod !== undefined) duplicates.push({ periodNumber: period.periodNumber, previousPeriod });
    else seen.set(key, period.periodNumber);
  });
  return duplicates;
}

function titleLooksConcrete(value: string) {
  const title = comparableText(value);
  return title.length > 0 && !/^(?:bai hoc|bai test|de trong|tu nhan dien|khong xac dinh)$/.test(title);
}

function comparableTitle(value: string) {
  return comparableText(value)
    .replace(/\b(?:bai|tiet|tap doc|doc|luyen tu va cau|chinh ta|nghe viet|noi va nghe|tap lam van)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titlesSimilar(expected: string, actual: string) {
  const expectedTitle = comparableTitle(expected);
  const actualTitle = comparableTitle(actual);
  if (!expectedTitle || !actualTitle) return true;
  if (expectedTitle.includes(actualTitle) || actualTitle.includes(expectedTitle)) return true;
  const expectedWords = expectedTitle.split(" ").filter((word) => word.length >= 3);
  const actualWords = new Set(actualTitle.split(" ").filter((word) => word.length >= 3));
  if (!expectedWords.length || !actualWords.size) return true;
  const overlap = expectedWords.filter((word) => actualWords.has(word)).length;
  return overlap / expectedWords.length >= 0.6;
}

function lessonTitleMismatch(input: LessonInput, lesson: LessonPlan) {
  const requested = input.lessonTitle?.trim() || "";
  const actual = lesson.generalInfo.lessonTitle?.trim() || "";
  return titleLooksConcrete(requested) && titleLooksConcrete(actual) && !titlesSimilar(requested, actual);
}

function scopeOutcomes(lesson: LessonPlan, scope: Scope) {
  if (!scope.periodNumber) return lesson.outcomes;
  return lesson.periodPlans?.find((period) => period.periodNumber === scope.periodNumber)?.outcomes || lesson.outcomes;
}

function qualityContentEvidenceText(lesson: LessonPlan, scope: Scope) {
  const outcomes = scopeOutcomes(lesson, scope);
  return [
    lesson.generalInfo.lessonTitle,
    scope.focus || "",
    ...(lesson.materials?.teacher || []),
    ...(lesson.materials?.students || []),
    ...scope.activities.map(activityText),
    ...(outcomes?.knowledgeAndSkills || []),
    ...(outcomes?.specificCompetencies || []),
  ].join(" ");
}

function unrelatedQualityStatements(lesson: LessonPlan, scope: Scope) {
  const outcomes = scopeOutcomes(lesson, scope);
  const evidence = comparableText(qualityContentEvidenceText(lesson, scope));
  return (outcomes?.qualities || []).filter((quality) => {
    const normalizedQuality = comparableText(quality);
    const matchedTerms = qualityContextTerms.filter((term) => normalizedQuality.includes(comparableText(term)));
    return matchedTerms.length > 0 && matchedTerms.every((term) => !evidence.includes(comparableText(term)));
  });
}

function outcomeHasActivityEvidence(statement: string, scope: Scope) {
  const rawEvidence = scopeText(scope);
  const evidence = comparableText(rawEvidence);
  const words = contentWords(statement);
  if (!words.length) return true;

  const statementIntents = actionIntents(statement);
  const evidenceIntents = actionIntents(rawEvidence);
  if (statementIntents.size && evidenceIntents.size && ![...statementIntents].some((intent) => evidenceIntents.has(intent))) {
    return false;
  }

  const hits = words.filter((word) => evidence.includes(word)).length;
  const requiredHits = words.length <= 2 ? 1 : 2;
  return hits >= requiredHits;
}

function unmatchedKnowledgeOutcomes(lesson: LessonPlan, scope: Scope) {
  const outcomes = scopeOutcomes(lesson, scope);
  return (outcomes?.knowledgeAndSkills || []).filter((statement) => !outcomeHasActivityEvidence(statement, scope));
}

function actionIntents(value: string) {
  return new Set(actionIntentPatterns.filter(({ pattern }) => pattern.test(value)).map(({ key }) => key));
}

function hasTeacherStudentSequenceMismatch(activity: LessonActivity) {
  const teachers = (activity.teacherActions || []).filter((item) => item.trim());
  const students = (activity.studentActions || []).filter((item) => item.trim());
  if (!teachers.length || !students.length) return false;
  if (teachers.length !== students.length) return true;
  return teachers.some((teacher, index) => {
    const student = students[index] || "";
    if (/đọc mẫu|làm mẫu|nêu mẫu|chốt|giới thiệu/i.test(teacher) && /nghe|quan sát|theo dõi/i.test(student)) return false;
    const teacherIntents = actionIntents(teacher);
    const studentIntents = actionIntents(student);
    if (!teacherIntents.size || !studentIntents.size) return false;
    if (/thực hiện nhiệm vụ|làm theo yêu cầu|tham gia hoạt động/i.test(student)) return false;
    return [...teacherIntents].every((intent) => !studentIntents.has(intent));
  });
}

function mainProductProblem(activity: LessonActivity) {
  const products = (activity.learningProducts || []).map((product) => product.trim()).filter(Boolean);
  if (!products.length) return "thiếu sản phẩm chính";
  if (products.some((product) => genericProductPattern.test(product))) return "sản phẩm chính còn mơ hồ";
  return "";
}

function scopeDuration(scope: Scope) {
  return scope.activities.reduce((sum, activity) => sum + Math.max(0, Number(activity.durationMinutes || 0)), 0);
}

function checkableAnswerTerms(activity: LessonActivity) {
  const answerText = [activity.expectedAnswer || "", ...(activity.acceptableResponses || [])].join(" ");
  const terms = new Set<string>();
  const quoted = answerText.match(/[“”"'`]?([\p{L}][\p{L}\s-]{1,35})[“”"'`]?/giu) || [];
  quoted
    .filter((term) => /[“”"'`]/.test(term))
    .forEach((term) => terms.add(term.replace(/[“”"'`]/g, "").trim()));

  const labeledPattern = /(?:đáp án\s+(?:điền từ|lựa chọn|từ cần điền)|từ cần điền|cụm từ cần điền|nhóm từ|các từ)\s*[:：]\s*([^.;\n]+)/giu;
  for (const match of answerText.matchAll(labeledPattern)) {
    (match[1] || "").split(/[,;；、]|\s+và\s+|\//i).map((part) => part.trim()).filter(Boolean).forEach((part) => terms.add(part));
  }

  return [...terms]
    .map((term) => term.replace(/^(?:là|gồm|có)\s+/i, "").trim())
    .filter((term) => {
      const normalized = comparableText(term);
      return normalized.length >= 3
        && normalized.length <= 35
        && !/^(?:dap an|du kien|phu hop|ngu lieu|cau tra loi|y chinh)$/.test(normalized);
    });
}

function answerTermsOutsideMaterial(activity: LessonActivity) {
  const materialText = (activity.inputOrMaterials || []).join(" ");
  if (!hasConcreteVietnameseMaterial(materialText)) return [];
  const materialComparable = comparableText(materialText);
  return checkableAnswerTerms(activity).filter((term) => !materialComparable.includes(comparableText(term)));
}

function hasSynonymSemanticMismatch(text: string) {
  if (negatedSoundLabelPattern.test(text)) return false;
  const mentionsSensitiveWords = morningSynonymPattern.test(text) || movementSynonymPattern.test(text);
  return mentionsSensitiveWords && soundSemanticLabelPattern.test(text);
}

function hasMechanicalOutcomeText(text: string) {
  return mechanicalOutcomePattern.test(text);
}

function outcomeEntries(lesson: LessonPlan) {
  const sets = [
    { outcomes: lesson.outcomes, periodNumber: undefined as number | undefined },
    ...(lesson.periodPlans || []).map((period) => ({ outcomes: period.outcomes, periodNumber: period.periodNumber })),
  ];
  return sets.flatMap(({ outcomes, periodNumber }) =>
    outcomeGroups.flatMap((category) => (outcomes?.[category] || []).map((statement, index) => ({ category, statement, index, periodNumber }))),
  );
}

function materialKey(value: string) {
  return value
    .toLowerCase()
    .normalize("NFC")
    .replace(/[“”"'`]/g, "")
    .replace(/\s+/g, " ")
    .replace(/[.;,\s]+$/g, "")
    .trim();
}

function specificPeriodMaterials(scope: Scope) {
  return scope.activities.flatMap((activity) => activity.inputOrMaterials || [])
    .map((material) => ({ material, key: materialKey(material) }))
    .filter(({ key }) => key.length >= 12 && !genericPeriodMaterialPattern.test(key));
}

function criteriaItemCount(criteria: string[]) {
  return criteria.reduce((count, criterion) => {
    const parts = criterion.split(/;|\n|•/).map((part) => part.trim()).filter(Boolean);
    return count + Math.max(1, parts.length);
  }, 0);
}

function activityAssessmentOverload(activity: LessonActivity) {
  const products = (activity.learningProducts || []).filter((product) => product.trim());
  const criteria = (activity.successCriteria || []).filter((criterion) => criterion.trim());
  return {
    productCount: products.length,
    criteriaCount: criteriaItemCount(criteria),
  };
}

function hasErrorFeedback(activity: LessonActivity) {
  const hasErrors = Boolean(activity.commonErrors?.some((item) => item.trim())) || /lỗi thường gặp|dễ nhầm|nếu hs (sai|nhầm)|học sinh (sai|nhầm)/i.test(activityText(activity));
  const hasFeedback = Boolean(activity.teacherFeedback?.some((item) => item.trim()))
    || Boolean(activity.errorFeedback?.some((item) => item.error.trim() && item.feedback.some((value) => value.trim())))
    || /sửa lỗi|gợi ý|nhắc hs|phản hồi|hướng dẫn.{0,30}(sửa|đối chiếu)/i.test(activityText(activity));
  return hasErrors && hasFeedback;
}

function gradeNumber(grade: string) {
  const match = String(grade).match(/([1-5])/);
  return match ? Number(match[1]) : 0;
}

function sentenceRange(text: string) {
  const match = text.match(/(\d+)\s*(?:[-–—]|đến)\s*(\d+)\s*câu/i);
  return match ? { min: Number(match[1]), max: Number(match[2]) } : null;
}

function gradeMismatchMessage(type: VietnameseLessonType, grade: number, text: string) {
  if (!grade) return "";
  if (type === "phonics" && grade > 2) return "Học âm-vần mới chỉ phù hợp chủ yếu lớp 1–2; cần xác minh lại kiểu bài hoặc yêu cầu.";
  if (type === "handwriting" && grade > 3 && /nét cơ bản|chữ thường mới/i.test(text)) return "Yêu cầu dạy nét cơ bản/chữ thường mới chưa phù hợp trọng tâm lớp 4–5.";
  if (type === "speaking-listening" && grade <= 2 && /thuyết trình|phản biện|lý lẽ/i.test(text)) return "Yêu cầu thuyết trình/phản biện vượt mức nói-nghe lớp 1–2.";
  if (type === "reading" && grade <= 2 && /biện pháp nghệ thuật|phân tích nghệ thuật|hàm ý/i.test(text)) return "Yêu cầu phân tích nghệ thuật/hàm ý vượt mức đọc lớp 1–2.";
  if (type === "composition") {
    const range = sentenceRange(text);
    if (grade === 1 && ((range && range.max > 3) || /viết bài (văn|hoàn chỉnh)|lập dàn ý/i.test(text))) return "Khối lượng viết vượt mức lớp 1: nên viết 1–3 câu theo mẫu/gợi ý.";
    if (grade === 2 && ((range && range.max > 5) || /viết bài (văn|hoàn chỉnh)/i.test(text))) return "Khối lượng viết vượt mức lớp 2: nên viết đoạn khoảng 3–5 câu có gợi ý.";
    if (grade === 3 && range && range.min > 7) return "Khối lượng viết vượt mức lớp 3: trọng tâm thường là đoạn 5–7 câu.";
    if (grade >= 4 && /chỉ viết [1-3] câu|viết 1[-–—]3 câu/i.test(text)) return "Nhiệm vụ viết quá thấp so với lớp 4–5 nếu đây là trọng tâm cả tiết.";
  }
  return "";
}

function passiveActionLocation(scope: Scope) {
  return allActivityLocations(scope).find(({ activity }) => {
    const teacher = (activity.teacherActions || []).join(" ");
    const student = (activity.studentActions || []).join(" ");
    return /yêu cầu|giao nhiệm vụ|hướng dẫn|tổ chức|mời hs/i.test(teacher)
      && /tìm|viết|đọc|nói|kể|thảo luận|trình bày|đặt câu|phân loại|sửa/i.test(teacher)
      && /^(?:hs\s+)?(?:lắng nghe|quan sát|theo dõi)[.\s]*$/i.test(student.trim());
  });
}

function listenerTaskPresent(text: string) {
  return /người nghe|nhiệm vụ nghe|ghi chú|hỏi lại|nhận xét (bạn|phần nói)|phản hồi|đánh giá phần nói/i.test(text);
}

function classificationText(lesson: LessonPlan) {
  const activityContent = scopes(lesson).flatMap((scope) => scope.activities.flatMap((activity) => [
    activity.phase,
    activity.title,
    activity.objective,
    ...(activity.inputOrMaterials || []),
    ...(activity.teacherActions || []),
    ...(activity.studentActions || []),
    ...(activity.learningProducts || []),
    ...(activity.successCriteria || []),
    activity.expectedAnswer || "",
    ...(activity.acceptableResponses || []),
    ...(activity.commonErrors || []),
    ...(activity.teacherFeedback || []),
  ]));
  return [
    lesson.generalInfo.lessonTitle,
    ...activityContent,
  ].join(" ");
}

function activityDemandText(activity: LessonActivity) {
  return [
    activity.objective,
    ...(activity.teacherActions || []).filter((action) => /hỏi|câu hỏi|vì sao|tại sao|tìm|nêu|viết|đặt câu|trả lời|sản phẩm/i.test(action)),
    ...(activity.studentActions || []).filter((action) => /trả lời|tìm|nêu|viết|đặt câu|chia sẻ|sản phẩm/i.test(action)),
    ...(activity.learningProducts || []),
    activity.expectedAnswer || "",
  ].join(" ");
}

function duplicateActivityDemands(scope: Scope) {
  const duplicates: Array<{ previousIndex: number; activityIndex: number }> = [];
  const candidates = allActivityLocations(scope).filter(({ activity }) => {
    const phase = activityPhaseKey(activity);
    if (phase === "Khởi động") return false;
    const text = activityDemandText(activity);
    return /hỏi|câu hỏi|vì sao|tại sao|tìm|nêu|viết|đặt câu|trả lời|chi tiết|sản phẩm/i.test(text);
  });
  candidates.forEach((left, leftIndex) => {
    candidates.slice(leftIndex + 1).forEach((right) => {
      const leftText = activityDemandText(left.activity);
      const rightText = activityDemandText(right.activity);
      const overlap = textOverlap(leftText, rightText);
      const leftIntents = actionIntents(leftText);
      const rightIntents = actionIntents(rightText);
      const sharesIntent = !leftIntents.size || !rightIntents.size || [...leftIntents].some((intent) => rightIntents.has(intent));
      if (overlap >= 0.72 && sharesIntent) {
        duplicates.push({ previousIndex: left.activityIndex, activityIndex: right.activityIndex });
      }
    });
  });
  return duplicates;
}

function textOverlap(left: string, right: string) {
  const leftWords = new Set(contentWords(left));
  const rightWords = new Set(contentWords(right));
  if (!leftWords.size || !rightWords.size) return 0;
  const hits = [...leftWords].filter((word) => rightWords.has(word)).length;
  return hits / Math.min(leftWords.size, rightWords.size);
}

function overusedDifferentiation(scope: Scope) {
  const differentiatedActivities = scope.activities.filter((activity) =>
    Boolean(activity.supportForStudentsNeedingHelp?.some((item) => item.trim()))
    || Boolean(activity.extensionForEarlyFinishers?.some((item) => item.trim()))
  );
  const templatedActivities = scope.activities.filter((activity) => differentiationTemplatePattern.test(activityText(activity)));
  if (templatedActivities.length) return { count: differentiatedActivities.length, templated: true };
  if (differentiatedActivities.length > 2) return { count: differentiatedActivities.length, templated: false };
  return null;
}

function duplicateSpecificCompetenciesInScope(lesson: LessonPlan, scope: Scope) {
  const outcomes = scopeOutcomes(lesson, scope);
  const knowledge = outcomes?.knowledgeAndSkills || [];
  return (outcomes?.specificCompetencies || []).filter((competency) =>
    knowledge.some((statement) => {
      const comparableCompetency = comparableText(competency);
      const comparableStatement = comparableText(statement);
      return Boolean(comparableCompetency && comparableStatement)
        && (comparableCompetency.includes(comparableStatement)
          || comparableStatement.includes(comparableCompetency)
          || textOverlap(competency, statement) >= 0.75);
    }),
  );
}

function hasSlashMarkedLongSentence(text: string) {
  return /[\p{L}\d][^.!?\n]{8,}\/[^.!?\n]{3,}/u.test(text);
}

function missingReadingFluencyDetails(scope: Scope, grade: number, lessonType: VietnameseLessonType) {
  if (lessonType !== "reading" || grade > 3) return false;
  const text = scopeText(scope);
  if (!/đọc thành tiếng|luyện đọc|đọc nối tiếp|đọc mẫu|ngắt nghỉ/i.test(text)) return false;
  const details = [
    hasSlashMarkedLongSentence(text),
    /giọng đọc|đọc chậm rãi|đọc nhẹ nhàng|đọc rõ ràng/i.test(text),
    /tốc độ|vừa phải|chậm rãi/i.test(text),
    /từ khó|tiếng khó|dễ đọc sai/i.test(text),
    /nhấn|nhấn giọng/i.test(text),
  ].filter(Boolean).length;
  return details < 3;
}

function effectiveActivityMinutes(activity: LessonActivity) {
  return Math.max(
    Number(activity.durationMinutes || 0),
    Number(activity.timeBreakdown?.workingMinutes || 0),
  );
}

function maxMinutesForTask(scope: Scope, pattern: RegExp) {
  return scope.activities
    .filter((activity) => pattern.test(activityText(activity)))
    .reduce((max, activity) => Math.max(max, effectiveActivityMinutes(activity)), 0);
}

function insufficientTypeTimeMessage(scope: Scope, grade: number, lessonType: VietnameseLessonType) {
  const text = scopeText(scope);
  if (lessonType === "reading" && grade <= 3 && /đọc thành tiếng|luyện đọc|đọc nối tiếp/i.test(text)) {
    const minutes = maxMinutesForTask(scope, /đọc thành tiếng|luyện đọc|đọc nối tiếp|ngắt nghỉ/i);
    if (minutes > 0 && minutes < 10) return `phần đọc thành tiếng lớp ${grade} chỉ có ${minutes} phút; nên bố trí 10–14 phút.`;
  }
  if (lessonType === "spelling" && /nghe[- ]?viết|nhớ[- ]?viết|chính tả/i.test(text)) {
    const minutes = maxMinutesForTask(scope, /nghe[- ]?viết|nhớ[- ]?viết|chính tả/i);
    if (minutes > 0 && minutes < 10) return `phần nghe-viết/chính tả chỉ có ${minutes} phút; nên bố trí 10–13 phút.`;
  }
  if (lessonType === "composition" && /3\s*[-–—]\s*5\s*câu|viết.{0,30}\d+\s*câu|viết đoạn/i.test(text)) {
    const minutes = maxMinutesForTask(scope, /3\s*[-–—]\s*5\s*câu|viết.{0,30}\d+\s*câu|viết đoạn/i);
    if (minutes > 0 && minutes < 13) return `phần viết 3–5 câu chỉ có ${minutes} phút; nên bố trí 13–16 phút.`;
  }
  if (/6\s*câu|sáu\s*câu|dấu chấm|dấu chấm hỏi/i.test(text)) {
    const minutes = maxMinutesForTask(scope, /6\s*câu|sáu\s*câu|dấu chấm|dấu chấm hỏi/i);
    if (minutes > 0 && minutes < 8) return `bài sáu câu/dấu câu chỉ có ${minutes} phút; nên bố trí ít nhất 8–10 phút.`;
  }
  const matchingActivity = scope.activities.find((activity) => /nối.{0,30}(mùa|cột|từ)|ghép.{0,30}(mùa|cột|từ)/i.test(activityText(activity)));
  if (matchingActivity && effectiveActivityMinutes(matchingActivity) > 10) {
    return `bài nối đơn giản đang kéo dài ${effectiveActivityMinutes(matchingActivity)} phút; nên giữ khoảng 6–9 phút để dành thời gian cho nhiệm vụ trọng tâm.`;
  }
  return "";
}

function listedAnswerItemCount(answer: string) {
  const cleaned = answer.replace(/\([^)]*\)/g, " ");
  const numbered = cleaned.match(/(?:^|\s)(?:\d+|[a-f])[\).]/gi) || [];
  const splitItems = cleaned
    .split(/[,;；、\n]|\s+-\s+|\s+\/\s+/)
    .map((part) => part.trim())
    .filter((part) => /[\p{L}\d]/u.test(part) && comparableText(part).length >= 2);
  return Math.max(numbered.length, splitItems.length);
}

function sourceTaskNeedsConcreteAnswer(activity: LessonActivity) {
  const text = activityText(activity);
  if (!/(?:6|sáu)\s+(?:cụm từ|từ|câu)|ch\/tr|c\/k|ac\/at|dấu chấm|dấu chấm hỏi|đồ vật|tên các đồ vật|gọi tên/i.test(text)) {
    return false;
  }
  const answer = [activity.expectedAnswer || "", ...(activity.acceptableResponses || [])].join(" ");
  if (!answer.trim()) return true;
  if (/theo sgk|chốt theo sgk|đối chiếu bằng sgk|đáp án phù hợp|giáo viên tự xác định/i.test(answer)) return true;
  const expectsSix = /(?:6|sáu)\s+(?:cụm từ|từ|câu)/i.test(text);
  return listedAnswerItemCount(answer) < (expectsSix ? 5 : 2);
}

function projectedOnlyDigitalCompetencies(lesson: LessonPlan, scope: Scope) {
  const outcomes = scopeOutcomes(lesson, scope);
  return (outcomes?.digitalCompetencies || []).filter((item) => (
    projectedOnlyDigitalPattern.test(item) && !studentDigitalActionPattern.test(item)
  ));
}

function unlabeledExtensionActivities(scope: Scope) {
  return allActivityLocations(scope).filter(({ activity }) => {
    const text = [
      ...(activity.teacherActions || []),
      ...(activity.studentActions || []),
      ...(activity.extensionForEarlyFinishers || []),
    ].join(" ");
    return extensionTaskPattern.test(text) && !extensionLabelPattern.test(text);
  });
}

type CriteriaProductKind =
  | "spelling"
  | "phonics"
  | "proper-noun"
  | "punctuation"
  | "question-writing"
  | "composition"
  | "storytelling"
  | "reading-fluency"
  | "reading-comprehension"
  | "generic";

function criteriaProductKind(activity: LessonActivity): CriteriaProductKind {
  const text = comparableText(activityText(activity));
  if (/nghe viet|nho viet|chinh ta|doan viet|soat loi/.test(text)) return "spelling";
  if (/ten dia danh|ten rieng|viet hoa ten|dia danh/.test(text)) return "proper-noun";
  if (/(viet|dat|lap).{0,20}cau hoi/.test(text)) return "question-writing";
  if (/dau cham|dau cham hoi|dau cau|sau cau|6 cau|dien dau/.test(text)) return "punctuation";
  if (/ch tr|c k|ac at|am van|dien am|dien van|phan biet am|phan biet van/.test(text)) return "phonics";
  if (/3 5 cau|viet.{0,25}[0-9]+ cau|viet doan|lap y/.test(text)) return "composition";
  if (/ke chuyen|ke lai cau chuyen|tranh truyen|noi va nghe/.test(text)) return "storytelling";
  if (/luyen doc|doc thanh tieng|doc noi tiep|ngat nghi|doc mau|giong doc|toc do doc/.test(text)) return "reading-fluency";
  if (/tra loi|tim chi tiet|y chinh|vi sao|tai sao|doc hieu|cau hoi/.test(text)) return "reading-comprehension";
  return "generic";
}

function criteriaMismatchedToProduct(activity: LessonActivity) {
  const kind = criteriaProductKind(activity);
  if (kind === "generic") return false;
  const criteria = comparableText((activity.successCriteria || []).join(" "));
  if (!criteria) return false;
  if (/co mot bang chung|giai thich tac dung|phan tich tac dung/.test(criteria)) return true;
  if (kind === "spelling") return /bang chung|ngat nghi|doc dung tieng|tra loi dung y/.test(criteria);
  if (kind === "proper-noun") return /ngat nghi|bang chung|doc thanh tieng|viet du so cau/.test(criteria);
  if (kind === "punctuation") return /ngat nghi|bang chung|viet du doan|ke dung trinh tu|noi du y/.test(criteria);
  if (kind === "question-writing") return /ngat nghi|bang chung|viet du doan|dien dung am|ke dung trinh tu/.test(criteria);
  if (kind === "phonics") return /bang chung|ngat nghi|viet du doan|ke dung trinh tu|noi du y/.test(criteria);
  if (kind === "composition") return /ngat nghi|bang chung|dien dung am|doc dung tieng/.test(criteria);
  if (kind === "storytelling") return /ngat nghi|dien dung am|viet du doan|viet hoa dung/.test(criteria);
  if (kind === "reading-fluency") return /dien dung am|viet du doan|dung dau cham|ke dung trinh tu|viet hoa dung/.test(criteria);
  if (kind === "reading-comprehension") return /dien dung am|viet du doan|ngat nghi o cau dai|ke dung trinh tu|viet hoa dung/.test(criteria);
  return false;
}

function missingStoryListeningRounds(scope: Scope, grade: number, lessonType: VietnameseLessonType) {
  if (grade > 3 || lessonType !== "speaking-listening") return false;
  const text = comparableText(scopeText(scope));
  if (!/ke chuyen|tranh truyen|noi va nghe/.test(text)) return false;
  const hasFirstRound = /lan 1|luot 1|lan thu nhat|luot thu nhat/.test(text);
  const hasSecondRound = /lan 2|luot 2|lan thu hai|luot thu hai/.test(text);
  return !(hasFirstRound && hasSecondRound);
}

export function validateVietnameseLesson(lesson: LessonPlan, input: LessonInput): PedagogyAuditFinding[] {
  if (!isVietnameseSubjectName(input.subject || lesson.generalInfo.subject)) return [];

  const findings: PedagogyAuditFinding[] = [];
  const lessonScopes = scopes(lesson);
  const overallClassification = classifyVietnameseLesson(input, classificationText(lesson));
  const grade = gradeNumber(input.grade || lesson.generalInfo.grade);

  const fullText = allLessonText(lesson);
  if (badDotColonPattern.test(fullText)) {
    findings.push(finding(
      vietnameseQualityRules.badDotColonPunctuation,
      "Giáo án có dấu câu sai dạng “.:”; cần sửa thành “:” hoặc dấu câu phù hợp trước khi xuất.",
    ));
  }

  if (unsafeUncertaintyPattern.test(fullText)) {
    findings.push(finding(
      vietnameseQualityRules.unsafeUncertaintyText,
      "Giáo án còn cụm xác minh thô như “cần xác minh”, “OCR chưa rõ”, “kiểm tra lại SGK” hoặc “chốt theo SGK”; cần chuyển thành ghi chú chuẩn bị trung tính và vẫn cho xuất Word.",
    ));
  }

  const repeatedPhrase = repeatedMechanicalPhrase(lesson);
  if (repeatedPhrase) {
    findings.push(finding(
      vietnameseQualityRules.repeatedMechanicalPhrase,
      `Giáo án lặp câu/cụm máy móc “${repeatedPhrase}”; cần viết lại ngắn gọn, theo đúng nhiệm vụ của bài.`,
    ));
  }

  duplicateGeneralCompetencyPeriods(lesson).forEach(({ periodNumber, previousPeriod }) => {
    findings.push(finding(
      vietnameseQualityRules.duplicateGeneralCompetency,
      `Tiết ${periodNumber} có năng lực chung giống hệt tiết ${previousPeriod}; cần cá thể hóa theo trọng tâm tiết.`,
      { periodNumber },
    ));
  });

  unusedDeclaredMaterials(lesson).forEach((material) => {
    findings.push(finding(
      vietnameseQualityRules.unusedDeclaredMaterial,
      `Học liệu “${material}” được khai báo nhưng chưa được sử dụng trong hoạt động nào.`,
    ));
  });

  if (lessonTitleMismatch(input, lesson)) {
    findings.push(finding(
      vietnameseQualityRules.lessonTitleMismatch,
      `Tên bài không thống nhất: form là “${input.lessonTitle}”, giáo án ghi “${lesson.generalInfo.lessonTitle}”.`,
    ));
  }

  outcomeEntries(lesson).forEach(({ category, statement, index, periodNumber }) => {
    if (hasMechanicalOutcomeText(statement)) {
      findings.push(finding(
        vietnameseQualityRules.mechanicalOutcomeWording,
        `${periodNumber ? `Tiết ${periodNumber}: ` : ""}Yêu cầu ${category} ${index + 1} chứa câu máy móc hoặc lỗi dấu câu: “${statement}”.`,
        { periodNumber },
      ));
    }
    if (category === "knowledgeAndSkills" && statement.trim() && !measurableOutcomeVerbPattern.test(statement.trim())) {
      findings.push(finding(
        vietnameseQualityRules.nonMeasurableOutcomeVerb,
        `${periodNumber ? `Tiết ${periodNumber}: ` : ""}Yêu cầu cần đạt ${index + 1} chưa bắt đầu bằng động từ đo được (${measurableOutcomeVerbExamples}): “${statement}”.`,
        { periodNumber },
      ));
    }
  });

  const seenMaterials = new Map<string, { material: string; periodNumber?: number }>();
  const reportedMaterialKeys = new Set<string>();
  lessonScopes.forEach((scope) => {
    specificPeriodMaterials(scope).forEach(({ material, key }) => {
      const previous = seenMaterials.get(key);
      if (previous && previous.periodNumber !== scope.periodNumber && !reportedMaterialKeys.has(key)) {
        findings.push(finding(
          vietnameseQualityRules.repeatedPeriodMaterial,
          `Học liệu/ngữ liệu “${material}” xuất hiện ở nhiều tiết; cần chỉ đặt ở tiết thật sự sử dụng để tránh lẫn học liệu giữa các tiết.`,
          { periodNumber: scope.periodNumber },
        ));
        reportedMaterialKeys.add(key);
      } else if (!previous) {
        seenMaterials.set(key, { material, periodNumber: scope.periodNumber });
      }
    });
  });

  lessonScopes.forEach((scope) => {
    const localClassification = scope.periodNumber
      ? classifyVietnameseLesson(
        { ...input, lessonTitle: scope.focus || "", specialRequest: "" },
        scopeText(scope),
      )
      : overallClassification;
    const classification = localClassification.primaryType !== "mixed" && localClassification.confidence !== "low"
      ? localClassification
      : overallClassification;
    const lessonType = classification.primaryType;
    const label = scopeLabel(scope);

    if (classification.confidence === "low" || lessonType === "mixed") {
      findings.push(finding(
        vietnameseQualityRules.insufficientClassificationEvidence,
        `${label} chưa đủ bằng chứng khóa kiểu bài Tiếng Việt (${lessonType}, độ tin cậy ${classification.confidence}); chỉ áp dụng kiểm tra phổ quát.`,
        { periodNumber: scope.periodNumber },
      ));
    }

    const text = scopeText(scope);
    const concreteText = concreteMaterialText(lesson, scope);
    const durationLimit = Number(input.duration || lesson.generalInfo.duration || 35);
    const totalDuration = scopeDuration(scope);

    if (durationLimit > 0 && totalDuration > durationLimit) {
      findings.push(finding(
        vietnameseQualityRules.durationExceeded,
        `${label} có tổng thời lượng hoạt động ${totalDuration} phút, vượt giới hạn ${durationLimit} phút.`,
        { periodNumber: scope.periodNumber },
      ));
    }

    duplicateActivityDemands(scope).slice(0, 2).forEach(({ previousIndex, activityIndex }) => {
      findings.push(finding(
        vietnameseQualityRules.duplicateActivityDemand,
        `${label} có hoạt động ${activityIndex + 1} gần trùng yêu cầu/sản phẩm với hoạt động ${previousIndex + 1}; cần đổi thành liên hệ, cảm nhận hoặc vận dụng có giá trị mới.`,
        { periodNumber: scope.periodNumber, activityIndex },
      ));
    });

    const differentiation = overusedDifferentiation(scope);
    if (differentiation) {
      findings.push(finding(
        vietnameseQualityRules.overusedDifferentiationTemplate,
        differentiation.templated
          ? `${label} còn dùng mẫu phân hóa máy móc như “ba từ khóa”, “có một bằng chứng” hoặc yêu cầu phân tích tác dụng; cần viết phân hóa theo nhiệm vụ thật.`
          : `${label} phân hóa ở ${differentiation.count} hoạt động; chỉ nên phân hóa 1–2 hoạt động trọng tâm mỗi tiết.`,
        { periodNumber: scope.periodNumber },
      ));
    }

    unlabeledExtensionActivities(scope).slice(0, 2).forEach(({ activity, activityIndex }) => {
      findings.push(finding(
        vietnameseQualityRules.unlabeledExtensionTask,
        `${label}, ${activity.phase || "Hoạt động"} có nhiệm vụ mở rộng/về nhà nhưng chưa ghi nhãn “Hoạt động mở rộng của giáo viên” hoặc “Thực hiện khi còn thời gian”.`,
        { periodNumber: scope.periodNumber, activityId: activity.id, activityIndex },
      ));
    });

    duplicateSpecificCompetenciesInScope(lesson, scope).slice(0, 2).forEach((competency) => {
      findings.push(finding(
        vietnameseQualityRules.duplicateSpecificCompetency,
        `${label} có năng lực đặc thù gần như chép lại kiến thức, kĩ năng: “${competency}”. Cần khái quát năng lực đọc/viết/nói-nghe thay vì lặp bài tập.`,
        { periodNumber: scope.periodNumber },
      ));
    });

    projectedOnlyDigitalCompetencies(lesson, scope).slice(0, 2).forEach((competency) => {
      findings.push(finding(
        vietnameseQualityRules.projectedOnlyDigitalCompetency,
        `${label} có năng lực số chỉ dựa trên việc GV trình chiếu hoặc HS quan sát: “${competency}”. Chỉ giữ năng lực số khi HS trực tiếp thao tác với công cụ/học liệu số.`,
        { periodNumber: scope.periodNumber },
      ));
    });

    if (grade <= 2 && grade2OverAnalysisPattern.test(text)) {
      findings.push(finding(
        vietnameseQualityRules.grade2OverAnalysis,
        `${label} có nhiệm vụ phân tích/nâng cao quá sức lớp ${grade}; nên chuyển thành nói điều hiểu, chọn chi tiết thích hoặc nêu lí do đơn giản.`,
        { periodNumber: scope.periodNumber },
      ));
    }

    if (missingReadingFluencyDetails(scope, grade, lessonType)) {
      findings.push(finding(
        vietnameseQualityRules.missingReadingFluencyDetails,
        `${label} thiếu hướng dẫn luyện đọc cụ thể cho lớp ${grade}: cần câu dài nguyên văn có dấu "/", giọng đọc, tốc độ, tiếng dễ đọc sai và từ cần nhấn.`,
        { periodNumber: scope.periodNumber },
      ));
    }

    if (missingStoryListeningRounds(scope, grade, lessonType)) {
      findings.push(finding(
        vietnameseQualityRules.missingStoryListeningRounds,
        `${label} là tiết kể chuyện/nói-nghe lớp ${grade} nhưng thiếu hai lượt nghe/kể mẫu: lượt 1 nắm nội dung, lượt 2 chú ý trình tự/giọng kể/chi tiết chính.`,
        { periodNumber: scope.periodNumber },
      ));
    }

    const timeMessage = insufficientTypeTimeMessage(scope, grade, lessonType);
    if (timeMessage) {
      findings.push(finding(
        vietnameseQualityRules.insufficientTypeTime,
        `${label} phân bổ thời lượng chưa phù hợp: ${timeMessage}`,
        { periodNumber: scope.periodNumber },
      ));
    }

    unrelatedQualityStatements(lesson, scope).forEach((quality) => {
      findings.push(finding(
        vietnameseQualityRules.unrelatedQuality,
        `${label} có phẩm chất chưa gắn với nội dung/ngữ liệu của bài: “${quality}”.`,
        { periodNumber: scope.periodNumber },
      ));
    });

    unmatchedKnowledgeOutcomes(lesson, scope).slice(0, 3).forEach((statement) => {
      findings.push(finding(
        vietnameseQualityRules.outcomeWithoutActivityEvidence,
        `${label} có YCCĐ chưa thấy hoạt động tương ứng: “${statement}”.`,
        { periodNumber: scope.periodNumber },
      ));
    });

    if (!hasConcreteVietnameseMaterial(concreteText)) {
      findings.push(finding(
        vietnameseQualityRules.missingConcreteMaterial,
        `${label} thiếu ngữ liệu cụ thể: cần ghi văn bản/đoạn/câu/từ/âm-vần/mẫu chữ hoặc mô tả tranh thực sự dùng để học.`,
        { periodNumber: scope.periodNumber },
      ));
    }
    if (/xem sgk|làm bài trong sgk|theo sgk trang/i.test(text) && !hasConcreteVietnameseMaterial(concreteText)) {
      findings.push(finding(
        vietnameseQualityRules.textbookOnlyReference,
        `${label} chỉ tham chiếu SGK mà chưa ghi ngữ liệu và nhiệm vụ cụ thể vào giáo án.`,
        { periodNumber: scope.periodNumber },
      ));
    }

    const passive = passiveActionLocation(scope);
    if (passive) {
      findings.push(finding(
        vietnameseQualityRules.passiveStudentAction,
        `${label} có hành động HS chỉ lắng nghe/quan sát trong khi GV giao nhiệm vụ ngôn ngữ.`,
        { periodNumber: scope.periodNumber, activityId: passive.activity.id, activityIndex: passive.activityIndex },
      ));
    }

    allActivityLocations(scope).forEach(({ activity, activityIndex, periodNumber }) => {
      const location = { periodNumber, activityId: activity.id, activityIndex };
      const phase = activityPhaseKey(activity);
      const currentActivityText = activityText(activity);
      const isTypeFocus = lessonType !== "mixed" && focusSignals[lessonType].test(currentActivityText);
      if (hasTeacherStudentSequenceMismatch(activity)) {
        findings.push(finding(
          vietnameseQualityRules.teacherStudentSequenceMismatch,
          `${label}, ${activity.phase || "Hoạt động"} có cột GV/HS lệch trình tự hoặc số bước không khớp.`,
          location,
        ));
      }
      const productProblem = mainProductProblem(activity);
      if (productProblem) {
        findings.push(finding(
          vietnameseQualityRules.missingMainProduct,
          `${label}, ${activity.phase || "Hoạt động"} ${productProblem}; mỗi hoạt động cần đúng một sản phẩm quan sát được.`,
          location,
        ));
      }
      if (lessonType === "reading" || lessonType === "language-knowledge") {
        const missingTerms = answerTermsOutsideMaterial(activity);
        if (missingTerms.length) {
          findings.push(finding(
            vietnameseQualityRules.answerTermOutsideMaterial,
            `${label}, ${activity.phase || "Hoạt động"} có từ/cụm trong đáp án không thấy trong ngữ liệu hoạt động: ${missingTerms.slice(0, 3).map((term) => `“${term}”`).join(", ")}.`,
            location,
          ));
        }
      }
      if (hasSynonymSemanticMismatch(currentActivityText)) {
        findings.push(finding(
          vietnameseQualityRules.synonymSemanticMismatch,
          `${label}, ${activity.phase || "Hoạt động"} đang gán sai trường nghĩa: “ban mai/sáng sớm/bình minh” là thời gian buổi sáng; “khuân/vác/lôi...” là hoạt động di chuyển, không phải nhóm từ chỉ âm thanh.`,
          location,
        ));
      }
      if (hasMechanicalOutcomeText([activity.objective, ...(activity.successCriteria || [])].join(" "))) {
        findings.push(finding(
          vietnameseQualityRules.mechanicalOutcomeWording,
          `${label}, ${activity.phase || "Hoạt động"} có mục tiêu/tiêu chí chứa câu máy móc hoặc lỗi dấu câu “.:”.`,
          location,
        ));
      }
      const overload = activityAssessmentOverload(activity);
      if (overload.productCount > 1 || overload.criteriaCount > 2) {
        findings.push(finding(
          vietnameseQualityRules.overloadedActivityAssessment,
          `${label}, ${activity.phase || "Hoạt động"} có ${overload.productCount} sản phẩm và ${overload.criteriaCount} tiêu chí; mỗi hoạt động chỉ nên có 1 sản phẩm chính và tối đa 2 tiêu chí ngắn.`,
          location,
        ));
      }
      if (
        classification.confidence !== "low"
        && (phase === "Khám phá" || phase === "Luyện tập")
        && isTypeFocus
        && !hasErrorFeedback(activity)
      ) {
        findings.push(finding(
          vietnameseQualityRules.missingErrorFeedback,
          `${label}, ${activity.phase || "Hoạt động"} chưa nêu lỗi ngôn ngữ thường gặp kèm phản hồi/cách sửa cụ thể.`,
          location,
        ));
      }
      if (expectedResponseNeeded(activity) && !hasExpectedResponse(activity)) {
        findings.push(finding(
          vietnameseQualityRules.missingExpectedResponse,
          `${label}, ${activity.phase || "Hoạt động"} có câu hỏi/nhiệm vụ nhưng thiếu đáp án hoặc phản hồi chấp nhận được dự kiến.`,
          location,
        ));
      }
      if (sourceTaskNeedsConcreteAnswer(activity)) {
        findings.push(finding(
          vietnameseQualityRules.sourceTaskMissingConcreteAnswer,
          `${label}, ${activity.phase || "Hoạt động"} có bài tập cần dữ liệu SGK cụ thể (từ/cụm/câu/dấu câu/đồ vật) nhưng expectedAnswer chưa ghi đủ đáp án kiểm chứng được.`,
          location,
        ));
      }
      if (criteriaMismatchedToProduct(activity)) {
        findings.push(finding(
          vietnameseQualityRules.productCriteriaMismatch,
          `${label}, ${activity.phase || "Hoạt động"} có tiêu chí đánh giá lệch loại sản phẩm; cần dùng tiêu chí riêng cho đọc, chính tả, âm/vần, dấu câu, nói hoặc viết.`,
          location,
        ));
      }
    });

    if (lessonType === "mixed") return;

    const profile = vietnameseLessonTypeProfiles[lessonType];
    const requirements = typeRequirements[lessonType];
    const missing = requirements.filter((requirement) => !requirement.pattern.test(text));
    if (missing.length) {
      findings.push(finding(
        vietnameseQualityRules.missingTypeSequence,
        `${label} kiểu “${profile.label}” thiếu các mắt xích: ${missing.map((item) => item.description).join("; ")}.`,
        { periodNumber: scope.periodNumber },
      ));
    }

    const products = scope.activities.flatMap((activity) => activity.learningProducts || []).join(" ");
    if (!productSignals[lessonType].test(products)) {
      findings.push(finding(
        vietnameseQualityRules.missingTypeProduct,
        `${label} chưa có sản phẩm đặc trưng của kiểu “${profile.label}”.`,
        { periodNumber: scope.periodNumber },
      ));
    }

    const criteria = [
      ...lesson.assessment.criteria,
      ...scope.activities.flatMap((activity) => activity.successCriteria || []),
    ].join(" ");
    if (!criteriaSignals[lessonType].test(criteria)) {
      findings.push(finding(
        vietnameseQualityRules.missingTypeCriteria,
        `${label} chưa có tiêu chí đánh giá đặc trưng, quan sát được cho kiểu “${profile.label}”.`,
        { periodNumber: scope.periodNumber },
      ));
    }

    if (lessonType === "speaking-listening" && !listenerTaskPresent(text)) {
      findings.push(finding(
        vietnameseQualityRules.missingListenerTask,
        `${label} bài nói-nghe thiếu nhiệm vụ thật cho người nghe: ghi chú, hỏi lại, nhận xét hoặc phản hồi.`,
        { periodNumber: scope.periodNumber },
      ));
    }

    const mismatch = gradeMismatchMessage(lessonType, grade, text);
    if (mismatch) {
      findings.push(finding(vietnameseQualityRules.gradeMismatch, `${label}: ${mismatch}`, { periodNumber: scope.periodNumber }));
    }

    const unrelatedCount = unrelatedSignals[lessonType].filter((pattern) => pattern.test(text)).length;
    if (unrelatedCount >= 2) {
      findings.push(finding(
        vietnameseQualityRules.unrelatedSkillOverload,
        `${label} đang nhồi ${unrelatedCount} nhóm kĩ năng không bắt buộc cho kiểu “${profile.label}”; cần giữ trọng tâm.`,
        { periodNumber: scope.periodNumber },
      ));
    }

    const hasDialogueScript = scope.activities.some((activity) =>
      /gv\s*[:：]|giáo viên\s*[:：]|hs\s*[:：]|học sinh\s*[:：]/i.test(activity.expectedAnswer || "")
    );
    if (hasDialogueScript) {
      findings.push(finding(
        vietnameseQualityRules.dialogueScripting,
        `${label} có đáp án viết kịch bản hội thoại mẫu bắt GV/HS nói theo khuôn; chỉ nên ghi ý cốt lõi.`,
        { periodNumber: scope.periodNumber }
      ));
    }

    const hometown = input.hometownProvince && input.hometownProvince !== "auto";
    const hasAssumedLocality = /\b(Hà Nội|Hồ Chí Minh|Sài Gòn|Cần Thơ|Đà Nẵng|Huế|Hải Phòng|Nha Trang|Đà Lạt|Hà Tây|Nghệ An|vùng núi|vùng biển|đồng bằng|sĩ số|học sinh khá|học sinh giỏi|học sinh yếu)\b/i.test(text);
    if (!hometown && hasAssumedLocality) {
      findings.push(finding(
        vietnameseQualityRules.assumedContext,
        `${label} tự ý chèn đặc điểm địa phương/vùng miền/sĩ số/trình độ học sinh khi chưa được cung cấp.`,
        { periodNumber: scope.periodNumber }
      ));
    }

    const isReview = /trả bài|chỉnh sửa bài|sửa bài viết|critique|review/i.test(scope.focus || lesson.generalInfo.lessonTitle || "");
    if (isReview && !/\[\.\.\.\]|ô chờ|bảng trống|để trống/i.test(text)) {
      findings.push(finding(
        vietnameseQualityRules.missingCompositionPlaceholders,
        `${label} là tiết trả bài/chỉnh sửa nhưng thiếu ô chờ [...] hoặc bảng trống để điền lỗi thật.`,
        { periodNumber: scope.periodNumber }
      ));
    }
  });

  const outcomesCount = lesson.outcomes?.knowledgeAndSkills?.length || 0;
  if (outcomesCount > 0 && (outcomesCount < 4 || outcomesCount > 6)) {
    findings.push(finding(
      vietnameseQualityRules.outcomeCountMismatch,
      `Mỗi tiết Tiếng Việt tiểu học chỉ xác định 4–6 yêu cầu cần đạt (hiện có ${outcomesCount} yêu cầu).`,
    ));
  }

  if (lesson.periodPlans?.length) {
    lesson.periodPlans.forEach((p) => {
      const pCount = p.outcomes?.knowledgeAndSkills?.length || 0;
      if (pCount > 0 && (pCount < 4 || pCount > 6)) {
        findings.push(finding(
          vietnameseQualityRules.outcomeCountMismatch,
          `Tiết ${p.periodNumber}: chỉ xác định 4–6 yêu cầu cần đạt (hiện có ${pCount} yêu cầu).`,
          { periodNumber: p.periodNumber }
        ));
      }
    });
  }

  const seen = new Set<string>();
  return findings.filter((item) => {
    const key = `${item.code}|${item.periodNumber ?? 0}|${item.activityId ?? item.activityIndex ?? -1}|${item.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
