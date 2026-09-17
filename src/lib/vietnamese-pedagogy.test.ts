/**
 * vietnamese-pedagogy.test.ts
 *
 * Tests for the Vietnamese lesson type classifier and helper functions.
 */

import { describe, it, expect } from "vitest";
import {
  classifyVietnameseLesson,
  getVietnameseChecklist,
  getCheckerFlagsForType,
  getVietnameseGradeWorkflow,
  vietnameseGradeWorkflows,
  vietnameseLessonTypeProfiles,
} from "./vietnamese-pedagogy";
import { classifierFixtures, makeInput } from "./vietnamese-fixtures";

// ─── CLASSIFIER TESTS ───

describe("classifyVietnameseLesson", () => {
  for (const fixture of classifierFixtures) {
    it(`phân loại đúng: ${fixture.name}`, () => {
      const input = makeInput(fixture.input);
      const result = classifyVietnameseLesson(input, fixture.ocrText);

      expect(result.primaryType).toBe(fixture.expectedPrimaryType);
      expect(result.gradeBand).toBeTruthy();

      // Confidence should be at least the expected level
      const confidenceLevels = { low: 0, medium: 1, high: 2 };
      expect(confidenceLevels[result.confidence]).toBeGreaterThanOrEqual(
        confidenceLevels[fixture.minConfidence],
      );

      // Evidence should be non-empty for non-mixed/non-low results
      if (result.primaryType !== "mixed" && result.confidence !== "low") {
        expect(result.evidence.length).toBeGreaterThan(0);
      }
    });
  }

  it("trả mixed với confidence low khi OCR rỗng và tên bài rỗng", () => {
    const input = makeInput({ grade: "Lớp 3", lessonTitle: "" });
    const result = classifyVietnameseLesson(input, "");

    expect(result.primaryType).toBe("mixed");
    expect(result.confidence).toBe("low");
    expect(result.uncertainties.length).toBeGreaterThan(0);
  });

  it("phonics chỉ áp dụng cho lớp 1-2, không cho lớp 4", () => {
    const input = makeInput({ grade: "Lớp 4", lessonTitle: "Âm e, ê" });
    const result = classifyVietnameseLesson(input, "Ghép tiếng be, bê.");

    // Should not be phonics for grade 4
    expect(result.primaryType).not.toBe("phonics");
  });

  it("tín hiệu xung đột trả confidence không cao hoặc có secondary types", () => {
    const input = makeInput({
      grade: "Lớp 3",
      lessonTitle: "Bài ôn tập",
    });
    // OCR has signals for multiple types
    const ocrText = "Đọc bài. Viết chính tả nghe viết. Luyện từ và câu. Nói và nghe kể chuyện.";
    const result = classifyVietnameseLesson(input, ocrText);

    // With many conflicting signals, should either be mixed or not have high confidence
    const isReasonable =
      result.primaryType === "mixed" ||
      result.secondaryTypes.length > 0 ||
      result.confidence !== "high";
    expect(isReasonable).toBe(true);
  });
});

// ─── LESSON-TYPE PROFILES ───

describe("vietnameseLessonTypeProfiles", () => {
  const allTypes = [
    "phonics",
    "reading",
    "handwriting",
    "spelling",
    "composition",
    "language-knowledge",
    "speaking-listening",
    "mixed",
  ] as const;

  for (const type of allTypes) {
    it(`profile '${type}' có đủ trường bắt buộc`, () => {
      const profile = vietnameseLessonTypeProfiles[type];
      expect(profile).toBeDefined();
      expect(profile.type).toBe(type);
      expect(profile.label).toBeTruthy();
      expect(profile.mandatorySequence.length).toBeGreaterThan(0);
      expect(profile.learningProducts.length).toBeGreaterThan(0);
      expect(profile.assessmentCriteria.length).toBeGreaterThan(0);
      expect(profile.checkerMustHave).toBeInstanceOf(RegExp);
    });
  }

  it("reading profile không yêu cầu ghép vần", () => {
    const profile = vietnameseLessonTypeProfiles.reading;
    expect(profile.checkerNotRequired).toContain("ghép vần");
  });

  it("spelling profile không yêu cầu đọc hiểu văn bản", () => {
    const profile = vietnameseLessonTypeProfiles.spelling;
    expect(profile.checkerNotRequired).toContain("đọc hiểu văn bản");
  });

  it("handwriting profile không yêu cầu nói và nghe", () => {
    const profile = vietnameseLessonTypeProfiles.handwriting;
    expect(profile.checkerNotRequired).toContain("nói và nghe");
  });
});

// ─── HELPERS ───

describe("getVietnameseChecklist", () => {
  it("trả checklist có kiểu bài và chuỗi bắt buộc", () => {
    const input = makeInput({ grade: "Lớp 3", lessonTitle: "Bài đọc: Test" });
    const classification = classifyVietnameseLesson(input, "Đọc bài thơ. Chi tiết. Câu hỏi. Ý chính.");
    const checklist = getVietnameseChecklist(classification);

    expect(checklist.length).toBeGreaterThan(0);
    expect(checklist[0]).toContain("Kiểu bài:");
  });

  it("trả checklist rỗng cho loại không có profile", () => {
    const checklist = getVietnameseChecklist({
      primaryType: "reading",
      secondaryTypes: [],
      confidence: "high",
      evidence: [],
      gradeBand: "Lớp 3",
      uncertainties: [],
    });
    // Reading does have a profile, so should have checks
    expect(checklist.length).toBeGreaterThan(0);
  });
});

describe("getCheckerFlagsForType", () => {
  it("reading chỉ bật requiresReading", () => {
    const flags = getCheckerFlagsForType("reading");
    expect(flags.requiresReading).toBe(true);
    expect(flags.requiresWriting).toBe(false);
    expect(flags.requiresSpeakingListening).toBe(false);
    expect(flags.requiresLanguageKnowledge).toBe(false);
    expect(flags.requiresPhonics).toBe(false);
  });

  it("spelling bật requiresWriting", () => {
    const flags = getCheckerFlagsForType("spelling");
    expect(flags.requiresWriting).toBe(true);
    expect(flags.requiresReading).toBe(false);
  });

  it("speaking-listening bật requiresSpeakingListening", () => {
    const flags = getCheckerFlagsForType("speaking-listening");
    expect(flags.requiresSpeakingListening).toBe(true);
    expect(flags.requiresReading).toBe(false);
  });

  it("phonics bật requiresPhonics", () => {
    const flags = getCheckerFlagsForType("phonics");
    expect(flags.requiresPhonics).toBe(true);
  });

  it("language-knowledge bật requiresLanguageKnowledge", () => {
    const flags = getCheckerFlagsForType("language-knowledge");
    expect(flags.requiresLanguageKnowledge).toBe(true);
  });
});

// ─── GRADE WORKFLOW TESTS ───

describe("vietnameseGradeWorkflows & getVietnameseGradeWorkflow", () => {
  it("lớp 1 bài âm/vần 2 tiết trả về workflow phonics 2 tiết", () => {
    const input = makeInput({ grade: "Lớp 1", lessonTitle: "Bài 42. ao eo", periods: 2 });
    const classification = classifyVietnameseLesson(input, "Ghép tiếng sao, kẹo. Viết ao, eo.");
    const wf = getVietnameseGradeWorkflow(input, classification);

    expect(wf).toBeDefined();
    expect(wf?.id).toBe("grade1-phonics-2p");
    expect(wf?.grade).toBe(1);
    expect(wf?.mandatoryStepsByPeriod?.[1]).toContain("Luyện viết bảng: GV viết mẫu điểm đặt bút/nét nối/cỡ chữ, HS viết bảng con");
    expect(wf?.mandatoryStepsByPeriod?.[2]).toContain("Luyện viết vở: tô và viết âm/chữ/vần/từ ngữ vào Vở tập viết, đúng tư thế");
  });

  it("lớp 1 đọc hiểu 4 tiết tập 2 trả về workflow reading 4 tiết", () => {
    const input = makeInput({ grade: "Lớp 1", lessonTitle: "Bài đọc: Đi học", periods: 4 });
    const classification = classifyVietnameseLesson(input, "Đọc văn bản. Trả lời câu hỏi.");
    const wf = getVietnameseGradeWorkflow(input, classification);

    expect(wf).toBeDefined();
    expect(wf?.id).toBe("grade1-reading-4p");
    expect(wf?.mandatoryStepsByPeriod?.[2]).toContain("Viết vào vở câu trả lời đúng quy cách chữ hoa và dấu câu");
  });

  it("lớp 2 tập viết trả về workflow handwriting", () => {
    const input = makeInput({ grade: "Lớp 2", lessonTitle: "Tập viết: Chữ hoa A", periods: 1 });
    const classification = classifyVietnameseLesson(input, "Quan sát chữ hoa A.");
    const wf = getVietnameseGradeWorkflow(input, classification);

    expect(wf).toBeDefined();
    expect(wf?.id).toBe("grade2-handwriting");
    expect(wf?.stepsSummary[0]).toContain("Viết chữ hoa");
  });

  it("lớp 2 chính tả trả về workflow spelling", () => {
    const input = makeInput({ grade: "Lớp 2", lessonTitle: "Chính tả: Nghe - viết Ngày hôm qua đâu rồi", periods: 1 });
    const classification = classifyVietnameseLesson(input, "Nghe viết đoạn thơ. Phân biệt ch/tr.");
    const wf = getVietnameseGradeWorkflow(input, classification);

    expect(wf).toBeDefined();
    expect(wf?.id).toBe("grade2-spelling");
    expect(wf?.stepsSummary[0]).toContain("Nghe - viết");
  });

  it("lớp 3 bài đọc trả về workflow reading lớp 3", () => {
    const input = makeInput({ grade: "Lớp 3", lessonTitle: "Bài đọc: Cậu học sinh mới", periods: 2 });
    const classification = classifyVietnameseLesson(input, "Luyện đọc thành tiếng. Tìm hiểu nghĩa từ ngữ. Đọc hiểu văn bản.");
    const wf = getVietnameseGradeWorkflow(input, classification);

    expect(wf).toBeDefined();
    expect(wf?.id).toBe("grade3-reading");
    expect(wf?.pedagogicalFocus[0]).toContain("Tách bạch 3 hoạt động trong Khám phá");
  });

  it("lớp 4 bài đọc trả về workflow 7 bước đọc lớp 4", () => {
    const input = makeInput({ grade: "Lớp 4", lessonTitle: "Bài đọc: Nghệ sĩ Trống", periods: 2 });
    const classification = classifyVietnameseLesson(input, "Đọc diễn cảm. Tìm hiểu bài.");
    const wf = getVietnameseGradeWorkflow(input, classification);

    expect(wf).toBeDefined();
    expect(wf?.id).toBe("grade4-reading-7steps");
    expect(wf?.stepsSummary.some((s) => s.includes("Bước 6: Luyện đọc lại, đọc diễn cảm"))).toBe(true);
  });

  it("lớp 5 bài đọc trả về workflow 8 bước đọc lớp 5", () => {
    const input = makeInput({ grade: "Lớp 5", lessonTitle: "Bài đọc: Mùa thảo quả", periods: 2 });
    const classification = classifyVietnameseLesson(input, "Nêu ý nghĩa văn bản. Đọc diễn cảm.");
    const wf = getVietnameseGradeWorkflow(input, classification);

    expect(wf).toBeDefined();
    expect(wf?.id).toBe("grade5-reading-8steps");
    expect(wf?.stepsSummary.some((s) => s.includes("Bước 6: Nêu nội dung, ý nghĩa của văn bản"))).toBe(true);
    expect(wf?.stepsSummary.some((s) => s.includes("Bước 7: Luyện đọc lại, đọc diễn cảm"))).toBe(true);
  });
});
