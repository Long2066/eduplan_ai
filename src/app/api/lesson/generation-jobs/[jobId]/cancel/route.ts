import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth-server";
import {
  generationJobErrorResponse,
  stagedGenerationAccessDeniedResponse,
  stagedGenerationDisabledResponse,
} from "@/lib/generation/job-http";
import {
  cancelStagedGenerationJob,
  serializeGenerationJob,
} from "@/lib/generation/job-service";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ jobId: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const disabledResponse = stagedGenerationDisabledResponse();
  if (disabledResponse) return disabledResponse;

  try {
    const user = await requireUser();
    const deniedResponse = stagedGenerationAccessDeniedResponse(user);
    if (deniedResponse) return deniedResponse;
    const { jobId } = await context.params;
    const job = await cancelStagedGenerationJob(user.uid, jobId);
    return NextResponse.json({ job: serializeGenerationJob(job) });
  } catch (error) {
    return generationJobErrorResponse(error, "Không thể hủy yêu cầu tạo giáo án.");
  }
}
