import { describe, expect, it } from "vitest";
import { validatePayosPayment } from "./payment-service";

const checkout = {
  status: "awaiting_payment",
  amountVnd: 59000,
  transferContent: "EDUPLAN01",
  paymentLinkId: "link-id",
};

const webhookData = {
  amount: 59000,
  description: "EDUPLAN01",
  paymentLinkId: "link-id",
  reference: "TF260806123456",
};

describe("payOS webhook reconciliation", () => {
  it("approves only a complete, matching and unused transaction", () => {
    const verdict = validatePayosPayment(checkout, webhookData, true);
    expect(verdict.allPassed).toBe(true);
    expect(verdict.checks.every((check) => check.passed)).toBe(true);
  });

  it("routes amount, link and duplicate mismatches to review", () => {
    expect(validatePayosPayment(checkout, { ...webhookData, amount: 58000 }, true).allPassed).toBe(false);
    expect(validatePayosPayment(checkout, { ...webhookData, paymentLinkId: "other" }, true).allPassed).toBe(false);
    expect(validatePayosPayment(checkout, webhookData, false).allPassed).toBe(false);
  });

  it("does not auto-approve a payment that is no longer receivable", () => {
    expect(validatePayosPayment({ ...checkout, status: "expired" }, webhookData, true).allPassed).toBe(false);
  });
});
