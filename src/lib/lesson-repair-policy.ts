import type { PedagogyAuditFinding } from "@/types/lesson";

export const MAX_LESSON_REPAIR_ROUNDS = 2;

type QualityRepairLoopOptions<T> = {
  initialValue: T;
  validate: (value: T) => PedagogyAuditFinding[];
  repairableFindings?: (findings: PedagogyAuditFinding[]) => PedagogyAuditFinding[];
  repair: (
    value: T,
    findings: PedagogyAuditFinding[],
    round: number,
  ) => Promise<T | null>;
  maxRounds?: number;
};

export type QualityRepairLoopResult<T> = {
  value: T;
  repairApplied: boolean;
  roundsAttempted: number;
  remainingFindings: PedagogyAuditFinding[];
};

export function repairableErrorFindings(
  findings: PedagogyAuditFinding[] | undefined,
): PedagogyAuditFinding[] {
  return (findings || []).filter(
    (finding) => finding.severity === "error" && finding.autoFixable === true,
  );
}

const RESCUE_REPAIR_PREFIXES = [
  "LQ-",
  "PHASE-QUALITY-",
  "MATH-QUALITY-",
  "NSXH-COVERAGE-",
  "NSXH-QUALITY-",
  "TV-COVERAGE-",
  "TV-QUALITY-",
] as const;

function isRescueRepairFinding(finding: PedagogyAuditFinding) {
  if (finding.severity === "error") return finding.autoFixable === true;
  if (finding.severity !== "warning" || finding.autoFixable !== true) return false;
  return RESCUE_REPAIR_PREFIXES.some((prefix) => finding.code.startsWith(prefix));
}

export function repairableStagedFindings(
  findings: PedagogyAuditFinding[] | undefined,
): PedagogyAuditFinding[] {
  return (findings || []).filter(isRescueRepairFinding);
}

export function findingsForPeriod(
  findings: PedagogyAuditFinding[],
  periodNumber: number,
): PedagogyAuditFinding[] {
  return findings.filter(
    (finding) => finding.periodNumber === undefined || finding.periodNumber === periodNumber,
  );
}

export function formatRepairFinding(finding: PedagogyAuditFinding): string {
  const locations = [
    finding.periodNumber ? `Tiết ${finding.periodNumber}` : "",
    finding.activityId
      ? `hoạt động ${finding.activityId}`
      : finding.activityIndex !== undefined
        ? `hoạt động ${finding.activityIndex + 1}`
        : "",
    finding.objectiveId ? `mục tiêu ${finding.objectiveId}` : "",
  ].filter(Boolean);
  const location = locations.length ? ` (${locations.join(", ")})` : "";
  return `[${finding.code}]${location}: ${finding.message}`;
}

export async function runQualityRepairLoop<T>({
  initialValue,
  validate,
  repairableFindings = repairableErrorFindings,
  repair,
  maxRounds = MAX_LESSON_REPAIR_ROUNDS,
}: QualityRepairLoopOptions<T>): Promise<QualityRepairLoopResult<T>> {
  const roundLimit = Math.max(0, Math.min(MAX_LESSON_REPAIR_ROUNDS, Math.floor(maxRounds)));
  let value = initialValue;
  let repairApplied = false;
  let roundsAttempted = 0;

  for (let round = 1; round <= roundLimit; round += 1) {
    const findings = repairableFindings(validate(value));
    if (!findings.length) break;

    roundsAttempted = round;
    const repaired = await repair(value, findings, round);
    if (repaired === null) break;

    value = repaired;
    repairApplied = true;
  }

  return {
    value,
    repairApplied,
    roundsAttempted,
    remainingFindings: repairableFindings(validate(value)),
  };
}
