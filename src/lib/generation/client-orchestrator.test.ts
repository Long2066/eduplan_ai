import { describe, expect, it, vi } from "vitest";
import {
  StagedGenerationTerminalError,
  resumeStagedGeneration,
  startStagedGeneration,
  type ClientGenerationJob,
} from "./client-orchestrator";

function job(
  stage: ClientGenerationJob["currentStage"],
  overrides: Partial<ClientGenerationJob> = {},
): ClientGenerationJob {
  return {
    id: "job-1",
    schemaVersion: 1,
    pipelineVersion: "staged-v1",
    status: stage === "completed" ? "completed" : "waiting_next_step",
    currentStage: stage,
    progress: {
      percent: stage === "completed" ? 100 : 20,
      message: "Đang xử lý",
      completedUnits: stage === "completed" ? 10 : 2,
      totalUnits: 10,
      currentPeriod: null,
      totalPeriods: 1,
    },
    stageCursor: { position: 0, total: 1 },
    attempt: 0,
    inputSummary: {
      subject: "Toán",
      grade: "Lớp 3",
      lessonTitle: "Phép cộng",
      periods: 1,
      assetCount: 0,
    },
    lessonId: stage === "completed" ? "lesson-1" : null,
    error: null,
    createdAt: "2026-08-15T00:00:00.000Z",
    updatedAt: "2026-08-15T00:00:00.000Z",
    expiresAt: "2026-08-22T00:00:00.000Z",
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("staged generation client orchestrator", () => {
  it("creates, advances sequentially, and loads the completed lesson", async () => {
    const responses = [
      jsonResponse({ job: job("ocr"), created: true }, 201),
      jsonResponse({ job: job("blueprint") }),
      jsonResponse({ job: job("period-generation") }),
      jsonResponse({ job: job("completed") }),
      jsonResponse({ lessonId: "lesson-1", lesson: { generalInfo: { lessonTitle: "Phép cộng" } } }),
    ];
    let activeRequests = 0;
    let maxActiveRequests = 0;
    const fetcher = vi.fn(async () => {
      activeRequests += 1;
      maxActiveRequests = Math.max(maxActiveRequests, activeRequests);
      await Promise.resolve();
      activeRequests -= 1;
      const response = responses.shift();
      if (!response) throw new Error("Unexpected request");
      return response;
    }) as unknown as typeof fetch;
    const updates: string[] = [];

    const result = await startStagedGeneration({
      payload: JSON.stringify({
        uploadedAssets: [{
          id: "asset-1",
          name: "page.png",
          type: "image",
          dataUrl: "data:image/png;base64,YWJj",
        }],
      }),
      idempotencyKey: "request-123",
      authToken: "token",
      fetcher,
      retryDelayMs: 0,
      onJob: (current) => updates.push(current.currentStage),
    });

    expect(result.lessonId).toBe("lesson-1");
    expect(result.lesson.generalInfo.lessonTitle).toBe("Phép cộng");
    expect(maxActiveRequests).toBe(1);
    expect(updates).toEqual(["ocr", "blueprint", "period-generation", "completed"]);
    expect(fetcher).toHaveBeenCalledTimes(5);
    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      "/api/lesson/generation-jobs/job-1/advance",
      expect.objectContaining({
        body: JSON.stringify({
          asset: {
            id: "asset-1",
            name: "page.png",
            type: "image",
            dataUrl: "data:image/png;base64,YWJj",
          },
        }),
      }),
    );
  });

  it("polls and continues after a busy worker response", async () => {
    const responses = [
      jsonResponse({ job: job("ocr") }),
      jsonResponse({ error: "Busy", code: "GENERATION_JOB_BUSY" }, 409),
      jsonResponse({ job: job("blueprint") }),
      jsonResponse({ job: job("completed") }),
      jsonResponse({ lessonId: "lesson-1", lesson: { generalInfo: { lessonTitle: "Phép cộng" } } }),
    ];
    const fetcher = vi.fn(async () => {
      const response = responses.shift();
      if (!response) throw new Error("Unexpected request");
      return response;
    }) as unknown as typeof fetch;

    const result = await resumeStagedGeneration({
      jobId: "job-1",
      authToken: "token",
      ocrAssets: [{
        id: "asset-1",
        name: "page.png",
        type: "image",
        dataUrl: "data:image/png;base64,YWJj",
      }],
      fetcher,
      retryDelayMs: 0,
    });

    expect(result.job.status).toBe("completed");
    expect(fetcher).toHaveBeenCalledTimes(5);
  });

  it("stops without loading a lesson when the job becomes terminal failed", async () => {
    const failed = job("quota-settlement", {
      status: "failed",
      error: {
        code: "FINAL_VALIDATION_BLOCKED",
        message: "Giáo án còn lỗi chặn.",
        stage: "final-validation",
        retryable: false,
      },
    });
    const fetcher = vi.fn(async () => jsonResponse({ job: failed })) as unknown as typeof fetch;

    await expect(resumeStagedGeneration({
      jobId: "job-1",
      authToken: "token",
      fetcher,
      retryDelayMs: 0,
    })).rejects.toBeInstanceOf(StagedGenerationTerminalError);
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("does not retry an unresolved-title HTTP 422", async () => {
    const titleMessage = "Không xác định được tên bài. Vui lòng nhập Tên bài hoặc tải ảnh có tiêu đề rõ hơn.";
    const responses = [
      jsonResponse({ job: job("blueprint") }),
      jsonResponse({ error: titleMessage, code: "LESSON_TITLE_UNRESOLVED" }, 422),
    ];
    const fetcher = vi.fn(async () => {
      const response = responses.shift();
      if (!response) throw new Error("Unexpected retry");
      return response;
    }) as unknown as typeof fetch;

    await expect(resumeStagedGeneration({
      jobId: "job-1",
      authToken: "token",
      fetcher,
      retryDelayMs: 0,
      maxAutomaticRetries: 3,
    })).rejects.toMatchObject({
      code: "LESSON_TITLE_UNRESOLVED",
      status: 422,
      message: titleMessage,
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("asks for the current image when an OCR resume has no browser asset", async () => {
    const fetcher = vi.fn(async () => jsonResponse({
      job: job("ocr", { stageCursor: { position: 1, total: 2 } }),
    })) as unknown as typeof fetch;

    await expect(resumeStagedGeneration({
      jobId: "job-1",
      authToken: "token",
      fetcher,
      retryDelayMs: 0,
    })).rejects.toMatchObject({
      code: "GENERATION_OCR_ASSET_REQUIRED",
      status: 409,
    });
    expect(fetcher).toHaveBeenCalledOnce();
  });
});
