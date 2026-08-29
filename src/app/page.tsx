"use client";

import { useEffect, useRef, useState } from "react";
import { sendEmailVerification } from "firebase/auth";
import { AuthPanel } from "@/components/auth-panel";
import { GenerationProgressCard } from "@/components/generation-progress-card";
import { GuideModal } from "@/components/guide-modal";
import { IntroductionModal } from "@/components/introduction-modal";
import { LessonForm } from "@/components/lesson-form";
import { LessonPreview } from "@/components/lesson-preview";
import { PedagogyAuditCard } from "@/components/pedagogy-audit-card";
import { PreviewToolbar } from "@/components/preview-toolbar";
import { type AppUser, UserMenu } from "@/components/user-menu";
import { defaultLessonInput, gradeOptions, subjectOptions } from "@/lib/defaults";
import { exportLessonToDocx } from "@/lib/export-docx";
import { accountBlockedMessage } from "@/lib/account-block";
import { getEmailActionSettings, getFirebaseClientAuth, hasFirebaseClientConfig } from "@/lib/firebase-client";
import { hasBlockingErrors, validateLessonInput } from "@/lib/lesson-validation";
import { MAX_GENERATION_REQUEST_BYTES, serializeGenerationInput } from "@/lib/client-image-processing";
import {
  clearActiveStagedGeneration,
  readActiveStagedGeneration,
  saveActiveStagedGeneration,
} from "@/lib/generation/client-job-storage";
import {
  StagedGenerationTerminalError,
  cancelStagedGenerationJobClient,
  resumeStagedGeneration,
  startStagedGeneration,
  type ClientGenerationJob,
  type StagedGenerationResult,
} from "@/lib/generation/client-orchestrator";
import {
  configuredClientGenerationPipelineMode,
  loadEffectiveClientGenerationPipelineMode,
} from "@/lib/generation/client-pipeline-mode";
import { lessonNeedsAdjustment } from "@/lib/lesson-validation-status";
import type { FormErrors, LessonInput, LessonPlan, LessonStyle, PedagogyAudit } from "@/types/lesson";

const DRAFT_KEY = "eduplan-ai.lesson-input.v1";
const ZALO_SUPPORT_GROUP_URL = "https://zalo.me/g/iunsqm93yttvc2wx99cq";
const SUPPORT_PHONE = "0342733640";
const SUPPORT_ZALO_URL = `https://zalo.me/${SUPPORT_PHONE}`;
const VISIT_COUNTED_KEY = "__eduplanVisitCountedForLoad";
const CLIENT_GENERATION_PIPELINE_MODE = configuredClientGenerationPipelineMode();


function generationUsageLabel(user: AppUser) {
  const { activePlan, planStatus, cards, free, credits, trials } = user.subscription;
  const planName = activePlan === "plus" ? "Trả phí" : "Miễn phí";

  if (activePlan === "free") {
    return `Miễn phí · dùng 1 lượt (còn ${free.remaining} hôm nay)`;
  }

  if (planStatus === "trial") {
    const remaining = trials.plusRemaining;
    return `Dùng thử ${planName} · dùng 1 lượt (còn ${remaining})`;
  }

  const activeCard = cards.find((card) => card.id === activePlan);
  if (planStatus === "paid" && activeCard) {
    return `Gói ${planName} · ${activeCard.generationCost} tín dụng (còn ${credits.total})`;
  }

  return `Gói ${planName} hiện không khả dụng`;
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
    enableDigitalCompetency: parsed.enableDigitalCompetency ?? defaultLessonInput.enableDigitalCompetency,
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
    enableDigitalCompetency: input.enableDigitalCompetency,
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
  const [pedagogyAudit, setPedagogyAudit] = useState<PedagogyAudit | null>(null);
  const [user, setUser] = useState<AppUser | null>(null);
  const [authLoaded, setAuthLoaded] = useState(false);
  const [verificationMessage, setVerificationMessage] = useState("");
  const [verificationError, setVerificationError] = useState("");
  const [isSendingVerification, setIsSendingVerification] = useState(false);
  const [todayVisits, setTodayVisits] = useState<number | null>(null);
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const [isIntroVisible, setIsIntroVisible] = useState(false);
  const [isGuideVisible, setIsGuideVisible] = useState(false);
  const [generationJob, setGenerationJob] = useState<ClientGenerationJob | null>(null);
  const [isCancellingGeneration, setIsCancellingGeneration] = useState(false);
  const [generationPipelineMode, setGenerationPipelineMode] = useState<"legacy" | "staged">("legacy");
  const [pipelineConfigLoaded, setPipelineConfigLoaded] = useState(
    CLIENT_GENERATION_PIPELINE_MODE === "legacy",
  );
  const generationRunnerRef = useRef<AbortController | null>(null);
  const resumedUserRef = useRef<string | null>(null);

  async function loadCurrentUser() {
    try {
      const response = await fetch("/api/auth/me", { cache: "no-store" });
      const result = (await response.json()) as { user?: AppUser | null; error?: string };
      if (!response.ok) throw new Error(result.error || "Không thể đồng bộ tài khoản.");
      setUser(result.user ?? null);
    } finally {
      setAuthLoaded(true);
    }
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

  useEffect(() => {
    if (!user?.uid || user.disabled) return;

    const sendHeartbeat = () => {
      if (document.visibilityState !== "visible") return;
      void fetch("/api/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state: "online" }),
        cache: "no-store",
        keepalive: true,
      }).catch(() => undefined);
    };

    sendHeartbeat();
    const interval = window.setInterval(sendHeartbeat, 60_000);
    document.addEventListener("visibilitychange", sendHeartbeat);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", sendHeartbeat);
    };
  }, [user?.uid, user?.disabled]);

  function handleChange(next: LessonInput) {
    setInput(next);
    if (Object.keys(errors).length) setErrors(validateLessonInput(next));
  }

  function isTerminalGenerationJob(job: ClientGenerationJob) {
    return job.status === "completed" || job.status === "failed" || job.status === "cancelled";
  }

  function handleStagedJobUpdate(job: ClientGenerationJob) {
    setGenerationJob(job);
    if (!user) return;
    if (isTerminalGenerationJob(job)) {
      clearActiveStagedGeneration(user.uid, job.id);
    } else {
      saveActiveStagedGeneration(user.uid, job);
    }
  }

  async function finishStagedGeneration(result: StagedGenerationResult) {
    setGenerationJob(result.job);
    setLesson(result.lesson);
    setPedagogyAudit(null);
    if (user) clearActiveStagedGeneration(user.uid, result.job.id);
    await loadCurrentUser();
    setToastMessage(lessonNeedsAdjustment(result.lesson)
      ? "Đã tạo và lưu bản nháp cần điều chỉnh vào lịch sử trong 7 ngày."
      : "Đã tạo và lưu giáo án vào lịch sử trong 7 ngày.");
  }

  async function handleResumeStagedGeneration(jobId: string) {
    if (!user || generationRunnerRef.current) return;
    const controller = new AbortController();
    generationRunnerRef.current = controller;
    setIsGenerating(true);
    setGenerationError("");

    try {
      const token = await getFirebaseClientAuth().currentUser?.getIdToken();
      if (!token) throw new Error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
      const result = await resumeStagedGeneration({
        jobId,
        authToken: token,
        ocrAssets: input.uploadedAssets,
        signal: controller.signal,
        onJob: handleStagedJobUpdate,
      });
      await finishStagedGeneration(result);
    } catch (error) {
      if (controller.signal.aborted) return;
      if (error instanceof StagedGenerationTerminalError) {
        handleStagedJobUpdate(error.job);
      }
      setGenerationError(error instanceof Error ? error.message : "Không thể tiếp tục tạo giáo án.");
    } finally {
      if (generationRunnerRef.current === controller) generationRunnerRef.current = null;
      setIsGenerating(false);
    }
  }

  async function handleCancelStagedGeneration() {
    if (!user || !generationJob || isTerminalGenerationJob(generationJob)) return;
    setIsCancellingGeneration(true);
    generationRunnerRef.current?.abort();
    generationRunnerRef.current = null;
    try {
      const token = await getFirebaseClientAuth().currentUser?.getIdToken();
      if (!token) throw new Error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
      const cancelled = await cancelStagedGenerationJobClient(generationJob.id, {
        authToken: token,
      });
      handleStagedJobUpdate(cancelled);
      clearActiveStagedGeneration(user.uid, generationJob.id);
      setGenerationError("");
      setToastMessage("Đã hủy yêu cầu và hoàn lại lượt sử dụng.");
      await loadCurrentUser();
    } catch (error) {
      setGenerationError(error instanceof Error ? error.message : "Không thể hủy yêu cầu tạo giáo án.");
    } finally {
      setIsGenerating(false);
      setIsCancellingGeneration(false);
    }
  }

  useEffect(() => {
    return () => generationRunnerRef.current?.abort();
  }, []);

  useEffect(() => {
    if (CLIENT_GENERATION_PIPELINE_MODE !== "staged") {
      setGenerationPipelineMode("legacy");
      setPipelineConfigLoaded(true);
      return;
    }
    if (!user?.emailVerified || user.disabled) {
      setGenerationPipelineMode("legacy");
      setPipelineConfigLoaded(false);
      return;
    }

    const controller = new AbortController();
    setPipelineConfigLoaded(false);
    void loadEffectiveClientGenerationPipelineMode({
      publicMode: CLIENT_GENERATION_PIPELINE_MODE,
      signal: controller.signal,
    }).then((mode) => {
      if (controller.signal.aborted) return;
      setGenerationPipelineMode(mode);
      setPipelineConfigLoaded(true);
      if (mode === "legacy") setGenerationJob(null);
    });
    return () => controller.abort();
  }, [user?.uid, user?.emailVerified, user?.disabled]);

  useEffect(() => {
    if (generationPipelineMode !== "staged" || !pipelineConfigLoaded) return;
    if (!user) {
      resumedUserRef.current = null;
      return;
    }
    if (!user.emailVerified || user.disabled || resumedUserRef.current === user.uid) return;
    resumedUserRef.current = user.uid;
    const stored = readActiveStagedGeneration(user.uid);
    if (!stored) return;
    setGenerationJob(stored.job);
    if (isTerminalGenerationJob(stored.job)) {
      clearActiveStagedGeneration(user.uid, stored.job.id);
      return;
    }
    void handleResumeStagedGeneration(stored.job.id);
  }, [generationPipelineMode, pipelineConfigLoaded, user]);

  async function handleGenerate() {
    if (generationRunnerRef.current) return;
    if (CLIENT_GENERATION_PIPELINE_MODE === "staged" && !pipelineConfigLoaded) {
      setGenerationError("Đang tải cấu hình quy trình tạo giáo án. Vui lòng thử lại sau giây lát.");
      return;
    }
    const nextErrors = validateLessonInput(input);
    setErrors(nextErrors);
    if (hasBlockingErrors(nextErrors)) return;
    if (!user) {
      setGenerationError("Vui lòng đăng nhập trước khi tạo giáo án.");
      return;
    }

    setIsGenerating(true);
    setGenerationError("");
    setPedagogyAudit(null);
    if (generationPipelineMode === "legacy") setGenerationJob(null);
    let stagedController: AbortController | null = null;

    try {
      const auth = getFirebaseClientAuth();
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
      const requestId = typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `generate-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const { payload, bytes: payloadBytes } = serializeGenerationInput(input);
      if (payloadBytes > MAX_GENERATION_REQUEST_BYTES) {
        throw new Error("Tổng dung lượng ảnh SGK vẫn quá lớn. Vui lòng xóa bớt ảnh hoặc chụp gần phần nội dung bài học hơn.");
      }
      if (generationPipelineMode === "staged") {
        stagedController = new AbortController();
        generationRunnerRef.current = stagedController;
        const result = await startStagedGeneration({
          payload,
          idempotencyKey: requestId,
          authToken: token,
          signal: stagedController.signal,
          onJob: handleStagedJobUpdate,
        });
        await finishStagedGeneration(result);
        return;
      }
      const response = await fetch("/api/lesson/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, "Idempotency-Key": requestId },
        body: payload,
      });
      const responseText = await response.text();
      let result: {
        error?: string;
        lesson?: LessonPlan;
        pedagogyAudit?: PedagogyAudit;
      } = {};
      if (responseText) {
        try {
          result = JSON.parse(responseText) as typeof result;
        } catch {
          const timedOut = response.status === 504 || /timeout|timed out|an error occurred/i.test(responseText);
          result = {
            error: response.status === 413
              ? "Ảnh SGK vượt giới hạn dung lượng máy chủ. Vui lòng xóa bớt ảnh hoặc tải lại ảnh để hệ thống tối ưu rồi thử lại."
              : timedOut
                ? "Máy chủ đã hết thời gian xử lý giáo án. Lượt sử dụng không bị tính; vui lòng thử lại."
                : `Máy chủ trả phản hồi không hợp lệ (HTTP ${response.status}). Vui lòng tải lại trang và thử lại.`,
          };
        }
      }
      if (!response.ok || !result.lesson) {
        throw new Error(result.error || `Không thể tạo giáo án (HTTP ${response.status}).`);
      }
      setLesson(result.lesson);
      setPedagogyAudit(result.pedagogyAudit || null);
      await loadCurrentUser();
      setToastMessage("Đã tạo và lưu giáo án vào lịch sử trong 7 ngày.");
    } catch (error) {
      if (stagedController?.signal.aborted) return;
      if (error instanceof StagedGenerationTerminalError) {
        handleStagedJobUpdate(error.job);
      }
      setGenerationError(error instanceof Error ? error.message : "Không thể tạo giáo án lúc này.");
    } finally {
      if (generationRunnerRef.current === stagedController) generationRunnerRef.current = null;
      setIsGenerating(false);
    }
  }


  function safeFileName() {
    return (lesson?.generalInfo.lessonTitle || "giao-an-eduplan-ai").replace(/[\\/:*?"<>|]/g, "-").slice(0, 80);
  }

  async function handleExportWord() {
    if (!lesson) return;
    try {
      await exportLessonToDocx(lesson, safeFileName());
      setGenerationError("");
      setToastMessage("Đã xuất file Word (.docx) có thể chỉnh sửa.");
    } catch (error) {
      setGenerationError(error instanceof Error ? error.message : "Không thể xuất file Word lúc này.");
    }
  }

  function handleOpenLesson(nextLesson: LessonPlan, _lessonId: string) {
    setLesson(nextLesson);
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

  function openFeedbackWidget() {
    setIsSupportOpen(false);
    setIsIntroVisible(false);
    window.dispatchEvent(new Event("eduplan:open-feedback"));
  }

  function openGuide() {
    setIsSupportOpen(false);
    setIsIntroVisible(false);
    setIsGuideVisible(true);
  }

  function goHome() {
    setIsSupportOpen(false);
    setIsIntroVisible(false);
    setIsGuideVisible(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openIntro() {
    setIsSupportOpen(false);
    setIsGuideVisible(false);
    setIsIntroVisible(true);
    window.requestAnimationFrame(() => {
      document.getElementById("gioi-thieu")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
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

  /* ── Account disabled ── */
  if (user.disabled) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="animate-scale-in w-full max-w-xl rounded-3xl border border-red-100 bg-white p-8 text-center shadow-soft sm:p-10">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-red-600">EduPlan AI</p>
          <h1 className="mt-3 text-2xl font-extrabold text-slate-900 sm:text-3xl">Tài khoản đã bị khóa</h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-500">
            {accountBlockedMessage(user.blockedReason, user.blockedReasonDetail)}
          </p>
          <button className="btn-secondary mt-7" onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); window.location.reload(); }}>Đăng xuất</button>
        </div>
      </main>
    );
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
    <main className="app-shell min-h-screen px-3 pb-5 pt-[86px] sm:px-4 sm:pt-[90px] lg:px-5 xl:h-screen xl:overflow-hidden xl:pb-0">
      <div className="mx-auto max-w-[1680px] xl:flex xl:h-full xl:flex-col">

        {/* ── HEADER ── */}
        <header className="app-topbar">
          <div className="app-topbar-inner">
            <button type="button" className="app-brand-mark" onClick={goHome} aria-label="Về trang chủ EduPlan AI">
              <span>EduPlan AI</span>
              <small>Soạn giáo án</small>
            </button>

            <nav className="support-nav" aria-label="Thanh điều hướng EduPlan AI">
              <button type="button" className={`support-nav-item ${!isIntroVisible && !isGuideVisible ? "support-nav-active" : ""}`} title="Trang chủ là giao diện soạn giáo án" onClick={goHome}>
                Trang chủ
              </button>
              <button type="button" className={`support-nav-item ${isIntroVisible ? "support-nav-active" : ""}`} title="Giới thiệu EduPlan AI" onClick={openIntro}>
                Giới thiệu
              </button>
              <button type="button" className={`support-nav-item ${isGuideVisible ? "support-nav-active" : ""}`} title="Xem hướng dẫn sử dụng EduPlan AI" onClick={openGuide}>
                Hướng dẫn
              </button>
              <div className="support-menu-wrap">
                <button
                  type="button"
                  className="support-nav-item support-menu-button"
                  aria-haspopup="menu"
                  aria-expanded={isSupportOpen}
                  onClick={() => setIsSupportOpen((current) => !current)}
                >
                  Hỗ trợ
                </button>
                {isSupportOpen ? (
                  <div className="support-menu-popover" role="menu" aria-label="Hỗ trợ EduPlan AI">
                    <p>Hỗ trợ nhanh</p>
                    <a href={ZALO_SUPPORT_GROUP_URL} target="_blank" rel="noreferrer" role="menuitem">
                      <strong>Nhóm Zalo hỗ trợ</strong>
                      <span>Cộng đồng hỗ trợ sử dụng tool</span>
                    </a>
                    <a href={`tel:${SUPPORT_PHONE}`} role="menuitem">
                      <strong>Gọi trực tiếp</strong>
                      <span>{SUPPORT_PHONE}</span>
                    </a>
                    <a href={SUPPORT_ZALO_URL} target="_blank" rel="noreferrer" role="menuitem">
                      <strong>Zalo cá nhân</strong>
                      <span>{SUPPORT_PHONE}</span>
                    </a>
                    <button type="button" role="menuitem" onClick={openFeedbackWidget}>
                      <strong>Gửi góp ý</strong>
                      <span>Mở hòm thư phản hồi</span>
                    </button>
                  </div>
                ) : null}
              </div>
            </nav>

            <div className="app-topbar-actions">
              <div className="app-visit-pill">
                <div className="relative">
                  <span className="block h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400 opacity-40" />
                </div>
                <div>
                  <p>Truy cập hôm nay</p>
                  <strong>
                    {todayVisits === null ? "..." : todayVisits.toLocaleString("vi-VN")}{" "}
                    <span>lượt</span>
                  </strong>
                </div>
              </div>

              <UserMenu user={user} onUserChange={loadCurrentUser} onOpenLesson={handleOpenLesson} />
            </div>
          </div>
        </header>

        <IntroductionModal isOpen={isIntroVisible} onClose={() => setIsIntroVisible(false)} />
        <GuideModal isOpen={isGuideVisible} onClose={() => setIsGuideVisible(false)} />

        {/* ── BODY: Form + Preview ── */}
        <div className="grid gap-4 xl:min-h-0 xl:flex-1 xl:grid-cols-[420px_1fr] xl:gap-5 xl:overflow-hidden">
          {/* Left: Form */}
          <div className="xl:min-h-0 xl:overflow-hidden xl:pr-1">
            <LessonForm
              input={input}
              errors={errors}
              isGenerating={isGenerating}
              generationUsageLabel={generationUsageLabel(user)}
              onChange={handleChange}
              onGenerate={handleGenerate}
            />
          </div>

          {/* Right: Preview */}
          <div className="fixed-preview-pane xl:flex xl:min-h-0 xl:flex-col xl:overflow-hidden">
            {/* Error banner */}
            {generationError ? (
              <div className="toast-banner mb-2.5 shrink-0 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold leading-5 text-red-700 shadow-sm">
                {generationError}
              </div>
            ) : null}

            {generationPipelineMode === "staged" && generationJob ? (
              <GenerationProgressCard
                job={generationJob}
                isActive={isGenerating}
                isCancelling={isCancellingGeneration}
                onResume={() => { void handleResumeStagedGeneration(generationJob.id); }}
                onCancel={() => { void handleCancelStagedGeneration(); }}
              />
            ) : null}

            {lesson && !isGenerating ? (
              <div className="mb-2.5 shrink-0">
                <PreviewToolbar onExportWord={handleExportWord} inline />
              </div>
            ) : null}

            <PedagogyAuditCard audit={pedagogyAudit} />

            {/* Success toast */}
            {toastMessage ? (
              <div className="toast-banner mb-2.5 shrink-0 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 shadow-sm">
                {toastMessage}
              </div>
            ) : null}

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
