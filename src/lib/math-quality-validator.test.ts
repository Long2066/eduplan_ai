import { describe, expect, it } from "vitest";
import { validateMathLesson } from "./math-quality-validator";
import { buildPedagogyAudit } from "./subject-checkers";
import type { LessonActivity, LessonInput, LessonPlan, PeriodPlan } from "@/types/lesson";

const input: LessonInput = {
  subject: "Toán",
  grade: "Lớp 4",
  lessonTitle: "Tìm hai số khi biết tổng và hiệu",
  book: "Cánh diều",
  bookVolume: "auto",
  periods: 1,
  duration: 35,
  hometownProvince: "auto",
  localityNote: "",
  studentProfile: "auto",
  teachingEnvironment: "auto",
  facilities: "auto",
  style: "Dạy thật trên lớp",
  specialRequest: "",
  allowAiInference: true,
  enableDigitalCompetency: false,
  uploadedAssets: [],
};

function activity(overrides: Partial<LessonActivity> = {}): LessonActivity {
  return {
    id: "activity",
    phase: "Khám phá",
    title: "Khám phá bài toán",
    objective: "Xác định đúng dữ kiện, yêu cầu và chọn đúng phép tính.",
    durationMinutes: 15,
    inputOrMaterials: ["Bài toán: Tổng hai số là 70, hiệu hai số là 10. Tìm hai số."],
    teacherActions: [
      "GV yêu cầu HS tóm tắt bằng sơ đồ phần bằng nhau, nêu dữ kiện và yêu cầu tìm.",
      "GV hỏi vì sao chọn phép tính rồi hướng dẫn HS kiểm tra ngược kết quả với tổng và hiệu.",
    ],
    studentActions: [
      "HS vẽ sơ đồ, tính số lớn: \\( (70 + 10) : 2 = 40 \\), số bé: \\(70 - 40 = 30\\).",
      "HS đối chiếu kết quả: \\(40 + 30 = 70\\), \\(40 - 30 = 10\\).",
    ],
    learningProducts: ["Sơ đồ, bài giải và đáp số 40; 30."],
    successCriteria: ["Xác định đúng dữ kiện; chọn đúng phép tính; tính đúng, ghi đáp số và kiểm tra được kết quả."],
    expectedAnswer: "Số lớn: 40; số bé: 30.",
    commonErrors: ["Nhầm tổng với hiệu hoặc quên chia 2."],
    teacherFeedback: ["GV gợi ý đối chiếu số phần và thử lại bằng tổng, hiệu."],
    supportForStudentsNeedingHelp: ["Dùng sơ đồ khuyết và câu hỏi từng bước để hỗ trợ HS cần giúp."],
    extensionForEarlyFinishers: ["HS hoàn thành sớm tự đặt đề tương tự và giải bằng cách khác."],
    ...overrides,
  };
}

function lesson(overrides: Partial<LessonPlan> = {}): LessonPlan {
  const activities = [
    activity({ id: "warmup", phase: "Khởi động", title: "Ôn kiến thức nền", durationMinutes: 4, inputOrMaterials: ["Thẻ số 8, 4"], teacherActions: ["GV cho HS ghép thẻ số để nêu tổng, hiệu."], studentActions: ["HS nêu \\(8 + 4 = 12\\) và \\(8 - 4 = 4\\)."], expectedAnswer: "12 và 4." }),
    activity({ id: "explore" }),
    activity({ id: "practice", phase: "Luyện tập", title: "Luyện tập", durationMinutes: 11, inputOrMaterials: ["Tính: \\(36 + 12\\); giải bài tương tự."], expectedAnswer: "\\(36 + 12 = 48\\).", learningProducts: ["Phép tính, bài giải và kết quả 48."] }),
    activity({ id: "apply", phase: "Vận dụng", title: "Vận dụng thực tế", durationMinutes: 5, inputOrMaterials: ["Trong lớp học có 30 quyển vở, chia vào hai ngăn chênh nhau 6 quyển."], teacherActions: ["GV yêu cầu HS giải tình huống thực tế trong lớp học."], studentActions: ["HS lập sơ đồ và nêu cách giải."], expectedAnswer: "Hai ngăn có 18 và 12 quyển.", learningProducts: ["Sơ đồ và đáp số 18; 12."] }),
  ];
  return {
    generalInfo: { subject: "Toán", grade: "Lớp 4", lessonTitle: input.lessonTitle, book: input.book, periods: 1, duration: 35 },
    outcomes: { generalCompetencies: ["Tự chủ."], specificCompetencies: ["Tư duy toán học."], qualities: ["Chăm chỉ."], knowledgeAndSkills: ["Xác định đúng dữ kiện và giải được bài toán."] },
    materials: { teacher: ["Bảng, sơ đồ."], students: ["Bảng con."] },
    activities,
    assessment: { criteria: ["Xác định đúng dữ kiện; chọn đúng phép tính; giải thích được cách làm; kiểm tra được kết quả."], evidence: ["Sơ đồ và bài giải."], comments: [] },
    adjustments: { suitablePoints: [], pointsToAdjust: [], nextLessonDirection: [] },
    contextFit: { notes: [] },
    meta: { style: "Dạy thật trên lớp", modelUsed: "test", createdAt: "2026-01-01T00:00:00.000Z" },
    ...overrides,
  };
}

function codes(plan: LessonPlan, customInput: LessonInput = input) {
  return validateMathLesson(plan, customInput).map((finding) => finding.code);
}

describe("validateMathLesson", () => {
  it("passes a concrete, represented and assessable math lesson", () => {
    const findings = validateMathLesson(lesson(), input);
    expect(findings.filter((finding) => finding.code.startsWith("MATH-QUALITY"))).toEqual([]);
  });

  it("reports generic math content without data or an actual calculation", () => {
    const plan = lesson({ activities: [activity({ inputOrMaterials: [], teacherActions: ["GV yêu cầu HS làm bài trong SGK."], studentActions: ["HS làm bài."], expectedAnswer: undefined })] });
    expect(codes(plan)).toContain("MATH-QUALITY-01");
  });

  it("reports invalid or undelimited formulas at the activity location", () => {
    const plan = lesson({ activities: [activity({ id: "bad-latex", studentActions: ["HS tính 36 + 12 = 48."], expectedAnswer: "48" })] });
    const finding = validateMathLesson(plan, input).find((item) => item.code === "MATH-QUALITY-02");
    expect(finding).toMatchObject({ activityId: "bad-latex", activityIndex: 0, severity: "error", autoFixable: true });
  });

  it("reports a task with no expected answer and no math product", () => {
    const plan = lesson({ activities: [activity({ expectedAnswer: undefined, acceptableResponses: [], learningProducts: ["Sản phẩm học tập."], teacherActions: ["GV yêu cầu HS tính và giải nhiệm vụ."], studentActions: ["HS thực hiện nhiệm vụ."], commonErrors: [], teacherFeedback: [] })] });
    expect(codes(plan)).toEqual(expect.arrayContaining(["MATH-QUALITY-03", "MATH-QUALITY-08"]));
  });

  it("reports missing representation, relation reasoning and differentiation", () => {
    const plan = lesson({ activities: [activity({ title: "Hoạt động cộng", objective: "Thực hiện phép cộng.", teacherActions: ["GV cho HS thực hiện \\(12 + 8\\)."], studentActions: ["HS tính và ghi 20."], inputOrMaterials: ["Bài 1: \\(12 + 8\\)."], learningProducts: ["Kết quả 20."], successCriteria: ["Tính đúng."], commonErrors: ["Nhầm kết quả."], teacherFeedback: ["GV cho HS làm lại từng bước."], supportForStudentsNeedingHelp: [], extensionForEarlyFinishers: [] })] });
    expect(codes(plan)).toEqual(expect.arrayContaining(["MATH-QUALITY-04", "MATH-QUALITY-05", "MATH-QUALITY-10"]));
  });

  it("reports missing misconception feedback and result checking", () => {
    const plan = lesson({ activities: [activity({ title: "Hoạt động cộng", objective: "Thực hiện phép cộng.", commonErrors: [], teacherFeedback: [], errorFeedback: [], teacherActions: ["GV giao phép tính \\(17 + 25\\)."], studentActions: ["HS tính."], expectedAnswer: "42", successCriteria: ["Tính đúng."] })] });
    expect(codes(plan)).toEqual(expect.arrayContaining(["MATH-QUALITY-06", "MATH-QUALITY-07"]));
  });

  it("reports math criteria that are not observable", () => {
    const plan = lesson({ assessment: { criteria: ["HS hoàn thành yêu cầu học tập trọng tâm."], evidence: [], comments: [] }, activities: [activity({ successCriteria: [] })] });
    expect(codes(plan)).toContain("MATH-QUALITY-09");
  });

  it("reports application without a real-life context", () => {
    const plan = lesson();
    plan.activities[3] = activity({ phase: "Vận dụng", title: "Vận dụng", teacherActions: ["GV cho HS làm thêm phép tính \\(20 + 15\\)."], studentActions: ["HS tính."], inputOrMaterials: ["Tính \\(20 + 15\\)."], expectedAnswer: "35" });
    expect(codes(plan)).toContain("MATH-QUALITY-11");
  });

  it("reports content beyond the selected grade band", () => {
    const gradeOneInput = { ...input, grade: "Lớp 1" };
    const plan = lesson({ generalInfo: { ...lesson().generalInfo, grade: "Lớp 1" }, activities: [activity({ inputOrMaterials: ["Tính tỉ số phần trăm và thể tích khối hộp."], studentActions: ["HS dùng công thức \\(V = a \\times b \\times c\\)."] })] });
    expect(codes(plan, gradeOneInput)).toContain("MATH-QUALITY-12");
  });

  it("reports a wrong equation or mismatched numeric answer", () => {
    const plan = lesson({ activities: [activity({ studentActions: ["HS tính \\(12 + 8 = 25\\)."], expectedAnswer: "Kết quả: 25." })] });
    expect(codes(plan)).toContain("MATH-QUALITY-13");
  });

  it("reports when warm-up leaks the core problem and presents a formula too early", () => {
    const activities = lesson().activities;
    activities[0] = activity({ phase: "Khởi động", title: "Khởi động", objective: "Nhận ra công thức tính.", inputOrMaterials: ["Bài toán có tổng 70 và hiệu 10."], teacherActions: ["GV nêu công thức S = a × b và yêu cầu tính với 70, 10."], studentActions: ["HS giải bài."], expectedAnswer: "40 và 30", learningProducts: ["Kết quả 40 và 30."], successCriteria: ["Tính đúng."] });
    expect(codes(lesson({ activities }))).toEqual(expect.arrayContaining(["MATH-QUALITY-14", "MATH-QUALITY-15"]));
  });

  it("checks each period independently and preserves period/activity location", () => {
    const periodOne: PeriodPlan = { periodNumber: 1, focus: "Ôn tập chung", outcomes: lesson().outcomes, activities: [activity({ inputOrMaterials: [], teacherActions: ["GV hướng dẫn."], studentActions: ["HS làm bài."], expectedAnswer: undefined })] };
    const periodTwo: PeriodPlan = { periodNumber: 2, focus: "Bài toán tổng hiệu", outcomes: lesson().outcomes, activities: lesson().activities };
    const findings = validateMathLesson(lesson({ periodPlans: [periodOne, periodTwo] }), { ...input, periods: 2 });
    expect(findings.find((finding) => finding.code === "MATH-QUALITY-01")).toMatchObject({ periodNumber: 1 });
    expect(findings.some((finding) => finding.code === "MATH-QUALITY-01" && finding.periodNumber === 2)).toBe(false);
  });

  it("does not claim textbook mismatch when source evidence is unavailable", () => {
    const plan = lesson({ materials: { teacher: ["SGK trang 25."], students: ["SGK."] } });
    const finding = validateMathLesson(plan, input).find((item) => item.code === "MATH-QUALITY-16");
    expect(finding).toMatchObject({ severity: "suggestion", autoFixable: false });
    expect(finding?.sources?.[0]).toMatchObject({ verificationStatus: "unavailable" });
    expect(finding?.message).toMatch(/chưa thể kết luận/i);
    expect(finding?.message).not.toMatch(/(?:sai|không khớp nguồn)/i);
  });

  it("does not run for Vietnamese lessons", () => {
    const vietnameseInput = { ...input, subject: "Tiếng Việt" };
    expect(validateMathLesson(lesson(), vietnameseInput)).toEqual([]);
  });

  it("is integrated into structured findings without replacing legacy issues", () => {
    const weak = lesson({ activities: [activity({ inputOrMaterials: [], teacherActions: ["GV hướng dẫn."], studentActions: ["HS làm bài."], expectedAnswer: undefined })] });
    const audit = buildPedagogyAudit(weak, input, false);
    expect(audit.findings?.some((finding) => finding.code === "MATH-QUALITY-01")).toBe(true);
    expect(Array.isArray(audit.issues)).toBe(true);
  });
});
