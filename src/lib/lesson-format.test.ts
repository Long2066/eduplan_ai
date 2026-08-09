import { describe, expect, it } from "vitest";
import { activityPhaseKey, canonicalizeOrderedActivityPhases, requiredActivityPhases } from "./lesson-format";
import type { LessonActivity } from "@/types/lesson";

function activity(phase: string, title: string): LessonActivity {
  return {
    phase,
    title,
    objective: "Hoàn thành nhiệm vụ.",
    teacherActions: ["GV giao nhiệm vụ."],
    studentActions: ["HS thực hiện nhiệm vụ."],
  };
}

describe("activity phase resolution", () => {
  it("prioritizes the explicit phase over phase words in the lesson title", () => {
    expect(activityPhaseKey(activity("Luyện tập", "Cùng khám phá trường học"))).toBe("Luyện tập");
    expect(activityPhaseKey(activity("Vận dụng", "Thực hành khám phá trường em"))).toBe("Vận dụng");
  });

  it("falls back to the title only when the explicit phase is missing", () => {
    expect(activityPhaseKey(activity("", "Khám phá các khu vực trong trường"))).toBe("Khám phá");
  });

  it("canonically relabels an already ordered four-activity period without changing content", () => {
    const activities = [
      activity("Mở đầu", "Trò chơi trường em"),
      activity("Hoạt động 2", "Cùng khám phá trường học"),
      activity("Hoạt động 3", "Luyện tập với sơ đồ trường"),
      activity("Hoạt động 4", "Vận dụng điều đã học"),
    ];

    const repaired = canonicalizeOrderedActivityPhases(activities);

    expect(repaired.map((item) => item.phase)).toEqual([...requiredActivityPhases]);
    expect(repaired.map((item) => item.title)).toEqual(activities.map((item) => item.title));
  });
});
