import { getPedagogyProfile } from "./pedagogy-profiles";
import { activityMinutes, pairedActivityActions, phaseKey, requiredActivityPhases } from "@/lib/lesson-format";
import type { LessonPlan, LessonInput, PedagogyAudit, PeriodPlan, LessonOutcomes, MathPeriodChunk } from "@/types/lesson";

// ─── VALIDATION HELPERS ───

export function periodHasRequiredPhases(activities: LessonPlan["activities"]) {
  const found = new Set(activities.map((activity) => phaseKey(`${activity.phase} ${activity.title}`)).filter(Boolean));
  return requiredActivityPhases.every((phase) => found.has(phase));
}

export function hasEqualActionPairs(activity: LessonPlan["activities"][number]) {
  return (
    Array.isArray(activity.teacherActions) &&
    Array.isArray(activity.studentActions) &&
    activity.teacherActions.length === activity.studentActions.length &&
    activity.teacherActions.length > 0
  );
}

export function hasWeaklyPairedActions(activity: LessonPlan["activities"][number]) {
  const pairs = pairedActivityActions(activity);
  return pairs.some((pair) => {
    const teacher = pair.teacher.toLowerCase();
    const student = pair.student.toLowerCase();
    const teacherRequiresResponse = /đặt câu hỏi|câu hỏi|yêu cầu|giao nhiệm vụ|hướng dẫn.*(tìm|xác định|viết|làm|thảo luận|trao đổi|đọc|tính|vẽ|lập|hoàn thành)|mời hs|tổ chức.*(thảo luận|trao đổi|làm việc|trình bày)/i.test(teacher);
    const studentHasMatchingAction = /trả lời|nêu|giải thích|chia sẻ|thảo luận|trao đổi|thực hiện|làm|đọc|viết|tìm|xác định|tính|vẽ|lập|hoàn thành|trình bày|báo cáo|nhận xét|ghi|đóng vai|vận dụng/i.test(student);
    const studentOnlyPassive = /^hs\s+(lắng nghe|nghe|quan sát|theo dõi)(\.|$)/i.test(pair.student.trim()) && !studentHasMatchingAction;
    const teacherOnlyCloses = /chốt|kết luận|chuyển\s+(sang|vào|ý)|giới thiệu.*(phần|hoạt động|nội dung)/i.test(teacher);
    const studentUsesGenericFallback = /thực hiện nhiệm vụ tương ứng|phản hồi theo hướng dẫn|trao đổi kết quả và phản hồi/i.test(student);
    return (teacherRequiresResponse && (!studentHasMatchingAction || studentOnlyPassive)) || (teacherOnlyCloses && studentUsesGenericFallback);
  });
}

export function maxActionPairsForDuration(activity: LessonPlan["activities"][number], index: number) {
  const minutes = activityMinutes(activity, index);
  const key = phaseKey(`${activity.phase} ${activity.title}`);
  if (key === "Khởi động" || minutes <= 5) return 3;
  if (key === "Vận dụng" && minutes <= 5) return 3;
  if (minutes <= 10) return 4;
  if (minutes <= 17) return 6;
  return 7;
}

export function hasTooManyActionPairs(activity: LessonPlan["activities"][number], index: number) {
  return pairedActivityActions(activity).length > maxActionPairsForDuration(activity, index);
}

export function hasDetailedOutcomeGroup(outcomes?: Partial<LessonOutcomes>) {
  const groups = [
    outcomes?.knowledgeAndSkills || [],
    outcomes?.generalCompetencies || [],
    outcomes?.specificCompetencies || [],
    outcomes?.qualities || [],
  ];
  return groups.every((items) => items.length > 0 && items.every((item) => item.trim().length >= 34 && /:|biết|thực hiện|trình bày|trao đổi|vận dụng|đề xuất|quan sát|hoàn thành/i.test(item)));
}

// ─── CHECKER HELPERS ───

function subjectPedagogySignalPattern(subject: string) {
  switch (subject) {
    case "Toán":
      return /sơ đồ|tóm tắt|dữ kiện|phép tính|kiểm tra ngược|đơn vị|phần bằng nhau|bài toán/i;
    case "Tiếng Việt":
      return /đọc|viết|nói|nghe|từ|câu|đoạn|văn bản|ngữ liệu|kể lại|giải nghĩa/i;
    case "Đạo đức":
      return /tình huống|hành vi|ứng xử|đóng vai|cam kết|cảm xúc|hậu quả|việc tốt/i;
    case "Tự nhiên và Xã hội":
      return /quan sát|mô tả|so sánh|phân loại|an toàn|vệ sinh|môi trường|cộng đồng|chăm sóc/i;
    case "Khoa học":
      return /dự đoán|thí nghiệm|quan sát|bằng chứng|kết luận|hiện tượng|kiểm chứng|an toàn/i;
    case "Lịch sử và Địa lí":
      return /bản đồ|lược đồ|tư liệu|thời gian|mốc|sự kiện|địa điểm|vị trí|chú giải|di tích/i;
    case "Tin học":
      return /thực hành|thiết bị|lệnh|tệp|sản phẩm số|an toàn số|thuật toán|thư mục|máy tính/i;
    case "Công nghệ":
      return /vật liệu|công cụ|quy trình|sản phẩm|an toàn|thiết kế|cải tiến|bảo quản|lắp ghép/i;
    case "Giáo dục thể chất":
      return /khởi động|động tác|đội hình|khoảng cách|an toàn|trò chơi vận động|hồi tĩnh|sửa lỗi/i;
    case "Âm nhạc":
      return /nghe|hát|gõ|nhịp|tiết tấu|cao độ|vận động|biểu diễn|cảm xúc/i;
    case "Mĩ thuật":
      return /quan sát|màu|nét|hình|bố cục|chất liệu|sản phẩm|trưng bày|ý tưởng/i;
    case "Hoạt động trải nghiệm":
      return /trải nghiệm|chia sẻ|rút kinh nghiệm|cam kết|tự đánh giá|phân vai|hợp tác|hành động/i;
    default:
      return /tình huống|quan sát|thực hành|sản phẩm|đánh giá|vận dụng/i;
  }
}

function subjectPedagogyText(lesson: LessonPlan) {
  return JSON.stringify({
    outcomes: lesson.outcomes,
    materials: lesson.materials,
    activities: lesson.activities,
    periodPlans: lesson.periodPlans,
    assessment: lesson.assessment,
    contextFit: lesson.contextFit,
  });
}

// ─── EXPORTED CHECKERS ───

export function subjectPedagogyIssues(lesson: LessonPlan, input: LessonInput) {
  const text = subjectPedagogyText(lesson);
  const issues: string[] = [];

  if (!subjectPedagogySignalPattern(input.subject).test(text)) {
    issues.push(`Giáo án chưa thể hiện rõ dấu hiệu sư phạm đặc trưng của môn ${input.subject}.`);
  }

  if (input.subject === "Toán") {
    if (!/sơ đồ|tóm tắt|bảng|hình vẽ|que tính|mô hình|thẻ|trục số|phần bằng nhau/i.test(text)) {
      issues.push("Môn Toán thiếu biểu diễn/tóm tắt trực quan như sơ đồ, bảng, hình vẽ, mô hình, thẻ hoặc phần bằng nhau.");
    }
    if (!/dữ kiện|yêu cầu|quan hệ|lớn hơn|bé hơn|tổng|hiệu|tỉ số|phép tính|vì sao/i.test(text)) {
      issues.push("Môn Toán thiếu phân tích dữ kiện, yêu cầu, quan hệ giữa các đại lượng hoặc lý do chọn phép tính.");
    }
    if (!/lỗi sai|sai thường gặp|nhầm|kiểm tra|đối chiếu|thử lại|kiểm tra ngược|đơn vị/i.test(text)) {
      issues.push("Môn Toán thiếu dự kiến lỗi sai thường gặp hoặc bước kiểm tra/đối chiếu kết quả, đơn vị.");
    }
    // Period-level check: khi có nhiều tiết, kiểm tra từng periodPlan riêng lẻ
    const periods = lesson.periodPlans || [];
    if (periods.length > 1) {
      periods.forEach((pp, idx) => {
        const periodText = JSON.stringify(pp);
        if (!/sơ đồ|tóm tắt|bảng|hình vẽ|que tính|mô hình|thẻ|trục số|phần bằng nhau/i.test(periodText)) {
          issues.push(`Tiết ${idx + 1} Toán thiếu biểu diễn/tóm tắt trực quan.`);
        }
        if (!/\d+\s*[+\-×÷=<>]\s*\d+|S\s*=|P\s*=|V\s*=/i.test(periodText)) {
          issues.push(`Tiết ${idx + 1} Toán thiếu nội dung toán cụ thể (phép tính, công thức, bài giải) trong teacherActions/studentActions.`);
        }
      });
    }
  }

  if (input.enableDigitalCompetency) {
    const hasDigitalComp = (lesson.outcomes?.digitalCompetencies || []).length > 0;
    if (!hasDigitalComp) {
      issues.push("Mục Yêu cầu cần đạt chung thiếu Năng lực số mặc dù đã bật tùy chọn Năng lực số.");
    } else {
      const isEmpty = (lesson.outcomes?.digitalCompetencies || []).some(
        (comp) => !comp || comp.trim().length < 5 || /\.\.\.|___/i.test(comp)
      );
      if (isEmpty) {
        issues.push("Mục Năng lực số chứa thông tin chưa cụ thể hoặc có ký tự chờ (..., ___).");
      }
    }
    const periods = lesson.periodPlans || [];
    if (periods.length > 1) {
      periods.forEach((pp, idx) => {
        const hasPeriodDigitalComp = (pp.outcomes?.digitalCompetencies || []).length > 0;
        if (!hasPeriodDigitalComp) {
          issues.push(`Tiết ${idx + 1} thiếu mục tiêu Năng lực số trong Yêu cầu cần đạt của tiết.`);
        } else {
          const isEmpty = (pp.outcomes?.digitalCompetencies || []).some(
            (comp) => !comp || comp.trim().length < 5 || /\.\.\.|___/i.test(comp)
          );
          if (isEmpty) {
            issues.push(`Mục Năng lực số ở tiết ${idx + 1} chứa thông tin chưa cụ thể hoặc có ký tự chờ (..., ___).`);
          }
        }
      });
    }
  }

  if (input.subject === "Tiếng Việt") {
    if (!/văn bản|ngữ liệu|bài đọc|đoạn|câu|từ|tranh/i.test(text)) {
      issues.push("Môn Tiếng Việt thiếu ngữ liệu cụ thể như văn bản, bài đọc, đoạn, câu, từ hoặc tranh làm điểm tựa.");
    }
    if (!/đọc|đọc mẫu|đọc thầm|đọc nối tiếp|luyện đọc/i.test(text)) {
      issues.push("Môn Tiếng Việt thiếu hoạt động đọc/luyện đọc phù hợp.");
    }
    if (!/viết|đặt câu|viết đoạn|chính tả|luyện từ|dấu câu|sửa lỗi/i.test(text)) {
      issues.push("Môn Tiếng Việt thiếu hoạt động viết, luyện từ/câu, chính tả hoặc sửa lỗi ngôn ngữ.");
    }
    if (!/nói|nghe|trao đổi|kể lại|chia sẻ|trình bày|đóng vai/i.test(text)) {
      issues.push("Môn Tiếng Việt thiếu hoạt động nói-nghe hoặc chia sẻ/trình bày.");
    }
    if (!/bằng chứng|dòng|đoạn|chi tiết|ý chính|cảm nhận|giải nghĩa/i.test(text)) {
      issues.push("Môn Tiếng Việt thiếu câu hỏi đọc hiểu có bằng chứng, chi tiết, ý chính, cảm nhận hoặc giải nghĩa từ trong ngữ cảnh.");
    }
  }

  if (input.subject === "Tự nhiên và Xã hội") {
    if (!/quan sát|tranh|vật thật|mô hình|sân trường|gia đình|trường học|cộng đồng/i.test(text)) {
      issues.push("Môn Tự nhiên và Xã hội thiếu hoạt động quan sát từ tranh, vật thật, mô hình hoặc môi trường gần gũi.");
    }
    if (!/mô tả|so sánh|giống|khác|phân loại|tiêu chí|đặc điểm/i.test(text)) {
      issues.push("Môn Tự nhiên và Xã hội thiếu nhiệm vụ mô tả, so sánh hoặc phân loại theo tiêu chí đơn giản.");
    }
    if (!/an toàn|vệ sinh|chăm sóc|bảo vệ|môi trường|việc nên làm|thực hiện ở nhà|thực hiện ở trường/i.test(text)) {
      issues.push("Môn Tự nhiên và Xã hội thiếu liên hệ hành vi thực tế như an toàn, vệ sinh, chăm sóc bản thân hoặc bảo vệ môi trường.");
    }
  }

  if (input.subject === "Khoa học") {
    if (!/câu hỏi|vấn đề|hiện tượng|dự đoán|phỏng đoán/i.test(text)) {
      issues.push("Môn Khoa học thiếu câu hỏi/vấn đề khám phá hoặc bước dự đoán trước khi kết luận.");
    }
    if (!/thí nghiệm|thực hành|quan sát|kiểm chứng|vật liệu|dụng cụ|an toàn/i.test(text)) {
      issues.push("Môn Khoa học thiếu hoạt động quan sát/thí nghiệm/thực hành có dụng cụ, vật liệu hoặc quy tắc an toàn.");
    }
    if (!/bằng chứng|kết quả|ghi lại|bảng|phiếu|so sánh dự đoán|kết luận/i.test(text)) {
      issues.push("Môn Khoa học thiếu ghi nhận bằng chứng/kết quả và rút ra kết luận dựa trên quan sát hoặc thí nghiệm.");
    }
    if (!/vận dụng|sức khỏe|môi trường|tiết kiệm|đời sống|gia đình|trường học/i.test(text)) {
      issues.push("Môn Khoa học thiếu vận dụng kiến thức vào sức khỏe, môi trường, tiết kiệm hoặc đời sống hằng ngày.");
    }
  }

  if (input.subject === "Lịch sử và Địa lí") {
    const hasHistorySignals = /thời gian|mốc|trước|sau|sự kiện|nhân vật|diễn biến|nguyên nhân|kết quả|ý nghĩa/i.test(text);
    const hasGeographySignals = /vị trí|địa điểm|vùng|miền|đặc điểm|tự nhiên|dân cư|đời sống|môi trường/i.test(text);
    if (!/bản đồ|lược đồ|tranh tư liệu|tư liệu|hình ảnh|chú giải|ký hiệu/i.test(text)) {
      issues.push("Môn Lịch sử và Địa lí thiếu bản đồ/lược đồ/tranh tư liệu hoặc nhiệm vụ đọc ký hiệu, chú giải, tư liệu.");
    }
    if (!hasHistorySignals && !hasGeographySignals) {
      issues.push("Môn Lịch sử và Địa lí thiếu trục phân tích Lịch sử hoặc Địa lí: mốc/sự kiện/ý nghĩa hoặc vị trí/đặc điểm/đời sống.");
    }
    if (!/địa phương|quê hương|hiện nay|trách nhiệm|bảo vệ|di sản|môi trường/i.test(text)) {
      issues.push("Môn Lịch sử và Địa lí thiếu liên hệ hiện nay, địa phương, di sản, môi trường hoặc trách nhiệm của học sinh.");
    }
  }

  if (input.subject === "Đạo đức") {
    if (!/tình huống|câu chuyện|tranh|nhân vật|việc làm|hành vi/i.test(text)) {
      issues.push("Môn Đạo đức thiếu tình huống/câu chuyện/tranh hoặc hành vi cụ thể để học sinh phân tích.");
    }
    if (!/cảm xúc|hậu quả|vì sao|nên|không nên|lựa chọn|ứng xử/i.test(text)) {
      issues.push("Môn Đạo đức thiếu phân tích cảm xúc, hậu quả, lựa chọn hành vi hoặc lý do nên/không nên.");
    }
    if (!/đóng vai|xử lí tình huống|thảo luận|góc ý kiến|bày tỏ|chia sẻ/i.test(text)) {
      issues.push("Môn Đạo đức thiếu hoạt động thực hành như đóng vai, xử lí tình huống, bày tỏ ý kiến hoặc thảo luận.");
    }
    if (!/cam kết|việc làm|hành động nhỏ|thực hiện|ở nhà|ở lớp|ở trường/i.test(text)) {
      issues.push("Môn Đạo đức thiếu cam kết/hành động nhỏ sau bài học gắn với gia đình, lớp hoặc trường.");
    }
  }

  if (input.subject === "Hoạt động trải nghiệm") {
    if (!/trải nghiệm|trò chơi|tình huống|hoạt động nhóm|nhiệm vụ|thử thách/i.test(text)) {
      issues.push("Hoạt động trải nghiệm thiếu hoạt động trải nghiệm ban đầu như trò chơi, tình huống, nhiệm vụ hoặc thử thách nhóm.");
    }
    if (!/chia sẻ|cảm xúc|khó khăn|điều học được|rút kinh nghiệm|lần sau/i.test(text)) {
      issues.push("Hoạt động trải nghiệm thiếu bước chia sẻ cảm xúc, rút kinh nghiệm hoặc nêu điều học được sau trải nghiệm.");
    }
    if (!/cam kết|kế hoạch|hành động|việc làm|tự đánh giá|đánh giá bạn|nhật ký/i.test(text)) {
      issues.push("Hoạt động trải nghiệm thiếu cam kết/kế hoạch hành động và tự đánh giá hoặc đánh giá đồng đẳng.");
    }
    if (!/phân vai|nhóm trưởng|thư ký|báo cáo|hợp tác|quy tắc an toàn/i.test(text)) {
      issues.push("Hoạt động trải nghiệm thiếu phân vai, hợp tác nhóm hoặc quy tắc an toàn khi tổ chức hoạt động.");
    }
  }

  if (input.subject === "Tin học") {
    if (!/thiết bị|máy tính|chuột|bàn phím|phần mềm|tệp|thư mục|màn hình/i.test(text)) {
      issues.push("Môn Tin học thiếu thao tác hoặc đối tượng số cụ thể như thiết bị, phần mềm, tệp, thư mục, chuột, bàn phím.");
    }
    if (!/thực hành|nhiệm vụ|sản phẩm số|tạo|lưu|mở|nhập|kéo thả|kiểm tra sản phẩm/i.test(text)) {
      issues.push("Môn Tin học thiếu nhiệm vụ thực hành hoặc sản phẩm số có tiêu chí kiểm tra.");
    }
    if (!/lệnh|thuật toán|trình tự|bước|lặp|điều kiện|sơ đồ|thẻ lệnh/i.test(text)) {
      issues.push("Môn Tin học thiếu yếu tố tư duy thuật toán hoặc trình tự thao tác/lệnh phù hợp bài học.");
    }
    if (!/an toàn số|thông tin cá nhân|mật khẩu|chia sẻ|nguồn|bản quyền|ứng xử/i.test(text)) {
      issues.push("Môn Tin học thiếu nội dung an toàn số, thông tin cá nhân, nguồn/bản quyền hoặc ứng xử văn minh khi phù hợp.");
    }
  }

  if (input.subject === "Công nghệ") {
    if (!/nhu cầu|vấn đề|công dụng|sản phẩm|đồ dùng|thiết kế/i.test(text)) {
      issues.push("Môn Công nghệ thiếu nhu cầu/vấn đề công nghệ, công dụng hoặc sản phẩm cần thiết kế/sử dụng.");
    }
    if (!/vật liệu|công cụ|dụng cụ|quy trình|bước làm|lắp ghép|chăm sóc|bảo quản/i.test(text)) {
      issues.push("Môn Công nghệ thiếu vật liệu, công cụ, quy trình hoặc bước thực hành cụ thể.");
    }
    if (!/an toàn|tiết kiệm|cẩn thận|vệ sinh|phân công|vai trò/i.test(text)) {
      issues.push("Môn Công nghệ thiếu quy tắc an toàn, tiết kiệm vật liệu, vệ sinh hoặc phân công vai trò.");
    }
    if (!/tiêu chí|đánh giá sản phẩm|kiểm tra|thử nghiệm|cải tiến|trưng bày/i.test(text)) {
      issues.push("Môn Công nghệ thiếu tiêu chí đánh giá, kiểm tra/thử nghiệm hoặc cải tiến sản phẩm.");
    }
  }

  if (input.subject === "Giáo dục thể chất") {
    if (!/khởi động|làm nóng|xoay khớp|ép dẻo|hồi tĩnh|thả lỏng/i.test(text)) {
      issues.push("Môn Giáo dục thể chất thiếu khởi động an toàn hoặc hồi tĩnh/thả lỏng cuối tiết.");
    }
    if (!/làm mẫu|động tác|kỹ thuật|tư thế|tay|chân|thân người|nhịp/i.test(text)) {
      issues.push("Môn Giáo dục thể chất thiếu làm mẫu, điểm kỹ thuật hoặc hướng dẫn sửa động tác.");
    }
    if (!/đội hình|hàng|cự ly|khoảng cách|sân bãi|dụng cụ|an toàn/i.test(text)) {
      issues.push("Môn Giáo dục thể chất thiếu đội hình, cự ly/khoảng cách, sân bãi, dụng cụ hoặc quy tắc an toàn.");
    }
    if (!/trò chơi vận động|luật chơi|lượt chơi|thi đua|hợp tác|cổ vũ/i.test(text)) {
      issues.push("Môn Giáo dục thể chất thiếu trò chơi vận động hoặc luật chơi gắn với kỹ năng chính.");
    }
  }

  if (input.subject === "Âm nhạc") {
    if (!/nghe|nghe mẫu|giai điệu|bài hát|âm thanh|cảm xúc/i.test(text)) {
      issues.push("Môn Âm nhạc thiếu hoạt động nghe/cảm thụ âm nhạc hoặc nêu cảm xúc từ giai điệu/bài hát.");
    }
    if (!/hát|luyện hát|lời ca|cao độ|trường độ|tiết tấu|nhịp/i.test(text)) {
      issues.push("Môn Âm nhạc thiếu luyện hát hoặc xử lý cao độ, trường độ, tiết tấu, nhịp.");
    }
    if (!/gõ đệm|vỗ tay|nhạc cụ|vận động|phụ họa|biểu diễn/i.test(text)) {
      issues.push("Môn Âm nhạc thiếu gõ đệm, vận động, phụ họa hoặc biểu diễn.");
    }
    if (!/sáng tạo|sắc thái|lĩnh xướng|nhóm|nhận xét|tự tin/i.test(text)) {
      issues.push("Môn Âm nhạc thiếu yếu tố sáng tạo/thể hiện sắc thái, phối hợp nhóm hoặc nhận xét biểu diễn.");
    }
  }

  if (input.subject === "Mĩ thuật") {
    if (!/quan sát|cảm nhận|tranh|sản phẩm mẫu|đồ vật|hình ảnh/i.test(text)) {
      issues.push("Môn Mĩ thuật thiếu quan sát/cảm nhận tranh, sản phẩm mẫu, đồ vật hoặc hình ảnh làm điểm tựa.");
    }
    if (!/nét|màu|hình|bố cục|đậm nhạt|chất liệu|kỹ thuật/i.test(text)) {
      issues.push("Môn Mĩ thuật thiếu yếu tố tạo hình trọng tâm như nét, màu, hình, bố cục, đậm nhạt, chất liệu hoặc kỹ thuật.");
    }
    if (!/tạo sản phẩm|vẽ|xé dán|nặn|in|trang trí|phác ý tưởng/i.test(text)) {
      issues.push("Môn Mĩ thuật thiếu hoạt động tạo sản phẩm hoặc phác ý tưởng bằng vật liệu/kỹ thuật cụ thể.");
    }
    if (!/trưng bày|giới thiệu|gallery|nhận xét|góp ý|tiêu chí|ý tưởng/i.test(text)) {
      issues.push("Môn Mĩ thuật thiếu trưng bày, giới thiệu, nhận xét sản phẩm hoặc tiêu chí đánh giá ý tưởng/kỹ thuật.");
    }
  }

  return issues;
}

export function subjectPedagogyRepairGuidance(lesson: LessonPlan, input: LessonInput) {
  const issues = subjectPedagogyIssues(lesson, input);
  if (!issues.length) {
    return `- Chưa phát hiện lỗi riêng theo môn ${input.subject}; vẫn phải giữ đúng Pedagogy Profile của môn khi sửa các lỗi khác.`;
  }
  return issues.map((issue) => `- ${issue}`).join("\n");
}

export function hasSubjectPedagogySignals(lesson: LessonPlan, input: LessonInput) {
  return subjectPedagogyIssues(lesson, input).length === 0;
}

export function buildPedagogyAudit(lesson: LessonPlan, input: LessonInput, repairApplied: boolean): PedagogyAudit {
  const issues = subjectPedagogyIssues(lesson, input);
  const profile = getPedagogyProfile(input.subject);
  const status: PedagogyAudit["status"] = issues.length ? "needs-review" : repairApplied ? "repaired" : "passed";
  return {
    subject: input.subject,
    grade: input.grade,
    status,
    issues,
    checks: profile?.qualityChecks || [],
    repairApplied,
    checkedAt: new Date().toISOString(),
  };
}

export function mathPeriodIssues(period: MathPeriodChunk) {
  const issues: string[] = [];
  const activities = period.activities || [];
  const text = JSON.stringify(period);
  if (!periodHasRequiredPhases(activities)) issues.push("Thiếu đủ 4 pha Khởi động, Khám phá, Luyện tập, Vận dụng.");
  if (!period.outcomes || !hasDetailedOutcomeGroup(period.outcomes)) issues.push("Yêu cầu cần đạt của tiết còn sơ sài hoặc thiếu nhóm năng lực/phẩm chất.");
  activities.forEach((activity, index) => {
    const label = `${activity.phase || "Hoạt động"} ${activity.title || index + 1}`;
    if (!hasEqualActionPairs(activity)) issues.push(`${label}: cặp GV/HS chưa cân bằng.`);
    if (hasWeaklyPairedActions(activity)) issues.push(`${label}: hành động GV/HS chưa ăn khớp.`);
    if (hasTooManyActionPairs(activity, index)) issues.push(`${label}: quá nhiều bước so với thời lượng.`);
    if (!activity.learningProducts?.length) issues.push(`${label}: thiếu sản phẩm học tập (cần ghi rõ kết quả bài làm, câu trả lời, bài giải cụ thể).`);
  });
  // Kiểm tra nội dung toán cụ thể (phép tính, công thức, bài giải)
  const actionsText = activities.map(a => [...(a.teacherActions || []), ...(a.studentActions || [])].join(" ")).join(" ");
  if (!/\d+\s*[+\-×÷=<>]\s*\d+/i.test(actionsText) && !/S\s*=|P\s*=|V\s*=|[Cc]ông thức/i.test(actionsText)) {
    issues.push("Tiết Toán thiếu nội dung toán cụ thể trong teacherActions/studentActions: phải viết rõ phép tính, công thức, bài giải mẫu hoặc đáp án dự kiến từ SGK, không chỉ tham chiếu 'xem SGK' hoặc 'HS làm bài'.");
  }
  if (!/sơ đồ|tóm tắt|bảng|hình vẽ|que tính|mô hình|thẻ|trục số|phần bằng nhau/i.test(text)) {
    issues.push("Tiết Toán thiếu biểu diễn/tóm tắt trực quan.");
  }
  if (!/dữ kiện|yêu cầu|quan hệ|lớn hơn|bé hơn|tổng|hiệu|tỉ số|phép tính|vì sao/i.test(text)) {
    issues.push("Tiết Toán thiếu phân tích dữ kiện, yêu cầu, quan hệ hoặc lý do chọn phép tính.");
  }
  if (!/lỗi sai|sai thường gặp|nhầm|kiểm tra|đối chiếu|thử lại|kiểm tra ngược|đơn vị/i.test(text)) {
    issues.push("Tiết Toán thiếu lỗi sai thường gặp hoặc bước kiểm tra kết quả/đơn vị.");
  }
  // Kiểm tra Khởi động lộ đáp án bài chính
  const startup = activities.find(a => phaseKey(`${a.phase} ${a.title}`) === "Khởi động");
  const explore = activities.find(a => phaseKey(`${a.phase} ${a.title}`) === "Khám phá");
  if (startup && explore) {
    const startupActions = [...(startup.teacherActions || []), ...(startup.studentActions || [])].join(" ");
    const exploreActions = [...(explore.teacherActions || []), ...(explore.studentActions || [])].join(" ");
    const startupNumbers: string[] = startupActions.match(/\d{2,}/g) || [];
    const exploreNumbers: string[] = exploreActions.match(/\d{2,}/g) || [];
    const overlap = startupNumbers.filter(n => exploreNumbers.includes(n));
    if (overlap.length >= 2) {
      issues.push("Khởi động có thể lộ đáp án/dữ kiện bài chính (trùng số liệu với Khám phá); cần đổi sang ôn kiến thức nền hoặc tình huống dẫn vào.");
    }
  }
  // Kiểm tra phân hóa học sinh
  if (!/hỗ trợ|HS yếu|HS khá|phân hóa|mở rộng|câu hỏi gợi|bài khó hơn|nâng cao|thêm thử thách/i.test(text)) {
    issues.push("Tiết Toán thiếu phân hóa: cần có hỗ trợ HS yếu (câu hỏi gợi mở, sơ đồ mẫu) và nhiệm vụ mở rộng cho HS khá.");
  }
  // Kiểm tra Vận dụng có gắn đời sống
  const application = activities.find(a => phaseKey(`${a.phase} ${a.title}`) === "Vận dụng");
  if (application) {
    const appText = JSON.stringify(application);
    if (!/đời sống|gia đình|lớp học|trường|mua|bán|quãng đường|thời gian|cây|vườn|sân|địa phương|thực tế|hằng ngày|ở nhà/i.test(appText)) {
      issues.push("Vận dụng Toán chưa gắn với đời sống thực tế: cần liên hệ gia đình, trường học, mua bán, địa phương hoặc tình huống hằng ngày.");
    }
  }
  return issues;
}
