"use client";

import { useEffect, useState } from "react";
import type { AppUser, PlanId } from "@/components/user-menu";

const PAYMENT_UI_COMING_SOON = true;
const planIcon: Record<PlanId, string> = { free: "◇", plus: "✦" };

function planLabel(plan: PlanId) {
  return plan === "plus" ? "Trả phí" : "Miễn phí";
}

function money(value: number) {
  return `${value.toLocaleString("vi-VN")}đ`;
}

function statusLabel(state: string) {
  return state === "active"
    ? "ĐANG SỬ DỤNG"
    : state === "trial_available"
    ? "DÙNG THỬ CÒN LẠI"
    : state === "expired"
    ? "HẾT HẠN"
    : state === "exhausted"
    ? "ĐÃ HẾT"
    : state === "purchase_required"
    ? "SẴN SÀNG NÂNG CẤP"
    : "CÓ THỂ CHỌN";
}

type PlansModalProps = {
  isOpen: boolean;
  onClose: () => void;
  user: AppUser;
  onUserChange: () => Promise<void> | void;
};

export function PlansModal({ isOpen, onClose, user, onUserChange }: PlansModalProps) {
  const [subscription, setSubscription] = useState(user.subscription);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setSubscription(user.subscription);
  }, [user.subscription]);

  useEffect(() => {
    if (!isOpen) return;
    setError("");
    setMessage("");

    let cancelled = false;
    fetch("/api/subscription/activate", { cache: "no-store" })
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (cancelled) return;
        if (ok && data?.subscription) {
          setSubscription(data.subscription);
        }
      })
      .catch(() => undefined);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      cancelled = true;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const activePlan = subscription.activePlan;
  const plusCost = subscription.cards.find((c) => c.id === "plus")?.generationCost || 10;
  const trialGenerations = Math.floor(subscription.trials.plusLimit / Math.max(1, plusCost));

  async function selectPlan(plan: PlanId) {
    setBusy(`select-${plan}`);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/subscription/activate", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const result = (await response.json()) as {
        subscription?: AppUser["subscription"];
        error?: string;
      };
      if (!response.ok || !result.subscription) {
        throw new Error(result.error || "Không thể chọn gói lúc này.");
      }
      setSubscription(result.subscription);
      setMessage(`Đã chọn gói ${planLabel(plan)} làm gói hiện tại.`);
      await onUserChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đã xảy ra lỗi.");
    } finally {
      setBusy("");
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-3 sm:p-4 backdrop-blur-sm animate-in fade-in duration-200"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-3xl bg-[#f8fafc] shadow-2xl ring-1 ring-slate-900/10 flex flex-col animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="plans-modal-title"
      >
        {/* Modal Header (Pure Plans Only) */}
        <header className="flex items-center justify-between border-b border-slate-200/80 px-5 py-4 sm:px-6 bg-white">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-md shadow-blue-600/25 font-black text-base">
              {planIcon[activePlan]}
            </span>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600">
                EduPlan Membership
              </span>
              <h2 id="plans-modal-title" className="text-lg sm:text-xl font-black text-slate-900 leading-tight">
                Quản lý Gói Sử Dụng
              </h2>
            </div>
          </div>
          <button
            type="button"
            className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
            onClick={onClose}
            aria-label="Đóng"
          >
            <span className="text-2xl leading-none">&times;</span>
          </button>
        </header>

        {/* Modal Content (2 Plans Only) */}
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {error ? <div className="account-alert error">{error}</div> : null}
          {message ? <div className="account-alert success">{message}</div> : null}

          <div className="plans-hero">
            <span className="plans-hero-kicker">EduPlan AI Membership</span>
            <h2>Nâng cấp chất lượng giáo án với AI mạnh hơn</h2>
            <p>
              Cùng một cấu trúc giáo án chuẩn, model AI cao cấp giúp nội dung mạch lạc hơn, chuyên sâu hơn và ổn định hơn, đặc biệt với bài nhiều tiết hoặc yêu cầu phức tạp.
            </p>
            <div className="plans-quality-line">
              <b>Miễn phí — Nhanh, đủ dùng</b>
              <i>·</i>
              <b>Trả phí — Mạch lạc, chuyên sâu và ổn định</b>
            </div>
          </div>

          <div className="plan-summary-strip">
            <div>
              <span>Gói đang dùng</span>
              <strong>
                {planLabel(activePlan)}
                {subscription.planStatus === "trial" ? " · Trải nghiệm" : ""}
              </strong>
            </div>
            <div>
              <span>
                {activePlan === "free"
                  ? "Lượt miễn phí hôm nay"
                  : subscription.planStatus === "trial"
                  ? "Tín dụng trải nghiệm hôm nay"
                  : "Tín dụng hiện có"}
              </span>
              <strong>
                {activePlan === "free"
                  ? `${subscription.free.remaining}/${subscription.free.limit} lượt`
                  : subscription.planStatus === "trial"
                  ? subscription.trials.plusRemaining
                  : subscription.credits.total}
              </strong>
            </div>
          </div>

          <div className="plan-grid pricing-modal-grid grid grid-cols-1 md:grid-cols-2 gap-4">
            {subscription.cards.map((card) => {
              const displayHint =
                card.id === "free" && card.hint && card.hint.includes("lượt tạo mỗi ngày")
                  ? trialGenerations > 0
                    ? card.hint.replace(
                        /\d+\s+lượt tạo mỗi ngày/,
                        `${trialGenerations} lượt tạo mỗi ngày`,
                      )
                    : "Cần nội dung chuyên sâu hơn, bám sát nhu cầu thực tế hơn? Gói Giáo viên sắp ra mắt sẽ mở khóa model AI cao cấp."
                  : card.hint;

              return (
                <article
                  key={card.id}
                  className={`plan-card plan-${card.id} ${card.active ? "is-active" : ""}`}
                >
                  <div className="plan-card-glow" />
                  <div className="plan-card-shine" aria-hidden="true" />
                  <div className="plan-card-top">
                    <span className="plan-gem">{planIcon[card.id]}</span>
                    <span className={`plan-badge badge-${card.id}`}>{card.badge}</span>
                    <span className={`plan-state ${card.active ? "active" : ""}`}>
                      {PAYMENT_UI_COMING_SOON &&
                      card.id === "plus" &&
                      !card.paid &&
                      !card.active &&
                      card.state !== "trial_available"
                        ? "COMING SOON"
                        : statusLabel(card.state)}
                    </span>
                  </div>
                  <h3 className="plan-name">{card.title}</h3>
                  {PAYMENT_UI_COMING_SOON && card.id === "plus" ? (
                    <div className="plan-price plan-price-coming-soon">
                      <strong>Coming soon</strong>
                    </div>
                  ) : (
                    <div className="plan-price">
                      {card.listPriceVnd ? <del>{money(card.listPriceVnd)}</del> : null}
                      <strong>{card.priceVnd ? money(card.priceVnd) : "0đ"}</strong>
                      <span>{card.id === "free" ? "· Không giới hạn thời gian" : "/ 30 ngày"}</span>
                    </div>
                  )}
                  <p className="plan-description">{card.description}</p>
                  <p className="plan-reason">{card.reason}</p>
                  <ul>
                    {card.benefits.map((item) => {
                      const dynamicItem =
                        card.id === "free" && item.includes("lượt tạo giáo án miễn phí")
                          ? `${subscription.free.limit} lượt tạo giáo án miễn phí mỗi ngày.`
                          : item;
                      return (
                        <li key={item}>
                          ✓ <span>{dynamicItem}</span>
                        </li>
                      );
                    })}
                  </ul>
                  {displayHint ? <p className="plan-hint">{displayHint}</p> : null}
                  {card.active ? (
                    <button
                      id={`modal-select-plan-${card.id}`}
                      type="button"
                      className="plan-action selected"
                      disabled
                    >
                      Gói hiện tại
                    </button>
                  ) : card.id === "free" ? (
                    card.selectable ? (
                      <button
                        id="modal-select-plan-free"
                        type="button"
                        className="plan-action"
                        disabled={Boolean(busy)}
                        onClick={() => selectPlan("free")}
                      >
                        {busy === "select-free" ? "Đang chọn..." : "Chọn gói"}
                      </button>
                    ) : (
                      <button
                        id="modal-select-plan-free"
                        type="button"
                        className="plan-action"
                        disabled
                      >
                        Chờ reset 00:00
                      </button>
                    )
                  ) : card.paid ? (
                    <button
                      id={`modal-select-plan-${card.id}`}
                      type="button"
                      className={`plan-action choose-owned ${
                        busy === `select-${card.id}` ? "is-loading" : ""
                      }`}
                      disabled={Boolean(busy)}
                      onClick={() => selectPlan(card.id)}
                    >
                      {busy === `select-${card.id}` ? "Đang chọn..." : "Chọn gói"}
                    </button>
                  ) : card.state === "trial_available" ? (
                    <button
                      id={`modal-select-trial-${card.id}`}
                      type="button"
                      className="plan-trial-action"
                      disabled={Boolean(busy)}
                      onClick={() => selectPlan(card.id)}
                    >
                      {busy === `select-${card.id}`
                        ? "Đang chọn..."
                        : `Trải nghiệm gói Trả phí · ${card.remaining} tín dụng`}
                    </button>
                  ) : (
                    <button
                      id={`modal-buy-plan-${card.id}`}
                      type="button"
                      className="plan-action coming-soon"
                      disabled
                    >
                      Coming soon
                    </button>
                  )}
                </article>
              );
            })}
          </div>

          <p className="plans-note">
            Hai gói sử dụng cùng cấu trúc giáo án và bộ kiểm tra sư phạm. Gói Trả phí dùng model AI cao cấp hơn để tăng độ sâu, tính mạch lạc và ổn định. Chất lượng kết quả còn phụ thuộc vào nội dung SGK và thông tin bạn cung cấp.
          </p>

          <div className="payment-zone payment-zone-single">
            <div className="payment-config payment-coming-soon">
              <p className="account-section-label">Mua thêm tín dụng</p>
              <strong>Coming soon</strong>
              <p>
                Tính năng mua tín dụng sẽ được mở trong phiên bản chính thức. Tín dụng do Admin cấp vẫn sử dụng bình thường.
              </p>
            </div>
          </div>
        </div>

        <footer className="border-t border-slate-200/80 px-6 py-3.5 bg-white flex justify-end">
          <button
            type="button"
            className="inline-flex min-h-[44px] items-center justify-center px-5 py-2 rounded-xl text-sm font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 active:scale-[0.98] transition-all"
            onClick={onClose}
          >
            Đóng
          </button>
        </footer>
      </div>
    </div>
  );
}
