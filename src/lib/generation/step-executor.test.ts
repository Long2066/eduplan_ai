import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GenerationJob, PersistedGenerationInput } from "./job-types";
import { LESSON_TITLE_REQUIRED_MESSAGE, LessonTitleResolutionError } from "@/lib/lesson-title";
import type { LessonInput } from "@/types/lesson";

const storeMocks = vi.hoisted(() => ({
  acquireGenerationJobLease: vi.fn(),
  getGenerationJobForUser: vi.fn(),
  readGenerationJobArtifact: vi.fn(),
  releaseGenerationJobLease: vi.fn(),
  updateLeasedGenerationJob: vi.fn(),
  writeGenerationJobArtifact: vi.fn(),
}));

const storageMocks = vi.hoisted(() => ({
  lessonInputFromPersisted: vi.fn(),
}));

const ocrMocks = vi.hoisted(() => ({
  runOpenAiOcrAsset: vi.fn(),
  sortGenerationOcrAssets: vi.fn((assets: unknown[]) => assets),
}));

const stageMocks = vi.hoisted(() => ({
  assembleStagedLesson: vi.fn(),
  prepareStagedSourceContext: vi.fn(),
  generateStagedBlueprint: vi.fn(),
  generateStagedPeriod: vi.fn(),
  finalizeStagedLesson: vi.fn(),
  reassembleStagedRepairs: vi.fn(),
  repairStagedPeriod: vi.fn(),
  validateStagedLesson: vi.fn(),
}));

const persistenceMocks = vi.hoisted(() => ({
  persistStagedGeneratedLesson: vi.fn(),
}));

const usageMocks = vi.hoisted(() => ({
  commitUsage: vi.fn(),
  releaseUsage: vi.fn(),
}));

const lifecycleMocks = vi.hoisted(() => ({
  cleanupGenerationJobInput: vi.fn(),
  expireStagedGenerationJobIfNeeded: vi.fn(),
}));

vi.mock("@/lib/generation/job-store", () => {
  class GenerationJobConflictError extends Error {
    code: string;
    constructor(message: string, code: string) {
      super(message);
      this.code = code;
    }
  }
  return { ...storeMocks, GenerationJobConflictError };
});
vi.mock("@/lib/generation/assembly", () => ({
  assembleStagedLesson: stageMocks.assembleStagedLesson,
}));
vi.mock("@/lib/generation/input-storage", () => storageMocks);
vi.mock("@/lib/generation/ocr", () => ocrMocks);
vi.mock("@/lib/generation/source-preparation", () => ({
  prepareStagedSourceContext: stageMocks.prepareStagedSourceContext,
}));
vi.mock("@/lib/generation/blueprint", () => ({
  generateStagedBlueprint: stageMocks.generateStagedBlueprint,
}));
vi.mock("@/lib/generation/period-generation", () => ({
  generateStagedPeriod: stageMocks.generateStagedPeriod,
}));
vi.mock("@/lib/generation/subject-validation", () => ({
  validateStagedLesson: stageMocks.validateStagedLesson,
}));
vi.mock("@/lib/generation/repair", () => ({
  reassembleStagedRepairs: stageMocks.reassembleStagedRepairs,
  repairStagedPeriod: stageMocks.repairStagedPeriod,
}));
vi.mock("@/lib/generation/final-validation", () => ({
  finalizeStagedLesson: stageMocks.finalizeStagedLesson,
}));
vi.mock("@/lib/generation/persistence", () => persistenceMocks);
vi.mock("@/lib/generation/lifecycle", () => lifecycleMocks);
vi.mock("@/lib/model-strategy", () => ({
  getPlanModelStrategy: () => ({ plan: "free", blueprint: {}, detail: {}, repair: {} }),
}));
vi.mock("@/lib/subscription-policy", () => usageMocks);

import { advanceStagedGenerationJob } from "./step-executor";

function lessonInput(): LessonInput {
  return {
    subject: "Toán",
    grade: "Lớp 3",
    lessonTitle: "Phép cộng",
    book: "Kết nối tri thức",
    bookVolume: "auto",
    periods: 2,
    duration: 35,
    hometownProvince: "auto",
    localityNote: "",
    studentProfile: "auto",
    teachingEnvironment: "auto",
    facilities: "auto",
    style: "Dạy thật trên lớp",
    specialRequest: "",
    allowAiInference: true,
    enableDigitalCompetency: false,
    uploadedAssets: [],
  };
}

function sourceContext(subjectKind = "math") {
  return {
    subjectKind,
    ocrSourceHashes: ["source-1"],
    sourceTruth: {
      version: 1,
      subject: "Toán",
      grade: "Lớp 3",
      lessonTitle: "Phép cộng",
      periods: 2,
      sourceHashes: ["source-1"],
      ocrExcerpt: "OCR",
      pageNumbers: [],
      titleCandidates: [],
      tasks: [],
      visuals: [],
      uncertain: [],
    },
    warnings: [],
  };
}

function job(stage: GenerationJob["currentStage"], overrides: Partial<GenerationJob> = {}): GenerationJob {
  return {
    id: "job-1",
    schemaVersion: 1,
    pipelineVersion: "staged-v1",
    uid: "user-1",
    status: "waiting_next_step",
    currentStage: stage,
    progress: {
      percent: 10,
      message: "Ready",
      completedUnits: 1,
      totalUnits: 11,
      currentPeriod: null,
      totalPeriods: 2,
    },
    stageCursor: { position: 0, total: 1 },
    attempt: 0,
    inputSummary: { subject: "Toán", grade: "Lớp 3", lessonTitle: "Phép cộng", periods: 2, assetCount: 0 },
    inputFingerprint: "fingerprint",
    quotaReservationId: "operation-1",
    quotaReservation: {
      operationId: "operation-1",
      uid: "user-1",
      plan: "free",
      kind: "generate",
      source: "free",
      amount: 1,
    },
    lease: null,
    lessonId: null,
    error: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    expiresAt: new Date("2026-01-08T00:00:00.000Z"),
    ...overrides,
  };
}

function persistedInput(uploadedAssets: PersistedGenerationInput["uploadedAssets"] = []): PersistedGenerationInput {
  return { ...lessonInput(), uploadedAssets };
}

describe("staged generation step executor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storeMocks.acquireGenerationJobLease.mockResolvedValue({ owner: "worker", expiresAt: new Date(Date.now() + 60_000) });
    storeMocks.releaseGenerationJobLease.mockResolvedValue(true);
    storeMocks.updateLeasedGenerationJob.mockResolvedValue(true);
    storeMocks.writeGenerationJobArtifact.mockResolvedValue("artifact");
    persistenceMocks.persistStagedGeneratedLesson.mockResolvedValue("staged-job-1");
    usageMocks.commitUsage.mockResolvedValue(undefined);
    usageMocks.releaseUsage.mockResolvedValue(undefined);
    lifecycleMocks.cleanupGenerationJobInput.mockResolvedValue(undefined);
    lifecycleMocks.expireStagedGenerationJobIfNeeded.mockResolvedValue(null);
    storageMocks.lessonInputFromPersisted.mockImplementation((input: PersistedGenerationInput) => ({ ...input, uploadedAssets: [] }));
  });

  it("finishes an empty OCR stage without calling AI", async () => {
    const current = job("ocr", { stageCursor: { position: 0, total: 0 } });
    const updated = job("source-preparation", { stageCursor: { position: 0, total: 1 } });
    storeMocks.getGenerationJobForUser.mockResolvedValueOnce(current).mockResolvedValueOnce(updated);
    storeMocks.readGenerationJobArtifact.mockResolvedValueOnce({ payload: persistedInput() });

    const result = await advanceStagedGenerationJob("user-1", "job-1");
    expect(result.currentStage).toBe("source-preparation");
    expect(ocrMocks.runOpenAiOcrAsset).not.toHaveBeenCalled();
    expect(storeMocks.writeGenerationJobArtifact).toHaveBeenCalledWith(
      "job-1",
      { kind: "ocr" },
      expect.objectContaining({ text: "", pageCount: 0 }),
    );
  });

  it("processes only one OCR image per advance request", async () => {
    const current = job("ocr", { stageCursor: { position: 0, total: 2 } });
    const updated = job("ocr", { stageCursor: { position: 1, total: 2 } });
    const assets: PersistedGenerationInput["uploadedAssets"] = [{
      id: "asset-1",
      name: "page.png",
      type: "image",
      mimeType: "image/png",
    }];
    assets.push({ ...assets[0], id: "asset-2", name: "page-2.png" });
    storeMocks.getGenerationJobForUser.mockResolvedValueOnce(current).mockResolvedValueOnce(updated);
    storeMocks.readGenerationJobArtifact
      .mockResolvedValueOnce({ payload: persistedInput(assets) })
      .mockResolvedValueOnce(null);
    ocrMocks.runOpenAiOcrAsset.mockResolvedValue({
      text: "Nội dung OCR đủ dài cho ảnh đầu tiên của bài học.",
      sourceHash: "source-1",
      cacheHit: false,
      model: "ocr-model",
    });

    await advanceStagedGenerationJob("user-1", "job-1", {
      id: "asset-1", name: "page.png", type: "image", dataUrl: "data:image/png;base64,YWJj",
    });
    expect(ocrMocks.runOpenAiOcrAsset).toHaveBeenCalledOnce();
    expect(storeMocks.writeGenerationJobArtifact).toHaveBeenCalledWith(
      "job-1",
      { kind: "ocr-page", sequence: 1 },
      expect.objectContaining({ assetId: "asset-1" }),
    );
    expect(storeMocks.updateLeasedGenerationJob).toHaveBeenCalledWith(
      "job-1",
      "user-1",
      expect.any(String),
      expect.objectContaining({ stageCursor: { position: 1, total: 2 } }),
    );
  });

  it("requires the current browser image before starting an OCR page", async () => {
    const current = job("ocr", { stageCursor: { position: 0, total: 1 } });
    storeMocks.getGenerationJobForUser.mockResolvedValueOnce(current);
    storeMocks.readGenerationJobArtifact
      .mockResolvedValueOnce({
        payload: persistedInput([{
          id: "asset-1",
          name: "page.png",
          type: "image",
          mimeType: "image/png",
        }]),
      })
      .mockResolvedValueOnce(null);

    await expect(advanceStagedGenerationJob("user-1", "job-1"))
      .rejects.toMatchObject({ code: "GENERATION_OCR_ASSET_REQUIRED", status: 409 });
    expect(ocrMocks.runOpenAiOcrAsset).not.toHaveBeenCalled();
    expect(storeMocks.updateLeasedGenerationJob).toHaveBeenCalledWith(
      "job-1",
      "user-1",
      expect.any(String),
      expect.objectContaining({ status: "waiting_next_step", error: null }),
    );
    expect(storeMocks.releaseGenerationJobLease).toHaveBeenCalledOnce();
  });

  it("reuses a completed OCR page without asking the browser to resend it", async () => {
    const current = job("ocr", { stageCursor: { position: 0, total: 2 } });
    const updated = job("ocr", { stageCursor: { position: 1, total: 2 } });
    const assets: PersistedGenerationInput["uploadedAssets"] = [1, 2].map((sequence) => ({
      id: `asset-${sequence}`,
      name: `page-${sequence}.png`,
      type: "image" as const,
      mimeType: "image/png",
    }));
    storeMocks.getGenerationJobForUser.mockResolvedValueOnce(current).mockResolvedValueOnce(updated);
    storeMocks.readGenerationJobArtifact
      .mockResolvedValueOnce({ payload: persistedInput(assets) })
      .mockResolvedValueOnce({
        payload: {
          index: 1,
          assetId: "asset-1",
          assetName: "page-1.png",
          text: "Nội dung OCR ảnh thứ nhất đã được lưu trước đó.",
          sourceHash: "source-1",
          cacheHit: false,
          model: "ocr-model",
        },
      });

    const result = await advanceStagedGenerationJob("user-1", "job-1");

    expect(result.stageCursor.position).toBe(1);
    expect(ocrMocks.runOpenAiOcrAsset).not.toHaveBeenCalled();
    expect(storeMocks.updateLeasedGenerationJob).toHaveBeenCalledWith(
      "job-1",
      "user-1",
      expect.any(String),
      expect.objectContaining({ stageCursor: { position: 1, total: 2 } }),
    );
  });

  it("aggregates ordered OCR pages after the last image", async () => {
    const current = job("ocr", { stageCursor: { position: 1, total: 2 } });
    const updated = job("source-preparation", { stageCursor: { position: 0, total: 1 } });
    const assets: PersistedGenerationInput["uploadedAssets"] = [1, 2].map((sequence) => ({
      id: `asset-${sequence}`,
      name: `page-${sequence}.png`,
      type: "image" as const,
      mimeType: "image/png",
    }));
    const pageOne = {
      index: 1,
      assetId: "asset-1",
      assetName: "page-1.png",
      text: "Nội dung OCR của ảnh thứ nhất đủ dài.",
      sourceHash: "source-1",
      cacheHit: true,
      model: "ocr-model",
    };
    const pageTwo = {
      ...pageOne,
      index: 2,
      assetId: "asset-2",
      assetName: "page-2.png",
      text: "Nội dung OCR của ảnh thứ hai đủ dài.",
      sourceHash: "source-2",
      cacheHit: false,
    };
    storeMocks.getGenerationJobForUser.mockResolvedValueOnce(current).mockResolvedValueOnce(updated);
    storeMocks.readGenerationJobArtifact
      .mockResolvedValueOnce({ payload: persistedInput(assets) })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ payload: pageOne })
      .mockResolvedValueOnce({ payload: pageTwo });
    ocrMocks.runOpenAiOcrAsset.mockResolvedValue({
      text: pageTwo.text,
      sourceHash: pageTwo.sourceHash,
      cacheHit: pageTwo.cacheHit,
      model: pageTwo.model,
    });

    const result = await advanceStagedGenerationJob("user-1", "job-1", {
      id: "asset-2", name: "page-2.png", type: "image", dataUrl: "data:image/png;base64,ZGVm",
    });
    expect(result.currentStage).toBe("source-preparation");
    expect(storeMocks.writeGenerationJobArtifact).toHaveBeenCalledWith(
      "job-1",
      { kind: "ocr" },
      expect.objectContaining({
        sourceHashes: ["source-1", "source-2"],
        cacheHitCount: 1,
        cacheMissCount: 1,
        pageCount: 2,
      }),
    );
  });

  it("prepares cached source context as its own step", async () => {
    const current = job("source-preparation");
    const updated = job("blueprint");
    storeMocks.getGenerationJobForUser.mockResolvedValueOnce(current).mockResolvedValueOnce(updated);
    storeMocks.readGenerationJobArtifact
      .mockResolvedValueOnce({ payload: persistedInput() })
      .mockResolvedValueOnce({ payload: { text: "OCR", sourceHashes: ["source-1"] } });
    stageMocks.prepareStagedSourceContext.mockResolvedValue(sourceContext());

    const result = await advanceStagedGenerationJob("user-1", "job-1");
    expect(result.currentStage).toBe("blueprint");
    expect(storeMocks.writeGenerationJobArtifact).toHaveBeenCalledWith(
      "job-1",
      { kind: "source-context" },
      expect.objectContaining({ subjectKind: "math" }),
    );
  });

  it("creates the blueprint and stops before period generation", async () => {
    const current = job("blueprint");
    const updated = job("period-generation", { stageCursor: { position: 0, total: 2 } });
    storeMocks.getGenerationJobForUser.mockResolvedValueOnce(current).mockResolvedValueOnce(updated);
    storeMocks.readGenerationJobArtifact
      .mockResolvedValueOnce({ payload: persistedInput() })
      .mockResolvedValueOnce({ payload: { text: "OCR", sourceHashes: [] } })
      .mockResolvedValueOnce({ payload: sourceContext() });
    stageMocks.generateStagedBlueprint.mockResolvedValue({ subjectKind: "math", mode: "chunked", blueprint: {} });

    const result = await advanceStagedGenerationJob("user-1", "job-1");
    expect(result.currentStage).toBe("period-generation");
    expect(storeMocks.writeGenerationJobArtifact).toHaveBeenCalledWith(
      "job-1",
      { kind: "blueprint" },
      expect.objectContaining({ mode: "chunked" }),
    );
  });

  it.each(["blueprint", "assembly"] as const)(
    "refunds and terminates an unresolved title thrown during %s",
    async (stage) => {
      const current = job(stage);
      storeMocks.getGenerationJobForUser.mockResolvedValueOnce(current);
      if (stage === "blueprint") {
        storeMocks.readGenerationJobArtifact
          .mockResolvedValueOnce({ payload: persistedInput() })
          .mockResolvedValueOnce({ payload: { text: "OCR without a heading", sourceHashes: [] } })
          .mockResolvedValueOnce({ payload: sourceContext() });
        stageMocks.generateStagedBlueprint.mockRejectedValueOnce(new LessonTitleResolutionError());
      } else {
        storeMocks.readGenerationJobArtifact
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({ payload: persistedInput() })
          .mockResolvedValueOnce({ payload: { subjectKind: "math", mode: "chunked", blueprint: {} } })
          .mockResolvedValueOnce({ payload: { subjectKind: "math", periodNumber: 1, period: {} } })
          .mockResolvedValueOnce({ payload: { subjectKind: "math", periodNumber: 2, period: {} } });
        stageMocks.assembleStagedLesson.mockImplementationOnce(() => {
          throw new LessonTitleResolutionError();
        });
      }

      await expect(advanceStagedGenerationJob("user-1", "job-1"))
        .rejects.toMatchObject({
          code: "LESSON_TITLE_UNRESOLVED",
          status: 422,
          message: LESSON_TITLE_REQUIRED_MESSAGE,
        });

      expect(usageMocks.releaseUsage).toHaveBeenCalledWith(
        current.quotaReservation,
        "staged_lesson_title_unresolved",
        expect.objectContaining({
          jobId: "job-1",
          stage,
          code: "LESSON_TITLE_UNRESOLVED",
          outcome: "rejected",
        }),
      );
      expect(lifecycleMocks.cleanupGenerationJobInput).toHaveBeenCalledWith(current);
      expect(storeMocks.updateLeasedGenerationJob).toHaveBeenCalledWith(
        "job-1",
        "user-1",
        expect.any(String),
        expect.objectContaining({
          status: "failed",
          currentStage: stage,
          error: expect.objectContaining({
            code: "LESSON_TITLE_UNRESOLVED",
            message: LESSON_TITLE_REQUIRED_MESSAGE,
            retryable: false,
          }),
        }),
      );
      expect(storeMocks.updateLeasedGenerationJob).not.toHaveBeenCalledWith(
        "job-1",
        "user-1",
        expect.any(String),
        expect.objectContaining({
          status: "waiting_next_step",
          error: expect.objectContaining({ retryable: true }),
        }),
      );
      expect(storeMocks.writeGenerationJobArtifact).not.toHaveBeenCalledWith(
        "job-1",
        { kind: stage },
        expect.anything(),
      );
      expect(storeMocks.releaseGenerationJobLease).toHaveBeenCalledOnce();
    },
  );

  it.each([
    { failure: "release", message: "quota release unavailable" },
    { failure: "cleanup", message: "cleanup unavailable" },
  ] as const)(
    "keeps unresolved-title settlement retryable when $failure fails",
    async ({ failure, message }) => {
      const current = job("blueprint");
      storeMocks.getGenerationJobForUser.mockResolvedValueOnce(current);
      storeMocks.readGenerationJobArtifact
        .mockResolvedValueOnce({ payload: persistedInput() })
        .mockResolvedValueOnce({ payload: { text: "OCR without a heading", sourceHashes: [] } })
        .mockResolvedValueOnce({ payload: sourceContext() });
      stageMocks.generateStagedBlueprint.mockRejectedValueOnce(new LessonTitleResolutionError());
      if (failure === "release") usageMocks.releaseUsage.mockRejectedValueOnce(new Error(message));
      else lifecycleMocks.cleanupGenerationJobInput.mockRejectedValueOnce(new Error(message));

      await expect(advanceStagedGenerationJob("user-1", "job-1"))
        .rejects.toMatchObject({
          code: "LESSON_TITLE_SETTLEMENT_FAILED",
          status: 503,
          message,
        });

      expect(storeMocks.updateLeasedGenerationJob).toHaveBeenCalledWith(
        "job-1",
        "user-1",
        expect.any(String),
        expect.objectContaining({
          status: "waiting_next_step",
          currentStage: "blueprint",
          error: expect.objectContaining({
            code: "LESSON_TITLE_SETTLEMENT_FAILED",
            retryable: true,
          }),
        }),
      );
      expect(storeMocks.updateLeasedGenerationJob).not.toHaveBeenCalledWith(
        "job-1",
        "user-1",
        expect.any(String),
        expect.objectContaining({ status: "failed" }),
      );
      if (failure === "release") {
        expect(lifecycleMocks.cleanupGenerationJobInput).not.toHaveBeenCalled();
      } else {
        expect(usageMocks.releaseUsage).toHaveBeenCalledOnce();
      }
      expect(storeMocks.releaseGenerationJobLease).toHaveBeenCalledOnce();
    },
  );

  it("generates only one period and keeps the job at period generation", async () => {
    const current = job("period-generation", { stageCursor: { position: 0, total: 2 } });
    const updated = job("period-generation", { stageCursor: { position: 1, total: 2 } });
    storeMocks.getGenerationJobForUser.mockResolvedValueOnce(current).mockResolvedValueOnce(updated);
    storeMocks.readGenerationJobArtifact
      .mockResolvedValueOnce({ payload: persistedInput() })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ payload: { text: "OCR", sourceHashes: [] } })
      .mockResolvedValueOnce({ payload: { subjectKind: "math", mode: "chunked", blueprint: {} } });
    stageMocks.generateStagedPeriod.mockResolvedValue({
      subjectKind: "math",
      periodNumber: 1,
      model: "detail-model",
      provider: "openai",
      fallbackUsed: false,
      period: { periodNumber: 1, focus: "Tiết 1", activities: [{}] },
      handoff: { learned: "Đã học tiết 1", nextBridge: "Sang tiết 2" },
    });

    const result = await advanceStagedGenerationJob("user-1", "job-1");

    expect(result.currentStage).toBe("period-generation");
    expect(stageMocks.generateStagedPeriod).toHaveBeenCalledOnce();
    expect(stageMocks.generateStagedPeriod).toHaveBeenCalledWith(
      expect.objectContaining({ subject: "Toán" }),
      "OCR",
      expect.objectContaining({ subjectKind: "math" }),
      1,
      null,
      expect.objectContaining({ plan: "free" }),
    );
    expect(storeMocks.writeGenerationJobArtifact).toHaveBeenCalledWith(
      "job-1",
      { kind: "period", sequence: 1 },
      expect.objectContaining({ periodNumber: 1 }),
    );
    expect(storeMocks.updateLeasedGenerationJob).toHaveBeenCalledWith(
      "job-1",
      "user-1",
      expect.any(String),
      expect.objectContaining({
        currentStage: "period-generation",
        stageCursor: { position: 1, total: 2 },
      }),
    );
  });

  it("passes the previous handoff and moves to assembly after the final period", async () => {
    const current = job("period-generation", { stageCursor: { position: 1, total: 2 } });
    const updated = job("assembly", { stageCursor: { position: 0, total: 1 } });
    const previousArtifact = {
      subjectKind: "math",
      periodNumber: 1,
      period: { periodNumber: 1, focus: "Tiết 1", activities: [{}] },
      handoff: { learned: "Đã học tiết 1", nextBridge: "Sang tiết 2" },
    };
    storeMocks.getGenerationJobForUser.mockResolvedValueOnce(current).mockResolvedValueOnce(updated);
    storeMocks.readGenerationJobArtifact
      .mockResolvedValueOnce({ payload: persistedInput() })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ payload: { text: "OCR", sourceHashes: [] } })
      .mockResolvedValueOnce({ payload: { subjectKind: "math", mode: "chunked", blueprint: {} } })
      .mockResolvedValueOnce({ payload: previousArtifact });
    stageMocks.generateStagedPeriod.mockResolvedValue({
      ...previousArtifact,
      periodNumber: 2,
      period: { periodNumber: 2, focus: "Tiết 2", activities: [{}] },
      handoff: { learned: "Đã học tiết 2" },
    });

    const result = await advanceStagedGenerationJob("user-1", "job-1");

    expect(result.currentStage).toBe("assembly");
    expect(stageMocks.generateStagedPeriod).toHaveBeenCalledWith(
      expect.anything(),
      "OCR",
      expect.anything(),
      2,
      previousArtifact.handoff,
      expect.anything(),
    );
    expect(storeMocks.updateLeasedGenerationJob).toHaveBeenCalledWith(
      "job-1",
      "user-1",
      expect.any(String),
      expect.objectContaining({
        currentStage: "assembly",
        stageCursor: { position: 0, total: 1 },
      }),
    );
  });

  it("reuses an existing period artifact after a partial retry without calling AI", async () => {
    const current = job("period-generation", { stageCursor: { position: 0, total: 2 } });
    const updated = job("period-generation", { stageCursor: { position: 1, total: 2 } });
    storeMocks.getGenerationJobForUser.mockResolvedValueOnce(current).mockResolvedValueOnce(updated);
    storeMocks.readGenerationJobArtifact
      .mockResolvedValueOnce({ payload: persistedInput() })
      .mockResolvedValueOnce({ payload: { periodNumber: 1, handoff: { learned: "Đã tạo" } } });

    await advanceStagedGenerationJob("user-1", "job-1");

    expect(stageMocks.generateStagedPeriod).not.toHaveBeenCalled();
    expect(storeMocks.writeGenerationJobArtifact).not.toHaveBeenCalledWith(
      "job-1",
      { kind: "period", sequence: 1 },
      expect.anything(),
    );
    expect(storeMocks.updateLeasedGenerationJob).toHaveBeenCalledWith(
      "job-1",
      "user-1",
      expect.any(String),
      expect.objectContaining({ stageCursor: { position: 1, total: 2 } }),
    );
  });

  it("assembles all period artifacts and advances to subject validation", async () => {
    const current = job("assembly", { stageCursor: { position: 0, total: 1 } });
    const updated = job("subject-validation", { stageCursor: { position: 0, total: 1 } });
    const blueprintArtifact = { subjectKind: "math", mode: "chunked", blueprint: {} };
    const firstPeriod = { subjectKind: "math", periodNumber: 1, period: { periodNumber: 1, activities: [{}] } };
    const secondPeriod = { subjectKind: "math", periodNumber: 2, period: { periodNumber: 2, activities: [{}] } };
    const assemblyArtifact = { subjectKind: "math", periodCount: 2, lesson: { periodPlans: [] } };
    storeMocks.getGenerationJobForUser.mockResolvedValueOnce(current).mockResolvedValueOnce(updated);
    storeMocks.readGenerationJobArtifact
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ payload: persistedInput() })
      .mockResolvedValueOnce({ payload: blueprintArtifact })
      .mockResolvedValueOnce({ payload: firstPeriod })
      .mockResolvedValueOnce({ payload: secondPeriod });
    stageMocks.assembleStagedLesson.mockReturnValue(assemblyArtifact);

    const result = await advanceStagedGenerationJob("user-1", "job-1");

    expect(result.currentStage).toBe("subject-validation");
    expect(stageMocks.assembleStagedLesson).toHaveBeenCalledWith(
      expect.objectContaining({ subject: "Toán", periods: 2 }),
      blueprintArtifact,
      [firstPeriod, secondPeriod],
      "free",
    );
    expect(storeMocks.writeGenerationJobArtifact).toHaveBeenCalledWith(
      "job-1",
      { kind: "assembly" },
      assemblyArtifact,
    );
    expect(storeMocks.updateLeasedGenerationJob).toHaveBeenCalledWith(
      "job-1",
      "user-1",
      expect.any(String),
      expect.objectContaining({
        currentStage: "subject-validation",
        stageCursor: { position: 0, total: 1 },
      }),
    );
  });

  it("reuses an existing assembly artifact after a partial retry", async () => {
    const current = job("assembly", { stageCursor: { position: 0, total: 1 } });
    const updated = job("subject-validation", { stageCursor: { position: 0, total: 1 } });
    storeMocks.getGenerationJobForUser.mockResolvedValueOnce(current).mockResolvedValueOnce(updated);
    storeMocks.readGenerationJobArtifact.mockResolvedValueOnce({ payload: { subjectKind: "math", lesson: {} } });

    await advanceStagedGenerationJob("user-1", "job-1");

    expect(stageMocks.assembleStagedLesson).not.toHaveBeenCalled();
    expect(storeMocks.writeGenerationJobArtifact).not.toHaveBeenCalledWith(
      "job-1",
      { kind: "assembly" },
      expect.anything(),
    );
    expect(storeMocks.readGenerationJobArtifact).toHaveBeenCalledOnce();
  });

  it("validates the assembled lesson and routes repairable errors to repair", async () => {
    const current = job("subject-validation", { stageCursor: { position: 0, total: 1 } });
    const updated = job("repair", { stageCursor: { position: 0, total: 2 } });
    const assemblyArtifact = { subjectKind: "math", lesson: { periodPlans: [] } };
    const blueprintArtifact = { subjectKind: "math", mode: "chunked", blueprint: {} };
    const validationArtifact = {
      subjectKind: "math",
      route: "repair",
      repairTargets: [{ periodNumber: 1 }, { periodNumber: 2 }],
      summary: { repairableErrors: 3 },
    };
    storeMocks.getGenerationJobForUser.mockResolvedValueOnce(current).mockResolvedValueOnce(updated);
    storeMocks.readGenerationJobArtifact
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ payload: persistedInput() })
      .mockResolvedValueOnce({ payload: assemblyArtifact })
      .mockResolvedValueOnce({ payload: blueprintArtifact });
    stageMocks.validateStagedLesson.mockReturnValue(validationArtifact);

    const result = await advanceStagedGenerationJob("user-1", "job-1");

    expect(result.currentStage).toBe("repair");
    expect(stageMocks.validateStagedLesson).toHaveBeenCalledWith(
      expect.objectContaining({ subject: "Toán" }),
      assemblyArtifact,
      blueprintArtifact,
    );
    expect(storeMocks.writeGenerationJobArtifact).toHaveBeenCalledWith(
      "job-1",
      { kind: "validation" },
      validationArtifact,
    );
    expect(storeMocks.updateLeasedGenerationJob).toHaveBeenCalledWith(
      "job-1",
      "user-1",
      expect.any(String),
      expect.objectContaining({
        currentStage: "repair",
        stageCursor: { position: 0, total: 2 },
      }),
    );
  });

  it("skips repair when subject validation has no repairable error", async () => {
    const current = job("subject-validation", { stageCursor: { position: 0, total: 1 } });
    const updated = job("final-validation", { stageCursor: { position: 0, total: 1 } });
    const validationArtifact = {
      subjectKind: "default",
      route: "final-validation",
      repairTargets: [],
      summary: { repairableErrors: 0 },
    };
    storeMocks.getGenerationJobForUser.mockResolvedValueOnce(current).mockResolvedValueOnce(updated);
    storeMocks.readGenerationJobArtifact
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ payload: persistedInput() })
      .mockResolvedValueOnce({ payload: { subjectKind: "default", lesson: {} } })
      .mockResolvedValueOnce({ payload: { subjectKind: "default", blueprint: {} } });
    stageMocks.validateStagedLesson.mockReturnValue(validationArtifact);

    const result = await advanceStagedGenerationJob("user-1", "job-1");

    expect(result.currentStage).toBe("final-validation");
    expect(storeMocks.updateLeasedGenerationJob).toHaveBeenCalledWith(
      "job-1",
      "user-1",
      expect.any(String),
      expect.objectContaining({
        currentStage: "final-validation",
        stageCursor: { position: 0, total: 1 },
      }),
    );
  });

  it("reuses an existing validation artifact after a partial retry", async () => {
    const current = job("subject-validation", { stageCursor: { position: 0, total: 1 } });
    const updated = job("repair", { stageCursor: { position: 0, total: 1 } });
    storeMocks.getGenerationJobForUser.mockResolvedValueOnce(current).mockResolvedValueOnce(updated);
    storeMocks.readGenerationJobArtifact.mockResolvedValueOnce({
      payload: {
        subjectKind: "math",
        route: "repair",
        repairTargets: [{ periodNumber: 1 }],
        summary: { repairableErrors: 1 },
      },
    });

    await advanceStagedGenerationJob("user-1", "job-1");

    expect(stageMocks.validateStagedLesson).not.toHaveBeenCalled();
    expect(storeMocks.writeGenerationJobArtifact).not.toHaveBeenCalledWith(
      "job-1",
      { kind: "validation" },
      expect.anything(),
    );
    expect(storeMocks.readGenerationJobArtifact).toHaveBeenCalledOnce();
  });

  it("repairs only one target and waits for the next repair request", async () => {
    const current = job("repair", { stageCursor: { position: 0, total: 2 } });
    const updated = job("repair", { stageCursor: { position: 1, total: 2 } });
    const validation = {
      route: "repair",
      repairTargets: [
        { periodNumber: 1, findingCodes: ["QUALITY-01"] },
        { periodNumber: 2, findingCodes: ["QUALITY-02"] },
      ],
      findings: [{ code: "QUALITY-01", severity: "error", message: "Lỗi tiết 1", periodNumber: 1, autoFixable: true }],
    };
    const assemblyArtifact = { repairApplied: false, lesson: { periodPlans: [{ periodNumber: 1, focus: "Tiết 1", activities: [{}] }] } };
    const repairedArtifact = { subjectKind: "math", targetIndex: 1, periodNumber: 1, period: { periodNumber: 1, activities: [{}] } };
    storeMocks.getGenerationJobForUser.mockResolvedValueOnce(current).mockResolvedValueOnce(updated);
    storeMocks.readGenerationJobArtifact
      .mockResolvedValueOnce({ payload: validation })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ payload: persistedInput() })
      .mockResolvedValueOnce({ payload: { text: "OCR", sourceHashes: [] } })
      .mockResolvedValueOnce({ payload: { subjectKind: "math", blueprint: {} } })
      .mockResolvedValueOnce({ payload: assemblyArtifact });
    stageMocks.repairStagedPeriod.mockResolvedValue(repairedArtifact);

    const result = await advanceStagedGenerationJob("user-1", "job-1");

    expect(result.currentStage).toBe("repair");
    expect(stageMocks.repairStagedPeriod).toHaveBeenCalledOnce();
    expect(stageMocks.repairStagedPeriod).toHaveBeenCalledWith(
      expect.objectContaining({ subject: "Toán" }),
      "OCR",
      expect.objectContaining({ subjectKind: "math" }),
      expect.objectContaining({ periodNumber: 1 }),
      null,
      validation.findings,
      1,
      expect.objectContaining({ plan: "free" }),
    );
    expect(storeMocks.writeGenerationJobArtifact).toHaveBeenCalledWith(
      "job-1",
      { kind: "repair", sequence: 1 },
      repairedArtifact,
    );
    expect(storeMocks.updateLeasedGenerationJob).toHaveBeenCalledWith(
      "job-1",
      "user-1",
      expect.any(String),
      expect.objectContaining({
        currentStage: "repair",
        stageCursor: { position: 1, total: 2 },
      }),
    );
    expect(stageMocks.reassembleStagedRepairs).not.toHaveBeenCalled();
  });

  it("applies all repair artifacts and moves to final validation after the last target", async () => {
    const current = job("repair", { stageCursor: { position: 1, total: 2 } });
    const updated = job("final-validation", { stageCursor: { position: 0, total: 1 } });
    const validation = {
      route: "repair",
      repairTargets: [
        { periodNumber: 1, findingCodes: ["QUALITY-01"] },
        { periodNumber: 2, findingCodes: ["QUALITY-02"] },
      ],
      findings: [{ code: "QUALITY-02", severity: "error", message: "Lỗi tiết 2", periodNumber: 2, autoFixable: true }],
    };
    const inputArtifact = persistedInput();
    const blueprintArtifact = { subjectKind: "math", blueprint: {} };
    const assemblyArtifact = {
      repairApplied: false,
      lesson: { periodPlans: [{ periodNumber: 2, focus: "Tiết 2", activities: [{}] }] },
    };
    const originalOne = { subjectKind: "math", periodNumber: 1, period: { periodNumber: 1, activities: [{}] } };
    const originalTwo = { subjectKind: "math", periodNumber: 2, period: { periodNumber: 2, activities: [{}] } };
    const repairOne = { ...originalOne, targetIndex: 1, handoff: { learned: "Tiết 1 đã sửa", nextBridge: "Sang tiết 2" } };
    const repairTwo = { ...originalTwo, targetIndex: 2 };
    const repairedAssembly = { repairApplied: true, lesson: { periodPlans: [] } };
    storeMocks.getGenerationJobForUser.mockResolvedValueOnce(current).mockResolvedValueOnce(updated);
    storeMocks.readGenerationJobArtifact
      .mockResolvedValueOnce({ payload: validation })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ payload: inputArtifact })
      .mockResolvedValueOnce({ payload: { text: "OCR", sourceHashes: [] } })
      .mockResolvedValueOnce({ payload: blueprintArtifact })
      .mockResolvedValueOnce({ payload: assemblyArtifact })
      .mockResolvedValueOnce({ payload: repairOne })
      .mockResolvedValueOnce({ payload: assemblyArtifact })
      .mockResolvedValueOnce({ payload: inputArtifact })
      .mockResolvedValueOnce({ payload: blueprintArtifact })
      .mockResolvedValueOnce({ payload: originalOne })
      .mockResolvedValueOnce({ payload: originalTwo })
      .mockResolvedValueOnce({ payload: repairOne })
      .mockResolvedValueOnce({ payload: repairTwo });
    stageMocks.repairStagedPeriod.mockResolvedValue(repairTwo);
    stageMocks.reassembleStagedRepairs.mockReturnValue(repairedAssembly);

    const result = await advanceStagedGenerationJob("user-1", "job-1");

    expect(result.currentStage).toBe("final-validation");
    expect(stageMocks.repairStagedPeriod).toHaveBeenCalledOnce();
    expect(stageMocks.repairStagedPeriod).toHaveBeenCalledWith(
      expect.anything(),
      "OCR",
      blueprintArtifact,
      expect.objectContaining({ periodNumber: 2 }),
      repairOne.handoff,
      validation.findings,
      2,
      expect.anything(),
    );
    expect(stageMocks.reassembleStagedRepairs).toHaveBeenCalledWith(
      expect.objectContaining({ subject: "Toán" }),
      blueprintArtifact,
      [originalOne, originalTwo],
      [repairOne, repairTwo],
      "free",
    );
    expect(storeMocks.writeGenerationJobArtifact).toHaveBeenCalledWith(
      "job-1",
      { kind: "assembly" },
      repairedAssembly,
    );
    expect(storeMocks.updateLeasedGenerationJob).toHaveBeenCalledWith(
      "job-1",
      "user-1",
      expect.any(String),
      expect.objectContaining({
        currentStage: "final-validation",
        stageCursor: { position: 0, total: 1 },
      }),
    );
  });

  it("reuses an existing repair artifact without calling AI again", async () => {
    const current = job("repair", { stageCursor: { position: 0, total: 2 } });
    const updated = job("repair", { stageCursor: { position: 1, total: 2 } });
    storeMocks.getGenerationJobForUser.mockResolvedValueOnce(current).mockResolvedValueOnce(updated);
    storeMocks.readGenerationJobArtifact
      .mockResolvedValueOnce({
        payload: {
          route: "repair",
          repairTargets: [{ periodNumber: 1, findingCodes: ["QUALITY-01"] }, { periodNumber: 2, findingCodes: ["QUALITY-02"] }],
          findings: [],
        },
      })
      .mockResolvedValueOnce({ payload: { targetIndex: 1, periodNumber: 1 } });

    await advanceStagedGenerationJob("user-1", "job-1");

    expect(stageMocks.repairStagedPeriod).not.toHaveBeenCalled();
    expect(storeMocks.writeGenerationJobArtifact).not.toHaveBeenCalledWith(
      "job-1",
      { kind: "repair", sequence: 1 },
      expect.anything(),
    );
  });

  it("finishes a retried last repair without AI or duplicate reassembly", async () => {
    const current = job("repair", { stageCursor: { position: 1, total: 2 } });
    const updated = job("final-validation", { stageCursor: { position: 0, total: 1 } });
    storeMocks.getGenerationJobForUser.mockResolvedValueOnce(current).mockResolvedValueOnce(updated);
    storeMocks.readGenerationJobArtifact
      .mockResolvedValueOnce({
        payload: {
          route: "repair",
          repairTargets: [{ periodNumber: 1, findingCodes: ["QUALITY-01"] }, { periodNumber: 2, findingCodes: ["QUALITY-02"] }],
          findings: [],
        },
      })
      .mockResolvedValueOnce({ payload: { targetIndex: 2, periodNumber: 2 } })
      .mockResolvedValueOnce({ payload: { repairApplied: true, lesson: {} } });

    const result = await advanceStagedGenerationJob("user-1", "job-1");

    expect(result.currentStage).toBe("final-validation");
    expect(stageMocks.repairStagedPeriod).not.toHaveBeenCalled();
    expect(stageMocks.reassembleStagedRepairs).not.toHaveBeenCalled();
    expect(storeMocks.readGenerationJobArtifact).toHaveBeenCalledTimes(3);
  });

  it("writes the final artifact and advances an accepted lesson to persistence", async () => {
    const current = job("final-validation", { stageCursor: { position: 0, total: 1 } });
    const updated = job("persistence", { stageCursor: { position: 0, total: 1 } });
    const inputArtifact = persistedInput();
    const assemblyArtifact = { subjectKind: "math", repairApplied: true, lesson: {} };
    const blueprintArtifact = { subjectKind: "math", blueprint: {} };
    const finalArtifact = {
      subjectKind: "math",
      canPersist: true,
      decision: "persist",
      summary: { errors: 0 },
      lesson: {},
    };
    storeMocks.getGenerationJobForUser.mockResolvedValueOnce(current).mockResolvedValueOnce(updated);
    storeMocks.readGenerationJobArtifact
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ payload: inputArtifact })
      .mockResolvedValueOnce({ payload: assemblyArtifact })
      .mockResolvedValueOnce({ payload: blueprintArtifact });
    stageMocks.finalizeStagedLesson.mockReturnValue(finalArtifact);

    const result = await advanceStagedGenerationJob("user-1", "job-1");

    expect(result.currentStage).toBe("persistence");
    expect(stageMocks.finalizeStagedLesson).toHaveBeenCalledWith(
      expect.objectContaining({ subject: "Toán" }),
      assemblyArtifact,
      blueprintArtifact,
    );
    expect(storeMocks.writeGenerationJobArtifact).toHaveBeenCalledWith(
      "job-1",
      { kind: "final" },
      finalArtifact,
    );
    expect(storeMocks.updateLeasedGenerationJob).toHaveBeenCalledWith(
      "job-1",
      "user-1",
      expect.any(String),
      expect.objectContaining({
        currentStage: "persistence",
        stageCursor: { position: 0, total: 1 },
        error: null,
      }),
    );
  });

  it("skips persistence and routes a rejected lesson to quota settlement", async () => {
    const current = job("final-validation", { stageCursor: { position: 0, total: 1 } });
    const updated = job("quota-settlement", { stageCursor: { position: 0, total: 1 } });
    const finalArtifact = {
      subjectKind: "math",
      canPersist: false,
      decision: "reject",
      blockingCodes: ["MATH-QUALITY-01"],
      summary: { errors: 2 },
      lesson: {},
    };
    storeMocks.getGenerationJobForUser.mockResolvedValueOnce(current).mockResolvedValueOnce(updated);
    storeMocks.readGenerationJobArtifact
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ payload: persistedInput() })
      .mockResolvedValueOnce({ payload: { subjectKind: "math", lesson: {} } })
      .mockResolvedValueOnce({ payload: { subjectKind: "math", blueprint: {} } });
    stageMocks.finalizeStagedLesson.mockReturnValue(finalArtifact);

    const result = await advanceStagedGenerationJob("user-1", "job-1");

    expect(result.currentStage).toBe("quota-settlement");
    expect(storeMocks.updateLeasedGenerationJob).toHaveBeenCalledWith(
      "job-1",
      "user-1",
      expect.any(String),
      expect.objectContaining({
        currentStage: "quota-settlement",
        error: expect.objectContaining({
          code: "FINAL_VALIDATION_BLOCKED",
          stage: "final-validation",
          retryable: false,
        }),
      }),
    );
  });

  it("reuses an existing final artifact without validating again", async () => {
    const current = job("final-validation", { stageCursor: { position: 0, total: 1 } });
    const updated = job("persistence", { stageCursor: { position: 0, total: 1 } });
    storeMocks.getGenerationJobForUser.mockResolvedValueOnce(current).mockResolvedValueOnce(updated);
    storeMocks.readGenerationJobArtifact.mockResolvedValueOnce({
      payload: { canPersist: true, decision: "persist", summary: { errors: 0 } },
    });

    await advanceStagedGenerationJob("user-1", "job-1");

    expect(stageMocks.finalizeStagedLesson).not.toHaveBeenCalled();
    expect(storeMocks.writeGenerationJobArtifact).not.toHaveBeenCalledWith(
      "job-1",
      { kind: "final" },
      expect.anything(),
    );
    expect(storeMocks.readGenerationJobArtifact).toHaveBeenCalledOnce();
  });

  it("persists an accepted final lesson once and advances to quota settlement", async () => {
    const current = job("persistence");
    const updated = job("quota-settlement", { lessonId: "staged-job-1" });
    const finalArtifact = {
      subjectKind: "math",
      decision: "persist",
      canPersist: true,
      repairApplied: false,
      summary: { errors: 0 },
      lesson: { generalInfo: { lessonTitle: "Phép cộng" } },
    };
    storeMocks.getGenerationJobForUser.mockResolvedValueOnce(current).mockResolvedValueOnce(updated);
    storeMocks.readGenerationJobArtifact.mockResolvedValueOnce({ payload: finalArtifact });

    const result = await advanceStagedGenerationJob("user-1", "job-1");

    expect(result.lessonId).toBe("staged-job-1");
    expect(persistenceMocks.persistStagedGeneratedLesson).toHaveBeenCalledOnce();
    expect(persistenceMocks.persistStagedGeneratedLesson).toHaveBeenCalledWith(
      "user-1",
      "job-1",
      finalArtifact.lesson,
    );
    expect(storeMocks.updateLeasedGenerationJob).toHaveBeenCalledWith(
      "job-1",
      "user-1",
      expect.any(String),
      expect.objectContaining({
        status: "waiting_next_step",
        currentStage: "quota-settlement",
        lessonId: "staged-job-1",
      }),
    );
    expect(usageMocks.commitUsage).not.toHaveBeenCalled();
    expect(usageMocks.releaseUsage).not.toHaveBeenCalled();
  });

  it("persists a free draft final lesson and advances to quota settlement", async () => {
    const current = job("persistence");
    const updated = job("quota-settlement", { lessonId: "staged-job-1" });
    const finalArtifact = {
      subjectKind: "math",
      decision: "draft",
      canPersist: true,
      repairApplied: true,
      fatalCodes: [],
      blockingCodes: ["MATH-PERIOD"],
      summary: { errors: 1, warnings: 0 },
      lesson: {
        generalInfo: { lessonTitle: "Phép cộng" },
        meta: { validationStatus: "needs_adjustment", freeDraft: true },
      },
    };
    storeMocks.getGenerationJobForUser.mockResolvedValueOnce(current).mockResolvedValueOnce(updated);
    storeMocks.readGenerationJobArtifact.mockResolvedValueOnce({ payload: finalArtifact });

    const result = await advanceStagedGenerationJob("user-1", "job-1");

    expect(result.lessonId).toBe("staged-job-1");
    expect(persistenceMocks.persistStagedGeneratedLesson).toHaveBeenCalledWith(
      "user-1",
      "job-1",
      finalArtifact.lesson,
    );
    expect(storeMocks.updateLeasedGenerationJob).toHaveBeenCalledWith(
      "job-1",
      "user-1",
      expect.any(String),
      expect.objectContaining({
        status: "waiting_next_step",
        currentStage: "quota-settlement",
        lessonId: "staged-job-1",
      }),
    );
  });

  it("reuses the job lesson ID on a persistence retry without saving again", async () => {
    const current = job("persistence", { lessonId: "staged-job-1" });
    const updated = job("quota-settlement", { lessonId: "staged-job-1" });
    storeMocks.getGenerationJobForUser.mockResolvedValueOnce(current).mockResolvedValueOnce(updated);
    storeMocks.readGenerationJobArtifact.mockResolvedValueOnce({
      payload: {
        decision: "persist",
        canPersist: true,
        lesson: { generalInfo: { lessonTitle: "Phép cộng" } },
      },
    });

    await advanceStagedGenerationJob("user-1", "job-1");

    expect(persistenceMocks.persistStagedGeneratedLesson).not.toHaveBeenCalled();
    expect(storeMocks.updateLeasedGenerationJob).toHaveBeenCalledWith(
      "job-1",
      "user-1",
      expect.any(String),
      expect.objectContaining({ lessonId: "staged-job-1", currentStage: "quota-settlement" }),
    );
  });

  it("does not persist a rejected final artifact", async () => {
    storeMocks.getGenerationJobForUser.mockResolvedValueOnce(job("persistence"));
    storeMocks.readGenerationJobArtifact.mockResolvedValueOnce({
      payload: {
        decision: "reject",
        canPersist: false,
        summary: { errors: 1 },
        lesson: {},
      },
    });

    await expect(advanceStagedGenerationJob("user-1", "job-1"))
      .rejects.toMatchObject({ code: "FINAL_ARTIFACT_NOT_PERSISTABLE" });
    expect(persistenceMocks.persistStagedGeneratedLesson).not.toHaveBeenCalled();
  });

  it("commits accepted usage and completes the saved job at 100 percent", async () => {
    const current = job("quota-settlement", { lessonId: "staged-job-1" });
    const updated = job("completed", {
      status: "completed",
      lessonId: "staged-job-1",
      progress: {
        ...current.progress,
        percent: 100,
        completedUnits: current.progress.totalUnits,
      },
    });
    const finalArtifact = {
      subjectKind: "math",
      decision: "persist",
      canPersist: true,
      repairApplied: true,
      summary: { errors: 0, warnings: 1 },
      lesson: {},
    };
    storeMocks.getGenerationJobForUser.mockResolvedValueOnce(current).mockResolvedValueOnce(updated);
    storeMocks.readGenerationJobArtifact.mockResolvedValueOnce({ payload: finalArtifact });

    const result = await advanceStagedGenerationJob("user-1", "job-1");

    expect(result.status).toBe("completed");
    expect(result.progress.percent).toBe(100);
    expect(usageMocks.commitUsage).toHaveBeenCalledWith(
      current.quotaReservation,
      "staged-job-1",
      expect.objectContaining({
        jobId: "job-1",
        outcome: "success",
        validationDecision: "persist",
      }),
    );
    expect(lifecycleMocks.cleanupGenerationJobInput).toHaveBeenCalledWith(current);
    expect(storeMocks.updateLeasedGenerationJob).toHaveBeenCalledWith(
      "job-1",
      "user-1",
      expect.any(String),
      expect.objectContaining({
        status: "completed",
        currentStage: "completed",
        progress: expect.objectContaining({ percent: 100, completedUnits: 11 }),
        error: null,
      }),
    );
    expect(usageMocks.releaseUsage).not.toHaveBeenCalled();
  });

  it("releases rejected usage, keeps the validation error, and terminates below 100 percent", async () => {
    const current = job("quota-settlement", {
      error: {
        code: "FINAL_VALIDATION_BLOCKED",
        message: "Blocked",
        stage: "final-validation",
        retryable: false,
      },
    });
    const updated = job("quota-settlement", {
      status: "failed",
      progress: { ...current.progress, percent: 82 },
      error: current.error,
    });
    const finalArtifact = {
      subjectKind: "math",
      decision: "reject",
      canPersist: false,
      repairApplied: true,
      summary: { errors: 2, warnings: 0 },
      lesson: {},
    };
    storeMocks.getGenerationJobForUser.mockResolvedValueOnce(current).mockResolvedValueOnce(updated);
    storeMocks.readGenerationJobArtifact.mockResolvedValueOnce({ payload: finalArtifact });

    const result = await advanceStagedGenerationJob("user-1", "job-1");

    expect(result.status).toBe("failed");
    expect(result.progress.percent).toBeLessThan(100);
    expect(usageMocks.releaseUsage).toHaveBeenCalledWith(
      current.quotaReservation,
      "staged_final_validation_rejected",
      expect.objectContaining({
        jobId: "job-1",
        outcome: "rejected",
        validationDecision: "reject",
      }),
    );
    expect(lifecycleMocks.cleanupGenerationJobInput).toHaveBeenCalledWith(current);
    expect(storeMocks.updateLeasedGenerationJob).toHaveBeenCalledWith(
      "job-1",
      "user-1",
      expect.any(String),
      expect.objectContaining({
        status: "failed",
        currentStage: "quota-settlement",
        error: expect.objectContaining({
          code: "FINAL_VALIDATION_BLOCKED",
          stage: "final-validation",
          retryable: false,
        }),
      }),
    );
    expect(usageMocks.commitUsage).not.toHaveBeenCalled();
  });

  it("returns the actionable title message when final settlement rejects title identity", async () => {
    const current = job("quota-settlement", {
      error: {
        code: "FINAL_VALIDATION_BLOCKED",
        message: "Blocked",
        stage: "final-validation",
        retryable: false,
      },
    });
    const updated = job("quota-settlement", {
      status: "failed",
      error: {
        code: "LESSON_TITLE_UNRESOLVED",
        message: LESSON_TITLE_REQUIRED_MESSAGE,
        stage: "final-validation",
        retryable: false,
      },
    });
    storeMocks.getGenerationJobForUser.mockResolvedValueOnce(current).mockResolvedValueOnce(updated);
    storeMocks.readGenerationJobArtifact.mockResolvedValueOnce({
      payload: {
        subjectKind: "science",
        decision: "reject",
        canPersist: false,
        repairApplied: false,
        fatalCodes: ["STAGED-TITLE-01"],
        blockingCodes: ["STAGED-TITLE-01"],
        summary: { errors: 1, warnings: 0 },
        lesson: {},
      },
    });

    const result = await advanceStagedGenerationJob("user-1", "job-1");

    expect(result.error).toMatchObject({
      code: "LESSON_TITLE_UNRESOLVED",
      message: LESSON_TITLE_REQUIRED_MESSAGE,
      retryable: false,
    });
    expect(storeMocks.updateLeasedGenerationJob).toHaveBeenCalledWith(
      "job-1",
      "user-1",
      expect.any(String),
      expect.objectContaining({
        status: "failed",
        error: expect.objectContaining({
          code: "LESSON_TITLE_UNRESOLVED",
          message: LESSON_TITLE_REQUIRED_MESSAGE,
          retryable: false,
        }),
      }),
    );
    expect(usageMocks.releaseUsage).toHaveBeenCalledWith(
      current.quotaReservation,
      "staged_final_validation_rejected",
      expect.anything(),
    );
  });

  it("fails defensively without accounting when an accepted job lost its reservation", async () => {
    const current = job("quota-settlement", {
      lessonId: "staged-job-1",
      quotaReservationId: null,
      quotaReservation: null,
    });
    const updated = job("quota-settlement", {
      status: "failed",
      lessonId: "staged-job-1",
      quotaReservationId: null,
      quotaReservation: null,
      error: {
        code: "QUOTA_RESERVATION_MISSING",
        message: "Missing",
        stage: "quota-settlement",
        retryable: false,
      },
    });
    storeMocks.getGenerationJobForUser.mockResolvedValueOnce(current).mockResolvedValueOnce(updated);
    storeMocks.readGenerationJobArtifact.mockResolvedValueOnce({
      payload: {
        subjectKind: "math",
        decision: "persist",
        canPersist: true,
        repairApplied: false,
        summary: { errors: 0 },
        lesson: {},
      },
    });

    const result = await advanceStagedGenerationJob("user-1", "job-1");

    expect(result.status).toBe("failed");
    expect(usageMocks.commitUsage).not.toHaveBeenCalled();
    expect(usageMocks.releaseUsage).not.toHaveBeenCalled();
    expect(lifecycleMocks.cleanupGenerationJobInput).toHaveBeenCalledWith(current);
    expect(storeMocks.updateLeasedGenerationJob).toHaveBeenCalledWith(
      "job-1",
      "user-1",
      expect.any(String),
      expect.objectContaining({
        status: "failed",
        error: expect.objectContaining({
          code: "QUOTA_RESERVATION_MISSING",
          retryable: false,
        }),
      }),
    );
  });

  it("refunds the reservation when an accepted job lost its persisted lesson ID", async () => {
    const current = job("quota-settlement", { lessonId: null });
    const updated = job("quota-settlement", {
      status: "failed",
      lessonId: null,
      error: {
        code: "PERSISTED_LESSON_MISSING",
        message: "Missing",
        stage: "quota-settlement",
        retryable: false,
      },
    });
    storeMocks.getGenerationJobForUser.mockResolvedValueOnce(current).mockResolvedValueOnce(updated);
    storeMocks.readGenerationJobArtifact.mockResolvedValueOnce({
      payload: {
        subjectKind: "math",
        decision: "persist",
        canPersist: true,
        repairApplied: false,
        summary: { errors: 0 },
        lesson: {},
      },
    });

    const result = await advanceStagedGenerationJob("user-1", "job-1");

    expect(result.status).toBe("failed");
    expect(usageMocks.releaseUsage).toHaveBeenCalledWith(
      current.quotaReservation,
      "staged_quota_settlement_invariant",
      expect.objectContaining({
        jobId: "job-1",
        code: "PERSISTED_LESSON_MISSING",
      }),
    );
    expect(lifecycleMocks.cleanupGenerationJobInput).toHaveBeenCalledWith(current);
    expect(usageMocks.commitUsage).not.toHaveBeenCalled();
  });

  it("keeps quota settlement retryable when terminal input cleanup fails", async () => {
    const current = job("quota-settlement", { lessonId: "staged-job-1" });
    storeMocks.getGenerationJobForUser.mockResolvedValueOnce(current);
    storeMocks.readGenerationJobArtifact.mockResolvedValueOnce({
      payload: {
        subjectKind: "math",
        decision: "persist",
        canPersist: true,
        repairApplied: false,
        summary: { errors: 0 },
        lesson: {},
      },
    });
    lifecycleMocks.cleanupGenerationJobInput.mockRejectedValueOnce(new Error("cleanup unavailable"));

    await expect(advanceStagedGenerationJob("user-1", "job-1"))
      .rejects.toMatchObject({ code: "GENERATION_STEP_FAILED" });

    expect(usageMocks.commitUsage).toHaveBeenCalledOnce();
    expect(storeMocks.updateLeasedGenerationJob).not.toHaveBeenCalledWith(
      "job-1",
      "user-1",
      expect.any(String),
      expect.objectContaining({ status: "completed" }),
    );
    expect(storeMocks.updateLeasedGenerationJob).toHaveBeenCalledWith(
      "job-1",
      "user-1",
      expect.any(String),
      expect.objectContaining({
        status: "waiting_next_step",
        error: expect.objectContaining({ retryable: true }),
      }),
    );
  });

  it("settles and returns an expired job before acquiring a worker lease", async () => {
    const current = job("ocr", {
      expiresAt: new Date(Date.now() - 60_000),
    });
    const expired = job("ocr", {
      status: "failed",
      expiresAt: current.expiresAt,
      error: {
        code: "GENERATION_JOB_EXPIRED",
        message: "Expired",
        stage: "ocr",
        retryable: false,
      },
    });
    storeMocks.getGenerationJobForUser.mockResolvedValueOnce(current);
    lifecycleMocks.expireStagedGenerationJobIfNeeded.mockResolvedValueOnce(expired);

    const result = await advanceStagedGenerationJob("user-1", "job-1");

    expect(result.status).toBe("failed");
    expect(lifecycleMocks.expireStagedGenerationJobIfNeeded).toHaveBeenCalledWith("user-1", "job-1");
    expect(storeMocks.acquireGenerationJobLease).not.toHaveBeenCalled();
  });

  it("releases the lease when the job is cancelled before execution starts", async () => {
    storeMocks.getGenerationJobForUser.mockResolvedValue(job("ocr"));
    storeMocks.updateLeasedGenerationJob.mockResolvedValue(false);
    await expect(advanceStagedGenerationJob("user-1", "job-1"))
      .rejects.toMatchObject({ code: "GENERATION_JOB_LEASE_LOST" });
    expect(storeMocks.releaseGenerationJobLease).toHaveBeenCalledOnce();
  });
});
