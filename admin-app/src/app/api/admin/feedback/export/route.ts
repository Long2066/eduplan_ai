import { NextResponse } from "next/server";
import { adminError, requireAdmin } from "@/lib/admin-auth";
import { getFirebaseDb } from "@/lib/firebase-admin";
import { serializeFeedback } from "@/lib/serializers";

export const runtime = "nodejs";

const categoryLabels: Record<string, string> = {
  bug: "Báo lỗi",
  improvement: "Góp ý cải thiện",
  feature: "Yêu cầu tính năng",
  other: "Khác",
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
    const headers = ["STT", "Thời gian", "Họ tên", "Email", "Loại góp ý", "Trạng thái", "Nội dung", "URL trang gửi", "User Agent"];
    const rows = feedback.map((item, index) => [
      index + 1,
      formatDate(item.createdAt),
      item.userName,
      item.userEmail,
      categoryLabels[item.category] || item.category,
      item.status === "reviewed" ? "Đã xem" : "Mới",
      item.message,
      item.pageUrl,
      item.userAgent,
    ]);

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
