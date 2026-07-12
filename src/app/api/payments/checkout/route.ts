import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth-server";
import { createCheckout, getPaymentForUser, paymentErrorResponse, type CheckoutInput } from "@/lib/payment-service";

export const runtime = "nodejs";

function errorResponse(error: unknown) {
  const known = paymentErrorResponse(error);
  return NextResponse.json(known?.body || { error: error instanceof Error ? error.message : "Không thể xử lý thanh toán." }, { status: known?.status || 500 });
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const input = (await request.json()) as CheckoutInput;
    const payment = await createCheckout(user.uid, user.displayName || user.email, input);
    return NextResponse.json({ payment }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const id = new URL(request.url).searchParams.get("id") || "";
    const payment = await getPaymentForUser(user.uid, id);
    return NextResponse.json({ payment });
  } catch (error) {
    return errorResponse(error);
  }
}
