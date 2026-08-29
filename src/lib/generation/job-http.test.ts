import { afterEach, describe, expect, it } from "vitest";
import { GenerationJobRequestError } from "./job-input";
import {
  generationJobErrorResponse,
  stagedGenerationAccessDeniedResponse,
  stagedGenerationDisabledResponse,
} from "./job-http";

const originalPipelineMode = process.env.GENERATION_PIPELINE_MODE;
const originalAllowlist = process.env.GENERATION_STAGED_ALLOWLIST;
const originalKillSwitch = process.env.GENERATION_STAGED_KILL_SWITCH;

afterEach(() => {
  if (originalPipelineMode === undefined) delete process.env.GENERATION_PIPELINE_MODE;
  else process.env.GENERATION_PIPELINE_MODE = originalPipelineMode;
  if (originalAllowlist === undefined) delete process.env.GENERATION_STAGED_ALLOWLIST;
  else process.env.GENERATION_STAGED_ALLOWLIST = originalAllowlist;
  if (originalKillSwitch === undefined) delete process.env.GENERATION_STAGED_KILL_SWITCH;
  else process.env.GENERATION_STAGED_KILL_SWITCH = originalKillSwitch;
});

describe("generation job HTTP helpers", () => {
  it("keeps staged APIs closed while legacy mode is active", async () => {
    process.env.GENERATION_PIPELINE_MODE = "legacy";
    const response = stagedGenerationDisabledResponse();
    expect(response?.status).toBe(409);
    expect(await response?.json()).toMatchObject({ code: "STAGED_PIPELINE_DISABLED" });
  });

  it("opens staged APIs only when explicitly enabled", () => {
    process.env.GENERATION_PIPELINE_MODE = "staged";
    expect(stagedGenerationDisabledResponse()).toBeNull();
  });

  it("denies direct staged API access for accounts outside the allowlist", async () => {
    process.env.GENERATION_PIPELINE_MODE = "staged";
    process.env.GENERATION_STAGED_ALLOWLIST = "allowed@example.com";
    const response = stagedGenerationAccessDeniedResponse({
      uid: "user-1",
      email: "other@example.com",
    });
    expect(response?.status).toBe(403);
    expect(await response?.json()).toMatchObject({ code: "STAGED_PIPELINE_NOT_ALLOWED" });
  });

  it("allows direct staged API access only for a matching account", () => {
    process.env.GENERATION_PIPELINE_MODE = "staged";
    process.env.GENERATION_STAGED_ALLOWLIST = "teacher@example.com";
    process.env.GENERATION_STAGED_KILL_SWITCH = "false";
    expect(stagedGenerationAccessDeniedResponse({
      uid: "user-1",
      email: "teacher@example.com",
    })).toBeNull();
  });

  it("preserves structured validation errors", async () => {
    const response = generationJobErrorResponse(
      new GenerationJobRequestError("Invalid input", "INVALID_INPUT", 413),
      "Fallback",
    );
    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ error: "Invalid input", code: "INVALID_INPUT" });
  });
});
