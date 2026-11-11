"use client";

import { useEffect, useRef, useState } from "react";
import { sendEmailVerification, signOut, updatePassword } from "firebase/auth";
import { getEmailActionSettings, getFirebaseClientAuth, hasFirebaseClientConfig } from "@/lib/firebase-client";
import { optimizeAvatarImage } from "@/lib/client-image-processing";
import { lessonValidationStatusShortLabel } from "@/lib/lesson-validation-status";
import type { LessonPlan } from "@/types/lesson";

export type PlanId = "free" | "plus";
type PlanCard = { id: PlanId; name: string; badge: string; title: string; priceVnd: number; listPriceVnd: number; includedCredits: number; generationCost: number; dailyLimit?: number; trialGenerations: number; description: string; benefits: string[]; cta: string; hint?: string; state: string; selectable: boolean; active: boolean; reason: string; remaining: number; expiresAt: string | null; paid: boolean };
type SubscriptionStatus = { activePlan: PlanId; planStatus: string; cards: PlanCard[]; free: { used: number; limit: number; remaining: number; resetAt: string }; credits: { package: number; topup: number; total: number; expiresAt: string | null }; trials: { plusRemaining: number; plusUsed: number; plusLimit: number; resetAt: string; proRemaining: number } };

export type AppUser = { uid: string; email: string; phoneNumber?: string; displayName: string; photoURL: string; emailVerified: boolean; disabled: boolean; blockedReason: string; blockedReasonDetail: string; role: "user" | "admin"; plan: string; freeLimit: number; usedGenerations: number; remainingGenerations: number; subscription: SubscriptionStatus };
type LessonHistoryItem = { id: string; title: string; subject: string; grade: string; periods: number; validationStatus?: "passed" | "needs_adjustment"; validationLabel?: string; freeDraft?: boolean; updatedAt: string; expiresAt: string };
type UserMenuProps = {
  user: AppUser;
  onUserChange: () => Promise<void> | void;
  onOpenLesson: (lesson: LessonPlan, lessonId: string) => void;
};

const planIcon: Record<PlanId, string> = { free: "◇", plus: "✦" };
function planLabel(plan: PlanId) { return plan === "plus" ? "Trả phí" : "Miễn phí"; }
function daysLeft(expiresAt: string) { const time = new Date(expiresAt).getTime(); if (!Number.isFinite(time)) return ""; return `Còn ${Math.ceil(Math.max(0, time - Date.now()) / 86_400_000)} ngày`; }

export function UserMenu({ user, onUserChange, onOpenLesson }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"profile" | "history">("profile");
  const [displayName, setDisplayName] = useState(user.displayName);
  const [newPassword, setNewPassword] = useState("");
  const [lessons, setLessons] = useState<LessonHistoryItem[]>([]);
  const [avatar, setAvatar] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState("");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setDisplayName(user.displayName); }, [user.displayName]);
  useEffect(() => { if (!avatar) { setAvatarPreview(""); return; } const url = URL.createObjectURL(avatar); setAvatarPreview(url); return () => URL.revokeObjectURL(url); }, [avatar]);
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.body.style.overflow = "hidden"; document.addEventListener("keydown", close);
    return () => { document.body.style.overflow = ""; document.removeEventListener("keydown", close); };
  }, [open]);
  useEffect(() => { if (open && tab === "history") loadLessons().catch(showError); }, [open, tab]);

  function showError(value: unknown) { setError(value instanceof Error ? value.message : "Đã xảy ra lỗi."); }
  function begin(key: string) { setBusy(key); setError(""); setMessage(""); }
  async function parse<T>(response: Response): Promise<T> { const result = await response.json() as T & { error?: string }; if (!response.ok) throw new Error(result.error || "Yêu cầu không thành công."); return result; }
  async function loadLessons() { const result = await parse<{ lessons?: LessonHistoryItem[] }>(await fetch("/api/lessons")); setLessons(result.lessons || []); }
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
  async function handleOpenLesson(id: string) { try { const result = await parse<{ lesson: LessonPlan; lessonId?: string }>(await fetch(`/api/lessons/${id}`)); onOpenLesson(result.lesson, result.lessonId || id); setOpen(false); } catch (e) { showError(e); } }
  async function handleDeleteLesson(id: string) { await fetch(`/api/lessons/${id}`, { method: "DELETE" }); await loadLessons(); }

  const activePlan = user.subscription.activePlan;
  const activeCard = user.subscription.cards.find((card) => card.id === activePlan);
  const avatarClass = `account-avatar account-avatar-${activePlan}`;
  const avatarUrl = avatarPreview || user.photoURL;

  return <div className="relative">
    <button id="open-account-center" className="group flex items-center gap-2.5 rounded-xl border border-surface-200 bg-white/80 px-3 py-2 text-left shadow-soft backdrop-blur-sm transition hover:-translate-y-0.5 hover:shadow-card-hover" onClick={() => setOpen(true)} aria-haspopup="dialog">
      <span className={avatarClass}>{user.photoURL ? <img src={user.photoURL} alt="Ảnh đại diện" /> : (user.displayName || user.email || user.phoneNumber || "U").slice(0, 1).toUpperCase()}</span>
      <span className="hidden min-w-0 sm:block"><span className="block max-w-[150px] truncate text-sm font-bold text-slate-900">{user.displayName || user.phoneNumber || "Người dùng"}</span><span className="block text-[11px] font-bold uppercase text-emerald-600">{planLabel(activePlan)} · {activeCard?.remaining || 0} còn lại</span></span>
    </button>

    {open ? <div className="account-overlay" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
      <div ref={modalRef} className="account-center" role="dialog" aria-modal="true" aria-labelledby="account-center-title">
        <header className="account-center-header"><div className="flex min-w-0 items-center gap-4"><span className={`${avatarClass} account-avatar-large`}>{user.photoURL ? <img src={user.photoURL} alt="Ảnh đại diện" /> : (user.displayName || user.phoneNumber || "U").slice(0, 1).toUpperCase()}</span><div className="min-w-0"><p className="account-eyebrow">EduPlan membership</p><h2 id="account-center-title" className="truncate text-xl font-black text-white">{user.displayName || "Trung tâm tài khoản"}</h2><p className="truncate text-xs text-slate-300">{user.email || user.phoneNumber || ""}</p></div></div><button id="close-account-center" className="account-close" onClick={() => setOpen(false)} aria-label="Đóng">×</button></header>
        <nav className="account-tabs" aria-label="Trung tâm tài khoản">{([['profile','Hồ sơ'],['history','Lịch sử']] as const).map(([id,label]) => <button id={`account-tab-${id}`} key={id} className={tab === id ? "active" : ""} onClick={() => { setTab(id); setError(""); setMessage(""); }}>{label}</button>)}</nav>
        <main className="account-content">
          {error ? <div className="account-alert error">{error}</div> : null}{message ? <div className="account-alert success">{message}</div> : null}
          {tab === "profile" ? <section className="account-profile-grid">
            <article className="account-panel"><p className="account-section-label">Ảnh đại diện</p><div className="avatar-editor"><span className={`${avatarClass} avatar-editor-preview`}>{avatarUrl ? <img src={avatarUrl} alt="Xem trước ảnh đại diện" /> : (user.displayName || user.phoneNumber || "U").slice(0, 1).toUpperCase()}</span><div><label className="avatar-file-label" htmlFor="profile-avatar">Chọn ảnh mới</label><input id="profile-avatar" className="avatar-file-input" type="file" accept="image/jpeg,image/png,image/webp" disabled={busy === "avatar-optimize"} onChange={(e) => { void handleAvatarSelect(e.target.files?.[0] || null); e.target.value = ""; }} /><p>JPG, PNG hoặc WebP · tối đa 5 MB</p><button id="upload-avatar" className="btn-primary mt-3" disabled={!avatar || Boolean(busy)} onClick={handleAvatarUpload}>{busy === "avatar-optimize" ? "Đang tối ưu ảnh..." : busy === "avatar" ? "Đang tải ảnh..." : "Đổi ảnh đại diện"}</button></div></div></article>
            <article className="account-panel"><p className="account-section-label">Thông tin cá nhân</p><label className="account-label">Họ và tên<input id="profile-display-name" className="input-field mt-2" value={displayName} onChange={(e) => setDisplayName(e.target.value)} /></label><div className="account-facts"><span>{user.email ? "Email" : "Số điện thoại"}</span><strong>{user.email || user.phoneNumber || "Chưa cập nhật"}</strong><span>Xác minh</span>{user.email ? <strong className={user.emailVerified ? "text-emerald-600" : "text-amber-600"}>{user.emailVerified ? "Đã xác minh" : "Chưa xác minh"}</strong> : <strong className="text-emerald-600">Đã xác minh qua SĐT</strong>}<span>Gói AI mặc định</span><strong>{planLabel(activePlan)}</strong></div><div className="mt-5 flex flex-wrap gap-2"><button id="save-profile" className="btn-primary" disabled={busy === "profile"} onClick={handleSaveProfile}>Lưu hồ sơ</button>{user.email && !user.emailVerified ? <button id="verify-email" className="btn-secondary" onClick={handleSendVerification}>Gửi xác minh</button> : null}</div></article>
            <article className="account-panel account-membership-panel"><p className="account-section-label">Quyền lợi hiện tại</p><div className="membership-orb">{planIcon[activePlan]}</div><h3 className="mt-4 text-2xl font-black text-slate-900">{planLabel(activePlan)}</h3><p className="mt-1 text-sm text-slate-500">{activeCard?.reason}</p><div className="membership-meter"><span style={{ width: `${Math.min(100, activePlan === 'free' ? user.subscription.free.used / Math.max(1, user.subscription.free.limit) * 100 : 100)}%` }} /></div></article>
            <article className="account-panel account-password"><p className="account-section-label">Bảo mật</p><div className="flex gap-3"><input id="new-password" className="input-field" type="password" placeholder="Mật khẩu mới (tối thiểu 6 ký tự)" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} /><button id="change-password" className="btn-secondary shrink-0" disabled={busy === "password"} onClick={handleChangePassword}>Đổi mật khẩu</button></div></article>
          </section> : null}

          {tab === "history" ? <section className="history-grid">{lessons.length ? lessons.map((item) => <article key={item.id} className="history-card"><div><p>{item.title}</p><span>{item.subject} · {item.grade} · {item.periods} tiết</span><small>{daysLeft(item.expiresAt)}</small></div><div className="history-card-actions"><span className={`history-validation-badge ${item.validationStatus === "needs_adjustment" ? "needs-adjustment" : "passed"}`}>{lessonValidationStatusShortLabel(item.validationStatus)}</span><button id={`open-lesson-${item.id}`} className="btn-primary" onClick={() => handleOpenLesson(item.id)}>Mở</button><button id={`delete-lesson-${item.id}`} className="btn-ghost text-red-600" onClick={() => handleDeleteLesson(item.id)}>Xóa</button></div></article>) : <div className="account-empty">Chưa có giáo án nào trong lịch sử.</div>}</section> : null}
        </main>
        <footer className="account-footer"><p>Tín dụng chỉ trừ sau khi AI lưu được giáo án hoặc bản nháp có thể chỉnh sửa.</p><button id="account-logout" className="btn-secondary" onClick={handleLogout}>Đăng xuất</button></footer>
      </div>
    </div> : null}
  </div>;
}
