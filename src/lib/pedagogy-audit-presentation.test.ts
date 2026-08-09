import { describe, expect, it } from "vitest";
import type { PedagogyAudit } from "@/types/lesson";
import {
  auditPeriodPresentations,
  confidenceLabel,
  groupAuditIssues,
  isUncertainVietnameseAudit,
  lessonTypeLabel,
  visibleAuditChecks,
} from "./pedagogy-audit-presentation";

function makeAudit(overrides: Partial<PedagogyAudit> = {}): PedagogyAudit {
  return {
    subject: "Tiếng Việt",
    grade: "Lớp 4",
    status: "passed",
    issues: [],
    checks: [],
    repairApplied: false,
    checkedAt: "2026-07-24T00:00:00.000Z",
    ...overrides,
  };
}

describe("pedagogy audit presentation", () => {
  it.each([
    ["phonics", "Học âm – vần – chữ"],
    ["reading", "Đọc / Đọc hiểu"],
    ["handwriting", "Tập viết"],
    ["spelling", "Chính tả"],
    ["composition", "Viết đoạn – bài"],
    ["language-knowledge", "Luyện từ và câu"],
    ["speaking-listening", "Nói và nghe"],
    ["mixed", "Bài học tích hợp"],
  ])("maps %s to a Vietnamese teacher-facing label", (type, label) => {
    expect(lessonTypeLabel(type)).toBe(label);
  });

  it("maps classifier confidence to teacher-facing labels", () => {
    expect(confidenceLabel("high")).toBe("Tin cậy cao");
    expect(confidenceLabel("medium")).toBe("Tin cậy vừa");
    expect(confidenceLabel("low")).toBe("Cần đối chiếu");
    expect(confidenceLabel(undefined)).toBeNull();
  });

  it("groups issues by period and deduplicates messages", () => {
    const groups = groupAuditIssues([
      "Tiết 2: TV-WRITE-02: Thiếu bước chỉnh sửa.",
      "TV-UNI-01: Thiếu ngữ liệu.",
      "Tiết 1: TV-READ-02: Thiếu bằng chứng.",
      "Tiết 1: TV-READ-02: Thiếu bằng chứng.",
    ]);
    expect(groups).toEqual([
      { label: "Toàn bài", periodNumber: undefined, issues: ["TV-UNI-01: Thiếu ngữ liệu."] },
      { label: "Tiết 1", periodNumber: 1, issues: ["TV-READ-02: Thiếu bằng chứng."] },
      { label: "Tiết 2", periodNumber: 2, issues: ["TV-WRITE-02: Thiếu bước chỉnh sửa."] },
    ]);
  });

  it("uses dynamic period checklists and removes internal checkbox/type lines", () => {
    const audit = makeAudit({
      lessonType: "mixed",
      periodTypes: ["reading", "composition"],
      periodChecks: [
        { periodNumber: 1, lessonType: "reading", checks: ["Kiểu bài: Đọc (high)", "☐ Luyện đọc", "☐ Tìm bằng chứng"] },
        { periodNumber: 2, lessonType: "composition", checks: ["Kiểu bài: Viết (high)", "☐ Tìm ý", "☐ Đọc soát"] },
      ],
    });
    expect(auditPeriodPresentations(audit)).toEqual([
      { periodNumber: 1, lessonType: "reading", lessonTypeLabel: "Đọc / Đọc hiểu", checks: ["Luyện đọc", "Tìm bằng chứng"] },
      { periodNumber: 2, lessonType: "composition", lessonTypeLabel: "Viết đoạn – bài", checks: ["Tìm ý", "Đọc soát"] },
    ]);
  });

  it("falls back safely to periodTypes for older audit metadata", () => {
    const periods = auditPeriodPresentations(makeAudit({ periodTypes: ["spelling"] }));
    expect(periods).toEqual([{ periodNumber: 1, lessonType: "spelling", lessonTypeLabel: "Chính tả", checks: [] }]);
  });

  it("keeps old subject audits safe without classification metadata", () => {
    const audit = makeAudit({ subject: "Toán", lessonType: undefined, periodTypes: undefined, periodChecks: undefined });
    expect(auditPeriodPresentations(audit)).toEqual([]);
    expect(isUncertainVietnameseAudit(audit)).toBe(false);
    expect(visibleAuditChecks(["Tiêu chí chung"])).toEqual(["Tiêu chí chung"]);
  });

  it("shows uncertainty only for low confidence or mixed Vietnamese audits", () => {
    expect(isUncertainVietnameseAudit(makeAudit({ lessonType: "reading", classificationConfidence: "high" }))).toBe(false);
    expect(isUncertainVietnameseAudit(makeAudit({ lessonType: "reading", classificationConfidence: "low" }))).toBe(true);
    expect(isUncertainVietnameseAudit(makeAudit({ lessonType: "mixed", classificationConfidence: "medium" }))).toBe(true);
  });
});
