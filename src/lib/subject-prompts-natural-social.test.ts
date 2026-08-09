import { describe, expect, it } from "vitest";
import {
  buildNaturalSocialBlueprintPrompt,
  buildNaturalSocialPeriodPrompt,
  buildNaturalSocialPeriodRepairPrompt,
  naturalSocialLessonTypeGuidance,
} from "./subject-prompts";
import { classifyNaturalSocialLesson } from "./natural-social-pedagogy";
import { makeInput } from "./vietnamese-fixtures";
import type { NaturalSocialLessonBlueprint, NaturalSocialPeriodBlueprint, NaturalSocialPeriodChunk } from "@/types/lesson";

function plantsContext() {
  const input = makeInput({
    subject: "Tự nhiên và Xã hội",
    grade: "Lớp 2",
    lessonTitle: "Chăm sóc cây trồng",
    periods: 1,
  });
  const ocrText = "Quan sát cây trong tranh. Bộ phận của cây: rễ, thân, lá. Việc nên làm để chăm sóc và bảo vệ cây.";
  const classification = classifyNaturalSocialLesson(input, ocrText);
  return { input, ocrText, classification };
}

describe("buildNaturalSocialBlueprintPrompt", () => {
  it("embeds classifier result and naturalSocialCore schema", () => {
    const { input, ocrText, classification } = plantsContext();
    const prompt = buildNaturalSocialBlueprintPrompt(input, ocrText, classification);

    expect(classification.primaryType).toBe("plants-animals");
    expect(prompt).toContain("Chủ đề chính: plants-animals");
    expect(prompt).toContain('"sourceInventory"');
    expect(prompt).toContain('"practiceTasks"');
    expect(prompt).toContain('"specificName"');
    expect(prompt).toContain('"habitatPlace"');
    expect(prompt).toContain('"environmentCategory"');
    expect(prompt).toContain('"naturalSocialCore"');
    expect(prompt).toContain('"observationObjects": string[]');
    expect(prompt).toContain('"evidenceToCollect": string[]');
    expect(prompt).toContain('"comparisonOrClassificationCriteria": string[]');
    expect(prompt).toContain("Không bịa dữ liệu địa phương");
    expect(prompt).toContain("periods phải đủ đúng 1 tiết");
  });

  it("includes grade 1-2 safeguards and safety rules", () => {
    const { input, ocrText, classification } = plantsContext();
    const prompt = buildNaturalSocialBlueprintPrompt(input, ocrText, classification);

    expect(prompt).toContain("Điều chỉnh bắt buộc cho Lớp 1-2");
    expect(prompt).toContain("không cho HS nếm/ngửi/chạm vật lạ");
    expect(prompt).toContain("tranh SGK, vật thật an toàn, mô hình");
  });

  it("provides lesson-type guidance", () => {
    const { classification } = plantsContext();
    const guidance = naturalSocialLessonTypeGuidance(classification);

    expect(guidance).toContain("Thực vật và động vật");
    expect(guidance).toContain("Quan sát tranh, vật thật");
    expect(guidance).toContain("Bảng phân loại theo tiêu chí");
  });
});

describe("buildNaturalSocialPeriodPrompt", () => {
  it("locks blueprint, period and inquiry rules", () => {
    const { input, ocrText, classification } = plantsContext();
    const period: NaturalSocialPeriodBlueprint = {
      periodNumber: 1,
      focus: "Quan sát và chăm sóc cây",
      lessonType: "plants-animals",
      observationTargets: ["Cây thật an toàn", "Tranh SGK"],
      inquiryQuestion: "Cây có những bộ phận nào và cần gì để sống tốt?",
      evidencePlan: "Phiếu quan sát cây",
      comparisonCriteria: ["Bộ phận cây", "Việc nên làm/chưa nên làm"],
      actionFocus: "Chăm sóc và bảo vệ cây ở lớp/nhà",
    };
    const blueprint: NaturalSocialLessonBlueprint = {
      lessonTitle: input.lessonTitle,
      classification,
      naturalSocialCore: {
        topic: "Chăm sóc cây",
        domain: "Thực vật và động vật",
        observationObjects: ["Cây thật an toàn", "Tranh SGK"],
        inquiryQuestions: [period.inquiryQuestion || ""],
        evidenceToCollect: ["Phiếu quan sát cây"],
        comparisonOrClassificationCriteria: ["Bộ phận cây", "Việc nên làm/chưa nên làm"],
        actionApplications: ["Chăm sóc và bảo vệ cây"],
        safetyNotes: ["Không nếm, ngửi trực tiếp lá/cây."],
        localConnectionRules: ["Dùng cây quen thuộc ở lớp/nhà."],
      },
      periods: [period],
    };
    const prompt = buildNaturalSocialPeriodPrompt(input, ocrText, blueprint, period, {
      learned: "Đã nhận biết tranh/cây",
      unresolvedRisks: ["Phân loại theo sở thích"],
      nextBridge: "Chuyển sang quan sát chi tiết",
    });

    expect(prompt).toContain("Chủ đề tiết này: Thực vật và động vật");
    expect(prompt).toContain("Đã nhận biết tranh/cây");
    expect(prompt).toContain("Tiết 35 phút chỉ ghi tổng durationMinutes 32-33 phút");
    expect(prompt).toContain("sourceTaskIds/sourceVisualIds/coveragePurpose");
    expect(prompt).toContain("Khởi động được phép dùng học liệu ngoài SGK");
    expect(prompt).toContain("không được gọi nhầm là tranh SGK");
    expect(prompt).toContain("Khám phá bắt buộc có quan sát");
    expect(prompt).toContain('"successCriteria": string[]');
    expect(prompt).toContain("supportForStudentsNeedingHelp");
    expect(prompt).toContain("Khởi động do hệ thống chọn sẵn bằng code");
    expect(prompt).toContain("Học liệu gợi mở ngoài SGK");
    expect(prompt).toContain("không gọi nhầm là tranh SGK");
  });
});

describe("buildNaturalSocialPeriodRepairPrompt", () => {
  it("asks repair to restore observation-evidence-action flow", () => {
    const { input, classification } = plantsContext();
    const periodBlueprint: NaturalSocialPeriodBlueprint = { periodNumber: 1, focus: "Quan sát cây", lessonType: "plants-animals" };
    const blueprint: NaturalSocialLessonBlueprint = { lessonTitle: input.lessonTitle, classification, periods: [periodBlueprint] };
    const period: NaturalSocialPeriodChunk = {
      periodNumber: 1,
      focus: "Quan sát cây",
      activities: [],
      handoff: { learned: "Chưa có", unresolvedRisks: [], nextBridge: "Bổ sung quan sát" },
    };
    const prompt = buildNaturalSocialPeriodRepairPrompt(input, blueprint, period, ["NSXH-QUALITY-01: thiếu hoạt động quan sát"]);

    expect(prompt).toContain("sửa riêng tiết này");
    expect(prompt).toContain("NSXH-QUALITY-01");
    expect(prompt).toContain("đối tượng quan sát cụ thể");
    expect(prompt).toContain("bằng chứng học tập");
    expect(prompt).toContain("Không bịa dữ liệu địa phương");
    expect(prompt).toContain("Chủ đề: Thực vật và động vật");
  });
});
