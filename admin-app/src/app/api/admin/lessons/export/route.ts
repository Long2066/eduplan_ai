import { NextResponse } from "next/server";
import { adminError, requireAdmin } from "@/lib/admin-auth";
import { getFirebaseDb } from "@/lib/firebase-admin";
import { serializeLesson } from "@/lib/serializers";

export const runtime = "nodejs";

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
      .collection("lessons")
      .limit(2000)
      .get();
    const lessons = snapshot.docs.map(serializeLesson).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    const headers = ["STT", "Tên giáo án", "User ID", "Môn", "Lớp", "Số tiết", "Ngày tạo", "Cập nhật", "Hết hạn"];
    const rows = lessons.map((lesson, index) => [
      index + 1,
      lesson.title,
      lesson.ownerId,
      lesson.subject,
      lesson.grade,
      lesson.periods,
      formatDate(lesson.createdAt),
      formatDate(lesson.updatedAt),
      formatDate(lesson.expiresAt),
    ]);

    const workbook = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="Giao an">
  <Table>
   <Row>${headers.map(xmlCell).join("")}</Row>
   ${rows.map((row) => `<Row>${row.map(xmlCell).join("")}</Row>`).join("")}
  </Table>
 </Worksheet>
</Workbook>`;

    return new NextResponse(workbook, {
      headers: {
        "Content-Type": "application/vnd.ms-excel; charset=utf-8",
        "Content-Disposition": `attachment; filename="eduplan-lessons-${new Date().toISOString().slice(0, 10)}.xls"`,
      },
    });
  } catch (error) {
    const { message, status } = adminError(error, "Không thể xuất Excel giáo án.");
    return NextResponse.json({ error: message }, { status });
  }
}
