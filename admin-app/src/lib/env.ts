import "server-only";
import { existsSync, readFileSync } from "fs";
import { join } from "path";

let loaded = false;

function parseEnvLine(line: string) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return;
  const index = trimmed.indexOf("=");
  if (index === -1) return;
  const key = trimmed.slice(0, index).trim();
  let value = trimmed.slice(index + 1);
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  process.env[key] ||= value.replace(/\\n/g, "\n");
}

export function loadSharedEnv() {
  if (loaded) return;
  loaded = true;
  const sharedEnvPath = join(process.cwd(), "..", ".env.local");
  if (!existsSync(sharedEnvPath)) return;
  const content = readFileSync(sharedEnvPath, "utf8");
  for (const line of content.split(/\r?\n/)) parseEnvLine(line);
}
