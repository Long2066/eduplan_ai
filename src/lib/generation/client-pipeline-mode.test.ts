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
});
