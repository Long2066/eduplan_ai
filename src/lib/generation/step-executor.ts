import "server-only";
import { randomUUID } from "node:crypto";
import {
  assembleStagedLesson,
  type StagedAssemblyArtifact,
} from "@/lib/generation/assembly";
import { generateStagedBlueprint, type StagedBlueprintArtifact } from "@/lib/generation/blueprint";
import {
  finalizeStagedLesson,
  type StagedFinalArtifact,
} from "@/lib/generation/final-validation";
import { GenerationJobRequestError } from "@/lib/generation/job-input";
import {
  GenerationJobConflictError,
  acquireGenerationJobLease,
  getGenerationJobForUser,
  readGenerationJobArtifact,
  releaseGenerationJobLease,
  updateLeasedGenerationJob,
  writeGenerationJobArtifact,
} from "@/lib/generation/job-store";
import {
  lessonInputFromPersisted,
} from "@/lib/generation/input-storage";
import {
  cleanupGenerationJobInput,
  expireStagedGenerationJobIfNeeded,
} from "@/lib/generation/lifecycle";
import { runOpenAiOcrAsset, sortGenerationOcrAssets } from "@/lib/generation/ocr";
import {
  generateStagedPeriod,
  type StagedPeriodArtifact,
} from "@/lib/generation/period-generation";
import { persistStagedGeneratedLesson } from "@/lib/generation/persistence";
import {
  reassembleStagedRepairs,
  repairStagedPeriod,
  type StagedRepairArtifact,
} from "@/lib/generation/repair";
import { GenerationTimeoutError, withGenerationDeadline, type GenerationContext } from "@/lib/generation/runtime";
import {
  MAX_GENERATION_SECURITY_CALLS,
  normalizeSecurityGenerationCalls,
  summarizeSecurityGenerationCalls,
} from "@shared/security-contract";
import {
  prepareStagedSourceContext,
  type StagedSourceContext,
} from "@/lib/generation/source-preparation";
import {
  validateStagedLesson,
  type StagedValidationArtifact,
} from "@/lib/generation/subject-validation";
import { getPlanModelStrategy } from "@/lib/model-strategy";
import {
  LESSON_TITLE_REQUIRED_MESSAGE,
  LessonTitleResolutionError,
} from "@/lib/lesson-title";
import { commitUsage, releaseUsage } from "@/lib/subscription-policy";
import type {
  GenerationJob,
  GenerationJobAssetMetadata,
  GenerationJobProgress,
  PersistedGenerationInput,
} from "@/lib/generation/job-types";
import type { UploadedAsset } from "@/types/lesson";

export type StagedOcrPageArtifact = {
  index: number;
  assetId: string;
  assetName: string;
  text: string;
  sourceHash: string;
  cacheHit: boolean;
  model: string;
};

export type StagedOcrArtifact = {
  text: string;
  sourceHashes: string[];
  cacheHitCount: number;
  cacheMissCount: number;
  pageCount: number;
};

function stagedStepTimeoutMs(stage?: GenerationJob["currentStage"]) {
  const defaultTimeout = stage === "blueprint"
    ? Number(process.env.GENERATION_BLUEPRINT_STEP_TIMEOUT_MS || 240_000)
    : Number(process.env.GENERATION_STEP_TIMEOUT_MS || 150_000);
  const configured = Number.isFinite(defaultTimeout) ? defaultTimeout : 150_000;
  return Number.isFinite(configured)
    ? Math.min(240_000, Math.max(30_000, Math.floor(configured)))
    : 150_000;
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

async function requiredInputArtifact(jobId: string) {
  const artifact = await readGenerationJobArtifact<PersistedGenerationInput>(jobId, { kind: "input" });
  if (!artifact) throw new Error("Không tìm thấy dữ liệu đầu vào của generation job.");
  return artifact.payload;
}

async function requiredOcrArtifact(jobId: string) {
  const artifact = await readGenerationJobArtifact<StagedOcrArtifact>(jobId, { kind: "ocr" });
  if (!artifact) throw new Error("Không tìm thấy kết quả OCR của generation job.");
  return artifact.payload;
}

async function requiredSourceContext(jobId: string) {
  const artifact = await readGenerationJobArtifact<StagedSourceContext>(jobId, { kind: "source-context" });
  if (!artifact) throw new Error("Không tìm thấy dữ liệu nguồn của generation job.");
  return artifact.payload;
}

async function requiredBlueprintArtifact(jobId: string) {
  const artifact = await readGenerationJobArtifact<StagedBlueprintArtifact>(jobId, { kind: "blueprint" });
  if (!artifact) throw new Error("Không tìm thấy blueprint của generation job.");
  return artifact.payload;
}

async function requiredAssemblyArtifact(jobId: string) {
  const artifact = await readGenerationJobArtifact<StagedAssemblyArtifact>(jobId, { kind: "assembly" });
  if (!artifact) throw new Error("Không tìm thấy giáo án đã ghép của generation job.");
  return artifact.payload;
}

async function requiredValidationArtifact(jobId: string) {
  const artifact = await readGenerationJobArtifact<StagedValidationArtifact>(jobId, { kind: "validation" });
  if (!artifact) throw new Error("Không tìm thấy kết quả kiểm định của generation job.");
  return artifact.payload;
}

async function requiredFinalArtifact(jobId: string) {
  const artifact = await readGenerationJobArtifact<StagedFinalArtifact>(jobId, { kind: "final" });
  if (!artifact) throw new Error("Không tìm thấy kết quả kiểm tra cuối của generation job.");
  return artifact.payload;
}

async function updateWithLeaseOrThrow(
  jobId: string,
  uid: string,
  owner: string,
  patch: Parameters<typeof updateLeasedGenerationJob>[3],
) {
  const updated = await updateLeasedGenerationJob(jobId, uid, owner, patch);
  if (!updated) {
    throw new GenerationJobConflictError(
      "Generation job đã bị hủy hoặc lease không còn hiệu lực.",
      "GENERATION_JOB_LEASE_LOST",
    );
  }
}

async function aggregateOcrPages(jobId: string, total: number): Promise<StagedOcrArtifact> {
  const pages: StagedOcrPageArtifact[] = [];
  for (let sequence = 1; sequence <= total; sequence += 1) {
    const artifact = await readGenerationJobArtifact<StagedOcrPageArtifact>(
      jobId,
      { kind: "ocr-page", sequence },
    );
    if (!artifact) throw new Error(`Thiếu kết quả OCR ảnh ${sequence}/${total}.`);
    pages.push(artifact.payload);
  }
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

async function executeOcrStep(job: GenerationJob, owner: string, submittedAsset?: UploadedAsset) {
  const persistedInput = await requiredInputArtifact(job.id);
  const orderedAssets = sortGenerationOcrAssets(
    persistedInput.uploadedAssets as GenerationJobAssetMetadata[],
  );
  const total = orderedAssets.length;
  const position = Math.min(Math.max(0, job.stageCursor.position), total);
  let nextPosition = position;

  if (position < total) {
    const sequence = position + 1;
    const existing = await readGenerationJobArtifact<StagedOcrPageArtifact>(
      job.id,
      { kind: "ocr-page", sequence },
    );
    if (!existing) {
      const asset = assertExpectedOcrAsset(orderedAssets[position], submittedAsset, sequence, total);
      const result = await runOpenAiOcrAsset(asset, position, total);
      await writeGenerationJobArtifact(job.id, { kind: "ocr-page", sequence }, {
        index: sequence,
        assetId: asset.id,
        assetName: asset.name,
        text: result.text,
        sourceHash: result.sourceHash,
        cacheHit: result.cacheHit,
        model: result.model,
      } satisfies StagedOcrPageArtifact);
    }
    nextPosition = sequence;
  }

  if (nextPosition < total) {
    await updateWithLeaseOrThrow(job.id, job.uid, owner, {
      status: "waiting_next_step",
      stageCursor: { position: nextPosition, total },
      progress: {
        ...job.progress,
        message: `Đã OCR ${nextPosition}/${total} ảnh.`,
      },
      error: null,
    });
    return;
  }

  const ocr = await aggregateOcrPages(job.id, total);
  await writeGenerationJobArtifact(job.id, { kind: "ocr" }, ocr);
  await updateWithLeaseOrThrow(job.id, job.uid, owner, {
    status: "waiting_next_step",
    currentStage: "source-preparation",
    stageCursor: { position: 0, total: 1 },
    progress: progressAfterUnit(job, "OCR hoàn tất. Đang chờ chuẩn bị dữ liệu nguồn."),
    error: null,
  });
}

async function executeSourcePreparationStep(job: GenerationJob, owner: string) {
  const persistedInput = await requiredInputArtifact(job.id);
  const input = lessonInputFromPersisted(persistedInput);
  const ocr = await requiredOcrArtifact(job.id);
  const sourceContext = await prepareStagedSourceContext(input, ocr.sourceHashes, ocr.text);
  await writeGenerationJobArtifact(job.id, { kind: "source-context" }, sourceContext);
  await updateWithLeaseOrThrow(job.id, job.uid, owner, {
    status: "waiting_next_step",
    currentStage: "blueprint",
    stageCursor: { position: 0, total: 1 },
    progress: progressAfterUnit(job, "Dữ liệu nguồn đã sẵn sàng. Đang chờ tạo blueprint."),
    error: null,
  });
}

async function executeBlueprintStep(job: GenerationJob, owner: string) {
  const persistedInput = await requiredInputArtifact(job.id);
  const input = lessonInputFromPersisted(persistedInput);
  const ocr = await requiredOcrArtifact(job.id);
  const sourceContext = await requiredSourceContext(job.id);
  const strategy = getPlanModelStrategy(job.quotaReservation?.plan || "free");
  const blueprint = await generateStagedBlueprint(input, ocr.text, sourceContext, strategy);
  await writeGenerationJobArtifact(job.id, { kind: "blueprint" }, blueprint);
  await updateWithLeaseOrThrow(job.id, job.uid, owner, {
    status: "waiting_next_step",
    currentStage: "period-generation",
    stageCursor: { position: 0, total: Math.max(1, Number(input.periods || 1)) },
    progress: progressAfterUnit(job, "Blueprint đã hoàn tất. Đang chờ tạo từng tiết."),
    error: null,
  });
}

async function executePeriodGenerationStep(job: GenerationJob, owner: string) {
  const persistedInput = await requiredInputArtifact(job.id);
  const input = lessonInputFromPersisted(persistedInput);
  const total = Math.max(1, Number(input.periods || 1));
  const position = Math.min(Math.max(0, job.stageCursor.position), total);

  if (position >= total) {
    await updateWithLeaseOrThrow(job.id, job.uid, owner, {
      status: "waiting_next_step",
      currentStage: "assembly",
      stageCursor: { position: 0, total: 1 },
      progress: {
        ...job.progress,
        currentPeriod: total,
        message: "Đã tạo đủ các tiết. Đang chờ ghép giáo án.",
      },
      error: null,
    });
    return;
  }

  const sequence = position + 1;
  const existing = await readGenerationJobArtifact<StagedPeriodArtifact>(
    job.id,
    { kind: "period", sequence },
  );
  if (!existing) {
    const ocr = await requiredOcrArtifact(job.id);
    const blueprint = await requiredBlueprintArtifact(job.id);
    const previous = sequence > 1
      ? await readGenerationJobArtifact<StagedPeriodArtifact>(
          job.id,
          { kind: "period", sequence: sequence - 1 },
        )
      : null;
    if (sequence > 1 && !previous) {
      throw new Error(`Không tìm thấy kết quả tiết ${sequence - 1} để giữ mạch sang tiết ${sequence}.`);
    }
    const strategy = getPlanModelStrategy(job.quotaReservation?.plan || "free");
    const generated = await generateStagedPeriod(
      input,
      ocr.text,
      blueprint,
      sequence,
      previous?.payload.handoff || null,
      strategy,
    );
    await writeGenerationJobArtifact(job.id, { kind: "period", sequence }, generated);
  }

  const progress = progressAfterUnit(
    job,
    sequence < total
      ? `Đã tạo tiết ${sequence}/${total}. Đang chờ tạo tiết tiếp theo.`
      : "Đã tạo đủ các tiết. Đang chờ ghép giáo án.",
  );
  progress.currentPeriod = sequence;
  await updateWithLeaseOrThrow(job.id, job.uid, owner, {
    status: "waiting_next_step",
    currentStage: sequence < total ? "period-generation" : "assembly",
    stageCursor: sequence < total
      ? { position: sequence, total }
      : { position: 0, total: 1 },
    progress,
    error: null,
  });
}

async function executeAssemblyStep(job: GenerationJob, owner: string) {
  const existing = await readGenerationJobArtifact<StagedAssemblyArtifact>(job.id, { kind: "assembly" });
  if (!existing) {
    const persistedInput = await requiredInputArtifact(job.id);
    const input = lessonInputFromPersisted(persistedInput);
    const blueprint = await requiredBlueprintArtifact(job.id);
    const total = Math.max(1, Number(input.periods || 1));
    const periods: StagedPeriodArtifact[] = [];
    for (let sequence = 1; sequence <= total; sequence += 1) {
      const artifact = await readGenerationJobArtifact<StagedPeriodArtifact>(
        job.id,
        { kind: "period", sequence },
      );
      if (!artifact) throw new Error(`Không tìm thấy artifact của tiết ${sequence}/${total}.`);
      periods.push(artifact.payload);
    }
    const assembly = assembleStagedLesson(
      input,
      blueprint,
      periods,
      job.quotaReservation?.plan || "free",
    );
    await writeGenerationJobArtifact(job.id, { kind: "assembly" }, assembly);
  }

  await updateWithLeaseOrThrow(job.id, job.uid, owner, {
    status: "waiting_next_step",
    currentStage: "subject-validation",
    stageCursor: { position: 0, total: 1 },
    progress: progressAfterUnit(job, "Đã ghép đủ các tiết. Đang chờ kiểm tra chất lượng theo môn."),
    error: null,
  });
}

async function executeSubjectValidationStep(job: GenerationJob, owner: string) {
  let validation = (await readGenerationJobArtifact<StagedValidationArtifact>(
    job.id,
    { kind: "validation" },
  ))?.payload;
  if (!validation) {
    const persistedInput = await requiredInputArtifact(job.id);
    const input = lessonInputFromPersisted(persistedInput);
    const assembly = await readGenerationJobArtifact<StagedAssemblyArtifact>(job.id, { kind: "assembly" });
    if (!assembly) throw new Error("Không tìm thấy giáo án đã ghép để kiểm định.");
    const blueprint = await requiredBlueprintArtifact(job.id);
    validation = validateStagedLesson(input, assembly.payload, blueprint);
    await writeGenerationJobArtifact(job.id, { kind: "validation" }, validation);
  }

  const requiresRepair = validation.route === "repair" && validation.repairTargets.length > 0;
  await updateWithLeaseOrThrow(job.id, job.uid, owner, {
    status: "waiting_next_step",
    currentStage: requiresRepair ? "repair" : "final-validation",
    stageCursor: requiresRepair
      ? { position: 0, total: validation.repairTargets.length }
      : { position: 0, total: 1 },
    progress: progressAfterUnit(
      job,
      requiresRepair
        ? `Đã kiểm định: ${validation.summary.repairableErrors} lỗi có thể tự sửa trong ${validation.repairTargets.length} tiết.`
        : "Đã kiểm định theo môn. Không có lỗi phù hợp để tự sửa; đang chờ kiểm tra cuối.",
    ),
    error: null,
  });
}

async function finalizeStagedRepairs(job: GenerationJob, validation: StagedValidationArtifact) {
  const currentAssembly = await requiredAssemblyArtifact(job.id);
  if (currentAssembly.repairApplied) return;

  const persistedInput = await requiredInputArtifact(job.id);
  const input = lessonInputFromPersisted(persistedInput);
  const blueprint = await requiredBlueprintArtifact(job.id);
  const totalPeriods = Math.max(1, Number(input.periods || 1));
  const originalPeriods: StagedPeriodArtifact[] = [];
  for (let sequence = 1; sequence <= totalPeriods; sequence += 1) {
    const artifact = await readGenerationJobArtifact<StagedPeriodArtifact>(
      job.id,
      { kind: "period", sequence },
    );
    if (!artifact) throw new Error(`Không tìm thấy artifact tiết gốc ${sequence}/${totalPeriods}.`);
    originalPeriods.push(artifact.payload);
  }

  const repairs: StagedRepairArtifact[] = [];
  for (let sequence = 1; sequence <= validation.repairTargets.length; sequence += 1) {
    const artifact = await readGenerationJobArtifact<StagedRepairArtifact>(
      job.id,
      { kind: "repair", sequence },
    );
    if (!artifact) throw new Error(`Không tìm thấy kết quả sửa ${sequence}/${validation.repairTargets.length}.`);
    const expectedPeriod = validation.repairTargets[sequence - 1]?.periodNumber;
    if (artifact.payload.periodNumber !== expectedPeriod) {
      throw new Error(`Kết quả sửa ${sequence} không khớp tiết ${expectedPeriod}.`);
    }
    repairs.push(artifact.payload);
  }

  const reassembled = reassembleStagedRepairs(
    input,
    blueprint,
    originalPeriods,
    repairs,
    job.quotaReservation?.plan || "free",
  );
  await writeGenerationJobArtifact(job.id, { kind: "assembly" }, reassembled);
}

async function executeRepairStep(job: GenerationJob, owner: string) {
  const validation = await requiredValidationArtifact(job.id);
  const total = validation.repairTargets.length;
  if (validation.route !== "repair" || total === 0) {
    await updateWithLeaseOrThrow(job.id, job.uid, owner, {
      status: "waiting_next_step",
      currentStage: "final-validation",
      stageCursor: { position: 0, total: 1 },
      progress: progressAfterUnit(job, "Không có lỗi cần tự sửa. Đang chờ kiểm tra cuối."),
      error: null,
    });
    return;
  }

  const position = Math.min(Math.max(0, job.stageCursor.position), total);
  if (position >= total) {
    await finalizeStagedRepairs(job, validation);
    await updateWithLeaseOrThrow(job.id, job.uid, owner, {
      status: "waiting_next_step",
      currentStage: "final-validation",
      stageCursor: { position: 0, total: 1 },
      progress: progressAfterUnit(job, "Đã áp dụng toàn bộ bản sửa. Đang chờ kiểm tra cuối."),
      error: null,
    });
    return;
  }

  const sequence = position + 1;
  const target = validation.repairTargets[position];
  const existing = await readGenerationJobArtifact<StagedRepairArtifact>(
    job.id,
    { kind: "repair", sequence },
  );
  if (!existing) {
    const persistedInput = await requiredInputArtifact(job.id);
    const input = lessonInputFromPersisted(persistedInput);
    const ocr = await requiredOcrArtifact(job.id);
    const blueprint = await requiredBlueprintArtifact(job.id);
    const assembly = await requiredAssemblyArtifact(job.id);
    const currentPeriod = assembly.lesson.periodPlans?.find(
      (period) => period.periodNumber === target.periodNumber,
    );
    if (!currentPeriod) throw new Error(`Không tìm thấy tiết ${target.periodNumber} trong giáo án đã ghép.`);
    let previousHandoff = target.periodNumber > 1
      ? assembly.lesson.periodPlans?.find((period) => period.periodNumber === target.periodNumber - 1)?.handoff || null
      : null;
    const previousRepairIndex = validation.repairTargets.findIndex(
      (repairTarget, index) => index < position && repairTarget.periodNumber === target.periodNumber - 1,
    );
    if (previousRepairIndex >= 0) {
      const previousRepair = await readGenerationJobArtifact<StagedRepairArtifact>(
        job.id,
        { kind: "repair", sequence: previousRepairIndex + 1 },
      );
      if (!previousRepair) {
        throw new Error(`Không tìm thấy bản sửa của tiết ${target.periodNumber - 1} để giữ continuity.`);
      }
      previousHandoff = previousRepair.payload.handoff || previousRepair.payload.period.handoff || null;
    }
    const findingCodes = new Set(target.findingCodes);
    const findings = validation.findings.filter((finding) =>
      findingCodes.has(finding.code)
      && (finding.periodNumber === undefined || finding.periodNumber === target.periodNumber),
    );
    if (!findings.length) throw new Error(`Không tìm thấy chi tiết lỗi cần sửa cho tiết ${target.periodNumber}.`);
    const strategy = getPlanModelStrategy(job.quotaReservation?.plan || "free");
    const repaired = await repairStagedPeriod(
      input,
      ocr.text,
      blueprint,
      currentPeriod,
      previousHandoff,
      findings,
      sequence,
      strategy,
    );
    await writeGenerationJobArtifact(job.id, { kind: "repair", sequence }, repaired);
  }

  if (sequence < total) {
    await updateWithLeaseOrThrow(job.id, job.uid, owner, {
      status: "waiting_next_step",
      currentStage: "repair",
      stageCursor: { position: sequence, total },
      progress: {
        ...job.progress,
        currentPeriod: target.periodNumber,
        message: `Đã sửa tiết ${target.periodNumber} (${sequence}/${total}). Đang chờ sửa tiết tiếp theo.`,
      },
      error: null,
    });
    return;
  }

  await finalizeStagedRepairs(job, validation);
  const progress = progressAfterUnit(job, "Đã sửa và ghép lại các tiết. Đang chờ kiểm tra cuối.");
  progress.currentPeriod = target.periodNumber;
  await updateWithLeaseOrThrow(job.id, job.uid, owner, {
    status: "waiting_next_step",
    currentStage: "final-validation",
    stageCursor: { position: 0, total: 1 },
    progress,
    error: null,
  });
}

async function executeFinalValidationStep(job: GenerationJob, owner: string) {
  let finalArtifact = (await readGenerationJobArtifact<StagedFinalArtifact>(
    job.id,
    { kind: "final" },
  ))?.payload;
  if (!finalArtifact) {
    const persistedInput = await requiredInputArtifact(job.id);
    const input = lessonInputFromPersisted(persistedInput);
    const assembly = await requiredAssemblyArtifact(job.id);
    const blueprint = await requiredBlueprintArtifact(job.id);
    finalArtifact = finalizeStagedLesson(input, assembly, blueprint);
    await writeGenerationJobArtifact(job.id, { kind: "final" }, finalArtifact);
  }

  const nextStage = finalArtifact.canPersist ? "persistence" : "quota-settlement";
  const rejectedCount = Math.max(finalArtifact.summary.errors, finalArtifact.fatalCodes?.length || 0);
  await updateWithLeaseOrThrow(job.id, job.uid, owner, {
    status: "waiting_next_step",
    currentStage: nextStage,
    stageCursor: { position: 0, total: 1 },
    progress: progressAfterUnit(
      job,
      finalArtifact.canPersist
        ? finalArtifact.decision === "draft"
          ? "Bản giáo án cần điều chỉnh đã sẵn sàng. Đang chờ lưu giáo án."
          : "Kiểm tra cuối đạt yêu cầu. Đang chờ lưu giáo án."
        : `Kiểm tra cuối còn ${rejectedCount} lỗi fatal/chặn; giáo án sẽ không được lưu.`,
    ),
    error: finalArtifact.canPersist
      ? null
      : {
          code: "FINAL_VALIDATION_BLOCKED",
          message: `Giáo án còn ${rejectedCount} lỗi fatal/chặn và không đủ điều kiện lưu.`,
          stage: "final-validation",
          retryable: false,
        },
  });
}

async function executePersistenceStep(job: GenerationJob, owner: string) {
  const finalArtifact = await requiredFinalArtifact(job.id);
  if (!finalArtifact.canPersist || finalArtifact.decision === "reject") {
    throw new GenerationJobConflictError(
      "Kết quả kiểm tra cuối không cho phép lưu giáo án.",
      "FINAL_ARTIFACT_NOT_PERSISTABLE",
    );
  }

  const lessonId = job.lessonId
    || await persistStagedGeneratedLesson(job.uid, job.id, finalArtifact.lesson);
  await updateWithLeaseOrThrow(job.id, job.uid, owner, {
    status: "waiting_next_step",
    currentStage: "quota-settlement",
    stageCursor: { position: 0, total: 1 },
    lessonId,
    progress: progressAfterUnit(job, "Đã lưu giáo án. Đang chờ xác nhận lượt sử dụng."),
    error: null,
  });
}

function stagedTelemetryExecutionKey(job: GenerationJob) {
  return `${job.currentStage}:${job.stageCursor.position}`;
}

function telemetryWithExecution(
  job: GenerationJob,
  context: GenerationContext | null,
) {
  if (!context) return job.telemetry;
  const executionKey = stagedTelemetryExecutionKey(job);
  const entries = {
    ...(job.telemetry?.entries || {}),
    [executionKey]: {
      executionKey,
      stage: job.currentStage,
      attempt: job.attempt + 1,
      recordedAt: new Date(),
      calls: normalizeSecurityGenerationCalls(context.calls),
    },
  };
  let remaining = MAX_GENERATION_SECURITY_CALLS;
  const boundedEntries = Object.fromEntries(
    Object.entries(entries).slice(-80).flatMap(([key, entry]) => {
      if (remaining <= 0) return [];
      const calls = entry.calls.slice(0, remaining);
      remaining -= calls.length;
      return [[key, { ...entry, calls }]];
    }),
  );
  return { entries: boundedEntries };
}

function stagedTelemetryCalls(job: GenerationJob) {
  return Object.values(job.telemetry?.entries || {})
    .flatMap((entry) => entry.calls)
    .slice(-MAX_GENERATION_SECURITY_CALLS);
}

function quotaSettlementTelemetry(
  job: GenerationJob,
  finalArtifact: StagedFinalArtifact,
  outcome: "success" | "rejected",
) {
  const calls = stagedTelemetryCalls(job);
  return {
    version: 2,
    pipelineVersion: job.pipelineVersion,
    jobId: job.id,
    stage: "quota-settlement",
    outcome,
    periods: job.inputSummary.periods,
    subjectKind: finalArtifact.subjectKind,
    repairApplied: finalArtifact.repairApplied,
    validationDecision: finalArtifact.decision,
    validationSummary: finalArtifact.summary,
    summary: summarizeSecurityGenerationCalls(calls),
    calls,
  };
}

async function failUnresolvedLessonTitle(
  job: GenerationJob,
  owner: string,
) {
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
    const detail = settlementError instanceof Error
      ? settlementError.message
      : "Không thể hoàn tất hoàn lượt hoặc dọn dữ liệu đầu vào.";
    await updateWithLeaseOrThrow(job.id, job.uid, owner, {
      status: "waiting_next_step",
      currentStage: job.currentStage,
      progress: {
        ...job.progress,
        message: "Đã từ chối tên bài nhưng chưa hoàn tất hoàn lượt/dọn dữ liệu; có thể thử lại bước này.",
      },
      error: {
        code: "LESSON_TITLE_SETTLEMENT_FAILED",
        message: detail,
        stage: job.currentStage,
        retryable: true,
      },
    });
    throw new GenerationJobRequestError(
      detail,
      "LESSON_TITLE_SETTLEMENT_FAILED",
      503,
    );
  }
  await updateWithLeaseOrThrow(job.id, job.uid, owner, {
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
  });
}

async function failQuotaSettlementInvariant(
  job: GenerationJob,
  owner: string,
  code: "PERSISTED_LESSON_MISSING" | "QUOTA_RESERVATION_MISSING",
  message: string,
) {
  if (job.quotaReservation) {
    await releaseUsage(job.quotaReservation, "staged_quota_settlement_invariant", {
      jobId: job.id,
      stage: "quota-settlement",
      code,
    });
  }
  await cleanupGenerationJobInput(job);
  await updateWithLeaseOrThrow(job.id, job.uid, owner, {
    status: "failed",
    currentStage: "quota-settlement",
    stageCursor: { position: 1, total: 1 },
    progress: {
      ...job.progress,
      message,
    },
    error: {
      code,
      message,
      stage: "quota-settlement",
      retryable: false,
    },
  });
}

async function executeQuotaSettlementStep(job: GenerationJob, owner: string) {
  const finalArtifact = await requiredFinalArtifact(job.id);
  const reservation = job.quotaReservation;

  if (finalArtifact.canPersist) {
    if (!job.lessonId) {
      await failQuotaSettlementInvariant(
        job,
        owner,
        "PERSISTED_LESSON_MISSING",
        "Không tìm thấy ID giáo án đã lưu để xác nhận lượt sử dụng.",
      );
      return;
    }
    if (!reservation) {
      await failQuotaSettlementInvariant(
        job,
        owner,
        "QUOTA_RESERVATION_MISSING",
        "Không tìm thấy lượt sử dụng đã giữ để xác nhận giáo án.",
      );
      return;
    }

    await commitUsage(
      reservation,
      job.lessonId,
      quotaSettlementTelemetry(job, finalArtifact, "success"),
    );
    await cleanupGenerationJobInput(job);
    await updateWithLeaseOrThrow(job.id, job.uid, owner, {
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
  await updateWithLeaseOrThrow(job.id, job.uid, owner, {
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
  });
}

export async function advanceStagedGenerationJob(uid: string, jobId: string, ocrAsset?: UploadedAsset) {
  const job = await getGenerationJobForUser(jobId, uid);
  if (!job) {
    throw new GenerationJobRequestError("Không tìm thấy yêu cầu tạo giáo án.", "GENERATION_JOB_NOT_FOUND", 404);
  }
  if (!["completed", "failed", "cancelled"].includes(job.status) && job.expiresAt.getTime() <= Date.now()) {
    const expired = await expireStagedGenerationJobIfNeeded(uid, jobId);
    if (expired) return expired;
  }
  if (["completed", "failed", "cancelled"].includes(job.status)) {
    throw new GenerationJobConflictError("Generation job không còn có thể chạy tiếp.", "GENERATION_JOB_TERMINAL");
  }
  if (!(["ocr", "source-preparation", "blueprint", "period-generation", "assembly", "subject-validation", "repair", "final-validation", "persistence", "quota-settlement"] as const).includes(
    job.currentStage as "ocr" | "source-preparation" | "blueprint" | "period-generation" | "assembly" | "subject-validation" | "repair" | "final-validation" | "persistence" | "quota-settlement",
  )) {
    throw new GenerationJobConflictError("Generation job chưa ở bước có thể chạy.", "GENERATION_STAGE_NOT_ADVANCEABLE");
  }

  const owner = randomUUID();
  const stepTimeoutMs = stagedStepTimeoutMs(job.currentStage);
  const lease = await acquireGenerationJobLease(job.id, uid, owner, stepTimeoutMs + 15_000);
  if (!lease) {
    throw new GenerationJobConflictError(
      "Một tiến trình khác đang xử lý bước này. Vui lòng đợi rồi thử lại.",
      "GENERATION_JOB_BUSY",
    );
  }

  const telemetryHolder: { current: GenerationContext | null } = { current: null };
  try {
    await updateWithLeaseOrThrow(job.id, uid, owner, {
      status: "running",
      attempt: job.attempt + 1,
      error: null,
    });
    await withGenerationDeadline(
      `${job.id}:${job.currentStage}:${job.stageCursor.position}`,
      async () => {
        if (job.currentStage === "ocr") return executeOcrStep(job, owner, ocrAsset);
        if (job.currentStage === "source-preparation") return executeSourcePreparationStep(job, owner);
        if (job.currentStage === "blueprint") return executeBlueprintStep(job, owner);
        if (job.currentStage === "period-generation") return executePeriodGenerationStep(job, owner);
        if (job.currentStage === "assembly") return executeAssemblyStep(job, owner);
        if (job.currentStage === "subject-validation") return executeSubjectValidationStep(job, owner);
        if (job.currentStage === "repair") return executeRepairStep(job, owner);
        if (job.currentStage === "final-validation") return executeFinalValidationStep(job, owner);
        if (job.currentStage === "persistence") return executePersistenceStep(job, owner);
        return executeQuotaSettlementStep(job, owner);
      },
      (context) => { telemetryHolder.current = context; },
      stepTimeoutMs,
    );
  } catch (error) {
    if (error instanceof LessonTitleResolutionError) {
      await failUnresolvedLessonTitle(job, owner);
    } else if (error instanceof GenerationJobRequestError) {
      await updateLeasedGenerationJob(job.id, uid, owner, {
        status: "waiting_next_step",
        error: null,
        progress: job.progress,
      }).catch(() => undefined);
    } else if (!(error instanceof GenerationJobConflictError)) {
      await updateLeasedGenerationJob(job.id, uid, owner, {
        status: "waiting_next_step",
        error: {
          code: error instanceof GenerationTimeoutError ? "GENERATION_STEP_TIMEOUT" : "GENERATION_STEP_FAILED",
          message: error instanceof Error ? error.message : "Không thể chạy bước tạo giáo án.",
          stage: job.currentStage,
          retryable: true,
        },
        progress: {
          ...job.progress,
          message: "Bước hiện tại gặp lỗi; có thể thử lại.",
        },
      }).catch(() => undefined);
    }
    if (error instanceof LessonTitleResolutionError) {
      throw new GenerationJobRequestError(
        LESSON_TITLE_REQUIRED_MESSAGE,
        "LESSON_TITLE_UNRESOLVED",
        422,
      );
    }
    if (error instanceof GenerationJobConflictError || error instanceof GenerationJobRequestError) throw error;
    throw new GenerationJobRequestError(
      error instanceof Error ? error.message : "Không thể chạy bước tạo giáo án.",
      error instanceof GenerationTimeoutError ? "GENERATION_STEP_TIMEOUT" : "GENERATION_STEP_FAILED",
      error instanceof GenerationTimeoutError ? 504 : 502,
    );
  } finally {
    if (telemetryHolder.current) {
      await updateLeasedGenerationJob(job.id, uid, owner, {
        telemetry: telemetryWithExecution(job, telemetryHolder.current),
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
