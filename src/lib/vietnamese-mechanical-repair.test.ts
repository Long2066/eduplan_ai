import { describe, expect, it } from "vitest";
import { applyVietnameseMechanicalRepair, vietnameseAiRepairFindings } from "@/lib/vietnamese-mechanical-repair";
import { makeInput, makeLesson } from "@/lib/vietnamese-fixtures";
import type { LessonActivity, PedagogyAuditFinding } from "@/types/lesson";

function finding(code: string, severity: PedagogyAuditFinding["severity"] = "error"): PedagogyAuditFinding {
  return { code, severity, autoFixable: true, message: code };
}

function spellingActivity(overrides: Partial<LessonActivity> = {}): LessonActivity {
  return {
    phase: "Luyện tập",
    title: "Nghe - viết đoạn chính tả",
    objective: "Viết chính tả phù hợp.: thực hiện được qua câu trả lời, bài tập hoặc sản phẩm học tập phù hợp.",
    durationMinutes: 12,
    teacherActions: ["GV đọc đoạn nghe - viết và yêu cầu HS kiểm tra lại SGK bản in."],
    studentActions: ["HS nghe - viết vào vở."],
    learningProducts: ["Bài chính tả."],
    successCriteria: ["Có một bằng chứng là giữ đúng một tiếng khó."],
    supportForStudentsNeedingHelp: ["Học sinh cần hỗ trợ: cung cấp ba từ khóa."],
    extensionForEarlyFinishers: ["Về nhà hỏi người thân thêm một từ khó."],
    ...overrides,
  };
}

describe("vietnamese mechanical repair", () => {
  it("sửa cụm máy móc, lỗi .: và tiêu chí lệch sản phẩm chính tả", () => {
    const lesson = makeLesson({
      activities: [spellingActivity()],
      periodPlans: [{ periodNumber: 1, focus: "Chính tả", activities: [spellingActivity()] }],
    });

    const repaired = applyVietnameseMechanicalRepair(lesson, makeInput({ grade: "Lớp 2" }));
    const activity = repaired.periodPlans?.[0].activities[0];

    expect(activity?.objective).not.toContain(".:");
    expect(activity?.objective).not.toContain("thực hiện được qua");
    expect(activity?.teacherActions.join(" ")).toContain("Ghi chú chuẩn bị");
    expect(activity?.successCriteria).toEqual([
      "Viết đủ đoạn, đúng phần lớn tiếng.",
      "Viết hoa, dùng dấu câu và trình bày sạch.",
    ]);
  });

  it("chỉ giữ phân hóa ở hoạt động trọng tâm và gắn nhãn mở rộng", () => {
    const kickoff = spellingActivity({ phase: "Khởi động", title: "Khởi động" });
    const practice = spellingActivity({ phase: "Luyện tập", title: "Nghe - viết" });
    const lesson = makeLesson({
      activities: [kickoff, practice],
      periodPlans: [{ periodNumber: 1, focus: "Chính tả", activities: [kickoff, practice] }],
    });

    const repaired = applyVietnameseMechanicalRepair(lesson);

    expect(repaired.periodPlans?.[0].activities[0].supportForStudentsNeedingHelp).toEqual([]);
    expect(repaired.periodPlans?.[0].activities[1].extensionForEarlyFinishers?.[0]).toContain("Thực hiện khi còn thời gian");
  });

  it("lọc AI repair chỉ cho lỗi cần hiểu nội dung/sư phạm", () => {
    const selected = vietnameseAiRepairFindings([
      finding("TV-COVERAGE-01"),
      finding("TV-QUALITY-22"),
      finding("TV-QUALITY-39"),
      finding("TV-QUALITY-34", "warning"),
    ]);

    expect(selected.map((item) => item.code)).toEqual(["TV-COVERAGE-01", "TV-QUALITY-39"]);
  });
});
