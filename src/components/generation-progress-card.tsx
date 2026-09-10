"use client";

import React from "react";
import {
  isJobBlockedByNonRetryableError,
  type ClientGenerationJob,
} from "@/lib/generation/client-orchestrator";

type GenerationProgressCardProps = {
  job: ClientGenerationJob;
  isActive: boolean;
  isCancelling: boolean;
  onResume: () => void;
  onCancel: () => void;
};

const stageLabels: Record<string, string> = {
  initialize: "Chuẩn bị dữ liệu",
  ocr: "Đọc nội dung ảnh SGK",
  "source-preparation": "Chuẩn hóa dữ liệu nguồn",
  "source-facts": "Trích xuất sự kiện & ngữ cảnh nguồn",
  blueprint: "Thiết kế khung giáo án",
  "lesson-map": "Lập bản đồ bài học",
  "section-outcomes": "Xác định mục tiêu & yêu cầu cần đạt",
  "section-materials": "Soạn thiết bị & học liệu",
  "period-blueprint": "Thiết kế khung từng tiết",
  "period-phase": "Soạn chi tiết hoạt động từng tiết",
  "period-generation": "Soạn từng tiết học",
  "section-assessment": "Soạn hồ sơ đánh giá",
  assembly: "Ghép toàn bộ giáo án",
  "subject-validation": "Kiểm tra chất lượng theo môn",
  repair: "Sửa các nội dung chưa đạt",
  "phase-repair": "Tinh chỉnh từng hoạt động chưa đạt",
  "final-validation": "Kiểm tra cuối",
  persistence: "Lưu giáo án",
  "quota-settlement": "Xác nhận lượt sử dụng",
  completed: "Hoàn tất",
};

const phaseNames: Record<string, string> = {
  warmup: "Khởi động",
  explore: "Khám phá",
  practice: "Luyện tập",
  apply: "Vận dụng",
};

const defaultPhaseIndexNames = [
  "Khởi động",
  "Khám phá",
  "Luyện tập",
  "Vận dụng",
];

function resolvePhaseLabel(job: ClientGenerationJob): string | null {
  if (job.currentStage === "period-phase" || job.currentStage === "phase-repair") {
    if (job.stageCursor.total > 0 && job.stageCursor.position < job.stageCursor.total) {
      const phaseMod = Math.abs(job.stageCursor.position % 4);
      return defaultPhaseIndexNames[phaseMod] || `Hoạt động ${phaseMod + 1}`;
    }
  }
  if (job.progress.currentPhase) {
    return phaseNames[job.progress.currentPhase] || job.progress.currentPhase;
  }
  return null;
}

function resolvePeriodIndex(job: ClientGenerationJob): number | null {
  if (job.currentStage === "period-phase" || job.currentStage === "phase-repair") {
    if (job.stageCursor.total > 0 && job.stageCursor.position < job.stageCursor.total) {
      return Math.floor(job.stageCursor.position / 4) + 1;
    }
  }
  if (typeof job.progress.currentPeriod === "number" && job.progress.currentPeriod > 0) {
    return job.progress.currentPeriod;
  }
  return null;
}

function isTerminal(job: ClientGenerationJob) {
  return job.status === "completed" || job.status === "failed" || job.status === "cancelled";
}

export function GenerationProgressCard({
  job,
  isActive,
  isCancelling,
  onResume,
  onCancel,
}: GenerationProgressCardProps) {
  const terminal = isTerminal(job);
  const percent = Math.min(100, Math.max(0, Math.round(job.progress.percent)));
  const isNonRetryable = isJobBlockedByNonRetryableError(job);
  const isFailed = job.status === "failed" || isNonRetryable;
  const tone = isFailed
    ? "border-red-200 bg-red-50"
    : job.status === "cancelled"
      ? "border-slate-200 bg-slate-50"
      : "border-brand-200 bg-gradient-to-r from-brand-50 to-white";

  const periodIndex = resolvePeriodIndex(job);
  const phaseLabel = resolvePhaseLabel(job);
  const stageName = stageLabels[job.currentStage] || job.currentStage;
  const isOcrPending = job.currentStage === "ocr" && job.stageCursor.position < job.stageCursor.total;

  return (
    <section className={"mb-2.5 shrink-0 rounded-2xl border px-4 py-3.5 shadow-sm " + tone} aria-live="polite">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.15em] text-brand-600 shadow-sm">
              Quy trình nhiều bước ({job.pipelineVersion || "staged"})
            </span>
            <span className="text-xs font-bold text-slate-700">{stageName}</span>
            {periodIndex ? (
              <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                Tiết {periodIndex}{job.progress.totalPeriods ? `/${job.progress.totalPeriods}` : ""}
              </span>
            ) : null}
            {phaseLabel ? (
              <span className="rounded bg-brand-100 px-2 py-0.5 text-xs font-semibold text-brand-700">
                {phaseLabel}
              </span>
            ) : null}
          </div>

          <p className="mt-2 text-sm font-semibold leading-5 text-slate-700">{job.progress.message}</p>

          {job.error ? (
            <div className="mt-1.5 rounded-lg border border-red-200 bg-red-100/60 px-2.5 py-1.5 text-xs font-medium text-red-800">
              <span className="font-bold">Lỗi ({job.error.code}): </span>
              <span>{job.error.message}</span>
              {isNonRetryable ? (
                <span className="ml-1 block text-[11px] text-red-700">
                  Bước này đã đạt giới hạn thử lại tự động hoặc gặp lỗi chặn. Bạn có thể hủy yêu cầu để điểm lưu hoàn trả lượt sử dụng đã đặt trước nếu chưa hoàn thành giáo án.
                </span>
              ) : null}
            </div>
          ) : null}

          {/* Background worker / OCR preservation notice */}
          {!terminal ? (
            <p className="mt-2 text-[11px] leading-4 text-slate-500">
              Lưu ý: Đóng tab trình duyệt sẽ ngắt lượt gửi yêu cầu từ máy của bạn. Khi mở lại, tiến trình sẽ tiếp tục từ trạm lưu hợp lệ gần nhất.
              {isOcrPending ? " Nếu đang xử lý ảnh SGK, có thể cần giữ nguyên hoặc tải lại ảnh SGK tương ứng." : ""}
            </p>
          ) : null}
        </div>
        <span className="text-lg font-black tabular-nums text-brand-700">{percent}%</span>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white shadow-inner">
        <div
          className="h-full rounded-full bg-gradient-to-r from-brand-500 via-brand-400 to-emerald-500 transition-[width] duration-500"
          style={{ width: percent + "%" }}
        />
      </div>

      {!terminal ? (
        <div className="mt-3 flex flex-wrap justify-end gap-2">
          {!isActive && !isNonRetryable ? (
            <button type="button" className="btn-primary px-4 py-2 text-xs" onClick={onResume}>
              Tiếp tục tiến trình
            </button>
          ) : null}
          <button
            type="button"
            className="btn-secondary px-4 py-2 text-xs disabled:opacity-50"
            disabled={isCancelling}
            onClick={onCancel}
          >
            {isCancelling ? "Đang hủy..." : "Hủy yêu cầu"}
          </button>
        </div>
      ) : null}
    </section>
  );
}
