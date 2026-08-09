type LegacyDocument = Record<string, unknown>;

export type LegacyMigrationPatch = Record<string, unknown>;

function isRecord(value: unknown): value is LegacyDocument {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function nonNegativeNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

export function buildLegacySubscriptionPatch(data: LegacyDocument): LegacyMigrationPatch {
  const patch: LegacyMigrationPatch = {};

  for (const field of ["activePlan", "paidPlan", "plan"] as const) {
    if (data[field] === "pro") patch[field] = "plus";
  }

  const trials = isRecord(data.trials) ? data.trials : null;
  if (trials && Object.prototype.hasOwnProperty.call(trials, "proRemaining")) {
    patch["trials.plusRemaining"] = nonNegativeNumber(trials.plusRemaining)
      + nonNegativeNumber(trials.proRemaining);
    patch["trials.proRemaining"] = 0;
  }

  return patch;
}

export function buildLegacyPaymentPatch(data: LegacyDocument): LegacyMigrationPatch {
  return data.targetPlan === "pro" ? { targetPlan: "plus" } : {};
}

export function hasLegacyMigrationChanges(patch: LegacyMigrationPatch) {
  return Object.keys(patch).length > 0;
}
