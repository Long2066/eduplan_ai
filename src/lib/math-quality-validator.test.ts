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

  it("passes a statistics/data-collection math lesson without arithmetic operator equations", () => {
    const statPlan = lesson({
      activities: [
        activity({
          id: "warmup",
          phase: "Khởi động",
          title: "Khởi động: Thu thập thông tin",
          inputOrMaterials: ["Tranh tình huống ném bóng vào rổ"],
          teacherActions: ["GV chiếu bảng ghi chép dấu × và O; hỏi vì sao cần phân loại dữ kiện."],
          studentActions: ["HS đếm bảng ghi chép: Nam có 7 lần, Việt có 10 lần, Mai có 5 lần ném bóng vào rổ."],
          expectedAnswer: "Nam: 7 lần, Việt: 10 lần, Mai: 5 lần.",
        }),
      ],
    });
    expect(codes(statPlan)).not.toContain("MATH-QUALITY-01");
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

  it("does not report MATH-QUALITY-13 on valid multi-term addition like 4 + 4 + 4 = 12", () => {
    const plan = lesson({ activities: [activity({ studentActions: ["HS tính \\(4 + 4 + 4 = 12\\)."], expectedAnswer: "12" })] });
    expect(codes(plan)).not.toContain("MATH-QUALITY-13");
  });

  it("does not report MATH-QUALITY-13 on chained commutative/associative equations or commonErrors examples", () => {
    const plan = lesson({
      activities: [
        activity({
          studentActions: [
            String.raw`HS tính \(746 + 487 = 487 + 746 = 1\,233\) và \((45\,000 + 75\,000) + 25\,000 = 145\,000\).`,
          ],
          commonErrors: [String.raw`HS viết dở \(746 + 487 = 487\) mà quên tính tổng.`],
          teacherFeedback: [String.raw`GV nhắc kết quả là \(1\,233\), không phải \(746 + 487 = 487\).`],
          expectedAnswer: String.raw`\(1\,233\); \(145\,000\)`,
        }),
      ],
    });
    expect(codes(plan)).not.toContain("MATH-QUALITY-13");
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

  it("produces zero blocking errors on a 3-period Grade 4 Math lesson (Bài 24: Tính chất giao hoán và kết hợp của phép cộng)", () => {
    const p1Acts = [
      activity({ id: "p1-warmup", phase: "Khởi động", durationMinutes: 5, teacherActions: ["- GV chiếu tranh tình huống cá voi.", "+ Hãy tính \\(4 + 3\\) và \\(3 + 4\\)?"], studentActions: ["- HS quan sát tranh cá voi.", "+ HS trả lời: \\(4 + 3 = 7\\) và \\(3 + 4 = 7\\)."] }),
      activity({ id: "p1-explore", phase: "Khám phá", durationMinutes: 13, teacherActions: ["- GV chiếu bảng giá trị a, b và yêu cầu HS tính \\(a + b\\), \\(b + a\\).", "+ Em nhận xét gì về \\(746 + 487 = 487 + 746 = 1\\,233\\)?"], studentActions: ["- HS điền bảng giá trị và so sánh.", "+ HS nêu: Khi đổi chỗ các số hạng trong một tổng thì tổng không thay đổi."] }),
      activity({ id: "p1-practice", phase: "Luyện tập", durationMinutes: 12, teacherActions: ["- GV giao Bài 1 và Bài 2 trang 81.", "+ Tìm số thích hợp cho \\(? + 304 = 304 + 1\\,975\\) và \\(56 + 4{,}763 = 4{,}763 + 56 = 4{,}819\\)?"], studentActions: ["- HS làm bài vào vở.", "+ HS trả lời: Số cần điền là \\(1\\,975\\); kết quả bằng \\(4{,}819\\) và kiểm tra lại kết quả."] }),
      activity({ id: "p1-apply", phase: "Vận dụng", durationMinutes: 5, teacherActions: ["- GV nêu bài toán mua bán thực tế trong gia đình."], studentActions: ["- HS tính nhẩm nhanh tiền mua đồ dùng học tập: \\(15\\,000 + 25\\,000 = 40\\,000\\) đồng."] }),
    ];
    const p2Acts = [
      activity({ id: "p2-warmup", phase: "Khởi động", durationMinutes: 5, teacherActions: ["- GV tổ chức trò chơi ghép thẻ số."], studentActions: ["- HS ghép thẻ \\(20 + 80 = 100\\)."] }),
      activity({ id: "p2-explore", phase: "Khám phá", durationMinutes: 13, teacherActions: ["- GV hướng dẫn HS so sánh \\((4 + 3) + 2\\) và \\(4 + (3 + 2)\\) trên sơ đồ."], studentActions: ["- HS tính \\((4 + 3) + 2 = 7 + 2 = 9\\) và \\(4 + (3 + 2) = 4 + 5 = 9\\)."] }),
      activity({ id: "p2-practice", phase: "Luyện tập", durationMinutes: 12, teacherActions: ["- GV giao Bài 2: \\(92 + 74 + 26 = 192\\) và Bài 3 : \\(68 + 207 + 3 = 278\\)."], studentActions: ["- HS nhóm các số hạng có tổng tròn chục, tròn trăm: \\(92 + (74 + 26) = 92 + 100 = 192\\) rồi kiểm tra ngược."] }),
      activity({ id: "p2-apply", phase: "Vận dụng", durationMinutes: 5, teacherActions: ["- GV nêu bài toán thực tế cân nặng thùng hàng ở trường học."], studentActions: ["- HS tính tổng cân nặng: \\((45 + 55) + 38 = 138\\) kg."] }),
    ];
    const p3Acts = [
      activity({ id: "p3-warmup", phase: "Khởi động", durationMinutes: 5, teacherActions: ["- GV cho HS đố vui tính nhẩm."], studentActions: ["- HS trả lời \\(35 + 65 = 100\\)."] }),
      activity({ id: "p3-explore", phase: "Khám phá", durationMinutes: 13, teacherActions: ["- GV hướng dẫn phân tích dữ kiện bài toán có lời văn bằng sơ đồ tóm tắt."], studentActions: ["- HS tóm tắt dữ kiện và nêu phép tính \\(182 + 75 + 218 = (182 + 218) + 75 = 475\\)."] }),
      activity({ id: "p3-practice", phase: "Luyện tập", durationMinutes: 12, teacherActions: ["- GV tổ chức làm phiếu luyện tập tổng hợp."], studentActions: ["- HS tính \\((45\\,000 + 75\\,000) + 25\\,000 = 145\\,000\\) đồng và đối chiếu kết quả."] }),
      activity({ id: "p3-apply", phase: "Vận dụng", durationMinutes: 5, teacherActions: ["- GV giao nhiệm vụ tính quãng đường thực tế ở địa phương."], studentActions: ["- HS tính tổng quãng đường \\(120 + 170 + 80 = 370\\) m."] }),
    ];
    const threePeriodInput: LessonInput = { ...input, lessonTitle: "Bài 24: Tính chất giao hoán và kết hợp của phép cộng", periods: 3, duration: 35 };
    const threePeriodPlan = lesson({
      generalInfo: { subject: "Toán", grade: "Lớp 4", lessonTitle: threePeriodInput.lessonTitle, book: "Kết nối tri thức với cuộc sống", periods: 3, duration: 35 },
      activities: [...p1Acts, ...p2Acts, ...p3Acts],
      periodPlans: [
        { periodNumber: 1, focus: "Tính chất giao hoán", outcomes: lesson().outcomes, activities: p1Acts, handoff: { learned: "Tính chất giao hoán", unresolvedRisks: [], nextBridge: "Sang tiết 2" } },
        { periodNumber: 2, focus: "Tính chất kết hợp", outcomes: lesson().outcomes, activities: p2Acts, handoff: { learned: "Tính chất kết hợp", unresolvedRisks: [], nextBridge: "Sang tiết 3" } },
        { periodNumber: 3, focus: "Luyện tập tổng hợp", outcomes: lesson().outcomes, activities: p3Acts, handoff: { learned: "Vận dụng tính thuận tiện", unresolvedRisks: [], nextBridge: "Bài tiếp theo" } },
      ],
    });
    const audit = buildPedagogyAudit(threePeriodPlan, threePeriodInput, false);
    const blockingErrors = (audit.findings || []).filter((f) => f.severity === "error");
    expect(blockingErrors).toEqual([]);
  });
});
