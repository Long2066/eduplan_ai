import { describe, expect, it } from "vitest";
import { Timestamp } from "firebase-admin/firestore";
import { buildSubscriptionStatus } from "./subscription-policy";

const NOW = new Date("2026-07-26T03:00:00.000Z");
const FUTURE = new Date("2026-08-25T03:00:00.000Z");
const PAST = new Date("2026-07-25T03:00:00.000Z");
const SETTINGS = { freeDailyLimit: 3, paidTrialDailyCredits: 10 };

function paidProfile(plan: "plus" | "pro", options: {
  activePlan?: "free" | "plus" | "pro";
  packageCredits?: number;
  topupCredits?: number;
  expiresAt?: Date;
  storedStatus?: string;
} = {}) {
  return {
    activePlan: options.activePlan ?? plan,
    plan: options.activePlan ?? plan,
    paidPlan: plan,
    planStatus: options.storedStatus ?? "paid",
    packageCredits: options.packageCredits ?? 50,
    topupCredits: options.topupCredits ?? 0,
    planExpiresAt: Timestamp.fromDate(options.expiresAt ?? FUTURE),
    freeDailyDayKey: "2026-07-26",
    freeDailyUsed: 0,
    trials: { plusRemaining: 0, proRemaining: 0 },
  };
}

function card(status: ReturnType<typeof buildSubscriptionStatus>, plan: "free" | "plus") {
  const result = status.cards.find((item) => item.id === plan);
  expect(result).toBeDefined();
  return result!;
}

describe("paid subscription ownership invariants", () => {
  it.each(["plus", "pro"] as const)("recognizes a %s grant as the paid Plus entitlement", (plan) => {
    const status = buildSubscriptionStatus(paidProfile(plan), NOW);
    const owned = card(status, "plus");

    expect(status.activePlan).toBe("plus");
    expect(status.planStatus).toBe("paid");
    expect(status.credits).toMatchObject({ package: 50, topup: 0, total: 50 });
    expect(owned).toMatchObject({ active: true, paid: true, selectable: true, state: "active" });
    expect(owned.expiresAt).toBe(FUTURE.toISOString());
  });

  it("derives ownership from paidPlan and expiry instead of a stale stored planStatus", () => {
    const status = buildSubscriptionStatus(paidProfile("plus", { storedStatus: "free" }), NOW);

    expect(status.planStatus).toBe("paid");
    expect(card(status, "plus")).toMatchObject({ active: true, paid: true, selectable: true });
  });

  it("maps owned legacy Pro to Plus while Free is selected", () => {
    const status = buildSubscriptionStatus(paidProfile("pro", {
      activePlan: "free",
      packageCredits: 18,
      topupCredits: 7,
    }), NOW);

    expect(status.activePlan).toBe("free");
    expect(status.planStatus).toBe("free");
    expect(status.credits).toMatchObject({ package: 18, topup: 7, total: 25, expiresAt: FUTURE.toISOString() });
    expect(card(status, "free")).toMatchObject({ active: true });
    expect(card(status, "plus")).toMatchObject({ active: false, paid: true, selectable: true, state: "available" });
    expect(status.cards.some((item) => String(item.id) === "pro")).toBe(false);
  });

  it("does not downgrade or hide a paid plan when credits reach zero", () => {
    const status = buildSubscriptionStatus(paidProfile("plus", {
      packageCredits: 0,
      topupCredits: 0,
    }), NOW);
    const plus = card(status, "plus");

    expect(status.planStatus).toBe("paid");
    expect(status.credits.total).toBe(0);
    expect(plus).toMatchObject({ active: true, paid: true, selectable: true, state: "active", remaining: 0 });
    expect(plus.reason).toContain("Đã hết tín dụng");
  });

  it("allows an owned zero-credit plan to be selected again from Free", () => {
    const status = buildSubscriptionStatus(paidProfile("pro", {
      activePlan: "free",
      packageCredits: 0,
      topupCredits: 0,
    }), NOW);

    expect(card(status, "plus")).toMatchObject({ active: false, paid: true, selectable: true, state: "available" });
  });

  it("expires entitlement only when planExpiresAt has passed", () => {
    const source = paidProfile("plus", { expiresAt: PAST, packageCredits: 50 });
    const status = buildSubscriptionStatus(source, NOW);
    const plus = card(status, "plus");

    expect(status.planStatus).toBe("expired");
    expect(status.credits.total).toBe(0);
    expect(plus).toMatchObject({ active: false, paid: false, selectable: false, state: "expired" });
    expect(source.paidPlan).toBe("plus");
    expect(source.packageCredits).toBe(50);
  });

  it("keeps Free marked as current after its daily quota is exhausted", () => {
    const status = buildSubscriptionStatus({
      activePlan: "free",
      paidPlan: "free",
      freeDailyDayKey: "2026-07-26",
      freeDailyUsed: 3,
      trials: { plusRemaining: 0, proRemaining: 0 },
    }, NOW);

    expect(status.free.remaining).toBe(0);
    expect(card(status, "free")).toMatchObject({ active: true, selectable: false, state: "active" });
  });

  it("uses the configured Free daily quota instead of stale profile fields", () => {
    const status = buildSubscriptionStatus({
      activePlan: "free",
      freeLimit: 99,
      freeDailyDayKey: "2026-07-26",
      freeDailyUsed: 2,
    }, NOW, { ...SETTINGS, freeDailyLimit: 5 });

    expect(status.free).toMatchObject({ limit: 5, used: 2, remaining: 3 });
  });

  it("exposes a daily paid-trial credit balance for users without a paid entitlement", () => {
    const status = buildSubscriptionStatus({
      activePlan: "free",
      paidPlan: "free",
      paidTrialDailyDayKey: "2026-07-26",
      paidTrialDailyUsed: 0,
    }, NOW, SETTINGS);

    expect(status.trials).toMatchObject({ plusLimit: 10, plusUsed: 0, plusRemaining: 10 });
    expect(card(status, "plus")).toMatchObject({ paid: false, selectable: true, state: "trial_available", remaining: 10 });
  });

  it("resets the paid-trial balance on the next Vietnam day", () => {
    const status = buildSubscriptionStatus({
      activePlan: "plus",
      paidPlan: "free",
      paidTrialDailyDayKey: "2026-07-25",
      paidTrialDailyUsed: 10,
    }, NOW, SETTINGS);

    expect(status.planStatus).toBe("trial");
    expect(status.trials).toMatchObject({ plusUsed: 0, plusRemaining: 10 });
    expect(card(status, "plus")).toMatchObject({ active: true, state: "active", remaining: 10 });
  });

  it("keeps an Admin-granted paid entitlement ahead of daily trial credits", () => {
    const status = buildSubscriptionStatus({
      ...paidProfile("plus", { packageCredits: 40 }),
      paidTrialDailyDayKey: "2026-07-26",
      paidTrialDailyUsed: 10,
    }, NOW, SETTINGS);

    expect(status.planStatus).toBe("paid");
    expect(status.credits.total).toBe(40);
    expect(card(status, "plus")).toMatchObject({ paid: true, active: true, remaining: 40 });
  });

  it("does not mutate entitlement source data while calculating status", () => {
    const source = paidProfile("pro", { activePlan: "free", packageCredits: 0, topupCredits: 9 });
    const before = {
      activePlan: source.activePlan,
      paidPlan: source.paidPlan,
      planStatus: source.planStatus,
      packageCredits: source.packageCredits,
      topupCredits: source.topupCredits,
      expiresAt: source.planExpiresAt.toMillis(),
    };

    buildSubscriptionStatus(source, NOW);

    expect({
      activePlan: source.activePlan,
      paidPlan: source.paidPlan,
      planStatus: source.planStatus,
      packageCredits: source.packageCredits,
      topupCredits: source.topupCredits,
      expiresAt: source.planExpiresAt.toMillis(),
    }).toEqual(before);
  });
});
