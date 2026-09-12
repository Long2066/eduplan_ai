import { createHash } from "node:crypto";
import {
  STAGED_PHASES,
  stagedActivityId,
  type StagedAnchor,
  type StagedAssessmentArtifact,
  type StagedContentArtifact,
  type StagedLessonMapArtifact,
  type StagedMaterialsArtifact,
  type StagedOutcomesArtifact,
  type StagedPeriodBlueprintArtifact,
  type StagedPhaseArtifact,
  type StagedPhaseName,
  type StagedSectionArtifacts,
  type StagedSectionIssue,
  type StagedSectionPrefixOptions,
  type StagedSectionValidation,
  type StagedSourceFactsArtifact,
} from "@/lib/generation/section-types";
import type { LessonInput } from "@/types/lesson";

export class StagedSectionValidationError extends Error {
  public readonly issues: StagedSectionIssue[];

  constructor(message: string, issues: StagedSectionIssue[]) {
    super(message);
    this.name = "StagedSectionValidationError";
    this.issues = issues;
  }
}

/**
 * Recursively serializes any value into deterministic canonical JSON.
 * - Object keys are sorted alphabetically at every nesting level.
 * - Undefined object values are omitted.
 * - Arrays maintain element order and each element is canonicalized.
 */
export function canonicalJson(value: unknown): string {
  if (value === null || value === undefined) {
    return "null";
  }
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return "[" + value.map((elem) => canonicalJson(elem)).join(",") + "]";
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record)
      .filter((k) => record[k] !== undefined)
      .sort();
    return "{" + keys.map((key) => JSON.stringify(key) + ":" + canonicalJson(record[key])).join(",") + "}";
  }
  return JSON.stringify(value);
}

export function computeStagedDataHash(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex").slice(0, 16);
}

export function makeStagedAnchor(value: unknown, revision = 1): StagedAnchor {
  return { revision, hash: computeStagedDataHash(value) };
}

/**
 * Returns the exact immutable payload for each staged artifact kind.
 * Recomputed hash of this exact payload MUST match artifact.anchor.hash.
 */
export function getStagedSourceFactsPayload(artifact: StagedSourceFactsArtifact) {
  return {
    facts: artifact.facts,
    promptSource: artifact.promptSource,
    ...(artifact.classification ? { classification: artifact.classification } : {}),
    ...(artifact.sourceInventory ? { sourceInventory: artifact.sourceInventory } : {}),
  };
}

export function getStagedOutcomesPayload(artifact: StagedOutcomesArtifact) {
  return {
    outcomes: artifact.outcomes,
  };
}

export function getStagedLessonMapPayload(artifact: StagedLessonMapArtifact) {
  return {
    lessonMap: artifact.lessonMap,
  };
}

export function getStagedPeriodBlueprintPayload(artifact: StagedPeriodBlueprintArtifact) {
  return {
    periodNumber: artifact.periodNumber,
    periodBlueprint: artifact.periodBlueprint,
  };
}

export function getStagedMaterialsPayload(artifact: StagedMaterialsArtifact) {
  return {
    materials: artifact.materials,
    items: artifact.items,
  };
}

export function getStagedPhasePayload(artifact: StagedPhaseArtifact) {
  return {
    periodNumber: artifact.periodNumber,
    phase: artifact.phase,
    activity: artifact.activity,
    materialIds: artifact.materialIds,
    sourceIds: artifact.sourceIds,
    input: artifact.input,
    handoff: artifact.handoff,
  };
}

export function getStagedAssessmentPayload(artifact: StagedAssessmentArtifact) {
  return {
    assessment: artifact.assessment,
    alignment: artifact.alignment,
  };
}

export function getStagedArtifactPayload(artifact: StagedContentArtifact<any>): unknown {
  switch (artifact.kind) {
    case "source-facts":
      return getStagedSourceFactsPayload(artifact as StagedSourceFactsArtifact);
    case "section-outcomes":
      return getStagedOutcomesPayload(artifact as StagedOutcomesArtifact);
    case "lesson-map":
      return getStagedLessonMapPayload(artifact as StagedLessonMapArtifact);
    case "period-blueprint":
      return getStagedPeriodBlueprintPayload(artifact as StagedPeriodBlueprintArtifact);
    case "section-materials":
      return getStagedMaterialsPayload(artifact as StagedMaterialsArtifact);
    case "period-phase":
      return getStagedPhasePayload(artifact as StagedPhaseArtifact);
    case "section-assessment":
      return getStagedAssessmentPayload(artifact as StagedAssessmentArtifact);
    default:
      throw new Error(`Loại artifact không xác định: ${(artifact as any).kind}`);
  }
}

export function stagedArtifactAnchor(
  artifact: StagedContentArtifact<any>,
  revision?: number,
): StagedAnchor {
  return makeStagedAnchor(
    getStagedArtifactPayload(artifact),
    revision ?? artifact.anchor?.revision ?? 1,
  );
}

function checkIdentity(
  input: LessonInput,
  artifactIdentity: { subject: string; grade: string; periods: number; duration: number },
  label: string,
  issues: StagedSectionIssue[],
) {
  if (artifactIdentity.subject !== input.subject) {
    issues.push({
      code: "SEC-ID-SUBJ",
      message: `${label} môn ${artifactIdentity.subject} != ${input.subject}`,
      path: "identity.subject",
    });
  }
  if (artifactIdentity.grade !== input.grade) {
    issues.push({
      code: "SEC-ID-GRADE",
      message: `${label} khối lớp ${artifactIdentity.grade} != ${input.grade}`,
      path: "identity.grade",
    });
  }
  const expPeriods = Math.max(1, Number(input.periods || 1));
  if (artifactIdentity.periods !== expPeriods) {
    issues.push({
      code: "SEC-ID-PERIODS",
      message: `${label} số tiết ${artifactIdentity.periods} != ${expPeriods}`,
      path: "identity.periods",
    });
  }
  const expDuration = Number(input.duration || 35);
  if (artifactIdentity.duration !== expDuration) {
    issues.push({
      code: "SEC-ID-DURATION",
      message: `${label} thời lượng ${artifactIdentity.duration} != ${expDuration}`,
      path: "identity.duration",
    });
  }
}

function verifyArtifactHash(
  artifact: StagedContentArtifact<any>,
  label: string,
  path: string,
  issues: StagedSectionIssue[],
) {
  if (!artifact.anchor || !artifact.anchor.hash) {
    issues.push({
      code: "SEC-HASH-MISSING",
      message: `${label} thiếu mã băm anchor.hash`,
      path: `${path}.anchor`,
    });
    return;
  }
  const expected = stagedArtifactAnchor(artifact, artifact.anchor.revision);
  if (artifact.anchor.hash !== expected.hash) {
    issues.push({
      code: "SEC-HASH-MISMATCH",
      message: `${label} có mã băm ${artifact.anchor.hash} không khớp mã băm tính toán từ dữ liệu thực tế ${expected.hash}`,
      path: `${path}.anchor.hash`,
    });
  }
}

function checkObjectiveIds(
  value: unknown,
  validIds: Set<string>,
  issue: StagedSectionIssue,
  issues: StagedSectionIssue[],
): Set<string> {
  const ids = new Set<string>();
  if (!Array.isArray(value) || value.length === 0) {
    issues.push({ ...issue, message: `${issue.message}: objectiveIds phải là mảng ID không rỗng` });
    return ids;
  }
  for (const id of value) {
    if (typeof id !== "string" || !id.trim() || !validIds.has(id)) {
      issues.push({
        ...issue,
        message: `${issue.message}: objectiveId không hợp lệ trong Mục I: ${canonicalJson(id)}`,
        ...(typeof id === "string" ? { objectiveId: id } : {}),
      });
    } else {
      ids.add(id);
    }
  }
  return ids;
}

/**
 * Validates any prefix of staged-v2 artifacts strictly.
 * - Verifies identities and exact payload hashes for every present artifact.
 * - Verifies dependency pointer hashes against existing prerequisites.
 * - Verifies internal unit integrity (actions, duration, handoffs).
 * - Does NOT flag missing future artifacts.
 * - When all lesson phases are present, validates full coverage of all outcomes.
 */
export function validateStagedSectionPrefix(
  options: StagedSectionPrefixOptions,
): StagedSectionValidation {
  const { input, sourceFacts, outcomes, lessonMap, periodBlueprints, materials, phases, assessment } = options;
  const issues: StagedSectionIssue[] = [];

  const expectedPeriods = Math.max(1, Number(input.periods || 1));
  const expectedDuration = Number(input.duration || 35);

  // 1. Validate Source Facts
  if (!sourceFacts) {
    issues.push({
      code: "SEC-SRC-MISSING",
      message: "Thiếu artifact sourceFacts",
      path: "sourceFacts",
    });
    return { passed: false, issues };
  }

  checkIdentity(input, sourceFacts.identity, "Mục Nguồn", issues);
  verifyArtifactHash(sourceFacts, "Mục Nguồn", "sourceFacts", issues);

  if (!sourceFacts.facts || !Array.isArray(sourceFacts.facts.sourceEvidence)) {
    issues.push({
      code: "SEC-SRC-EVIDENCE-EMPTY",
      message: "Mục Nguồn thiếu danh sách dữ kiện sourceEvidence",
      path: "sourceFacts.facts.sourceEvidence",
    });
  } else if (sourceFacts.facts.sourceEvidence.length === 0) {
    issues.push({
      code: "SEC-SRC-EVIDENCE-EMPTY",
      message: "Mục Nguồn phải có ít nhất một dữ kiện sourceEvidence",
      path: "sourceFacts.facts.sourceEvidence",
    });
  }

  const validSourceIds = new Set<string>();
  const seenSourceIds = new Set<string>();
  for (const src of sourceFacts.facts?.sourceEvidence || []) {
    if (!src.id) {
      issues.push({
        code: "SEC-SRC-ITEM-NO-ID",
        message: "Dữ kiện nguồn thiếu id",
        path: "sourceFacts.facts.sourceEvidence",
      });
      continue;
    }
    if (seenSourceIds.has(src.id)) {
      issues.push({
        code: "SEC-SRC-ITEM-DUP-ID",
        message: `Dữ kiện nguồn trùng lặp id: ${src.id}`,
        path: `sourceFacts.facts.sourceEvidence[${src.id}]`,
      });
    }
    seenSourceIds.add(src.id);
    validSourceIds.add(src.id);
    if (!src.label || !src.label.trim()) {
      issues.push({
        code: "SEC-SRC-ITEM-NO-LABEL",
        message: `Dữ kiện nguồn ${src.id} thiếu tiêu đề/label`,
        path: `sourceFacts.facts.sourceEvidence[${src.id}].label`,
      });
    }
  }

  // 2. Validate Outcomes (if present)
  const validObjectiveIds = new Set<string>();
  const objectiveStatements = new Map<string, string>();
  if (outcomes) {
    checkIdentity(input, outcomes.identity, "Mục I (Mục tiêu)", issues);
    verifyArtifactHash(outcomes, "Mục I (Mục tiêu)", "outcomes", issues);

    if (outcomes.dependencies.source?.hash !== sourceFacts.anchor.hash) {
      issues.push({
        code: "SEC-DEP-OUTCOMES-SRC",
        message: `Mục I trỏ hash nguồn (${outcomes.dependencies.source?.hash || "null"}) không khớp Mục Nguồn (${sourceFacts.anchor.hash})`,
        path: "outcomes.dependencies.source",
      });
    }

    const metas = outcomes.outcomes?.objectiveMetadata;
    if (!Array.isArray(metas) || metas.length === 0) {
      issues.push({
        code: "SEC-OUTCOMES-EMPTY",
        message: "Mục I phải có ít nhất một YCCĐ trong objectiveMetadata có id cố định",
        path: "outcomes.outcomes.objectiveMetadata",
      });
    } else {
      const seenObjIds = new Set<string>();
      for (const obj of metas) {
        if (!obj.id) {
          issues.push({
            code: "SEC-OUTCOMES-ITEM-NO-ID",
            message: "YCCĐ thiếu id",
            path: "outcomes.outcomes.objectiveMetadata",
          });
          continue;
        }
        if (seenObjIds.has(obj.id)) {
          issues.push({
            code: "SEC-OUTCOMES-ITEM-DUP-ID",
            message: `YCCĐ trùng lặp id: ${obj.id}`,
            path: `outcomes.outcomes.objectiveMetadata[${obj.id}]`,
          });
        }
        seenObjIds.add(obj.id);
        validObjectiveIds.add(obj.id);
        objectiveStatements.set(obj.id, obj.statement);

        if (!obj.statement || !obj.statement.trim()) {
          issues.push({
            code: "SEC-OUTCOMES-ITEM-NO-STMT",
            message: `YCCĐ ${obj.id} có nội dung statement rỗng`,
            path: `outcomes.outcomes.objectiveMetadata[${obj.id}].statement`,
            objectiveId: obj.id,
          });
        }
      }
    }
  }

  // 3. Validate Lesson Map (if present)
  const periodObjectiveIds = new Map<number, Set<string>>();
  if (lessonMap) {
    if (!outcomes) {
      issues.push({
        code: "SEC-DEP-MAP-OUTCOMES-MISSING",
        message: "Bản đồ bài học yêu cầu Mục I (outcomes) phải có trước",
        path: "lessonMap",
      });
    } else {
      checkIdentity(input, lessonMap.identity, "Bản đồ bài học", issues);
      verifyArtifactHash(lessonMap, "Bản đồ bài học", "lessonMap", issues);

      if (lessonMap.dependencies.source?.hash !== sourceFacts.anchor.hash) {
        issues.push({
          code: "SEC-DEP-MAP-SRC",
          message: "Bản đồ bài học không trỏ đúng hash Mục Nguồn",
          path: "lessonMap.dependencies.source",
        });
      }
      if (lessonMap.dependencies.outcomes?.hash !== outcomes.anchor.hash) {
        issues.push({
          code: "SEC-DEP-MAP-OUTCOMES",
          message: "Bản đồ bài học không trỏ đúng hash Mục I",
          path: "lessonMap.dependencies.outcomes",
        });
      }

      const periods = lessonMap.lessonMap?.periods;
      const mappedObjectiveIds = new Set<string>();
      if (!Array.isArray(periods) || periods.length !== expectedPeriods) {
        issues.push({
          code: "SEC-MAP-PERIODS-LEN",
          message: `Bản đồ bài học phải có đúng ${expectedPeriods} tiết nhưng nhận ${Array.isArray(periods) ? periods.length : 0}`,
          path: "lessonMap.lessonMap.periods",
        });
      }
      if (Array.isArray(periods)) {
        periods.forEach((p, idx) => {
          if (p?.periodNumber !== idx + 1) {
            issues.push({
              code: "SEC-MAP-PERIOD-NUM",
              message: `Bản đồ bài học tiết thứ ${idx + 1} có periodNumber = ${p?.periodNumber}`,
              path: `lessonMap.lessonMap.periods[${idx}].periodNumber`,
            });
          }
          if (typeof p?.focus !== "string" || !p.focus.trim()) {
            issues.push({
              code: "SEC-MAP-PERIOD-FOCUS",
              message: `Bản đồ bài học tiết ${idx + 1} thiếu trọng tâm focus`,
              path: `lessonMap.lessonMap.periods[${idx}].focus`,
            });
          }
          const ids = checkObjectiveIds(p?.objectiveIds, validObjectiveIds, {
            code: "SEC-MAP-INVALID-OBJ",
            message: `Bản đồ bài học Tiết ${idx + 1}`,
            path: `lessonMap.lessonMap.periods[${idx}].objectiveIds`,
            periodNumber: idx + 1,
          }, issues);
          if (p?.periodNumber === idx + 1) periodObjectiveIds.set(p.periodNumber, ids);
          for (const id of ids) mappedObjectiveIds.add(id);
          for (const srcId of Array.isArray(p?.sourceIds) ? p.sourceIds : []) {
            if (!validSourceIds.has(srcId)) {
              issues.push({
                code: "SEC-MAP-INVALID-SRC",
                message: `Bản đồ bài học tiết ${p.periodNumber} tham chiếu sourceId không tồn tại: ${srcId}`,
                path: `lessonMap.lessonMap.periods[${idx}].sourceIds`,
              });
            }
          }
        });
      }
      for (const id of validObjectiveIds) {
        if (!mappedObjectiveIds.has(id)) {
          issues.push({
            code: "SEC-MAP-OBJ-UNCOVERED",
            message: `YCCĐ ${id} ("${objectiveStatements.get(id)}") chưa được khai báo trong objectiveIds của bất kỳ tiết nào trên Bản đồ bài học`,
            path: "lessonMap.lessonMap.periods",
            objectiveId: id,
          });
        }
      }

      // Validate continuityPlan on LessonMap
      const continuityPlan = lessonMap.lessonMap?.continuityPlan;
      if (!continuityPlan || typeof continuityPlan !== "object") {
        issues.push({
          code: "SEC-MAP-CONTINUITY-MISSING",
          message: "Bản đồ bài học thiếu cấu trúc continuityPlan hợp lệ",
          path: "lessonMap.lessonMap.continuityPlan",
        });
      } else {
        if (!Array.isArray(continuityPlan.sourceUnits)) {
          issues.push({
            code: "SEC-MAP-CONTINUITY-UNITS",
            message: "continuityPlan.sourceUnits phải là mảng",
            path: "lessonMap.lessonMap.continuityPlan.sourceUnits",
          });
        }
        if (!Array.isArray(continuityPlan.clusters)) {
          issues.push({
            code: "SEC-MAP-CONTINUITY-CLUSTERS",
            message: "continuityPlan.clusters phải là mảng",
            path: "lessonMap.lessonMap.continuityPlan.clusters",
          });
        }
        if (Array.isArray(continuityPlan.sourceUnits) && Array.isArray(continuityPlan.clusters)) {
          const unitIds = new Set<string>();
          for (let uIdx = 0; uIdx < continuityPlan.sourceUnits.length; uIdx++) {
            const unit = continuityPlan.sourceUnits[uIdx];
            if (!unit || typeof unit !== "object" || typeof unit.unitId !== "string" || !unit.unitId.trim()) {
              issues.push({
                code: "SEC-MAP-CONTINUITY-UNIT-ID",
                message: `Source unit thứ ${uIdx + 1} thiếu unitId hợp lệ`,
                path: `lessonMap.lessonMap.continuityPlan.sourceUnits[${uIdx}].unitId`,
              });
              continue;
            }
            if (validSourceIds.size > 0 && !validSourceIds.has(unit.unitId)) {
              issues.push({
                code: "SEC-MAP-CONTINUITY-UNKNOWN-UNIT",
                message: `Source unit ${unit.unitId} không tồn tại trong Mục Nguồn`,
                path: `lessonMap.lessonMap.continuityPlan.sourceUnits[${uIdx}].unitId`,
              });
            }
            unitIds.add(unit.unitId);
          }

          for (let cIdx = 0; cIdx < continuityPlan.clusters.length; cIdx++) {
            const cluster = continuityPlan.clusters[cIdx];
            if (!cluster || typeof cluster !== "object" || typeof cluster.clusterId !== "string" || !cluster.clusterId.trim()) {
              issues.push({
                code: "SEC-MAP-CONTINUITY-CLUSTER-ID",
                message: `Cluster thứ ${cIdx + 1} thiếu clusterId hợp lệ`,
                path: `lessonMap.lessonMap.continuityPlan.clusters[${cIdx}].clusterId`,
              });
              continue;
            }
            if (!Array.isArray(cluster.sourceUnitIds)) {
              issues.push({
                code: "SEC-MAP-CONTINUITY-CLUSTER-SOURCES",
                message: `Cụm “${cluster.label || cluster.clusterId}” thiếu danh sách sourceUnitIds hợp lệ`,
                path: `lessonMap.lessonMap.continuityPlan.clusters[${cIdx}].sourceUnitIds`,
              });
            } else {
              for (const uId of cluster.sourceUnitIds) {
                if (typeof uId !== "string" || (unitIds.size > 0 && !unitIds.has(uId))) {
                  issues.push({
                    code: "SEC-MAP-CONTINUITY-CLUSTER-UNIT-REF",
                    message: `Cụm “${cluster.label || cluster.clusterId}” tham chiếu unitId không tồn tại: ${uId}`,
                    path: `lessonMap.lessonMap.continuityPlan.clusters[${cIdx}].sourceUnitIds`,
                  });
                }
              }
            }
            if (cluster.periodNumber !== undefined && (typeof cluster.periodNumber !== "number" || cluster.periodNumber < 1 || cluster.periodNumber > expectedPeriods)) {
              issues.push({
                code: "SEC-MAP-CONTINUITY-CLUSTER-PERIOD",
                message: `Cụm “${cluster.label || cluster.clusterId}” có periodNumber không hợp lệ: ${cluster.periodNumber}`,
                path: `lessonMap.lessonMap.continuityPlan.clusters[${cIdx}].periodNumber`,
              });
            }
          }
        }
      }

      if (lessonMap.lessonMap?.sourceAllocation !== undefined) {
        if (!Array.isArray(lessonMap.lessonMap.sourceAllocation)) {
          issues.push({
            code: "SEC-MAP-SOURCE-ALLOC-NOT-ARRAY",
            message: "sourceAllocation phải là mảng",
            path: "lessonMap.lessonMap.sourceAllocation",
          });
        } else {
          lessonMap.lessonMap.sourceAllocation.forEach((alloc, aIdx) => {
            if (!alloc || typeof alloc !== "object" || (validSourceIds.size > 0 && !validSourceIds.has(alloc.sourceId))) {
              issues.push({
                code: "SEC-MAP-SOURCE-ALLOC-INVALID",
                message: `Phân bổ nguồn thứ ${aIdx + 1} tham chiếu sourceId không tồn tại: ${alloc?.sourceId}`,
                path: `lessonMap.lessonMap.sourceAllocation[${aIdx}].sourceId`,
              });
            }
            if (typeof alloc?.periodNumber !== "number" || alloc.periodNumber < 1 || alloc.periodNumber > expectedPeriods) {
              issues.push({
                code: "SEC-MAP-SOURCE-ALLOC-PERIOD",
                message: `Phân bổ nguồn thứ ${aIdx + 1} có periodNumber không hợp lệ: ${alloc?.periodNumber}`,
                path: `lessonMap.lessonMap.sourceAllocation[${aIdx}].periodNumber`,
              });
            }
          });
        }
      }
    }
  }

  // 4. Validate Period Blueprints (if present)
  const bpMap = new Map<number, StagedPeriodBlueprintArtifact>();
  if (periodBlueprints && periodBlueprints.length > 0) {
    if (!outcomes || !lessonMap) {
      issues.push({
        code: "SEC-DEP-BP-PREREQ-MISSING",
        message: "Blueprint tiết yêu cầu Mục I và Bản đồ bài học phải có trước",
        path: "periodBlueprints",
      });
    }

    const seenBpPeriods = new Set<number>();
    for (let idx = 0; idx < periodBlueprints.length; idx++) {
      const bp = periodBlueprints[idx];
      const pNum = bp.periodNumber;
      if (seenBpPeriods.has(pNum)) {
        issues.push({
          code: "SEC-BP-DUP-PERIOD",
          message: `Trùng lặp blueprint cho Tiết ${pNum}`,
          path: `periodBlueprints[${idx}].periodNumber`,
          periodNumber: pNum,
        });
      }
      seenBpPeriods.add(pNum);
      bpMap.set(pNum, bp);

      checkIdentity(input, bp.identity, `Blueprint Tiết ${pNum}`, issues);
      verifyArtifactHash(bp, `Blueprint Tiết ${pNum}`, `periodBlueprints[${pNum}]`, issues);

      if (outcomes && bp.dependencies.outcomes?.hash !== outcomes.anchor.hash) {
        issues.push({
          code: "SEC-DEP-BP-OUTCOMES",
          message: `Blueprint Tiết ${pNum} sai hash Mục I`,
          path: `periodBlueprints[${pNum}].dependencies.outcomes`,
          periodNumber: pNum,
        });
      }
      if (lessonMap && bp.dependencies.lessonMap?.hash !== lessonMap.anchor.hash) {
        issues.push({
          code: "SEC-DEP-BP-MAP",
          message: `Blueprint Tiết ${pNum} sai hash Bản đồ bài học`,
          path: `periodBlueprints[${pNum}].dependencies.lessonMap`,
          periodNumber: pNum,
        });
      }

      // Check blueprint phases
      const bpPhases = bp.periodBlueprint?.phases;
      if (!Array.isArray(bpPhases) || bpPhases.length !== 4) {
        issues.push({
          code: "SEC-BP-PHASES-LEN",
          message: `Blueprint Tiết ${pNum} phải có đúng 4 pha nhưng nhận ${bpPhases?.length ?? 0}`,
          path: `periodBlueprints[${pNum}].periodBlueprint.phases`,
          periodNumber: pNum,
        });
      } else {
        STAGED_PHASES.forEach((phaseName) => {
          const ph = bpPhases.find((item) => item.phase === phaseName);
          if (!ph) {
            issues.push({
              code: "SEC-BP-PHASE-MISSING",
              message: `Blueprint Tiết ${pNum} thiếu pha ${phaseName}`,
              path: `periodBlueprints[${pNum}].periodBlueprint.phases`,
              periodNumber: pNum,
              phase: phaseName,
            });
          } else {
            const expActId = stagedActivityId(pNum, phaseName);
            if (ph.activityId !== expActId) {
              issues.push({
                code: "SEC-BP-ACT-ID",
                message: `Blueprint Tiết ${pNum} Pha ${phaseName} có activityId ${ph.activityId} != ${expActId}`,
                path: `periodBlueprints[${pNum}].periodBlueprint.phases[${phaseName}].activityId`,
                periodNumber: pNum,
                phase: phaseName,
              });
            }
          }
        });
      }

      const expectedObjIds = periodObjectiveIds.get(pNum);
      const bpObjIds = checkObjectiveIds(bp.periodBlueprint?.objectiveIds, validObjectiveIds, {
        code: "SEC-BP-INVALID-OBJ",
        message: `Blueprint Tiết ${pNum}`,
        path: `periodBlueprints[${pNum}].periodBlueprint.objectiveIds`,
        periodNumber: pNum,
      }, issues);
      if (expectedObjIds) {
        for (const id of expectedObjIds) {
          if (!bpObjIds.has(id)) {
            issues.push({
              code: "SEC-BP-OBJ-UNCOVERED",
              message: `Blueprint Tiết ${pNum} thiếu mục tiêu được phân bổ từ Bản đồ bài học: ${id} ("${objectiveStatements.get(id)}")`,
              path: `periodBlueprints[${pNum}].periodBlueprint.objectiveIds`,
              periodNumber: pNum,
              objectiveId: id,
            });
          }
        }
        for (const id of bpObjIds) {
          if (!expectedObjIds.has(id)) {
            issues.push({
              code: "SEC-BP-OBJ-NOT-ALLOCATED",
              message: `Blueprint Tiết ${pNum} tự gán objectiveId ${id} không thuộc phân bổ của tiết này`,
              path: `periodBlueprints[${pNum}].periodBlueprint.objectiveIds`,
              periodNumber: pNum,
              objectiveId: id,
            });
          }
        }
      }

      const bpPhasesCoverage = new Set<string>();
      if (Array.isArray(bpPhases)) {
        for (const ph of bpPhases) {
          const phIds = checkObjectiveIds(ph.objectiveIds, validObjectiveIds, {
            code: "SEC-BP-PHASE-INVALID-OBJ",
            message: `Blueprint Tiết ${pNum} Pha ${ph.phase}`,
            path: `periodBlueprints[${pNum}].periodBlueprint.phases[${ph.phase}].objectiveIds`,
            periodNumber: pNum,
            phase: ph.phase,
          }, issues);
          for (const id of phIds) {
            bpPhasesCoverage.add(id);
            if (expectedObjIds && !expectedObjIds.has(id)) {
              issues.push({
                code: "SEC-BP-PHASE-OBJ-NOT-ALLOCATED",
                message: `Blueprint Tiết ${pNum} Pha ${ph.phase} gán objectiveId ${id} không thuộc phân bổ của tiết này`,
                path: `periodBlueprints[${pNum}].periodBlueprint.phases[${ph.phase}].objectiveIds`,
                periodNumber: pNum,
                phase: ph.phase,
                objectiveId: id,
              });
            }
          }
        }
      }
      if (expectedObjIds) {
        for (const id of expectedObjIds) {
          if (!bpPhasesCoverage.has(id)) {
            issues.push({
              code: "SEC-BP-OBJ-UNCOVERED",
              message: `Các pha trong Blueprint Tiết ${pNum} chưa bao phủ mục tiêu ${id} ("${objectiveStatements.get(id)}") được phân bổ cho tiết`,
              path: `periodBlueprints[${pNum}].periodBlueprint.phases`,
              periodNumber: pNum,
              objectiveId: id,
            });
          }
        }
      }
    }
  }

  // 5. Validate Materials (if present)
  const validMaterialIds = new Set<string>();
  if (materials) {
    if (!outcomes || !lessonMap) {
      issues.push({
        code: "SEC-DEP-MAT-PREREQ-MISSING",
        message: "Mục II yêu cầu Mục I và Bản đồ bài học phải có trước",
        path: "materials",
      });
    }

    checkIdentity(input, materials.identity, "Mục II (Thiết bị)", issues);
    verifyArtifactHash(materials, "Mục II (Thiết bị)", "materials", issues);

    if (sourceFacts && materials.dependencies.source?.hash !== sourceFacts.anchor.hash) {
      issues.push({
        code: "SEC-DEP-MAT-SRC",
        message: "Mục II không trỏ đúng hash Mục Nguồn",
        path: "materials.dependencies.source",
      });
    }
    if (outcomes && materials.dependencies.outcomes?.hash !== outcomes.anchor.hash) {
      issues.push({
        code: "SEC-DEP-MAT-OUTCOMES",
        message: "Mục II không trỏ đúng hash Mục I",
        path: "materials.dependencies.outcomes",
      });
    }
    if (lessonMap && materials.dependencies.lessonMap?.hash !== lessonMap.anchor.hash) {
      issues.push({
        code: "SEC-DEP-MAT-MAP",
        message: "Mục II không trỏ đúng hash Bản đồ bài học",
        path: "materials.dependencies.lessonMap",
      });
    }

    if (!Array.isArray(materials.items) || materials.items.length === 0) {
      issues.push({
        code: "SEC-MAT-ITEMS-EMPTY",
        message: "Mục II phải có danh sách items đồ dùng với id cố định",
        path: "materials.items",
      });
    } else {
      const seenMatIds = new Set<string>();
      for (const item of materials.items) {
        if (!item.id) {
          issues.push({
            code: "SEC-MAT-ITEM-NO-ID",
            message: "Đồ dùng thiếu id",
            path: "materials.items",
          });
          continue;
        }
        if (seenMatIds.has(item.id)) {
          issues.push({
            code: "SEC-MAT-ITEM-DUP-ID",
            message: `Đồ dùng trùng lặp id: ${item.id}`,
            path: `materials.items[${item.id}]`,
          });
        }
        seenMatIds.add(item.id);
        validMaterialIds.add(item.id);

        for (const objId of Array.isArray(item.objectiveIds) ? item.objectiveIds : []) {
          if (!validObjectiveIds.has(objId)) {
            issues.push({
              code: "SEC-MAT-INVALID-OBJ",
              message: `Thiết bị ${item.id} tham chiếu objectiveId không hợp lệ: ${objId}`,
              path: `materials.items[${item.id}].objectiveIds`,
              objectiveId: objId,
            });
          }
        }
        for (const srcId of Array.isArray(item.sourceIds) ? item.sourceIds : []) {
          if (!validSourceIds.has(srcId)) {
            issues.push({
              code: "SEC-MAT-INVALID-SRC",
              message: `Thiết bị ${item.id} tham chiếu sourceId không hợp lệ: ${srcId}`,
              path: `materials.items[${item.id}].sourceIds`,
            });
          }
        }
      }
    }
  }

  // 6. Validate Phases (if present)
  const coveredObjectiveIds = new Set<string>();
  if (phases && phases.length > 0) {
    if (!outcomes || !materials) {
      issues.push({
        code: "SEC-DEP-PHASE-PREREQ-MISSING",
        message: "Pha dạy học yêu cầu Mục I và Mục II phải có trước",
        path: "phases",
      });
    }

    // Canonical sequence index checker
    let prevPhaseArt: StagedPhaseArtifact | null = null;
    const periodMinutesMap = new Map<number, number>();

    for (let idx = 0; idx < phases.length; idx++) {
      const phaseArt = phases[idx];
      const pNum = phaseArt.periodNumber;
      const phaseName = phaseArt.phase;
      const actId = stagedActivityId(pNum, phaseName);

      // Verify canonical sequence (no phase skipping)
      const expectedPNum = Math.floor(idx / 4) + 1;
      const expectedPhaseName = STAGED_PHASES[idx % 4];
      if (pNum !== expectedPNum || phaseName !== expectedPhaseName) {
        issues.push({
          code: "SEC-PHASE-SEQUENCE",
          message: `Pha thứ ${idx + 1} phải là Tiết ${expectedPNum} Pha ${expectedPhaseName} nhưng nhận Tiết ${pNum} Pha ${phaseName}`,
          path: `phases[${idx}]`,
          periodNumber: pNum,
          phase: phaseName,
        });
      }

      checkIdentity(input, phaseArt.identity, `Tiết ${pNum} Pha ${phaseName}`, issues);
      verifyArtifactHash(phaseArt, `Tiết ${pNum} Pha ${phaseName}`, `phases[${actId}]`, issues);

      if (outcomes && phaseArt.dependencies.outcomes?.hash !== outcomes.anchor.hash) {
        issues.push({
          code: "SEC-DEP-PHASE-OUTCOMES",
          message: `Tiết ${pNum} Pha ${phaseName} sai hash Mục I`,
          path: `phases[${actId}].dependencies.outcomes`,
          periodNumber: pNum,
          phase: phaseName,
        });
      }
      if (materials && phaseArt.dependencies.materials?.hash !== materials.anchor.hash) {
        issues.push({
          code: "SEC-DEP-PHASE-MAT",
          message: `Tiết ${pNum} Pha ${phaseName} sai hash Mục II`,
          path: `phases[${actId}].dependencies.materials`,
          periodNumber: pNum,
          phase: phaseName,
        });
      }

      const bp = bpMap.get(pNum);
      if (bp && phaseArt.dependencies.periodBlueprint?.hash !== bp.anchor.hash) {
        issues.push({
          code: "SEC-DEP-PHASE-BP",
          message: `Tiết ${pNum} Pha ${phaseName} sai hash Period Blueprint`,
          path: `phases[${actId}].dependencies.periodBlueprint`,
          periodNumber: pNum,
          phase: phaseName,
        });
      }

      // Handoff & input continuity
      if (idx === 0) {
        if (phaseArt.dependencies.previousPhase) {
          issues.push({
            code: "SEC-DEP-PREV-PHASE-FIRST",
            message: "Pha mở đầu bài học (Tiết 1 Khởi động) không được có previousPhase dependency",
            path: `phases[${actId}].dependencies.previousPhase`,
            periodNumber: pNum,
            phase: phaseName,
          });
        }
        if (phaseArt.input.previousActivityId !== null) {
          issues.push({
            code: "SEC-PHASE-INPUT-PREV-ID-FIRST",
            message: "Pha mở đầu bài học phải có input.previousActivityId = null",
            path: `phases[${actId}].input.previousActivityId`,
            periodNumber: pNum,
            phase: phaseName,
          });
        }
        if (phaseArt.input.previousHandoffHash !== null) {
          issues.push({
            code: "SEC-PHASE-INPUT-PREV-HASH-FIRST",
            message: "Pha mở đầu bài học phải có input.previousHandoffHash = null",
            path: `phases[${actId}].input.previousHandoffHash`,
            periodNumber: pNum,
            phase: phaseName,
          });
        }
      } else {
        if (prevPhaseArt) {
          if (phaseArt.dependencies.previousPhase?.hash !== prevPhaseArt.anchor.hash) {
            issues.push({
              code: "SEC-DEP-PREV-PHASE-MISMATCH",
              message: `Tiết ${pNum} Pha ${phaseName} không khớp hash dây nối của pha trước (${prevPhaseArt.activity.id})`,
              path: `phases[${actId}].dependencies.previousPhase`,
              periodNumber: pNum,
              phase: phaseName,
            });
          }
          if (phaseArt.input.previousActivityId !== prevPhaseArt.activity.id) {
            issues.push({
              code: "SEC-PHASE-INPUT-PREV-ID",
              message: `Tiết ${pNum} Pha ${phaseName} ghi nhận previousActivityId (${phaseArt.input.previousActivityId}) != ${prevPhaseArt.activity.id}`,
              path: `phases[${actId}].input.previousActivityId`,
              periodNumber: pNum,
              phase: phaseName,
            });
          }
          if (phaseArt.input.previousHandoffHash !== prevPhaseArt.anchor.hash) {
            issues.push({
              code: "SEC-PHASE-INPUT-PREV-HASH",
              message: `Tiết ${pNum} Pha ${phaseName} ghi nhận previousHandoffHash (${phaseArt.input.previousHandoffHash}) != ${prevPhaseArt.anchor.hash}`,
              path: `phases[${actId}].input.previousHandoffHash`,
              periodNumber: pNum,
              phase: phaseName,
            });
          }
        }
      }

      // Activity content check
      const act = phaseArt.activity;
      if (!act) {
        issues.push({
          code: "SEC-PHASE-ACT-MISSING",
          message: `Tiết ${pNum} Pha ${phaseName} thiếu activity object`,
          path: `phases[${actId}].activity`,
          periodNumber: pNum,
          phase: phaseName,
        });
        prevPhaseArt = phaseArt;
        continue;
      }

      if (act.id !== actId) {
        issues.push({
          code: "SEC-PHASE-ACT-ID",
          message: `ID hoạt động ${act.id} không đúng quy ước ${actId}`,
          path: `phases[${actId}].activity.id`,
          periodNumber: pNum,
          phase: phaseName,
          activityId: act.id,
        });
      }

      const dur = Number(act.durationMinutes || 0);
      if (!Number.isFinite(dur) || dur <= 0) {
        issues.push({
          code: "SEC-PHASE-DURATION",
          message: `Tiết ${pNum} Pha ${phaseName} thiếu thời lượng hợp lệ (${act.durationMinutes} phút)`,
          path: `phases[${actId}].activity.durationMinutes`,
          periodNumber: pNum,
          phase: phaseName,
        });
      } else {
        periodMinutesMap.set(pNum, (periodMinutesMap.get(pNum) || 0) + dur);
      }

      if (!Array.isArray(act.teacherActions) || act.teacherActions.length === 0 || !act.teacherActions.some((a) => typeof a === "string" && a.trim())) {
        issues.push({
          code: "SEC-PHASE-ACTIONS-EMPTY",
          message: `Tiết ${pNum} Pha ${phaseName} thiếu hoạt động của giáo viên (teacherActions)`,
          path: `phases[${actId}].activity.teacherActions`,
          periodNumber: pNum,
          phase: phaseName,
        });
      }
      if (!Array.isArray(act.studentActions) || act.studentActions.length === 0 || !act.studentActions.some((a) => typeof a === "string" && a.trim())) {
        issues.push({
          code: "SEC-PHASE-ACTIONS-EMPTY",
          message: `Tiết ${pNum} Pha ${phaseName} thiếu hoạt động của học sinh (studentActions)`,
          path: `phases[${actId}].activity.studentActions`,
          periodNumber: pNum,
          phase: phaseName,
        });
      }

      const actObjIds = checkObjectiveIds(act.objectiveIds, validObjectiveIds, {
        code: "SEC-PHASE-INVALID-OBJ",
        message: `Tiết ${pNum} Pha ${phaseName}`,
        path: `phases[${actId}].activity.objectiveIds`,
        periodNumber: pNum,
        phase: phaseName,
        activityId: act.id,
      }, issues);
      for (const objId of actObjIds) {
        coveredObjectiveIds.add(objId);
      }

      if (bp) {
        const bpPhase = bp.periodBlueprint?.phases?.find((item) => item.phase === phaseName);
        if (bpPhase) {
          const assignedIds = Array.isArray(bpPhase.objectiveIds) ? bpPhase.objectiveIds : [];
          for (const id of assignedIds) {
            if (validObjectiveIds.has(id) && !actObjIds.has(id)) {
              issues.push({
                code: "SEC-PHASE-OBJ-UNCOVERED",
                message: `Hoạt động Tiết ${pNum} Pha ${phaseName} chưa khai báo mục tiêu ${id} ("${objectiveStatements.get(id)}") được phân bổ cho pha này`,
                path: `phases[${actId}].activity.objectiveIds`,
                periodNumber: pNum,
                phase: phaseName,
                activityId: act.id,
                objectiveId: id,
              });
            }
          }
        }
      }

      for (const matId of Array.isArray(phaseArt.materialIds) ? phaseArt.materialIds : []) {
        if (!validMaterialIds.has(matId)) {
          issues.push({
            code: "SEC-PHASE-INVALID-MAT",
            message: `Tiết ${pNum} Pha ${phaseName} dùng thiết bị không có trong Mục II: ${matId}`,
            path: `phases[${actId}].materialIds`,
            periodNumber: pNum,
            phase: phaseName,
          });
        }
      }

      for (const srcId of Array.isArray(phaseArt.sourceIds) ? phaseArt.sourceIds : []) {
        if (!validSourceIds.has(srcId)) {
          issues.push({
            code: "SEC-PHASE-INVALID-SRC",
            message: `Tiết ${pNum} Pha ${phaseName} dùng dữ kiện nguồn không có trong Mục Nguồn: ${srcId}`,
            path: `phases[${actId}].sourceIds`,
            periodNumber: pNum,
            phase: phaseName,
          });
        }
      }

      // Handoff check
      if (!phaseArt.handoff || !phaseArt.handoff.bridge) {
        issues.push({
          code: "SEC-PHASE-HANDOFF-BRIDGE",
          message: `Tiết ${pNum} Pha ${phaseName} thiếu câu chuyển tiếp handoff.bridge`,
          path: `phases[${actId}].handoff.bridge`,
          periodNumber: pNum,
          phase: phaseName,
        });
      }

      prevPhaseArt = phaseArt;
    }

    // Check complete period duration for any period having all 4 phases
    for (let p = 1; p <= expectedPeriods; p++) {
      const periodPhases = phases.filter((ph) => ph.periodNumber === p);
      if (periodPhases.length === 4) {
        const totalMin = periodMinutesMap.get(p) || 0;
        if (totalMin < expectedDuration - 5 || totalMin > expectedDuration + 5) {
          issues.push({
            code: "SEC-PERIOD-TOTAL-TIME",
            message: `Tiết ${p} có tổng thời lượng ${totalMin} phút, lệch quá 5 phút so với chuẩn ${expectedDuration} phút`,
            path: `period[${p}].totalMinutes`,
            periodNumber: p,
          });
        }
      }
    }

    // Full objective coverage check triggers ONLY when ALL phases for lesson are completed
    const totalExpectedPhases = expectedPeriods * 4;
    if (phases.length === totalExpectedPhases && outcomes) {
      for (const obj of outcomes.outcomes?.objectiveMetadata || []) {
        if (!coveredObjectiveIds.has(obj.id)) {
          issues.push({
            code: "SEC-OBJ-UNCOVERED",
            message: `YCCĐ ${obj.id} ("${obj.statement}") không được bất kỳ pha nào triển khai`,
            path: "outcomes.objectiveMetadata",
            objectiveId: obj.id,
          });
        }
      }
    }
  }

  // 7. Validate Assessment (if present)
  if (assessment) {
    if (!outcomes || !materials) {
      issues.push({
        code: "SEC-DEP-ASSESS-PREREQ-MISSING",
        message: "Mục Đánh giá yêu cầu Mục I và Mục II phải có trước",
        path: "assessment",
      });
    }

    checkIdentity(input, assessment.identity, "Mục Đánh giá", issues);
    verifyArtifactHash(assessment, "Mục Đánh giá", "assessment", issues);

    if (outcomes && assessment.dependencies.outcomes?.hash !== outcomes.anchor.hash) {
      issues.push({
        code: "SEC-DEP-ASSESS-OUTCOMES",
        message: "Mục Đánh giá không trỏ đúng hash Mục I",
        path: "assessment.dependencies.outcomes",
      });
    }
    if (materials && assessment.dependencies.materials?.hash !== materials.anchor.hash) {
      issues.push({
        code: "SEC-DEP-ASSESS-MAT",
        message: "Mục Đánh giá không trỏ đúng hash Mục II",
        path: "assessment.dependencies.materials",
      });
    }

    if (phases && assessment.dependencies.phases) {
      if (!Array.isArray(assessment.dependencies.phases)) {
        issues.push({
          code: "SEC-DEP-ASSESS-PHASES",
          message: "Mục Đánh giá dependencies.phases phải là một danh sách",
          path: "assessment.dependencies.phases",
        });
      } else {
        const expectedPhaseHashes = phases.map((p) => p.anchor.hash);
        const actualPhaseHashes = assessment.dependencies.phases.map((p) => p?.hash);
        if (
          actualPhaseHashes.length !== expectedPhaseHashes.length ||
          !actualPhaseHashes.every((h, i) => h === expectedPhaseHashes[i])
        ) {
          issues.push({
            code: "SEC-DEP-ASSESS-PHASES",
            message: "Mục Đánh giá không trỏ đúng danh sách hash của các pha đã hoàn thành",
            path: "assessment.dependencies.phases",
          });
        }
      }
    }

    for (const align of Array.isArray(assessment.alignment) ? assessment.alignment : []) {
      if (!align || typeof align !== "object") continue;
      if (!validObjectiveIds.has(align.objectiveId)) {
        issues.push({
          code: "SEC-ASSESS-INVALID-OBJ",
          message: `Đánh giá đối chiếu objectiveId không tồn tại: ${align.objectiveId}`,
          path: "assessment.alignment",
          objectiveId: align.objectiveId,
        });
      }
      for (const actId of Array.isArray(align.activityIds) ? align.activityIds : []) {
        if (phases && !phases.some((p) => p.activity?.id === actId)) {
          issues.push({
            code: "SEC-ASSESS-INVALID-ACT",
            message: `Đánh giá tham chiếu activityId không tồn tại: ${actId}`,
            path: "assessment.alignment.activityIds",
            activityId: actId,
          });
        }
      }
    }
  }

  return { passed: issues.length === 0, issues };
}

export function assertStagedSectionPrefix(options: StagedSectionPrefixOptions): void {
  const result = validateStagedSectionPrefix(options);
  if (!result.passed) {
    const message = result.issues.map((err) => `[${err.code}] ${err.message}`).join("\n");
    throw new StagedSectionValidationError(`Kiểm định staged prefix thất bại:\n${message}`, result.issues);
  }
}

/**
 * Validates the full staged-v2 section set required for assembly.
 * Checks completeness: all period blueprints, materials, all 4 phases per period, and assessment.
 */
export function validateStagedSections(
  artifacts: StagedSectionArtifacts & { input: LessonInput },
): StagedSectionValidation {
  const prefixResult = validateStagedSectionPrefix(artifacts);
  const issues = [...prefixResult.issues];

  const expectedPeriods = Math.max(1, Number(artifacts.input.periods || 1));

  if (!artifacts.periodBlueprints || artifacts.periodBlueprints.length !== expectedPeriods) {
    issues.push({
      code: "SEC-PERIOD-BLUEPRINTS-LEN",
      message: `Cần đủ ${expectedPeriods} blueprint tiết nhưng nhận ${artifacts.periodBlueprints?.length ?? 0}`,
      path: "periodBlueprints",
    });
  }

  if (!artifacts.materials) {
    issues.push({
      code: "SEC-MATERIALS-MISSING",
      message: "Thiếu Mục II (Thiết bị dạy học)",
      path: "materials",
    });
  }

  const expectedTotalPhases = expectedPeriods * 4;
  if (!artifacts.phases || artifacts.phases.length !== expectedTotalPhases) {
    issues.push({
      code: "SEC-PHASES-LEN",
      message: `Cần đủ ${expectedTotalPhases} pha (${expectedPeriods} tiết x 4 pha) nhưng nhận ${artifacts.phases?.length ?? 0}`,
      path: "phases",
    });
  }

  if (!artifacts.assessment) {
    issues.push({
      code: "SEC-ASSESSMENT-MISSING",
      message: "Thiếu Mục IV (Ma trận đánh giá)",
      path: "assessment",
    });
  }

  return { passed: issues.length === 0, issues };
}

export function assertStagedSections(
  artifacts: StagedSectionArtifacts & { input: LessonInput },
): void {
  const result = validateStagedSections(artifacts);
  if (!result.passed) {
    const message = result.issues.map((err) => `[${err.code}] ${err.message}`).join("\n");
    throw new StagedSectionValidationError(`Kiểm định staged-v2 thất bại:\n${message}`, result.issues);
  }
}

