import { describe, expect, it } from "vitest";
import { validateVietnameseTaskCoverage } from "@/lib/vietnamese-task-coverage";
import { makeInput, makeLesson } from "@/lib/vietnamese-fixtures";
import type { LessonActivity, VietnameseSourceInventory } from "@/types/lesson";

function activity(overrides: Partial<LessonActivity> = {}): LessonActivity {
  return {
    phase: "Khám phá",
    title: "Hoạt động Tiếng Việt",
    objective: "Thực hiện nhiệm vụ trong SGK.",
    durationMinutes: 8,
    teacherActions: ["GV giao nhiệm vụ và hướng dẫn HS thực hiện."],
    studentActions: ["HS thực hiện nhiệm vụ."],
    learningProducts: ["Sản phẩm học tập."],
    successCriteria: ["Hoàn thành đúng yêu cầu."],
    ...overrides,
  };
}

const input = makeInput({ subject: "Tiếng Việt", grade: "Lớp 2", lessonTitle: "Bài 2. Ngày hôm qua đâu rồi?", periods: 2 });

describe("validateVietnameseTaskCoverage", () => {
  it("phát hiện nhiệm vụ học thuộc lòng có dấu sao bị bỏ sót", () => {
    const inventory: VietnameseSourceInventory = {
      requiredTasks: [{
        label: "Học thuộc lòng 2 khổ thơ em thích.",
        taskType: "memorization",
        periodNumber: 1,
        required: true,
        productKind: "memorized",
        criteria: ["Thuộc hai khổ thơ.", "Đọc rõ tiếng."],
      }],
    };
    const lesson = makeLesson({
      generalInfo: { subject: "Tiếng Việt", grade: input.grade, lessonTitle: input.lessonTitle, periods: 2, duration: 35 },
      periodPlans: [
        { periodNumber: 1, focus: "Đọc bài thơ", activities: [activity({ teacherActions: ["GV cho HS luyện đọc và trả lời câu hỏi."], studentActions: ["HS đọc bài và trả lời."] })] },
      ],
    });

    const codes = validateVietnameseTaskCoverage(lesson, input, inventory).map((finding) => finding.code);
    expect(codes).toContain("TV-COVERAGE-01");
  });

  it("chấp nhận nhiệm vụ học thuộc khi có hoạt động, sản phẩm và tiêu chí", () => {
    const inventory: VietnameseSourceInventory = {
      requiredTasks: [{
        label: "Học thuộc lòng 2 khổ thơ em thích.",
        taskType: "memorization",
        periodNumber: 1,
        required: true,
        productKind: "memorized",
      }],
    };
    const lesson = makeLesson({
      generalInfo: { subject: "Tiếng Việt", grade: input.grade, lessonTitle: input.lessonTitle, periods: 1, duration: 35 },
      periodPlans: [
        { periodNumber: 1, focus: "Đọc bài thơ", activities: [activity({
          title: "Luyện học thuộc lòng",
          teacherActions: ["GV hướng dẫn HS đọc nhẩm, nhìn từ khóa, che dần dòng thơ và luyện đọc thuộc theo cặp."],
          studentActions: ["HS học thuộc lòng hai khổ thơ em thích và đọc thuộc trước lớp."],
          learningProducts: ["Hai khổ thơ được đọc thuộc."],
          successCriteria: ["Thuộc cơ bản hai khổ thơ.", "Đọc đúng, rõ tiếng."],
        })] },
      ],
    });

    expect(validateVietnameseTaskCoverage(lesson, input, inventory)).toEqual([]);
  });

  it("phát hiện câu hỏi đọc hiểu thiếu đáp án dự kiến", () => {
    const inventory: VietnameseSourceInventory = {
      readingQuestions: [{
        question: "Bạn nhỏ đã hỏi bố điều gì?",
        expectedAnswer: "Ngày hôm qua đâu rồi?",
      }],
    };
    const lesson = makeLesson({
      generalInfo: { subject: "Tiếng Việt", grade: input.grade, lessonTitle: input.lessonTitle, periods: 1, duration: 35 },
      periodPlans: [
        { periodNumber: 1, focus: "Đọc hiểu", activities: [activity({
          teacherActions: ["GV hỏi ba câu trong SGK."],
          studentActions: ["HS trả lời câu hỏi."],
          expectedAnswer: "",
          acceptableResponses: [],
          learningProducts: ["Câu trả lời đọc hiểu."],
          successCriteria: ["Trả lời đúng ý."],
        })] },
      ],
    });

    const codes = validateVietnameseTaskCoverage(lesson, input, inventory).map((finding) => finding.code);
    expect(codes).toContain("TV-COVERAGE-02");
  });

  it("phát hiện nhiệm vụ đặt hai câu nhưng hoạt động chỉ nói miệng", () => {
    const inventory: VietnameseSourceInventory = {
      requiredTasks: [{
        label: "Đặt 2 câu với từ ngữ vừa tìm được.",
        taskType: "sentence-writing",
        periodNumber: 2,
        required: true,
        productKind: "written",
      }],
    };
    const lesson = makeLesson({
      generalInfo: { subject: "Tiếng Việt", grade: input.grade, lessonTitle: input.lessonTitle, periods: 2, duration: 35 },
      periodPlans: [
        { periodNumber: 2, focus: "Đặt câu", activities: [activity({
          title: "Nói câu với từ vừa tìm",
          teacherActions: ["GV yêu cầu HS nói một câu có từ chỉ người và một câu có từ chỉ vật."],
          studentActions: ["HS nói câu trước lớp và nghe bạn nhận xét."],
          learningProducts: ["Hai câu HS nói miệng."],
          successCriteria: ["Câu trọn ý.", "Viết hoa đầu câu và dùng dấu chấm cuối câu."],
        })] },
      ],
    });

    const codes = validateVietnameseTaskCoverage(lesson, input, inventory).map((finding) => finding.code);
    expect(codes).toContain("TV-COVERAGE-03");
  });
});
