import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST() {
  return NextResponse.json(
    { error: "EduPlan đã ngừng tiếp nhận và duyệt bill. Thanh toán được xác nhận tự động qua payOS." },
    { status: 410 },
  );
}
