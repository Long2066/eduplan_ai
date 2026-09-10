import "server-only";
import { extractAiJsonValue } from "@/lib/ai-json";
import { fetchAiJsonContent } from "@/lib/generation/ai-json-client";
import { generationSubjectKind } from "@/lib/generation/subject-routing";
import { sourceTruthPromptContext } from "@/lib/generation/source-truth";
import { makeStagedAnchor } from "@/lib/generation/section-validation";
import {
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
  type StagedSourceEvidence,
  type StagedSourceFacts,
  type StagedSourceFactsArtifact,
  type StagedSourceIdentity,
} from "@/lib/generation/section-types";
import { resolveLessonTitle, requireResolvedLessonTitle } from "@/lib/lesson-title";
import {
  buildSubjectSystemRole,
  bookContext,
  learningContextGuidance,
  mathGradeBandGuidance,
  pedagogyProfileGuidance,
  vietnameseStrictGuidance,
  vietnameseLessonTypeGuidance,
  naturalSocialStrictGuidance,
  naturalSocialLessonTypeGuidance,
} from "@/lib/subject-prompts";
import type { LessonInput, LessonOutcomes, LessonPlan } from "@/types/lesson";

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
  const titleResolution = resolveLessonTitle({
    subject: input.subject,
    ocrText,
    candidates: [
      { value: sourceTruth?.lessonTitle, source: "source-truth", confidence: sourceTruth?.lessonIdentity?.confidence || 0.95 },
      { value: input.lessonTitle, source: "user-input", confidence: 0.95 },
    ],
  });
  const lockedTitle = requireResolvedLessonTitle(titleResolution);
  const identity = cleanIdentity(input, lockedTitle, sourceContext.ocrSourceHashes);
  const promptContext = sourceTruthPromptContext(sourceTruth, ocrText);

  const prompt = `Bạn là chuyên gia sư phạm tiểu học.
Nhiệm vụ: Trích xuất và khóa dữ kiện nguồn SGK/OCR cho bài học "${lockedTitle}".
Lưu ý:
- KHÔNG soạn giáo án hay hoạt động chi tiết ở bước này.
- Trích xuất danh sách nguồn: các bài tập, nhiệm vụ đọc/viết/tính/quan sát (sourceEvidence) và gán ID dạng "src-1", "src-2",...
- Ghi nhận đầy đủ số trang nếu có trong OCR.
- Nếu không có OCR, dựa trên form người dùng và kiến thức chuẩn CTGDPT 2018 để suy luận dữ kiện cốt lõi, đánh dấu kind="inference".
${pedagogyProfileGuidance(input)}

DỮ LIỆU NGUỒN:
${promptContext}

Trả về duy nhất JSON:
{
  "lessonTitle": "${lockedTitle}",
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

  const anchor = makeStagedAnchor(parsed);
  return {
    version: 2,
    kind: "source-facts",
    subjectKind,
    identity,
    anchor,
    dependencies: {},
    model: res.model,
    provider: res.provider,
    fallbackUsed: res.fallbackUsed,
    sourceTruth,
    promptSource: ocrText ? "ocr" : "input-only",
    classification: sourceContext.vietnamese ? undefined : undefined,
    facts: parsed,
  };
}

export async function generateStagedOutcomes(
  options: GenerateStagedOutcomesOptions,
): Promise<StagedOutcomesArtifact> {
  const { input, sourceFacts, strategy } = options;
  const identity = sourceFacts.identity;
  const prompt = `Soạn MỤC I. YÊU CẦU CẦN ĐẠT cho bài học: "${identity.lessonTitle}".
Môn: ${input.subject}, Khối lớp: ${input.grade}, Số tiết: ${identity.periods}, Bộ sách: ${bookContext(input)}.
Bám sát Chương trình GDPT 2018 và dữ kiện nguồn đã khóa:
${JSON.stringify(sourceFacts.facts.sourceEvidence)}

Yêu cầu:
1. Đầy đủ: Năng lực đặc thù, Năng lực chung, Phẩm chất, Kiến thức và kĩ năng.
2. BẮT BUỘC: Mỗi YCCĐ cụ thể phải có một mục trong objectiveMetadata với id duy nhất cố định: "obj-1", "obj-2",...
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
      "category": "specificCompetencies"|"generalCompetencies"|"qualities"|"knowledgeAndSkills",
      "statement": string,
      "evidence": { "activityIds": [], "learningProducts": [], "successCriteria": [] }
    }
  ]
}`;

  const res = await fetchAiJsonContent(strategy.blueprint, [
    { role: "system", content: "Bạn chỉ trả về JSON Yêu cầu cần đạt chuẩn CV 2345 và CTGDPT 2018." },
    { role: "user", content: prompt },
  ]);
  const parsed = extractAiJsonValue<LessonOutcomes & { objectiveMetadata: NonNullable<LessonOutcomes["objectiveMetadata"]> }>(res.content);
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

  const anchor = makeStagedAnchor(parsed);
  return {
    version: 2,
    kind: "section-outcomes",
    subjectKind: sourceFacts.subjectKind,
    identity,
    anchor,
    dependencies: { source: sourceFacts.anchor },
    model: res.model,
    provider: res.provider,
    fallbackUsed: res.fallbackUsed,
    outcomes: parsed,
  };
}

export async function generateStagedLessonMap(
  options: GenerateStagedLessonMapOptions,
): Promise<StagedLessonMapArtifact> {
  const { input, sourceFacts, outcomes, strategy } = options;
  const identity = sourceFacts.identity;
  const prompt = `Lập BẢN ĐỒ TIẾN TRÌNH BÀI HỌC (Lesson Map) cho: "${identity.lessonTitle}".
Tổng số tiết: ${identity.periods}.
Dữ kiện nguồn đã khóa:
${JSON.stringify(sourceFacts.facts.sourceEvidence)}
Yêu cầu cần đạt đã khóa:
${JSON.stringify(outcomes.outcomes.objectiveMetadata.map((o) => ({ id: o.id, statement: o.statement })))}

Nhiệm vụ:
- Phân bổ mạch logic và các objectiveId ("obj-1",...) vào đúng từng tiết (từ tiết 1 đến ${identity.periods}).
- Mỗi tiết phải có trọng tâm, continuityIn, continuityOut.
- Phân bổ sourceIds đã có ("src-1",...) cho từng tiết.

Trả về duy nhất JSON:
{
  "lessonTitle": "${identity.lessonTitle}",
  "lessonOverview": string,
  "logicSpine": string[],
  "sourceAllocation": [{ "sourceId": string, "periodNumber": number, "purpose": string, "allowReuse": boolean }],
  "continuityPlan": { "sourceUnits": [], "clusters": [] },
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
  const anchor = makeStagedAnchor(parsed);
  return {
    version: 2,
    kind: "lesson-map",
    subjectKind: sourceFacts.subjectKind,
    identity,
    anchor,
    dependencies: { source: sourceFacts.anchor, outcomes: outcomes.anchor },
    model: res.model,
    provider: res.provider,
    fallbackUsed: res.fallbackUsed,
    lessonMap: parsed,
  };
}

export async function generateStagedPeriodBlueprint(
  options: GenerateStagedPeriodBlueprintOptions,
): Promise<StagedPeriodBlueprintArtifact> {
  const { input, sourceFacts, outcomes, lessonMap, periodNumber, strategy } = options;
  const identity = sourceFacts.identity;
  const periodMap = lessonMap.lessonMap.periods.find((p) => p.periodNumber === periodNumber)
    || { periodNumber, focus: `Tiết ${periodNumber}`, objectiveIds: outcomes.outcomes.objectiveMetadata.map((o) => o.id), sourceIds: [] };

  const prompt = `Lập BLUEPRINT CHI TIẾT 4 PHA CHO TIẾT ${periodNumber}/${identity.periods} bài "${identity.lessonTitle}".
Trọng tâm tiết: ${periodMap.focus}.
YCCĐ phân bổ cho tiết này: ${JSON.stringify(periodMap.objectiveIds)}.
Dữ kiện nguồn phân bổ: ${JSON.stringify(periodMap.sourceIds)}.

Yêu cầu:
- Thiết kế khung gọn gàng cho 4 pha bắt buộc: warmup, explore, practice, apply.
- Với mỗi pha, xác định: activityId (p${periodNumber}-warmup, p${periodNumber}-explore, p${periodNumber}-practice, p${periodNumber}-apply), title, durationMinutes (tổng 4 pha xấp xỉ ${identity.duration} phút), objectiveIds liên quan, handoffToNext.

Trả về duy nhất JSON:
{
  "periodNumber": ${periodNumber},
  "focus": "${periodMap.focus}",
  "lessonType": "standard",
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
      "sourceUnitIds": [],
      "sourceClusterIds": [],
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
  const anchor = makeStagedAnchor(parsed);
  return {
    version: 2,
    kind: "period-blueprint",
    subjectKind: sourceFacts.subjectKind,
    identity,
    anchor,
    dependencies: { outcomes: outcomes.anchor, lessonMap: lessonMap.anchor },
    model: res.model,
    provider: res.provider,
    fallbackUsed: res.fallbackUsed,
    periodNumber,
    periodBlueprint: parsed,
  };
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

Yêu cầu:
1. Chia thành Giáo viên (teacher) và Học sinh (students).
2. Liệt kê danh sách items với ID cố định: "mat-1", "mat-2",... Gắn kết rõ sourceIds và objectiveIds phục vụ.
3. KHÔNG bịa thiết bị đắt tiền nếu điều kiện học sinh bình thường.

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
  const anchor = makeStagedAnchor(parsed);
  return {
    version: 2,
    kind: "section-materials",
    subjectKind: sourceFacts.subjectKind,
    identity,
    anchor,
    dependencies: {
      source: sourceFacts.anchor,
      outcomes: outcomes.anchor,
      lessonMap: lessonMap.anchor,
      periodBlueprints: periodBlueprints.map((b) => b.anchor),
    },
    model: res.model,
    provider: res.provider,
    fallbackUsed: res.fallbackUsed,
    materials: parsed.materials,
    items: parsed.items || [],
  };
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
  const anchor = makeStagedAnchor(parsed);
  return {
    version: 2,
    kind: "section-assessment",
    subjectKind: sourceFacts.subjectKind,
    identity,
    anchor,
    dependencies: {
      outcomes: outcomes.anchor,
      materials: materials.anchor,
      phases: phases.map((p) => p.anchor),
    },
    model: res.model,
    provider: res.provider,
    fallbackUsed: res.fallbackUsed,
    assessment: parsed.assessment,
    alignment: parsed.alignment || [],
  };
}
