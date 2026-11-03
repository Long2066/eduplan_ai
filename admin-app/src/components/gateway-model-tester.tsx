"use client";

import { useEffect, useState } from "react";
import { ALL_GATEWAY_MODELS } from "@shared/ai-gateway-catalog";

type Result = { ok: boolean; error?: string; reply?: string; latencyMs?: number; httpStatus?: number; code?: string };

export function GatewayModelTester({ baseUrl, apiKey }: { baseUrl: string; apiKey: string }) {
  const [results, setResults] = useState<Record<string, Result>>({});
  const [busy, setBusy] = useState("");
  const [filter, setFilter] = useState("");
  useEffect(() => { setResults({}); }, [baseUrl, apiKey]);

  async function test(model: string, mode: "text" | "vision") {
    const id = `${model}:${mode}`;
    setBusy(id);
    try {
      const response = await fetch("/api/admin/settings/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "gateway", baseUrl, model, mode }),
      });
      const data = await response.json() as Result;
      setResults((current) => ({ ...current, [id]: response.ok ? data : { ok: false, error: data.error || `HTTP ${response.status}` } }));
    } catch {
      setResults((current) => ({ ...current, [id]: { ok: false, error: "Không thể kết nối trang quản trị." } }));
    } finally {
      setBusy("");
    }
  }

  const visible = ALL_GATEWAY_MODELS.filter((m) => `${m.id} ${m.name}`.toLowerCase().includes(filter.toLowerCase()));
  return <section className="gateway-tester" aria-labelledby="gateway-tester-heading">
    <div className="gateway-tester-heading">
      <div>
        <h3 id="gateway-tester-heading">Kiểm tra từng model</h3>
        <p>Văn bản và nhận ảnh là hai phép thử riêng. Nhận ảnh thành công chưa chứng minh chất lượng OCR tài liệu SGK.</p>
      </div>
      <label className="gateway-tester-search">
        <span className="label">Tìm model</span>
        <input className="input" type="search" value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Nhập tên hoặc mã model" />
      </label>
    </div>
    <p className="gateway-tester-hint">Lưu URL và API Key Gateway trước khi thử. Không tự gọi hàng loạt để tránh giới hạn lượt.</p>
    {visible.length === 0 ? <div className="gateway-tester-empty" role="status"><span aria-hidden="true">⌕</span><strong>Không tìm thấy model</strong><p>Thử từ khóa khác để tiếp tục kiểm tra.</p><button type="button" className="button secondary" onClick={() => setFilter("")}>Xóa bộ lọc</button></div> :
      <div className="gateway-tester-list">
        {visible.map((model) => <div className="gateway-tester-row" key={model.id}>
          <div className="gateway-tester-name"><strong>{model.name}</strong><small>{model.provider} · {model.id}</small></div>
          {(["text", "vision"] as const).map((mode) => {
            const id = `${model.id}:${mode}`;
            const result = results[id];
            return <div className="gateway-tester-cell" key={mode}>
              <button type="button" className="button secondary gateway-tester-button" disabled={!!busy || !baseUrl || !apiKey} onClick={() => test(model.id, mode)} aria-label={`Thử ${mode === "text" ? "văn bản" : "nhận ảnh"} với ${model.name}`}>
                {busy === id ? "Đang thử…" : mode === "text" ? "Thử văn bản" : "Thử nhận ảnh"}
              </button>
              <span className={`gateway-tester-result ${result ? result.ok ? "gateway-tester-success" : "gateway-tester-error" : ""}`} role="status">
                {busy === id ? <span className="gateway-tester-skeleton" aria-label="Đang gửi yêu cầu" /> : result ? `${result.ok ? "✓ Có phản hồi" : "✕ Lỗi"}${result.httpStatus ? ` · HTTP ${result.httpStatus}` : ""}${result.latencyMs !== undefined ? ` · ${result.latencyMs} ms` : ""}${result.error ? ` · ${result.error}` : ""}` : "Chưa thử"}
              </span>
            </div>;
          })}
        </div>)}
      </div>}
  </section>;
}
