import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UploadedAsset } from "@/types/lesson";

const cacheMocks = vi.hoisted(() => ({
  readCachedOcrText: vi.fn(),
  saveCachedOcrText: vi.fn(),
}));
vi.mock("@/lib/vietnamese-source-inventory-store", () => cacheMocks);

import { runOpenAiOcrAsset, sortGenerationOcrAssets } from "./ocr";

function asset(name: string, order?: number): UploadedAsset {
  return {
    id: name,
    name,
    type: "image",
    order,
    dataUrl: "data:image/png;base64,YWJj",
  };
}

describe("shared OCR pipeline", () => {
  beforeEach(() => vi.clearAllMocks());

  it("preserves explicit upload order before filename sequence", () => {
    const sorted = sortGenerationOcrAssets([
      asset("page-10.png"),
      asset("page-2.png"),
      asset("manual.png", 0),
    ]);
    expect(sorted.map((item) => item.name)).toEqual(["manual.png", "page-2.png", "page-10.png"]);
  });

  it("uses the existing OCR cache before calling OpenAI", async () => {
    cacheMocks.readCachedOcrText.mockResolvedValue("Nội dung OCR đã được lưu trong cache và đủ dài.");
    const result = await runOpenAiOcrAsset(asset("page-1.png"), 0, 1);
    expect(result).toMatchObject({ cacheHit: true, text: expect.stringContaining("cache") });
    expect(cacheMocks.saveCachedOcrText).not.toHaveBeenCalled();
  });

  it("routes OCR to 9router Gemini with stream=false when freeEngine is gemini", async () => {
    process.env.NINEROUTER_API_KEY = "test-ocr-key";
    process.env.NINEROUTER_API_BASE_URL = "http://158.178.235.87:20128/v1";
    cacheMocks.readCachedOcrText.mockResolvedValue(null);
    let capturedUrl = "";
    let capturedAuth = "";
    let capturedBody: { stream?: boolean; model?: string } = {};
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      capturedUrl = url;
      capturedAuth = (init?.headers as Record<string, string>)?.["Authorization"] || "";
      capturedBody = JSON.parse(String(init?.body || "{}"));
      return {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: "Nội dung trích xuất từ SGK Tiếng Việt lớp 1." } }],
        }),
      };
    }));

    const result = await runOpenAiOcrAsset(asset("sgk-1.png"), 0, 1, { freeEngine: "gemini" });
    expect(result.model).toBe("ag/gemini-3.8-flash-high");
    expect(result.text).toContain("SGK Tiếng Việt");
    expect(capturedUrl).toContain("158.178.235.87:20128/v1/chat/completions");
    expect(capturedAuth).toBe("Bearer test-ocr-key");
    expect(capturedBody.stream).toBe(false);
  });
});
