import { NextResponse } from "next/server";
import { adminError, requireAdmin } from "@/lib/admin-auth";
import { getFirebaseDb } from "@/lib/firebase-admin";
import { normalizeAiGatewaySettings } from "@shared/ai-gateway-catalog";
import { confirmsBlueImage, makeTestPayload, readableReply, type TestMode } from "./payload";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const body = (await request.json()) as {
      type?: "gateway" | "openai";
      baseUrl?: string;
      model?: string;
      mode?: TestMode;
    };
    const type = body.type || "gateway";
    const mode = body.mode || "text";
    if ((type !== "gateway" && type !== "openai") || (mode !== "text" && mode !== "vision")) {
      return NextResponse.json({ ok: false, error: "Loại kiểm tra không hợp lệ." }, { status: 400 });
    }
    const model = (body.model || "").trim();
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._/-]{0,99}$/.test(model)) {
      return NextResponse.json({ ok: false, error: "Mã model không hợp lệ." }, { status: 400 });
    }

    // Only call the saved, admin-configured Gateway. Never use a caller-supplied outbound URL or key.
    const settings = normalizeAiGatewaySettings((await getFirebaseDb().collection("app_settings").doc("system").get()).data()?.aiGateway);
    const savedBaseUrl = settings.baseUrl.replace(/\/+$/, "");
    if (type === "gateway" && (!savedBaseUrl || !settings.apiKey || body.baseUrl?.trim().replace(/\/+$/, "") !== savedBaseUrl)) {
      return NextResponse.json({ ok: false, error: "Hãy lưu URL và API Key Gateway trước khi kiểm tra." }, { status: 400 });
    }
    const endpoint = type === "gateway" ? `${savedBaseUrl}/chat/completions` : "https://api.openai.com/v1/chat/completions";
    const apiKey = type === "gateway" ? settings.apiKey : settings.openaiApiKey;
    if (!apiKey) {
      return NextResponse.json({ ok: false, error: "Hãy lưu API Key tương ứng trước khi kiểm tra." }, { status: 400 });
    }
    if (type === "gateway") {
      let url: URL;
      try { url = new URL(savedBaseUrl); } catch {
        return NextResponse.json({ ok: false, error: "URL Gateway không hợp lệ." }, { status: 400 });
      }
      if (url.protocol !== "https:" || url.username || url.password || !url.hostname.includes(".") || /^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.|::|\[)/i.test(url.hostname)) {
        return NextResponse.json({ ok: false, error: "Gateway phải dùng HTTPS trên tên miền công khai." }, { status: 400 });
      }
    }

    const start = Date.now();
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(makeTestPayload(model, mode)),
        signal: AbortSignal.timeout(25000),
        cache: "no-store",
        redirect: "error",
      });
      const latencyMs = Date.now() - start;
      if (!response.ok) {
        // Do not relay arbitrary upstream bodies: they might echo credentials or private data.
        let code = "upstream_error";
        let parameter = "";
        try {
          const data = await response.json() as { error?: { code?: string; type?: string; param?: string } };
          const candidate = data.error?.code || data.error?.type;
          if (candidate && /^[a-zA-Z0-9_.-]{1,64}$/.test(candidate)) code = candidate;
          if (data.error?.param && /^[a-zA-Z0-9_.-]{1,64}$/.test(data.error.param)) parameter = data.error.param;
        } catch { /* Non-JSON provider error. */ }
        return NextResponse.json({ ok: false, model, mode, httpStatus: response.status, code, parameter, error: `Gateway/API trả HTTP ${response.status} (${code}${parameter ? `: ${parameter}` : ""}).`, latencyMs });
      }
      const data = await response.json() as { choices?: Array<{ message?: { content?: unknown } }> };
      const reply = readableReply(data.choices?.[0]?.message?.content);
      if (!reply) return NextResponse.json({ ok: false, model, mode, error: "HTTP 200 nhưng không có câu trả lời dạng văn bản.", httpStatus: 200, latencyMs });
      if (mode === "vision" && !confirmsBlueImage(reply)) return NextResponse.json({ ok: false, model, mode, httpStatus: 200, latencyMs, error: "Model phản hồi nhưng chưa nhận diện đúng màu xanh trong ảnh thử." });
      return NextResponse.json({ ok: true, model, mode, latencyMs, httpStatus: 200, reply: reply.slice(0, 80) });
    } catch (error) {
      return NextResponse.json({ ok: false, model, mode, latencyMs: Date.now() - start, error: error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError") ? "Quá thời gian chờ 25 giây." : "Không kết nối được hoặc phản hồi API không hợp lệ." });
    }
  } catch (error) {
    const { message, status } = adminError(error, "Lỗi kiểm tra kết nối.");
    return NextResponse.json({ error: message }, { status });
  }
}
