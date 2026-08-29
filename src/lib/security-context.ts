import "server-only";

import { createHash } from "node:crypto";
import { SECURITY_SCHEMA_VERSION, type GenerationPipeline, type GenerationSecurityContext } from "@shared/security-contract";

function firstForwardedIp(value: string | null) {
  return value?.split(",")[0]?.trim() || "";
}

export function clientIp(request: Request) {
  return firstForwardedIp(request.headers.get("x-forwarded-for"))
    || request.headers.get("cf-connecting-ip")?.trim()
    || request.headers.get("x-real-ip")?.trim()
    || "unknown";
}

export function hashClientIp(ip: string) {
  if (!ip || ip === "unknown") return "";
  const salt = process.env.IP_HASH_SALT || process.env.FIREBASE_PROJECT_ID || "eduplan-ip-policy";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}

export function requestIpHash(request: Request) {
  return hashClientIp(clientIp(request));
}

export function generationSecurityContext(
  request: Request,
  pipeline: GenerationPipeline,
  inputFingerprint: string,
): GenerationSecurityContext {
  return {
    schemaVersion: SECURITY_SCHEMA_VERSION,
    pipeline,
    ipHash: requestIpHash(request),
    inputFingerprint,
  };
}
