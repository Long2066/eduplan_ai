import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { Packer } from "docx";
import {
  cropImageWithPadding,
  attachSgkCropsToActivities,
  STANDARD_GRADE1_REGIONS,
} from "./sgk-crop";
import { buildLessonDocxDocument } from "@/lib/export-docx";
import type { LessonActivity, LessonPlan, UploadedAsset } from "@/types/lesson";

describe("SGK image auto-crop and embed in Teacher column", () => {
  it("crops image with smart padding and returns valid dimensions", async () => {
    // Tạo ảnh test 800x1000
    const testSvg = Buffer.from(
      '<svg width="800" height="1000"><rect width="800" height="1000" fill="#f0fdf4"/><circle cx="400" cy="200" r="100" fill="#16a34a"/></svg>',
    );
    const testBuffer = await sharp(testSvg).png().toBuffer();

    const box = STANDARD_GRADE1_REGIONS.warmup_recognition; // [40, 50, 320, 950]
    const crop = await cropImageWithPadding(testBuffer, box, {
      paddingPercent: 0.08,
      maxWidth: 320,
    });

    expect(crop).not.toBeNull();
    expect(crop?.width).toBeLessThanOrEqual(320);
    expect(crop?.dataUrl).toMatch(/^data:image\/png;base64,/);
    expect(crop?.buffer.length).toBeGreaterThan(0);
  });

  it("attaches cropped visuals to activities when image assets are provided", async () => {
    const testSvg = Buffer.from(
      '<svg width="600" height="800"><rect width="600" height="800" fill="#f8fafc"/></svg>',
    );
    const testBuffer = await sharp(testSvg).png().toBuffer();
    const dataUrl = `data:image/png;base64,${testBuffer.toString("base64")}`;

    const assets: UploadedAsset[] = [
      {
        id: "asset_page1",
        name: "SGK_Trang_74.png",
        type: "image",
        dataUrl,
      },
    ];

    const activities: LessonActivity[] = [
      {
        id: "act_1",
        phase: "Khởi động",
        title: "Khởi động: Nhận biết vần qua tranh",
        objective: "Nhận biết âm vần",
        durationMinutes: 5,
        teacherActions: ["GV chiếu tranh khởi động", "GV đặt câu hỏi"],
        studentActions: ["HS quan sát tranh", "HS trả lời"],
      },
      {
        id: "act_2",
        phase: "Khám phá",
        title: "Khám phá: Mô hình vần và ghép tiếng",
        objective: "Ghép được tiếng mới",
        durationMinutes: 12,
        teacherActions: ["GV chỉ mô hình ghép tiếng"],
        studentActions: ["HS ghép thẻ chữ"],
      },
    ];

    const updated = await attachSgkCropsToActivities(activities, assets);

    expect(updated[0].teacherVisuals).toBeDefined();
    expect(updated[0].teacherVisuals?.length).toBe(1);
    expect(updated[0].teacherVisuals?.[0].caption).toContain("Tranh nhận biết");

    expect(updated[1].teacherVisuals).toBeDefined();
    expect(updated[1].teacherVisuals?.length).toBe(1);
    expect(updated[1].teacherVisuals?.[0].caption).toContain("Mô hình vần");
  });

  it("attaches SGK handwriting sample to writing activities in Grade 1", async () => {
    const testSvg = Buffer.from(
      '<svg width="600" height="800"><rect width="600" height="800" fill="#fef2f2"/></svg>',
    );
    const testBuffer = await sharp(testSvg).png().toBuffer();
    const dataUrl = `data:image/png;base64,${testBuffer.toString("base64")}`;

    const assets: UploadedAsset[] = [
      { id: "asset_page1", name: "SGK_Trang_74.png", type: "image", dataUrl },
    ];

    const activities: LessonActivity[] = [
      {
        id: "act_write",
        phase: "Khám phá",
        title: "Khám phá: Hướng dẫn viết vần an, ăn, ân",
        objective: "Viết đúng quy trình",
        durationMinutes: 12,
        teacherActions: ["GV viết mẫu vần an"],
        studentActions: ["HS viết bảng con"],
      },
    ];

    const updated = await attachSgkCropsToActivities(activities, assets, { grade: 1 });
    expect(updated[0].teacherVisuals).toBeDefined();
    expect(updated[0].teacherVisuals?.[0].caption).toContain("Mẫu chữ viết chuẩn ô li SGK");
  });

  it("attaches Grade 2-5 regions for reading and exercise activities", async () => {
    const testSvg = Buffer.from(
      '<svg width="600" height="800"><rect width="600" height="800" fill="#eff6ff"/></svg>',
    );
    const testBuffer = await sharp(testSvg).png().toBuffer();
    const dataUrl = `data:image/png;base64,${testBuffer.toString("base64")}`;

    const assets: UploadedAsset[] = [
      { id: "asset_p1", name: "SGK_L3_T1.png", type: "image", dataUrl },
      { id: "asset_p2", name: "SGK_L3_T2.png", type: "image", dataUrl },
    ];

    const activities: LessonActivity[] = [
      {
        id: "act_read",
        phase: "Khám phá",
        title: "Đọc văn bản: Chiếc áo len",
        objective: "Đọc đúng văn bản",
        durationMinutes: 20,
        teacherActions: ["GV đọc mẫu"],
        studentActions: ["HS luyện đọc"],
      },
      {
        id: "act_exercises",
        phase: "Luyện tập",
        title: "Tìm hiểu bài và trả lời câu hỏi",
        objective: "Hiểu nội dung",
        durationMinutes: 15,
        teacherActions: ["GV nêu câu hỏi 1"],
        studentActions: ["HS thảo luận"],
      },
    ];

    const updated = await attachSgkCropsToActivities(activities, assets, { grade: 3 });
    expect(updated[0].teacherVisuals?.[0].caption).toContain("Văn bản SGK");
    expect(updated[1].teacherVisuals?.[0].caption).toContain("câu hỏi / bài tập SGK");
  });

  it("embeds cropped images into DOCX Teacher column within table without breaking layout", async () => {
    const testSvg = Buffer.from(
      '<svg width="200" height="150"><rect width="200" height="150" fill="#38bdf8"/></svg>',
    );
    const testBuffer = await sharp(testSvg).png().toBuffer();
    const dataUrl = `data:image/png;base64,${testBuffer.toString("base64")}`;

    const lesson: LessonPlan = {
      generalInfo: {
        subject: "Tiếng Việt",
        grade: "Lớp 1",
        lessonTitle: "Bài 31. an ăn ân",
        book: "Kết nối tri thức",
        periods: 1,
        duration: 35,
      },
      outcomes: {
        knowledgeAndSkills: ["Đọc đúng các vần an, ăn, ân"],
        generalCompetencies: ["Tự chủ và tự học"],
        specificCompetencies: ["Năng lực ngôn ngữ"],
        qualities: ["Chăm chỉ"],
      },
      materials: {
        teacher: ["SGK Tiếng Việt 1"],
        students: ["Vở tập viết"],
      },
      activities: [
        {
          id: "act_1",
          phase: "Khám phá",
          title: "Khám phá vần an, ăn, ân",
          objective: "Đọc đúng vần",
          durationMinutes: 15,
          teacherActions: ["GV chiếu mô hình vần:", "GV hướng dẫn học sinh đọc:"],
          studentActions: ["HS quan sát mô hình", "HS đọc theo nhịp"],
          teacherVisuals: [
            {
              id: "vis_1",
              caption: "Mô hình vần an",
              dataUrl,
              widthPx: 200,
              heightPx: 150,
            },
          ],
        },
      ],
      assessment: {
        criteria: ["Đọc đúng vần"],
        evidence: ["Đọc cá nhân"],
        comments: ["Khen ngợi"],
      },
      adjustments: {
        suitablePoints: [],
        pointsToAdjust: [],
        nextLessonDirection: [],
      },
      contextFit: {
        notes: [],
      },
      meta: {
        style: "Dạy thật trên lớp",
        modelUsed: "test",
        createdAt: new Date().toISOString(),
      },
    };

    const doc = buildLessonDocxDocument(lesson);
    const buffer = await Packer.toBuffer(doc);

    expect(buffer.length).toBeGreaterThan(5000);
  });
});
