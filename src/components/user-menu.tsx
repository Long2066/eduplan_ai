"use client";

import { useEffect, useRef, useState } from "react";
import { sendEmailVerification, signOut, updatePassword } from "firebase/auth";
import { getEmailActionSettings, getFirebaseClientAuth, hasFirebaseClientConfig } from "@/lib/firebase-client";
import type { LessonPlan } from "@/types/lesson";

export type AppUser = {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  emailVerified: boolean;
  role: "user" | "admin";
  plan: string;
  freeLimit: number;
  usedGenerations: number;
  remainingGenerations: number;
};

type LessonHistoryItem = {
  id: string;
  title: string;
  subject: string;
  grade: string;
  periods: number;
  updatedAt: string;
  expiresAt: string;
};

type UserMenuProps = {
  user: AppUser;
  onUserChange: () => Promise<void> | void;
  onOpenLesson: (lesson: LessonPlan, lessonId: string) => void;
};

function daysLeft(expiresAt: string) {
  const expires = new Date(expiresAt).getTime();
  if (!Number.isFinite(expires)) return "";
  const diff = Math.max(0, expires - Date.now());
  const days = Math.ceil(diff / (24 * 60 * 60 * 1000));
  return `Còn ${days} ngày`;
}

function daysLeftCount(expiresAt: string): number {
  const expires = new Date(expiresAt).getTime();
  if (!Number.isFinite(expires)) return 999;
  const diff = Math.max(0, expires - Date.now());
  return Math.ceil(diff / (24 * 60 * 60 * 1000));
}

export function UserMenu({ user, onUserChange, onOpenLesson }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"profile" | "history">("profile");
  const [displayName, setDisplayName] = useState(user.displayName);
  const [newPassword, setNewPassword] = useState("");
  const [lessons, setLessons] = useState<LessonHistoryItem[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDisplayName(user.displayName);
  }, [user.displayName]);

  /* Click-outside handler */
  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  async function loadLessons() {
    const response = await fetch("/api/lessons");
    const result = (await response.json()) as { lessons?: LessonHistoryItem[]; error?: string };
    if (!response.ok) throw new Error(result.error || "Không thể tải lịch sử.");
    setLessons(result.lessons || []);
  }

  useEffect(() => {
    if (!open || tab !== "history") return;
    loadLessons().catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Không thể tải lịch sử."));
  }, [open, tab]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    if (hasFirebaseClientConfig()) await signOut(getFirebaseClientAuth()).catch(() => undefined);
    window.location.reload();
  }

  async function handleSaveProfile() {
    setError("");
    setMessage("");
    const response = await fetch("/api/user/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName }),
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(result.error || "Không thể lưu hồ sơ.");
      return;
    }
    setMessage("Đã lưu hồ sơ.");
    await onUserChange();
  }

  async function handleChangePassword() {
    setError("");
    setMessage("");
    if (!newPassword || newPassword.length < 6) {
      setError("Mật khẩu mới cần tối thiểu 6 ký tự.");
      return;
    }
    try {
      const current = getFirebaseClientAuth().currentUser;
      if (!current) throw new Error("Vui lòng đăng nhập lại để đổi mật khẩu.");
      await updatePassword(current, newPassword);
      setNewPassword("");
      setMessage("Đã đổi mật khẩu.");
    } catch (changeError) {
      setError(changeError instanceof Error ? changeError.message : "Không thể đổi mật khẩu.");
    }
  }

  async function handleSendVerification() {
    setError("");
    setMessage("");
    try {
      const current = getFirebaseClientAuth().currentUser;
      if (!current) throw new Error("Vui lòng đăng nhập lại để gửi xác minh.");
      await sendEmailVerification(current, getEmailActionSettings());
      setMessage("Đã gửi lại email xác minh.");
    } catch (verifyError) {
      setError(verifyError instanceof Error ? verifyError.message : "Không thể gửi email xác minh.");
    }
  }

  async function handleOpenLesson(id: string) {
    const response = await fetch(`/api/lessons/${id}`);
    const result = (await response.json()) as { lesson?: LessonPlan; lessonId?: string; error?: string };
    if (!response.ok || !result.lesson) throw new Error(result.error || "Không thể mở giáo án.");
    onOpenLesson(result.lesson, result.lessonId || id);
    setOpen(false);
  }

  async function handleDeleteLesson(id: string) {
    await fetch(`/api/lessons/${id}`, { method: "DELETE" });
    await loadLessons();
  }

  const quotaPercent = user.freeLimit > 0 ? Math.round((user.usedGenerations / user.freeLimit) * 100) : 0;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* ── Trigger Button ── */}
      <button
        className="group flex items-center gap-2.5 rounded-xl border border-surface-200 bg-white/80 backdrop-blur-sm px-3 py-2 text-left shadow-soft transition-all duration-200 hover:shadow-card-hover hover:scale-[1.02] active:scale-[0.98]"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-sm font-black text-white shadow-sm ring-2 ring-white transition-shadow duration-200 group-hover:shadow-glow">
          {(user.displayName || user.email || "U").slice(0, 1).toUpperCase()}
        </span>
        <span className="hidden min-w-0 sm:block">
          <span className="block max-w-[150px] truncate text-sm font-bold text-slate-900">
            {user.displayName || "Người dùng"}
          </span>
          <span className="block text-[11px] font-semibold text-brand-600">
            {user.remainingGenerations}/{user.freeLimit} lượt còn lại
          </span>
        </span>
      </button>

      {/* ── Dropdown Panel ── */}
      {open ? (
        <div className="dropdown-enter absolute right-0 z-[70] mt-2.5 w-[min(92vw,420px)] overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-2xl">
          {/* Header */}
          <div className="bg-gradient-to-r from-brand-50 to-surface-50 border-b border-slate-100 px-5 py-4">
            <p className="text-sm font-bold text-slate-900">{user.displayName || "Người dùng"}</p>
            <p className="mt-0.5 text-xs font-medium text-slate-400">{user.email}</p>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 border-b border-slate-100 px-4 py-2">
            <button
              className={`flex-1 rounded-lg px-4 py-2 text-sm font-bold transition-all duration-200 ${
                tab === "profile"
                  ? "bg-brand-600 text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-700 hover:bg-surface-50"
              }`}
              onClick={() => setTab("profile")}
            >
              Hồ sơ
            </button>
            <button
              className={`flex-1 rounded-lg px-4 py-2 text-sm font-bold transition-all duration-200 ${
                tab === "history"
                  ? "bg-brand-600 text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-700 hover:bg-surface-50"
              }`}
              onClick={() => setTab("history")}
            >
              Lịch sử
            </button>
          </div>

          {/* Content */}
          <div className="max-h-[70vh] overflow-auto p-5">
            {error ? (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-semibold text-red-700 animate-fade-in">
                {error}
              </div>
            ) : null}
            {message ? (
              <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-semibold text-emerald-700 animate-fade-in">
                {message}
              </div>
            ) : null}

            {tab === "profile" ? (
              <div className="space-y-5">
                {/* Info Card */}
                <div className="rounded-xl bg-surface-50 border border-slate-100 p-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500">Email</span>
                    <span className="text-xs font-medium text-slate-700">{user.email}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500">Xác minh</span>
                    <span className={`text-xs font-bold ${user.emailVerified ? "text-emerald-600" : "text-amber-600"}`}>
                      {user.emailVerified ? "Đã xác minh" : "Chưa xác minh"}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-500">Lượt tạo</span>
                      <span className="text-xs font-bold text-brand-700">
                        {user.remainingGenerations}/{user.freeLimit} còn lại
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-brand-500 transition-all duration-500"
                        style={{ width: `${Math.min(quotaPercent, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Display Name */}
                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Họ tên</span>
                  <input
                    className="input-field mt-1.5 w-full"
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                  />
                </label>

                {!user.emailVerified ? (
                  <button className="btn-secondary text-sm" onClick={handleSendVerification}>
                    Gửi lại email xác minh
                  </button>
                ) : null}

                <button className="btn-primary text-sm" onClick={handleSaveProfile}>
                  Lưu hồ sơ
                </button>

                {/* Password Section */}
                <div className="border-t border-slate-100 pt-5">
                  <label className="block">
                    <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Mật khẩu mới</span>
                    <input
                      className="input-field mt-1.5 w-full"
                      type="password"
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                    />
                  </label>
                  <button className="btn-secondary mt-3 text-sm" onClick={handleChangePassword}>
                    Đổi mật khẩu
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {lessons.length ? (
                  lessons.map((item) => {
                    const days = daysLeftCount(item.expiresAt);
                    const badgeColor =
                      days > 3
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : days >= 1
                          ? "bg-amber-50 text-amber-700 border-amber-200"
                          : "bg-red-50 text-red-700 border-red-200";

                    return (
                      <div
                        key={item.id}
                        className="rounded-xl border border-slate-200 bg-white p-4 transition-all duration-200 hover:shadow-md hover:border-brand-200"
                      >
                        <p className="line-clamp-2 text-sm font-bold text-slate-900">{item.title}</p>
                        <p className="mt-1.5 text-xs font-medium text-slate-400">
                          {item.subject} · {item.grade} · {item.periods} tiết
                        </p>
                        <div className="mt-2 flex items-center justify-between">
                          <span className={`inline-block rounded-lg border px-2 py-0.5 text-[11px] font-bold ${badgeColor}`}>
                            {daysLeft(item.expiresAt)}
                          </span>
                          <div className="flex gap-2">
                            <button
                              className="btn-primary px-3 py-1.5 text-xs"
                              onClick={() => handleOpenLesson(item.id)}
                            >
                              Mở
                            </button>
                            <button
                              className="btn-ghost px-3 py-1.5 text-xs text-red-600 hover:bg-red-50"
                              onClick={() => handleDeleteLesson(item.id)}
                            >
                              Xóa
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="py-6 text-center text-sm text-slate-400">Chưa có giáo án nào trong lịch sử.</p>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-slate-100 px-5 py-4">
            <button className="btn-secondary w-full" onClick={handleLogout}>
              Đăng xuất
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
