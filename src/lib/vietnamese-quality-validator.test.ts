import { describe, expect, it } from "vitest";
import { validateVietnameseLesson } from "@/lib/vietnamese-quality-validator";
import { classifyVietnameseLesson } from "@/lib/vietnamese-pedagogy";
import { makeInput, makeLesson } from "@/lib/vietnamese-fixtures";
import type { LessonActivity, LessonInput, LessonPlan, VietnameseLessonType } from "@/types/lesson";

function activity(overrides: Partial<LessonActivity> = {}): LessonActivity {
  return {
    phase: "Khám phá",
    title: "Hoạt động Tiếng Việt",
    objective: "Nêu được ý trả lời theo nhiệm vụ.",
    durationMinutes: 8,
    teacherActions: ["GV hướng dẫn và phản hồi, sửa lỗi cho HS."],
    studentActions: ["HS thực hiện nhiệm vụ và nêu đáp án: kết quả phù hợp."],
    learningProducts: ["Sản phẩm ngôn ngữ cụ thể."],
    successCriteria: ["Thực hiện đúng yêu cầu."],
    commonErrors: ["HS dễ nhầm nội dung trọng tâm."],
    teacherFeedback: ["GV gợi ý để HS đối chiếu và sửa lỗi."],
    expectedAnswer: "Đáp án dự kiến phù hợp ngữ liệu.",
    ...overrides,
  };
}

function lessonFor(title: string, grade: string, activities: LessonActivity[], criteria: string[]): LessonPlan {
  return makeLesson({
    generalInfo: { subject: "Tiếng Việt", grade, lessonTitle: title, periods: 1, duration: 35 },
    activities,
    assessment: { criteria, evidence: ["Sản phẩm học tập"], comments: ["Phản hồi cụ thể"] },
  });
}

function inputFor(title: string, grade: string): LessonInput {
  return makeInput({ lessonTitle: title, grade, periods: 1 });
}

function codes(lesson: LessonPlan, input: LessonInput) {
  return validateVietnameseLesson(lesson, input).map((finding) => finding.code);
}

function expectTypeLocked(input: LessonInput, lesson: LessonPlan, type: VietnameseLessonType) {
  const findings = validateVietnameseLesson(lesson, input);
  expect(findings.find((finding) => finding.code === "TV-QUALITY-12"), JSON.stringify(findings)).toBeUndefined();
  expect(type).not.toBe("mixed");
  return findings;
}

describe("validateVietnameseLesson", () => {
  it("chấp nhận bài đọc đủ ngữ liệu, chuỗi, sản phẩm, tiêu chí và phản hồi", () => {
    const input = inputFor("Bài đọc: Dòng sông", "Lớp 4");
    const lesson = lessonFor(input.lessonTitle, input.grade, [
      activity({
        phase: "Khởi động",
        teacherActions: ["GV cho HS quan sát tranh và dự đoán nội dung bài đọc: Dòng sông."],
        studentActions: ["HS quan sát tranh và nêu dự đoán."],
      }),
      activity({
        phase: "Khám phá",
        inputOrMaterials: ["Bài đọc: Dòng sông quê em."],
        teacherActions: ["GV đọc mẫu, hướng dẫn đọc nối tiếp và giải nghĩa từ trong ngữ cảnh."],
        studentActions: ["HS luyện đọc và tìm chi tiết: dòng sông uốn quanh làng."],
        learningProducts: ["Phần đọc đúng, rõ và câu trả lời có chi tiết."],
        successCriteria: ["Đọc đúng, rõ, ngắt nghỉ phù hợp; tìm được chi tiết."],
      }),
      activity({
        phase: "Luyện tập",
        teacherActions: ["GV hỏi: Ý chính của bài là gì? Yêu cầu nêu bằng chứng."],
        studentActions: ["HS nêu đáp án: bài ca ngợi vẻ đẹp dòng sông quê."],
        learningProducts: ["Câu trả lời nêu ý chính và bằng chứng."],
        successCriteria: ["Nêu được ý chính dựa trên văn bản."],
      }),
      activity({
        phase: "Vận dụng",
        teacherActions: ["GV yêu cầu HS nêu cảm nhận và liên hệ bản thân."],
        studentActions: ["HS nêu cảm nhận về dòng sông quê."],
      }),
    ], ["Đọc đúng, rõ, ngắt nghỉ phù hợp; tìm được chi tiết; nêu được ý chính."]);
    expect(expectTypeLocked(input, lesson, "reading")).toEqual([]);
  });

  const cases: Array<{
    name: string;
    type: Exclude<VietnameseLessonType, "mixed" | "reading">;
    title: string;
    grade: string;
    text: string;
    product: string;
    criterion: string;
  }> = [
    {
      name: "học âm-vần",
      type: "phonics",
      title: "Bài 5. Âm e, ê",
      grade: "Lớp 1",
      text: "GV cho HS nghe và nhận diện âm e, ê; phân tích cấu tạo tiếng bé gồm âm đầu b, vần e, thanh sắc; ghép tiếng, đánh vần, đọc tiếng từ; viết chữ e, tiếng bé trên bảng con; dùng từ mới đặt câu trong ngữ cảnh.",
      product: "Tiếng, từ đọc đúng; chữ e viết đúng; câu nói có từ mới.",
      criterion: "Đọc đúng, ghép được tiếng và viết đúng chữ.",
    },
    {
      name: "tập viết",
      type: "handwriting",
      title: "Tập viết: Chữ hoa A",
      grade: "Lớp 2",
      text: "GV cho HS quan sát mẫu chữ A, phân tích nét, điểm đặt bút, dừng bút, cỡ chữ và dòng kẻ; GV viết mẫu; HS luyện viết bảng con rồi viết vào vở; đối chiếu và tự soát, sửa tư thế cầm bút.",
      product: "Chữ viết đúng mẫu và tư thế đúng.",
      criterion: "Viết đúng mẫu, đúng cỡ, đúng dòng kẻ và khoảng cách.",
    },
    {
      name: "chính tả",
      type: "spelling",
      title: "Chính tả: Nghe - viết",
      grade: "Lớp 2",
      text: "GV nêu đoạn viết: Mùa xuân về; cho tìm từ khó, phân tích âm vần ch/tr; tổ chức nghe-viết; HS tự soát lỗi, đổi vở; làm bài tập chính tả phân biệt ch/tr; sửa lỗi cá nhân và ghi nhớ từ khó vào sổ tay.",
      product: "Bài chính tả, bài tập phân biệt và danh sách từ khó.",
      criterion: "Viết đúng chính tả, tự phát hiện sửa lỗi và phân biệt đúng ch/tr.",
    },
    {
      name: "viết đoạn-bài",
      type: "composition",
      title: "Tập làm văn: Viết đoạn văn",
      grade: "Lớp 3",
      text: "GV cho HS đọc đề và phân tích yêu cầu; HS tìm ý, lập ý bằng sơ đồ ý; viết đoạn 5-7 câu; đọc lại, chỉnh sửa và góp ý; chia sẻ sản phẩm viết trước lớp.",
      product: "Sơ đồ ý, đoạn bài viết và bản chỉnh sửa.",
      criterion: "Viết đúng yêu cầu, đủ ý, đúng trình tự, ngữ pháp và dấu câu; có chỉnh sửa.",
    },
    {
      name: "luyện từ và câu",
      type: "language-knowledge",
      title: "Luyện từ và câu: Danh từ",
      grade: "Lớp 4",
      text: "GV đưa ngữ liệu: Em yêu dòng sông; HS quan sát từ, nhận xét, so sánh và phát hiện đặc điểm; GV chốt quy tắc ghi nhớ; HS tìm, phân loại, xác định danh từ; đặt câu và sửa lỗi dùng từ trong ngữ cảnh mới.",
      product: "Bài tập, câu đặt đúng và bảng phân loại.",
      criterion: "Nhận diện đúng, phân loại đúng, sử dụng đúng và sửa được lỗi.",
    },
    {
      name: "nói và nghe",
      type: "speaking-listening",
      title: "Nói và nghe: Kể chuyện",
      grade: "Lớp 3",
      text: "HS chuẩn bị nội dung và tiêu chí nói nghe; kể chuyện theo lượt; người nghe ghi chú, hỏi lại và nhận xét phần nói; người nói phản hồi, tự điều chỉnh rồi nói lại sau góp ý.",
      product: "Phần trình bày nói, câu hỏi phản hồi và phiếu tự đánh giá.",
      criterion: "Nói đủ ý, rõ ràng, đúng trình tự; hỏi lại và nhận xét phù hợp; biết điều chỉnh.",
    },
  ];

  for (const item of cases) {
    it(`chấp nhận chuỗi chuyên môn đầy đủ: ${item.name}`, () => {
      const input = inputFor(item.title, item.grade);
      const lesson = lessonFor(item.title, item.grade, [
        activity({
          phase: "Khám phá",
          inputOrMaterials: [item.text],
          teacherActions: [`GV hướng dẫn: ${item.text}`],
          studentActions: [`HS thực hiện: ${item.text}`],
          learningProducts: [item.product],
          successCriteria: [item.criterion],
        }),
        activity({ phase: "Luyện tập", inputOrMaterials: [item.text], teacherActions: [item.text], studentActions: [item.text], learningProducts: [item.product], successCriteria: [item.criterion] }),
      ], [item.criterion]);
      const findings = expectTypeLocked(input, lesson, item.type);
      expect(findings.filter((finding) => ["TV-QUALITY-03", "TV-QUALITY-04", "TV-QUALITY-05"].includes(finding.code))).toEqual([]);
    });
  }

  it("phát hiện bài đọc chỉ tham chiếu SGK và thiếu ngữ liệu cụ thể", () => {
    const input = inputFor("Bài đọc: Cây bàng", "Lớp 3");
    const lesson = lessonFor(input.lessonTitle, input.grade, [
      activity({ inputOrMaterials: [], teacherActions: ["GV yêu cầu HS xem SGK và làm bài trong SGK."], studentActions: ["HS làm bài theo SGK trang 20."], expectedAnswer: "" }),
    ], ["Đọc đúng."]);
    const result = codes(lesson, input);
    expect(result).toContain("TV-QUALITY-01");
    expect(result).toContain("TV-QUALITY-02");
  });

  it("phát hiện thiếu mắt xích, sản phẩm và tiêu chí đặc trưng", () => {
    const input = inputFor("Chính tả: Nghe - viết", "Lớp 2");
    const lesson = lessonFor(input.lessonTitle, input.grade, [activity({
      inputOrMaterials: ["Đoạn viết: Mùa xuân về."],
      teacherActions: ["GV đọc đoạn chính tả."],
      studentActions: ["HS nghe viết."],
      learningProducts: ["Sản phẩm học tập."],
      successCriteria: ["Hoàn thành nhiệm vụ."],
    })], ["Hoàn thành nhiệm vụ."]);
    const result = codes(lesson, input);
    expect(result).toContain("TV-QUALITY-03");
    expect(result).toContain("TV-QUALITY-04");
    expect(result).toContain("TV-QUALITY-05");
  });

  it("phát hiện thiếu lỗi thường gặp và phản hồi ở hoạt động trọng tâm", () => {
    const input = inputFor("Bài đọc: Cây bàng", "Lớp 3");
    const lesson = lessonFor(input.lessonTitle, input.grade, [activity({
      inputOrMaterials: ["Bài đọc: Cây bàng trước sân trường."],
      commonErrors: [],
      teacherFeedback: [],
      errorFeedback: [],
      teacherActions: ["GV hướng dẫn HS đọc bài."],
    })], ["Đọc đúng, rõ."]);
    expect(codes(lesson, input)).toContain("TV-QUALITY-06");
  });

  it("phát hiện câu hỏi thiếu đáp án dự kiến", () => {
    const input = inputFor("Bài đọc: Cây bàng", "Lớp 3");
    const lesson = lessonFor(input.lessonTitle, input.grade, [activity({
      inputOrMaterials: ["Bài đọc: Cây bàng trước sân trường."],
      teacherActions: ["GV hỏi: Chi tiết nào tả cây bàng?"],
      studentActions: ["HS trả lời câu hỏi."],
      expectedAnswer: "",
      acceptableResponses: [],
    })], ["Tìm được chi tiết."]);
    expect(codes(lesson, input)).toContain("TV-QUALITY-07");
  });

  it("phát hiện yêu cầu viết vượt mức lớp 1", () => {
    const input = inputFor("Tập làm văn: Viết đoạn văn", "Lớp 1");
    const text = "Đọc đề, phân tích yêu cầu, tìm ý, lập dàn ý, viết đoạn 5-7 câu, đọc lại chỉnh sửa và chia sẻ sản phẩm viết.";
    const lesson = lessonFor(input.lessonTitle, input.grade, [activity({ inputOrMaterials: [text], teacherActions: [text], studentActions: [text], learningProducts: ["Đoạn bài viết"], successCriteria: ["Viết đúng yêu cầu, đủ ý, có chỉnh sửa"] })], ["Viết đúng yêu cầu, đủ ý, có chỉnh sửa"]);
    expect(codes(lesson, input)).toContain("TV-QUALITY-08");
  });

  it("phát hiện nhồi nhiều kỹ năng không liên quan", () => {
    const input = inputFor("Chính tả: Nghe - viết", "Lớp 2");
    const text = "Đoạn viết: Mùa xuân. HS tìm từ khó, nghe-viết, soát lỗi, làm bài tập chính tả, sửa lỗi; đồng thời đọc hiểu nêu ý chính, lập dàn ý viết đoạn và thuyết trình kể chuyện.";
    const lesson = lessonFor(input.lessonTitle, input.grade, [activity({ inputOrMaterials: [text], teacherActions: [text], studentActions: [text], learningProducts: ["Bài chính tả"], successCriteria: ["Viết đúng chính tả"] })], ["Viết đúng chính tả"]);
    expect(codes(lesson, input)).toContain("TV-QUALITY-09");
  });

  it("phát hiện bài nói-nghe thiếu nhiệm vụ cho người nghe", () => {
    const input = inputFor("Nói và nghe: Kể chuyện", "Lớp 3");
    const text = "HS chuẩn bị ý và tiêu chí nói; kể chuyện theo lượt trước lớp; sau đó tự điều chỉnh cách nói.";
    const lesson = lessonFor(input.lessonTitle, input.grade, [activity({ inputOrMaterials: ["Tranh: câu chuyện về tình bạn."], teacherActions: [text], studentActions: [text], learningProducts: ["Phần trình bày nói"], successCriteria: ["Nói đủ ý, rõ ràng"] })], ["Nói đủ ý, rõ ràng"]);
    expect(codes(lesson, input)).toContain("TV-QUALITY-10");
  });

  it("phát hiện HS thụ động khi GV giao nhiệm vụ ngôn ngữ", () => {
    const input = inputFor("Bài đọc: Cây bàng", "Lớp 3");
    const lesson = lessonFor(input.lessonTitle, input.grade, [activity({
      inputOrMaterials: ["Bài đọc: Cây bàng trước sân trường."],
      teacherActions: ["GV yêu cầu HS đọc và tìm chi tiết."],
      studentActions: ["HS lắng nghe."],
    })], ["Đọc đúng, tìm được chi tiết."]);
    expect(codes(lesson, input)).toContain("TV-QUALITY-11");
  });

  it("chỉ áp dụng kiểm tra phổ quát khi classifier mixed/low", () => {
    const input = inputFor("Bài ôn tập", "Lớp 3");
    const neutralActivity: LessonActivity = {
      phase: "Khởi động",
      title: "Ôn tập",
      objective: "Ôn tập nội dung tuần 5.",
      durationMinutes: 35,
      teacherActions: ["GV tổ chức hoạt động ôn tập."],
      studentActions: ["HS tham gia hoạt động."],
      learningProducts: ["Kết quả ôn tập."],
      inputOrMaterials: ["Ngữ liệu: Ôn tập tuần 5."],
    };
    const lesson = lessonFor(input.lessonTitle, input.grade, [neutralActivity], ["Thực hiện đúng yêu cầu."]);
    const result = codes(lesson, input);
    expect(result).toContain("TV-QUALITY-12");
    expect(result).not.toContain("TV-QUALITY-03");
  });

  it("không chạy cho môn khác", () => {
    const input = { ...makeInput(), subject: "Toán", lessonTitle: "Phép cộng" };
    const lesson = makeLesson({ generalInfo: { subject: "Toán", grade: "Lớp 3", lessonTitle: "Phép cộng", periods: 1, duration: 35 } });
    expect(validateVietnameseLesson(lesson, input)).toEqual([]);
  });

  it("phân loại và kiểm tra riêng từng tiết trong bài tích hợp", () => {
    const input = makeInput({ lessonTitle: "Bài 8", grade: "Lớp 3", periods: 2 });
    const readingText = "Bài đọc: Dòng sông. Quan sát tranh và dự đoán; đọc nối tiếp; tìm chi tiết, giải nghĩa từ; nêu ý chính, cảm nhận và liên hệ bản thân.";
    const spellingText = "Chính tả nghe-viết. Đoạn viết: Mùa xuân về. Tìm từ khó, phân tích âm vần; nghe-viết; tự soát lỗi, làm bài tập chính tả phân biệt ch/tr; sửa lỗi và ghi nhớ.";
    const readingActivity = activity({ inputOrMaterials: [readingText], teacherActions: [readingText], studentActions: [readingText], learningProducts: ["Phần đọc đúng, câu trả lời chi tiết và ý chính"], successCriteria: ["Đọc đúng, tìm được chi tiết, nêu được ý chính"] });
    const spellingActivity = activity({ inputOrMaterials: [spellingText], teacherActions: [spellingText], studentActions: [spellingText], learningProducts: ["Bài chính tả và bài tập phân biệt"], successCriteria: ["Viết đúng chính tả, tự sửa lỗi và phân biệt đúng ch/tr"] });
    const lesson = makeLesson({
      generalInfo: { subject: "Tiếng Việt", grade: "Lớp 3", lessonTitle: input.lessonTitle, periods: 2, duration: 35 },
      periodPlans: [
        { periodNumber: 1, focus: "Bài đọc: Dòng sông", activities: [readingActivity] },
        { periodNumber: 2, focus: "Chính tả: Nghe-viết", activities: [spellingActivity] },
      ],
      activities: [readingActivity, spellingActivity],
      assessment: { criteria: ["Đọc đúng, tìm được chi tiết, nêu được ý chính; viết đúng chính tả, tự sửa lỗi, phân biệt đúng."], evidence: [], comments: [] },
    });

    expect(classifyVietnameseLesson({ ...input, lessonTitle: "Bài đọc: Dòng sông" }, readingText).primaryType).toBe("reading");
    expect(classifyVietnameseLesson({ ...input, lessonTitle: "Chính tả: Nghe-viết" }, spellingText).primaryType).toBe("spelling");
    const findings = validateVietnameseLesson(lesson, input);
    expect(findings.filter((finding) => finding.code === "TV-QUALITY-03")).toEqual([]);
    expect(findings.filter((finding) => finding.code === "TV-QUALITY-12")).toEqual([]);
  });

  it("định vị finding đúng tiết trong giáo án nhiều tiết", () => {
    const input = makeInput({ lessonTitle: "Bài đọc: Dòng sông", grade: "Lớp 4", periods: 2 });
    const good = activity({ inputOrMaterials: ["Bài đọc: Dòng sông quê em."], teacherActions: ["GV đọc mẫu, cho tìm chi tiết, nêu ý chính và liên hệ bản thân."], studentActions: ["HS đọc nối tiếp, tìm chi tiết, nêu ý chính."], learningProducts: ["Phần đọc đúng và câu trả lời chi tiết"], successCriteria: ["Đọc đúng, tìm được chi tiết, nêu được ý chính"] });
    const bad = activity({ inputOrMaterials: [], teacherActions: ["GV yêu cầu xem SGK."], studentActions: ["HS xem SGK."], expectedAnswer: "" });
    const lesson = makeLesson({
      generalInfo: { subject: "Tiếng Việt", grade: "Lớp 4", lessonTitle: input.lessonTitle, periods: 2, duration: 35 },
      periodPlans: [
        { periodNumber: 1, focus: "Đọc", activities: [good] },
        { periodNumber: 2, focus: "Đọc", activities: [bad] },
      ],
      activities: [good, bad],
      assessment: { criteria: ["Đọc đúng, tìm được chi tiết, nêu được ý chính"], evidence: [], comments: [] },
    });
    const materialFinding = validateVietnameseLesson(lesson, input).find((finding) => finding.code === "TV-QUALITY-01");
    expect(materialFinding?.periodNumber).toBe(2);
  });

  it("phát hiện số lượng yêu cầu cần đạt không nằm trong khoảng 4-6 mục", () => {
    const input = inputFor("Bài đọc: Cây bàng", "Lớp 3");
    const lesson = lessonFor(input.lessonTitle, input.grade, [activity()], ["Đọc đúng."]);
    lesson.outcomes.knowledgeAndSkills = ["Đọc đúng.", "Hiểu bài."];
    expect(codes(lesson, input)).toContain("TV-QUALITY-13");
  });

  it("phát hiện kịch bản hội thoại mẫu trong đáp án", () => {
    const input = inputFor("Bài đọc: Cây bàng", "Lớp 3");
    const lesson = lessonFor(input.lessonTitle, input.grade, [activity({
      expectedAnswer: "GV: Con chim sẻ đậu ở đâu? HS: Dạ ở trên cành bàng.",
    })], ["Đọc đúng."]);
    expect(codes(lesson, input)).toContain("TV-QUALITY-14");
  });

  it("phát hiện chèn địa phương/bối cảnh giả định khi chưa cung cấp", () => {
    const input = makeInput({ lessonTitle: "Bài đọc: Cây bàng", hometownProvince: "auto" });
    const lesson = lessonFor(input.lessonTitle, input.grade, [activity({
      teacherActions: ["GV giới thiệu về Hồ Gươm ở Hà Nội và sĩ số lớp 35 em học sinh khá giỏi."],
    })], ["Đọc đúng."]);
    expect(codes(lesson, input)).toContain("TV-QUALITY-15");
  });

  it("phát hiện tiết trả bài thiếu ô chờ [...] hoặc bảng trống", () => {
    const input = inputFor("Trả bài: Viết đoạn văn kể chuyện", "Lớp 3");
    const lesson = lessonFor(input.lessonTitle, input.grade, [activity({
      teacherActions: ["GV nhận xét bài viết của HS và hướng dẫn sửa lỗi chung."],
      studentActions: ["HS sửa lỗi vào vở."],
    })], ["Chỉnh sửa đoạn văn."]);
    expect(codes(lesson, input)).toContain("TV-QUALITY-16");
  });

  it("phát hiện gán sai trường nghĩa đồng nghĩa nhạy cảm", () => {
    const input = inputFor("Luyện từ và câu: Từ đồng nghĩa", "Lớp 3");
    const lesson = lessonFor(input.lessonTitle, input.grade, [activity({
      inputOrMaterials: ["Ngữ liệu: ban mai, sáng sớm, khuân, vác."],
      teacherActions: ["GV yêu cầu HS xếp nhóm từ đồng nghĩa chỉ âm thanh: ban mai, sáng sớm, khuân, vác."],
      studentActions: ["HS phân loại từ và nêu đáp án dự kiến."],
    })], ["Phân loại đúng từ theo nghĩa trong ngữ cảnh."]);
    expect(codes(lesson, input)).toContain("TV-QUALITY-17");
  });

  it("phát hiện yêu cầu cần đạt viết máy móc", () => {
    const input = inputFor("Bài đọc: Cây bàng", "Lớp 3");
    const lesson = lessonFor(input.lessonTitle, input.grade, [activity()], ["Đọc đúng."]);
    lesson.outcomes.knowledgeAndSkills = [
      "Thực hiện được qua nội dung học tập đặc thù của bài đọc.",
      "Đọc đúng và rõ một số câu trong văn bản.",
      "Tìm được chi tiết chính trong văn bản.",
      "Nêu được ý chính bằng lời của mình.",
    ];
    expect(codes(lesson, input)).toContain("TV-QUALITY-18");
  });

  it("phát hiện lặp học liệu riêng giữa nhiều tiết", () => {
    const input = makeInput({ lessonTitle: "Bài 8", grade: "Lớp 3", periods: 2 });
    const repeatedMaterial = "Ngữ liệu: đoạn văn Ban mai trên cánh đồng.";
    const periodOneActivity = activity({ inputOrMaterials: [repeatedMaterial] });
    const periodTwoActivity = activity({ inputOrMaterials: [repeatedMaterial] });
    const lesson = makeLesson({
      generalInfo: { subject: "Tiếng Việt", grade: input.grade, lessonTitle: input.lessonTitle, periods: 2, duration: 35 },
      periodPlans: [
        { periodNumber: 1, focus: "Tiết 1: Đọc", activities: [periodOneActivity] },
        { periodNumber: 2, focus: "Tiết 2: Luyện từ và câu", activities: [periodTwoActivity] },
      ],
      activities: [periodOneActivity, periodTwoActivity],
    });
    expect(codes(lesson, input)).toContain("TV-QUALITY-19");
  });

  it("phát hiện hoạt động có quá nhiều sản phẩm hoặc tiêu chí đánh giá", () => {
    const input = inputFor("Bài đọc: Cây bàng", "Lớp 3");
    const lesson = lessonFor(input.lessonTitle, input.grade, [activity({
      learningProducts: ["Câu trả lời đọc hiểu.", "Phiếu học tập hoàn chỉnh."],
      successCriteria: ["Tìm đúng chi tiết; nêu được bằng chứng; diễn đạt thành câu rõ."],
    })], ["Tìm được chi tiết trong văn bản."]);
    expect(codes(lesson, input)).toContain("TV-QUALITY-20");
  });

  it("phát hiện YCCĐ không bắt đầu bằng động từ đo được", () => {
    const input = inputFor("Bài đọc: Cây bàng", "Lớp 3");
    const lesson = lessonFor(input.lessonTitle, input.grade, [activity()], ["Đọc đúng."]);
    lesson.outcomes.knowledgeAndSkills = [
      "Nắm được nội dung chính của văn bản.",
      "Đọc đúng đoạn văn Cây bàng.",
      "Tìm chi tiết về tán lá trong văn bản.",
      "Nêu cảm nhận về cây bàng.",
    ];
    expect(codes(lesson, input)).toContain("TV-QUALITY-21");
  });

  it("phát hiện dấu câu sai dạng .:", () => {
    const input = inputFor("Bài đọc: Cây bàng", "Lớp 3");
    const lesson = lessonFor(input.lessonTitle, input.grade, [activity({
      teacherActions: ["GV ghi nhiệm vụ.: đọc đoạn văn Cây bàng và tìm chi tiết."],
    })], ["Đọc đúng."]);
    expect(codes(lesson, input)).toContain("TV-QUALITY-22");
  });

  it("phát hiện cột GV/HS lệch trình tự", () => {
    const input = inputFor("Bài đọc: Cây bàng", "Lớp 3");
    const lesson = lessonFor(input.lessonTitle, input.grade, [activity({
      inputOrMaterials: ["Bài đọc: Cây bàng trước sân trường."],
      teacherActions: ["GV yêu cầu HS đọc đoạn văn.", "GV yêu cầu HS tìm chi tiết về tán lá."],
      studentActions: ["HS đọc đoạn văn."],
    })], ["Đọc đúng."]);
    expect(codes(lesson, input)).toContain("TV-QUALITY-23");
  });

  it("phát hiện lặp câu/cụm máy móc", () => {
    const input = inputFor("Bài đọc: Cây bàng", "Lớp 3");
    const lesson = lessonFor(input.lessonTitle, input.grade, [activity()], ["Đọc đúng."]);
    lesson.assessment.criteria = ["Hoàn thành nhiệm vụ học tập."];
    lesson.assessment.comments = ["Hoàn thành nhiệm vụ học tập."];
    expect(codes(lesson, input)).toContain("TV-QUALITY-24");
  });

  it("phát hiện năng lực chung giống hệt giữa các tiết", () => {
    const input = makeInput({ lessonTitle: "Bài đọc: Cây bàng", grade: "Lớp 3", periods: 2 });
    const sharedOutcomes = {
      ...makeLesson().outcomes,
      generalCompetencies: ["Tự chủ và tự học: Chuẩn bị bài, hoàn thành nhiệm vụ đọc."],
    };
    const periodOneActivity = activity({ inputOrMaterials: ["Bài đọc: Cây bàng trước sân trường."], teacherActions: ["GV yêu cầu HS đọc văn bản."], studentActions: ["HS đọc văn bản."] });
    const periodTwoActivity = activity({ inputOrMaterials: ["Bài đọc: Cây bàng trước sân trường."], teacherActions: ["GV yêu cầu HS tìm chi tiết."], studentActions: ["HS tìm chi tiết."] });
    const lesson = makeLesson({
      generalInfo: { subject: "Tiếng Việt", grade: input.grade, lessonTitle: input.lessonTitle, periods: 2, duration: 35 },
      periodPlans: [
        { periodNumber: 1, focus: "Đọc văn bản", outcomes: sharedOutcomes, activities: [periodOneActivity] },
        { periodNumber: 2, focus: "Đọc hiểu", outcomes: sharedOutcomes, activities: [periodTwoActivity] },
      ],
      activities: [periodOneActivity, periodTwoActivity],
    });
    expect(codes(lesson, input)).toContain("TV-QUALITY-25");
  });

  it("phát hiện phẩm chất không liên quan nội dung bài", () => {
    const input = inputFor("Luyện từ và câu: Danh từ", "Lớp 4");
    const lesson = lessonFor(input.lessonTitle, input.grade, [activity({
      inputOrMaterials: ["Ngữ liệu: Em yêu dòng sông. Tìm danh từ trong câu."],
      teacherActions: ["GV yêu cầu HS tìm danh từ trong câu mẫu."],
      studentActions: ["HS tìm danh từ: em, dòng sông."],
    })], ["Xác định đúng danh từ trong câu."]);
    lesson.outcomes.qualities = ["Yêu nước: Biết thể hiện tình yêu biển đảo qua bài học."];
    expect(codes(lesson, input)).toContain("TV-QUALITY-26");
  });

  it("phát hiện học liệu khai báo nhưng không dùng", () => {
    const input = inputFor("Bài đọc: Cây bàng", "Lớp 3");
    const lesson = lessonFor(input.lessonTitle, input.grade, [activity({
      inputOrMaterials: ["Bài đọc: Cây bàng trước sân trường."],
    })], ["Đọc đúng."]);
    lesson.materials.teacher = ["Bảng phụ đoạn thơ Mùa xuân về." ];
    expect(codes(lesson, input)).toContain("TV-QUALITY-27");
  });

  it("phát hiện YCCĐ chưa có hoạt động tương ứng", () => {
    const input = inputFor("Bài đọc: Cây bàng", "Lớp 3");
    const lesson = lessonFor(input.lessonTitle, input.grade, [activity({
      inputOrMaterials: ["Bài đọc: Cây bàng trước sân trường."],
      teacherActions: ["GV yêu cầu HS đọc đoạn văn và tìm chi tiết về tán lá."],
      studentActions: ["HS đọc đoạn văn và tìm chi tiết."],
    })], ["Đọc đúng."]);
    lesson.outcomes.knowledgeAndSkills = [
      "Đọc đúng đoạn văn Cây bàng.",
      "Tìm chi tiết về tán lá trong văn bản.",
      "Nêu cảm nhận về cây bàng.",
      "Sắp xếp tranh theo trình tự câu chuyện con kiến.",
    ];
    expect(codes(lesson, input)).toContain("TV-QUALITY-28");
  });

  it("phát hiện hoạt động thiếu hoặc dùng sản phẩm chính mơ hồ", () => {
    const input = inputFor("Bài đọc: Cây bàng", "Lớp 3");
    const lesson = lessonFor(input.lessonTitle, input.grade, [activity({
      learningProducts: ["Phiếu học tập"],
    })], ["Đọc đúng."]);
    expect(codes(lesson, input)).toContain("TV-QUALITY-29");
  });

  it("phát hiện từ trong đáp án không xuất hiện trong ngữ liệu hoạt động đọc/luyện từ", () => {
    const input = inputFor("Luyện từ và câu: Điền từ", "Lớp 3");
    const lesson = lessonFor(input.lessonTitle, input.grade, [activity({
      inputOrMaterials: ["Ngữ liệu: Cây bàng xanh trước sân trường."],
      teacherActions: ["GV yêu cầu HS lựa chọn từ cần điền vào câu trong ngữ liệu."],
      studentActions: ["HS lựa chọn từ cần điền."],
      expectedAnswer: "Từ cần điền: phượng vĩ.",
    })], ["Lựa chọn đúng từ cần điền."]);
    expect(codes(lesson, input)).toContain("TV-QUALITY-30");
  });

  it("phát hiện tổng thời lượng vượt giới hạn", () => {
    const input = inputFor("Bài đọc: Cây bàng", "Lớp 3");
    const lesson = lessonFor(input.lessonTitle, input.grade, [activity({ durationMinutes: 36 })], ["Đọc đúng."]);
    expect(codes(lesson, input)).toContain("TV-QUALITY-31");
  });

  it("phát hiện tên bài học không thống nhất với form", () => {
    const input = inputFor("Bài đọc: Cây bàng", "Lớp 3");
    const lesson = lessonFor("Bài đọc: Dòng sông", input.grade, [activity()], ["Đọc đúng."]);
    expect(codes(lesson, input)).toContain("TV-QUALITY-32");
  });

  it("phát hiện hai hoạt động gần trùng nhiệm vụ trong cùng tiết", () => {
    const input = inputFor("Bài đọc: Mùa nước nổi", "Lớp 2");
    const repeated = "GV hỏi: Vì sao gọi là mùa nước nổi? Tìm chi tiết chứng minh trong bài đọc.";
    const lesson = lessonFor(input.lessonTitle, input.grade, [
      activity({
        phase: "Khám phá",
        inputOrMaterials: ["Bài đọc: Mùa nước nổi. Câu hỏi: Vì sao gọi là mùa nước nổi?"],
        teacherActions: [repeated],
        studentActions: ["HS trả lời vì nước dâng cao và tìm chi tiết chứng minh."],
        learningProducts: ["Câu trả lời về tên gọi mùa nước nổi."],
      }),
      activity({
        phase: "Vận dụng",
        inputOrMaterials: ["Bài đọc: Mùa nước nổi. Câu hỏi: Vì sao gọi là mùa nước nổi?"],
        teacherActions: [repeated],
        studentActions: ["HS dùng lại chi tiết chứng minh để trả lời."],
        learningProducts: ["Câu trả lời về tên gọi mùa nước nổi."],
      }),
    ], ["Đọc đúng, tìm được chi tiết."]);
    expect(codes(lesson, input)).toContain("TV-QUALITY-33");
  });

  it("phát hiện phân hóa lặp mẫu cũ", () => {
    const input = inputFor("Chính tả: Nghe - viết", "Lớp 2");
    const lesson = lessonFor(input.lessonTitle, input.grade, [
      activity({
        inputOrMaterials: ["Đoạn viết: Mùa nước nổi."],
        supportForStudentsNeedingHelp: ["Học sinh cần hỗ trợ: cung cấp ba từ khóa và khung câu."],
        successCriteria: ["Học sinh đạt chuẩn: viết đủ đoạn, có một bằng chứng."],
        extensionForEarlyFinishers: ["Học sinh nâng cao: giải thích tác dụng của dấu câu."],
      }),
    ], ["Viết đúng chính tả."]);
    expect(codes(lesson, input)).toContain("TV-QUALITY-34");
  });

  it("phát hiện yêu cầu phân tích quá sức lớp 2", () => {
    const input = inputFor("Bài đọc: Mùa nước nổi", "Lớp 2");
    const lesson = lessonFor(input.lessonTitle, input.grade, [
      activity({
        inputOrMaterials: ["Bài đọc: Mùa nước nổi."],
        teacherActions: ["GV yêu cầu HS giải thích tác dụng của phép lặp và hiệu quả của nhịp trong câu văn."],
        studentActions: ["HS phân tích tác dụng nghệ thuật."],
      }),
    ], ["Đọc đúng."]);
    expect(codes(lesson, input)).toContain("TV-QUALITY-35");
  });

  it("phát hiện thiếu hướng dẫn luyện đọc cụ thể cho lớp 2", () => {
    const input = inputFor("Bài đọc: Mùa nước nổi", "Lớp 2");
    const lesson = lessonFor(input.lessonTitle, input.grade, [
      activity({
        inputOrMaterials: ["Bài đọc: Mùa nước nổi."],
        teacherActions: ["GV hướng dẫn HS luyện đọc hai câu dài trong bài."],
        studentActions: ["HS đọc nối tiếp và luyện đọc."],
        learningProducts: ["Phần đọc thành tiếng."],
        successCriteria: ["Đọc đúng, rõ, ngắt nghỉ phù hợp."],
      }),
    ], ["Đọc đúng, rõ."]);
    expect(codes(lesson, input)).toContain("TV-QUALITY-36");
  });

  it("phát hiện thời lượng nghe-viết quá ít", () => {
    const input = inputFor("Chính tả: Nghe - viết", "Lớp 2");
    const lesson = lessonFor(input.lessonTitle, input.grade, [
      activity({
        durationMinutes: 9,
        inputOrMaterials: ["Đoạn chính tả nghe - viết: Mùa nước nổi."],
        teacherActions: ["GV đọc cho HS nghe-viết đoạn chính tả."],
        studentActions: ["HS nghe-viết đoạn chính tả."],
        learningProducts: ["Bài chính tả."],
        successCriteria: ["Viết đúng chính tả."],
      }),
    ], ["Viết đúng chính tả."]);
    expect(codes(lesson, input)).toContain("TV-QUALITY-37");
  });

  it("phát hiện năng lực đặc thù chép lại kiến thức, kĩ năng", () => {
    const input = inputFor("Bài đọc: Cây bàng", "Lớp 3");
    const lesson = lessonFor(input.lessonTitle, input.grade, [activity({
      inputOrMaterials: ["Bài đọc: Cây bàng trước sân trường."],
    })], ["Đọc đúng."]);
    lesson.outcomes.knowledgeAndSkills = [
      "Đọc đúng đoạn văn Cây bàng.",
      "Tìm chi tiết về tán lá trong văn bản.",
      "Nêu cảm nhận về cây bàng.",
      "Viết một câu về cây bàng.",
    ];
    lesson.outcomes.specificCompetencies = ["Đọc đúng đoạn văn Cây bàng."];
    expect(codes(lesson, input)).toContain("TV-QUALITY-38");
  });

  it("phát hiện bài tập SGK cần đáp án cụ thể nhưng chỉ ghi chung chung", () => {
    const input = inputFor("Luyện từ và câu: Dấu câu", "Lớp 2");
    const lesson = lessonFor(input.lessonTitle, input.grade, [
      activity({
        inputOrMaterials: ["Bài 3: Điền dấu chấm hoặc dấu chấm hỏi vào 6 câu."],
        teacherActions: ["GV viết 6 câu của bài 3 lên bảng phụ."],
        studentActions: ["HS điền dấu câu."],
        expectedAnswer: "GV chốt theo SGK.",
      }),
    ], ["Lựa chọn đúng dấu câu."]);
    expect(codes(lesson, input)).toContain("TV-QUALITY-39");
  });

  it("phát hiện cụm xác minh thô không nên đi vào Word", () => {
    const input = inputFor("Luyện từ và câu: Dấu câu", "Lớp 2");
    const lesson = lessonFor(input.lessonTitle, input.grade, [
      activity({
        expectedAnswer: "GV chốt theo SGK vì OCR chưa rõ, cần GV xác minh.",
      }),
    ], ["Lựa chọn đúng dấu câu."]);
    expect(codes(lesson, input)).toContain("TV-QUALITY-40");
  });

  it("phát hiện năng lực số chỉ do GV trình chiếu", () => {
    const input = inputFor("Bài đọc: Cây bàng", "Lớp 3");
    const lesson = lessonFor(input.lessonTitle, input.grade, [activity({
      inputOrMaterials: ["Bài đọc: Cây bàng trước sân trường."],
    })], ["Đọc đúng."]);
    lesson.outcomes.digitalCompetencies = ["Năng lực số (1.2): HS quan sát tranh trình chiếu trên máy chiếu."];
    expect(codes(lesson, input)).toContain("TV-QUALITY-41");
  });

  it("phát hiện nhiệm vụ mở rộng chưa gắn nhãn", () => {
    const input = inputFor("Bài đọc: Cây bàng", "Lớp 3");
    const lesson = lessonFor(input.lessonTitle, input.grade, [
      activity({
        teacherActions: ["GV yêu cầu HS về nhà hỏi người thân thêm một câu chuyện về cây bàng."],
      }),
    ], ["Đọc đúng."]);
    expect(codes(lesson, input)).toContain("TV-QUALITY-42");
  });

  it("phát hiện tiêu chí đánh giá lệch loại sản phẩm", () => {
    const input = inputFor("Chính tả: Nghe - viết", "Lớp 2");
    const lesson = lessonFor(input.lessonTitle, input.grade, [
      activity({
        inputOrMaterials: ["Đoạn chính tả nghe - viết: Mùa nước nổi."],
        teacherActions: ["GV đọc cho HS nghe-viết đoạn chính tả."],
        studentActions: ["HS nghe-viết đoạn chính tả."],
        learningProducts: ["Bài chính tả."],
        successCriteria: ["Trả lời đúng ý, có một bằng chứng trong bài đọc."],
      }),
    ], ["Viết đúng chính tả."]);
    expect(codes(lesson, input)).toContain("TV-QUALITY-43");
  });

  it("phát hiện kể chuyện lớp 3 thiếu hai lượt nghe/kể mẫu", () => {
    const input = inputFor("Nói và nghe: Kể chuyện", "Lớp 3");
    const lesson = lessonFor(input.lessonTitle, input.grade, [
      activity({
        inputOrMaterials: ["Tranh truyện: Câu chuyện về tình bạn."],
        teacherActions: ["GV yêu cầu HS kể chuyện theo tranh."],
        studentActions: ["HS kể chuyện theo tranh và nhận xét bạn."],
        learningProducts: ["Phần kể chuyện theo tranh."],
        successCriteria: ["Kể đúng trình tự sự việc chính."],
      }),
    ], ["Kể đúng trình tự."]);
    expect(codes(lesson, input)).toContain("TV-QUALITY-44");
  });
});
