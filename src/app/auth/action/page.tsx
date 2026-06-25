"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { applyActionCode, confirmPasswordReset, verifyPasswordResetCode } from "firebase/auth";
import { getFirebaseClientAuth } from "@/lib/firebase-client";

type ActionState = "loading" | "success" | "error" | "reset";

function friendlyActionError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  if (/expired-action-code|invalid-action-code/i.test(message)) {
    return "Liên kết đã hết hạn hoặc đã được sử dụng. Vui lòng quay lại EduPlan AI để gửi lại email.";
  }
  if (/weak-password/i.test(message)) return "Mật khẩu mới cần tối thiểu 6 ký tự.";
  return message || "Không thể xử lý yêu cầu này lúc này.";
}

function AuthActionContent() {
  const params = useSearchParams();
  const mode = params.get("mode") || "";
  const oobCode = params.get("oobCode") || "";
  const continueUrl = params.get("continueUrl") || "/";
  const [state, setState] = useState<ActionState>("loading");
  const [title, setTitle] = useState("Đang xử lý yêu cầu");
  const [description, setDescription] = useState("EduPlan AI đang kiểm tra liên kết trong email của bạn.");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const handledRef = useRef(false);

  useEffect(() => {
    if (handledRef.current) return;
    handledRef.current = true;

    async function handleAction() {
      if (!mode || !oobCode) {
        setState("error");
        setTitle("Liên kết không hợp lệ");
        setDescription("Email thiếu mã xác thực. Vui lòng quay lại EduPlan AI và gửi lại yêu cầu.");
        return;
      }

      const auth = getFirebaseClientAuth();
      try {
        if (mode === "verifyEmail") {
          await applyActionCode(auth, oobCode);
          setState("success");
          setTitle("Email đã được xác minh");
          setDescription("Tài khoản của bạn đã sẵn sàng. Hãy quay lại EduPlan AI để bắt đầu tạo và lưu giáo án.");
          return;
        }

        if (mode === "resetPassword") {
          const accountEmail = await verifyPasswordResetCode(auth, oobCode);
          setEmail(accountEmail);
          setState("reset");
          setTitle("Đặt lại mật khẩu");
          setDescription("Nhập mật khẩu mới cho tài khoản dưới đây.");
          return;
        }

        if (mode === "recoverEmail") {
          await applyActionCode(auth, oobCode);
          setState("success");
          setTitle("Email tài khoản đã được khôi phục");
          setDescription("Yêu cầu khôi phục email đã hoàn tất. Bạn có thể quay lại EduPlan AI để đăng nhập.");
          return;
        }

        setState("error");
        setTitle("Không hỗ trợ yêu cầu này");
        setDescription("EduPlan AI chưa nhận diện được loại liên kết trong email.");
      } catch (error) {
        setState("error");
        setTitle(mode === "verifyEmail" ? "Cần xác minh lại email" : "Yêu cầu không hoàn tất");
        setDescription(friendlyActionError(error));
      }
    }

    void handleAction();
  }, [mode, oobCode]);

  async function handleResetPassword() {
    setIsSubmitting(true);
    try {
      await confirmPasswordReset(getFirebaseClientAuth(), oobCode, password);
      setState("success");
      setTitle("Mật khẩu đã được cập nhật");
      setDescription("Bạn có thể quay lại EduPlan AI và đăng nhập bằng mật khẩu mới.");
      setPassword("");
    } catch (error) {
      setState("reset");
      setDescription(friendlyActionError(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  const badgeClass = state === "success" ? "bg-emerald-50 text-emerald-700" : state === "error" ? "bg-red-50 text-red-700" : "bg-brand-50 text-brand-700";
  const iconClass = state === "success" ? "bg-emerald-600" : state === "error" ? "bg-red-600" : "bg-brand-600";
  const icon = state === "success" ? "✓" : state === "error" ? "!" : "•";

  return (
    <main className="auth-page flex min-h-screen items-center justify-center bg-slate-50 px-4 py-8">
      <section className="w-full max-w-xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <div className="border-b border-slate-100 bg-gradient-to-br from-brand-600 to-sky-500 px-8 py-7 text-white">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-white/80">EduPlan AI</p>
          <h1 className="mt-3 text-3xl font-black">Xác thực tài khoản</h1>
          <p className="mt-2 text-sm leading-6 text-white/85">Bảo vệ tài khoản, lưu lịch sử giáo án và quản lý lượt tạo miễn phí.</p>
        </div>

        <div className="p-8 text-center">
          <div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-2xl text-2xl font-black text-white ${iconClass}`}>{icon}</div>
          <span className={`mt-5 inline-flex rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.16em] ${badgeClass}`}>
            {state === "loading" ? "Đang kiểm tra" : state === "reset" ? "Bảo mật" : state === "success" ? "Hoàn tất" : "Cần xử lý lại"}
          </span>
          <h2 className="mt-4 text-3xl font-black text-slate-950">{title}</h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-600">{description}</p>

          {state === "reset" ? (
            <div className="mx-auto mt-6 max-w-sm text-left">
              <div className="mb-3 rounded-xl bg-slate-50 px-4 py-3 text-sm font-bold text-slate-600">{email}</div>
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Mật khẩu mới</span>
                <input className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-brand-500" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
              </label>
              <button className="mt-4 w-full rounded-xl bg-brand-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-brand-600/20 disabled:opacity-60" disabled={isSubmitting || password.length < 6} onClick={handleResetPassword}>
                {isSubmitting ? "Đang cập nhật..." : "Cập nhật mật khẩu"}
              </button>
            </div>
          ) : null}

          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <a className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-black text-white" href={continueUrl || "/"}>
              Quay lại EduPlan AI
            </a>
            {state === "error" ? (
              <a className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-black text-slate-700" href="/">
                Gửi lại email
              </a>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}

export default function AuthActionPage() {
  return (
    <Suspense fallback={<main className="auth-page flex min-h-screen items-center justify-center bg-slate-50 text-sm font-bold text-slate-600">Đang tải...</main>}>
      <AuthActionContent />
    </Suspense>
  );
}
