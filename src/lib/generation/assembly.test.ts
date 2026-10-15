import { describe, expect, it } from "vitest";
import sharp from "sharp";
import type { StagedBlueprintArtifact } from "./blueprint";
import type { StagedPeriodArtifact } from "./period-generation";
import type { LessonInput, PeriodPlan } from "@/types/lesson";
import { assembleStagedLesson } from "./assembly";

function lessonInput(subject = "Toán"): LessonInput {
  return {
    subject,
    grade: "Lớp 3",
    lessonTitle: "Bài học thử nghiệm",
    book: "Kết nối tri thức",
    bookVolume: "Tập 1",
    periods: 2,
    duration: 35,
    hometownProvince: "auto",
    localityNote: "",
    studentProfile: "auto",
    teachingEnvironment: "auto",
    facilities: "auto",
    style: "Dạy thật trên lớp",
    specialRequest: "",
    allowAiInference: true,
    enableDigitalCompetency: false,
    uploadedAssets: [],
  };
}

function blueprint(
  subjectKind: StagedBlueprintArtifact["subjectKind"],
  value: StagedBlueprintArtifact["blueprint"],
  overrides: Partial<StagedBlueprintArtifact> = {},
): StagedBlueprintArtifact {
  return {
    subjectKind,
    mode: subjectKind === "default" ? "direct-generation" : "chunked",
    model: "blueprint-model",
    provider: "openai",
    fallbackUsed: false,
    promptSource: "ocr",
    blueprint: value,
    ...overrides,
  };
}

function period(
  periodNumber: number,
  subjectKind: StagedPeriodArtifact["subjectKind"] = "math",
  overrides: Partial<PeriodPlan> = {},
): StagedPeriodArtifact {
  const lessonPeriod: PeriodPlan = {
    periodNumber,
    focus: `Trọng tâm tiết ${periodNumber}`,
    outcomes: {
      generalCompetencies: ["Tự chủ"],
      specificCompetencies: [`Năng lực tiết ${periodNumber}`],
      qualities: ["Chăm chỉ"],
      knowledgeAndSkills: [`Kiến thức tiết ${periodNumber}`],
    },
    activities: [{
      phase: "Khởi động",
      title: `Hoạt động tiết ${periodNumber}`,
      objective: "Khởi động bài học",
      teacherActions: ["GV giao nhiệm vụ"],
      studentActions: ["HS thực hiện nhiệm vụ"],
    }],
    handoff: {
      learned: `Đã học tiết ${periodNumber}`,
      unresolvedRisks: [],
      nextBridge: `Chuẩn bị sau tiết ${periodNumber}`,
    },
    ...overrides,
  };
  return {
    subjectKind,
    periodNumber,
    model: periodNumber === 2 ? "fallback-model" : "detail-model",
    provider: periodNumber === 2 ? "openrouter" : "openai",
    fallbackUsed: periodNumber === 2,
    period: lessonPeriod,
    handoff: lessonPeriod.handoff || null,
  };
}

describe("staged lesson assembly", () => {
  it("uses one source-truth title for every period even when the blueprint is generic", async () => {
    const input = { ...lessonInput("Khoa học"), lessonTitle: "" };
    const sourceTitle = "Bài 2. Ô nhiễm, xói mòn đất và bảo vệ môi trường đất";
    const result = await assembleStagedLesson(
      input,
      blueprint("natural-social", {
        lessonTitle: "Bài học Khoa học",
        outcomes: { knowledgeAndSkills: ["Thực hiện nhiệm vụ khoa học"] },
        materials: { teacher: ["Bảng phụ"], students: ["Bảng con"] },
        assessment: { criteria: ["Hoàn thành"] },
        contextFit: { notes: ["Phù hợp lớp học"] },
        continuityPlan: { sourceUnits: [], clusters: [] },
        periods: [],
      }, {
        sourceTruth: {
          version: 1,
          subject: "Khoa học",
          grade: "Lớp 3",
          lessonTitle: sourceTitle,
          periods: 2,
          sourceHashes: [],
          ocrExcerpt: "",
          pageNumbers: [],
          titleCandidates: [sourceTitle],
          lessonIdentity: { status: "resolved", title: sourceTitle, source: "ocr-heading", confidence: 0.98, reason: "OCR", evidence: [sourceTitle] },
          tasks: [],
          visuals: [],
          uncertain: [],
        },
      }),
      [period(2, "natural-social"), period(1, "natural-social")],
      "plus",
    );

    expect(result.periodCount).toBe(2);
    expect(result.lesson.generalInfo).toMatchObject({
      subject: "Khoa học",
      lessonTitle: sourceTitle,
      book: "Kết nối tri thức - Tập 1",
      periods: 2,
    });
    expect(result.lesson.periodPlans?.map((item) => item.periodNumber)).toEqual([1, 2]);
    expect(result.lesson.activities.map((item) => item.title)).toEqual([
      "Hoạt động tiết 1",
      "Hoạt động tiết 2",
    ]);
    expect(result.lesson.outcomes.knowledgeAndSkills).toEqual([
      "Thực hiện nhiệm vụ khoa học",
      "Kiến thức tiết 1",
      "Kiến thức tiết 2",
    ]);
    expect(result.lesson.materials).toEqual({ teacher: ["Bảng phụ"], students: ["Bảng con"] });
    expect(result.lesson.assessment.criteria).toEqual(["Hoàn thành"]);
    expect(result.lesson.contextFit.notes).toContain("Tiết 1: Chuẩn bị sau tiết 1");
    expect(result.lesson.meta).toMatchObject({ plan: "plus", modelUsed: "fallback-model" });
    expect(result.models).toEqual(["blueprint-model", "detail-model", "fallback-model"]);
    expect(result.providers).toEqual(["openai", "openrouter"]);
    expect(result.fallbackUsed).toBe(true);
  });

  it("preserves Vietnamese source inventory metadata", async () => {
    const sourceInventory = { readingText: ["Bài đọc"] };
    const result = await assembleStagedLesson(
      lessonInput("Tiếng Việt"),
      blueprint("vietnamese", { periods: [] }, { sourceInventory }),
      [period(1, "vietnamese"), period(2, "vietnamese")],
      "free",
    );

    expect(result.lesson.meta.vietnameseSourceInventory).toEqual(sourceInventory);
    expect(result.lesson.materials.teacher).toContain("Bảng phụ, thẻ từ hoặc phiếu học tập");
    expect(result.lesson.meta.naturalSocialSourceInventory).toBeUndefined();
  });

  it("attaches SGK crop visuals when uploadedAssets are provided for Vietnamese lesson", async () => {
    const testSvg = Buffer.from(
      '<svg width="600" height="800"><rect width="600" height="800" fill="#f8fafc"/></svg>',
    );
    const testBuffer = await sharp(testSvg).png().toBuffer();
    const dataUrl = `data:image/png;base64,${testBuffer.toString("base64")}`;
    const input: LessonInput = {
      ...lessonInput("Tiếng Việt"),
      grade: "Lớp 1",
      lessonTitle: "Bài 31. an ăn ân",
      uploadedAssets: [
        { id: "p1", name: "SGK_Trang_74.png", type: "image", dataUrl },
      ],
    };
    const period1 = period(1, "vietnamese", {
      activities: [
        {
          phase: "Khởi động",
          title: "Khởi động: Nhận biết qua tranh",
          objective: "Nhận biết vần",
          teacherActions: ["GV chiếu tranh"],
          studentActions: ["HS quan sát"],
        },
      ],
    });
    const period2 = period(2, "vietnamese");

    const result = await assembleStagedLesson(
      input,
      blueprint("vietnamese", { periods: [] }),
      [period1, period2],
      "free",
    );

    const act1 = result.lesson.activities[0];
    expect(act1.teacherVisuals).toBeDefined();
    expect(act1.teacherVisuals?.[0].caption).toContain("SGK");
  });

  it("preserves Natural and Social Studies metadata and context guardrails", async () => {
    const sourceInventory = { safetyConstraints: ["Quan sát an toàn"] };
    const result = await assembleStagedLesson(
      lessonInput("Tự nhiên và Xã hội"),
      blueprint("natural-social", {
        naturalSocialCore: {
          safetyNotes: ["Không dùng vật sắc nhọn"],
          localConnectionRules: ["Chỉ dùng ví dụ đã xác minh"],
        },
        periods: [],
      }, { sourceInventory }),
      [period(1, "natural-social"), period(2, "natural-social")],
      "free",
    );

    expect(result.lesson.meta.naturalSocialSourceInventory).toMatchObject(sourceInventory);
    expect(result.lesson.meta.naturalSocialSourceInventory?.visuals).toEqual([]);
    expect(result.lesson.meta.naturalSocialSourceInventory?.requiredTasks).toEqual([]);
    expect(result.lesson.contextFit.notes).toContain("Lưu ý an toàn: Không dùng vật sắc nhọn");
    expect(result.lesson.contextFit.notes).toContain("Địa phương hóa: Chỉ dùng ví dụ đã xác minh");
  });

  it("assembles default subjects with structural fallback materials", async () => {
    const input = lessonInput("Đạo đức");
    const result = await assembleStagedLesson(
      input,
      blueprint("default", { subject: "Đạo đức", lessonTitle: "Bài 3. Quan tâm hàng xóm láng giềng", periods: 2, directGeneration: true }),
      [period(1, "default"), period(2, "default")],
      "free",
    );

    expect(result.subjectKind).toBe("default");
    expect(result.lesson.generalInfo.subject).toBe("Đạo đức");
    expect(result.lesson.materials.teacher).toEqual([
      "Ảnh SGK/tranh minh họa bài học",
      "Bảng phụ hoặc phiếu học tập",
    ]);
    expect(result.lesson.periodPlans).toHaveLength(2);
  });

  it("rejects missing, duplicate, mismatched, or empty period artifacts", async () => {
    const input = lessonInput();
    const mathBlueprint = blueprint("math", { periods: [] });

    await expect(assembleStagedLesson(input, mathBlueprint, [period(1)], "free"))
      .rejects.toThrow("cần đủ 2 tiết");
    await expect(assembleStagedLesson(input, mathBlueprint, [period(1), period(1)], "free"))
      .rejects.toThrow("periodNumber 1 bị trùng");
    await expect(assembleStagedLesson(input, mathBlueprint, [period(1), period(2, "vietnamese")], "free"))
      .rejects.toThrow("không khớp môn học");
    await expect(assembleStagedLesson(
      input,
      mathBlueprint,
      [period(1), period(2, "math", { activities: [] })],
      "free",
    )).rejects.toThrow("tiết 2 chưa có hoạt động");
  });

  it("rejects an assembly whose only title is a subject placeholder", async () => {
    const input = { ...lessonInput("Toán"), lessonTitle: "Bài học Toán" };
    const genericBlueprint = blueprint("math", { lessonTitle: "Bài học Toán", periods: [] });
    await expect(assembleStagedLesson(input, genericBlueprint, [period(1), period(2)], "free"))
      .rejects.toThrow("Không xác định được tên bài");
  });

  it("enriches digital competencies and digital activity when enableDigitalCompetency is true", async () => {
    const input: LessonInput = {
      ...lessonInput("Tiếng Việt"),
      enableDigitalCompetency: true,
      lessonTitle: "Bài 31. an ăn ân",
    };
    const bp = blueprint("vietnamese", { lessonTitle: "Bài 31. an ăn ân", periods: [] });
    const p1 = period(1, "vietnamese", {
      activities: [
        {
          phase: "Vận dụng",
          title: "Vận dụng: Đọc và chia sẻ",
          objective: "Vận dụng kiến thức",
          teacherActions: ["GV giao nhiệm vụ"],
          studentActions: ["HS thực hiện"],
        },
      ],
    });
    const p2 = period(2, "vietnamese");

    const result = await assembleStagedLesson(input, bp, [p1, p2], "free");

    expect(result.lesson.outcomes.digitalCompetencies).toBeDefined();
    expect(result.lesson.outcomes.digitalCompetencies?.length).toBeGreaterThan(0);
    expect(result.lesson.outcomes.digitalCompetencies?.[0]).toContain("Năng lực số");

    const allActivities = result.lesson.activities;
    const hasDigital = allActivities.some((act) =>
      act.studentActions.some((sa) => /công cụ số|học liệu số|thao tác/i.test(sa))
    );
    expect(hasDigital).toBe(true);
  });
});
