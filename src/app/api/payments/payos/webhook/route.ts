import { NextResponse } from "next/server";
import { paymentErrorResponse, processPayosWebhook } from "@/lib/payment-service";
import { PayosClientError, type PayosWebhookPayload } from "@/lib/payos-client";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const payload = await request.json() as PayosWebhookPayload;
    const result = await processPayosWebhook(payload);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const known = paymentErrorResponse(error);
    const status = known?.status || (error instanceof PayosClientError ? error.status : 500);
    return NextResponse.json({ success: false, error: known?.body.error || (error instanceof Error ? error.message : "Không thể xử lý webhook payOS.") }, { status });
  }
}
