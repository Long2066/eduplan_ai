import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LessonInput } from "@/types/lesson";

const cacheMocks = vi.hoisted(() => ({
  readVietnameseSourceInventory: vi.fn(),
  readNaturalSocialSourceInventory: vi.fn(),
}));
vi.mock("@/lib/vietnamese-source-inventory-store", () => ({
  readVietnameseSourceInventory: cacheMocks.readVietnameseSourceInventory,
}));
vi.mock("@/lib/natural-social-source-inventory-store", () => ({
  readNaturalSocialSourceInventory: cacheMocks.readNaturalSocialSourceInventory,
}));

import { prepareStagedSourceContext } from "./source-preparation";

function lessonInput(subject: string): LessonInput {
  return {
    subject,
    grade: "Lớp 3",
    lessonTitle: "Bài học",
    book: "Kết nối tri thức",
    bookVolume: "auto",
    periods: 1,
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

describe("staged source preparation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("loads the existing Vietnamese verified source cache", async () => {
    cacheMocks.readVietnameseSourceInventory.mockResolvedValue({
      lessonKey: "lesson-key",
      verifiedStatus: "verified",
      sourceHashes: ["old-hash"],
      inventory: { readingText: ["Đoạn đọc"] },
    });
    const result = await prepareStagedSourceContext(
      lessonInput("Tiếng Việt"),
      ["new-hash"],
      "Bài 4. Đọc đoạn văn và trả lời câu hỏi: Vì sao bạn nhỏ vui?",
    );
    expect(result).toMatchObject({
      subjectKind: "vietnamese",
      ocrSourceHashes: ["new-hash"],
      vietnamese: { lessonKey: "lesson-key", inventory: { readingText: ["Đoạn đọc"] } },
    });
    expect(result.sourceTruth).toMatchObject({
      version: 1,
      subject: "Tiếng Việt",
      sourceHashes: ["new-hash"],
    });
    expect(result.sourceTruth.tasks.some((task) => task.source === "ocr" && task.label.includes("trả lời câu hỏi"))).toBe(true);
  });

  it("keeps cache failures retry-safe as warnings", async () => {
    cacheMocks.readNaturalSocialSourceInventory.mockRejectedValue(new Error("cache unavailable"));
    const result = await prepareStagedSourceContext(lessonInput("Tự nhiên và Xã hội"), []);
    expect(result.subjectKind).toBe("natural-social");
    expect(result.warnings).toEqual(["cache unavailable"]);
    expect(result.sourceTruth.uncertain).toContain("Không có OCR text để đối chiếu nguồn SGK.");
  });

  it("adds cached Natural and Social Studies tasks to source truth", async () => {
    cacheMocks.readNaturalSocialSourceInventory.mockResolvedValue({
      lessonKey: "nsxh-key",
      verifiedStatus: "verified",
      sourceHashes: ["hash-1"],
      inventory: {
        requiredTasks: [{ taskId: "q1", label: "Xác định năm thành lập trường", taskType: "answer_question", periodNumber: 1 }],
        visuals: [{ visualId: "v1", label: "Lịch sử nhà trường", page: "27" }],
      },
    });

    const result = await prepareStagedSourceContext(
      lessonInput("Tự nhiên và Xã hội"),
      ["hash-2"],
      "Trang 27 Quan sát hình và chia sẻ về truyền thống trường em.",
    );

    expect(result.sourceTruth.tasks).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "q1", label: "Xác định năm thành lập trường", source: "natural-social-inventory" }),
    ]));
    expect(result.sourceTruth.visuals).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "v1", page: "27" }),
    ]));
  });

  it("locks a split OCR heading and ignores exercise-number noise", async () => {
    cacheMocks.readNaturalSocialSourceInventory.mockResolvedValue(null);
    const input = { ...lessonInput("Khoa học"), lessonTitle: "" };
    const result = await prepareStagedSourceContext(
      input,
      ["science-hash"],
      "KHOA HỌC 5\nBài 2\nÔ nhiễm, xói mòn đất và bảo vệ môi trường đất\nQuan sát hình và trả lời câu hỏi.\nBài 1. Hãy nêu nguyên nhân?\nBài 2. Viết biện pháp bảo vệ đất?",
    );

    expect(result.sourceTruth.lessonTitle).toBe("Bài 2. Ô nhiễm, xói mòn đất và bảo vệ môi trường đất");
    expect(result.sourceTruth.lessonIdentity).toMatchObject({
      status: "resolved",
      source: "ocr-heading",
      title: "Bài 2. Ô nhiễm, xói mòn đất và bảo vệ môi trường đất",
    });
    expect(result.sourceTruth.titleEvidence).toHaveLength(1);
  });
});
