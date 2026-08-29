import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");

if (dryRun) {
  console.log("Staged smoke dry-run OK.");
  console.log("Sequence: create -> advance (serial) -> completed -> load lesson.");
  console.log("Live mode requires STAGED_SMOKE_TEST_CONFIRM=1, STAGED_SMOKE_BASE_URL, STAGED_SMOKE_COOKIE and STAGED_SMOKE_INPUT_FILE.");
  process.exit(0);
}

if (process.env.STAGED_SMOKE_TEST_CONFIRM !== "1") {
  throw new Error("Set STAGED_SMOKE_TEST_CONFIRM=1 to acknowledge that a live smoke test can consume AI quota.");
}

const baseUrl = String(process.env.STAGED_SMOKE_BASE_URL || "").replace(/\/+$/, "");
const sessionCookie = String(process.env.STAGED_SMOKE_COOKIE || "").trim();
const inputFile = String(process.env.STAGED_SMOKE_INPUT_FILE || "").trim();
if (!baseUrl || !sessionCookie || !inputFile) {
  throw new Error("Missing STAGED_SMOKE_BASE_URL, STAGED_SMOKE_COOKIE or STAGED_SMOKE_INPUT_FILE.");
}

const input = JSON.parse(await readFile(resolve(inputFile), "utf8"));
const idempotencyKey = String(process.env.STAGED_SMOKE_IDEMPOTENCY_KEY || randomUUID());
const headers = {
  "Content-Type": "application/json",
  "Idempotency-Key": idempotencyKey,
  Cookie: sessionCookie,
};

async function request(path, init = {}) {
  const response = await fetch(baseUrl + path, {
    ...init,
    headers: { ...headers, ...(init.headers || {}) },
  });
  const text = await response.text();
  let result = {};
  try {
    result = text ? JSON.parse(text) : {};
  } catch {
    throw new Error("Invalid response HTTP " + response.status + ": " + text.slice(0, 300));
  }
  if (!response.ok) {
    throw new Error((result.error || "Request failed") + " [" + (result.code || response.status) + "]");
  }
  return result;
}

const created = await request("/api/lesson/generation-jobs", {
  method: "POST",
  body: JSON.stringify(input),
});
let job = created.job;
console.log("Created job " + job.id + " at stage " + job.currentStage + ".");

for (let step = 1; step <= 100; step += 1) {
  if (job.status === "completed" || job.status === "failed" || job.status === "cancelled") break;
  const advanced = await request(
    "/api/lesson/generation-jobs/" + encodeURIComponent(job.id) + "/advance",
    { method: "POST" },
  );
  job = advanced.job;
  console.log(
    "Step " + step + ": " + job.currentStage + " | " + job.status + " | " + job.progress.percent + "%",
  );
}

if (job.status !== "completed" || !job.lessonId) {
  throw new Error("Smoke test ended without a completed lesson: " + JSON.stringify({
    status: job.status,
    stage: job.currentStage,
    error: job.error,
  }));
}

const lessonResult = await request("/api/lessons/" + encodeURIComponent(job.lessonId), {
  method: "GET",
});
if (!lessonResult.lesson?.generalInfo) {
  throw new Error("Completed lesson payload is missing generalInfo.");
}

console.log("Staged smoke test passed. Lesson ID: " + job.lessonId);
