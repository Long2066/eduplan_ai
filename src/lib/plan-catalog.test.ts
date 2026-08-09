import { describe, expect, it } from "vitest";
import { FREE_DAILY_LIMIT, PLAN_CATALOG, buildSubscriptionStatus } from "./subscription-policy";

describe("public two-plan catalog", () => {
  it("exposes only Miễn phí and Trả phí while retaining internal plus id", () => {
    expect(Object.keys(PLAN_CATALOG)).toEqual(["free", "plus"]);
    expect(PLAN_CATALOG.free.name).toBe("Miễn phí");
    expect(PLAN_CATALOG.plus.name).toBe("Trả phí");
    expect(PLAN_CATALOG.plus.id).toBe("plus");
  });

  it("keeps the approved Free quota and current generation model copy", () => {
    expect(FREE_DAILY_LIMIT).toBe(3);
    expect(PLAN_CATALOG.free.dailyLimit).toBe(3);
    expect(PLAN_CATALOG.free.benefits.join(" ")).toContain("GPT-4.1-mini");
    expect(PLAN_CATALOG.free.benefits.join(" ")).not.toContain("MiniMax");
  });

  it("never returns a public Pro card for legacy Pro data", () => {
    const status = buildSubscriptionStatus({
      activePlan: "pro",
      paidPlan: "pro",
      planStatus: "paid",
      packageCredits: 50,
      planExpiresAt: new Date("2099-01-01T00:00:00.000Z"),
    });

    expect(status.activePlan).toBe("plus");
    expect(status.cards.map((card) => card.id)).toEqual(["free", "plus"]);
    expect(status.cards.map((card) => card.name)).toEqual(["Miễn phí", "Trả phí"]);
  });
});
