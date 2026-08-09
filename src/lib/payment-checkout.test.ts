import { describe, expect, it } from "vitest";
import { createPayosDescription, createPayosOrderCode, resolvePaymentProvider } from "./payment-checkout";

const payosEnv = {
  PAYOS_CLIENT_ID: "client",
  PAYOS_API_KEY: "api",
  PAYOS_CHECKSUM_KEY: "checksum",
  PAYOS_RETURN_URL: "https://example.com/success",
  PAYOS_CANCEL_URL: "https://example.com/cancel",
};

describe("payment checkout provider", () => {
  it("requires payOS and never falls back to manual bank transfer", () => {
    expect(() => resolvePaymentProvider({})).toThrow("payOS chưa được cấu hình đầy đủ");
    expect(resolvePaymentProvider(payosEnv)).toBe("payos");
    expect(() => resolvePaymentProvider({ ...payosEnv, PAYMENT_PROVIDER: "bank_transfer" })).toThrow("chỉ hỗ trợ thanh toán tự động qua payOS");
    expect(resolvePaymentProvider({ ...payosEnv, PAYMENT_PROVIDER: "payos" })).toBe("payos");
  });

  it("creates a safe integer order code and a compact transfer description", () => {
    const orderCode = createPayosOrderCode(1_785_981_000_000, 247);
    const description = createPayosDescription(orderCode);

    expect(orderCode).toBe(178_598_100_000_047);
    expect(Number.isSafeInteger(orderCode)).toBe(true);
    expect(description).toMatch(/^ED[A-Z0-9]{7}$/);
    expect(description).toHaveLength(9);
  });
});
