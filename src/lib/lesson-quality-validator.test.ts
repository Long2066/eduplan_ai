import { describe, expect, it } from "vitest";
import { validateLessonQuality } from "@/lib/lesson-quality-validator";
import type { LessonActivity, LessonOutcomes, LessonPlan } from "@/types/lesson";

function activity(overrides: Partial<LessonActivity> = {}): LessonActivity {
  return {
    id: "act-1",
    phase: "Khám phá",
    title: "Đọc và tìm chi tiết",
    objective: "Tìm được hai chi tiết trong đoạn đọc.",
    durationMinutes: 12,
    teacherActions: ["GV yêu cầu: Đọc đoạn 1, gạch dưới hai từ tả màu sắc và trả lời câu hỏi vì sao em chọn."],
    studentActions: ["HS đọc đoạn 1, gạch dưới hai từ tả màu sắc và nêu căn cứ từ câu văn."],
    learningProducts: ["Hai từ tả màu sắc được gạch dưới và câu trả lời có căn cứ."],
    successCriteria: ["Tìm đúng hai từ và chỉ ra đúng câu văn chứa từ."],
    supportForStudentsNeedingHelp: ["GV đánh dấu phạm vi đoạn 1 và cho khung câu: Em chọn từ ... vì ..."],
    extensionForEarlyFinishers: ["Tìm thêm một từ tả màu sắc và đặt câu với từ đó."],
    ...overrides,
  };
}

function outcomes(overrides: Partial<LessonOutcomes> = {}): LessonOutcomes {
  return {
    generalCompetencies: ["Trao đổi được với bạn về căn cứ của câu trả lời."],
    specificCompetencies: ["Đọc đúng đoạn văn và ngắt nghỉ phù hợp."],
    qualities: ["Nêu được một việc làm thể hiện sự chăm chỉ trong học tập."],
    knowledgeAndSkills: ["Tìm được hai từ tả màu sắc trong đoạn 1."],
    objectiveMetadata: [{
      id: "obj-1",
      category: "knowledgeAndSkills",
      statement: "Tìm được hai từ tả màu sắc trong đoạn 1.",
      evidence: {
        activityIds: ["act-1"],
        learningProducts: ["Hai từ được gạch dưới."],
        successCriteria: ["Tìm đúng hai từ."],
      },
    }],
    ...overrides,
  };
}

function lesson(activityOverrides: Partial<LessonActivity> = {}, outcomeOverrides: Partial<LessonOutcomes> = {}): LessonPlan {
  return {
    generalInfo: { subject: "Tiếng Việt", grade: "Lớp 3", lessonTitle: "Bài đọc", periods: 1, duration: 35 },
    outcomes: outcomes(outcomeOverrides),
    materials: { teacher: [], students: [] },
    activities: [activity(activityOverrides)],
    assessment: { criteria: [], evidence: [], comments: [] },
    adjustments: { suitablePoints: [], pointsToAdjust: [], nextLessonDirection: [] },
    contextFit: { notes: [] },
    meta: { style: "standard", modelUsed: "test", createdAt: "2026-01-01T00:00:00.000Z" },
  };
}

function codes(value: LessonPlan) {
  return validateLessonQuality(value).map((finding) => finding.code);
}

describe("validateLessonQuality", () => {
  it("chấp nhận mục tiêu, sản phẩm, tiêu chí và phân hóa cụ thể", () => {
    expect(validateLessonQuality(lesson())).toEqual([]);
  });

  it("phát hiện mục tiêu chung chung bị cấm", () => {
    expect(codes(lesson({}, { knowledgeAndSkills: ["Hoàn thành yêu cầu học tập trọng tâm."] }))).toContain("LQ-OUTCOME-01");
  });

  it("cảnh báo mục tiêu không quan sát được", () => {
    expect(codes(lesson({}, { qualities: ["Có ý thức chăm chỉ và trách nhiệm."] }))).toContain("LQ-OUTCOME-02");
  });

  it("phát hiện câu hoạt động rỗng", () => {
    expect(codes(lesson({ teacherActions: ["GV giao nhiệm vụ cụ thể."], studentActions: ["HS thực hiện nhiệm vụ theo hướng dẫn."] }))).toContain("LQ-ACTIVITY-02");
  });

  it("phát hiện thiếu sản phẩm và tiêu chí", () => {
    expect(codes(lesson({ learningProducts: [] }))).toContain("LQ-PRODUCT-01");
    expect(codes(lesson({ successCriteria: [] }))).toContain("LQ-ASSESS-01");
  });

  it("phát hiện liên kết metadata thiếu activity tồn tại", () => {
    const value = lesson({}, { objectiveMetadata: [{
      id: "obj-1",
      category: "knowledgeAndSkills",
      statement: "Tìm được hai từ.",
      evidence: { activityIds: ["missing"], learningProducts: ["Hai từ."], successCriteria: ["Đúng hai từ."] },
    }] });
    expect(codes(value)).toContain("LQ-LINK-01");
  });

  it("phát hiện thiếu hỗ trợ, mở rộng ở hoạt động trọng tâm", () => {
    const result = codes(lesson({ supportForStudentsNeedingHelp: [], extensionForEarlyFinishers: [] }));
    expect(result).toContain("LQ-DIFF-01");
    expect(result).toContain("LQ-DIFF-02");
  });

  it("không crash khi AI trả trường phân hóa dạng string hoặc object", () => {
    const value = lesson({
      supportForStudentsNeedingHelp: "GV gợi ý bằng câu hỏi lựa chọn." as unknown as string[],
      extensionForEarlyFinishers: { task: "HS đặt thêm một câu hỏi nâng cao." } as unknown as string[],
      learningProducts: "Câu trả lời có căn cứ." as unknown as string[],
      successCriteria: { criterion: "Nêu được căn cứ trong đoạn đọc." } as unknown as string[],
    });

    expect(() => validateLessonQuality(value)).not.toThrow();
    expect(codes(value)).not.toContain("LQ-DIFF-01");
    expect(codes(value)).not.toContain("LQ-DIFF-02");
  });

  it("phát hiện nhãn học sinh không tôn trọng", () => {
    expect(codes(lesson({ teacherActions: ["GV giao phiếu riêng cho HS yếu."] }))).toContain("LQ-DIFF-03");
  });
});