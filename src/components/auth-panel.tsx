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

/* ───────────────────────── 3D ISOMETRIC SVG SCENE (CGI-STYLE) ───────────────────────── */

function HeroTechIllustration() {
  return (
    <div
      className="auth-hero-svg-wrap relative mx-auto w-full max-w-[440px] select-none pointer-events-none"
      style={{ aspectRatio: "440 / 320" }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 440 320" fill="none" className="h-full w-full overflow-visible">
        <defs>
          <linearGradient id="lpTop" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f1f5f9" />
            <stop offset="100%" stopColor="#c8d4e3" />
          </linearGradient>
          <linearGradient id="lpFront" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#c8d4e3" />
            <stop offset="100%" stopColor="#94a3b8" />
          </linearGradient>
          <linearGradient id="lpRight" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#b8c8db" />
            <stop offset="100%" stopColor="#8599b2" />
          </linearGradient>
          <linearGradient id="lidBack" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#2d3f56" />
            <stop offset="100%" stopColor="#1a2535" />
          </linearGradient>
          <linearGradient id="screenBg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0d2d6b" />
            <stop offset="50%" stopColor="#1246a8" />
            <stop offset="100%" stopColor="#0a1e45" />
          </linearGradient>
          <linearGradient id="bkTop1" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#2563eb" />
            <stop offset="100%" stopColor="#1d4ed8" />
          </linearGradient>
          <linearGradient id="bkTop2" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#2563eb" />
          </linearGradient>
          <linearGradient id="bkTop3" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#60a5fa" />
            <stop offset="100%" stopColor="#3b82f6" />
          </linearGradient>
          <linearGradient id="capBoard" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1e3a8a" />
            <stop offset="100%" stopColor="#0f172a" />
          </linearGradient>
          <linearGradient id="chipBody" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#312e81" />
            <stop offset="100%" stopColor="#1e1b4b" />
          </linearGradient>
          <linearGradient id="chipBorder" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="50%" stopColor="#818cf8" />
            <stop offset="100%" stopColor="#c084fc" />
          </linearGradient>
          <linearGradient id="docBadge" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#3b82f6" />
          </linearGradient>
          <linearGradient id="wordBadge" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#1d4ed8" />
          </linearGradient>
          <linearGradient id="glassTile" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0.06" />
          </linearGradient>
          <radialGradient id="pedBloom" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.7" />
            <stop offset="45%" stopColor="#06b6d4" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#0284c7" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="pedRing" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="50%" stopColor="#67e8f9" />
            <stop offset="100%" stopColor="#38bdf8" />
          </linearGradient>
          <filter id="glowF" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.8" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="chipGlowF" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="6" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="cardShadowF" x="-15%" y="-15%" width="130%" height="145%">
            <feDropShadow dx="0" dy="10" stdDeviation="11" floodColor="#040e30" floodOpacity="0.5" />
          </filter>
        </defs>

        {/* 1. Circuit traces */}
        <g stroke="#38bdf8" strokeWidth="1.4" opacity="0.75" filter="url(#glowF)">
          <path d="M198 55 L198 20 L138 20 L138 46" />
          <path d="M182 60 L120 60 L92 86 L60 86" />
          <path d="M176 76 L128 76 L110 108" />
          <path d="M236 48 L298 48 L332 20 L378 20" />
          <path d="M242 66 L316 66 L348 94 L388 94" />
          <path d="M238 80 L282 80 L306 118" />
        </g>
        <g fill="#7dd3fc" filter="url(#glowF)">
          <circle cx="138" cy="46" r="3.2" />
          <circle cx="60" cy="86" r="3.2" />
          <circle cx="110" cy="108" r="2.6" />
          <circle cx="378" cy="20" r="3.2" />
          <circle cx="388" cy="94" r="3.2" />
          <circle cx="306" cy="118" r="2.6" />
          <circle cx="298" cy="48" r="2.2" fill="#ffffff" />
          <circle cx="120" cy="60" r="2.2" fill="#ffffff" />
        </g>

        {/* 2. Neon pedestal */}
        <g className="animate-neon-aura-svg">
          <ellipse cx="230" cy="296" rx="150" ry="26" fill="url(#pedBloom)" />
          <ellipse cx="230" cy="296" rx="134" ry="20" fill="none" stroke="url(#pedRing)" strokeWidth="2.5" filter="url(#glowF)" />
          <ellipse cx="230" cy="296" rx="108" ry="14" fill="none" stroke="#bae6fd" strokeWidth="1" strokeDasharray="5 4" opacity="0.65" />
        </g>

        {/* 3. Laptop base (isometric: top / front / right faces) */}
        <polygon points="82,232 214,196 310,230 178,266" fill="url(#lpTop)" />
        <polygon points="100,228 210,198 298,226 188,258" fill="#64748b" opacity="0.55" />
        <line x1="110" y1="224" x2="216" y2="198" stroke="#94a3b8" strokeWidth="1" opacity="0.55" />
        <line x1="122" y1="232" x2="226" y2="206" stroke="#94a3b8" strokeWidth="1" opacity="0.55" />
        <line x1="134" y1="240" x2="236" y2="215" stroke="#94a3b8" strokeWidth="1" opacity="0.55" />
        <polygon points="150,250 192,238 210,248 168,260" fill="#94a3b8" opacity="0.7" />
        <polygon points="82,232 178,266 178,278 82,244" fill="url(#lpFront)" />
        <polygon points="178,266 310,230 310,242 178,278" fill="url(#lpRight)" />

        {/* Laptop lid */}
        <polygon points="98,230 104,106 268,96 274,220" fill="url(#lidBack)" stroke="#2d3f5a" strokeWidth="1.5" />
        <polygon points="104,226 110,112 262,102 268,216" fill="#121c2c" />
        <polygon points="112,222 117,120 255,110 260,212" fill="url(#screenBg)" />
        <line x1="117" y1="120" x2="255" y2="110" stroke="#93c5fd" strokeWidth="1" opacity="0.4" />

        {/* 4. Floating document card */}
        <g className="animate-float-svg-card" filter="url(#cardShadowF)">
          <rect x="118" y="128" width="140" height="96" rx="10" fill="#ffffff" />
          <rect x="118" y="128" width="140" height="24" rx="10" fill="#eff6ff" />
          <rect x="118" y="140" width="140" height="12" fill="#eff6ff" />
          <text x="130" y="145" fontSize="11" fontWeight="900" fill="#1e3a8a">Giáo án</text>
          <rect x="226" y="134" width="24" height="13" rx="6.5" fill="url(#docBadge)" />
          <text x="238" y="144" fontSize="8" fontWeight="900" fill="#ffffff" textAnchor="middle">AI</text>
          <circle cx="132" cy="166" r="6" fill="#22c55e" />
          <polyline points="129,166 131.5,169 136,163" stroke="#ffffff" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="142" y="162" width="84" height="7" rx="3.5" fill="#e2e8f0" />
          <circle cx="132" cy="183" r="6" fill="#22c55e" />
          <polyline points="129,183 131.5,186 136,180" stroke="#ffffff" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="142" y="179" width="68" height="7" rx="3.5" fill="#e2e8f0" />
          <circle cx="132" cy="200" r="6" fill="#22c55e" />
          <polyline points="129,200 131.5,203 136,197" stroke="#ffffff" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="142" y="196" width="78" height="7" rx="3.5" fill="#e2e8f0" />
          <rect x="130" y="212" width="58" height="5" rx="2.5" fill="#bfdbfe" />
        </g>

        {/* 5. Word badge */}
        <g className="animate-float-svg-badge" filter="url(#cardShadowF)">
          <rect x="258" y="186" width="46" height="52" rx="10" fill="#ffffff" />
          <rect x="266" y="194" width="30" height="4" rx="2" fill="#e2e8f0" />
          <rect x="266" y="201" width="20" height="4" rx="2" fill="#e2e8f0" />
          <rect x="268" y="210" width="28" height="20" rx="6" fill="url(#wordBadge)" />
          <text x="282" y="225" fontSize="14" fontWeight="900" fill="#ffffff" textAnchor="middle">W</text>
        </g>

        {/* 6. AI chip */}
        <g className="animate-float-svg-chip" filter="url(#chipGlowF)">
          <rect x="192" y="22" width="62" height="62" rx="16" fill="url(#chipBody)" stroke="url(#chipBorder)" strokeWidth="2.5" />
          <g stroke="#38bdf8" strokeWidth="1.8" strokeLinecap="round">
            <line x1="206" y1="22" x2="206" y2="16" />
            <line x1="223" y1="22" x2="223" y2="16" />
            <line x1="240" y1="22" x2="240" y2="16" />
            <line x1="206" y1="84" x2="206" y2="90" />
            <line x1="223" y1="84" x2="223" y2="90" />
            <line x1="240" y1="84" x2="240" y2="90" />
            <line x1="192" y1="38" x2="186" y2="38" />
            <line x1="192" y1="53" x2="186" y2="53" />
            <line x1="192" y1="68" x2="186" y2="68" />
            <line x1="254" y1="38" x2="260" y2="38" />
            <line x1="254" y1="53" x2="260" y2="53" />
            <line x1="254" y1="68" x2="260" y2="68" />
          </g>
          <rect x="204" y="34" width="38" height="38" rx="6" fill="none" stroke="#38bdf8" strokeWidth="0.6" opacity="0.5" />
          <text x="223" y="60" fontSize="22" fontWeight="900" fill="#ffffff" textAnchor="middle" letterSpacing="1">AI</text>
        </g>

        {/* 7. Glass tiles */}
        <g className="animate-float-svg-tile-a">
          <rect x="52" y="92" width="46" height="44" rx="12" fill="url(#glassTile)" stroke="#ffffff" strokeOpacity="0.45" strokeWidth="1.3" />
          <path d="M65 106 C67.5 104 70 104 75 106 C80 104 82.5 104 85 106 L85 118 C82.5 116 80 116 75 118 C70 116 67.5 116 65 118 Z" fill="none" stroke="#ffffff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </g>
        <g className="animate-float-svg-tile-b">
          <rect x="346" y="98" width="46" height="44" rx="12" fill="url(#glassTile)" stroke="#ffffff" strokeOpacity="0.45" strokeWidth="1.3" />
          <g stroke="#ffffff" strokeWidth="2.6" strokeLinecap="round">
            <line x1="358" y1="130" x2="358" y2="120" />
            <line x1="369" y1="130" x2="369" y2="113" />
            <line x1="380" y1="130" x2="380" y2="106" />
          </g>
        </g>
        <g className="animate-float-svg-tile-c">
          <rect x="34" y="186" width="38" height="36" rx="10" fill="url(#glassTile)" stroke="#ffffff" strokeOpacity="0.38" strokeWidth="1.1" />
          <path d="M45 198 C47 196.5 49 196.5 53 198 C57 196.5 59 196.5 61 198 L61 208 C59 206.5 57 206.5 53 208 C49 206.5 47 206.5 45 208 Z" fill="none" stroke="#ffffff" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </g>

        {/* 8. Books + graduation cap */}
        <polygon points="318,266 370,244 402,264 350,286" fill="url(#bkTop1)" />
        <polygon points="318,266 350,286 350,298 318,278" fill="#172554" />
        <polygon points="350,286 402,264 402,276 350,298" fill="#1e3a8a" />
        <polygon points="352,287 400,265 400,274 352,296" fill="#f8fafc" />
        <line x1="354" y1="289" x2="398" y2="268" stroke="#cbd5e1" strokeWidth="0.9" />

        <polygon points="314,250 366,228 398,248 346,270" fill="url(#bkTop2)" />
        <polygon points="314,250 346,270 346,282 314,262" fill="#1e3a8a" />
        <polygon points="346,270 398,248 398,260 346,282" fill="#1d4ed8" />
        <polygon points="348,271 396,250 396,259 348,280" fill="#f8fafc" />
        <line x1="350" y1="273" x2="394" y2="252" stroke="#cbd5e1" strokeWidth="0.9" />

        <polygon points="318,236 370,214 402,234 350,256" fill="url(#bkTop3)" />
        <polygon points="318,236 350,256 350,268 318,248" fill="#1d4ed8" />
        <polygon points="350,256 402,234 402,246 350,268" fill="#2563eb" />
        <polygon points="352,257 400,236 400,245 352,266" fill="#f8fafc" />
        <line x1="354" y1="259" x2="398" y2="238" stroke="#cbd5e1" strokeWidth="0.9" />

        <path d="M342 222 C342 234 378 234 378 222 L374 212 L346 212 Z" fill="url(#capBoard)" />
        <polygon points="360,196 404,212 360,228 316,212" fill="url(#capBoard)" stroke="#60a5fa" strokeWidth="1.2" strokeOpacity="0.55" />
        <circle cx="360" cy="212" r="4" fill="#facc15" />
        <path d="M360 212 C374 214 384 222 386 236 L386 250" stroke="#facc15" strokeWidth="2.4" strokeLinecap="round" fill="none" />
        <rect x="380" y="250" width="12" height="10" rx="2" fill="#eab308" />
        <g stroke="#eab308" strokeWidth="1.5" strokeLinecap="round">
          <line x1="382" y1="260" x2="382" y2="268" />
          <line x1="386" y1="260" x2="386" y2="268" />
          <line x1="390" y1="260" x2="390" y2="268" />
        </g>
      </svg>
    </div>
  );
}

/* ───────────────────────── 4 FEATURE BENTO CHIPS ───────────────────────── */

function FeatureChipsRow() {
  const items = [
    {
      icon: <BookOpenOutlineIcon className="h-6 w-6 text-white shrink-0" />,
      titleTop: "Kho SGK NXB",
      titleBottom: "Giáo dục",
      subtitle: "Chọn trực tiếp, tiện lợi",
    },
    {
      icon: <ShieldCheckOutlineIcon className="h-6 w-6 text-white shrink-0" />,
      titleTop: "Chuẩn CV 2345",
      titleBottom: "& GDPT 2018",
      subtitle: "Đảm bảo đúng quy định",
    },
    {
      icon: <DocumentTextOutlineIcon className="h-6 w-6 text-white shrink-0" />,
      titleTop: "Xuất Word (.docx)",
      titleBottom: "",
      subtitle: "Giáo án chuyên nghiệp, dễ chỉnh sửa",
    },
    {
      icon: <LightningBoltOutlineIcon className="h-6 w-6 text-white shrink-0" />,
      titleTop: "Tiết kiệm",
      titleBottom: "thời gian",
      subtitle: "Tăng hiệu quả công việc",
    },
  ];

  return (
    <div className="auth-bento-grid grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
      {items.map((item, index) => (
        <div
          key={index}
          className="auth-bento-card group relative flex min-w-0 flex-col justify-between rounded-2xl border border-white/30 bg-gradient-to-b from-white/[0.16] to-white/[0.06] px-3 py-2.5 text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_10px_24px_rgba(3,20,75,0.25)] backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 hover:border-white/45 hover:bg-white/[0.2]"
        >
          {/* Top row: Crisp white outline icon on left + Bold title on right */}
          <div className="flex items-center gap-2.5">
            <span className="shrink-0 transition-transform group-hover:scale-105">
              {item.icon}
            </span>
            <div className="min-w-0">
              <h4 className="auth-bento-title text-[12px] font-bold leading-tight text-white sm:text-[12.5px]">
                {item.titleTop}
                {item.titleBottom ? <span className="block">{item.titleBottom}</span> : null}
              </h4>
            </div>
          </div>
          {/* Subtitle below */}
          <p className="auth-bento-subtitle mt-1.5 text-[10.5px] font-medium leading-snug text-blue-100/90">
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

type PublicPlanQuota = {
  freeDailyLimit: number;
  paidTrialDailyCredits: number;
  paidTrialGenerationCost: number;
};

function PricingModal({
  isOpen,
  onClose,
  quota,
}: {
  isOpen: boolean;
  onClose: () => void;
  quota: PublicPlanQuota;
}) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const freeLimit = Math.max(0, Number(quota.freeDailyLimit ?? 3));
  const trialCost = Math.max(1, Number(quota.paidTrialGenerationCost ?? 10));
  const trialGenerations = Math.floor(Math.max(0, Number(quota.paidTrialDailyCredits ?? 10)) / trialCost);
  const trialCredits = Math.max(0, Number(quota.paidTrialDailyCredits ?? 10));

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-3 sm:p-4 backdrop-blur-sm animate-in fade-in duration-200"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-3xl bg-[#f8fafc] shadow-2xl ring-1 ring-slate-900/10 flex flex-col animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pricing-modal-title"
      >
        {/* Header */}
        <header className="flex items-center justify-between border-b border-slate-200/80 px-5 py-4 sm:px-6 sm:py-4 bg-white">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-md shadow-blue-600/25">
              <BookLogoIcon className="h-5 w-5" />
            </span>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600">EduPlan Membership</span>
              <h2 id="pricing-modal-title" className="text-lg sm:text-xl font-black text-slate-900 leading-tight">
                Bảng Giá &amp; Gói Sử Dụng
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

        {/* Modal Body: Khớp 100% với tab Quản lý Gói bên trong app */}
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {/* Top Hero Banner */}
          <div className="plans-hero">
            <span className="plans-hero-kicker">EduPlan AI Membership</span>
            <h2 className="text-xl sm:text-2xl font-black text-white mt-1 mb-2">
              Nâng cấp chất lượng giáo án với AI mạnh hơn
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-2xl">
              Cùng một cấu trúc giáo án chuẩn, model AI cao cấp giúp nội dung mạch lạc hơn, chuyên sâu hơn và ổn định hơn, đặc biệt với bài nhiều tiết hoặc yêu cầu phức tạp.
            </p>
            <div className="plans-quality-line">
              <b>Miễn phí — Nhanh, đủ dùng</b>
              <i>·</i>
              <b>Trả phí — Mạch lạc, chuyên sâu và ổn định</b>
            </div>
          </div>

          {/* 2 Plan Cards: Miễn phí & Trả phí */}
          <div className="plan-grid pricing-modal-grid grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Card 1: Miễn phí */}
            <article className="plan-card plan-free">
              <div className="plan-card-glow" />
              <div className="plan-card-top">
                <span className="plan-gem">◇</span>
                <span className="plan-badge badge-free">MIỄN PHÍ</span>
                <span className="plan-state active">MẶC ĐỊNH KHI ĐĂNG NHẬP</span>
              </div>
              <h3 className="plan-name">Miễn phí</h3>
              <div className="plan-price">
                <strong>0đ</strong>
                <span>· Không giới hạn thời gian</span>
              </div>
              <p className="plan-description">
                Phù hợp để trải nghiệm EduPlan AI và soạn nhanh các giáo án cơ bản.
              </p>
              <p className="plan-reason">{freeLimit} lượt tạo miễn phí mỗi ngày (tự động reset lúc 00:00)</p>
              <ul>
                <li>✓ <span>Sử dụng AI tiêu chuẩn.</span></li>
                <li>✓ <span>{freeLimit} lượt tạo giáo án miễn phí mỗi ngày.</span></li>
                <li>✓ <span>Tự động reset lúc 00:00 theo giờ Việt Nam.</span></li>
                <li>✓ <span>Đầy đủ cấu trúc KHBD và bộ kiểm tra sư phạm.</span></li>
                <li>✓ <span>Lưu lịch sử và xuất giáo án Word.</span></li>
                <li>✓ <span>Phù hợp để trải nghiệm và soạn các bài học cơ bản.</span></li>
              </ul>
              <p className="plan-hint">
                {trialGenerations > 0
                  ? `Cần nội dung chuyên sâu hơn, bám sát nhu cầu thực tế hơn? Gói Giáo viên sắp ra mắt đang được trải nghiệm ${trialGenerations} lượt tạo mỗi ngày.`
                  : "Cần nội dung chuyên sâu hơn, bám sát nhu cầu thực tế hơn? Gói Giáo viên sắp ra mắt sẽ cung cấp model AI cao cấp hơn."}
              </p>
              <button
                type="button"
                className="plan-action selected mt-auto cursor-pointer"
                onClick={onClose}
              >
                Tiếp tục miễn phí — Đăng nhập ngay
              </button>
            </article>

            {/* Card 2: Trả phí – Chất lượng cao */}
            <article className="plan-card plan-plus">
              <div className="plan-card-glow" />
              <div className="plan-card-shine" aria-hidden="true" />
              <div className="plan-card-top">
                <span className="plan-gem">✦</span>
                <span className="plan-badge badge-plus">TRẢ PHÍ (THỬ NGHIỆM)</span>
                <span className="plan-state">COMING SOON</span>
              </div>
              <h3 className="plan-name">Trả phí – Chất lượng cao</h3>
              <div className="plan-price plan-price-coming-soon">
                <strong>Coming soon</strong>
              </div>
              <p className="plan-description">
                Phù hợp với giáo viên muốn có giáo án rõ ràng, tự nhiên, bám sát yêu cầu bài dạy. Giáo án chỉn chu hơn và chất lượng hơn.
              </p>
              <p className="plan-reason">
                {trialCredits > 0
                  ? `Hỗ trợ ${trialCredits} tín dụng trải nghiệm miễn phí mỗi ngày (${trialGenerations} lượt tạo)`
                  : "Nâng cấp để mở khóa model AI cao cấp"}
              </p>
              <ul>
                <li>✓ <span>Sử dụng model AI cao cấp để soạn KHBD.</span></li>
                <li>✓ <span>Nội dung mạch lạc – ổn định – chất lượng hơn rõ rệt.</span></li>
                <li>✓ <span>Bám sát mục tiêu, hoạt động và đánh giá.</span></li>
                <li>✓ <span>Diễn đạt tự nhiên, giúp giảm thời gian chỉnh sửa.</span></li>
                <li>✓ <span>Quyền sử dụng trong 30 ngày.</span></li>
                <li>✓ <span>Soạn tối đa 5 giáo án với 50 tín dụng, có thể mua thêm tín dụng (nếu có).</span></li>
                <li>✓ <span>Đầy đủ công cụ lưu và xuất giáo án.</span></li>
              </ul>
              <button
                type="button"
                className="plan-action coming-soon mt-auto"
                disabled
              >
                Coming soon
              </button>
            </article>
          </div>

          {/* Ghi chú sư phạm khớp 100% bên trong */}
          <p className="plans-note">
            Hai gói sử dụng cùng cấu trúc giáo án và bộ kiểm tra sư phạm. Gói Trả phí dùng model AI cao cấp hơn để tăng độ sâu, tính mạch lạc và ổn định. Chất lượng kết quả còn phụ thuộc vào nội dung SGK và thông tin bạn cung cấp.
          </p>

          {/* Hộp mua thêm tín dụng khớp 100% bên trong */}
          <div className="payment-zone payment-zone-single">
            <div className="payment-config payment-coming-soon">
              <p className="account-section-label">Mua thêm tín dụng</p>
              <strong>Coming soon</strong>
              <p>Tính năng mua tín dụng sẽ được mở trong phiên bản chính thức. Tín dụng do Admin cấp vẫn sử dụng bình thường.</p>
            </div>
          </div>
        </div>

        {/* Footer */}
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
  const [planQuota, setPlanQuota] = useState<PublicPlanQuota>({
    freeDailyLimit: 3,
    paidTrialDailyCredits: 10,
    paidTrialGenerationCost: 10,
  });

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

  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings/plans", { cache: "no-store" })
      .then((response) => response.json())
      .then((result: Partial<PublicPlanQuota>) => {
        if (cancelled) return;
        if (typeof result.freeDailyLimit === "number" || typeof result.paidTrialDailyCredits === "number") {
          setPlanQuota((prev) => ({
            freeDailyLimit: typeof result.freeDailyLimit === "number" ? result.freeDailyLimit : prev.freeDailyLimit,
            paidTrialDailyCredits: typeof result.paidTrialDailyCredits === "number" ? result.paidTrialDailyCredits : prev.paidTrialDailyCredits,
            paidTrialGenerationCost: typeof result.paidTrialGenerationCost === "number" ? result.paidTrialGenerationCost : prev.paidTrialGenerationCost,
          }));
        }
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [isPricingOpen]);

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
    <div className="auth-panel-root relative flex flex-1 min-h-0 w-full max-w-full overflow-x-hidden lg:overflow-hidden flex-col items-center justify-start lg:justify-between px-3 py-3 sm:px-6 sm:py-5 lg:py-2.5 lg:px-8 selection:bg-blue-600 selection:text-white">
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
      <PricingModal isOpen={isPricingOpen} onClose={() => setIsPricingOpen(false)} quota={planQuota} />

      {/* Background Watermark Vectors */}
      <SchoolBuildingWatermark />
      <BooksWatermark />

      {/* ── 1. FLOATING TOP NAVBAR ── */}
      <header className="auth-top-navbar shrink-0 mb-2.5 sm:mb-3.5 lg:mb-2 flex w-full max-w-[1200px] min-w-0 overflow-hidden flex-col gap-1.5 rounded-2xl border border-blue-100/90 bg-white/95 px-3 py-2 sm:px-6 sm:py-2.5 shadow-[0_8px_30px_rgba(37,99,235,0.06)] backdrop-blur-md">
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
      <div className="auth-hero-shell relative flex w-full max-w-[1200px] lg:flex-1 lg:min-h-0 lg:max-h-[700px] flex-col lg:flex-row overflow-hidden rounded-[26px] p-2 sm:p-2.5 lg:p-2.5 shadow-[0_24px_70px_-12px_rgba(6,32,112,0.38)] ring-1 ring-white/55 my-auto">
        {/* Soft Background Halftone & Dot Waves */}
        <div className="auth-hero-dot-wave pointer-events-none absolute inset-0 z-0" />
        <div className="pointer-events-none absolute -left-20 -top-20 h-96 w-96 rounded-full bg-sky-400/25 blur-3xl" />
        <div className="pointer-events-none absolute left-1/3 top-1/2 h-80 w-80 -translate-y-1/2 rounded-full bg-blue-400/20 blur-3xl" />

        {/* ── LEFT HERO PANEL ── */}
        <div className="auth-left-panel relative z-10 flex min-w-0 flex-1 flex-col justify-between p-4 sm:p-5 lg:p-5 text-white">
          <div>
            {/* Top Brand Tag */}
            <div className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/15 backdrop-blur-sm ring-1 ring-white/20">
                <BookLogoIcon className="h-4 w-4" />
              </span>
              <span className="text-lg font-black tracking-tight text-white">EduPlan AI</span>
            </div>

            {/* Headline */}
            <h1 className="auth-hero-headline mt-2 sm:mt-2.5 text-2xl sm:text-3xl lg:text-[32px] xl:text-[35px] font-black leading-[1.16] tracking-tight text-white">
              Trợ lý soạn giáo án<br />
              thông minh cho giáo viên<br />
              <span className="italic font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-sky-200 via-sky-100 to-white">
                thời đại số
              </span>
            </h1>

            {/* Subtitle description */}
            <p className="auth-hero-subtitle mt-2 max-w-[340px] text-xs sm:text-[13px] leading-relaxed text-blue-100/90 font-medium">
              Soạn giáo án chuẩn Công văn 2345 &amp; GDPT 2018, tiết kiệm thời gian, xuất Word nhanh chóng, hỗ trợ chọn SGK và lập kế hoạch bài dạy chuyên nghiệp.
            </p>

            {/* Middle Row: 4 Checklist items + 3D Scene */}
            <div className="auth-hero-mid mt-3 sm:mt-4 grid grid-cols-1 md:grid-cols-[285px_1fr] xl:grid-cols-[305px_1fr] items-center gap-3 lg:gap-4">
              {/* 4 Checklist Bullets */}
              <ul className="auth-checklist space-y-2 sm:space-y-2.5">
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
                    <span className="auth-checklist-text text-xs sm:text-[12.5px] font-semibold text-white/95 leading-snug md:whitespace-nowrap">
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
          <div className="auth-bento-wrap mt-3 sm:mt-4 pt-2.5 sm:pt-3 border-t border-white/15">
            <FeatureChipsRow />
          </div>
        </div>

        {/* ── RIGHT LOGIN CARD PANEL ── */}
        <div className="auth-login-card relative z-20 flex min-w-0 w-full flex-col justify-center rounded-[22px] bg-white p-5 sm:p-6 lg:w-[420px] xl:w-[440px] shadow-[0_16px_40px_rgba(2,12,45,0.18)]">
          {/* Shaded 3D Pale-Blue Watermark at top-right of login card */}
          <svg aria-hidden="true" className="pointer-events-none absolute right-3 top-3 h-[85px] w-[95px] text-blue-200/50" viewBox="0 0 100 85" fill="none">
            <defs>
              <linearGradient id="wmBookL" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#bfdbfe" stopOpacity="0.75" />
                <stop offset="100%" stopColor="#dbeafe" stopOpacity="0.3" />
              </linearGradient>
              <linearGradient id="wmBookR" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#93c5fd" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#bfdbfe" stopOpacity="0.35" />
              </linearGradient>
              <linearGradient id="wmCap" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#93c5fd" stopOpacity="0.85" />
                <stop offset="100%" stopColor="#60a5fa" stopOpacity="0.45" />
              </linearGradient>
            </defs>
            {/* Open Book Left & Right Pages */}
            <path d="M12 55 Q30 45 50 52 L50 30 Q30 22 12 30 Z" fill="url(#wmBookL)" />
            <path d="M88 55 Q70 45 50 52 L50 30 Q70 22 88 30 Z" fill="url(#wmBookR)" />
            <path d="M12 55 L50 52 L88 55 L88 58 L50 55 L12 58 Z" fill="#93c5fd" opacity="0.5" />
            {/* Mortarboard Graduation Cap Hovering Above */}
            <path d="M60 22 C60 29 84 29 84 22 Z" fill="#60a5fa" opacity="0.6" />
            <polygon points="72,7 94,17 72,25 50,17" fill="url(#wmCap)" stroke="#93c5fd" strokeWidth="0.8" />
            <circle cx="72" cy="16" r="1.5" fill="#facc15" />
            <path d="M72 16 C80 18 86 22 87 29" stroke="#facc15" strokeWidth="1.2" strokeLinecap="round" fill="none" />
            <circle cx="87" cy="30" r="1.5" fill="#eab308" />
          </svg>

          {/* Header */}
          <div className="auth-card-header relative z-10 mb-5 text-center">
            <h2 className="text-2xl sm:text-[26px] font-black tracking-tight text-slate-900 leading-tight">
              {title}
            </h2>
            <p className="mt-1 text-xs sm:text-[13px] font-medium leading-relaxed text-slate-500">
              {subtitle}
            </p>
          </div>

          {/* Method Tabs Switcher (Email / Số điện thoại) */}
          <div className="auth-method-tabs mb-5 grid grid-cols-2 rounded-xl bg-slate-100 p-1 border border-slate-200/60 text-xs sm:text-sm font-bold">
            <button
              type="button"
              className={`auth-tab-btn flex min-h-[44px] items-center justify-center gap-2 rounded-lg transition-all active:scale-[0.98] ${
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
              className={`auth-tab-btn flex min-h-[44px] items-center justify-center gap-2 rounded-lg transition-all active:scale-[0.98] ${
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
            <form onSubmit={handleEmailAuth} className="auth-form space-y-4">
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
                  <div className="auth-divider relative my-2 flex items-center justify-center">
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
                    className="auth-google-btn inline-flex min-h-[44px] w-full items-center justify-center gap-2.5 rounded-xl border border-slate-200/90 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 active:scale-[0.985] shadow-2xs transition-all disabled:opacity-50"
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
            <form onSubmit={handlePhoneLogin} className="auth-form space-y-4">
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

              <div className="auth-divider relative my-2 flex items-center justify-center">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200" />
                </div>
                <span className="relative bg-white px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  HOẶC
                </span>
              </div>

              <button
                type="button"
                className="auth-google-btn inline-flex min-h-[44px] w-full items-center justify-center gap-2.5 rounded-xl border border-slate-200/90 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 active:scale-[0.985] shadow-2xs transition-all disabled:opacity-50"
                disabled={isSubmitting}
                onClick={handleGoogleLogin}
              >
                <GoogleIcon className="h-5 w-5" />
                <span>Tiếp tục với Google</span>
              </button>
            </form>
          ) : mode === "register" ? (
            /* PHONE REGISTER FLOW */
            <form onSubmit={handlePhoneRegister} className="auth-form space-y-4">
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
            <form onSubmit={handlePhoneResetPassword} className="auth-form space-y-4">
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
          <div className="auth-links-row mt-5 flex items-center justify-center gap-3 text-xs sm:text-[13px]">
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
          <p className="auth-legal-note mt-4 text-center text-[11px] leading-relaxed text-slate-400">
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
