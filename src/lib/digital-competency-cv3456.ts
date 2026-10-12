import cv3456Data from "@/data/digital-competency-cv3456.json";
import type { LessonActivity } from "@/types/lesson";

export interface DigitalIndicator {
  code: string;
  description: string;
  tieng_viet_context: string;
  domainId: string;
  domainName: string;
  subdomainId: string;
  subdomainName: string;
  band: "CB1" | "CB2";
}

export const CV3456_INDICATOR_REGEX = /^[1-6]\.[1-4]\.CB[12][a-d]$/;

export function getBandForGrade(grade: number | string): "CB1" | "CB2" {
  const gradeNum = typeof grade === "number" ? grade : parseInt(String(grade).replace(/\D/g, ""), 10);
  if (gradeNum >= 4) return "CB2";
  return "CB1";
}

export function getAllCV3456Indicators(): DigitalIndicator[] {
  const result: DigitalIndicator[] = [];
  for (const domain of cv3456Data.domains) {
    for (const sub of domain.subdomains) {
      for (const [bandKey, list] of Object.entries(sub.indicators)) {
        const band = bandKey as "CB1" | "CB2";
        for (const item of list) {
          result.push({
            code: item.code,
            description: item.description,
            tieng_viet_context: item.tieng_viet_context,
            domainId: domain.id,
            domainName: domain.name,
            subdomainId: sub.id,
            subdomainName: sub.name,
            band,
          });
        }
      }
    }
  }
  return result;
}

export function getIndicatorsByGrade(grade: number | string): DigitalIndicator[] {
  const band = getBandForGrade(grade);
  return getAllCV3456Indicators().filter((item) => item.band === band);
}

export function findIndicatorByCode(code: string): DigitalIndicator | undefined {
  const normalized = code.trim().toUpperCase();
  return getAllCV3456Indicators().find(
    (item) => item.code.toUpperCase() === normalized
  );
}

export interface TiengVietDigitalActivitySuggestion {
  indicatorCode: string;
  indicatorDescription: string;
  taskTitle: string;
  teacherAction: string;
  studentAction: string;
  digitalProduct: string;
  assessmentCriterion: string;
}

export function suggestTiengVietDigitalActivity(
  grade: number | string,
  lessonType: string,
  lessonTitle: string
): TiengVietDigitalActivitySuggestion {
  const band = getBandForGrade(grade);
  const title = lessonTitle.trim() || "bài học";

  if (band === "CB1") {
    if (lessonType === "phonics" || lessonType === "reading") {
      return {
        indicatorCode: "3.1.CB1a",
        indicatorDescription: "Tạo và chỉnh sửa nội dung số đơn giản ở ít nhất một định dạng (văn bản, âm thanh, hình ảnh).",
        taskTitle: "Ghi âm đọc mẫu và tự đối chiếu giọng đọc",
        teacherAction: `GV hướng dẫn HS sử dụng thiết bị ghi âm (điện thoại/máy tính bảng) để tự ghi lại giọng đọc 1 đoạn ngắn bài ${title}.`,
        studentAction: "HS thao tác nút ghi âm, đọc to đoạn văn, bật nghe lại để tự đối chiếu với giọng đọc mẫu của GV.",
        digitalProduct: "Tệp ghi âm giọng đọc của học sinh",
        assessmentCriterion: "HS biết thao tác bật/tắt ghi âm và nhận xét được độ trôi chảy, rõ tiếng của bản thân.",
      };
    }
    if (lessonType === "speaking-listening") {
      return {
        indicatorCode: "2.1.CB1a",
        indicatorDescription: "Lựa chọn và sử dụng được các công nghệ số đơn giản để tương tác trong giờ học.",
        taskTitle: "Tương tác chọn hình ảnh theo nội dung bài nói",
        teacherAction: `GV mở kho hình ảnh số trên bảng tương tác, gọi HS lên chạm/chọn tranh minh họa đúng với chi tiết vừa nghe trong bài ${title}.`,
        studentAction: "HS lên bảng tương tác, thao tác chạm chọn tranh và giải thích lý do lựa chọn trước lớp.",
        digitalProduct: "Lựa chọn đúng thẻ hình ảnh tương tác trên màn hình",
        assessmentCriterion: "HS tương tác đúng thao tác chạm và giải thích ăn khớp với nội dung bài học.",
      };
    }
    return {
      indicatorCode: "1.1.CB1a",
      indicatorDescription: "Xác định được nhu cầu thông tin, tìm kiếm dữ liệu thông qua tìm kiếm đơn giản trong môi trường số.",
      taskTitle: "Truy cập học liệu số minh họa từ ngữ",
      teacherAction: `GV hướng dẫn HS bấm mở liên kết hoặc quét mã QR kho tranh ảnh học liệu số về ${title}.`,
      studentAction: "HS thao tác truy cập kho tư liệu số theo hướng dẫn và chỉ ra hình ảnh khớp với từ ngữ bài học.",
      digitalProduct: "Hình ảnh số được HS lựa chọn đúng yêu cầu",
      assessmentCriterion: "HS tự thực hiện được thao tác truy cập và xác định đúng hình ảnh.",
    };
  }

  // CB2 (Lớp 4, Lớp 5)
  if (lessonType === "reading" || lessonType === "language-knowledge") {
    return {
      indicatorCode: "1.1.CB2b",
      indicatorDescription: "Tìm kiếm dữ liệu, thông tin thông qua tìm kiếm đơn giản trong môi trường số.",
      taskTitle: "Tra cứu từ ngữ và thông tin tư liệu văn bản",
      teacherAction: `GV giao nhiệm vụ cho các nhóm sử dụng từ điển số hoặc công cụ tìm kiếm để tra cứu từ khó và hình ảnh mở rộng về ${title}.`,
      studentAction: "HS gõ từ khóa vào thanh tìm kiếm, chọn lọc kết quả phù hợp và ghi chép nghĩa của từ vào phiếu học tập.",
      digitalProduct: "Phiếu ghi chép kết quả tra cứu số có nguồn gốc rõ ràng",
      assessmentCriterion: "HS chọn đúng từ khóa, trích dẫn được nguồn tra cứu và diễn giải đúng nghĩa từ ngữ.",
    };
  }

  if (lessonType === "composition") {
    return {
      indicatorCode: "3.4.CB2a",
      indicatorDescription: "Lập sơ đồ các bước theo trình tự để giải quyết nhiệm vụ học tập.",
      taskTitle: "Lập sơ đồ tư duy dàn ý bài viết trên thiết bị số",
      teacherAction: `GV hướng dẫn HS sử dụng ứng dụng sơ đồ tư duy đơn giản để phân nhánh các ý chính cho bài viết ${title}.`,
      studentAction: "HS thao tác trên phần mềm sơ đồ tư duy, kéo thả các nhánh mở bài, thân bài, kết bài và điền từ ngữ gợi tả vào từng nhánh.",
      digitalProduct: "Sơ đồ tư duy dàn ý bài viết dạng kỹ thuật số",
      assessmentCriterion: "Sơ đồ có bố cục logic 3 phần, nội dung nhánh chi tiết và rõ ràng.",
    };
  }

  return {
    indicatorCode: "3.1.CB2a",
    indicatorDescription: "Tạo và chỉnh sửa nội dung số ở nhiều định dạng kết hợp (chữ viết kèm âm thanh hoặc hình ảnh minh họa).",
    taskTitle: "Thiết kế thẻ thông tin hoặc poster giới thiệu bài học",
    teacherAction: `GV giao nhiệm vụ HS dùng phần mềm học tập tạo 1 trang giới thiệu tóm tắt nhân vật hoặc thông điệp bài ${title}.`,
    studentAction: "HS chọn mẫu, gõ nội dung tóm tắt, chèn hình minh họa và lưu tệp sản phẩm.",
    digitalProduct: "Tệp thẻ thông tin hoặc poster số của học sinh",
    assessmentCriterion: "Nội dung cô đọng, hình ảnh phù hợp chủ đề, hoàn thành đúng thời lượng.",
  };
}

export interface DigitalAuditResult {
  isValid: boolean;
  hasSuperficialWarning: boolean;
  code?: string;
  message?: string;
}

export function auditTiengVietDigitalIntegration(activity: LessonActivity): DigitalAuditResult {
  const nameText = (activity.title || "").toLowerCase();
  const teacherText = (activity.teacherActions || []).join(" ").toLowerCase();
  const studentText = (activity.studentActions || []).join(" ").toLowerCase();
  const allText = `${nameText} ${teacherText} ${studentText}`;

  // Check if digital mentions exist
  const hasDigitalKeyword = /công nghệ số|năng lực số|thiết bị số|máy tính|ghi âm|màn hình tương tác|phần mềm|ứng dụng|tra cứu số|slide|máy chiếu|tivi/i.test(allText);

  if (!hasDigitalKeyword) {
    return { isValid: true, hasSuperficialWarning: false };
  }

  // Check superficial: GV chiếu TV/slide nhưng HS chỉ ngồi xem/nghe, không có thao tác học sinh
  const teacherUsesScreenOnly = /chiếu (slide|tivi|video|hình ảnh)|bật (tivi|video|máy chiếu)/i.test(teacherText);
  const studentHasNoDigitalTask = !/hs (thao tác|thực hành|sử dụng|ghi âm|tra cứu|chạm|bấm|nhập|gõ|kéo thả|lập sơ đồ)/i.test(studentText);

  if (teacherUsesScreenOnly && studentHasNoDigitalTask) {
    return {
      isValid: false,
      hasSuperficialWarning: true,
      message: "Cảnh báo NLS hình thức: Giáo viên chiếu tivi/slide nhưng học sinh không có thao tác số trực tiếp và không có sản phẩm số thực tế.",
    };
  }

  // Extract CV3456 code if present
  const codeMatch = allText.match(/([1-6]\.[1-4]\.cb[12][a-d])/i);
  return {
    isValid: true,
    hasSuperficialWarning: false,
    code: codeMatch ? codeMatch[1].toUpperCase() : undefined,
  };
}
