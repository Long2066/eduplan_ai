import "server-only";

import { isPayosConfigured } from "@/lib/payos-client";

export type PaymentProvider = "payos" | "bank_transfer";
type Environment = Readonly<Record<string, string | undefined>>;

export function resolvePaymentProvider(env: Environment = process.env): "payos" {
  const requested = String(env.PAYMENT_PROVIDER || "auto").trim().toLowerCase();
  if (requested === "bank_transfer" || requested === "legacy") {
    throw new Error("EduPlan chỉ hỗ trợ thanh toán tự động qua payOS.");
  }
  if (!isPayosConfigured(env)) {
    throw new Error("payOS chưa được cấu hình đầy đủ.");
  }
  return "payos";
}

export function createPayosOrderCode(nowMs = Date.now(), entropy = 0) {
  const timestamp = Math.max(1, Math.floor(nowMs));
  const suffix = Math.abs(Math.floor(entropy)) % 100;
  const orderCode = timestamp * 100 + suffix;
  if (!Number.isSafeInteger(orderCode)) throw new Error("Không thể tạo orderCode payOS an toàn.");
  return orderCode;
}

export function createPayosDescription(orderCode: number) {
  const suffix = orderCode.toString(36).toUpperCase().slice(-7).padStart(7, "0");
  return `ED${suffix}`;
}
