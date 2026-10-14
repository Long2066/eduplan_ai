import { describe, expect, it } from "vitest";
import { Packer } from "docx";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import {
  attachHandwritingVisualsToActivities,
  extractTargetLettersFromWritingText,
  getHandwritingVisualsForLetters,
} from "./vietnamese-handwriting";
import { buildLessonDocxDocument, prepareLessonVisualsForDocx } from "./export-docx";
import type { LessonPlan, LessonActivity } from "@/types/lesson";

describe("Chặng 3: Render & Kiểm định Giáo án Tiếng Việt (Handwriting & Digital Competency)", () => {
  it("attachHandwritingVisualsToActivities tự động nhận diện và gắn thẻ mẫu chữ chuẩn", () => {
    const activities: LessonActivity[] = [
      {
        id: "act-warmup",
        phase: "Khởi động",
        title: "Hát bài Chữ cái",
        objective: "Tạo hứng thú",
        durationMinutes: 4,
        teacherActions: ["GV bật nhạc"],
        studentActions: ["HS hát theo"],
      },
      {
        id: "act-writing",
        phase: "Luyện tập",
        title: "Luyện viết bảng con",
        objective: "Tập viết đúng quy trình các chữ an, ăn, ân",
        durationMinutes: 10,
        teacherActions: ["GV viết mẫu điểm đặt bút và chiều lia bút", "HS viết bảng con"],
        studentActions: ["HS quan sát mẫu và thực hành viết bảng con"],
      },
    ];

    const result = attachHandwritingVisualsToActivities(
      activities,
      "Bài 31. an ăn ân",
      "Học vần an, ăn, ân",
      { embedBase64: true }
    );

    // Warmup should not have visuals
    expect(result[0].teacherVisuals).toBeUndefined();

    // Writing activity should have visuals attached
    const writingVisuals = result[1].teacherVisuals;
    expect(writingVisuals).toBeDefined();
    expect(writingVisuals!.length).toBeGreaterThanOrEqual(1);

    const letterNames = writingVisuals!.map((v) => v.caption);
    expect(letterNames.some((c) => c.includes("Mẫu chữ a"))).toBe(true);
    expect(writingVisuals![0].dataUrl).toMatch(/^data:image\/png;base64,/);
  });

  it("buildLessonDocxDocument nhúng ảnh mẫu chữ vào cột GV và hiển thị chuẩn NLS CV 3456", async () => {
    const visuals = getHandwritingVisualsForLetters(["a"], { embedBase64: true });

    const sampleLesson: LessonPlan = {
      generalInfo: {
        subject: "Tiếng Việt",
        grade: "Lớp 1",
        lessonTitle: "Bài 31. an ăn ân",
        book: "Kết nối tri thức với cuộc sống",
        periods: 1,
        duration: 35,
      },
      outcomes: {
        knowledgeAndSkills: ["Nhận biết và đọc đúng vần an, ăn, ân"],
        generalCompetencies: ["Tự chủ và tự học: chủ động ghép tiếng"],
        specificCompetencies: ["Năng lực ngôn ngữ: đọc đúng và viết chuẩn"],
        digitalCompetencies: [
          "3.1.CB1a: Tạo nội dung số đơn giản (HS ghi âm lại giọng đọc mẫu và tự đối chiếu)",
        ],
        qualities: ["Chăm chỉ rèn luyện chữ viết"],
      },
      materials: {
        teacher: ["Bộ thẻ chữ", "Tranh minh họa"],
        students: ["Bảng con", "Vở tập viết"],
      },
      activities: [
        {
          phase: "Luyện tập",
          title: "Luyện viết bảng con",
          objective: "Viết đúng chữ an, ăn, ân đúng độ cao",
          durationMinutes: 12,
          teacherActions: ["GV hướng dẫn mẫu chữ"],
          studentActions: ["HS quan sát và viết bảng"],
          teacherVisuals: visuals,
        },
      ],
      periodPlans: [
        {
          periodNumber: 1,
          focus: "Học vần và luyện viết",
          activities: [
            {
              phase: "Luyện tập",
              title: "Luyện viết bảng con",
              objective: "Viết đúng chữ an, ăn, ân đúng độ cao",
              durationMinutes: 12,
              teacherActions: ["GV hướng dẫn mẫu chữ"],
              studentActions: ["HS quan sát và viết bảng"],
              teacherVisuals: visuals,
            },
          ],
        },
      ],
    };

    const doc = buildLessonDocxDocument(sampleLesson);
    const buffer = await Packer.toBuffer(doc);
    expect(buffer.length).toBeGreaterThan(1000);

    // Save to temp file and run tools/verify_docx_table.py
    const tempDocxPath = path.join(process.cwd(), "tests", "temp_test_bai31_chặng3.docx");
    fs.writeFileSync(tempDocxPath, buffer);

    try {
      const output = execSync(`python tools/verify_docx_table.py "${tempDocxPath}"`, {
        encoding: "utf-8",
      });
      expect(output).toContain("PASSED");
    } finally {
      if (fs.existsSync(tempDocxPath)) {
        fs.unlinkSync(tempDocxPath);
      }
    }
  });

  it("prepareLessonVisualsForDocx chuyển đổi đường dẫn tĩnh sang base64 hợp lệ", async () => {
    const rawLesson: LessonPlan = {
      generalInfo: {
        subject: "Tiếng Việt",
        grade: "Lớp 1",
        lessonTitle: "Bài 1. a b",
        periods: 1,
        duration: 35,
      },
      outcomes: {
        knowledgeAndSkills: ["Viết chữ a"],
        generalCompetencies: ["Tự học"],
        specificCompetencies: ["Viết chữ"],
        qualities: ["Chăm chỉ"],
      },
      activities: [
        {
          phase: "Luyện tập",
          title: "Tập viết chữ a",
          objective: "Viết đúng chữ a",
          durationMinutes: 15,
          teacherActions: ["GV viết mẫu"],
          studentActions: ["HS viết bài"],
          teacherVisuals: [
            {
              id: "hw-a",
              caption: "Mẫu chữ a",
              dataUrl: "/handwriting/lower_a.png",
              widthPx: 240,
            },
          ],
        },
      ],
    };

    const prepared = await prepareLessonVisualsForDocx(rawLesson);
    const convertedVisual = prepared.activities[0].teacherVisuals?.[0];
    expect(convertedVisual?.dataUrl).toMatch(/^data:image\/png;base64,/);
  });
});
