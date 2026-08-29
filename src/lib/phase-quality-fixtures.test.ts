import { describe, expect, it } from "vitest";
import { validatePhaseQuality } from "@/lib/phase-quality-validator";
import type { LessonActivity, LessonPlan, PeriodPlan } from "@/types/lesson";

type SubjectFixture = {
  subject: string;
  grade: string;
  lessonTitle: string;
  periods: PeriodPlan[];
};

function baseActivity(overrides: Partial<LessonActivity>): LessonActivity {
  return {
    phase: "Khám phá",
    title: "Khám phá",
    objective: "Hình thành kiến thức hoặc kĩ năng mới của bài.",
    durationMinutes: 12,
    teacherActions: ["GV giao nhiệm vụ có nguồn học liệu, câu hỏi và sản phẩm rõ."],
    studentActions: ["HS quan sát, trao đổi, hoàn thành nhiệm vụ và trình bày kết quả."],
    inputOrMaterials: ["Học liệu của bài."],
    learningProducts: ["Sản phẩm học tập quan sát được."],
    successCriteria: ["Sản phẩm đúng trọng tâm bài học."],
    expectedAnswer: "Câu trả lời phù hợp với nhiệm vụ.",
    commonErrors: ["Trả lời thiếu căn cứ."],
    teacherFeedback: ["GV hỏi lại căn cứ và chốt kiến thức."],
    supportForStudentsNeedingHelp: [],
    extensionForEarlyFinishers: [],
    ...overrides,
  };
}

function standardPeriod(periodNumber: number, focus: string, activities: LessonActivity[]): PeriodPlan {
  return {
    periodNumber,
    focus,
    outcomes: {
      generalCompetencies: [`Trao đổi được với bạn để hoàn thành nhiệm vụ ${focus}.`],
      specificCompetencies: [`Thực hiện được sản phẩm học tập chính của ${focus}.`],
      qualities: [`Tham gia hoạt động ${focus} có trách nhiệm.`],
      knowledgeAndSkills: [`Nêu được nội dung trọng tâm của ${focus}.`],
    },
    activities,
    handoff: { learned: `Đã hoàn thành ${focus}.`, unresolvedRisks: [], nextBridge: "Chuyển sang nhiệm vụ tiếp theo." },
  };
}

function lessonFromFixture(fixture: SubjectFixture): LessonPlan {
  return {
    generalInfo: {
      subject: fixture.subject,
      grade: fixture.grade,
      lessonTitle: fixture.lessonTitle,
      periods: fixture.periods.length,
      duration: 35,
      book: "Fixture",
    },
    outcomes: fixture.periods[0].outcomes!,
    materials: { teacher: ["Học liệu theo từng hoạt động."], students: ["Vở, bút, phiếu/thẻ khi cần."] },
    activities: fixture.periods.flatMap((period) => period.activities),
    periodPlans: fixture.periods,
    assessment: { criteria: ["Sản phẩm đúng nhiệm vụ."], evidence: ["Sản phẩm học tập."], comments: ["Nhận xét theo tiêu chí."] },
    adjustments: { suitablePoints: [], pointsToAdjust: [], nextLessonDirection: [] },
    contextFit: { notes: [] },
    meta: { style: "Dạy thật trên lớp", modelUsed: "fixture", createdAt: "2026-01-01T00:00:00.000Z" },
  };
}

function mathFixture(): SubjectFixture {
  return {
    subject: "Toán",
    grade: "Lớp 3",
    lessonTitle: "Tìm thành phần chưa biết của phép tính",
    periods: [standardPeriod(1, "Tìm số hạng chưa biết", [
      baseActivity({
        id: "math-start",
        phase: "Khởi động",
        title: "Ô số bí mật",
        durationMinutes: 4,
        teacherActions: ["GV tổ chức trò chơi ô số bí mật: che một số trong phép cộng quen thuộc và yêu cầu HS dự đoán cách tìm."],
        studentActions: ["HS quan sát phép tính, dự đoán số bị che và nêu lí do dựa vào quan hệ tổng - số hạng."],
        learningProducts: ["Dự đoán và lí do tìm số bị che."],
      }),
      baseActivity({
        id: "math-explore",
        phase: "Khám phá",
        title: "Mô hình hóa quan hệ phép cộng",
        teacherActions: ["GV đưa bài toán từ ảnh SGK, yêu cầu HS dùng sơ đồ thanh để biểu diễn tổng, số hạng đã biết và số hạng chưa biết."],
        studentActions: ["HS thao tác với sơ đồ thanh, so sánh dữ kiện, phát hiện muốn tìm số hạng chưa biết thì lấy tổng trừ số hạng đã biết."],
        learningProducts: ["Sơ đồ thanh và kết luận cách tìm số hạng chưa biết."],
        expectedAnswer: "Muốn tìm số hạng chưa biết, lấy tổng trừ số hạng đã biết.",
      }),
      baseActivity({
        id: "math-practice",
        phase: "Luyện tập",
        title: "Tìm x và kiểm tra",
        teacherActions: ["GV giao bài tập luyện tập: \\(x + 18 = 45\\), \\(27 + x = 60\\); yêu cầu HS nêu cách làm, tính và kiểm tra ngược."],
        studentActions: ["HS giải từng bài, đối chiếu đáp án, sửa lỗi nhầm phép cộng/trừ và trình bày cách kiểm tra ngược."],
        learningProducts: ["Bài giải tìm x kèm kiểm tra ngược."],
        expectedAnswer: "\\(x = 27\\), \\(x = 33\\).",
      }),
      baseActivity({
        id: "math-apply",
        phase: "Vận dụng",
        title: "Hộp bút của lớp",
        teacherActions: ["GV nêu tình huống thực tế ở lớp: hộp có 45 bút, đã biết 18 bút xanh, hỏi có bao nhiêu bút đỏ; yêu cầu HS lập phép tính và nêu cách kiểm tra."],
        studentActions: ["HS vận dụng cách tìm số hạng chưa biết để lập bài toán lớp học, giải và nói cách kiểm tra kết quả."],
        learningProducts: ["Bài toán thực tế về hộp bút của lớp và phép giải đúng."],
      }),
    ])],
  };
}

function vietnameseFixture(): SubjectFixture {
  return {
    subject: "Tiếng Việt",
    grade: "Lớp 4",
    lessonTitle: "Luyện từ và câu: Mở rộng vốn từ về ước mơ",
    periods: [standardPeriod(1, "Tìm và dùng từ về ước mơ", [
      baseActivity({
        id: "tv-start",
        phase: "Khởi động",
        title: "Túi từ bí mật",
        teacherActions: ["GV tổ chức trò chơi túi từ bí mật: HS rút thẻ từ và đoán từ nào liên quan đến ước mơ."],
        studentActions: ["HS đọc thẻ, chọn từ liên quan và giải thích nhanh bằng một câu."],
        learningProducts: ["Từ khóa và câu giải thích ban đầu."],
      }),
      baseActivity({
        id: "tv-explore",
        phase: "Khám phá",
        title: "Tìm nghĩa qua ngữ liệu",
        teacherActions: ["GV cho HS đọc các câu trong ảnh SGK, gạch dưới từ chỉ ước mơ và hỏi từ đó thể hiện mong muốn nào."],
        studentActions: ["HS đọc ngữ liệu, gạch dưới từ, trao đổi cặp đôi và rút ra nhóm từ chỉ ước mơ/khát vọng."],
        learningProducts: ["Danh sách từ có căn cứ từ câu văn."],
      }),
      baseActivity({
        id: "tv-practice",
        phase: "Luyện tập",
        title: "Đặt câu đúng ngữ cảnh",
        teacherActions: ["GV yêu cầu HS luyện đặt hai câu với từ vừa tìm, đọc cho bạn nghe và sửa lỗi dùng từ chưa đúng ngữ cảnh."],
        studentActions: ["HS viết hai câu, đổi vở kiểm tra tiêu chí, sửa lỗi diễn đạt và đọc câu đã chỉnh."],
        learningProducts: ["Hai câu dùng từ về ước mơ đúng ngữ cảnh."],
      }),
      baseActivity({
        id: "tv-apply",
        phase: "Vận dụng",
        title: "Lời nhắn gửi tương lai",
        teacherActions: ["GV nêu bối cảnh gần thực tế: viết lời nhắn 2-3 câu gửi bản thân về một ước mơ học tập trong năm nay."],
        studentActions: ["HS vận dụng từ vừa học để viết lời nhắn ngắn, chia sẻ với bạn và chọn một câu muốn giữ lại."],
        learningProducts: ["Lời nhắn 2-3 câu dùng ít nhất một từ về ước mơ."],
      }),
    ])],
  };
}

function naturalSocialFixture(): SubjectFixture {
  return {
    subject: "Tự nhiên và Xã hội",
    grade: "Lớp 2",
    lessonTitle: "Chăm sóc cây trồng",
    periods: [standardPeriod(1, "Quan sát và chăm sóc cây", [
      baseActivity({
        id: "ns-start",
        phase: "Khởi động",
        title: "Chiếc lá biết nói",
        teacherActions: ["GV cho HS quan sát một chiếc lá an toàn và dự đoán cây cần gì để xanh tốt."],
        studentActions: ["HS quan sát, dự đoán và nêu một việc em từng làm để chăm sóc cây."],
        learningProducts: ["Dự đoán ban đầu về nhu cầu của cây."],
      }),
      baseActivity({
        id: "ns-explore",
        phase: "Khám phá",
        title: "Điều tra cây trong tranh",
        teacherActions: ["GV yêu cầu HS quan sát tranh SGK và cây thật an toàn, mô tả rễ/thân/lá và tìm bằng chứng cây được chăm sóc tốt."],
        studentActions: ["HS quan sát, chỉ bộ phận cây, so sánh cây tươi/cây héo và rút ra việc nên làm để chăm sóc cây."],
        learningProducts: ["Phiếu quan sát bộ phận cây và việc chăm sóc phù hợp."],
      }),
      baseActivity({
        id: "ns-practice",
        phase: "Luyện tập",
        title: "Chọn việc nên làm",
        teacherActions: ["GV giao bộ thẻ việc làm, yêu cầu HS phân loại nên làm/chưa nên làm và nêu lí do theo kết luận vừa học."],
        studentActions: ["HS phân loại thẻ, đối chiếu đáp án, sửa lỗi chọn theo sở thích thay vì nhu cầu của cây."],
        learningProducts: ["Bảng phân loại việc chăm sóc cây."],
      }),
      baseActivity({
        id: "ns-apply",
        phase: "Vận dụng",
        title: "Lịch chăm sóc cây lớp em",
        teacherActions: ["GV giao nhiệm vụ lập checklist chăm sóc cây ở lớp trong một tuần với việc làm cụ thể và người phụ trách."],
        studentActions: ["HS vận dụng bài học để lập checklist chăm sóc cây lớp em và cam kết thực hiện một việc an toàn."],
        learningProducts: ["Checklist chăm sóc cây ở lớp."],
      }),
    ])],
  };
}

function ethicsFixture(): SubjectFixture {
  return {
    subject: "Đạo đức",
    grade: "Lớp 3",
    lessonTitle: "Giữ lời hứa",
    periods: [standardPeriod(1, "Nhận biết và thực hành giữ lời hứa", [
      baseActivity({
        id: "dd-start",
        phase: "Khởi động",
        title: "Lời hứa trên thẻ màu",
        teacherActions: ["GV tổ chức bình chọn thẻ màu: tình huống nào là lời hứa, tình huống nào chỉ là dự định."],
        studentActions: ["HS chọn thẻ, nêu lí do và chia sẻ một trải nghiệm gần gũi."],
        learningProducts: ["Lựa chọn ban đầu kèm lí do."],
      }),
      baseActivity({
        id: "dd-explore",
        phase: "Khám phá",
        title: "Phân tích tình huống",
        teacherActions: ["GV đưa tình huống trong tranh SGK, yêu cầu HS đọc lời thoại, xác định lời hứa và dự đoán hậu quả nếu không thực hiện."],
        studentActions: ["HS đọc tình huống, tìm bằng chứng trong lời thoại, thảo luận và rút ra vì sao cần giữ lời hứa."],
        learningProducts: ["Bảng nguyên nhân - hậu quả của việc giữ/không giữ lời hứa."],
      }),
      baseActivity({
        id: "dd-practice",
        phase: "Luyện tập",
        title: "Chọn cách ứng xử",
        teacherActions: ["GV giao ba tình huống quen thuộc, yêu cầu HS chọn cách ứng xử giữ lời hứa và nhận xét cách chọn của bạn."],
        studentActions: ["HS luyện chọn cách ứng xử, đóng vai ngắn, nhận phản hồi và sửa cách nói chưa phù hợp."],
        learningProducts: ["Cách ứng xử giữ lời hứa trong tình huống quen thuộc."],
      }),
      baseActivity({
        id: "dd-apply",
        phase: "Vận dụng",
        title: "Một lời hứa có thể làm ngay",
        teacherActions: ["GV yêu cầu HS viết một lời hứa nhỏ với gia đình/lớp học trong tuần, kèm cách tự kiểm tra đã thực hiện."],
        studentActions: ["HS viết lời hứa cụ thể, nêu thời điểm thực hiện và chia sẻ với bạn để cùng nhắc nhau."],
        learningProducts: ["Phiếu lời hứa có việc làm, thời điểm và cách tự kiểm tra."],
      }),
    ])],
  };
}

function scienceFixture(): SubjectFixture {
  return {
    subject: "Khoa học",
    grade: "Lớp 4",
    lessonTitle: "Không khí cần cho sự cháy",
    periods: [standardPeriod(1, "Dự đoán và giải thích hiện tượng", [
      baseActivity({
        id: "kh-start",
        phase: "Khởi động",
        title: "Điều gì xảy ra với ngọn nến",
        teacherActions: ["GV chiếu hình thí nghiệm nến bị úp cốc và yêu cầu HS dự đoán hiện tượng bằng thẻ lựa chọn."],
        studentActions: ["HS quan sát hình, chọn dự đoán và nêu lí do ban đầu."],
        learningProducts: ["Dự đoán hiện tượng nến tắt hay cháy tiếp."],
      }),
      baseActivity({
        id: "kh-explore",
        phase: "Khám phá",
        title: "Quan sát thí nghiệm an toàn",
        teacherActions: ["GV làm mẫu thí nghiệm an toàn, yêu cầu HS quan sát thời điểm nến tắt, ghi dữ liệu và giải thích vai trò của không khí."],
        studentActions: ["HS quan sát, ghi kết quả, so sánh với dự đoán và rút ra kết luận không khí cần cho sự cháy."],
        learningProducts: ["Bảng dự đoán - quan sát - kết luận."],
      }),
      baseActivity({
        id: "kh-practice",
        phase: "Luyện tập",
        title: "Giải thích hiện tượng",
        teacherActions: ["GV giao ba hình tình huống, yêu cầu HS luyện giải thích hiện tượng cháy/tắt dựa trên kết luận vừa học."],
        studentActions: ["HS giải thích từng hình, đối chiếu đáp án và sửa lỗi nhầm giữa gió mạnh và thiếu không khí."],
        learningProducts: ["Câu giải thích hiện tượng có căn cứ."],
      }),
      baseActivity({
        id: "kh-apply",
        phase: "Vận dụng",
        title: "An toàn khi dùng lửa ở nhà",
        teacherActions: ["GV nêu tình huống thực tế trong gia đình: xử lí khi thấy lửa nhỏ trong bếp; yêu cầu HS lập checklist an toàn với người lớn."],
        studentActions: ["HS vận dụng kiến thức về không khí và sự cháy để đề xuất checklist an toàn, không tự ý dùng lửa."],
        learningProducts: ["Checklist an toàn khi gặp tình huống có lửa ở nhà."],
      }),
    ])],
  };
}

function historyGeographyFixture(): SubjectFixture {
  return {
    subject: "Lịch sử và Địa lí",
    grade: "Lớp 4",
    lessonTitle: "Bản đồ hành chính Việt Nam",
    periods: [standardPeriod(1, "Đọc kí hiệu và vị trí trên bản đồ", [
      baseActivity({
        id: "lsdl-start",
        phase: "Khởi động",
        title: "Tìm tỉnh trên bản đồ",
        teacherActions: ["GV tổ chức thử thách tìm nhanh một địa danh quen thuộc trên bản đồ lớp học."],
        studentActions: ["HS quan sát bản đồ, chỉ vị trí dự đoán và nêu dấu hiệu em dùng để tìm."],
        learningProducts: ["Vị trí dự đoán và dấu hiệu nhận biết trên bản đồ."],
      }),
      baseActivity({
        id: "lsdl-explore",
        phase: "Khám phá",
        title: "Giải mã chú giải bản đồ",
        teacherActions: ["GV yêu cầu HS đọc chú giải, màu sắc và kí hiệu trên bản đồ hành chính, sau đó xác định thủ đô, tỉnh/thành phố và ranh giới."],
        studentActions: ["HS đọc nguồn bản đồ, đối chiếu chú giải, đánh dấu vị trí và rút ra cách đọc thông tin hành chính."],
        learningProducts: ["Bản đồ nhỏ có đánh dấu vị trí và chú giải đã đọc."],
      }),
      baseActivity({
        id: "lsdl-practice",
        phase: "Luyện tập",
        title: "Đọc bản đồ theo nhiệm vụ",
        teacherActions: ["GV giao phiếu luyện tập: tìm 3 tỉnh/thành phố, xác định kí hiệu thủ đô và nêu cách kiểm tra bằng chú giải."],
        studentActions: ["HS hoàn thành phiếu, đối chiếu với bản đồ, sửa lỗi đọc nhầm màu/kí hiệu."],
        learningProducts: ["Phiếu đọc bản đồ có vị trí và cách kiểm tra."],
      }),
      baseActivity({
        id: "lsdl-apply",
        phase: "Vận dụng",
        title: "Lộ trình giới thiệu quê em",
        teacherActions: ["GV nêu nhiệm vụ thực tế: chọn một địa phương quen thuộc và nói 2 câu giới thiệu vị trí tương đối trên bản đồ."],
        studentActions: ["HS vận dụng cách đọc bản đồ để giới thiệu vị trí địa phương/quê em và chỉ trên bản đồ lớp."],
        learningProducts: ["Lời giới thiệu ngắn về vị trí địa phương trên bản đồ."],
      }),
    ])],
  };
}

function experientialFixture(): SubjectFixture {
  return {
    subject: "Hoạt động trải nghiệm",
    grade: "Lớp 3",
    lessonTitle: "Xây dựng góc học tập gọn gàng",
    periods: [
      standardPeriod(1, "Nhận diện góc học tập gọn gàng", [
        baseActivity({
          id: "hdtn-start-1",
          phase: "Khởi động",
          title: "Ảnh nào làm em muốn học",
          teacherActions: ["GV tổ chức bình chọn hai ảnh góc học tập và yêu cầu HS nêu cảm giác khi nhìn từng ảnh."],
          studentActions: ["HS quan sát ảnh, chọn ảnh tạo động lực học tập và giải thích lí do."],
          learningProducts: ["Lựa chọn ảnh kèm lí do."],
        }),
        baseActivity({
          id: "hdtn-explore-1",
          phase: "Khám phá",
          title: "Phòng tranh tiêu chí",
          teacherActions: ["GV tổ chức phòng tranh: HS quan sát ảnh góc học tập, dùng thẻ dấu hiệu để tìm tiêu chí gọn gàng, đủ ánh sáng, dễ lấy đồ."],
          studentActions: ["HS đi theo nhóm, dán thẻ dấu hiệu, trao đổi và rút ra tiêu chí góc học tập gọn gàng."],
          learningProducts: ["Bộ tiêu chí góc học tập gọn gàng từ quan sát ảnh."],
        }),
        baseActivity({
          id: "hdtn-practice-1",
          phase: "Luyện tập",
          title: "Sắp xếp trên sơ đồ",
          teacherActions: ["GV giao sơ đồ bàn học, yêu cầu HS luyện sắp xếp sách, bút, đèn theo tiêu chí vừa rút ra và nhận xét sản phẩm của bạn."],
          studentActions: ["HS sắp xếp thẻ đồ vật trên sơ đồ, đối chiếu tiêu chí và chỉnh vị trí chưa hợp lí."],
          learningProducts: ["Sơ đồ góc học tập đã sắp xếp theo tiêu chí."],
        }),
        baseActivity({
          id: "hdtn-apply-1",
          phase: "Vận dụng",
          title: "Một thay đổi tối nay",
          teacherActions: ["GV yêu cầu HS chọn một việc thực tế sẽ làm ở góc học tập tại nhà tối nay và viết cách kiểm tra sau khi làm."],
          studentActions: ["HS lập kế hoạch một thay đổi nhỏ ở nhà, chia sẻ với bạn và ghi cách tự kiểm tra."],
          learningProducts: ["Kế hoạch một việc cải thiện góc học tập tại nhà."],
        }),
      ]),
      standardPeriod(2, "Thực hành duy trì góc học tập", [
        baseActivity({
          id: "hdtn-start-2",
          phase: "Khởi động",
          title: "Báo cáo một thay đổi",
          teacherActions: ["GV tổ chức vòng chia sẻ nhanh: HS dùng thẻ cảm xúc để báo cáo việc đã thử làm ở nhà."],
          studentActions: ["HS chọn thẻ cảm xúc, chia sẻ một kết quả hoặc khó khăn khi thực hiện kế hoạch."],
          learningProducts: ["Chia sẻ kết quả thực hiện ở nhà."],
        }),
        baseActivity({
          id: "hdtn-explore-2",
          phase: "Khám phá",
          title: "Phỏng vấn khó khăn thật",
          teacherActions: ["GV tổ chức phỏng vấn cặp đôi: HS hỏi bạn khó khăn khi giữ góc học tập gọn và ghi nguyên nhân thường gặp."],
          studentActions: ["HS phỏng vấn bạn, ghi nguyên nhân, nhóm nguyên nhân và rút ra cách duy trì phù hợp."],
          learningProducts: ["Bảng nguyên nhân và cách duy trì góc học tập."],
        }),
        baseActivity({
          id: "hdtn-practice-2",
          phase: "Luyện tập",
          title: "Xử lí tình huống bừa bộn",
          teacherActions: ["GV giao tình huống góc học tập bừa bộn sau một tuần, yêu cầu HS luyện chọn 3 bước xử lí theo tiêu chí đã học."],
          studentActions: ["HS sắp xếp thứ tự 3 bước, đóng vai nhắc bạn và sửa cách nói chưa tích cực."],
          learningProducts: ["Ba bước xử lí tình huống góc học tập bừa bộn."],
        }),
        baseActivity({
          id: "hdtn-apply-2",
          phase: "Vận dụng",
          title: "Checklist 7 ngày",
          teacherActions: ["GV yêu cầu HS lập checklist 7 ngày cho góc học tập ở nhà/lớp và chọn người nhắc nhở phù hợp."],
          studentActions: ["HS vận dụng tiêu chí, lập checklist duy trì, chia sẻ với bạn và thống nhất cách theo dõi."],
          learningProducts: ["Checklist 7 ngày duy trì góc học tập."],
        }),
      ]),
    ],
  };
}

describe("phase quality fixtures across subjects", () => {
  const fixtures = [
    mathFixture(),
    vietnameseFixture(),
    naturalSocialFixture(),
    ethicsFixture(),
    scienceFixture(),
    historyGeographyFixture(),
    experientialFixture(),
  ];

  it.each(fixtures)("accepts a teachable %s fixture", (fixture) => {
    const findings = validatePhaseQuality(lessonFromFixture(fixture));
    expect(findings).toEqual([]);
  });

  it("keeps multi-period discovery varied when the method and product change", () => {
    const findings = validatePhaseQuality(lessonFromFixture(experientialFixture()));
    expect(findings.map((finding) => finding.code)).not.toContain("PHASE-QUALITY-05");
  });
});
