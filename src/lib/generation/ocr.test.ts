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
});
