/**
 * vietnamese-fixtures.ts
 *
 * Test fixtures for Vietnamese lesson classifier and checker tests.
 * Contains synthetic data — NOT copied from copyrighted SGK content.
 */

import type { LessonInput, LessonPlan, LessonActivity, PeriodPlan, LessonOutcomes } from "@/types/lesson";

// ─── DEFAULT LESSON INPUT ───

const baseInput: LessonInput = {
  subject: "Tiếng Việt",
  grade: "Lớp 3",
  lessonTitle: "",
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

export function makeInput(overrides: Partial<LessonInput> = {}): LessonInput {
  return { ...baseInput, ...overrides };
}

// ─── CLASSIFIER FIXTURES ───

export const classifierFixtures: Array<{
  name: string;
  input: Partial<LessonInput>;
  ocrText: string;
  expectedPrimaryType: string;
  minConfidence: "high" | "medium" | "low";
}> = [
  {
    name: "Lớp 1 - học âm/vần mới",
    input: { grade: "Lớp 1", lessonTitle: "Bài 5. Âm e, ê" },
    ocrText: "Âm e - ê. Ghép tiếng: be, bê, me, mê. Phân tích tiếng: bé = b + e + thanh sắc. Viết chữ e, ê.",
    expectedPrimaryType: "phonics",
    minConfidence: "high",
  },
  {
    name: "Lớp 1 - tập viết",
    input: { grade: "Lớp 1", lessonTitle: "Tập viết: Các nét cơ bản" },
    ocrText: "Nét thẳng, nét cong, nét móc. Cỡ chữ vừa. Dòng kẻ li.",
    expectedPrimaryType: "handwriting",
    minConfidence: "high",
  },
  {
    name: "Lớp 2 - nghe-viết chính tả",
    input: { grade: "Lớp 2", lessonTitle: "Chính tả: Nghe - viết" },
    ocrText: "Nghe - viết: Mùa xuân đến. Phân biệt ch/tr. Từ khó: trường, chuyện. Bài tập chính tả.",
    expectedPrimaryType: "spelling",
    minConfidence: "high",
  },
  {
    name: "Lớp 2 - bài đọc truyện",
    input: { grade: "Lớp 2", lessonTitle: "Bài 3. Có công mài sắt có ngày nên kim" },
    ocrText: "Đọc bài: Có công mài sắt có ngày nên kim. Câu hỏi: Nhân vật chính là ai? Chi tiết nào cho thấy cậu bé kiên trì? Ý chính của bài đọc là gì?",
    expectedPrimaryType: "reading",
    minConfidence: "high",
  },
  {
    name: "Lớp 3 - luyện từ và câu",
    input: { grade: "Lớp 3", lessonTitle: "Luyện từ và câu: Mở rộng vốn từ về quê hương" },
    ocrText: "Mở rộng vốn từ: quê hương. Tìm từ cùng nghĩa. Đặt câu với từ vừa tìm. Dấu phẩy trong câu.",
    expectedPrimaryType: "language-knowledge",
    minConfidence: "high",
  },
  {
    name: "Lớp 3 - nói và nghe",
    input: { grade: "Lớp 3", lessonTitle: "Nói và nghe: Kể chuyện đã nghe, đã đọc" },
    ocrText: "Kể lại câu chuyện. Nghe bạn kể. Hỏi lại bạn. Nói trước lớp.",
    expectedPrimaryType: "speaking-listening",
    minConfidence: "high",
  },
  {
    name: "Lớp 4 - viết đoạn văn",
    input: { grade: "Lớp 4", lessonTitle: "Tập làm văn: Viết đoạn văn miêu tả" },
    ocrText: "Viết đoạn văn miêu tả con vật. Lập dàn ý. Câu mở đầu. Câu kết. Chỉnh sửa bài viết.",
    expectedPrimaryType: "composition",
    minConfidence: "high",
  },
  {
    name: "Lớp 5 - đọc hiểu",
    input: { grade: "Lớp 5", lessonTitle: "Bài 10. Hạt gạo làng ta" },
    ocrText: "Bài thơ: Hạt gạo làng ta. Đọc diễn cảm. Nội dung bài đọc. Tìm chi tiết. Biện pháp nghệ thuật. Ý nghĩa bài thơ.",
    expectedPrimaryType: "reading",
    minConfidence: "high",
  },
  {
    name: "Bài tích hợp nhiều kĩ năng",
    input: { grade: "Lớp 3", lessonTitle: "Bài 8", periods: 3 },
    ocrText: "Đọc bài. Viết chính tả. Luyện từ và câu. Nói và nghe.",
    expectedPrimaryType: "mixed",
    minConfidence: "low",
  },
  {
    name: "Tên bài mơ hồ, OCR ít",
    input: { grade: "Lớp 3", lessonTitle: "Bài ôn tập" },
    ocrText: "Ôn tập tuần 5.",
    expectedPrimaryType: "mixed",
    minConfidence: "low",
  },
  {
    name: "Văn bản không dấu",
    input: { grade: "Lớp 2", lessonTitle: "Chinh ta: Nghe - viet" },
    ocrText: "Nghe viet. Phan biet ch/tr.",
    expectedPrimaryType: "spelling",
    minConfidence: "medium",
  },
];

// ─── CHECKER FIXTURES ───

const baseOutcomes: LessonOutcomes = {
  generalCompetencies: ["Tự chủ và tự học: Biết chuẩn bị bài, hoàn thành nhiệm vụ đọc/viết được giao."],
  specificCompetencies: ["Năng lực ngôn ngữ: Đọc đúng, rõ ràng, biết ngắt nghỉ hợp lý."],
  qualities: ["Chăm chỉ: Tích cực đọc bài, viết bài, hoàn thành nhiệm vụ trên lớp."],
  knowledgeAndSkills: [
    "Đọc đúng từ, câu trong ngữ liệu bài học.",
    "Tìm chi tiết trả lời câu hỏi đọc hiểu trong văn bản.",
    "Nêu ý chính hoặc nội dung cốt lõi của bài học.",
    "Hiểu nghĩa từ trong ngữ liệu bài học.",
  ],
};

function makeActivity(overrides: Partial<LessonActivity> = {}): LessonActivity {
  return {
    phase: "Khám phá",
    title: "Hoạt động",
    objective: "Nêu được một ý trả lời theo nhiệm vụ.",
    durationMinutes: 8,
    teacherActions: ["GV giao nhiệm vụ ngôn ngữ và nêu tiêu chí thực hiện."],
    studentActions: ["HS thực hiện nhiệm vụ, nêu câu trả lời và tự sửa nếu cần."],
    learningProducts: ["Câu trả lời ngắn theo nhiệm vụ."],
    successCriteria: ["Nêu được một ý phù hợp."],
    commonErrors: ["HS dễ nêu thiếu bằng chứng."],
    teacherFeedback: ["GV gợi ý từ khóa để HS đối chiếu và sửa lỗi."],
    expectedAnswer: "Ý cốt lõi phù hợp với ngữ liệu.",
    supportForStudentsNeedingHelp: ["Học sinh cần hỗ trợ: cung cấp ba từ khóa, khung câu và câu hỏi gợi mở."],
    extensionForEarlyFinishers: ["Thực hiện khi còn thời gian hoặc dành cho học sinh hoàn thành sớm: nêu thêm một ví dụ phù hợp."],
    ...overrides,
  };
}

function makePeriod(overrides: Partial<PeriodPlan> = {}): PeriodPlan {
  return {
    periodNumber: 1,
    focus: "Trọng tâm tiết",
    outcomes: baseOutcomes,
    activities: [
      makeActivity({ phase: "Khởi động", title: "Khởi động", durationMinutes: 4 }),
      makeActivity({ phase: "Khám phá", title: "Khám phá", durationMinutes: 14 }),
      makeActivity({ phase: "Luyện tập", title: "Luyện tập", durationMinutes: 10 }),
      makeActivity({ phase: "Vận dụng", title: "Vận dụng", durationMinutes: 4 }),
    ],
    ...overrides,
  };
}

export function makeLesson(overrides: Partial<LessonPlan> = {}): LessonPlan {
  return {
    generalInfo: {
      subject: "Tiếng Việt",
      grade: "Lớp 3",
      lessonTitle: "Bài test",
      book: "Cánh diều",
      periods: 1,
      duration: 35,
    },
    outcomes: baseOutcomes,
    materials: {
      teacher: ["SGK, tranh minh họa, phiếu học tập."],
      students: ["SGK, vở, bút."],
    },
    activities: [
      makeActivity({ phase: "Khởi động", title: "Khởi động", durationMinutes: 4 }),
      makeActivity({ phase: "Khám phá", title: "Khám phá", durationMinutes: 14 }),
      makeActivity({ phase: "Luyện tập", title: "Luyện tập", durationMinutes: 10 }),
      makeActivity({ phase: "Vận dụng", title: "Vận dụng", durationMinutes: 4 }),
    ],
    assessment: { criteria: ["Đánh giá."], evidence: ["Minh chứng."], comments: ["Nhận xét."] },
    adjustments: { suitablePoints: [], pointsToAdjust: [], nextLessonDirection: [] },
    contextFit: { notes: [] },
    meta: { style: "Dạy thật trên lớp", modelUsed: "test", createdAt: new Date().toISOString() },
    ...overrides,
  };
}

// ─── SPECIFIC CHECKER FIXTURES ───

/** A good reading lesson — should PASS reading checks */
export const readingLessonGood = makeLesson({
  generalInfo: { subject: "Tiếng Việt", grade: "Lớp 3", lessonTitle: "Bài đọc: Con cò", book: "Cánh diều", periods: 1, duration: 35 },
  activities: [
    makeActivity({
      phase: "Khởi động", title: "Khởi động", durationMinutes: 4,
      teacherActions: ["GV cho HS quan sát tranh con cò và đoán nội dung bài đọc."],
      studentActions: ["HS quan sát tranh, nêu dự đoán."],
    }),
    makeActivity({
      phase: "Khám phá", title: "Đọc văn bản và tìm hiểu bài", durationMinutes: 14,
      teacherActions: [
        "GV đọc mẫu bài thơ Con cò. Hướng dẫn HS đọc nối tiếp từng khổ.",
        "GV hỏi: Chi tiết nào cho thấy con cò gắn bó với đời sống nông thôn? Tìm trong đoạn 1.",
        "GV hỏi: Bài thơ muốn nói điều gì? Dựa vào chi tiết nào trong bài để trả lời?",
        "GV giải nghĩa từ 'lặn lội' trong ngữ cảnh câu thơ.",
      ],
      studentActions: [
        "HS đọc nối tiếp, luyện đọc từ khó: lặn lội, nước mặn, đồng chua.",
        "HS tìm chi tiết: 'lặn lội bờ sông', 'gánh gạo nuôi con'. Nêu bằng chứng từ đoạn 1.",
        "HS nêu ý chính: ca ngợi sự tần tảo. Dẫn chứng: hình ảnh con cò.",
        "HS giải nghĩa: lặn lội = vất vả, lội qua nhiều nơi.",
      ],
    }),
    makeActivity({
      phase: "Luyện tập", title: "Luyện tập", durationMinutes: 10,
      teacherActions: ["GV yêu cầu HS trả lời câu hỏi đọc hiểu trong SGK."],
      studentActions: ["HS trả lời câu hỏi, nêu bằng chứng."],
    }),
    makeActivity({
      phase: "Vận dụng", title: "Vận dụng", durationMinutes: 4,
      teacherActions: ["GV hỏi: Em cảm nhận gì về hình ảnh con cò? Liên hệ với người thân."],
      studentActions: ["HS nêu cảm nhận ngắn, liên hệ bản thân."],
    }),
  ],
});

/** A good spelling lesson — should PASS spelling checks even without full reading activities */
export const spellingLessonGood = makeLesson({
  generalInfo: { subject: "Tiếng Việt", grade: "Lớp 2", lessonTitle: "Chính tả: Nghe - viết", book: "Cánh diều", periods: 1, duration: 35 },
  activities: [
    makeActivity({
      phase: "Khởi động", title: "Khởi động", durationMinutes: 3,
      teacherActions: ["GV tổ chức trò chơi phân biệt ch/tr bằng thẻ từ."],
      studentActions: ["HS giơ thẻ đúng khi nghe từ."],
    }),
    makeActivity({
      phase: "Khám phá", title: "Chuẩn bị và nghe viết", durationMinutes: 14,
      teacherActions: [
        "GV đọc đoạn viết cho HS nghe. Hướng dẫn tìm từ khó: trường, chuyện.",
        "GV phân tích âm-vần từ khó: trường = tr + ương + thanh huyền.",
        "GV đọc bài chính tả từng câu, HS nghe viết.",
      ],
      studentActions: [
        "HS nghe, tìm từ khó, phân tích âm-vần.",
        "HS viết bảng con từ khó trước.",
        "HS nghe viết vào vở.",
      ],
    }),
    makeActivity({
      phase: "Luyện tập", title: "Soát lỗi và bài tập chính tả", durationMinutes: 10,
      teacherActions: [
        "GV hướng dẫn HS soát lỗi bài viết: đổi vở, dùng bút chì gạch chân lỗi.",
        "GV cho bài tập phân biệt ch/tr: điền ch hoặc tr vào chỗ trống.",
      ],
      studentActions: [
        "HS soát lỗi, sửa lỗi cá nhân.",
        "HS làm bài tập phân biệt.",
      ],
    }),
    makeActivity({
      phase: "Vận dụng", title: "Vận dụng", durationMinutes: 4,
      teacherActions: ["GV yêu cầu HS ghi nhớ quy tắc phân biệt ch/tr."],
      studentActions: ["HS nêu lại quy tắc, ghi từ khó vào sổ tay."],
    }),
  ],
});

/** A language-knowledge lesson that should NOT be flagged for missing reading comprehension */
export const languageKnowledgeLessonGood = makeLesson({
  generalInfo: { subject: "Tiếng Việt", grade: "Lớp 3", lessonTitle: "Luyện từ và câu: Từ đồng nghĩa", book: "Cánh diều", periods: 1, duration: 35 },
  activities: [
    makeActivity({
      phase: "Khởi động", title: "Khởi động", durationMinutes: 4,
      teacherActions: ["GV tổ chức trò chơi ghép từ đồng nghĩa trên bảng."],
      studentActions: ["HS tham gia ghép từ: xinh - đẹp, nhanh - mau."],
    }),
    makeActivity({
      phase: "Khám phá", title: "Khám phá ngữ liệu", durationMinutes: 14,
      teacherActions: [
        "GV chiếu đoạn văn có các từ in đậm. Yêu cầu HS tìm từ gần nghĩa.",
        "GV hỏi: Các từ này có nghĩa giống hay khác nhau? Có thể thay thế được không?",
        "GV chốt: Từ đồng nghĩa là những từ có nghĩa giống hoặc gần giống nhau.",
      ],
      studentActions: [
        "HS đọc ngữ liệu, tìm từ in đậm: xinh đẹp, xinh xắn, đẹp đẽ.",
        "HS so sánh: nghĩa giống nhau, có thể thay thế trong câu.",
        "HS ghi nhớ quy tắc về từ đồng nghĩa.",
      ],
    }),
    makeActivity({
      phase: "Luyện tập", title: "Luyện nhận diện và sử dụng", durationMinutes: 10,
      teacherActions: [
        "GV yêu cầu HS làm bài tập: tìm từ đồng nghĩa, đặt câu.",
        "GV hướng dẫn HS sửa lỗi dùng từ sai ngữ cảnh.",
      ],
      studentActions: [
        "HS tìm từ đồng nghĩa trong bài tập, đặt câu.",
        "HS nhận ra lỗi dùng từ không phù hợp ngữ cảnh, sửa lại.",
      ],
    }),
    makeActivity({
      phase: "Vận dụng", title: "Vận dụng", durationMinutes: 4,
      teacherActions: ["GV yêu cầu HS dùng từ đồng nghĩa vừa học để viết 2 câu về trường em."],
      studentActions: ["HS viết 2 câu sử dụng từ đồng nghĩa."],
    }),
  ],
});

export { makePeriod, makeActivity };
