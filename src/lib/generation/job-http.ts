import "server-only";
import { NextResponse } from "next/server";
import { configuredGenerationPipelineMode } from "@/lib/generation/pipeline-mode";
import { GenerationJobRequestError } from "@/lib/generation/job-input";
import { GenerationJobConflictError } from "@/lib/generation/job-store";
import {
  configuredStagedGenerationAccess,
  type GenerationPipelineIdentity,
} from "@/lib/generation/pipeline-access";
import { subscriptionErrorResponse } from "@/lib/subscription-policy";

export function stagedGenerationDisabledResponse() {
  if (configuredGenerationPipelineMode() === "staged") return null;
  return NextResponse.json({
    error: "Quy trình tạo giáo án nhiều bước chưa được bật.",
    code: "STAGED_PIPELINE_DISABLED",
  }, { status: 409 });
}

export function stagedGenerationAccessDeniedResponse(identity: GenerationPipelineIdentity) {
  const access = configuredStagedGenerationAccess(identity);
  if (access.allowed) return null;
  return NextResponse.json({
    error: "Tài khoản này chưa được bật thử nghiệm quy trình tạo giáo án nhiều bước.",
    code: "STAGED_PIPELINE_NOT_ALLOWED",
    pipelineMode: "legacy",
  }, { status: 403 });
}

export function generationJobErrorResponse(error: unknown, fallbackMessage: string) {
  if (error instanceof GenerationJobRequestError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }
  if (error instanceof GenerationJobConflictError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: 409 });
  }
  const policyError = subscriptionErrorResponse(error);
  if (policyError) return NextResponse.json(policyError.body, { status: policyError.status });
  if (error instanceof SyntaxError) {
    return NextResponse.json({ error: "Dữ liệu JSON không hợp lệ.", code: "INVALID_JSON" }, { status: 400 });
  }
  const status = error instanceof Error && error.name === "UNAUTHENTICATED"
    ? 401
    : error instanceof Error && error.name === "ACCOUNT_DISABLED"
      ? 403
      : 500;
  return NextResponse.json({
    error: status === 500 ? fallbackMessage : error instanceof Error ? error.message : fallbackMessage,
  }, { status });
}
