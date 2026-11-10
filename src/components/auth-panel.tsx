"use client";

import { useEffect, useRef, useState, type ReactNode, type FormEvent } from "react";
import {
  createUserWithEmailAndPassword,
  getRedirectResult,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithCustomToken,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  updateProfile,
  type User,
} from "firebase/auth";
import { completeFirebaseAuthSession, getGoogleAuthStrategy } from "@/lib/auth-client";
import { getEmailActionSettings, getFirebaseClientAuth, googleAuthProvider, hasFirebaseClientConfig } from "@/lib/firebase-client";
import {
  isValidVietnamesePhoneNumber,
  normalizePhoneNumber,
  phoneToInternalEmail,
} from "@/lib/phone-utils";

type AuthPanelProps = {
  onSessionReady: () => Promise<void> | void;
  onOpenGuide?: () => void;
  onOpenIntro?: () => void;
  initialMode?: AuthMode;
  initialMethod?: AuthMethod;
};

type AuthMode = "login" | "register" | "reset";
type AuthMethod = "email" | "phone";

const ZALO_SUPPORT_URL = "https://zalo.me/g/iunsqm93yttvc2wx99cq";

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
    return "Tài khoản của bạn bị khóa, vui lòng liên hệ hỗ trợ kỹ thuật 0342 733 640 nếu bạn cho là bị nhầm lẫn.";
  }
  if (/tài khoản.*khóa|account.*disabled/i.test(message)) return message;
  if (/auth\/configuration-not-found/i.test(message)) {
    return "Firebase Authentication chưa được bật cho project này. Vào Firebase Console > Authentication > Get started, rồi bật Phone, Email/Password và Google.";
  }
  if (/auth\/billing-not-enabled/i.test(message)) {
    return "Firebase yêu cầu dự án phải liên kết tài khoản thanh toán (gói Blaze) để gửi SMS thật ra số điện thoại bên ngoài. Bạn cần nâng cấp lên gói Blaze trong Firebase Console hoặc thêm số này vào danh sách 'Số điện thoại thử nghiệm'.";
  }
  if (/region.*enabled|sms.*region/i.test(message)) {
    return "Firebase chưa bật gửi SMS về vùng Việt Nam (+84). Vào Firebase Console > Authentication > Settings > SMS region policy, thêm Việt Nam (+84).";
  }
  if (/auth\/operation-not-allowed/i.test(message)) {
    return "Phương thức Phone hoặc vùng gửi SMS (+84) chưa được cấp phép. Vào Firebase Console > Authentication > Settings > SMS Regions để thêm Việt Nam (+84).";
  }
  if (/auth\/unauthorized-domain/i.test(message)) {
    return "Domain hiện tại chưa được phép đăng nhập. Vào Authentication > Settings > Authorized domains để thêm domain.";
  }
  if (/auth\/unauthorized-continue-uri/i.test(message)) {
    return "Đường dẫn xác thực email chưa được Firebase cho phép. Hãy thêm domain của app vào Firebase Authentication > Settings > Authorized domains.";
  }
  if (/auth\/popup-blocked/i.test(message)) {
    return "Cửa sổ đăng nhập Google đang bị chặn. Hãy cho phép hiển thị cửa sổ bật lên trong trình duyệt của bạn.";
  }
  if (/auth\/popup-closed-by-user/i.test(message)) {
    return "Cửa sổ đăng nhập Google đã bị đóng trước khi hoàn tất.";
  }
  if (/auth\/invalid-email/i.test(message)) {
    return "Địa chỉ email không đúng định dạng hoặc chưa được nhập.";
  }
  if (/auth\/missing-email/i.test(message)) {
    return "Vui lòng nhập địa chỉ email.";
  }
  if (/auth\/missing-password/i.test(message)) {
    return "Vui lòng nhập mật khẩu.";
  }
  if (/auth\/invalid-credential|auth\/wrong-password|auth\/user-not-found/i.test(message)) {
    return "Email hoặc mật khẩu chưa đúng.";
  }
  if (/auth\/email-already-in-use/i.test(message)) {
    return "Email này đã được đăng ký tài khoản.";
  }
  if (/auth\/weak-password/i.test(message)) {
    return "Mật khẩu cần tối thiểu 6 ký tự.";
  }
  if (/auth\/invalid-phone-number/i.test(message)) {
    return "Số điện thoại không hợp lệ. Vui lòng kiểm tra lại.";
  }
  if (/auth\/too-many-requests/i.test(message)) {
    return "Quá nhiều yêu cầu từ thiết bị này. Vui lòng đợi ít phút trước khi thử lại.";
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

/* ───────────────────────── ICONS ───────────────────────── */

function BookLogoIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 48 48" fill="none">
      <path d="M9 15.5c5.6.6 10 2.4 13.3 5.3v18.7C18.6 36.9 14.2 35.4 9 35V15.5Z" fill="white" opacity="0.96" />
      <path d="M39 15.5c-5.6.6-10 2.4-13.3 5.3v18.7c3.7-2.6 8.1-4.1 13.3-4.5V15.5Z" fill="white" opacity="0.96" />
      <path d="M24 18.6V40" stroke="white" strokeWidth="2.8" strokeLinecap="round" opacity="0.9" />
      <path d="M24 7.5l1.7 3.5 3.8.6-2.7 2.7.6 3.8-3.4-1.8-3.4 1.8.6-3.8-2.7-2.7 3.8-.6L24 7.5Z" fill="white" />
      <path d="M13.8 8.8l.9 1.9 2.1.3-1.5 1.5.4 2.1-1.9-1-1.9 1 .4-2.1-1.5-1.5 2.1-.3.9-1.9ZM34.2 8.8l.9 1.9 2.1.3-1.5 1.5.4 2.1-1.9-1-1.9 1 .4-2.1-1.5-1.5 2.1-.3.9-1.9Z" fill="white" opacity="0.9" />
    </svg>
  );
}

function UsersIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function CheckmarkIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3.5 8.5 6.5 11.5 12.5 4.5" />
    </svg>
  );
}

function MailIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

function PhoneIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

function LockIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function UserIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function EyeIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
      <line x1="2" x2="22" y1="2" y2="22" />
    </svg>
  );
}

function GoogleIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.6 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h5.9a5 5 0 0 1-2.2 3.3v2.8h3.6c2.1-2 3.3-4.8 3.3-8.2Z" />
      <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.6l-3.6-2.8c-1 .7-2.2 1-3.7 1-2.8 0-5.2-1.9-6.1-4.5H2.2V17A11 11 0 0 0 12 23Z" />
      <path fill="#FBBC05" d="M5.9 14.2a6.6 6.6 0 0 1 0-4.3V7H2.2a11 11 0 0 0 0 10l3.7-2.8Z" />
      <path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A10.8 10.8 0 0 0 12 1 11 11 0 0 0 2.2 7l3.7 2.9c.9-2.6 3.3-4.5 6.1-4.5Z" />
    </svg>
  );
}

function BookOpenOutlineIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  );
}

function ShieldCheckOutlineIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function DocumentTextOutlineIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  );
}

function LightningBoltOutlineIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

/* ───────────────────────── AMBIENT WATERMARKS ───────────────────────── */

function SchoolBuildingWatermark() {
  return (
    <svg aria-hidden="true" className="pointer-events-none absolute -left-10 top-1/2 -translate-y-1/2 h-[380px] w-[280px] text-blue-300/40 hidden md:block" viewBox="0 0 240 300" fill="none" stroke="currentColor" strokeWidth="1.3">
      <line x1="120" y1="18" x2="120" y2="45" />
      <path d="M120 20 C128 20, 134 26, 142 22 L142 34 C134 38, 128 32, 120 34 Z" fill="currentColor" opacity="0.3" />
      <path d="M102 65 C102 48 138 48 138 65 Z" />
      <rect x="100" y="65" width="40" height="25" rx="3" />
      <circle cx="120" cy="77" r="7" />
      <line x1="120" y1="73" x2="120" y2="77" />
      <line x1="120" y1="77" x2="124" y2="79" />
      <polygon points="120,95 60,130 180,130" />
      <rect x="68" y="130" width="104" height="12" />
      <rect x="80" y="142" width="10" height="70" />
      <rect x="104" y="142" width="10" height="70" />
      <rect x="126" y="142" width="10" height="70" />
      <rect x="150" y="142" width="10" height="70" />
      <path d="M112 178 C112 168 128 168 128 178 L128 212 L112 212 Z" />
      <rect x="30" y="142" width="38" height="70" />
      <rect x="172" y="142" width="38" height="70" />
      <rect x="40" y="155" width="8" height="14" rx="1" />
      <rect x="52" y="155" width="8" height="14" rx="1" />
      <rect x="40" y="180" width="8" height="14" rx="1" />
      <rect x="52" y="180" width="8" height="14" rx="1" />
      <rect x="180" y="155" width="8" height="14" rx="1" />
      <rect x="192" y="155" width="8" height="14" rx="1" />
      <rect x="180" y="180" width="8" height="14" rx="1" />
      <rect x="192" y="180" width="8" height="14" rx="1" />
      <rect x="18" y="212" width="204" height="10" rx="2" />
      <rect x="8" y="222" width="224" height="12" rx="2" />
    </svg>
  );
}

function BooksWatermark() {
  return (
    <svg aria-hidden="true" className="pointer-events-none absolute -right-6 bottom-4 h-[280px] w-[280px] text-blue-300/40 hidden md:block" viewBox="0 0 200 200" fill="none" stroke="currentColor" strokeWidth="1.3">
      <path d="M40 140 L150 115 L170 135 L60 160 Z" />
      <path d="M40 140 L40 152 L60 172 L60 160" />
      <path d="M60 172 L170 147 L170 135" />
      <path d="M35 110 L145 85 L165 105 L55 130 Z" />
      <path d="M35 110 L35 122 L55 142 L55 130" />
      <path d="M55 142 L165 117 L165 105" />
      <polygon points="100,35 160,55 100,75 40,55" fill="currentColor" fillOpacity="0.1" />
      <path d="M65 65 C65 85 135 85 135 65" />
      <circle cx="100" cy="55" r="3" fill="currentColor" />
      <path d="M100 55 C125 58 145 70 148 95" strokeWidth="1.5" />
      <circle cx="148" cy="97" r="3" fill="currentColor" />
    </svg>
  );
}

/* ───────────────────────── 3D TECH SCENE ILLUSTRATION ───────────────────────── */

function HeroTechIllustration() {
  return (
    <div className="relative mx-auto flex w-full items-center justify-center select-none" aria-hidden="true">
      <svg className="w-full h-auto overflow-visible" viewBox="0 0 540 380" fill="none">
        <defs>
          {/* Radial pedestal glow */}
          <radialGradient id="pedestalGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.85" />
            <stop offset="45%" stopColor="#0284c7" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#0369a1" stopOpacity="0" />
          </radialGradient>

          {/* Neon Ring Gradient */}
          <linearGradient id="neonCyan" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="50%" stopColor="#67e8f9" />
            <stop offset="100%" stopColor="#3b82f6" />
          </linearGradient>

          {/* Laptop gradients */}
          <linearGradient id="laptopDeck" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f8fafc" />
            <stop offset="40%" stopColor="#e2e8f0" />
            <stop offset="100%" stopColor="#cbd5e1" />
          </linearGradient>
          <linearGradient id="laptopDeckSide" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#64748b" />
            <stop offset="50%" stopColor="#94a3b8" />
            <stop offset="100%" stopColor="#475569" />
          </linearGradient>

          <linearGradient id="screenBezel" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#0f172a" />
            <stop offset="100%" stopColor="#1e293b" />
          </linearGradient>

          {/* Book colors */}
          <linearGradient id="bookCoverBlue1" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#1d4ed8" />
            <stop offset="100%" stopColor="#1e3a8a" />
          </linearGradient>
          <linearGradient id="bookCoverBlue2" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#2563eb" />
            <stop offset="100%" stopColor="#1d4ed8" />
          </linearGradient>
          <linearGradient id="bookCoverBlue3" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#2563eb" />
          </linearGradient>

          {/* AI Chip Gradient */}
          <linearGradient id="aiChipBorder" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="50%" stopColor="#818cf8" />
            <stop offset="100%" stopColor="#c084fc" />
          </linearGradient>
          <linearGradient id="aiChipBody" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0f172a" />
            <stop offset="100%" stopColor="#1e1b4b" />
          </linearGradient>

          {/* Filters */}
          <filter id="softGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* ── 1. CIRCUIT TRACES RADIATING FROM AI CHIP ── */}
        <g stroke="#38bdf8" strokeWidth="1.6" opacity="0.85" fill="none">
          <path d="M260 68 L260 25 L180 25 L180 55" />
          <path d="M290 70 L355 70 L395 35 L450 35" />
          <path d="M290 85 L365 85 L405 120 L440 120" />
          <path d="M230 75 L150 75 L120 110 L90 110" />
          <path d="M230 90 L170 90 L150 148 L105 148" />

          {/* Solder nodes */}
          <circle cx="180" cy="55" r="3.5" fill="#38bdf8" />
          <circle cx="450" cy="35" r="3.5" fill="#38bdf8" />
          <circle cx="440" cy="120" r="3.5" fill="#38bdf8" />
          <circle cx="90" cy="110" r="3.5" fill="#38bdf8" />
          <circle cx="105" cy="148" r="3.5" fill="#38bdf8" />
          <circle cx="355" cy="70" r="2.5" fill="#67e8f9" />
          <circle cx="170" cy="90" r="2.5" fill="#67e8f9" />
        </g>

        {/* ── 2. AI PROCESSOR CHIP (TOP CENTER) ── */}
        <g transform="translate(260, 48)">
          <rect x="-32" y="-32" width="64" height="64" rx="18" fill="url(#aiChipBody)" stroke="url(#aiChipBorder)" strokeWidth="3" filter="url(#softGlow)" />
          {/* Connector Pins */}
          <path d="M-16 -32 L-16 -37 M0 -32 L0 -37 M16 -32 L16 -37" stroke="#38bdf8" strokeWidth="2" />
          <path d="M-16 32 L-16 37 M0 32 L0 37 M16 32 L16 37" stroke="#38bdf8" strokeWidth="2" />
          <path d="M-32 -16 L-37 -16 M-32 0 L-37 0 M-32 16 L-37 16" stroke="#38bdf8" strokeWidth="2" />
          <path d="M32 -16 L37 -16 M32 0 L37 0 M32 16 L37 16" stroke="#38bdf8" strokeWidth="2" />
          {/* AI Bold Text */}
          <text x="0" y="9" fill="#ffffff" fontSize="26" fontWeight="900" textAnchor="middle" letterSpacing="1.2">
            AI
          </text>
        </g>

        {/* ── 3. FLOATING GLASS TILES ── */}
        {/* Upper-left Tile: Open Book */}
        <g transform="translate(195, 125)">
          <rect x="-22" y="-22" width="44" height="44" rx="13" fill="rgba(255, 255, 255, 0.16)" stroke="rgba(255, 255, 255, 0.45)" strokeWidth="1.5" />
          <path d="M-11 -5 C-7 -7 -3 -7 0 -5 C3 -7 7 -7 11 -5 L11 7 C7 5 3 5 0 7 C-3 5 -7 5 -11 7 Z" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </g>

        {/* Lower-left Tile: Small Open Book */}
        <g transform="translate(165, 248)">
          <rect x="-18" y="-18" width="36" height="36" rx="11" fill="rgba(255, 255, 255, 0.14)" stroke="rgba(255, 255, 255, 0.35)" strokeWidth="1.3" />
          <path d="M-9 -4 C-6 -6 -2 -6 0 -4 C2 -6 6 -6 9 -4 L9 6 C6 4 2 4 0 6 C-2 4 -6 4 -9 6 Z" fill="none" stroke="#ffffff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </g>

        {/* Upper-right Tile: 3-Bar Chart */}
        <g transform="translate(415, 138)">
          <rect x="-22" y="-22" width="44" height="44" rx="13" fill="rgba(255, 255, 255, 0.16)" stroke="rgba(255, 255, 255, 0.45)" strokeWidth="1.5" />
          <path d="M-10 8 L-10 1 M-3 8 L-3 -4 M4 8 L4 -9" stroke="#ffffff" strokeWidth="2.6" strokeLinecap="round" />
        </g>

        {/* ── 4. CYAN HOLOGRAPHIC PEDESTAL ── */}
        <g transform="translate(235, 298)">
          <ellipse cx="0" cy="0" rx="155" ry="34" fill="url(#pedestalGlow)" />
          <ellipse cx="0" cy="0" rx="138" ry="28" fill="none" stroke="url(#neonCyan)" strokeWidth="2.8" opacity="0.95" filter="url(#softGlow)" />
          <ellipse cx="0" cy="0" rx="112" ry="20" fill="none" stroke="#bae6fd" strokeWidth="1.2" opacity="0.6" strokeDasharray="6 4" />
        </g>

        {/* ── 5. ISOMETRIC LAPTOP ── */}
        {/* Laptop Keyboard Base */}
        <g>
          {/* Chassis Front Lip */}
          <polygon points="120,272 220,318 355,272 355,266 220,312 120,266" fill="url(#laptopDeckSide)" />
          {/* Chassis Top Deck */}
          <polygon points="120,266 220,312 355,266 255,224" fill="url(#laptopDeck)" />
          {/* Keyboard Recessed Area */}
          <polygon points="152,252 224,284 315,254 250,228" fill="#475569" opacity="0.55" />
          {/* Key row indicator lines */}
          <path d="M165 248 L232 278 M180 242 L245 272 M195 236 L258 265 M210 231 L270 259" stroke="#94a3b8" strokeWidth="1.2" opacity="0.6" />
          {/* Trackpad */}
          <polygon points="198,290 240,305 254,298 214,284" fill="#94a3b8" opacity="0.75" />
        </g>

        {/* Laptop Screen & Floating Document Sheet */}
        <g>
          {/* Screen Outer Lid (Bezel) */}
          <polygon points="160,248 274,232 292,112 180,126" fill="url(#screenBezel)" stroke="#334155" strokeWidth="2" />
          {/* Screen Glass Interior */}
          <polygon points="166,243 268,229 285,119 184,131" fill="#0f172a" />

          {/* Floating Document Sheet ("Giáo án AI") */}
          <g filter="url(#softGlow)">
            {/* Sheet body */}
            <polygon points="170,238 270,224 287,116 188,129" fill="#ffffff" />

            {/* Document Header Text "Giáo án" */}
            <text x="197" y="150" fill="#1e3a8a" fontSize="12.5" fontWeight="900" transform="rotate(-7, 197, 150)">
              Giáo án
            </text>

            {/* "AI" Pill Badge */}
            <g transform="translate(263, 134) rotate(-7)">
              <rect x="-10" y="-8.5" width="22" height="14" rx="7" fill="url(#bookCoverBlue2)" />
              <text x="1" y="2" fill="#ffffff" fontSize="9" fontWeight="900" textAnchor="middle">
                AI
              </text>
            </g>

            {/* 3 Checkmark lines */}
            {/* Row 1 */}
            <circle cx="200" cy="166" r="4.5" fill="#22c55e" />
            <path d="M198 166 L199.5 167.5 L202 164.5" stroke="#ffffff" strokeWidth="1.3" strokeLinecap="round" />
            <polygon points="208,163 258,156 258,160 208,167" fill="#cbd5e1" rx="2" />

            {/* Row 2 */}
            <circle cx="197" cy="183" r="4.5" fill="#22c55e" />
            <path d="M195 183 L196.5 184.5 L199 181.5" stroke="#ffffff" strokeWidth="1.3" strokeLinecap="round" />
            <polygon points="205,180 250,173 250,177 205,184" fill="#cbd5e1" rx="2" />

            {/* Row 3 */}
            <circle cx="194" cy="200" r="4.5" fill="#22c55e" />
            <path d="M192 200 L193.5 201.5 L196 198.5" stroke="#ffffff" strokeWidth="1.3" strokeLinecap="round" />
            <polygon points="202,197 244,191 244,195 202,201" fill="#cbd5e1" rx="2" />
          </g>

          {/* Microsoft Word [W] Overlapping Badge */}
          <g transform="translate(268, 202) rotate(-7)">
            <rect x="-17" y="-19" width="36" height="40" rx="9" fill="#ffffff" stroke="#93c5fd" strokeWidth="1.5" filter="url(#softGlow)" />
            <rect x="-13" y="-15" width="28" height="30" rx="7" fill="#1d4ed8" />
            <text x="1" y="6" fill="#ffffff" fontSize="17" fontWeight="900" textAnchor="middle" fontFamily="sans-serif">
              W
            </text>
          </g>
        </g>

        {/* ── 6. STACK OF 3 BLUE BOOKS + GRADUATION CAP ── */}
        <g transform="translate(405, 235)">
          {/* Book 1 (Bottom Book) */}
          <polygon points="-46,30 38,7 60,22 -24,45" fill="url(#bookCoverBlue1)" />
          <polygon points="-46,30 -24,45 -24,54 -46,39" fill="#1e3a8a" />
          <polygon points="-24,54 60,31 60,22 -24,45" fill="#f8fafc" />

          {/* Book 2 (Middle Book) */}
          <polygon points="-50,14 34,-9 56,6 -28,29" fill="url(#bookCoverBlue2)" />
          <polygon points="-50,14 -28,29 -28,38 -50,23" fill="#1d4ed8" />
          <polygon points="-28,38 56,15 56,6 -28,29" fill="#f8fafc" />

          {/* Book 3 (Top Book) */}
          <polygon points="-46,-2 38,-25 60,-10 -24,13" fill="url(#bookCoverBlue3)" />
          <polygon points="-46,-2 -24,13 -24,22 -46,7" fill="#2563eb" />
          <polygon points="-24,22 60,0 60,-10 -24,13" fill="#f8fafc" />

          {/* Graduation Cap (Mortarboard) */}
          <g transform="translate(6, -26)">
            {/* Skull Cap Base */}
            <path d="M-16 11 C-16 24 26 24 26 11 Z" fill="#0f172a" />
            {/* Top Diamond */}
            <polygon points="6,-15 45,4 6,21 -33,4" fill="#0f172a" stroke="#334155" strokeWidth="1.5" />
            {/* Center Gold Button */}
            <circle cx="6" cy="4" r="3" fill="#facc15" />
            {/* Gold Tassel */}
            <path d="M6 4 C20 6 32 15 34 30 L34 40" fill="none" stroke="#facc15" strokeWidth="2" strokeLinecap="round" />
            {/* Tassel tip */}
            <circle cx="34" cy="42" r="3" fill="#eab308" />
          </g>
        </g>
      </svg>
    </div>
  );
}

/* ───────────────────────── 4 FEATURE BENTO CHIPS ───────────────────────── */

function FeatureChipsRow() {
  const items = [
    {
      icon: <BookOpenOutlineIcon className="h-5 w-5 text-white shrink-0" />,
      titleTop: "Kho SGK NXB",
      titleBottom: "Giáo dục",
      subtitle: "Chọn trực tiếp, tiện lợi",
    },
    {
      icon: <ShieldCheckOutlineIcon className="h-5 w-5 text-white shrink-0" />,
      titleTop: "Chuẩn CV 2345",
      titleBottom: "& GDPT 2018",
      subtitle: "Đảm bảo đúng quy định",
    },
    {
      icon: <DocumentTextOutlineIcon className="h-5 w-5 text-white shrink-0" />,
      titleTop: "Xuất Word (.docx)",
      titleBottom: "",
      subtitle: "Giáo án chuyên nghiệp, dễ chỉnh sửa",
    },
    {
      icon: <LightningBoltOutlineIcon className="h-5 w-5 text-white shrink-0" />,
      titleTop: "Tiết kiệm",
      titleBottom: "thời gian",
      subtitle: "Tăng hiệu quả công việc",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-2.5">
      {items.map((item, index) => (
        <div
          key={index}
          className="group relative flex min-w-0 flex-col justify-between rounded-xl border border-white/20 bg-white/[0.12] p-2.5 text-white shadow-[0_8px_20px_rgba(3,20,75,0.22)] backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 hover:border-white/35 hover:bg-white/[0.18]"
        >
          {/* Top row: Icon on the left + Bold title on the right */}
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/20 transition-transform group-hover:scale-105">
              {item.icon}
            </span>
            <div className="min-w-0">
              <h4 className="text-[12px] font-bold leading-tight text-white sm:text-[12.5px]">
                {item.titleTop}
                {item.titleBottom ? <span className="block">{item.titleBottom}</span> : null}
              </h4>
            </div>
          </div>
          {/* Subtitle below */}
          <p className="mt-1.5 text-[10.5px] font-medium leading-snug text-blue-100/85">
            {item.subtitle}
          </p>
        </div>
      ))}
    </div>
  );
}

/* ───────────────────────── MODALS ───────────────────────── */

function PolicyModal({ title, content, onClose }: { title: string; content: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="max-h-[85vh] w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-slate-900/10 flex flex-col animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5 bg-slate-50/80">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600">EduPlan AI</span>
            <h2 className="text-xl font-extrabold text-slate-900">{title}</h2>
          </div>
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-200/70 hover:text-slate-700 transition-colors"
            onClick={onClose}
            aria-label="Đóng"
          >
            <span className="text-2xl leading-none">&times;</span>
          </button>
        </div>
        <div className="overflow-y-auto p-6 space-y-4 text-sm leading-relaxed text-slate-600">
          {content.split(/\n{2,}/).map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </div>
        <div className="border-t border-slate-100 px-6 py-4 bg-slate-50/80 flex justify-end">
          <button
            type="button"
            className="inline-flex min-h-[44px] items-center justify-center px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 active:scale-[0.98] shadow-sm transition-all"
            onClick={onClose}
          >
            Đã hiểu & Đóng
          </button>
        </div>
      </div>
    </div>
  );
}

function FeaturesOverviewModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  if (!isOpen) return null;
  const features = [
    {
      title: "1. Chọn trực tiếp SGK số từ NXB Giáo Dục",
      desc: "Tích hợp đầy đủ sách giáo khoa Kết nối tri thức, Chân trời sáng tạo, Cánh diều. Giáo viên chỉ cần chọn bài và trang, không cần gõ lại thủ công.",
    },
    {
      title: "2. Chuẩn Công văn 2345/BGDĐT-GDTH & GDPT 2018",
      desc: "Tự động phân bổ cấu trúc 4 hoạt động: Khởi động, Khám phá, Luyện tập, Vận dụng. Đầy đủ hoạt động giáo viên, hoạt động học sinh, sản phẩm và đánh giá.",
    },
    {
      title: "3. Tự động gợi ý mục tiêu, học liệu và năng lực số",
      desc: "Hệ thống AI bám sát yêu cầu cần đạt (YCCĐ) của Bộ GD&ĐT, gợi ý phương pháp sư phạm tích cực, đồ dùng dạy học và tích hợp năng lực số thực chất.",
    },
    {
      title: "4. Xuất file Word (.docx) chuẩn in ấn",
      desc: "Tải về file DOCX hai cột chuẩn lề A4, công thức toán học sắc nét, bảng biểu căn chỉnh chuẩn mực, sẵn sàng chỉnh sửa và nộp tổ chuyên môn.",
    },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="max-h-[85vh] w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-slate-900/10 flex flex-col animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600">EduPlan AI · Tính năng nổi bật</span>
            <h2 className="text-xl font-black text-slate-900 mt-0.5">Trợ lý Soạn Giáo Án Đột Phá</h2>
          </div>
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-200/70 hover:text-slate-700 transition-colors"
            onClick={onClose}
            aria-label="Đóng"
          >
            <span className="text-2xl leading-none">&times;</span>
          </button>
        </div>
        <div className="overflow-y-auto p-6 space-y-4">
          {features.map((f, i) => (
            <div key={i} className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4 transition-colors hover:border-blue-200 hover:bg-blue-50/30">
              <h3 className="text-sm font-bold text-slate-900">{f.title}</h3>
              <p className="mt-1.5 text-xs sm:text-sm leading-relaxed text-slate-600">{f.desc}</p>
            </div>
          ))}
        </div>
        <div className="border-t border-slate-100 px-6 py-4 bg-slate-50/80 flex justify-end">
          <button
            type="button"
            className="inline-flex min-h-[44px] items-center justify-center px-5 py-2 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 active:scale-[0.98] shadow-sm transition-all"
            onClick={onClose}
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}

function PricingModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="max-h-[85vh] w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-slate-900/10 flex flex-col animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600">EduPlan AI</span>
            <h2 className="text-xl font-black text-slate-900 mt-0.5">Bảng Giá &amp; Gói Sử Dụng</h2>
          </div>
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-200/70 hover:text-slate-700 transition-colors"
            onClick={onClose}
            aria-label="Đóng"
          >
            <span className="text-2xl leading-none">&times;</span>
          </button>
        </div>
        <div className="overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Gói Miễn Phí */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col justify-between">
            <div>
              <span className="inline-block rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">Gói Miễn Phí</span>
              <h3 className="mt-3 text-2xl font-black text-slate-900">0đ</h3>
              <p className="mt-1 text-xs text-slate-500">Trải nghiệm tạo giáo án mỗi ngày</p>
              <ul className="mt-4 space-y-2 text-xs text-slate-600">
                <li className="flex items-center gap-2">
                  <CheckmarkIcon className="h-4 w-4 text-emerald-600" />
                  <span>1 lượt tạo giáo án miễn phí mỗi ngày</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckmarkIcon className="h-4 w-4 text-emerald-600" />
                  <span>Chuẩn Công văn 2345 tiểu học</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckmarkIcon className="h-4 w-4 text-emerald-600" />
                  <span>Xuất file Word (.docx)</span>
                </li>
              </ul>
            </div>
            <div className="mt-6 pt-4 border-t border-slate-100">
              <span className="text-xs font-semibold text-slate-500 block text-center">Tự động kích hoạt khi đăng nhập</span>
            </div>
          </div>

          {/* Gói Plus */}
          <div className="relative rounded-2xl border-2 border-blue-600 bg-gradient-to-b from-blue-50/50 to-white p-5 shadow-md flex flex-col justify-between">
            <span className="absolute -top-3 right-4 rounded-full bg-blue-600 px-3 py-0.5 text-[11px] font-bold text-white shadow-sm">
              PHỔ BIẾN NHẤT
            </span>
            <div>
              <span className="inline-block rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700">Gói Plus Chuyên Sâu</span>
              <h3 className="mt-3 text-2xl font-black text-blue-700">Nâng Cấp</h3>
              <p className="mt-1 text-xs text-slate-500">Dành cho giáo viên soạn bài chuyên nghiệp</p>
              <ul className="mt-4 space-y-2 text-xs text-slate-600">
                <li className="flex items-center gap-2">
                  <CheckmarkIcon className="h-4 w-4 text-blue-600" />
                  <span>Soạn không giới hạn số lượng bài dạy</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckmarkIcon className="h-4 w-4 text-blue-600" />
                  <span>Ưu tiên AI thế hệ mới tốc độ cao</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckmarkIcon className="h-4 w-4 text-blue-600" />
                  <span>Tự động crop tranh ảnh SGK vào bài dạy</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckmarkIcon className="h-4 w-4 text-blue-600" />
                  <span>Hỗ trợ chuyên gia kỹ thuật 24/7 qua Zalo</span>
                </li>
              </ul>
            </div>
            <div className="mt-6 pt-4 border-t border-slate-100">
              <a
                href={ZALO_SUPPORT_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex w-full min-h-[44px] items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-700 transition-all shadow-sm"
              >
                <span>Liên hệ hỗ trợ gói Plus</span>
                <span>&rarr;</span>
              </a>
            </div>
          </div>
        </div>
        <div className="border-t border-slate-100 px-6 py-4 bg-slate-50/80 flex justify-end">
          <button
            type="button"
            className="inline-flex min-h-[44px] items-center justify-center px-5 py-2 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-200/60 active:scale-[0.98] transition-all"
            onClick={onClose}
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── MAIN AUTH PANEL COMPONENT ───────────────────────── */

export function AuthPanel({
  onSessionReady,
  onOpenGuide,
  onOpenIntro,
  initialMode = "login",
  initialMethod = "email",
}: AuthPanelProps) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [authMethod, setAuthMethod] = useState<AuthMethod>(initialMethod);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const urlMode = params.get("mode");
      const urlMethod = params.get("method");
      if (urlMode === "register" || urlMode === "reset" || urlMode === "login") {
        setMode(urlMode);
      }
      if (urlMethod === "phone" || urlMethod === "email") {
        setAuthMethod(urlMethod);
      }
    }
  }, []);

  const [phoneNumber, setPhoneNumber] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [newResetPassword, setNewResetPassword] = useState("");
  const [newResetPasswordVisible, setNewResetPasswordVisible] = useState(false);
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

  const [isFeaturesOpen, setIsFeaturesOpen] = useState(false);
  const [isPricingOpen, setIsPricingOpen] = useState(false);

  const clientReady = hasFirebaseClientConfig();

  function switchMode(newMode: AuthMode) {
    setMode(newMode);
    setRecoveryCode("");
    setNewResetPassword("");
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

  const onSessionReadyRef = useRef(onSessionReady);
  onSessionReadyRef.current = onSessionReady;

  useEffect(() => {
    if (!clientReady) return;

    // Check redirect completion silently without pre-emptively locking the login button
    completeGoogleRedirectOnce(onSessionReadyRef.current)
      .then((hasUser) => {
        if (hasUser) {
          setMessage("Đăng nhập Google thành công!");
        }
      })
      .catch((authError) => {
        setError(friendlyAuthError(authError));
      });
  }, [clientReady]);

  async function finishSession(user: User) {
    await completeFirebaseAuthSession({ user, onSessionReady });
  }

  async function handleEmailAuth(e?: FormEvent) {
    if (e) e.preventDefault();
    setError("");
    setMessage("");
    if (!clientReady) {
      setError("Thiếu cấu hình Firebase trong .env.local.");
      return;
    }

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setError("Vui lòng nhập địa chỉ email.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError("Địa chỉ email không đúng định dạng. Vui lòng kiểm tra lại.");
      return;
    }

    if (mode === "register") {
      if (!displayName.trim()) {
        setError("Vui lòng nhập họ và tên.");
        return;
      }
      if (!password || password.length < 6) {
        setError("Mật khẩu cần tối thiểu 6 ký tự.");
        return;
      }
      if (!acceptedPolicy) {
        setError("Bạn cần đồng ý Điều khoản sử dụng và Chính sách bảo mật.");
        return;
      }
    } else if (mode === "login") {
      if (!password) {
        setError("Vui lòng nhập mật khẩu.");
        return;
      }
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
        setMessage("Đã tạo tài khoản thành công!");
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

  async function handlePhoneLogin(e?: FormEvent) {
    if (e) e.preventDefault();
    setError("");
    setMessage("");
    if (!clientReady) {
      setError("Thiếu cấu hình kết nối tài khoản.");
      return;
    }
    const rawPhone = phoneNumber.trim();
    if (!rawPhone) {
      setError("Vui lòng nhập số điện thoại.");
      return;
    }
    if (!isValidVietnamesePhoneNumber(rawPhone)) {
      setError("Số điện thoại không đúng định dạng nhà mạng Việt Nam (10 chữ số).");
      return;
    }
    const cleaned = normalizePhoneNumber(rawPhone);
    if (!password) {
      setError("Vui lòng nhập mật khẩu.");
      return;
    }

    setIsSubmitting(true);
    try {
      const auth = getFirebaseClientAuth();
      const internalEmail = phoneToInternalEmail(cleaned);
      const credential = await signInWithEmailAndPassword(auth, internalEmail, password);
      await finishSession(credential.user);
    } catch (authError) {
      const msg = authError instanceof Error ? authError.message : String(authError);
      if (/auth\/invalid-credential|auth\/user-not-found|auth\/wrong-password/i.test(msg)) {
        setError("Số điện thoại hoặc mật khẩu chưa đúng.");
      } else {
        setError(friendlyAuthError(authError));
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handlePhoneRegister(e?: FormEvent) {
    if (e) e.preventDefault();
    setError("");
    setMessage("");
    if (!clientReady) {
      setError("Thiếu cấu hình kết nối tài khoản.");
      return;
    }

    if (!displayName.trim()) {
      setError("Vui lòng nhập họ và tên.");
      return;
    }

    const rawPhone = phoneNumber.trim();
    if (!rawPhone) {
      setError("Vui lòng nhập số điện thoại.");
      return;
    }
    if (!isValidVietnamesePhoneNumber(rawPhone)) {
      setError("Số điện thoại không đúng định dạng nhà mạng Việt Nam (10 chữ số).");
      return;
    }

    if (!password || password.length < 6) {
      setError("Mật khẩu cần tối thiểu 6 ký tự.");
      return;
    }

    const trimmedCode = recoveryCode.trim();
    if (!trimmedCode || !/^\d{6}$/.test(trimmedCode)) {
      setError("Vui lòng nhập mã code tùy chỉnh đúng 6 số để khôi phục mật khẩu sau này.");
      return;
    }

    if (!acceptedPolicy) {
      setError("Bạn cần đồng ý Điều khoản sử dụng và Chính sách bảo mật.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/auth/phone/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phoneNumber: rawPhone,
          password,
          displayName: displayName.trim(),
          recoveryCode: trimmedCode,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        customToken?: string;
        error?: string;
      };
      if (!res.ok || !data.customToken) {
        setError(data.error || "Không thể hoàn tất đăng ký.");
        return;
      }

      const auth = getFirebaseClientAuth();
      const credential = await signInWithCustomToken(auth, data.customToken);
      await finishSession(credential.user);
      setMessage("Đăng ký thành công!");
    } catch (authError) {
      setError(friendlyAuthError(authError));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handlePhoneResetPassword(e?: FormEvent) {
    if (e) e.preventDefault();
    setError("");
    setMessage("");
    if (!clientReady) {
      setError("Thiếu cấu hình kết nối tài khoản.");
      return;
    }

    if (!displayName.trim()) {
      setError("Vui lòng nhập họ và tên của tài khoản.");
      return;
    }

    const rawPhone = phoneNumber.trim();
    if (!rawPhone) {
      setError("Vui lòng nhập số điện thoại.");
      return;
    }

    if (!isValidVietnamesePhoneNumber(rawPhone)) {
      setError("Số điện thoại không đúng định dạng nhà mạng Việt Nam.");
      return;
    }

    const trimmedCode = recoveryCode.trim();
    if (!trimmedCode || !/^\d{6}$/.test(trimmedCode)) {
      setError("Vui lòng nhập mã code khôi phục đúng 6 chữ số.");
      return;
    }

    if (!newResetPassword || newResetPassword.length < 6) {
      setError("Mật khẩu mới cần tối thiểu 6 ký tự.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/auth/phone/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phoneNumber: rawPhone,
          displayName: displayName.trim(),
          recoveryCode: trimmedCode,
          newPassword: newResetPassword,
        }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        message?: string;
      };

      if (!res.ok) {
        setError(data.error || "Thông tin Họ tên, Số điện thoại hoặc Mã khôi phục chưa chính xác. Vui lòng kiểm tra lại.");
        return;
      }

      setMessage("Đã đặt lại mật khẩu thành công! Bạn có thể đăng nhập ngay.");
      setPassword(newResetPassword);
      setNewResetPassword("");
      setRecoveryCode("");
      setMode("login");
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleGoogleLogin() {
    setError("");
    setMessage("");
    if (!clientReady) {
      setError("Thiếu cấu hình Firebase trong .env.local.");
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
      ? authMethod === "phone"
        ? "Nhập Họ tên, Số điện thoại và Mã code 6 số để đặt lại mật khẩu mới."
        : "Nhập email để nhận link đặt lại mật khẩu tài khoản."
      : authMethod === "phone"
      ? mode === "login"
        ? "Đăng nhập để sử dụng EduPlan AI và tạo giáo án thông minh"
        : "Tạo tài khoản mới bằng số điện thoại để bắt đầu sử dụng"
      : mode === "login"
      ? "Đăng nhập để sử dụng EduPlan AI và tạo giáo án thông minh"
      : "Đăng ký tài khoản để bắt đầu sử dụng EduPlan AI";

  return (
    <div className="relative flex flex-1 w-full max-w-full overflow-x-hidden flex-col items-center justify-start px-3 py-3 sm:px-6 sm:py-5 lg:px-8 selection:bg-blue-600 selection:text-white">
      {/* Policy Modal */}
      {policyTitle ? (
        <PolicyModal
          title={policyTitle}
          content={policyTitle === "Điều khoản sử dụng" ? policies.terms : policies.privacy}
          onClose={() => setPolicyTitle("")}
        />
      ) : null}

      {/* Feature & Pricing Modals */}
      <FeaturesOverviewModal isOpen={isFeaturesOpen} onClose={() => setIsFeaturesOpen(false)} />
      <PricingModal isOpen={isPricingOpen} onClose={() => setIsPricingOpen(false)} />

      {/* Background Watermark Vectors */}
      <SchoolBuildingWatermark />
      <BooksWatermark />

      {/* ── 1. FLOATING TOP NAVBAR ── */}
      <header className="mb-4 sm:mb-6 flex w-full max-w-[1200px] min-w-0 overflow-hidden flex-col gap-1.5 rounded-2xl border border-blue-100/90 bg-white/95 px-3 py-2 sm:px-6 sm:py-2.5 shadow-[0_8px_30px_rgba(37,99,235,0.06)] backdrop-blur-md">
        <div className="flex w-full items-center justify-between">
          {/* Brand Left */}
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-md shadow-blue-600/30">
              <BookLogoIcon className="h-5 w-5" />
            </span>
            <div className="flex items-center gap-2.5">
              <span className="text-base sm:text-lg font-black tracking-tight text-slate-900 leading-tight">EduPlan AI</span>
              <span className="hidden sm:inline h-3.5 w-px bg-slate-200" />
              <span className="hidden md:inline text-xs sm:text-[13px] font-medium text-slate-500">Trợ lý AI cho giáo viên Việt Nam</span>
            </div>
          </div>

          {/* Navigation & Action Right */}
          <div className="flex items-center gap-2 sm:gap-4 md:gap-6">
            <nav className="hidden lg:flex items-center gap-5 text-[13.5px] font-semibold text-slate-600">
              <button
                type="button"
                className="hover:text-blue-600 transition-colors"
                onClick={() => setIsFeaturesOpen(true)}
              >
                Tính năng
              </button>
              {onOpenGuide ? (
                <button
                  type="button"
                  className="hover:text-blue-600 transition-colors"
                  onClick={onOpenGuide}
                >
                  Hướng dẫn sử dụng
                </button>
              ) : null}
              <button
                type="button"
                className="hover:text-blue-600 transition-colors"
                onClick={() => setIsPricingOpen(true)}
              >
                Bảng giá
              </button>
              {onOpenIntro ? (
                <button
                  type="button"
                  className="hover:text-blue-600 transition-colors"
                  onClick={onOpenIntro}
                >
                  Giới thiệu
                </button>
              ) : null}
            </nav>

            {/* Nhóm Zalo Hỗ Trợ Button */}
            <a
              href={ZALO_SUPPORT_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-[40px] shrink-0 items-center gap-1.5 sm:gap-2 rounded-full border border-blue-200 bg-blue-50/60 px-2.5 sm:px-3.5 py-1.5 text-[11.5px] sm:text-[13px] font-bold text-blue-700 hover:bg-blue-100/70 hover:border-blue-300 transition-all active:scale-[0.98] shadow-2xs whitespace-nowrap"
              title="Tham gia nhóm Zalo hỗ trợ kỹ thuật"
            >
              <UsersIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-600 shrink-0" />
              <span>Nhóm Zalo hỗ trợ</span>
            </a>
          </div>
        </div>

        {/* Mobile quick-action sub-row on screens < lg */}
        <nav className="flex lg:hidden flex-wrap items-center justify-center gap-x-3 border-t border-slate-100 pt-1 text-xs font-semibold text-slate-600">
          <button
            type="button"
            className="min-h-[44px] flex items-center px-2 hover:text-blue-600 transition-colors"
            onClick={() => setIsFeaturesOpen(true)}
          >
            Tính năng
          </button>
          {onOpenGuide ? (
            <button
              type="button"
              className="min-h-[44px] flex items-center px-2 hover:text-blue-600 transition-colors"
              onClick={onOpenGuide}
            >
              Hướng dẫn
            </button>
          ) : null}
          <button
            type="button"
            className="min-h-[44px] flex items-center px-2 hover:text-blue-600 transition-colors"
            onClick={() => setIsPricingOpen(true)}
          >
            Bảng giá
          </button>
          {onOpenIntro ? (
            <button
              type="button"
              className="min-h-[44px] flex items-center px-2 hover:text-blue-600 transition-colors"
              onClick={onOpenIntro}
            >
              Giới thiệu
            </button>
          ) : null}
        </nav>
      </header>

      {/* ── 2. MAIN SPLIT CARD SHELL ── */}
      <div className="relative flex w-full max-w-[1200px] flex-col lg:flex-row overflow-hidden rounded-[26px] bg-gradient-to-br from-[#0b48d2] via-[#083cb5] to-[#7dbaff] p-2 sm:p-2.5 lg:p-3.5 shadow-[0_24px_70px_-12px_rgba(6,32,112,0.35)] ring-1 ring-white/50 my-auto">
        {/* Soft Background Radial Light & Halftone */}
        <div className="pointer-events-none absolute -left-20 -top-20 h-96 w-96 rounded-full bg-sky-400/25 blur-3xl" />
        <div className="pointer-events-none absolute left-1/3 top-1/2 h-80 w-80 -translate-y-1/2 rounded-full bg-blue-400/20 blur-3xl" />

        {/* ── LEFT HERO PANEL ── */}
        <div className="relative z-10 flex min-w-0 flex-1 flex-col justify-between p-4 sm:p-6 lg:p-7 text-white">
          <div>
            {/* Top Brand Tag */}
            <div className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/15 backdrop-blur-sm ring-1 ring-white/20">
                <BookLogoIcon className="h-4 w-4" />
              </span>
              <span className="text-lg font-black tracking-tight text-white">EduPlan AI</span>
            </div>

            {/* Headline */}
            <h1 className="mt-4 text-2xl sm:text-3xl lg:text-[34px] xl:text-[36px] font-black leading-[1.18] tracking-tight text-white">
              Trợ lý soạn giáo án<br />
              thông minh cho giáo viên<br />
              <span className="italic font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-sky-200 via-sky-100 to-white">
                thời đại số
              </span>
            </h1>

            {/* Subtitle description */}
            <p className="mt-2.5 max-w-lg text-xs sm:text-[13.5px] leading-relaxed text-blue-100/90 font-medium">
              Soạn giáo án chuẩn Công văn 2345 &amp; GDPT 2018, tiết kiệm thời gian, xuất Word nhanh chóng, hỗ trợ chọn SGK và lập kế hoạch bài dạy chuyên nghiệp.
            </p>

            {/* Middle Row: 4 Checklist items + 3D Scene */}
            <div className="mt-5 grid grid-cols-1 md:grid-cols-[290px_1fr] xl:grid-cols-[315px_1fr] items-center gap-3 lg:gap-4">
              {/* 4 Checklist Bullets */}
              <ul className="space-y-3">
                {[
                  "Chọn trực tiếp SGK số từ NXB Giáo dục",
                  "Tự động gợi ý mục tiêu, hoạt động, học liệu",
                  "Xuất giáo án Word (.docx) chuẩn chỉnh",
                  "Tối ưu thời gian soạn bài cho giáo viên",
                ].map((item, idx) => (
                  <li key={idx} className="flex items-center gap-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#70baff]/35 text-white ring-1 ring-white/50 shadow-xs">
                      <CheckmarkIcon className="h-3 w-3" />
                    </span>
                    <span className="text-xs sm:text-[12.5px] font-semibold text-white/95 leading-snug md:whitespace-nowrap">
                      {item}
                    </span>
                  </li>
                ))}
              </ul>

              {/* 3D Scene Illustration */}
              <div className="hidden sm:block">
                <HeroTechIllustration />
              </div>
            </div>
          </div>

          {/* Bottom Row: 4 Bento Feature Chips */}
          <div className="mt-5 pt-3.5 border-t border-white/15">
            <FeatureChipsRow />
          </div>
        </div>

        {/* ── RIGHT LOGIN CARD PANEL ── */}
        <div className="relative z-20 flex min-w-0 w-full flex-col justify-center rounded-[22px] bg-white p-5 sm:p-8 lg:w-[440px] xl:w-[460px] shadow-[0_16px_40px_rgba(2,12,45,0.18)]">
          {/* Subtle Watermark at top-right of login card */}
          <svg aria-hidden="true" className="pointer-events-none absolute right-4 top-4 h-24 w-28 text-blue-100/70" viewBox="0 0 100 80" fill="none" stroke="currentColor" strokeWidth="1.2">
            <path d="M15 50 C25 45 40 45 50 50 C60 45 75 45 85 50 L85 25 C75 20 60 20 50 25 C40 20 25 20 15 25 Z" fill="currentColor" fillOpacity="0.3" />
            <polygon points="50,10 75,20 50,30 25,20" fill="currentColor" fillOpacity="0.5" />
            <path d="M35 25 C35 34 65 34 65 25" />
          </svg>

          {/* Header */}
          <div className="relative mb-5 text-left">
            <h2 className="text-2xl sm:text-[26px] font-black tracking-tight text-slate-900 leading-tight">
              {title}
            </h2>
            <p className="mt-1 text-xs sm:text-[13px] font-medium leading-relaxed text-slate-500">
              {subtitle}
            </p>
          </div>

          {/* Method Tabs Switcher (Email / Số điện thoại) */}
          <div className="mb-5 grid grid-cols-2 rounded-xl bg-slate-100 p-1 border border-slate-200/60 text-xs sm:text-sm font-bold">
            <button
              type="button"
              className={`flex min-h-[44px] items-center justify-center gap-2 rounded-lg transition-all active:scale-[0.98] ${
                authMethod === "email"
                  ? "bg-white text-blue-700 shadow-sm"
                  : "text-slate-500 hover:text-slate-900"
              }`}
              onClick={() => {
                setAuthMethod("email");
                setError("");
                setMessage("");
              }}
            >
              <MailIcon className="h-4 w-4" />
              <span>Email</span>
            </button>
            <button
              type="button"
              className={`flex min-h-[44px] items-center justify-center gap-2 rounded-lg transition-all active:scale-[0.98] ${
                authMethod === "phone"
                  ? "bg-white text-blue-700 shadow-sm"
                  : "text-slate-500 hover:text-slate-900"
              }`}
              onClick={() => {
                setAuthMethod("phone");
                setError("");
                setMessage("");
              }}
            >
              <PhoneIcon className="h-4 w-4" />
              <span>Số điện thoại</span>
            </button>
          </div>

          {/* Form Fields: EMAIL FLOW */}
          {authMethod === "email" ? (
            <form onSubmit={handleEmailAuth} className="space-y-4">
              {mode === "register" ? (
                <label className="block text-left">
                  <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Họ tên
                  </span>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                      <UserIcon className="h-4 w-4" />
                    </span>
                    <input
                      className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10 min-h-[44px] transition-all"
                      placeholder="Nguyễn Văn A"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                    />
                  </div>
                </label>
              ) : null}

              <label className="block text-left">
                <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Email
                </span>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                    <MailIcon className="h-4 w-4" />
                  </span>
                  <input
                    className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10 min-h-[44px] transition-all"
                    type="email"
                    placeholder="email@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </label>

              {mode !== "reset" ? (
                <label className="block text-left">
                  <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Mật khẩu
                  </span>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                      <LockIcon className="h-4 w-4" />
                    </span>
                    <input
                      className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-11 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10 min-h-[44px] transition-all"
                      type={passwordVisible ? "text" : "password"}
                      placeholder="Nhập mật khẩu"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 transition-colors"
                      onClick={() => setPasswordVisible((c) => !c)}
                      aria-label={passwordVisible ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                    >
                      {passwordVisible ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                    </button>
                  </div>
                </label>
              ) : null}

              {mode === "register" ? (
                <label className="flex items-start gap-2.5 rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs leading-5 text-slate-600">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 accent-blue-600"
                    checked={acceptedPolicy}
                    onChange={(e) => setAcceptedPolicy(e.target.checked)}
                  />
                  <span>
                    Tôi đồng ý với{" "}
                    <button
                      className="font-bold text-blue-600 hover:underline"
                      type="button"
                      onClick={() => setPolicyTitle("Điều khoản sử dụng")}
                    >
                      Điều khoản sử dụng
                    </button>{" "}
                    và{" "}
                    <button
                      className="font-bold text-blue-600 hover:underline"
                      type="button"
                      onClick={() => setPolicyTitle("Chính sách bảo mật")}
                    >
                      Chính sách bảo mật
                    </button>
                    .
                  </span>
                </label>
              ) : null}

              {/* Feedback messages */}
              {error ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-bold leading-5 text-red-700">
                  {error}
                </div>
              ) : null}
              {message ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-bold leading-5 text-emerald-700">
                  {message}
                </div>
              ) : null}

              {/* Primary Blue Action Button */}
              <button
                type="submit"
                className="inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-5 py-3 text-sm font-bold text-white shadow-md shadow-blue-600/30 hover:from-blue-700 hover:to-blue-800 active:scale-[0.985] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isSubmitting || (mode === "register" && !acceptedPolicy)}
              >
                <span>{isSubmitting ? "Đang xử lý..." : title}</span>
                <span className="text-base">&rarr;</span>
              </button>

              {/* Divider HOẶC */}
              {mode !== "reset" ? (
                <>
                  <div className="relative my-2 flex items-center justify-center">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-slate-200" />
                    </div>
                    <span className="relative bg-white px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      HOẶC
                    </span>
                  </div>

                  {/* Google Button */}
                  <button
                    type="button"
                    className="inline-flex min-h-[44px] w-full items-center justify-center gap-2.5 rounded-xl border border-slate-200/90 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 active:scale-[0.985] shadow-2xs transition-all disabled:opacity-50"
                    disabled={isSubmitting}
                    onClick={handleGoogleLogin}
                  >
                    <GoogleIcon className="h-5 w-5" />
                    <span>Tiếp tục với Google</span>
                  </button>
                </>
              ) : null}
            </form>
          ) : mode === "login" ? (
            /* PHONE LOGIN FLOW */
            <form onSubmit={handlePhoneLogin} className="space-y-4">
              <label className="block text-left">
                <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Số điện thoại
                </span>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                    <PhoneIcon className="h-4 w-4" />
                  </span>
                  <input
                    className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10 min-h-[44px] transition-all"
                    type="tel"
                    inputMode="tel"
                    placeholder="0912 345 678"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                  />
                </div>
              </label>

              <label className="block text-left">
                <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Mật khẩu
                </span>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                    <LockIcon className="h-4 w-4" />
                  </span>
                  <input
                    className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-11 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10 min-h-[44px] transition-all"
                    type={passwordVisible ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 transition-colors"
                    onClick={() => setPasswordVisible((c) => !c)}
                    aria-label={passwordVisible ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                  >
                    {passwordVisible ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                  </button>
                </div>
              </label>

              {error ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-bold leading-5 text-red-700">
                  {error}
                </div>
              ) : null}
              {message ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-bold leading-5 text-emerald-700">
                  {message}
                </div>
              ) : null}

              <button
                type="submit"
                className="inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-5 py-3 text-sm font-bold text-white shadow-md shadow-blue-600/30 hover:from-blue-700 hover:to-blue-800 active:scale-[0.985] transition-all disabled:opacity-50"
                disabled={isSubmitting}
              >
                <span>{isSubmitting ? "Đang xử lý..." : "Đăng nhập"}</span>
                <span className="text-base">&rarr;</span>
              </button>

              <div className="relative my-2 flex items-center justify-center">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200" />
                </div>
                <span className="relative bg-white px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  HOẶC
                </span>
              </div>

              <button
                type="button"
                className="inline-flex min-h-[44px] w-full items-center justify-center gap-2.5 rounded-xl border border-slate-200/90 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 active:scale-[0.985] shadow-2xs transition-all disabled:opacity-50"
                disabled={isSubmitting}
                onClick={handleGoogleLogin}
              >
                <GoogleIcon className="h-5 w-5" />
                <span>Tiếp tục với Google</span>
              </button>
            </form>
          ) : mode === "register" ? (
            /* PHONE REGISTER FLOW */
            <form onSubmit={handlePhoneRegister} className="space-y-4">
              <label className="block text-left">
                <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Họ tên
                </span>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                    <UserIcon className="h-4 w-4" />
                  </span>
                  <input
                    className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10 min-h-[44px] transition-all"
                    placeholder="Nguyễn Văn A"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                  />
                </div>
              </label>

              <label className="block text-left">
                <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Số điện thoại
                </span>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                    <PhoneIcon className="h-4 w-4" />
                  </span>
                  <input
                    className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10 min-h-[44px] transition-all"
                    type="tel"
                    inputMode="tel"
                    placeholder="0912 345 678"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                  />
                </div>
              </label>

              <label className="block text-left">
                <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Mật khẩu
                </span>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                    <LockIcon className="h-4 w-4" />
                  </span>
                  <input
                    className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-11 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10 min-h-[44px] transition-all"
                    type={passwordVisible ? "text" : "password"}
                    placeholder="Tối thiểu 6 ký tự"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 transition-colors"
                    onClick={() => setPasswordVisible((c) => !c)}
                    aria-label={passwordVisible ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                  >
                    {passwordVisible ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                  </button>
                </div>
              </label>

              <label className="block text-left">
                <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Mã code khôi phục (6 số)
                </span>
                <input
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 px-4 font-mono tracking-widest text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10 min-h-[44px] transition-all"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="Ví dụ: 123456"
                  value={recoveryCode}
                  onChange={(e) => setRecoveryCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                />
              </label>

              <label className="flex items-start gap-2.5 rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs leading-5 text-slate-600">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 accent-blue-600"
                  checked={acceptedPolicy}
                  onChange={(e) => setAcceptedPolicy(e.target.checked)}
                />
                <span>
                  Tôi đồng ý với{" "}
                  <button
                    className="font-bold text-blue-600 hover:underline"
                    type="button"
                    onClick={() => setPolicyTitle("Điều khoản sử dụng")}
                  >
                    Điều khoản sử dụng
                  </button>{" "}
                  và{" "}
                  <button
                    className="font-bold text-blue-600 hover:underline"
                    type="button"
                    onClick={() => setPolicyTitle("Chính sách bảo mật")}
                  >
                    Chính sách bảo mật
                  </button>
                  .
                </span>
              </label>

              {error ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-bold leading-5 text-red-700">
                  {error}
                </div>
              ) : null}
              {message ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-bold leading-5 text-emerald-700">
                  {message}
                </div>
              ) : null}

              <button
                type="submit"
                className="inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-5 py-3 text-sm font-bold text-white shadow-md shadow-blue-600/30 hover:from-blue-700 hover:to-blue-800 active:scale-[0.985] transition-all disabled:opacity-50"
                disabled={isSubmitting || !acceptedPolicy}
              >
                <span>{isSubmitting ? "Đang xử lý..." : "Đăng ký tài khoản"}</span>
                <span className="text-base">&rarr;</span>
              </button>
            </form>
          ) : (
            /* PHONE RESET PASSWORD FLOW */
            <form onSubmit={handlePhoneResetPassword} className="space-y-4">
              <label className="block text-left">
                <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Họ và tên tài khoản
                </span>
                <input
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 px-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10 min-h-[44px] transition-all"
                  placeholder="Nguyễn Văn A"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </label>

              <label className="block text-left">
                <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Số điện thoại
                </span>
                <input
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 px-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10 min-h-[44px] transition-all"
                  type="tel"
                  placeholder="0912 345 678"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                />
              </label>

              <label className="block text-left">
                <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Mã code khôi phục 6 số
                </span>
                <input
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 px-4 font-mono tracking-widest text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10 min-h-[44px] transition-all"
                  type="text"
                  maxLength={6}
                  placeholder="••••••"
                  value={recoveryCode}
                  onChange={(e) => setRecoveryCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                />
              </label>

              <label className="block text-left">
                <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Mật khẩu mới
                </span>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                    <LockIcon className="h-4 w-4" />
                  </span>
                  <input
                    className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-11 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10 min-h-[44px] transition-all"
                    type={newResetPasswordVisible ? "text" : "password"}
                    placeholder="Tối thiểu 6 ký tự"
                    value={newResetPassword}
                    onChange={(e) => setNewResetPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 transition-colors"
                    onClick={() => setNewResetPasswordVisible((c) => !c)}
                    aria-label={newResetPasswordVisible ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                  >
                    {newResetPasswordVisible ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                  </button>
                </div>
              </label>

              {error ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-bold leading-5 text-red-700">
                  {error}
                </div>
              ) : null}
              {message ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-bold leading-5 text-emerald-700">
                  {message}
                </div>
              ) : null}

              <button
                type="submit"
                className="inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-5 py-3 text-sm font-bold text-white shadow-md shadow-blue-600/30 hover:from-blue-700 hover:to-blue-800 active:scale-[0.985] transition-all disabled:opacity-50"
                disabled={isSubmitting}
              >
                <span>{isSubmitting ? "Đang xử lý..." : "Xác nhận & Đổi mật khẩu"}</span>
              </button>
            </form>
          )}

          {/* Links Row: Đăng ký | Quên mật khẩu? */}
          <div className="mt-5 flex items-center justify-center gap-3 text-xs sm:text-[13px]">
            {mode !== "login" ? (
              <button
                type="button"
                className="font-bold text-blue-600 hover:text-blue-700 transition-colors"
                onClick={() => switchMode("login")}
              >
                Đăng nhập
              </button>
            ) : null}
            {mode !== "register" ? (
              <button
                type="button"
                className="font-bold text-blue-600 hover:text-blue-700 transition-colors"
                onClick={() => switchMode("register")}
              >
                Đăng ký
              </button>
            ) : null}
            {mode === "login" ? (
              <>
                <span className="text-slate-300">|</span>
                <button
                  type="button"
                  className="font-medium text-slate-500 hover:text-slate-700 transition-colors"
                  onClick={() => switchMode("reset")}
                >
                  Quên mật khẩu?
                </button>
              </>
            ) : null}
          </div>

          {/* Legal statement footer */}
          <p className="mt-4 text-center text-[11px] leading-relaxed text-slate-400">
            Khi sử dụng EduPlan AI, bạn đồng ý với{" "}
            <button
              className="font-bold text-blue-600 hover:underline"
              type="button"
              onClick={() => setPolicyTitle("Điều khoản sử dụng")}
            >
              Điều khoản sử dụng
            </button>{" "}
            và{" "}
            <button
              className="font-bold text-blue-600 hover:underline"
              type="button"
              onClick={() => setPolicyTitle("Chính sách bảo mật")}
            >
              Chính sách bảo mật
            </button>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
