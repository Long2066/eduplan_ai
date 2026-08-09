import { describe, expect, it } from "vitest";
import { validateNaturalSocialLesson } from "./natural-social-quality-validator";
import { makeInput } from "./vietnamese-fixtures";
import type { LessonActivity, LessonPlan } from "@/types/lesson";

function activity(overrides: Partial<LessonActivity>): LessonActivity {
  return {
    phase: "Khám phá",
    title: "Hoạt động",
    objective: "Quan sát và mô tả đặc điểm chính.",
    durationMinutes: 10,
    teacherActions: ["GV giao nhiệm vụ quan sát tranh/vật thật và trả lời câu hỏi."],
    studentActions: ["HS quan sát, ghi lại kết quả và chia sẻ với bạn."],
    inputOrMaterials: ["Tranh/ảnh SGK"],
    learningProducts: ["Phiếu quan sát ngắn"],
    successCriteria: ["Quan sát được đặc điểm chính.", "Nêu được bằng chứng từ tranh/vật thật."],
    commonErrors: ["HS nêu theo cảm tính, chưa dựa vào quan sát."],
    teacherFeedback: ["GV gợi HS nhìn lại tranh/vật thật và nêu đặc điểm cụ thể."],
    supportForStudentsNeedingHelp: ["GV cho HS chọn thẻ gợi ý."],
    extensionForEarlyFinishers: ["HS tìm thêm một ví dụ gần gũi."],
    ...overrides,
  };
}

function lesson(overrides: Partial<LessonPlan> = {}): LessonPlan {
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
        "Quan sát được một số bộ phận chính của cây qua tranh hoặc cây thật.",
        "Mô tả được đặc điểm nổi bật của cây bằng lời nói hoặc phiếu học tập.",
        "Phân loại được việc nên làm và chưa nên làm khi chăm sóc cây.",
        "Nêu được một hành động chăm sóc, bảo vệ cây ở nhà hoặc ở trường.",
      ],
    },
    materials: {
      teacher: ["Tranh/ảnh SGK về cây", "Cây thật an toàn", "Thẻ việc nên làm/chưa nên làm"],
      students: ["SGK", "Phiếu quan sát", "Bút màu"],
    },
    activities: [
      activity({
        phase: "Khởi động",
        title: "Nhìn lá đoán cây",
        objective: "Tạo hứng thú và khơi gợi kinh nghiệm chăm sóc cây.",
        durationMinutes: 4,
        teacherActions: [
          "GV cho HS quan sát tranh lá/cây và hỏi: Con thấy gì? Cây cần gì để sống tốt?",
          "GV chuyển sang tranh SGK: Khi quan sát tranh SGK, con hãy tìm chi tiết chứng minh cây cần được chăm sóc như thế nào.",
        ],
        studentActions: [
          "HS quan sát tranh, dự đoán tên cây và nêu một việc em từng làm để chăm sóc cây.",
          "HS nêu một dự đoán rồi chuẩn bị quan sát tranh SGK để kiểm chứng.",
        ],
        learningProducts: ["Câu trả lời/dự đoán ban đầu"],
        successCriteria: ["Nêu được ít nhất một đặc điểm quan sát được."],
        supportForStudentsNeedingHelp: [],
        extensionForEarlyFinishers: [],
      }),
      activity({
        phase: "Khám phá",
        title: "Phiếu quan sát cây",
        durationMinutes: 16,
        teacherActions: [
          "GV cho HS quan sát cây thật/tranh SGK, đặt câu hỏi: Cây có những bộ phận nào? Lá, thân, rễ có đặc điểm gì?",
          "GV hướng dẫn HS ghi bằng chứng vào phiếu quan sát: bộ phận, màu sắc, kích thước tương đối, điều cây cần.",
          "GV mời nhóm trình bày, xử lí lỗi nếu HS gọi tên theo cảm tính: Hãy chỉ vào tranh/cây để nêu bằng chứng.",
          "GV chốt: Khi tìm hiểu cây, cần quan sát đặc điểm cụ thể rồi mới kết luận.",
        ],
        studentActions: [
          "HS quan sát cây thật/tranh SGK và nêu bộ phận nhìn thấy.",
          "HS ghi lại kết quả vào phiếu quan sát theo gợi ý.",
          "HS trình bày kết quả, nhận xét bạn và sửa câu trả lời dựa vào bằng chứng.",
          "HS nhắc lại cách quan sát: nhìn kĩ, mô tả đặc điểm, không đoán vội.",
        ],
      }),
      activity({
        phase: "Luyện tập",
        title: "Phân loại việc chăm cây",
        objective: "So sánh, phân loại việc nên làm và chưa nên làm khi chăm sóc cây.",
        durationMinutes: 10,
        teacherActions: ["GV phát thẻ hành vi, yêu cầu HS phân loại theo tiêu chí nên làm/chưa nên làm và giải thích vì sao."],
        studentActions: ["HS làm việc nhóm, xếp thẻ vào bảng hai cột, trình bày lý do và bổ sung cho nhóm bạn."],
        learningProducts: ["Bảng phân loại việc nên làm/chưa nên làm"],
        successCriteria: ["Phân loại đúng theo tiêu chí.", "Nêu được lý do đơn giản dựa vào nhu cầu của cây."],
      }),
      activity({
        phase: "Vận dụng",
        title: "Một việc em làm cho cây",
        objective: "Vận dụng bài học thành hành động chăm sóc và bảo vệ cây.",
        durationMinutes: 5,
        teacherActions: ["GV yêu cầu HS chọn một việc nên làm ở nhà hoặc ở trường để chăm sóc, bảo vệ cây an toàn."],
        studentActions: ["HS viết hoặc nói cam kết một việc làm cụ thể: tưới cây vừa đủ, không bẻ cành, nhắc bạn bảo vệ cây."],
        learningProducts: ["Cam kết hành động chăm sóc/bảo vệ cây"],
        successCriteria: ["Nêu được việc làm cụ thể.", "Việc làm an toàn và vừa sức."],
        supportForStudentsNeedingHelp: [],
        extensionForEarlyFinishers: [],
      }),
    ],
    assessment: {
      criteria: ["Quan sát được đặc điểm cây.", "Phân loại được việc nên làm/chưa nên làm.", "Nêu được hành động chăm sóc cây vừa sức."],
      evidence: ["Phiếu quan sát", "Bảng phân loại", "Cam kết hành động"],
      comments: ["Nhận xét dựa trên bằng chứng quan sát và hành động vận dụng."],
    },
    adjustments: { suitablePoints: [], pointsToAdjust: [], nextLessonDirection: [] },
    contextFit: { notes: [] },
    meta: { style: "Dạy thật trên lớp", modelUsed: "test", createdAt: "2026-08-02T00:00:00.000Z" },
    ...overrides,
  };
}

describe("validateNaturalSocialLesson", () => {
  it("passes a lesson with observation, evidence, classification and action", () => {
    const input = makeInput({ subject: "Tự nhiên và Xã hội", grade: "Lớp 2", lessonTitle: "Chăm sóc cây trồng" });
    const findings = validateNaturalSocialLesson(lesson(), input);

    expect(findings.filter((finding) => finding.code.startsWith("NSXH-QUALITY"))).toHaveLength(0);
  });

  it("flags lecture-only lessons", () => {
    const input = makeInput({ subject: "Tự nhiên và Xã hội", grade: "Lớp 1", lessonTitle: "Gia đình em" });
    const findings = validateNaturalSocialLesson(lesson({
      generalInfo: {
        subject: "Tự nhiên và Xã hội",
        grade: "Lớp 1",
        lessonTitle: "Gia đình em",
        periods: 1,
        duration: 35,
      },
      activities: [
        activity({
          phase: "Khởi động",
          title: "Giới thiệu",
          objective: "Nhắc lại tên bài.",
          teacherActions: ["GV giới thiệu bài."],
          studentActions: ["HS lắng nghe."],
          inputOrMaterials: [],
          learningProducts: [],
          successCriteria: [],
          commonErrors: [],
          teacherFeedback: [],
          supportForStudentsNeedingHelp: [],
          extensionForEarlyFinishers: [],
        }),
        activity({
          phase: "Khám phá",
          title: "Nghe giảng",
          objective: "Nghe và nhắc lại nội dung bài.",
          teacherActions: ["GV nêu định nghĩa."],
          studentActions: ["HS nhắc lại."],
          inputOrMaterials: [],
          learningProducts: [],
          successCriteria: [],
          commonErrors: [],
          teacherFeedback: [],
          supportForStudentsNeedingHelp: [],
          extensionForEarlyFinishers: [],
        }),
      ],
    }), input);

    expect(findings.some((finding) => finding.code === "NSXH-QUALITY-01")).toBe(true);
    expect(findings.some((finding) => finding.code === "NSXH-QUALITY-04")).toBe(true);
    expect(findings.some((finding) => finding.code === "NSXH-QUALITY-10")).toBe(true);
    expect(findings.some((finding) => finding.code === "NSXH-QUALITY-11")).toBe(true);
  });

  it("flags startup metadata leaks, outside-SGK mislabeling and grade 1 text overload", () => {
    const input = makeInput({ subject: "Tự nhiên và Xã hội", grade: "Lớp 1", lessonTitle: "Động vật sống ở đâu?" });
    const findings = validateNaturalSocialLesson(lesson({
      generalInfo: {
        subject: "Tự nhiên và Xã hội",
        grade: "Lớp 1",
        lessonTitle: "Động vật sống ở đâu?",
        periods: 1,
        duration: 35,
      },
      activities: [
        activity({
          phase: "Khởi động",
          title: "Video SGK",
          teacherActions: [
            "Học liệu/đầu vào: Video SGK về con vật sống dưới nước.",
            "GV yêu cầu HS đọc thẻ chữ và viết nhanh 3 ý vào phiếu.",
          ],
          studentActions: [
            "Cách tổ chức: Toàn lớp.",
            "HS viết nhanh 3 ý vào phiếu chữ rồi nghe GV giới thiệu bài.",
          ],
          inputOrMaterials: ["Video SGK về con vật sống dưới nước"],
          learningProducts: ["Phiếu chữ"],
          successCriteria: ["Viết được 3 ý."],
          commonErrors: [],
          teacherFeedback: [],
          supportForStudentsNeedingHelp: [],
          extensionForEarlyFinishers: [],
        }),
        ...lesson().activities.slice(1),
      ],
    }), input);

    expect(findings.some((finding) => finding.code === "NSXH-QUALITY-10")).toBe(true);
    expect(findings.some((finding) => finding.code === "NSXH-QUALITY-12")).toBe(true);
    expect(findings.some((finding) => finding.code === "NSXH-QUALITY-13")).toBe(true);
  });

  it("flags duplicated startup forms across periods", () => {
    const input = makeInput({ subject: "Tự nhiên và Xã hội", grade: "Lớp 2", lessonTitle: "Chăm sóc cây trồng", periods: 2 });
    const baseActivities = lesson().activities;
    const candidate = lesson({
      generalInfo: {
        subject: "Tự nhiên và Xã hội",
        grade: "Lớp 2",
        lessonTitle: "Chăm sóc cây trồng",
        periods: 2,
        duration: 35,
      },
      periodPlans: [
        { periodNumber: 1, focus: "Quan sát cây", activities: baseActivities },
        { periodNumber: 2, focus: "Chăm sóc cây", activities: baseActivities },
      ],
    });
    const findings = validateNaturalSocialLesson(candidate, input);

    expect(findings.some((finding) => finding.code === "NSXH-QUALITY-14")).toBe(true);
  });

  it("flags SGK character details promoted into curriculum outcomes", () => {
    const input = makeInput({ subject: "Tự nhiên và Xã hội", grade: "Lớp 1", lessonTitle: "Ngôi nhà của em" });
    const candidate = lesson({
      generalInfo: { subject: "Tự nhiên và Xã hội", grade: "Lớp 1", lessonTitle: "Ngôi nhà của em", periods: 1, duration: 35 },
      outcomes: {
        ...lesson().outcomes,
        knowledgeAndSkills: ["Nêu được nhà Minh ở đường Hoa Ban trong tranh."],
      },
      meta: {
        ...lesson().meta,
        naturalSocialSourceInventory: {
          visuals: [{ visualId: "home-1", label: "Nhà Minh ở đường Hoa Ban", required: true }],
        },
      },
    });

    const findings = validateNaturalSocialLesson(candidate, input);
    expect(findings.some((finding) => finding.code === "NSXH-QUALITY-15")).toBe(true);
  });

  it("flags chores and safety injected into a home-environment lesson when SGK does not require them", () => {
    const input = makeInput({ subject: "Tự nhiên và Xã hội", grade: "Lớp 1", lessonTitle: "Ngôi nhà của em" });
    const candidate = lesson({
      generalInfo: { subject: "Tự nhiên và Xã hội", grade: "Lớp 1", lessonTitle: "Ngôi nhà của em", periods: 1, duration: 35 },
      meta: {
        ...lesson().meta,
        naturalSocialSourceInventory: {
          visuals: [{ visualId: "home-1", label: "Các kiểu nhà và các phòng trong nhà", required: true }],
          questions: [{ taskId: "home-q1", question: "Đồ dùng nào phù hợp với từng phòng?", required: true }],
        },
      },
      activities: lesson().activities.map((item, index) => index === 3 ? activity({
        phase: "Vận dụng",
        title: "Thẻ việc tốt và nhà an toàn",
        teacherActions: ["GV yêu cầu HS cam kết lau bàn, tránh ổ điện và hóa chất trong nhà."],
        studentActions: ["HS chọn một việc nhà và nêu quy tắc an toàn ở nhà."],
      }) : item),
    });

    const findings = validateNaturalSocialLesson(candidate, input);
    expect(findings.some((finding) => finding.code === "NSXH-QUALITY-16")).toBe(true);
  });

  it("allows knowing an address but flags public disclosure of a real full address", () => {
    const input = makeInput({ subject: "Tự nhiên và Xã hội", grade: "Lớp 1", lessonTitle: "Ngôi nhà của em" });
    const allowed = lesson({
      generalInfo: { subject: "Tự nhiên và Xã hội", grade: "Lớp 1", lessonTitle: "Ngôi nhà của em", periods: 1, duration: 35 },
      outcomes: { ...lesson().outcomes, knowledgeAndSkills: ["Nêu được địa chỉ nơi gia đình đang ở ở mức phù hợp."] },
      activities: lesson().activities.map((item, index) => index === 3 ? activity({
        phase: "Vận dụng",
        teacherActions: ["GV phối hợp phụ huynh kiểm tra riêng để bảo đảm HS biết địa chỉ nhà mình."],
        studentActions: ["HS nói địa chỉ với GV trong phần kiểm tra riêng; dùng địa chỉ giả định trên sản phẩm trưng bày."],
      }) : item),
    });
    const unsafeDisclosure = lesson({
      ...allowed,
      activities: allowed.activities.map((item, index) => index === 3 ? activity({
        phase: "Vận dụng",
        teacherActions: ["GV yêu cầu từng HS đọc địa chỉ nhà thật, đầy đủ trước lớp."],
        studentActions: ["HS công khai địa chỉ nhà thật trước cả lớp và ghi lên thiệp trưng bày."],
      }) : item),
    });

    expect(validateNaturalSocialLesson(allowed, input).some((finding) => finding.code === "NSXH-QUALITY-17")).toBe(false);
    expect(validateNaturalSocialLesson(unsafeDisclosure, input).some((finding) => finding.code === "NSXH-QUALITY-17")).toBe(true);
  });

  it("flags visible machine markers and malformed punctuation", () => {
    const input = makeInput({ subject: "Tự nhiên và Xã hội", grade: "Lớp 3", lessonTitle: "Nơi em sống" });
    const candidate = lesson({
      activities: lesson().activities.map((item, index) => index === 1 ? activity({
        title: "Q1 Quan sát nơi em sống",
        teacherActions: ["GV chốt nội dung trong tranh.: HS nêu đặc điểm.;"],
      }) : item),
    });

    const findings = validateNaturalSocialLesson(candidate, input);
    expect(findings.some((finding) => finding.code === "NSXH-QUALITY-18")).toBe(true);
  });

  it("flags an overloaded reading-writing sequence for grade 1", () => {
    const input = makeInput({ subject: "Tự nhiên và Xã hội", grade: "Lớp 1", lessonTitle: "Ngôi nhà của em" });
    const candidate = lesson({
      generalInfo: { subject: "Tự nhiên và Xã hội", grade: "Lớp 1", lessonTitle: "Ngôi nhà của em", periods: 1, duration: 35 },
      activities: lesson().activities.map((item, index) => index === 2 ? activity({
        phase: "Luyện tập",
        durationMinutes: 10,
        teacherActions: [
          "GV yêu cầu HS viết lời mời, thời gian và địa điểm vào thiệp.",
          "GV yêu cầu HS đổi thiệp kiểm tra rồi tự sửa sản phẩm trước khi trưng bày.",
        ],
        studentActions: [
          "HS đọc mẫu, viết đầy đủ ba thành phần của thiệp.",
          "HS đổi thiệp, đọc bài của bạn, sửa và viết lại.",
        ],
      }) : item),
    });

    const findings = validateNaturalSocialLesson(candidate, input);
    expect(findings.some((finding) => finding.code === "NSXH-QUALITY-19")).toBe(true);
  });

  it("requires outcome-to-activity evidence mapping when SGK required tasks are locked", () => {
    const input = makeInput({ subject: "Tự nhiên và Xã hội", grade: "Lớp 2", lessonTitle: "Nơi em sống" });
    const candidate = lesson({
      meta: {
        ...lesson().meta,
        naturalSocialSourceInventory: {
          requiredTasks: [{
            taskId: "task-1",
            label: "Quan sát và mô tả nơi em sống",
            taskType: "observe_image",
            productKind: "observation",
            required: true,
            criteria: ["Nêu được một đặc điểm quan sát được."],
          }],
        },
      },
    });

    const findings = validateNaturalSocialLesson(candidate, input);
    expect(findings.some((finding) => finding.code === "NSXH-QUALITY-20")).toBe(true);
  });

  it("flags unsafe activities", () => {
    const input = makeInput({ subject: "Tự nhiên và Xã hội", grade: "Lớp 2", lessonTitle: "Cây xung quanh em" });
    const candidate = lesson({
      activities: [
        ...lesson().activities.slice(0, 1),
        activity({
          phase: "Khám phá",
          title: "Quan sát lá",
          teacherActions: ["GV yêu cầu HS nếm thử lá cây để biết đặc điểm."],
          studentActions: ["HS nếm thử lá cây và nêu cảm nhận."],
        }),
        ...lesson().activities.slice(2),
      ],
    });
    const findings = validateNaturalSocialLesson(candidate, input);

    expect(findings.some((finding) => finding.code === "NSXH-QUALITY-06")).toBe(true);
  });

  it("ignores other subjects", () => {
    const input = makeInput({ subject: "Toán", grade: "Lớp 2", lessonTitle: "Phép cộng" });
    expect(validateNaturalSocialLesson(lesson(), input)).toHaveLength(0);
  });
});
