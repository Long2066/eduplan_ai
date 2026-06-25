import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminError, requireAdmin, writeAuditLog } from "@/lib/admin-auth";
import { getFirebaseDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";

const defaultLed = {
  enabled: true,
  messages: [
    "EduPlan AI chào mừng thầy cô đến với công cụ soạn giáo án thông minh",
    "Tạo giáo án chuẩn CV2345 nhanh chóng, rõ hoạt động giáo viên và học sinh",
    "Xuất Word và PDF giữ định dạng đẹp, tiện chỉnh sửa và lưu trữ",
  ],
  durationSeconds: 18,
  theme: "blue",
};

function normalizeMessages(value: unknown) {
  if (!Array.isArray(value)) return defaultLed.messages;
  return value.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 12);
}

export async function GET() {
  try {
    await requireAdmin();
    const snapshot = await getFirebaseDb().collection("app_settings").doc("header_led").get();
    return NextResponse.json({ led: { ...defaultLed, ...(snapshot.data() || {}) } });
  } catch (error) {
    const { message, status } = adminError(error, "Không thể tải cấu hình LED.");
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(request: Request) {
  try {
    const admin = await requireAdmin();
    const body = (await request.json()) as {
      enabled?: boolean;
      messages?: string[];
      durationSeconds?: number;
      theme?: string;
    };
    const led = {
      enabled: Boolean(body.enabled),
      messages: normalizeMessages(body.messages),
      durationSeconds: Math.min(120, Math.max(6, Number(body.durationSeconds || 18))),
      theme: String(body.theme || "blue").slice(0, 32),
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: admin.uid,
    };
    await getFirebaseDb().collection("app_settings").doc("header_led").set(led, { merge: true });
    await writeAuditLog(admin, "UPDATE_HEADER_LED", { durationSeconds: led.durationSeconds, messagesCount: led.messages.length });
    return NextResponse.json({ led });
  } catch (error) {
    const { message, status } = adminError(error, "Không thể lưu cấu hình LED.");
    return NextResponse.json({ error: message }, { status });
  }
}
