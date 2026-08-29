import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth-server";
import {
  generationJobErrorResponse,
  stagedGenerationAccessDeniedResponse,
  stagedGenerationDisabledResponse,
} from "@/lib/generation/job-http";
import {
  getStagedGenerationJob,
  serializeGenerationJob,
} from "@/lib/generation/job-service";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ jobId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const disabledResponse = stagedGenerationDisabledResponse();
  if (disabledResponse) return disabledResponse;

  try {
    const user = await requireUser();
    const deniedResponse = stagedGenerationAccessDeniedResponse(user);
    if (deniedResponse) return deniedResponse;
    const { jobId } = await context.params;
    const job = await getStagedGenerationJob(user.uid, jobId);
    return NextResponse.json({ job: serializeGenerationJob(job) });
  } catch (error) {
    return generationJobErrorResponse(error, "Không thể tải trạng thái tạo giáo án.");
  }
}
