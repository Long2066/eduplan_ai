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

type Dashboard = {
  today: string;
  totalUsers: number;
  verifiedUsers: number;
  todayVisits: number;
  totalLessons: number;
  lessonsToday: number;
  lowQuotaUsers: number;
};

type ManagedUser = {
  uid: string;
  email: string;
  displayName: string;
  role: "user" | "admin";
  emailVerified: boolean;
  freeLimit: number;
  usedGenerations: number;
  remainingGenerations: number;
  createdAt: string;
  updatedAt: string;
};

type LedSettings = {
  enabled: boolean;
  messages: string[];
  durationSeconds: number;
  theme: string;
};

type LessonItem = {
  id: string;
  ownerId: string;
  title: string;
  subject: string;
  grade: string;
  periods: number;
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

type AuditLog = {
  id: string;
  action: string;
  adminEmail: string;
  detail: Record<string, unknown>;
  createdAt: string;
};

type FeedbackItem = {
  id: string;
  category: "bug" | "improvement" | "feature" | "other" | string;
  status: "new" | "reviewed";
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
  { id: "led", label: "Bảng LED" },
  { id: "users", label: "Người dùng" },
  { id: "lessons", label: "Giáo án" },
  { id: "feedback", label: "Góp ý" },
  { id: "policies", label: "Chính sách" },
  { id: "audit", label: "Audit log" },
] as const;

type TabId = (typeof tabs)[number]["id"];

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

function previewText(value: string, maxLength = 120) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength).trim()}...`;
}

const feedbackCategoryLabels: Record<string, string> = {
  all: "Tất cả",
  bug: "Báo lỗi",
  improvement: "Góp ý cải thiện",
  feature: "Yêu cầu tính năng",
  other: "Khác",
};

export default function AdminPage() {
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [authLoaded, setAuthLoaded] = useState(false);
  const [tab, setTab] = useState<TabId>("dashboard");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [led, setLed] = useState<LedSettings>({ enabled: true, messages: [], durationSeconds: 18, theme: "blue" });
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [userQuery, setUserQuery] = useState("");
  const [lessons, setLessons] = useState<LessonItem[]>([]);
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [feedbackCategory, setFeedbackCategory] = useState("all");
  const [feedbackStatus, setFeedbackStatus] = useState("all");
  const [feedbackFrom, setFeedbackFrom] = useState("");
  const [feedbackTo, setFeedbackTo] = useState("");
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackItem | null>(null);
  const [policies, setPolicies] = useState<Policies>({ terms: "", privacy: "", version: "1.0" });
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [passwordTarget, setPasswordTarget] = useState<ManagedUser | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [revokeSessions, setRevokeSessions] = useState(true);
  const [mustChangePassword, setMustChangePassword] = useState(false);

  const ledText = useMemo(() => led.messages.join("\n"), [led.messages]);

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

  async function loadUsers(query = userQuery) {
    const result = await api<{ users: ManagedUser[] }>(`/api/admin/users${query ? `?q=${encodeURIComponent(query)}` : ""}`);
    setUsers(result.users);
  }

  async function loadLessons() {
    const result = await api<{ lessons: LessonItem[] }>("/api/admin/lessons");
    setLessons(result.lessons);
  }

  async function loadFeedback() {
    const params = new URLSearchParams();
    if (feedbackCategory !== "all") params.set("category", feedbackCategory);
    if (feedbackStatus !== "all") params.set("status", feedbackStatus);
    if (feedbackFrom) params.set("from", feedbackFrom);
    if (feedbackTo) params.set("to", feedbackTo);
    const query = params.toString();
    const result = await api<{ feedback: FeedbackItem[] }>(`/api/admin/feedback${query ? `?${query}` : ""}`);
    setFeedback(result.feedback);
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
    try {
      if (nextTab === "dashboard") await loadDashboard();
      if (nextTab === "led") await loadLed();
      if (nextTab === "users") await loadUsers();
      if (nextTab === "lessons") await loadLessons();
      if (nextTab === "feedback") await loadFeedback();
      if (nextTab === "policies") await loadPolicies();
      if (nextTab === "audit") await loadAudit();
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Không thể tải dữ liệu.");
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
      await loadDashboard();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Không thể lưu user.");
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
      await loadAudit();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Không thể đổi mật khẩu.");
    }
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

  async function updateFeedbackStatus(item: FeedbackItem, status: "new" | "reviewed") {
    setError("");
    setMessage("");
    try {
      await api(`/api/admin/feedback/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setMessage("Đã cập nhật trạng thái góp ý.");
      if (selectedFeedback?.id === item.id) setSelectedFeedback({ ...item, status });
      await loadFeedback();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Không thể cập nhật góp ý.");
    }
  }

  async function deleteFeedback(item: FeedbackItem) {
    const confirmed = window.confirm(`Xóa góp ý của ${item.userEmail || item.userName || "người dùng"}? Thao tác này không tự khôi phục.`);
    if (!confirmed) return;
    setError("");
    setMessage("");
    try {
      await api(`/api/admin/feedback/${item.id}`, { method: "DELETE" });
      setSelectedFeedback(null);
      setMessage("Đã xóa góp ý.");
      await loadFeedback();
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
        <nav style={{ marginTop: 18 }}>
          {tabs.map((item) => (
            <button key={item.id} className={`nav-button ${tab === item.id ? "active" : ""}`} onClick={() => setTab(item.id)}>
              {item.label}
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
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <strong>{admin.displayName || admin.email}</strong>
            <button className="button secondary" onClick={handleLogout}>Đăng xuất</button>
          </div>
        </div>

        <div style={{ marginTop: 14 }}>
          {message ? <div className="message ok">{message}</div> : null}
          {error ? <div className="message error">{error}</div> : null}
        </div>

        {tab === "dashboard" && dashboard ? (
          <div className="grid stats-grid" style={{ marginTop: 14 }}>
            <Stat title="Tổng user" value={dashboard.totalUsers} />
            <Stat title="Đã xác minh email" value={dashboard.verifiedUsers} />
            <Stat title="Truy cập hôm nay" value={dashboard.todayVisits} />
            <Stat title="Tổng giáo án" value={dashboard.totalLessons} />
            <Stat title="Giáo án hôm nay" value={dashboard.lessonsToday} />
            <Stat title="User gần hết lượt" value={dashboard.lowQuotaUsers} />
          </div>
        ) : null}

        {tab === "led" ? (
          <div className="card" style={{ marginTop: 14 }}>
            <label className="label">Bật bảng LED</label>
            <input type="checkbox" checked={led.enabled} onChange={(event) => setLed({ ...led, enabled: event.target.checked })} />
            <div style={{ height: 12 }} />
            <label className="label">Nội dung, mỗi dòng là một thông báo</label>
            <textarea className="textarea" value={ledText} onChange={(event) => setLed({ ...led, messages: event.target.value.split(/\r?\n/) })} />
            <div className="grid" style={{ gridTemplateColumns: "180px 180px", marginTop: 12 }}>
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

        {tab === "users" ? (
          <div className="card" style={{ marginTop: 14 }}>
            <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
              <input className="input" placeholder="Tìm theo email hoặc họ tên" value={userQuery} onChange={(event) => setUserQuery(event.target.value)} />
              <button className="button secondary" onClick={() => loadUsers()}>Tìm</button>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Xác minh</th>
                    <th>Role</th>
                    <th>Lượt free</th>
                    <th>Đã dùng</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user, index) => (
                    <tr key={user.uid}>
                      <td>
                        <input className="input" value={user.displayName} onChange={(event) => {
                          const next = [...users];
                          next[index] = { ...user, displayName: event.target.value };
                          setUsers(next);
                        }} />
                        <div className="muted">{user.email}</div>
                      </td>
                      <td>{user.emailVerified ? "Đã xác minh" : "Chưa"}</td>
                      <td>
                        <select className="select" value={user.role} onChange={(event) => {
                          const next = [...users];
                          next[index] = { ...user, role: event.target.value as "user" | "admin" };
                          setUsers(next);
                        }}>
                          <option value="user">user</option>
                          <option value="admin">admin</option>
                        </select>
                      </td>
                      <td><NumberInput value={user.freeLimit} onChange={(value) => {
                        const next = [...users];
                        next[index] = { ...user, freeLimit: value };
                        setUsers(next);
                      }} /></td>
                      <td><NumberInput value={user.usedGenerations} onChange={(value) => {
                        const next = [...users];
                        next[index] = { ...user, usedGenerations: value };
                        setUsers(next);
                      }} /></td>
                      <td>
                        <button className="button secondary" onClick={() => saveUser(user)}>Lưu</button>{" "}
                        <button className="button" onClick={() => setPasswordTarget(user)}>Đổi mật khẩu</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {tab === "lessons" ? (
          <DataTable headers={["Tên", "User", "Môn/Lớp", "Tiết", "Cập nhật", "Hết hạn"]} rows={lessons.map((lesson) => [
            lesson.title,
            lesson.ownerId,
            `${lesson.subject} - ${lesson.grade}`,
            String(lesson.periods),
            shortDate(lesson.updatedAt),
            shortDate(lesson.expiresAt),
          ])} />
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
                  <option value="all">Tất cả</option>
                  <option value="new">Mới</option>
                  <option value="reviewed">Đã xem</option>
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
                    <th>Nội dung</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {feedback.length ? feedback.map((item) => (
                    <tr key={item.id}>
                      <td>{shortDate(item.createdAt)}</td>
                      <td>
                        <strong>{item.userName || "Không tên"}</strong>
                        <div className="muted">{item.userEmail || item.userId}</div>
                      </td>
                      <td>{feedbackCategoryLabels[item.category] || item.category}</td>
                      <td>
                        <span className={`status-pill ${item.status === "new" ? "new" : ""}`}>
                          {item.status === "new" ? "Mới" : "Đã xem"}
                        </span>
                      </td>
                      <td className="feedback-preview">{previewText(item.message)}</td>
                      <td>
                        <div className="row-actions">
                          <button className="button secondary" onClick={() => setSelectedFeedback(item)}>Xem</button>
                          <button
                            className="button secondary"
                            onClick={() => updateFeedbackStatus(item, item.status === "new" ? "reviewed" : "new")}
                          >
                            {item.status === "new" ? "Đã xem" : "Đánh dấu mới"}
                          </button>
                          <button className="button danger" onClick={() => deleteFeedback(item)}>Xóa</button>
                        </div>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={6} className="empty-row">Chưa có góp ý nào theo bộ lọc hiện tại.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {tab === "policies" ? (
          <div className="card" style={{ marginTop: 14 }}>
            <label className="label">Phiên bản</label>
            <input className="input" value={policies.version} onChange={(event) => setPolicies({ ...policies, version: event.target.value })} />
            <label className="label" style={{ marginTop: 12 }}>Điều khoản sử dụng</label>
            <textarea className="textarea" value={policies.terms} onChange={(event) => setPolicies({ ...policies, terms: event.target.value })} />
            <label className="label" style={{ marginTop: 12 }}>Chính sách bảo mật</label>
            <textarea className="textarea" value={policies.privacy} onChange={(event) => setPolicies({ ...policies, privacy: event.target.value })} />
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
            <label style={{ display: "block", marginTop: 12 }}>
              <input type="checkbox" checked={revokeSessions} onChange={(event) => setRevokeSessions(event.target.checked)} /> Bắt đăng nhập lại
            </label>
            <label style={{ display: "block", marginTop: 8 }}>
              <input type="checkbox" checked={mustChangePassword} onChange={(event) => setMustChangePassword(event.target.checked)} /> Đánh dấu cần đổi mật khẩu
            </label>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 18 }}>
              <button className="button secondary" onClick={() => setPasswordTarget(null)}>Hủy</button>
              <button className="button danger" onClick={changePassword}>Lưu mật khẩu mới</button>
            </div>
          </div>
        </div>
      ) : null}

      {selectedFeedback ? (
        <div className="modal-backdrop">
          <div className="modal feedback-modal">
            <div className="modal-title-row">
              <div>
                <p className="eyebrow">Hòm thư góp ý</p>
                <h2>Chi tiết phản hồi</h2>
              </div>
              <span className={`status-pill ${selectedFeedback.status === "new" ? "new" : ""}`}>
                {selectedFeedback.status === "new" ? "Mới" : "Đã xem"}
              </span>
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
              <button className="button secondary" onClick={() => setSelectedFeedback(null)}>Đóng</button>
              <button
                className="button secondary"
                onClick={() => updateFeedbackStatus(selectedFeedback, selectedFeedback.status === "new" ? "reviewed" : "new")}
              >
                {selectedFeedback.status === "new" ? "Đánh dấu đã xem" : "Đánh dấu mới"}
              </button>
              <button className="button danger" onClick={() => deleteFeedback(selectedFeedback)}>Xóa</button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function Stat({ title, value }: { title: string; value: number }) {
  return (
    <div className="card">
      <p className="label">{title}</p>
      <div className="stat-value">{value.toLocaleString("vi-VN")}</div>
    </div>
  );
}

function NumberInput({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return <input className="input" type="number" value={value} onChange={(event) => onChange(Math.max(0, Number(event.target.value)))} />;
}

function DataTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="card table-wrap" style={{ marginTop: 14 }}>
      <table>
        <thead>
          <tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
