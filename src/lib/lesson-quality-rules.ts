import type { PedagogyAuditFinding } from "@/types/lesson";

export type LessonQualityRule = {
  code: string;
  severity: PedagogyAuditFinding["severity"];
  autoFixable: boolean;
  description: string;
};

export const observableOutcomeVerbPattern = /(đọc|viết|nêu|trả lời|tìm|xác định|quan sát|ghi lại|phân loại|điền|sửa|trao đổi|vận dụng|trình bày|giải thích|so sánh|mô tả|thực hiện|chăm sóc|bảo vệ|lựa chọn|tính|giải|lập|vẽ|nhận biết|chỉ ra|kể|phân tích|đánh giá|tạo|hoàn thành|ngắt nghỉ)\s+(được|đúng|rõ ràng|phù hợp)?/i;

export const genericOutcomePatterns: RegExp[] = [
  /hoàn thành yêu cầu học tập trọng tâm/i,
  /sử dụng kiến thức,?\s*kĩ năng đặc thù để hoàn thành nhiệm vụ/i,
  /thực hiện được qua câu trả lời hoặc sản phẩm phù hợp/i,
  /phát triển toàn diện năng lực và phẩm chất/i,
  /hoàn thành mục tiêu( học tập)?/i,
];

export const genericActivityPatterns: RegExp[] = [
  /gv tổ chức hoạt động bám ngữ liệu và trọng tâm/i,
  /gv giao nhiệm vụ cụ thể/i,
  /hs quan sát,?\s*đọc,?\s*nghe ngữ liệu/i,
  /hs thực hiện nhiệm vụ và tạo sản phẩm/i,
  /gv hỗ trợ học sinh theo lỗi thường gặp/i,
  /hs thực hiện nhiệm vụ theo hướng dẫn/i,
  /hs thực hiện nhiệm vụ tương ứng/i,
  /hs phản hồi theo hướng dẫn/i,
];

export const stigmatizingStudentLabelPattern = /\b(học sinh|hs)\s+yếu\b/i;

export const lessonQualityRules = {
  genericOutcome: { code: "LQ-OUTCOME-01", severity: "error", autoFixable: true, description: "Yêu cầu cần đạt chứa câu chung chung bị cấm." },
  unobservableOutcome: { code: "LQ-OUTCOME-02", severity: "warning", autoFixable: true, description: "Yêu cầu cần đạt chưa dùng động từ quan sát, đánh giá được." },
  missingOutcomeEvidence: { code: "LQ-LINK-01", severity: "warning", autoFixable: true, description: "Mục tiêu chưa liên kết đủ hoạt động, sản phẩm và tiêu chí." },
  missingActivityObjective: { code: "LQ-ACTIVITY-01", severity: "error", autoFixable: true, description: "Hoạt động thiếu mục tiêu cụ thể." },
  genericActivity: { code: "LQ-ACTIVITY-02", severity: "error", autoFixable: true, description: "Hoạt động chứa câu mẫu rỗng hoặc không nêu nhiệm vụ cụ thể." },
  missingProduct: { code: "LQ-PRODUCT-01", severity: "error", autoFixable: true, description: "Hoạt động thiếu sản phẩm học tập cụ thể." },
  missingSuccessCriteria: { code: "LQ-ASSESS-01", severity: "warning", autoFixable: true, description: "Sản phẩm chưa có tiêu chí thành công quan sát được." },
  missingSupport: { code: "LQ-DIFF-01", severity: "suggestion", autoFixable: true, description: "Hoạt động trọng tâm chưa có hỗ trợ cho học sinh cần trợ giúp." },
  missingExtension: { code: "LQ-DIFF-02", severity: "suggestion", autoFixable: true, description: "Hoạt động trọng tâm chưa có mở rộng cho học sinh hoàn thành sớm." },
  stigmatizingLabel: { code: "LQ-DIFF-03", severity: "error", autoFixable: true, description: "Giáo án dùng nhãn không phù hợp đối với học sinh." },
} as const satisfies Record<string, LessonQualityRule>;
