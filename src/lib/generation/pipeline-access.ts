import "server-only";
import {
  configuredGenerationPipelineMode,
  type GenerationPipelineMode,
} from "@/lib/generation/pipeline-mode";

export type GenerationPipelineIdentity = {
  uid: string;
  email?: string | null;
};

export type StagedGenerationAccess = {
  allowed: boolean;
  effectiveMode: GenerationPipelineMode;
  reason: "global_legacy" | "kill_switch" | "allowlist_empty" | "allowlisted" | "not_allowlisted";
};

function enabledFlag(value: string | undefined) {
  return ["1", "true", "yes", "on"].includes(value?.trim().toLowerCase() || "");
}

export function parseStagedGenerationAllowlist(value: string | undefined) {
  return Array.from(new Set(
    (value || "")
      .split(/[\s,;]+/)
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean),
  ));
}

export function resolveStagedGenerationAccess(
  identity: GenerationPipelineIdentity,
  options: {
    pipelineMode?: GenerationPipelineMode;
    killSwitch?: string;
    allowlist?: string;
  } = {},
): StagedGenerationAccess {
  const pipelineMode = options.pipelineMode || configuredGenerationPipelineMode();
  if (pipelineMode !== "staged") {
    return { allowed: false, effectiveMode: "legacy", reason: "global_legacy" };
  }
  if (enabledFlag(options.killSwitch)) {
    return { allowed: false, effectiveMode: "legacy", reason: "kill_switch" };
  }

  const allowlist = parseStagedGenerationAllowlist(options.allowlist);
  if (!allowlist.length) {
    return { allowed: false, effectiveMode: "legacy", reason: "allowlist_empty" };
  }
  const uid = identity.uid.trim().toLowerCase();
  const email = String(identity.email || "").trim().toLowerCase();
  const allowed = allowlist.includes("*")
    || allowlist.includes(uid)
    || Boolean(email && allowlist.includes(email));
  return allowed
    ? { allowed: true, effectiveMode: "staged", reason: "allowlisted" }
    : { allowed: false, effectiveMode: "legacy", reason: "not_allowlisted" };
}

export function configuredStagedGenerationAccess(identity: GenerationPipelineIdentity) {
  return resolveStagedGenerationAccess(identity, {
    pipelineMode: configuredGenerationPipelineMode(),
    killSwitch: process.env.GENERATION_STAGED_KILL_SWITCH,
    allowlist: process.env.GENERATION_STAGED_ALLOWLIST,
  });
}
