import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth-server";
import { configuredStagedGenerationAccess } from "@/lib/generation/pipeline-access";

import { STAGED_GENERATION_PIPELINE_VERSION } from "@/lib/generation/job-types";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await requireUser();
    const access = configuredStagedGenerationAccess(user);
    return NextResponse.json({
      pipelineMode: access.effectiveMode,
      stagedAvailable: access.allowed,
      pipelineVersion: STAGED_GENERATION_PIPELINE_VERSION,
      reason: access.reason,
    }, {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch (error) {
    const isUnauthenticated = error instanceof Error && error.name === "UNAUTHENTICATED";
    const isAccountDisabled = error instanceof Error && error.name === "ACCOUNT_DISABLED";
    const status = isUnauthenticated ? 401 : isAccountDisabled ? 403 : 500;
    const code = isUnauthenticated
      ? "UNAUTHENTICATED"
      : isAccountDisabled
        ? "ACCOUNT_DISABLED"
        : "GENERATION_CONFIG_ERROR";
    const retryable = status >= 500;
    return NextResponse.json({
      error: status === 500
        ? "Không thể tải cấu hình quy trình tạo giáo án."
        : error instanceof Error ? error.message : "Không thể tải cấu hình.",
      code,
      retryable,
    }, {
      status,
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  }
}
