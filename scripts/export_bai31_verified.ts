import fs from "node:fs";
import path from "node:path";
import { Packer } from "docx";
import { v1SchemaToLessonPlan, type V1LessonPlanSchema } from "../src/lib/lesson-schema-adapter";
import { buildLessonDocxDocument } from "../src/lib/export-docx";

async function main() {
  const contractPath = path.resolve(__dirname, "../samples/bai31-source-contract.json");
  const raw = fs.readFileSync(contractPath, "utf-8");
  const contract = JSON.parse(raw) as V1LessonPlanSchema;

  const lessonPlan = v1SchemaToLessonPlan(contract);

  // Tạo ảnh mẫu SGK tr. 74 cho hoạt động khởi động và khám phá
  const sharp = (await import("sharp")).default;
  const warmupSvg = Buffer.from(
    `<svg width="300" height="160" xmlns="http://www.w3.org/2000/svg">
      <rect width="300" height="160" fill="#f0f9ff" rx="8" stroke="#bae6fd" stroke-width="2"/>
      <text x="150" y="45" font-family="Arial" font-size="14" font-weight="bold" fill="#0369a1" text-anchor="middle">TRANH SGK TRANG 74</text>
      <text x="150" y="85" font-family="Arial" font-size="13" fill="#0284c7" text-anchor="middle">Cả đàn gà cứ tha thẩn gần chân mẹ</text>
      <rect x="50" y="105" width="60" height="30" fill="#e0f2fe" rx="4"/>
      <text x="80" y="125" font-family="Arial" font-size="12" font-weight="bold" fill="#0284c7" text-anchor="middle">đàn</text>
      <rect x="120" y="105" width="60" height="30" fill="#e0f2fe" rx="4"/>
      <text x="150" y="125" font-family="Arial" font-size="12" font-weight="bold" fill="#0284c7" text-anchor="middle">gần</text>
      <rect x="190" y="105" width="60" height="30" fill="#e0f2fe" rx="4"/>
      <text x="220" y="125" font-family="Arial" font-size="12" font-weight="bold" fill="#0284c7" text-anchor="middle">chân</text>
    </svg>`
  );
  const warmupPng = await sharp(warmupSvg).png().toBuffer();
  const warmupDataUrl = `data:image/png;base64,${warmupPng.toString("base64")}`;

  const phonicsSvg = Buffer.from(
    `<svg width="300" height="140" xmlns="http://www.w3.org/2000/svg">
      <rect width="300" height="140" fill="#fefce8" rx="8" stroke="#fef08a" stroke-width="2"/>
      <text x="150" y="35" font-family="Arial" font-size="14" font-weight="bold" fill="#854d0e" text-anchor="middle">MÔ HÌNH VẦN VÀ GHÉP TIẾNG</text>
      <text x="150" y="70" font-family="Arial" font-size="13" font-weight="bold" fill="#a16207" text-anchor="middle">an (a - n)   |   ăn (ă - n)   |   ân (â - n)</text>
      <text x="150" y="105" font-family="Arial" font-size="13" font-weight="bold" fill="#ca8a04" text-anchor="middle">b + an = ban  →  ban + . = bạn</text>
    </svg>`
  );
  const phonicsPng = await sharp(phonicsSvg).png().toBuffer();
  const phonicsDataUrl = `data:image/png;base64,${phonicsPng.toString("base64")}`;

  if (lessonPlan.periodPlans?.[0]?.activities?.[0]) {
    lessonPlan.periodPlans[0].activities[0].teacherVisuals = [
      {
        id: "vis_warmup",
        caption: "Tranh nhận biết SGK tr. 74",
        dataUrl: warmupDataUrl,
        widthPx: 240,
        heightPx: 128,
      },
    ];
  }

  if (lessonPlan.periodPlans?.[0]?.activities?.[1]) {
    lessonPlan.periodPlans[0].activities[1].teacherVisuals = [
      {
        id: "vis_phonics",
        caption: "Mô hình cấu tạo vần và ghép tiếng bạn",
        dataUrl: phonicsDataUrl,
        widthPx: 240,
        heightPx: 112,
      },
    ];
  }

  const doc = buildLessonDocxDocument(lessonPlan);

  const buffer = await Packer.toBuffer(doc);
  const outPath = path.resolve(__dirname, "../samples/bai31_verified.docx");
  fs.writeFileSync(outPath, buffer);

  console.log(`Đã xuất thành công file DOCX (kèm ảnh cột GV): ${outPath} (${buffer.length} bytes)`);
}

main().catch((err) => {
  console.error("Lỗi khi xuất DOCX:", err);
  process.exit(1);
});
