import { NextResponse } from "next/server";
import { adminError, requireAdmin } from "@/lib/admin-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const body = (await request.json()) as {
      type?: "gateway" | "openai";
      baseUrl?: string;
      apiKey?: string;
      model?: string;
    };

    const type = body.type || "gateway";
    let endpoint = "";
    let apiKey = (body.apiKey || "").trim();
    const model = (body.model || (type === "gateway" ? "gemini-3.5-flash-lite" : "gpt-5.4-mini")).trim();

    if (type === "gateway") {
      const baseUrl = (body.baseUrl || "").trim().replace(/\/+$/, "");
      if (!baseUrl) {
        return NextResponse.json({ ok: false, error: "Vui lòng nhập Link Gateway (Base URL)." }, { status: 400 });
      }
      endpoint = `${baseUrl}/chat/completions`;
      if (!apiKey) {
        apiKey = process.env.NINEROUTER_API_KEY || "sk-30291fde1e5baa54-rmony8-33298b25";
      }
    } else {
      endpoint = "https://api.openai.com/v1/chat/completions";
      if (!apiKey) {
        apiKey = process.env.OPENAI_API_KEY || "";
      }
      if (!apiKey) {
        return NextResponse.json({ ok: false, error: "Vui lòng nhập OpenAI API Key để kiểm tra." }, { status: 400 });
      }
    }

    const start = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          stream: false,
          reasoning_effort: "low",
          messages: [{ role: "user", content: "Ping EduPlan AI. Vui lòng trả lời 1 từ: OK" }],
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);
      const elapsedMs = Date.now() - start;

      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        return NextResponse.json({
          ok: false,
          error: `HTTP ${response.status}: ${errText.slice(0, 150) || response.statusText}`,
          latencyMs: elapsedMs,
        });
      }

      const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const reply = data.choices?.[0]?.message?.content || "OK";

      return NextResponse.json({
        ok: true,
        latencyMs: elapsedMs,
        model,
        reply: reply.slice(0, 50),
      });
    } catch (fetchErr: unknown) {
      clearTimeout(timeout);
      const elapsedMs = Date.now() - start;
      const isTimeout = fetchErr instanceof Error && fetchErr.name === "AbortError";
      return NextResponse.json({
        ok: false,
        error: isTimeout ? "Kết nối quá hạn sau 12 giây (Timeout)." : (fetchErr instanceof Error ? fetchErr.message : "Không thể kết nối đến máy chủ."),
        latencyMs: elapsedMs,
      });
    }
  } catch (error) {
    const { message, status } = adminError(error, "Lỗi kiểm tra kết nối.");
    return NextResponse.json({ error: message }, { status });
  }
}
