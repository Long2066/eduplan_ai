import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth-server";
import { configuredStagedGenerationAccess } from "@/lib/generation/pipeline-access";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await requireUser();
    const access = configuredStagedGenerationAccess(user);
    return NextResponse.json({
      pipelineMode: access.effectiveMode,
      stagedAvailable: access.allowed,
    }, {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch (error) {
    const status = error instanceof Error && error.name === "UNAUTHENTICATED"
      ? 401
      : error instanceof Error && error.name === "ACCOUNT_DISABLED"
        ? 403
        : 500;
    return NextResponse.json({
      error: status === 500
        ? "Không thể tải cấu hình quy trình tạo giáo án."
        : error instanceof Error ? error.message : "Không thể tải cấu hình.",
    }, { status });
  }
}
