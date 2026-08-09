import { describe, expect, it } from "vitest";
import {
  NATURAL_SOCIAL_OUTSIDE_SGK_LABEL,
  applyNaturalSocialStartupGuardrails,
  isNaturalSocialGradeOneTextHeavyStartup,
  isWeakNaturalSocialStartup,
  naturalSocialStartupToActivity,
  selectNaturalSocialStartup,
} from "./natural-social-startup";
import { makeInput } from "./vietnamese-fixtures";
import type { LessonActivity, NaturalSocialSourceInventory } from "@/types/lesson";

const sourceInventory: NaturalSocialSourceInventory = {
  visuals: [{ visualId: "visual-1", label: "Gia đình bạn An cùng ăn cơm", required: true }],
  questions: [{
    taskId: "question-1",
    question: "Mọi người trong gia đình đang làm gì?",
    visualIds: ["visual-1"],
    periodNumber: 1,
    required: true,
  }],
};

function input(overrides = {}) {
  return makeInput({
    subject: "Tự nhiên và Xã hội",
    grade: "Lớp 1",
    lessonTitle: "Kể về gia đình",
    facilities: ["Bảng lớp", "Thẻ màu"],
    ...overrides,
  });
}

describe("selectNaturalSocialStartup", () => {
  it("creates an outside-SGK startup that bridges back to SGK without claiming source coverage", () => {
    const suggestion = selectNaturalSocialStartup({
      input: input(),
      lessonType: "family",
      periodNumber: 1,
      lessonTitle: "Kể về gia đình",
      sourceInventory,
    });
    const activity = naturalSocialStartupToActivity(suggestion);

    expect(suggestion.materials.join(" ")).toContain(NATURAL_SOCIAL_OUTSIDE_SGK_LABEL);
    expect(suggestion.bridgeQuestion).toContain("SGK");
    expect(suggestion.coveragePurpose).toContain("không thay thế nhiệm vụ SGK");
    expect(activity.sourceTaskIds).toEqual([]);
    expect(activity.sourceVisualIds).toEqual([]);
    expect(activity.organization).toBe("whole_class");
  });

  it("varies the startup form across periods for the same lesson type", () => {
    const first = selectNaturalSocialStartup({
      input: input({ grade: "Lớp 2" }),
      lessonType: "family",
      periodNumber: 1,
      lessonTitle: "Kể về gia đình",
      sourceInventory,
    });
    const second = selectNaturalSocialStartup({
      input: input({ grade: "Lớp 2" }),
      lessonType: "family",
      periodNumber: 2,
      lessonTitle: "Kể về gia đình",
      sourceInventory,
    });

    expect(first.title).not.toBe(second.title);
  });

  it("does not require writing-heavy startup work for grade 1", () => {
    const suggestion = selectNaturalSocialStartup({
      input: input(),
      lessonType: "plants-animals",
      periodNumber: 1,
      lessonTitle: "Động vật sống ở đâu?",
    });
    const text = [...suggestion.teacherActions, ...suggestion.studentActions].join(" ");

    expect(text).not.toMatch(/HS .*?(viết|ghi|hoàn thành phiếu)/i);
  });

  it("uses a home-focused startup instead of chores for a home lesson", () => {
    const suggestion = selectNaturalSocialStartup({
      input: input({ lessonTitle: "Ngôi nhà của em" }),
      lessonType: "family",
      topicFocus: "home-environment",
      periodNumber: 1,
      lessonTitle: "Ngôi nhà của em",
      focus: "Địa chỉ, đặc điểm và các kiểu nhà",
      sourceInventory: {
        visuals: [{ visualId: "home-1", label: "Ngôi nhà của Minh", required: true }],
        questions: [{ taskId: "home-q1", question: "Nhà Minh có đặc điểm gì?", visualIds: ["home-1"], periodNumber: 1 }],
      },
    });
    const text = [suggestion.title, ...suggestion.teacherActions, ...suggestion.studentActions].join(" ");

    expect(text).toMatch(/ngôi nhà|kiểu nhà|đặc điểm ngôi nhà/i);
    expect(text).not.toMatch(/việc nhà|nấu ăn|lau bàn|chăm em|giúp gia đình/i);
  });

  it("uses room and household-item signals for a later home period", () => {
    const suggestion = selectNaturalSocialStartup({
      input: input({ lessonTitle: "Ngôi nhà của em" }),
      lessonType: "family",
      topicFocus: "home-environment",
      periodNumber: 2,
      lessonTitle: "Ngôi nhà của em",
      focus: "Các phòng và đồ dùng trong nhà",
      inquiryQuestion: "Đồ dùng nào phù hợp với từng phòng?",
    });
    const text = [suggestion.title, ...suggestion.teacherActions, ...suggestion.studentActions].join(" ");

    expect(text).toMatch(/phòng|đồ dùng/i);
    expect(text).not.toMatch(/việc nhà|thẻ việc tốt|cam kết/i);
  });
});

describe("natural social startup guardrails", () => {
  const weakStartup: LessonActivity = {
    phase: "Khởi động",
    title: "Giới thiệu bài",
    objective: "Dẫn vào bài.",
    durationMinutes: 5,
    teacherActions: ["Học liệu/đầu vào: Tranh nghề nghiệp phóng to từ SGK", "GV giới thiệu bài."],
    studentActions: ["Cách tổ chức: Toàn lớp", "HS lắng nghe."],
    inputOrMaterials: [],
  };

  it("detects metadata leaks and replaces weak startup content", () => {
    const suggestion = selectNaturalSocialStartup({
      input: input({ lessonTitle: "Nghề nghiệp quanh em" }),
      lessonType: "local-community",
      periodNumber: 1,
      lessonTitle: "Nghề nghiệp quanh em",
    });
    const fixed = applyNaturalSocialStartupGuardrails(weakStartup, input(), suggestion);

    expect(isWeakNaturalSocialStartup(weakStartup)).toBe(true);
    expect(fixed.title).toBe(suggestion.title);
    expect(fixed.teacherActions.join(" ")).not.toContain("Học liệu/đầu vào");
    expect(fixed.studentActions.join(" ")).not.toContain("Cách tổ chức");
  });

  it("flags grade 1 startups that ask students to write/read too much", () => {
    expect(isNaturalSocialGradeOneTextHeavyStartup({
      ...weakStartup,
      teacherActions: ["GV phát phiếu chữ dài và yêu cầu đọc thầm."],
      studentActions: ["HS viết nhanh 3 câu vào phiếu trước khi chia sẻ."],
    }, 1)).toBe(true);
  });
});
