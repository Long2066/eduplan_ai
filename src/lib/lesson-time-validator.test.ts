import { describe, expect, it } from "vitest";
import { validateLessonTime } from "@/lib/lesson-time-validator";
import type { LessonActivity, LessonPlan, PeriodPlan } from "@/types/lesson";

function activity(overrides: Partial<LessonActivity> = {}): LessonActivity {
  return {
    phase: "Khám phá",
    title: "Tìm chi tiết",
    objective: "Tìm được chi tiết trong bài.",
    durationMinutes: 10,
    teacherActions: ["GV nêu câu hỏi về chi tiết trong bài."],
    studentActions: ["HS tìm chi tiết trong bài."],
    learningProducts: ["Chi tiết được tìm đúng."],
    timeBreakdown: { workingMinutes: 10 },
    ...overrides,
  };
}

function validActivities(): LessonActivity[] {
  return [
    activity({ phase: "Khởi động", durationMinutes: 4, timeBreakdown: { workingMinutes: 3, transitionMinutes: 1 } }),
    activity({ phase: "Khám phá", durationMinutes: 14, timeBreakdown: { workingMinutes: 14 } }),
    activity({ phase: "Luyện tập", durationMinutes: 10, timeBreakdown: { workingMinutes: 10 } }),
    activity({ phase: "Vận dụng", durationMinutes: 4, timeBreakdown: { workingMinutes: 4 } }),
  ];
}

function period(periodNumber: number, activities: LessonActivity[] = validActivities()): PeriodPlan {
  return { periodNumber, focus: `Tiết ${periodNumber}`, activities };
}

function lesson(overrides: Partial<LessonPlan> = {}): LessonPlan {
  return {
    generalInfo: { subject: "Tiếng Việt", grade: "Lớp 3", lessonTitle: "Bài đọc", periods: 1, duration: 35 },
    outcomes: { generalCompetencies: [], specificCompetencies: [], qualities: [], knowledgeAndSkills: [] },
    materials: { teacher: [], students: [] },
    activities: validActivities(),
    assessment: { criteria: [], evidence: [], comments: [] },
    adjustments: { suitablePoints: [], pointsToAdjust: [], nextLessonDirection: [] },
    contextFit: { notes: [] },
    meta: { style: "standard", modelUsed: "test", createdAt: "2026-01-01T00:00:00.000Z" },
    ...overrides,
  };
}

function findingsByCode(value: LessonPlan, code: string) {
  return validateLessonTime(value).filter((finding) => finding.code === code);
}

describe("validateLessonTime", () => {
  it("chấp nhận tiết Tiếng Việt 35 phút có 32 phút hoạt động và 3 phút dự phòng", () => {
    expect(validateLessonTime(lesson())).toEqual([]);
  });

  it("bắt buộc tổng hoạt động Tiếng Việt nằm trong khoảng 32–33 phút", () => {
    const activities = validActivities();
    activities[3] = activity({ phase: "Vận dụng", durationMinutes: 6, timeBreakdown: { workingMinutes: 6 } });
    expect(findingsByCode(lesson({ activities }), "LQ-TIME-01")[0]?.message).toContain("34 phút");
  });

  it("kiểm tra tổng timeBreakdown bằng durationMinutes", () => {
    const activities = validActivities();
    activities[1] = activity({ durationMinutes: 15, timeBreakdown: { workingMinutes: 10, feedbackMinutes: 2 } });
    expect(findingsByCode(lesson({ activities }), "LQ-TIME-02")).toHaveLength(1);
  });

  it("phát hiện thao tác vận hành chưa được tính thời gian", () => {
    const activities = validActivities();
    activities[1] = activity({
      durationMinutes: 15,
      timeBreakdown: undefined,
      teacherActions: ["GV phát phiếu, cho HS suy nghĩ rồi mời trình bày và nhận xét."],
      studentActions: ["HS làm phiếu và trình bày kết quả."],
    });
    expect(findingsByCode(lesson({ activities }), "LQ-TIME-03")).toHaveLength(1);
  });

  it("dành tối thiểu khoảng 12 phút để viết đoạn 5–7 câu", () => {
    const activities = validActivities();
    activities[1] = activity({
      title: "Viết đoạn 5–7 câu",
      objective: "Viết được đoạn 5–7 câu về gia đình.",
      durationMinutes: 15,
      timeBreakdown: { instructionMinutes: 2, workingMinutes: 10, feedbackMinutes: 3 },
    });
    expect(findingsByCode(lesson({ activities }), "LQ-TIME-04")).toHaveLength(1);
  });

  it("phát hiện thảo luận nhóm không đủ thời gian làm việc và báo cáo", () => {
    const activities = validActivities();
    activities[3] = activity({
      phase: "Vận dụng",
      organization: "group",
      durationMinutes: 5,
      timeBreakdown: { instructionMinutes: 1, workingMinutes: 3, presentationMinutes: 1 },
    });
    expect(findingsByCode(lesson({ activities }), "LQ-TIME-05")).toHaveLength(1);
  });

  it("phát hiện ba sản phẩm trở lên trong dưới năm phút", () => {
    const activities = validActivities();
    activities[3] = activity({
      phase: "Vận dụng",
      durationMinutes: 4,
      learningProducts: ["Phiếu", "Bài nói", "Sơ đồ"],
      timeBreakdown: { workingMinutes: 4 },
    });
    expect(findingsByCode(lesson({ activities }), "LQ-TIME-06")).toHaveLength(1);
  });

  it("phát hiện quá nhiều bước so với số phút", () => {
    const activities = validActivities();
    activities[3] = activity({
      phase: "Vận dụng",
      durationMinutes: 5,
      teacherActions: ["Bước 1", "Bước 2", "Bước 3", "Bước 4"],
      studentActions: ["Việc 1", "Việc 2", "Việc 3", "Việc 4"],
      timeBreakdown: { workingMinutes: 5 },
    });
    expect(findingsByCode(lesson({ activities }), "LQ-TIME-07")).toHaveLength(1);
  });

  it("kiểm tra từng tiết độc lập trong giáo án nhiều tiết", () => {
    const shortActivities = validActivities();
    shortActivities[3] = activity({ phase: "Vận dụng", durationMinutes: 6, timeBreakdown: { workingMinutes: 6 } });
    const value = lesson({
      generalInfo: { subject: "Tiếng Việt", grade: "Lớp 3", lessonTitle: "Bài đọc", periods: 2, duration: 35 },
      activities: [...validActivities(), ...shortActivities],
      periodPlans: [period(1), period(2, shortActivities)],
    });
    const mismatch = findingsByCode(value, "LQ-TIME-01");
    expect(mismatch).toHaveLength(1);
    expect(mismatch[0].periodNumber).toBe(2);
  });

  it("phát hiện durationMinutes không hợp lệ", () => {
    const activities = validActivities();
    activities[0] = activity({ phase: "Khởi động", durationMinutes: 0, timeBreakdown: { workingMinutes: 0 } });
    expect(findingsByCode(lesson({ activities }), "LQ-TIME-10")).toHaveLength(1);
  });

  it("phát hiện một tiết chứa quá nhiều loại nhiệm vụ lớn", () => {
    const activities = validActivities();
    activities[1] = activity({
      title: "Viết đoạn và làm phiếu",
      teacherActions: ["GV tổ chức thảo luận nhóm, đóng vai rồi yêu cầu viết đoạn và hoàn thành phiếu học tập."],
      studentActions: ["HS thảo luận nhóm, đóng vai, viết đoạn và hoàn thành phiếu học tập."],
      durationMinutes: 15,
      timeBreakdown: { instructionMinutes: 2, workingMinutes: 10, presentationMinutes: 2, transitionMinutes: 1 },
    });
    expect(findingsByCode(lesson({ activities }), "LQ-TIME-08")).toHaveLength(1);
  });

  it("phát hiện timeBreakdown có số phút âm", () => {
    const activities = validActivities();
    activities[1] = activity({ durationMinutes: 15, timeBreakdown: { workingMinutes: 16, feedbackMinutes: -1 } });
    expect(findingsByCode(lesson({ activities }), "LQ-TIME-10")).toHaveLength(1);
  });

  it("gợi ý quỹ chuyển tiếp khi chưa có phút linh hoạt hoặc mô tả chuyển hoạt động", () => {
    const activities = [
      activity({ phase: "Khởi động", durationMinutes: 5 }),
      activity({ phase: "Khám phá", durationMinutes: 15 }),
      activity({ phase: "Luyện tập", durationMinutes: 10 }),
      activity({ phase: "Vận dụng", durationMinutes: 5 }),
    ].map((item) => ({ ...item, timeBreakdown: { workingMinutes: item.durationMinutes } }));
    const value = lesson({
      generalInfo: { subject: "Toán", grade: "Lớp 3", lessonTitle: "Phép cộng", periods: 1, duration: 35 },
      activities,
    });
    expect(findingsByCode(value, "LQ-TIME-09")).toHaveLength(1);
  });
});