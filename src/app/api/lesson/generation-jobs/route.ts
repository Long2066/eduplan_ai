import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth-server";
import {
  stagedGenerationAccessDeniedResponse,
  generationJobErrorResponse,
  stagedGenerationDisabledResponse,
} from "@/lib/generation/job-http";
import {
  generationInputFingerprint,
  requireGenerationIdempotencyKey,
  validateGenerationJobInput,
} from "@/lib/generation/job-input";
import { generationSecurityContext } from "@/lib/security-context";
import {
  createStagedGenerationJob,
  serializeGenerationJob,
} from "@/lib/generation/job-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const disabledResponse = stagedGenerationDisabledResponse();
  if (disabledResponse) return disabledResponse;

  try {
    const user = await requireUser();
    const deniedResponse = stagedGenerationAccessDeniedResponse(user);
    if (deniedResponse) return deniedResponse;
    if (!user.emailVerified) {
      return NextResponse.json({
        error: "Bạn cần xác minh email trước khi tạo giáo án.",
        code: "EMAIL_NOT_VERIFIED",
      }, { status: 403 });
    }
    const idempotencyKey = requireGenerationIdempotencyKey(request.headers.get("idempotency-key"));
    const input = validateGenerationJobInput(await request.json());
    const security = generationSecurityContext(
      request,
      "staged",
      generationInputFingerprint(input),
    );
    const result = await createStagedGenerationJob(user, input, idempotencyKey, security);
    return NextResponse.json({
      job: serializeGenerationJob(result.job),
      created: result.created,
    }, { status: result.created ? 201 : 200 });
  } catch (error) {
    return generationJobErrorResponse(error, "Không thể tạo yêu cầu tạo giáo án.");
  }
}
