import { describe, expect, it } from "vitest";
import { activityPhaseKey, canonicalizeOrderedActivityPhases, requiredActivityPhases, sanitizeMaterials } from "./lesson-format";
import type { LessonActivity } from "@/types/lesson";

function activity(phase: string, title: string): LessonActivity {
  return {
    phase,
    title,
    objective: "Hoàn thành nhiệm vụ.",
    teacherActions: ["GV giao nhiệm vụ."],
    studentActions: ["HS thực hiện nhiệm vụ."],
  };
}

describe("activity phase resolution", () => {
  it("prioritizes the explicit phase over phase words in the lesson title", () => {
    expect(activityPhaseKey(activity("Luyện tập", "Cùng khám phá trường học"))).toBe("Luyện tập");
    expect(activityPhaseKey(activity("Vận dụng", "Thực hành khám phá trường em"))).toBe("Vận dụng");
  });

  it("falls back to the title only when the explicit phase is missing", () => {
    expect(activityPhaseKey(activity("", "Khám phá các khu vực trong trường"))).toBe("Khám phá");
  });

  it("canonically relabels an already ordered four-activity period without changing content", () => {
    const activities = [
      activity("Mở đầu", "Trò chơi trường em"),
      activity("Hoạt động 2", "Cùng khám phá trường học"),
      activity("Hoạt động 3", "Luyện tập với sơ đồ trường"),
      activity("Hoạt động 4", "Vận dụng điều đã học"),
    ];

    const repaired = canonicalizeOrderedActivityPhases(activities);

    expect(repaired.map((item) => item.phase)).toEqual([...requiredActivityPhases]);
    expect(repaired.map((item) => item.title)).toEqual(activities.map((item) => item.title));
  });
});

describe("materials sanitization", () => {
  it("strips pseudo-instructions, contingency plans, and action details from verbose materials", () => {
    const rawTeacher = [
      "- Máy tính giáo viên kết nối TV và Wifi của lớp học trường thành phố; mở slide câu hỏi, hình ảnh/sơ đồ tủ lạnh và video ngắn về cách sắp xếp thực phẩm trong tủ lạnh.",
      "- Phương án thay thế khi mất mạng: slide/tệp hình ảnh đã tải sẵn trên máy tính giáo viên hoặc tranh in hình tủ lạnh, thực phẩm và tình huống sử dụng tủ lạnh an toàn.",
      "- Slide khởi động mô phỏng tủ lạnh gia đình ở khu chung cư/nhà phố: GV chiếu hình các loại thực phẩm, mời HS quan sát và chọn ngăn tủ phù hợp.",
      "- Bộ thẻ hình/thẻ từ gồm: khoang cấp đông, khoang làm lạnh, làm đá, bảo quản đông lạnh, bảo quản lạnh và các loại thực phẩm; dùng để GV tổ chức cho HS kéo-thả trên slide hoặc ghép thẻ khi không dùng mạng.",
      "- Phiếu học tập mẫu phân hóa: câu hỏi lựa chọn, nối cột, đánh dấu đúng/sai cho HS cần hỗ trợ; câu hỏi giải thích, đề xuất cách sắp xếp tiết kiệm và an toàn cho HS khá giỏi.",
      "- Bảng phụ hoặc bảng lớp, bút dạ, nam châm/thẻ dán để tổng hợp đáp án và chốt quy tắc sử dụng tủ lạnh.",
    ];

    const rawStudents = [
      "- SGK hoặc bản in các hình/tình huống về tác dụng, khoang tủ lạnh, sắp xếp thực phẩm, dấu hiệu bất thường và an toàn khi sử dụng tủ lạnh.",
      "- Phiếu học tập cá nhân/cặp đôi: quan sát hình GV chiếu trên TV hoặc tranh in thay thế; khoanh/chọn đáp án, nối khoang với vai trò, đánh dấu cách bảo quản đúng hoặc chưa đúng.",
      "- Bộ thẻ thực phẩm và thẻ tên khoang để HS làm việc theo cặp: quan sát slide trên TV, kéo-thả/chọn vị trí trên phiếu hoặc ghép thẻ vào sơ đồ tủ lạnh khi mất mạng.",
      "- Bút chì, bút màu; HS dùng để đánh dấu thực phẩm cần cấp đông/làm lạnh và ghi một lời nhắc an toàn.",
      "- Nhiệm vụ trao đổi cặp đôi: quan sát hình/video ngắn do GV chiếu bằng máy tính kết nối TV, trả lời ngắn phù hợp và cách xử lí khi tủ lạnh bất thường; dùng tranh in nếu Wifi không ổn định.",
      "- Nhiệm vụ vận dụng tại gia đình thành thị: quan sát tủ lạnh gia đình (nếu được cho phép), chia sẻ với người thân cách sắp xếp, bọc đựng thực phẩm và báo ngu có dấu hiệu bất thường.",
    ];

    const cleaned = sanitizeMaterials({ teacher: rawTeacher, students: rawStudents });

    // Should drop "Phương án thay thế", "Nhiệm vụ trao đổi", "Nhiệm vụ vận dụng"
    expect(cleaned.teacher.some((t: string) => t.includes("Phương án thay thế"))).toBe(false);
    expect(cleaned.students.some((s: string) => s.includes("Nhiệm vụ trao đổi"))).toBe(false);
    expect(cleaned.students.some((s: string) => s.includes("Nhiệm vụ vận dụng"))).toBe(false);

    // Should strip trailing action clauses
    expect(cleaned.teacher.some((t: string) => t.includes("mở slide câu hỏi"))).toBe(false);
    expect(cleaned.teacher.some((t: string) => t.includes("dùng để GV tổ chức"))).toBe(false);
    expect(cleaned.teacher.some((t: string) => t.includes("để tổng hợp đáp án"))).toBe(false);
    expect(cleaned.students.some((s: string) => s.includes("HS dùng để đánh dấu"))).toBe(false);

    // Should retain clean items
    expect(cleaned.teacher.some((t: string) => t.includes("Máy tính, ti vi / màn chiếu"))).toBe(true);
    expect(cleaned.students.some((s: string) => s.includes("Bút chì, bút màu"))).toBe(true);
    expect(cleaned.students.some((s: string) => s.includes("Phiếu học tập"))).toBe(true);
  });
});
