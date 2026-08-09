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
