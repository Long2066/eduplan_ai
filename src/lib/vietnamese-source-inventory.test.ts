import { describe, expect, it } from "vitest";
import {
  buildVietnameseSourceInventoryPromptContext,
  buildVietnameseSourceInventoryRecord,
  hasStableVietnameseSourceInventoryKey,
  hashUploadedAsset,
  mergeVietnameseSourceInventories,
  summarizeVietnameseSourceComponents,
  vietnameseSourceInventoryLessonKey,
} from "@/lib/vietnamese-source-inventory";
import { makeInput } from "@/lib/vietnamese-fixtures";
import type { UploadedAsset, VietnameseSourceInventory } from "@/types/lesson";

function asset(overrides: Partial<UploadedAsset> = {}): UploadedAsset {
  return {
    id: "a1",
    name: "page-1.png",
    type: "image",
    mimeType: "image/png",
    dataUrl: "data:image/png;base64,QUJDREVGRw==",
    ...overrides,
  };
}

describe("vietnamese source inventory helpers", () => {
  it("tạo hash theo nội dung ảnh, không phụ thuộc tên file", () => {
    expect(hashUploadedAsset(asset({ name: "A.png" }))).toBe(hashUploadedAsset(asset({ name: "B.png" })));
  });

  it("khóa bài ổn định theo môn, lớp, bộ sách và tên bài", () => {
    const input = makeInput({ subject: "Tiếng Việt", grade: "Lớp 2", book: "Kết nối tri thức", lessonTitle: "Bài 1" });
    expect(vietnameseSourceInventoryLessonKey(input)).toBe(vietnameseSourceInventoryLessonKey({ ...input, lessonTitle: "  Bài   1  " }));
  });

  it("không coi tên bài trống/auto là khóa kho ngữ liệu ổn định", () => {
    expect(hasStableVietnameseSourceInventoryKey({ lessonTitle: "" })).toBe(false);
    expect(hasStableVietnameseSourceInventoryKey({ lessonTitle: "Tự nhận diện" })).toBe(false);
    expect(hasStableVietnameseSourceInventoryKey({ lessonTitle: "Bài 2. Một bài đọc" })).toBe(true);
  });

  it("merge ngữ liệu theo component thay vì ghi đè toàn bài", () => {
    const reading: VietnameseSourceInventory = {
      readingText: ["Đoạn đọc A"],
      readingQuestions: [{ question: "Câu hỏi 1?", expectedAnswer: "Đáp án 1" }],
    };
    const writing: VietnameseSourceInventory = {
      writingPrompt: { sentenceCount: "Viết 3-5 câu", objectNames: ["cặp sách"], prompts: ["Em quan sát tranh."] },
      punctuationSentences: [{ sentence: "Bạn đi đâu", answer: "Bạn đi đâu?" }],
    };

    const merged = mergeVietnameseSourceInventories(reading, writing);

    expect(merged?.readingText).toEqual(["Đoạn đọc A"]);
    expect(merged?.readingQuestions?.[0].expectedAnswer).toBe("Đáp án 1");
    expect(merged?.writingPrompt?.sentenceCount).toBe("Viết 3-5 câu");
    expect(merged?.punctuationSentences?.[0].answer).toBe("Bạn đi đâu?");
  });

  it("đánh dấu từng component đã có dữ liệu là verified", () => {
    const components = summarizeVietnameseSourceComponents({
      readingText: ["Đoạn đọc A"],
      spellingText: "Một đoạn nghe viết.",
    }, ["hash-1"]);

    expect(components.readingText.status).toBe("verified");
    expect(components.spellingText.status).toBe("verified");
    expect(components.writingPrompt.status).toBe("missing");
    expect(components.readingText.sourceHashes).toEqual(["hash-1"]);
  });

  it("record chỉ lưu sourceInventory, không lưu giáo án hoàn chỉnh", () => {
    const input = makeInput({ subject: "Tiếng Việt", grade: "Lớp 2", lessonTitle: "Bài 1" });
    const record = buildVietnameseSourceInventoryRecord(input, {
      readingText: ["Đoạn đọc A"],
      requiredTasks: [{ label: "Đọc đoạn 1", taskType: "reading-fluency", required: true }],
    }, ["hash-1"]);

    expect(record?.inventory.readingText).toEqual(["Đoạn đọc A"]);
    expect(JSON.stringify(record)).not.toContain("teacherActions");
    expect(JSON.stringify(record)).not.toContain("studentActions");
  });

  it("prompt context nói rõ kho là dữ liệu SGK sạch, không phải giáo án cũ", () => {
    const context = buildVietnameseSourceInventoryPromptContext("OCR mới", {
      readingText: ["Đoạn đọc A"],
    });

    expect(context).toContain("KHO NGỮ LIỆU SGK ĐÃ XÁC MINH");
    expect(context).toContain("không phải giáo án cũ");
    expect(context).toContain("OCR mới");
  });
});
