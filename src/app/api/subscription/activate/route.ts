import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth-server";
import { activatePlan, getSubscriptionStatus, subscriptionErrorResponse } from "@/lib/subscription-policy";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await requireUser();
    return NextResponse.json({ subscription: await getSubscriptionStatus(user.uid) });
  } catch (error) {
    const known = subscriptionErrorResponse(error);
    return NextResponse.json(known?.body || { error: error instanceof Error ? error.message : "Không thể tải thông tin gói." }, { status: known?.status || 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = (await request.json()) as { plan?: unknown };
    const subscription = await activatePlan(user.uid, body.plan);
    return NextResponse.json({ ok: true, subscription });
  } catch (error) {
    const known = subscriptionErrorResponse(error);
    return NextResponse.json(known?.body || { error: error instanceof Error ? error.message : "Không thể kích hoạt gói." }, { status: known?.status || 500 });
  }
}
