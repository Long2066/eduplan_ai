import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

const DEFAULT_API_BASE_URL = "https://api-merchant.payos.vn";
type Environment = Readonly<Record<string, string | undefined>>;

export type PayosConfig = {
  clientId: string;
  apiKey: string;
  checksumKey: string;
  apiBaseUrl: string;
  webhookUrl: string;
  returnUrl: string;
  cancelUrl: string;
};

export type PayosPaymentLinkInput = {
  orderCode: number;
  amount: number;
  description: string;
  returnUrl?: string;
  cancelUrl?: string;
  expiredAt?: number;
  buyerName?: string;
  buyerEmail?: string;
  items?: Array<{ name: string; quantity: number; price: number }>;
};

export type PayosPaymentLink = {
  bin: string;
  accountNumber: string;
  accountName: string;
  amount: number;
  description: string;
  orderCode: number;
  currency: string;
  paymentLinkId: string;
  status: string;
  checkoutUrl: string;
  qrCode: string;
};

export type PayosWebhookPayload = {
  code: string;
  desc: string;
  success: boolean;
  data: Record<string, unknown>;
  signature: string;
};

export class PayosClientError extends Error {
  status: number;
  code: string;

  constructor(message: string, code = "PAYOS_ERROR", status = 502) {
    super(message);
    this.name = "PayosClientError";
    this.code = code;
    this.status = status;
  }
}

function envValue(env: Environment, key: string) {
  return String(env[key] || "").trim();
}

export function getPayosConfig(env: Environment = process.env): PayosConfig {
  const config = {
    clientId: envValue(env, "PAYOS_CLIENT_ID"),
    apiKey: envValue(env, "PAYOS_API_KEY"),
    checksumKey: envValue(env, "PAYOS_CHECKSUM_KEY"),
    apiBaseUrl: envValue(env, "PAYOS_API_BASE_URL") || DEFAULT_API_BASE_URL,
    webhookUrl: envValue(env, "PAYOS_WEBHOOK_URL"),
    returnUrl: envValue(env, "PAYOS_RETURN_URL"),
    cancelUrl: envValue(env, "PAYOS_CANCEL_URL"),
  };

  const missing = [
    ["PAYOS_CLIENT_ID", config.clientId],
    ["PAYOS_API_KEY", config.apiKey],
    ["PAYOS_CHECKSUM_KEY", config.checksumKey],
    ["PAYOS_RETURN_URL", config.returnUrl],
    ["PAYOS_CANCEL_URL", config.cancelUrl],
  ].filter(([, value]) => !value).map(([key]) => key);

  if (missing.length) {
    throw new PayosClientError(
      `Thiếu cấu hình payOS: ${missing.join(", ")}.`,
      "PAYOS_NOT_CONFIGURED",
      503,
    );
  }

  return config;
}

export function isPayosConfigured(env: Environment = process.env) {
  try {
    getPayosConfig(env);
    return true;
  } catch {
    return false;
  }
}

function sortedObject(value: Record<string, unknown>): Record<string, unknown> {
  return Object.keys(value).sort().reduce<Record<string, unknown>>((result, key) => {
    const entry = value[key];
    if (Array.isArray(entry)) {
      result[key] = entry.map((item) => item && typeof item === "object" && !Array.isArray(item)
        ? sortedObject(item as Record<string, unknown>)
        : item);
    } else if (entry && typeof entry === "object") {
      result[key] = sortedObject(entry as Record<string, unknown>);
    } else {
      result[key] = entry;
    }
    return result;
  }, {});
}

function signatureValue(value: unknown) {
  if (value === null || value === undefined || value === "null" || value === "undefined") return "";
  if (Array.isArray(value)) {
    return JSON.stringify(value.map((item) => item && typeof item === "object" && !Array.isArray(item)
      ? sortedObject(item as Record<string, unknown>)
      : item));
  }
  if (typeof value === "object") return JSON.stringify(sortedObject(value as Record<string, unknown>));
  return String(value);
}

export function buildPayosDataString(data: Record<string, unknown>) {
  return Object.keys(data)
    .sort()
    .map((key) => `${key}=${signatureValue(data[key])}`)
    .join("&");
}

export function buildPayosDataSignature(data: Record<string, unknown>, checksumKey: string) {
  return createHmac("sha256", checksumKey).update(buildPayosDataString(data)).digest("hex");
}

export function buildPayosPaymentRequestSignature(
  input: Pick<PayosPaymentLinkInput, "amount" | "cancelUrl" | "description" | "orderCode" | "returnUrl">,
  checksumKey: string,
) {
  return buildPayosDataSignature({
    amount: input.amount,
    cancelUrl: input.cancelUrl || "",
    description: input.description,
    orderCode: input.orderCode,
    returnUrl: input.returnUrl || "",
  }, checksumKey);
}

export function verifyPayosWebhookSignature(data: Record<string, unknown>, signature: string, checksumKey: string) {
  const expected = buildPayosDataSignature(data, checksumKey);
  if (!/^[a-f0-9]{64}$/i.test(signature)) return false;
  return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(signature, "hex"));
}

async function payosRequest<T>(path: string, body: Record<string, unknown>, config: PayosConfig): Promise<T> {
  const response = await fetch(`${config.apiBaseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-client-id": config.clientId,
      "x-api-key": config.apiKey,
    },
    body: JSON.stringify(body),
  });
  const result = await response.json().catch(() => null) as { code?: string; desc?: string; data?: T } | null;
  if (!response.ok || result?.code !== "00" || !result.data) {
    throw new PayosClientError(
      result?.desc || `payOS phản hồi lỗi (${response.status}).`,
      "PAYOS_API_ERROR",
      response.status >= 400 && response.status < 500 ? 400 : 502,
    );
  }
  return result.data;
}

export async function createPayosPaymentLink(input: PayosPaymentLinkInput, config = getPayosConfig()) {
  const returnUrl = input.returnUrl || config.returnUrl;
  const cancelUrl = input.cancelUrl || config.cancelUrl;
  const signature = buildPayosPaymentRequestSignature({ ...input, returnUrl, cancelUrl }, config.checksumKey);
  return payosRequest<PayosPaymentLink>("/v2/payment-requests", {
    ...input,
    returnUrl,
    cancelUrl,
    signature,
  }, config);
}

export async function confirmPayosWebhook(config = getPayosConfig()) {
  if (!config.webhookUrl) {
    throw new PayosClientError("Thiếu PAYOS_WEBHOOK_URL.", "PAYOS_WEBHOOK_NOT_CONFIGURED", 503);
  }
  return payosRequest<Record<string, unknown>>("/confirm-webhook", { webhookUrl: config.webhookUrl }, config);
}
