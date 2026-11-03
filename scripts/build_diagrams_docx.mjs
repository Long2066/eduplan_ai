import fs from "node:fs";
import path from "node:path";
import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from "docx";

const FONT = "Times New Roman";
const SIZE_11 = 22; // 11pt = 22 half-points
const SIZE_10 = 20; // 10pt = 20 half-points

const NAVY = "1F4E79";
const BLUE = "2E75B6";
const TEAL = "006666";
const GREEN = "276A3C";
const AMBER = "B45F06";
const RED = "C00000";
const DARK = "1A1A1A";

const BG_NAVY = "EAF1F8";
const BG_BLUE = "F0F6FC";
const BG_TEAL = "E8F6F5";
const BG_GREEN = "EBF5EE";
const BG_AMBER = "FEF7E6";
const BG_RED = "FDF0F0";
const BG_GRAY = "F5F7FA";
const WHITE = "FFFFFF";

const noBorder = { style: BorderStyle.NONE, size: 0, color: WHITE };
const noBordersAll = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };

function borderBox(color = NAVY, size = 8, style = BorderStyle.SINGLE) {
  const b = { style, size, color };
  return { top: b, bottom: b, left: b, right: b };
}

function t(text, opts = {}) {
  return new TextRun({
    text,
    font: FONT,
    size: opts.size || SIZE_11,
    bold: opts.bold || false,
    italics: opts.italic || false,
    color: opts.color || DARK,
  });
}

function p(runs, opts = {}) {
  const children = Array.isArray(runs) ? runs : [runs];
  return new Paragraph({
    alignment: opts.align || AlignmentType.CENTER,
    spacing: {
      before: opts.before ?? 20,
      after: opts.after ?? 20,
      line: opts.line ?? 240,
    },
    children: children.map((c) => (typeof c === "string" ? t(c, opts) : c)),
  });
}

function blockCell({ title, items = [], width, fill = WHITE, borderColor = NAVY, titleColor = NAVY, colSpan = 1 }) {
  const children = [
    p([t(title, { bold: true, color: titleColor, size: SIZE_11 })], { before: 20, after: items.length ? 15 : 20 }),
  ];
  for (const item of items) {
    children.push(
      p([t(item, { size: SIZE_10, color: DARK })], {
        align: AlignmentType.LEFT,
        before: 8,
        after: 8,
        line: 220,
      })
    );
  }
  return new TableCell({
    width: width ? { size: width, type: WidthType.PERCENTAGE } : undefined,
    columnSpan: colSpan,
    shading: { type: ShadingType.CLEAR, fill },
    borders: borderBox(borderColor, 8),
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children,
  });
}

function arrowRow(label = "▼", colSpan = 1) {
  return new TableRow({
    children: [
      new TableCell({
        columnSpan: colSpan,
        borders: noBordersAll,
        margins: { top: 10, bottom: 10, left: 20, right: 20 },
        children: [p([t(label, { bold: true, color: NAVY, size: SIZE_11 })], { before: 0, after: 0 })],
      }),
    ],
  });
}

function spacerCell(width = 2) {
  return new TableCell({
    width: { size: width, type: WidthType.PERCENTAGE },
    borders: noBordersAll,
    children: [p("", { before: 0, after: 0 })],
  });
}

function buildDiagram1() {
  // SƠ ĐỒ 1: KIẾN TRÚC PHÂN TẦNG HỆ THỐNG EDUPLAN AI V2.0
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: noBordersAll,
    rows: [
      // TẦNG 1: CLIENT LAYER
      new TableRow({
        children: [
          blockCell({
            title: "TẦNG 1: GIAO DIỆN NGƯỜI DÙNG (CLIENT PRESENTATION LAYER — NEXT.JS 15 & REACT 19)",
            fill: BG_NAVY,
            borderColor: NAVY,
            titleColor: NAVY,
            colSpan: 5,
            items: [
              "• Khung nhập liệu thông minh (Lesson Form) & Tùy chọn bối cảnh sư phạm (vùng miền, thiết bị, phong cách dạy học).",
              "• Kho học liệu Tập Huấn NXB GDVN tích hợp sẵn (chọn trang SGK trực tiếp) & Công cụ tải ảnh SGK.",
              "• Khung xem trước A4 trực quan (WYSIWYG Multi-Period Preview) & Thẻ phản biện sư phạm (Pedagogy Audit Card).",
            ],
          }),
        ],
      }),
      arrowRow("▼   HTTP/REST JSON  |  Firebase Auth Session Cookie  |  Rate Limiting & IP Security   ▼", 5),

      // TẦNG 2: BFF & API GATEWAY
      new TableRow({
        children: [
          blockCell({
            title: "TẦNG 2: CỔNG DỊCH VỤ & ĐIỀU PHỐI BẤT ĐỒNG BỘ (API GATEWAY & JOB ORCHESTRATOR)",
            fill: BG_BLUE,
            borderColor: BLUE,
            titleColor: NAVY,
            colSpan: 5,
            items: [
              "• Quản lý phiên & Phân quyền gói cước (Free / Plus / Pro)  |  • Cổng thanh toán tự động VietQR PayOS Webhook.",
              "• Điều phối tiến trình Staged Generation (Step Executor V2) có cơ chế thuê khóa (Lease Locking) & Lưu Checkpoint.",
            ],
          }),
        ],
      }),
      arrowRow("▼   Phân tách 8 bước tuần tự  &  Gọi động cơ chuyên biệt theo môn học   ▼", 5),

      // TẦNG 3: 3 KHỐI XỬ LÝ TRUNG TÂM SONG SONG
      new TableRow({
        children: [
          blockCell({
            width: 32,
            title: "TẦNG 3A: ĐỘNG CƠ SƯ PHẠM\n(PEDAGOGY ENGINE 12 MÔN KNTT)",
            fill: BG_TEAL,
            borderColor: TEAL,
            titleColor: TEAL,
            items: [
              "• Hồ sơ phương pháp 12 môn Tiểu học.",
              "• Tiếng Việt: 11 dạng bài, quy trình học vần 8 bước, ghép tiếng 2 bước.",
              "• Nét chữ ô li: Điểm đặt/dừng bút, độ cao ô li Lớp 1.",
              "• Toán: Trực quan, sơ đồ, kiểm tra logic số học ngược.",
              "• Tích hợp Năng lực số CV 3456.",
            ],
          }),
          spacerCell(2),
          blockCell({
            width: 32,
            title: "TẦNG 3B: LÕI AI & THỊ GIÁC MÁY TÍNH\n(AI CORE & SMART SGK CROP)",
            fill: BG_GREEN,
            borderColor: GREEN,
            titleColor: GREEN,
            items: [
              "• OpenAI Vision OCR: Bóc tách văn bản & tọa độ ảnh SGK theo batch.",
              "• Định tuyến Model: gpt-4.1-mini, gpt-5.4-mini, gpt-5.4.",
              "• Smart SGK Crop (Sharp): Tự động cắt ảnh bài tập SGK với 8% biên an toàn, nhúng vào cột GV.",
            ],
          }),
          spacerCell(2),
          blockCell({
            width: 32,
            title: "TẦNG 3C: KIỂM ĐỊNH 5 CỔNG\n(5-GATE QUALITY ASSURANCE V12)",
            fill: BG_AMBER,
            borderColor: AMBER,
            titleColor: AMBER,
            items: [
              "• Gate 1: Chuẩn JSON & 35 phút/tiết.",
              "• Gate 2: Khóa ngữ liệu SGK gốc (Chống ảo giác 100%).",
              "• Gate 3: Kiểm tra logic sư phạm môn.",
              "• Gate 4: Bảo toàn Bảng 2 cột CV 2345.",
              "• Gate 5: Tự động sửa lỗi (Repair Loop).",
            ],
          }),
        ],
      }),
      arrowRow("▼   Hợp nhất cấu trúc LessonPlan JSON đã kiểm định  &  Lưu trữ đám mây   ▼", 5),

      // TẦNG 4: DỮ LIỆU & XUẤT BẢN
      new TableRow({
        children: [
          blockCell({
            width: 49,
            title: "TẦNG 4A: BỘ XUẤT BẢN WORD (.DOCX) NATIVE",
            fill: BG_NAVY,
            borderColor: NAVY,
            titleColor: NAVY,
            items: [
              "• Khởi tạo OpenXML trực tiếp (thư viện docx), chuẩn khổ A4, Times New Roman.",
              "• Bảng 2 cột (Hoạt động GV | Hoạt động HS) kèm ảnh cắt SGK.",
              "• Biên dịch công thức Toán LaTeX → MathML → OMML (Microsoft Equation sửa được).",
            ],
          }),
          spacerCell(2),
          blockCell({
            width: 49,
            title: "TẦNG 4B: HẠ TẦNG DỮ LIỆU ĐÁM MÂY (FIREBASE)",
            fill: BG_GRAY,
            borderColor: BLUE,
            titleColor: NAVY,
            items: [
              "• Cloud Firestore: Lưu trữ KHBD, lịch sử phiên bản, Checkpoint Job, Sổ cái tín dụng (Entitlement Ledger).",
              "• Firebase Storage: Lưu trữ ảnh SGK tạm thời kèm cơ chế tự động xóa bảo mật (TTL Cron Cleanup).",
            ],
          }),
        ],
      }),
    ],
  });
}

function buildDiagram2() {
  // SƠ ĐỒ 2: LƯU ĐỒ QUY TRÌNH 8 BƯỚC SINH KHBD VÀ 5 CỔNG KIỂM ĐỊNH (QUALITY GATES V12)
  const stepCell = (num, title, desc, width = 44) =>
    blockCell({
      width,
      title: `BƯỚC ${num}: ${title}`,
      fill: BG_BLUE,
      borderColor: BLUE,
      titleColor: NAVY,
      items: [desc],
    });

  const gateCell = (num, title, desc, fill = BG_AMBER, borderColor = AMBER, titleColor = AMBER, width = 44) =>
    blockCell({
      width,
      title: `CỔNG KIỂM ĐỊNH ${num} (GATE ${num}): ${title}`,
      fill,
      borderColor,
      titleColor,
      items: [desc],
    });

  const midArrow = (symbol = "──►") =>
    new TableCell({
      width: { size: 12, type: WidthType.PERCENTAGE },
      borders: noBordersAll,
      verticalAlign: VerticalAlign.CENTER,
      children: [p([t(symbol, { bold: true, color: RED, size: SIZE_11 })], { before: 0, after: 0 })],
    });

  const downLeftRightRow = (leftSymbol = "▼", rightSymbol = "") =>
    new TableRow({
      children: [
        new TableCell({
          width: { size: 44, type: WidthType.PERCENTAGE },
          borders: noBordersAll,
          children: [p([t(leftSymbol, { bold: true, color: NAVY, size: SIZE_11 })], { before: 4, after: 4 })],
        }),
        new TableCell({
          width: { size: 12, type: WidthType.PERCENTAGE },
          borders: noBordersAll,
          children: [p("", { before: 4, after: 4 })],
        }),
        new TableCell({
          width: { size: 44, type: WidthType.PERCENTAGE },
          borders: noBordersAll,
          children: [p([t(rightSymbol, { bold: true, color: RED, size: SIZE_11 })], { before: 4, after: 4 })],
        }),
      ],
    });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: noBordersAll,
    rows: [
      // HEADER CỘT
      new TableRow({
        children: [
          blockCell({
            width: 44,
            title: "LUỒNG 8 BƯỚC SINH KHBD (STAGED PIPELINE V2)",
            fill: BG_NAVY,
            borderColor: NAVY,
            titleColor: NAVY,
          }),
          new TableCell({ width: { size: 12, type: WidthType.PERCENTAGE }, borders: noBordersAll, children: [p("")] }),
          blockCell({
            width: 44,
            title: "HỆ THỐNG 5 CỔNG KIỂM ĐỊNH (QUALITY GATES V12)",
            fill: BG_RED,
            borderColor: RED,
            titleColor: RED,
          }),
        ],
      }),
      downLeftRightRow("▼", "▼"),

      // BƯỚC 1 + BƯỚC 2 <---> GATE 2 (SOURCE CONTRACT)
      new TableRow({
        children: [
          stepCell(
            "1 & 2",
            "CHUẨN BỊ NGUỒN, OCR & LẬP BẢN ĐỒ BÀI DẠY",
            "• Nhận ảnh SGK / trang sách Tập Huấn, chạy OpenAI Vision OCR theo batch.\n• Trích xuất ngữ liệu gốc (sourceFacts) và lập bản đồ bài dạy (lessonMap)."
          ),
          midArrow("◄──►"),
          gateCell(
            "2",
            "HỢP ĐỒNG NGỮ LIỆU SGK (SOURCE CONTRACT)",
            "• Đối soát 1:1 từ ngữ, câu nhận biết, đoạn đọc, bài tập với SGK gốc.\n• Chặn tuyệt đối lỗi ảo giác (Hallucination); thiếu nguồn báo requires_source_review."
          ),
        ],
      }),
      downLeftRightRow("▼", ""),

      // BƯỚC 3 <---> GATE 1 (TECHNICAL & TIME)
      new TableRow({
        children: [
          stepCell(
            "3",
            "THIẾT KẾ KHUNG TIẾT HỌC (PERIOD BLUEPRINT)",
            "• Phân bổ Yêu cầu cần đạt (phẩm chất, năng lực, năng lực số) cho từng tiết.\n• Chia định mức thời gian chi tiết cho từng hoạt động."
          ),
          midArrow("◄──►"),
          gateCell(
            "1",
            "CẤU TRÚC KỸ THUẬT & ĐỊNH MỨC 35 PHÚT",
            "• Kiểm tra khớp 100% JSON Schema chuẩn.\n• Khóa chặt tổng thời lượng các hoạt động mỗi tiết đúng bằng 35 phút."
          ),
        ],
      }),
      downLeftRightRow("▼", ""),

      // BƯỚC 4 <---> GATE 3 (PEDAGOGY LOGIC)
      new TableRow({
        children: [
          stepCell(
            "4",
            "SINH KỊCH BẢN TỪNG PHA (PHASE GENERATION)",
            "• Sinh tuần tự 4 pha: Khởi động → Khám phá → Luyện tập → Vận dụng.\n• Viết lời thoại đối đáp 1:1 (GV hỏi/tổ chức - HS trả lời/thực hành - Sản phẩm)."
          ),
          midArrow("◄──►"),
          gateCell(
            "3",
            "LOGIC SƯ PHẠM ĐẶC THÙ MÔN (PEDAGOGY GATE)",
            "• Tiếng Việt: Đủ 8 bước học vần, ghép tiếng 2 bước, chuẩn nét viết ô li.\n• Toán: Có biểu diễn trực quan/sơ đồ, phân tích dữ kiện và kiểm tra ngược."
          ),
        ],
      }),
      downLeftRightRow("▼", "▲ (Vòng lặp tự sửa lỗi)"),

      // BƯỚC 5 & 6 <---> BƯỚC 7 (REPAIR LOOP)
      new TableRow({
        children: [
          stepCell(
            "5 & 6",
            "HỢP NHẤT GIÁO ÁN & CẮT ẢNH SGK (SMART CROP)",
            "• Ráp nối Mục I, II, III, IV thành cấu trúc KHBD hoàn chỉnh.\n• Dùng Sharp cắt ảnh bài tập/tranh SGK (8% padding) gắn vào cột GV."
          ),
          midArrow("──►"),
          blockCell({
            width: 44,
            title: "BƯỚC 7: KIỂM ĐỊNH TỰ ĐỘNG & SỬA LỖI (REPAIR LOOP)",
            fill: BG_RED,
            borderColor: RED,
            titleColor: RED,
            items: [
              "• Quét toàn bộ KHBD qua Gate 1, Gate 2, Gate 3.",
              "• Nếu phát hiện lỗi: Kích hoạt Mechanical Repair sửa cục bộ pha bị lỗi.",
              "• Nếu đạt chuẩn 100%: Cho phép chuyển sang Bước 8.",
            ],
          }),
        ],
      }),
      downLeftRightRow("▼", "▼ (Đạt chuẩn)"),

      // BƯỚC 8 <---> GATE 4 & GATE 5 (DOCX & VISUAL QA)
      new TableRow({
        children: [
          blockCell({
            width: 44,
            title: "BƯỚC 8: ĐÓNG GÓI, LƯU TRỮ & XUẤT WORD (.DOCX)",
            fill: BG_GREEN,
            borderColor: GREEN,
            titleColor: GREEN,
            items: [
              "• Lưu bản ghi KHBD hoàn chỉnh vào Cloud Firestore & Trừ hạn ngạch.",
              "• Hiển thị bản xem trước A4 và kết xuất tệp Word (.docx) Native.",
            ],
          }),
          midArrow("◄──►"),
          gateCell(
            "4 & 5",
            "THỂ THỨC BẢNG 2 CỘT CV 2345 & THẨM ĐỊNH IN ẤN",
            "• Gate 4: 100% Mục III nằm trong Bảng 2 cột (GV - HS), 0 đoạn văn rơi ngoài bảng.\n• Gate 5: Khổ A4, lề 1.8/1.6cm, Times New Roman, Toán OMML native sắc nét.",
            BG_GREEN,
            GREEN,
            GREEN
          ),
        ],
      }),
    ],
  });
}

async function main() {
  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: FONT, size: SIZE_11, color: DARK },
          paragraph: { spacing: { line: 240, before: 20, after: 20 } },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 850, // ~1.5cm
              bottom: 850,
              left: 900, // ~1.6cm
              right: 900,
            },
          },
        },
        children: [
          // TIÊU ĐỀ SƠ ĐỒ 1
          p([t("HÌNH 1. SƠ ĐỒ KHỐI KIẾN TRÚC PHÂN TẦNG HỆ THỐNG EDUPLAN AI (PHIÊN BẢN 2.0)", { bold: true, color: NAVY, size: SIZE_11 })], {
            align: AlignmentType.CENTER,
            before: 0,
            after: 80,
          }),
          buildDiagram1(),
          p([t("Hình 1. Kiến trúc phân tầng hướng dịch vụ của hệ thống trợ lý sư phạm EduPlan AI v2.0", { italic: true, size: SIZE_11, color: DARK })], {
            align: AlignmentType.CENTER,
            before: 60,
            after: 200,
          }),

          // TIÊU ĐỀ SƠ ĐỒ 2
          p([t("HÌNH 2. LƯU ĐỒ QUY TRÌNH 8 BƯỚC SINH KHBD VÀ 5 CỔNG KIỂM ĐỊNH CHẤT LƯỢNG (QUALITY GATES V12)", { bold: true, color: NAVY, size: SIZE_11 })], {
            align: AlignmentType.CENTER,
            before: 100,
            after: 80,
          }),
          buildDiagram2(),
          p([t("Hình 2. Lưu đồ tiến trình Staged Generation Pipeline V2 kết hợp 5 cổng kiểm định chất lượng của EduPlan AI v2.0", { italic: true, size: SIZE_11, color: DARK })], {
            align: AlignmentType.CENTER,
            before: 60,
            after: 0,
          }),
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  const fileName = "SO_DO_KIEN_TRUC_VA_QUY_TRINH_EDUPLAN_AI_V2.docx";
  const targets = [
    "C:/Users/Admin/Downloads",
    "C:/Downloads",
    "d:/NCKH/Tool/EduPlan AI",
  ];

  for (const dir of targets) {
    if (fs.existsSync(dir)) {
      const fullPath = path.join(dir, fileName);
      fs.writeFileSync(fullPath, buffer);
      console.log(`[OK] Đã xuất sơ đồ Word tại: ${fullPath} (${buffer.length} bytes)`);
    }
  }
}

main().catch(console.error);
