import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const lifecycleMocks = vi.hoisted(() => ({
  cleanupExpiredGenerationJobs: vi.fn(),
}));

vi.mock("@/lib/generation/lifecycle", () => lifecycleMocks);

import { GET } from "./route";

const originalCronSecret = process.env.CRON_SECRET;

afterAll(() => {
  if (originalCronSecret === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = originalCronSecret;
});

describe("expired generation cleanup route", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = "test-cleanup-secret";
    vi.clearAllMocks();
    lifecycleMocks.cleanupExpiredGenerationJobs.mockResolvedValue({
      scanned: 2,
      settled: 1,
      cleaned: 2,
      deleted: 2,
      failed: 0,
    });
  });

  it("rejects requests without the configured bearer secret", async () => {
    const response = await GET(new Request("http://localhost/api/internal/generation-jobs/cleanup"));

    expect(response.status).toBe(401);
    expect(lifecycleMocks.cleanupExpiredGenerationJobs).not.toHaveBeenCalled();
  });

  it("runs the bounded cleanup for an authorized Vercel cron request", async () => {
    const response = await GET(new Request("http://localhost/api/internal/generation-jobs/cleanup", {
      headers: { Authorization: "Bearer test-cleanup-secret" },
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      scanned: 2,
      settled: 1,
      cleaned: 2,
      deleted: 2,
      failed: 0,
    });
    expect(lifecycleMocks.cleanupExpiredGenerationJobs).toHaveBeenCalledWith(20);
  });
});
