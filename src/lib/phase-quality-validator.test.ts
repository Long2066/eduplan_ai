import { describe, expect, it } from "vitest";
import { validatePhaseQuality } from "@/lib/phase-quality-validator";
import { buildPedagogyAudit } from "@/lib/subject-checkers";
import { makeInput } from "@/lib/vietnamese-fixtures";
import type { LessonActivity, LessonPlan, PeriodPlan } from "@/types/lesson";

function activity(overrides: Partial<LessonActivity> = {}): LessonActivity {
  return {
    id: "act",
    phase: "Khám phá",
    title: "Khám phá bằng chứng",
    objective: "Tìm được bằng chứng chính của bài học.",
    durationMinutes: 12,
    teacherActions: ["GV giao nhiệm vụ: quan sát ảnh SGK, đọc câu hỏi và ghi một bằng chứng vào phiếu quan sát."],
    studentActions: ["HS quan sát ảnh SGK, đọc câu hỏi, trao đổi cặp đôi và ghi bằng chứng tìm được vào phiếu."],
    inputOrMaterials: ["Ảnh SGK và phiếu quan sát."],
    learningProducts: ["Phiếu quan sát có một bằng chứng đúng."],
    successCriteria: ["Nêu đúng bằng chứng và giải thích ngắn vì sao chọn."],
    expectedAnswer: "HS nêu được bằng chứng phù hợp với nội dung ảnh SGK.",
    commonErrors: ["Chọn chi tiết không liên quan."],
    teacherFeedback: ["GV hỏi gợi mở: Con dựa vào chi tiết nào?"],
    ...overrides,
  };
}

function period(periodNumber: number, activities: LessonActivity[]): PeriodPlan {
  return {
    periodNumber,
    focus: `Tiết ${periodNumber}`,
    outcomes: {
      generalCompetencies: ["Trao đổi được với bạn để hoàn thành nhiệm vụ."],
      specificCompetencies: ["Nêu được bằng chứng phù hợp với nhiệm vụ."],
      qualities: ["Tham gia học tập có trách nhiệm."],
      knowledgeAndSkills: ["Tìm được thông tin chính từ học liệu."],
    },
    activities,
  };
}

function lesson(periods: PeriodPlan[]): LessonPlan {
  return {
    generalInfo: { subject: "Tự nhiên và Xã hội", grade: "Lớp 2", lessonTitle: "Bài học", periods: periods.length, duration: 35 },
    outcomes: periods[0].outcomes!,
    materials: { teacher: [], students: [] },
    activities: periods.flatMap((item) => item.activities),
    periodPlans: periods,
    assessment: { criteria: [], evidence: [], comments: [] },
    adjustments: { suitablePoints: [], pointsToAdjust: [], nextLessonDirection: [] },
    contextFit: { notes: [] },
    meta: { style: "Dạy thật trên lớp", modelUsed: "test", createdAt: "2026-01-01T00:00:00.000Z" },
  };
}

function goodActivities() {
  return [
    activity({
      id: "start",
      phase: "Khởi động",
      title: "Hộp bí mật",
      durationMinutes: 4,
      teacherActions: ["GV đưa hộp bí mật có ảnh/kỉ vật nhỏ, yêu cầu HS dự đoán nội dung bài qua một câu hỏi mở."],
      studentActions: ["HS quan sát, dự đoán và nêu lí do chọn dự đoán của mình."],
      learningProducts: ["Dự đoán ban đầu có lí do."],
      successCriteria: ["Nêu được một dự đoán liên quan bài học."],
    }),
    activity({ id: "explore" }),
    activity({
      id: "practice",
      phase: "Luyện tập",
      title: "Sắp xếp bằng chứng",
      durationMinutes: 10,
      teacherActions: ["GV yêu cầu HS luyện tập bằng cách sắp xếp thẻ bằng chứng vào hai nhóm đúng/chưa đúng và giải thích cách làm vừa học."],
      studentActions: ["HS làm bài theo nhóm, đối chiếu đáp án, sửa lỗi phân loại và trình bày kết quả."],
      learningProducts: ["Bảng phân loại thẻ bằng chứng đã sửa."],
      successCriteria: ["Phân loại đúng ít nhất 3 thẻ và nêu được lí do."],
      expectedAnswer: "Các thẻ đúng được xếp vào nhóm có bằng chứng liên quan trực tiếp.",
    }),
    activity({
      id: "apply",
      phase: "Vận dụng",
      title: "Việc làm ở trường em",
      durationMinutes: 5,
      teacherActions: ["GV nêu tình huống ở lớp/trường: chọn một việc làm hằng ngày để giữ gìn truyền thống tốt đẹp và viết lời khuyên ngắn cho bạn."],
      studentActions: ["HS vận dụng điều vừa học, viết một lời khuyên hoặc checklist hành động ở lớp/trường rồi chia sẻ với bạn."],
      learningProducts: ["Lời khuyên hoặc checklist hành động áp dụng trong lớp/trường."],
      successCriteria: ["Nêu được hành động cụ thể và gắn với điều vừa học."],
    }),
  ];
}

function codes(value: LessonPlan) {
  return validatePhaseQuality(value).map((finding) => finding.code);
}

describe("validatePhaseQuality", () => {
  it("accepts phases with real discovery, practice and application", () => {
    expect(validatePhaseQuality(lesson([period(1, goodActivities())]))).toEqual([]);
  });

  it("detects activities whose phase label is correct but the essence is wrong", () => {
    const value = lesson([period(1, [
      activity({
        id: "start",
        phase: "Khởi động",
        title: "Giới thiệu bài",
        teacherActions: ["GV giới thiệu bài và nêu mục tiêu tiết học."],
        studentActions: ["HS lắng nghe."],
        inputOrMaterials: [],
        learningProducts: ["HS biết tên bài."],
        successCriteria: [],
        expectedAnswer: "",
        commonErrors: [],
        teacherFeedback: [],
      }),
      activity({
        id: "explore",
        phase: "Khám phá",
        title: "GV trình bày kiến thức",
        teacherActions: ["GV giảng khái niệm mới và yêu cầu HS nghe."],
        studentActions: ["HS lắng nghe và ghi nhớ."],
        inputOrMaterials: [],
        learningProducts: ["HS nghe nội dung bài."],
        successCriteria: [],
        expectedAnswer: "",
        commonErrors: [],
        teacherFeedback: [],
      }),
      activity({
        id: "practice",
        phase: "Luyện tập",
        title: "Cùng khám phá thêm",
        teacherActions: ["GV cho HS khám phá kiến thức mới qua thảo luận tự do."],
        studentActions: ["HS thảo luận tự do."],
        inputOrMaterials: [],
        learningProducts: ["Ý kiến chung."],
        successCriteria: [],
        expectedAnswer: "",
        commonErrors: [],
        teacherFeedback: [],
      }),
      activity({
        id: "apply",
        phase: "Vận dụng",
        title: "Dặn dò",
        teacherActions: ["GV dặn HS về nhà học bài và chuẩn bị bài sau."],
        studentActions: ["HS hứa em sẽ cố gắng."],
        inputOrMaterials: [],
        learningProducts: ["Lời hứa cố gắng."],
        successCriteria: [],
        expectedAnswer: "",
        commonErrors: [],
        teacherFeedback: [],
      }),
    ])]);

    expect(codes(value)).toEqual(expect.arrayContaining([
      "PHASE-QUALITY-01",
      "PHASE-QUALITY-02",
      "PHASE-QUALITY-03",
      "PHASE-QUALITY-04",
    ]));
  });

  it("detects repeated discovery patterns across periods", () => {
    const repeatedExplore = activity({
      id: "explore-1",
      phase: "Khám phá",
      title: "Quan sát tranh và thảo luận",
      teacherActions: ["GV yêu cầu HS quan sát tranh SGK, thảo luận nhóm và trình bày kết quả vào phiếu học tập."],
      studentActions: ["HS quan sát tranh SGK, thảo luận nhóm và trình bày kết quả vào phiếu học tập."],
      learningProducts: ["Phiếu học tập sau khi quan sát tranh."],
    });
    const value = lesson([
      period(1, goodActivities().map((item) => item.phase === "Khám phá" ? repeatedExplore : item)),
      period(2, goodActivities().map((item) => item.phase === "Khám phá"
        ? { ...repeatedExplore, id: "explore-2" }
        : { ...item, id: `${item.id}-2` })),
    ]);

    expect(codes(value)).toContain("PHASE-QUALITY-05");
  });

  it("adds phase-quality findings to the pedagogy audit", () => {
    const input = makeInput({ subject: "Đạo đức", lessonTitle: "Giữ lời hứa" });
    const value = lesson([period(1, [
      ...goodActivities().slice(0, 3),
      activity({
        id: "apply",
        phase: "Vận dụng",
        title: "Nhắc lại",
        teacherActions: ["GV yêu cầu HS nhắc lại kiến thức vừa học."],
        studentActions: ["HS nhắc lại kiến thức."],
        learningProducts: ["Câu nhắc lại kiến thức."],
      }),
    ])]);

    const audit = buildPedagogyAudit(value, input, false);
    expect(audit.findings?.map((finding) => finding.code)).toContain("PHASE-QUALITY-04");
  });
});
