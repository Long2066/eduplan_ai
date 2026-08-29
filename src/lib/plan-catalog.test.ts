import { describe, expect, it } from "vitest";
import { FREE_DAILY_LIMIT, PAID_TRIAL_DAILY_CREDITS, PLAN_CATALOG, buildSubscriptionStatus } from "./subscription-policy";

describe("public two-plan catalog", () => {
  it("exposes only Miễn phí and Trả phí while retaining internal plus id", () => {
    expect(Object.keys(PLAN_CATALOG)).toEqual(["free", "plus"]);
    expect(PLAN_CATALOG.free.name).toBe("Miễn phí");
    expect(PLAN_CATALOG.plus.name).toBe("Trả phí");
    expect(PLAN_CATALOG.plus.id).toBe("plus");
  });

  it("keeps the approved quotas and plan-card copy aligned with the usage mechanics", () => {
    const freeCopy = [PLAN_CATALOG.free.description, ...PLAN_CATALOG.free.benefits, PLAN_CATALOG.free.hint].join(" ");
    const paidCopy = [PLAN_CATALOG.plus.badge, PLAN_CATALOG.plus.title, PLAN_CATALOG.plus.description, ...PLAN_CATALOG.plus.benefits].join(" ");

    expect(FREE_DAILY_LIMIT).toBe(3);
    expect(PLAN_CATALOG.free.dailyLimit).toBe(3);
    expect(freeCopy).toContain("Sử dụng AI tiêu chuẩn.");
    expect(freeCopy).toContain("3 lượt tạo giáo án miễn phí mỗi ngày.");
    expect(freeCopy).toContain("00:00 theo giờ Việt Nam");
    expect(freeCopy).toContain("1 lượt tạo mỗi ngày");
    expect(PAID_TRIAL_DAILY_CREDITS / PLAN_CATALOG.plus.generationCost).toBe(1);

    expect(PLAN_CATALOG.plus.badge).toBe("TRẢ PHÍ (THỬ NGHIỆM)");
    expect(PLAN_CATALOG.plus.title).toBe("Trả phí – Chất lượng cao");
    expect(PLAN_CATALOG.plus.includedCredits).toBe(50);
    expect(PLAN_CATALOG.plus.generationCost).toBe(10);
    expect(PLAN_CATALOG.plus.includedCredits / PLAN_CATALOG.plus.generationCost).toBe(5);
    expect(paidCopy).toContain("Sử dụng model AI cao cấp để soạn KHBD.");
    expect(paidCopy).toContain("có thể mua thêm tín dụng (nếu có)");
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
