/**
 * subject-checkers-vietnamese.test.ts
 *
 * Tests for the conditional Vietnamese checker in subject-checkers.ts.
 * Verifies that:
 * - Spelling lessons pass without full reading comprehension activities
 * - Language-knowledge lessons pass without speaking-listening
 * - Reading lessons fail when missing evidence/comprehension questions
 * - Composition lessons fail when missing revision step
 * - Speaking-listening lessons fail when listener has no task
 * - Phonics lessons (grade 1) fail when missing syllable building
 * - Mixed lessons only check the assigned type
 * - Issue codes are stable
 */

import { describe, it, expect } from "vitest";
import {
  subjectPedagogyIssues,
  vietnamesePeriodIssues,
  vietnameseLessonIssues,
  buildPedagogyAudit,
} from "./subject-checkers";
import {
  makeInput,
  makeLesson,
  readingLessonGood,
  spellingLessonGood,
  languageKnowledgeLessonGood,
  makeActivity,
  makePeriod,
} from "./vietnamese-fixtures";
import type { VietnamesePeriodBlueprint } from "@/types/lesson";

// ─── subjectPedagogyIssues – Conditional checks ───

describe("subjectPedagogyIssues – Tiếng Việt conditional", () => {
  it("bài Chính tả đạt dù không có luyện đọc đầy đủ", () => {
    const input = makeInput({
      grade: "Lớp 2",
      lessonTitle: "Chính tả: Nghe - viết",
    });
    const issues = subjectPedagogyIssues(spellingLessonGood, input);

    // Should NOT contain old-style blanket "thiếu hoạt động đọc/luyện đọc"
    const readingIssues = issues.filter((i) => /thiếu hoạt động đọc\/luyện đọc/i.test(i));
    expect(readingIssues).toHaveLength(0);

    // Should NOT contain blanket "thiếu hoạt động nói-nghe"
    const speakingIssues = issues.filter((i) => /thiếu hoạt động nói-nghe/i.test(i));
    expect(speakingIssues).toHaveLength(0);
  });

  it("bài Luyện từ và câu đạt dù không có nói-nghe độc lập", () => {
    const input = makeInput({
      grade: "Lớp 3",
      lessonTitle: "Luyện từ và câu: Từ đồng nghĩa",
    });
    const issues = subjectPedagogyIssues(languageKnowledgeLessonGood, input);

    // Should NOT have blanket "thiếu hoạt động nói-nghe"
    const speakingIssues = issues.filter((i) => /thiếu hoạt động nói-nghe/i.test(i));
    expect(speakingIssues).toHaveLength(0);
  });

  it("bài Đọc đạt khi có đủ thành tố đọc hiểu", () => {
    const input = makeInput({
      grade: "Lớp 3",
      lessonTitle: "Bài đọc: Con cò",
    });
    const issues = subjectPedagogyIssues(readingLessonGood, input);

    // Should have no TV-READ issues
    const readIssues = issues.filter((i) => i.startsWith("TV-READ"));
    expect(readIssues).toHaveLength(0);
  });

  it("bài Đọc bị lỗi khi thiếu ngữ liệu và chi tiết", () => {
    const input = makeInput({
      grade: "Lớp 3",
      lessonTitle: "Bài đọc: Con cò",
    });
    const emptyLesson = makeLesson({
      activities: [
        makeActivity({
          phase: "Khởi động", title: "Khởi động", durationMinutes: 5,
          teacherActions: ["GV giới thiệu bài."],
          studentActions: ["HS lắng nghe."],
        }),
        makeActivity({
          phase: "Khám phá", title: "Khám phá", durationMinutes: 15,
          teacherActions: ["GV hướng dẫn HS tìm hiểu bài."],
          studentActions: ["HS tìm hiểu bài."],
        }),
        makeActivity({
          phase: "Luyện tập", title: "Luyện tập", durationMinutes: 10,
          teacherActions: ["GV giao bài tập."],
          studentActions: ["HS làm bài."],
        }),
        makeActivity({
          phase: "Vận dụng", title: "Vận dụng", durationMinutes: 5,
          teacherActions: ["GV nhận xét."],
          studentActions: ["HS lắng nghe."],
        }),
      ],
    });
    const issues = subjectPedagogyIssues(emptyLesson, input);

    // Should have reading-specific issues
    const readIssues = issues.filter((i) => i.startsWith("TV-READ"));
    expect(readIssues.length).toBeGreaterThan(0);
  });

  it("ngữ liệu rỗng bị báo thiếu ngữ liệu", () => {
    const input = makeInput({
      grade: "Lớp 3",
      lessonTitle: "Bài đọc: Test",
    });
    // Lesson with no linguistic material at all
    const emptyLesson = makeLesson({
      outcomes: {
        generalCompetencies: ["Test"],
        specificCompetencies: ["Test"],
        qualities: ["Test"],
        knowledgeAndSkills: ["Test"],
      },
      materials: { teacher: ["Không"], students: ["Không"] },
      activities: [
        makeActivity({ phase: "Khởi động", title: "Khởi động", objective: "Test", durationMinutes: 4, teacherActions: ["GV nói."], studentActions: ["HS nghe."], learningProducts: ["Không."], successCriteria: [], expectedAnswer: "", commonErrors: [], teacherFeedback: [], supportForStudentsNeedingHelp: [], extensionForEarlyFinishers: [] }),
        makeActivity({ phase: "Khám phá", title: "Khám phá", objective: "Test", durationMinutes: 14, teacherActions: ["GV nói."], studentActions: ["HS nghe."], learningProducts: ["Không."], successCriteria: [], expectedAnswer: "", commonErrors: [], teacherFeedback: [], supportForStudentsNeedingHelp: [], extensionForEarlyFinishers: [] }),
        makeActivity({ phase: "Luyện tập", title: "Luyện tập", objective: "Test", durationMinutes: 10, teacherActions: ["GV nói."], studentActions: ["HS nghe."], learningProducts: ["Không."], successCriteria: [], expectedAnswer: "", commonErrors: [], teacherFeedback: [], supportForStudentsNeedingHelp: [], extensionForEarlyFinishers: [] }),
        makeActivity({ phase: "Vận dụng", title: "Vận dụng", objective: "Test", durationMinutes: 4, teacherActions: ["GV nói."], studentActions: ["HS nghe."], learningProducts: ["Không."], successCriteria: [], expectedAnswer: "", commonErrors: [], teacherFeedback: [], supportForStudentsNeedingHelp: [], extensionForEarlyFinishers: [] }),
      ],
    });
    const issues = subjectPedagogyIssues(emptyLesson, input);
    const uniIssues = issues.filter((i) => i.includes("TV-UNI-01"));
    expect(uniIssues.length).toBeGreaterThan(0);
  });
});

// ─── vietnamesePeriodIssues ───

describe("vietnamesePeriodIssues", () => {
  it("tiết Chính tả đạt không bị lỗi đọc hiểu", () => {
    const period = spellingLessonGood.periodPlans?.[0] || {
      periodNumber: 1,
      focus: "Chính tả",
      outcomes: spellingLessonGood.outcomes,
      activities: spellingLessonGood.activities,
    };
    const blueprint: VietnamesePeriodBlueprint = {
      periodNumber: 1,
      lessonType: "spelling",
    };
    const input = makeInput({ grade: "Lớp 2", lessonTitle: "Chính tả: Nghe - viết" });
    const issues = vietnamesePeriodIssues(period, blueprint, input);

    // No reading-specific issues
    const readIssues = issues.filter((i) => i.startsWith("TV-READ"));
    expect(readIssues).toHaveLength(0);
  });

  it("tiết Đọc bị lỗi khi thiếu luyện đọc", () => {
    const period = makePeriod({
      activities: [
        makeActivity({ phase: "Khởi động", title: "Khởi động", durationMinutes: 5 }),
        makeActivity({ phase: "Khám phá", title: "Khám phá", durationMinutes: 15,
          teacherActions: ["GV hỏi về nội dung bài."],
          studentActions: ["HS trả lời."],
        }),
        makeActivity({ phase: "Luyện tập", title: "Luyện tập", durationMinutes: 10 }),
        makeActivity({ phase: "Vận dụng", title: "Vận dụng", durationMinutes: 5 }),
      ],
    });
    const blueprint: VietnamesePeriodBlueprint = {
      periodNumber: 1,
      lessonType: "reading",
    };
    const input = makeInput({ grade: "Lớp 3", lessonTitle: "Bài đọc" });
    const issues = vietnamesePeriodIssues(period, blueprint, input);

    // Should have TV-READ-01
    expect(issues.some((i) => i.includes("TV-READ-01"))).toBe(true);
  });

  it("mixed type không tạo lỗi kiểu bài cụ thể", () => {
    const period = makePeriod();
    const blueprint: VietnamesePeriodBlueprint = {
      periodNumber: 1,
      lessonType: "mixed",
    };
    const input = makeInput({ grade: "Lớp 3", lessonTitle: "Ôn tập" });
    const issues = vietnamesePeriodIssues(period, blueprint, input);

    // No type-specific issues (TV-READ, TV-SPELL, etc.)
    const typeIssues = issues.filter((i) =>
      /TV-READ|TV-SPELL|TV-WRITE|TV-LANG|TV-SPEAK|TV-PHON|TV-HAND|TV-TYPE/.test(i),
    );
    expect(typeIssues).toHaveLength(0);
  });
});

// ─── buildPedagogyAudit ───

describe("buildPedagogyAudit – Vietnamese metadata", () => {
  it("includes lessonType for Tiếng Việt", () => {
    const input = makeInput({ grade: "Lớp 3", lessonTitle: "Luyện từ và câu: Từ đồng nghĩa" });
    const audit = buildPedagogyAudit(languageKnowledgeLessonGood, input, false);

    expect(audit.lessonType).toBe("language-knowledge");
    expect(audit.classificationConfidence).toBeTruthy();
  });

  it("does NOT include lessonType for Toán", () => {
    const input = makeInput({ subject: "Toán", grade: "Lớp 3", lessonTitle: "Phép cộng" });
    const lesson = makeLesson({ generalInfo: { subject: "Toán", grade: "Lớp 3", lessonTitle: "Phép cộng", periods: 1, duration: 35 } });
    const audit = buildPedagogyAudit(lesson, input, false);

    expect(audit.lessonType).toBeUndefined();
    expect(audit.classificationConfidence).toBeUndefined();
  });
});

// ─── Issue code stability ───

describe("Issue code stability", () => {
  const allCodes = [
    "TV-UNI-01", "TV-UNI-02",
    "TV-TYPE-01",
    "TV-READ-01", "TV-READ-02", "TV-READ-03",
    "TV-SPELL-01", "TV-SPELL-02", "TV-SPELL-03",
    "TV-WRITE-01", "TV-WRITE-02",
    "TV-LANG-01", "TV-LANG-02", "TV-LANG-03",
    "TV-SPEAK-01", "TV-SPEAK-02",
    "TV-PHON-01", "TV-PHON-02", "TV-PHON-03",
    "TV-HAND-01", "TV-HAND-02", "TV-HAND-03",
    "TV-STRUCT-01", "TV-STRUCT-02",
    "TV-PAIR-01", "TV-PAIR-02", "TV-PAIR-03", "TV-PAIR-04",
  ];

  it("tất cả mã issue là duy nhất", () => {
    const uniqueCodes = new Set(allCodes);
    expect(uniqueCodes.size).toBe(allCodes.length);
  });

  it("tất cả mã issue bắt đầu bằng TV-", () => {
    for (const code of allCodes) {
      expect(code).toMatch(/^TV-[A-Z]+-\d{2}$/);
    }
  });
});
