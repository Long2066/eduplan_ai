import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth-server";
import { activatePlan, getSubscriptionStatus, subscriptionErrorResponse } from "@/lib/subscription-policy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStoreHeaders = { "Cache-Control": "private, no-store, no-cache, max-age=0, must-revalidate" };

function errorStatus(error: unknown, policyStatus?: number) {
  if (policyStatus) return policyStatus;
  if (error instanceof Error && error.name === "UNAUTHENTICATED") return 401;
  if (error instanceof Error && error.name === "ACCOUNT_DISABLED") return 403;
  return 500;
}

export async function GET() {
  try {
    const user = await requireUser();
    return NextResponse.json({ subscription: await getSubscriptionStatus(user.uid) }, { headers: noStoreHeaders });
  } catch (error) {
    const known = subscriptionErrorResponse(error);
    return NextResponse.json(
      known?.body || { error: error instanceof Error ? error.message : "Không thể tải thông tin gói." },
      { status: errorStatus(error, known?.status), headers: noStoreHeaders },
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = (await request.json()) as { plan?: unknown };
    const subscription = await activatePlan(user.uid, body.plan);
    return NextResponse.json({ ok: true, subscription }, { headers: noStoreHeaders });
  } catch (error) {
    const known = subscriptionErrorResponse(error);
    return NextResponse.json(
      known?.body || { error: error instanceof Error ? error.message : "Không thể kích hoạt gói." },
      { status: errorStatus(error, known?.status), headers: noStoreHeaders },
    );
  }
}
