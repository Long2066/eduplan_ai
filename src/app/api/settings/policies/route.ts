import { NextResponse } from "next/server";
import { getFirebaseDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";

const fallbackPolicies = {
  terms: "Người dùng sử dụng EduPlan AI đúng mục đích giáo dục, không tải dữ liệu nhạy cảm không cần thiết và tự kiểm tra giáo án trước khi sử dụng.",
  privacy: "EduPlan AI lưu hồ sơ tài khoản, lượt tạo và lịch sử giáo án tạm thời để phục vụ trải nghiệm người dùng.",
  version: "1.0",
};

export async function GET() {
  try {
    const snapshot = await getFirebaseDb().collection("app_settings").doc("policies").get();
    return NextResponse.json({ policies: { ...fallbackPolicies, ...(snapshot.data() || {}) } });
  } catch {
    return NextResponse.json({ policies: fallbackPolicies });
  }
}
