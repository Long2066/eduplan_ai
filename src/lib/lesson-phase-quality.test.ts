import { describe, expect, it } from "vitest";
import {
  buildPhaseQualityPromptBlock,
  canonicalLessonPhase,
  isLessonPhase,
  lessonPhaseOrder,
  phaseIssuePolicyFor,
  phaseQualityStandards,
  phaseRepairablePedagogySignals,
  phaseStandardFor,
  phaseStructuralFatalSignals,
} from "@/lib/lesson-phase-quality";
import { requiredActivityPhases, phaseKey } from "@/lib/lesson-format";

describe("lesson phase quality standard", () => {
  it("defines the required phase order once for lesson formatting", () => {
    expect(lessonPhaseOrder).toEqual(["Khởi động", "Khám phá", "Luyện tập", "Vận dụng"]);
    expect(requiredActivityPhases).toBe(lessonPhaseOrder);
  });

  it("canonicalizes Vietnamese phase names and common aliases", () => {
    expect(canonicalLessonPhase("Hoạt động 1: Khởi động")).toBe("Khởi động");
    expect(canonicalLessonPhase("kham pha kiến thức mới")).toBe("Khám phá");
    expect(canonicalLessonPhase("Hình thành kiến thức")).toBe("Khám phá");
    expect(canonicalLessonPhase("Thực hành theo nhóm")).toBe("Luyện tập");
    expect(canonicalLessonPhase("van dung vào đời sống")).toBe("Vận dụng");
    expect(canonicalLessonPhase("Củng cố")).toBe("");
    expect(phaseKey("Hình thành kiến thức")).toBe("Khám phá");
  });

  it("captures phase essence for discovery, practice and application", () => {
    expect(phaseQualityStandards["Khám phá"].requiredSignals.join(" ")).toMatch(/nguồn|bằng chứng|thao tác|chốt/i);
    expect(`${phaseQualityStandards["Luyện tập"].role} ${phaseQualityStandards["Luyện tập"].successDefinition}`).toContain("vừa được hình thành");
    expect(phaseQualityStandards["Vận dụng"].requiredSignals.join(" ")).toMatch(/đời sống|sản phẩm|hành động/i);
    expect(phaseQualityStandards["Vận dụng"].antiPatterns.join(" ")).toContain("em sẽ cố gắng");
  });

  it("separates fatal structure failures from repairable pedagogy failures", () => {
    expect(phaseStructuralFatalSignals.join(" ")).toMatch(/Sai môn học|JSON hỏng|thiếu pha/i);
    expect(phaseRepairablePedagogySignals.join(" ")).toMatch(/Khám phá chưa đủ sáng tạo|Vận dụng còn chung chung/i);
    expect(phaseIssuePolicyFor("Khám phá")).toBe("repairable_pedagogy");
    expect(phaseIssuePolicyFor("Không rõ")).toBeUndefined();
  });

  it("provides prompt-ready guidance for later generation phases", () => {
    const promptBlock = buildPhaseQualityPromptBlock();
    expect(promptBlock).toContain("CHUẨN VAI TRÒ 4 PHA");
    expect(promptBlock).toContain("Khám phá");
    expect(promptBlock).toContain("Luyện tập");
    expect(promptBlock).toContain("Vận dụng");
    expect(promptBlock).toContain("không gọi là đạt kiểm tra cuối");
  });

  it("exposes safe lookup helpers", () => {
    expect(isLessonPhase("Khởi động")).toBe(true);
    expect(isLessonPhase("Củng cố")).toBe(false);
    expect(phaseStandardFor("vận dụng thực tế")?.phase).toBe("Vận dụng");
  });
});
