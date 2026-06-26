"use client";

import { useState } from "react";

const categoryOptions = [
  { value: "bug", label: "Báo lỗi" },
  { value: "improvement", label: "Góp ý cải thiện" },
  { value: "feature", label: "Yêu cầu tính năng" },
  { value: "other", label: "Khác" },
];

export function FeedbackWidget() {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState("improvement");
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submitFeedback() {
    setNotice("");
    setError("");
    if (message.trim().length < 5) {
      setError("Thầy/cô vui lòng nhập góp ý rõ hơn một chút.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          message,
          pageUrl: window.location.href,
        }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Không thể gửi góp ý.");
      setMessage("");
      setCategory("improvement");
      setNotice("Đã gửi góp ý. Cảm ơn thầy/cô đã giúp EduPlan AI tốt hơn.");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Không thể gửi góp ý lúc này.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="feedback-widget">
      {open ? (
        <section className="feedback-panel" aria-label="Hòm thư góp ý">
          <div className="feedback-panel-header">
            <div>
              <p>Hòm thư góp ý</p>
              <h2>Gửi phản hồi</h2>
            </div>
            <button type="button" className="feedback-close" onClick={() => setOpen(false)} aria-label="Đóng góp ý">
              ×
            </button>
          </div>

          <label className="feedback-label">
            Loại góp ý
            <select className="feedback-select" value={category} onChange={(event) => setCategory(event.target.value)}>
              {categoryOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>

          <label className="feedback-label">
            Nội dung
            <textarea
              className="feedback-textarea"
              placeholder="Thầy/cô muốn EduPlan AI cải thiện điều gì?"
              value={message}
              maxLength={5000}
              onChange={(event) => setMessage(event.target.value)}
            />
          </label>

          <div className="feedback-meta">
            <span>{message.length}/5000</span>
          </div>

          {error ? <div className="feedback-message feedback-error">{error}</div> : null}
          {notice ? <div className="feedback-message feedback-success">{notice}</div> : null}

          <button type="button" className="feedback-submit" disabled={submitting} onClick={submitFeedback}>
            {submitting ? "Đang gửi..." : "Gửi góp ý"}
          </button>
        </section>
      ) : null}

      <button type="button" className="feedback-fab" onClick={() => setOpen((current) => !current)} aria-label="Mở hòm thư góp ý">
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
          <path d="M5 6.5h14v9H8.5L5 19v-3.5H5v-9Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          <path d="M8 10h8M8 13h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <span>Góp ý</span>
      </button>
    </div>
  );
}
