"use client";

import { useMemo, useState } from "react";
import type { SecurityDashboardData, SecurityEventRecord, SecurityRiskRow } from "@/lib/security";
import type { SecurityEventReviewStatus, SecurityRiskLevel } from "@shared/security-contract";

type Props = {
  data: SecurityDashboardData | null;
  loading: boolean;
  windowDays: number;
  onWindowChange: (days: number) => void;
  onRefresh: () => Promise<void> | void;
  onReviewEvent: (eventId: string, status: SecurityEventReviewStatus, note: string) => Promise<void>;
  onSetIpOverride: (uid: string, enabled: boolean) => Promise<void>;
  onSetBlocked: (uid: string, blocked: boolean, reason: string) => Promise<void>;
};

const riskLabels: Record<SecurityRiskLevel, string> = {
  low: "Thấp",
  medium: "Trung bình",
  high: "Cao",
  critical: "Khẩn cấp",
};

function formatNumber(value: number) {
  return Math.max(0, Number(value || 0)).toLocaleString("vi-VN");
}

function formatTime(value: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(value));
}

function percent(part: number, total: number) {
  return total ? Math.round((part / total) * 100) : 0;
}

function riskMatches(row: SecurityRiskRow, query: string, level: string) {
  if (level !== "all" && row.riskLevel !== level) return false;
  if (!query) return true;
  const text = `${row.email} ${row.displayName} ${row.uid} ${row.ipHashes.join(" ")} ${row.reasons.map((item) => item.label).join(" ")}`;
  return text.toLowerCase().includes(query.toLowerCase());
}

function eventLabel(event: SecurityEventRecord) {
  if (event.type === "ip_account_limit") return "Vượt giới hạn tài khoản/IP";
  if (event.type === "generation_duplicate_input") return "Nội dung trùng giữa tài khoản";
  if (event.type === "generation_failure_spike") return "Tăng đột biến lỗi generation";
  if (event.type === "generation_token_spike") return "Tăng đột biến token";
  return event.type || "Sự kiện bảo mật";
}

export function SecurityView({
  data,
  loading,
  windowDays,
  onWindowChange,
  onRefresh,
  onReviewEvent,
  onSetIpOverride,
  onSetBlocked,
}: Props) {
  const [query, setQuery] = useState("");
  const [riskLevel, setRiskLevel] = useState("all");
  const [eventStatus, setEventStatus] = useState("open");
  const [selectedUid, setSelectedUid] = useState("");
  const [busy, setBusy] = useState("");
  const risks = useMemo(
    () => (data?.risks || []).filter((row) => riskMatches(row, query.trim(), riskLevel)),
    [data, query, riskLevel],
  );
  const events = useMemo(
    () => (data?.events || []).filter((event) => eventStatus === "all" || event.reviewStatus === eventStatus),
    [data, eventStatus],
  );
  const selected = (data?.risks || []).find((row) => row.uid === selectedUid) || null;

  async function run(key: string, action: () => Promise<void>) {
    setBusy(key);
    try {
      await action();
    } finally {
      setBusy("");
    }
  }

  async function review(event: SecurityEventRecord, status: SecurityEventReviewStatus) {
    const note = window.prompt(
      status === "dismissed" ? "Ghi chú lý do false positive:" : "Ghi chú xử lý (có thể để trống):",
      event.reviewNote || "",
    );
    if (note === null) return;
    await run(`event:${event.id}`, () => onReviewEvent(event.id, status, note));
  }

  async function changeBlocked(row: SecurityRiskRow, blocked: boolean) {
    const reason = blocked
      ? window.prompt("Nhập lý do khóa. Phiên đăng nhập sẽ bị thu hồi:", row.reasons.map((item) => item.label).join("; "))
      : "Mở khóa từ Trung tâm bảo mật";
    if (reason === null || (blocked && !reason.trim())) return;
    if (!window.confirm(`Xác nhận ${blocked ? "khóa" : "mở khóa"} ${row.email || row.uid}?`)) return;
    await run(`block:${row.uid}`, () => onSetBlocked(row.uid, blocked, reason));
  }

  if (!data && loading) return <div className="card security-loading">Đang tổng hợp tín hiệu bảo mật…</div>;
  if (!data) return <div className="card empty-state">Chưa có dữ liệu bảo mật. <button className="mini-link-button" onClick={() => void onRefresh()}>Thử tải lại</button></div>;

  const coverage = data.coverage;
  return (
    <div className="security-view grid">
      <section className="card security-hero">
        <div>
          <div className="eyebrow">Risk operations</div>
          <h2>Trung tâm bảo mật</h2>
          <p className="muted">Tín hiệu hỗ trợ điều tra — không phải kết luận gian lận và không tự động khóa tài khoản.</p>
        </div>
        <div className="security-hero-actions">
          <select className="select" value={windowDays} onChange={(event) => onWindowChange(Number(event.target.value))} aria-label="Cửa sổ quan sát">
            <option value={1}>24 giờ</option><option value={7}>7 ngày</option><option value={30}>30 ngày</option>
          </select>
          <button className="button secondary" disabled={loading} onClick={() => void onRefresh()}>{loading ? "Đang tải…" : "Làm mới"}</button>
        </div>
      </section>

      <section className="grid security-stats-grid">
        <article className="card security-stat critical"><span>Sự kiện đang mở</span><strong>{formatNumber(data.summary.openEvents)}</strong><small>Cần admin xem xét</small></article>
        <article className="card security-stat high"><span>Tài khoản rủi ro cao</span><strong>{formatNumber(data.summary.highRiskAccounts)}</strong><small>Score từ 50 điểm</small></article>
        <article className="card security-stat medium"><span>Cụm IP nhiều tài khoản</span><strong>{formatNumber(data.summary.multiAccountIpClusters)}</strong><small>Từ 2 Free/Trial account</small></article>
        <article className="card security-stat"><span>Token volume</span><strong>{formatNumber(data.summary.totalTokens)}</strong><small>Call thành công có usage</small></article>
        <article className="card security-stat"><span>Call lỗi / fallback</span><strong>{formatNumber(data.summary.failedCalls)} / {formatNumber(data.summary.fallbackCalls)}</strong><small>Trong cửa sổ quan sát</small></article>
        <article className="card security-stat"><span>Generation được hoàn</span><strong>{formatNumber(data.summary.releasedOperations)}</strong><small>Không đồng nghĩa gian lận</small></article>
      </section>

      <section className={`card security-coverage ${coverage.truncated ? "warning" : ""}`}>
        <div className="section-title-row">
          <div><div className="eyebrow">Độ phủ dữ liệu</div><h2>{formatTime(coverage.from)} → {formatTime(coverage.to)}</h2></div>
          <span className={`status-pill ${coverage.truncated ? "new" : "success-pill"}`}>{coverage.truncated ? "Đã chạm giới hạn đọc" : "Bounded query"}</span>
        </div>
        <div className="security-coverage-grid">
          <div><strong>{formatNumber(coverage.operationsScanned)}</strong><span>operation đã quét</span></div>
          <div><strong>{percent(coverage.operationsWithSecurity, coverage.operationsScanned)}%</strong><span>có security context</span></div>
          <div><strong>{percent(coverage.operationsWithTelemetry, coverage.operationsScanned)}%</strong><span>có telemetry</span></div>
          <div><strong>{formatNumber(coverage.accessRecordsScanned)}</strong><span>quan sát IP hash</span></div>
        </div>
        <p className="muted">Bản ghi trước rollout có thể thiếu IP, fingerprint hoặc staged telemetry. Thiếu dữ liệu không được hiểu là không có rủi ro.</p>
      </section>

      <section className="card">
        <div className="section-title-row"><div><div className="eyebrow">Risk queue</div><h2>Hàng đợi tài khoản</h2><p className="muted">Điểm deterministic, luôn kèm lý do cụ thể.</p></div></div>
        <div className="security-toolbar">
          <input className="input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm email, UID, hash hoặc tín hiệu…" />
          <select className="select" value={riskLevel} onChange={(event) => setRiskLevel(event.target.value)}>
            <option value="all">Mọi mức rủi ro</option><option value="critical">Khẩn cấp</option><option value="high">Cao</option><option value="medium">Trung bình</option><option value="low">Thấp</option>
          </select>
        </div>
        <div className="table-wrap"><table className="security-table"><thead><tr><th>Tài khoản</th><th>Rủi ro</th><th>Tín hiệu</th><th>Generation</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>
          {risks.map((row) => <tr key={row.uid} className={selectedUid === row.uid ? "selected" : ""}>
            <td><strong>{row.email || row.uid}</strong><div className="muted">{row.displayName || row.uid}</div><button className="mini-link-button" onClick={() => setSelectedUid(row.uid)}>Xem chi tiết</button></td>
            <td><span className={`risk-score ${row.riskLevel}`}>{row.riskScore}</span><div className="muted">{riskLabels[row.riskLevel]}</div></td>
            <td><div className="risk-reasons">{row.reasons.slice(0, 3).map((reason) => <span key={reason.code} title={reason.detail}>{reason.label} +{reason.weight}</span>)}</div></td>
            <td><strong>{formatNumber(row.operationCount)}</strong><div className="muted">Hoàn {row.releasedCount} · lỗi call {row.failedCallCount}</div></td>
            <td><div className="risk-reasons">{row.disabled ? <span className="danger">Đã khóa</span> : null}{row.ipLimitOverride ? <span className="success">Ngoại lệ IP</span> : null}{!row.disabled && !row.ipLimitOverride ? <span>Bình thường</span> : null}</div></td>
            <td><div className="security-row-actions"><button className="button secondary" disabled={Boolean(busy)} onClick={() => void run(`override:${row.uid}`, () => onSetIpOverride(row.uid, !row.ipLimitOverride))}>{row.ipLimitOverride ? "Bỏ ngoại lệ" : "Cho ngoại lệ"}</button><button className={row.disabled ? "button secondary" : "button danger"} disabled={Boolean(busy)} onClick={() => void changeBlocked(row, !row.disabled)}>{row.disabled ? "Mở khóa" : "Khóa"}</button></div></td>
          </tr>)}
          {!risks.length ? <tr><td colSpan={6}><div className="empty-state">Không có tài khoản phù hợp bộ lọc.</div></td></tr> : null}
        </tbody></table></div>
      </section>

      {selected ? <section className="card security-detail">
        <div className="section-title-row"><div><div className="eyebrow">Account detail</div><h2>{selected.email || selected.uid}</h2></div><button className="button secondary" onClick={() => setSelectedUid("")}>Đóng</button></div>
        <div className="security-detail-grid"><div><span>UID</span><strong>{selected.uid}</strong></div><div><span>IP đã quan sát</span><strong>{selected.ipCount}</strong></div><div><span>Fingerprint trùng</span><strong>{selected.duplicateGroupCount}</strong></div><div><span>Token</span><strong>{formatNumber(selected.totalTokens)}</strong></div></div>
        <div className="security-reason-list">{selected.reasons.map((reason) => <article key={reason.code}><span>+{reason.weight}</span><div><strong>{reason.label}</strong><p>{reason.detail}</p></div></article>)}</div>
        {selected.ipHashes.length ? <p className="muted">IP hash rút gọn: {selected.ipHashes.join(", ")}</p> : null}
      </section> : null}

      <div className="security-two-column">
        <section className="card"><div className="section-title-row"><div><div className="eyebrow">IP clusters</div><h2>Cụm IP hash</h2></div></div><div className="security-cluster-list">{data.ipClusters.map((cluster) => <article key={cluster.key}><div><strong>{cluster.ipHashPreview}</strong><span>{cluster.uids.length} UID · {cluster.activeFreeTrialUids.length} Free/Trial đang hoạt động</span></div><small>Lần cuối {formatTime(cluster.lastSeenAt)}</small></article>)}{!data.ipClusters.length ? <div className="empty-state">Chưa có cụm từ 2 tài khoản.</div> : null}</div></section>
        <section className="card"><div className="section-title-row"><div><div className="eyebrow">Duplicate input</div><h2>Nội dung trùng nhiều UID</h2></div></div><div className="security-cluster-list">{data.duplicateGroups.map((group) => <article key={group.key}><div><strong>{group.fingerprintPreview}</strong><span>{group.uids.length} UID · {group.operationCount} operation</span></div><small>Lần cuối {formatTime(group.lastSeenAt)}</small></article>)}{!data.duplicateGroups.length ? <div className="empty-state">Chưa có fingerprint trùng giữa nhiều UID.</div> : null}</div></section>
      </div>

      <section className="card">
        <div className="section-title-row"><div><div className="eyebrow">Security events</div><h2>Nhật ký điều tra</h2></div><select className="select security-event-filter" value={eventStatus} onChange={(event) => setEventStatus(event.target.value)}><option value="open">Đang mở</option><option value="reviewed">Đã xử lý</option><option value="dismissed">False positive</option><option value="all">Tất cả</option></select></div>
        <div className="table-wrap"><table><thead><tr><th>Sự kiện</th><th>Đối tượng</th><th>Thời gian</th><th>Trạng thái</th><th>Xử lý</th></tr></thead><tbody>
          {events.map((event) => <tr key={event.id}><td><strong>{eventLabel(event)}</strong><div className="muted">IP {event.ipHash}{event.relatedUids.length ? ` · ${event.relatedUids.length} UID liên quan` : ""}</div>{event.reviewNote ? <div className="security-event-note">{event.reviewNote}</div> : null}</td><td>{event.uid}</td><td>{formatTime(event.createdAt)}</td><td><span className={`status-pill ${event.reviewStatus === "open" ? "new" : event.reviewStatus === "dismissed" ? "muted-pill" : "success-pill"}`}>{event.reviewStatus === "open" ? "Đang mở" : event.reviewStatus === "reviewed" ? "Đã xử lý" : "False positive"}</span></td><td><div className="security-row-actions"><button className="button secondary" disabled={Boolean(busy)} onClick={() => void review(event, "reviewed")}>Đã xử lý</button><button className="button secondary" disabled={Boolean(busy)} onClick={() => void review(event, "dismissed")}>False positive</button></div></td></tr>)}
          {!events.length ? <tr><td colSpan={5}><div className="empty-state">Không có security event ở trạng thái này.</div></td></tr> : null}
        </tbody></table></div>
      </section>
    </div>
  );
}
