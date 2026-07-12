import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth-server";
import { getFirebaseStorageBucket } from "@/lib/firebase-admin";
import { paymentErrorResponse, saveProofResult, type PaymentOcr } from "@/lib/payment-service";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_FILE_SIZE = 8 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function cleanJson(raw: string) {
  return raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
}

function numberOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(String(value).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

async function readBillWithAi(file: File, bytes: Buffer): Promise<PaymentOcr> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Thiếu OPENAI_API_KEY để kiểm tra bill tự động.");
  const model = process.env.PAYMENT_OCR_MODEL || process.env.OPENAI_OCR_MODEL || "gpt-4.1-mini";
  const dataUrl = `data:${file.type};base64,${bytes.toString("base64")}`;
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [{
        role: "user",
        content: [
          { type: "text", text: "Đọc ảnh biên lai chuyển khoản ngân hàng Việt Nam. Trả về DUY NHẤT JSON: amount (số VND, không dấu phân cách hoặc null), contentCode (toàn bộ nội dung chuyển khoản), senderName (tên người chuyển), transferredAt (ISO 8601 có múi giờ +07:00 hoặc null), bankTransactionId (mã giao dịch/tham chiếu), bankName, confidence (0..1), rawText (toàn bộ chữ quan trọng). Không suy đoán trường không nhìn rõ." },
          { type: "image_url", image_url: { url: dataUrl, detail: "high" } },
        ],
      }],
    }),
  });
  if (!response.ok) throw new Error(`Dịch vụ OCR bill đang lỗi (${response.status}).`);
  const result = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const raw = result.choices?.[0]?.message?.content || "{}";
  const parsed = JSON.parse(cleanJson(raw)) as Record<string, unknown>;
  return {
    amount: numberOrNull(parsed.amount),
    contentCode: String(parsed.contentCode || ""),
    senderName: String(parsed.senderName || ""),
    transferredAt: parsed.transferredAt ? String(parsed.transferredAt) : null,
    bankTransactionId: String(parsed.bankTransactionId || ""),
    bankName: String(parsed.bankName || ""),
    confidence: Math.min(1, Math.max(0, Number(parsed.confidence) || 0)),
    rawText: String(parsed.rawText || ""),
  };
}

function errorResponse(error: unknown) {
  const known = paymentErrorResponse(error);
  return NextResponse.json(known?.body || { error: error instanceof Error ? error.message : "Không thể kiểm tra bill." }, { status: known?.status || 500 });
}

export async function POST(request: Request) {
  let storagePath = "";
  try {
    const user = await requireUser();
    const form = await request.formData();
    const paymentId = String(form.get("paymentId") || "").trim();
    const file = form.get("proof");
    if (!paymentId) return NextResponse.json({ error: "Thiếu mã giao dịch." }, { status: 400 });
    if (!(file instanceof File)) return NextResponse.json({ error: "Vui lòng chọn ảnh bill." }, { status: 400 });
    if (!ALLOWED_TYPES.has(file.type)) return NextResponse.json({ error: "Bill phải là ảnh JPG, PNG hoặc WebP." }, { status: 415 });
    if (file.size < 1 || file.size > MAX_FILE_SIZE) return NextResponse.json({ error: "Ảnh bill tối đa 8 MB." }, { status: 413 });

    const bytes = Buffer.from(await file.arrayBuffer());
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    storagePath = `payment-proofs/${user.uid}/${paymentId}/${sha256}.${extension}`;
    await getFirebaseStorageBucket().file(storagePath).save(bytes, {
      resumable: false,
      contentType: file.type,
      metadata: { cacheControl: "private, max-age=0, no-store", metadata: { uid: user.uid, paymentId, sha256 } },
    });

    const ocr = await readBillWithAi(file, bytes);
    const transactionBasis = `${ocr.bankName}|${ocr.bankTransactionId}`.trim();
    const transactionFingerprint = createHash("sha256").update(transactionBasis || `unreadable:${sha256}`).digest("hex");
    const payment = await saveProofResult(paymentId, user.uid, { storagePath, sha256, transactionFingerprint }, ocr);
    return NextResponse.json({ payment });
  } catch (error) {
    return errorResponse(error);
  }
}
