import { NextResponse } from "next/server";
import { adminError, requireAdmin } from "@/lib/admin-auth";
import { getFirebaseAdminAuth, getFirebaseDb } from "@/lib/firebase-admin";
import { toIso } from "@/lib/serializers";

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
      .collection("generationOperations")
      .orderBy("reservedAt", "desc")
      .limit(2000)
      .get();
    let operations = snapshot.docs
      .filter((doc) => String(doc.get("kind") || "generate") === "generate")
      .map((doc) => {
        const rawStatus = String(doc.get("status") || "reserved");
        return {
          uid: String(doc.get("uid") || ""),
          email: String(doc.get("userEmail") || ""),
          subject: String(doc.get("subject") || ""),
          createdAt: toIso(doc.get("committedAt") || doc.get("releasedAt") || doc.get("reservedAt")),
          status: rawStatus === "committed" ? "Thành công" : rawStatus === "released" ? "Thất bại" : "Đang xử lý",
        };
      });
    const missingEmails = [...new Set(operations.filter((item) => !item.email && item.uid).map((item) => item.uid))];
    if (missingEmails.length) {
      const result = await getFirebaseAdminAuth().getUsers(missingEmails.map((uid) => ({ uid })));
      const emailByUid = new Map(result.users.map((profile) => [profile.uid, profile.email || ""]));
      operations = operations.map((item) => item.email ? item : { ...item, email: emailByUid.get(item.uid) || item.uid });
    }
    const totals = new Map<string, number>();
    for (const item of operations) {
      if (item.status === "Thành công") totals.set(item.email, (totals.get(item.email) || 0) + 1);
    }
    const headers = ["STT", "Email người dùng", "Số giáo án đã tạo", "Thời gian tạo", "Môn", "Trạng thái"];
    const rows = operations.map((item, index) => [
      index + 1,
      item.email || item.uid,
      totals.get(item.email) || 0,
      formatDate(item.createdAt),
      item.subject || "Chưa ghi nhận",
      item.status,
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
