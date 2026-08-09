import { describe, expect, it } from "vitest";
import { activityDocumentBlock } from "@/lib/lesson-document-model";
import type { LessonActivity } from "@/types/lesson";

function verboseActivity(): LessonActivity {
  return {
    phase: "Khởi động",
    title: "Giới thiệu nhà khoa học và khơi gợi tò mò",
    objective: "Học sinh kể hoặc nói những điều biết về nhà khoa học.",
    durationMinutes: 5,
    teacherActions: ["GV yêu cầu HS kể tên hoặc nói những điều biết về một nhà khoa học."],
    studentActions: ["HS kể tên và chia sẻ thông tin về nhà khoa học đã biết."],
    learningProducts: ["Danh sách các phẩm chất nhà khoa học do HS kể"],
    successCriteria: ["HS nêu được ít nhất 2 điều biết về nhà khoa học.", "HS tham gia tích cực vào trò chơi nói ý kiến."],
    expectedAnswer: "Có thể kể tên một số nhà khoa học, nêu được các phẩm chất như chăm chỉ, kiên trì, thông minh.",
    commonErrors: ["HS chỉ kể tên mà không nêu phẩm chất."],
    teacherFeedback: ["GV nhắc HS nói rõ hơn ý của mình."],
    supportForStudentsNeedingHelp: ["GV gợi ý bằng câu hỏi lựa chọn."],
    extensionForEarlyFinishers: ["HS đặt câu hỏi về nhà khoa học cho bạn trả lời."],
  };
}

describe("activityDocumentBlock", () => {
  it("giữ đầy đủ chi tiết kỹ thuật ở chế độ thường", () => {
    const block = activityDocumentBlock(verboseActivity(), 0);
    const labels = block.details.map((detail) => detail.label);

    expect(labels).toContain("Tiêu chí thành công");
    expect(labels).toContain("Đáp án dự kiến");
    expect(labels).toContain("Lỗi thường gặp");
    expect(labels).toContain("Hỗ trợ HS cần giúp đỡ");
    expect(labels).toContain("Mở rộng cho HS hoàn thành sớm");
  });

  it("ẩn chi tiết kỹ thuật dài ở chế độ compact cho gói Free", () => {
    const block = activityDocumentBlock(verboseActivity(), 0, { compact: true });

    expect(block.details).toEqual([]);
    expect(block.products).toBe("Danh sách các phẩm chất nhà khoa học do HS kể");
    expect(block.products).not.toContain("Tiêu chí thành công");
    expect(block.products).not.toContain("Hỗ trợ HS cần giúp đỡ");
  });

  it("ẩn metadata riêng ở chế độ concise và gộp tiêu chí vào sản phẩm/đánh giá", () => {
    const block = activityDocumentBlock(verboseActivity(), 0, { concise: true });

    expect(block.details).toEqual([]);
    expect(block.products).toContain("Danh sách các phẩm chất nhà khoa học do HS kể");
    expect(block.products).toContain("đánh giá:");
    expect(block.products).toContain("HS nêu được ít nhất 2 điều");
    expect(JSON.stringify(block)).not.toContain("Học liệu/đầu vào");
    expect(JSON.stringify(block)).not.toContain("Đáp án dự kiến");
    expect(JSON.stringify(block)).not.toContain("Lỗi thường gặp");
    expect(JSON.stringify(block)).not.toContain("Phản hồi của GV");
  });

  it("lọc metadata nội bộ nếu AI lỡ nhét vào bước GV ở chế độ Plus/Pro", () => {
    const activity = {
      ...verboseActivity(),
      teacherActions: [
        [
          "Học liệu/đầu vào: Tranh nghề nghiệp phóng to từ SGK hoặc thẻ tranh",
          "Cách tổ chức: Toàn lớp",
          "Tiêu chí thành công: Chọn được thẻ phù hợp với tranh",
          "Đáp án dự kiến: Con đoán đây là nghề bán hàng.",
          "Lỗi thường gặp: Chọn thẻ theo cảm tính, chưa dựa vào tranh",
          "Phản hồi của GV: GV gợi: Con nhìn tay người đó đang làm gì?",
          "Cách tiến hành: GV cho HS quan sát tranh nghề nghiệp và chọn thẻ phù hợp.",
        ].join("\n"),
      ],
      studentActions: ["HS quan sát tranh, chọn thẻ nghề và nêu chi tiết nhìn thấy."],
    };
    const block = activityDocumentBlock(activity, 0, { concise: true });
    const renderedText = JSON.stringify(block);

    expect(renderedText).not.toContain("Học liệu/đầu vào");
    expect(renderedText).not.toContain("Cách tổ chức");
    expect(renderedText).not.toContain("Tiêu chí thành công");
    expect(renderedText).not.toContain("Đáp án dự kiến");
    expect(renderedText).not.toContain("Lỗi thường gặp");
    expect(renderedText).not.toContain("Phản hồi của GV");
    expect(block.actionPairs).toHaveLength(1);
    expect(block.actionPairs[0].teacher).toBe("GV cho HS quan sát tranh nghề nghiệp và chọn thẻ phù hợp.");
  });
});
