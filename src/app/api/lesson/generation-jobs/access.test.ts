import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
}));
const httpMocks = vi.hoisted(() => ({
  generationJobErrorResponse: vi.fn(),
  stagedGenerationAccessDeniedResponse: vi.fn(),
  stagedGenerationDisabledResponse: vi.fn(),
}));
const inputMocks = vi.hoisted(() => ({
  requireGenerationIdempotencyKey: vi.fn(),
  validateGenerationJobInput: vi.fn(),
}));
const serviceMocks = vi.hoisted(() => ({
  cancelStagedGenerationJob: vi.fn(),
  createStagedGenerationJob: vi.fn(),
  getStagedGenerationJob: vi.fn(),
  serializeGenerationJob: vi.fn(),
}));
const executorMocks = vi.hoisted(() => ({
  advanceStagedGenerationJob: vi.fn(),
}));

vi.mock("@/lib/auth-server", () => authMocks);
vi.mock("@/lib/generation/job-http", () => httpMocks);
vi.mock("@/lib/generation/job-input", () => inputMocks);
vi.mock("@/lib/generation/job-service", () => serviceMocks);
vi.mock("@/lib/generation/step-executor", () => executorMocks);

import { POST as createJob } from "./route";
import { GET as getJob } from "./[jobId]/route";
import { POST as advanceJob } from "./[jobId]/advance/route";
import { POST as cancelJob } from "./[jobId]/cancel/route";

const context = { params: Promise.resolve({ jobId: "job-1" }) };

describe("generation job API canary enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    httpMocks.stagedGenerationDisabledResponse.mockReturnValue(null);
    authMocks.requireUser.mockResolvedValue({
      uid: "user-1",
      email: "not-allowed@example.com",
      emailVerified: true,
    });
    httpMocks.stagedGenerationAccessDeniedResponse.mockReturnValue(
      Response.json({ code: "STAGED_PIPELINE_NOT_ALLOWED" }, { status: 403 }),
    );
  });

  it("blocks create, get, advance and cancel before any job operation runs", async () => {
    const createResponse = await createJob(new Request("http://localhost/api/lesson/generation-jobs", {
      method: "POST",
    }));
    const getResponse = await getJob(new Request("http://localhost"), context);
    const advanceResponse = await advanceJob(new Request("http://localhost", { method: "POST" }), context);
    const cancelResponse = await cancelJob(new Request("http://localhost", { method: "POST" }), context);

    expect([
      createResponse.status,
      getResponse.status,
      advanceResponse.status,
      cancelResponse.status,
    ]).toEqual([403, 403, 403, 403]);
    expect(httpMocks.stagedGenerationAccessDeniedResponse).toHaveBeenCalledTimes(4);
    expect(serviceMocks.createStagedGenerationJob).not.toHaveBeenCalled();
    expect(serviceMocks.getStagedGenerationJob).not.toHaveBeenCalled();
    expect(executorMocks.advanceStagedGenerationJob).not.toHaveBeenCalled();
    expect(serviceMocks.cancelStagedGenerationJob).not.toHaveBeenCalled();
  });
});
