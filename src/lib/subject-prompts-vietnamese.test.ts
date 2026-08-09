/**
 * subject-prompts-vietnamese.test.ts
 * Phase B tests for Vietnamese blueprint, period and local-repair prompts.
 */
import { describe, expect, it } from "vitest";
import {
  buildVietnameseBlueprintPrompt,
  buildVietnamesePeriodPrompt,
  buildVietnamesePeriodRepairPrompt,
  vietnameseLessonTypeGuidance,
} from "./subject-prompts";
import { classifyVietnameseLesson } from "./vietnamese-pedagogy";
import { makeInput } from "./vietnamese-fixtures";
import type { VietnameseLessonBlueprint, VietnamesePeriodBlueprint, VietnamesePeriodChunk } from "@/types/lesson";

function spellingContext() {
  const input = makeInput({ grade: "Lớp 2", lessonTitle: "Chính tả: Nghe - viết", periods: 1 });
  const ocrText = "Chính tả (nghe - viết). Tìm từ khó. Phân biệt ch/tr. Soát lỗi bài viết.";
  const classification = classifyVietnameseLesson(input, ocrText);
  return { input, ocrText, classification };
}

describe("buildVietnameseBlueprintPrompt", () => {
  it("embeds classifier result and lesson-type guidance", () => {
    const { input, ocrText, classification } = spellingContext();
    const prompt = buildVietnameseBlueprintPrompt(input, ocrText, classification);
    expect(classification.primaryType).toBe("spelling");
    expect(prompt).toContain("Kiểu bài chính: spelling");
    expect(prompt).toContain("Chính tả");
    expect(prompt).toContain("Soát lỗi");
    expect(prompt).toContain("periods phải đủ đúng 1 tiết");
    expect(prompt).toContain('"lessonType": string');
    expect(prompt).toContain('"sourceEvidence": string');
    expect(prompt).toContain('"sourceInventory"');
    expect(prompt).toContain('"punctuationSentences"');
    expect(prompt).toContain('"materialsByPeriod"');
    expect(prompt).toContain('"requiredTasks"');
    expect(prompt).toContain("dấu sao/chữ nhỏ");
  });

  it("includes grade 1-2 safeguards", () => {
    const { input, ocrText, classification } = spellingContext();
    const prompt = buildVietnameseBlueprintPrompt(input, ocrText, classification);
    expect(prompt).toContain("Điều chỉnh bắt buộc cho Lớp 1-2");
    expect(prompt).toContain("không dùng quy trình đọc hiểu lớp lớn cho bài học vần");
  });

  it("does not require reading comprehension for spelling", () => {
    const { classification } = spellingContext();
    const guidance = vietnameseLessonTypeGuidance(classification);
    expect(guidance).toContain("KHÔNG bắt buộc: đọc hiểu văn bản");
    expect(guidance).toContain("KHÔNG bắt buộc: ý chính");
  });

  it("supports mixed classification without inventing one fixed type", () => {
    const input = makeInput({ lessonTitle: "", periods: 2 });
    const classification = classifyVietnameseLesson(input, "");
    const prompt = buildVietnameseBlueprintPrompt(input, "", classification);
    expect(classification.primaryType).toBe("mixed");
    expect(prompt).toContain("Mỗi tiết trong blueprint phải được gán kiểu bài chính riêng");
    expect(prompt).toContain("periods phải đủ đúng 2 tiết");
  });

  it("includes digitalCompetencies only when enabled", () => {
    const enabled = makeInput({ grade: "Lớp 3", lessonTitle: "Bài đọc: Cây bàng", enableDigitalCompetency: true });
    const classification = classifyVietnameseLesson(enabled, "Đọc bài và tìm chi tiết trong văn bản.");
    const enabledPrompt = buildVietnameseBlueprintPrompt(enabled, "Đọc bài", classification);
    const disabledPrompt = buildVietnameseBlueprintPrompt({ ...enabled, enableDigitalCompetency: false }, "Đọc bài", classification);
    expect(enabledPrompt).toContain('"digitalCompetencies": string[]');
    expect(enabledPrompt).toContain("Chỉ đưa năng lực số khi học sinh trực tiếp thao tác");
    expect(enabledPrompt).toContain("trả về mảng rỗng");
    expect(disabledPrompt).not.toContain('"digitalCompetencies": string[]');
  });

  it("keeps SGK uncertainty internal and does not block Word export", () => {
    const { input, ocrText, classification } = spellingContext();
    const prompt = buildVietnameseBlueprintPrompt(input, ocrText, classification);
    expect(prompt).toContain("sourceInventory.uncertain");
    expect(prompt).toContain("không chặn xuất Word");
    expect(prompt).toContain("Ghi chú chuẩn bị: GV đối chiếu ảnh SGK trước giờ dạy.");
  });
});

describe("buildVietnamesePeriodPrompt", () => {
  it("locks period type, blueprint and previous handoff", () => {
    const { input, ocrText, classification } = spellingContext();
    const period: VietnamesePeriodBlueprint = {
      periodNumber: 1, focus: "Nghe - viết và soát lỗi", lessonType: "spelling",
      objectives: ["Viết đúng đoạn chính tả"], sourceEvidence: "Đoạn nghe - viết trong ảnh SGK",
      targetSkills: ["nghe - viết", "soát lỗi"], continuityIn: "Từ nhận diện từ khó",
      continuityOut: "Ghi nhớ lỗi cá nhân", activities: [],
    };
    const blueprint: VietnameseLessonBlueprint = { lessonTitle: input.lessonTitle, classification, periods: [period] };
    const prompt = buildVietnamesePeriodPrompt(input, ocrText, blueprint, period, {
      learned: "Đã nhận diện từ khó", unresolvedRisks: ["Nhầm ch/tr"], nextBridge: "Luyện nghe - viết",
    });
    expect(prompt).toContain("Kiểu bài tiết này: Chính tả");
    expect(prompt).toContain("Đã nhận diện từ khó");
    expect(prompt).toContain("Nhầm ch/tr");
    expect(prompt).toContain("Giữ mạch từ previousHandoff");
    expect(prompt).toContain("Nghe viết hoặc nhớ viết theo quy trình");
    expect(prompt).toContain("Chỉ điền supportForStudentsNeedingHelp/extensionForEarlyFinishers ở 1–2 hoạt động trọng tâm");
    expect(prompt).toContain("Hoạt động mở rộng của giáo viên");
    expect(prompt).toContain("hai lượt nghe hoặc kể mẫu");
    expect(prompt).not.toContain("Học sinh đạt chuẩn: trả lời đủ ý, có một bằng chứng");
    expect(prompt).not.toContain("cung cấp ba từ khóa");
  });

  it("uses reading-specific sequence for a reading period", () => {
    const input = makeInput({ grade: "Lớp 4", lessonTitle: "Bài đọc: Dòng sông", periods: 1 });
    const classification = classifyVietnameseLesson(input, "Đọc bài, tìm chi tiết, nêu ý chính.");
    const period: VietnamesePeriodBlueprint = { periodNumber: 1, focus: "Luyện đọc và đọc hiểu", lessonType: "reading" };
    const blueprint: VietnameseLessonBlueprint = { lessonTitle: input.lessonTitle, classification, periods: [period] };
    const prompt = buildVietnamesePeriodPrompt(input, "Đọc bài", blueprint, period, null);
    expect(prompt).toContain("Kiểu bài tiết này: Đọc (Tập đọc / Đọc hiểu)");
    expect(prompt).toContain("tìm chi tiết");
    expect(prompt).toContain("nêu ý chính");
  });
});

describe("buildVietnamesePeriodRepairPrompt", () => {
  it("repairs only the current period and preserves lesson type", () => {
    const { input, classification } = spellingContext();
    const periodBlueprint: VietnamesePeriodBlueprint = { periodNumber: 1, focus: "Nghe - viết", lessonType: "spelling" };
    const blueprint: VietnameseLessonBlueprint = { lessonTitle: input.lessonTitle, classification, periods: [periodBlueprint] };
    const period: VietnamesePeriodChunk = {
      periodNumber: 1, focus: "Nghe - viết", activities: [],
      handoff: { learned: "Đã viết bài", unresolvedRisks: [], nextBridge: "Soát lỗi" },
    };
    const prompt = buildVietnamesePeriodRepairPrompt(input, blueprint, period, ["TV-SPELL-02: Bài chính tả thiếu bước soát lỗi hoặc sửa lỗi."]);
    expect(prompt).toContain("sửa riêng tiết này");
    expect(prompt).toContain("TV-SPELL-02");
    expect(prompt).toContain("Giữ ngữ liệu và bài tập cụ thể");
    expect(prompt).toContain("không nhồi thêm kĩ năng không liên quan");
    expect(prompt).toContain("Kiểu bài: Chính tả");
    expect(prompt).toContain("không dùng các cụm");
    expect(prompt).not.toContain("ghi rõ cần GV xác minh");
  });
});
