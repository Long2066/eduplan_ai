import "server-only";
import { extractAiJsonValue } from "@/lib/ai-json";
import { assembleStagedLesson, type StagedAssemblyArtifact } from "@/lib/generation/assembly";
import type { StagedBlueprintArtifact } from "@/lib/generation/blueprint";
import { fetchAiJsonContent } from "@/lib/generation/ai-json-client";
import { sourceTruthPromptContext } from "@/lib/generation/source-truth";
import { validateStagedLesson } from "@/lib/generation/subject-validation";
import type { StagedPeriodArtifact } from "@/lib/generation/period-generation";
import { formatRepairFinding } from "@/lib/lesson-repair-policy";
import {
  buildMathPeriodRepairPrompt,
  buildNaturalSocialPeriodRepairPrompt,
  buildSubjectSystemRole,
  buildVietnamesePeriodRepairPrompt,
} from "@/lib/subject-prompts";
import type { PlanModelStrategy, SubscriptionPlan } from "@/lib/model-strategy";
import type {
  LessonInput,
  LessonActivity,
  LessonPlan,
  MathLessonBlueprint,
  NaturalSocialLessonBlueprint,
  PedagogyAuditFinding,
  PeriodPlan,
  VietnameseLessonBlueprint,
} from "@/types/lesson";

export type StagedRepairArtifact = StagedPeriodArtifact & {
  targetIndex: number;
  findingCodes: string[];
  findingCount: number;
};

type JsonObject = Record<string, unknown>;

function objectValue(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonObject
    : {};
}

function positiveInteger(value: unknown, fallback = 1) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue >= 1
    ? Math.floor(numericValue)
    : fallback;
}

function nonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.map(nonEmptyString).filter((item): item is string => Boolean(item))
    : [];
}

function blueprintValue(artifact: StagedBlueprintArtifact) {
  const blueprint = objectValue(artifact.blueprint);
  return {
    ...blueprint,
    ...(blueprint.classification || artifact.classification
      ? { classification: blueprint.classification || artifact.classification }
      : {}),
    ...(blueprint.sourceInventory || artifact.sourceInventory
      ? { sourceInventory: blueprint.sourceInventory || artifact.sourceInventory }
      : {}),
  };
}

function candidatePeriod(value: unknown, periodNumber: number) {
  const root = objectValue(value);
  const wrappedPeriod = objectValue(root.period);
  if (Object.keys(wrappedPeriod).length) return wrappedPeriod;
  const periods = Array.isArray(root.periodPlans) ? root.periodPlans.map(objectValue) : [];
  if (periods.length) {
    return periods.find((period) => positiveInteger(period.periodNumber, 0) === periodNumber)
      || periods[periodNumber - 1]
      || {};
  }
  return root;
}

function normalizeHandoff(value: unknown): PeriodPlan["handoff"] | null {
  const raw = objectValue(value);
  const learned = nonEmptyString(raw.learned);
  const unresolvedRisks = stringArray(raw.unresolvedRisks);
  const nextBridge = nonEmptyString(raw.nextBridge);
  if (!learned && !unresolvedRisks.length && !nextBridge) return null;
  return { learned, unresolvedRisks, nextBridge };
}

const activityBindingKeys = [
  "objectiveIds",
  "sourceTaskIds",
  "sourceVisualIds",
  "sourceUnitIds",
  "sourceClusterIds",
] as const satisfies ReadonlyArray<keyof LessonActivity>;

function mergeActivityBindings(current: LessonActivity | undefined, repaired: JsonObject) {
  if (!current) return repaired as LessonActivity;
  const merged = { ...current, ...repaired, id: current.id || nonEmptyString(repaired.id) } as LessonActivity;
  activityBindingKeys.forEach((key) => {
    const currentValues = stringArray(current[key]);
    const values = currentValues.length ? currentValues : stringArray(repaired[key]);
    if (values.length) Object.assign(merged, { [key]: values });
  });
  return merged;
}

function mergeRepairedActivities(rawActivities: unknown[], currentActivities: LessonActivity[]) {
  return rawActivities.map((value, index) => {
    const repaired = objectValue(value);
    const repairedId = nonEmptyString(repaired.id);
    const current = (repairedId
      ? currentActivities.find((activity) => activity.id === repairedId)
      : undefined) || currentActivities[index];
    return mergeActivityBindings(current, repaired);
  });
}

function normalizeRepairedPeriod(value: unknown, current: PeriodPlan) {
  const raw = candidatePeriod(value, current.periodNumber);
  const rawActivities = Array.isArray(raw.activities) ? raw.activities : [];
  if (!rawActivities.length) {
    throw new Error(`AI chưa trả đủ hoạt động sau khi sửa tiết ${current.periodNumber}. Vui lòng thử lại bước này.`);
  }
  const activities = mergeRepairedActivities(rawActivities, current.activities || []);
  const handoff = normalizeHandoff(raw.handoff) || normalizeHandoff(current.handoff);
  const period = {
    ...current,
    ...raw,
    periodNumber: current.periodNumber,
    focus: nonEmptyString(raw.focus) || current.focus,
    outcomes: objectValue(raw.outcomes) && Object.keys(objectValue(raw.outcomes)).length
      ? raw.outcomes as PeriodPlan["outcomes"]
      : current.outcomes,
    activities,
    handoff: handoff || undefined,
  } as PeriodPlan;
  return { period, handoff };
}

function defaultRepairPrompt(
  input: LessonInput,
  ocrText: string,
  period: PeriodPlan,
  findings: PedagogyAuditFinding[],
) {
  return `Sửa riêng PeriodPlan sau, không viết lại toàn bộ LessonPlan và không tạo các tiết khác.

Thông tin bài học:
${JSON.stringify({
    subject: input.subject,
    grade: input.grade,
    lessonTitle: input.lessonTitle,
    book: input.book,
    bookVolume: input.bookVolume,
    duration: input.duration,
    style: input.style,
    specialRequest: input.specialRequest,
  })}

Các lỗi bắt buộc sửa:
${findings.map(formatRepairFinding).map((finding) => `- ${finding}`).join("\n")}

Nguyên tắc:
- Chỉ trả JSON hợp lệ cho một PeriodPlan.
- Giữ periodNumber bằng ${period.periodNumber}, giữ trọng tâm và toàn bộ nội dung đúng đang có.
- Chỉ thay đổi nội dung cần thiết để xử lý các lỗi liệt kê.
- Tiết phải đủ Khởi động, Khám phá, Luyện tập, Vận dụng và dùng được khi dạy thật.
- teacherActions/studentActions phải theo cặp, bắt đầu bằng "GV ..." và "HS ...".
- Giữ sourceTaskIds/sourceVisualIds/sourceUnitIds/sourceClusterIds đang đúng.
- Cuối tiết giữ hoặc cập nhật handoff để không đứt mạch với tiết sau.
- Không dùng từ "OCR" trong nội dung giáo án.

PeriodPlan hiện tại:
${JSON.stringify(period)}

Nội dung ảnh SGK để đối chiếu khi cần:
${ocrText.slice(0, 10_000)}

Schema: { "periodNumber": number, "focus": string, "outcomes": object, "activities": array, "handoff": { "learned": string, "unresolvedRisks": string[], "nextBridge": string } }`;
}

export async function repairStagedPeriod(
  input: LessonInput,
  ocrText: string,
  blueprintArtifact: StagedBlueprintArtifact,
  currentPeriod: PeriodPlan,
  previousHandoff: PeriodPlan["handoff"] | null,
  findings: PedagogyAuditFinding[],
  targetIndex: number,
  strategy: PlanModelStrategy,
): Promise<StagedRepairArtifact> {
  if (!findings.length) {
    throw new Error(`Không tìm thấy lỗi cần sửa cho tiết ${currentPeriod.periodNumber}.`);
  }
  const blueprint = blueprintValue(blueprintArtifact);
  const groundedSourceText = sourceTruthPromptContext(blueprintArtifact.sourceTruth, ocrText);
  const issueMessages = findings.map(formatRepairFinding);
  let systemPrompt: string;
  let userPrompt: string;
  if (blueprintArtifact.subjectKind === "math") {
    systemPrompt = "Bạn chỉ trả JSON hợp lệ. Nhiệm vụ là sửa một PeriodPlan môn Toán, giữ mạch blueprint và không viết lại toàn bộ bài.";
    userPrompt = buildMathPeriodRepairPrompt(
      input,
      blueprint as MathLessonBlueprint,
      currentPeriod,
      issueMessages,
    );
  } else if (blueprintArtifact.subjectKind === "vietnamese") {
    systemPrompt = "Bạn chỉ trả JSON hợp lệ. Sửa riêng một PeriodPlan Tiếng Việt theo đúng kiểu bài; không viết lại toàn bộ bài và không nhồi thêm kĩ năng không liên quan.";
    userPrompt = buildVietnamesePeriodRepairPrompt(
      input,
      blueprint as VietnameseLessonBlueprint,
      currentPeriod,
      issueMessages,
    );
  } else if (blueprintArtifact.subjectKind === "natural-social") {
    systemPrompt = "Bạn chỉ trả JSON hợp lệ. Sửa riêng một PeriodPlan Tự nhiên và Xã hội theo mạch quan sát - bằng chứng - hành động; không viết lại toàn bộ bài.";
    userPrompt = buildNaturalSocialPeriodRepairPrompt(
      input,
      blueprint as NaturalSocialLessonBlueprint,
      currentPeriod,
      issueMessages,
    );
  } else {
    systemPrompt = buildSubjectSystemRole(input);
    userPrompt = defaultRepairPrompt(input, groundedSourceText, currentPeriod, findings);
  }
  userPrompt += `\n\nBàn giao hiệu lực từ tiết trước:\n${previousHandoff ? JSON.stringify(previousHandoff) : "Đây là tiết mở đầu hoặc không có bàn giao từ tiết trước."}\nGiữ mạch này khi sửa, không làm tiết hiện tại mâu thuẫn với kiến thức đã hoàn thành.\n\nNguồn chuẩn hóa để đối chiếu khi sửa:\n${groundedSourceText.slice(0, 10_000)}`;

  const result = await fetchAiJsonContent(strategy.repair, [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ]);
  const generated = extractAiJsonValue<PeriodPlan | { period: PeriodPlan } | LessonPlan>(result.content);
  const normalized = normalizeRepairedPeriod(generated, currentPeriod);
  return {
    subjectKind: blueprintArtifact.subjectKind,
    targetIndex: positiveInteger(targetIndex),
    periodNumber: currentPeriod.periodNumber,
    findingCodes: Array.from(new Set(findings.map((finding) => finding.code))),
    findingCount: findings.length,
    model: result.model,
    provider: result.provider,
    fallbackUsed: result.fallbackUsed,
    period: normalized.period,
    handoff: normalized.handoff,
  };
}

export function reassembleStagedRepairs(
  input: LessonInput,
  blueprint: StagedBlueprintArtifact,
  originalPeriods: StagedPeriodArtifact[],
  repairs: StagedRepairArtifact[],
  plan: SubscriptionPlan,
): StagedAssemblyArtifact {
  const originalNumbers = new Set(originalPeriods.map((artifact) => artifact.periodNumber));
  const repairedByPeriod = new Map<number, StagedRepairArtifact>();
  repairs.forEach((repair) => {
    if (!originalNumbers.has(repair.periodNumber)) {
      throw new Error(`Không thể áp dụng repair: không tìm thấy tiết gốc ${repair.periodNumber}.`);
    }
    if (repairedByPeriod.has(repair.periodNumber)) {
      throw new Error(`Không thể áp dụng repair: tiết ${repair.periodNumber} có nhiều kết quả sửa.`);
    }
    repairedByPeriod.set(repair.periodNumber, repair);
  });
  const effectivePeriods = originalPeriods.map((artifact) => repairedByPeriod.get(artifact.periodNumber) || artifact);
  const originalAssembly = assembleStagedLesson(input, blueprint, originalPeriods, plan, false);
  const repairedAssembly = assembleStagedLesson(input, blueprint, effectivePeriods, plan, true);
  const originalErrors = validateStagedLesson(input, originalAssembly, blueprint).summary.errors;
  const repairedErrors = validateStagedLesson(input, repairedAssembly, blueprint).summary.errors;
  return repairedErrors >= originalErrors ? originalAssembly : repairedAssembly;
}
