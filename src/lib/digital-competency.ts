import type { LessonInput, LessonOutcomes, LessonPlan } from "@/types/lesson";

export const DIGITAL_COMPETENCY_CIRCULAR = "Thông tư 02/2025/TT-BGDĐT";

const validDigitalCompetencyCode = /^[1-6]\.[1-6]$/;

function competencyCode(statement: string) {
  return (
    statement.match(/(?:năng lực số\s*)?\(?([1-6]\.[1-6])(?:\.CB[12][a-d])?\)?/i)?.[1]
    || statement.match(/\b([1-6]\.[1-6])(?:\.CB[12][a-d])?\b/i)?.[1]
    || ""
  );
}

function normalizeCompetencyStatement(raw: string) {
  const cleaned = String(raw || "").replace(/\s+/g, " ").trim();
  const code = competencyCode(cleaned);
  if (!cleaned || !validDigitalCompetencyCode.test(code)) return "";
  if (/^năng lực số\s*\(/i.test(cleaned)) return cleaned;
  const body = cleaned
    .replace(/^(?:năng lực số\s*)?\(?[1-6]\.[1-6](?:\.CB[12][a-d])?\)?\s*[:.\-–—]?\s*/i, "")
    .trim();
  return body ? `Năng lực số (${code}): ${body}` : "";
}

function uniqueValidCompetencies(values: string[] | undefined) {
  const seen = new Set<string>();
  return (values || [])
    .map(normalizeCompetencyStatement)
    .filter((item) => {
      const code = competencyCode(item);
      const key = item.toLocaleLowerCase("vi");
      if (!item || !validDigitalCompetencyCode.test(code) || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 2);
}

function fallbackDigitalCompetency(input: Pick<LessonInput, "subject">, lessonTitle: string) {
  const subject = input.subject.trim().toLocaleLowerCase("vi");
  const title = lessonTitle.trim() || "bài học";

  if (/toán|toan/.test(subject)) {
    return `Năng lực số (5.3): Sử dụng công cụ số đơn giản dưới sự hướng dẫn để thực hiện hoặc kiểm tra một nhiệm vụ toán học phù hợp với ${title}.`;
  }
  if (/tiếng việt|tieng viet|ngữ văn|ngu van/.test(subject)) {
    return `Năng lực số (3.1): Sử dụng công cụ ghi âm hoặc soạn thảo đơn giản dưới sự hướng dẫn để tạo sản phẩm đọc, nói hoặc viết phù hợp với ${title}.`;
  }
  if (/tự nhiên và xã hội|tu nhien va xa hoi|khoa học|khoa hoc/.test(subject)) {
    return `Năng lực số (1.1): Sử dụng học liệu số đơn giản dưới sự hướng dẫn để tìm kiếm, quan sát và chọn thông tin phù hợp với ${title}.`;
  }
  return `Năng lực số (3.1): Sử dụng công cụ số đơn giản dưới sự hướng dẫn để tạo một sản phẩm học tập phù hợp với ${title}.`;
}

function digitalActivitySupport(subject: string, lessonTitle: string, competency: string) {
  const code = competencyCode(competency);
  const normalizedSubject = subject.trim().toLocaleLowerCase("vi");
  const title = lessonTitle.trim() || "bài học";
  if (code === "5.3" || /toán|toan/.test(normalizedSubject)) {
    return {
      teacher: `- GV tổ chức nhiệm vụ tích hợp Năng lực số (${code || "5.3"}): hướng dẫn HS trực tiếp sử dụng công cụ số đơn giản (bảng tương tác/ứng dụng học toán) để thực hiện hoặc kiểm tra nhanh một phép tính/nhiệm vụ toán học của bài ${title}.`,
      student: "- HS trực tiếp thao tác trên công cụ số theo hướng dẫn, đối chiếu kết quả vừa thực hiện và nêu nhận xét trước lớp.",
      material: "Công cụ số đơn giản dùng cho học sinh thực hành",
      product: "Kết quả thao tác hoặc kiểm tra nhiệm vụ trên công cụ số của học sinh",
    };
  }
  if (code === "1.1") {
    return {
      teacher: `- GV tổ chức nhiệm vụ tích hợp Năng lực số (${code}): hướng dẫn HS trực tiếp truy cập học liệu số đã chuẩn bị để tìm, quan sát và chọn thông tin phù hợp với bài ${title}.`,
      student: "- HS trực tiếp thao tác trên học liệu số, chọn thông tin/hình ảnh phù hợp và trình bày căn cứ lựa chọn trước lớp.",
      material: "Học liệu số được chọn lọc cho học sinh thao tác",
      product: "Thông tin học sinh lựa chọn từ học liệu số",
    };
  }
  return {
    teacher: `- GV tổ chức nhiệm vụ tích hợp Năng lực số (${code || "3.1"}): hướng dẫn HS trực tiếp sử dụng công cụ số đơn giản (ghi âm/bảng tương tác/ứng dụng học tập) để tạo hoặc hoàn thiện sản phẩm học tập phù hợp với bài ${title}.`,
    student: "- HS trực tiếp thao tác trên công cụ số theo hướng dẫn, hoàn thiện và chia sẻ sản phẩm số với bạn/trước lớp.",
    material: "Công cụ số đơn giản để học sinh tạo sản phẩm",
    product: "Sản phẩm số đơn giản của học sinh",
  };
}

function ensureDigitalActivity(lesson: LessonPlan) {
  const competencies = lesson.outcomes.digitalCompetencies || [];
  if (!competencies.length) return lesson;
  const currentText = JSON.stringify(lesson.activities);
  const hasStudentDigitalOperation = /HS[^"\n]{0,100}(?:thao tác|sử dụng|truy cập|tìm kiếm|tạo|chỉnh sửa|lưu|chia sẻ|ghi âm|chụp|quay)[^"\n]{0,100}(?:công cụ số|thiết bị số|học liệu số|phần mềm|ứng dụng|máy tính|máy tính bảng|điện thoại|bảng tương tác)/i.test(currentText);
  const hasMatchingCode = competencies.some((competency) => {
    const code = competencyCode(competency);
    if (code === "1.1") return /tìm kiếm|truy cập|chọn thông tin|học liệu số/i.test(currentText);
    if (code === "3.1") return /tạo|chỉnh sửa|ghi âm|soạn thảo|sản phẩm số/i.test(currentText);
    if (code === "5.3") return /giải quyết|thực hiện|kiểm tra.*(?:công cụ số|phần mềm|ứng dụng|bảng tương tác)/i.test(currentText);
    return hasStudentDigitalOperation;
  });
  if (hasStudentDigitalOperation && hasMatchingCode) {
    return lesson;
  }
  const activities = lesson.activities || [];
  if (!activities.length) return lesson;
  const applicationIndex = activities.findIndex((activity) => /vận dụng/i.test(`${activity.phase} ${activity.title}`));
  const practiceIndex = activities.findIndex((activity) => /luyện tập/i.test(`${activity.phase} ${activity.title}`));
  const targetIndex = applicationIndex >= 0 ? applicationIndex : practiceIndex;
  const index = targetIndex >= 0 ? targetIndex : activities.length - 1;
  const support = digitalActivitySupport(lesson.generalInfo.subject, lesson.generalInfo.lessonTitle, competencies[0]);
  const nextActivities = activities.map((activity, activityIndex) => {
    if (activityIndex !== index) return activity;
    const teacherActions = [...(activity.teacherActions || [])];
    const studentActions = [...(activity.studentActions || [])];
    while (teacherActions.length < studentActions.length) {
      teacherActions.push("- GV quan sát, gợi mở và hướng dẫn HS tự đối chiếu, điều chỉnh.");
    }
    while (studentActions.length < teacherActions.length) {
      studentActions.push("- HS suy nghĩ, trao đổi cùng bạn và hoàn thành yêu cầu học tập cụ thể.");
    }
    teacherActions.push(support.teacher);
    studentActions.push(support.student);
    return {
      ...activity,
      teacherActions,
      studentActions,
      inputOrMaterials: [...(activity.inputOrMaterials || []), support.material],
      learningProducts: [...(activity.learningProducts || []), support.product],
    };
  });
  return { ...lesson, activities: nextActivities };
}

export function ensureDigitalCompetencyOutcomes(
  input: Pick<LessonInput, "subject" | "enableDigitalCompetency">,
  outcomes: LessonOutcomes,
  lessonTitle: string,
): LessonOutcomes {
  if (!input.enableDigitalCompetency) return { ...outcomes, digitalCompetencies: [] };
  const existing = uniqueValidCompetencies(outcomes.digitalCompetencies);
  return {
    ...outcomes,
    digitalCompetencies: existing.length ? existing : [fallbackDigitalCompetency(input, lessonTitle)],
  };
}

export function ensureLessonDigitalCompetencies(input: LessonInput, lesson: LessonPlan): LessonPlan {
  const title = lesson.generalInfo.lessonTitle || input.lessonTitle || "bài học";
  const outcomes = ensureDigitalCompetencyOutcomes(input, lesson.outcomes, title);
  const periodPlans = lesson.periodPlans?.map((period) => {
    const periodLesson = ensureDigitalActivity({
      ...lesson,
      generalInfo: { ...lesson.generalInfo, lessonTitle: `${title} - tiết ${period.periodNumber}` },
      outcomes: ensureDigitalCompetencyOutcomes(input, period.outcomes || outcomes, `${title} - tiết ${period.periodNumber}`),
      activities: period.activities,
      periodPlans: undefined,
    });
    return { ...period, outcomes: periodLesson.outcomes, activities: periodLesson.activities };
  });
  const activities = periodPlans?.length
    ? periodPlans.flatMap((period) => period.activities)
    : ensureDigitalActivity({ ...lesson, outcomes }).activities;

  return { ...lesson, outcomes, activities, periodPlans };
}
