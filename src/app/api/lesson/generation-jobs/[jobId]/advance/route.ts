import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth-server";
import {
  generationJobErrorResponse,
  stagedGenerationAccessDeniedResponse,
  stagedGenerationDisabledResponse,
} from "@/lib/generation/job-http";
import { serializeGenerationJob } from "@/lib/generation/job-service";
import { advanceStagedGenerationJob } from "@/lib/generation/step-executor";
import { validateGenerationOcrAsset } from "@/lib/generation/job-input";

export const runtime = "nodejs";
export const maxDuration = 300;

type RouteContext = { params: Promise<{ jobId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const disabledResponse = stagedGenerationDisabledResponse();
  if (disabledResponse) return disabledResponse;

  try {
    const user = await requireUser();
    const deniedResponse = stagedGenerationAccessDeniedResponse(user);
    if (deniedResponse) return deniedResponse;
    const { jobId } = await context.params;
    const requestText = await request.text();
    const requestBody = requestText ? JSON.parse(requestText) as { asset?: unknown } : null;
    const ocrAsset = requestBody?.asset === undefined
      ? undefined
      : validateGenerationOcrAsset(requestBody.asset);
    const job = await advanceStagedGenerationJob(user.uid, jobId, ocrAsset);
    return NextResponse.json({ job: serializeGenerationJob(job) });
  } catch (error) {
    return generationJobErrorResponse(error, "Không thể chạy bước tiếp theo của giáo án.");
  }
}
