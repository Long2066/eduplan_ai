import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Packer } from "docx";
import JSZip from "jszip";
import { LessonPreview } from "@/components/lesson-preview";
import { buildLessonDocxDocument } from "./export-docx";
import { LessonTitleResolutionError } from "./lesson-title";
import { makeLesson } from "./vietnamese-fixtures";
import type { LessonPlan, PeriodPlan } from "@/types/lesson";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

const canonicalHeading = "BÀI 2. Ô NHIỄM, XÓI MÒN ĐẤT VÀ BẢO VỆ MÔI TRƯỜNG ĐẤT";

function lessonWithTitle(lessonTitle: string): LessonPlan {
  const base = makeLesson({
    generalInfo: {
      subject: "Khoa học",
      grade: "Lớp 5",
      lessonTitle,
      book: "Kết nối tri thức",
      periods: 2,
      duration: 35,
    },
  });
  const period = (periodNumber: number): PeriodPlan => ({
    periodNumber,
    focus: `Trọng tâm tiết ${periodNumber}`,
    outcomes: base.outcomes,
    activities: base.activities,
  });
  return { ...base, periodPlans: [period(1), period(2)] };
}

async function documentXml(lesson: LessonPlan) {
  const packed = await Packer.toBuffer(buildLessonDocxDocument(lesson));
  const zip = await JSZip.loadAsync(packed);
  return zip.file("word/document.xml")?.async("string") ?? "";
}

function occurrences(value: string, search: string) {
  return value.split(search).length - 1;
}

describe("Preview and DOCX lesson-title parity", () => {
  it("renders the same canonical Khoa học heading and distinct period labels", async () => {
    const lesson = lessonWithTitle("Bài 2 – Ô nhiễm, xói mòn đất và bảo vệ môi trường đất");

    const preview = renderToStaticMarkup(<LessonPreview lesson={lesson} />);
    const xml = await documentXml(lesson);

    expect(occurrences(preview, canonicalHeading)).toBe(2);
    expect(preview).toContain("(TIẾT 1)");
    expect(preview).toContain("(TIẾT 2)");
    expect(occurrences(xml, canonicalHeading)).toBe(2);
    expect(xml).toContain("(TIẾT 1)");
    expect(xml).toContain("(TIẾT 2)");
    expect(preview).not.toContain("BÀI HỌC KHOA HỌC");
    expect(xml).not.toContain("BÀI HỌC KHOA HỌC");
  });

  it("warns in Preview but rejects Word export for a generic legacy title", () => {
    const legacyLesson = lessonWithTitle("Bài học Khoa học");
    const preview = renderToStaticMarkup(<LessonPreview lesson={legacyLesson} />);

    expect(preview).toContain("Tên bài của giáo án cũ chưa cụ thể");
    expect(() => buildLessonDocxDocument(legacyLesson)).toThrow(LessonTitleResolutionError);
  });
});
