import "server-only";
import { extractAiJsonValue } from "@/lib/ai-json";
import { fetchAiJsonContent } from "@/lib/generation/ai-json-client";
import { makeStagedAnchor } from "@/lib/generation/section-validation";
import {
  STAGED_PHASE_LABELS,
  stagedActivityId,
  type GenerateStagedPhaseOptions,
  type RepairStagedPhaseOptions,
  type RepairStagedPhaseResult,
  type StagedPhaseArtifact,
  type StagedPhaseHandoff,
  type StagedPhaseInput,
} from "@/lib/generation/section-types";
import {
  learningContextGuidance,
  mathLatexPolicy,
  mathGradeBandGuidance,
  pedagogyProfileGuidance,
  vietnameseStrictGuidance,
  naturalSocialStrictGuidance,
} from "@/lib/subject-prompts";
import type { LessonActivity } from "@/types/lesson";

export async function generateStagedPhase(
  options: GenerateStagedPhaseOptions,
): Promise<StagedPhaseArtifact> {
  const { input, sourceFacts, outcomes, materials, periodBlueprint, phase, previousPhase, strategy } = options;
  const identity = sourceFacts.identity;
  const periodNumber = periodBlueprint.periodNumber;
  const activityId = stagedActivityId(periodNumber, phase);
  const phaseLabel = STAGED_PHASE_LABELS[phase];
  const phaseBp = periodBlueprint.periodBlueprint.phases.find((p) => p.phase === phase) || {
    phase,
    activityId,
    title: `${phaseLabel}: ${periodBlueprint.periodBlueprint.focus}`,
    durationMinutes: phase === "explore" ? 15 : phase === "practice" ? 10 : 5,
    objectiveIds: periodBlueprint.periodBlueprint.objectiveIds,
    learningProducts: ["Sản phẩm học tập của học sinh"],
    handoffToNext: "",
  };

  const phaseInput: StagedPhaseInput = {
    previousActivityId: previousPhase ? previousPhase.activity.id : null,
    previousHandoffHash: previousPhase ? previousPhase.anchor.hash : null,
    knowledge: previousPhase ? previousPhase.handoff.knowledge : [],
    products: previousPhase ? previousPhase.handoff.products : [],
    pending: previousPhase ? previousPhase.handoff.pending : [],
    bridge: previousPhase ? previousPhase.handoff.bridge : "Mở đầu tiết học.",
  };

  const subjectGuidance = sourceFacts.subjectKind === "math"
    ? `${mathLatexPolicy}\n${mathGradeBandGuidance(input)}`
    : sourceFacts.subjectKind === "vietnamese"
      ? vietnameseStrictGuidance
      : sourceFacts.subjectKind === "natural-social"
        ? naturalSocialStrictGuidance
        : pedagogyProfileGuidance(input);

  const prompt = `Soạn CHI TIẾT ĐƠN VỊ PHA: ${phaseLabel.toUpperCase()} (ID: "${activityId}").
Bài: "${identity.lessonTitle}" - Tiết ${periodNumber}/${identity.periods} - Thời lượng pha: ~${phaseBp.durationMinutes} phút.
Môn: ${input.subject} - Lớp: ${input.grade}.

NGỮ CẢNH BÀN GIAO TỪ PHA TRƯỚC:
${JSON.stringify(phaseInput)}

DỮ LIỆU ĐÃ KHÓA BẮT BUỘC TUÂN THỦ:
- YCCĐ phân bổ: ${JSON.stringify(outcomes.outcomes.objectiveMetadata.filter((o) => (phaseBp.objectiveIds || []).includes(o.id)).map((o) => ({ id: o.id, stmt: o.statement })))}
- Đồ dùng có sẵn (Mục II): ${JSON.stringify(materials.items.map((m) => ({ id: m.id, label: m.label })))}
- Dữ kiện SGK/Nguồn: ${JSON.stringify(sourceFacts.facts.sourceEvidence.map((s) => ({ id: s.id, label: s.label, text: s.text })))}

QUY TẮC SƯ PHẠM:
${subjectGuidance}
${learningContextGuidance(input)}

YÊU CẦU ĐẦU RA:
1. Chỉ trả về duy nhất hoạt động này, đầy đủ các bước thực tế (teacherActions, studentActions) dùng dạy thật trên lớp.
2. Gán các objectiveIds, materialIds ("mat-1",...), sourceIds ("src-1",...) THỰC TẾ được dùng trong pha này.
3. Sinh khối handoff: knowledge (kiến thức đã chốt), products (sản phẩm hoàn thành), pending (nhiệm vụ chuyển tiếp), bridge (câu nối sang pha sau).

Trả về duy nhất JSON:
{
  "activity": {
    "id": "${activityId}",
    "phase": "${phaseLabel}",
    "title": "${phaseBp.title}",
    "objective": string,
    "durationMinutes": ${phaseBp.durationMinutes},
    "teacherActions": string[],
    "studentActions": string[],
    "learningProducts": string[],
    "objectiveIds": string[],
    "organization": "whole_class"|"group"|"pair"|"individual"
  },
  "materialIds": string[],
  "sourceIds": string[],
  "handoff": {
    "activityId": "${activityId}",
    "knowledge": string[],
    "products": string[],
    "pending": string[],
    "bridge": string,
    "objectiveIds": string[],
    "sourceIds": string[],
    "materialIds": string[]
  }
}`;

  const res = await fetchAiJsonContent(strategy.detail, [
    { role: "system", content: "Bạn chỉ trả về JSON hoạt động dạy học của một pha duy nhất." },
    { role: "user", content: prompt },
  ]);

  const parsed = extractAiJsonValue<{
    activity: LessonActivity;
    materialIds: string[];
    sourceIds: string[];
    handoff: StagedPhaseHandoff;
  }>(res.content);

  const safeActivity = {
    ...parsed.activity,
    id: activityId,
    phase: phaseLabel,
    durationMinutes: (parsed.activity.durationMinutes && parsed.activity.durationMinutes > 0)
      ? parsed.activity.durationMinutes
      : phaseBp.durationMinutes,
    objectiveIds: parsed.activity.objectiveIds?.length ? parsed.activity.objectiveIds : phaseBp.objectiveIds,
    learningProducts: parsed.activity.learningProducts || phaseBp.learningProducts || [],
    successCriteria: (parsed.activity as any).successCriteria || [],
  };

  const payload = {
    activity: safeActivity,
    materialIds: parsed.materialIds || [],
    sourceIds: parsed.sourceIds || [],
    handoff: parsed.handoff || {
      activityId,
      knowledge: [],
      products: safeActivity.learningProducts,
      pending: [],
      bridge: `Chuyển tiếp sau pha ${phaseLabel}.`,
      objectiveIds: safeActivity.objectiveIds || [],
      sourceIds: parsed.sourceIds || [],
      materialIds: parsed.materialIds || [],
    },
  };

  const anchor = makeStagedAnchor(payload);
  return {
    version: 2,
    kind: "period-phase",
    subjectKind: sourceFacts.subjectKind,
    identity,
    anchor,
    dependencies: {
      outcomes: outcomes.anchor,
      materials: materials.anchor,
      periodBlueprint: periodBlueprint.anchor,
      ...(previousPhase ? { previousPhase: previousPhase.anchor } : {}),
    },
    model: res.model,
    provider: res.provider,
    fallbackUsed: res.fallbackUsed,
    periodNumber,
    phase,
    activity: payload.activity,
    materialIds: payload.materialIds,
    sourceIds: payload.sourceIds,
    input: phaseInput,
    handoff: payload.handoff,
  };
}

export async function repairStagedPhase(
  options: RepairStagedPhaseOptions,
): Promise<RepairStagedPhaseResult> {
  const { currentPhase, issues, input, sourceFacts, outcomes, materials, periodBlueprint, strategy } = options;
  if (!issues.length) {
    return { artifact: currentPhase, repaired: false, issues: [] };
  }

  const identity = sourceFacts.identity;
  const prompt = `SỬA ĐƠN VỊ PHA: ${currentPhase.phase} (ID: "${currentPhase.activity.id}").
Các vấn đề phát hiện từ bộ kiểm tra sư phạm:
${issues.map((i) => `- [${i.code}] ${i.message}`).join("\n")}

Dữ liệu pha hiện tại:
${JSON.stringify({
  activity: currentPhase.activity,
  materialIds: currentPhase.materialIds,
  sourceIds: currentPhase.sourceIds,
  handoff: currentPhase.handoff,
})}

Dữ liệu Mục I hợp lệ: ${JSON.stringify(outcomes.outcomes.objectiveMetadata.map((o) => o.id))}
Dữ liệu Mục II hợp lệ: ${JSON.stringify(materials.items.map((m) => m.id))}

Yêu cầu:
- Bổ sung/sửa đúng các lỗi trên (ví dụ gán đúng objectiveId hợp lệ từ Mục I, materialId từ Mục II, kiểm soát thời lượng).
- GIỮ LẠI các phần đã đạt chuẩn, không viết chung chung.
- Trả về JSON sửa hoàn chỉnh theo cấu trúc pha.`;

  try {
    const res = await fetchAiJsonContent(strategy.repair, [
      { role: "system", content: "Bạn chỉ trả về JSON sửa chữa cho hoạt động pha." },
      { role: "user", content: prompt },
    ]);

    const parsed = extractAiJsonValue<{
      activity: LessonActivity;
      materialIds: string[];
      sourceIds: string[];
      handoff: StagedPhaseHandoff;
    }>(res.content);

    const repairedActivity = {
      ...currentPhase.activity,
      ...(parsed.activity || {}),
      id: currentPhase.activity.id,
      phase: currentPhase.activity.phase,
      durationMinutes: (parsed.activity?.durationMinutes && parsed.activity.durationMinutes > 0)
        ? parsed.activity.durationMinutes
        : currentPhase.activity.durationMinutes,
      objectiveIds: parsed.activity?.objectiveIds?.length
        ? parsed.activity.objectiveIds
        : currentPhase.activity.objectiveIds,
      learningProducts: parsed.activity?.learningProducts || currentPhase.activity.learningProducts,
      successCriteria: (parsed.activity as any)?.successCriteria || currentPhase.activity.successCriteria,
    };

    const payload = {
      activity: repairedActivity,
      materialIds: parsed.materialIds || currentPhase.materialIds,
      sourceIds: parsed.sourceIds || currentPhase.sourceIds,
      handoff: parsed.handoff || currentPhase.handoff,
    };

    const anchor = makeStagedAnchor(payload, currentPhase.anchor.revision + 1);
    const artifact: StagedPhaseArtifact = {
      ...currentPhase,
      anchor,
      model: res.model,
      provider: res.provider,
      fallbackUsed: res.fallbackUsed,
      activity: payload.activity,
      materialIds: payload.materialIds,
      sourceIds: payload.sourceIds,
      handoff: payload.handoff,
    };
    return { artifact, repaired: true, issues: [] };
  } catch (err) {
    return { artifact: currentPhase, repaired: false, issues };
  }
}
