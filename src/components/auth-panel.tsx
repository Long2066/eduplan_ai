"use client";

import { useEffect, useState, type ReactNode } from "react";
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
  if (/auth\/user-disabled|tài khoản.*khóa|account.*disabled/i.test(message)) {
    return "Tài khoản của bạn bị khóa, vui lòng liên hệ hỗ trợ kĩ thuật 0342 733 640 nếu bạn cho là bị nhầm lẫn.";
  }
  if (/auth\/configuration-not-found/i.test(message)) {
    return "Firebase Authentication chưa được bật cho project này. Vào Firebase Console > Authentication > Get started, rồi bật Email/Password và Google.";
  }
  if (/auth\/operation-not-allowed/i.test(message)) {
    return "Phương thức đăng nhập này chưa được bật. Vào Authentication > Sign-in method để bật Email/Password hoặc Google.";
  }
  if (/auth\/unauthorized-domain/i.test(message)) {
    return "Domain localhost chưa được phép đăng nhập. Vào Authentication > Settings > Authorized domains và thêm localhost.";
  }
  if (/auth\/unauthorized-continue-uri/i.test(message)) {
    return "Đường dẫn xác thực email chưa được Firebase cho phép. Hãy thêm domain của app vào Firebase Authentication > Settings > Authorized domains, hoặc bỏ cấu hình NEXT_PUBLIC_FIREBASE_AUTH_ACTION_CONTINUE_URL.";
  }
  if (/auth\/popup-blocked/i.test(message)) {
    return "Cửa sổ đăng nhập Google đang bị chặn. Với bản exe, hãy dùng bản mới đã hỗ trợ popup Google trong ứng dụng.";
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

function BookLogoIcon() {
  return (
    <svg aria-hidden="true" className="h-10 w-10" viewBox="0 0 48 48" fill="none">
      <path d="M9 15.5c5.6.6 10 2.4 13.3 5.3v18.7C18.6 36.9 14.2 35.4 9 35V15.5Z" fill="white" opacity="0.96" />
      <path d="M39 15.5c-5.6.6-10 2.4-13.3 5.3v18.7c3.7-2.6 8.1-4.1 13.3-4.5V15.5Z" fill="white" opacity="0.96" />
      <path d="M24 18.6V40" stroke="white" strokeWidth="2.8" strokeLinecap="round" opacity="0.9" />
      <path d="M24 7.5l1.7 3.5 3.8.6-2.7 2.7.6 3.8-3.4-1.8-3.4 1.8.6-3.8-2.7-2.7 3.8-.6L24 7.5Z" fill="white" />
      <path d="M13.8 8.8l.9 1.9 2.1.3-1.5 1.5.4 2.1-1.9-1-1.9 1 .4-2.1-1.5-1.5 2.1-.3.9-1.9ZM34.2 8.8l.9 1.9 2.1.3-1.5 1.5.4 2.1-1.9-1-1.9 1 .4-2.1-1.5-1.5 2.1-.3.9-1.9Z" fill="white" opacity="0.9" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 20 20" fill="none">
      <path d="m5 10 3 3 7-7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none">
      <path d="M4.5 7.5h15v10h-15v-10Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="m5 8 7 5 7-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none">
      <path d="M7 10V8a5 5 0 0 1 10 0v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M6 10h12v9H6v-9Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M12 14v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none">
      <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" stroke="currentColor" strokeWidth="2" />
      <path d="M4.5 20a7.5 7.5 0 0 1 15 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none">
      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" stroke="currentColor" strokeWidth="2" />
      <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg aria-hidden="true" className="h-6 w-6" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.6 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h5.9a5 5 0 0 1-2.2 3.3v2.8h3.6c2.1-2 3.3-4.8 3.3-8.2Z" />
      <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.6l-3.6-2.8c-1 .7-2.2 1-3.7 1-2.8 0-5.2-1.9-6.1-4.5H2.2V17A11 11 0 0 0 12 23Z" />
      <path fill="#FBBC05" d="M5.9 14.2a6.6 6.6 0 0 1 0-4.3V7H2.2a11 11 0 0 0 0 10l3.7-2.8Z" />
      <path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A10.8 10.8 0 0 0 12 1 11 11 0 0 0 2.2 7l3.7 2.9c.9-2.6 3.3-4.5 6.1-4.5Z" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg aria-hidden="true" className="h-7 w-7" viewBox="0 0 24 24" fill="none">
      <path d="M12 3.5 19 6v5.4c0 4.2-2.8 7.9-7 9.1-4.2-1.2-7-4.9-7-9.1V6l7-2.5Z" stroke="currentColor" strokeWidth="2" />
      <path d="m8.8 12 2.2 2.2 4.4-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DocumentIcon() {
  return (
    <svg aria-hidden="true" className="h-7 w-7" viewBox="0 0 24 24" fill="none">
      <path d="M6 3.5h8l4 4V20H6V3.5Z" fill="currentColor" opacity="0.18" />
      <path d="M14 3.5V8h4M6 3.5h8l4 4V20H6V3.5Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M9 12h6M9 15h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function BotIcon() {
  return (
    <svg aria-hidden="true" className="h-7 w-7" viewBox="0 0 24 24" fill="none">
      <path d="M8 9h8a4 4 0 0 1 4 4v4H4v-4a4 4 0 0 1 4-4Z" stroke="currentColor" strokeWidth="2" />
      <path d="M12 9V5M9 5h6M9 14h.01M15 14h.01" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M8.5 18.5h7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function LessonMockup() {
  return (
    <div className="lesson-mockup" aria-hidden="true">
      <div className="lesson-paper">
        <p className="lesson-mini-title">GIÁO ÁN</p>
        <p className="lesson-mini-subtitle">THEO CÔNG VĂN 2345</p>
        <div className="lesson-mini-checks">
          <span />
          <span />
          <span />
        </div>
        <div className="lesson-mini-lines">
          <i />
          <i />
          <i />
          <i />
        </div>
        <div className="lesson-mini-table">
          <span />
          <span />
        </div>
      </div>
      <div className="lesson-glass-base" />
    </div>
  );
}

function AuthInputIcon({ children }: { children: ReactNode }) {
  return <span className="pointer-events-none absolute left-4 top-1/2 flex -translate-y-1/2 text-slate-500">{children}</span>;
}

export function AuthPanel({ onSessionReady }: AuthPanelProps) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
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
    <main className="auth-page flex min-h-screen items-center justify-center px-4 py-7 sm:px-6 lg:px-8">
      {policyTitle ? (
        <PolicyModal
          title={policyTitle}
          content={policyTitle === "Điều khoản sử dụng" ? policies.terms : policies.privacy}
          onClose={() => setPolicyTitle("")}
        />
      ) : null}

      <div className="auth-shell animate-fade-in flex w-full max-w-7xl overflow-hidden bg-white shadow-float md:min-h-[660px]">
        <div className="auth-hero relative hidden w-[48%] flex-shrink-0 overflow-hidden px-10 py-9 text-white md:flex md:flex-col lg:px-14">
          <div className="auth-hero-dots pointer-events-none absolute inset-0" />
          <div className="auth-hero-wave pointer-events-none absolute inset-0" />
          <div className="auth-hero-glow pointer-events-none absolute bottom-0 right-0 h-72 w-72 rounded-full bg-sky-300/20 blur-3xl" />

          <div className="relative z-10 flex items-center gap-3">
            <BookLogoIcon />
            <span className="text-2xl font-black tracking-tight">EduPlan AI</span>
          </div>

          <div className="relative z-10 mt-12 max-w-lg">
            <h1 className="text-5xl font-black leading-tight tracking-normal text-white lg:text-6xl">
              EduPlan AI
            </h1>
            <p className="mt-4 max-w-md text-xl font-bold leading-snug text-white/95">
              Soạn giáo án chuẩn Công văn 2345 trong vài phút
            </p>
          </div>

          <ul className="relative z-10 mt-8 max-w-[520px] space-y-4 text-base font-medium leading-relaxed text-white/95">
            {[
              "Tải ảnh SGK, AI tự soạn giáo án đầy đủ",
              "Xem trước khổ A4, xuất Word/PDF nhanh chóng",
              "Tùy chỉnh linh hoạt, phù hợp từng lớp học",
            ].map((item) => (
              <li key={item} className="flex items-center gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-brand-700 shadow-lg shadow-brand-950/20">
                  <CheckIcon />
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>

          <div className="relative z-10 mt-auto grid grid-cols-[190px_minmax(0,1fr)] items-end gap-5 pt-8">
            <div className="space-y-3">
              <div className="auth-feature-chip">
                <ShieldIcon />
                <span>Chuẩn CV 2345</span>
              </div>
              <div className="auth-feature-chip">
                <DocumentIcon />
                <span>Xuất Word/PDF</span>
              </div>
              <div className="auth-feature-chip">
                <BotIcon />
                <span>AI hỗ trợ giáo viên</span>
              </div>
            </div>
            <LessonMockup />
          </div>

          <p className="relative z-10 mt-6 text-xs font-medium text-white/70">
            © 2025 EduPlan AI - Hỗ trợ giáo viên Việt Nam
          </p>
        </div>

        <div className="flex w-full flex-1 flex-col justify-center px-6 py-9 sm:px-10 md:px-12 lg:px-16 xl:px-20">
          <div className="mb-7 flex items-center gap-3 md:hidden">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-lg shadow-brand-600/20">
              <BookLogoIcon />
            </span>
            <span className="text-xl font-black text-slate-950">EduPlan AI</span>
          </div>

          {mode !== "reset" ? (
            <div className="mb-10">
              <div className="relative inline-flex rounded-full bg-surface-100 p-1.5 shadow-inner">
                <div
                  className="absolute inset-y-1.5 rounded-full bg-white shadow-soft transition-all duration-300 ease-out"
                  style={{
                    width: "50%",
                    left: mode === "login" ? "6px" : "calc(50% - 0px)",
                  }}
                />
                <button
                  className={`relative z-10 min-w-[128px] rounded-full px-6 py-2.5 text-base font-black transition-colors duration-200 ${
                    mode === "login" ? "text-brand-700" : "text-slate-400 hover:text-slate-600"
                  }`}
                  onClick={() => setMode("login")}
                >
                  Đăng nhập
                </button>
                <button
                  className={`relative z-10 min-w-[128px] rounded-full px-6 py-2.5 text-base font-black transition-colors duration-200 ${
                    mode === "register" ? "text-brand-700" : "text-slate-400 hover:text-slate-600"
                  }`}
                  onClick={() => setMode("register")}
                >
                  Đăng ký
                </button>
              </div>
            </div>
          ) : null}

          <div className="mb-8">
            <h2 className="text-4xl font-black leading-tight text-slate-950">
              {title}
            </h2>
            <p className="mt-3 text-base leading-relaxed text-slate-500">
              {mode === "reset"
                ? "Nhập email để nhận link đặt lại mật khẩu."
                : "Đăng nhập để vào giao diện tạo giáo án và lưu lịch sử làm việc."}
            </p>
          </div>

          <div className="space-y-5">
            {mode === "register" ? (
              <label className="block">
                <span className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-500">
                  Họ tên
                </span>
                <span className="relative block">
                  <AuthInputIcon><UserIcon /></AuthInputIcon>
                  <input
                    className="auth-input-field"
                    placeholder="Nguyễn Văn A"
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                  />
                </span>
              </label>
            ) : null}

            <label className="block">
              <span className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-500">
                Email
              </span>
              <span className="relative block">
                <AuthInputIcon><MailIcon /></AuthInputIcon>
                <input
                  className="auth-input-field"
                  type="email"
                  placeholder="email@example.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </span>
            </label>

            {mode !== "reset" ? (
              <label className="block">
                <span className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-500">
                  Mật khẩu
                </span>
                <span className="relative block">
                  <AuthInputIcon><LockIcon /></AuthInputIcon>
                  <input
                    className="auth-input-field pr-12"
                    type={passwordVisible ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                  <button
                    type="button"
                    className="absolute right-4 top-1/2 flex -translate-y-1/2 text-slate-500 transition-colors hover:text-brand-700"
                    onClick={() => setPasswordVisible((current) => !current)}
                    aria-label={passwordVisible ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                  >
                    <EyeIcon />
                  </button>
                </span>
              </label>
            ) : null}

            {mode === "register" ? (
              <label className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-surface-50 p-3.5 text-xs leading-5 text-slate-600 transition-colors hover:border-brand-100 hover:bg-brand-50/30">
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

            <button
              className="btn-primary w-full py-4 text-lg font-black"
              disabled={isSubmitting}
              onClick={handleEmailAuth}
            >
              {isSubmitting ? "Đang xử lý..." : title}
            </button>

            {mode !== "reset" ? (
              <button
                className="btn-secondary w-full py-3.5 text-lg font-black"
                disabled={isSubmitting}
                onClick={handleGoogleLogin}
              >
                <GoogleIcon />
                Tiếp tục với Google
              </button>
            ) : null}
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-base">
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

          <div className="mt-8 border-t border-slate-100 pt-6 text-center text-sm leading-6 text-slate-400">
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
