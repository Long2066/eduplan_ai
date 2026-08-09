import { describe, expect, it } from "vitest";
import {
  classifyNaturalSocialLesson,
  getNaturalSocialChecklist,
  isNaturalSocialSubjectName,
} from "./natural-social-pedagogy";
import { makeInput } from "./vietnamese-fixtures";

describe("natural social pedagogy classifier", () => {
  it("recognizes human-health lessons", () => {
    const input = makeInput({
      subject: "Tự nhiên và Xã hội",
      grade: "Lớp 2",
      lessonTitle: "Giữ vệ sinh cơ thể",
    });
    const classification = classifyNaturalSocialLesson(input, "Quan sát tranh rửa tay, vệ sinh cá nhân và phòng tránh bệnh.");

    expect(classification.primaryType).toBe("human-health");
    expect(classification.confidence).toBe("high");
  });

  it("recognizes plants and animals from source text", () => {
    const input = makeInput({
      subject: "Tự nhiên và Xã hội",
      grade: "Lớp 3",
      lessonTitle: "Quan sát cây xung quanh em",
    });
    const classification = classifyNaturalSocialLesson(input, "Lá, thân, rễ, hoa, quả. Chăm sóc và bảo vệ cây.");

    expect(classification.primaryType).toBe("plants-animals");
    expect(getNaturalSocialChecklist(classification).join(" ")).toContain("đối tượng quan sát");
  });

  it("falls back to mixed when signals are weak", () => {
    const input = makeInput({
      subject: "Tự nhiên và Xã hội",
      grade: "Lớp 1",
      lessonTitle: "Ôn tập",
    });
    const classification = classifyNaturalSocialLesson(input, "");

    expect(classification.primaryType).toBe("mixed");
    expect(classification.confidence).toBe("low");
  });

  it("separates home lessons from chores and home safety", () => {
    const input = makeInput({
      subject: "Tự nhiên và Xã hội",
      grade: "Lớp 1",
      lessonTitle: "Bài 2. Ngôi nhà của em",
    });
    const classification = classifyNaturalSocialLesson(
      input,
      "Quan sát nhà Minh, địa chỉ, quang cảnh, các kiểu nhà, các phòng và đồ dùng trong từng phòng.",
    );

    expect(classification.primaryType).toBe("family");
    expect(classification.topicFocus).toBe("home-environment");
  });

  it("keeps family chores as a distinct topic focus", () => {
    const input = makeInput({
      subject: "Tự nhiên và Xã hội",
      grade: "Lớp 2",
      lessonTitle: "Cùng làm việc nhà",
    });
    const classification = classifyNaturalSocialLesson(input, "Quét nhà, gấp quần áo và chia sẻ việc nhà vừa sức.");

    expect(classification.primaryType).toBe("family");
    expect(classification.topicFocus).toBe("family-chores");
  });

  it("does not classify a school address as a family lesson", () => {
    const input = makeInput({
      subject: "Tự nhiên và Xã hội",
      grade: "Lớp 1",
      lessonTitle: "Bài 7. Cùng khám phá trường học",
    });
    const classification = classifyNaturalSocialLesson(
      input,
      "Nêu tên và địa chỉ trường em. Quan sát lớp học, sân trường và các hoạt động ở trường.",
    );

    expect(classification.primaryType).toBe("school");
    expect(classification.secondaryTypes).not.toContain("family");
  });

  it("still recognizes an address of the family home", () => {
    const input = makeInput({
      subject: "Tự nhiên và Xã hội",
      grade: "Lớp 1",
      lessonTitle: "Địa chỉ nơi gia đình em ở",
    });
    const classification = classifyNaturalSocialLesson(input, "Em cần biết địa chỉ nhà và nơi gia đình đang sinh sống.");

    expect(classification.primaryType).toBe("family");
    expect(classification.topicFocus).toBe("home-environment");
  });

  it("accepts canonical and short subject names", () => {
    expect(isNaturalSocialSubjectName("Tự nhiên và Xã hội")).toBe(true);
    expect(isNaturalSocialSubjectName("TNXH")).toBe(true);
    expect(isNaturalSocialSubjectName("Toán")).toBe(false);
  });
});
