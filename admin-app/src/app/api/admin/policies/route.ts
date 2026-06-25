import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminError, requireAdmin, writeAuditLog } from "@/lib/admin-auth";
import { getFirebaseDb } from "@/lib/firebase-admin";
import { toIso } from "@/lib/serializers";

export const runtime = "nodejs";

const fallbackPolicies = {
  terms: "Người dùng sử dụng EduPlan AI đúng mục đích giáo dục và tự kiểm tra nội dung trước khi sử dụng.",
  privacy: "EduPlan AI lưu hồ sơ tài khoản, lượt tạo và lịch sử giáo án tạm thời để phục vụ trải nghiệm người dùng.",
  version: "1.0",
};

export async function GET() {
  try {
    await requireAdmin();
    const snapshot = await getFirebaseDb().collection("app_settings").doc("policies").get();
    const data = snapshot.data() || {};
    return NextResponse.json({
      policies: {
        ...fallbackPolicies,
        ...data,
        updatedAt: toIso(data.updatedAt),
      },
    });
  } catch (error) {
    const { message, status } = adminError(error, "Không thể tải chính sách.");
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(request: Request) {
  try {
    const admin = await requireAdmin();
    const body = (await request.json()) as { terms?: string; privacy?: string; version?: string };
    const policies = {
      terms: String(body.terms || "").trim(),
      privacy: String(body.privacy || "").trim(),
      version: String(body.version || "1.0").trim(),
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: admin.uid,
    };
    await getFirebaseDb().collection("app_settings").doc("policies").set(policies, { merge: true });
    await writeAuditLog(admin, "UPDATE_POLICIES", { version: policies.version });
    return NextResponse.json({ policies });
  } catch (error) {
    const { message, status } = adminError(error, "Không thể lưu chính sách.");
    return NextResponse.json({ error: message }, { status });
  }
}
