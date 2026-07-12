"use client";

import { useEffect, useRef, useState } from "react";
import { sendEmailVerification, signOut, updatePassword } from "firebase/auth";
import { getEmailActionSettings, getFirebaseClientAuth, hasFirebaseClientConfig } from "@/lib/firebase-client";
import type { LessonPlan } from "@/types/lesson";

export type PlanId = "free" | "plus" | "pro";
type PlanCard = { id: PlanId; name: string; priceVnd: number; includedCredits: number; generationCost: number; refineCost: number; dailyLimit?: number; trialGenerations: number; benefits: string[]; state: string; selectable: boolean; active: boolean; reason: string; remaining: number; expiresAt: string | null; paid: boolean };
type SubscriptionStatus = { activePlan: PlanId; planStatus: string; cards: PlanCard[]; free: { used: number; limit: number; remaining: number; resetAt: string }; credits: { package: number; topup: number; total: number; expiresAt: string | null }; trials: { plusRemaining: number; proRemaining: number } };

export type AppUser = {
  uid: string; email: string; displayName: string; photoURL: string; emailVerified: boolean; disabled: boolean; role: "user" | "admin"; plan: string; freeLimit: number; usedGenerations: number; remainingGenerations: number; subscription: SubscriptionStatus;
};

type LessonHistoryItem = { id: string; title: string; subject: string; grade: string; periods: number; updatedAt: string; expiresAt: string };
type Payment = { id: string; purchaseType: "package" | "topup"; targetPlan: PlanId; amountVnd: number; credits: number; transferContent: string; senderName: string; status: string; safeReason: string; expiresAt: string | null; bank: { bankName: string; accountName: string; accountNumber: string; qrImageUrl: string; configured: boolean } };
type UserMenuProps = { user: AppUser; onUserChange: () => Promise<void> | void; onOpenLesson: (lesson: LessonPlan, lessonId: string) => void };

const planIcon: Record<PlanId, string> = { free: "◇", plus: "✦", pro: "◆" };
function money(value: number) { return `${value.toLocaleString("vi-VN")}đ`; }
function daysLeft(expiresAt: string) { const time = new Date(expiresAt).getTime(); if (!Number.isFinite(time)) return ""; return `Còn ${Math.ceil(Math.max(0, time - Date.now()) / 86_400_000)} ngày`; }
function statusLabel(state: string) { return state === "active" ? "ĐANG SỬ DỤNG" : state === "trial_available" ? "DÙNG THỬ" : state === "expired" ? "HẾT HẠN" : state === "exhausted" ? "ĐÃ HẾT" : state === "purchase_required" ? "CẦN MUA GÓI" : "CÓ THỂ CHỌN"; }

export function UserMenu({ user, onUserChange, onOpenLesson }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"profile" | "plans" | "history">("profile");
  const [displayName, setDisplayName] = useState(user.displayName);
  const [newPassword, setNewPassword] = useState("");
  const [lessons, setLessons] = useState<LessonHistoryItem[]>([]);
  const [subscription, setSubscription] = useState(user.subscription);
  const [senderName, setSenderName] = useState(user.displayName);
  const [topupAmount, setTopupAmount] = useState(25_000);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [proof, setProof] = useState<File | null>(null);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setDisplayName(user.displayName); setSenderName(user.displayName); setSubscription(user.subscription); }, [user]);
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.body.style.overflow = "hidden"; document.addEventListener("keydown", close);
    return () => { document.body.style.overflow = ""; document.removeEventListener("keydown", close); };
  }, [open]);
  useEffect(() => { if (open && tab === "history") loadLessons().catch(showError); }, [open, tab]);

  function showError(value: unknown) { setError(value instanceof Error ? value.message : "Đã xảy ra lỗi."); }
  function begin(key: string) { setBusy(key); setError(""); setMessage(""); }
  async function parse<T>(response: Response): Promise<T> { const result = await response.json() as T & { error?: string }; if (!response.ok) throw new Error(result.error || "Yêu cầu không thành công."); return result; }
  async function loadLessons() { const result = await parse<{ lessons?: LessonHistoryItem[] }>(await fetch("/api/lessons")); setLessons(result.lessons || []); }
  async function refreshAccount() { const result = await parse<{ subscription: SubscriptionStatus }>(await fetch("/api/subscription/activate")); setSubscription(result.subscription); await onUserChange(); }
  async function handleLogout() { await fetch("/api/auth/logout", { method: "POST" }); if (hasFirebaseClientConfig()) await signOut(getFirebaseClientAuth()).catch(() => undefined); window.location.reload(); }

  async function handleSaveProfile() {
    begin("profile"); try { await parse(await fetch("/api/user/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ displayName }) })); setMessage("Đã lưu hồ sơ."); await onUserChange(); } catch (e) { showError(e); } finally { setBusy(""); }
  }
  async function handleChangePassword() {
    begin("password"); try { if (newPassword.length < 6) throw new Error("Mật khẩu mới cần tối thiểu 6 ký tự."); const current = getFirebaseClientAuth().currentUser; if (!current) throw new Error("Vui lòng đăng nhập lại."); await updatePassword(current, newPassword); setNewPassword(""); setMessage("Đã đổi mật khẩu."); } catch (e) { showError(e); } finally { setBusy(""); }
  }
  async function handleSendVerification() {
    begin("verification"); try { const current = getFirebaseClientAuth().currentUser; if (!current) throw new Error("Vui lòng đăng nhập lại."); await sendEmailVerification(current, getEmailActionSettings()); setMessage("Đã gửi lại email xác minh."); } catch (e) { showError(e); } finally { setBusy(""); }
  }
  async function selectPlan(plan: PlanId) {
    begin(`select-${plan}`); try { const result = await parse<{ subscription: SubscriptionStatus }>(await fetch("/api/subscription/activate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan }) })); setSubscription(result.subscription); setMessage(`Đã chọn gói ${plan.toUpperCase()} cho lần soạn tiếp theo.`); await onUserChange(); } catch (e) { showError(e); } finally { setBusy(""); }
  }
  async function checkout(purchaseType: "package" | "topup", targetPlan?: PlanId) {
    alert("Hệ thống đang cập nhật, không thể thao tác");
  }
  async function uploadProof() {
    if (!payment || !proof) return setError("Vui lòng chọn ảnh bill.");
    begin("proof"); try { const body = new FormData(); body.set("paymentId", payment.id); body.set("proof", proof); const result = await parse<{ payment: Payment }>(await fetch("/api/payments/proof", { method: "POST", body })); setPayment(result.payment); setMessage(result.payment.safeReason || "Đã tiếp nhận bill."); if (result.payment.status === "approved") await refreshAccount(); } catch (e) { showError(e); } finally { setBusy(""); }
  }
  async function handleOpenLesson(id: string) { try { const result = await parse<{ lesson: LessonPlan; lessonId?: string }>(await fetch(`/api/lessons/${id}`)); onOpenLesson(result.lesson, result.lessonId || id); setOpen(false); } catch (e) { showError(e); } }
  async function handleDeleteLesson(id: string) { await fetch(`/api/lessons/${id}`, { method: "DELETE" }); await loadLessons(); }

  const activePlan = subscription.activePlan;
  const activeCard = subscription.cards.find((card) => card.id === activePlan);
  const avatarClass = `account-avatar account-avatar-${activePlan}`;

  return <div className="relative">
    <button id="open-account-center" className="group flex items-center gap-2.5 rounded-xl border border-surface-200 bg-white/80 px-3 py-2 text-left shadow-soft backdrop-blur-sm transition hover:-translate-y-0.5 hover:shadow-card-hover" onClick={() => setOpen(true)} aria-haspopup="dialog">
      <span className={avatarClass}>{user.photoURL ? <img src={user.photoURL} alt="Ảnh đại diện" /> : (user.displayName || user.email || "U").slice(0, 1).toUpperCase()}</span>
      <span className="hidden min-w-0 sm:block"><span className="block max-w-[150px] truncate text-sm font-bold text-slate-900">{user.displayName || "Người dùng"}</span><span className="block text-[11px] font-bold uppercase text-emerald-600">{activePlan} · {activeCard?.remaining || 0} còn lại</span></span>
    </button>

    {open ? <div className="account-overlay" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
      <div ref={modalRef} className="account-center" role="dialog" aria-modal="true" aria-labelledby="account-center-title">
        <header className="account-center-header">
          <div className="flex min-w-0 items-center gap-4"><span className={`${avatarClass} account-avatar-large`}>{user.photoURL ? <img src={user.photoURL} alt="Ảnh đại diện" /> : (user.displayName || "U").slice(0, 1).toUpperCase()}</span><div className="min-w-0"><p className="account-eyebrow">EduPlan membership</p><h2 id="account-center-title" className="truncate text-xl font-black text-white">{user.displayName || "Trung tâm tài khoản"}</h2><p className="truncate text-xs text-slate-300">{user.email}</p></div></div>
          <button id="close-account-center" className="account-close" onClick={() => setOpen(false)} aria-label="Đóng">×</button>
        </header>
        <nav className="account-tabs" aria-label="Trung tâm tài khoản">
          {([['profile','Hồ sơ'],['plans','Gói & thanh toán'],['history','Lịch sử']] as const).map(([id,label]) => <button id={`account-tab-${id}`} key={id} className={tab === id ? "active" : ""} onClick={() => { setTab(id); setError(""); setMessage(""); }}>{label}{id === "plans" ? <span className="tab-plan-dot">{activePlan}</span> : null}</button>)}
        </nav>
        <main className="account-content">
          {error ? <div className="account-alert error">{error}</div> : null}{message ? <div className="account-alert success">{message}</div> : null}
          {tab === "profile" ? <section className="account-profile-grid">
            <article className="account-panel"><p className="account-section-label">Thông tin cá nhân</p><label className="account-label">Họ và tên<input id="profile-display-name" className="input-field mt-2" value={displayName} onChange={(e) => setDisplayName(e.target.value)} /></label><div className="account-facts"><span>Email</span><strong>{user.email}</strong><span>Xác minh</span><strong className={user.emailVerified ? "text-emerald-600" : "text-amber-600"}>{user.emailVerified ? "Đã xác minh" : "Chưa xác minh"}</strong><span>Gói AI mặc định</span><strong className="uppercase">{activePlan}</strong></div><div className="mt-5 flex flex-wrap gap-2"><button id="save-profile" className="btn-primary" disabled={busy === "profile"} onClick={handleSaveProfile}>Lưu hồ sơ</button>{!user.emailVerified ? <button id="verify-email" className="btn-secondary" onClick={handleSendVerification}>Gửi xác minh</button> : null}</div></article>
            <article className="account-panel account-membership-panel"><p className="account-section-label">Quyền lợi hiện tại</p><div className="membership-orb">{planIcon[activePlan]}</div><h3 className="mt-4 text-2xl font-black uppercase text-slate-900">{activePlan}</h3><p className="mt-1 text-sm text-slate-500">{activeCard?.reason}</p><div className="membership-meter"><span style={{ width: `${Math.min(100, activePlan === 'free' ? subscription.free.used / Math.max(1, subscription.free.limit) * 100 : 100)}%` }} /></div><button id="go-to-plans" className="btn-secondary mt-5 w-full" onClick={() => setTab("plans")}>Quản lý gói</button></article>
            <article className="account-panel account-password"><p className="account-section-label">Bảo mật</p><div className="flex gap-3"><input id="new-password" className="input-field" type="password" placeholder="Mật khẩu mới (tối thiểu 6 ký tự)" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} /><button id="change-password" className="btn-secondary shrink-0" disabled={busy === "password"} onClick={handleChangePassword}>Đổi mật khẩu</button></div></article>
          </section> : null}

          {tab === "plans" ? <section>
            <div className="plan-summary-strip"><div><span>Gói đang dùng</span><strong>{activePlan.toUpperCase()}</strong></div><div><span>Tín dụng</span><strong>{subscription.credits.total}</strong></div><div><span>Plus trial</span><strong>{subscription.trials.plusRemaining}</strong></div><div><span>Pro trial</span><strong>{subscription.trials.proRemaining}</strong></div></div>
            <div className="plan-grid">{subscription.cards.map((card) => <article key={card.id} className={`plan-card plan-${card.id} ${card.active ? 'is-active' : ''} ${!card.selectable && !card.active ? 'is-locked' : ''}`}>
              <div className="plan-card-glow" /><div className="plan-card-top"><span className="plan-gem">{planIcon[card.id]}</span><span className={`plan-state ${card.active ? 'active' : ''}`}>{statusLabel(card.state)}</span></div><p className="plan-name">{card.name}</p><div className="plan-price">{card.priceVnd ? <><strong>{money(card.priceVnd)}</strong><span>/ 30 ngày</span></> : <strong>Miễn phí</strong>}</div><p className="plan-reason">{card.reason}</p><ul>{card.benefits.map((item) => <li key={item}>✓ <span>{item}</span></li>)}</ul>
              {card.selectable ? <button id={`select-plan-${card.id}`} className={`plan-action ${card.active ? 'selected' : ''}`} disabled={card.active || busy === `select-${card.id}`} onClick={() => selectPlan(card.id)}>{card.active ? "Đang được chọn" : card.state === "trial_available" ? "Chọn dùng thử" : "Chọn gói này"}</button> : card.id !== "free" ? <button id={`buy-plan-${card.id}`} className="plan-action buy" disabled={Boolean(busy)} onClick={() => checkout("package", card.id)}>Mua / gia hạn {card.name}</button> : <button className="plan-action" disabled>Chờ reset 00:00</button>}
            </article>)}</div>
            <div className="payment-zone">
              <div className="payment-config"><p className="account-section-label">Thông tin người chuyển</p><input id="payment-sender-name" className="input-field" value={senderName} onChange={(e) => setSenderName(e.target.value)} placeholder="Họ tên trên tài khoản ngân hàng" /><p className="mt-2 text-xs leading-5 text-slate-500">Tên này được đối chiếu tự động với bill. Mỗi yêu cầu có mã chuyển khoản riêng và cửa sổ thời gian từ 5 phút trước đến 30 phút sau lúc bấm mua.</p></div>
              <div className={`payment-config ${subscription.planStatus !== 'paid' ? 'disabled-zone' : ''}`}><p className="account-section-label">Mua thêm tín dụng</p><div className="flex gap-2"><input id="topup-amount" className="input-field" type="number" min={25000} step={1000} value={topupAmount} disabled={subscription.planStatus !== 'paid'} onChange={(e) => setTopupAmount(Number(e.target.value))} /><button id="buy-topup" className="btn-primary shrink-0" disabled={subscription.planStatus !== 'paid' || Boolean(busy)} onClick={() => checkout("topup")}>Mua {Math.max(0, topupAmount / 1000)} tín dụng</button></div><p className="mt-2 text-xs text-slate-500">Tối thiểu 25.000đ; tín dụng mua thêm hết hạn cùng gói.</p></div>
            </div>
            {payment ? <article className="checkout-card"><div className="checkout-heading"><div><p className="account-section-label">Yêu cầu chuyển khoản</p><h3>{payment.purchaseType === 'package' ? `Gói ${payment.targetPlan.toUpperCase()}` : `${payment.credits} tín dụng`}</h3></div><span className={`checkout-status status-${payment.status}`}>{payment.status === 'approved' ? 'ĐÃ DUYỆT' : payment.status === 'pending_review' ? 'CHỜ ADMIN' : payment.status === 'precheck_failed' ? 'CHƯA KHỚP' : 'CHỜ BILL'}</span></div><div className="bank-details"><span>Ngân hàng<strong>{payment.bank.bankName}</strong></span><span>Số tài khoản<strong>{payment.bank.accountNumber}</strong></span><span>Chủ tài khoản<strong>{payment.bank.accountName}</strong></span><span>Số tiền<strong>{money(payment.amountVnd)}</strong></span><span className="transfer-code">Nội dung<strong>{payment.transferContent}</strong></span></div>{payment.bank.qrImageUrl ? <img className="bank-qr" src={payment.bank.qrImageUrl} alt="Mã QR chuyển khoản" /> : null}{payment.status === 'awaiting_proof' ? <div className="proof-upload"><input id="payment-proof" type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setProof(e.target.files?.[0] || null)} /><button id="upload-payment-proof" className="btn-primary" disabled={!proof || busy === 'proof'} onClick={uploadProof}>{busy === 'proof' ? 'Đang đọc bill...' : 'Tải bill & kiểm tra'}</button></div> : <p className="payment-verdict">{payment.safeReason}</p>}</article> : null}
          </section> : null}

          {tab === "history" ? <section className="history-grid">{lessons.length ? lessons.map((item) => <article key={item.id} className="history-card"><div><p>{item.title}</p><span>{item.subject} · {item.grade} · {item.periods} tiết</span><small>{daysLeft(item.expiresAt)}</small></div><div><button id={`open-lesson-${item.id}`} className="btn-primary" onClick={() => handleOpenLesson(item.id)}>Mở</button><button id={`delete-lesson-${item.id}`} className="btn-ghost text-red-600" onClick={() => handleDeleteLesson(item.id)}>Xóa</button></div></article>) : <div className="account-empty">Chưa có giáo án nào trong lịch sử.</div>}</section> : null}
        </main>
        <footer className="account-footer"><p>Tín dụng chỉ trừ sau khi AI tạo hoặc tinh chỉnh thành công.</p><button id="account-logout" className="btn-secondary" onClick={handleLogout}>Đăng xuất</button></footer>
      </div>
    </div> : null}
  </div>;
}
