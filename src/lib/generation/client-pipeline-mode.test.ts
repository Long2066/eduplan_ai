import { describe, expect, it, vi } from "vitest";
import {
  loadEffectiveClientGenerationPipelineMode,
  resolveClientGenerationPipelineMode,
} from "./client-pipeline-mode";

describe("client generation pipeline rollout mode", () => {
  it("defaults to legacy for missing or unknown values", () => {
    expect(resolveClientGenerationPipelineMode(undefined)).toBe("legacy");
    expect(resolveClientGenerationPipelineMode("on")).toBe("legacy");
  });

  it("requires an explicit staged value", () => {
    expect(resolveClientGenerationPipelineMode("staged")).toBe("staged");
    expect(resolveClientGenerationPipelineMode(" STAGED ")).toBe("staged");
  });

  it("does not call the config endpoint while the public kill switch is legacy", async () => {
    const fetcher = vi.fn();
    await expect(loadEffectiveClientGenerationPipelineMode({
      publicMode: "legacy",
      fetcher,
    })).resolves.toBe("legacy");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("uses staged only when the authenticated config endpoint allows it", async () => {
    const allowedFetcher = vi.fn(async () => new Response(JSON.stringify({
      pipelineMode: "staged",
      stagedAvailable: true,
    }), { status: 200 })) as unknown as typeof fetch;
    await expect(loadEffectiveClientGenerationPipelineMode({
      publicMode: "staged",
      fetcher: allowedFetcher,
    })).resolves.toBe("staged");

    const deniedFetcher = vi.fn(async () => new Response(JSON.stringify({
      pipelineMode: "legacy",
      stagedAvailable: false,
    }), { status: 200 })) as unknown as typeof fetch;
    await expect(loadEffectiveClientGenerationPipelineMode({
      publicMode: "staged",
      fetcher: deniedFetcher,
    })).resolves.toBe("legacy");
  });

  it("throws instead of silently downgrading when config route returns 500 or invalid json", async () => {
    const errorFetcher = vi.fn(async () => new Response(JSON.stringify({
      error: "Máy chủ bận.",
    }), { status: 500 })) as unknown as typeof fetch;

    await expect(loadEffectiveClientGenerationPipelineMode({
      publicMode: "staged",
      fetcher: errorFetcher,
    })).rejects.toThrow(/Không thể tải cấu hình|Máy chủ bận/);

    const malformedFetcher = vi.fn(async () => new Response(JSON.stringify({
      pipelineMode: "unexpected",
    }), { status: 200 })) as unknown as typeof fetch;

    await expect(loadEffectiveClientGenerationPipelineMode({
      publicMode: "staged",
      fetcher: malformedFetcher,
    })).rejects.toThrow(/Cấu hình quy trình tạo giáo án không hợp lệ/);
  });

  it("throws instead of silently downgrading on network failure when public staged", async () => {
    const networkErrorFetcher = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;

    await expect(loadEffectiveClientGenerationPipelineMode({
      publicMode: "staged",
      fetcher: networkErrorFetcher,
    })).rejects.toThrow(/Chưa chuyển sang quy trình một bước/);
  });
});
