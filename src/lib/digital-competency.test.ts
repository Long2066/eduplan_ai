import { describe, expect, it } from "vitest";
import { ensureLessonDigitalCompetencies } from "./digital-competency";
import { makeInput, makeLesson } from "./vietnamese-fixtures";

describe("ensureLessonDigitalCompetencies", () => {
  it("bổ sung năng lực số và thao tác học sinh khi tùy chọn được bật", () => {
    const input = makeInput({ subject: "Tự nhiên và Xã hội", lessonTitle: "Bài 10. Cùng khám phá quang cảnh xung quanh", enableDigitalCompetency: true });
    const lesson = makeLesson({
      generalInfo: { subject: input.subject, grade: input.grade, lessonTitle: input.lessonTitle, periods: 1, duration: 35 },
      outcomes: {
        generalCompetencies: ["Giao tiếp và hợp tác"],
        specificCompetencies: ["Tìm hiểu môi trường tự nhiên và xã hội xung quanh"],
        qualities: ["Chăm chỉ"],
        knowledgeAndSkills: ["Nêu được một số đặc điểm của quang cảnh xung quanh"],
        digitalCompetencies: [],
      },
    });

    const result = ensureLessonDigitalCompetencies(input, lesson);

    expect(result.outcomes.digitalCompetencies?.[0]).toContain("Năng lực số (1.1)");
    expect(JSON.stringify(result.activities)).toMatch(/HS.*(?:thao tác|truy cập).*học liệu số/i);
  });

  it("giữ tối đa hai mã hợp lệ đã được AI chọn", () => {
    const input = makeInput({ enableDigitalCompetency: true });
    const lesson = makeLesson();
    lesson.outcomes.digitalCompetencies = [
      "Năng lực số (3.1): Sử dụng công cụ ghi âm để tạo sản phẩm đọc.",
      "Năng lực số (2.2): Chia sẻ sản phẩm dưới sự hướng dẫn.",
      "Năng lực số (9.9): Mã không có trong khung.",
    ];

    const result = ensureLessonDigitalCompetencies(input, lesson);

    expect(result.outcomes.digitalCompetencies).toEqual([
      "Năng lực số (3.1): Sử dụng công cụ ghi âm để tạo sản phẩm đọc.",
      "Năng lực số (2.2): Chia sẻ sản phẩm dưới sự hướng dẫn.",
    ]);
  });

  it("xóa năng lực số khi tùy chọn tắt", () => {
    const input = makeInput({ enableDigitalCompetency: false });
    const lesson = makeLesson();
    lesson.outcomes.digitalCompetencies = ["Năng lực số (3.1): Tạo sản phẩm số."];

    expect(ensureLessonDigitalCompetencies(input, lesson).outcomes.digitalCompetencies).toEqual([]);
  });
});
