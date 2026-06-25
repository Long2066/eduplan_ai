import { NextResponse } from "next/server";
import { getFirebaseDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";

const defaultLed = {
  enabled: true,
  messages: [
    "EduPlan AI chào mừng thầy cô đến với công cụ soạn giáo án thông minh",
    "Tạo giáo án chuẩn CV2345 nhanh chóng, rõ hoạt động giáo viên và học sinh",
    "Xuất Word và PDF giữ định dạng đẹp, tiện chỉnh sửa và lưu trữ",
    "Dữ liệu giáo án được lưu trong 7 ngày, dễ mở lại khi cần",
  ],
  durationSeconds: 18,
  theme: "blue",
};

export async function GET() {
  try {
    const snapshot = await getFirebaseDb().collection("app_settings").doc("header_led").get();
    return NextResponse.json({ led: { ...defaultLed, ...(snapshot.data() || {}) } });
  } catch {
    return NextResponse.json({ led: defaultLed });
  }
}
