"use client";

import { useEffect, useState } from "react";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
} from "firebase/auth";
import { getEmailActionSettings, getFirebaseClientAuth, googleAuthProvider, hasFirebaseClientConfig } from "@/lib/firebase-client";

type AuthPanelProps = {
  onSessionReady: () => Promise<void> | void;
};

type AuthMode = "login" | "register" | "reset";

async function createSession() {
  const auth = getFirebaseClientAuth();
  const idToken = await auth.currentUser?.getIdToken(true);
  if (!idToken) throw new Error("Không lấy được phiên đăng nhập.");
  const response = await fetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
  if (!response.ok) {
    const result = (await response.json()) as { error?: string };
    throw new Error(result.error || "Không thể tạo phiên đăng nhập.");
  }
}

function friendlyAuthError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  if (/auth\/configuration-not-found/i.test(message)) {
    return "Firebase Authentication chưa được bật cho project này. Vào Firebase Console > Authentication > Get started, rồi bật Email/Password và Google.";
  }
  if (/auth\/operation-not-allowed/i.test(message)) {
    return "Phương thức đăng nhập này chưa được bật. Vào Authentication > Sign-in method để bật Email/Password hoặc Google.";
  }
  if (/auth\/unauthorized-domain/i.test(message)) {
    return "Domain localhost chưa được phép đăng nhập. Vào Authentication > Settings > Authorized domains và thêm localhost.";
  }
  if (/auth\/popup-closed-by-user/i.test(message)) {
    return "Cửa sổ đăng nhập Google đã bị đóng trước khi hoàn tất.";
  }
  if (/auth\/invalid-credential|auth\/wrong-password|auth\/user-not-found/i.test(message)) {
    return "Email hoặc mật khẩu chưa đúng.";
  }
  if (/auth\/email-already-in-use/i.test(message)) {
    return "Email này đã được đăng ký.";
  }
  if (/auth\/weak-password/i.test(message)) {
    return "Mật khẩu cần tối thiểu 6 ký tự.";
  }
  return message || "Không thể xử lý tài khoản lúc này.";
}

type Policies = {
  terms: string;
  privacy: string;
  version?: string;
};

const defaultTerms = [
  "1. Người dùng sử dụng EduPlan AI đúng mục đích giáo dục, hỗ trợ soạn giáo án, kế hoạch bài dạy và tài liệu liên quan đến hoạt động dạy học.",
  "2. Nội dung do EduPlan AI tạo ra chỉ mang tính hỗ trợ. Người dùng cần đọc, kiểm tra, chỉnh sửa và chịu trách nhiệm cuối cùng trước khi sử dụng, nộp hoặc giảng dạy.",
  "3. Người dùng không tải lên, nhập vào hoặc yêu cầu xử lý các dữ liệu nhạy cảm không cần thiết như thông tin cá nhân học sinh, số điện thoại, địa chỉ, hồ sơ sức khỏe, điểm số riêng tư hoặc tài liệu không có quyền sử dụng.",
  "4. Người dùng không được sử dụng công cụ để tạo nội dung vi phạm pháp luật, sai lệch chuyên môn, xúc phạm cá nhân/tổ chức, phân biệt đối xử hoặc gây ảnh hưởng tiêu cực đến môi trường giáo dục.",
  "5. EduPlan AI có thể giới hạn số lượt tạo giáo án miễn phí, điều chỉnh tính năng hoặc tạm ngừng tài khoản nếu phát hiện hành vi lạm dụng, gây quá tải hệ thống hoặc vi phạm điều khoản sử dụng.",
].join("\n\n");

const defaultPrivacy = [
  "1. EduPlan AI thu thập và lưu các thông tin cần thiết để vận hành tài khoản, gồm họ tên, email, trạng thái xác minh email, số lượt tạo giáo án và lịch sử tạo giáo án.",
  "2. Lịch sử giáo án được lưu tạm thời trong hệ thống để người dùng có thể mở lại và chỉnh sửa. Theo cấu hình hiện tại, giáo án tự động được lưu trong 7 ngày.",
  "3. Mật khẩu người dùng được quản lý qua Firebase Authentication. EduPlan AI không lưu mật khẩu dạng văn bản và quản trị viên không thể xem mật khẩu hiện tại của người dùng.",
  "4. Dữ liệu người dùng chỉ được sử dụng để cung cấp dịch vụ, quản lý tài khoản, thống kê lượt truy cập, hỗ trợ kỹ thuật và cải thiện chất lượng công cụ.",
  "5. EduPlan AI không khuyến khích người dùng nhập dữ liệu cá nhân nhạy cảm của học sinh hoặc bên thứ ba. Nếu người dùng tự nhập dữ liệu đó, người dùng chịu trách nhiệm bảo đảm có quyền sử dụng và đã tuân thủ quy định bảo mật liên quan.",
].join("\n\n");

function PolicyModal({ title, content, onClose }: { title: string; content: string; onClose: () => void }) {
  return (
    <div className="animate-fade-in fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
      <div className="animate-scale-in max-h-[82vh] w-full max-w-2xl overflow-auto rounded-2xl bg-white p-8 shadow-float">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-600">EduPlan AI</p>
            <h2 className="mt-1.5 text-2xl font-black text-slate-950">{title}</h2>
          </div>
          <button
            className="btn-secondary px-4 py-1.5 text-sm"
            onClick={onClose}
          >
            Đóng
          </button>
        </div>
        <div className="mt-6 space-y-3 text-sm leading-relaxed text-slate-600">
          {content.split(/\n{2,}/).map((paragraph, index) => <p key={index}>{paragraph}</p>)}
        </div>
      </div>
    </div>
  );
}

export function AuthPanel({ onSessionReady }: AuthPanelProps) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [acceptedPolicy, setAcceptedPolicy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [policyTitle, setPolicyTitle] = useState("");
  const [policies, setPolicies] = useState<Policies>({
    terms: defaultTerms,
    privacy: defaultPrivacy,
  });

  const clientReady = hasFirebaseClientConfig();

  useEffect(() => {
    fetch("/api/settings/policies")
      .then((response) => response.json())
      .then((result: { policies?: Policies }) => {
        if (result.policies) setPolicies(result.policies);
      })
      .catch(() => undefined);
  }, []);

  async function finishSession() {
    await createSession();
    await onSessionReady();
  }

  async function handleEmailAuth() {
    setError("");
    setMessage("");
    if (!clientReady) {
      setError("Thiếu Firebase Web App config. Cần điền NEXT_PUBLIC_FIREBASE_* trong .env.local.");
      return;
    }
    if (mode === "register" && !acceptedPolicy) {
      setError("Bạn cần đồng ý Điều khoản sử dụng và Chính sách bảo mật.");
      return;
    }

    setIsSubmitting(true);
    try {
      const auth = getFirebaseClientAuth();
      if (mode === "reset") {
        await sendPasswordResetEmail(auth, email, getEmailActionSettings());
        setMessage("Đã gửi email đặt lại mật khẩu. Vui lòng kiểm tra hộp thư.");
        return;
      }

      if (mode === "register") {
        const credential = await createUserWithEmailAndPassword(auth, email, password);
        if (displayName.trim()) await updateProfile(credential.user, { displayName: displayName.trim() });
        await sendEmailVerification(credential.user, getEmailActionSettings());
        await finishSession();
        setMessage("Đã tạo tài khoản. Vui lòng xác minh email để bắt đầu tạo giáo án.");
        return;
      }

      await signInWithEmailAndPassword(auth, email, password);
      await finishSession();
    } catch (authError) {
      setError(friendlyAuthError(authError));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleGoogleLogin() {
    setError("");
    setMessage("");
    if (!clientReady) {
      setError("Thiếu Firebase Web App config. Cần điền NEXT_PUBLIC_FIREBASE_* trong .env.local.");
      return;
    }
    setIsSubmitting(true);
    try {
      const auth = getFirebaseClientAuth();
      await signInWithPopup(auth, googleAuthProvider);
      await finishSession();
    } catch (authError) {
      setError(friendlyAuthError(authError));
    } finally {
      setIsSubmitting(false);
    }
  }

  const title = mode === "register" ? "Tạo tài khoản" : mode === "reset" ? "Quên mật khẩu" : "Đăng nhập";

  return (
    <main className="auth-page flex min-h-screen items-center justify-center px-4 py-8">
      {policyTitle ? (
        <PolicyModal
          title={policyTitle}
          content={policyTitle === "Điều khoản sử dụng" ? policies.terms : policies.privacy}
          onClose={() => setPolicyTitle("")}
        />
      ) : null}

      <div className="animate-fade-in flex w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-float md:min-h-[600px]">
        {/* ── LEFT: Hero branding panel (desktop only) ── */}
        <div className="auth-hero relative hidden w-[44%] flex-shrink-0 flex-col justify-between p-10 md:flex lg:p-12">
          {/* Dot pattern overlay */}
          <div className="auth-hero-dots pointer-events-none absolute inset-0" />

          {/* Top content */}
          <div className="relative z-10">
            <h1 className="text-4xl font-black tracking-tight text-white lg:text-5xl">
              EduPlan AI
            </h1>
            <p className="mt-4 max-w-xs text-base font-medium leading-relaxed text-white/80 lg:text-lg">
              Soạn giáo án chuẩn Công văn 2345 trong vài phút
            </p>
          </div>

          {/* Feature bullets */}
          <ul className="relative z-10 space-y-4 text-sm leading-relaxed text-white/90">
            <li className="flex items-start gap-2.5">
              <span className="mt-0.5 text-white/50">•</span>
              <span>Upload ảnh SGK, AI tự soạn giáo án đầy đủ</span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="mt-0.5 text-white/50">•</span>
              <span>Preview A4 đẹp, xuất Word và PDF ngay</span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="mt-0.5 text-white/50">•</span>
              <span>Tinh chỉnh thông minh, phù hợp mọi bối cảnh</span>
            </li>
          </ul>

          {/* Bottom subtle text */}
          <p className="relative z-10 text-xs font-medium text-white/40">
            © 2025 EduPlan AI — Hỗ trợ giáo viên Việt Nam
          </p>
        </div>

        {/* ── RIGHT: Form panel ── */}
        <div className="flex w-full flex-1 flex-col justify-center px-6 py-10 sm:px-10 md:px-12 lg:px-16">
          {/* Mobile-only brand badge */}
          <div className="mb-6 md:hidden">
            <span className="rounded-full bg-brand-50 px-3.5 py-1.5 text-xs font-black uppercase tracking-[0.2em] text-brand-700">
              EduPlan AI
            </span>
          </div>

          {/* Tab switcher (pill toggle) — only for login/register */}
          {mode !== "reset" ? (
            <div className="mb-8">
              <div className="relative inline-flex rounded-full bg-surface-100 p-1">
                {/* Sliding highlight */}
                <div
                  className="absolute inset-y-1 rounded-full bg-white shadow-soft transition-all duration-300 ease-out"
                  style={{
                    width: "50%",
                    left: mode === "login" ? "4px" : "calc(50% - 0px)",
                  }}
                />
                <button
                  className={`relative z-10 rounded-full px-6 py-2 text-sm font-bold transition-colors duration-200 ${
                    mode === "login" ? "text-brand-700" : "text-slate-400 hover:text-slate-600"
                  }`}
                  onClick={() => setMode("login")}
                >
                  Đăng nhập
                </button>
                <button
                  className={`relative z-10 rounded-full px-6 py-2 text-sm font-bold transition-colors duration-200 ${
                    mode === "register" ? "text-brand-700" : "text-slate-400 hover:text-slate-600"
                  }`}
                  onClick={() => setMode("register")}
                >
                  Đăng ký
                </button>
              </div>
            </div>
          ) : null}

          {/* Title and subtitle */}
          <div className="mb-7">
            <h2 className="text-2xl font-black text-slate-950 sm:text-3xl">
              {title}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">
              {mode === "reset"
                ? "Nhập email để nhận link đặt lại mật khẩu."
                : "Đăng nhập để vào giao diện tạo giáo án và lưu lịch sử làm việc."}
            </p>
          </div>

          {/* Form fields */}
          <div className="space-y-4">
            {mode === "register" ? (
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
                  Họ tên
                </span>
                <input
                  className="input-field"
                  placeholder="Nguyễn Văn A"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                />
              </label>
            ) : null}

            <label className="block">
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
                Email
              </span>
              <input
                className="input-field"
                type="email"
                placeholder="email@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>

            {mode !== "reset" ? (
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
                  Mật khẩu
                </span>
                <input
                  className="input-field"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </label>
            ) : null}

            {mode === "register" ? (
              <label className="flex items-start gap-3 rounded-xl border border-slate-100 bg-surface-50 p-3.5 text-xs leading-5 text-slate-600 transition-colors hover:border-brand-100 hover:bg-brand-50/30">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 accent-brand-600"
                  checked={acceptedPolicy}
                  onChange={(event) => setAcceptedPolicy(event.target.checked)}
                />
                <span>
                  Tôi đồng ý với{" "}
                  <button className="font-bold text-brand-700 hover:underline" type="button" onClick={() => setPolicyTitle("Điều khoản sử dụng")}>Điều khoản sử dụng</button>
                  {" "}và{" "}
                  <button className="font-bold text-brand-700 hover:underline" type="button" onClick={() => setPolicyTitle("Chính sách bảo mật")}>Chính sách bảo mật</button>.
                </span>
              </label>
            ) : null}

            {/* Messages */}
            {error ? (
              <div className="animate-slide-up rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-bold leading-5 text-red-700">
                {error}
              </div>
            ) : null}
            {message ? (
              <div className="animate-slide-up rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-bold leading-5 text-emerald-700">
                {message}
              </div>
            ) : null}

            {/* Submit button */}
            <button
              className="btn-primary w-full py-3 text-sm font-black"
              disabled={isSubmitting}
              onClick={handleEmailAuth}
            >
              {isSubmitting ? "Đang xử lý..." : title}
            </button>

            {/* Google button */}
            {mode !== "reset" ? (
              <button
                className="btn-secondary w-full py-3 text-sm font-black"
                disabled={isSubmitting}
                onClick={handleGoogleLogin}
              >
                Tiếp tục với Google
              </button>
            ) : null}
          </div>

          {/* Mode switcher links */}
          <div className="mt-7 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm">
            {mode !== "login" ? (
              <button
                className="font-bold text-brand-700 transition-colors hover:text-brand-800"
                onClick={() => setMode("login")}
              >
                Đăng nhập
              </button>
            ) : null}
            {mode !== "register" ? (
              <button
                className="font-bold text-brand-700 transition-colors hover:text-brand-800"
                onClick={() => setMode("register")}
              >
                Đăng ký
              </button>
            ) : null}
            {mode !== "reset" ? (
              <button
                className="font-medium text-slate-400 transition-colors hover:text-slate-600"
                onClick={() => setMode("reset")}
              >
                Quên mật khẩu?
              </button>
            ) : null}
          </div>

          {/* Footer policy text */}
          <div className="mt-6 border-t border-slate-100 pt-5 text-center text-xs leading-5 text-slate-400">
            Khi sử dụng EduPlan AI, bạn đồng ý tuân thủ{" "}
            <button className="font-bold text-brand-600 transition-colors hover:text-brand-700 hover:underline" type="button" onClick={() => setPolicyTitle("Điều khoản sử dụng")}>
              Điều khoản sử dụng
            </button>
            {" "}và{" "}
            <button className="font-bold text-brand-600 transition-colors hover:text-brand-700 hover:underline" type="button" onClick={() => setPolicyTitle("Chính sách bảo mật")}>
              Chính sách bảo mật
            </button>
            .
          </div>
        </div>
      </div>
    </main>
  );
}
