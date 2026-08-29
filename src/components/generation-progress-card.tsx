"use client";

import type { ClientGenerationJob } from "@/lib/generation/client-orchestrator";

type GenerationProgressCardProps = {
  job: ClientGenerationJob;
  isActive: boolean;
  isCancelling: boolean;
  onResume: () => void;
  onCancel: () => void;
};

const stageLabels: Record<ClientGenerationJob["currentStage"], string> = {
  initialize: "Chuẩn bị dữ liệu",
  ocr: "Đọc nội dung ảnh SGK",
  "source-preparation": "Chuẩn hóa dữ liệu nguồn",
  blueprint: "Thiết kế khung giáo án",
  "period-generation": "Soạn từng tiết học",
  assembly: "Ghép toàn bộ giáo án",
  "subject-validation": "Kiểm tra chất lượng theo môn",
  repair: "Sửa các nội dung chưa đạt",
  "final-validation": "Kiểm tra cuối",
  persistence: "Lưu giáo án",
  "quota-settlement": "Xác nhận lượt sử dụng",
  completed: "Hoàn tất",
};

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
  const tone = job.status === "failed"
    ? "border-red-200 bg-red-50"
    : job.status === "cancelled"
      ? "border-slate-200 bg-slate-50"
      : "border-brand-200 bg-gradient-to-r from-brand-50 to-white";

  return (
    <section className={"mb-2.5 shrink-0 rounded-2xl border px-4 py-3.5 shadow-sm " + tone} aria-live="polite">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.15em] text-brand-600 shadow-sm">
              Quy trình nhiều bước
            </span>
            <span className="text-xs font-bold text-slate-700">{stageLabels[job.currentStage]}</span>
            {job.progress.currentPeriod ? (
              <span className="text-xs font-semibold text-slate-500">
                Tiết {job.progress.currentPeriod}/{job.progress.totalPeriods}
              </span>
            ) : null}
          </div>
          <p className="mt-2 text-sm font-semibold leading-5 text-slate-700">{job.progress.message}</p>
          {job.error ? (
            <p className="mt-1.5 text-xs font-semibold text-red-700">{job.error.message}</p>
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
          {!isActive ? (
            <button type="button" className="btn-primary px-4 py-2 text-xs" onClick={onResume}>
              Tiếp tục
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
