import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { GenerationProgressCard } from "./generation-progress-card";
import type { ClientGenerationJob } from "@/lib/generation/client-orchestrator";

function makeJob(overrides: Partial<ClientGenerationJob> = {}): ClientGenerationJob {
  return {
    id: "job-123",
    schemaVersion: 1,
    pipelineVersion: "staged-v2",
    status: "waiting_next_step",
    currentStage: "period-phase",
    progress: {
      percent: 45,
      message: "Đang soạn hoạt động Luyện tập.",
      completedUnits: 9,
      totalUnits: 20,
      currentPeriod: 2,
      totalPeriods: 3,
      currentPhase: "practice",
    },
    stageCursor: { position: 6, total: 12 },
    attempt: 1,
    inputSummary: {
      subject: "Toán",
      grade: "Lớp 4",
      lessonTitle: "Góc nhọn, góc tù",
      periods: 3,
      assetCount: 1,
    },
    lessonId: null,
    error: null,
    createdAt: "2026-09-10T00:00:00.000Z",
    updatedAt: "2026-09-10T00:00:00.000Z",
    expiresAt: "2026-09-17T00:00:00.000Z",
    ...overrides,
  };
}

describe("GenerationProgressCard", () => {
  it("renders stage label, period, and phase information for staged-v2", () => {
    const markup = renderToStaticMarkup(
      <GenerationProgressCard
        job={makeJob()}
        isActive={false}
        isCancelling={false}
        onResume={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(markup).toContain("Soạn chi tiết hoạt động từng tiết");
    expect(markup).toContain("Tiết 2/3");
    expect(markup).toContain("Luyện tập");
    expect(markup).toContain("Quy trình nhiều bước (staged-v2)");
    expect(markup).toContain("Tiếp tục tiến trình");
  });

  it("derives period and phase from cursor position when missing in progress", () => {
    const fallbackJob = makeJob({
      progress: {
        percent: 30,
        message: "Đang soạn hoạt động.",
        completedUnits: 6,
        totalUnits: 20,
        currentPeriod: null,
        totalPeriods: 3,
      },
      stageCursor: { position: 5, total: 12 },
    });

    const markup = renderToStaticMarkup(
      <GenerationProgressCard
        job={fallbackJob}
        isActive={false}
        isCancelling={false}
        onResume={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(markup).toContain("Tiết 2/3");
    expect(markup).toContain("Khám phá");
  });

  it("renders OCR re-upload advisory and close-tab note when OCR is pending", () => {
    const ocrJob = makeJob({
      currentStage: "ocr",
      progress: {
        percent: 15,
        message: "Đang đọc ảnh SGK 1/2",
        completedUnits: 1,
        totalUnits: 20,
        currentPeriod: null,
        totalPeriods: 2,
      },
      stageCursor: { position: 0, total: 2 },
    });

    const markup = renderToStaticMarkup(
      <GenerationProgressCard
        job={ocrJob}
        isActive={true}
        isCancelling={false}
        onResume={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(markup).toContain("Đóng tab trình duyệt sẽ ngắt lượt gửi yêu cầu");
    expect(markup).toContain("tải lại ảnh SGK tương ứng");
  });

  it("displays non-retryable error notice and hides resume button", () => {
    const failedJob = makeJob({
      error: {
        code: "GENERATION_UNIT_RETRY_LIMIT",
        message: "Đã vượt quá số lần thử lại tại bước này.",
        stage: "section-outcomes",
        retryable: false,
      },
    });

    const markup = renderToStaticMarkup(
      <GenerationProgressCard
        job={failedJob}
        isActive={false}
        isCancelling={false}
        onResume={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(markup).toContain("Lỗi (GENERATION_UNIT_RETRY_LIMIT)");
    expect(markup).toContain("Bước này đã đạt giới hạn thử lại tự động");
    expect(markup).not.toContain("Tiếp tục tiến trình");
    expect(markup).toContain("Hủy yêu cầu");
  });
});
