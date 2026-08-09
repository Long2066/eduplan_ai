import { describe, expect, it } from "vitest";
import {
  buildLegacyPaymentPatch,
  buildLegacySubscriptionPatch,
  hasLegacyMigrationChanges,
} from "./subscription-legacy";

describe("legacy Pro migration", () => {
  it("builds a non-mutating patch and preserves entitlement fields", () => {
    const source = {
      activePlan: "pro",
      paidPlan: "pro",
      plan: "pro",
      planStatus: "paid",
      packageCredits: 31,
      topupCredits: 9,
      planExpiresAt: "2026-09-01T00:00:00.000Z",
      trials: { plusRemaining: 2, proRemaining: 1, retainedField: "keep" },
    };
    const before = structuredClone(source);

    const patch = buildLegacySubscriptionPatch(source);

    expect(source).toEqual(before);
    expect(patch).toEqual({
      activePlan: "plus",
      paidPlan: "plus",
      plan: "plus",
      "trials.plusRemaining": 3,
      "trials.proRemaining": 0,
    });
    expect(patch).not.toHaveProperty("planStatus");
    expect(patch).not.toHaveProperty("packageCredits");
    expect(patch).not.toHaveProperty("topupCredits");
    expect(patch).not.toHaveProperty("planExpiresAt");
  });

  it("keeps Free selected while migrating an owned legacy Pro entitlement", () => {
    const patch = buildLegacySubscriptionPatch({
      activePlan: "free",
      plan: "free",
      paidPlan: "pro",
      planStatus: "free",
      packageCredits: 18,
    });

    expect(patch).toEqual({ paidPlan: "plus" });
  });

  it("merges legacy trial balances and clears only the Pro balance", () => {
    const patch = buildLegacySubscriptionPatch({
      trials: { plusRemaining: 4, proRemaining: 3 },
    });

    expect(patch).toEqual({
      "trials.plusRemaining": 7,
      "trials.proRemaining": 0,
    });
  });

  it("normalizes legacy payment targets without changing current payments", () => {
    expect(buildLegacyPaymentPatch({ targetPlan: "pro", status: "pending_review" }))
      .toEqual({ targetPlan: "plus" });
    expect(buildLegacyPaymentPatch({ targetPlan: "plus", status: "pending_review" }))
      .toEqual({});
  });

  it("reports whether a migration patch contains changes", () => {
    expect(hasLegacyMigrationChanges(buildLegacySubscriptionPatch({ paidPlan: "pro" }))).toBe(true);
    expect(hasLegacyMigrationChanges(buildLegacySubscriptionPatch({ paidPlan: "plus" }))).toBe(false);
  });
});
