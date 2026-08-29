"use client";

import { useEffect, useMemo, useState } from "react";
import { signInWithEmailAndPassword, signInWithPopup, signOut } from "firebase/auth";
import { getFirebaseClientAuth, googleAuthProvider } from "@/lib/firebase-client";

type AdminUser = {
  uid: string;
  email: string;
  displayName: string;
  role: "admin";
};

type ChartPoint = {
  date: string;
  value: number;
};

type RecentIssue = {
  id: string;
  action?: string;
  message?: string;
  source?: string;
  adminEmail?: string;
  createdAt: string;
};

type Dashboard = {
  today: string;
  totalUsers: number;
  verifiedUsers: number;
  newUsersToday: number;
  newUsersThisWeek: number;
  todayVisits: number;
  totalLessons: number;
  lessonsToday: number;
  lowQuotaUsers: number;
  remainingGenerations: number;
  feedbackNew: number;
  feedbackOpen: number;
  recentErrors: RecentIssue[];
  chart: {
    visits: ChartPoint[];
    users: ChartPoint[];
    lessons: ChartPoint[];
    feedback: ChartPoint[];
  };
};

type ManagedUser = {
  uid: string;
  email: string;
  displayName: string;
  role: "user" | "admin";
  emailVerified: boolean;
  disabled: boolean;
  blockedReason: string;
  blockedReasonDetail: string;
  blockedAt: string;
  lastLoginIpHash: string;
  presenceState: "online" | "offline";
  isOnline: boolean;
  lastSeenAt: string;
  lastLoginAt: string;
  lastOfflineAt: string;
  ipLimitOverride: boolean;
  mustChangePassword: boolean;
  freeLimit: number;
  usedGenerations: number;
  remainingGenerations: number;
  paidTrialLimit: number;
  paidTrialUsed: number;
  paidTrialRemaining: number;
  activePlan: string;
  paidPlan: string;
  planStatus: string;
  packageCredits: number;
  topupCredits: number;
  planExpiresAt: string;
  createdAt: string;
  updatedAt: string;
};

type GenerationItem = {
  id: string;
  uid: string;
  userEmail: string;
  totalCreated: number;
  subject: string;
  createdAt: string;
  status: "success" | "failed" | "processing";
  modelUsed: string;
  ocrModelUsed: string;
  fallbackUsed: boolean;
  elapsedMs: number;
  totalTokens: number;
};

type Policies = {
  terms: string;
  privacy: string;
  version: string;
  updatedAt?: string;
};

type SystemSettings = {
  defaultFreeLimit: number;
  paidTrialDailyCredits: number;
  featureFlags: {
    feedbackWidget: boolean;
    lessonHistory: boolean;
    exportFiles: boolean;
  };
  updatedAt?: string;
};

type AuditLog = {
  id: string;
  action: string;
  adminEmail: string;
  detail: Record<string, unknown>;
  createdAt: string;
};

type FeedbackStatus = "new" | "in_progress" | "resolved" | "ignored" | "reviewed";
type FeedbackPriority = "low" | "medium" | "high";

type PaymentItem = {
  id: string;
  uid: string;
  provider: string;
  orderCode: number | null;
  paymentLinkId: string;
  purchaseType: string;
  targetPlan: string;
  amountVnd: number;
  credits: number;
  senderName: string;
  transferContent: string;
  status: string;
  approvalMode: string;
  safeReason: string;
  checks: Array<{ key: string; passed: boolean; detail: string }>;
  payos: Record<string, unknown> | null;
  createdAt: string;
  approvedAt: string;
};

type PilotRating = "pass" | "needs-work" | "unrated";
type PilotFeedback = {
  version?: number;
  lessonId: string;
  subject: string;
  grade: string;
  lessonTitle: string;
  book: string;
  periods: number;
  teachable: boolean | null;
  ratings: Record<string, PilotRating>;
  summary: { passedCount: number; needsWorkCount: number; unratedCount: number; scorePercent: number; gate: string };
  audit: { status?: string; lessonType?: string; classificationConfidence?: string; periodTypes?: string[]; issueCount?: number };
};

type FeedbackItem = {
  id: string;
  category: "bug" | "improvement" | "feature" | "other" | "vietnamese-pilot" | string;
  status: FeedbackStatus;
  priority: FeedbackPriority;
  adminNote: string;
  message: string;
  userId: string;
  userEmail: string;
  userName: string;
  pageUrl: string;
  userAgent: string;
  pilot: PilotFeedback | null;
  createdAt: string;
  updatedAt: string;
};

const tabs = [
  { id: "dashboard", label: "Tổng quan" },
  { id: "users", label: "Người dùng" },
  { id: "lessons", label: "Giáo án" },
  { id: "payments", label: "Thanh toán" },
  { id: "feedback", label: "Góp ý" },
  { id: "support", label: "Thanh hỗ trợ" },
  { id: "settings", label: "Cấu hình" },
  { id: "policies", label: "Chính sách" },
  { id: "audit", label: "Audit log" },
] as const;

type TabId = (typeof tabs)[number]["id"];

const pageSize = 20;
const supportLinks = [
  { label: "Nhận diện", value: "EduPlan AI / Soạn giáo án", href: "/" },
  { label: "Trang chủ", value: "Giao diện soạn giáo án", href: "/" },
  { label: "Hướng dẫn", value: "Tài liệu hướng dẫn sẽ được upload sau", href: "" },
  { label: "Dropdown Hỗ trợ", value: "Nhóm Zalo, gọi trực tiếp, Zalo cá nhân và góp ý được gom vào một menu", href: "" },
  { label: "Nhóm Zalo hỗ trợ", value: "https://zalo.me/g/iunsqm93yttvc2wx99cq", href: "https://zalo.me/g/iunsqm93yttvc2wx99cq" },
  { label: "Liên hệ trực tiếp", value: "Gọi/Zalo 0342733640", href: "https://zalo.me/0342733640" },
];

const feedbackCategoryLabels: Record<string, string> = {
  all: "Tất cả",
  bug: "Báo lỗi",
  improvement: "Góp ý cải thiện",
  feature: "Yêu cầu tính năng",
  "vietnamese-pilot": "Pilot Tiếng Việt",
  other: "Khác",
};

const pilotCriterionLabels: Record<string, string> = {
  classification: "Đúng kiểu bài",
  "source-fidelity": "Đúng ngữ liệu, không bịa",
  "measurable-outcomes": "Mục tiêu đo được",
  "pedagogy-sequence": "Đúng chuỗi dạy học",
  "responses-and-support": "Phản hồi và sửa lỗi",
  "time-fit": "Dạy được trong 35 phút",
  "period-continuity": "Nối tiết không lặp",
  "preview-and-word": "Preview và Word",
};

const feedbackStatusLabels: Record<string, string> = {
  all: "Tất cả",
  new: "Mới",
  in_progress: "Đang xử lý",
  resolved: "Đã xử lý",
  ignored: "Bỏ qua",
  reviewed: "Đã xem",
};

const planStatusLabels: Record<string, string> = {
  free: "Miễn phí",
  trial: "Đang trải nghiệm",
  paid: "Đang trả phí",
  expired: "Đã hết hạn",
};

const priorityLabels: Record<string, string> = {
  all: "Tất cả",
  low: "Thấp",
  medium: "Vừa",
  high: "Quan trọng",
};

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Yêu cầu không thành công.");
  return result as T;
}

function shortDate(value: string) {
  if (!value) return "";
  return new Date(value).toLocaleString("vi-VN");
}

function durationSeconds(value: number) {
  return value > 0 ? `${Math.round(value / 100) / 10}s` : "—";
}

function relativeActivity(value: string) {
  if (!value) return "Chưa từng ghi nhận";
  const elapsed = Math.max(0, Date.now() - new Date(value).getTime());
  if (elapsed < 60_000) return "vừa xong";
  if (elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)} phút`;
  if (elapsed < 86_400_000) return `${Math.floor(elapsed / 3_600_000)} giờ`;
  if (elapsed < 2_592_000_000) return `${Math.floor(elapsed / 86_400_000)} ngày`;
  return `${Math.floor(elapsed / 2_592_000_000)} tháng`;
}

function activityTone(user: ManagedUser) {
  if (user.isOnline) return "online";
  if (!user.lastSeenAt) return "never";
  return Date.now() - new Date(user.lastSeenAt).getTime() >= 30 * 86_400_000 ? "inactive" : "offline";
}

function shortDay(value: string) {
  if (!value) return "";
  return value.slice(5).replace("-", "/");
}

function previewText(value: string, maxLength = 120) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength).trim()}...`;
}

function firebaseErrorCode(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: string }).code || "")
    : "";
}

function friendlyAdminAuthError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  const code = firebaseErrorCode(error);
  const currentDomain = typeof window !== "undefined" ? window.location.hostname : "domain admin hiện tại";

  if (/auth\/unauthorized-domain/i.test(`${code} ${message}`)) {
    return `Firebase chưa cho phép domain ${currentDomain} đăng nhập. Vào Firebase Console > Authentication > Settings > Authorized domains và thêm ${currentDomain}.`;
  }
  if (/auth\/configuration-not-found/i.test(`${code} ${message}`)) {
    return "Firebase Authentication chưa được bật cho project này. Vào Firebase Console > Authentication > Get started, rồi bật Email/Password và Google.";
  }
  if (/auth\/operation-not-allowed/i.test(`${code} ${message}`)) {
    return "Phương thức đăng nhập này chưa được bật trong Firebase Authentication > Sign-in method.";
  }
  if (/auth\/invalid-credential|auth\/wrong-password|auth\/user-not-found/i.test(`${code} ${message}`)) {
    return "Email hoặc mật khẩu chưa đúng.";
  }
  if (/auth\/popup-blocked/i.test(`${code} ${message}`)) {
    return "Trình duyệt đang chặn cửa sổ đăng nhập Google. Hãy cho phép popup hoặc đăng nhập bằng email/mật khẩu.";
  }
  if (/auth\/popup-closed-by-user/i.test(`${code} ${message}`)) {
    return "Cửa sổ đăng nhập Google đã bị đóng trước khi hoàn tất.";
  }
  if (/Tài khoản này chưa được cấp quyền admin/i.test(message)) {
    return "Tài khoản đăng nhập thành công nhưng chưa được cấp quyền admin.";
  }
  return code ? `Firebase: ${code}. ${message}` : message || "Không thể đăng nhập admin.";
}

function clampPage(page: number, total: number) {
  return Math.min(Math.max(1, page), Math.max(1, Math.ceil(total / pageSize)));
}

function slicePage<T>(items: T[], page: number) {
  return items.slice((page - 1) * pageSize, page * pageSize);
}

export default function AdminPage() {
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [authLoaded, setAuthLoaded] = useState(false);
  const [tab, setTab] = useState<TabId>("dashboard");
  const [loadingTab, setLoadingTab] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [system, setSystem] = useState<SystemSettings>({
    defaultFreeLimit: 3,
    paidTrialDailyCredits: 10,
    featureFlags: { feedbackWidget: true, lessonHistory: true, exportFiles: true },
  });
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [userQuery, setUserQuery] = useState("");
  const [userFilter, setUserFilter] = useState("all");
  const [userPage, setUserPage] = useState(1);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [blockTarget, setBlockTarget] = useState<ManagedUser | null>(null);
  const [blockReason, setBlockReason] = useState("");
  const [isBlocking, setIsBlocking] = useState(false);

  const [lessons, setLessons] = useState<GenerationItem[]>([]);
  const [lessonQuery, setLessonQuery] = useState("");
  const [lessonSubject, setLessonSubject] = useState("");
  const [lessonStatus, setLessonStatus] = useState("all");
  const [lessonFrom, setLessonFrom] = useState("");
  const [lessonTo, setLessonTo] = useState("");
  const [lessonPage, setLessonPage] = useState(1);
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [feedbackCategory, setFeedbackCategory] = useState("all");
  const [feedbackStatus, setFeedbackStatus] = useState("all");
  const [feedbackPriority, setFeedbackPriority] = useState("all");
  const [feedbackFrom, setFeedbackFrom] = useState("");
  const [feedbackTo, setFeedbackTo] = useState("");
  const [feedbackPage, setFeedbackPage] = useState(1);
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackItem | null>(null);
  const [feedbackDraft, setFeedbackDraft] = useState<{ status: FeedbackStatus; priority: FeedbackPriority; adminNote: string } | null>(null);
  const [policies, setPolicies] = useState<Policies>({ terms: "", privacy: "", version: "1.0" });
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [paymentStatus, setPaymentStatus] = useState("all");
  const [selectedPayment, setSelectedPayment] = useState<PaymentItem | null>(null);
  const [passwordTarget, setPasswordTarget] = useState<ManagedUser | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [revokeSessions, setRevokeSessions] = useState(true);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [grantTarget, setGrantTarget] = useState<ManagedUser | null>(null);
  const [grantCreditsAmount, setGrantCreditsAmount] = useState(25);
  const [deductAmount, setDeductAmount] = useState(10);

  const pagedUsers = useMemo(() => slicePage(users, clampPage(userPage, users.length)), [users, userPage]);
  const selectablePagedUsers = useMemo(() => pagedUsers.filter((user) => user.uid !== admin?.uid), [pagedUsers, admin?.uid]);
  const selectedUsers = useMemo(() => users.filter((user) => selectedUserIds.includes(user.uid)), [users, selectedUserIds]);
  const pagedLessons = useMemo(() => slicePage(lessons, clampPage(lessonPage, lessons.length)), [lessons, lessonPage]);
  const pagedFeedback = useMemo(() => slicePage(feedback, clampPage(feedbackPage, feedback.length)), [feedback, feedbackPage]);

  async function loadAdmin() {
    const result = await api<{ admin: AdminUser | null }>("/api/auth/me");
    setAdmin(result.admin);
    setAuthLoaded(true);
  }

  async function loadDashboard() {
    setDashboard(await api<Dashboard>("/api/admin/dashboard"));
  }

  async function loadSystem() {
    const result = await api<{ system: SystemSettings }>("/api/admin/settings/system");
    setSystem(result.system);
  }

  async function loadUsers(query = userQuery, filter = userFilter, preserveState = false) {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (filter !== "all") params.set("filter", filter);
    const result = await api<{ users: ManagedUser[] }>(`/api/admin/users${params.toString() ? `?${params}` : ""}`);
    setUsers(result.users);
    if (preserveState) {
      const availableIds = new Set(result.users.map((user) => user.uid));
      setSelectedUserIds((current) => current.filter((uid) => availableIds.has(uid)));
      setUserPage((current) => clampPage(current, result.users.length));
    } else {
      setSelectedUserIds([]);
      setUserPage(1);
    }
  }

  async function loadLessons() {
    const params = new URLSearchParams();
    if (lessonQuery) params.set("q", lessonQuery);
    if (lessonSubject) params.set("subject", lessonSubject);
    if (lessonStatus !== "all") params.set("status", lessonStatus);
    if (lessonFrom) params.set("from", lessonFrom);
    if (lessonTo) params.set("to", lessonTo);
    const result = await api<{ generations: GenerationItem[] }>(`/api/admin/lessons${params.toString() ? `?${params}` : ""}`);
    setLessons(result.generations);
    setLessonPage(1);
  }

  async function loadPayments(status = paymentStatus) {
    const params = status === "all" ? "" : `?status=${encodeURIComponent(status)}`;
    const result = await api<{ payments: PaymentItem[] }>(`/api/admin/payments${params}`);
    setPayments(result.payments);
  }

  async function reviewPayment(paymentId: string, action: "approve" | "reject") {
    const label = action === "approve" ? "duyệt" : "từ chối";
    if (!window.confirm(`Xác nhận ${label} giao dịch này?`)) return;
    await api("/api/admin/payments", { method: "PATCH", body: JSON.stringify({ paymentId, action }) });
    setMessage(`Đã ${label} giao dịch.`);
    setSelectedPayment(null);
    await loadPayments();
  }

  async function loadFeedback() {
    const params = new URLSearchParams();
    if (feedbackCategory !== "all") params.set("category", feedbackCategory);
    if (feedbackStatus !== "all") params.set("status", feedbackStatus);
    if (feedbackPriority !== "all") params.set("priority", feedbackPriority);
    if (feedbackFrom) params.set("from", feedbackFrom);
    if (feedbackTo) params.set("to", feedbackTo);
    const result = await api<{ feedback: FeedbackItem[] }>(`/api/admin/feedback${params.toString() ? `?${params}` : ""}`);
    setFeedback(result.feedback);
    setFeedbackPage(1);
  }

  async function loadPolicies() {
    const result = await api<{ policies: Policies }>("/api/admin/policies");
    setPolicies(result.policies);
  }

  async function loadAudit() {
    const result = await api<{ logs: AuditLog[] }>("/api/admin/audit");
    setAuditLogs(result.logs);
  }

  async function refreshCurrentTab(nextTab = tab) {
    setError("");
    setLoadingTab(true);
    try {
      if (nextTab === "dashboard") await loadDashboard();
      if (nextTab === "settings") await loadSystem();
      if (nextTab === "users") await loadUsers();
      if (nextTab === "lessons") await loadLessons();
      if (nextTab === "feedback") await loadFeedback();
      if (nextTab === "payments") await loadPayments();
      if (nextTab === "policies") await loadPolicies();
      if (nextTab === "audit") await loadAudit();
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Không thể tải dữ liệu.");
    } finally {
      setLoadingTab(false);
    }
  }

  useEffect(() => {
    loadAdmin().catch(() => setAuthLoaded(true));
  }, []);

  useEffect(() => {
    if (!admin) return;
    void refreshCurrentTab(tab);
  }, [admin, tab]);

  useEffect(() => {
    if (!admin || tab !== "users") return;
    const refreshPresence = () => {
      if (document.visibilityState === "visible") {
        void loadUsers(userQuery, userFilter, true).catch((loadError) => {
          setError(loadError instanceof Error ? loadError.message : "Không thể làm mới trạng thái user.");
        });
      }
    };
    const interval = window.setInterval(refreshPresence, 60_000);
    document.addEventListener("visibilitychange", refreshPresence);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshPresence);
    };
  }, [admin, tab, userQuery, userFilter]);

  async function createSession() {
    const auth = await getFirebaseClientAuth();
    const idToken = await auth.currentUser?.getIdToken(true);
    if (!idToken) throw new Error("Không lấy được phiên Firebase.");
    await api("/api/auth/session", {
      method: "POST",
      body: JSON.stringify({ idToken }),
    });
    await loadAdmin();
  }

  async function handleEmailLogin() {
    setError("");
    setMessage("");
    setIsSubmitting(true);
    try {
      const auth = await getFirebaseClientAuth();
      await signInWithEmailAndPassword(auth, email, password);
      try {
        await createSession();
      } catch (sessionError) {
        await signOut(auth).catch(() => undefined);
        throw sessionError;
      }
    } catch (loginError) {
      setError(friendlyAdminAuthError(loginError));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleGoogleLogin() {
    setError("");
    setMessage("");
    setIsSubmitting(true);
    try {
      const auth = await getFirebaseClientAuth();
      await signInWithPopup(auth, googleAuthProvider);
      try {
        await createSession();
      } catch (sessionError) {
        await signOut(auth).catch(() => undefined);
        throw sessionError;
      }
    } catch (loginError) {
      setError(friendlyAdminAuthError(loginError));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleLogout() {
    await api("/api/auth/logout", { method: "POST" });
    const auth = await getFirebaseClientAuth();
    await signOut(auth).catch(() => undefined);
    setAdmin(null);
  }

  async function saveSystem() {
    setError("");
    setMessage("");
    try {
      const result = await api<{ system: SystemSettings }>("/api/admin/settings/system", {
        method: "PATCH",
        body: JSON.stringify(system),
      });
      setSystem(result.system);
      setMessage("Đã lưu cấu hình hệ thống.");
      await Promise.all([
        loadUsers(userQuery, userFilter, true).catch(() => undefined),
        loadDashboard().catch(() => undefined),
      ]);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Không thể lưu cấu hình.");
    }
  }

  async function saveUser(user: ManagedUser) {
    setError("");
    setMessage("");
    try {
      await api(`/api/admin/users/${user.uid}`, {
        method: "PATCH",
        body: JSON.stringify({
          displayName: user.displayName,
          role: user.role,
          emailVerified: user.emailVerified,
          ipLimitOverride: user.ipLimitOverride,
        }),
      });
      setMessage(`Đã cập nhật ${user.email}.`);
      await loadUsers(userQuery, userFilter, true);
      await loadDashboard().catch(() => undefined);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Không thể lưu user.");
    }
  }

  function openBlockUser(user: ManagedUser) {
    if (user.uid === admin?.uid) {
      setError("Không thể tự khóa chính tài khoản admin đang đăng nhập.");
      return;
    }
    setBlockTarget(user);
    setBlockReason("");
    setError("");
  }

  async function blockUser() {
    if (!blockTarget) return;
    const reason = blockReason.replace(/\s+/g, " ").trim();
    if (!reason) {
      setError("Vui lòng nhập lý do khóa tài khoản.");
      return;
    }
    setIsBlocking(true);
    setError("");
    setMessage("");
    try {
      await api(`/api/admin/users/${blockTarget.uid}`, {
        method: "PATCH",
        body: JSON.stringify({ disabled: true, blockedReasonDetail: reason }),
      });
      setMessage(`Đã khóa ${blockTarget.email} và thu hồi phiên đăng nhập.`);
      setBlockTarget(null);
      setBlockReason("");
      await loadUsers(userQuery, userFilter, true);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Không thể khóa user.");
    } finally {
      setIsBlocking(false);
    }
  }

  async function unblockUser(user: ManagedUser) {
    if (!window.confirm(`Mở khóa tài khoản ${user.email}?`)) return;
    setError("");
    setMessage("");
    try {
      await api(`/api/admin/users/${user.uid}`, {
        method: "PATCH",
        body: JSON.stringify({ disabled: false }),
      });
      setMessage(`Đã mở khóa ${user.email}.`);
      await loadUsers(userQuery, userFilter, true);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Không thể mở khóa user.");
    }
  }

  function toggleUserSelection(uid: string, checked: boolean) {
    setSelectedUserIds((current) => (
      checked
        ? Array.from(new Set([...current, uid]))
        : current.filter((item) => item !== uid)
    ));
  }

  function toggleCurrentPageUsers(checked: boolean) {
    const pageIds = selectablePagedUsers.map((user) => user.uid);
    setSelectedUserIds((current) => (
      checked
        ? Array.from(new Set([...current, ...pageIds]))
        : current.filter((uid) => !pageIds.includes(uid))
    ));
  }

  async function deleteUser(user: ManagedUser) {
    if (user.uid === admin?.uid) {
      setError("Không thể xóa chính tài khoản admin đang đăng nhập.");
      return;
    }
    const confirmed = window.confirm(`Xóa user ${user.email || user.displayName}? Thao tác này xóa tài khoản đăng nhập và hồ sơ user, không tự khôi phục.`);
    if (!confirmed) return;
    setError("");
    setMessage("");
    try {
      await api(`/api/admin/users/${user.uid}`, { method: "DELETE" });
      setSelectedUserIds((current) => current.filter((uid) => uid !== user.uid));

      if (passwordTarget?.uid === user.uid) setPasswordTarget(null);
      setMessage(`Đã xóa user ${user.email}.`);
      await loadUsers();
      await loadDashboard().catch(() => undefined);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Không thể xóa user.");
    }
  }

  async function deleteSelectedUsers() {
    const targets = selectedUsers.filter((user) => user.uid !== admin?.uid);
    if (!targets.length) {
      setError("Chưa chọn user để xóa.");
      return;
    }
    const confirmed = window.confirm(`Xóa ${targets.length} user đã chọn? Thao tác này xóa tài khoản đăng nhập và hồ sơ user, không tự khôi phục.`);
    if (!confirmed) return;
    setError("");
    setMessage("");
    try {
      const result = await api<{ deletedCount: number }>("/api/admin/users", {
        method: "DELETE",
        body: JSON.stringify({ uids: targets.map((user) => user.uid) }),
      });
      setSelectedUserIds([]);

      if (passwordTarget && targets.some((user) => user.uid === passwordTarget.uid)) setPasswordTarget(null);
      setMessage(`Đã xóa ${result.deletedCount} user.`);
      await loadUsers();
      await loadDashboard().catch(() => undefined);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Không thể xóa user đã chọn.");
    }
  }


  async function changePassword() {
    if (!passwordTarget) return;
    setError("");
    setMessage("");
    try {
      await api(`/api/admin/users/${passwordTarget.uid}/password`, {
        method: "POST",
        body: JSON.stringify({ newPassword, revokeSessions, mustChangePassword }),
      });
      setPasswordTarget(null);
      setNewPassword("");
      setMessage(`Đã đổi mật khẩu cho ${passwordTarget.email}.`);
      await loadAudit().catch(() => undefined);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Không thể đổi mật khẩu.");
    }
  }

  async function grantPlan(uid: string) {
    if (!window.confirm("Kích hoạt gói Trả phí (50 tín dụng, 30 ngày) cho user này?")) return;
    setError(""); setMessage("");
    try {
      const result = await api<{ granted: { plan: string; credits: number; expiresAt: string } }>(`/api/admin/users/${uid}`, { method: "PATCH", body: JSON.stringify({ grantPlan: "plus" }) });
      setMessage(`Đã kích hoạt gói Trả phí với ${result.granted.credits} tín dụng.`);
      setGrantTarget(null);
      await loadUsers();
    } catch (e) { setError(e instanceof Error ? e.message : "Không thể kích hoạt gói."); }
  }

  async function grantCredits(uid: string, amount: number) {
    if (amount < 1) return setError("Số tín dụng phải lớn hơn 0.");
    if (!window.confirm(`Cộng ${amount} tín dụng cho user này?`)) return;
    setError(""); setMessage("");
    try {
      await api(`/api/admin/users/${uid}`, { method: "PATCH", body: JSON.stringify({ grantCredits: amount }) });
      setMessage(`Đã cộng ${amount} tín dụng.`);
      setGrantTarget(null);
      await loadUsers();
    } catch (e) { setError(e instanceof Error ? e.message : "Không thể cộng tín dụng."); }
  }

  async function revokePlan(uid: string) {
    if (!window.confirm("Xác nhận tước quyền gói Trả phí của người dùng này?\n\nNgười dùng sẽ bị chuyển về gói Miễn phí và mất toàn bộ tín dụng còn lại.")) return;
    setError(""); setMessage("");
    try {
      await api(`/api/admin/users/${uid}`, { method: "PATCH", body: JSON.stringify({ revokePlan: true }) });
      setMessage("Đã tước quyền gói. Người dùng đã chuyển về gói Miễn phí.");
      setGrantTarget(null);
      await loadUsers();
    } catch (e) { setError(e instanceof Error ? e.message : "Không thể tước quyền gói."); }
  }

  async function deductCredits(uid: string, amount: number) {
    if (amount < 1) return setError("Số tín dụng phải lớn hơn 0.");
    if (!window.confirm(`Xác nhận trừ ${amount} tín dụng của user này?`)) return;
    setError(""); setMessage("");
    try {
      await api(`/api/admin/users/${uid}`, { method: "PATCH", body: JSON.stringify({ deductCredits: amount }) });
      setMessage(`Đã trừ ${amount} tín dụng.`);
      setGrantTarget(null);
      await loadUsers();
    } catch (e) { setError(e instanceof Error ? e.message : "Không thể trừ tín dụng."); }
  }

  async function savePolicies() {
    setError("");
    setMessage("");
    try {
      const result = await api<{ policies: Policies }>("/api/admin/policies", {
        method: "PATCH",
        body: JSON.stringify(policies),
      });
      setPolicies(result.policies);
      setMessage("Đã lưu chính sách.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Không thể lưu chính sách.");
    }
  }

  async function updateFeedback(item: FeedbackItem, updates: Partial<Pick<FeedbackItem, "status" | "priority" | "adminNote">>) {
    setError("");
    setMessage("");
    try {
      await api(`/api/admin/feedback/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify(updates),
      });
      setMessage("Đã cập nhật góp ý.");
      if (selectedFeedback?.id === item.id) {
        const next = { ...selectedFeedback, ...updates };
        setSelectedFeedback(next);
        setFeedbackDraft({ status: next.status, priority: next.priority, adminNote: next.adminNote });
      }
      await loadFeedback();
      await loadDashboard().catch(() => undefined);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Không thể cập nhật góp ý.");
    }
  }

  async function saveFeedbackDraft() {
    if (!selectedFeedback || !feedbackDraft) return;
    await updateFeedback(selectedFeedback, feedbackDraft);
  }

  async function deleteFeedback(item: FeedbackItem) {
    const confirmed = window.confirm(`Xóa góp ý của ${item.userEmail || item.userName || "người dùng"}? Thao tác này không tự khôi phục.`);
    if (!confirmed) return;
    setError("");
    setMessage("");
    try {
      await api(`/api/admin/feedback/${item.id}`, { method: "DELETE" });
      setSelectedFeedback(null);
      setFeedbackDraft(null);
      setMessage("Đã xóa góp ý.");
      await loadFeedback();
      await loadDashboard().catch(() => undefined);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Không thể xóa góp ý.");
    }
  }

  function exportFeedback() {
    window.location.href = "/api/admin/feedback/export";
  }

  if (!authLoaded) {
    return <main className="main">Đang kiểm tra phiên admin...</main>;
  }

  if (!admin) {
    return (
      <main className="login-page">
        {/* ── Left Hero Panel ── */}
        <div className="login-hero">
          <div className="login-hero-dots" />
          <div className="login-orb login-orb-1" />
          <div className="login-orb login-orb-2" />
          <div className="login-orb login-orb-3" />
          <div className="login-hero-content">
            <div className="login-hero-brand">
              <div className="login-hero-brand-icon">
                <svg width="24" height="24" viewBox="0 0 48 48" fill="none">
                  <path d="M9 15.5c5.6.6 10 2.4 13.3 5.3v18.7C18.6 36.9 14.2 35.4 9 35V15.5Z" fill="white" opacity="0.96" />
                  <path d="M39 15.5c-5.6.6-10 2.4-13.3 5.3v18.7c3.7-2.6 8.1-4.1 13.3-4.5V15.5Z" fill="white" opacity="0.96" />
                  <path d="M24 18.6V40" stroke="white" strokeWidth="2.8" strokeLinecap="round" opacity="0.9" />
                  <path d="M24 7.5l1.7 3.5 3.8.6-2.7 2.7.6 3.8-3.4-1.8-3.4 1.8.6-3.8-2.7-2.7 3.8-.6L24 7.5Z" fill="white" />
                </svg>
              </div>
              <span>EduPlan AI</span>
            </div>

            <h1>Admin Console</h1>
            <p className="login-hero-subtitle">
              Hệ thống quản trị tập trung — quản lý người dùng, giáo án, cấu hình và theo dõi hoạt động toàn hệ thống.
            </p>

            <div className="login-hero-features">
              <div className="login-hero-feature">
                <div className="login-hero-feature-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="white" strokeWidth="2" strokeLinecap="round"/><circle cx="9" cy="7" r="4" stroke="white" strokeWidth="2"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>
                </div>
                <span className="login-hero-feature-text">Quản lý người dùng & phân quyền</span>
              </div>
              <div className="login-hero-feature">
                <div className="login-hero-feature-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" stroke="white" strokeWidth="2" strokeLinejoin="round"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>
                </div>
                <span className="login-hero-feature-text">Theo dõi giáo án & lịch sử tạo</span>
              </div>
              <div className="login-hero-feature">
                <div className="login-hero-feature-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 20V10M18 20V4M6 20v-4" stroke="white" strokeWidth="2.5" strokeLinecap="round"/></svg>
                </div>
                <span className="login-hero-feature-text">Thống kê & báo cáo trực quan</span>
              </div>
              <div className="login-hero-feature">
                <div className="login-hero-feature-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" stroke="white" strokeWidth="2" strokeLinejoin="round"/><path d="m9 12 2 2 4-4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
                <span className="login-hero-feature-text">Bảo mật & kiểm soát truy cập</span>
              </div>
            </div>

            <p className="login-hero-footer">© 2026 EduPlan AI — Admin Console</p>
          </div>
        </div>

        {/* ── Right Form Panel ── */}
        <div className="login-form-side">
          <div className="login-mesh" />
          <section className="login-card">
            <div className="login-card-header">
              <div className="login-card-badge">
                <div className="login-card-badge-dot" />
                <span>Admin Portal</span>
              </div>
              <h1>Đăng nhập quản trị</h1>
              <p className="login-card-desc">Chỉ tài khoản có quyền admin mới được truy cập hệ thống quản lý.</p>
            </div>

            {error ? <div className="login-message-area"><div className="message error">{error}</div></div> : null}

            <div className="login-fields">
              <div className="login-field-group">
                <label className="login-field-label">Email</label>
                <div className="login-input-wrap">
                  <span className="login-input-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="2"/><path d="m3 7 9 6 9-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </span>
                  <input className="login-input" type="email" placeholder="admin@eduplan.vn" value={email} onChange={(event) => setEmail(event.target.value)} />
                </div>
              </div>

              <div className="login-field-group">
                <label className="login-field-label">Mật khẩu</label>
                <div className="login-input-wrap">
                  <span className="login-input-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><circle cx="12" cy="16" r="1.5" fill="currentColor"/></svg>
                  </span>
                  <input className="login-input" type={showPassword ? "text" : "password"} placeholder="••••••••" value={password} onChange={(event) => setPassword(event.target.value)} />
                  <button type="button" className="login-toggle-pw" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}>
                    {showPassword ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19M1 1l22 22" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12Z" stroke="currentColor" strokeWidth="2"/><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/></svg>
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="login-actions">
              <button className={`login-btn-primary${isSubmitting ? " loading" : ""}`} disabled={isSubmitting} onClick={handleEmailLogin}>
                <span className="login-spinner" />
                {isSubmitting ? "Đang xác thực..." : "Đăng nhập"}
              </button>

              <div className="login-divider">hoặc</div>

              <button className="login-btn-google" disabled={isSubmitting} onClick={handleGoogleLogin}>
                <svg width="20" height="20" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.6 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h5.9a5 5 0 0 1-2.2 3.3v2.8h3.6c2.1-2 3.3-4.8 3.3-8.2Z"/><path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.6l-3.6-2.8c-1 .7-2.2 1-3.7 1-2.8 0-5.2-1.9-6.1-4.5H2.2V17A11 11 0 0 0 12 23Z"/><path fill="#FBBC05" d="M5.9 14.2a6.6 6.6 0 0 1 0-4.3V7H2.2a11 11 0 0 0 0 10l3.7-2.8Z"/><path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A10.8 10.8 0 0 0 12 1 11 11 0 0 0 2.2 7l3.7 2.9c.9-2.6 3.3-4.5 6.1-4.5Z"/></svg>
                Tiếp tục với Google
              </button>
            </div>

            <div className="login-card-footer">
              Bằng việc đăng nhập, bạn đồng ý với điều khoản sử dụng của EduPlan AI.
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="admin-shell">
      <aside className="sidebar">
        <div className="brand">
          <p>EduPlan AI</p>
          <h2>Admin Console</h2>
        </div>
        <nav className="admin-nav">
          {tabs.map((item) => (
            <button key={item.id} className={`nav-button ${tab === item.id ? "active" : ""}`} onClick={() => setTab(item.id)}>
              <span>{item.label}</span>
              {item.id === "feedback" && dashboard?.feedbackNew ? <span className="nav-badge">{dashboard.feedbackNew}</span> : null}
              {item.id === "users" && dashboard?.lowQuotaUsers ? <span className="nav-badge subtle">{dashboard.lowQuotaUsers}</span> : null}
            </button>
          ))}
        </nav>
      </aside>

      <section className="main">
        <div className="topbar">
          <div>
            <p className="eyebrow">Quản trị độc lập</p>
            <h1 style={{ margin: "4px 0 0" }}>{tabs.find((item) => item.id === tab)?.label}</h1>
          </div>
          <div className="topbar-actions">
            <button className="button secondary" onClick={() => refreshCurrentTab()}>Làm mới</button>
            <strong>{admin.displayName || admin.email}</strong>
            <button className="button secondary" onClick={handleLogout}>Đăng xuất</button>
          </div>
        </div>

        <div style={{ marginTop: 14 }}>
          {message ? <div className="message ok">{message}</div> : null}
          {error ? <div className="message error">{error}</div> : null}
          {loadingTab ? <LoadingRows /> : null}
        </div>

        {tab === "dashboard" && dashboard ? (
          <DashboardView dashboard={dashboard} />
        ) : null}

        {tab === "support" ? (
          <div className="card form-card" style={{ marginTop: 14 }}>
            <div className="section-title-row">
              <div>
                <p className="eyebrow">Header trang chính</p>
                <h2>Thanh hỗ trợ thay thế bảng LED</h2>
                <p className="muted">Bảng chữ chạy đã được bỏ. Header trang chính dùng cấu trúc nhận diện, điều hướng gọn và dropdown Hỗ trợ.</p>
              </div>
            </div>
            <div className="support-admin-grid">
              {supportLinks.map((item) => (
                <div key={item.label} className="support-admin-card">
                  <strong>{item.label}</strong>
                  <p>{item.value}</p>
                  {item.href ? <a href={item.href} target="_blank" rel="noreferrer">Mở liên kết</a> : <span className="muted">Không cần liên kết ngoài</span>}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {tab === "payments" ? (
          <div className="card" style={{ marginTop: 14 }}>
            <div className="toolbar-grid user-toolbar">
              <select className="select" value={paymentStatus} onChange={(event) => setPaymentStatus(event.target.value)}>
                <option value="all">Tất cả giao dịch</option>
                <option value="pending_review">Cần kiểm tra</option>
                <option value="awaiting_payment">Chờ payOS</option>
                <option value="provider_failed">Lỗi nhà cung cấp</option>
                <option value="expired">Hết hạn</option>
                <option value="approved">Đã duyệt</option>
                <option value="rejected">Từ chối</option>
              </select>
              <button className="button secondary" onClick={() => loadPayments()}>Lọc / làm mới</button>
            </div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Giao dịch</th><th>Gói</th><th>Số tiền</th><th>Trạng thái</th><th>Thời gian</th><th>Thao tác</th></tr></thead>
                <tbody>{payments.length ? payments.map((payment) => (
                  <tr key={payment.id}>
                    <td><strong>{payment.senderName}</strong><div className="muted">{payment.provider === "payos" ? "payOS" : "Chuyển khoản"} · {payment.transferContent}</div></td>
                    <td>{payment.purchaseType === "package" ? "Gói Trả phí" : `${payment.credits} tín dụng Trả phí`}</td>
                    <td>{payment.amountVnd.toLocaleString("vi-VN")}đ</td>
                    <td><span className={`status-pill ${payment.status === "approved" ? "" : payment.status === "rejected" ? "danger-pill" : "new"}`}>{payment.status}</span><div className="muted">{payment.safeReason}</div></td>
                    <td>{shortDate(payment.createdAt)}</td>
                    <td><button className="button secondary" onClick={() => setSelectedPayment(payment)}>Chi tiết</button></td>
                  </tr>
                )) : <tr><td colSpan={6} className="muted">Chưa có giao dịch phù hợp.</td></tr>}</tbody>
              </table>
            </div>
          </div>
        ) : null}

        {tab === "settings" ? (
          <div className="card form-card" style={{ marginTop: 14 }}>
            <div className="section-title">
              <h2>Cấu hình hệ thống</h2>
              <p className="muted">Quota hằng ngày được app người dùng và API tạo giáo án dùng trực tiếp.</p>
            </div>
            <label>
              <span className="label">Số lượt miễn phí mặc định (Gói Miễn phí)</span>
              <input className="input" type="number" min={0} max={1000} value={system.defaultFreeLimit} onChange={(event) => setSystem({ ...system, defaultFreeLimit: Number(event.target.value) })} />
            </label>
            <label style={{ marginTop: 12 }}>
              <span className="label">Tín dụng trải nghiệm gói Trả phí mỗi ngày</span>
              <input className="input" type="number" min={0} max={1000} step={10} value={system.paidTrialDailyCredits} onChange={(event) => setSystem({ ...system, paidTrialDailyCredits: Number(event.target.value) })} />
              <span className="muted">Mỗi lần tạo bằng gói Trả phí tốn 10 tín dụng. Đặt 0 để tắt trải nghiệm; quota reset lúc 00:00 Việt Nam.</span>
            </label>
            <div className="settings-toggles">
              {Object.entries(system.featureFlags).map(([key, value]) => (
                <label key={key} className="switch-row">
                  <input
                    type="checkbox"
                    checked={value}
                    onChange={(event) => setSystem({
                      ...system,
                      featureFlags: { ...system.featureFlags, [key]: event.target.checked },
                    })}
                  />
                  <span>{featureFlagLabel(key)}</span>
                </label>
              ))}
            </div>
            <button className="button" onClick={saveSystem}>Lưu cấu hình</button>
          </div>
        ) : null}

        {tab === "users" ? (
          <div className="card" style={{ marginTop: 14 }}>
            <div className="toolbar-grid user-toolbar">
              <input className="input" placeholder="Tìm theo email hoặc họ tên" value={userQuery} onChange={(event) => setUserQuery(event.target.value)} />
              <select className="select" value={userFilter} onChange={(event) => setUserFilter(event.target.value)}>
                <option value="all">Tất cả user</option>
                <option value="remaining">Còn lượt</option>
                <option value="exhausted">Hết lượt</option>
                <option value="admin">Admin</option>
                <option value="unverified">Chưa xác minh</option>
                <option value="disabled">Đang khóa</option>
                <option value="ip_blocked">Khóa do giới hạn IP</option>
                <option value="online">Đang online</option>
                <option value="offline">Đang offline</option>
                <option value="inactive_7d">Offline trên 7 ngày</option>
                <option value="inactive_30d">Offline trên 30 ngày</option>
                <option value="inactive_90d">Offline trên 90 ngày</option>
                <option value="never_seen">Chưa từng hoạt động</option>
              </select>
              <button className="button secondary" onClick={() => loadUsers()}>Lọc</button>
              <button className="button danger" disabled={!selectedUsers.length} onClick={deleteSelectedUsers}>Xóa đã chọn ({selectedUsers.length})</button>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th className="select-cell">
                      <input
                        aria-label="Chọn user trên trang này"
                        type="checkbox"
                        checked={selectablePagedUsers.length > 0 && selectablePagedUsers.every((user) => selectedUserIds.includes(user.uid))}
                        onChange={(event) => toggleCurrentPageUsers(event.target.checked)}
                      />
                    </th>
                    <th>User</th>
                    <th>Trạng thái</th>
                    <th>Hoạt động</th>
                    <th>Role</th>
                    <th>Quota hôm nay</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedUsers.length ? pagedUsers.map((user) => (
                    <tr key={user.uid}>
                      <td className="select-cell">
                        <input
                          aria-label={`Chọn ${user.email || user.displayName}`}
                          type="checkbox"
                          checked={selectedUserIds.includes(user.uid)}
                          disabled={user.uid === admin.uid}
                          onChange={(event) => toggleUserSelection(user.uid, event.target.checked)}
                        />
                      </td>
                      <td>
                        <input className="input" value={user.displayName} onChange={(event) => {
                          setUsers(users.map((item) => item.uid === user.uid ? { ...item, displayName: event.target.value } : item));
                        }} />
                        <div className="muted">{user.email}</div>
                      </td>
                      <td>
                        <div className="status-cell">
                          <span className={`status-pill ${user.disabled ? "danger-pill" : user.emailVerified ? "" : "new"}`}>
                            {user.disabled ? "Đang khóa" : user.emailVerified ? "Đã xác minh" : "Chưa xác minh"}
                          </span>
                          {!user.emailVerified ? (
                            <button
                              className="mini-link-button"
                              onClick={() => {
                                const next = { ...user, emailVerified: true };
                                setUsers(users.map((item) => item.uid === user.uid ? next : item));
                                void saveUser(next);
                              }}
                            >
                              Xác minh
                            </button>
                          ) : null}
                          {user.blockedReason === "ip_account_limit" ? (
                            <span className="muted" title={user.lastLoginIpHash}>Giới hạn 2 tài khoản/IP · {user.lastLoginIpHash.slice(0, 10)}…</span>
                          ) : null}
                          {user.disabled && user.blockedReasonDetail ? (
                            <div className="block-reason" title={user.blockedReasonDetail}>
                              <strong>Lý do khóa:</strong> {user.blockedReasonDetail}
                            </div>
                          ) : null}
                          <label className="muted" title="Cho phép tài khoản này bỏ qua giới hạn Miễn phí/Trải nghiệm theo IP">
                            <input
                              type="checkbox"
                              checked={user.ipLimitOverride}
                              onChange={(event) => {
                                const next = { ...user, ipLimitOverride: event.target.checked };
                                setUsers(users.map((item) => item.uid === user.uid ? next : item));
                                void saveUser(next);
                              }}
                            /> Ngoại lệ IP
                          </label>
                        </div>
                      </td>
                      <td>
                        <div className={`presence-card ${activityTone(user)}`} title={user.lastSeenAt ? `Lần cuối: ${shortDate(user.lastSeenAt)}` : "Chưa có heartbeat hoặc lần đăng nhập"}>
                          <span className="presence-dot" aria-hidden="true" />
                          <div>
                            <strong>{user.isOnline ? "Đang online" : user.lastSeenAt ? `Offline · ${relativeActivity(user.lastSeenAt)}` : "Chưa hoạt động"}</strong>
                            <span>{user.lastSeenAt ? shortDate(user.lastSeenAt) : "Chưa ghi nhận lần truy cập"}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <select className="select" value={user.role} onChange={(event) => {
                          setUsers(users.map((item) => item.uid === user.uid ? { ...item, role: event.target.value as "user" | "admin" } : item));
                        }}>
                          <option value="user">user</option>
                          <option value="admin">admin</option>
                        </select>
                      </td>
                      <td>
                        <strong>Free: {user.remainingGenerations}/{user.freeLimit} lượt</strong>
                        <div className="muted">Đã dùng {user.usedGenerations} lượt hôm nay</div>
                        <strong style={{ display: "block", marginTop: 6 }}>Trial Trả phí: {user.paidTrialRemaining}/{user.paidTrialLimit} tín dụng</strong>
                        <div className="muted">Đã dùng {user.paidTrialUsed} tín dụng hôm nay</div>
                      </td>
                      <td>
                        <div className="row-actions">
                          <button className="button secondary" onClick={() => saveUser(user)}>Lưu</button>
                          <button
                            id={`toggle-block-${user.uid}`}
                            className={`button ${user.disabled ? "secondary" : "danger"}`}
                            disabled={user.uid === admin.uid}
                            onClick={() => user.disabled ? void unblockUser(user) : openBlockUser(user)}
                          >
                            {user.disabled ? "Mở khóa" : "Khóa"}
                          </button>

                          <button className="button secondary" onClick={() => { setGrantTarget(user); setGrantCreditsAmount(25); }}>Gói</button>
                          <button className="button" onClick={() => setPasswordTarget(user)}>Đổi mật khẩu</button>
                          <button className="button danger" disabled={user.uid === admin.uid} onClick={() => deleteUser(user)}>Xóa</button>
                        </div>
                      </td>
                    </tr>
                  )) : <EmptyTable colSpan={7} text="Không có user theo bộ lọc hiện tại." />}
                </tbody>
              </table>
            </div>
            <Pagination page={userPage} total={users.length} onPage={setUserPage} />
          </div>
        ) : null}

        {tab === "lessons" ? (
          <div className="card" style={{ marginTop: 14 }}>
            <div className="toolbar-grid lesson-toolbar lesson-toolbar-compact">
              <input className="input" placeholder="Tìm email hoặc môn" value={lessonQuery} onChange={(event) => setLessonQuery(event.target.value)} />
              <input className="input" placeholder="Môn" value={lessonSubject} onChange={(event) => setLessonSubject(event.target.value)} />
              <select className="select" value={lessonStatus} onChange={(event) => setLessonStatus(event.target.value)}>
                <option value="all">Tất cả trạng thái</option>
                <option value="success">Thành công</option>
                <option value="failed">Thất bại</option>
                <option value="processing">Đang xử lý</option>
              </select>
              <input className="input" type="date" value={lessonFrom} onChange={(event) => setLessonFrom(event.target.value)} />
              <input className="input" type="date" value={lessonTo} onChange={(event) => setLessonTo(event.target.value)} />
              <button className="button secondary" onClick={() => loadLessons()}>Lọc</button>
            </div>
            <p className="muted lesson-data-note">Chỉ tải 200 lượt tạo gần nhất và metadata tối thiểu, không tải nội dung giáo án.</p>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Email người dùng</th>
                    <th>Số giáo án đã tạo</th>
                    <th>Thời gian tạo</th>
                    <th>Môn</th>
                    <th>Model / thời gian</th>
                    <th>Token</th>
                    <th>Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedLessons.length ? pagedLessons.map((lesson) => (
                    <tr key={lesson.id}>
                      <td><strong>{lesson.userEmail || lesson.uid}</strong></td>
                      <td>{lesson.totalCreated}</td>
                      <td>{shortDate(lesson.createdAt)}</td>
                      <td>{lesson.subject || "Chưa ghi nhận"}</td>
                      <td><strong>{lesson.modelUsed || "Chưa ghi nhận"}</strong><div className="muted">OCR: {lesson.ocrModelUsed || "cache/chưa ghi nhận"} · {durationSeconds(lesson.elapsedMs)}{lesson.fallbackUsed ? " · fallback" : ""}</div></td>
                      <td>{lesson.totalTokens ? lesson.totalTokens.toLocaleString("vi-VN") : "—"}</td>
                      <td><GenerationStatusPill status={lesson.status} /></td>
                    </tr>
                  )) : <EmptyTable colSpan={7} text="Không có lượt tạo theo bộ lọc hiện tại." />}
                </tbody>
              </table>
            </div>
            <Pagination page={lessonPage} total={lessons.length} onPage={setLessonPage} />
          </div>
        ) : null}

        {tab === "feedback" ? (
          <div className="card" style={{ marginTop: 14 }}>
            <div className="feedback-toolbar">
              <label>
                <span className="label">Loại</span>
                <select className="select" value={feedbackCategory} onChange={(event) => setFeedbackCategory(event.target.value)}>
                  {Object.entries(feedbackCategoryLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
              <label>
                <span className="label">Trạng thái</span>
                <select className="select" value={feedbackStatus} onChange={(event) => setFeedbackStatus(event.target.value)}>
                  {Object.entries(feedbackStatusLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
              <label>
                <span className="label">Mức độ</span>
                <select className="select" value={feedbackPriority} onChange={(event) => setFeedbackPriority(event.target.value)}>
                  {Object.entries(priorityLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
              <label>
                <span className="label">Từ ngày</span>
                <input className="input" type="date" value={feedbackFrom} onChange={(event) => setFeedbackFrom(event.target.value)} />
              </label>
              <label>
                <span className="label">Đến ngày</span>
                <input className="input" type="date" value={feedbackTo} onChange={(event) => setFeedbackTo(event.target.value)} />
              </label>
              <div className="feedback-actions">
                <button className="button secondary" onClick={loadFeedback}>Lọc</button>
                <button className="button" onClick={exportFeedback}>Tải Excel</button>
              </div>
            </div>

            <div className="table-wrap feedback-table">
              <table>
                <thead>
                  <tr>
                    <th>Thời gian</th>
                    <th>Người gửi</th>
                    <th>Loại</th>
                    <th>Trạng thái</th>
                    <th>Mức độ</th>
                    <th>Nội dung</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedFeedback.length ? pagedFeedback.map((item) => (
                    <tr key={item.id}>
                      <td>{shortDate(item.createdAt)}</td>
                      <td>
                        <strong>{item.userName || "Không tên"}</strong>
                        <div className="muted">{item.userEmail || item.userId}</div>
                      </td>
                      <td>{feedbackCategoryLabels[item.category] || item.category}</td>
                      <td><FeedbackStatusPill status={item.status} /></td>
                      <td><PriorityPill priority={item.priority} /></td>
                      <td className="feedback-preview">{previewText(item.message)}</td>
                      <td>
                        <div className="row-actions">
                          <button className="button secondary" onClick={() => {
                            setSelectedFeedback(item);
                            setFeedbackDraft({ status: item.status, priority: item.priority, adminNote: item.adminNote });
                          }}>Xem</button>
                          <button className="button secondary" onClick={() => updateFeedback(item, { status: "in_progress" })}>Xử lý</button>
                          <button className="button danger" onClick={() => deleteFeedback(item)}>Xóa</button>
                        </div>
                      </td>
                    </tr>
                  )) : <EmptyTable colSpan={7} text="Chưa có góp ý nào theo bộ lọc hiện tại." />}
                </tbody>
              </table>
            </div>
            <Pagination page={feedbackPage} total={feedback.length} onPage={setFeedbackPage} />
          </div>
        ) : null}

        {tab === "policies" ? (
          <div className="card form-card" style={{ marginTop: 14 }}>
            <div className="section-title">
              <h2>Chính sách và điều khoản</h2>
              <p className="muted">Nội dung này nên ngắn, rõ và cập nhật theo từng phiên bản.</p>
            </div>
            <label className="label">Phiên bản</label>
            <input className="input" value={policies.version} onChange={(event) => setPolicies({ ...policies, version: event.target.value })} />
            <label className="label" style={{ marginTop: 12 }}>Điều khoản sử dụng</label>
            <textarea className="textarea tall-textarea" value={policies.terms} onChange={(event) => setPolicies({ ...policies, terms: event.target.value })} />
            <label className="label" style={{ marginTop: 12 }}>Chính sách bảo mật</label>
            <textarea className="textarea tall-textarea" value={policies.privacy} onChange={(event) => setPolicies({ ...policies, privacy: event.target.value })} />
            <button className="button" style={{ marginTop: 14 }} onClick={savePolicies}>Lưu chính sách</button>
          </div>
        ) : null}

        {tab === "audit" ? (
          <DataTable headers={["Thời gian", "Admin", "Hành động", "Chi tiết"]} rows={auditLogs.map((log) => [
            shortDate(log.createdAt),
            log.adminEmail,
            log.action,
            JSON.stringify(log.detail),
          ])} />
        ) : null}
      </section>

      {blockTarget ? (
        <div className="modal-backdrop" onClick={() => !isBlocking && setBlockTarget(null)}>
          <div className="modal block-modal" role="dialog" aria-modal="true" aria-labelledby="block-user-title" onClick={(event) => event.stopPropagation()}>
            <div className="modal-title-row">
              <div>
                <p className="eyebrow danger-eyebrow">Kiểm soát tài khoản</p>
                <h2 id="block-user-title">Khóa người dùng</h2>
              </div>
              <span className="status-pill danger-pill">Thu hồi phiên ngay</span>
            </div>
            <div className="block-target-card">
              <strong>{blockTarget.displayName || "Người dùng chưa đặt tên"}</strong>
              <span>{blockTarget.email}</span>
            </div>
            <label className="label" htmlFor="block-reason-input">Lý do khóa gửi tới người dùng <strong aria-hidden="true">*</strong></label>
            <textarea
              id="block-reason-input"
              className="textarea block-reason-input"
              rows={5}
              maxLength={500}
              autoFocus
              placeholder="Ví dụ: Tài khoản vi phạm điều khoản sử dụng do chia sẻ quyền truy cập cho nhiều người..."
              value={blockReason}
              disabled={isBlocking}
              onChange={(event) => setBlockReason(event.target.value)}
            />
            <div className="block-reason-meta">
              <span>Lý do này sẽ hiển thị nguyên văn sau khi người dùng đăng nhập đúng.</span>
              <strong>{blockReason.length}/500</strong>
            </div>
            <div className="modal-actions">
              <button id="cancel-block-user" className="button secondary" disabled={isBlocking} onClick={() => setBlockTarget(null)}>Hủy</button>
              <button id="confirm-block-user" className="button danger" disabled={isBlocking || !blockReason.trim()} onClick={blockUser}>
                {isBlocking ? "Đang khóa..." : "Xác nhận khóa"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {passwordTarget ? (
        <div className="modal-backdrop">
          <div className="modal">
            <h2>Đổi mật khẩu</h2>
            <p className="muted">{passwordTarget.email}</p>
            <label className="label">Mật khẩu mới</label>
            <input className="input" type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
            <label className="switch-row" style={{ marginTop: 12 }}>
              <input type="checkbox" checked={revokeSessions} onChange={(event) => setRevokeSessions(event.target.checked)} /> <span>Bắt đăng nhập lại</span>
            </label>
            <label className="switch-row" style={{ marginTop: 8 }}>
              <input type="checkbox" checked={mustChangePassword} onChange={(event) => setMustChangePassword(event.target.checked)} /> <span>Đánh dấu cần đổi mật khẩu</span>
            </label>
            <div className="modal-actions">
              <button className="button secondary" onClick={() => setPasswordTarget(null)}>Hủy</button>
              <button className="button danger" onClick={changePassword}>Lưu mật khẩu mới</button>
            </div>
          </div>
        </div>
      ) : null}



      {selectedFeedback && feedbackDraft ? (
        <div className="modal-backdrop">
          <div className="modal feedback-modal">
            <div className="modal-title-row">
              <div>
                <p className="eyebrow">Hòm thư góp ý</p>
                <h2>Chi tiết phản hồi</h2>
              </div>
              <FeedbackStatusPill status={feedbackDraft.status} />
            </div>
            <div className="feedback-detail-grid">
              <div>
                <span className="label">Người gửi</span>
                <strong>{selectedFeedback.userName || "Không tên"}</strong>
                <div className="muted">{selectedFeedback.userEmail || selectedFeedback.userId}</div>
              </div>
              <div>
                <span className="label">Loại</span>
                <strong>{feedbackCategoryLabels[selectedFeedback.category] || selectedFeedback.category}</strong>
              </div>
              <div>
                <span className="label">Thời gian</span>
                <strong>{shortDate(selectedFeedback.createdAt)}</strong>
              </div>
            </div>
            {selectedFeedback.pilot ? (
              <section className="pilot-detail-panel">
                <div className="modal-title-row">
                  <div>
                    <p className="eyebrow">Pilot Tiếng Việt</p>
                    <h3>{selectedFeedback.pilot.lessonTitle || "Giáo án chưa đặt tên"}</h3>
                  </div>
                  <span className={`status-pill ${selectedFeedback.pilot.summary.needsWorkCount ? "danger-pill" : ""}`}>
                    {selectedFeedback.pilot.summary.scorePercent}% đạt
                  </span>
                </div>
                <div className="feedback-detail-grid pilot-meta-grid">
                  <div><span className="label">Lớp / Bộ sách</span><strong>{selectedFeedback.pilot.grade} · {selectedFeedback.pilot.book || "Chưa ghi"}</strong></div>
                  <div><span className="label">Loại bài</span><strong>{selectedFeedback.pilot.audit?.lessonType || "Chưa xác định"}</strong><div className="muted">{selectedFeedback.pilot.audit?.classificationConfidence || "không có confidence"}</div></div>
                  <div><span className="label">Audit / Số tiết</span><strong>{selectedFeedback.pilot.audit?.status || "không có"} · {selectedFeedback.pilot.periods} tiết</strong><div className="muted">{selectedFeedback.pilot.audit?.issueCount || 0} issue</div></div>
                  <div><span className="label">Dùng để dạy</span><strong>{selectedFeedback.pilot.teachable === true ? "Có" : selectedFeedback.pilot.teachable === false ? "Chưa" : "Chưa đánh giá"}</strong></div>
                  <div><span className="label">Lesson ID</span><strong className="pilot-lesson-id">{selectedFeedback.pilot.lessonId}</strong></div>
                </div>
                <div className="pilot-rating-grid">
                  {Object.entries(pilotCriterionLabels).map(([id, label]) => {
                    const rating = selectedFeedback.pilot?.ratings?.[id] || "unrated";
                    return (
                      <div key={id} className={`pilot-rating ${rating}`}>
                        <span>{label}</span>
                        <strong>{rating === "pass" ? "✓ Đạt" : rating === "needs-work" ? "! Cần chỉnh" : "— Chưa chấm"}</strong>
                      </div>
                    );
                  })}
                </div>
              </section>
            ) : null}
            <div className="feedback-message-box">{selectedFeedback.message}</div>
            <div className="grid settings-grid" style={{ marginTop: 14 }}>
              <label>
                <span className="label">Trạng thái</span>
                <select className="select" value={feedbackDraft.status} onChange={(event) => setFeedbackDraft({ ...feedbackDraft, status: event.target.value as FeedbackStatus })}>
                  {Object.entries(feedbackStatusLabels).filter(([value]) => value !== "all" && value !== "reviewed").map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
              <label>
                <span className="label">Mức độ</span>
                <select className="select" value={feedbackDraft.priority} onChange={(event) => setFeedbackDraft({ ...feedbackDraft, priority: event.target.value as FeedbackPriority })}>
                  {Object.entries(priorityLabels).filter(([value]) => value !== "all").map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
            </div>
            <label className="label" style={{ marginTop: 14 }}>Ghi chú nội bộ</label>
            <textarea className="textarea" value={feedbackDraft.adminNote} onChange={(event) => setFeedbackDraft({ ...feedbackDraft, adminNote: event.target.value })} />
            {selectedFeedback.pageUrl ? (
              <div style={{ marginTop: 12 }}>
                <span className="label">Trang gửi</span>
                <a className="feedback-link" href={selectedFeedback.pageUrl} target="_blank" rel="noreferrer">{selectedFeedback.pageUrl}</a>
              </div>
            ) : null}
            {selectedFeedback.userAgent ? (
              <div style={{ marginTop: 12 }}>
                <span className="label">Thiết bị</span>
                <p className="muted feedback-user-agent">{selectedFeedback.userAgent}</p>
              </div>
            ) : null}
            <div className="modal-actions">
              <button className="button secondary" onClick={() => {
                setSelectedFeedback(null);
                setFeedbackDraft(null);
              }}>Đóng</button>
              <button className="button" onClick={saveFeedbackDraft}>Lưu xử lý</button>
              <button className="button danger" onClick={() => deleteFeedback(selectedFeedback)}>Xóa</button>
            </div>
          </div>
        </div>
      ) : null}

      {selectedPayment ? (
        <div className="modal-backdrop" onClick={() => setSelectedPayment(null)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-title-row"><div><p className="eyebrow">Đối soát giao dịch</p><h2>{selectedPayment.transferContent}</h2></div><span className="status-pill">{selectedPayment.status}</span></div>
            <div className="detail-grid">
              <div><span className="label">Người chuyển</span><strong>{selectedPayment.senderName}</strong></div>
              <div><span className="label">Số tiền</span><strong>{selectedPayment.amountVnd.toLocaleString("vi-VN")}đ</strong></div>
              <div><span className="label">Gói / tín dụng</span><strong>Trả phí · {selectedPayment.credits} tín dụng</strong></div>
              <div><span className="label">Mã giao dịch</span><strong>{selectedPayment.id}</strong></div>
              <div><span className="label">Nhà cung cấp</span><strong>{selectedPayment.provider === "payos" ? "payOS" : "Chuyển khoản"}</strong></div>
              <div><span className="label">Order code</span><strong>{selectedPayment.orderCode || "—"}</strong></div>
            </div>
            <div style={{ marginTop: 14 }}>
              {selectedPayment.checks.map((check) => <div key={check.key} className={`message ${check.passed ? "ok" : "error"}`}>{check.passed ? "✓" : "✕"} {check.key}: {check.detail}</div>)}
            </div>
            <pre className="code-block">{JSON.stringify(selectedPayment.payos, null, 2)}</pre>
            <div className="modal-actions">
              {selectedPayment.status === 'pending_review' ? <>
                <button className="button" onClick={() => reviewPayment(selectedPayment.id, "approve")}>Duyệt & cộng quyền lợi</button>
                <button className="button danger" onClick={() => reviewPayment(selectedPayment.id, "reject")}>Từ chối</button>
              </> : null}
              <button className="button secondary" onClick={() => setSelectedPayment(null)}>Đóng</button>
            </div>
          </div>
        </div>
      ) : null}

      {grantTarget ? (
        <div className="modal-backdrop" onClick={() => setGrantTarget(null)}>
          <div className="modal" onClick={(event) => event.stopPropagation()} style={{ width: 'min(560px, 100%)' }}>
            <div className="modal-title-row">
              <div>
                <p className="eyebrow">Quản lý gói & tín dụng</p>
                <h2>{grantTarget.displayName || grantTarget.email}</h2>
              </div>
              <button className="button secondary" onClick={() => setGrantTarget(null)}>Đóng</button>
            </div>

            <div className="detail-grid">
              <div><span className="label">Gói hiện tại</span><strong>{grantTarget.paidPlan && grantTarget.paidPlan !== 'free' ? 'Trả phí' : 'Miễn phí'}</strong></div>
              <div><span className="label">Trạng thái</span><strong>{planStatusLabels[grantTarget.planStatus] || grantTarget.planStatus}</strong></div>
              <div><span className="label">Tín dụng gói</span><strong>{grantTarget.packageCredits}</strong></div>
              <div><span className="label">Tín dụng top-up</span><strong>{grantTarget.topupCredits}</strong></div>
              <div><span className="label">Hết hạn</span><strong>{grantTarget.planExpiresAt ? shortDate(grantTarget.planExpiresAt) : '—'}</strong></div>
              <div><span className="label">Email</span><strong>{grantTarget.email}</strong></div>
            </div>

            {/* ── Kích hoạt gói ── */}
            <div style={{ marginTop: 20, borderTop: '1px solid var(--c-border, #e2e8f0)', paddingTop: 18 }}>
              <p className="label">Kích hoạt gói mới (50 tín dụng, 30 ngày)</p>
              <p className="muted" style={{ margin: '4px 0 10px' }}>Reset tín dụng về 50, gia hạn 30 ngày. Top-up cũ sẽ bị xóa.</p>
              <div className="row-actions">
                <button className="button" onClick={() => grantPlan(grantTarget.uid)}>Kích hoạt gói Trả phí</button>
              </div>
            </div>

            {/* ── Cộng tín dụng ── */}
            <div style={{ marginTop: 20, borderTop: '1px solid var(--c-border, #e2e8f0)', paddingTop: 18 }}>
              <p className="label">Cộng tín dụng (yêu cầu gói Trả phí còn hạn)</p>
              <div className="row-actions" style={{ marginTop: 8 }}>
                <input className="input" type="number" min={1} max={9999} value={grantCreditsAmount} onChange={(event) => setGrantCreditsAmount(Math.max(1, Number(event.target.value)))} style={{ maxWidth: 120 }} />
                <button className="button" onClick={() => grantCredits(grantTarget.uid, grantCreditsAmount)}>Cộng {grantCreditsAmount} tín dụng</button>
              </div>
            </div>

            {/* ── Trừ tín dụng ── */}
            <div style={{ marginTop: 20, borderTop: '1px solid var(--c-border, #e2e8f0)', paddingTop: 18 }}>
              <p className="label">Trừ tín dụng</p>
              <p className="muted" style={{ margin: '4px 0 10px' }}>Trừ từ tín dụng gói trước, sau đó trừ top-up. Không thể trừ quá số dư.</p>
              <div className="row-actions" style={{ marginTop: 8 }}>
                <input className="input" type="number" min={1} max={9999} value={deductAmount} onChange={(event) => setDeductAmount(Math.max(1, Number(event.target.value)))} style={{ maxWidth: 120 }} />
                <button className="button danger" onClick={() => deductCredits(grantTarget.uid, deductAmount)}>Trừ {deductAmount} tín dụng</button>
              </div>
            </div>

            {/* ── Tước quyền gói ── */}
            {grantTarget.paidPlan && grantTarget.paidPlan !== 'free' ? (
              <div style={{ marginTop: 20, borderTop: '1px solid var(--c-border, #e2e8f0)', paddingTop: 18 }}>
                <p className="label">Tước quyền gói</p>
                <p className="muted" style={{ margin: '4px 0 10px' }}>Chuyển người dùng về gói Miễn phí, xóa toàn bộ tín dụng và hạn gói. Thao tác không thể hoàn tác.</p>
                <button className="button danger" onClick={() => revokePlan(grantTarget.uid)}>Tước quyền gói Trả phí</button>
              </div>
            ) : null}

            <div className="modal-actions" style={{ marginTop: 20, borderTop: '1px solid var(--c-border, #e2e8f0)', paddingTop: 16 }}>
              <button className="button secondary" onClick={() => setGrantTarget(null)}>Đóng</button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function DashboardView({ dashboard }: { dashboard: Dashboard }) {
  return (
    <div style={{ marginTop: 14 }}>
      <div className="grid stats-grid">
        <Stat title="Tổng user" value={dashboard.totalUsers} hint={`+${dashboard.newUsersToday} hôm nay, +${dashboard.newUsersThisWeek} tuần này`} />
        <Stat title="Đã xác minh email" value={dashboard.verifiedUsers} />
        <Stat title="Truy cập hôm nay" value={dashboard.todayVisits} />
        <Stat title="Tổng giáo án" value={dashboard.totalLessons} hint={`+${dashboard.lessonsToday} hôm nay`} />
        <Stat title="Lượt tạo còn lại" value={dashboard.remainingGenerations} />
        <Stat title="Góp ý chưa xử lý" value={dashboard.feedbackOpen} hint={`${dashboard.feedbackNew} góp ý mới`} />
      </div>
      <div className="grid dashboard-grid">
        <ChartCard title="Hoạt động 7 ngày" series={[
          { label: "Truy cập", points: dashboard.chart.visits },
          { label: "User mới", points: dashboard.chart.users },
          { label: "Giáo án", points: dashboard.chart.lessons },
          { label: "Góp ý", points: dashboard.chart.feedback },
        ]} />
        <div className="card">
          <div className="section-title">
            <h2>Lỗi và thao tác nhạy cảm gần đây</h2>
            <p className="muted">Tổng hợp từ error log nếu có, nếu không thì từ audit log.</p>
          </div>
          {dashboard.recentErrors.length ? (
            <div className="issue-list">
              {dashboard.recentErrors.map((issue) => (
                <div className="issue-item" key={issue.id}>
                  <strong>{issue.message || issue.action || "Sự kiện hệ thống"}</strong>
                  <span>{issue.source || issue.adminEmail || "system"} - {shortDate(issue.createdAt)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">Chưa ghi nhận lỗi hệ thống gần đây.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function ChartCard({ title, series }: { title: string; series: Array<{ label: string; points: ChartPoint[] }> }) {
  const max = Math.max(1, ...series.flatMap((item) => item.points.map((point) => point.value)));
  return (
    <div className="card chart-card">
      <div className="section-title">
        <h2>{title}</h2>
        <p className="muted">So sánh nhanh theo ngày, không cần mở báo cáo ngoài.</p>
      </div>
      <div className="chart-legend">
        {series.map((item, index) => <span key={item.label} className={`legend-dot dot-${index}`}>{item.label}</span>)}
      </div>
      <div className="bar-chart">
        {(series[0]?.points || []).map((point, pointIndex) => (
          <div className="chart-day" key={point.date}>
            <div className="bar-stack">
              {series.map((item, seriesIndex) => (
                <span
                  key={item.label}
                  className={`bar bar-${seriesIndex}`}
                  style={{ height: `${Math.max(4, (item.points[pointIndex]?.value || 0) / max * 100)}%` }}
                  title={`${item.label}: ${item.points[pointIndex]?.value || 0}`}
                />
              ))}
            </div>
            <small>{shortDay(point.date)}</small>
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({ title, value, hint }: { title: string; value: number; hint?: string }) {
  return (
    <div className="card">
      <p className="label">{title}</p>
      <div className="stat-value">{value.toLocaleString("vi-VN")}</div>
      {hint ? <p className="muted">{hint}</p> : null}
    </div>
  );
}

function NumberInput({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return <input className="input compact-number" type="number" value={value} onChange={(event) => onChange(Math.max(0, Number(event.target.value)))} />;
}

function DataTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="card table-wrap" style={{ marginTop: 14 }}>
      <table>
        <thead>
          <tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr>
        </thead>
        <tbody>
          {rows.length ? rows.map((row, rowIndex) => (
            <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>
          )) : <EmptyTable colSpan={headers.length} text="Chưa có dữ liệu." />}
        </tbody>
      </table>
    </div>
  );
}

function EmptyTable({ colSpan, text }: { colSpan: number; text: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="empty-row">{text}</td>
    </tr>
  );
}

function Pagination({ page, total, onPage }: { page: number; total: number; onPage: (page: number) => void }) {
  const maxPage = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;
  return (
    <div className="pagination">
      <button className="button secondary" disabled={page <= 1} onClick={() => onPage(page - 1)}>Trước</button>
      <span>Trang {page} / {maxPage}</span>
      <button className="button secondary" disabled={page >= maxPage} onClick={() => onPage(page + 1)}>Sau</button>
    </div>
  );
}

function FeedbackStatusPill({ status }: { status: FeedbackStatus }) {
  const className = status === "new" ? "new" : status === "resolved" ? "success-pill" : status === "ignored" ? "muted-pill" : "";
  return <span className={`status-pill ${className}`}>{feedbackStatusLabels[status] || status}</span>;
}

function PriorityPill({ priority }: { priority: FeedbackPriority }) {
  const className = priority === "high" ? "danger-pill" : priority === "low" ? "muted-pill" : "new";
  return <span className={`status-pill ${className}`}>{priorityLabels[priority] || priority}</span>;
}

function LoadingRows() {
  return (
    <div className="loading-card">
      <span />
      <span />
      <span />
    </div>
  );
}

function GenerationStatusPill({ status }: { status: GenerationItem["status"] }) {
  const label = status === "success" ? "Thành công" : status === "failed" ? "Thất bại" : "Đang xử lý";
  const className = status === "success" ? "success-pill" : status === "failed" ? "danger-pill" : "new";
  return <span className={`status-pill ${className}`}>{label}</span>;
}

function featureFlagLabel(key: string) {
  if (key === "feedbackWidget") return "Bật hòm thư góp ý";
  if (key === "lessonHistory") return "Bật lịch sử giáo án";
  if (key === "exportFiles") return "Bật xuất file";
  return key;
}
