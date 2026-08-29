export const GENERATION_PIPELINE_MODES = ["legacy", "staged"] as const;

export type GenerationPipelineMode = (typeof GENERATION_PIPELINE_MODES)[number];

export function resolveGenerationPipelineMode(value: string | undefined): GenerationPipelineMode {
  return value?.trim().toLowerCase() === "staged" ? "staged" : "legacy";
}

export function configuredGenerationPipelineMode() {
  return resolveGenerationPipelineMode(process.env.GENERATION_PIPELINE_MODE);
}
