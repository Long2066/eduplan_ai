export const lessonPhaseOrder = ["Khởi động", "Khám phá", "Luyện tập", "Vận dụng"] as const;

export type LessonPhase = (typeof lessonPhaseOrder)[number];

export type PhaseIssuePolicy = "fatal_structure" | "repairable_pedagogy";

export type PhaseQualityStandard = {
  phase: LessonPhase;
  role: string;
  successDefinition: string;
  requiredSignals: string[];
  acceptableEvidence: string[];
  antiPatterns: string[];
  issuePolicy: PhaseIssuePolicy;
  repairGuidance: string;
};

export const phaseStructuralFatalSignals = [
  "Sai môn học hoặc nội dung lệch hẳn khỏi OCR/nguồn đầu vào.",
  "Thiếu số tiết, thiếu pha bắt buộc hoặc cấu trúc tiết rỗng.",
  "Không có hoạt động học tập quan sát được của học sinh.",
  "JSON hỏng, cấu trúc rỗng hoặc không thể dựng giáo án.",
  "Nội dung nguy hiểm rõ ràng hoặc nhiệm vụ/đáp án/hình/trang bắt buộc bị thiếu sai nghiêm trọng.",
] as const;

export const phaseRepairablePedagogySignals = [
  "Pha đúng cấu trúc nhưng còn thiếu chiều sâu sư phạm.",
  "Khám phá chưa đủ sáng tạo hoặc còn lặp mô típ giữa các tiết.",
  "Luyện tập chưa bám thật sát kiến thức/kĩ năng vừa hình thành.",
  "Vận dụng còn chung chung, chưa biến kiến thức thành hành động/sản phẩm gần đời sống.",
  "Coverage chưa đủ mượt nhưng giáo viên còn có thể sửa tay mà không phá cấu trúc bài.",
] as const;

export const phaseQualityStandards: Record<LessonPhase, PhaseQualityStandard> = {
  "Khởi động": {
    phase: "Khởi động",
    role: "Gợi động cơ học tập, kích hoạt trải nghiệm hoặc kiến thức nền, tạo cầu nối tự nhiên vào nhiệm vụ chính.",
    successDefinition: "Học sinh có lí do muốn học bài mới và sẵn sàng bước vào Khám phá, nhưng chưa bị lộ luôn kết luận/đáp án trọng tâm.",
    requiredSignals: [
      "Có tình huống, câu hỏi, trò chơi ngắn, vật thật, tranh/âm thanh/video ngắn hoặc trải nghiệm gần gũi.",
      "Liên hệ rõ với mục tiêu bài học hoặc vấn đề sẽ khám phá.",
      "Có phản ứng/hành động cụ thể của học sinh, không chỉ nghe giới thiệu.",
      "Kết thúc bằng câu nối vào nhiệm vụ Khám phá.",
    ],
    acceptableEvidence: [
      "Câu trả lời nhanh, dự đoán ban đầu, lựa chọn có lí do, chia sẻ kinh nghiệm, thẻ ý tưởng hoặc câu hỏi muốn tìm hiểu.",
    ],
    antiPatterns: [
      "GV giới thiệu bài một chiều.",
      "Ôn bài cũ dài làm mất vai trò dẫn nhập.",
      "Dùng đúng bài tập/tranh trọng tâm và nói trước kết luận của Khám phá.",
    ],
    issuePolicy: "repairable_pedagogy",
    repairGuidance: "Rút gọn, đổi thành tình huống kích hoạt và nối rõ sang vấn đề học sinh sẽ tự tìm hiểu.",
  },
  "Khám phá": {
    phase: "Khám phá",
    role: "Tổ chức để học sinh hình thành kiến thức/kĩ năng mới thông qua quan sát, thao tác, đọc nguồn, thử nghiệm, điều tra hoặc giải quyết vấn đề.",
    successDefinition: "Học sinh tự tìm ra hoặc cùng kiến tạo điểm mới của bài từ bằng chứng/nhiệm vụ cụ thể, rồi được GV chốt hóa chính xác.",
    requiredSignals: [
      "Có vấn đề/câu hỏi khám phá gắn trực tiếp với YCCĐ.",
      "Có nguồn/bằng chứng/học liệu rõ: OCR, tranh SGK, văn bản, bài toán, vật thật, dữ liệu, bản đồ, thí nghiệm hoặc tình huống.",
      "Học sinh phải thao tác, quan sát, đọc, phân tích, thử, so sánh, phân loại, phỏng vấn hoặc tạo dữ kiện.",
      "Có dự kiến câu trả lời đúng/sai thường gặp và cách GV gợi mở sửa sai.",
      "Có lời chốt hình thành kiến thức/kĩ năng mới.",
    ],
    acceptableEvidence: [
      "Phiếu/bảng quan sát, mô hình, phép giải mẫu, kết luận nhóm, thẻ bằng chứng, dòng thời gian, bản đồ ý, đoạn đọc có căn cứ hoặc sản phẩm khám phá.",
    ],
    antiPatterns: [
      "Chỉ cho HS đọc SGK rồi GV giảng lại.",
      "Chỉ phát phiếu/thẻ lặp lại giữa các tiết mà không có phát hiện mới.",
      "Hoạt động vui nhưng không dẫn tới kiến thức/kĩ năng của mục tiêu.",
      "Đổi tên thành Khám phá nhưng bản chất là luyện bài đã biết.",
    ],
    issuePolicy: "repairable_pedagogy",
    repairGuidance: "Viết lại như một chuỗi điều tra/phát hiện: vấn đề, nguồn chứng cứ, thao tác HS, sản phẩm, sửa sai, chốt kiến thức.",
  },
  "Luyện tập": {
    phase: "Luyện tập",
    role: "Củng cố và rèn chính kiến thức/kĩ năng vừa được hình thành ở Khám phá qua nhiệm vụ có tiêu chí và phản hồi.",
    successDefinition: "Học sinh thực hành đúng trọng tâm mới học, nhận phản hồi để sửa lỗi, tăng độ chắc và độ độc lập.",
    requiredSignals: [
      "Nhiệm vụ luyện tập bám trực tiếp vào kết luận/kĩ năng vừa chốt.",
      "Có bài tập, lượt thực hành, tình huống quen thuộc hoặc sản phẩm luyện tập cụ thể.",
      "Có đáp án/cách làm/dự kiến sản phẩm để GV kiểm chứng.",
      "Có lỗi thường gặp hoặc tiêu chí phản hồi giúp học sinh sửa.",
      "Mức độ có thể tăng dần hoặc có phân hóa vừa phải.",
    ],
    acceptableEvidence: [
      "Bài làm, câu trả lời có căn cứ, bảng phân loại, đoạn viết/nói, thao tác thực hành, kết quả tính toán, sản phẩm chỉnh sửa sau góp ý.",
    ],
    antiPatterns: [
      "Luyện tập nhưng lại dạy kiến thức mới chưa được Khám phá.",
      "Chỉ yêu cầu thảo luận chung không có sản phẩm kiểm tra được.",
      "Bài tập lệch khỏi mục tiêu hoặc quá tải so với thời lượng.",
    ],
    issuePolicy: "repairable_pedagogy",
    repairGuidance: "Neo nhiệm vụ vào kiến thức vừa chốt, thêm sản phẩm, đáp án/tiêu chí và phản hồi sửa lỗi.",
  },
  "Vận dụng": {
    phase: "Vận dụng",
    role: "Đưa kiến thức/kĩ năng vào bối cảnh thực tế hoặc gần thực tế để tạo hành động, quyết định, sản phẩm hoặc liên hệ có giá trị.",
    successDefinition: "Học sinh dùng điều vừa học để xử lí một tình huống đời sống/lớp học/địa phương hoặc tạo sản phẩm áp dụng rõ ràng.",
    requiredSignals: [
      "Bối cảnh vận dụng phải gần đời sống, lớp học, gia đình, cộng đồng, địa phương, trải nghiệm cá nhân hoặc tình huống nghề nghiệp đơn giản.",
      "Nhiệm vụ phải dùng đúng kiến thức/kĩ năng vừa học, không chỉ nêu cảm nghĩ chung.",
      "Có sản phẩm/hành động cụ thể: lời khuyên, kế hoạch, cách giải quyết, câu/đoạn viết, bài toán thực tế, cam kết có tiêu chí, poster nhỏ, checklist, trình bày hoặc thực hành.",
      "Có tiêu chí đánh giá ngắn để biết học sinh đã vận dụng đúng.",
    ],
    acceptableEvidence: [
      "Sản phẩm ứng dụng, cách xử lí tình huống, ví dụ đời sống tự tạo, kế hoạch hành động, lời nói/đoạn viết phục vụ bối cảnh thật, bài toán/giải pháp gắn thực tế.",
    ],
    antiPatterns: [
      "Chỉ dặn dò về nhà hoặc nói 'em sẽ cố gắng'.",
      "Chỉ nhắc lại kiến thức vừa học.",
      "Vận dụng lạc sang bài khác như an toàn, vệ sinh, cam kết nếu nguồn/YCCĐ không yêu cầu.",
      "Không có sản phẩm/hành động kiểm tra được.",
    ],
    issuePolicy: "repairable_pedagogy",
    repairGuidance: "Đổi thành nhiệm vụ áp dụng trong bối cảnh thật/gần thật, yêu cầu sản phẩm cụ thể và tiêu chí kiểm chứng.",
  },
};

function normalizeVietnamese(value: string) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function canonicalLessonPhase(value: string): LessonPhase | "" {
  const source = normalizeVietnamese(value);
  if (!source) return "";
  if (/\bkhoi dong\b/.test(source)) return "Khởi động";
  if (/\bkham pha\b|\bhinh thanh\b/.test(source)) return "Khám phá";
  if (/\bluyen tap\b|\bthuc hanh\b/.test(source)) return "Luyện tập";
  if (/\bvan dung\b/.test(source)) return "Vận dụng";
  return "";
}

export function isLessonPhase(value: string): value is LessonPhase {
  return lessonPhaseOrder.includes(value as LessonPhase);
}

export function phaseStandardFor(value: string): PhaseQualityStandard | undefined {
  const phase = canonicalLessonPhase(value);
  return phase ? phaseQualityStandards[phase] : undefined;
}

export function phaseIssuePolicyFor(value: string): PhaseIssuePolicy | undefined {
  return phaseStandardFor(value)?.issuePolicy;
}

export function buildPhaseQualityPromptBlock() {
  const lines = lessonPhaseOrder.flatMap((phase) => {
    const standard = phaseQualityStandards[phase];
    return [
      `${phase}: ${standard.role}`,
      `- Đạt khi: ${standard.successDefinition}`,
      `- Tín hiệu bắt buộc: ${standard.requiredSignals.join(" | ")}`,
      `- Tránh: ${standard.antiPatterns.join(" | ")}`,
    ];
  });
  return [
    "CHUẨN VAI TRÒ 4 PHA DẠY HỌC DÙNG CHUNG MỌI MÔN:",
    ...lines,
    "Lỗi cấu trúc/fatal không được xuất Word khi sai môn, thiếu số tiết, thiếu hoạt động, JSON/cấu trúc rỗng, nội dung nguy hiểm hoặc thiếu dữ kiện bắt buộc.",
    "Lỗi sư phạm/coverage còn sửa tay được thì đánh dấu cần điều chỉnh và hướng dẫn sửa, không gọi là đạt kiểm tra cuối.",
  ].join("\n");
}
