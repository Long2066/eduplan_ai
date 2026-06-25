import type { LessonInput, LessonPlan } from "@/types/lesson";

function display(value: string) {
  return value && value !== "auto" ? value : "AI tự chọn theo thông tin bài học";
}

export function createMockLesson(input: LessonInput): LessonPlan {
  const style = input.style;
  const facilities = input.facilities === "auto" ? "AI tự chọn" : input.facilities.join(", ");

  return {
    generalInfo: {
      subject: input.subject || "................................",
      grade: input.grade || "................................",
      lessonTitle: input.lessonTitle || "AI TỰ NHẬN DIỆN TỪ ẢNH SGK",
      book: input.book || "................................",
      periods: input.periods || 1,
      duration: input.duration,
    },
    outcomes: {
      generalCompetencies: [
        "Tự chủ và tự học: chủ động quan sát, trả lời câu hỏi và hoàn thành nhiệm vụ học tập.",
        "Giao tiếp và hợp tác: trao đổi trong nhóm, lắng nghe và phản hồi ý kiến của bạn.",
      ],
      specificCompetencies: [
        `Nhận biết nội dung trọng tâm của bài ${input.lessonTitle || "học"} qua hình ảnh/tư liệu SGK.`,
        "Vận dụng kiến thức để giải quyết nhiệm vụ học tập phù hợp lứa tuổi.",
      ],
      qualities: ["Chăm chỉ", "Trách nhiệm", "Trung thực khi tự đánh giá kết quả học tập"],
      knowledgeAndSkills: [
        "Nắm được kiến thức cốt lõi của bài học.",
        "Thực hiện được nhiệm vụ luyện tập và vận dụng theo hướng dẫn của giáo viên.",
      ],
    },
    materials: {
      teacher: ["Ảnh SGK đã upload", "Phiếu học tập", facilities, "Bảng phụ hoặc slide minh họa"],
      students: ["Sách giáo khoa", "Vở ghi", "Bút màu hoặc thẻ trả lời"],
    },
    activities: [
      {
        phase: "Khởi động",
        title: "Tạo hứng thú và kết nối bài học",
        objective: "Kích hoạt hiểu biết ban đầu của học sinh.",
        teacherActions: [
          "Chiếu hoặc giới thiệu hình ảnh liên quan đến bài học.",
          "Đặt câu hỏi gợi mở: Em quan sát thấy điều gì? Điều này gợi cho em nhớ đến kiến thức nào?",
          "Dẫn dắt vào bài học bằng một tình huống gần gũi.",
        ],
        studentActions: [
          "Quan sát hình ảnh/tình huống.",
          "Chia sẻ nhanh suy nghĩ cá nhân.",
          "Lắng nghe bạn và chuẩn bị vào bài mới.",
        ],
        learningProducts: ["Câu trả lời miệng hoặc ghi chú nhanh của học sinh"],
      },
      {
        phase: "Khám phá / hình thành kiến thức",
        title: "Tìm hiểu nội dung trọng tâm",
        objective: "Học sinh hình thành kiến thức mới từ tư liệu và nhiệm vụ học tập.",
        teacherActions: [
          "Tổ chức cho học sinh đọc/quan sát nội dung từ tài liệu đã OCR.",
          "Nêu câu hỏi theo từng bước, từ nhận biết đến giải thích.",
          "Chốt kiến thức bằng bảng tóm tắt ngắn gọn, dễ nhớ.",
        ],
        studentActions: [
          "Làm việc cá nhân hoặc theo cặp để tìm thông tin.",
          "Trả lời câu hỏi và bổ sung ý kiến cho bạn.",
          "Ghi lại kiến thức chính vào vở.",
        ],
        learningProducts: ["Bảng tóm tắt kiến thức hoặc câu trả lời nhóm"],
      },
      {
        phase: "Luyện tập / thực hành",
        title: "Củng cố kiến thức",
        objective: "Học sinh luyện tập để nắm chắc nội dung bài học.",
        teacherActions: [
          "Giao bài tập vừa sức, phân hóa theo đối tượng học sinh.",
          "Quan sát, hỗ trợ học sinh cần giúp đỡ.",
          "Mời học sinh trình bày cách làm và nhận xét chung.",
        ],
        studentActions: [
          "Hoàn thành nhiệm vụ luyện tập.",
          "Trao đổi với bạn khi cần.",
          "Tự kiểm tra kết quả theo hướng dẫn của giáo viên.",
        ],
      },
      {
        phase: "Vận dụng",
        title: "Liên hệ thực tế",
        objective: "Học sinh biết vận dụng kiến thức vào tình huống gần gũi.",
        teacherActions: [
          "Nêu tình huống thực tế phù hợp môi trường học của lớp.",
          "Khuyến khích học sinh lựa chọn cách trình bày: nói, viết ngắn, vẽ sơ đồ hoặc đóng vai.",
        ],
        studentActions: [
          "Đề xuất cách giải quyết tình huống.",
          "Chia sẻ sản phẩm vận dụng trước lớp.",
        ],
        learningProducts: ["Sản phẩm vận dụng ngắn của cá nhân/nhóm"],
      },
      {
        phase: "Đánh giá, nhận xét",
        title: "Tự đánh giá và định hướng sau bài học",
        objective: "Giáo viên và học sinh xác định mức độ đạt yêu cầu cần đạt.",
        teacherActions: [
          "Sử dụng câu hỏi nhanh hoặc phiếu exit ticket để kiểm tra mức độ hiểu bài.",
          "Nhận xét tinh thần học tập, sản phẩm và mức độ hợp tác của học sinh.",
        ],
        studentActions: [
          "Tự đánh giá mức độ hoàn thành nhiệm vụ.",
          "Nêu điều đã hiểu và điều còn băn khoăn.",
        ],
      },
    ],
    assessment: {
      criteria: ["Hoàn thành nhiệm vụ học tập", "Trả lời đúng câu hỏi trọng tâm", "Hợp tác tích cực trong nhóm"],
      evidence: ["Câu trả lời miệng", "Phiếu học tập", "Sản phẩm vận dụng"],
      comments: ["Khuyến khích học sinh tự tin chia sẻ", "Hỗ trợ thêm nhóm học sinh còn lúng túng"],
    },
    adjustments: {
      suitablePoints: ["Hoạt động phù hợp với thời lượng 35 phút/tiết", "Câu hỏi gợi mở giúp học sinh dễ tham gia"],
      pointsToAdjust: ["Điều chỉnh mức độ bài tập theo khả năng thực tế của lớp"],
      nextLessonDirection: ["Tăng thời gian luyện tập nếu nhiều học sinh chưa đạt yêu cầu"],
    },
    contextFit: {
      notes: [
        `Đối tượng học sinh: ${display(input.studentProfile)}.`,
        `Môi trường học: ${display(input.teachingEnvironment)}.`,
        `Phong cách giáo án: ${style}.`,
      ],
    },
    meta: {
      style,
      modelUsed: "Mock preview - chưa gọi AI thật",
      createdAt: new Date().toISOString(),
    },
  };
}
