import { NextResponse } from "next/server";
import { adminError, requireAdmin } from "@/lib/admin-auth";
import { getFirebaseDb } from "@/lib/firebase-admin";
import { serializeFeedback } from "@/lib/serializers";

export const runtime = "nodejs";

const categoryLabels: Record<string, string> = {
  bug: "Báo lỗi",
  improvement: "Góp ý cải thiện",
  feature: "Yêu cầu tính năng",
  "vietnamese-pilot": "Pilot Tiếng Việt",
  other: "Khác",
};

const pilotCriteria = [
  ["classification", "Đúng kiểu bài"],
  ["source-fidelity", "Đúng ngữ liệu"],
  ["measurable-outcomes", "Mục tiêu đo được"],
  ["pedagogy-sequence", "Đúng chuỗi dạy học"],
  ["responses-and-support", "Phản hồi và sửa lỗi"],
  ["time-fit", "Dạy được 35 phút"],
  ["period-continuity", "Nối tiết không lặp"],
  ["preview-and-word", "Preview và Word"],
] as const;

function pilotRatingLabel(value: unknown) {
  return value === "pass" ? "Đạt" : value === "needs-work" ? "Cần chỉnh" : "Chưa đánh giá";
}

const statusLabels: Record<string, string> = {
  new: "Mới",
  in_progress: "Đang xử lý",
  resolved: "Đã xử lý",
  ignored: "Bỏ qua",
  reviewed: "Đã xem",
};

const priorityLabels: Record<string, string> = {
  low: "Thấp",
  medium: "Vừa",
  high: "Quan trọng",
};

function xmlCell(value: unknown) {
  const text = String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  return `<Cell><Data ss:Type="String">${text}</Data></Cell>`;
}

function formatDate(value: string) {
  if (!value) return "";
  return new Date(value).toLocaleString("vi-VN");
}

export async function GET() {
  try {
    await requireAdmin();
    const snapshot = await getFirebaseDb()
      .collection("feedback")
      .orderBy("createdAt", "desc")
      .limit(2000)
      .get();
    const feedback = snapshot.docs.map(serializeFeedback);
    const headers = [
      "STT", "Thời gian", "Họ tên", "Email", "Loại góp ý", "Trạng thái", "Mức độ", "Ghi chú admin", "Nội dung", "URL trang gửi", "User Agent",
      "Pilot Lesson ID", "Lớp", "Bài", "Bộ sách", "Số tiết", "Kiểu bài", "Confidence", "Audit", "Điểm pilot", "Có thể dùng để dạy",
      ...pilotCriteria.map(([, label]) => label),
    ];
    const rows = feedback.map((item, index) => {
      const pilot = item.pilot as {
        lessonId?: string; grade?: string; lessonTitle?: string; book?: string; periods?: number; teachable?: boolean | null;
        ratings?: Record<string, unknown>; summary?: { scorePercent?: number }; audit?: { lessonType?: string; classificationConfidence?: string; status?: string };
      } | null;
      return [
        index + 1,
        formatDate(item.createdAt),
        item.userName,
        item.userEmail,
        categoryLabels[item.category] || item.category,
        statusLabels[item.status] || item.status,
        priorityLabels[item.priority] || item.priority,
        item.adminNote,
        item.message,
        item.pageUrl,
        item.userAgent,
        pilot?.lessonId || "",
        pilot?.grade || "",
        pilot?.lessonTitle || "",
        pilot?.book || "",
        pilot?.periods || "",
        pilot?.audit?.lessonType || "",
        pilot?.audit?.classificationConfidence || "",
        pilot?.audit?.status || "",
        pilot ? `${Number(pilot.summary?.scorePercent || 0)}%` : "",
        pilot ? (pilot.teachable === true ? "Có" : pilot.teachable === false ? "Chưa" : "Chưa đánh giá") : "",
        ...pilotCriteria.map(([id]) => pilot ? pilotRatingLabel(pilot.ratings?.[id]) : ""),
      ];
    });

    const workbook = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="Gop y">
  <Table>
   <Row>${headers.map(xmlCell).join("")}</Row>
   ${rows.map((row) => `<Row>${row.map(xmlCell).join("")}</Row>`).join("")}
  </Table>
 </Worksheet>
</Workbook>`;

    return new NextResponse(workbook, {
      headers: {
        "Content-Type": "application/vnd.ms-excel; charset=utf-8",
        "Content-Disposition": `attachment; filename="eduplan-feedback-${new Date().toISOString().slice(0, 10)}.xls"`,
      },
    });
  } catch (error) {
    const { message, status } = adminError(error, "Không thể xuất Excel góp ý.");
    return NextResponse.json({ error: message }, { status });
  }
}
