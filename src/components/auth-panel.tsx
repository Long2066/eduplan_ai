"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  createUserWithEmailAndPassword,
  getRedirectResult,
  RecaptchaVerifier,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPhoneNumber,
  signInWithPopup,
  signInWithRedirect,
  updateProfile,
  type ConfirmationResult,
  type User,
} from "firebase/auth";
import { completeFirebaseAuthSession, getGoogleAuthStrategy } from "@/lib/auth-client";
import { getEmailActionSettings, getFirebaseClientAuth, googleAuthProvider, hasFirebaseClientConfig } from "@/lib/firebase-client";

type AuthPanelProps = {
  onSessionReady: () => Promise<void> | void;
};

type AuthMode = "login" | "register" | "reset";
type AuthMethod = "email" | "phone";

let redirectCompletionPromise: Promise<boolean> | null = null;

function completeGoogleRedirectOnce(onSessionReady: AuthPanelProps["onSessionReady"]) {
  if (!redirectCompletionPromise) {
    redirectCompletionPromise = (async () => {
      const result = await getRedirectResult(getFirebaseClientAuth());
      if (!result) return false;
      await completeFirebaseAuthSession({ user: result.user, onSessionReady });
      return true;
    })();
  }
  return redirectCompletionPromise;
}

function friendlyAuthError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  if (/lý do từ quản trị viên/i.test(message)) return message;
  if (/bạn đang sử dụng quá nhiều tài khoản/i.test(message)) return message;
  if (/auth\/user-disabled/i.test(message)) {
    return "Tài khoản của bạn bị khóa, vui lòng liên hệ hỗ trợ kĩ thuật 0342 733 640 nếu bạn cho là bị nhầm lẫn.";
  }
  if (/tài khoản.*khóa|account.*disabled/i.test(message)) return message;
  if (/auth\/configuration-not-found/i.test(message)) {
    return "Firebase Authentication chưa được bật cho project này. Vào Firebase Console > Authentication > Get started, rồi bật Phone, Email/Password và Google.";
  }
  if (/region.*enabled|sms.*region/i.test(message)) {
    return "Firebase chưa bật gửi SMS về vùng Việt Nam (+84). Vào Firebase Console > Authentication > Paramètres (Settings) > SMS region policy, thêm Việt Nam (+84).";
  }
  if (/auth\/operation-not-allowed/i.test(message)) {
    return "Phương thức Phone hoặc vùng gửi SMS (+84) chưa được cấp phép. Vào Firebase Console > Authentication > Paramètres (Settings) > SMS Regions để thêm Việt Nam (+84).";
  }
  if (/auth\/unauthorized-domain/i.test(message)) {
    return "Domain hiện tại chưa được phép đăng nhập. Vào Authentication > Settings > Authorized domains để thêm domain.";
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
  if (/auth\/invalid-phone-number/i.test(message)) {
    return "Số điện thoại không hợp lệ. Vui lòng kiểm tra lại.";
  }
  if (/auth\/quota-exceeded/i.test(message)) {
    return "Đã đạt giới hạn tin nhắn SMS miễn phí trong ngày (10 SMS/ngày). Vui lòng thử lại vào ngày mai hoặc đăng nhập bằng Email/Google.";
  }
  if (/auth\/too-many-requests/i.test(message)) {
    return "Quá nhiều yêu cầu từ thiết bị này. Vui lòng đợi ít phút trước khi thử lại.";
  }
  if (/auth\/invalid-verification-code/i.test(message)) {
    return "Mã OTP không chính xác. Vui lòng kiểm tra lại tin nhắn.";
  }
  if (/auth\/code-expired/i.test(message)) {
    return "Mã OTP đã hết hạn. Vui lòng bấm gửi lại mã mới.";
  }
  if (/auth\/captcha-check-failed/i.test(message)) {
    return "Kiểm tra bảo mật reCAPTCHA thất bại. Vui lòng thử lại.";
  }
  if (/auth\/missing-verification-code/i.test(message)) {
    return "Vui lòng nhập đủ 6 chữ số mã OTP.";
  }
  const firebaseCode = typeof error === "object" && error !== null && "code" in error ? String((error as { code?: string }).code) : "";
  return firebaseCode ? `Lỗi (${firebaseCode}): ${message}` : message || "Không thể xử lý tài khoản lúc này.";
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

function PhoneIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none">
      <path
        d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function formatPhoneDisplay(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("84") && digits.length >= 11) {
    return `+84 ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`;
  }
  if (digits.length === 10) {
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  }
  return raw;
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

function GraduationIcon() {
  return (
    <svg aria-hidden="true" className="h-7 w-7" viewBox="0 0 24 24" fill="none">
      <path d="M12 3L2 8l10 5 10-5-10-5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 10v6c0 3 6 3 6 3s6 0 6-3v-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M22 8v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
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
  const [authMethod, setAuthMethod] = useState<AuthMethod>("email");
  const [phoneStep, setPhoneStep] = useState<"input_phone" | "input_otp">("input_phone");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpSecondsLeft, setOtpSecondsLeft] = useState(0);
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);

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

  function resetRecaptcha() {
    if (recaptchaVerifierRef.current) {
      try {
        recaptchaVerifierRef.current.clear();
      } catch {
        // ignore
      }
      recaptchaVerifierRef.current = null;
    }
  }

  function getOrCreateRecaptcha(): RecaptchaVerifier {
    const auth = getFirebaseClientAuth();
    if (recaptchaVerifierRef.current) {
      return recaptchaVerifierRef.current;
    }
    const verifier = new RecaptchaVerifier(auth, "phone-recaptcha-container", {
      size: "invisible",
    });
    recaptchaVerifierRef.current = verifier;
    return verifier;
  }

  useEffect(() => {
    return () => {
      resetRecaptcha();
    };
  }, []);

  useEffect(() => {
    if (phoneStep !== "input_otp" || otpSecondsLeft <= 0) return;
    const timer = setInterval(() => {
      setOtpSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [phoneStep, otpSecondsLeft]);

  function switchMode(newMode: AuthMode) {
    setMode(newMode);
    setPhoneStep("input_phone");
    setOtpCode("");
    setError("");
    setMessage("");
  }

  function handleChangePhone() {
    setPhoneStep("input_phone");
    setOtpCode("");
    setError("");
    setMessage("");
  }

  useEffect(() => {
    fetch("/api/settings/policies")
      .then((response) => response.json())
      .then((result: { policies?: Policies }) => {
        if (result.policies) setPolicies(result.policies);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!clientReady) return;

    let active = true;
    setIsSubmitting(true);
    completeGoogleRedirectOnce(onSessionReady)
      .catch((authError) => {
        if (active) setError(friendlyAuthError(authError));
      })
      .finally(() => {
        if (active) setIsSubmitting(false);
      });

    return () => {
      active = false;
    };
  }, [clientReady, onSessionReady]);

  async function finishSession(user: User) {
    await completeFirebaseAuthSession({ user, onSessionReady });
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
        await finishSession(credential.user);
        setMessage("Đã tạo tài khoản. Vui lòng xác minh email để bắt đầu tạo giáo án.");
        return;
      }

      const credential = await signInWithEmailAndPassword(auth, email, password);
      await finishSession(credential.user);
    } catch (authError) {
      setError(friendlyAuthError(authError));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSendPhoneOtp() {
    setError("");
    setMessage("");
    if (!clientReady) {
      setError("Thiếu Firebase Web App config. Cần điền NEXT_PUBLIC_FIREBASE_* trong .env.local.");
      return;
    }

    const rawPhone = phoneNumber.trim();
    if (!rawPhone) {
      setError("Vui lòng nhập số điện thoại.");
      return;
    }

    let cleaned = rawPhone.replace(/[\s.\-()]/g, "");
    if (cleaned.startsWith("0")) cleaned = "+84" + cleaned.slice(1);
    else if (cleaned.startsWith("84")) cleaned = "+" + cleaned;
    else if (!cleaned.startsWith("+")) cleaned = "+84" + cleaned;

    if (!/^\+[1-9]\d{8,14}$/.test(cleaned)) {
      setError("Số điện thoại không đúng định dạng. Vui lòng nhập số di động Việt Nam (VD: 0912 345 678).");
      return;
    }

    if (mode === "register") {
      if (!displayName.trim()) {
        setError("Vui lòng nhập họ và tên của bạn.");
        return;
      }
      if (!acceptedPolicy) {
        setError("Bạn cần đồng ý Điều khoản sử dụng và Chính sách bảo mật.");
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const checkRes = await fetch("/api/auth/phone/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phoneNumber: cleaned,
          intent: mode === "register" ? "register" : "login",
        }),
      });
      const checkData = (await checkRes.json().catch(() => ({}))) as {
        error?: string;
        code?: string;
        formattedPhone?: string;
      };
      if (!checkRes.ok) {
        setError(checkData.error || "Không thể kiểm tra số điện thoại.");
        return;
      }

      const auth = getFirebaseClientAuth();
      const verifier = getOrCreateRecaptcha();
      const confirmation = await signInWithPhoneNumber(auth, cleaned, verifier);
      setConfirmationResult(confirmation);
      setPhoneStep("input_otp");
      setOtpSecondsLeft(60);
      setMessage(`Đã gửi mã xác thực 6 số đến ${formatPhoneDisplay(cleaned)}. Vui lòng kiểm tra tin nhắn SMS.`);
    } catch (authError) {
      resetRecaptcha();
      setError(friendlyAuthError(authError));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleVerifyOtp() {
    setError("");
    setMessage("");
    if (!confirmationResult) {
      setError("Phiên gửi mã OTP đã hết hạn. Vui lòng gửi lại mã mới.");
      return;
    }
    const code = otpCode.trim();
    if (code.length < 6) {
      setError("Vui lòng nhập đủ 6 chữ số mã xác thực.");
      return;
    }

    setIsSubmitting(true);
    try {
      const credential = await confirmationResult.confirm(code);
      if (mode === "register" && displayName.trim()) {
        await updateProfile(credential.user, { displayName: displayName.trim() }).catch(() => undefined);
      }
      await finishSession(credential.user);
      setMessage(mode === "register" ? "Đăng ký thành công!" : "Đăng nhập thành công!");
    } catch (verifyError) {
      setError(friendlyAuthError(verifyError));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResendOtp() {
    if (otpSecondsLeft > 0) return;
    await handleSendPhoneOtp();
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
      if (getGoogleAuthStrategy() === "redirect") {
        await signInWithRedirect(auth, googleAuthProvider);
        return;
      }

      const credential = await signInWithPopup(auth, googleAuthProvider);
      await finishSession(credential.user);
    } catch (authError) {
      setError(friendlyAuthError(authError));
    } finally {
      setIsSubmitting(false);
    }
  }

  const title = mode === "register" ? "Tạo tài khoản" : mode === "reset" ? "Quên mật khẩu" : "Đăng nhập";
  const subtitle =
    mode === "reset"
      ? "Nhập email để nhận link đặt lại mật khẩu."
      : authMethod === "phone"
      ? phoneStep === "input_otp"
        ? "Nhập mã 6 chữ số vừa nhận để hoàn tất xác thực."
        : mode === "register"
        ? "Đăng ký bằng số điện thoại và nhận mã xác thực qua tin nhắn SMS."
        : "Đăng nhập bằng số điện thoại và nhận mã xác thực qua tin nhắn SMS."
      : "Đăng nhập để vào giao diện tạo giáo án và lưu lịch sử làm việc.";

  return (
    <main className="auth-page flex min-h-screen items-center justify-center px-4 py-7 sm:px-6 lg:px-8">
      <div id="phone-recaptcha-container" />
      {policyTitle ? (
        <PolicyModal
          title={policyTitle}
          content={policyTitle === "Điều khoản sử dụng" ? policies.terms : policies.privacy}
          onClose={() => setPolicyTitle("")}
        />
      ) : null}

      <div className="auth-shell animate-fade-in flex w-full max-w-6xl overflow-hidden bg-white shadow-float md:min-h-[600px] lg:min-h-[660px]">
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
              Soạn giáo án chuẩn Công văn 2345 - Chương trình GDPT 2018 trong vài phút
            </p>
          </div>

          <ul className="relative z-10 mt-8 max-w-[520px] space-y-4 text-base font-medium leading-relaxed text-white/95">
            {[
              "Tải ảnh SGK, AI tự soạn giáo án đầy đủ",
              "Xem trước khổ A4, xuất Word nhanh chóng",
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

          <div className="relative z-10 mt-auto grid grid-cols-[210px_minmax(0,1fr)] items-end gap-5 pt-8">
            <div className="space-y-3">
              <div className="auth-feature-chip">
                <ShieldIcon />
                <span>Chuẩn CV 2345</span>
              </div>
              <div className="auth-feature-chip">
                <GraduationIcon />
                <span>Chuẩn CT GDPT 2018</span>
              </div>
              <div className="auth-feature-chip">
                <DocumentIcon />
                <span>Xuất Word</span>
              </div>
              <div className="auth-feature-chip">
                <BotIcon />
                <span>AI hỗ trợ giáo viên</span>
              </div>
            </div>
            <LessonMockup />
          </div>

          <p className="relative z-10 mt-6 text-xs font-medium text-white/70">
            © 2026 EduPlan AI - Hỗ trợ giáo viên Việt Nam
          </p>
        </div>

        <div className="auth-form-container flex w-full flex-1 flex-col overflow-y-auto px-6 py-9 sm:px-10 md:px-12 lg:px-16 xl:px-20">
          <div className="mb-7 flex items-center gap-3 md:hidden">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-lg shadow-brand-600/20">
              <BookLogoIcon />
            </span>
            <span className="text-xl font-black text-slate-950">EduPlan AI</span>
          </div>

          <div className="flex flex-1 flex-col justify-center">
            {mode !== "reset" ? (
              <div className="auth-switcher-container mb-8 text-center">
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
                    onClick={() => switchMode("login")}
                  >
                    Đăng nhập
                  </button>
                  <button
                    className={`relative z-10 min-w-[128px] rounded-full px-6 py-2.5 text-base font-black transition-colors duration-200 ${
                      mode === "register" ? "text-brand-700" : "text-slate-400 hover:text-slate-600"
                    }`}
                    onClick={() => switchMode("register")}
                  >
                    Đăng ký
                  </button>
                </div>
              </div>
            ) : null}

            <div className="auth-header-container mb-6">
              <h2 className="text-4xl font-black leading-tight text-slate-950">
                {title}
              </h2>
              <p className="mt-2.5 text-base leading-relaxed text-slate-500">
                {subtitle}
              </p>
            </div>

            {mode !== "reset" ? (
              <div className="mb-6 grid grid-cols-2 gap-1.5 rounded-2xl bg-surface-100 p-1.5 text-sm font-bold">
                <button
                  type="button"
                  className={`flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-4 py-2.5 transition-all ${
                    authMethod === "email"
                      ? "bg-white text-brand-700 shadow-sm"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                  onClick={() => {
                    setAuthMethod("email");
                    setError("");
                    setMessage("");
                  }}
                >
                  <MailIcon />
                  <span>Email</span>
                </button>
                <button
                  type="button"
                  className={`flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-4 py-2.5 transition-all ${
                    authMethod === "phone"
                      ? "bg-white text-brand-700 shadow-sm"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                  onClick={() => {
                    setAuthMethod("phone");
                    setError("");
                    setMessage("");
                  }}
                >
                  <PhoneIcon />
                  <span>Số điện thoại</span>
                </button>
              </div>
            ) : null}

            {authMethod === "email" || mode === "reset" ? (
              <div className="auth-fields-container space-y-5">
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
                  className="btn-primary auth-submit-btn w-full py-4 text-lg font-black"
                  disabled={isSubmitting}
                  onClick={handleEmailAuth}
                >
                  {isSubmitting ? "Đang xử lý..." : title}
                </button>

                {mode !== "reset" ? (
                  <button
                    className="btn-secondary auth-google-btn w-full py-3.5 text-lg font-black"
                    disabled={isSubmitting}
                    onClick={handleGoogleLogin}
                  >
                    <GoogleIcon />
                    Tiếp tục với Google
                  </button>
                ) : null}
              </div>
            ) : phoneStep === "input_otp" ? (
              <div className="auth-fields-container space-y-5">
                <div className="rounded-2xl border border-brand-100 bg-brand-50/50 p-4 text-center">
                  <p className="text-xs font-bold uppercase tracking-wider text-brand-600">Xác thực số điện thoại</p>
                  <p className="mt-1 text-sm font-medium text-slate-700">
                    Mã 6 số đã được gửi đến số <strong className="font-bold text-slate-900">{formatPhoneDisplay(phoneNumber)}</strong>
                  </p>
                  <button
                    type="button"
                    className="mt-2 text-xs font-bold text-brand-700 hover:underline"
                    onClick={handleChangePhone}
                  >
                    Đổi số điện thoại khác
                  </button>
                </div>

                <label className="block">
                  <span className="mb-2 block text-center text-xs font-black uppercase tracking-wide text-slate-500">
                    Nhập mã OTP gồm 6 chữ số
                  </span>
                  <input
                    className="auth-input-field text-center font-mono text-2xl font-bold tracking-[0.35em] text-slate-900 placeholder:text-slate-300"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    placeholder="••••••"
                    value={otpCode}
                    onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                    autoFocus
                  />
                </label>

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
                  className="btn-primary auth-submit-btn w-full py-4 text-lg font-black"
                  disabled={isSubmitting || otpCode.length < 6}
                  onClick={handleVerifyOtp}
                >
                  {isSubmitting ? "Đang xác thực..." : mode === "register" ? "Xác nhận & Đăng ký" : "Xác nhận & Đăng nhập"}
                </button>

                <div className="text-center">
                  {otpSecondsLeft > 0 ? (
                    <p className="text-xs font-medium text-slate-400">
                      Gửi lại mã sau <span className="font-bold tabular-nums text-slate-600">{otpSecondsLeft}s</span>
                    </p>
                  ) : (
                    <button
                      type="button"
                      className="text-xs font-bold text-brand-700 hover:underline"
                      disabled={isSubmitting}
                      onClick={handleResendOtp}
                    >
                      Chưa nhận được mã? Gửi lại OTP
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="auth-fields-container space-y-5">
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
                    Số điện thoại
                  </span>
                  <span className="relative block">
                    <AuthInputIcon><PhoneIcon /></AuthInputIcon>
                    <input
                      className="auth-input-field"
                      type="tel"
                      inputMode="tel"
                      placeholder="0912 345 678"
                      value={phoneNumber}
                      onChange={(event) => setPhoneNumber(event.target.value)}
                    />
                  </span>
                  <span className="mt-1.5 block text-[11px] text-slate-400">
                    Hệ thống sẽ gửi tin nhắn SMS chứa mã OTP 6 số để xác thực.
                  </span>
                </label>

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
                  className="btn-primary auth-submit-btn w-full py-4 text-lg font-black"
                  disabled={isSubmitting}
                  onClick={handleSendPhoneOtp}
                >
                  {isSubmitting ? "Đang gửi mã OTP..." : mode === "register" ? "Gửi mã đăng ký SMS" : "Gửi mã đăng nhập SMS"}
                </button>

                <button
                  className="btn-secondary auth-google-btn w-full py-3.5 text-lg font-black"
                  disabled={isSubmitting}
                  onClick={handleGoogleLogin}
                >
                  <GoogleIcon />
                  Tiếp tục với Google
                </button>
              </div>
            )}
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-base">
            {mode !== "login" ? (
              <button
                className="font-bold text-brand-700 transition-colors hover:text-brand-800"
                onClick={() => switchMode("login")}
              >
                Đăng nhập
              </button>
            ) : null}
            {mode !== "register" ? (
              <button
                className="font-bold text-brand-700 transition-colors hover:text-brand-800"
                onClick={() => switchMode("register")}
              >
                Đăng ký
              </button>
            ) : null}
            {mode !== "reset" ? (
              <button
                className="font-medium text-slate-400 transition-colors hover:text-slate-600"
                onClick={() => {
                  setMode("reset");
                  setAuthMethod("email");
                  setError("");
                  setMessage("");
                }}
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
