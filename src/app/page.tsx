"use client";

import { type CSSProperties, useEffect, useState } from "react";
import { sendEmailVerification } from "firebase/auth";
import { AuthPanel } from "@/components/auth-panel";
import { LessonForm } from "@/components/lesson-form";
import { LessonPreview } from "@/components/lesson-preview";
import { PreviewToolbar, type RefineAction } from "@/components/preview-toolbar";
import { type AppUser, UserMenu } from "@/components/user-menu";
import { defaultLessonInput, gradeOptions, subjectOptions } from "@/lib/defaults";
import { exportLessonToDocx } from "@/lib/export-docx";
import { getEmailActionSettings, getFirebaseClientAuth, hasFirebaseClientConfig } from "@/lib/firebase-client";
import { hasBlockingErrors, validateLessonInput } from "@/lib/lesson-validation";
import type { FormErrors, LessonInput, LessonPlan, LessonStyle, PedagogyAudit } from "@/types/lesson";

const DRAFT_KEY = "eduplan-ai.lesson-input.v1";
const defaultBillboardMessages = [
  "EduPlan AI chào mừng thầy cô đến với công cụ soạn giáo án thông minh",
  "Tạo giáo án chuẩn CV2345 nhanh chóng, rõ hoạt động giáo viên và học sinh",
  "Xuất Word và PDF giữ định dạng đẹp, tiện chỉnh sửa và lưu trữ",
  "Dữ liệu giáo án được lưu trong 7 ngày, dễ mở lại khi cần",
];
const VISIT_COUNTED_KEY = "__eduplanVisitCountedForLoad";

type ModelRoutingNotice = {
  primaryModel: string;
  modelUsed: string;
};

function PedagogyAuditCard({ audit }: { audit: PedagogyAudit | null }) {
  if (!audit) return null;

  const statusLabel =
    audit.status === "passed" ? "Đạt checklist môn học" : audit.status === "repaired" ? "Đã tự repair theo môn" : "Cần xem lại";
  const statusClass =
    audit.status === "needs-review"
      ? "border-amber-200 bg-amber-50 text-amber-900"
      : audit.status === "repaired"
        ? "border-sky-200 bg-sky-50 text-sky-900"
        : "border-emerald-200 bg-emerald-50 text-emerald-900";
  const dotClass = audit.status === "needs-review" ? "bg-amber-500" : audit.status === "repaired" ? "bg-sky-500" : "bg-emerald-500";

  return (
    <section className={`mb-2.5 shrink-0 rounded-xl border px-4 py-3 text-sm shadow-sm ${statusClass}`} role="status">
      <div className="flex flex-wrap items-center gap-2 font-semibold">
        <span className={`inline-flex h-2.5 w-2.5 rounded-full ${dotClass}`} aria-hidden="true" />
        <span>Kiểm tra sư phạm theo môn: {statusLabel}</span>
        <span className="rounded-full bg-white/70 px-2 py-0.5 text-xs font-bold">
          {audit.subject} · {audit.grade}
        </span>
        {audit.repairApplied ? <span className="rounded-full bg-white/70 px-2 py-0.5 text-xs font-bold">Đã repair</span> : null}
      </div>

      {audit.issues.length ? (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-5">
          {audit.issues.slice(0, 4).map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-xs leading-5 opacity-90">
          Giáo án đã có các tín hiệu sư phạm chính của môn. Checklist sâu vẫn nên được giáo viên đọc lại trước khi dạy thật.
        </p>
      )}

      {audit.checks.length ? (
        <details className="mt-2 text-xs">
          <summary className="cursor-pointer font-semibold">Xem checklist môn học</summary>
          <ul className="mt-1 list-disc space-y-1 pl-5 leading-5">
            {audit.checks.slice(0, 6).map((check) => (
              <li key={check}>{check}</li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}

function normalizeDraftGrade(grade?: string) {
  const trimmed = (grade || "").trim();
  if (!trimmed) return "";
  const numeric = trimmed.match(/^(\d)$/)?.[1];
  const normalized = numeric ? `Lớp ${numeric}` : trimmed;
  return gradeOptions.includes(normalized as (typeof gradeOptions)[number]) ? normalized : trimmed;
}

function normalizeDraftSubject(subject?: string) {
  const trimmed = (subject || "").trim();
  const aliases: Record<string, string> = {
    "Địa lý": "Lịch sử và Địa lí",
    "Địa lí": "Lịch sử và Địa lí",
    "Mỹ thuật": "Mĩ thuật",
    "Thể dục": "Giáo dục thể chất",
    "Tiếng Anh/Ngoại ngữ 1": "Tiếng Anh",
    "Ngoại ngữ 1": "Tiếng Anh",
  };
  const normalized = aliases[trimmed] || trimmed;
  return subjectOptions.includes(normalized) ? normalized : trimmed;
}

function normalizeDraftStyle(raw: Partial<LessonInput> & { qualityLevel?: string; creativeLessonMode?: boolean; customStyle?: string }): LessonStyle {
  const source = `${raw.style || ""} ${raw.qualityLevel || ""} ${raw.creativeLessonMode ? "sáng tạo" : ""} ${raw.customStyle || ""}`;
  if (/sáng tạo|sinh động|dự giờ|thi giảng|sáng tạo cao/i.test(source)) return "Sáng tạo, sinh động";
  if (/dạy thật|chi tiết|nhiều hoạt động|thực tế/i.test(source)) return "Dạy thật trên lớp";
  return "Cơ bản";
}

function migrateDraft(raw: unknown): LessonInput {
  const parsed = raw as Partial<LessonInput>;
  return {
    ...defaultLessonInput,
    subject: normalizeDraftSubject(parsed.subject),
    grade: normalizeDraftGrade(parsed.grade),
    lessonTitle: parsed.lessonTitle || "",
    book: parsed.book || "",
    bookVolume: parsed.bookVolume || "auto",
    periods: parsed.periods || defaultLessonInput.periods,
    duration: parsed.duration || defaultLessonInput.duration,
    hometownProvince: parsed.hometownProvince || "auto",
    localityNote: parsed.localityNote || "",
    studentProfile: parsed.studentProfile || "auto",
    teachingEnvironment: parsed.teachingEnvironment || "auto",
    facilities: parsed.facilities || "auto",
    style: normalizeDraftStyle(parsed),
    specialRequest: parsed.specialRequest || "",
    allowAiInference: parsed.allowAiInference ?? defaultLessonInput.allowAiInference,
    uploadedAssets: parsed.uploadedAssets || [],
  };
}

function serializableDraft(input: LessonInput): LessonInput {
  return {
    subject: input.subject,
    grade: input.grade,
    lessonTitle: input.lessonTitle,
    book: input.book,
    bookVolume: input.bookVolume,
    periods: input.periods,
    duration: input.duration,
    hometownProvince: input.hometownProvince,
    localityNote: input.localityNote,
    studentProfile: input.studentProfile,
    teachingEnvironment: input.teachingEnvironment,
    facilities: input.facilities,
    style: input.style,
    specialRequest: input.specialRequest,
    allowAiInference: input.allowAiInference,
    uploadedAssets: [],
  };
}

export default function Home() {
  const [input, setInput] = useState<LessonInput>(defaultLessonInput);
  const [lesson, setLesson] = useState<LessonPlan | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [generationError, setGenerationError] = useState("");
  const [toastMessage, setToastMessage] = useState("");
  const [modelRoutingNotice, setModelRoutingNotice] = useState<ModelRoutingNotice | null>(null);
  const [pedagogyAudit, setPedagogyAudit] = useState<PedagogyAudit | null>(null);
  const [user, setUser] = useState<AppUser | null>(null);
  const [authLoaded, setAuthLoaded] = useState(false);
  const [currentLessonId, setCurrentLessonId] = useState<string | null>(null);
  const [verificationMessage, setVerificationMessage] = useState("");
  const [verificationError, setVerificationError] = useState("");
  const [isSendingVerification, setIsSendingVerification] = useState(false);
  const [todayVisits, setTodayVisits] = useState<number | null>(null);
  const [ledMessages, setLedMessages] = useState(defaultBillboardMessages);
  const [ledDurationSeconds, setLedDurationSeconds] = useState(18);

  async function loadCurrentUser() {
    const response = await fetch("/api/auth/me");
    const result = (await response.json()) as { user: AppUser | null };
    setUser(result.user);
    setAuthLoaded(true);
  }

  useEffect(() => {
    loadCurrentUser().catch(() => setAuthLoaded(true));
    const saved = window.localStorage.getItem(DRAFT_KEY);
    if (saved) {
      try {
        setInput(migrateDraft(JSON.parse(saved)));
      } catch {
        window.localStorage.removeItem(DRAFT_KEY);
      }
    }
    setDraftLoaded(true);
  }, []);

  useEffect(() => {
    if (!draftLoaded) return;
    try {
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify(serializableDraft(input)));
    } catch {
      window.localStorage.removeItem(DRAFT_KEY);
    }
  }, [draftLoaded, input]);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = window.setTimeout(() => setToastMessage(""), 2600);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  useEffect(() => {
    async function loadLedSettings() {
      try {
        const response = await fetch("/api/settings/header-led");
        const result = (await response.json()) as { led?: { enabled?: boolean; messages?: unknown[]; durationSeconds?: number } };
        const data = result.led;
        if (!response.ok || !data) throw new Error("Không thể tải LED.");
        const messages = Array.isArray(data.messages)
          ? data.messages.map((item) => String(item || "").trim()).filter(Boolean)
          : [];
        setLedMessages(data.enabled === false ? ["EduPlan AI"] : messages.length ? messages : defaultBillboardMessages);
        setLedDurationSeconds(Math.min(120, Math.max(6, Number(data.durationSeconds || 18))));
      } catch {
        setLedMessages(defaultBillboardMessages);
        setLedDurationSeconds(18);
      }
    }
    void loadLedSettings();
    const timer = window.setInterval(loadLedSettings, 3000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!authLoaded || !user?.emailVerified) return;

    async function recordVisit() {
      const windowWithVisitFlag = window as typeof window & Record<typeof VISIT_COUNTED_KEY, boolean | undefined>;
      const method = windowWithVisitFlag[VISIT_COUNTED_KEY] ? "GET" : "POST";
      windowWithVisitFlag[VISIT_COUNTED_KEY] = true;

      try {
        const response = await fetch("/api/analytics/visit", { method });
        const result = (await response.json()) as { visits?: number };
        if (response.ok && typeof result.visits === "number") setTodayVisits(result.visits);
      } catch {
        setTodayVisits(null);
      }
    }

    void recordVisit();
  }, [authLoaded, user?.emailVerified]);

  function handleChange(next: LessonInput) {
    setInput(next);
    if (Object.keys(errors).length) setErrors(validateLessonInput(next));
  }

  async function handleGenerate() {
    const nextErrors = validateLessonInput(input);
    setErrors(nextErrors);
    if (hasBlockingErrors(nextErrors)) return;

    setIsGenerating(true);
    setGenerationError("");
    setModelRoutingNotice(null);
    setPedagogyAudit(null);

    try {
      const response = await fetch("/api/lesson/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const result = (await response.json()) as {
        lesson?: LessonPlan;
        lessonId?: string;
        error?: string;
        modelRouting?: ModelRoutingNotice & { fallbackUsed: boolean };
        pedagogyAudit?: PedagogyAudit;
      };
      if (!response.ok || !result.lesson) {
        throw new Error(result.error || "Không thể tạo giáo án lúc này.");
      }
      setLesson(result.lesson);
      setCurrentLessonId(result.lessonId || null);
      setModelRoutingNotice(result.modelRouting?.fallbackUsed ? result.modelRouting : null);
      setPedagogyAudit(result.pedagogyAudit || null);
      await loadCurrentUser();
      setToastMessage("Đã tạo và lưu giáo án vào lịch sử trong 7 ngày.");
    } catch (error) {
      setGenerationError(error instanceof Error ? error.message : "Không thể tạo giáo án lúc này.");
    } finally {
      setIsGenerating(false);
    }
  }

  function getA4Document() {
    return document.querySelector(".a4-document") as HTMLElement | null;
  }

  function safeFileName() {
    return (lesson?.generalInfo.lessonTitle || "giao-an-eduplan-ai").replace(/[\\/:*?"<>|]/g, "-").slice(0, 80);
  }

  async function handleExportPdf() {
    if (!lesson) return;
    try {
      const response = await fetch("/api/lesson/export-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lesson, fileName: safeFileName() }),
      });
      if (!response.ok) {
        const result = (await response.json()) as { error?: string };
        throw new Error(result.error || "Không thể xuất PDF lúc này.");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${safeFileName()}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setToastMessage("Đã tải file PDF xuống máy.");
    } catch (error) {
      setGenerationError(error instanceof Error ? error.message : "Không thể xuất PDF lúc này.");
    }
  }

  async function handleExportWord() {
    if (!lesson) return;
    await exportLessonToDocx(lesson, safeFileName());
    setToastMessage("Đã xuất file Word (.docx) có thể chỉnh sửa.");
  }

  async function handleRefine(action: RefineAction) {
    if (!lesson) return;
    setIsGenerating(true);
    setGenerationError("");
    try {
      const response = await fetch("/api/lesson/refine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lesson, action }),
      });
      const result = (await response.json()) as { lesson?: LessonPlan; error?: string };
      if (!response.ok || !result.lesson) throw new Error(result.error || "Không thể tinh chỉnh giáo án lúc này.");
      setLesson(result.lesson);
      setPedagogyAudit(null);
      await saveLessonDraft(result.lesson, currentLessonId);
      await loadCurrentUser();
      setToastMessage("Đã tinh chỉnh, lưu lịch sử và trừ 1 lượt tạo.");
    } catch (error) {
      setGenerationError(error instanceof Error ? error.message : "Không thể tinh chỉnh giáo án lúc này.");
    } finally {
      setIsGenerating(false);
    }
  }

  async function saveLessonDraft(nextLesson: LessonPlan, lessonId: string | null) {
    const response = await fetch("/api/lessons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lesson: nextLesson, lessonId }),
    });
    const result = (await response.json()) as { lessonId?: string; error?: string };
    if (!response.ok) throw new Error(result.error || "Không thể lưu giáo án.");
    if (result.lessonId) setCurrentLessonId(result.lessonId);
  }

  function handleOpenLesson(nextLesson: LessonPlan, lessonId: string) {
    setLesson(nextLesson);
    setCurrentLessonId(lessonId);
    setModelRoutingNotice(null);
    setPedagogyAudit(null);
    setToastMessage("Đã mở giáo án từ lịch sử.");
  }

  async function handleResendVerification() {
    setVerificationError("");
    setVerificationMessage("");
    if (!hasFirebaseClientConfig()) {
      setVerificationError("Thiếu Firebase Web App config nên chưa gửi được email xác minh.");
      return;
    }
    setIsSendingVerification(true);
    try {
      const current = getFirebaseClientAuth().currentUser;
      if (!current) throw new Error("Phiên Firebase đã hết hạn. Vui lòng đăng xuất rồi đăng nhập lại.");
      await sendEmailVerification(current, getEmailActionSettings());
      setVerificationMessage(`Đã gửi email xác minh tới ${user?.email || current.email}. Vui lòng kiểm tra Inbox, Spam hoặc Promotions.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error || "");
      if (/too-many-requests/i.test(message)) {
        setVerificationError("Firebase đang giới hạn gửi email do bấm quá nhiều lần. Vui lòng thử lại sau ít phút.");
      } else {
        setVerificationError(message || "Không thể gửi email xác minh lúc này.");
      }
    } finally {
      setIsSendingVerification(false);
    }
  }

  /* ── Loading auth ── */
  if (!authLoaded) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="animate-fade-in glass-card rounded-2xl px-8 py-6 text-center shadow-soft">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-[3px] border-brand-200 border-t-brand-600" />
          <p className="text-sm font-semibold text-slate-600">Đang kiểm tra phiên đăng nhập...</p>
        </div>
      </main>
    );
  }

  /* ── Not logged in ── */
  if (!user) {
    return <AuthPanel onSessionReady={loadCurrentUser} />;
  }

  /* ── Email not verified ── */
  if (!user.emailVerified) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="animate-scale-in w-full max-w-xl rounded-3xl border border-slate-100 bg-white p-8 text-center shadow-soft sm:p-10">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand-600">EduPlan AI</p>
          <h1 className="mt-3 text-2xl font-extrabold text-slate-900 sm:text-3xl">Vui lòng xác minh email</h1>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-slate-500">
            Tài khoản <strong className="text-slate-700">{user.email}</strong> cần xác minh email trước khi tạo giáo án. Sau khi bấm link trong email, quay lại đây và bấm kiểm tra lại.
          </p>
          {verificationError ? (
            <div className="animate-slide-up mx-auto mt-5 max-w-md rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold leading-5 text-red-700">{verificationError}</div>
          ) : null}
          {verificationMessage ? (
            <div className="animate-slide-up mx-auto mt-5 max-w-md rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold leading-5 text-emerald-700">{verificationMessage}</div>
          ) : null}
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <button className="btn-primary" onClick={loadCurrentUser}>Tôi đã xác minh</button>
            <button className="btn-secondary disabled:opacity-50" disabled={isSendingVerification} onClick={handleResendVerification}>
              {isSendingVerification ? "Đang gửi..." : "Gửi lại email xác minh"}
            </button>
            <button className="btn-ghost text-slate-600" onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); window.location.reload(); }}>Đăng xuất</button>
          </div>
        </div>
      </main>
    );
  }

  /* ── Main app ── */
  return (
    <main className="app-shell min-h-screen px-3 pb-5 sm:px-4 lg:px-5 xl:h-screen xl:overflow-hidden xl:pb-0">
      <div className="mx-auto max-w-[1680px] xl:flex xl:h-full xl:flex-col">

        {/* ── HEADER ── */}
        <div className="sticky top-0 z-50 mb-3 shrink-0 py-2.5">
          <div className="glass-card overflow-visible rounded-2xl shadow-sm">
            <div className="relative grid gap-2.5 p-2.5 lg:grid-cols-[minmax(0,1fr)_220px_auto] lg:items-center xl:grid-cols-[minmax(0,1fr)_240px_auto]">
              {/* Billboard LED */}
              <div className="billboard-sign" style={{ "--billboard-duration": `${ledDurationSeconds}s` } as CSSProperties}>
                <div className="billboard-track" aria-live="polite">
                  <span className="billboard-led-text">{ledMessages.join("   •   ")}</span>
                </div>
              </div>

              {/* Visit counter */}
              <div className="flex min-h-[44px] items-center gap-3 rounded-xl border border-slate-100 bg-white px-3.5 py-2 shadow-sm transition-all duration-200 hover:shadow-md">
                <div className="relative">
                  <span className="block h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400 opacity-40" />
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Truy cập hôm nay</p>
                  <p className="text-base font-extrabold leading-tight text-slate-900">
                    {todayVisits === null ? "..." : todayVisits.toLocaleString("vi-VN")}{" "}
                    <span className="text-[11px] font-medium text-slate-400">lượt</span>
                  </p>
                </div>
              </div>

              {/* User menu */}
              <UserMenu user={user} onUserChange={loadCurrentUser} onOpenLesson={handleOpenLesson} />
            </div>
          </div>
        </div>

        {/* ── BODY: Form + Preview ── */}
        <div className="grid gap-4 xl:min-h-0 xl:flex-1 xl:grid-cols-[420px_1fr] xl:gap-5 xl:overflow-hidden">
          {/* Left: Form */}
          <div className="xl:min-h-0 xl:overflow-hidden xl:pr-1">
            <LessonForm input={input} errors={errors} isGenerating={isGenerating} onChange={handleChange} onGenerate={handleGenerate} />
          </div>

          {/* Right: Preview */}
          <div className="fixed-preview-pane xl:flex xl:min-h-0 xl:flex-col xl:overflow-hidden">
            {/* Error banner */}
            {generationError ? (
              <div className="toast-banner mb-2.5 shrink-0 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold leading-5 text-red-700 shadow-sm">
                {generationError}
              </div>
            ) : null}

            {/* Model routing notice */}
            {modelRoutingNotice ? (
              <div className="toast-banner mb-2.5 shrink-0 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold leading-5 text-amber-800 shadow-sm" role="status">
                Model chính <strong>{modelRoutingNotice.primaryModel}</strong> tạm thời không khả dụng. Hệ thống đã chuyển sang model dự phòng <strong>{modelRoutingNotice.modelUsed}</strong> để hoàn tất giáo án.
              </div>
            ) : null}

            <PedagogyAuditCard audit={pedagogyAudit} />

            {/* Success toast */}
            {toastMessage ? (
              <div className="toast-banner mb-2.5 shrink-0 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 shadow-sm">
                {toastMessage}
              </div>
            ) : null}

            {/* Toolbar */}
            <PreviewToolbar disabled={!lesson} isGenerating={isGenerating} onRefine={handleRefine} onExportWord={handleExportWord} onExportPdf={handleExportPdf} />

            {/* Preview */}
            <div className="xl:min-h-0 xl:flex-1 xl:overflow-hidden">
              <LessonPreview lesson={lesson} isGenerating={isGenerating} />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
