import { getPedagogyProfile } from "./pedagogy-profiles";
import { activityMinutes, activityPhaseKey, pairedActivityActions, phaseKey, requiredActivityPhases } from "@/lib/lesson-format";
import { validateMathContent } from "@/lib/math-content";
import { validateMathLesson } from "@/lib/math-quality-validator";
import { validateLessonQuality } from "@/lib/lesson-quality-validator";
import { validateLessonTime } from "@/lib/lesson-time-validator";
import { validateLessonContinuity } from "@/lib/lesson-continuity";
import { validatePhaseQuality } from "@/lib/phase-quality-validator";
import { validateNaturalSocialLesson } from "@/lib/natural-social-quality-validator";
import { validateNaturalSocialTaskCoverage } from "@/lib/natural-social-task-coverage";
import { validateVietnameseLesson } from "@/lib/vietnamese-quality-validator";
import {
  classifyNaturalSocialLesson,
  getNaturalSocialChecklist,
  isNaturalSocialSubjectName,
  naturalSocialSourceInventoryText,
} from "./natural-social-pedagogy";
import { classifyVietnameseLesson, isVietnameseSubjectName, vietnameseLessonTypeProfiles } from "./vietnamese-pedagogy";
import type { LessonPlan, LessonInput, PedagogyAudit, PeriodPlan, LessonOutcomes, MathPeriodChunk, NaturalSocialPeriodBlueprint, VietnameseLessonType, VietnamesePeriodBlueprint } from "@/types/lesson";

// ─── VALIDATION HELPERS ───

export function periodHasRequiredPhases(activities: LessonPlan["activities"]) {
  const found = new Set(activities.map(activityPhaseKey).filter(Boolean));
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
    const studentHasMatchingAction = /trả lời|nêu|giải thích|chia sẻ|thảo luận|trao đổi|thực hiện|làm|đọc|viết|tìm|xác định|tính|vẽ|lập|hoàn thành|trình bày|báo cáo|nhận xét|ghi|đóng vai|vận dụng|quan sát|dự đoán|chọn|giơ|chỉ|cúi|co|duỗi|mở|cảm nhận|dừng|nghỉ|ghép|xếp|đánh dấu/i.test(student);
    const studentOnlyPassive = /^hs\s+(lắng nghe|nghe|quan sát|theo dõi)(\.|$)/i.test(pair.student.trim()) && !studentHasMatchingAction;
    const teacherOnlyCloses = /chốt|kết luận|chuyển\s+(sang|vào|ý)|giới thiệu.*(phần|hoạt động|nội dung)/i.test(teacher);
    const studentUsesGenericFallback = /thực hiện nhiệm vụ tương ứng|phản hồi theo hướng dẫn|trao đổi kết quả và phản hồi/i.test(student);
    return (teacherRequiresResponse && (!studentHasMatchingAction || studentOnlyPassive)) || (teacherOnlyCloses && studentUsesGenericFallback);
  });
}

export function maxActionPairsForDuration(activity: LessonPlan["activities"][number], index: number) {
  const minutes = activityMinutes(activity, index);
  const key = activityPhaseKey(activity);
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
  const observableOutcomePattern = /:|biết|nhận biết|thực hiện|trình bày|trao đổi|vận dụng|đề xuất|quan sát|hoàn thành|đọc|viết|nêu|tìm|xác định|chỉ|mô tả|lựa chọn|phân loại|so sánh|giải thích/i;
  return groups.every((items) => items.length > 0 && items.every(
    (item) => item.trim().length >= 34 && observableOutcomePattern.test(item),
  ));
}

const mechanicalVietnameseOutcomePattern = /thực hiện được qua|sử dụng kiến thức,?\s*kĩ năng đặc thù|sử dụng kiến thức đặc thù|kiến thức đặc thù|nội dung học tập đặc thù|được hình thành qua|\.\s*:/i;
const vietnameseMorningWordsPattern = /ban mai|sáng sớm|bình minh|sớm mai|rạng sáng/i;
const vietnameseMovementWordsPattern = /khuân|vác|lôi|bê|xách|kéo|đẩy/i;
const vietnameseSoundMeaningPattern = /(?:từ|nhóm|trường nghĩa|đồng nghĩa).{0,90}(?:âm thanh|tiếng động|tiếng kêu|tiếng vang)|(?:âm thanh|tiếng động|tiếng kêu|tiếng vang).{0,90}(?:từ|nhóm|đồng nghĩa)/i;
const vietnameseOutcomeVerbPattern = /^(?:Đọc|Hiểu|Tìm|Xác định|Sắp xếp|Nêu|Lựa chọn|Đặt câu|Viết|Tự sửa)\b/iu;
const vietnameseDifferentiationTemplatePattern = /ba từ khóa|có một bằng chứng|giải thích tác dụng|phân tích tác dụng/i;
const vietnameseGrade2OverAnalysisPattern = /giải thích tác dụng|phân tích tác dụng|hiệu quả của nhịp|phân tích nghệ thuật|biện pháp nghệ thuật|phép lặp|hàm ý|hình ảnh nghệ thuật/i;

function outcomeText(outcomes?: Partial<LessonOutcomes>) {
  return [
    ...(outcomes?.knowledgeAndSkills || []),
    ...(outcomes?.generalCompetencies || []),
    ...(outcomes?.specificCompetencies || []),
    ...(outcomes?.qualities || []),
    ...(outcomes?.digitalCompetencies || []),
  ].join(" ");
}

function activityCriteriaCount(activity: LessonPlan["activities"][number]) {
  return (activity.successCriteria || []).reduce((count, criterion) => {
    const parts = criterion.split(/;|\n|•/).map((part) => part.trim()).filter(Boolean);
    return count + Math.max(1, parts.length);
  }, 0);
}

function hasVietnameseSynonymSemanticIssue(text: string) {
  return (vietnameseMorningWordsPattern.test(text) || vietnameseMovementWordsPattern.test(text)) && vietnameseSoundMeaningPattern.test(text);
}

function hasVietnameseOutcomeGroup(outcomes?: Partial<LessonOutcomes>) {
  const knowledge = outcomes?.knowledgeAndSkills || [];
  return (
    knowledge.length >= 4 &&
    knowledge.length <= 6 &&
    knowledge.every((item) => vietnameseOutcomeVerbPattern.test(item.trim())) &&
    Boolean(outcomes?.generalCompetencies?.length) &&
    Boolean(outcomes?.specificCompetencies?.length) &&
    Boolean(outcomes?.qualities?.length)
  );
}

function vietnameseListedAnswerItemCount(answer: string) {
  const numbered = answer.match(/(?:^|\s)(?:\d+|[a-f])[\).]/gi) || [];
  const splitItems = answer
    .split(/[,;；、\n]|\s+-\s+|\s+\/\s+/)
    .map((part) => part.trim())
    .filter((part) => /[\p{L}\d]/u.test(part) && part.length >= 2);
  return Math.max(numbered.length, splitItems.length);
}

function vietnameseSourceTaskMissingAnswer(activity: LessonPlan["activities"][number]) {
  const text = JSON.stringify(activity);
  if (!/(?:6|sáu)\s+(?:cụm từ|từ|câu)|ch\/tr|c\/k|ac\/at|dấu chấm|dấu chấm hỏi|đồ vật|tên các đồ vật|gọi tên/i.test(text)) return false;
  const answer = [activity.expectedAnswer || "", ...(activity.acceptableResponses || [])].join(" ");
  if (!answer.trim()) return true;
  if (/theo sgk|chốt theo sgk|đối chiếu bằng sgk|đáp án phù hợp|giáo viên tự xác định/i.test(answer)) return true;
  const expectsSix = /(?:6|sáu)\s+(?:cụm từ|từ|câu)/i.test(text);
  return vietnameseListedAnswerItemCount(answer) < (expectsSix ? 5 : 2);
}

function vietnameseDuplicateActivityTexts(activities: LessonPlan["activities"]) {
  const normalize = (value: string) => value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const words = (activity: LessonPlan["activities"][number]) => new Set(normalize([
    activity.objective,
    ...(activity.teacherActions || []),
    ...(activity.studentActions || []),
    ...(activity.learningProducts || []),
    activity.expectedAnswer || "",
  ].join(" ")).split(" ").filter((word) => word.length >= 3));
  const duplicates: number[] = [];
  activities.forEach((activity, index) => {
    const current = words(activity);
    if (current.size < 4) return;
    for (let previous = 0; previous < index; previous += 1) {
      const earlier = words(activities[previous]);
      const hits = [...current].filter((word) => earlier.has(word)).length;
      if (hits / Math.min(current.size, earlier.size || 1) >= 0.72) {
        duplicates.push(index);
        break;
      }
    }
  });
  return duplicates;
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

  if (input.enableDigitalCompetency && !isVietnameseSubjectName(input.subject)) {
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

  if (isVietnameseSubjectName(input.subject)) {
    // Use conditional checker based on lesson-type classification
    const classification = classifyVietnameseLesson(input, text);
    const typeIssues = vietnameseTypeIssues(classification.primaryType, text);
    issues.push(...typeIssues);
    // Universal Tiếng Việt check: must have some linguistic material
    if (!/văn bản|ngữ liệu|bài đọc|đoạn|câu|từ|tranh|âm|vần|chữ|mẫu/i.test(text)) {
      issues.push("TV-UNI-01: Môn Tiếng Việt thiếu ngữ liệu cụ thể (văn bản, từ, câu, tranh, âm-vần hoặc mẫu chữ).");
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

// ─── VIETNAMESE CONDITIONAL CHECKERS ───

function vietnameseTypeIssues(lessonType: VietnameseLessonType, text: string): string[] {
  const issues: string[] = [];
  const profile = vietnameseLessonTypeProfiles[lessonType];
  if (!profile || lessonType === "mixed") return issues;

  // Check the must-have pattern for this lesson type
  if (!profile.checkerMustHave.test(text)) {
    issues.push(`TV-TYPE-01: Kiểu bài "${profile.label}" thiếu dấu hiệu đặc trưng bắt buộc.`);
  }

  // Type-specific checks
  switch (lessonType) {
    case "reading":
      if (!/đọc (mẫu|thành tiếng|thầm|nối tiếp|phân vai|diễn cảm)|luyện đọc/i.test(text)) {
        issues.push("TV-READ-01: Bài đọc thiếu hoạt động luyện đọc (đọc mẫu/nối tiếp/thầm/phân vai).");
      }
      if (!/chi tiết|bằng chứng|dẫn chứng|tìm trong (đoạn|bài|câu)/i.test(text)) {
        issues.push("TV-READ-02: Bài đọc thiếu câu hỏi tìm chi tiết/bằng chứng trong văn bản.");
      }
      if (!/ý chính|nội dung (chính|bài)|thông điệp|cảm nhận|cảm nghĩ/i.test(text)) {
        issues.push("TV-READ-03: Bài đọc thiếu câu hỏi về ý chính, nội dung hoặc cảm nhận.");
      }
      break;

    case "spelling":
      if (!/nghe[- ]viết|nhớ[- ]viết|tập chép|viết (chính tả|bài)/i.test(text)) {
        issues.push("TV-SPELL-01: Bài chính tả thiếu quy trình nghe viết hoặc nhớ viết.");
      }
      if (!/soát (lỗi|bài)|sửa lỗi|kiểm tra bài viết|đổi (vở|bài)/i.test(text)) {
        issues.push("TV-SPELL-02: Bài chính tả thiếu bước soát lỗi hoặc sửa lỗi.");
      }
      if (!/từ khó|phân biệt|âm|vần|quy tắc/i.test(text)) {
        issues.push("TV-SPELL-03: Bài chính tả thiếu phân tích từ khó hoặc bài tập phân biệt.");
      }
      break;

    case "composition":
      if (!/dàn (ý|bài)|lập ý|tìm ý|sắp xếp ý/i.test(text)) {
        issues.push("TV-WRITE-01: Bài viết thiếu bước tìm ý hoặc lập dàn ý.");
      }
      if (!/chỉnh sửa|sửa bài|đọc (lại|soát)|góp ý|tiêu chí viết/i.test(text)) {
        issues.push("TV-WRITE-02: Bài viết thiếu bước chỉnh sửa hoặc tiêu chí đánh giá bài viết.");
      }
      break;

    case "language-knowledge":
      if (!/ngữ liệu|ví dụ|đoạn (văn|trích)|câu (mẫu|ví dụ)|quan sát/i.test(text)) {
        issues.push("TV-LANG-01: Luyện từ và câu thiếu ngữ liệu để học sinh khám phá quy tắc.");
      }
      if (!/quy tắc|kiến thức|nhận xét|rút ra|kết luận|ghi nhớ/i.test(text)) {
        issues.push("TV-LANG-02: Luyện từ và câu thiếu bước chốt kiến thức hoặc quy tắc.");
      }
      if (!/bài tập|luyện|đặt câu|tìm (từ|câu)|điền|sửa lỗi/i.test(text)) {
        issues.push("TV-LANG-03: Luyện từ và câu thiếu bài tập luyện nhận diện hoặc sử dụng.");
      }
      break;

    case "speaking-listening":
      if (!/nói (và nghe|trước|theo)|kể (chuyện|lại)|trình bày|trao đổi|chia sẻ/i.test(text)) {
        issues.push("TV-SPEAK-01: Bài nói-nghe thiếu hoạt động nói hoặc kể chuyện.");
      }
      if (!/người nghe|nghe (bạn|và)|nhiệm vụ (nghe|người nghe)|hỏi lại|nhận xét (bạn|phần)/i.test(text)) {
        issues.push("TV-SPEAK-02: Bài nói-nghe thiếu nhiệm vụ cho người nghe (hỏi lại, nhận xét, ghi chú).");
      }
      break;

    case "phonics":
      if (!/âm|vần|tiếng|chữ/i.test(text)) {
        issues.push("TV-PHON-01: Bài học vần thiếu âm, vần hoặc tiếng mục tiêu.");
      }
      if (!/ghép|phân tích (tiếng|cấu tạo)|đánh vần/i.test(text)) {
        issues.push("TV-PHON-02: Bài học vần thiếu hoạt động ghép hoặc phân tích cấu tạo tiếng.");
      }
      if (!/viết|tập viết|bảng con|vở/i.test(text)) {
        issues.push("TV-PHON-03: Bài học vần thiếu hoạt động viết chữ/tiếng mới.");
      }
      break;

    case "handwriting":
      if (!/mẫu (chữ|viết)|nét|cỡ chữ|dòng kẻ|điểm đặt bút/i.test(text)) {
        issues.push("TV-HAND-01: Bài tập viết thiếu mẫu chữ hoặc phân tích nét.");
      }
      if (!/viết mẫu|GV viết|làm mẫu/i.test(text)) {
        issues.push("TV-HAND-02: Bài tập viết thiếu bước GV viết mẫu.");
      }
      if (!/luyện viết|tập viết|viết (vào vở|trên bảng|bảng con)/i.test(text)) {
        issues.push("TV-HAND-03: Bài tập viết thiếu bước HS luyện viết.");
      }
      break;
  }

  return issues;
}

export function vietnamesePeriodIssues(
  period: PeriodPlan,
  blueprintPeriod: VietnamesePeriodBlueprint | undefined,
  input: LessonInput,
): string[] {
  const issues: string[] = [];
  const activities = period.activities || [];
  const text = JSON.stringify(period);
  const lessonType = blueprintPeriod?.lessonType || "mixed";

  // Structural checks (same as general)
  if (!periodHasRequiredPhases(activities)) {
    issues.push("TV-STRUCT-01: Thiếu đủ 4 pha Khởi động, Khám phá, Luyện tập, Vận dụng.");
  }
  if (!period.outcomes || !hasVietnameseOutcomeGroup(period.outcomes)) {
    issues.push("TV-STRUCT-02: Yêu cầu cần đạt Tiếng Việt cần 4–6 mục ngắn bắt đầu bằng động từ đo được, kèm năng lực chung/đặc thù/phẩm chất không lặp máy móc.");
  }

  const totalMinutes = activities.reduce((sum, activity, index) => sum + activityMinutes(activity, index), 0);
  if (input.duration === 35 && (totalMinutes < 32 || totalMinutes > 33)) {
    issues.push(`TV-TIME-01: Tổng thời lượng 4 hoạt động là ${totalMinutes} phút; tiết Tiếng Việt 35 phút chỉ nên ghi 32–33 phút để chừa 2–3 phút dự phòng.`);
  }
  if (mechanicalVietnameseOutcomePattern.test(outcomeText(period.outcomes))) {
    issues.push("TV-YCCD-01: Yêu cầu cần đạt còn có câu máy móc hoặc lỗi dấu câu .:; hãy viết bằng động từ quan sát được, bỏ cụm 'thực hiện được qua/sử dụng kiến thức đặc thù'.");
  }
  if (hasVietnameseSynonymSemanticIssue(text)) {
    issues.push("TV-LANG-04: Có nguy cơ gán sai trường nghĩa; ban mai/sáng sớm/bình minh là thời gian buổi sáng, khuân/vác/lôi là hoạt động di chuyển, không phải nhóm từ chỉ âm thanh.");
  }
  if (vietnameseDifferentiationTemplatePattern.test(text) || activities.filter((activity) => activity.supportForStudentsNeedingHelp?.length || activity.extensionForEarlyFinishers?.length).length > 2) {
    issues.push("TV-DIFF-01: Phân hóa đang lặp mẫu hoặc xuất hiện quá nhiều; chỉ giữ ở 1–2 hoạt động trọng tâm và viết theo nhiệm vụ thật.");
  }
  if (/lớp\s*([12])|grade\s*([12])/i.test(input.grade) && vietnameseGrade2OverAnalysisPattern.test(text)) {
    issues.push("TV-AGE-01: Có yêu cầu phân tích/nâng cao quá sức lớp 1–2; chuyển thành nói điều hiểu, chọn chi tiết thích hoặc nêu lí do đơn giản.");
  }
  vietnameseDuplicateActivityTexts(activities).slice(0, 2).forEach((index) => {
    issues.push(`TV-DUP-01 ${activities[index]?.phase || `Hoạt động ${index + 1}`}: Hoạt động gần trùng yêu cầu/sản phẩm với hoạt động trước; cần đổi thành liên hệ, cảm nhận hoặc vận dụng mới.`);
  });

  // Action pair checks
  activities.forEach((activity, index) => {
    const label = `${activity.phase || "Hoạt động"} ${activity.title || index + 1}`;
    const productCount = (activity.learningProducts || []).filter((product) => product.trim()).length;
    const criteriaCount = activityCriteriaCount(activity);
    if (!hasEqualActionPairs(activity)) issues.push(`TV-PAIR-01 ${label}: cặp GV/HS chưa cân bằng.`);
    if (hasWeaklyPairedActions(activity)) issues.push(`TV-PAIR-02 ${label}: hành động GV/HS chưa ăn khớp.`);
    if (hasTooManyActionPairs(activity, index)) issues.push(`TV-PAIR-03 ${label}: quá nhiều bước so với thời lượng.`);
    if (!activity.learningProducts?.length) issues.push(`TV-PAIR-04 ${label}: thiếu sản phẩm học tập.`);
    if (productCount > 1 || criteriaCount > 2) issues.push(`TV-LOAD-01 ${label}: mỗi hoạt động chỉ nên có 1 sản phẩm chính và tối đa 2 tiêu chí ngắn.`);
    if (vietnameseSourceTaskMissingAnswer(activity)) issues.push(`TV-ANS-01 ${label}: Bài tập cần từ/cụm/câu/dấu câu/đồ vật cụ thể nhưng expectedAnswer chưa ghi đủ đáp án kiểm chứng được.`);
  });

  // Type-specific checks
  const typeIssues = vietnameseTypeIssues(lessonType, text);
  issues.push(...typeIssues);

  // Universal: must reference textbook content, not just "xem SGK"
  if (/xem SGK|làm bài trong SGK|theo SGK trang/i.test(text) && !/ngữ liệu|văn bản|bài đọc|đoạn|âm|vần/i.test(text)) {
    issues.push("TV-UNI-02: Chỉ tham chiếu SGK mà không chép cụ thể ngữ liệu/nhiệm vụ vào giáo án.");
  }

  return issues;
}

export function vietnameseLessonIssues(
  lesson: LessonPlan,
  input: LessonInput,
): string[] {
  const issues: string[] = [];
  const classification = classifyVietnameseLesson(input, JSON.stringify(lesson));

  // Per-period checks
  const periods = lesson.periodPlans || [];
  if (periods.length > 1) {
    periods.forEach((pp, idx) => {
      const blueprintPeriod: VietnamesePeriodBlueprint = {
        periodNumber: idx + 1,
        lessonType: classification.primaryType,
      };
      const periodIssues = vietnamesePeriodIssues(pp, blueprintPeriod, input);
      for (const issue of periodIssues) {
        issues.push(`Tiết ${idx + 1}: ${issue}`);
      }
    });
  }

  return issues;
}

export function buildPedagogyAudit(lesson: LessonPlan, input: LessonInput, repairApplied: boolean): PedagogyAudit {
  const issues = subjectPedagogyIssues(lesson, input);
  const profile = getPedagogyProfile(input.subject);

  // Add subject classification metadata if applicable
  let lessonType: string | undefined;
  let classificationConfidence: "high" | "medium" | "low" | undefined;
  let periodTypes: string[] | undefined;
  let checks = profile?.qualityChecks || [];

  if (isVietnameseSubjectName(input.subject)) {
    const classification = classifyVietnameseLesson(input, JSON.stringify(lesson));
    lessonType = classification.primaryType;
    classificationConfidence = classification.confidence;
    if (lesson.periodPlans && lesson.periodPlans.length > 1) {
      // For multi-period, all periods get the primary type for now
      // (blueprint will assign per-period types in Phase B)
      periodTypes = lesson.periodPlans.map(() => classification.primaryType);
    }
  }

  if (isNaturalSocialSubjectName(input.subject)) {
    const sourceText = naturalSocialSourceInventoryText(lesson.meta?.naturalSocialSourceInventory);
    const classification = classifyNaturalSocialLesson(input, sourceText);
    lessonType = classification.primaryType;
    classificationConfidence = classification.confidence;
    checks = getNaturalSocialChecklist(classification);
    if (lesson.periodPlans && lesson.periodPlans.length > 1) {
      periodTypes = lesson.periodPlans.map((period) =>
        classifyNaturalSocialLesson({ ...input, lessonTitle: period.focus || input.lessonTitle }, sourceText).primaryType,
      );
    }
  }

  const findings = [
    ...validateLessonQuality(lesson),
    ...validateLessonTime(lesson),
    ...validateLessonContinuity(lesson, input),
    ...validatePhaseQuality(lesson, input),
    ...(/^(toán|toan)$/i.test(input.subject.trim()) ? validateMathLesson(lesson, input) : []),
    ...(isVietnameseSubjectName(input.subject) ? validateVietnameseLesson(lesson, input) : []),
    ...(isNaturalSocialSubjectName(input.subject) ? validateNaturalSocialLesson(lesson, input) : []),
    ...(isNaturalSocialSubjectName(input.subject) ? validateNaturalSocialTaskCoverage(lesson, input, lesson.meta?.naturalSocialSourceInventory) : []),
  ];
  const hasBlockingFinding = findings.some((finding) => finding.severity === "error");
  const status: PedagogyAudit["status"] = issues.length || hasBlockingFinding
    ? "needs-review"
    : repairApplied
      ? "repaired"
      : "passed";

  return {
    subject: input.subject,
    grade: input.grade,
    status,
    issues,
    checks,
    repairApplied,
    checkedAt: new Date().toISOString(),
    findings,
    lessonType,
    classificationConfidence,
    periodTypes,
  };
}

export function mathPeriodIssues(period: MathPeriodChunk) {
  const issues: string[] = [];
  const activities = period.activities || [];
  const text = JSON.stringify(period);
  const mathTextEntries: Array<[string, string | undefined]> = [
    ["Trọng tâm tiết", period.focus],
    ...Object.entries(period.outcomes || {}).flatMap(([group, values]) =>
      group !== "objectiveMetadata" && Array.isArray(values)
        ? values.filter((value): value is string => typeof value === "string").map((value, index): [string, string] => [`Yêu cầu ${group} ${index + 1}`, value])
        : [],
    ),
    ...activities.flatMap((activity, activityIndex): Array<[string, string | undefined]> => [
      [`${activity.phase || "Hoạt động"} ${activityIndex + 1} - mục tiêu`, activity.objective],
      ...(activity.teacherActions || []).map((value, index): [string, string] => [`${activity.phase} - GV bước ${index + 1}`, value]),
      ...(activity.studentActions || []).map((value, index): [string, string] => [`${activity.phase} - HS bước ${index + 1}`, value]),
      ...(activity.learningProducts || []).map((value, index): [string, string] => [`${activity.phase} - sản phẩm ${index + 1}`, value]),
    ]),
    ["Bàn giao kiến thức", period.handoff?.learned],
    ["Cầu nối tiết sau", period.handoff?.nextBridge],
  ];

  const latexIssues = mathTextEntries.flatMap(([location, value]) => {
    if (typeof value !== "string" || !value.trim()) return [];
    return validateMathContent(value, { requireDelimitedFormulas: true }).map((issue) => `${location}: ${issue.message}`);
  });
  if (latexIssues.length) {
    issues.push(`Chuẩn LaTeX chưa đạt: ${latexIssues.slice(0, 8).join(" | ")}${latexIssues.length > 8 ? ` | và ${latexIssues.length - 8} lỗi khác` : ""}`);
  }
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
  const startup = activities.find(a => activityPhaseKey(a) === "Khởi động");
  const explore = activities.find(a => activityPhaseKey(a) === "Khám phá");
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
  const application = activities.find(a => activityPhaseKey(a) === "Vận dụng");
  if (application) {
    const appText = JSON.stringify(application);
    if (!/đời sống|gia đình|lớp học|trường|mua|bán|quãng đường|thời gian|cây|vườn|sân|địa phương|thực tế|hằng ngày|ở nhà/i.test(appText)) {
      issues.push("Vận dụng Toán chưa gắn với đời sống thực tế: cần liên hệ gia đình, trường học, mua bán, địa phương hoặc tình huống hằng ngày.");
    }
  }
  return issues;
}

export function naturalSocialPeriodIssues(
  period: PeriodPlan,
  blueprintPeriod: NaturalSocialPeriodBlueprint | undefined,
  input: LessonInput,
): string[] {
  const issues: string[] = [];
  const activities = period.activities || [];
  const text = JSON.stringify(period);
  const lessonType = blueprintPeriod?.lessonType || classifyNaturalSocialLesson(input, text).primaryType;

  if (!periodHasRequiredPhases(activities)) {
    issues.push("NSXH-STRUCT-01: Thiếu đủ 4 pha Khởi động, Khám phá, Luyện tập, Vận dụng.");
  }
  if (!period.outcomes || !hasDetailedOutcomeGroup(period.outcomes)) {
    issues.push("NSXH-STRUCT-02: Yêu cầu cần đạt của tiết còn sơ sài hoặc thiếu nhóm năng lực/phẩm chất.");
  }

  activities.forEach((activity, index) => {
    const label = `${activity.phase || "Hoạt động"} ${activity.title || index + 1}`;
    if (!hasEqualActionPairs(activity)) issues.push(`${label}: cặp GV/HS chưa cân bằng.`);
    if (hasWeaklyPairedActions(activity)) issues.push(`${label}: hành động GV/HS chưa ăn khớp.`);
    if (hasTooManyActionPairs(activity, index)) issues.push(`${label}: quá nhiều bước so với thời lượng.`);
    if (!activity.learningProducts?.length) issues.push(`${label}: thiếu sản phẩm học tập quan sát được như phiếu, bảng, tranh, thẻ hoặc lời trình bày.`);
    if (!activity.successCriteria?.length) issues.push(`${label}: thiếu tiêu chí thành công gắn với quan sát, mô tả, phân loại hoặc hành động vận dụng.`);
  });

  const lesson: LessonPlan = {
    generalInfo: {
      subject: "Tự nhiên và Xã hội",
      grade: input.grade,
      lessonTitle: input.lessonTitle || period.focus || "Bài học Tự nhiên và Xã hội",
      book: input.book,
      periods: 1,
      duration: input.duration,
    },
    outcomes: period.outcomes || {
      generalCompetencies: [],
      specificCompetencies: [],
      qualities: [],
      knowledgeAndSkills: [],
    },
    materials: { teacher: [], students: [] },
    activities,
    periodPlans: [{ ...period, activities }],
    assessment: { criteria: [], evidence: [], comments: [] },
    adjustments: { suitablePoints: [], pointsToAdjust: [], nextLessonDirection: [] },
    contextFit: { notes: [] },
    meta: { style: input.style, modelUsed: "checker", createdAt: new Date().toISOString() },
  };
  issues.push(...validateNaturalSocialLesson(lesson, input, lessonType).map((finding) => `${finding.code}: ${finding.message}`));

  return Array.from(new Set(issues));
}
