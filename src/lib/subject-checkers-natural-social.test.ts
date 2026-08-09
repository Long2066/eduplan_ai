import { describe, expect, it } from "vitest";
import { buildPedagogyAudit, periodHasRequiredPhases, subjectPedagogyIssues } from "./subject-checkers";
import { makeInput } from "./vietnamese-fixtures";
import type { LessonPlan } from "@/types/lesson";

function naturalSocialLesson(): LessonPlan {
  return {
    generalInfo: {
      subject: "Tự nhiên và Xã hội",
      grade: "Lớp 2",
      lessonTitle: "Chăm sóc cây trồng",
      periods: 1,
      duration: 35,
    },
    outcomes: {
      generalCompetencies: ["Tự chủ và tự học: nhận nhiệm vụ quan sát cây/tranh và hoàn thành phiếu học tập."],
      specificCompetencies: ["Nhận thức khoa học: quan sát, mô tả và phân loại được việc nên làm khi chăm sóc cây."],
      qualities: ["Trách nhiệm: biết chăm sóc và bảo vệ cây ở lớp, ở nhà bằng việc làm vừa sức."],
      knowledgeAndSkills: [
        "Quan sát được bộ phận chính của cây qua tranh hoặc cây thật.",
        "Mô tả được đặc điểm nổi bật của cây bằng lời hoặc phiếu học tập.",
        "Phân loại được việc nên làm và chưa nên làm khi chăm sóc cây.",
        "Nêu được hành động chăm sóc, bảo vệ cây ở nhà hoặc ở trường.",
      ],
    },
    materials: { teacher: ["Tranh SGK", "Cây thật an toàn"], students: ["Phiếu quan sát"] },
    activities: [
      {
        phase: "Khởi động",
        title: "Nhìn lá đoán cây",
        objective: "Khơi gợi kinh nghiệm quan sát cây.",
        durationMinutes: 4,
        teacherActions: ["GV cho HS quan sát tranh lá/cây và hỏi: Con thấy gì?"],
        studentActions: ["HS quan sát tranh và nêu đặc điểm nhìn thấy."],
        learningProducts: ["Câu trả lời quan sát ban đầu"],
        successCriteria: ["Nêu được một đặc điểm quan sát được."],
      },
      {
        phase: "Khám phá",
        title: "Phiếu quan sát cây",
        objective: "Quan sát, mô tả đặc điểm chính của cây.",
        durationMinutes: 16,
        teacherActions: ["GV cho HS quan sát cây thật/tranh SGK, ghi bằng chứng vào phiếu: rễ, thân, lá, màu sắc.", "GV hỏi: Các cây giống và khác nhau ở điểm nào?"],
        studentActions: ["HS quan sát, ghi lại đặc điểm vào phiếu.", "HS so sánh theo tiêu chí bộ phận và màu sắc."],
        learningProducts: ["Phiếu quan sát cây"],
        successCriteria: ["Quan sát được đặc điểm chính.", "Mô tả được bằng chứng từ tranh/cây."],
        supportForStudentsNeedingHelp: ["GV cho HS chọn thẻ gợi ý bộ phận cây."],
        extensionForEarlyFinishers: ["HS tìm thêm một cây quen thuộc và nêu điểm khác."],
      },
      {
        phase: "Luyện tập",
        title: "Phân loại việc chăm cây",
        objective: "Phân loại việc nên làm/chưa nên làm khi chăm sóc cây.",
        durationMinutes: 10,
        teacherActions: ["GV yêu cầu HS xếp thẻ vào bảng hai cột theo tiêu chí nên làm/chưa nên làm."],
        studentActions: ["HS phân loại thẻ, trình bày lý do và nhận xét nhóm bạn."],
        learningProducts: ["Bảng phân loại việc chăm sóc cây"],
        successCriteria: ["Phân loại đúng theo tiêu chí.", "Nêu được lý do đơn giản."],
        supportForStudentsNeedingHelp: ["GV đọc từng thẻ và hỏi việc này giúp hay hại cây."],
        extensionForEarlyFinishers: ["HS đề xuất thêm một việc chăm cây an toàn."],
      },
      {
        phase: "Vận dụng",
        title: "Một việc em làm cho cây",
        objective: "Chọn hành động chăm sóc và bảo vệ cây.",
        durationMinutes: 5,
        teacherActions: ["GV yêu cầu HS chọn một việc nên làm ở nhà hoặc ở trường để chăm sóc, bảo vệ cây an toàn."],
        studentActions: ["HS nói cam kết: tưới cây vừa đủ, không bẻ cành hoặc nhắc bạn bảo vệ cây."],
        learningProducts: ["Cam kết hành động chăm sóc cây"],
        successCriteria: ["Nêu được việc làm cụ thể.", "Việc làm an toàn và vừa sức."],
      },
    ],
    assessment: {
      criteria: ["Quan sát được đặc điểm cây.", "Phân loại được việc nên làm/chưa nên làm.", "Nêu được hành động chăm sóc cây vừa sức."],
      evidence: ["Phiếu quan sát", "Bảng phân loại", "Cam kết hành động"],
      comments: ["Nhận xét dựa trên sản phẩm học tập."],
    },
    adjustments: { suitablePoints: [], pointsToAdjust: [], nextLessonDirection: [] },
    contextFit: { notes: [] },
    meta: { style: "Dạy thật trên lớp", modelUsed: "test", createdAt: "2026-08-02T00:00:00.000Z" },
  };
}

describe("subject-checkers – Tự nhiên và Xã hội", () => {
  it("adds natural-social classification metadata to audit", () => {
    const input = makeInput({ subject: "Tự nhiên và Xã hội", grade: "Lớp 2", lessonTitle: "Chăm sóc cây trồng" });
    const audit = buildPedagogyAudit(naturalSocialLesson(), input, false);

    expect(audit.lessonType).toBe("plants-animals");
    expect(audit.classificationConfidence).toBeTruthy();
    expect(audit.checks.join(" ")).toContain("đối tượng quan sát");
  });

  it("keeps subject pedagogy issues focused on observation and action", () => {
    const input = makeInput({ subject: "Tự nhiên và Xã hội", grade: "Lớp 2", lessonTitle: "Chăm sóc cây trồng" });
    const issues = subjectPedagogyIssues(naturalSocialLesson(), input);

    expect(issues.filter((issue) => issue.includes("Tự nhiên và Xã hội"))).toHaveLength(0);
  });

  it("keeps all four phases when activity titles contain other phase keywords", () => {
    const candidate = naturalSocialLesson();
    candidate.activities[2] = { ...candidate.activities[2], title: "Luyện tập: Cùng khám phá trường học" };
    candidate.activities[3] = { ...candidate.activities[3], title: "Vận dụng sau hoạt động khám phá trường học" };

    expect(periodHasRequiredPhases(candidate.activities)).toBe(true);
  });
});
