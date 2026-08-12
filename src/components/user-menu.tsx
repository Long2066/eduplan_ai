"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import QRCode from "qrcode";
import { sendEmailVerification, signOut, updatePassword } from "firebase/auth";
import { getEmailActionSettings, getFirebaseClientAuth, hasFirebaseClientConfig } from "@/lib/firebase-client";
import { optimizeAvatarImage } from "@/lib/client-image-processing";
import { formatPaymentCountdown, isTerminalPaymentStatus, paymentStorageKey } from "@/lib/payment-ui";
import type { LessonPlan } from "@/types/lesson";

export type PlanId = "free" | "plus";
type PlanCard = { id: PlanId; name: string; badge: string; title: string; priceVnd: number; listPriceVnd: number; includedCredits: number; generationCost: number; dailyLimit?: number; trialGenerations: number; description: string; benefits: string[]; cta: string; hint?: string; state: string; selectable: boolean; active: boolean; reason: string; remaining: number; expiresAt: string | null; paid: boolean };
type SubscriptionStatus = { activePlan: PlanId; planStatus: string; cards: PlanCard[]; free: { used: number; limit: number; remaining: number; resetAt: string }; credits: { package: number; topup: number; total: number; expiresAt: string | null }; trials: { plusRemaining: number; plusUsed: number; plusLimit: number; resetAt: string; proRemaining: number } };

export type AppUser = { uid: string; email: string; displayName: string; photoURL: string; emailVerified: boolean; disabled: boolean; blockedReason: string; blockedReasonDetail: string; role: "user" | "admin"; plan: string; freeLimit: number; usedGenerations: number; remainingGenerations: number; subscription: SubscriptionStatus };
type LessonHistoryItem = { id: string; title: string; subject: string; grade: string; periods: number; updatedAt: string; expiresAt: string };
type Payment = { id: string; provider: "payos" | "bank_transfer"; purchaseType: "package" | "topup"; targetPlan: PlanId; amountVnd: number; credits: number; orderCode: number | null; paymentLinkId: string; checkoutUrl: string; qrCode: string; transferContent: string; senderName: string; status: string; safeReason: string; createdAt: string | null; expiresAt: string | null; bank: { bankName: string; accountName: string; accountNumber: string; qrImageUrl: string; configured: boolean } };
type UserMenuProps = { user: AppUser; onUserChange: () => Promise<void> | void; onOpenLesson: (lesson: LessonPlan, lessonId: string) => void };

const PAYMENT_UI_COMING_SOON = true;
const planIcon: Record<PlanId, string> = { free: "◇", plus: "✦" };
function planLabel(plan: PlanId) { return plan === "plus" ? "Trả phí" : "Miễn phí"; }
function money(value: number) { return `${value.toLocaleString("vi-VN")}đ`; }
function daysLeft(expiresAt: string) { const time = new Date(expiresAt).getTime(); if (!Number.isFinite(time)) return ""; return `Còn ${Math.ceil(Math.max(0, time - Date.now()) / 86_400_000)} ngày`; }
function statusLabel(state: string) { return state === "active" ? "ĐANG SỬ DỤNG" : state === "trial_available" ? "DÙNG THỬ CÒN LẠI" : state === "expired" ? "HẾT HẠN" : state === "exhausted" ? "ĐÃ HẾT" : state === "purchase_required" ? "SẴN SÀNG NÂNG CẤP" : "CÓ THỂ CHỌN"; }
function paymentStatusLabel(status: string) { return status === "approved" ? "ĐÃ THANH TOÁN" : status === "pending_review" ? "ĐANG ĐỐI SOÁT" : status === "expired" ? "HẾT HẠN" : status === "rejected" ? "ĐÃ TỪ CHỐI" : status === "provider_failed" ? "LỖI PAYOS" : status === "creating" ? "ĐANG TẠO" : "CHỜ THANH TOÁN"; }

export function UserMenu({ user, onUserChange, onOpenLesson }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"profile" | "plans" | "history">("profile");
  const [displayName, setDisplayName] = useState(user.displayName);
  const [newPassword, setNewPassword] = useState("");
  const [lessons, setLessons] = useState<LessonHistoryItem[]>([]);
  const [subscription, setSubscription] = useState(user.subscription);
  const [topupAmount, setTopupAmount] = useState(25_000);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentQrUrl, setPaymentQrUrl] = useState("");
  const [paymentSecondsLeft, setPaymentSecondsLeft] = useState(0);
  const [copiedPaymentField, setCopiedPaymentField] = useState("");
  const [avatar, setAvatar] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState("");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const modalRef = useRef<HTMLDivElement>(null);
  const subscriptionRequestRef = useRef(0);

  useEffect(() => { setDisplayName(user.displayName); setSubscription(user.subscription); }, [user]);
  useEffect(() => { if (!avatar) { setAvatarPreview(""); return; } const url = URL.createObjectURL(avatar); setAvatarPreview(url); return () => URL.revokeObjectURL(url); }, [avatar]);
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (paymentModalOpen) setPaymentModalOpen(false);
      else setOpen(false);
    };
    document.body.style.overflow = "hidden"; document.addEventListener("keydown", close);
    return () => { document.body.style.overflow = ""; document.removeEventListener("keydown", close); };
  }, [open, paymentModalOpen]);
  useEffect(() => { if (open && tab === "history") loadLessons().catch(showError); }, [open, tab]);
  useEffect(() => {
    if (!open || tab !== "plans") return;
    refreshAccount().catch(showError);
    const storedId = window.localStorage.getItem(paymentStorageKey(user.uid));
    if (!storedId || payment?.id === storedId) return;
    getPayment(storedId).then((storedPayment) => {
      if (isTerminalPaymentStatus(storedPayment.status)) {
        window.localStorage.removeItem(paymentStorageKey(user.uid));
        return;
      }
      setPayment(storedPayment);
    }).catch(() => window.localStorage.removeItem(paymentStorageKey(user.uid)));
  }, [open, tab, user.uid, payment?.id]);
  useEffect(() => {
    if (!payment?.qrCode) { setPaymentQrUrl(""); return; }
    let cancelled = false;
    QRCode.toDataURL(payment.qrCode, { width: 380, margin: 1, errorCorrectionLevel: "M", color: { dark: "#061b18", light: "#ffffff" } })
      .then((url) => { if (!cancelled) setPaymentQrUrl(url); })
      .catch(() => { if (!cancelled) setPaymentQrUrl(""); });
    return () => { cancelled = true; };
  }, [payment?.qrCode]);
  useEffect(() => {
    if (!payment?.expiresAt || isTerminalPaymentStatus(payment.status)) { setPaymentSecondsLeft(0); return; }
    const update = () => setPaymentSecondsLeft(Math.max(0, Math.ceil((new Date(payment.expiresAt || "").getTime() - Date.now()) / 1000)));
    update();
    const interval = window.setInterval(update, 1000);
    return () => window.clearInterval(interval);
  }, [payment?.expiresAt, payment?.status]);
  useEffect(() => {
    if (!open || tab !== "plans" || !payment?.id || isTerminalPaymentStatus(payment.status)) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const updated = await getPayment(payment.id);
        if (cancelled) return;
        setPayment(updated);
        if (isTerminalPaymentStatus(updated.status)) window.localStorage.removeItem(paymentStorageKey(user.uid));
        if (updated.status === "approved") {
          setMessage(updated.safeReason || "Thanh toán đã được xác nhận.");
          await refreshAccount();
        }
      } catch {
        // A transient polling error must not interrupt the checkout UI.
      }
    };
    const interval = window.setInterval(() => { void poll(); }, 4000);
    return () => { cancelled = true; window.clearInterval(interval); };
  }, [open, tab, payment?.id, payment?.status, user.uid]);

  function showError(value: unknown) { setError(value instanceof Error ? value.message : "Đã xảy ra lỗi."); }
  function begin(key: string) { setBusy(key); setError(""); setMessage(""); }
  async function parse<T>(response: Response): Promise<T> { const result = await response.json() as T & { error?: string }; if (!response.ok) throw new Error(result.error || "Yêu cầu không thành công."); return result; }
  async function loadLessons() { const result = await parse<{ lessons?: LessonHistoryItem[] }>(await fetch("/api/lessons")); setLessons(result.lessons || []); }
  async function refreshAccount() {
    const requestId = ++subscriptionRequestRef.current;
    const result = await parse<{ subscription: SubscriptionStatus }>(await fetch("/api/subscription/activate", { cache: "no-store" }));
    if (requestId !== subscriptionRequestRef.current) return;
    setSubscription(result.subscription);
    await onUserChange();
  }
  async function getPayment(id: string) {
    const result = await parse<{ payment: Payment }>(await fetch(`/api/payments/checkout?id=${encodeURIComponent(id)}`, { cache: "no-store" }));
    return result.payment;
  }
  async function handleLogout() { await fetch("/api/auth/logout", { method: "POST" }); if (hasFirebaseClientConfig()) await signOut(getFirebaseClientAuth()).catch(() => undefined); window.location.reload(); }

  async function handleSaveProfile() { begin("profile"); try { await parse(await fetch("/api/user/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ displayName }) })); setMessage("Đã lưu hồ sơ."); await onUserChange(); } catch (e) { showError(e); } finally { setBusy(""); } }
  async function handleAvatarSelect(file: File | null) {
    if (!file) {
      setAvatar(null);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setAvatar(null);
      setError("Ảnh đại diện tối đa 5 MB.");
      return;
    }
    begin("avatar-optimize");
    try {
      setAvatar(await optimizeAvatarImage(file));
    } catch (value) {
      setAvatar(null);
      showError(value);
    } finally {
      setBusy("");
    }
  }
  async function handleAvatarUpload() {
    if (!avatar) return setError("Vui lòng chọn ảnh đại diện.");
    begin("avatar"); try { const body = new FormData(); body.set("avatar", avatar); await parse(await fetch("/api/user/avatar", { method: "POST", body })); setAvatar(null); setMessage("Đã cập nhật ảnh đại diện."); await onUserChange(); } catch (e) { showError(e); } finally { setBusy(""); }
  }
  async function handleChangePassword() { begin("password"); try { if (newPassword.length < 6) throw new Error("Mật khẩu mới cần tối thiểu 6 ký tự."); const current = getFirebaseClientAuth().currentUser; if (!current) throw new Error("Vui lòng đăng nhập lại."); await updatePassword(current, newPassword); setNewPassword(""); setMessage("Đã đổi mật khẩu."); } catch (e) { showError(e); } finally { setBusy(""); } }
  async function handleSendVerification() { begin("verification"); try { const current = getFirebaseClientAuth().currentUser; if (!current) throw new Error("Vui lòng đăng nhập lại."); await sendEmailVerification(current, getEmailActionSettings()); setMessage("Đã gửi lại email xác minh."); } catch (e) { showError(e); } finally { setBusy(""); } }
  async function selectPlan(plan: PlanId) {
    const requestId = ++subscriptionRequestRef.current;
    begin(`select-${plan}`);
    try {
      const result = await parse<{ subscription: SubscriptionStatus }>(await fetch("/api/subscription/activate", { method: "POST", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan }) }));
      if (requestId !== subscriptionRequestRef.current) return;
      setSubscription(result.subscription);
      setMessage(`Đã chọn gói ${planLabel(plan)} làm gói hiện tại.`);
      await onUserChange();
    } catch (e) { showError(e); } finally { setBusy(""); }
  }
  async function checkout(purchaseType: "package" | "topup", targetPlan?: PlanId) {
    if (payment && !isTerminalPaymentStatus(payment.status)) {
      setPaymentModalOpen(true);
      setMessage("Bạn đang có một đơn payOS chờ thanh toán.");
      return;
    }
    begin("checkout"); try {
      const result = await parse<{ payment: Payment }>(await fetch("/api/payments/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ purchaseType, targetPlan, amountVnd: purchaseType === "topup" ? topupAmount : undefined }) }));
      setPayment(result.payment);
      window.localStorage.setItem(paymentStorageKey(user.uid), result.payment.id);
      setPaymentModalOpen(true);
      setMessage("Đã tạo VietQR payOS. Quét mã để hoàn tất thanh toán.");
    } catch (e) { showError(e); } finally { setBusy(""); }
  }
  async function copyPaymentValue(field: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedPaymentField(field);
      window.setTimeout(() => setCopiedPaymentField((current) => current === field ? "" : current), 1400);
    } catch {
      setError("Không thể sao chép tự động. Vui lòng chọn và sao chép thủ công.");
    }
  }
  async function handleOpenLesson(id: string) { try { const result = await parse<{ lesson: LessonPlan; lessonId?: string }>(await fetch(`/api/lessons/${id}`)); onOpenLesson(result.lesson, result.lessonId || id); setOpen(false); } catch (e) { showError(e); } }
  async function handleDeleteLesson(id: string) { await fetch(`/api/lessons/${id}`, { method: "DELETE" }); await loadLessons(); }

  const activePlan = subscription.activePlan;
  const activeCard = subscription.cards.find((card) => card.id === activePlan);
  const ownedPaidCard = subscription.cards.find((card) => card.paid);
  const canTopup = Boolean(ownedPaidCard);
  const avatarClass = `account-avatar account-avatar-${activePlan}`;
  const avatarUrl = avatarPreview || user.photoURL;

  return <div className="relative">
    <button id="open-account-center" className="group flex items-center gap-2.5 rounded-xl border border-surface-200 bg-white/80 px-3 py-2 text-left shadow-soft backdrop-blur-sm transition hover:-translate-y-0.5 hover:shadow-card-hover" onClick={() => setOpen(true)} aria-haspopup="dialog">
      <span className={avatarClass}>{user.photoURL ? <img src={user.photoURL} alt="Ảnh đại diện" /> : (user.displayName || user.email || "U").slice(0, 1).toUpperCase()}</span>
      <span className="hidden min-w-0 sm:block"><span className="block max-w-[150px] truncate text-sm font-bold text-slate-900">{user.displayName || "Người dùng"}</span><span className="block text-[11px] font-bold uppercase text-emerald-600">{planLabel(activePlan)} · {activeCard?.remaining || 0} còn lại</span></span>
    </button>

    {open ? <div className="account-overlay" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
      <div ref={modalRef} className="account-center" role="dialog" aria-modal="true" aria-labelledby="account-center-title">
        <header className="account-center-header"><div className="flex min-w-0 items-center gap-4"><span className={`${avatarClass} account-avatar-large`}>{user.photoURL ? <img src={user.photoURL} alt="Ảnh đại diện" /> : (user.displayName || "U").slice(0, 1).toUpperCase()}</span><div className="min-w-0"><p className="account-eyebrow">EduPlan membership</p><h2 id="account-center-title" className="truncate text-xl font-black text-white">{user.displayName || "Trung tâm tài khoản"}</h2><p className="truncate text-xs text-slate-300">{user.email}</p></div></div><button id="close-account-center" className="account-close" onClick={() => setOpen(false)} aria-label="Đóng">×</button></header>
        <nav className="account-tabs" aria-label="Trung tâm tài khoản">{([['profile','Hồ sơ'],['plans','Quản lý Gói'],['history','Lịch sử']] as const).map(([id,label]) => <button id={`account-tab-${id}`} key={id} className={tab === id ? "active" : ""} onClick={() => { setTab(id); setError(""); setMessage(""); }}>{label}</button>)}</nav>
        <main className="account-content">
          {error ? <div className="account-alert error">{error}</div> : null}{message ? <div className="account-alert success">{message}</div> : null}
          {tab === "profile" ? <section className="account-profile-grid">
            <article className="account-panel"><p className="account-section-label">Ảnh đại diện</p><div className="avatar-editor"><span className={`${avatarClass} avatar-editor-preview`}>{avatarUrl ? <img src={avatarUrl} alt="Xem trước ảnh đại diện" /> : (user.displayName || "U").slice(0, 1).toUpperCase()}</span><div><label className="avatar-file-label" htmlFor="profile-avatar">Chọn ảnh mới</label><input id="profile-avatar" className="avatar-file-input" type="file" accept="image/jpeg,image/png,image/webp" disabled={busy === "avatar-optimize"} onChange={(e) => { void handleAvatarSelect(e.target.files?.[0] || null); e.target.value = ""; }} /><p>JPG, PNG hoặc WebP · tối đa 5 MB</p><button id="upload-avatar" className="btn-primary mt-3" disabled={!avatar || Boolean(busy)} onClick={handleAvatarUpload}>{busy === "avatar-optimize" ? "Đang tối ưu ảnh..." : busy === "avatar" ? "Đang tải ảnh..." : "Đổi ảnh đại diện"}</button></div></div></article>
            <article className="account-panel"><p className="account-section-label">Thông tin cá nhân</p><label className="account-label">Họ và tên<input id="profile-display-name" className="input-field mt-2" value={displayName} onChange={(e) => setDisplayName(e.target.value)} /></label><div className="account-facts"><span>Email</span><strong>{user.email}</strong><span>Xác minh</span><strong className={user.emailVerified ? "text-emerald-600" : "text-amber-600"}>{user.emailVerified ? "Đã xác minh" : "Chưa xác minh"}</strong><span>Gói AI mặc định</span><strong>{planLabel(activePlan)}</strong></div><div className="mt-5 flex flex-wrap gap-2"><button id="save-profile" className="btn-primary" disabled={busy === "profile"} onClick={handleSaveProfile}>Lưu hồ sơ</button>{!user.emailVerified ? <button id="verify-email" className="btn-secondary" onClick={handleSendVerification}>Gửi xác minh</button> : null}</div></article>
            <article className="account-panel account-membership-panel"><p className="account-section-label">Quyền lợi hiện tại</p><div className="membership-orb">{planIcon[activePlan]}</div><h3 className="mt-4 text-2xl font-black text-slate-900">{planLabel(activePlan)}</h3><p className="mt-1 text-sm text-slate-500">{activeCard?.reason}</p><div className="membership-meter"><span style={{ width: `${Math.min(100, activePlan === 'free' ? subscription.free.used / Math.max(1, subscription.free.limit) * 100 : 100)}%` }} /></div><button id="go-to-plans" className="btn-secondary mt-5 w-full" onClick={() => setTab("plans")}>Quản lý gói</button></article>
            <article className="account-panel account-password"><p className="account-section-label">Bảo mật</p><div className="flex gap-3"><input id="new-password" className="input-field" type="password" placeholder="Mật khẩu mới (tối thiểu 6 ký tự)" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} /><button id="change-password" className="btn-secondary shrink-0" disabled={busy === "password"} onClick={handleChangePassword}>Đổi mật khẩu</button></div></article>
          </section> : null}

          {tab === "plans" ? <section>
            <div className="plans-hero"><span className="plans-hero-kicker">EduPlan AI Membership</span><h2>Nâng cấp chất lượng giáo án với AI mạnh hơn</h2><p>Cùng một cấu trúc giáo án chuẩn, model AI cao cấp giúp nội dung mạch lạc hơn, chuyên sâu hơn và ổn định hơn, đặc biệt với bài nhiều tiết hoặc yêu cầu phức tạp.</p><div className="plans-quality-line"><b>Miễn phí — Nhanh, đủ dùng</b><i>·</i><b>Trả phí — Mạch lạc, chuyên sâu và ổn định</b></div></div>
            <div className="plan-summary-strip"><div><span>Gói đang dùng</span><strong>{planLabel(activePlan)}{subscription.planStatus === "trial" ? " · Trải nghiệm" : ""}</strong></div><div><span>{subscription.planStatus === "trial" ? "Tín dụng trải nghiệm hôm nay" : "Tín dụng hiện có"}</span><strong>{subscription.planStatus === "trial" ? subscription.trials.plusRemaining : subscription.credits.total}</strong></div></div>
            <div className="plan-grid">{subscription.cards.map((card) => <article key={card.id} className={`plan-card plan-${card.id} ${card.active ? 'is-active' : ''}`}>
              <div className="plan-card-glow" /><div className="plan-card-shine" aria-hidden="true" /><div className="plan-card-top"><span className="plan-gem">{planIcon[card.id]}</span><span className={`plan-badge badge-${card.id}`}>{card.badge}</span><span className={`plan-state ${card.active ? 'active' : ''}`}>{PAYMENT_UI_COMING_SOON && card.id === "plus" && !card.paid && !card.active && card.state !== "trial_available" ? "COMING SOON" : statusLabel(card.state)}</span></div><h3 className="plan-name">{card.title}</h3>{PAYMENT_UI_COMING_SOON && card.id === "plus" ? <div className="plan-price plan-price-coming-soon"><strong>Coming soon</strong></div> : <div className="plan-price">{card.listPriceVnd ? <del>{money(card.listPriceVnd)}</del> : null}<strong>{card.priceVnd ? money(card.priceVnd) : "0đ"}</strong><span>{card.id === "free" ? "· Không giới hạn thời gian" : "/ 30 ngày"}</span></div>}<p className="plan-description">{card.description}</p><p className="plan-reason">{card.reason}</p><ul>{card.benefits.map((item) => <li key={item}>✓ <span>{item}</span></li>)}</ul>{card.hint ? <p className="plan-hint">{card.hint}</p> : null}
              {card.active
                ? <button id={`select-plan-${card.id}`} className="plan-action selected" disabled>Gói hiện tại</button>
                : card.id === "free"
                  ? card.selectable
                    ? <button id="select-plan-free" className="plan-action" disabled={Boolean(busy)} onClick={() => selectPlan("free")}>{busy === "select-free" ? "Đang chọn..." : "Chọn gói"}</button>
                    : <button id="select-plan-free" className="plan-action" disabled>Chờ reset 00:00</button>
                  : card.paid
                    ? <button id={`select-plan-${card.id}`} className={`plan-action choose-owned ${busy === `select-${card.id}` ? "is-loading" : ""}`} disabled={Boolean(busy)} onClick={() => selectPlan(card.id)}>{busy === `select-${card.id}` ? "Đang chọn..." : "Chọn gói"}</button>
                    : card.state === "trial_available"
                      ? <button id={`select-trial-${card.id}`} className="plan-trial-action" disabled={Boolean(busy)} onClick={() => selectPlan(card.id)}>{busy === `select-${card.id}` ? "Đang chọn..." : `Trải nghiệm gói Trả phí · ${card.remaining} tín dụng`}</button>
                    : PAYMENT_UI_COMING_SOON
                      ? <button id={`buy-plan-${card.id}`} className="plan-action coming-soon" disabled>Coming soon</button>
                      : <><button id={`buy-plan-${card.id}`} className={`plan-action buy buy-${card.id}`} disabled={Boolean(busy)} onClick={() => checkout("package", card.id)}>{busy === "checkout" ? "Đang tạo yêu cầu..." : card.cta}</button>{card.state === "trial_available" ? <button id={`select-trial-${card.id}`} className="plan-trial-action" disabled={Boolean(busy)} onClick={() => selectPlan(card.id)}>Dùng lượt trải nghiệm còn lại</button> : null}</>}
            </article>)}</div>
            <p className="plans-note">Hai gói sử dụng cùng cấu trúc giáo án và bộ kiểm tra sư phạm. Gói Trả phí dùng model AI cao cấp hơn để tăng độ sâu, tính mạch lạc và ổn định. Chất lượng kết quả còn phụ thuộc vào nội dung SGK và thông tin bạn cung cấp.</p>
            <div className="payment-zone payment-zone-single">{PAYMENT_UI_COMING_SOON ? <div className="payment-config payment-coming-soon"><p className="account-section-label">Mua thêm tín dụng</p><strong>Coming soon</strong><p>Tính năng mua tín dụng sẽ được mở trong phiên bản chính thức. Tín dụng do Admin cấp vẫn sử dụng bình thường.</p></div> : <div className={`payment-config ${!canTopup ? 'disabled-zone' : ''}`}><p className="account-section-label">Mua thêm tín dụng</p><div className="flex gap-2"><input id="topup-amount" className="input-field" type="number" min={25000} step={1000} value={topupAmount} disabled={!canTopup} onChange={(e) => setTopupAmount(Number(e.target.value))} /><button id="buy-topup" className="btn-primary shrink-0" disabled={!canTopup || Boolean(busy)} onClick={() => checkout("topup")}>Mua {Math.max(0, topupAmount / 1000)} tín dụng</button></div><p className="mt-2 text-xs text-slate-500">{ownedPaidCard ? `Cộng vào gói ${ownedPaidCard.name}; tín dụng hết hạn cùng gói.` : "Tối thiểu 25.000đ; cần sở hữu gói Trả phí còn hạn."}</p></div>}</div>
            {!PAYMENT_UI_COMING_SOON && payment ? <button type="button" className={`active-payment-strip status-${payment.status}`} onClick={() => setPaymentModalOpen(true)}><span><b>{payment.purchaseType === 'package' ? `Gói ${planLabel(payment.targetPlan)}` : `${payment.credits} tín dụng`}</b><small>{payment.safeReason}</small></span><strong>{paymentStatusLabel(payment.status)} →</strong></button> : null}
          </section> : null}

          {tab === "history" ? <section className="history-grid">{lessons.length ? lessons.map((item) => <article key={item.id} className="history-card"><div><p>{item.title}</p><span>{item.subject} · {item.grade} · {item.periods} tiết</span><small>{daysLeft(item.expiresAt)}</small></div><div><button id={`open-lesson-${item.id}`} className="btn-primary" onClick={() => handleOpenLesson(item.id)}>Mở</button><button id={`delete-lesson-${item.id}`} className="btn-ghost text-red-600" onClick={() => handleDeleteLesson(item.id)}>Xóa</button></div></article>) : <div className="account-empty">Chưa có giáo án nào trong lịch sử.</div>}</section> : null}
        </main>
        <footer className="account-footer"><p>Tín dụng chỉ trừ sau khi AI tạo giáo án thành công.</p><button id="account-logout" className="btn-secondary" onClick={handleLogout}>Đăng xuất</button></footer>
      </div>
      {payment && paymentModalOpen && typeof document !== "undefined" ? createPortal(<div className="payos-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setPaymentModalOpen(false); }}>
        <section className="payos-modal" role="dialog" aria-modal="true" aria-labelledby="payos-modal-title" onMouseDown={(event) => event.stopPropagation()}>
          <header className="payos-modal-header"><div><p>Thanh toán tự động</p><h2 id="payos-modal-title">{payment.purchaseType === 'package' ? `Gói ${planLabel(payment.targetPlan)}` : `${payment.credits} tín dụng`}</h2></div><div className="payos-modal-header-actions"><span className={`checkout-status status-${payment.status}`}>{paymentStatusLabel(payment.status)}</span><button type="button" onClick={() => setPaymentModalOpen(false)} aria-label="Đóng thanh toán">×</button></div></header>
          {payment.status === 'approved' ? <div className="payos-result success"><span>✓</span><h3>Thanh toán thành công</h3><p>{payment.safeReason}</p><button type="button" className="btn-primary" onClick={() => setPaymentModalOpen(false)}>Hoàn tất</button></div>
            : isTerminalPaymentStatus(payment.status) ? <div className="payos-result error"><span>!</span><h3>Giao dịch chưa hoàn tất</h3><p>{payment.safeReason}</p><button type="button" className="btn-primary" onClick={() => setPaymentModalOpen(false)}>Đóng và thử lại</button></div>
              : <>
                <div className="payos-expiry"><span>Quét mã bằng ứng dụng ngân hàng</span><strong>{paymentSecondsLeft > 0 ? formatPaymentCountdown(paymentSecondsLeft) : 'Đang kiểm tra…'}</strong></div>
                <div className="payos-modal-body">
                  <div className="payos-qr-panel">{paymentQrUrl ? <img src={paymentQrUrl} alt="Mã VietQR thanh toán payOS" /> : <div className="payos-qr-loading">Đang tạo VietQR…</div>}<p>QR được tạo trực tiếp từ dữ liệu payOS</p></div>
                  <div className="payos-transfer-panel">
                    <div className="payos-brand-row"><span>EDUPLAN AI</span><b>payOS</b></div>
                    <dl>
                      <div><dt>Ngân hàng</dt><dd>{payment.bank.bankName}</dd></div>
                      <div><dt>Chủ tài khoản</dt><dd>{payment.bank.accountName}</dd></div>
                      <div><dt>Số tài khoản</dt><dd>{payment.bank.accountNumber}<button type="button" onClick={() => copyPaymentValue('account', payment.bank.accountNumber)}>{copiedPaymentField === 'account' ? 'Đã chép' : 'Sao chép'}</button></dd></div>
                      <div><dt>Số tiền</dt><dd>{money(payment.amountVnd)}<button type="button" onClick={() => copyPaymentValue('amount', String(payment.amountVnd))}>{copiedPaymentField === 'amount' ? 'Đã chép' : 'Sao chép'}</button></dd></div>
                      <div><dt>Nội dung</dt><dd className="payos-transfer-code">{payment.transferContent}<button type="button" onClick={() => copyPaymentValue('content', payment.transferContent)}>{copiedPaymentField === 'content' ? 'Đã chép' : 'Sao chép'}</button></dd></div>
                    </dl>
                    <p className="payos-transfer-note">Vui lòng giữ nguyên số tiền và nội dung. Quyền lợi được cộng tự động sau khi payOS xác nhận.</p>
                  </div>
                </div>
                <footer className="payos-modal-footer"><span className="payos-waiting-dot" /> <p>{payment.safeReason}</p><button type="button" className="btn-secondary" onClick={() => setPaymentModalOpen(false)}>Thanh toán sau</button></footer>
              </>}
        </section>
      </div>, document.body) : null}
    </div> : null}
  </div>;
}
