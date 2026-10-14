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

  it("lớp 2 tập làm văn và đọc mở rộng định tuyến đúng", () => {
    const compInput = makeInput({ grade: "Lớp 2", lessonTitle: "Luyện viết đoạn: Kể về một việc tốt", periods: 1 });
    const compClass = classifyVietnameseLesson(compInput, "Viết 3-4 câu kể về việc tốt em đã làm.");
    const compWf = getVietnameseGradeWorkflow(compInput, compClass);
    expect(compWf?.id).toBe("grade2-composition");
    expect(compWf?.stepsSummary.some((s) => s.toLowerCase().includes("viết đoạn văn"))).toBe(true);

    const extInput = makeInput({ grade: "Lớp 2", lessonTitle: "Đọc mở rộng: Đọc một bài thơ về trẻ em", periods: 1 });
    const extClass = classifyVietnameseLesson(extInput, "Đọc thơ và chia sẻ phiếu đọc sách.");
    const extWf = getVietnameseGradeWorkflow(extInput, extClass);
    expect(extWf?.id).toBe("grade2-reading-extension");
  });

  it("lớp 3 chính tả, luyện từ và câu, viết đoạn định tuyến đúng", () => {
    const spellInput = makeInput({ grade: "Lớp 3", lessonTitle: "Chính tả: Nghe - viết Em học vẽ", periods: 1 });
    const spellClass = classifyVietnameseLesson(spellInput, "Nghe viết khổ 1, 2. Làm bài tập phân biệt s/x.");
    const spellWf = getVietnameseGradeWorkflow(spellInput, spellClass);
    expect(spellWf?.id).toBe("grade3-spelling");
    expect(spellWf?.stepsSummary.some((s) => s.includes("soát lỗi"))).toBe(true);

    const lkInput = makeInput({ grade: "Lớp 3", lessonTitle: "Luyện từ và câu: Mở rộng vốn từ Trường học", periods: 1 });
    const lkClass = classifyVietnameseLesson(lkInput, "Tìm từ chỉ hoạt động ở trường. Đặt câu.");
    const lkWf = getVietnameseGradeWorkflow(lkInput, lkClass);
    expect(lkWf?.id).toBe("grade3-language-knowledge");
    expect(lkWf?.stepsSummary.some((s) => s.includes("Nhận biết"))).toBe(true);

    const compInput = makeInput({ grade: "Lớp 3", lessonTitle: "Luyện viết đoạn: Kể lại một buổi lao động", periods: 1 });
    const compClass = classifyVietnameseLesson(compInput, "Viết đoạn văn từ 5 đến 7 câu.");
    const compWf = getVietnameseGradeWorkflow(compInput, compClass);
    expect(compWf?.id).toBe("grade3-composition");
    expect(compWf?.stepsSummary.some((s) => s.includes("Đọc soát & Chỉnh sửa"))).toBe(true);
  });

  it("lớp 4 nói nghe 7 bước, viết quy trình, luyện từ câu và đọc mở rộng định tuyến đúng", () => {
    const slInput = makeInput({ grade: "Lớp 4", lessonTitle: "Nói và nghe: Kể chuyện Cây khế", periods: 1 });
    const slClass = classifyVietnameseLesson(slInput, "Nghe kể chuyện và tập kể lại.");
    const slWf = getVietnameseGradeWorkflow(slInput, slClass);
    expect(slWf?.id).toBe("grade4-speaking-listening-7steps");
    expect(slWf?.stepsSummary.some((s) => s.includes("4. Thực hành nói"))).toBe(true);

    const compInput = makeInput({ grade: "Lớp 4", lessonTitle: "Viết: Lập dàn ý cho bài văn miêu tả cây cối", periods: 1 });
    const compClass = classifyVietnameseLesson(compInput, "Lập dàn ý chi tiết bài văn miêu tả.");
    const compWf = getVietnameseGradeWorkflow(compInput, compClass);
    expect(compWf?.id).toBe("grade4-composition-process");
    expect(compWf?.stepsSummary.some((s) => s.toLowerCase().includes("lập dàn ý"))).toBe(true);

    const lkInput = makeInput({ grade: "Lớp 4", lessonTitle: "Luyện từ và câu: Danh từ", periods: 1 });
    const lkClass = classifyVietnameseLesson(lkInput, "Tìm danh từ chỉ người, vật, hiện tượng.");
    const lkWf = getVietnameseGradeWorkflow(lkInput, lkClass);
    expect(lkWf?.id).toBe("grade4-language-knowledge");

    const extInput = makeInput({ grade: "Lớp 4", lessonTitle: "Đọc mở rộng: Đọc sách về các nhà thám hiểm", periods: 1 });
    const extClass = classifyVietnameseLesson(extInput, "Tìm đọc bài viết về thám hiểm và ghi phiếu đọc sách.");
    const extWf = getVietnameseGradeWorkflow(extInput, extClass);
    expect(extWf?.id).toBe("grade4-reading-extension");
  });

  it("lớp 5 nói nghe, viết quy trình, luyện từ câu và đọc mở rộng định tuyến đúng", () => {
    const slInput = makeInput({ grade: "Lớp 5", lessonTitle: "Nói và nghe: Thuyết trình về vấn đề ô nhiễm môi trường", periods: 1 });
    const slClass = classifyVietnameseLesson(slInput, "Chuẩn bị bài nói và trao đổi với các bạn.");
    const slWf = getVietnameseGradeWorkflow(slInput, slClass);
    expect(slWf?.id).toBe("grade5-speaking-listening-7steps");

    const compInput = makeInput({ grade: "Lớp 5", lessonTitle: "Viết: Viết bài văn tả cảnh sông nước", periods: 1 });
    const compClass = classifyVietnameseLesson(compInput, "Dựa vào dàn ý đã lập, viết bài văn hoàn chỉnh.");
    const compWf = getVietnameseGradeWorkflow(compInput, compClass);
    expect(compWf?.id).toBe("grade5-composition-process");
    expect(compWf?.stepsSummary.some((s) => s.includes("Đọc soát"))).toBe(true);

    const lkInput = makeInput({ grade: "Lớp 5", lessonTitle: "Luyện từ và câu: Từ đồng nghĩa", periods: 1 });
    const lkClass = classifyVietnameseLesson(lkInput, "Tìm từ đồng nghĩa hoàn toàn và không hoàn toàn.");
    const lkWf = getVietnameseGradeWorkflow(lkInput, lkClass);
    expect(lkWf?.id).toBe("grade5-language-knowledge");

    const extInput = makeInput({ grade: "Lớp 5", lessonTitle: "Đọc mở rộng: Tìm đọc truyện lịch sử", periods: 1 });
    const extClass = classifyVietnameseLesson(extInput, "Ghi chép sự kiện lịch sử vào phiếu đọc sách.");
    const extWf = getVietnameseGradeWorkflow(extInput, extClass);
    expect(extWf?.id).toBe("grade5-reading-extension");
  });
});
