import type { GenerationPipelineMode } from "@/lib/generation/pipeline-mode";

export function resolveClientGenerationPipelineMode(
  value: string | undefined,
): GenerationPipelineMode {
  return value?.trim().toLowerCase() === "staged" ? "staged" : "legacy";
}

export function configuredClientGenerationPipelineMode() {
  return resolveClientGenerationPipelineMode(process.env.NEXT_PUBLIC_GENERATION_PIPELINE_MODE);
}

export async function loadEffectiveClientGenerationPipelineMode(
  options: {
    publicMode?: GenerationPipelineMode;
    fetcher?: typeof fetch;
    signal?: AbortSignal;
  } = {},
) {
  const publicMode = options.publicMode || configuredClientGenerationPipelineMode();
  if (publicMode !== "staged") return "legacy" as const;
  try {
    const response = await (options.fetcher || fetch)("/api/lesson/generation-config", {
      method: "GET",
      cache: "no-store",
      signal: options.signal,
    });
    if (!response.ok) return "legacy" as const;
    const result = await response.json() as {
      pipelineMode?: unknown;
      stagedAvailable?: unknown;
    };
    return result.pipelineMode === "staged" && result.stagedAvailable === true
      ? "staged" as const
      : "legacy" as const;
  } catch {
    return "legacy" as const;
  }
}
