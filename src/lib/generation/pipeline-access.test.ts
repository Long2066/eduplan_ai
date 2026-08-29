import { describe, expect, it } from "vitest";
import {
  parseStagedGenerationAllowlist,
  resolveStagedGenerationAccess,
} from "./pipeline-access";

const identity = { uid: "User-123", email: "Teacher@Example.com" };

describe("staged generation canary access", () => {
  it("normalizes comma, semicolon, whitespace, UID and email entries", () => {
    expect(parseStagedGenerationAllowlist(" A@EXAMPLE.COM, user-1;user-1\nuser-2 "))
      .toEqual(["a@example.com", "user-1", "user-2"]);
  });

  it("keeps everyone on legacy while the global pipeline is legacy", () => {
    expect(resolveStagedGenerationAccess(identity, {
      pipelineMode: "legacy",
      allowlist: "teacher@example.com",
    })).toEqual({
      allowed: false,
      effectiveMode: "legacy",
      reason: "global_legacy",
    });
  });

  it("uses the kill switch ahead of an allowlist match", () => {
    expect(resolveStagedGenerationAccess(identity, {
      pipelineMode: "staged",
      killSwitch: "true",
      allowlist: "teacher@example.com",
    })).toMatchObject({ allowed: false, effectiveMode: "legacy", reason: "kill_switch" });
  });

  it("fails closed when staged mode has no allowlist", () => {
    expect(resolveStagedGenerationAccess(identity, {
      pipelineMode: "staged",
      allowlist: "",
    })).toMatchObject({ allowed: false, reason: "allowlist_empty" });
  });

  it("allows a case-insensitive email or UID match", () => {
    expect(resolveStagedGenerationAccess(identity, {
      pipelineMode: "staged",
      allowlist: "teacher@example.com",
    }).allowed).toBe(true);
    expect(resolveStagedGenerationAccess(identity, {
      pipelineMode: "staged",
      allowlist: "user-123",
    }).allowed).toBe(true);
  });

  it("supports an explicit wildcard for a later global rollout", () => {
    expect(resolveStagedGenerationAccess(identity, {
      pipelineMode: "staged",
      allowlist: "*",
    })).toMatchObject({ allowed: true, effectiveMode: "staged" });
  });

  it("keeps a non-allowlisted account on legacy", () => {
    expect(resolveStagedGenerationAccess(identity, {
      pipelineMode: "staged",
      allowlist: "another@example.com",
    })).toMatchObject({ allowed: false, effectiveMode: "legacy", reason: "not_allowlisted" });
  });
});
