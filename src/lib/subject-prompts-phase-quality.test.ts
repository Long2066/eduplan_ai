import { describe, expect, it } from "vitest";
import {
  buildMathBlueprintPrompt,
  buildMathPeriodPrompt,
  buildMathPeriodRepairPrompt,
  buildNaturalSocialBlueprintPrompt,
  buildNaturalSocialPeriodPrompt,
  buildNaturalSocialPeriodRepairPrompt,
  buildSubjectPrompt,
  buildSubjectRepairPrompt,
  buildVietnameseBlueprintPrompt,
  buildVietnamesePeriodPrompt,
  buildVietnamesePeriodRepairPrompt,
} from "@/lib/subject-prompts";
import { classifyNaturalSocialLesson } from "@/lib/natural-social-pedagogy";
import { classifyVietnameseLesson } from "@/lib/vietnamese-pedagogy";
import { makeInput } from "@/lib/vietnamese-fixtures";
import type {
  LessonActivity,
  LessonInput,
  LessonPlan,
  MathLessonBlueprint,
  MathPeriodBlueprint,
  MathPeriodChunk,
  NaturalSocialLessonBlueprint,
  NaturalSocialPeriodBlueprint,
  NaturalSocialPeriodChunk,
  VietnameseLessonBlueprint,
  VietnamesePeriodBlueprint,
  VietnamesePeriodChunk,
} from "@/types/lesson";

function expectPhaseQualityGuidance(prompt: string) {
  expect(prompt).toContain("CHUẨN VAI TRÒ 4 PHA");
  expect(prompt).toContain("Áp dụng cho mọi môn, mọi bài, mọi tiết, cả miễn phí và trả phí");
  expect(prompt).toContain("Khám phá của các tiết trong cùng bài phải khác nhau rõ");
  expect(prompt).toContain("Luyện tập chỉ luyện chính kiến thức/kĩ năng vừa được Khám phá chốt");
  expect(prompt).toContain("Vận dụng phải đưa kiến thức/kĩ năng vào bối cảnh thật hoặc gần thật");
}

function activity(overrides: Partial<LessonActivity> = {}): LessonActivity {
  return {
    phase: "Khám phá",
    title: "Tìm hiểu nhiệm vụ",
    objective: "Nêu được nội dung chính của bài.",
    durationMinutes: 12,
    teacherActions: ["GV giao nhiệm vụ quan sát tranh và nêu nhận xét."],
    studentActions: ["HS quan sát tranh và nêu nhận xét."],
    learningProducts: ["Câu trả lời của học sinh."],
    ...overrides,
  };
}

function lesson(input: LessonInput): LessonPlan {
  return {
    generalInfo: {
      subject: input.subject,
      grade: input.grade,
      lessonTitle: input.lessonTitle || "Bài học",
      book: input.book,
      periods: input.periods,
      duration: input.duration,
    },
    outcomes: {
      generalCompetencies: ["Trao đổi được với bạn về nhiệm vụ học tập."],
      specificCompetencies: ["Nêu được nội dung chính của bài học."],
      qualities: ["Tham gia hoạt động học tập với tinh thần trách nhiệm."],
      knowledgeAndSkills: ["Thực hiện được nhiệm vụ trọng tâm của bài."],
    },
    materials: { teacher: [], students: [] },
    activities: [
      activity({ phase: "Khởi động", title: "Mở đầu", durationMinutes: 4 }),
      activity(),
      activity({ phase: "Luyện tập", title: "Thực hành", durationMinutes: 10 }),
      activity({ phase: "Vận dụng", title: "Liên hệ", durationMinutes: 4 }),
    ],
    assessment: { criteria: [], evidence: [], comments: [] },
    adjustments: { suitablePoints: [], pointsToAdjust: [], nextLessonDirection: [] },
    contextFit: { notes: [] },
    meta: { style: input.style, modelUsed: "test", createdAt: "2026-01-01T00:00:00.000Z" },
  };
}

describe("subject prompts phase quality guidance", () => {
  it("injects the global phase standard into default generation and repair prompts", () => {
    const input = makeInput({ subject: "Đạo đức", lessonTitle: "Giữ lời hứa" });
    expectPhaseQualityGuidance(buildSubjectPrompt(input, "Tình huống: bạn nhỏ giữ lời hứa với bạn."));

    const repairPrompt = buildSubjectRepairPrompt(lesson(input), input, "Tình huống giữ lời hứa.", "Vận dụng còn chung chung.");
    expectPhaseQualityGuidance(repairPrompt);
    expect(repairPrompt).toContain("nếu tên pha đúng nhưng nội dung sai bản chất");
  });

  it("injects the global phase standard into math blueprint, period and repair prompts", () => {
    const input = makeInput({ subject: "Toán", lessonTitle: "Phép cộng trong phạm vi 100", periods: 1 });
    const blueprint: MathLessonBlueprint = {
      lessonTitle: input.lessonTitle,
      periods: [{ periodNumber: 1, focus: "Cộng hai số", activities: [] }],
    };
    const period: MathPeriodBlueprint = { periodNumber: 1, focus: "Cộng hai số", activities: [] };
    const chunk: MathPeriodChunk = { periodNumber: 1, focus: "Cộng hai số", activities: [] };

    expectPhaseQualityGuidance(buildMathBlueprintPrompt(input, "Bài 1: 24 + 35 = ?"));
    expectPhaseQualityGuidance(buildMathPeriodPrompt(input, "Bài 1: 24 + 35 = ?", blueprint, period, null));
    const repairPrompt = buildMathPeriodRepairPrompt(input, blueprint, chunk, ["Vận dụng chưa gắn thực tế."]);
    expectPhaseQualityGuidance(repairPrompt);
    expect(repairPrompt).toContain("phải viết lại toàn bộ pha đó");
  });

  it("injects the global phase standard into natural-social blueprint, period and repair prompts", () => {
    const input = makeInput({ subject: "Tự nhiên và Xã hội", grade: "Lớp 2", lessonTitle: "Chăm sóc cây trồng", periods: 1 });
    const ocrText = "Quan sát cây trong tranh. Nêu việc nên làm để chăm sóc cây.";
    const classification = classifyNaturalSocialLesson(input, ocrText);
    const period: NaturalSocialPeriodBlueprint = { periodNumber: 1, focus: "Quan sát và chăm sóc cây", lessonType: classification.primaryType };
    const blueprint: NaturalSocialLessonBlueprint = { lessonTitle: input.lessonTitle, classification, periods: [period] };
    const chunk: NaturalSocialPeriodChunk = { periodNumber: 1, focus: "Quan sát và chăm sóc cây", activities: [] };

    expectPhaseQualityGuidance(buildNaturalSocialBlueprintPrompt(input, ocrText, classification));
    expectPhaseQualityGuidance(buildNaturalSocialPeriodPrompt(input, ocrText, blueprint, period, null));
    expectPhaseQualityGuidance(buildNaturalSocialPeriodRepairPrompt(input, blueprint, chunk, ["Khám phá thiếu bằng chứng quan sát."]));
  });

  it("injects the global phase standard into Vietnamese blueprint, period and repair prompts", () => {
    const input = makeInput({ subject: "Tiếng Việt", grade: "Lớp 3", lessonTitle: "Bài đọc: Dòng sông", periods: 1 });
    const ocrText = "Đọc bài Dòng sông. Tìm chi tiết tả dòng sông. Nêu cảm nghĩ.";
    const classification = classifyVietnameseLesson(input, ocrText);
    const period: VietnamesePeriodBlueprint = { periodNumber: 1, focus: "Đọc và tìm chi tiết", lessonType: classification.primaryType };
    const blueprint: VietnameseLessonBlueprint = { lessonTitle: input.lessonTitle, classification, periods: [period] };
    const chunk: VietnamesePeriodChunk = { periodNumber: 1, focus: "Đọc và tìm chi tiết", activities: [] };

    expectPhaseQualityGuidance(buildVietnameseBlueprintPrompt(input, ocrText, classification));
    expectPhaseQualityGuidance(buildVietnamesePeriodPrompt(input, ocrText, blueprint, period, null));
    expectPhaseQualityGuidance(buildVietnamesePeriodRepairPrompt(input, blueprint, chunk, ["Luyện tập chưa bám kĩ năng vừa hình thành."]));
  });
});
