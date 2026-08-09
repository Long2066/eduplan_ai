import { describe, expect, it } from "vitest";
import {
  buildMathContinuityPlan,
  buildNaturalSocialContinuityPlan,
  buildVietnameseContinuityPlan,
  normalizeLessonContinuityPlan,
  validateContinuityPlan,
  validateLessonContinuity,
} from "@/lib/lesson-continuity";
import type { LessonActivity, LessonPlan } from "@/types/lesson";

function activity(overrides: Partial<LessonActivity> = {}): LessonActivity {
  return {
    phase: "Khám phá",
    title: "Tìm hiểu",
    objective: "Xác định được nội dung trọng tâm.",
    durationMinutes: 15,
    teacherActions: ["GV giao nhiệm vụ cụ thể."],
    studentActions: ["HS thực hiện nhiệm vụ."],
    learningProducts: ["Câu trả lời."],
    successCriteria: ["Hoàn thành đúng yêu cầu."],
    ...overrides,
  };
}

function lesson(periodActivities: LessonActivity[][]): LessonPlan {
  return {
    generalInfo: { subject: "Tiếng Việt", grade: "Lớp 3", lessonTitle: "Bài đọc", periods: periodActivities.length, duration: 35 },
    outcomes: { generalCompetencies: [], specificCompetencies: [], qualities: [], knowledgeAndSkills: [] },
    materials: { teacher: [], students: [] },
    activities: periodActivities.flat(),
    periodPlans: periodActivities.map((activities, index) => ({
      periodNumber: index + 1,
      focus: `Tiết ${index + 1}`,
      activities,
      handoff: index < periodActivities.length - 1
        ? { learned: `Kết quả tiết ${index + 1}`, nextBridge: `Chuẩn bị tiết ${index + 2}`, unresolvedRisks: [] }
        : undefined,
    })),
    assessment: { criteria: [], evidence: [], comments: [] },
    adjustments: { suitablePoints: [], pointsToAdjust: [], nextLessonDirection: [] },
    contextFit: { notes: [] },
    meta: { style: "Dạy thật trên lớp", modelUsed: "test", createdAt: new Date(0).toISOString() },
  };
}

describe("lesson continuity", () => {
  it("normalizes stable source and cluster identifiers", () => {
    const plan = normalizeLessonContinuityPlan({
      sourceUnits: [{ unitId: "task 1", label: "Câu hỏi 1", periodNumber: 1 }],
      clusters: [{ clusterId: "group 1", label: "Đọc hiểu", sourceUnitIds: ["task-1"], periodNumber: 1 }],
    }, 2);

    expect(plan?.sourceUnits[0]?.unitId).toBe("task-1");
    expect(plan?.clusters[0]?.clusterId).toBe("group-1");
  });

  it("builds Vietnamese fallback clusters from required tasks", () => {
    const plan = buildVietnameseContinuityPlan({
      requiredTasks: [{ label: "Trả lời câu hỏi 1", taskType: "reading-question", periodNumber: 1, required: true }],
    }, 2);

    expect(plan?.sourceUnits[0]?.unitId).toBe("tv-task-1");
    expect(plan?.clusters[0]?.periodNumber).toBe(1);
    expect(validateContinuityPlan(plan, { periods: 2, duration: 35 })).toEqual([]);
  });

  it("allows a TNXH visual to be reused by multiple task clusters", () => {
    const plan = buildNaturalSocialContinuityPlan({
      visuals: [{ visualId: "visual-1", label: "Tranh cây", required: true }],
      questions: [
        { taskId: "q1", question: "Cây có bộ phận nào?", visualIds: ["visual-1"], periodNumber: 1, required: true },
        { taskId: "q2", question: "Bộ phận nào giúp cây hút nước?", visualIds: ["visual-1"], periodNumber: 1, required: true },
      ],
    }, 1);

    expect(validateContinuityPlan(plan, { periods: 1, duration: 35 }).map((item) => item.code)).not.toContain("LC-PLAN-03");
  });

  it("does not treat a reusable TNXH visual as a cluster split", () => {
    const plan = normalizeLessonContinuityPlan({
      sourceUnits: [
        { unitId: "visual-1", label: "Tranh cây", allowReuse: true },
        { unitId: "question-1", label: "Câu hỏi tiết 1" },
        { unitId: "question-2", label: "Câu hỏi tiết 2" },
      ],
      clusters: [
        { clusterId: "cluster-1", label: "Quan sát", sourceUnitIds: ["visual-1", "question-1"], periodNumber: 1 },
        { clusterId: "cluster-2", label: "Giải thích", sourceUnitIds: ["visual-1", "question-2"], periodNumber: 2 },
      ],
    }, 2);
    const value = lesson([
      [activity({ sourceUnitIds: ["visual-1", "question-1"], sourceClusterIds: ["cluster-1"] })],
      [activity({ sourceUnitIds: ["visual-1", "question-2"], sourceClusterIds: ["cluster-2"] })],
    ]);
    value.meta.continuityPlan = plan;

    expect(validateLessonContinuity(value, { periods: 2, duration: 35 }).map((item) => item.code)).not.toContain("LC-COVERAGE-03");
  });

  it("detects a must-stay-together cluster split across periods", () => {
    const plan = normalizeLessonContinuityPlan({
      sourceUnits: [
        { unitId: "read", label: "Đọc văn bản" },
        { unitId: "question", label: "Câu hỏi đọc hiểu" },
      ],
      clusters: [{ clusterId: "reading", label: "Mạch đọc hiểu", sourceUnitIds: ["read", "question"], mustStayTogether: true }],
    }, 2);
    const value = lesson([
      [activity({ sourceUnitIds: ["read"], sourceClusterIds: ["reading"] })],
      [activity({ sourceUnitIds: ["question"], sourceClusterIds: ["reading"] })],
    ]);
    value.meta.continuityPlan = plan;

    expect(validateLessonContinuity(value, { periods: 2, duration: 35 }).map((item) => item.code)).toContain("LC-COVERAGE-03");
  });

  it("detects missing required source evidence and missing handoff", () => {
    const plan = normalizeLessonContinuityPlan({
      sourceUnits: [{ unitId: "task-1", label: "Bài tập bắt buộc", preferredPeriodNumber: 1 }],
      clusters: [{ clusterId: "cluster-1", label: "Bài tập", sourceUnitIds: ["task-1"], periodNumber: 1 }],
    }, 2);
    const value = lesson([[activity()], [activity()]]);
    value.periodPlans![0]!.handoff = undefined;
    value.meta.continuityPlan = plan;

    const codes = validateLessonContinuity(value, { periods: 2, duration: 35 }).map((item) => item.code);
    expect(codes).toContain("LC-COVERAGE-01");
    expect(codes).toContain("LC-HANDOFF-01");
  });

  it("builds a deterministic Math fallback from period math focuses", () => {
    const plan = buildMathContinuityPlan([{
      periodNumber: 1,
      focus: "Phép cộng",
      activities: [{ phase: "Khám phá", mathFocus: "Hình thành phép cộng", durationMinutes: 15 }],
    }], 1);

    expect(plan?.sourceUnits[0]?.unitId).toBe("math-p1-a1");
    expect(plan?.clusters[0]?.periodNumber).toBe(1);
  });

  it("keeps an explicit Math continuity plan without adding synthetic duplicate units", () => {
    const plan = buildMathContinuityPlan([{
      periodNumber: 1,
      focus: "Phép cộng",
      activities: [{
        phase: "Khám phá",
        mathFocus: "Hình thành phép cộng",
        durationMinutes: 15,
        sourceUnitIds: ["example-1"],
        sourceClusterIds: ["addition-flow"],
      }],
    }], 1, {
      sourceUnits: [{ unitId: "example-1", label: "Ví dụ phép cộng" }],
      clusters: [{ clusterId: "addition-flow", label: "Mạch phép cộng", sourceUnitIds: ["example-1"], periodNumber: 1 }],
    });

    expect(plan?.sourceUnits.map((unit) => unit.unitId)).toEqual(["example-1"]);
    expect(plan?.clusters.map((cluster) => cluster.clusterId)).toEqual(["addition-flow"]);
  });
});
