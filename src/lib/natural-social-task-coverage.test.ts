import { describe, expect, it } from "vitest";
import {
  normalizeNaturalSocialSourceInventory,
  validateNaturalSocialTaskCoverage,
} from "@/lib/natural-social-task-coverage";
import type { LessonActivity, LessonInput, LessonPlan, NaturalSocialSourceInventory, PeriodPlan } from "@/types/lesson";

const input: LessonInput = {
  subject: "Tự nhiên và Xã hội",
  grade: "Lớp 2",
  lessonTitle: "Bài 4. Giữ sạch nhà ở",
  book: "Kết nối tri thức",
  bookVolume: "auto",
  periods: 2,
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

function inventory(): NaturalSocialSourceInventory {
  return {
    visuals: [
      { visualId: "v-lau-ban", label: "Tranh 1: lau bàn", expectedObservation: "Bạn nhỏ lau bàn để loại bỏ bụi bẩn.", effectOrReason: "Giữ bàn sạch.", isPositiveExample: true },
      { visualId: "v-ve-sinh", label: "Tranh 2: cọ rửa nhà vệ sinh", expectedObservation: "Người lớn cọ rửa nhà vệ sinh.", effectOrReason: "Giữ nhà vệ sinh sạch, hạn chế mùi và vi khuẩn.", isPositiveExample: true },
      { visualId: "v-quet-san", label: "Tranh 3: quét sân", expectedObservation: "Bạn nhỏ quét sân, gom lá rác.", effectOrReason: "Giữ sân sạch.", isPositiveExample: true },
      { visualId: "v-rua-coc", label: "Tranh 4: rửa cốc chén", expectedObservation: "Người thân rửa cốc chén.", effectOrReason: "Giữ đồ dùng ăn uống sạch.", isPositiveExample: true },
    ],
    questions: [
      { taskId: "q-viec-lam-tac-dung", question: "Các bạn trong hình đang làm gì? Việc làm đó có tác dụng gì?", expectedAnswer: "Lau bàn, cọ rửa nhà vệ sinh, quét sân, rửa cốc chén đều giúp nhà sạch hơn." },
    ],
    procedures: [
      { taskId: "p-quet-nha", label: "Sắp xếp quy trình quét nhà", steps: ["Quét gom rác", "Hót rác vào đồ hót", "Bỏ rác vào thùng"] },
      { taskId: "p-rua-coc", label: "Sắp xếp quy trình rửa cốc chén", steps: ["Thu gom cốc chén bẩn", "Rửa cốc chén", "Tráng sạch", "Úp hoặc xếp cho ráo"] },
    ],
    personalTasks: [
      { taskId: "personal-da-lam", label: "Nói việc nên làm và việc em đã làm để giữ vệ sinh nhà ở" },
    ],
    situations: [
      { taskId: "s-hoa-minh", label: "Hoa đến nhà Minh và góp ý khi phòng bừa bộn", characters: ["Hoa", "Minh"], prompt: "Nếu là Hoa, em sẽ nói gì?", expectedResponse: "Góp ý lịch sự và rủ Minh cùng dọn phòng." },
    ],
    practiceTasks: [
      { taskId: "practice-hop", label: "Làm hộp đựng đồ dùng từ vật liệu đã qua sử dụng", materials: ["Hộp giấy", "keo dán", "giấy màu", "bút màu"], steps: ["Cắt nắp hộp", "Dán giấy màu", "Trang trí", "Đặt đồ dùng vào hộp"], expectedProduct: "Hộp đựng đồ dùng đã trang trí", safetyNotes: ["Hộp được người lớn cắt sẵn; không dùng kéo sắc."] },
    ],
  };
}

function activity(overrides: Partial<LessonActivity>): LessonActivity {
  return {
    phase: "Khám phá",
    title: "Hoạt động",
    objective: "Hoàn thành nhiệm vụ TNXH.",
    durationMinutes: 8,
    teacherActions: ["GV giao nhiệm vụ."],
    studentActions: ["HS thực hiện nhiệm vụ."],
    learningProducts: ["Sản phẩm học tập"],
    successCriteria: ["Hoàn thành nhiệm vụ."],
    ...overrides,
  };
}

function period(periodNumber: number, activities: LessonActivity[]): PeriodPlan {
  return { periodNumber, focus: `Tiết ${periodNumber}`, activities };
}

function completeLesson(overrides: Partial<LessonPlan> = {}): LessonPlan {
  const periodPlans = [
    period(1, [
      activity({
        phase: "Khởi động",
        durationMinutes: 3,
        sourceTaskIds: ["personal-da-lam"],
        teacherActions: ["GV cho HS nói với bạn: ở nhà em đã làm việc gì để giữ vệ sinh nhà ở?"],
        studentActions: ["HS chia sẻ: em đã lau bàn, quét sân hoặc rửa cốc chén khi phù hợp."],
      }),
      activity({
        phase: "Khám phá",
        durationMinutes: 12,
        sourceTaskIds: ["q-viec-lam-tac-dung"],
        sourceVisualIds: ["v-lau-ban", "v-ve-sinh", "v-quet-san", "v-rua-coc"],
        coveragePurpose: "Quan sát đủ bốn tranh và nêu tác dụng từng việc.",
        teacherActions: ["GV cho HS quan sát tranh lau bàn, cọ rửa nhà vệ sinh, quét sân, rửa cốc chén và hỏi tác dụng từng việc."],
        studentActions: ["HS nêu: lau bàn giữ bàn sạch; cọ rửa nhà vệ sinh hạn chế mùi; quét sân gom lá rác; rửa cốc chén giữ đồ dùng sạch."],
        expectedAnswer: "Lau bàn giữ bàn sạch; cọ rửa nhà vệ sinh hạn chế mùi và vi khuẩn; quét sân giữ sân sạch; rửa cốc chén giữ đồ dùng ăn uống sạch.",
      }),
      activity({
        phase: "Luyện tập",
        durationMinutes: 10,
        sourceTaskIds: ["p-quet-nha", "p-rua-coc"],
        teacherActions: ["GV yêu cầu HS sắp xếp quy trình quét nhà: quét gom rác, hót rác vào đồ hót, bỏ rác vào thùng; và quy trình rửa cốc chén: thu gom cốc chén bẩn, rửa, tráng sạch, úp hoặc xếp cho ráo."],
        studentActions: ["HS dùng thẻ trình tự: trước tiên quét gom rác, tiếp theo hót rác, cuối cùng bỏ thùng; với cốc chén thì thu gom, rửa, tráng sạch, úp cho ráo."],
      }),
      activity({
        phase: "Vận dụng",
        durationMinutes: 8,
        sourceTaskIds: ["personal-da-lam"],
        teacherActions: ["GV mời HS nói một việc nên làm và một việc em đã làm để nhà sạch, kèm lưu ý chỉ làm việc vừa sức."],
        studentActions: ["HS nói: em nên cất đồ đúng chỗ; em đã lau bàn sau khi ăn."],
      }),
    ]),
    period(2, [
      activity({ phase: "Khởi động", durationMinutes: 3 }),
      activity({
        phase: "Khám phá",
        durationMinutes: 8,
        sourceTaskIds: ["s-hoa-minh"],
        teacherActions: ["GV tổ chức đóng vai: nếu là Hoa, em sẽ nói gì với Minh khi thấy phòng bừa bộn?"],
        studentActions: ["HS đóng vai Hoa góp ý lịch sự: Minh ơi, chúng mình cùng cất đồ và lau bàn nhé."],
        expectedAnswer: "Hoa góp ý lịch sự và rủ Minh cùng dọn phòng.",
      }),
      activity({
        phase: "Luyện tập",
        durationMinutes: 14,
        sourceTaskIds: ["practice-hop"],
        teacherActions: ["GV chuẩn bị hộp đã cắt sẵn, nhắc không dùng kéo sắc; hướng dẫn HS dán giấy màu, trang trí và đặt bút vào hộp đựng đồ dùng."],
        studentActions: ["HS thực hành làm hộp đựng đồ: dán giấy màu, trang trí, hoàn thiện sản phẩm và thử đặt đồ dùng vào hộp."],
        inputOrMaterials: ["Hộp giấy đã qua sử dụng sạch", "keo dán", "giấy màu", "bút màu"],
        learningProducts: ["Hộp đựng đồ dùng đã trang trí"],
        successCriteria: ["Có hộp đựng đồ hoàn thiện.", "Nêu được lí do tái sử dụng vật liệu sạch."],
      }),
      activity({
        phase: "Vận dụng",
        durationMinutes: 8,
        teacherActions: ["GV cho HS trưng bày hộp và nêu dùng hộp để cất bút, góp phần giữ góc học tập gọn gàng."],
        studentActions: ["HS giới thiệu sản phẩm và nêu ý nghĩa tái sử dụng vật liệu đã qua sử dụng."],
      }),
    ]),
  ];

  return {
    generalInfo: { subject: "Tự nhiên và Xã hội", grade: "Lớp 2", lessonTitle: "Bài 4. Giữ sạch nhà ở", book: "Kết nối tri thức", periods: 2, duration: 35 },
    outcomes: { generalCompetencies: [], specificCompetencies: [], qualities: [], knowledgeAndSkills: [] },
    materials: { teacher: [], students: [] },
    activities: periodPlans.flatMap((item) => item.activities),
    periodPlans,
    assessment: { criteria: [], evidence: [], comments: [] },
    adjustments: { suitablePoints: [], pointsToAdjust: [], nextLessonDirection: [] },
    contextFit: { notes: [] },
    meta: { style: "test", modelUsed: "test", createdAt: "2026-01-01T00:00:00.000Z", naturalSocialSourceInventory: inventory() },
    ...overrides,
  };
}

function codes(lesson: LessonPlan, sourceInventory = inventory()) {
  return validateNaturalSocialTaskCoverage(lesson, input, sourceInventory).map((finding) => finding.code);
}

describe("validateNaturalSocialTaskCoverage", () => {
  it("chấp nhận giáo án bao phủ đủ inventory chung của SGK", () => {
    expect(validateNaturalSocialTaskCoverage(completeLesson(), input, inventory())).toEqual([]);
  });

  it("bắt thiếu tranh/hình nguồn thay vì chỉ kiểm chủ đề chung", () => {
    const lesson = completeLesson();
    lesson.periodPlans![0].activities[1].sourceVisualIds = ["v-lau-ban", "v-quet-san", "v-rua-coc"];
    lesson.periodPlans![0].activities[1].teacherActions = ["GV cho HS quan sát tranh lau bàn, quét sân và rửa cốc chén."];
    lesson.periodPlans![0].activities[1].studentActions = ["HS nêu tác dụng của lau bàn, quét sân và rửa cốc chén."];
    lesson.periodPlans![0].activities[1].expectedAnswer = "Lau bàn, quét sân và rửa cốc chén đều giúp nhà sạch hơn.";

    expect(codes(lesson)).toContain("NSXH-COVERAGE-01");
  });

  it("bắt lỗi phân loại đối lập khi toàn bộ tranh nguồn đều là ví dụ tích cực", () => {
    const lesson = completeLesson();
    lesson.periodPlans![0].activities[2].teacherActions = ["GV yêu cầu HS phân loại bốn tranh vào hai cột: giúp nhà sạch và chưa giúp nhà sạch."];

    expect(codes(lesson)).toContain("NSXH-COVERAGE-05");
  });

  it("bắt lỗi thay nhiệm vụ làm sản phẩm bằng nói hoặc vẽ cam kết", () => {
    const lesson = completeLesson();
    lesson.periodPlans![1].activities[2].teacherActions = ["GV cho HS quan sát mẫu hộp rồi vẽ cam kết giữ nhà sạch."];
    lesson.periodPlans![1].activities[2].studentActions = ["HS nói nơi sẽ dùng hộp và chia sẻ ý tưởng trang trí."];
    lesson.periodPlans![1].activities[2].inputOrMaterials = ["Tranh mẫu hộp"];
    lesson.periodPlans![1].activities[2].learningProducts = ["Lời chia sẻ ý tưởng"];
    lesson.periodPlans![1].activities[2].successCriteria = ["Nói được một ý tưởng."];

    expect(codes(lesson)).toContain("NSXH-COVERAGE-04");
  });

  it("cảnh báo khi tiết TNXH 35 phút bị phân bổ kín không còn dự phòng", () => {
    const lesson = completeLesson();
    lesson.periodPlans![0].activities[3].durationMinutes = 10;

    expect(codes(lesson)).toContain("NSXH-COVERAGE-10");
  });

  it("chuẩn hóa inventory thô từ AI thành id ổn định", () => {
    const normalized = normalizeNaturalSocialSourceInventory({
      visuals: [{ label: "Tranh cây hoa", expectedObservation: "HS quan sát hoa.", specificName: "cây hoa", habitatPlace: "vườn trường", environmentCategory: "trên cạn" }],
      practiceTasks: [{ label: "Trồng cây vào cốc giấy" }],
    });

    expect(normalized?.visuals?.[0].visualId).toBe("visual-1");
    expect(normalized?.visuals?.[0].specificName).toBe("cây hoa");
    expect(normalized?.practiceTasks?.[0].taskId).toBe("practice-1");
  });

  it("bắt sai trang, rút tên loài cụ thể, thiếu nơi sống và lặp phân loại ở bài động vật", () => {
    const sourceInventory: NaturalSocialSourceInventory = {
      visuals: [
        { visualId: "v-pond-fish", label: "Cá trong tranh ao hồ", page: "62-63", specificName: "cá", habitatPlace: "ao, hồ", environmentCategory: "dưới nước", required: true },
        { visualId: "v-duck", label: "Vịt trong tranh ao hồ", page: "62-63", specificName: "vịt", habitatPlace: "ao, hồ và bờ ao", environmentCategory: "vừa trên cạn vừa dưới nước", required: true },
        { visualId: "v-frog", label: "Ếch trong tranh ao hồ", page: "62-63", specificName: "ếch", habitatPlace: "ao, hồ hoặc ruộng", environmentCategory: "vừa trên cạn vừa dưới nước", required: true },
        { visualId: "v-crab", label: "Cua trong tranh ao hồ", page: "62-63", specificName: "cua", habitatPlace: "ao, hồ hoặc vùng nước", environmentCategory: "dưới nước", required: true },
        { visualId: "v-tiger", label: "Hổ", page: "64", specificName: "hổ", habitatPlace: "rừng", environmentCategory: "trên cạn", required: true },
        { visualId: "v-dolphin", label: "Cá heo", page: "64", specificName: "cá heo", habitatPlace: "biển", environmentCategory: "dưới nước", required: true },
        { visualId: "v-sea-turtle", label: "Rùa biển", page: "64", specificName: "rùa biển", habitatPlace: "biển", environmentCategory: "dưới nước", required: true },
      ],
      questions: [
        { taskId: "q-name-place", question: "Chỉ và nói tên các con vật, chúng sống ở đâu?", expectedAnswer: "HS gọi tên con vật, nêu nơi sống cụ thể và môi trường sống." },
      ],
      classificationTasks: [
        { taskId: "classify-habitat", label: "Hoàn thành bảng tên con vật - nơi sống - môi trường sống", categories: ["trên cạn", "dưới nước", "vừa trên cạn vừa dưới nước"], required: true },
      ],
    };
    const periodPlans = [
      period(1, [
        activity({
          phase: "Khởi động",
          durationMinutes: 3,
          teacherActions: ["GV chiếu tranh SGK trang 62 có hình hổ và cá heo, yêu cầu HS đoán nơi sống."],
          studentActions: ["HS gọi tên hổ, cá heo và dự đoán nơi sống."],
        }),
        activity({
          phase: "Khám phá",
          durationMinutes: 14,
          teacherActions: ["GV cho HS quan sát hổ và cá heo, nói hổ sống trên cạn, cá heo sống dưới nước."],
          studentActions: ["HS ghi con vật vào cột trên cạn hoặc dưới nước."],
          learningProducts: ["Phiếu con vật - môi trường sống"],
        }),
        activity({
          phase: "Luyện tập",
          durationMinutes: 10,
          teacherActions: ["GV phát thẻ hổ, cá heo, voi, mèo, bò, rùa và yêu cầu phân loại theo ba nhóm: trên cạn, dưới nước, vừa trên cạn vừa dưới nước."],
          studentActions: ["HS xếp rùa vào nhóm vừa trên cạn vừa dưới nước và giải thích."],
          learningProducts: ["Bảng phân loại ba nhóm"],
        }),
        activity({
          phase: "Vận dụng",
          durationMinutes: 6,
          teacherActions: ["GV yêu cầu HS tự hoàn thành lại bảng phân loại theo ba nhóm: trên cạn, dưới nước, vừa trên cạn vừa dưới nước."],
          studentActions: ["HS làm lại bảng phân loại cá nhân."],
          learningProducts: ["Bảng phân loại cá nhân"],
        }),
      ]),
    ];
    const badLesson = completeLesson({
      generalInfo: { subject: "Tự nhiên và Xã hội", grade: "Lớp 2", lessonTitle: "Bài 17. Động vật sống ở đâu?", book: "Kết nối tri thức", periods: 1, duration: 35 },
      activities: periodPlans.flatMap((item) => item.activities),
      periodPlans,
    });

    const resultCodes = validateNaturalSocialTaskCoverage(badLesson, { ...input, lessonTitle: "Bài 17. Động vật sống ở đâu?", periods: 1 }, sourceInventory)
      .map((finding) => finding.code);

    expect(resultCodes).toContain("NSXH-COVERAGE-12");
    expect(resultCodes).toContain("NSXH-COVERAGE-13");
    expect(resultCodes).toContain("NSXH-COVERAGE-14");
    expect(resultCodes).toContain("NSXH-COVERAGE-15");
  });
});
