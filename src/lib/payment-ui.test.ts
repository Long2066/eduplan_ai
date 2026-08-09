import { describe, expect, it } from "vitest";
import { formatPaymentCountdown, isTerminalPaymentStatus, paymentStorageKey } from "./payment-ui";
import { isReusablePayosCheckout } from "./payment-service";

describe("payment modal helpers", () => {
  it("identifies terminal states without treating review as completed", () => {
    expect(isTerminalPaymentStatus("approved")).toBe(true);
    expect(isTerminalPaymentStatus("expired")).toBe(true);
    expect(isTerminalPaymentStatus("pending_review")).toBe(false);
    expect(isTerminalPaymentStatus("awaiting_payment")).toBe(false);
  });

  it("formats a stable countdown and isolates storage by user", () => {
    expect(formatPaymentCountdown(125)).toBe("02:05");
    expect(formatPaymentCountdown(-1)).toBe("00:00");
    expect(paymentStorageKey("user-1")).toBe("eduplan:active-payos:user-1");
  });

  it("reuses only active payOS checkouts that have not expired", () => {
    const now = new Date("2026-08-06T04:00:00.000Z");
    expect(isReusablePayosCheckout({ provider: "payos", status: "awaiting_payment", expiresAt: new Date("2026-08-06T04:10:00.000Z") }, now)).toBe(true);
    expect(isReusablePayosCheckout({ provider: "payos", status: "approved", expiresAt: new Date("2026-08-06T04:10:00.000Z") }, now)).toBe(false);
    expect(isReusablePayosCheckout({ provider: "bank_transfer", status: "awaiting_payment", expiresAt: new Date("2026-08-06T04:10:00.000Z") }, now)).toBe(false);
    expect(isReusablePayosCheckout({ provider: "payos", status: "awaiting_payment", expiresAt: new Date("2026-08-06T03:59:00.000Z") }, now)).toBe(false);
  });
});
