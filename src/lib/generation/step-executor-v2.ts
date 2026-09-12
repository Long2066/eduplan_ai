import "server-only";
import { randomUUID } from "node:crypto";
import { finalizeStagedLesson, type StagedFinalArtifact } from "@/lib/generation/final-validation";
import { GenerationJobRequestError } from "@/lib/generation/job-input";
import {
  acquireGenerationCheckpointLease,
  commitGenerationJobCheckpoint,
  getGenerationJobForUser,
  readGenerationJobArtifact,
  releaseGenerationJobLease,
  GenerationJobConflictError,
} from "@/lib/generation/job-store";
import { lessonInputFromPersisted } from "@/lib/generation/input-storage";
import {
  cleanupGenerationJobInput,
  expireStagedGenerationJobIfNeeded,
} from "@/lib/generation/lifecycle";
import { runOpenAiOcrAsset, sortGenerationOcrAssets } from "@/lib/generation/ocr";
import { persistStagedGeneratedLesson } from "@/lib/generation/persistence";
import {
  GenerationTimeoutError,
  withGenerationDeadline,
  type GenerationContext,
} from "@/lib/generation/runtime";
import {
  LESSON_TITLE_REQUIRED_MESSAGE,
  LessonTitleResolutionError,
} from "@/lib/lesson-title";
import { commitUsage, releaseUsage } from "@/lib/subscription-policy";
import { getPlanModelStrategy } from "@/lib/model-strategy";
import {
  STAGED_PHASES,
  type StagedAssessmentArtifact,
  type StagedLessonMapArtifact,
  type StagedMaterialsArtifact,
  type StagedOutcomesArtifact,
  type StagedPeriodBlueprintArtifact,
  type StagedPhaseArtifact,
  type StagedPhaseName,
  type StagedSectionArtifacts,
  type StagedSectionIssue,
  type StagedSectionPrefixOptions,
  type StagedSectionsAssembly,
  type StagedSourceFactsArtifact,
} from "@/lib/generation/section-types";
import {
  assembleStagedSections,
} from "@/lib/generation/section-assembly";
import {
  generateStagedAssessment,
  generateStagedLessonMap,
  generateStagedMaterials,
  generateStagedOutcomes,
  generateStagedPeriodBlueprint,
  generateStagedSourceFacts,
} from "@/lib/generation/section-generation";
import {
  generateStagedPhase,
  repairStagedPhase,
} from "@/lib/generation/phase-generation";
import {
  StagedSectionValidationError,
  validateStagedSectionPrefix,
} from "@/lib/generation/section-validation";
import { validateStagedLesson } from "@/lib/generation/subject-validation";
import type { StagedAssemblyArtifact } from "@/lib/generation/assembly";
import type { StagedBlueprintArtifact } from "@/lib/generation/blueprint";
import { prepareStagedSourceContext, type StagedSourceContext } from "@/lib/generation/source-preparation";
import type {
  GenerationArtifactKey,
  GenerationJob,
  GenerationJobAssetMetadata,
  GenerationJobError,
  GenerationJobProgress,
  GenerationJobStage,
  GenerationJobTelemetry,
  PersistedGenerationInput,
} from "@/lib/generation/job-types";
import type { UploadedAsset } from "@/types/lesson";
import type { StagedOcrArtifact, StagedOcrPageArtifact } from "@/lib/generation/step-executor";
import { normalizeSecurityGenerationCalls, summarizeSecurityGenerationCalls } from "@shared/security-contract";

export const MAX_UNIT_ATTEMPTS = 3;

export function flatPhaseSequence(periodNumber: number, phase: StagedPhaseName): number {
  const phaseIndex = STAGED_PHASES.indexOf(phase);
  if (phaseIndex < 0) throw new Error(`Pha không hợp lệ: ${phase}`);
  return (periodNumber - 1) * 4 + phaseIndex + 1;
}

export function phaseFromSequence(sequence: number): { periodNumber: number; phase: StagedPhaseName } {
  const zeroIndexed = sequence - 1;
  const periodNumber = Math.floor(zeroIndexed / 4) + 1;
  const phaseIndex = zeroIndexed % 4;
  return { periodNumber, phase: STAGED_PHASES[phaseIndex] };
}

function unitKeyForStage(stage: GenerationJobStage, position: number): string {
  return `${stage}:${position}`;
}

function progressAfterUnit(job: GenerationJob, message: string): GenerationJobProgress {
  const completedUnits = Math.min(job.progress.totalUnits, job.progress.completedUnits + 1);
  return {
    ...job.progress,
    completedUnits,
    percent: Math.min(99, Math.round((completedUnits / job.progress.totalUnits) * 100)),
    message,
  };
}

function stagedStepTimeoutMs(stage?: GenerationJobStage) {
  const defaultTimeout = stage === "period-phase" || stage === "phase-repair"
    ? Number(process.env.GENERATION_PHASE_STEP_TIMEOUT_MS || 120_000)
    : Number(process.env.GENERATION_STEP_TIMEOUT_MS || 150_000);
  const configured = Number.isFinite(defaultTimeout) ? defaultTimeout : 150_000;
  return Math.min(240_000, Math.max(30_000, Math.floor(configured)));
}

async function requiredInputArtifact(jobId: string): Promise<PersistedGenerationInput> {
  const artifact = await readGenerationJobArtifact<PersistedGenerationInput>(jobId, { kind: "input" });
  if (!artifact) throw new Error("Không tìm thấy dữ liệu đầu vào của generation job.");
  return artifact.payload;
}

async function requiredOcrArtifact(jobId: string): Promise<StagedOcrArtifact> {
  const artifact = await readGenerationJobArtifact<StagedOcrArtifact>(jobId, { kind: "ocr" });
  if (!artifact) throw new Error("Không tìm thấy kết quả OCR của generation job.");
  return artifact.payload;
}

async function requiredSourceContext(jobId: string): Promise<StagedSourceContext> {
  const artifact = await readGenerationJobArtifact<StagedSourceContext>(jobId, { kind: "source-context" });
  if (!artifact) throw new Error("Không tìm thấy dữ liệu nguồn của generation job.");
  return artifact.payload;
}

async function requiredSourceFacts(jobId: string): Promise<StagedSourceFactsArtifact> {
  const artifact = await readGenerationJobArtifact<StagedSourceFactsArtifact>(jobId, { kind: "source-facts" });
  if (!artifact) throw new Error("Không tìm thấy dữ kiện nguồn (source-facts) đã lưu.");
  return artifact.payload;
}

async function requiredOutcomes(jobId: string): Promise<StagedOutcomesArtifact> {
  const artifact = await readGenerationJobArtifact<StagedOutcomesArtifact>(jobId, { kind: "section-outcomes" });
  if (!artifact) throw new Error("Không tìm thấy YCCĐ (section-outcomes) đã lưu.");
  return artifact.payload;
}

async function requiredLessonMap(jobId: string): Promise<StagedLessonMapArtifact> {
  const artifact = await readGenerationJobArtifact<StagedLessonMapArtifact>(jobId, { kind: "lesson-map" });
  if (!artifact) throw new Error("Không tìm thấy tiến trình bài học (lesson-map) đã lưu.");
  return artifact.payload;
}

async function requiredMaterials(jobId: string): Promise<StagedMaterialsArtifact> {
  const artifact = await readGenerationJobArtifact<StagedMaterialsArtifact>(jobId, { kind: "section-materials" });
  if (!artifact) throw new Error("Không tìm thấy đồ dùng dạy học (section-materials) đã lưu.");
  return artifact.payload;
}

async function requiredFinalArtifact(jobId: string): Promise<StagedFinalArtifact> {
  const artifact = await readGenerationJobArtifact<StagedFinalArtifact>(jobId, { kind: "final" });
  if (!artifact) throw new Error("Không tìm thấy kết quả kiểm tra cuối của generation job.");
  return artifact.payload;
}

function assertExpectedOcrAsset(
  expected: GenerationJobAssetMetadata,
  received: UploadedAsset | undefined,
  sequence: number,
  total: number,
) {
  if (!received) {
    throw new GenerationJobRequestError(
      `Cần gửi lại ảnh SGK ${sequence}/${total} để tiếp tục OCR.`,
      "GENERATION_OCR_ASSET_REQUIRED",
      409,
    );
  }
  if (received.id !== expected.id || received.name !== expected.name) {
    throw new GenerationJobRequestError(
      `Ảnh SGK ${sequence}/${total} không khớp thứ tự của generation job.`,
      "GENERATION_OCR_ASSET_MISMATCH",
      409,
    );
  }
  return received;
}

function telemetryWithExecution(job: GenerationJob, context: GenerationContext): GenerationJobTelemetry {
  const currentEntries = job.telemetry?.entries || {};
  const normalizedCalls = normalizeSecurityGenerationCalls(context.calls || []);
  const executionKey = `${job.currentStage}:${job.stageCursor.position}:${job.attempt}`;
  return {
    entries: {
      ...currentEntries,
      [executionKey]: {
        executionKey,
        stage: job.currentStage,
        attempt: job.attempt,
        recordedAt: new Date(),
        calls: normalizedCalls,
      },
    },
  };
}

function quotaSettlementTelemetry(
  job: GenerationJob,
  finalArtifact: StagedFinalArtifact,
  outcome: "success" | "rejected",
) {
  const aggregatedCalls = summarizeSecurityGenerationCalls(
    Object.values(job.telemetry?.entries || {}).flatMap((entry) => entry.calls || []),
  );
  return {
    version: 2,
    pipelineVersion: job.pipelineVersion,
    jobId: job.id,
    stage: job.currentStage,
    outcome,
    decision: finalArtifact.decision,
    canPersist: finalArtifact.canPersist,
    repairApplied: finalArtifact.repairApplied,
    fatalCodes: finalArtifact.fatalCodes,
    blockingCodes: finalArtifact.blockingCodes,
    findingsCount: finalArtifact.summary.total,
    errorsCount: finalArtifact.summary.errors,
    warningsCount: finalArtifact.summary.warnings,
    callsCount: aggregatedCalls.callCount,
    successfulCallCount: aggregatedCalls.successfulCallCount,
    failedCallCount: aggregatedCalls.failedCallCount,
    fallbackCallCount: aggregatedCalls.fallbackCallCount,
    totalTokens: aggregatedCalls.totalTokens,
    elapsedMs: aggregatedCalls.elapsedMs,
    periods: job.inputSummary.periods,
  };
}

function assertLockedSectionPrefix(options: StagedSectionPrefixOptions): void {
  const validation = validateStagedSectionPrefix(options);
  if (!validation.passed) {
    throw new GenerationJobRequestError(
      `Dữ liệu đã khóa không đạt chuẩn: ${validation.issues.map((i) => `[${i.code}] ${i.message}`).join("; ")}. Không thể sửa bằng cách thử lại bước hiện tại. Hãy hủy yêu cầu và tạo lại.`,
      "GENERATION_LOCKED_PREREQUISITE_INVALID",
      422,
    );
  }
}

async function loadAllPeriodBlueprints(jobId: string, totalPeriods: number): Promise<StagedPeriodBlueprintArtifact[]> {
  const list: StagedPeriodBlueprintArtifact[] = [];
  for (let seq = 1; seq <= totalPeriods; seq += 1) {
    const art = await readGenerationJobArtifact<StagedPeriodBlueprintArtifact>(jobId, { kind: "period-blueprint", sequence: seq });
    if (!art) throw new Error(`Không tìm thấy khung tiết ${seq}/${totalPeriods}.`);
    list.push(art.payload);
  }
  return list;
}

export async function loadEffectivePhases(jobId: string, totalPhases: number): Promise<StagedPhaseArtifact[]> {
  const phases: StagedPhaseArtifact[] = [];
  for (let seq = 1; seq <= totalPhases; seq += 1) {
    const orig = await readGenerationJobArtifact<StagedPhaseArtifact>(jobId, { kind: "period-phase", sequence: seq });
    if (!orig) throw new Error(`Không tìm thấy artifact của pha thứ ${seq}/${totalPhases}.`);
    const repair = await readGenerationJobArtifact<{ artifact: StagedPhaseArtifact; baseAnchor?: { hash: string } }>(jobId, { kind: "phase-repair", sequence: seq });
    if (repair?.payload?.artifact && (!repair.payload.baseAnchor || repair.payload.baseAnchor.hash === orig.payload.anchor.hash)) {
      phases.push(repair.payload.artifact);
      continue;
    }
    phases.push(orig.payload);
  }
  return phases;
}

export async function advanceStagedGenerationJobV2(
  uid: string,
  jobId: string,
  submittedAsset?: UploadedAsset,
): Promise<GenerationJob> {
  const initialJob = await getGenerationJobForUser(jobId, uid);
  if (!initialJob) {
    throw new GenerationJobRequestError("Không tìm thấy yêu cầu tạo giáo án.", "GENERATION_JOB_NOT_FOUND", 404);
  }
  if (!["completed", "failed", "cancelled"].includes(initialJob.status) && initialJob.expiresAt.getTime() <= Date.now()) {
    const expired = await expireStagedGenerationJobIfNeeded(uid, jobId);
    if (expired) return expired;
  }
  if (["completed", "failed", "cancelled"].includes(initialJob.status)) {
    throw new GenerationJobConflictError("Generation job không còn có thể chạy tiếp.", "GENERATION_JOB_TERMINAL");
  }
  if (initialJob.status === "waiting_next_step" && initialJob.error?.retryable === false) {
    return initialJob;
  }

  const advanceableStages: GenerationJobStage[] = [
    "ocr",
    "source-preparation",
    "source-facts",
    "section-outcomes",
    "lesson-map",
    "period-blueprint",
    "section-materials",
    "period-phase",
    "section-assessment",
    "assembly",
    "subject-validation",
    "phase-repair",
    "final-validation",
    "persistence",
    "quota-settlement",
  ];
  if (!advanceableStages.includes(initialJob.currentStage)) {
    throw new GenerationJobConflictError("Generation job chưa ở bước có thể chạy.", "GENERATION_STAGE_NOT_ADVANCEABLE");
  }

  const owner = randomUUID();
  const stepTimeoutMs = stagedStepTimeoutMs(initialJob.currentStage);
  const leaseResult = await acquireGenerationCheckpointLease(jobId, uid, owner, stepTimeoutMs + 15_000);
  if (!leaseResult) {
    throw new GenerationJobConflictError(
      "Một tiến trình khác đang xử lý bước này. Vui lòng đợi rồi thử lại.",
      "GENERATION_JOB_BUSY",
    );
  }

  const { job, epoch } = leaseResult;
  const unitKey = unitKeyForStage(job.currentStage, job.stageCursor.position);
  const currentAttempts = Number(job.unitAttempts?.[unitKey] || 0);

  // Check attempt exhaustion before executing AI
  if (currentAttempts >= MAX_UNIT_ATTEMPTS && job.currentStage !== "ocr" && job.currentStage !== "quota-settlement") {
    const exhaustionError: GenerationJobError = {
      code: "SECTION_UNIT_ATTEMPTS_EXHAUSTED",
      message: `Đơn vị "${unitKey}" đã thử ${currentAttempts}/${MAX_UNIT_ATTEMPTS} lần nhưng không đạt. Quá trình tạm dừng để tránh lãng phí tài nguyên.`,
      stage: job.currentStage,
      retryable: false,
    };
    await commitGenerationJobCheckpoint(job.id, uid, owner, epoch, {
      expectedStage: job.currentStage,
      expectedPosition: job.stageCursor.position,
      patch: {
        status: "waiting_next_step",
        error: exhaustionError,
        progress: {
          ...job.progress,
          message: exhaustionError.message,
        },
      },
    });
    await releaseGenerationJobLease(job.id, uid, owner).catch(() => undefined);
    const exhaustedJob = await getGenerationJobForUser(job.id, uid);
    return exhaustedJob || job;
  }

  // Preflight increment unit attempts durably in checkpoint transaction
  const nextUnitAttempts = {
    ...(job.unitAttempts || {}),
    [unitKey]: currentAttempts + 1,
  };
  const useFallback = currentAttempts > 0;

  const telemetryHolder: { current: GenerationContext | null } = { current: null };

  try {
    await commitGenerationJobCheckpoint(job.id, uid, owner, epoch, {
      expectedStage: job.currentStage,
      expectedPosition: job.stageCursor.position,
      patch: {
        status: "running",
        attempt: job.attempt + 1,
        unitAttempts: nextUnitAttempts,
        error: null,
      },
    });

    await withGenerationDeadline(
      `${job.id}:${job.currentStage}:${job.stageCursor.position}:${epoch}`,
      async () => {
        await executeStagedV2Unit({
          job,
          uid,
          owner,
          epoch,
          submittedAsset,
          useFallback,
          unitAttempts: nextUnitAttempts,
        });
      },
      (context) => {
        telemetryHolder.current = context;
        context.aiPolicy = {
          singleAttempt: true,
          useFallback,
          requestTimeoutMs: stepTimeoutMs,
        };
      },
      stepTimeoutMs,
    );
  } catch (error) {
    if (error instanceof LessonTitleResolutionError) {
      await failUnresolvedLessonTitleV2(job, uid, owner, epoch);
      throw new GenerationJobRequestError(
        LESSON_TITLE_REQUIRED_MESSAGE,
        "LESSON_TITLE_UNRESOLVED",
        422,
      );
    }

    const lockedPrerequisiteError = error instanceof GenerationJobRequestError
      && error.code === "GENERATION_LOCKED_PREREQUISITE_INVALID";
    if (error instanceof GenerationJobConflictError || (error instanceof GenerationJobRequestError && !lockedPrerequisiteError)) {
      throw error;
    }

    const nonAiStages: GenerationJobStage[] = [
      "assembly",
      "subject-validation",
      "final-validation",
      "persistence",
      "quota-settlement",
    ];
    const isDeterministicStage = nonAiStages.includes(job.currentStage);
    const isDeterministicError = error instanceof StagedSectionValidationError
      || (error instanceof Error && (error.message.includes("SEC-") || error.message.includes("LC-STRUCT")));
    const shouldStopRetrying = lockedPrerequisiteError || (isDeterministicStage && isDeterministicError);

    const isTimeout = error instanceof GenerationTimeoutError;
    const isExhausted = (currentAttempts + 1) >= MAX_UNIT_ATTEMPTS;
    const errorPatch: GenerationJobError = {
      code: lockedPrerequisiteError ? error.code : isTimeout ? "GENERATION_STEP_TIMEOUT" : "GENERATION_STEP_FAILED",
      message: error instanceof Error ? error.message : "Không thể chạy bước tạo giáo án.",
      stage: job.currentStage,
      retryable: !shouldStopRetrying && !isExhausted,
    };

    await commitGenerationJobCheckpoint(job.id, uid, owner, epoch, {
      expectedStage: job.currentStage,
      expectedPosition: job.stageCursor.position,
      patch: {
        status: "waiting_next_step",
        error: errorPatch,
        progress: {
          ...job.progress,
          message: lockedPrerequisiteError
            ? "Dữ liệu đã khóa cần tạo lại. Đã dừng, không gọi AI thêm."
            : isExhausted
              ? `Đơn vị "${unitKey}" đã thử đủ ${MAX_UNIT_ATTEMPTS} lần không thành công.`
              : "Bước hiện tại gặp lỗi; có thể tiếp tục thử lại.",
        },
      },
    }).catch(() => undefined);

    throw new GenerationJobRequestError(
      errorPatch.message,
      errorPatch.code,
      lockedPrerequisiteError ? 422 : isTimeout ? 504 : 502,
    );
  } finally {
    if (telemetryHolder.current) {
      const telemetry = telemetryWithExecution(job, telemetryHolder.current);
      await commitGenerationJobCheckpoint(job.id, uid, owner, epoch, {
        expectedStage: job.currentStage,
        expectedPosition: job.stageCursor.position,
        patch: { telemetry },
      }).catch(() => undefined);
    }
    await releaseGenerationJobLease(job.id, uid, owner).catch(() => undefined);
  }

  const updated = await getGenerationJobForUser(job.id, uid);
  if (!updated) {
    throw new GenerationJobRequestError("Không tìm thấy yêu cầu tạo giáo án.", "GENERATION_JOB_NOT_FOUND", 404);
  }
  return updated;
}

type ExecutionContext = {
  job: GenerationJob;
  uid: string;
  owner: string;
  epoch: number;
  submittedAsset?: UploadedAsset;
  useFallback: boolean;
  unitAttempts: Record<string, number>;
};

async function executeStagedV2Unit(ctx: ExecutionContext): Promise<void> {
  const { job } = ctx;
  switch (job.currentStage) {
    case "ocr":
      return executeOcrStepV2(ctx);
    case "source-preparation":
      return executeSourcePreparationStepV2(ctx);
    case "source-facts":
      return executeSourceFactsStepV2(ctx);
    case "section-outcomes":
      return executeSectionOutcomesStepV2(ctx);
    case "lesson-map":
      return executeLessonMapStepV2(ctx);
    case "period-blueprint":
      return executePeriodBlueprintStepV2(ctx);
    case "section-materials":
      return executeSectionMaterialsStepV2(ctx);
    case "period-phase":
      return executePeriodPhaseStepV2(ctx);
    case "section-assessment":
      return executeSectionAssessmentStepV2(ctx);
    case "assembly":
      return executeAssemblyStepV2(ctx);
    case "subject-validation":
      return executeSubjectValidationStepV2(ctx);
    case "phase-repair":
      return executePhaseRepairStepV2(ctx);
    case "final-validation":
      return executeFinalValidationStepV2(ctx);
    case "persistence":
      return executePersistenceStepV2(ctx);
    case "quota-settlement":
      return executeQuotaSettlementStepV2(ctx);
    default:
      throw new Error(`Bước không hỗ trợ trong pipeline v2: ${job.currentStage}`);
  }
}

async function executeOcrStepV2(ctx: ExecutionContext): Promise<void> {
  const { job, uid, owner, epoch, submittedAsset } = ctx;
  const persistedInput = await requiredInputArtifact(job.id);
  const orderedAssets = sortGenerationOcrAssets(
    persistedInput.uploadedAssets as GenerationJobAssetMetadata[],
  );
  const total = orderedAssets.length;
  const position = Math.min(Math.max(0, job.stageCursor.position), total);

  if (total === 0) {
    const emptyOcr: StagedOcrArtifact = {
      text: "",
      sourceHashes: [],
      cacheHitCount: 0,
      cacheMissCount: 0,
      pageCount: 0,
    };
    await commitGenerationJobCheckpoint(job.id, uid, owner, epoch, {
      expectedStage: "ocr",
      expectedPosition: 0,
      artifacts: [{ key: { kind: "ocr" }, payload: emptyOcr }],
      patch: {
        status: "waiting_next_step",
        currentStage: "source-preparation",
        stageCursor: { position: 0, total: 1 },
        progress: progressAfterUnit(job, "Không có ảnh SGK; chuẩn bị dữ liệu nguồn từ form."),
        error: null,
      },
    });
    return;
  }

  if (position < total) {
    const sequence = position + 1;
    let pagePayload: StagedOcrPageArtifact;
    const existing = await readGenerationJobArtifact<StagedOcrPageArtifact>(job.id, { kind: "ocr-page", sequence });
    if (existing) {
      pagePayload = existing.payload;
    } else {
      const asset = assertExpectedOcrAsset(orderedAssets[position], submittedAsset, sequence, total);
      const result = await runOpenAiOcrAsset(asset, position, total);
      pagePayload = {
        index: sequence,
        assetId: asset.id,
        assetName: asset.name,
        text: result.text,
        sourceHash: result.sourceHash,
        cacheHit: result.cacheHit,
        model: result.model,
      };
    }

    const nextPosition = sequence;
    const artifactsToCommit: Array<{ key: GenerationArtifactKey; payload: unknown }> = [
      { key: { kind: "ocr-page", sequence }, payload: pagePayload },
    ];

    if (nextPosition < total) {
      await commitGenerationJobCheckpoint(job.id, uid, owner, epoch, {
        expectedStage: "ocr",
        expectedPosition: position,
        artifacts: artifactsToCommit,
        patch: {
          status: "waiting_next_step",
          stageCursor: { position: nextPosition, total },
          progress: {
            ...job.progress,
            message: `Đã OCR ${nextPosition}/${total} ảnh.`,
          },
          error: null,
        },
      });
      return;
    }

    const aggregate = await aggregateOcrPagesWithLast(job.id, total, pagePayload);
    artifactsToCommit.push({ key: { kind: "ocr" }, payload: aggregate });
    await commitGenerationJobCheckpoint(job.id, uid, owner, epoch, {
      expectedStage: "ocr",
      expectedPosition: position,
      artifacts: artifactsToCommit,
      patch: {
        status: "waiting_next_step",
        currentStage: "source-preparation",
        stageCursor: { position: 0, total: 1 },
        progress: progressAfterUnit(job, "OCR hoàn tất. Đang chờ chuẩn bị dữ liệu nguồn."),
        error: null,
      },
    });
  }
}

async function aggregateOcrPagesWithLast(jobId: string, total: number, lastPage: StagedOcrPageArtifact): Promise<StagedOcrArtifact> {
  const pages: StagedOcrPageArtifact[] = [];
  for (let seq = 1; seq < total; seq += 1) {
    const artifact = await readGenerationJobArtifact<StagedOcrPageArtifact>(jobId, { kind: "ocr-page", sequence: seq });
    if (!artifact) throw new Error(`Thiếu kết quả OCR ảnh ${seq}/${total}.`);
    pages.push(artifact.payload);
  }
  pages.push(lastPage);
  const text = pages.map((page) => page.text).filter(Boolean).join("\n\n--- HẾT ẢNH ---\n\n").trim();
  if (total > 0 && text.length < 40) {
    throw new Error("OpenAI OCR không đọc được đủ nội dung từ ảnh. Hãy thử ảnh rõ hơn, ít nhiễu hơn hoặc crop sát vùng SGK.");
  }
  return {
    text,
    sourceHashes: pages.map((page) => page.sourceHash).filter(Boolean),
    cacheHitCount: pages.filter((page) => page.cacheHit).length,
    cacheMissCount: pages.filter((page) => !page.cacheHit).length,
    pageCount: pages.length,
  };
}

async function executeSourcePreparationStepV2(ctx: ExecutionContext): Promise<void> {
  const { job, uid, owner, epoch } = ctx;
  const existing = await readGenerationJobArtifact<StagedSourceContext>(job.id, { kind: "source-context" });
  if (existing) {
    await commitGenerationJobCheckpoint(job.id, uid, owner, epoch, {
      expectedStage: "source-preparation",
      expectedPosition: 0,
      patch: {
        status: "waiting_next_step",
        currentStage: "source-facts",
        stageCursor: { position: 0, total: 1 },
        progress: progressAfterUnit(job, "Dữ liệu nguồn đã sẵn sàng. Chờ tạo dữ kiện nguồn."),
        error: null,
      },
    });
    return;
  }

  const persistedInput = await requiredInputArtifact(job.id);
  const input = lessonInputFromPersisted(persistedInput);
  const ocr = await requiredOcrArtifact(job.id);
  const sourceContext = await prepareStagedSourceContext(input, ocr.sourceHashes, ocr.text);

  await commitGenerationJobCheckpoint(job.id, uid, owner, epoch, {
    expectedStage: "source-preparation",
    expectedPosition: 0,
    artifacts: [{ key: { kind: "source-context" }, payload: sourceContext }],
    patch: {
      status: "waiting_next_step",
      currentStage: "source-facts",
      stageCursor: { position: 0, total: 1 },
      progress: progressAfterUnit(job, "Dữ liệu nguồn đã sẵn sàng. Đang chờ tạo dữ kiện nguồn."),
      error: null,
    },
  });
}

async function executeSourceFactsStepV2(ctx: ExecutionContext): Promise<void> {
  const { job, uid, owner, epoch } = ctx;
  const existing = await readGenerationJobArtifact<StagedSourceFactsArtifact>(job.id, { kind: "source-facts" });
  let sourceFacts: StagedSourceFactsArtifact;

  const persistedInput = await requiredInputArtifact(job.id);
  const input = lessonInputFromPersisted(persistedInput);

  if (existing) {
    sourceFacts = existing.payload;
  } else {
    const ocr = await requiredOcrArtifact(job.id);
    const sourceContext = await requiredSourceContext(job.id);
    const strategy = getPlanModelStrategy(job.quotaReservation?.plan || "free");
    sourceFacts = await generateStagedSourceFacts({
      input,
      ocrText: ocr.text,
      sourceContext,
      strategy,
    });
  }

  const validation = validateStagedSectionPrefix({ input, sourceFacts });
  if (!validation.passed) {
    throw new Error(`Dữ kiện nguồn không đạt chuẩn: ${validation.issues.map((i) => i.message).join("; ")}`);
  }

  await commitGenerationJobCheckpoint(job.id, uid, owner, epoch, {
    expectedStage: "source-facts",
    expectedPosition: 0,
    artifacts: [{ key: { kind: "source-facts" }, payload: sourceFacts }],
    patch: {
      status: "waiting_next_step",
      currentStage: "section-outcomes",
      stageCursor: { position: 0, total: 1 },
      progress: progressAfterUnit(job, "Đã khóa dữ kiện nguồn. Đang chờ soạn Mục I: Yêu cầu cần đạt."),
      error: null,
    },
  });
}

async function executeSectionOutcomesStepV2(ctx: ExecutionContext): Promise<void> {
  const { job, uid, owner, epoch } = ctx;
  const persistedInput = await requiredInputArtifact(job.id);
  const input = lessonInputFromPersisted(persistedInput);
  const sourceFacts = await requiredSourceFacts(job.id);

  const existing = await readGenerationJobArtifact<StagedOutcomesArtifact>(job.id, { kind: "section-outcomes" });
  let outcomes: StagedOutcomesArtifact;

  if (existing) {
    outcomes = existing.payload;
  } else {
    const strategy = getPlanModelStrategy(job.quotaReservation?.plan || "free");
    outcomes = await generateStagedOutcomes({
      input,
      sourceFacts,
      strategy,
    });
  }

  const validation = validateStagedSectionPrefix({ input, sourceFacts, outcomes });
  if (!validation.passed) {
    throw new Error(`Yêu cầu cần đạt không đạt chuẩn: ${validation.issues.map((i) => i.message).join("; ")}`);
  }

  await commitGenerationJobCheckpoint(job.id, uid, owner, epoch, {
    expectedStage: "section-outcomes",
    expectedPosition: 0,
    artifacts: [{ key: { kind: "section-outcomes" }, payload: outcomes }],
    patch: {
      status: "waiting_next_step",
      currentStage: "lesson-map",
      stageCursor: { position: 0, total: 1 },
      progress: progressAfterUnit(job, "Đã hoàn thành Mục I. Đang chờ xây dựng bản đồ tiến trình."),
      error: null,
    },
  });
}

async function executeLessonMapStepV2(ctx: ExecutionContext): Promise<void> {
  const { job, uid, owner, epoch } = ctx;
  const persistedInput = await requiredInputArtifact(job.id);
  const input = lessonInputFromPersisted(persistedInput);
  const sourceFacts = await requiredSourceFacts(job.id);
  const outcomes = await requiredOutcomes(job.id);

  const existing = await readGenerationJobArtifact<StagedLessonMapArtifact>(job.id, { kind: "lesson-map" });
  assertLockedSectionPrefix({ input, sourceFacts, outcomes, lessonMap: existing?.payload });
  let lessonMap: StagedLessonMapArtifact;

  if (existing) {
    lessonMap = existing.payload;
  } else {
    const strategy = getPlanModelStrategy(job.quotaReservation?.plan || "free");
    lessonMap = await generateStagedLessonMap({
      input,
      sourceFacts,
      outcomes,
      strategy,
      feedback: ctx.useFallback && job.error?.stage === job.currentStage ? job.error.message : undefined,
    });
  }

  const validation = validateStagedSectionPrefix({ input, sourceFacts, outcomes, lessonMap });
  if (!validation.passed) {
    throw new Error(`Bản đồ bài học không đạt chuẩn: ${validation.issues.map((i) => i.message).join("; ")}`);
  }

  const totalPeriods = Math.max(1, Number(input.periods || 1));
  await commitGenerationJobCheckpoint(job.id, uid, owner, epoch, {
    expectedStage: "lesson-map",
    expectedPosition: 0,
    artifacts: [{ key: { kind: "lesson-map" }, payload: lessonMap }],
    patch: {
      status: "waiting_next_step",
      currentStage: "period-blueprint",
      stageCursor: { position: 0, total: totalPeriods },
      progress: progressAfterUnit(job, "Đã lập bản đồ bài học. Đang chờ tạo khung từng tiết."),
      error: null,
    },
  });
}

async function executePeriodBlueprintStepV2(ctx: ExecutionContext): Promise<void> {
  const { job, uid, owner, epoch } = ctx;
  const persistedInput = await requiredInputArtifact(job.id);
  const input = lessonInputFromPersisted(persistedInput);
  const sourceFacts = await requiredSourceFacts(job.id);
  const outcomes = await requiredOutcomes(job.id);
  const lessonMap = await requiredLessonMap(job.id);

  const totalPeriods = Math.max(1, Number(input.periods || 1));
  const position = Math.min(Math.max(0, job.stageCursor.position), totalPeriods);
  const periodNumber = position + 1;

  const existing = await readGenerationJobArtifact<StagedPeriodBlueprintArtifact>(
    job.id,
    { kind: "period-blueprint", sequence: periodNumber },
  );
  const priorBlueprints = await loadAllPeriodBlueprints(job.id, position);
  assertLockedSectionPrefix({
    input, sourceFacts, outcomes, lessonMap,
    periodBlueprints: existing ? [...priorBlueprints, existing.payload] : priorBlueprints,
  });
  let periodBp: StagedPeriodBlueprintArtifact;

  if (existing) {
    periodBp = existing.payload;
  } else {
    const strategy = getPlanModelStrategy(job.quotaReservation?.plan || "free");
    periodBp = await generateStagedPeriodBlueprint({
      input,
      sourceFacts,
      outcomes,
      lessonMap,
      periodNumber,
      strategy,
      feedback: ctx.useFallback && job.error?.stage === job.currentStage ? job.error.message : undefined,
    });
  }

  const allCurrentBlueprints = [...priorBlueprints, periodBp];

  const validation = validateStagedSectionPrefix({
    input,
    sourceFacts,
    outcomes,
    lessonMap,
    periodBlueprints: allCurrentBlueprints,
  });
  if (!validation.passed) {
    throw new Error(`Khung tiết ${periodNumber} không đạt chuẩn: ${validation.issues.map((i) => i.message).join("; ")}`);
  }

  const nextPos = position + 1;
  const isFinished = nextPos >= totalPeriods;

  await commitGenerationJobCheckpoint(job.id, uid, owner, epoch, {
    expectedStage: "period-blueprint",
    expectedPosition: position,
    artifacts: [{ key: { kind: "period-blueprint", sequence: periodNumber }, payload: periodBp }],
    patch: {
      status: "waiting_next_step",
      currentStage: isFinished ? "section-materials" : "period-blueprint",
      stageCursor: isFinished ? { position: 0, total: 1 } : { position: nextPos, total: totalPeriods },
      progress: progressAfterUnit(
        job,
        isFinished
          ? "Đã tạo đủ khung các tiết. Đang chờ soạn Mục II: Đồ dùng dạy học."
          : `Đã tạo khung tiết ${periodNumber}/${totalPeriods}. Đang chờ tiết tiếp theo.`,
      ),
      error: null,
    },
  });
}

async function executeSectionMaterialsStepV2(ctx: ExecutionContext): Promise<void> {
  const { job, uid, owner, epoch } = ctx;
  const persistedInput = await requiredInputArtifact(job.id);
  const input = lessonInputFromPersisted(persistedInput);
  const sourceFacts = await requiredSourceFacts(job.id);
  const outcomes = await requiredOutcomes(job.id);
  const lessonMap = await requiredLessonMap(job.id);
  const totalPeriods = Math.max(1, Number(input.periods || 1));
  const periodBlueprints = await loadAllPeriodBlueprints(job.id, totalPeriods);

  const existing = await readGenerationJobArtifact<StagedMaterialsArtifact>(job.id, { kind: "section-materials" });
  assertLockedSectionPrefix({ input, sourceFacts, outcomes, lessonMap, periodBlueprints, materials: existing?.payload });
  let materials: StagedMaterialsArtifact;

  if (existing) {
    materials = existing.payload;
  } else {
    const strategy = getPlanModelStrategy(job.quotaReservation?.plan || "free");
    materials = await generateStagedMaterials({
      input,
      sourceFacts,
      outcomes,
      lessonMap,
      periodBlueprints,
      strategy,
    });
  }

  const validation = validateStagedSectionPrefix({
    input,
    sourceFacts,
    outcomes,
    lessonMap,
    periodBlueprints,
    materials,
  });
  if (!validation.passed) {
    throw new Error(`Đồ dùng dạy học không đạt chuẩn: ${validation.issues.map((i) => i.message).join("; ")}`);
  }

  const totalPhases = totalPeriods * 4;
  await commitGenerationJobCheckpoint(job.id, uid, owner, epoch, {
    expectedStage: "section-materials",
    expectedPosition: 0,
    artifacts: [{ key: { kind: "section-materials" }, payload: materials }],
    patch: {
      status: "waiting_next_step",
      currentStage: "period-phase",
      stageCursor: { position: 0, total: totalPhases },
      progress: progressAfterUnit(job, "Đã chuẩn bị Mục II. Đang chờ tạo từng pha dạy học."),
      error: null,
    },
  });
}

async function executePeriodPhaseStepV2(ctx: ExecutionContext): Promise<void> {
  const { job, uid, owner, epoch } = ctx;
  const persistedInput = await requiredInputArtifact(job.id);
  const input = lessonInputFromPersisted(persistedInput);
  const sourceFacts = await requiredSourceFacts(job.id);
  const outcomes = await requiredOutcomes(job.id);
  const lessonMap = await requiredLessonMap(job.id);
  const materials = await requiredMaterials(job.id);

  const totalPeriods = Math.max(1, Number(input.periods || 1));
  const totalPhases = totalPeriods * 4;
  const position = Math.min(Math.max(0, job.stageCursor.position), totalPhases);
  const sequence = position + 1;
  const { periodNumber, phase } = phaseFromSequence(sequence);

  const periodBlueprints = await loadAllPeriodBlueprints(job.id, totalPeriods);
  const periodBlueprint = periodBlueprints.find((bp) => bp.periodNumber === periodNumber);
  if (!periodBlueprint) throw new Error(`Không tìm thấy khung tiết ${periodNumber}.`);

  const priorPhases: StagedPhaseArtifact[] = [];
  for (let s = 1; s < sequence; s += 1) {
    const art = await readGenerationJobArtifact<StagedPhaseArtifact>(job.id, { kind: "period-phase", sequence: s });
    if (!art) throw new Error(`Thiếu pha trước đó (thứ ${s}) trong chuỗi.`);
    priorPhases.push(art.payload);
  }
  const previousPhase = priorPhases.at(-1) ?? null;
  const existing = await readGenerationJobArtifact<StagedPhaseArtifact>(job.id, { kind: "period-phase", sequence });
  assertLockedSectionPrefix({
    input, sourceFacts, outcomes, lessonMap, materials, periodBlueprints,
    phases: existing ? [...priorPhases, existing.payload] : priorPhases,
  });
  let currentPhaseArt: StagedPhaseArtifact;

  if (existing) {
    currentPhaseArt = existing.payload;
  } else {
    const strategy = getPlanModelStrategy(job.quotaReservation?.plan || "free");
    currentPhaseArt = await generateStagedPhase({
      input,
      sourceFacts,
      outcomes,
      lessonMap,
      materials,
      periodBlueprint,
      phase,
      previousPhase,
      strategy,
      feedback: ctx.useFallback && job.error?.stage === job.currentStage ? job.error.message : undefined,
    });
  }

  const allCurrentPhases = [...priorPhases, currentPhaseArt];

  const validation = validateStagedSectionPrefix({
    input,
    sourceFacts,
    outcomes,
    lessonMap,
    materials,
    periodBlueprints,
    phases: allCurrentPhases,
  });
  if (!validation.passed) {
    const scope = validation.issues.some((i) => i.code === "SEC-OBJ-UNCOVERED")
      ? "Liên kết mục tiêu toàn bài"
      : `Pha ${phase} (Tiết ${periodNumber})`;
    throw new Error(`${scope} không đạt chuẩn: ${validation.issues.map((i) => `[${i.code}] ${i.message}`).join("; ")}`);
  }

  const nextPos = position + 1;
  const isFinished = nextPos >= totalPhases;

  const progress = progressAfterUnit(
    job,
    isFinished
      ? "Đã tạo đủ các pha dạy học. Đang chờ soạn Mục IV: Đánh giá."
      : `Đã tạo ${phase} Tiết ${periodNumber} (${sequence}/${totalPhases}). Đang chờ pha tiếp theo.`,
  );
  progress.currentPeriod = periodNumber;
  progress.currentPhase = phase;

  await commitGenerationJobCheckpoint(job.id, uid, owner, epoch, {
    expectedStage: "period-phase",
    expectedPosition: position,
    artifacts: [{ key: { kind: "period-phase", sequence }, payload: currentPhaseArt }],
    patch: {
      status: "waiting_next_step",
      currentStage: isFinished ? "section-assessment" : "period-phase",
      stageCursor: isFinished ? { position: 0, total: 1 } : { position: nextPos, total: totalPhases },
      progress,
      error: null,
    },
  });
}

async function executeSectionAssessmentStepV2(ctx: ExecutionContext): Promise<void> {
  const { job, uid, owner, epoch } = ctx;
  const persistedInput = await requiredInputArtifact(job.id);
  const input = lessonInputFromPersisted(persistedInput);
  const sourceFacts = await requiredSourceFacts(job.id);
  const outcomes = await requiredOutcomes(job.id);
  const lessonMap = await requiredLessonMap(job.id);
  const materials = await requiredMaterials(job.id);

  const totalPeriods = Math.max(1, Number(input.periods || 1));
  const periodBlueprints = await loadAllPeriodBlueprints(job.id, totalPeriods);
  const totalPhases = totalPeriods * 4;
  const phases = await loadEffectivePhases(job.id, totalPhases);

  const existing = await readGenerationJobArtifact<StagedAssessmentArtifact>(job.id, { kind: "section-assessment" });
  let assessment: StagedAssessmentArtifact;

  if (existing) {
    assessment = existing.payload;
  } else {
    const strategy = getPlanModelStrategy(job.quotaReservation?.plan || "free");
    assessment = await generateStagedAssessment({
      input,
      sourceFacts,
      outcomes,
      lessonMap,
      materials,
      periodBlueprints,
      phases,
      strategy,
    });
  }

  const validation = validateStagedSectionPrefix({
    input,
    sourceFacts,
    outcomes,
    lessonMap,
    periodBlueprints,
    materials,
    phases,
    assessment,
  });
  if (!validation.passed) {
    throw new Error(`Đánh giá không đạt chuẩn: ${validation.issues.map((i) => i.message).join("; ")}`);
  }

  await commitGenerationJobCheckpoint(job.id, uid, owner, epoch, {
    expectedStage: "section-assessment",
    expectedPosition: 0,
    artifacts: [{ key: { kind: "section-assessment" }, payload: assessment }],
    patch: {
      status: "waiting_next_step",
      currentStage: "assembly",
      stageCursor: { position: 0, total: 1 },
      progress: progressAfterUnit(job, "Đã hoàn tất đánh giá và ma trận. Đang chờ ghép toàn bộ giáo án."),
      error: null,
    },
  });
}

async function executeAssemblyStepV2(ctx: ExecutionContext): Promise<void> {
  const { job, uid, owner, epoch } = ctx;
  const persistedInput = await requiredInputArtifact(job.id);
  const input = lessonInputFromPersisted(persistedInput);
  const sourceFacts = await requiredSourceFacts(job.id);
  const outcomes = await requiredOutcomes(job.id);
  const lessonMap = await requiredLessonMap(job.id);
  const materials = await requiredMaterials(job.id);

  const totalPeriods = Math.max(1, Number(input.periods || 1));
  const periodBlueprints = await loadAllPeriodBlueprints(job.id, totalPeriods);
  const totalPhases = totalPeriods * 4;
  const phases = await loadEffectivePhases(job.id, totalPhases);
  const assessment = await readGenerationJobArtifact<StagedAssessmentArtifact>(job.id, { kind: "section-assessment" });
  if (!assessment) throw new Error("Không tìm thấy artifact đánh giá.");

  const stagedSections: StagedSectionArtifacts = {
    sourceFacts,
    outcomes,
    lessonMap,
    periodBlueprints,
    materials,
    phases,
    assessment: assessment.payload,
  };

  const hasRepairs = phases.some((p) => p.anchor.revision > 1);
  const assemblyResult: StagedSectionsAssembly = assembleStagedSections({
    ...stagedSections,
    input,
    plan: job.quotaReservation?.plan || "free",
    repairApplied: hasRepairs,
  });

  const artifactsToCommit: Array<{ key: GenerationArtifactKey; payload: unknown }> = [
    { key: { kind: "assembly" }, payload: assemblyResult.assembly },
    { key: { kind: "blueprint" }, payload: assemblyResult.blueprint },
  ];
  for (const p of assemblyResult.periods) {
    artifactsToCommit.push({ key: { kind: "period", sequence: p.periodNumber }, payload: p });
  }

  await commitGenerationJobCheckpoint(job.id, uid, owner, epoch, {
    expectedStage: "assembly",
    expectedPosition: 0,
    artifacts: artifactsToCommit,
    patch: {
      status: "waiting_next_step",
      currentStage: "subject-validation",
      stageCursor: { position: 0, total: 1 },
      progress: progressAfterUnit(job, "Đã ghép xong giáo án. Đang chờ kiểm định chất lượng chuyên môn."),
      error: null,
    },
  });
}

async function executeSubjectValidationStepV2(ctx: ExecutionContext): Promise<void> {
  const { job, uid, owner, epoch } = ctx;
  const persistedInput = await requiredInputArtifact(job.id);
  const input = lessonInputFromPersisted(persistedInput);

  const sourceFacts = await requiredSourceFacts(job.id);
  const outcomes = await requiredOutcomes(job.id);
  const lessonMap = await requiredLessonMap(job.id);
  const materials = await requiredMaterials(job.id);
  const totalPeriods = Math.max(1, Number(input.periods || 1));
  const periodBlueprints = await loadAllPeriodBlueprints(job.id, totalPeriods);
  const totalPhases = totalPeriods * 4;
  const phases = await loadEffectivePhases(job.id, totalPhases);
  const assessment = await readGenerationJobArtifact<StagedAssessmentArtifact>(job.id, { kind: "section-assessment" });
  if (!assessment) throw new Error("Không tìm thấy artifact đánh giá.");

  const validation = validateStagedSectionPrefix({
    input,
    sourceFacts,
    outcomes,
    lessonMap,
    periodBlueprints,
    materials,
    phases,
    assessment: assessment.payload,
  });

  const assembly = await readGenerationJobArtifact<StagedAssemblyArtifact>(job.id, { kind: "assembly" });
  const blueprint = await readGenerationJobArtifact<StagedBlueprintArtifact>(job.id, { kind: "blueprint" });

  const subjectAuditIssues: StagedSectionIssue[] = [];
  if (assembly && blueprint) {
    const subjectValidation = validateStagedLesson(input, assembly.payload, blueprint.payload);
    const blockingErrors = subjectValidation.findings.filter((f) => f.severity === "error");
    for (const b of blockingErrors) {
      if (!validation.issues.some((i) => i.code === b.code && i.periodNumber === b.periodNumber)) {
        subjectAuditIssues.push({
          code: b.code,
          message: b.message,
          path: "lesson",
          periodNumber: b.periodNumber,
        });
      }
    }
  }

  const allIssues = [...validation.issues, ...subjectAuditIssues];
  const repairableIssues = allIssues.filter((issue) => issue.phase && issue.periodNumber);
  const nonRepairableIssues = allIssues.filter((issue) => !(issue.phase && issue.periodNumber));

  if (nonRepairableIssues.length > 0 && !validation.passed) {
    throw new StagedSectionValidationError(
      `Kiểm định cấu trúc/nguồn không đạt: ${nonRepairableIssues.map((i) => `[${i.code}] ${i.message}`).join("; ")}`,
      nonRepairableIssues,
    );
  }

  const needsRepair = repairableIssues.length > 0;

  if (needsRepair) {
    const totalRepairTargets = repairableIssues.length;
    await commitGenerationJobCheckpoint(job.id, uid, owner, epoch, {
      expectedStage: "subject-validation",
      expectedPosition: 0,
      patch: {
        status: "waiting_next_step",
        currentStage: "phase-repair",
        stageCursor: { position: 0, total: totalRepairTargets },
        progress: progressAfterUnit(job, `Phát hiện ${totalRepairTargets} mục cần tinh chỉnh. Đang chuyển sang bước sửa cục bộ.`),
        error: null,
      },
    });
    return;
  }

  await commitGenerationJobCheckpoint(job.id, uid, owner, epoch, {
    expectedStage: "subject-validation",
    expectedPosition: 0,
    patch: {
      status: "waiting_next_step",
      currentStage: "final-validation",
      stageCursor: { position: 0, total: 1 },
      progress: progressAfterUnit(job, "Kiểm định sư phạm đạt chuẩn. Đang chờ kiểm tra duyệt cuối."),
      error: null,
    },
  });
}

async function executePhaseRepairStepV2(ctx: ExecutionContext): Promise<void> {
  const { job, uid, owner, epoch } = ctx;
  const persistedInput = await requiredInputArtifact(job.id);
  const input = lessonInputFromPersisted(persistedInput);

  const sourceFacts = await requiredSourceFacts(job.id);
  const outcomes = await requiredOutcomes(job.id);
  const lessonMap = await requiredLessonMap(job.id);
  const materials = await requiredMaterials(job.id);
  const totalPeriods = Math.max(1, Number(input.periods || 1));
  const periodBlueprints = await loadAllPeriodBlueprints(job.id, totalPeriods);
  const totalPhases = totalPeriods * 4;
  const phases = await loadEffectivePhases(job.id, totalPhases);
  const assessment = await readGenerationJobArtifact<StagedAssessmentArtifact>(job.id, { kind: "section-assessment" });

  const validation = validateStagedSectionPrefix({
    input,
    sourceFacts,
    outcomes,
    lessonMap,
    periodBlueprints,
    materials,
    phases,
    assessment: assessment?.payload,
  });

  const repairableIssues = validation.issues.filter((issue) => issue.phase && issue.periodNumber);
  const position = Math.min(Math.max(0, job.stageCursor.position), repairableIssues.length);

  if (position >= repairableIssues.length || repairableIssues.length === 0) {
    await commitGenerationJobCheckpoint(job.id, uid, owner, epoch, {
      expectedStage: "phase-repair",
      expectedPosition: job.stageCursor.position,
      patch: {
        status: "waiting_next_step",
        currentStage: "assembly",
        stageCursor: { position: 0, total: 1 },
        progress: progressAfterUnit(job, "Đã hoàn thành các bước sửa cục bộ. Đang ghép lại giáo án."),
        error: null,
      },
    });
    return;
  }

  const currentIssue = repairableIssues[position];
  const targetPeriod = currentIssue.periodNumber!;
  const targetPhase = currentIssue.phase!;
  const targetSeq = flatPhaseSequence(targetPeriod, targetPhase);
  const currentPhaseArt = phases[targetSeq - 1];
  const targetBp = periodBlueprints.find((b) => b.periodNumber === targetPeriod);

  if (!currentPhaseArt || !targetBp) {
    throw new Error(`Không tìm thấy dữ liệu pha ${targetPhase} Tiết ${targetPeriod} để sửa.`);
  }

  const strategy = getPlanModelStrategy(job.quotaReservation?.plan || "free");
  const repairResult = await repairStagedPhase({
    input,
    sourceFacts,
    outcomes,
    materials,
    lessonMap,
    periodBlueprint: targetBp,
    phase: targetPhase,
    previousPhase: targetSeq > 1 ? phases[targetSeq - 2] : null,
    currentPhase: currentPhaseArt,
    issues: [currentIssue],
    strategy,
  });

  const testPhases = [...phases];
  testPhases[targetSeq - 1] = repairResult.artifact;
  const testValidation = validateStagedSectionPrefix({
    input,
    sourceFacts,
    outcomes,
    lessonMap,
    periodBlueprints,
    materials,
    phases: testPhases,
  });

  const targetIssues = testValidation.issues.filter(
    (i) => i.periodNumber === targetPeriod && i.phase === targetPhase,
  );
  const accepted = repairResult.repaired && targetIssues.length === 0;
  const artifactsToCommit: Array<{ key: GenerationArtifactKey; payload: unknown }> = [];

  if (accepted) {
    artifactsToCommit.push({
      key: { kind: "phase-repair", sequence: targetSeq },
      payload: {
        sequence: targetSeq,
        baseAnchor: currentPhaseArt.anchor,
        artifact: repairResult.artifact,
      },
    });
  }

  const nextPos = position + 1;
  const isFinished = nextPos >= repairableIssues.length;

  await commitGenerationJobCheckpoint(job.id, uid, owner, epoch, {
    expectedStage: "phase-repair",
    expectedPosition: position,
    artifacts: artifactsToCommit,
    patch: {
      status: "waiting_next_step",
      currentStage: isFinished ? "assembly" : "phase-repair",
      stageCursor: isFinished ? { position: 0, total: 1 } : { position: nextPos, total: repairableIssues.length },
      progress: progressAfterUnit(
        job,
        isFinished
          ? "Đã hoàn thành sửa các pha cần thiết. Đang chờ ghép lại giáo án."
          : `Đã xử lý sửa pha ${targetPhase} Tiết ${targetPeriod} (${nextPos}/${repairableIssues.length}).`,
      ),
      error: null,
    },
  });
}

async function executeFinalValidationStepV2(ctx: ExecutionContext): Promise<void> {
  const { job, uid, owner, epoch } = ctx;
  const persistedInput = await requiredInputArtifact(job.id);
  const input = lessonInputFromPersisted(persistedInput);

  const assembly = await readGenerationJobArtifact<any>(job.id, { kind: "assembly" });
  const blueprint = await readGenerationJobArtifact<any>(job.id, { kind: "blueprint" });
  if (!assembly || !blueprint) throw new Error("Không tìm thấy artifact assembly hoặc blueprint để kiểm tra cuối.");

  const finalArtifact = finalizeStagedLesson(input, assembly.payload, blueprint.payload);

  await commitGenerationJobCheckpoint(job.id, uid, owner, epoch, {
    expectedStage: "final-validation",
    expectedPosition: 0,
    artifacts: [{ key: { kind: "final" }, payload: finalArtifact }],
    patch: {
      status: "waiting_next_step",
      currentStage: finalArtifact.canPersist ? "persistence" : "quota-settlement",
      stageCursor: { position: 0, total: 1 },
      progress: progressAfterUnit(
        job,
        finalArtifact.canPersist
          ? "Kiểm tra cuối hoàn tất. Đang chờ lưu giáo án vào tài khoản."
          : "Giáo án không đạt kiểm tra cuối. Đang chuyển sang hoàn lượt.",
      ),
      error: null,
    },
  });
}

async function executePersistenceStepV2(ctx: ExecutionContext): Promise<void> {
  const { job, uid, owner, epoch } = ctx;
  const finalArtifact = await requiredFinalArtifact(job.id);
  if (!finalArtifact.canPersist) {
    throw new Error("Giáo án không đủ điều kiện lưu trữ.");
  }

  const lessonId = await persistStagedGeneratedLesson(uid, job.id, finalArtifact.lesson, {
    owner,
    epoch,
  });

  await commitGenerationJobCheckpoint(job.id, uid, owner, epoch, {
    expectedStage: "persistence",
    expectedPosition: 0,
    patch: {
      lessonId,
      status: "waiting_next_step",
      currentStage: "quota-settlement",
      stageCursor: { position: 0, total: 1 },
      progress: progressAfterUnit(job, "Đã lưu giáo án thành công. Đang hoàn tất xác nhận lượt."),
      error: null,
    },
  });
}

async function executeQuotaSettlementStepV2(ctx: ExecutionContext): Promise<void> {
  const { job, uid, owner, epoch } = ctx;
  const finalArtifact = await requiredFinalArtifact(job.id);
  const reservation = job.quotaReservation;

  if (finalArtifact.canPersist) {
    if (!job.lessonId) {
      await releaseReservationIfPresent(job, "PERSISTED_LESSON_MISSING");
      await commitGenerationJobCheckpoint(job.id, uid, owner, epoch, {
        expectedStage: "quota-settlement",
        expectedPosition: 0,
        patch: {
          status: "failed",
          currentStage: "quota-settlement",
          stageCursor: { position: 1, total: 1 },
          progress: {
            ...job.progress,
            message: "Không tìm thấy ID giáo án đã lưu để xác nhận lượt.",
          },
          error: {
            code: "PERSISTED_LESSON_MISSING",
            message: "Không tìm thấy ID giáo án đã lưu để xác nhận lượt sử dụng.",
            stage: "quota-settlement",
            retryable: false,
          },
        },
      });
      return;
    }

    if (!reservation) {
      await commitGenerationJobCheckpoint(job.id, uid, owner, epoch, {
        expectedStage: "quota-settlement",
        expectedPosition: 0,
        patch: {
          status: "failed",
          currentStage: "quota-settlement",
          stageCursor: { position: 1, total: 1 },
          progress: {
            ...job.progress,
            message: "Không tìm thấy lượt sử dụng đã giữ.",
          },
          error: {
            code: "QUOTA_RESERVATION_MISSING",
            message: "Không tìm thấy lượt sử dụng đã giữ để xác nhận giáo án.",
            stage: "quota-settlement",
            retryable: false,
          },
        },
      });
      return;
    }

    await commitUsage(
      reservation,
      job.lessonId,
      quotaSettlementTelemetry(job, finalArtifact, "success"),
    );
    await cleanupGenerationJobInput(job);

    await commitGenerationJobCheckpoint(job.id, uid, owner, epoch, {
      expectedStage: "quota-settlement",
      expectedPosition: 0,
      patch: {
        status: "completed",
        currentStage: "completed",
        stageCursor: { position: 1, total: 1 },
        progress: {
          ...job.progress,
          percent: 100,
          completedUnits: job.progress.totalUnits,
          currentPeriod: job.progress.totalPeriods,
          message: finalArtifact.decision === "draft"
            ? "Đã tạo và lưu giáo án cần điều chỉnh."
            : "Đã tạo và lưu giáo án thành công.",
        },
        error: null,
      },
    });
    return;
  }

  if (reservation) {
    await releaseUsage(
      reservation,
      "staged_final_validation_rejected",
      quotaSettlementTelemetry(job, finalArtifact, "rejected"),
    );
  }
  await cleanupGenerationJobInput(job);

  const unresolvedTitle = [
    ...(finalArtifact.fatalCodes || []),
    ...(finalArtifact.blockingCodes || []),
  ].some((code) => code === "STAGED-TITLE-01" || code === "STAGED-TITLE-02");

  const rejectionMessage = unresolvedTitle
    ? LESSON_TITLE_REQUIRED_MESSAGE
    : "Giáo án còn " + Math.max(finalArtifact.summary.errors, finalArtifact.fatalCodes?.length || 0) + " lỗi fatal/chặn và không đủ điều kiện lưu.";

  await commitGenerationJobCheckpoint(job.id, uid, owner, epoch, {
    expectedStage: "quota-settlement",
    expectedPosition: 0,
    patch: {
      status: "failed",
      currentStage: "quota-settlement",
      stageCursor: { position: 1, total: 1 },
      progress: {
        ...job.progress,
        message: reservation
          ? "Giáo án không đạt kiểm tra cuối; lượt sử dụng đã được hoàn lại."
          : "Giáo án không đạt kiểm tra cuối và không được lưu.",
      },
      error: {
        code: unresolvedTitle ? "LESSON_TITLE_UNRESOLVED" : "FINAL_VALIDATION_BLOCKED",
        message: rejectionMessage,
        stage: "final-validation",
        retryable: false,
      },
    },
  });
}

async function releaseReservationIfPresent(job: GenerationJob, code: string) {
  if (job.quotaReservation) {
    await releaseUsage(job.quotaReservation, "staged_quota_settlement_invariant", {
      jobId: job.id,
      stage: "quota-settlement",
      code,
    });
  }
  await cleanupGenerationJobInput(job);
}

async function failUnresolvedLessonTitleV2(job: GenerationJob, uid: string, owner: string, epoch: number) {
  try {
    if (job.quotaReservation) {
      await releaseUsage(job.quotaReservation, "staged_lesson_title_unresolved", {
        version: 2,
        pipelineVersion: job.pipelineVersion,
        jobId: job.id,
        stage: job.currentStage,
        outcome: "rejected",
        code: "LESSON_TITLE_UNRESOLVED",
        periods: job.inputSummary.periods,
      });
    }
    await cleanupGenerationJobInput(job);
  } catch (settlementError) {
    const detail = settlementError instanceof Error ? settlementError.message : "Lỗi hoàn lượt.";
    await commitGenerationJobCheckpoint(job.id, uid, owner, epoch, {
      expectedStage: job.currentStage,
      expectedPosition: job.stageCursor.position,
      patch: {
        status: "waiting_next_step",
        error: {
          code: "LESSON_TITLE_SETTLEMENT_FAILED",
          message: detail,
          stage: job.currentStage,
          retryable: true,
        },
      },
    }).catch(() => undefined);
    return;
  }

  await commitGenerationJobCheckpoint(job.id, uid, owner, epoch, {
    expectedStage: job.currentStage,
    expectedPosition: job.stageCursor.position,
    patch: {
      status: "failed",
      currentStage: job.currentStage,
      progress: {
        ...job.progress,
        message: job.quotaReservation
          ? `${LESSON_TITLE_REQUIRED_MESSAGE} Lượt sử dụng đã được hoàn lại.`
          : LESSON_TITLE_REQUIRED_MESSAGE,
      },
      error: {
        code: "LESSON_TITLE_UNRESOLVED",
        message: LESSON_TITLE_REQUIRED_MESSAGE,
        stage: job.currentStage,
        retryable: false,
      },
    },
  }).catch(() => undefined);
}
