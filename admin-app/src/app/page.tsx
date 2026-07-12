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
  lastLoginIpHash: string;
  ipLimitOverride: boolean;
  mustChangePassword: boolean;
  freeLimit: number;
  usedGenerations: number;
  remainingGenerations: number;
  activePlan: string;
  paidPlan: string;
  planStatus: string;
  packageCredits: number;
  topupCredits: number;
  planExpiresAt: string;
  createdAt: string;
  updatedAt: string;
};

type LedSettings = {
  enabled: boolean;
  messages: string[];
  durationSeconds: number;
  theme: string;
};

type LessonPayload = {
  generalInfo?: {
    lessonTitle?: string;
    subject?: string;
    grade?: string;
    periods?: number;
    duration?: number;
  };
  outcomes?: Record<string, string[]>;
  materials?: Record<string, string[]>;
  activities?: Array<{ name?: string; teacherActions?: string[]; studentActions?: string[] }>;
  periodPlans?: Array<{ periodNumber?: number; focus?: string; activities?: Array<{ name?: string }> }>;
};

type LessonItem = {
  id: string;
  ownerId: string;
  title: string;
  subject: string;
  grade: string;
  periods: number;
  lesson: LessonPayload | null;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
};

type Policies = {
  terms: string;
  privacy: string;
  version: string;
  updatedAt?: string;
};

type SystemSettings = {
  defaultFreeLimit: number;
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
  ocr: Record<string, unknown> | null;
  createdAt: string;
  approvedAt: string;
};

type FeedbackItem = {
  id: string;
  category: "bug" | "improvement" | "feature" | "other" | string;
  status: FeedbackStatus;
  priority: FeedbackPriority;
  adminNote: string;
  message: string;
  userId: string;
  userEmail: string;
  userName: string;
  pageUrl: string;
  userAgent: string;
  createdAt: string;
  updatedAt: string;
};

const tabs = [
  { id: "dashboard", label: "Tổng quan" },
  { id: "users", label: "Người dùng" },
  { id: "lessons", label: "Giáo án" },
  { id: "payments", label: "Thanh toán" },
  { id: "feedback", label: "Góp ý" },
  { id: "led", label: "Bảng LED" },
  { id: "settings", label: "Cấu hình" },
  { id: "policies", label: "Chính sách" },
  { id: "audit", label: "Audit log" },
] as const;

type TabId = (typeof tabs)[number]["id"];

const pageSize = 20;

const feedbackCategoryLabels: Record<string, string> = {
  all: "Tất cả",
  bug: "Báo lỗi",
  improvement: "Góp ý cải thiện",
  feature: "Yêu cầu tính năng",
  other: "Khác",
};

const feedbackStatusLabels: Record<string, string> = {
  all: "Tất cả",
  new: "Mới",
  in_progress: "Đang xử lý",
  resolved: "Đã xử lý",
  ignored: "Bỏ qua",
  reviewed: "Đã xem",
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

function shortDay(value: string) {
  if (!value) return "";
  return value.slice(5).replace("-", "/");
}

function previewText(value: string, maxLength = 120) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength).trim()}...`;
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
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [led, setLed] = useState<LedSettings>({ enabled: true, messages: [], durationSeconds: 18, theme: "blue" });
  const [system, setSystem] = useState<SystemSettings>({
    defaultFreeLimit: 10,
    featureFlags: { feedbackWidget: true, lessonHistory: true, exportFiles: true },
  });
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [userQuery, setUserQuery] = useState("");
  const [userFilter, setUserFilter] = useState("all");
  const [userPage, setUserPage] = useState(1);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [selectedUser, setSelectedUser] = useState<ManagedUser | null>(null);
  const [userLessons, setUserLessons] = useState<LessonItem[]>([]);
  const [lessons, setLessons] = useState<LessonItem[]>([]);
  const [lessonQuery, setLessonQuery] = useState("");
  const [lessonSubject, setLessonSubject] = useState("");
  const [lessonGrade, setLessonGrade] = useState("");
  const [lessonFrom, setLessonFrom] = useState("");
  const [lessonTo, setLessonTo] = useState("");
  const [lessonPage, setLessonPage] = useState(1);
  const [selectedLesson, setSelectedLesson] = useState<LessonItem | null>(null);
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

  const ledText = useMemo(() => led.messages.join("\n"), [led.messages]);
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

  async function loadLed() {
    const result = await api<{ led: LedSettings }>("/api/admin/settings/header-led");
    setLed(result.led);
  }

  async function loadSystem() {
    const result = await api<{ system: SystemSettings }>("/api/admin/settings/system");
    setSystem(result.system);
  }

  async function loadUsers(query = userQuery, filter = userFilter) {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (filter !== "all") params.set("filter", filter);
    const result = await api<{ users: ManagedUser[] }>(`/api/admin/users${params.toString() ? `?${params}` : ""}`);
    setUsers(result.users);
    setSelectedUserIds([]);
    setUserPage(1);
  }

  async function loadLessons(ownerId?: string) {
    const params = new URLSearchParams();
    if (lessonQuery) params.set("q", lessonQuery);
    if (lessonSubject) params.set("subject", lessonSubject);
    if (lessonGrade) params.set("grade", lessonGrade);
    if (lessonFrom) params.set("from", lessonFrom);
    if (lessonTo) params.set("to", lessonTo);
    const result = await api<{ lessons: LessonItem[] }>(`/api/admin/lessons${params.toString() ? `?${params}` : ""}`);
    const nextLessons = ownerId ? result.lessons.filter((lesson) => lesson.ownerId === ownerId) : result.lessons;
    if (ownerId) setUserLessons(nextLessons);
    else {
      setLessons(nextLessons);
      setLessonPage(1);
    }
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
      if (nextTab === "led") await loadLed();
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
    try {
      const auth = await getFirebaseClientAuth();
      await signInWithEmailAndPassword(auth, email, password);
      await createSession();
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Không thể đăng nhập admin.");
    }
  }

  async function handleGoogleLogin() {
    setError("");
    setMessage("");
    try {
      const auth = await getFirebaseClientAuth();
      await signInWithPopup(auth, googleAuthProvider);
      await createSession();
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Không thể đăng nhập Google.");
    }
  }

  async function handleLogout() {
    await api("/api/auth/logout", { method: "POST" });
    const auth = await getFirebaseClientAuth();
    await signOut(auth).catch(() => undefined);
    setAdmin(null);
  }

  async function saveLed() {
    setError("");
    setMessage("");
    try {
      const result = await api<{ led: LedSettings }>("/api/admin/settings/header-led", {
        method: "PATCH",
        body: JSON.stringify({
          ...led,
          messages: ledText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean),
        }),
      });
      setLed(result.led);
      setMessage("Đã lưu bảng LED.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Không thể lưu LED.");
    }
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
        body: JSON.stringify(user),
      });
      setMessage(`Đã cập nhật ${user.email}.`);
      await loadUsers();
      await loadDashboard().catch(() => undefined);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Không thể lưu user.");
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
      if (selectedUser?.uid === user.uid) setSelectedUser(null);
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
      if (selectedUser && targets.some((user) => user.uid === selectedUser.uid)) setSelectedUser(null);
      if (passwordTarget && targets.some((user) => user.uid === passwordTarget.uid)) setPasswordTarget(null);
      setMessage(`Đã xóa ${result.deletedCount} user.`);
      await loadUsers();
      await loadDashboard().catch(() => undefined);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Không thể xóa user đã chọn.");
    }
  }

  function adjustQuota(user: ManagedUser, delta: number) {
    const next = users.map((item) => (
      item.uid === user.uid
        ? { ...item, freeLimit: Math.max(0, item.freeLimit + delta), remainingGenerations: Math.max(0, item.freeLimit + delta - item.usedGenerations) }
        : item
    ));
    setUsers(next);
  }

  async function openUserHistory(user: ManagedUser) {
    setSelectedUser(user);
    setUserLessons([]);
    await loadLessons(user.uid);
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

  async function grantPlan(uid: string, plan: "plus" | "pro") {
    if (!window.confirm(`Kích hoạt gói ${plan.toUpperCase()} (50 tín dụng, 30 ngày) cho user này?`)) return;
    setError(""); setMessage("");
    try {
      const result = await api<{ granted: { plan: string; credits: number; expiresAt: string } }>(`/api/admin/users/${uid}`, { method: "PATCH", body: JSON.stringify({ grantPlan: plan }) });
      setMessage(`Đã kích hoạt gói ${result.granted.plan.toUpperCase()} với ${result.granted.credits} tín dụng.`);
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
    if (!window.confirm("Xác nhận tước quyền gói Plus/Pro của user này?\n\nUser sẽ bị chuyển về FREE, mất toàn bộ tín dụng còn lại.")) return;
    setError(""); setMessage("");
    try {
      await api(`/api/admin/users/${uid}`, { method: "PATCH", body: JSON.stringify({ revokePlan: true }) });
      setMessage("Đã tước quyền gói. User đã chuyển về FREE.");
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

  async function deleteLesson(item: LessonItem) {
    const confirmed = window.confirm(`Xóa giáo án "${item.title}"? Thao tác này chỉ xóa thủ công và không tự khôi phục.`);
    if (!confirmed) return;
    setError("");
    setMessage("");
    try {
      await api(`/api/admin/lessons/${item.id}`, { method: "DELETE" });
      setSelectedLesson(null);
      setMessage("Đã xóa giáo án.");
      await loadLessons();
      await loadDashboard().catch(() => undefined);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Không thể xóa giáo án.");
    }
  }

  function exportFeedback() {
    window.location.href = "/api/admin/feedback/export";
  }

  function exportLessons() {
    window.location.href = "/api/admin/lessons/export";
  }

  if (!authLoaded) {
    return <main className="main">Đang kiểm tra phiên admin...</main>;
  }

  if (!admin) {
    return (
      <main className="login-page">
        <section className="login-card">
          <p className="eyebrow">EduPlan AI Admin</p>
          <h1>Đăng nhập quản trị</h1>
          <p className="muted">Chỉ tài khoản có role admin mới được truy cập hệ thống quản lý.</p>
          {error ? <div className="message error">{error}</div> : null}
          <label className="label">Email</label>
          <input className="input" value={email} onChange={(event) => setEmail(event.target.value)} />
          <label className="label">Mật khẩu</label>
          <input className="input" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          <button className="button" onClick={handleEmailLogin}>Đăng nhập</button>
          <button className="button secondary" onClick={handleGoogleLogin}>Tiếp tục với Google</button>
        </section>
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

        {tab === "led" ? (
          <div className="card form-card" style={{ marginTop: 14 }}>
            <label className="switch-row">
              <input type="checkbox" checked={led.enabled} onChange={(event) => setLed({ ...led, enabled: event.target.checked })} />
              <span>Bật bảng LED</span>
            </label>
            <label className="label" style={{ marginTop: 12 }}>Nội dung, mỗi dòng là một thông báo</label>
            <textarea className="textarea" value={ledText} onChange={(event) => setLed({ ...led, messages: event.target.value.split(/\r?\n/) })} />
            <div className="grid settings-grid" style={{ marginTop: 12 }}>
              <label>
                <span className="label">Giây chạy</span>
                <input className="input" type="number" min={6} max={120} value={led.durationSeconds} onChange={(event) => setLed({ ...led, durationSeconds: Number(event.target.value) })} />
              </label>
              <label>
                <span className="label">Theme</span>
                <select className="select" value={led.theme} onChange={(event) => setLed({ ...led, theme: event.target.value })}>
                  <option value="blue">Blue</option>
                  <option value="dark">Dark</option>
                  <option value="notice">Notice</option>
                </select>
              </label>
            </div>
            <button className="button" style={{ marginTop: 14 }} onClick={saveLed}>Lưu thay đổi</button>
          </div>
        ) : null}

        {tab === "payments" ? (
          <div className="card" style={{ marginTop: 14 }}>
            <div className="toolbar-grid user-toolbar">
              <select className="select" value={paymentStatus} onChange={(event) => setPaymentStatus(event.target.value)}>
                <option value="all">Tất cả giao dịch</option>
                <option value="pending_review">Cần kiểm tra</option>
                <option value="precheck_failed">OCR không khớp</option>
                <option value="awaiting_proof">Chờ bill</option>
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
                    <td><strong>{payment.senderName}</strong><div className="muted">{payment.transferContent}</div></td>
                    <td>{payment.purchaseType === "package" ? `Gói ${payment.targetPlan}` : `${payment.credits} tín dụng ${payment.targetPlan}`}</td>
                    <td>{payment.amountVnd.toLocaleString("vi-VN")}đ</td>
                    <td><span className={`status-pill ${payment.status === "approved" ? "" : payment.status === "precheck_failed" || payment.status === "rejected" ? "danger-pill" : "new"}`}>{payment.status}</span><div className="muted">{payment.safeReason}</div></td>
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
              <p className="muted">Các cờ tính năng và lượt miễn phí mặc định cho vận hành.</p>
            </div>
            <label>
              <span className="label">Số lượt miễn phí mặc định</span>
              <input className="input" type="number" min={0} max={1000} value={system.defaultFreeLimit} onChange={(event) => setSystem({ ...system, defaultFreeLimit: Number(event.target.value) })} />
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
                    <th>Role</th>
                    <th>Lượt</th>
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
                          <label className="muted" title="Cho phép tài khoản này bỏ qua giới hạn Free/Trial theo IP">
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
                        <select className="select" value={user.role} onChange={(event) => {
                          setUsers(users.map((item) => item.uid === user.uid ? { ...item, role: event.target.value as "user" | "admin" } : item));
                        }}>
                          <option value="user">user</option>
                          <option value="admin">admin</option>
                        </select>
                      </td>
                      <td>
                        <div className="quota-row">
                          <button className="mini-button" onClick={() => adjustQuota(user, -1)}>-</button>
                          <NumberInput value={user.freeLimit} onChange={(value) => {
                            setUsers(users.map((item) => item.uid === user.uid ? { ...item, freeLimit: value, remainingGenerations: Math.max(0, value - item.usedGenerations) } : item));
                          }} />
                          <button className="mini-button" onClick={() => adjustQuota(user, 1)}>+</button>
                        </div>
                        <div className="muted">Đã dùng {user.usedGenerations}, còn {Math.max(0, user.freeLimit - user.usedGenerations)}</div>
                      </td>
                      <td>
                        <div className="row-actions">
                          <button className="button secondary" onClick={() => saveUser(user)}>Lưu</button>
                          <button
                            className="button secondary"
                            onClick={() => {
                              const next = { ...user, disabled: !user.disabled };
                              setUsers(users.map((item) => item.uid === user.uid ? next : item));
                              void saveUser(next);
                            }}
                          >
                            {user.disabled ? "Mở khóa" : "Khóa"}
                          </button>
                          <button className="button secondary" onClick={() => openUserHistory(user)}>Lịch sử</button>
                          <button className="button secondary" onClick={() => { setGrantTarget(user); setGrantCreditsAmount(25); }}>Gói</button>
                          <button className="button" onClick={() => setPasswordTarget(user)}>Đổi mật khẩu</button>
                          <button className="button danger" disabled={user.uid === admin.uid} onClick={() => deleteUser(user)}>Xóa</button>
                        </div>
                      </td>
                    </tr>
                  )) : <EmptyTable colSpan={6} text="Không có user theo bộ lọc hiện tại." />}
                </tbody>
              </table>
            </div>
            <Pagination page={userPage} total={users.length} onPage={setUserPage} />
          </div>
        ) : null}

        {tab === "lessons" ? (
          <div className="card" style={{ marginTop: 14 }}>
            <div className="toolbar-grid lesson-toolbar">
              <input className="input" placeholder="Tìm tên, user, môn, lớp" value={lessonQuery} onChange={(event) => setLessonQuery(event.target.value)} />
              <input className="input" placeholder="Môn" value={lessonSubject} onChange={(event) => setLessonSubject(event.target.value)} />
              <input className="input" placeholder="Lớp" value={lessonGrade} onChange={(event) => setLessonGrade(event.target.value)} />
              <input className="input" type="date" value={lessonFrom} onChange={(event) => setLessonFrom(event.target.value)} />
              <input className="input" type="date" value={lessonTo} onChange={(event) => setLessonTo(event.target.value)} />
              <button className="button secondary" onClick={() => loadLessons()}>Lọc</button>
              <button className="button" onClick={exportLessons}>Tải Excel</button>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Tên</th>
                    <th>User</th>
                    <th>Môn/Lớp</th>
                    <th>Tiết</th>
                    <th>Cập nhật</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedLessons.length ? pagedLessons.map((lesson) => (
                    <tr key={lesson.id}>
                      <td><strong>{lesson.title}</strong><div className="muted">Tạo {shortDate(lesson.createdAt)}</div></td>
                      <td>{lesson.ownerId}</td>
                      <td>{lesson.subject} - {lesson.grade}</td>
                      <td>{lesson.periods}</td>
                      <td>{shortDate(lesson.updatedAt)}</td>
                      <td>
                        <div className="row-actions">
                          <button className="button secondary" onClick={() => setSelectedLesson(lesson)}>Preview</button>
                          <button className="button danger" onClick={() => deleteLesson(lesson)}>Xóa</button>
                        </div>
                      </td>
                    </tr>
                  )) : <EmptyTable colSpan={6} text="Không có giáo án theo bộ lọc hiện tại." />}
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

      {selectedUser ? (
        <div className="modal-backdrop">
          <div className="modal feedback-modal">
            <div className="modal-title-row">
              <div>
                <p className="eyebrow">Lịch sử user</p>
                <h2>{selectedUser.displayName || selectedUser.email}</h2>
              </div>
              <button className="button secondary" onClick={() => setSelectedUser(null)}>Đóng</button>
            </div>
            <div className="table-wrap" style={{ marginTop: 14 }}>
              <table>
                <thead>
                  <tr><th>Giáo án</th><th>Môn/Lớp</th><th>Cập nhật</th><th>Thao tác</th></tr>
                </thead>
                <tbody>
                  {userLessons.length ? userLessons.map((lesson) => (
                    <tr key={lesson.id}>
                      <td>{lesson.title}</td>
                      <td>{lesson.subject} - {lesson.grade}</td>
                      <td>{shortDate(lesson.updatedAt)}</td>
                      <td><button className="button secondary" onClick={() => setSelectedLesson(lesson)}>Preview</button></td>
                    </tr>
                  )) : <EmptyTable colSpan={4} text="User này chưa có giáo án trong 200 bản gần nhất." />}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      {selectedLesson ? (
        <LessonModal lesson={selectedLesson} onClose={() => setSelectedLesson(null)} onDelete={() => deleteLesson(selectedLesson)} />
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
              <div><span className="label">Gói / tín dụng</span><strong>{selectedPayment.targetPlan} · {selectedPayment.credits} credits</strong></div>
              <div><span className="label">Mã giao dịch</span><strong>{selectedPayment.id}</strong></div>
            </div>
            <div style={{ marginTop: 14 }}>
              {selectedPayment.checks.map((check) => <div key={check.key} className={`message ${check.passed ? "ok" : "error"}`}>{check.passed ? "✓" : "✕"} {check.key}: {check.detail}</div>)}
            </div>
            <pre className="code-block">{JSON.stringify(selectedPayment.ocr, null, 2)}</pre>
            <div className="modal-actions">
              {!['approved','rejected'].includes(selectedPayment.status) ? <>
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
              <div><span className="label">Gói hiện tại</span><strong>{grantTarget.paidPlan ? grantTarget.paidPlan.toUpperCase() : 'FREE'}</strong></div>
              <div><span className="label">Trạng thái</span><strong>{grantTarget.planStatus}</strong></div>
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
                <button className="button" onClick={() => grantPlan(grantTarget.uid, 'plus')}>Kích hoạt PLUS</button>
                <button className="button" onClick={() => grantPlan(grantTarget.uid, 'pro')}>Kích hoạt PRO</button>
              </div>
            </div>

            {/* ── Cộng tín dụng ── */}
            <div style={{ marginTop: 20, borderTop: '1px solid var(--c-border, #e2e8f0)', paddingTop: 18 }}>
              <p className="label">Cộng tín dụng (yêu cầu gói Plus/Pro còn hạn)</p>
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
                <p className="muted" style={{ margin: '4px 0 10px' }}>Chuyển user về FREE, xóa toàn bộ tín dụng và hạn gói. Thao tác không thể hoàn tác.</p>
                <button className="button danger" onClick={() => revokePlan(grantTarget.uid)}>Tước quyền {grantTarget.paidPlan.toUpperCase()}</button>
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

function LessonModal({ lesson, onClose, onDelete }: { lesson: LessonItem; onClose: () => void; onDelete: () => void }) {
  const payload = lesson.lesson;
  const outcomes = payload?.outcomes ? Object.entries(payload.outcomes).flatMap(([key, values]) => values.map((value) => `${key}: ${value}`)).slice(0, 8) : [];
  const materials = payload?.materials ? Object.entries(payload.materials).flatMap(([key, values]) => values.map((value) => `${key}: ${value}`)).slice(0, 8) : [];
  const activities = payload?.periodPlans?.flatMap((period) => (period.activities || []).map((activity) => `Tiết ${period.periodNumber || ""}: ${activity.name || "Hoạt động"}`))
    || payload?.activities?.map((activity) => activity.name || "Hoạt động")
    || [];
  return (
    <div className="modal-backdrop">
      <div className="modal lesson-modal">
        <div className="modal-title-row">
          <div>
            <p className="eyebrow">Preview giáo án</p>
            <h2>{lesson.title}</h2>
            <p className="muted">{lesson.subject} - {lesson.grade} - {lesson.periods} tiết</p>
          </div>
          <button className="button secondary" onClick={onClose}>Đóng</button>
        </div>
        <div className="lesson-preview-grid">
          <PreviewBlock title="Mục tiêu" items={outcomes} empty="Chưa có mục tiêu trong payload." />
          <PreviewBlock title="Học liệu" items={materials} empty="Chưa có học liệu trong payload." />
          <PreviewBlock title="Hoạt động" items={activities.slice(0, 12)} empty="Chưa có hoạt động trong payload." />
        </div>
        <div className="modal-actions">
          <button className="button danger" onClick={onDelete}>Xóa giáo án</button>
        </div>
      </div>
    </div>
  );
}

function PreviewBlock({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <div className="preview-block">
      <h3>{title}</h3>
      {items.length ? (
        <ul>{items.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul>
      ) : <p className="muted">{empty}</p>}
    </div>
  );
}

function featureFlagLabel(key: string) {
  if (key === "feedbackWidget") return "Bật hòm thư góp ý";
  if (key === "lessonHistory") return "Bật lịch sử giáo án";
  if (key === "exportFiles") return "Bật xuất file";
  return key;
}
