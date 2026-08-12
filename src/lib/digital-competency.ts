import type { LessonInput, LessonOutcomes, LessonPlan } from "@/types/lesson";

export const DIGITAL_COMPETENCY_CIRCULAR = "Thông tư 02/2025/TT-BGDĐT";

const validDigitalCompetencyCode = /^[1-6]\.[1-6]$/;

function competencyCode(statement: string) {
  return statement.match(/(?:năng lực số\s*)?\(?([1-6]\.[1-6])\)?/i)?.[1] || "";
}

function uniqueValidCompetencies(values: string[] | undefined) {
  const seen = new Set<string>();
  return (values || [])
    .map((item) => String(item || "").replace(/\s+/g, " ").trim())
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
      teacher: `GV hướng dẫn HS trực tiếp sử dụng công cụ số đơn giản để thực hiện hoặc kiểm tra một nhiệm vụ phù hợp với ${title}.`,
      student: "HS thao tác trên công cụ số theo hướng dẫn, đối chiếu kết quả và nêu điều chỉnh nếu cần.",
      material: "Công cụ số đơn giản dùng cho học sinh thực hành",
      product: "Kết quả thao tác hoặc kiểm tra nhiệm vụ trên công cụ số của học sinh",
    };
  }
  if (code === "1.1") {
    return {
      teacher: `GV hướng dẫn HS trực tiếp truy cập học liệu số đã chuẩn bị để tìm và chọn thông tin phù hợp với ${title}.`,
      student: "HS thao tác trên học liệu số, chọn thông tin phù hợp và trình bày căn cứ lựa chọn.",
      material: "Học liệu số được chọn lọc cho học sinh thao tác",
      product: "Thông tin học sinh lựa chọn từ học liệu số",
    };
  }
  return {
    teacher: `GV hướng dẫn HS trực tiếp sử dụng công cụ số đơn giản để tạo sản phẩm học tập phù hợp với ${title}.`,
    student: "HS thao tác trên công cụ số theo hướng dẫn, hoàn thiện và chia sẻ sản phẩm học tập.",
    material: "Công cụ số đơn giản để học sinh tạo sản phẩm",
    product: "Sản phẩm số đơn giản của học sinh",
  };
}

function ensureDigitalActivity(lesson: LessonPlan) {
  const competencies = lesson.outcomes.digitalCompetencies || [];
  if (!competencies.length) return lesson;
  const currentText = JSON.stringify(lesson.activities);
  const hasStudentDigitalOperation = /HS[^"\n]{0,100}(?:thao tác|sử dụng|truy cập|tìm kiếm|tạo|chỉnh sửa|lưu|chia sẻ|ghi âm|chụp|quay)[^"\n]{0,100}(?:công cụ số|thiết bị số|học liệu số|phần mềm|ứng dụng|máy tính|máy tính bảng|điện thoại)/i.test(currentText);
  const hasMatchingCode = competencies.some((competency) => {
    const code = competencyCode(competency);
    if (code === "1.1") return /tìm kiếm|truy cập|chọn thông tin|học liệu số/i.test(currentText);
    if (code === "3.1") return /tạo|chỉnh sửa|ghi âm|soạn thảo|sản phẩm số/i.test(currentText);
    if (code === "5.3") return /giải quyết|thực hiện|kiểm tra.*(?:công cụ số|phần mềm|ứng dụng)/i.test(currentText);
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
    const pairIndex = Math.max(teacherActions.length, studentActions.length) - 1;
    if (pairIndex >= 0) {
      while (teacherActions.length <= pairIndex) teacherActions.push("GV quan sát và hỗ trợ HS thực hiện nhiệm vụ.");
      while (studentActions.length <= pairIndex) studentActions.push("HS thực hiện nhiệm vụ theo hướng dẫn.");
      teacherActions[pairIndex] = `${teacherActions[pairIndex] || "GV giao nhiệm vụ."} ${support.teacher}`;
      studentActions[pairIndex] = `${studentActions[pairIndex] || "HS thực hiện nhiệm vụ."} ${support.student}`;
    } else {
      teacherActions.push(support.teacher);
      studentActions.push(support.student);
    }
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
