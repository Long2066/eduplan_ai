import type { CanonicalSubject } from "@/lib/subject-catalog";

export type GradeBand = "Lớp 1-2" | "Lớp 3" | "Lớp 4-5";

export type PedagogyProfile = {
  subject: CanonicalSubject;
  purpose: string;
  coreTeachingFocus: string[];
  signatureActivities: string[];
  commonMisconceptions: string[];
  supportQuestions: string[];
  assessmentCriteria: string[];
  differentiationMoves: string[];
  applicationMoves: string[];
  avoid: string[];
  gradeBandAdjustments: Partial<Record<GradeBand, string[]>>;
  qualityChecks: string[];
  repairHints: string[];
};

export function gradeBandFor(grade: string): GradeBand {
  if (grade === "Lớp 1" || grade === "Lớp 2") return "Lớp 1-2";
  if (grade === "Lớp 3") return "Lớp 3";
  return "Lớp 4-5";
}

export const mathPedagogyProfile: PedagogyProfile = {
  subject: "Toán",
  purpose:
    "Giúp học sinh hình thành khái niệm toán học từ thao tác, hình ảnh, sơ đồ và tình huống có nghĩa trước khi khái quát thành quy trình hoặc công thức.",
  coreTeachingFocus: [
    "Lấy hiểu bản chất làm trung tâm: học sinh cần nói được vì sao làm như vậy, không chỉ ghi công thức.",
    "Luôn có biểu diễn phù hợp: vật thật, que tính, bảng, sơ đồ đoạn thẳng, hình vẽ, bảng số hoặc mô hình theo nội dung bài.",
    "Với bài toán có lời văn, phải xác định rõ dữ kiện, quan hệ giữa các đại lượng, câu hỏi cần tìm và bước kiểm tra kết quả.",
    "Với lớp 4-5, cần làm rõ mối quan hệ số học như phân số, tỉ số, hiệu/tổng số phần, đơn vị đo, mốc thời gian, diện tích/thể tích hoặc chuyển động nếu bài có liên quan.",
    "Dành thời gian để học sinh tự diễn đạt quy trình bằng lời của mình sau khi giải.",
  ],
  signatureActivities: [
    "Quan sát tình huống hoặc tranh SGK để nêu bài toán bằng lời.",
    "Tóm tắt bằng sơ đồ, bảng, hình vẽ hoặc ký hiệu vừa sức.",
    "Trao đổi cặp đôi/nhóm nhỏ để dự đoán cách làm trước khi giáo viên chốt.",
    "Giải mẫu có phân tích từng bước và nêu lý do chọn phép tính.",
    "Luyện tập theo 3 mức: củng cố trực tiếp, vận dụng tình huống quen thuộc, vận dụng cao/phân hóa.",
    "Kiểm tra ngược bằng dữ kiện đề bài: hiệu/tổng/tỉ số/đơn vị/kết quả thực tế.",
  ],
  commonMisconceptions: [
    "Nhầm số lớn - số bé hoặc nhầm đại lượng ứng với tử số/mẫu số trong bài tỉ số.",
    "Lấy hiệu/tổng chia nhầm cho tử số hoặc mẫu số thay vì chia cho tổng/hiệu số phần bằng nhau.",
    "Bỏ qua mốc thời gian trong bài toán tuổi; không nhận ra hiệu tuổi không đổi.",
    "Quên đổi đơn vị đo như tấn - kg, m - cm, giờ - phút hoặc đơn vị tiền.",
    "Áp dụng công thức quá sớm nên không giải thích được sơ đồ hoặc ý nghĩa phép tính.",
    "Tính xong không kiểm tra lại theo dữ kiện ban đầu.",
  ],
  supportQuestions: [
    "Đề bài cho biết những dữ kiện nào? Câu hỏi yêu cầu tìm gì?",
    "Đại lượng nào lớn hơn/bé hơn? Vì sao con biết?",
    "Nếu biểu diễn bằng phần bằng nhau thì mỗi đại lượng có mấy phần?",
    "Phần hơn/kém hoặc tổng cộng ứng với mấy phần?",
    "Muốn tìm 1 phần, con cần lấy số nào chia cho số phần nào?",
    "Kết quả tìm được có thỏa mãn lại hiệu/tổng/tỉ số của đề bài không?",
    "Có cần đổi đơn vị trước khi tính không?",
    "Bài này có mốc thời gian hiện nay/sau này/trước đây không?",
  ],
  assessmentCriteria: [
    "Học sinh xác định đúng dữ kiện, yêu cầu và quan hệ giữa các đại lượng.",
    "Học sinh tóm tắt hoặc biểu diễn bài toán phù hợp với nội dung bài.",
    "Học sinh chọn đúng phép tính/quy trình và giải thích được lý do.",
    "Học sinh tính toán chính xác, ghi đơn vị đúng nếu có.",
    "Học sinh kiểm tra lại kết quả bằng dữ kiện đề bài.",
    "Học sinh trình bày được cách làm bằng lời, sơ đồ hoặc bài giải rõ ràng.",
  ],
  differentiationMoves: [
    "Học sinh cần hỗ trợ: dùng thẻ phần, sơ đồ khuyết, câu hỏi gợi mở từng bước và bài số nhỏ.",
    "Học sinh trung bình: làm bài tương tự có thay số hoặc thay ngữ cảnh gần gũi.",
    "Học sinh khá giỏi: tự đặt đề, giải bằng cách khác, giải thích lỗi sai hoặc xử lý bài có dữ kiện ẩn hơn.",
    "Nếu lớp đông hoặc không đồng đều, ưu tiên cặp đôi hỗ trợ và bảng phụ/sơ đồ mẫu để tránh mất thời gian.",
  ],
  applicationMoves: [
    "Gắn bài toán với lớp học, sách vở, cây trồng, quãng đường, mua bán, thời gian, diện tích sân trường hoặc tình huống địa phương.",
    "Vận dụng ngắn trong 3-5 phút chỉ nên yêu cầu nêu cách làm, đặt đề nhanh, giải một bước trọng tâm hoặc giao hoàn thiện ở nhà.",
    "Không đưa tình huống vận dụng có dữ kiện mâu thuẫn với quan hệ toán học.",
  ],
  avoid: [
    "Không mở bài bằng công thức khi học sinh chưa hiểu biểu diễn và quan hệ toán học.",
    "Không dùng trò chơi vui nhưng không phục vụ kiến thức trọng tâm.",
    "Không nhồi quá nhiều bài trong một tiết 35 phút, đặc biệt với bài có nhiều mốc thời gian hoặc đổi đơn vị.",
    "Không viết chung chung 'HS làm bài' mà thiếu dữ kiện, đáp án dự kiến, lỗi sai thường gặp hoặc lời chốt.",
    "Không để khởi động dùng nguyên dữ kiện của bài chính khiến hoạt động khám phá bị lộ đáp án.",
  ],
  gradeBandAdjustments: {
    "Lớp 1-2": [
      "Ưu tiên thao tác trực quan, tranh ảnh, que tính, đồ vật thật, nói miệng và câu hỏi ngắn.",
      "Bài toán có lời văn cần tóm tắt rất đơn giản, tránh yêu cầu giải thích dài.",
      "Đánh giá qua thao tác, câu trả lời miệng, kết quả viết ngắn và khả năng nêu phép tính phù hợp.",
    ],
    "Lớp 3": [
      "Tăng dần hoạt động tự tóm tắt, giải bài có lời văn, bảng số, đo lường và giải thích cách làm.",
      "Cần chỉ rõ lỗi sai về phép tính, đơn vị và đọc hiểu đề.",
      "Có thể dùng phiếu học tập ngắn và trao đổi cặp đôi trước khi trình bày.",
    ],
    "Lớp 4-5": [
      "Ưu tiên phân tích quan hệ toán học: phân số, tỉ số, tổng/hiệu số phần, diện tích, thể tích, thời gian, chuyển động.",
      "Với bài toán tỉ số, sơ đồ đoạn thẳng hoặc bảng phần phải là điểm tựa hình thành kiến thức.",
      "Bài luyện tập nên chia mức, trong đó bài khó như tuổi, đổi đơn vị, vận dụng thực tế được hướng dẫn kỹ hoặc giao phân hóa.",
    ],
  },
  qualityChecks: [
    "Bài toán/tình huống tự tạo có nhất quán dữ kiện không.",
    "Có biểu diễn toán học phù hợp với trọng tâm bài không.",
    "Có câu hỏi gợi mở cho học sinh yếu ở chỗ dễ sai không.",
    "Có đáp án dự kiến, lỗi sai thường gặp và lời chốt kiến thức không.",
    "Số lượng bài luyện tập có vừa thời lượng 35 phút không.",
    "Có kiểm tra ngược kết quả bằng dữ kiện ban đầu không.",
    "Khởi động có ôn kiến thức nền mà không giải trước bài chính không.",
  ],
  repairHints: [
    "Nếu phát hiện dữ kiện mâu thuẫn, sửa lại quan hệ lớn/bé, tỉ số, hiệu/tổng hoặc đơn vị trước khi sửa lời dẫn.",
    "Nếu hoạt động quá dày, giữ bài cốt lõi cho cả lớp và chuyển bài khó sang vận dụng cao hoặc về nhà.",
    "Nếu thiếu hỗ trợ học sinh yếu, bổ sung chuỗi câu hỏi: dữ kiện - số lớn/bé - số phần - 1 phần - kết quả - kiểm tra.",
    "Nếu giáo án mở bằng công thức, chuyển sang tình huống trực quan/sơ đồ rồi mới chốt quy trình.",
    "Nếu thiếu đánh giá, thêm tiêu chí quan sát được gắn với tóm tắt, phép tính, trình bày và kiểm tra kết quả.",
  ],
};

export const vietnamesePedagogyProfile: PedagogyProfile = {
  subject: "Tiếng Việt",
  purpose:
    "Giúp học sinh phát triển năng lực đọc, viết, nói, nghe và dùng tiếng Việt để học tập, giao tiếp, cảm nhận văn bản và bày tỏ suy nghĩ phù hợp lứa tuổi.",
  coreTeachingFocus: [
    "Dạy tiếng Việt phải đi từ ngữ liệu cụ thể: âm, vần, tiếng, từ, câu, đoạn, văn bản và tình huống giao tiếp.",
    "Kết hợp đọc đúng, đọc hiểu, nói nghe và viết; không tách kỹ năng thành các việc rời rạc không có mục đích giao tiếp.",
    "Với văn bản đọc, cần có câu hỏi trước khi đọc, trong khi đọc và sau khi đọc để dẫn học sinh hiểu nội dung, chi tiết, nhân vật, cảm xúc hoặc thông điệp.",
    "Với tập viết/chính tả/luyện từ và câu/tập làm văn, cần có mẫu, phân tích mẫu, luyện có kiểm soát rồi mới vận dụng.",
    "Tôn trọng trải nghiệm và vốn từ của học sinh; khuyến khích diễn đạt bằng lời của mình trước khi chuẩn hóa.",
  ],
  signatureActivities: [
    "Khởi động bằng tranh, tình huống giao tiếp, câu đố, từ khóa hoặc trải nghiệm gần bài.",
    "Đọc mẫu/đọc nối tiếp/đọc thầm có nhiệm vụ; luyện đọc từ khó, câu dài, giọng đọc.",
    "Tìm chi tiết trong văn bản, giải nghĩa từ trong ngữ cảnh, trả lời câu hỏi theo nhiều mức.",
    "Thảo luận cặp đôi/nhóm nhỏ để nói lại, kể lại, nêu cảm nghĩ hoặc đóng vai.",
    "Viết theo khung gợi ý: từ - câu - đoạn; đọc lại và chỉnh sửa theo tiêu chí.",
    "Mở rộng vốn từ bằng trò chơi ngôn ngữ, sơ đồ từ, đặt câu, dùng từ trong tình huống thật.",
  ],
  commonMisconceptions: [
    "Đọc trôi chảy nhưng không hiểu chi tiết hoặc ý chính của văn bản.",
    "Trả lời câu hỏi bằng cách chép nguyên văn mà chưa diễn đạt ý hiểu.",
    "Nhầm nghĩa của từ vì tách khỏi ngữ cảnh.",
    "Viết câu thiếu chủ ngữ/vị ngữ, thiếu dấu câu hoặc dùng từ lặp.",
    "Kể/viết lan man, không theo trình tự sự việc hoặc không bám yêu cầu đề.",
    "Ngại nói trước lớp vì sợ sai phát âm, sai từ hoặc thiếu ý.",
  ],
  supportQuestions: [
    "Con nhìn thấy/đọc thấy chi tiết nào trong tranh hoặc văn bản?",
    "Từ/câu này giúp con hiểu điều gì về nhân vật/sự việc?",
    "Nếu nói bằng lời của con, ý chính là gì?",
    "Câu trả lời của con dựa vào dòng/đoạn nào?",
    "Con có thể thay từ này bằng từ nào gần nghĩa hơn không?",
    "Câu con viết đã đủ ý chưa? Có dấu câu chưa?",
    "Nếu nói với bạn, con sẽ nói thế nào cho rõ và lịch sự?",
  ],
  assessmentCriteria: [
    "Học sinh đọc đúng, rõ, biết ngắt nghỉ hoặc thể hiện giọng đọc phù hợp mức lớp.",
    "Học sinh nêu được chi tiết, ý chính, cảm xúc hoặc thông điệp của văn bản.",
    "Học sinh dùng từ, đặt câu, viết đoạn đúng yêu cầu và có chỉnh sửa sau góp ý.",
    "Học sinh tham gia nói nghe: biết lắng nghe, phản hồi, hỏi lại hoặc trình bày rõ ý.",
    "Học sinh vận dụng từ/cấu trúc/cách diễn đạt vào tình huống giao tiếp hoặc bài viết ngắn.",
  ],
  differentiationMoves: [
    "Học sinh yếu: cho đọc câu ngắn, từ khóa, tranh gợi ý, khung câu và câu hỏi lựa chọn.",
    "Học sinh trung bình: yêu cầu trả lời đủ ý, tìm bằng chứng trong văn bản, viết câu/đoạn có gợi ý.",
    "Học sinh khá giỏi: nêu cảm nhận, so sánh nhân vật, viết mở rộng, đặt câu hỏi cho bạn hoặc đổi vai giao tiếp.",
    "Với lớp có nhiều mức đọc, tổ chức đọc theo nhóm nhỏ và giao nhiệm vụ khác nhau trên cùng văn bản.",
  ],
  applicationMoves: [
    "Gắn bài học với giao tiếp hằng ngày: chào hỏi, xin lỗi, cảm ơn, kể việc, viết lời nhắn, viết đoạn chia sẻ.",
    "Cho học sinh dùng từ mới trong câu nói thật, nhật ký ngắn, thẻ cảm xúc hoặc sản phẩm lớp học.",
    "Vận dụng nên ngắn, rõ sản phẩm: một câu nói, một đoạn 3-5 câu, một lời kể, một phiếu đọc hoặc một cuộc trao đổi.",
  ],
  avoid: [
    "Không biến tiết Tiếng Việt thành hỏi đáp máy móc chỉ để tìm đáp án đúng.",
    "Không yêu cầu học sinh viết dài khi chưa có mẫu, vốn từ và khung ý.",
    "Không bỏ qua luyện đọc từ khó, câu dài hoặc phát âm với lớp 1-2.",
    "Không chấm lỗi chính tả/ngữ pháp mà thiếu cơ hội sửa lỗi.",
    "Không dùng câu hỏi quá trừu tượng vượt trải nghiệm của học sinh tiểu học.",
  ],
  gradeBandAdjustments: {
    "Lớp 1-2": [
      "Trọng tâm là âm-vần-tiếng-từ-câu, đọc đúng, viết đúng nét/chữ, nói thành câu và hiểu nội dung trực tiếp.",
      "Hoạt động cần nhiều tranh, thẻ chữ, thao tác ghép tiếng, đọc đồng thanh/cá nhân và luyện viết ngắn.",
      "Câu hỏi đọc hiểu nên cụ thể, bám tranh và chi tiết dễ nhận ra.",
    ],
    "Lớp 3": [
      "Chuyển dần từ học đọc sang đọc để học; tăng câu hỏi suy luận đơn giản và kể/viết theo trình tự.",
      "Cần luyện mở rộng vốn từ, đặt câu, viết đoạn có câu chủ đề và chi tiết.",
      "Khuyến khích học sinh nêu cảm nghĩ nhưng vẫn phải dựa vào văn bản.",
    ],
    "Lớp 4-5": [
      "Tăng đọc hiểu đa tầng: chi tiết, ý chính, biện pháp nghệ thuật, thông điệp và liên hệ bản thân.",
      "Viết đoạn/bài cần có lập ý, sắp xếp ý, dùng từ nối, chỉnh sửa và tiêu chí rõ.",
      "Nói nghe cần hướng đến thuyết trình ngắn, trao đổi có lý lẽ và phản hồi lịch sự.",
    ],
  },
  qualityChecks: [
    "Có ngữ liệu và mục tiêu kỹ năng rõ: đọc, viết, nói nghe, luyện từ/câu hay chính tả.",
    "Có hoạt động trước - trong - sau đọc nếu là bài đọc.",
    "Có luyện mẫu trước khi yêu cầu học sinh nói/viết độc lập.",
    "Có câu hỏi hỗ trợ học sinh tìm bằng chứng trong văn bản.",
    "Có sản phẩm ngôn ngữ quan sát được và tiêu chí đánh giá cụ thể.",
    "Có cơ hội học sinh sửa lỗi phát âm, dùng từ, đặt câu hoặc bài viết.",
  ],
  repairHints: [
    "Nếu giáo án chỉ hỏi đáp nội dung, bổ sung hoạt động đọc có nhiệm vụ, giải nghĩa từ và nói/viết vận dụng.",
    "Nếu yêu cầu viết quá dài, thêm mẫu, khung ý và rút sản phẩm theo mức lớp.",
    "Nếu thiếu hỗ trợ học sinh yếu, thêm tranh/từ khóa/khung câu/câu hỏi lựa chọn.",
    "Nếu câu hỏi quá chung, chuyển thành câu hỏi bám chi tiết văn bản và yêu cầu nêu bằng chứng.",
    "Nếu thiếu đánh giá, thêm tiêu chí đọc đúng, hiểu ý, diễn đạt và chỉnh sửa.",
  ],
};

export const ethicsPedagogyProfile: PedagogyProfile = {
  subject: "Đạo đức",
  purpose:
    "Giúp học sinh nhận biết giá trị, chuẩn mực hành vi và biết lựa chọn cách ứng xử phù hợp trong tình huống gần gũi với gia đình, nhà trường và cộng đồng.",
  coreTeachingFocus: [
    "Dạy đạo đức qua tình huống, lựa chọn, hậu quả và cam kết hành vi; không chỉ giảng điều hay lẽ phải.",
    "Luôn làm rõ: việc gì xảy ra, ai liên quan, cảm xúc của mỗi người, hành vi nào nên/không nên và vì sao.",
    "Khuyến khích học sinh nêu trải nghiệm thật nhưng phải giữ an toàn, không làm em nào bị bêu tên.",
    "Kết nối bài học với hành động nhỏ có thể thực hiện ngay trong lớp, ở nhà hoặc ở trường.",
  ],
  signatureActivities: [
    "Quan sát tranh/tình huống, nhận diện hành vi đúng/chưa đúng.",
    "Đóng vai hoặc xử lý tình huống theo nhóm nhỏ.",
    "Thảo luận hậu quả của mỗi lựa chọn và cảm xúc của người liên quan.",
    "Lập cam kết hành động nhỏ, thẻ việc tốt hoặc nhật ký hành vi.",
    "Chia sẻ gương tốt, câu chuyện thật hoặc việc làm trong lớp.",
  ],
  commonMisconceptions: [
    "Học sinh nói được hành vi đúng nhưng chưa biết làm trong tình huống thật.",
    "Đồng nhất đạo đức với vâng lời tuyệt đối, thiếu phân tích lý do và hoàn cảnh.",
    "Chỉ phán xét bạn sai mà chưa biết cách góp ý hoặc hỗ trợ.",
    "Nhầm giữa cảm xúc cá nhân và cách ứng xử phù hợp.",
  ],
  supportQuestions: [
    "Trong tình huống này, điều gì đã xảy ra?",
    "Bạn/nhân vật đang cảm thấy thế nào?",
    "Nếu làm như vậy, điều gì có thể xảy ra tiếp theo?",
    "Cách nào vừa đúng vừa không làm tổn thương người khác?",
    "Con có thể làm một việc nhỏ nào ngay hôm nay?",
  ],
  assessmentCriteria: [
    "Học sinh nhận diện được hành vi phù hợp/chưa phù hợp.",
    "Học sinh nêu được lý do và hậu quả của lựa chọn hành vi.",
    "Học sinh đề xuất được cách ứng xử cụ thể trong tình huống.",
    "Học sinh thể hiện cam kết hoặc thực hành hành vi tích cực.",
  ],
  differentiationMoves: [
    "Học sinh rụt rè: cho chọn thẻ hành vi, nói với bạn bên cạnh trước khi chia sẻ.",
    "Học sinh khá: yêu cầu phân tích nhiều phương án và chọn cách ứng xử tinh tế hơn.",
    "Dùng tình huống phân tầng: dễ nhận diện cho cả lớp, tình huống có xung đột nhẹ cho nhóm khá.",
  ],
  applicationMoves: [
    "Giao nhiệm vụ hành động nhỏ: giúp bạn, giữ lời hứa, xếp hàng, tiết kiệm, chăm sóc bản thân, nói lời lịch sự.",
    "Theo dõi bằng phiếu tự đánh giá hoặc góc cam kết lớp trong 1 tuần.",
  ],
  avoid: [
    "Không biến tiết học thành bài giảng đạo lý một chiều.",
    "Không nêu tên học sinh thật trong tình huống tiêu cực.",
    "Không chỉ yêu cầu học sinh hứa suông mà thiếu hành động cụ thể.",
    "Không dùng tình huống quá nặng, gây xấu hổ hoặc vượt trải nghiệm lứa tuổi.",
  ],
  gradeBandAdjustments: {
    "Lớp 1-2": [
      "Tình huống ngắn, tranh rõ, hành vi cụ thể: chào hỏi, giữ đồ dùng, giúp bạn, an toàn cá nhân.",
      "Ưu tiên đóng vai ngắn, thẻ mặt cười/mặt buồn và lời nói mẫu.",
    ],
    "Lớp 3": [
      "Tăng phân tích lý do, hậu quả và lựa chọn khác nhau trong quan hệ bạn bè, gia đình, trường lớp.",
      "Có thể dùng nhật ký việc tốt hoặc bảng theo dõi cam kết.",
    ],
    "Lớp 4-5": [
      "Tăng thảo luận về trách nhiệm, quyền và bổn phận, tôn trọng khác biệt, tự quản và cộng đồng.",
      "Khuyến khích tranh luận lịch sự và xây dựng quy tắc ứng xử của nhóm/lớp.",
    ],
  },
  qualityChecks: [
    "Có tình huống đạo đức cụ thể, gần đời sống học sinh không.",
    "Có bước phân tích hành vi, cảm xúc, hậu quả và lựa chọn không.",
    "Có hoạt động thực hành/đóng vai chứ không chỉ nghe giảng không.",
    "Có cam kết hành động nhỏ và tiêu chí quan sát không.",
  ],
  repairHints: [
    "Nếu giáo án chỉ nêu bài học đạo lý, thêm tình huống tranh luận và đóng vai.",
    "Nếu vận dụng chung chung, đổi thành một hành động nhỏ có thể làm trong ngày.",
    "Nếu câu hỏi phán xét, sửa thành câu hỏi phân tích cảm xúc - hậu quả - cách ứng xử.",
  ],
};

export const naturalSocialPedagogyProfile: PedagogyProfile = {
  subject: "Tự nhiên và Xã hội",
  purpose:
    "Giúp học sinh quan sát, mô tả, phân loại và giải thích ban đầu về cơ thể, gia đình, trường học, cộng đồng, tự nhiên và môi trường xung quanh.",
  coreTeachingFocus: [
    "Dạy từ quan sát thật/tranh ảnh/thí nghiệm nhỏ đến mô tả, so sánh, phân loại và kết luận đơn giản.",
    "Kết nối kiến thức với chăm sóc bản thân, an toàn, gia đình, trường lớp, địa phương và bảo vệ môi trường.",
    "Ưu tiên câu hỏi khám phá: con thấy gì, giống/khác gì, vì sao, cần làm gì.",
    "Không yêu cầu học sinh ghi nhớ thuật ngữ vượt quá mức trải nghiệm trực tiếp.",
  ],
  signatureActivities: [
    "Quan sát tranh, vật thật, mô hình hoặc môi trường lớp/trường.",
    "Phân loại bằng thẻ, bảng hai cột, sơ đồ đơn giản.",
    "Thực hành kỹ năng: vệ sinh, an toàn, chăm sóc cây/con vật, ứng xử nơi công cộng.",
    "Điều tra nhỏ: hỏi người thân, quan sát ở nhà, ghi lại bằng tranh hoặc phiếu.",
    "Chia sẻ kết quả và rút ra kết luận hành động.",
  ],
  commonMisconceptions: [
    "Nhầm đặc điểm quan sát được với suy đoán chưa có căn cứ.",
    "Phân loại theo cảm tính thay vì theo tiêu chí đã thống nhất.",
    "Biết quy tắc an toàn/vệ sinh nhưng không nêu được lý do cần làm.",
    "Nhầm vai trò của thành viên gia đình, bộ phận cơ thể, mùa, thời tiết hoặc môi trường sống.",
  ],
  supportQuestions: [
    "Con quan sát thấy những đặc điểm nào?",
    "Hai sự vật này giống và khác nhau ở điểm nào?",
    "Con đang phân loại theo tiêu chí nào?",
    "Nếu không làm việc này thì điều gì có thể xảy ra?",
    "Ở nhà/trường con đã gặp tình huống tương tự chưa?",
  ],
  assessmentCriteria: [
    "Học sinh quan sát và mô tả được đặc điểm chính.",
    "Học sinh biết so sánh, phân loại theo tiêu chí đơn giản.",
    "Học sinh nêu được việc nên làm để chăm sóc bản thân, gia đình, môi trường hoặc bảo đảm an toàn.",
    "Học sinh trình bày kết quả bằng lời, tranh, bảng hoặc phiếu học tập.",
  ],
  differentiationMoves: [
    "Học sinh yếu: dùng tranh rõ, câu hỏi chọn đáp án, bảng phân loại có mẫu.",
    "Học sinh khá: yêu cầu giải thích tiêu chí, tìm ví dụ khác hoặc đề xuất cách xử lý tình huống.",
    "Cho phép học sinh trả lời bằng vẽ, chỉ tranh hoặc nói ngắn nếu còn hạn chế ngôn ngữ.",
  ],
  applicationMoves: [
    "Giao nhiệm vụ quan sát ở nhà/trường: cây trong sân, đồ dùng an toàn, thói quen vệ sinh, việc làm giúp gia đình.",
    "Vận dụng thành việc làm cụ thể: rửa tay đúng cách, phân loại rác, chăm sóc cây, đi đường an toàn.",
  ],
  avoid: [
    "Không biến bài học thành học thuộc định nghĩa.",
    "Không dùng thí nghiệm/vật thật thiếu an toàn hoặc khó chuẩn bị.",
    "Không hỏi quá nhiều câu vì sao trừu tượng khi học sinh chưa quan sát đủ.",
    "Không bỏ qua liên hệ hành động thực tế sau khi khám phá.",
  ],
  gradeBandAdjustments: {
    "Lớp 1-2": [
      "Trọng tâm là quan sát, gọi tên, mô tả và thực hành hành vi an toàn/vệ sinh gần gũi.",
      "Dùng tranh lớn, vật thật, trò chơi phân loại và thao tác ngắn.",
    ],
    "Lớp 3": [
      "Tăng điều tra nhỏ, bảng ghi nhận, so sánh theo tiêu chí và trình bày kết quả.",
      "Có thể yêu cầu học sinh nêu nguyên nhân - kết quả đơn giản.",
    ],
  },
  qualityChecks: [
    "Có hoạt động quan sát/khám phá trước khi kết luận không.",
    "Có tiêu chí phân loại hoặc câu hỏi so sánh rõ không.",
    "Có liên hệ với hành vi an toàn, vệ sinh, môi trường hoặc cộng đồng không.",
    "Có sản phẩm học tập quan sát được: phiếu, bảng, tranh, lời trình bày không.",
  ],
  repairHints: [
    "Nếu bài quá lý thuyết, thêm quan sát tranh/vật thật và nhiệm vụ phân loại.",
    "Nếu thiếu vận dụng, thêm việc làm cụ thể ở nhà/trường.",
    "Nếu câu hỏi mơ hồ, đổi thành quan sát - so sánh - phân loại - giải thích đơn giản.",
  ],
};

export const sciencePedagogyProfile: PedagogyProfile = {
  subject: "Khoa học",
  purpose:
    "Giúp học sinh lớp 4-5 hình thành tư duy khoa học ban đầu qua đặt câu hỏi, dự đoán, quan sát/thí nghiệm, thu thập bằng chứng và giải thích hiện tượng.",
  coreTeachingFocus: [
    "Bài khoa học cần có tiến trình khám phá: câu hỏi - dự đoán - kiểm chứng - kết luận - vận dụng.",
    "Luôn phân biệt điều học sinh quan sát được, số liệu/bằng chứng và lời giải thích.",
    "Thí nghiệm hoặc hoạt động thực hành phải an toàn, đơn giản, có kiểm soát biến nếu phù hợp.",
    "Kết nối hiện tượng với sức khỏe, môi trường, năng lượng, vật chất và đời sống hằng ngày.",
  ],
  signatureActivities: [
    "Nêu hiện tượng/vấn đề từ tranh, video, vật thật hoặc trải nghiệm.",
    "Dự đoán cá nhân rồi thảo luận nhóm.",
    "Thực hành/thí nghiệm/quan sát theo phiếu có bước và tiêu chí an toàn.",
    "Ghi kết quả vào bảng, sơ đồ, hình vẽ hoặc câu mô tả.",
    "So sánh dự đoán với kết quả và rút ra kết luận.",
    "Vận dụng vào chăm sóc sức khỏe, tiết kiệm năng lượng, bảo vệ môi trường.",
  ],
  commonMisconceptions: [
    "Nhầm dự đoán với kết luận đã được chứng minh.",
    "Kết luận không dựa vào kết quả quan sát/thí nghiệm.",
    "Chỉ nhớ thuật ngữ mà không giải thích được hiện tượng.",
    "Bỏ qua yếu tố an toàn khi làm thí nghiệm hoặc quan sát.",
    "Hiểu sai quan hệ nguyên nhân - kết quả vì thiếu kiểm chứng.",
  ],
  supportQuestions: [
    "Con dự đoán điều gì sẽ xảy ra? Vì sao?",
    "Con quan sát thấy bằng chứng nào?",
    "Kết quả có giống dự đoán ban đầu không?",
    "Điều gì cần giữ nguyên để kiểm tra công bằng hơn?",
    "Từ kết quả này, con có thể kết luận điều gì?",
    "Kiến thức này giúp con làm gì trong cuộc sống?",
  ],
  assessmentCriteria: [
    "Học sinh nêu được câu hỏi/dự đoán phù hợp.",
    "Học sinh thực hiện quan sát/thí nghiệm an toàn theo hướng dẫn.",
    "Học sinh ghi nhận kết quả và phân biệt kết quả với giải thích.",
    "Học sinh rút ra kết luận dựa trên bằng chứng.",
    "Học sinh vận dụng kiến thức vào tình huống đời sống.",
  ],
  differentiationMoves: [
    "Học sinh yếu: dùng thí nghiệm minh họa, phiếu có câu hỏi từng bước và lựa chọn kết luận.",
    "Học sinh trung bình: ghi kết quả vào bảng và trả lời vì sao đơn giản.",
    "Học sinh khá: đề xuất cách kiểm chứng khác, giải thích sâu hơn hoặc liên hệ hiện tượng mới.",
  ],
  applicationMoves: [
    "Thiết kế thông điệp sức khỏe/môi trường, quy tắc an toàn hoặc giải pháp nhỏ cho gia đình/lớp học.",
    "Liên hệ với nước sạch, không khí, dinh dưỡng, ánh sáng, âm thanh, năng lượng, cây trồng và vật nuôi.",
  ],
  avoid: [
    "Không chốt kiến thức trước khi học sinh có dữ liệu quan sát.",
    "Không tổ chức thí nghiệm thiếu vật liệu, thiếu thời gian hoặc thiếu quy tắc an toàn.",
    "Không dùng thuật ngữ khoa học quá nặng mà thiếu ví dụ cụ thể.",
    "Không xem mọi dự đoán sai là lỗi; cần dùng để so sánh với kết quả.",
  ],
  gradeBandAdjustments: {
    "Lớp 4-5": [
      "Tập trung chu trình khám phá khoa học ngắn, phiếu ghi kết quả và kết luận dựa trên bằng chứng.",
      "Tăng dần yêu cầu giải thích nguyên nhân - kết quả và vận dụng vào sức khỏe/môi trường.",
    ],
  },
  qualityChecks: [
    "Có câu hỏi khám phá hoặc hiện tượng khởi đầu không.",
    "Có dự đoán trước quan sát/thí nghiệm không.",
    "Có hướng dẫn an toàn và vật liệu khả thi không.",
    "Có bảng/phiếu ghi bằng chứng không.",
    "Kết luận có dựa trên kết quả không.",
  ],
  repairHints: [
    "Nếu bài chỉ giảng giải, thêm chu trình dự đoán - quan sát - kết luận.",
    "Nếu thiếu an toàn, bổ sung quy tắc, vai trò nhóm và vật liệu thay thế.",
    "Nếu kết luận áp đặt, thêm câu hỏi đối chiếu dự đoán với kết quả.",
  ],
};

export const historyGeographyPedagogyProfile: PedagogyProfile = {
  subject: "Lịch sử và Địa lí",
  purpose:
    "Giúp học sinh hiểu con người, sự kiện, địa danh, môi trường sống và mối quan hệ giữa lịch sử - địa lí qua bản đồ, tranh ảnh, tư liệu và câu chuyện gần gũi.",
  coreTeachingFocus: [
    "Lịch sử cần đặt sự kiện/nhân vật vào mốc thời gian, bối cảnh, nguyên nhân, diễn biến chính và ý nghĩa.",
    "Địa lí cần dùng bản đồ/lược đồ, hình ảnh, số liệu đơn giản để xác định vị trí, đặc điểm, mối quan hệ người - môi trường.",
    "Không học thuộc ngày tháng/địa danh rời rạc; phải có câu chuyện, bằng chứng và liên hệ hiện nay.",
    "Tăng năng lực đọc bản đồ, đọc tranh/tư liệu, kể lại và giải thích bằng lời học sinh.",
  ],
  signatureActivities: [
    "Quan sát bản đồ/lược đồ/tranh tư liệu để đặt câu hỏi.",
    "Sắp xếp mốc thời gian, diễn biến hoặc tuyến sự kiện.",
    "Đọc ký hiệu bản đồ, xác định vị trí, hướng, vùng miền, đặc điểm tự nhiên - dân cư.",
    "Kể chuyện lịch sử hoặc trình bày địa lí theo sơ đồ.",
    "So sánh trước - sau, nơi này - nơi khác, nguyên nhân - kết quả.",
    "Liên hệ di tích, địa phương, môi trường sống hoặc trách nhiệm công dân nhỏ.",
  ],
  commonMisconceptions: [
    "Nhớ tên nhân vật/sự kiện nhưng không hiểu bối cảnh và ý nghĩa.",
    "Nhầm trình tự thời gian hoặc nguyên nhân - kết quả.",
    "Đọc bản đồ theo cảm tính, không dựa vào ký hiệu/chú giải.",
    "Nhầm vị trí địa lí, vùng miền hoặc đặc điểm tự nhiên - kinh tế.",
    "Liên hệ hiện nay quá chung, không gắn với hành động hoặc địa phương.",
  ],
  supportQuestions: [
    "Sự kiện này xảy ra khi nào, ở đâu, liên quan đến ai?",
    "Trước đó có điều gì dẫn đến sự kiện này?",
    "Chi tiết/tư liệu nào giúp con biết điều đó?",
    "Trên bản đồ, con dựa vào ký hiệu hoặc chú giải nào?",
    "Đặc điểm tự nhiên ảnh hưởng thế nào đến đời sống con người?",
    "Bài học này gợi cho con trách nhiệm gì hôm nay?",
  ],
  assessmentCriteria: [
    "Học sinh xác định được mốc thời gian/vị trí/đối tượng chính.",
    "Học sinh đọc được thông tin cơ bản từ bản đồ, tranh, lược đồ hoặc tư liệu.",
    "Học sinh kể lại/sắp xếp/giải thích được quan hệ nguyên nhân - diễn biến - ý nghĩa hoặc vị trí - đặc điểm - đời sống.",
    "Học sinh liên hệ được với địa phương, hiện tại hoặc hành động phù hợp.",
  ],
  differentiationMoves: [
    "Học sinh yếu: dùng trục thời gian khuyết, bản đồ có đánh dấu, câu hỏi chọn vị trí/chi tiết.",
    "Học sinh trung bình: kể lại theo sơ đồ và giải thích một quan hệ đơn giản.",
    "Học sinh khá: so sánh tư liệu, trình bày bằng bản đồ tư duy, đặt câu hỏi phản biện hoặc liên hệ địa phương.",
  ],
  applicationMoves: [
    "Làm thẻ di tích/nhân vật/địa danh, hướng dẫn viên nhí, bản đồ mini, cam kết bảo vệ di sản/môi trường.",
    "Liên hệ với quê hương, vùng miền, biển đảo, di sản, nghề nghiệp hoặc vấn đề môi trường địa phương.",
  ],
  avoid: [
    "Không bắt học sinh chép và thuộc lòng quá nhiều mốc/số liệu.",
    "Không dùng bản đồ như hình minh họa trang trí mà không có nhiệm vụ đọc bản đồ.",
    "Không kể chuyện lịch sử thiếu nguồn/tư liệu hoặc làm sai bản chất sự kiện.",
    "Không liên hệ giáo dục tình cảm công dân bằng khẩu hiệu chung chung.",
  ],
  gradeBandAdjustments: {
    "Lớp 4-5": [
      "Tăng sử dụng trục thời gian, bản đồ/lược đồ, tranh tư liệu và câu hỏi bằng chứng.",
      "Yêu cầu học sinh trình bày ngắn theo cấu trúc: thời gian/vị trí - diễn biến/đặc điểm - ý nghĩa/liên hệ.",
    ],
  },
  qualityChecks: [
    "Có tư liệu, bản đồ, lược đồ hoặc tranh ảnh làm điểm tựa không.",
    "Có nhiệm vụ đọc tư liệu/bản đồ cụ thể không.",
    "Có phân biệt thời gian, địa điểm, nhân vật/sự kiện hoặc vị trí, đặc điểm, đời sống không.",
    "Có liên hệ hiện tại/địa phương bằng hành động rõ không.",
  ],
  repairHints: [
    "Nếu bài chỉ kể/chép, thêm nhiệm vụ đọc tư liệu, bản đồ hoặc trục thời gian.",
    "Nếu nhầm địa lí với học thuộc địa danh, thêm câu hỏi vị trí - đặc điểm - tác động.",
    "Nếu lịch sử thiếu ý nghĩa, thêm bước nguyên nhân - diễn biến - kết quả - bài học.",
  ],
};

export const informaticsPedagogyProfile: PedagogyProfile = {
  subject: "Tin học",
  purpose:
    "Giúp học sinh hình thành năng lực số an toàn, thao tác cơ bản với thiết bị, tư duy thuật toán ban đầu và thái độ sử dụng công nghệ có trách nhiệm.",
  coreTeachingFocus: [
    "Dạy Tin học bằng nhiệm vụ thực hành cụ thể; mỗi khái niệm nên gắn với thao tác hoặc tình huống số.",
    "Kết hợp kỹ năng dùng thiết bị, an toàn số, tổ chức thông tin và tư duy giải quyết vấn đề.",
    "Với bài thuật toán/lập trình trực quan, cần làm rõ trình tự, lặp, điều kiện bằng ví dụ đời sống hoặc hoạt động không máy.",
    "Luôn có phương án không đủ thiết bị: làm cặp đôi, phiếu lệnh, mô phỏng unplugged.",
  ],
  signatureActivities: [
    "Quan sát tình huống số và nhận diện vấn đề cần giải quyết.",
    "Thực hành theo nhiệm vụ: mở/lưu tệp, nhập liệu, tìm kiếm, sắp xếp, tạo sản phẩm số.",
    "Mô phỏng thuật toán bằng thẻ lệnh, đường đi, vai robot hoặc sơ đồ.",
    "Làm việc cặp đôi: một bạn điều khiển, một bạn kiểm tra theo tiêu chí.",
    "Chia sẻ sản phẩm và nêu quy tắc an toàn/đạo đức số.",
  ],
  commonMisconceptions: [
    "Học sinh nhớ vị trí nút bấm nhưng không hiểu mục đích thao tác.",
    "Nhầm trình tự lệnh nên sản phẩm/đường đi sai.",
    "Quên lưu tệp, đặt tên tệp hoặc tổ chức thư mục.",
    "Sao chép thông tin/hình ảnh mà không hiểu an toàn, bản quyền, nguồn.",
    "Dùng thiết bị quá hứng thú dẫn đến lệch khỏi nhiệm vụ học tập.",
  ],
  supportQuestions: [
    "Nhiệm vụ cần tạo ra sản phẩm gì?",
    "Bước đầu tiên con cần làm là gì? Sau đó là gì?",
    "Nếu lệnh này chạy, điều gì sẽ xảy ra?",
    "Con đã lưu/đặt tên/kiểm tra sản phẩm chưa?",
    "Thông tin này có an toàn và phù hợp để chia sẻ không?",
  ],
  assessmentCriteria: [
    "Học sinh thực hiện đúng thao tác hoặc chuỗi lệnh chính.",
    "Học sinh giải thích được mục đích của thao tác/lệnh ở mức đơn giản.",
    "Học sinh tạo được sản phẩm số theo tiêu chí.",
    "Học sinh biết hợp tác, thay phiên và tuân thủ an toàn số.",
  ],
  differentiationMoves: [
    "Học sinh yếu: phiếu thao tác từng bước, ảnh minh họa nút, bạn hỗ trợ theo cặp.",
    "Học sinh trung bình: hoàn thành nhiệm vụ mẫu và tự sửa lỗi đơn giản.",
    "Học sinh khá: tối ưu lệnh, thêm tính năng, hướng dẫn bạn hoặc giải thích lỗi.",
  ],
  applicationMoves: [
    "Tạo sản phẩm phục vụ học tập: thiệp số, bảng thông tin, sơ đồ, câu chuyện tương tác, tệp trình bày ngắn.",
    "Vận dụng quy tắc an toàn: mật khẩu, thông tin cá nhân, thời lượng dùng thiết bị, ứng xử văn minh.",
  ],
  avoid: [
    "Không dạy Tin học như đọc chép lý thuyết về máy tính.",
    "Không để học sinh thao tác tự do không tiêu chí.",
    "Không giả định lớp nào cũng đủ máy hoặc mạng ổn định.",
    "Không bỏ qua an toàn số và đạo đức số khi dùng Internet/tài nguyên.",
  ],
  gradeBandAdjustments: {
    "Lớp 3": [
      "Ưu tiên thao tác thiết bị cơ bản, quy tắc an toàn và thuật toán không máy bằng thẻ lệnh/trò chơi.",
      "Nhiệm vụ thực hành ngắn, có mẫu rõ và sản phẩm nhỏ.",
    ],
    "Lớp 4-5": [
      "Tăng nhiệm vụ tạo sản phẩm số, tổ chức tệp, tìm kiếm có chọn lọc và lập trình trực quan.",
      "Yêu cầu học sinh tự kiểm tra sản phẩm theo tiêu chí và giải thích lỗi thường gặp.",
    ],
  },
  qualityChecks: [
    "Có nhiệm vụ/sản phẩm số cụ thể không.",
    "Có chuỗi thao tác hoặc lệnh rõ không.",
    "Có phương án khi thiếu thiết bị không.",
    "Có kiểm tra an toàn số/đạo đức số nếu dùng thông tin hoặc Internet không.",
    "Có tiêu chí sản phẩm để học sinh tự kiểm tra không.",
  ],
  repairHints: [
    "Nếu bài quá lý thuyết, chuyển thành nhiệm vụ thao tác/sản phẩm.",
    "Nếu thiếu thiết bị, thêm hoạt động cặp đôi hoặc unplugged.",
    "Nếu học sinh chỉ bấm theo mẫu, thêm câu hỏi mục đích thao tác và lỗi có thể xảy ra.",
  ],
};

export const technologyPedagogyProfile: PedagogyProfile = {
  subject: "Công nghệ",
  purpose:
    "Giúp học sinh hiểu sản phẩm công nghệ gần gũi, quy trình thiết kế - sử dụng - bảo quản an toàn và biết tạo/sửa/đánh giá sản phẩm đơn giản.",
  coreTeachingFocus: [
    "Dạy Công nghệ qua nhu cầu, vật liệu, công cụ, quy trình, sản phẩm và tiêu chí đánh giá.",
    "Luôn nhấn mạnh an toàn khi dùng dụng cụ, tiết kiệm vật liệu và bảo quản sản phẩm/thiết bị.",
    "Hoạt động nên có thiết kế hoặc thực hành tạo sản phẩm nhỏ, không chỉ nhận biết đồ vật.",
    "Khuyến khích học sinh thử - sai - chỉnh sửa theo tiêu chí.",
  ],
  signatureActivities: [
    "Quan sát sản phẩm/công cụ và xác định công dụng, cấu tạo đơn giản.",
    "Nêu nhu cầu hoặc vấn đề cần thiết kế.",
    "Lập kế hoạch vật liệu, bước làm và phân công nhóm.",
    "Thực hành tạo, lắp ghép, chăm sóc, sử dụng hoặc bảo quản.",
    "Trưng bày sản phẩm, đánh giá theo tiêu chí và đề xuất cải tiến.",
  ],
  commonMisconceptions: [
    "Chỉ quan tâm sản phẩm đẹp mà bỏ qua công dụng, độ bền hoặc an toàn.",
    "Dùng vật liệu/công cụ không phù hợp với nhiệm vụ.",
    "Làm theo mẫu máy móc, không biết vì sao cần bước đó.",
    "Bỏ qua kiểm tra, chỉnh sửa hoặc bảo quản sau khi làm xong.",
  ],
  supportQuestions: [
    "Sản phẩm này dùng để làm gì?",
    "Cần vật liệu/công cụ nào? Vì sao chọn chúng?",
    "Bước nào cần làm trước để đảm bảo an toàn?",
    "Sản phẩm đã đạt tiêu chí nào? Cần cải tiến gì?",
    "Nếu thay vật liệu, sản phẩm sẽ thay đổi thế nào?",
  ],
  assessmentCriteria: [
    "Học sinh nêu được công dụng/cấu tạo/quy trình cơ bản.",
    "Học sinh thực hành an toàn, tiết kiệm và hợp tác.",
    "Học sinh tạo hoặc sử dụng sản phẩm theo tiêu chí.",
    "Học sinh biết kiểm tra, nhận xét và cải tiến sản phẩm.",
  ],
  differentiationMoves: [
    "Học sinh yếu: dùng mẫu bán hoàn chỉnh, vật liệu dễ thao tác và bước làm có hình.",
    "Học sinh trung bình: làm theo quy trình và tự kiểm tra tiêu chí.",
    "Học sinh khá: thay đổi thiết kế, tối ưu vật liệu hoặc đề xuất cải tiến.",
  ],
  applicationMoves: [
    "Gắn với đồ dùng học tập, nhà ở, cây trồng, đồ chơi, mô hình, tiết kiệm năng lượng và bảo quản vật dụng.",
    "Sản phẩm vận dụng nên nhỏ, an toàn, dùng được hoặc giải thích được công dụng.",
  ],
  avoid: [
    "Không tổ chức thực hành thiếu quy tắc an toàn.",
    "Không yêu cầu sản phẩm cầu kỳ vượt thời lượng và vật liệu lớp học.",
    "Không đánh giá chỉ bằng đẹp/xấu mà thiếu tiêu chí công dụng, quy trình, hợp tác.",
    "Không bỏ qua bước thử nghiệm và cải tiến.",
  ],
  gradeBandAdjustments: {
    "Lớp 3": [
      "Tập trung nhận biết sản phẩm/công cụ gần gũi, quy trình ngắn và thực hành an toàn.",
      "Sản phẩm nên đơn giản, ít bước, vật liệu dễ kiếm.",
    ],
    "Lớp 4-5": [
      "Tăng yếu tố thiết kế, lựa chọn vật liệu, tiêu chí sản phẩm, thử nghiệm và cải tiến.",
      "Có thể giao nhiệm vụ nhóm với vai trò rõ: thiết kế, vật liệu, thực hiện, kiểm tra.",
    ],
  },
  qualityChecks: [
    "Có nhu cầu/vấn đề công nghệ cụ thể không.",
    "Có vật liệu, công cụ, quy trình và an toàn không.",
    "Có sản phẩm hoặc nhiệm vụ thực hành không.",
    "Có tiêu chí đánh giá và cải tiến sản phẩm không.",
  ],
  repairHints: [
    "Nếu bài chỉ nhận biết, thêm nhiệm vụ thiết kế/thực hành nhỏ.",
    "Nếu thiếu an toàn, thêm quy tắc dùng công cụ và phân công vai trò.",
    "Nếu đánh giá mơ hồ, thêm tiêu chí công dụng - độ chắc - thẩm mỹ - hợp tác.",
  ],
};

export const physicalEducationPedagogyProfile: PedagogyProfile = {
  subject: "Giáo dục thể chất",
  purpose:
    "Giúp học sinh phát triển vận động, thể lực, thói quen rèn luyện, tinh thần kỷ luật, hợp tác và an toàn trong hoạt động thể chất.",
  coreTeachingFocus: [
    "Dạy động tác theo tiến trình: khởi động an toàn - làm mẫu - tập từng phần - tập phối hợp - trò chơi/vận dụng - hồi tĩnh.",
    "Mỗi hoạt động phải có yêu cầu an toàn, đội hình, cự ly, dụng cụ và cách sửa lỗi.",
    "Đánh giá qua quan sát động tác, nỗ lực, hợp tác và tuân thủ luật chơi; không chỉ qua thành tích.",
    "Điều chỉnh cường độ theo sức khỏe, không gian và điều kiện sân bãi.",
  ],
  signatureActivities: [
    "Khởi động khớp/cơ theo bài và kiểm tra an toàn sân bãi.",
    "Giáo viên làm mẫu, học sinh quan sát điểm kỹ thuật chính.",
    "Tập luyện cá nhân/cặp/nhóm với nhịp, hàng, trạm hoặc vòng xoay.",
    "Trò chơi vận động gắn kỹ năng chính.",
    "Nhận xét sửa lỗi nhanh và hồi tĩnh cuối tiết.",
  ],
  commonMisconceptions: [
    "Học sinh làm động tác nhanh nhưng sai kỹ thuật cơ bản.",
    "Không giữ khoảng cách an toàn khi chạy, nhảy, ném, chuyền.",
    "Nhầm luật chơi hoặc chỉ chú trọng thắng thua.",
    "Một số em ngại vận động do sợ sai, sức khỏe yếu hoặc thiếu tự tin.",
  ],
  supportQuestions: [
    "Khi thực hiện động tác, con cần chú ý điểm nào trước?",
    "Khoảng cách với bạn đã an toàn chưa?",
    "Nếu động tác chưa đúng, con cần chỉnh tay/chân/thân người thế nào?",
    "Trong trò chơi, luật nào giúp bảo đảm công bằng và an toàn?",
  ],
  assessmentCriteria: [
    "Học sinh thực hiện được động tác/kỹ năng chính ở mức phù hợp.",
    "Học sinh biết khởi động, giữ an toàn và tuân thủ hiệu lệnh.",
    "Học sinh tham gia tích cực, hợp tác và tôn trọng bạn.",
    "Học sinh biết tự nhận xét hoặc sửa một lỗi kỹ thuật đơn giản.",
  ],
  differentiationMoves: [
    "Học sinh yếu/sức khỏe hạn chế: giảm cự ly, tốc độ, số lần hoặc dùng biến thể nhẹ.",
    "Học sinh trung bình: tập đúng kỹ thuật cơ bản theo nhịp.",
    "Học sinh khá: tăng độ khó, làm nhóm trưởng, hỗ trợ bạn hoặc trình diễn mẫu.",
  ],
  applicationMoves: [
    "Gợi ý bài tập ngắn ở nhà: khởi động, thăng bằng, bật nhảy, tung bắt, chạy chậm an toàn.",
    "Liên hệ thói quen vận động, dinh dưỡng, ngủ nghỉ và phòng tránh chấn thương.",
  ],
  avoid: [
    "Không bỏ qua khởi động và hồi tĩnh.",
    "Không tổ chức trò chơi đông người thiếu cự ly và luật an toàn.",
    "Không phê bình làm học sinh xấu hổ vì thể lực/yếu kỹ năng.",
    "Không đặt yêu cầu thành tích vượt lứa tuổi hoặc điều kiện sân bãi.",
  ],
  gradeBandAdjustments: {
    "Lớp 1-2": [
      "Ưu tiên trò chơi vận động, động tác cơ bản, hiệu lệnh ngắn và đội hình đơn giản.",
      "Thời lượng hướng dẫn ngắn, tập nhiều lần, sửa lỗi bằng hình ảnh/làm mẫu.",
    ],
    "Lớp 3": [
      "Tăng phối hợp động tác, luật chơi, hợp tác nhóm và tự nhận xét đơn giản.",
    ],
    "Lớp 4-5": [
      "Tăng kỹ thuật, chiến thuật trò chơi nhỏ, vai trò nhóm trưởng và tự điều chỉnh cường độ.",
    ],
  },
  qualityChecks: [
    "Có khởi động, tập luyện chính, trò chơi/vận dụng và hồi tĩnh không.",
    "Có đội hình, cự ly, dụng cụ và an toàn không.",
    "Có lỗi kỹ thuật thường gặp và cách sửa không.",
    "Có biến thể cho học sinh thể lực khác nhau không.",
  ],
  repairHints: [
    "Nếu thiếu an toàn, thêm kiểm tra sân bãi, đội hình và khoảng cách.",
    "Nếu hoạt động chỉ là trò chơi, bổ sung kỹ thuật trọng tâm và sửa lỗi.",
    "Nếu yêu cầu quá nặng, giảm cự ly/số lần và thêm lựa chọn nhẹ.",
  ],
};

export const musicPedagogyProfile: PedagogyProfile = {
  subject: "Âm nhạc",
  purpose:
    "Giúp học sinh cảm thụ, thể hiện và sáng tạo âm nhạc qua nghe, hát, vận động, gõ đệm, đọc nhạc đơn giản và chia sẻ cảm xúc.",
  coreTeachingFocus: [
    "Dạy âm nhạc bằng trải nghiệm nghe - bắt chước - luyện tập - thể hiện - sáng tạo.",
    "Chú ý cao độ, trường độ, tiết tấu, sắc thái và cảm xúc bài hát ở mức phù hợp.",
    "Kết hợp hát, vận động cơ thể, nhạc cụ gõ hoặc vật dụng an toàn.",
    "Tạo môi trường tự tin; sửa lỗi nhẹ nhàng, tránh làm học sinh sợ hát/sợ sai.",
  ],
  signatureActivities: [
    "Nghe mẫu và nêu cảm xúc/hình ảnh liên tưởng.",
    "Luyện tiết tấu bằng vỗ tay, gõ đệm, đọc âm hình.",
    "Tập hát từng câu, nối câu, hát cả bài với sắc thái.",
    "Vận động phụ họa hoặc biểu diễn nhóm.",
    "Sáng tạo lời ca/tiết tấu/động tác đơn giản.",
  ],
  commonMisconceptions: [
    "Hát thuộc lời nhưng sai cao độ hoặc tiết tấu.",
    "Gõ đệm lệch nhịp vì chưa cảm được phách mạnh/nhẹ.",
    "Biểu diễn quá to/nhanh, thiếu lắng nghe nhóm.",
    "Ngại hát cá nhân hoặc sợ bị chê.",
  ],
  supportQuestions: [
    "Con nghe bài hát có vui, nhẹ nhàng hay rộn ràng?",
    "Phách mạnh nằm ở đâu? Con thử vỗ theo nhịp nhé?",
    "Câu hát này lên cao hay xuống thấp?",
    "Nhóm cần lắng nghe nhau ở điểm nào để hát đều hơn?",
  ],
  assessmentCriteria: [
    "Học sinh tham gia nghe, hát, gõ đệm hoặc vận động tích cực.",
    "Học sinh thể hiện đúng tương đối cao độ, tiết tấu, lời ca và sắc thái.",
    "Học sinh biết lắng nghe, phối hợp nhóm và tự tin biểu diễn.",
    "Học sinh nêu được cảm xúc hoặc sáng tạo một yếu tố âm nhạc đơn giản.",
  ],
  differentiationMoves: [
    "Học sinh ngại hát: cho gõ đệm, hát nhóm, hát đáp lại hoặc vận động trước.",
    "Học sinh yếu nhịp: dùng vỗ tay/chân theo nhịp chậm và câu ngắn.",
    "Học sinh khá: lĩnh xướng, sáng tạo động tác, gõ tiết tấu hoặc hỗ trợ nhóm.",
  ],
  applicationMoves: [
    "Biểu diễn trong lớp, góc âm nhạc, sinh hoạt tập thể hoặc gắn với chủ điểm, quê hương, lễ hội.",
    "Khuyến khích học sinh nghe nhạc phù hợp và chia sẻ cảm xúc tích cực.",
  ],
  avoid: [
    "Không biến âm nhạc thành chép lời bài hát hoặc học lý thuyết khô.",
    "Không sửa lỗi bằng cách chê giọng hát.",
    "Không chọn hoạt động biểu diễn quá phức tạp so với thời lượng.",
    "Không để nhạc cụ/gõ đệm gây ồn mất kiểm soát.",
  ],
  gradeBandAdjustments: {
    "Lớp 1-2": [
      "Ưu tiên hát ngắn, vận động minh họa, vỗ tay theo nhịp và trò chơi âm thanh.",
    ],
    "Lớp 3": [
      "Tăng gõ đệm theo mẫu, hát kết hợp vận động và nhận biết sắc thái đơn giản.",
    ],
    "Lớp 4-5": [
      "Tăng biểu diễn nhóm, đọc nhạc/tiết tấu đơn giản và sáng tạo lời/động tác/gõ đệm.",
    ],
  },
  qualityChecks: [
    "Có đủ nghe - luyện - thể hiện - chia sẻ/sáng tạo không.",
    "Có điểm kỹ thuật âm nhạc trọng tâm không.",
    "Có cách hỗ trợ học sinh ngại hát hoặc lệch nhịp không.",
    "Có tiêu chí biểu diễn phù hợp không.",
  ],
  repairHints: [
    "Nếu bài chỉ hát theo, thêm nghe cảm thụ, gõ đệm và biểu diễn nhóm.",
    "Nếu thiếu kỹ thuật, thêm luyện tiết tấu/cao độ theo câu ngắn.",
    "Nếu hoạt động ồn, thêm quy ước tín hiệu và vai trò nhóm.",
  ],
};

export const artPedagogyProfile: PedagogyProfile = {
  subject: "Mĩ thuật",
  purpose:
    "Giúp học sinh quan sát, cảm nhận, thể hiện ý tưởng và tạo sản phẩm thẩm mỹ bằng đường nét, màu sắc, hình khối, chất liệu và câu chuyện cá nhân.",
  coreTeachingFocus: [
    "Dạy mĩ thuật theo tiến trình: quan sát/cảm nhận - khám phá chất liệu/kỹ thuật - tạo sản phẩm - chia sẻ/đánh giá.",
    "Ưu tiên ý tưởng, quá trình và cách thể hiện cá nhân; không chỉ chấm giống mẫu.",
    "Làm rõ yếu tố tạo hình trọng tâm: nét, hình, màu, bố cục, đậm nhạt, chất liệu hoặc không gian.",
    "Tổ chức vật liệu an toàn, tiết kiệm, phù hợp điều kiện lớp học.",
  ],
  signatureActivities: [
    "Quan sát tranh/đồ vật/sản phẩm mẫu và nêu cảm nhận.",
    "Thử nét, màu, hình, chất liệu hoặc kỹ thuật nhỏ trước khi làm sản phẩm.",
    "Phác ý tưởng, chọn vật liệu và tạo sản phẩm cá nhân/nhóm.",
    "Trưng bày gallery walk, giới thiệu sản phẩm và góp ý tích cực.",
    "Liên hệ nghệ thuật với thiên nhiên, văn hóa, đồ dùng hoặc chủ điểm học tập.",
  ],
  commonMisconceptions: [
    "Học sinh cố vẽ giống mẫu, sợ khác mẫu là sai.",
    "Bố cục rời rạc, màu thiếu chủ đích hoặc sản phẩm không thể hiện ý tưởng.",
    "Dùng vật liệu lãng phí, bẩn lớp hoặc thiếu an toàn.",
    "Nhận xét sản phẩm bạn bằng đẹp/xấu thay vì theo tiêu chí.",
  ],
  supportQuestions: [
    "Con muốn sản phẩm kể điều gì?",
    "Con chọn màu/nét/hình này để thể hiện cảm xúc nào?",
    "Phần chính của tranh/sản phẩm nằm ở đâu?",
    "Nếu muốn nổi bật hơn, con có thể thêm/bớt/chỉnh gì?",
    "Con nhận xét sản phẩm của bạn theo tiêu chí nào?",
  ],
  assessmentCriteria: [
    "Học sinh thể hiện được ý tưởng cá nhân hoặc nhóm.",
    "Học sinh sử dụng yếu tố tạo hình/kỹ thuật/chất liệu phù hợp.",
    "Học sinh làm việc an toàn, gọn gàng, tiết kiệm vật liệu.",
    "Học sinh giới thiệu và nhận xét sản phẩm bằng ngôn ngữ tích cực.",
  ],
  differentiationMoves: [
    "Học sinh yếu: cho mẫu gợi ý, khung bố cục, vật liệu dễ thao tác.",
    "Học sinh trung bình: hoàn thiện sản phẩm theo tiêu chí trọng tâm.",
    "Học sinh khá: thử chất liệu mới, tạo biến thể, giải thích lựa chọn thẩm mỹ hoặc hỗ trợ trưng bày.",
  ],
  applicationMoves: [
    "Tạo sản phẩm trang trí lớp, thiệp, poster, đồ dùng học tập, góc chủ điểm hoặc sản phẩm tái chế.",
    "Liên hệ với văn hóa địa phương, thiên nhiên, lễ hội và bảo vệ môi trường.",
  ],
  avoid: [
    "Không bắt cả lớp sao chép một mẫu y hệt.",
    "Không đánh giá chỉ bằng đẹp/xấu hoặc năng khiếu bẩm sinh.",
    "Không dùng vật liệu nguy hiểm/khó kiếm/khó dọn với học sinh nhỏ.",
    "Không bỏ qua bước chia sẻ ý tưởng và nhận xét tích cực.",
  ],
  gradeBandAdjustments: {
    "Lớp 1-2": [
      "Ưu tiên nét, màu, hình đơn giản, xé dán/nặn/vẽ tự do có gợi ý và vật liệu an toàn.",
    ],
    "Lớp 3": [
      "Tăng bố cục, phối màu, kể chuyện bằng tranh/sản phẩm và nhận xét theo tiêu chí đơn giản.",
    ],
    "Lớp 4-5": [
      "Tăng ý tưởng cá nhân, chất liệu hỗn hợp, sản phẩm nhóm, trưng bày và thuyết trình ngắn.",
    ],
  },
  qualityChecks: [
    "Có bước quan sát/cảm nhận trước khi tạo sản phẩm không.",
    "Có yếu tố tạo hình hoặc kỹ thuật trọng tâm không.",
    "Có tiêu chí đánh giá sản phẩm không.",
    "Có vật liệu an toàn và phương án dọn dẹp không.",
    "Có cơ hội chia sẻ ý tưởng không.",
  ],
  repairHints: [
    "Nếu bài giống chép mẫu, thêm lựa chọn cá nhân về màu, bố cục, ý tưởng.",
    "Nếu thiếu tiêu chí, thêm ý tưởng - kỹ thuật - hoàn thiện - chia sẻ.",
    "Nếu vật liệu khó, đề xuất vật liệu thay thế dễ kiếm/an toàn.",
  ],
};

export const experientialPedagogyProfile: PedagogyProfile = {
  subject: "Hoạt động trải nghiệm",
  purpose:
    "Giúp học sinh hình thành năng lực tự nhận thức, tự quản, giao tiếp, hợp tác, thích ứng và tham gia hoạt động gia đình, nhà trường, cộng đồng qua chu trình trải nghiệm.",
  coreTeachingFocus: [
    "Hoạt động trải nghiệm cần theo chu trình: trải nghiệm - chia sẻ - rút kinh nghiệm - vận dụng/cam kết.",
    "Trọng tâm là hành vi, kỹ năng và thái độ quan sát được; không biến thành tiết giảng đạo lý.",
    "Nhiệm vụ phải gần đời sống học sinh: bản thân, bạn bè, gia đình, lớp học, trường học, cộng đồng.",
    "Cần có sản phẩm hoặc hành động cụ thể sau hoạt động.",
  ],
  signatureActivities: [
    "Trò chơi/tình huống/hoạt động nhóm tạo trải nghiệm ban đầu.",
    "Chia sẻ cảm xúc, điều đã làm, điều khó và điều học được.",
    "Thảo luận cách làm tốt hơn hoặc quy tắc/kỹ năng cần nhớ.",
    "Lập kế hoạch/cam kết hành động cá nhân hoặc nhóm.",
    "Đánh giá bằng phiếu tự đánh giá, bạn đánh giá, nhật ký hoặc sản phẩm lớp.",
  ],
  commonMisconceptions: [
    "Hoạt động vui nhưng không rút ra kỹ năng hay hành động cụ thể.",
    "Chỉ yêu cầu học sinh hứa sẽ làm mà không có kế hoạch thực hiện.",
    "Nhiệm vụ nhóm không phân vai nên vài em làm, nhiều em đứng ngoài.",
    "Chia sẻ cảm xúc hình thức, không gắn với trải nghiệm vừa làm.",
  ],
  supportQuestions: [
    "Trong hoạt động vừa rồi, con đã làm gì?",
    "Con thấy dễ/khó ở điểm nào?",
    "Nhóm đã hợp tác ra sao?",
    "Lần sau con muốn làm tốt hơn điều gì?",
    "Con sẽ thực hiện hành động nhỏ nào sau tiết học?",
  ],
  assessmentCriteria: [
    "Học sinh tham gia trải nghiệm tích cực và an toàn.",
    "Học sinh biết chia sẻ cảm xúc/kinh nghiệm sau hoạt động.",
    "Học sinh rút ra kỹ năng hoặc quy tắc hành động.",
    "Học sinh lập được cam kết/kế hoạch nhỏ và biết tự đánh giá.",
  ],
  differentiationMoves: [
    "Học sinh rụt rè: giao vai trò nhỏ, chia sẻ cặp đôi, dùng thẻ cảm xúc.",
    "Học sinh năng động: giao vai trò điều phối, ghi chép, báo cáo hoặc hỗ trợ bạn.",
    "Nhóm không đồng đều: phân vai rõ người nói, người làm, người quan sát, người báo cáo.",
  ],
  applicationMoves: [
    "Thực hiện việc làm sau tiết học: sắp xếp góc học tập, giúp đỡ bạn, tự phục vụ, bảo vệ môi trường, tham gia việc lớp.",
    "Theo dõi bằng bảng cam kết, nhật ký một tuần hoặc sản phẩm truyền thông nhỏ.",
  ],
  avoid: [
    "Không tổ chức trò chơi chỉ để vui mà thiếu rút kinh nghiệm.",
    "Không giao nhiệm vụ mơ hồ như 'hãy cố gắng hơn' mà thiếu hành động cụ thể.",
    "Không để chia sẻ cá nhân nhạy cảm gây áp lực hoặc xấu hổ.",
    "Không bỏ qua phân vai và quy tắc an toàn trong hoạt động nhóm.",
  ],
  gradeBandAdjustments: {
    "Lớp 1-2": [
      "Hoạt động ngắn, nhiều hình ảnh, thẻ cảm xúc, hành động cụ thể như tự phục vụ, chào hỏi, giữ vệ sinh.",
    ],
    "Lớp 3": [
      "Tăng hợp tác nhóm nhỏ, tự đánh giá đơn giản và kế hoạch cá nhân trong tuần.",
    ],
    "Lớp 4-5": [
      "Tăng dự án/chiến dịch nhỏ, vai trò nhóm, giải quyết vấn đề và phản hồi lẫn nhau.",
    ],
  },
  qualityChecks: [
    "Có đủ trải nghiệm - chia sẻ - rút kinh nghiệm - vận dụng không.",
    "Có kỹ năng/hành vi trọng tâm quan sát được không.",
    "Có phân vai, quy tắc an toàn và sản phẩm/cam kết không.",
    "Có tự đánh giá hoặc đánh giá đồng đẳng không.",
  ],
  repairHints: [
    "Nếu hoạt động chỉ vui, thêm câu hỏi chia sẻ và rút bài học.",
    "Nếu cam kết chung chung, đổi thành hành động nhỏ có thời gian/người thực hiện.",
    "Nếu nhóm dễ loạn, thêm phân vai và luật hoạt động.",
  ],
};

export const pedagogyProfiles: Record<CanonicalSubject, PedagogyProfile> = {
  "Tiếng Việt": vietnamesePedagogyProfile,
  Toán: mathPedagogyProfile,
  "Đạo đức": ethicsPedagogyProfile,
  "Tự nhiên và Xã hội": naturalSocialPedagogyProfile,
  "Khoa học": sciencePedagogyProfile,
  "Lịch sử và Địa lí": historyGeographyPedagogyProfile,
  "Tin học": informaticsPedagogyProfile,
  "Công nghệ": technologyPedagogyProfile,
  "Giáo dục thể chất": physicalEducationPedagogyProfile,
  "Âm nhạc": musicPedagogyProfile,
  "Mĩ thuật": artPedagogyProfile,
  "Hoạt động trải nghiệm": experientialPedagogyProfile,
};

export function getPedagogyProfile(subject: string) {
  return pedagogyProfiles[subject as CanonicalSubject] || null;
}
