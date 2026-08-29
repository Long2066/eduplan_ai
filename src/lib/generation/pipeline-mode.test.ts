import { describe, expect, it } from "vitest";
import { resolveGenerationPipelineMode } from "./pipeline-mode";

describe("generation pipeline mode", () => {
  it("keeps legacy as the safe default", () => {
    expect(resolveGenerationPipelineMode(undefined)).toBe("legacy");
    expect(resolveGenerationPipelineMode("")).toBe("legacy");
    expect(resolveGenerationPipelineMode("unknown")).toBe("legacy");
  });

  it("accepts the staged mode case-insensitively", () => {
    expect(resolveGenerationPipelineMode("staged")).toBe("staged");
    expect(resolveGenerationPipelineMode(" STAGED ")).toBe("staged");
  });
});
