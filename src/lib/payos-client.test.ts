import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildPayosDataString,
  buildPayosPaymentRequestSignature,
  createPayosPaymentLink,
  getPayosConfig,
  isPayosConfigured,
  verifyPayosWebhookSignature,
} from "./payos-client";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("payOS client", () => {
  it("builds the payment-request signature in payOS field order", () => {
    const signature = buildPayosPaymentRequestSignature({
      amount: 59000,
      cancelUrl: "https://eduplan-ai.id.vn/?payment=cancelled",
      description: "EDUPLAN123",
      orderCode: 20260806001,
      returnUrl: "https://eduplan-ai.id.vn/?payment=success",
    }, "test-checksum-key");

    expect(signature).toBe("f95c3b2cb949e37636db792dcfb2c1ef4b7c4a1c94580c21c949cd2a91026e6b");
  });

  it("normalizes and sorts webhook data before verifying HMAC", () => {
    const data = {
      transactionDateTime: "2023-02-04 18:25:00",
      amount: 3000,
      description: "VQRIO123",
      orderCode: 123,
      accountNumber: "12345678",
      reference: "TF230204212323",
      currency: "VND",
      paymentLinkId: "124c33293c43417ab7879e14c8d9eb18",
      code: "00",
      desc: "Thành công",
      counterAccountBankId: "",
      counterAccountBankName: "",
      counterAccountName: "",
      counterAccountNumber: "",
      virtualAccountName: "",
      virtualAccountNumber: "",
    };
    const checksumKey = "1a54716c8f0efb2744fb28b6e38b25da7f67a925d98bc1c18bd8faaecadd7675";
    const signature = "412e915d2871504ed31be63c8f62a149a4410d34c4c42affc9006ef9917eaa03";

    expect(buildPayosDataString({ b: null, a: 1 })).toBe("a=1&b=");
    expect(verifyPayosWebhookSignature(data, signature, checksumKey)).toBe(true);
    expect(verifyPayosWebhookSignature({ ...data, amount: 4000 }, signature, checksumKey)).toBe(false);
  });

  it("requires server-only credentials and redirect URLs", () => {
    expect(isPayosConfigured({})).toBe(false);
    expect(() => getPayosConfig({})).toThrow(/PAYOS_CLIENT_ID/);
    expect(getPayosConfig({
      PAYOS_CLIENT_ID: "client",
      PAYOS_API_KEY: "api",
      PAYOS_CHECKSUM_KEY: "checksum",
      PAYOS_RETURN_URL: "https://example.com/success",
      PAYOS_CANCEL_URL: "https://example.com/cancel",
    })).toMatchObject({
      clientId: "client",
      apiKey: "api",
      checksumKey: "checksum",
      apiBaseUrl: "https://api-merchant.payos.vn",
    });
  });

  it("creates a hosted checkout with server-only headers and a signed payload", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      code: "00",
      desc: "success",
      data: {
        bin: "970452",
        accountNumber: "2601072006",
        accountName: "MA VAN LONG",
        amount: 59000,
        description: "EDUPLAN01",
        orderCode: 20260806001,
        currency: "VND",
        paymentLinkId: "link-id",
        status: "PENDING",
        checkoutUrl: "https://pay.payos.vn/web/link-id",
        qrCode: "vietqr-payload",
      },
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const config = getPayosConfig({
      PAYOS_CLIENT_ID: "client",
      PAYOS_API_KEY: "api",
      PAYOS_CHECKSUM_KEY: "checksum",
      PAYOS_RETURN_URL: "https://eduplan-ai.id.vn/?payment=success",
      PAYOS_CANCEL_URL: "https://eduplan-ai.id.vn/?payment=cancelled",
    });
    const link = await createPayosPaymentLink({
      orderCode: 20260806001,
      amount: 59000,
      description: "EDUPLAN01",
      expiredAt: 1_786_000_000,
    }, config);

    expect(link.checkoutUrl).toBe("https://pay.payos.vn/web/link-id");
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api-merchant.payos.vn/v2/payment-requests");
    expect(init.headers).toMatchObject({ "x-client-id": "client", "x-api-key": "api" });
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({
      orderCode: 20260806001,
      amount: 59000,
      description: "EDUPLAN01",
      returnUrl: "https://eduplan-ai.id.vn/?payment=success",
      cancelUrl: "https://eduplan-ai.id.vn/?payment=cancelled",
    });
    expect(body.signature).toBe(buildPayosPaymentRequestSignature(body, "checksum"));
  });
});
