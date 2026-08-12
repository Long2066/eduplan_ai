import { describe, expect, it } from "vitest";
import { lessonDocumentHeading } from "./lesson-document-model";
import { lessonHeadingTitle } from "./lesson-format";
import { makeLesson } from "./vietnamese-fixtures";

describe("lesson document heading", () => {
  it("giữ nguyên số bài, dấu phân cách và tên bài từ dữ liệu SGK", () => {
    const lesson = makeLesson({
      generalInfo: {
        subject: "Tự nhiên và Xã hội",
        grade: "Lớp 1",
        lessonTitle: "Bài 10. Cùng khám phá quang cảnh xung quanh",
        periods: 2,
        duration: 35,
      },
    });
    const heading = lessonDocumentHeading(lesson, { periodNumber: 2, focus: "Khám phá", activities: lesson.activities });

    expect(heading.documentTitle).toBe("KẾ HOẠCH BÀI DẠY");
    expect(heading.lessonTitle).toBe("Bài 10. Cùng khám phá quang cảnh xung quanh");
    expect(lessonHeadingTitle(heading.lessonTitle)).toBe("BÀI 10. CÙNG KHÁM PHÁ QUANG CẢNH XUNG QUANH");
    expect(heading.periodLabel).toBe("(TIẾT 2)");
  });

  it("không tự thêm tiền tố BÀI vào tên không có tiền tố", () => {
    expect(lessonHeadingTitle("Ôn tập cuối học kì")).toBe("ÔN TẬP CUỐI HỌC KÌ");
  });
});
