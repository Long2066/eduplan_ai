import "server-only";
import { extractAiJsonValue } from "@/lib/ai-json";
import { fetchAiJsonContent } from "@/lib/generation/ai-json-client";
import { generationSubjectKind } from "@/lib/generation/subject-routing";
import { sourceTruthPromptContext } from "@/lib/generation/source-truth";
import { stagedArtifactAnchor } from "@/lib/generation/section-validation";
import {
  STAGED_PHASES,
  STAGED_PHASE_LABELS,
  stagedActivityId,
  type GenerateStagedAssessmentOptions,
  type GenerateStagedLessonMapOptions,
  type GenerateStagedMaterialsOptions,
  type GenerateStagedOutcomesOptions,
  type GenerateStagedPeriodBlueprintOptions,
  type GenerateStagedSourceFactsOptions,
  type StagedAssessmentArtifact,
  type StagedCompactPeriodBlueprint,
  type StagedLessonMap,
  type StagedLessonMapArtifact,
  type StagedMaterial,
  type StagedMaterialsArtifact,
  type StagedOutcomesArtifact,
  type StagedPeriodBlueprintArtifact,
  type StagedPhaseName,
  type StagedSourceEvidence,
  type StagedSourceFacts,
  type StagedSourceFactsArtifact,
  type StagedSourceIdentity,
} from "@/lib/generation/section-types";
import { resolveLessonTitle, requireResolvedLessonTitle } from "@/lib/lesson-title";
import { sanitizeMaterials, sanitizeMaterialItem } from "@/lib/lesson-format";
import { ensureDigitalCompetencyOutcomes } from "@/lib/digital-competency";
import {
  buildSubjectSystemRole,
  bookContext,
  digitalCompetencyInstruction,
  learningContextGuidance,
  mathGradeBandGuidance,
  pedagogyProfileGuidance,
  vietnameseStrictGuidance,
  vietnameseLessonTypeGuidance,
  naturalSocialStrictGuidance,
  naturalSocialLessonTypeGuidance,
} from "@/lib/subject-prompts";
import { classifyVietnameseLesson } from "@/lib/vietnamese-pedagogy";
import { classifyNaturalSocialLesson } from "@/lib/natural-social-pedagogy";
import type {
  LessonInput,
  LessonOutcomes,
  LessonPlan,
  VietnameseLessonClassification,
  NaturalSocialClassification,
} from "@/types/lesson";

function cleanIdentity(input: LessonInput, lockedTitle: string, sourceHashes: string[]): StagedSourceIdentity {
  return {
    subject: input.subject,
    grade: input.grade,
    lessonTitle: lockedTitle,
    periods: Math.max(1, Number(input.periods || 1)),
    duration: Number(input.duration || 35),
    sourceHashes,
  };
}

export async function generateStagedSourceFacts(
  options: GenerateStagedSourceFactsOptions,
): Promise<StagedSourceFactsArtifact> {
  const { input, ocrText, sourceContext, strategy } = options;
  const subjectKind = generationSubjectKind(input);
  const sourceTruth = sourceContext.sourceTruth;
  const initialResolution = resolveLessonTitle({
    subject: input.subject,
    ocrText,
    candidates: [
      { value: sourceTruth?.lessonTitle, source: "source-truth", confidence: sourceTruth?.lessonIdentity?.confidence || 0.95 },
      { value: input.lessonTitle, source: "user-input", confidence: 0.95 },
    ],
  });
  const promptTitleHint = initialResolution.status === "resolved"
    ? `cho bài học "${initialResolution.title}"`
    : `(xác định chính xác tên bài học từ dữ liệu nguồn SGK/OCR bên dưới và điền vào "lessonTitle")`;
  const promptContext = sourceTruthPromptContext(sourceTruth, ocrText);

  const prompt = `Bạn là chuyên gia sư phạm tiểu học.
Nhiệm vụ: Trích xuất và khóa dữ kiện nguồn SGK/OCR ${promptTitleHint}.
Lưu ý:
- KHÔNG soạn giáo án hay hoạt động chi tiết ở bước này.
- Nếu tên bài chưa được khóa sẵn, hãy trích xuất đúng tiêu đề bài học từ trang SGK/OCR (ví dụ: "Bài 24. Tính chất giao hoán và kết hợp của phép cộng") vào trường "lessonTitle"; tuyệt đối không đặt tên chung chung như "Bài học Toán".
- Trích xuất danh sách nguồn: các bài tập, nhiệm vụ đọc/viết/tính/quan sát (sourceEvidence) và gán ID dạng "src-1", "src-2",...
- Ghi nhận đầy đủ số trang nếu có trong OCR.
- Nếu không có OCR, dựa trên form người dùng và kiến thức chuẩn CTGDPT 2018 để suy luận dữ kiện cốt lõi, đánh dấu kind="inference".
${pedagogyProfileGuidance(input)}

DỮ LIỆU NGUỒN:
${promptContext}

Trả về duy nhất JSON:
{
  "lessonTitle": ${initialResolution.status === "resolved" ? JSON.stringify(initialResolution.title) : "string"},
  "coreContent": string[],
  "objectivesFromSource": string[],
  "sourceEvidence": [
    { "id": "src-1", "kind": "task"|"visual"|"text"|"inference", "label": string, "text": string, "page": string, "required": boolean, "allowReuse": boolean }
  ],
  "uncertainties": string[],
  "conflicts": string[],
  "fatalIssues": string[]
}`;

  const res = await fetchAiJsonContent(strategy.blueprint, [
    { role: "system", content: "Bạn chỉ trả về JSON hợp lệ trích xuất sự thật nguồn SGK." },
    { role: "user", content: prompt },
  ]);
  const parsed = extractAiJsonValue<StagedSourceFacts>(res.content);
  const finalResolution = resolveLessonTitle({
    subject: input.subject,
    ocrText,
    candidates: [
      { value: sourceTruth?.lessonTitle, source: "source-truth", confidence: sourceTruth?.lessonIdentity?.confidence || 0.95 },
      { value: input.lessonTitle, source: "user-input", confidence: 0.95 },
      ...(ocrText.trim().length > 0 && parsed?.lessonTitle
        ? [{ value: parsed.lessonTitle, source: "source-facts" as const, confidence: 0.9 }]
        : []),
    ],
  });
  const lockedTitle = requireResolvedLessonTitle(finalResolution);
  const identity = cleanIdentity(input, lockedTitle, sourceContext.ocrSourceHashes);
  parsed.lessonTitle = lockedTitle;
  if (!parsed.sourceEvidence?.length) {
    parsed.sourceEvidence = [{
      id: "src-1",
      kind: "inference",
      label: `Nội dung trọng tâm ${lockedTitle}`,
      text: (parsed.coreContent || []).join("; ") || lockedTitle,
      page: "",
      required: true,
      allowReuse: true,
    }];
  }

  const artifact: StagedSourceFactsArtifact = {
    version: 2,
    kind: "source-facts",
    subjectKind,
    identity,
    anchor: { revision: 1, hash: "" },
    dependencies: {},
    model: res.model,
    provider: res.provider,
    fallbackUsed: res.fallbackUsed,
    sourceTruth,
    promptSource: ocrText ? "ocr" : "input-only",
    classification: subjectKind === "vietnamese"
      ? classifyVietnameseLesson(input, ocrText || (parsed.coreContent || []).join(" "))
      : subjectKind === "natural-social"
        ? classifyNaturalSocialLesson(input, ocrText || (parsed.coreContent || []).join(" "))
        : undefined,
    sourceInventory: sourceContext.vietnamese?.inventory || (sourceContext.naturalSocial?.inventory as any),
    facts: parsed,
  };
  artifact.anchor = stagedArtifactAnchor(artifact);
  return artifact;
}

export async function generateStagedOutcomes(
  options: GenerateStagedOutcomesOptions,
): Promise<StagedOutcomesArtifact> {
  const { input, sourceFacts, strategy } = options;
  const identity = sourceFacts.identity;
  const digitalBlock = digitalCompetencyInstruction(input);
  const prompt = `Soạn MỤC I. YÊU CẦU CẦN ĐẠT cho bài học: "${identity.lessonTitle}".
Môn: ${input.subject}, Khối lớp: ${input.grade}, Số tiết: ${identity.periods}, Bộ sách: ${bookContext(input)}.
Bám sát Chương trình GDPT 2018 và dữ kiện nguồn đã khóa:
${JSON.stringify(sourceFacts.facts.sourceEvidence)}
${digitalBlock}

Yêu cầu:
1. Đầy đủ: Năng lực đặc thù, Năng lực chung, Phẩm chất, Kiến thức và kĩ năng${input.enableDigitalCompetency ? ", Năng lực số (digitalCompetencies)" : ""}.
2. BẮT BUỘC: Mỗi YCCĐ cụ thể phải có một mục trong objectiveMetadata với id duy nhất cố định: "obj-1", "obj-2",...${input.enableDigitalCompetency ? ' (bao gồm cả mục tiêu thuộc category "digitalCompetencies")' : ""}
3. Các ID này sẽ được khóa chặt và làm gốc neo cho toàn bộ các pha dạy học sau.

Trả về duy nhất JSON:
{
  "generalCompetencies": string[],
  "specificCompetencies": string[],
  "qualities": string[],
  "knowledgeAndSkills": string[],
  "digitalCompetencies": string[],
  "objectiveMetadata": [
    {
      "id": "obj-1",
      "category": "specificCompetencies"|"generalCompetencies"|"qualities"|"knowledgeAndSkills"|"digitalCompetencies",
      "statement": string,
      "evidence": { "activityIds": [], "learningProducts": [], "successCriteria": [] }
    }
  ]
}`;

  const res = await fetchAiJsonContent(strategy.blueprint, [
    { role: "system", content: "Bạn chỉ trả về JSON Yêu cầu cần đạt chuẩn CV 2345 và CTGDPT 2018." },
    { role: "user", content: prompt },
  ]);
  const rawParsed = extractAiJsonValue<LessonOutcomes & { objectiveMetadata: NonNullable<LessonOutcomes["objectiveMetadata"]> }>(res.content);
  const parsed = ensureDigitalCompetencyOutcomes(
    input,
    rawParsed,
    identity.lessonTitle,
  ) as LessonOutcomes & { objectiveMetadata: NonNullable<LessonOutcomes["objectiveMetadata"]> };

  if (!parsed.objectiveMetadata?.length) {
    const defaultObjs = (parsed.specificCompetencies || []).concat(parsed.knowledgeAndSkills || []);
    parsed.objectiveMetadata = defaultObjs.map((stmt, idx) => ({
      id: `obj-${idx + 1}`,
      category: "specificCompetencies",
      statement: stmt,
      evidence: { activityIds: [], learningProducts: [], successCriteria: [] },
    }));
  }
  if (!parsed.objectiveMetadata.length) {
    parsed.objectiveMetadata = [{
      id: "obj-1",
      category: "specificCompetencies",
      statement: `Học sinh nắm vững kiến thức bài ${identity.lessonTitle}`,
      evidence: { activityIds: [], learningProducts: [], successCriteria: [] },
    }];
  }

  if (input.enableDigitalCompetency && parsed.digitalCompetencies?.length) {
    const hasDigitalMeta = parsed.objectiveMetadata.some((obj) => obj.category === "digitalCompetencies");
    if (!hasDigitalMeta) {
      for (const digitalStmt of parsed.digitalCompetencies) {
        parsed.objectiveMetadata.push({
          id: `obj-${parsed.objectiveMetadata.length + 1}`,
          category: "digitalCompetencies",
          statement: digitalStmt,
          evidence: { activityIds: [], learningProducts: [], successCriteria: [] },
        });
      }
    }
  } else if (!input.enableDigitalCompetency) {
    parsed.objectiveMetadata = parsed.objectiveMetadata.filter((obj) => obj.category !== "digitalCompetencies");
  }

  // Ensure every item has a normalized evidence structure
  parsed.objectiveMetadata = parsed.objectiveMetadata.map((obj, idx) => ({
    id: obj.id || `obj-${idx + 1}`,
    category: obj.category || "specificCompetencies",
    statement: obj.statement || `Yêu cầu cần đạt ${idx + 1}`,
    evidence: {
      activityIds: Array.isArray(obj.evidence?.activityIds) ? obj.evidence.activityIds : [],
      learningProducts: Array.isArray(obj.evidence?.learningProducts) ? obj.evidence.learningProducts : [],
      successCriteria: Array.isArray(obj.evidence?.successCriteria) ? obj.evidence.successCriteria : [],
    },
  }));

  const artifact: StagedOutcomesArtifact = {
    version: 2,
    kind: "section-outcomes",
    subjectKind: sourceFacts.subjectKind,
    identity,
    anchor: { revision: 1, hash: "" },
    dependencies: { source: sourceFacts.anchor },
    model: res.model,
    provider: res.provider,
    fallbackUsed: res.fallbackUsed,
    outcomes: parsed,
  };
  artifact.anchor = stagedArtifactAnchor(artifact);
  return artifact;
}

export async function generateStagedLessonMap(
  options: GenerateStagedLessonMapOptions,
): Promise<StagedLessonMapArtifact> {
  const { input, sourceFacts, outcomes, strategy } = options;
  const identity = sourceFacts.identity;
  const feedbackInstruction = options.feedback
    ? `\nPHẢN HỒI CẦN SỬA ĐỔI TỪ LẦN TRƯỚC:\n${options.feedback}\nBẮT BUỘC: Sửa triệt để các lỗi trên, phân bổ đủ mọi YCCĐ còn thiếu vào đúng các tiết phù hợp. Tuyệt đối KHÔNG bỏ sót bất kỳ mục tiêu nào.`
    : "";

  const prompt = `Lập BẢN ĐỒ TIẾN TRÌNH BÀI HỌC (Lesson Map) cho: "${identity.lessonTitle}".
Tổng số tiết: ${identity.periods}.
Dữ kiện nguồn đã khóa:
${JSON.stringify(sourceFacts.facts.sourceEvidence)}
Yêu cầu cần đạt đã khóa:
${JSON.stringify(outcomes.outcomes.objectiveMetadata.map((o) => ({ id: o.id, statement: o.statement, category: o.category })))}

Nhiệm vụ:
- BẮT BUỘC: Phân bổ TẤT CẢ 100% objectiveId ("obj-1",...) trong Yêu cầu cần đạt đã khóa vào các tiết (từ tiết 1 đến ${identity.periods}). Tuyệt đối KHÔNG bỏ sót bất kỳ mục tiêu nào (kể cả Phẩm chất (qualities) và năng lực chung).
- Mỗi tiết phải có trọng tâm, continuityIn, continuityOut.
- Phân bổ sourceIds đã có ("src-1",...) cho từng tiết.
- BẮT BUỘC thiết lập kế hoạch liên kết mạch bài học (continuityPlan):
  + "sourceUnits": Lập danh sách các đơn vị nguồn tương ứng với sourceEvidence đã khóa. Mỗi đơn vị có "unitId" khớp chính xác với "src-..." đã có, "label", "required" (true/false), "allowReuse" (true/false), "preferredPeriodNumber" (1..${identity.periods}).
  + "clusters": Gom nhóm các sourceUnits theo mạch học tập. Mỗi cụm có "clusterId" (ví dụ "cluster-1"), "label", "sourceUnitIds" (bắt buộc là mảng string các unitId, không được để trống), "periodNumber" (1..${identity.periods}), "estimatedMinutes" (khoảng 10-25 phút, tổng trong tiết không vượt ${identity.duration} phút).${feedbackInstruction}

Trả về duy nhất JSON:
{
  "lessonTitle": "${identity.lessonTitle}",
  "lessonOverview": string,
  "logicSpine": string[],
  "sourceAllocation": [{ "sourceId": string, "periodNumber": number, "purpose": string, "allowReuse": boolean }],
  "continuityPlan": {
    "sourceUnits": [
      { "unitId": "src-1", "label": string, "required": boolean, "allowReuse": boolean, "preferredPeriodNumber": number }
    ],
    "clusters": [
      { "clusterId": "cluster-1", "label": string, "sourceUnitIds": ["src-1"], "periodNumber": number, "estimatedMinutes": number }
    ]
  },
  "periods": [
    {
      "periodNumber": number,
      "focus": string,
      "objectiveIds": string[],
      "sourceIds": string[],
      "targetKnowledge": string,
      "continuityIn": string,
      "continuityOut": string,
      "assessmentEvidence": string[]
    }
  ],
  "risks": string[]
}`;

  const res = await fetchAiJsonContent(strategy.blueprint, [
    { role: "system", content: "Bạn chỉ trả về JSON phân bổ tiến trình bài học." },
    { role: "user", content: prompt },
  ]);
  const parsed = extractAiJsonValue<StagedLessonMap>(res.content);
  parsed.lessonTitle = identity.lessonTitle;
  const validObjIds = outcomes.outcomes.objectiveMetadata.map((o) => o.id);
  const validObjSet = new Set(validObjIds);
  const validSrcSet = new Set(sourceFacts.facts.sourceEvidence.map((s) => s.id));

  if (!Array.isArray(parsed.periods) || parsed.periods.length !== identity.periods) {
    parsed.periods = Array.from({ length: identity.periods }, (_, i) => ({
      periodNumber: i + 1,
      focus: parsed.periods?.[i]?.focus?.trim() || `Tiết ${i + 1}: ${identity.lessonTitle}`,
      objectiveIds: parsed.periods?.[i]?.objectiveIds || [],
      sourceIds: parsed.periods?.[i]?.sourceIds || [],
      targetKnowledge: parsed.periods?.[i]?.targetKnowledge || "",
      continuityIn: parsed.periods?.[i]?.continuityIn || "",
      continuityOut: parsed.periods?.[i]?.continuityOut || "",
      assessmentEvidence: parsed.periods?.[i]?.assessmentEvidence || [],
    }));
  }
  const coveredInMap = new Set<string>();
  parsed.periods.forEach((p, idx) => {
    p.periodNumber = idx + 1;
    if (!p.focus || !p.focus.trim()) p.focus = `Tiết ${idx + 1}: ${identity.lessonTitle}`;
    p.objectiveIds = (Array.isArray(p.objectiveIds) ? p.objectiveIds : [])
      .filter((id) => typeof id === "string" && validObjSet.has(id));
    if (p.objectiveIds.length === 0 && validObjIds.length > 0) {
      p.objectiveIds = [validObjIds[idx % validObjIds.length]];
    }
    p.objectiveIds.forEach((id) => coveredInMap.add(id));
    p.sourceIds = (Array.isArray(p.sourceIds) ? p.sourceIds : [])
      .filter((id) => typeof id === "string" && validSrcSet.has(id));
  });
  for (const objId of validObjIds) {
    if (!coveredInMap.has(objId) && parsed.periods.length > 0) {
      parsed.periods[parsed.periods.length - 1].objectiveIds.push(objId);
    }
  }
  if (Array.isArray(parsed.sourceAllocation)) {
    parsed.sourceAllocation = parsed.sourceAllocation
      .filter((a) => a && typeof a === "object" && validSrcSet.has(a.sourceId))
      .map((a) => ({
        ...a,
        periodNumber: Math.min(identity.periods, Math.max(1, Number(a.periodNumber) || 1)),
      }));
  }

  if (!parsed.continuityPlan || typeof parsed.continuityPlan !== "object") {
    parsed.continuityPlan = { sourceUnits: [], clusters: [] };
  }
  if (!Array.isArray(parsed.continuityPlan.sourceUnits)) parsed.continuityPlan.sourceUnits = [];
  parsed.continuityPlan.sourceUnits = parsed.continuityPlan.sourceUnits
    .filter((u) => u && typeof u === "object" && typeof u.unitId === "string" && validSrcSet.has(u.unitId));
  const existingUnitIds = new Set(parsed.continuityPlan.sourceUnits.map((u) => u.unitId));
  for (const [srcIdx, src] of (sourceFacts.facts.sourceEvidence || []).entries()) {
    if (src?.id && !existingUnitIds.has(src.id)) {
      parsed.continuityPlan.sourceUnits.push({
        unitId: src.id,
        label: src.label || src.id,
        kind: src.kind || "task",
        page: src.page || undefined,
        required: src.required !== false,
        allowReuse: src.allowReuse === true || identity.periods > 1,
        preferredPeriodNumber: (srcIdx % identity.periods) + 1,
      });
      existingUnitIds.add(src.id);
    }
  }
  const unitSet = new Set(parsed.continuityPlan.sourceUnits.map((u) => u.unitId));
  if (!Array.isArray(parsed.continuityPlan.clusters)) parsed.continuityPlan.clusters = [];
  parsed.continuityPlan.clusters = parsed.continuityPlan.clusters
    .filter((c) => c && typeof c === "object" && typeof c.clusterId === "string" && c.clusterId.trim())
    .map((c) => ({
      ...c,
      sourceUnitIds: (Array.isArray(c.sourceUnitIds) ? c.sourceUnitIds : [])
        .filter((uId) => typeof uId === "string" && (unitSet.size === 0 || unitSet.has(uId))),
      periodNumber: Math.min(identity.periods, Math.max(1, Number(c.periodNumber) || 1)),
    }))
    .filter((c) => c.sourceUnitIds.length > 0);

  const clusteredUnits = new Map<string, number>();
  for (const cluster of parsed.continuityPlan.clusters) {
    for (const uId of cluster.sourceUnitIds) {
      clusteredUnits.set(uId, (clusteredUnits.get(uId) || 0) + 1);
    }
  }
  for (const [uIdx, unit] of parsed.continuityPlan.sourceUnits.entries()) {
    const count = clusteredUnits.get(unit.unitId) || 0;
    if (unit.required !== false && count === 0) {
      const targetPeriod = Math.min(identity.periods, Math.max(1, Number(unit.preferredPeriodNumber) || ((uIdx % identity.periods) + 1)));
      parsed.continuityPlan.clusters.push({
        clusterId: `cluster-auto-${unit.unitId}`,
        label: unit.label || unit.unitId,
        sourceUnitIds: [unit.unitId],
        periodNumber: targetPeriod,
        mustStayTogether: true,
        estimatedMinutes: 12,
      });
      clusteredUnits.set(unit.unitId, 1);
    } else if (count > 1 || identity.periods > 1) {
      unit.allowReuse = true;
    }
  }

  const artifact: StagedLessonMapArtifact = {
    version: 2,
    kind: "lesson-map",
    subjectKind: sourceFacts.subjectKind,
    identity,
    anchor: { revision: 1, hash: "" },
    dependencies: { source: sourceFacts.anchor, outcomes: outcomes.anchor },
    model: res.model,
    provider: res.provider,
    fallbackUsed: res.fallbackUsed,
    lessonMap: parsed,
  };
  artifact.anchor = stagedArtifactAnchor(artifact);
  return artifact;
}

export async function generateStagedPeriodBlueprint(
  options: GenerateStagedPeriodBlueprintOptions,
): Promise<StagedPeriodBlueprintArtifact> {
  const { input, sourceFacts, outcomes, lessonMap, periodNumber, strategy } = options;
  const identity = sourceFacts.identity;
  const periodMap = lessonMap.lessonMap.periods.find((p) => p.periodNumber === periodNumber)
    || { periodNumber, focus: `Tiết ${periodNumber}`, objectiveIds: outcomes.outcomes.objectiveMetadata.map((o) => o.id), sourceIds: [] };

  const allocatedObjs = outcomes.outcomes.objectiveMetadata.filter((o) => (periodMap.objectiveIds || []).includes(o.id));
  const allocatedClusters = (lessonMap.lessonMap.continuityPlan?.clusters || [])
    .filter((c) => c.periodNumber === periodNumber);
  const feedbackInstruction = options.feedback
    ? `\nPHẢN HỒI CẦN SỬA ĐỔI TỪ LẦN TRƯỚC:\n${options.feedback}\nBẮT BUỘC: Sửa triệt để các lỗi trên, phân bổ đủ mọi mục tiêu của tiết vào các pha tương ứng. Tuyệt đối KHÔNG bỏ sót bất kỳ mục tiêu nào.`
    : "";

  const defaultLessonType = sourceFacts.subjectKind === "vietnamese"
    ? ((sourceFacts.classification as VietnameseLessonClassification)?.primaryType || "phonics")
    : sourceFacts.subjectKind === "natural-social"
      ? ((sourceFacts.classification as NaturalSocialClassification)?.primaryType || "mixed")
      : "standard";

  const prompt = `Lập BLUEPRINT CHI TIẾT 4 PHA CHO TIẾT ${periodNumber}/${identity.periods} bài "${identity.lessonTitle}".
Trọng tâm tiết: ${periodMap.focus}.
YCCĐ phân bổ cho tiết này (kèm nội dung chi tiết):
${JSON.stringify(allocatedObjs.map((o) => ({ id: o.id, statement: o.statement, category: o.category })))}
Dữ kiện nguồn phân bổ: ${JSON.stringify(periodMap.sourceIds)}.
Cụm học tập phân bổ cho tiết này: ${JSON.stringify(allocatedClusters.map((c) => ({ id: c.clusterId, label: c.label, sourceUnitIds: c.sourceUnitIds })))}.

Yêu cầu:
- Thiết kế khung gọn gàng cho 4 pha bắt buộc: warmup, explore, practice, apply.
- BẮT BUỘC: hợp objectiveIds của 4 pha phải bao phủ 100% mọi YCCĐ của tiết này (${JSON.stringify(periodMap.objectiveIds)}). Tuyệt đối KHÔNG bỏ sót bất kỳ mục tiêu nào.
- Với mỗi pha, xác định: activityId (p${periodNumber}-warmup, p${periodNumber}-explore, p${periodNumber}-practice, p${periodNumber}-apply), title, durationMinutes (tổng 4 pha xấp xỉ ${identity.duration} phút), objectiveIds liên quan, sourceIds, sourceUnitIds, sourceClusterIds, handoffToNext.${feedbackInstruction}

Trả về duy nhất JSON:
{
  "periodNumber": ${periodNumber},
  "focus": "${periodMap.focus}",
  "lessonType": "${defaultLessonType}",
  "objectiveIds": ${JSON.stringify(periodMap.objectiveIds)},
  "targetKnowledge": string,
  "continuityIn": string,
  "continuityOut": string,
  "teachingNotes": string[],
  "phases": [
    {
      "phase": "warmup"|"explore"|"practice"|"apply",
      "activityId": "p${periodNumber}-warmup",
      "title": string,
      "objectiveIds": string[],
      "sourceIds": string[],
      "sourceUnitIds": string[],
      "sourceClusterIds": string[],
      "durationMinutes": number,
      "learningProducts": string[],
      "handoffToNext": string,
      "pedagogyFocus": string
    }
  ]
}`;

  const res = await fetchAiJsonContent(strategy.blueprint, [
    { role: "system", content: "Bạn chỉ trả về JSON blueprint 4 pha cho một tiết dạy." },
    { role: "user", content: prompt },
  ]);
  const parsed = extractAiJsonValue<StagedCompactPeriodBlueprint>(res.content);
  parsed.periodNumber = periodNumber;
  const expectedPeriodObjIds = (periodMap.objectiveIds || []).filter((id) =>
    outcomes.outcomes.objectiveMetadata.some((o) => o.id === id),
  );
  const expectedObjSet = new Set(expectedPeriodObjIds);
  parsed.objectiveIds = [...expectedPeriodObjIds];

  const rawPhases = Array.isArray(parsed.phases) ? parsed.phases : [];
  const defaultMinutes: Record<StagedPhaseName, number> = {
    warmup: 5,
    explore: 13,
    practice: 12,
    apply: 5,
  };
  const phaseCovered = new Set<string>();
  parsed.phases = STAGED_PHASES.map((phaseName, idx) => {
    const existing = rawPhases.find((p) => p?.phase === phaseName) || rawPhases[idx];
    const validPhaseObjs = (Array.isArray(existing?.objectiveIds) ? existing.objectiveIds : [])
      .filter((id) => typeof id === "string" && expectedObjSet.has(id));
    const finalPhaseObjs = validPhaseObjs.length > 0
      ? validPhaseObjs
      : expectedPeriodObjIds.length > 0
        ? [expectedPeriodObjIds[idx % expectedPeriodObjIds.length]]
        : [];
    finalPhaseObjs.forEach((id) => phaseCovered.add(id));
    return {
      phase: phaseName,
      activityId: stagedActivityId(periodNumber, phaseName),
      title: existing?.title?.trim() || STAGED_PHASE_LABELS[phaseName],
      objectiveIds: finalPhaseObjs,
      sourceIds: Array.isArray(existing?.sourceIds) ? existing.sourceIds : [],
      sourceUnitIds: Array.isArray(existing?.sourceUnitIds) ? existing.sourceUnitIds : [],
      sourceClusterIds: Array.isArray(existing?.sourceClusterIds) ? existing.sourceClusterIds : [],
      durationMinutes: (existing?.durationMinutes && existing.durationMinutes > 0)
        ? existing.durationMinutes
        : defaultMinutes[phaseName],
      learningProducts: Array.isArray(existing?.learningProducts) && existing.learningProducts.length > 0
        ? existing.learningProducts
        : ["Sản phẩm học tập của học sinh"],
      handoffToNext: existing?.handoffToNext || "",
      pedagogyFocus: existing?.pedagogyFocus || "",
    };
  });
  for (const objId of expectedPeriodObjIds) {
    if (!phaseCovered.has(objId) && parsed.phases.length >= 3) {
      parsed.phases[2].objectiveIds.push(objId);
    }
  }
  // Ensure the 4 phase durations sum to exact identity.duration (e.g. 35 minutes)
  const targetPeriodMinutes = Math.max(20, Number(identity.duration) || 35);
  const currentTotalMinutes = parsed.phases.reduce((sum, ph) => sum + (Number(ph.durationMinutes) || 0), 0);
  if (currentTotalMinutes !== targetPeriodMinutes && parsed.phases.length === 4) {
    let delta = targetPeriodMinutes - currentTotalMinutes;
    for (const adjustIndex of [2, 1, 3, 0]) {
      if (delta === 0) break;
      const ph = parsed.phases[adjustIndex]!;
      const minAllowed = adjustIndex === 1 || adjustIndex === 2 ? 8 : 4;
      const nextVal = Math.max(minAllowed, ph.durationMinutes + delta);
      delta -= (nextVal - ph.durationMinutes);
      ph.durationMinutes = nextVal;
    }
  }
  const periodClusterIds = allocatedClusters.map((c) => c.clusterId).filter(Boolean);
  const periodUnitIds = Array.from(new Set([
    ...(periodMap.sourceIds || []),
    ...allocatedClusters.flatMap((c) => c.sourceUnitIds || []),
  ])).filter(Boolean);
  if (parsed.phases.length >= 3) {
    const hasAnyCluster = parsed.phases.some((ph) => ph.sourceClusterIds?.length > 0);
    if (!hasAnyCluster && periodClusterIds.length > 0) {
      parsed.phases[1].sourceClusterIds = [...periodClusterIds];
    }
    const hasAnyUnit = parsed.phases.some((ph) => ph.sourceUnitIds?.length > 0 || ph.sourceIds?.length > 0);
    if (!hasAnyUnit && periodUnitIds.length > 0) {
      parsed.phases[1].sourceUnitIds = [...periodUnitIds];
      parsed.phases[1].sourceIds = [...periodUnitIds];
    }
  }
  const artifact: StagedPeriodBlueprintArtifact = {
    version: 2,
    kind: "period-blueprint",
    subjectKind: sourceFacts.subjectKind,
    identity,
    anchor: { revision: 1, hash: "" },
    dependencies: { outcomes: outcomes.anchor, lessonMap: lessonMap.anchor },
    model: res.model,
    provider: res.provider,
    fallbackUsed: res.fallbackUsed,
    periodNumber,
    periodBlueprint: parsed,
  };
  artifact.anchor = stagedArtifactAnchor(artifact);
  return artifact;
}

export async function generateStagedMaterials(
  options: GenerateStagedMaterialsOptions,
): Promise<StagedMaterialsArtifact> {
  const { input, sourceFacts, outcomes, lessonMap, periodBlueprints, strategy } = options;
  const identity = sourceFacts.identity;
  const prompt = `Soạn MỤC II. THIẾT BỊ DẠY HỌC VÀ HỌC LIỆU cho bài "${identity.lessonTitle}".
Cơ sở vật chất: ${learningContextGuidance(input)}
Dữ kiện nguồn SGK: ${JSON.stringify(sourceFacts.facts.sourceEvidence)}
YCCĐ: ${JSON.stringify(outcomes.outcomes.objectiveMetadata.map((o) => o.id))}

Yêu cầu định dạng bắt buộc:
1. Chia thành Giáo viên (teacher) và Học sinh (students).
2. CHỈ ghi ngắn gọn tên các thiết bị, đồ dùng, học liệu, tài liệu, phiếu học tập (danh từ ngắn, dưới 12 từ/mục, tối đa 4-6 mục).
3. TUYỆT ĐỐI KHÔNG mô tả hoạt động hay kịch bản sư phạm (cấm ghi: "GV chiếu...", "HS quan sát...", "dùng để...", "mời HS...", "kéo-thả...", "nhiệm vụ...").
4. TUYỆT ĐỐI KHÔNG ghi phương án thay thế, phương án mất mạng, nhiệm vụ học tập, hay phân hóa học sinh vào đây.
5. Liệt kê danh sách items với ID cố định: "mat-1", "mat-2",... Gắn kết rõ sourceIds và objectiveIds phục vụ.
6. KHÔNG bịa thiết bị đắt tiền nếu điều kiện học sinh bình thường.

Trả về duy nhất JSON:
{
  "materials": {
    "teacher": string[],
    "students": string[]
  },
  "items": [
    { "id": "mat-1", "owner": "teacher"|"students", "label": string, "sourceIds": string[], "objectiveIds": string[] }
  ]
}`;

  const res = await fetchAiJsonContent(strategy.blueprint, [
    { role: "system", content: "Bạn chỉ trả về JSON thiết bị dạy học Mục II." },
    { role: "user", content: prompt },
  ]);
  const parsed = extractAiJsonValue<{ materials: LessonPlan["materials"]; items: StagedMaterial[] }>(res.content);
  const cleanMat = sanitizeMaterials(parsed.materials);
  const cleanItems = (parsed.items || []).map((item) => ({
    ...item,
    label: sanitizeMaterialItem(item.label) || item.label,
  })).filter((item) => sanitizeMaterialItem(item.label) !== null);

  const validObjSet = new Set(outcomes.outcomes.objectiveMetadata.map((o) => o.id));
  const validSrcSet = new Set(sourceFacts.facts.sourceEvidence.map((s) => s.id));
  const rawItems = (cleanItems.length ? cleanItems : parsed.items || []);
  const normalizedItems = rawItems.map((item, idx) => ({
    ...item,
    id: `mat-${idx + 1}`,
    owner: item.owner === "students" ? ("students" as const) : ("teacher" as const),
    label: item.label?.trim() || `Học liệu ${idx + 1}`,
    sourceIds: (Array.isArray(item.sourceIds) ? item.sourceIds : []).filter((id) => validSrcSet.has(id)),
    objectiveIds: (Array.isArray(item.objectiveIds) ? item.objectiveIds : []).filter((id) => validObjSet.has(id)),
  }));
  if (normalizedItems.length === 0) {
    normalizedItems.push({
      id: "mat-1",
      owner: "teacher",
      label: "SGK và học liệu minh họa",
      sourceIds: [],
      objectiveIds: [],
    });
  }

  const artifact: StagedMaterialsArtifact = {
    version: 2,
    kind: "section-materials",
    subjectKind: sourceFacts.subjectKind,
    identity,
    anchor: { revision: 1, hash: "" },
    dependencies: {
      source: sourceFacts.anchor,
      outcomes: outcomes.anchor,
      lessonMap: lessonMap.anchor,
      periodBlueprints: periodBlueprints.map((b) => b.anchor),
    },
    model: res.model,
    provider: res.provider,
    fallbackUsed: res.fallbackUsed,
    materials: cleanMat,
    items: normalizedItems,
  };
  artifact.anchor = stagedArtifactAnchor(artifact);
  return artifact;
}

export async function generateStagedAssessment(
  options: GenerateStagedAssessmentOptions,
): Promise<StagedAssessmentArtifact> {
  const { input, sourceFacts, outcomes, materials, phases, strategy } = options;
  const identity = sourceFacts.identity;
  const prompt = `Lập MA TRẬN ĐÁNH GIÁ & TIÊU CHÍ (Assessment Matrix) cho bài "${identity.lessonTitle}".
Đối chiếu Mục I YCCĐ:
${JSON.stringify(outcomes.outcomes.objectiveMetadata.map((o) => ({ id: o.id, statement: o.statement })))}
Các hoạt động đã triển khai:
${JSON.stringify(phases.map((p) => ({ id: p.activity.id, title: p.activity.title, objIds: p.activity.objectiveIds })))}

Trả về duy nhất JSON:
{
  "assessment": {
    "criteria": string[],
    "evidence": string[],
    "comments": string[]
  },
  "alignment": [
    {
      "objectiveId": string,
      "activityIds": string[],
      "materialIds": string[],
      "sourceIds": string[],
      "learningProducts": string[],
      "successCriteria": string[]
    }
  ]
}`;

  const res = await fetchAiJsonContent(strategy.blueprint, [
    { role: "system", content: "Bạn chỉ trả về JSON ma trận đánh giá đối chiếu mục tiêu." },
    { role: "user", content: prompt },
  ]);
  const parsed = extractAiJsonValue<{ assessment: LessonPlan["assessment"]; alignment: any[] }>(res.content);
  const validObjSet = new Set(outcomes.outcomes.objectiveMetadata.map((o) => o.id));
  const validActSet = new Set(phases.map((p) => p.activity.id));
  const normalizedAlignment = (Array.isArray(parsed.alignment) ? parsed.alignment : [])
    .filter((a) => a && typeof a === "object" && validObjSet.has(a.objectiveId))
    .map((a) => ({
      ...a,
      activityIds: (Array.isArray(a.activityIds) ? a.activityIds : []).filter((id: string) => validActSet.has(id)),
    }));

  const artifact: StagedAssessmentArtifact = {
    version: 2,
    kind: "section-assessment",
    subjectKind: sourceFacts.subjectKind,
    identity,
    anchor: { revision: 1, hash: "" },
    dependencies: {
      outcomes: outcomes.anchor,
      materials: materials.anchor,
      phases: phases.map((p) => p.anchor),
    },
    model: res.model,
    provider: res.provider,
    fallbackUsed: res.fallbackUsed,
    assessment: parsed.assessment,
    alignment: normalizedAlignment,
  };
  artifact.anchor = stagedArtifactAnchor(artifact);
  return artifact;
}
