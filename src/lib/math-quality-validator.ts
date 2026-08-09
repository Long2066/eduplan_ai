import { activityPhaseKey } from "@/lib/lesson-format";
import { validateMathContent } from "@/lib/math-content";
import type { LessonActivity, LessonInput, LessonPlan, PedagogyAuditFinding, PedagogyAuditSourceEvidence } from "@/types/lesson";

type MathRule = { code: string; severity: PedagogyAuditFinding["severity"]; autoFixable: boolean };
type Scope = { periodNumber?: number; focus?: string; activities: LessonActivity[] };
type ActivityLocation = { activity: LessonActivity; activityIndex: number; periodNumber?: number };

export const mathQualityRules = {
  missingConcreteMath: { code: "MATH-QUALITY-01", severity: "error", autoFixable: false },
  invalidMathNotation: { code: "MATH-QUALITY-02", severity: "error", autoFixable: true },
  missingExpectedAnswer: { code: "MATH-QUALITY-03", severity: "warning", autoFixable: true },
  missingRepresentation: { code: "MATH-QUALITY-04", severity: "warning", autoFixable: true },
  missingRelationReasoning: { code: "MATH-QUALITY-05", severity: "warning", autoFixable: true },
  missingErrorFeedback: { code: "MATH-QUALITY-06", severity: "warning", autoFixable: true },
  missingCheckOrUnit: { code: "MATH-QUALITY-07", severity: "warning", autoFixable: true },
  missingMathProduct: { code: "MATH-QUALITY-08", severity: "warning", autoFixable: true },
  missingMathCriteria: { code: "MATH-QUALITY-09", severity: "warning", autoFixable: true },
  missingDifferentiation: { code: "MATH-QUALITY-10", severity: "suggestion", autoFixable: true },
  unrealisticApplication: { code: "MATH-QUALITY-11", severity: "warning", autoFixable: true },
  gradeMismatch: { code: "MATH-QUALITY-12", severity: "warning", autoFixable: true },
  answerMismatch: { code: "MATH-QUALITY-13", severity: "error", autoFixable: true },
  startupLeaksCoreProblem: { code: "MATH-QUALITY-14", severity: "warning", autoFixable: true },
  prematureFormula: { code: "MATH-QUALITY-15", severity: "warning", autoFixable: true },
  sourceVerificationUnavailable: { code: "MATH-QUALITY-16", severity: "suggestion", autoFixable: false },
} as const satisfies Record<string, MathRule>;

const visualPattern = /sơ đồ|tóm tắt|bảng|hình vẽ|que tính|mô hình|thẻ số|thẻ dữ kiện|trục số|phần bằng nhau|vật thật|khối lập phương|đồng hồ|thước/i;
const concreteMathPattern = /\\\([^)]*(?:\d|[a-z])[+\-×÷=*<>\\][^)]*\\\)|\\\[[^\]]*(?:\d|[a-z])[+\-×÷=*<>\\][^\]]*\\\]|\d+\s*(?:[+×÷=<>]|[−–—-])\s*\d+|(?:S|P|V|C|A)\s*=|công thức\s*[:：]|đáp (?:số|án)\s*[:：]|dữ kiện\s*[:：]|bài toán\s*[:：]|hình (?:vuông|chữ nhật|tam giác|tròn).{0,40}\d/iu;
const relationPattern = /dữ kiện|đề bài cho|yêu cầu tìm|câu hỏi cần tìm|quan hệ|lớn hơn|bé hơn|nhiều hơn|ít hơn|gấp|kém|tổng|hiệu|tỉ số|số phần|vì sao|lý do chọn|chọn phép tính/i;
const checkPattern = /kiểm tra ngược|thử lại|đối chiếu.{0,35}(dữ kiện|đề bài|kết quả)|thay.{0,20}(kết quả|đáp số).{0,20}(vào|lại)|ước lượng|hợp lý/i;
const unitPattern = /(?:^|[\s(,;:])(?:mm|cm|dm|m|km|g|kg|tấn|ml|lít|giây|phút|giờ|đồng|cm2|cm²|m2|m²|cm3|cm³|m3|m³)(?=$|[\s).,;:])/i;
const questionPattern = /tính|đặt tính|giải bài|bài toán|tìm|so sánh|điền|đo|vẽ|lập|câu hỏi|yêu cầu|hãy|bao nhiêu|mấy/i;
const mathProductPattern = /phép tính|biểu thức|bài giải|đáp số|kết quả|sơ đồ|bảng|hình vẽ|câu trả lời|cách giải|phiếu|sản phẩm đo|mô hình/i;
const mathCriteriaPattern = /tính đúng|đặt tính đúng|chọn đúng phép tính|giải thích được|nêu được.{0,25}(lý do|cách làm)|tóm tắt được|vẽ đúng|đo đúng|đúng đơn vị|kiểm tra được|vận dụng được|xác định đúng.{0,25}(dữ kiện|yêu cầu|quan hệ)/i;
const supportPattern = /hỗ trợ|gợi mở|gợi ý|sơ đồ khuyết|bài số nhỏ|câu hỏi từng bước|thẻ phần|HS cần hỗ trợ/i;
const extensionPattern = /mở rộng|thử thách|nâng cao|cách khác|tự đặt đề|HS hoàn thành sớm|HS khá/i;
const realContextPattern = /đời sống|thực tế|gia đình|lớp học|trường|mua|bán|quãng đường|thời gian|cây|vườn|sân|địa phương|hằng ngày|ở nhà|tiền|đo chiều dài|diện tích/i;

function finding(rule: MathRule, message: string, location: Partial<PedagogyAuditFinding> = {}): PedagogyAuditFinding { return { code: rule.code, severity: rule.severity, autoFixable: rule.autoFixable, message, ...location } }
function isMathSubject(subject: string) { return /^(toán|toan)$/i.test(String(subject || "").trim()) }
function scopes(lesson: LessonPlan): Scope[] { if (lesson.periodPlans?.length) return lesson.periodPlans.map((period) => ({ periodNumber: period.periodNumber, focus: period.focus, activities: period.activities || [] })); return [{ focus: lesson.generalInfo.lessonTitle, activities: lesson.activities || [] }] }
function locations(scope: Scope): ActivityLocation[] { return scope.activities.map((activity, activityIndex) => ({ activity, activityIndex, periodNumber: scope.periodNumber })) }
function activityText(activity: LessonActivity) { return [activity.phase, activity.title, activity.objective, ...(activity.inputOrMaterials || []), ...(activity.teacherActions || []), ...(activity.studentActions || []), ...(activity.learningProducts || []), ...(activity.successCriteria || []), activity.expectedAnswer || "", ...(activity.acceptableResponses || []), ...(activity.commonErrors || []), ...(activity.teacherFeedback || []), ...(activity.errorFeedback || []).flatMap((item) => [item.error, ...item.feedback]), ...(activity.supportForStudentsNeedingHelp || []), ...(activity.extensionForEarlyFinishers || [])].join(" ") }
function instructionText(activity: LessonActivity) { return [activity.phase, activity.title, activity.objective, ...(activity.inputOrMaterials || []), ...(activity.teacherActions || []), ...(activity.studentActions || [])].join(" ") }
function scopeText(scope: Scope) { return [scope.focus || "", ...scope.activities.map(activityText)].join(" ") }
function scopeLabel(scope: Scope) { return scope.periodNumber ? `Tiết ${scope.periodNumber}` : "Giáo án" }
function hasExpectedAnswer(activity: LessonActivity) {
  if (activity.expectedAnswer?.trim() || activity.acceptableResponses?.some((item) => item.trim())) return true;
  const explicitAnswerText = [...(activity.inputOrMaterials || []), ...(activity.teacherActions || []), ...(activity.studentActions || [])].join(" ");
  return /(?:đáp án|đáp số|lời giải|kết quả dự kiến)\s*[:：]/i.test(explicitAnswerText);
}
function hasErrorAndFeedback(activity: LessonActivity) { const text = activityText(activity); const hasError = Boolean(activity.commonErrors?.some((item) => item.trim())) || /lỗi sai|sai thường gặp|dễ nhầm|nếu hs (sai|nhầm)|nhầm/i.test(text); const hasFeedback = Boolean(activity.teacherFeedback?.some((item) => item.trim())) || Boolean(activity.errorFeedback?.some((item) => item.error.trim() && item.feedback.some((value) => value.trim()))) || /sửa lỗi|gợi hỏi|gợi ý|đối chiếu|hướng dẫn.{0,30}(sửa|thử lại)|phản hồi/i.test(text); return hasError && hasFeedback }
function gradeNumber(value: string) { const match = String(value).match(/([1-5])/); return match ? Number(match[1]) : 0 }
function gradeMismatchMessage(grade: number, text: string) { if (!grade) return ""; if (grade <= 2 && /tỉ số phần trăm|phân số|số thập phân|diện tích (hình|tam giác)|thể tích|vận tốc|chuyển động đều|ẩn số|phương trình/i.test(text)) return "Nội dung phân số/số thập phân/tỉ số phần trăm/diện tích-thể tích/chuyển động hoặc phương trình vượt mức điển hình lớp 1–2."; if (grade === 3 && /tỉ số phần trăm|số thập phân|thể tích|vận tốc|chuyển động đều|phương trình/i.test(text)) return "Nội dung tỉ số phần trăm/số thập phân/thể tích/chuyển động hoặc phương trình vượt mức điển hình lớp 3."; if (grade <= 3 && /chứng minh|suy luận đại số|biến số/i.test(text)) return "Yêu cầu chứng minh hoặc suy luận đại số vượt mức diễn đạt điển hình của khối lớp."; return "" }
function answerMismatchMessage(activity: LessonActivity) {
  const pattern = /(-?\d+(?:[.,]\d+)?)\s*([+×÷]|[−–—-])\s*(-?\d+(?:[.,]\d+)?)\s*=\s*(-?\d+(?:[.,]\d+)?)/g;
  for (const match of activityText(activity).matchAll(pattern)) {
    const left = Number(match[1].replace(",", "."));
    const right = Number(match[3].replace(",", "."));
    const stated = Number(match[4].replace(",", "."));
    const computed = match[2] === "+" ? left + right : /[−–—-]/.test(match[2]) ? left - right : match[2] === "×" ? left * right : right !== 0 ? left / right : Number.NaN;
    if (Number.isFinite(computed) && Math.abs(stated - computed) > 1e-9) {
      return `Đẳng thức ${match[0]} sai; kết quả đúng của phép tính là ${computed}.`;
    }
  }
  return "";
}
function mathTextEntries(activity: LessonActivity): Array<[string, string]> { return [["mục tiêu", activity.objective] as [string, string], ...(activity.inputOrMaterials || []).map((value, index): [string, string] => [`ngữ liệu ${index + 1}`, value]), ...(activity.teacherActions || []).map((value, index): [string, string] => [`GV bước ${index + 1}`, value]), ...(activity.studentActions || []).map((value, index): [string, string] => [`HS bước ${index + 1}`, value]), ...(activity.learningProducts || []).map((value, index): [string, string] => [`sản phẩm ${index + 1}`, value]), ...(activity.successCriteria || []).map((value, index): [string, string] => [`tiêu chí ${index + 1}`, value]), ...(activity.expectedAnswer ? [["đáp án dự kiến", activity.expectedAnswer] as [string, string]] : []), ...(activity.acceptableResponses || []).map((value, index): [string, string] => [`phản hồi ${index + 1}`, value])].filter(([, value]) => Boolean(value?.trim())) }
function sourceEvidence(input: LessonInput): PedagogyAuditSourceEvidence[] { if (!input.uploadedAssets?.length) return [{ sourceType: "textbook", verificationStatus: "unavailable" }]; return input.uploadedAssets.map((asset) => ({ sourceType: asset.type === "image" ? "uploaded_image" : asset.type === "pdf" ? "uploaded_pdf" : "user_input", reference: asset.name, verificationStatus: asset.dataUrl || asset.previewUrl ? "uncertain" : "unavailable" })) }

export function validateMathLesson(lesson: LessonPlan, input: LessonInput): PedagogyAuditFinding[] {
  if (!isMathSubject(input.subject || lesson.generalInfo.subject)) return [];
  const findings: PedagogyAuditFinding[] = []; const grade = gradeNumber(input.grade || lesson.generalInfo.grade);
  scopes(lesson).forEach((scope) => {
    const label = scopeLabel(scope); const text = scopeText(scope); const teachingText = scope.activities.map(instructionText).join(" "); const activityLocations = locations(scope);
    if (!concreteMathPattern.test(text)) findings.push(finding(mathQualityRules.missingConcreteMath, `${label} thiếu nội dung toán cụ thể: cần ghi rõ dữ kiện, phép tính, biểu thức, công thức, bài giải mẫu hoặc đáp án dự kiến thay vì chỉ “HS làm bài”.`, { periodNumber: scope.periodNumber }));
    if (!visualPattern.test(teachingText)) findings.push(finding(mathQualityRules.missingRepresentation, `${label} thiếu biểu diễn trực quan phù hợp như vật thật, que tính, trục số, bảng, sơ đồ, hình vẽ hoặc mô hình.`, { periodNumber: scope.periodNumber }));
    if (!relationPattern.test(teachingText)) findings.push(finding(mathQualityRules.missingRelationReasoning, `${label} thiếu phân tích dữ kiện, yêu cầu, quan hệ toán học hoặc lý do chọn phép tính/quy trình.`, { periodNumber: scope.periodNumber }));
    if (!supportPattern.test(text) || !extensionPattern.test(text)) findings.push(finding(mathQualityRules.missingDifferentiation, `${label} chưa đủ phân hóa Toán: cần có hỗ trợ từng bước cho HS cần giúp và nhiệm vụ mở rộng cho HS hoàn thành sớm.`, { periodNumber: scope.periodNumber }));
    const criteria = [...lesson.assessment.criteria, ...scope.activities.flatMap((activity) => activity.successCriteria || [])].join(" ");
    if (!mathCriteriaPattern.test(criteria)) findings.push(finding(mathQualityRules.missingMathCriteria, `${label} thiếu tiêu chí Toán quan sát được về dữ kiện/biểu diễn/phép tính/giải thích/đơn vị hoặc kiểm tra kết quả.`, { periodNumber: scope.periodNumber }));
    const mismatch = gradeMismatchMessage(grade, text); if (mismatch) findings.push(finding(mathQualityRules.gradeMismatch, `${label}: ${mismatch}`, { periodNumber: scope.periodNumber }));
    const application = activityLocations.find(({ activity }) => activityPhaseKey(activity) === "Vận dụng");
    if (application && !realContextPattern.test(activityText(application.activity))) findings.push(finding(mathQualityRules.unrealisticApplication, `${label}, Vận dụng chưa gắn với tình huống đời sống hoặc thực tế có ý nghĩa.`, { periodNumber: scope.periodNumber, activityId: application.activity.id, activityIndex: application.activityIndex }));
    const startup = activityLocations.find(({ activity }) => activityPhaseKey(activity) === "Khởi động"); const explore = activityLocations.find(({ activity }) => activityPhaseKey(activity) === "Khám phá");
    if (startup && explore) {
      const startupInstruction = instructionText(startup.activity);
      const exploreInstruction = instructionText(explore.activity);
      const startupNumbers: string[] = startupInstruction.match(/\d{2,}/g) || [];
      const exploreNumbers: string[] = exploreInstruction.match(/\d{2,}/g) || [];
      const overlap: string[] = [...new Set(startupNumbers.filter((number) => exploreNumbers.includes(number)))];
      if (overlap.length >= 2) findings.push(finding(mathQualityRules.startupLeaksCoreProblem, `${label}, Khởi động trùng nhiều số liệu (${overlap.join(", ")}) với Khám phá và có nguy cơ giải trước bài chính.`, { periodNumber: scope.periodNumber, activityId: startup.activity.id, activityIndex: startup.activityIndex }));
      if (/công thức|(?:S|P|V|C)\s*=/.test(startupInstruction) && !visualPattern.test(startupInstruction)) findings.push(finding(mathQualityRules.prematureFormula, `${label}, Khởi động đưa công thức trước khi HS thao tác hoặc hiểu biểu diễn/quan hệ toán học.`, { periodNumber: scope.periodNumber, activityId: startup.activity.id, activityIndex: startup.activityIndex }));
    }
    activityLocations.forEach(({ activity, activityIndex, periodNumber }) => {
      const location = { periodNumber, activityId: activity.id, activityIndex }; const activityContent = activityText(activity); const phase = activityPhaseKey(activity);
      mathTextEntries(activity).forEach(([entryLabel, value]) => { const issues = validateMathContent(value, { requireDelimitedFormulas: true }); if (issues.length) findings.push(finding(mathQualityRules.invalidMathNotation, `${label}, ${activity.phase || "Hoạt động"} – ${entryLabel}: ${issues.map((issue) => issue.message).join("; ")}`, location)) });
      if ((phase === "Khám phá" || phase === "Luyện tập" || phase === "Vận dụng") && questionPattern.test(activityContent) && !hasExpectedAnswer(activity)) findings.push(finding(mathQualityRules.missingExpectedAnswer, `${label}, ${activity.phase || "Hoạt động"} có bài tập/nhiệm vụ Toán nhưng thiếu đáp án, đáp số hoặc hướng giải dự kiến.`, location));
      if ((phase === "Khám phá" || phase === "Luyện tập") && concreteMathPattern.test(activityContent) && !hasErrorAndFeedback(activity)) findings.push(finding(mathQualityRules.missingErrorFeedback, `${label}, ${activity.phase || "Hoạt động"} chưa nêu lỗi sai/nhầm lẫn Toán thường gặp kèm cách gợi mở hoặc sửa.`, location));
      if ((phase === "Khám phá" || phase === "Luyện tập") && questionPattern.test(activityContent) && !checkPattern.test(instructionText(activity)) && !unitPattern.test(activityContent)) findings.push(finding(mathQualityRules.missingCheckOrUnit, `${label}, ${activity.phase || "Hoạt động"} thiếu bước kiểm tra/đối chiếu kết quả; nếu có đại lượng cần ghi và kiểm tra đơn vị.`, location));
      const products = (activity.learningProducts || []).join(" "); if ((phase === "Khám phá" || phase === "Luyện tập" || phase === "Vận dụng") && questionPattern.test(activityContent) && !mathProductPattern.test(products)) findings.push(finding(mathQualityRules.missingMathProduct, `${label}, ${activity.phase || "Hoạt động"} chưa có sản phẩm Toán cụ thể khớp nhiệm vụ (phép tính, bài giải, sơ đồ, hình vẽ, kết quả hoặc cách giải).`, location));
      const answerMismatch = answerMismatchMessage(activity); if (answerMismatch) findings.push(finding(mathQualityRules.answerMismatch, `${label}, ${activity.phase || "Hoạt động"}: ${answerMismatch}`, location));
    });
  });
  if (/sgk|sách giáo khoa|ảnh bài|theo bài|trang\s*\d+/i.test(JSON.stringify(lesson)) && !input.uploadedAssets?.length) findings.push(finding(mathQualityRules.sourceVerificationUnavailable, "Giáo án tham chiếu SGK/ảnh bài nhưng không có ảnh, PDF hoặc OCR đủ tin cậy; chưa thể kết luận dữ kiện hay đáp án có khớp nguồn.", { sources: sourceEvidence(input) }));
  const seen = new Set<string>(); return findings.filter((item) => { const key = `${item.code}|${item.periodNumber ?? 0}|${item.activityId ?? item.activityIndex ?? -1}|${item.message}`; if (seen.has(key)) return false; seen.add(key); return true });
}
