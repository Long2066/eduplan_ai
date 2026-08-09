import type {
  LessonContinuityPlan,
  LessonInput,
  LessonLearningCluster,
  LessonPlan,
  LessonSourceUnit,
  MathPeriodBlueprint,
  NaturalSocialSourceInventory,
  PedagogyAuditFinding,
  VietnameseSourceInventory,
} from "@/types/lesson";

type UnknownRecord = Record<string, unknown>;

const continuityRules = {
  unknownSourceUnit: { code: "LC-PLAN-01", severity: "error", autoFixable: true },
  missingRequiredUnitAssignment: { code: "LC-PLAN-02", severity: "error", autoFixable: true },
  duplicatedUnitAssignment: { code: "LC-PLAN-03", severity: "error", autoFixable: true },
  invalidPrerequisite: { code: "LC-PLAN-04", severity: "error", autoFixable: true },
  prerequisiteOrder: { code: "LC-PLAN-05", severity: "error", autoFixable: true },
  estimatedOverload: { code: "LC-TIME-01", severity: "warning", autoFixable: true },
  missingRequiredUnitEvidence: { code: "LC-COVERAGE-01", severity: "error", autoFixable: true },
  duplicatedUnitAcrossPeriods: { code: "LC-COVERAGE-02", severity: "error", autoFixable: true },
  splitClusterAcrossPeriods: { code: "LC-COVERAGE-03", severity: "error", autoFixable: true },
  clusterInWrongPeriod: { code: "LC-COVERAGE-04", severity: "error", autoFixable: true },
  missingPeriodHandoff: { code: "LC-HANDOFF-01", severity: "warning", autoFixable: true },
} as const;

type ContinuityRule = typeof continuityRules[keyof typeof continuityRules];

function finding(
  rule: ContinuityRule,
  message: string,
  location: Partial<PedagogyAuditFinding> = {},
): PedagogyAuditFinding {
  return { code: rule.code, severity: rule.severity, autoFixable: rule.autoFixable, message, ...location };
}

function record(value: unknown): UnknownRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as UnknownRecord : null;
}

function objects(value: unknown): UnknownRecord[] {
  return Array.isArray(value) ? value.map(record).filter((item): item is UnknownRecord => Boolean(item)) : [];
}

function strings(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(strings);
  if (typeof value === "string") return value.trim() ? [value.trim()] : [];
  if (typeof value === "number" || typeof value === "boolean") return [String(value)];
  return [];
}

function text(value: unknown) {
  return strings(value)[0] || "";
}

function positiveNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : undefined;
}

function periodNumber(value: unknown, expectedPeriods: number) {
  const number = positiveNumber(value);
  return number && Number.isInteger(number) && number <= expectedPeriods ? number : undefined;
}

function unique(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function stableId(value: unknown, fallback: string) {
  return text(value).replace(/\s+/g, "-") || fallback;
}

function normalizeSourceUnits(value: unknown, expectedPeriods: number): LessonSourceUnit[] {
  const seen = new Set<string>();
  return objects(value).flatMap((item, index) => {
    const unitId = stableId(item.unitId, `source-${index + 1}`);
    if (seen.has(unitId)) return [];
    seen.add(unitId);
    return [{
      unitId,
      label: text(item.label) || unitId,
      kind: text(item.kind) || undefined,
      page: text(item.page) || undefined,
      required: item.required === false ? false : true,
      allowReuse: item.allowReuse === true,
      preferredPeriodNumber: periodNumber(item.preferredPeriodNumber ?? item.periodNumber, expectedPeriods),
      estimatedMinutes: positiveNumber(item.estimatedMinutes),
      sourceEvidence: strings(item.sourceEvidence),
    }];
  });
}

function normalizeClusters(value: unknown, expectedPeriods: number): LessonLearningCluster[] {
  const seen = new Set<string>();
  return objects(value).flatMap((item, index) => {
    const clusterId = stableId(item.clusterId, `cluster-${index + 1}`);
    if (seen.has(clusterId)) return [];
    const sourceUnitIds = unique(strings(item.sourceUnitIds).map((unitId) => stableId(unitId, "")));
    if (!sourceUnitIds.length) return [];
    seen.add(clusterId);
    return [{
      clusterId,
      label: text(item.label) || clusterId,
      sourceUnitIds,
      periodNumber: periodNumber(item.periodNumber, expectedPeriods),
      mustStayTogether: item.mustStayTogether === false ? false : true,
      prerequisiteClusterIds: unique(strings(item.prerequisiteClusterIds).map((clusterId) => stableId(clusterId, ""))),
      estimatedMinutes: positiveNumber(item.estimatedMinutes),
      expectedProduct: text(item.expectedProduct) || undefined,
    }];
  });
}

export function normalizeLessonContinuityPlan(
  value: unknown,
  expectedPeriods: number,
): LessonContinuityPlan | undefined {
  const raw = record(value);
  if (!raw) return undefined;
  const sourceUnits = normalizeSourceUnits(raw.sourceUnits, expectedPeriods);
  const clusters = normalizeClusters(raw.clusters, expectedPeriods);
  if (!sourceUnits.length && !clusters.length) return undefined;
  return { sourceUnits, clusters, warnings: strings(raw.warnings) };
}

function mergePlans(
  primary: LessonContinuityPlan | undefined,
  fallback: LessonContinuityPlan | undefined,
): LessonContinuityPlan | undefined {
  if (!primary) return fallback;
  if (!fallback) return primary;

  const sourceUnits = [...primary.sourceUnits];
  const unitIds = new Set(sourceUnits.map((unit) => unit.unitId));
  for (const unit of fallback.sourceUnits) {
    if (!unitIds.has(unit.unitId)) {
      unitIds.add(unit.unitId);
      sourceUnits.push(unit);
    }
  }

  const clusters = [...primary.clusters];
  const clusterIds = new Set(clusters.map((cluster) => cluster.clusterId));
  const assignedUnitIds = new Set(clusters.flatMap((cluster) => cluster.sourceUnitIds));
  for (const cluster of fallback.clusters) {
    if (cluster.sourceUnitIds.some((unitId) => assignedUnitIds.has(unitId))) continue;
    let clusterId = cluster.clusterId;
    let suffix = 2;
    while (clusterIds.has(clusterId)) clusterId = `${cluster.clusterId}-${suffix++}`;
    clusterIds.add(clusterId);
    clusters.push({ ...cluster, clusterId });
    cluster.sourceUnitIds.forEach((unitId) => assignedUnitIds.add(unitId));
  }

  return {
    sourceUnits,
    clusters,
    warnings: unique([...(primary.warnings || []), ...(fallback.warnings || [])]),
  };
}

function vietnameseTaskMinutes(taskType?: string) {
  const minutes: Record<string, number> = {
    startup: 4,
    "reading-fluency": 10,
    "reading-question": 5,
    memorization: 6,
    vocabulary: 5,
    phonics: 8,
    spelling: 13,
    punctuation: 9,
    "sentence-writing": 10,
    composition: 15,
    "language-knowledge": 9,
    speaking: 10,
    listening: 8,
    extension: 4,
    other: 6,
  };
  return minutes[taskType || "other"] || minutes.other;
}

export function buildVietnameseContinuityPlan(
  inventory: VietnameseSourceInventory | undefined,
  expectedPeriods: number,
  explicitPlan?: unknown,
): LessonContinuityPlan | undefined {
  const tasks = (inventory?.requiredTasks || []).filter((task) => task.label && task.required !== false);
  const fallback: LessonContinuityPlan | undefined = tasks.length ? {
    sourceUnits: tasks.map((task, index) => ({
      unitId: task.taskId?.trim() || `tv-task-${index + 1}`,
      label: task.label,
      kind: task.taskType || "other",
      required: true,
      preferredPeriodNumber: periodNumber(task.periodNumber, expectedPeriods),
      estimatedMinutes: vietnameseTaskMinutes(task.taskType),
      sourceEvidence: task.sourceEvidence || [],
    })),
    clusters: tasks.map((task, index) => {
      const unitId = task.taskId?.trim() || `tv-task-${index + 1}`;
      return {
        clusterId: `tv-cluster-${unitId}`,
        label: task.label,
        sourceUnitIds: [unitId],
        periodNumber: periodNumber(task.periodNumber, expectedPeriods),
        mustStayTogether: true,
        estimatedMinutes: vietnameseTaskMinutes(task.taskType),
        expectedProduct: task.productKind,
      };
    }),
  } : undefined;
  return normalizeLessonContinuityPlan(
    mergePlans(normalizeLessonContinuityPlan(explicitPlan, expectedPeriods), fallback),
    expectedPeriods,
  );
}

type NaturalSocialTaskSeed = {
  taskId?: string;
  label: string;
  taskType: string;
  periodNumber?: number;
  visualIds?: string[];
  estimatedMinutes?: number;
  expectedProduct?: string;
  sourceEvidence?: string[];
};

function naturalSocialTaskSeeds(inventory?: NaturalSocialSourceInventory): NaturalSocialTaskSeed[] {
  if (!inventory) return [];
  const seeds: NaturalSocialTaskSeed[] = [];
  for (const task of inventory.requiredTasks || []) {
    if (!task.label || task.required === false) continue;
    seeds.push({
      taskId: task.taskId,
      label: task.label,
      taskType: task.taskType || "other",
      periodNumber: task.periodNumber,
      estimatedMinutes: task.taskType === "practice_product" ? 15 : task.taskType === "role_play" ? 9 : 6,
      expectedProduct: task.productKind,
      sourceEvidence: task.sourceEvidence,
    });
  }
  for (const task of inventory.questions || []) {
    if (!task.question || task.required === false) continue;
    seeds.push({ taskId: task.taskId, label: task.question, taskType: "answer_question", periodNumber: task.periodNumber, visualIds: task.visualIds, estimatedMinutes: 6, sourceEvidence: task.sourceEvidence });
  }
  for (const task of inventory.procedures || []) {
    if (!task.label || task.required === false) continue;
    seeds.push({ taskId: task.taskId, label: task.label, taskType: "sort_sequence", periodNumber: task.periodNumber, visualIds: task.visualIds, estimatedMinutes: Math.max(7, task.steps.length * 2), sourceEvidence: task.sourceEvidence });
  }
  for (const task of inventory.practiceTasks || []) {
    if (!task.label || task.required === false) continue;
    seeds.push({ taskId: task.taskId, label: task.label, taskType: "practice_product", periodNumber: task.periodNumber, estimatedMinutes: 15, expectedProduct: task.expectedProduct, sourceEvidence: task.sourceEvidence });
  }
  for (const task of inventory.situations || []) {
    if (!task.label || task.required === false) continue;
    seeds.push({ taskId: task.taskId, label: task.label, taskType: "role_play", periodNumber: task.periodNumber, estimatedMinutes: 9, sourceEvidence: task.sourceEvidence });
  }
  for (const task of inventory.classificationTasks || []) {
    if (!task.label || task.required === false) continue;
    seeds.push({ taskId: task.taskId, label: task.label, taskType: "classify", periodNumber: task.periodNumber, visualIds: task.visualIds, estimatedMinutes: 9, sourceEvidence: task.sourceEvidence });
  }
  for (const task of inventory.personalTasks || []) {
    if (!task.label || task.required === false) continue;
    seeds.push({ taskId: task.taskId, label: task.label, taskType: "personal_connection", periodNumber: task.periodNumber, estimatedMinutes: 5, sourceEvidence: task.sourceEvidence });
  }
  const seen = new Set<string>();
  return seeds.filter((seed, index) => {
    const key = seed.taskId?.trim() || `${seed.taskType}|${seed.label.toLowerCase()}|${seed.periodNumber || 0}|${index}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function buildNaturalSocialContinuityPlan(
  inventory: NaturalSocialSourceInventory | undefined,
  expectedPeriods: number,
  explicitPlan?: unknown,
): LessonContinuityPlan | undefined {
  const taskSeeds = naturalSocialTaskSeeds(inventory);
  const visuals = (inventory?.visuals || []).filter((visual) => visual.label && visual.required !== false);
  const fallback: LessonContinuityPlan | undefined = taskSeeds.length || visuals.length ? {
    sourceUnits: [
      ...visuals.map((visual, index) => ({
        unitId: visual.visualId?.trim() || `tnxh-visual-${index + 1}`,
        label: visual.label,
        kind: "visual",
        page: visual.page,
        required: true,
        allowReuse: true,
        sourceEvidence: visual.sourceEvidence || [],
      })),
      ...taskSeeds.map((task, index) => ({
        unitId: task.taskId?.trim() || `tnxh-task-${index + 1}`,
        label: task.label,
        kind: task.taskType,
        required: true,
        preferredPeriodNumber: periodNumber(task.periodNumber, expectedPeriods),
        estimatedMinutes: task.estimatedMinutes,
        sourceEvidence: task.sourceEvidence || [],
      })),
    ],
    clusters: taskSeeds.map((task, index) => {
      const taskId = task.taskId?.trim() || `tnxh-task-${index + 1}`;
      return {
        clusterId: `tnxh-cluster-${taskId}`,
        label: task.label,
        sourceUnitIds: unique([taskId, ...(task.visualIds || [])]),
        periodNumber: periodNumber(task.periodNumber, expectedPeriods),
        mustStayTogether: true,
        estimatedMinutes: task.estimatedMinutes,
        expectedProduct: task.expectedProduct,
      };
    }),
  } : undefined;
  return normalizeLessonContinuityPlan(
    mergePlans(normalizeLessonContinuityPlan(explicitPlan, expectedPeriods), fallback),
    expectedPeriods,
  );
}

export function buildMathContinuityPlan(
  periods: MathPeriodBlueprint[] | undefined,
  expectedPeriods: number,
  explicitPlan?: unknown,
): LessonContinuityPlan | undefined {
  const fallbackUnits: LessonSourceUnit[] = [];
  const fallbackClusters: LessonLearningCluster[] = [];
  for (const [periodIndex, period] of (periods || []).entries()) {
    const targetPeriod = periodNumber(period.periodNumber || periodIndex + 1, expectedPeriods);
    for (const [activityIndex, activity] of (period.activities || []).entries()) {
      if (!activity.mathFocus?.trim()) continue;
      const unitId = `math-p${targetPeriod || periodIndex + 1}-a${activityIndex + 1}`;
      fallbackUnits.push({
        unitId,
        label: activity.mathFocus,
        kind: "math-focus",
        required: true,
        preferredPeriodNumber: targetPeriod,
        estimatedMinutes: positiveNumber(activity.durationMinutes),
      });
      fallbackClusters.push({
        clusterId: `math-cluster-${unitId}`,
        label: activity.title || activity.mathFocus,
        sourceUnitIds: [unitId],
        periodNumber: targetPeriod,
        mustStayTogether: true,
        estimatedMinutes: positiveNumber(activity.durationMinutes),
        expectedProduct: activity.mathFocus,
      });
    }
  }
  const normalizedExplicitPlan = normalizeLessonContinuityPlan(explicitPlan, expectedPeriods);
  if (normalizedExplicitPlan) return normalizedExplicitPlan;
  const fallback = fallbackUnits.length ? { sourceUnits: fallbackUnits, clusters: fallbackClusters } : undefined;
  return normalizeLessonContinuityPlan(fallback, expectedPeriods);
}

function dedupeFindings(findings: PedagogyAuditFinding[]) {
  const seen = new Set<string>();
  return findings.filter((item) => {
    const key = `${item.code}|${item.periodNumber || 0}|${item.activityIndex ?? -1}|${item.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function validateContinuityPlan(
  plan: LessonContinuityPlan | undefined,
  input: Pick<LessonInput, "periods" | "duration">,
): PedagogyAuditFinding[] {
  if (!plan) return [];
  const findings: PedagogyAuditFinding[] = [];
  const units = new Map(plan.sourceUnits.map((unit) => [unit.unitId, unit]));
  const clusters = new Map(plan.clusters.map((cluster) => [cluster.clusterId, cluster]));
  const unitAssignments = new Map<string, LessonLearningCluster[]>();

  for (const cluster of plan.clusters) {
    for (const unitId of cluster.sourceUnitIds) {
      if (!units.has(unitId)) {
        findings.push(finding(
          continuityRules.unknownSourceUnit,
          `Cụm “${cluster.label}” tham chiếu source unit không tồn tại: ${unitId}.`,
          { periodNumber: cluster.periodNumber },
        ));
        continue;
      }
      const assigned = unitAssignments.get(unitId) || [];
      assigned.push(cluster);
      unitAssignments.set(unitId, assigned);
    }
    for (const prerequisiteId of cluster.prerequisiteClusterIds || []) {
      const prerequisite = clusters.get(prerequisiteId);
      if (!prerequisite) {
        findings.push(finding(
          continuityRules.invalidPrerequisite,
          `Cụm “${cluster.label}” tham chiếu cụm tiên quyết không tồn tại: ${prerequisiteId}.`,
          { periodNumber: cluster.periodNumber },
        ));
      } else if (prerequisite.periodNumber && cluster.periodNumber && prerequisite.periodNumber > cluster.periodNumber) {
        findings.push(finding(
          continuityRules.prerequisiteOrder,
          `Cụm “${cluster.label}” được xếp trước cụm tiên quyết “${prerequisite.label}”.`,
          { periodNumber: cluster.periodNumber },
        ));
      }
    }
  }

  for (const unit of plan.sourceUnits) {
    const assignments = unitAssignments.get(unit.unitId) || [];
    if (unit.required !== false && !assignments.length) {
      findings.push(finding(
        continuityRules.missingRequiredUnitAssignment,
        `Source unit bắt buộc chưa được đưa vào cụm học tập: “${unit.label}”.`,
        { periodNumber: unit.preferredPeriodNumber },
      ));
    }
    if (!unit.allowReuse && assignments.length > 1) {
      findings.push(finding(
        continuityRules.duplicatedUnitAssignment,
        `Source unit “${unit.label}” bị gán vào nhiều cụm: ${assignments.map((cluster) => cluster.label).join("; ")}.`,
        { periodNumber: assignments[0]?.periodNumber },
      ));
    }
  }

  const periodMinutes = new Map<number, number>();
  for (const cluster of plan.clusters) {
    if (!cluster.periodNumber || !cluster.estimatedMinutes) continue;
    periodMinutes.set(cluster.periodNumber, (periodMinutes.get(cluster.periodNumber) || 0) + cluster.estimatedMinutes);
    if (cluster.estimatedMinutes > input.duration) {
      findings.push(finding(
        continuityRules.estimatedOverload,
        `Cụm “${cluster.label}” ước tính ${cluster.estimatedMinutes} phút, vượt thời lượng một tiết ${input.duration} phút và không nên bị cắt tự động.`,
        { periodNumber: cluster.periodNumber },
      ));
    }
  }
  for (const [period, minutes] of periodMinutes) {
    if (minutes > input.duration) {
      findings.push(finding(
        continuityRules.estimatedOverload,
        `Tiết ${period} có các cụm bắt buộc ước tính ${minutes} phút, vượt thời lượng ${input.duration} phút.`,
        { periodNumber: period },
      ));
    }
  }

  return dedupeFindings(findings);
}

function periodsForLesson(lesson: LessonPlan) {
  return lesson.periodPlans?.length
    ? lesson.periodPlans
    : [{ periodNumber: 1, focus: lesson.generalInfo.lessonTitle, outcomes: lesson.outcomes, activities: lesson.activities }];
}

function activityUnitIds(activity: LessonPlan["activities"][number]) {
  return unique([
    ...(activity.sourceUnitIds || []),
    ...(activity.sourceTaskIds || []),
    ...(activity.sourceVisualIds || []),
  ].map((unitId) => stableId(unitId, "")));
}

export function validateLessonContinuity(
  lesson: LessonPlan,
  input: Pick<LessonInput, "periods" | "duration">,
  plan: LessonContinuityPlan | undefined = lesson.meta?.continuityPlan,
): PedagogyAuditFinding[] {
  if (!plan) return [];
  const findings = [...validateContinuityPlan(plan, input)];
  const periods = periodsForLesson(lesson);
  const units = new Map(plan.sourceUnits.map((unit) => [unit.unitId, unit]));
  const clustersByUnit = new Map<string, LessonLearningCluster[]>();
  for (const cluster of plan.clusters) {
    for (const unitId of cluster.sourceUnitIds) {
      const assigned = clustersByUnit.get(unitId) || [];
      assigned.push(cluster);
      clustersByUnit.set(unitId, assigned);
    }
  }
  const unitPeriods = new Map<string, Set<number>>();
  const clusterPeriods = new Map<string, Set<number>>();

  for (const period of periods) {
    const number = Number(period.periodNumber || 1);
    for (const activity of period.activities || []) {
      for (const unitId of activityUnitIds(activity)) {
        const periodSet = unitPeriods.get(unitId) || new Set<number>();
        periodSet.add(number);
        unitPeriods.set(unitId, periodSet);
      }
      for (const clusterId of unique((activity.sourceClusterIds || []).map((id) => stableId(id, "")))) {
        const periodSet = clusterPeriods.get(clusterId) || new Set<number>();
        periodSet.add(number);
        clusterPeriods.set(clusterId, periodSet);
      }
    }
  }

  for (const unit of plan.sourceUnits) {
    if (unit.required === false) continue;
    const usedPeriods = [...(unitPeriods.get(unit.unitId) || [])];
    if (!usedPeriods.length) {
      const assignedPeriod = (clustersByUnit.get(unit.unitId) || [])
        .map((cluster) => cluster.periodNumber)
        .find((number): number is number => Boolean(number));
      findings.push(finding(
        continuityRules.missingRequiredUnitEvidence,
        `Giáo án chưa gắn hoạt động với source unit bắt buộc: “${unit.label}”.`,
        { periodNumber: unit.preferredPeriodNumber || assignedPeriod },
      ));
    } else if (!unit.allowReuse && usedPeriods.length > 1) {
      findings.push(finding(
        continuityRules.duplicatedUnitAcrossPeriods,
        `Source unit “${unit.label}” xuất hiện ở nhiều tiết (${usedPeriods.join(", ")}) nhưng không được đánh dấu tái sử dụng.`,
        { periodNumber: usedPeriods[0] },
      ));
    }
  }

  for (const cluster of plan.clusters) {
    const periodsFromClusterIds = clusterPeriods.get(cluster.clusterId) || new Set<number>();
    // Reusable evidence (typically one SGK visual) must not make a cluster look split.
    const nonReusableUnitIds = cluster.sourceUnitIds.filter((unitId) => !units.get(unitId)?.allowReuse);
    const evidenceUnitIds = nonReusableUnitIds.length ? nonReusableUnitIds : cluster.sourceUnitIds;
    const periodsFromUnits = new Set(evidenceUnitIds.flatMap((unitId) => [...(unitPeriods.get(unitId) || [])]));
    const usedPeriods = [...new Set([...periodsFromClusterIds, ...periodsFromUnits])];
    if (cluster.mustStayTogether !== false && usedPeriods.length > 1) {
      findings.push(finding(
        continuityRules.splitClusterAcrossPeriods,
        `Cụm “${cluster.label}” bị cắt qua nhiều tiết (${usedPeriods.join(", ")}).`,
        { periodNumber: usedPeriods[0] },
      ));
    }
    if (cluster.periodNumber && usedPeriods.length && usedPeriods.some((number) => number !== cluster.periodNumber)) {
      findings.push(finding(
        continuityRules.clusterInWrongPeriod,
        `Cụm “${cluster.label}” được khóa ở tiết ${cluster.periodNumber} nhưng xuất hiện ở tiết ${usedPeriods.join(", ")}.`,
        { periodNumber: cluster.periodNumber },
      ));
    }
  }

  for (const period of periods.slice(0, -1)) {
    const handoff = (period as typeof period & { handoff?: { learned?: string; nextBridge?: string } }).handoff;
    if (!handoff?.learned?.trim() || !handoff.nextBridge?.trim()) {
      findings.push(finding(
        continuityRules.missingPeriodHandoff,
        `Tiết ${period.periodNumber} chưa có bàn giao thực tế đủ “đã học” và “cầu nối” cho tiết sau.`,
        { periodNumber: period.periodNumber },
      ));
    }
  }

  return dedupeFindings(findings);
}
