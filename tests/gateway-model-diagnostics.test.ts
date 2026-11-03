import { describe, expect, it } from "vitest";
import { ALL_GATEWAY_MODELS, GATEWAY_OCR_MODELS, GATEWAY_TEXT_MODELS } from "../shared/ai-gateway-catalog";
import { confirmsBlueImage, makeTestPayload, readableReply, TEST_IMAGE } from "../admin-app/src/app/api/admin/settings/test-connection/payload";

describe("Gateway model diagnostics", () => {
  it("offers every Gateway model to both routing slots without duplicates", () => {
    const ids = ALL_GATEWAY_MODELS.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(GATEWAY_TEXT_MODELS).toBe(ALL_GATEWAY_MODELS);
    expect(GATEWAY_OCR_MODELS).toBe(ALL_GATEWAY_MODELS);
    for (const id of ["gpt-5.4-mini", "gpt-image-2", "gpt-image-2.5-flare", "gemini-3.1-flash-image"]) expect(ids).toContain(id);
  });
  it("sends a real image for vision but not text requests", () => {
    const vision = makeTestPayload("gemini-3-flash", "vision", true);
    const text = makeTestPayload("gemini-3-flash", "text", true);
    expect(JSON.stringify(vision)).toContain(TEST_IMAGE);
    expect(JSON.stringify(text)).not.toContain("image_url");
    expect(TEST_IMAGE.startsWith("data:image/png;base64,")).toBe(true);
  });
  it("does not treat empty responses or non-image responses as image recognition", () => {
    expect(readableReply(null)).toBe("");
    expect(readableReply([{ type: "text", text: "Màu xanh dương" }])).toContain("xanh");
    expect(confirmsBlueImage("OK")).toBe(false);
    expect(confirmsBlueImage("The color is blue")).toBe(true);
  });
});
