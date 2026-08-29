import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
}));
const accessMocks = vi.hoisted(() => ({
  configuredStagedGenerationAccess: vi.fn(),
}));

vi.mock("@/lib/auth-server", () => authMocks);
vi.mock("@/lib/generation/pipeline-access", () => accessMocks);

import { GET } from "./route";

describe("generation pipeline config route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.requireUser.mockResolvedValue({
      uid: "user-1",
      email: "teacher@example.com",
    });
  });

  it("returns staged only for an allowlisted authenticated account", async () => {
    accessMocks.configuredStagedGenerationAccess.mockReturnValue({
      allowed: true,
      effectiveMode: "staged",
      reason: "allowlisted",
    });

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      pipelineMode: "staged",
      stagedAvailable: true,
    });
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it("keeps a non-allowlisted account on legacy", async () => {
    accessMocks.configuredStagedGenerationAccess.mockReturnValue({
      allowed: false,
      effectiveMode: "legacy",
      reason: "not_allowlisted",
    });

    const response = await GET();

    await expect(response.json()).resolves.toEqual({
      pipelineMode: "legacy",
      stagedAvailable: false,
    });
  });
});
