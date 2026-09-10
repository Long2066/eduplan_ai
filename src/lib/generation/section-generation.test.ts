import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  generateStagedSourceFacts,
  generateStagedOutcomes,
  generateStagedLessonMap,
  generateStagedPeriodBlueprint,
  generateStagedMaterials,
  generateStagedAssessment,
} from "@/lib/generation/section-generation";
import { generateStagedPhase, repairStagedPhase } from "@/lib/generation/phase-generation";
import {
  computeStagedDataHash,
  stagedArtifactAnchor,
  validateStagedSectionPrefix,
  validateStagedSections,
} from "@/lib/generation/section-validation";
import { fetchAiJsonContent } from "@/lib/generation/ai-json-client";
import * as aiClient from "@/lib/generation/ai-json-client";
import { buildSourceTruth } from "@/lib/generation/source-truth";

vi.mock("@/lib/generation/ai-json-client", () => ({
  fetchAiJsonContent: vi.fn(),
}));
import {
  STAGED_PHASES,
  STAGED_PHASE_LABELS,
  stagedActivityId,
  type StagedAssessmentArtifact,
  type StagedCompactPeriodBlueprint,
  type StagedLessonMap,
  type StagedMaterialsArtifact,
  type StagedOutcomesArtifact,
  type StagedPeriodBlueprintArtifact,
  type StagedPhaseArtifact,
  type StagedPhaseBlueprint,
  type StagedSectionArtifacts,
  type StagedSectionPrefixOptions,
  type StagedSourceFacts,
} from "@/lib/generation/section-types";
import type { LessonInput, LessonOutcomeCategory } from "@/types/lesson";
import type { PlanModelStrategy } from "@/lib/model-strategy";
beforeEach(() => {
  vi.mocked(fetchAiJsonContent).mockReset();
});


const mockInput: LessonInput = {
  subject: "Toán",
  grade: "Lớp 3",
  lessonTitle: "Hình tam giác",
  book: "Cánh Diều",
  bookVolume: "Tập 1",
  periods: 1,
  duration: 35,
  hometownProvince: "auto",
  localityNote: "",
  studentProfile: "auto",
  teachingEnvironment: "auto",
  facilities: "auto",
  style: "Cơ bản",
  specialRequest: "",
  allowAiInference: true,
  enableDigitalCompetency: false,
  uploadedAssets: [],
};

const mockStrategy: PlanModelStrategy = {
  plan: "plus",
  blueprint: { stage: "blueprint", provider: "openai", model: "mock-model", temperature: 0.3 },
  detail: { stage: "detail", provider: "openai", model: "mock-model", temperature: 0.5 },
  repair: { stage: "repair", provider: "openai", model: "mock-model", temperature: 0.3 },
};

const input: LessonInput = { ...mockInput, periods: 3 };
const objectiveCases: Array<{
  category: LessonOutcomeCategory; statement: string; task: string; product: string; criterion: string;
}> = [
  { category: "specificCompetencies", statement: "Nhận biết hình tam giác", task: "Chọn tam giác trong bốn hình trên phiếu", product: "Phiếu khoanh hình tam giác", criterion: "Chọn đúng hai tam giác" },
  { category: "knowledgeAndSkills", statement: "Chỉ được ba đỉnh của tam giác", task: "Chấm và đọc tên ba đỉnh A, B, C trên hình", product: "Hình đánh dấu ba đỉnh", criterion: "Chỉ đúng cả ba đỉnh" },
  { category: "knowledgeAndSkills", statement: "Nêu được ba cạnh của tam giác", task: "Tô và đọc tên các cạnh AB, BC, CA", product: "Hình tô ba cạnh", criterion: "Nêu đúng ba cạnh không lặp" },
  { category: "generalCompetencies", statement: "Giải thích lựa chọn hình cho bạn", task: "Giải thích cho bạn vì sao hình đã chọn có ba cạnh và ba đỉnh", product: "Lời giải thích theo cặp", criterion: "Nêu đủ hai dấu hiệu để bạn kiểm tra" },
  { category: "specificCompetencies", statement: "Phân biệt tam giác với hình khác", task: "Loại hình tròn và hình tứ giác khỏi nhóm tam giác", product: "Nhóm thẻ đã phân loại", criterion: "Phân loại đúng cả bốn thẻ" },
  { category: "knowledgeAndSkills", statement: "Vẽ tam giác bằng thước", task: "Dùng thước nối ba điểm không thẳng hàng", product: "Tam giác vẽ bằng thước", criterion: "Ba đoạn thẳng khép kín nối đúng ba điểm" },
  { category: "generalCompetencies", statement: "Kiểm tra và sửa hình đã vẽ", task: "Đối chiếu hình với bảng kiểm ba cạnh, ba đỉnh rồi sửa chỗ sai", product: "Hình đã sửa và bảng kiểm", criterion: "Tự kiểm tra đủ hai dấu hiệu" },
  { category: "specificCompetencies", statement: "Tìm tam giác trong đồ vật", task: "Chỉ mặt hình tam giác trong tranh mái nhà", product: "Tranh khoanh mặt tam giác", criterion: "Chỉ đúng mặt có ba cạnh" },
  { category: "knowledgeAndSkills", statement: "Ghép tam giác thành hình mới", task: "Ghép hai thẻ tam giác thành mái nhà và trình bày cách ghép", product: "Mái nhà ghép từ hai tam giác", criterion: "Dùng đủ hai thẻ và giải thích vị trí ghép" },
  { category: "qualities", statement: "Trung thực khi tự đánh giá sản phẩm", task: "Đánh dấu đúng phần đã làm và phần chưa làm trên phiếu tự đánh giá rồi nói cách sửa", product: "Phiếu tự đánh giá trung thực", criterion: "Nhận xét khớp sản phẩm, nêu được việc cần sửa" },
];
const objectiveMetadata = objectiveCases.map(({ category, statement }, index) => ({
  id: `obj-${index + 1}`, category, statement,
  evidence: { activityIds: [], learningProducts: [], successCriteria: [] },
}));
const statements = (category: LessonOutcomeCategory) => objectiveMetadata
  .filter((objective) => objective.category === category).map((objective) => objective.statement);
const outcomesPayload: StagedOutcomesArtifact["outcomes"] = {
  generalCompetencies: statements("generalCompetencies"),
  specificCompetencies: statements("specificCompetencies"),
  qualities: statements("qualities"),
  knowledgeAndSkills: statements("knowledgeAndSkills"),
  digitalCompetencies: [],
  objectiveMetadata,
};
const sourcePayload: StagedSourceFacts = {
  lessonTitle: input.lessonTitle,
  coreContent: ["Tam giác có ba đỉnh, ba cạnh"],
  objectivesFromSource: objectiveMetadata.map((objective) => objective.statement),
  sourceEvidence: Array.from({ length: input.periods }, (_, index) => ({
    id: `src-${index + 1}`, kind: "task", label: `Bài ${index + 1}`,
    text: ["Chọn tam giác, chỉ đỉnh và cạnh", "Phân loại, vẽ và kiểm tra tam giác", "Ghép mái nhà từ tam giác và tự đánh giá sản phẩm"][index],
    page: String(index + 1), required: true, allowReuse: true,
  })),
  uncertainties: [], conflicts: [], fatalIssues: [],
};
const phaseObjectiveIds = [
  [["obj-1", "obj-2"], ["obj-2"], ["obj-3"], ["obj-4"]],
  [["obj-5"], ["obj-6"], ["obj-6"], ["obj-7"]],
  [["obj-8"], ["obj-8"], ["obj-9"], ["obj-9", "obj-10"]],
];
const lessonMapPayload: StagedLessonMap = {
  lessonTitle: input.lessonTitle,
  lessonOverview: "Nhận biết, vẽ, vận dụng tam giác và tự đánh giá",
  logicSpine: ["Nhận biết", "Vẽ và kiểm tra", "Vận dụng"],
  sourceAllocation: sourcePayload.sourceEvidence.map((source, index) => ({
    sourceId: source.id, periodNumber: index + 1, purpose: source.text, allowReuse: true,
  })),
  continuityPlan: { sourceUnits: [], clusters: [] },
  periods: phaseObjectiveIds.map((ids, index) => ({
    periodNumber: index + 1, focus: sourcePayload.sourceEvidence[index].text,
    objectiveIds: [...new Set(ids.flat())], sourceIds: [`src-${index + 1}`],
    targetKnowledge: "Tam giác có ba đỉnh, ba cạnh",
    continuityIn: index ? "Dùng dấu hiệu đã học" : "Quan sát hình quen thuộc",
    continuityOut: "Giữ sản phẩm để đối chiếu nhiệm vụ sau", assessmentEvidence: ["Phiếu học tập"],
  })),
  risks: [],
};
const blueprintPayloads: StagedCompactPeriodBlueprint[] = lessonMapPayload.periods.map((period, index) => ({
  periodNumber: period.periodNumber, focus: period.focus, lessonType: "standard",
  objectiveIds: period.objectiveIds, targetKnowledge: period.targetKnowledge,
  continuityIn: period.continuityIn, continuityOut: period.continuityOut, teachingNotes: [],
  phases: STAGED_PHASES.map((phase, phaseIndex) => ({
    phase, activityId: stagedActivityId(period.periodNumber, phase), title: STAGED_PHASE_LABELS[phase],
    objectiveIds: phaseObjectiveIds[index][phaseIndex], sourceIds: period.sourceIds,
    sourceUnitIds: [], sourceClusterIds: [], durationMinutes: [5, 15, 10, 5][phaseIndex],
    learningProducts: ["Phiếu học tập"], handoffToNext: "Đối chiếu sản phẩm ở nhiệm vụ sau",
    pedagogyFocus: period.focus,
  })),
}));
const materialsPayload: Pick<StagedMaterialsArtifact, "materials" | "items"> = {
  materials: { teacher: ["Phiếu học tập, thẻ tam giác"], students: ["Thước kẻ, bút chì"] },
  items: [{
    id: "mat-1", owner: "teacher", label: "Phiếu học tập và thẻ tam giác",
    sourceIds: sourcePayload.sourceEvidence.map((source) => source.id),
    objectiveIds: objectiveMetadata.map((objective) => objective.id),
  }],
};

function mockReply(payload: unknown, model = "mock-model") {
  vi.mocked(fetchAiJsonContent).mockResolvedValueOnce({
    content: JSON.stringify(payload), model, provider: "openai", fallbackUsed: false,
  });
}

async function generateSourceFacts() {
  const ocrText = `${input.lessonTitle}\n${sourcePayload.sourceEvidence.map((source) => source.text).join("\n")}`;
  const sourceHashes = [computeStagedDataHash(ocrText)];
  mockReply(sourcePayload);
  return generateStagedSourceFacts({
    input, ocrText, strategy: mockStrategy,
    sourceContext: {
      subjectKind: "math", ocrSourceHashes: sourceHashes,
      sourceTruth: buildSourceTruth({ input, ocrText, sourceHashes }), warnings: [],
    },
  });
}

function expectValidPrefix(prefix: StagedSectionPrefixOptions) {
  const validation = validateStagedSectionPrefix(prefix);
  expect(validation.issues.filter((issue) => issue.code === "SEC-HASH-MISMATCH")).toEqual([]);
  expect(validation.issues).toEqual([]);
  expect(validation.passed).toBe(true);
}

async function generatePrerequisites(feedback?: string) {
  // 1. Source facts
  const sourceFacts = await generateSourceFacts();
  expectValidPrefix({ input, sourceFacts });
  // 2. Outcomes
  mockReply(outcomesPayload);
  const outcomes = await generateStagedOutcomes({ input, sourceFacts, strategy: mockStrategy });
  expectValidPrefix({ input, sourceFacts, outcomes });
  // 3. Lesson map
  mockReply(lessonMapPayload);
  const lessonMap = await generateStagedLessonMap({ input, sourceFacts, outcomes, strategy: mockStrategy, feedback });
  expectValidPrefix({ input, sourceFacts, outcomes, lessonMap });
  // 4. Period blueprint
  const periodBlueprints: StagedPeriodBlueprintArtifact[] = [];
  for (const blueprint of blueprintPayloads) {
    mockReply(blueprint);
    periodBlueprints.push(await generateStagedPeriodBlueprint({
      input, sourceFacts, outcomes, lessonMap, periodNumber: blueprint.periodNumber, strategy: mockStrategy, feedback,
    }));
    expectValidPrefix({ input, sourceFacts, outcomes, lessonMap, periodBlueprints });
  }
  // 5. Materials
  mockReply(materialsPayload);
  const materials = await generateStagedMaterials({
    input, sourceFacts, outcomes, lessonMap, periodBlueprints, strategy: mockStrategy,
  });
  const artifacts = { sourceFacts, outcomes, lessonMap, periodBlueprints, materials };
  expectValidPrefix({ input, ...artifacts });
  return artifacts;
}

function phasePayload(blueprint: StagedPhaseBlueprint): Pick<StagedPhaseArtifact, "activity" | "materialIds" | "sourceIds" | "handoff"> {
  const objectives = blueprint.objectiveIds.map((id) => objectiveCases[Number(id.slice(4)) - 1]);
  const learningProducts = objectives.map((objective) => objective.product);
  return {
    activity: {
      id: blueprint.activityId, phase: STAGED_PHASE_LABELS[blueprint.phase], title: blueprint.title,
      objective: objectives.map((objective) => objective.statement).join("; "),
      durationMinutes: blueprint.durationMinutes,
      teacherActions: objectives.map((objective) => `GV giao nhiệm vụ: ${objective.task}; quan sát và góp ý theo tiêu chí: ${objective.criterion}.`),
      studentActions: objectives.map((objective) => `HS thực hiện: ${objective.task}.`),
      learningProducts, successCriteria: objectives.map((objective) => objective.criterion),
      objectiveIds: blueprint.objectiveIds, organization: "pair",
    },
    materialIds: ["mat-1"], sourceIds: blueprint.sourceIds,
    handoff: {
      activityId: blueprint.activityId, knowledge: objectives.map((objective) => objective.statement),
      products: learningProducts, pending: ["Đối chiếu sản phẩm với nhiệm vụ tiếp theo"],
      bridge: blueprint.handoffToNext, objectiveIds: blueprint.objectiveIds,
      sourceIds: blueprint.sourceIds, materialIds: ["mat-1"],
    },
  };
}

function promptContaining(text: string) {
  return vi.mocked(fetchAiJsonContent).mock.calls
    .flatMap(([, messages]) => messages.filter((message) => message.role === "user").map((message) => message.content))
    .find((prompt) => prompt.includes(text)) || "";
}

describe("staged-v2 generation & repair functions", () => {
  it("generates source facts with locked title", async () => {
    const sourceFacts = await generateSourceFacts();
    expect(sourceFacts.identity.lessonTitle).toBe(input.lessonTitle);
    expect(sourceFacts.facts.lessonTitle).toBe(input.lessonTitle);
    expect(sourceFacts.facts.sourceEvidence).toHaveLength(input.periods);
    expect(sourceFacts.anchor.hash).toBe(stagedArtifactAnchor(sourceFacts).hash);
    expectValidPrefix({ input, sourceFacts });
  });

  it("repairs a phase in a single bounded AI call with valid anchor", async () => {
    const artifacts = await generatePrerequisites();
    const periodBlueprint = artifacts.periodBlueprints[0];
    const payload = phasePayload(periodBlueprint.periodBlueprint.phases[0]);
    mockReply({ ...payload, activity: { ...payload.activity, teacherActions: [], studentActions: [] } });
    const options = { input, ...artifacts, periodBlueprint, phase: "warmup" as const, previousPhase: null, strategy: mockStrategy };
    const currentPhase = await generateStagedPhase(options);
    vi.mocked(fetchAiJsonContent).mockClear();
    mockReply(payload, "mock-repair");
    const repairRes = await repairStagedPhase({
      ...options, currentPhase,
      issues: [{ code: "SEC-PHASE-ACTIONS-EMPTY", message: "Thiếu hoạt động", path: "activity" }],
    });
    expect(fetchAiJsonContent).toHaveBeenCalledTimes(1);
    expect(repairRes.repaired).toBe(true);
    expect(repairRes.artifact.anchor.revision).toBe(2);
    expect(repairRes.artifact.activity.teacherActions).toEqual(payload.activity.teacherActions);
    expect(repairRes.artifact.anchor.hash).toBe(stagedArtifactAnchor(repairRes.artifact, 2).hash);
    expectValidPrefix({ input, ...artifacts, phases: [repairRes.artifact] });
  });

  it("passes objective statements, categories and retry feedback to map, blueprint and phase prompts", async () => {
    const feedback = "[SEC-OBJ-UNCOVERED] obj-10: thiếu nhiệm vụ tự đánh giá trung thực.";
    const artifacts = await generatePrerequisites(feedback);
    const periodBlueprint = artifacts.periodBlueprints[0];
    const blueprint = periodBlueprint.periodBlueprint.phases[0];
    mockReply(phasePayload(blueprint));
    const phase = await generateStagedPhase({
      input, ...artifacts, periodBlueprint, phase: blueprint.phase, previousPhase: null, strategy: mockStrategy, feedback,
    });
    const mapPrompt = promptContaining("Lập BẢN ĐỒ");
    const bpPrompt = promptContaining("Lập BLUEPRINT CHI TIẾT 4 PHA CHO TIẾT 3/");
    const phasePrompt = promptContaining("Soạn CHI TIẾT ĐƠN VỊ PHA");
    for (const prompt of [mapPrompt, bpPrompt, phasePrompt]) {
      expect(prompt).toContain(feedback);
      expect(prompt).toMatch(/KHÔNG (xóa|bỏ)/);
    }
    for (const objective of objectiveMetadata) {
      expect(mapPrompt).toContain(JSON.stringify({ id: objective.id, statement: objective.statement, category: objective.category }));
    }
    for (const id of lessonMapPayload.periods[2].objectiveIds) {
      const objective = objectiveMetadata.find((item) => item.id === id)!;
      expect(bpPrompt).toContain(JSON.stringify({ id, statement: objective.statement, category: objective.category }));
    }
    expect(mapPrompt).toContain("TẤT CẢ");
    expect(mapPrompt).toContain("Phẩm chất (qualities)");
    expect(bpPrompt).toMatch(/hợp objectiveIds.*4 pha.*mọi YCCĐ/);
    for (const id of blueprint.objectiveIds) {
      const objective = objectiveMetadata.find((item) => item.id === id)!;
      expect(phasePrompt).toContain(JSON.stringify({ id, statement: objective.statement, category: objective.category }));
    }
    expect(phasePrompt).toContain("Mỗi YCCĐ");
    expect(phasePrompt).toContain('"successCriteria": string[]');
    expect(phase.activity.successCriteria).toEqual(phasePayload(blueprint).activity.successCriteria);
  });

  it.each([
    { label: "absent", objectiveIds: undefined, expected: [] },
    { label: "null", objectiveIds: null, expected: [] },
    { label: "empty", objectiveIds: [], expected: [] },
    { label: "nonempty subset", objectiveIds: ["obj-1"], expected: ["obj-1"] },
    { label: "string", objectiveIds: "obj-1", expected: "obj-1" },
    { label: "object", objectiveIds: {}, expected: {} },
    { label: "number", objectiveIds: 7, expected: 7 },
    { label: "boolean", objectiveIds: false, expected: false },
    { label: "mixed array", objectiveIds: ["obj-1", null], expected: ["obj-1", null] },
  ])("does not autofill $label objectiveIds and lets validation reject the phase", async ({ objectiveIds, expected }) => {
    const artifacts = await generatePrerequisites();
    const periodBlueprint = artifacts.periodBlueprints[0];
    const payload = phasePayload(periodBlueprint.periodBlueprint.phases[0]);
    mockReply({ ...payload, activity: { ...payload.activity, objectiveIds } });
    const phase = await generateStagedPhase({
      input, ...artifacts, periodBlueprint, phase: "warmup", previousPhase: null, strategy: mockStrategy,
    });
    expect(phase.activity.objectiveIds).toEqual(expected);
    expect(phase.anchor.hash).toBe(stagedArtifactAnchor(phase).hash);
    const validation = validateStagedSectionPrefix({ input, ...artifacts, phases: [phase] });
    expect(validation.passed).toBe(false);
    expect(validation.issues.some((issue) => issue.periodNumber === 1 && issue.phase === "warmup")).toBe(true);
    expect(validation.issues.some((issue) => issue.code === "SEC-HASH-MISMATCH")).toBe(false);
  });

  it("validates every generated prefix and all seven artifact kinds across three periods, including quality coverage", async () => {
    const artifacts = await generatePrerequisites();
    const phases: StagedPhaseArtifact[] = [];
    // 6. Phase
    for (const periodBlueprint of artifacts.periodBlueprints) {
      for (const blueprint of periodBlueprint.periodBlueprint.phases) {
        mockReply(phasePayload(blueprint));
        const previousPhase = phases.at(-1) || null;
        const phase = await generateStagedPhase({
          input, ...artifacts, periodBlueprint, phase: blueprint.phase, previousPhase, strategy: mockStrategy,
        });
        expect(phase.anchor.hash).toBe(stagedArtifactAnchor(phase).hash);
        expect(phase.dependencies.periodBlueprint).toEqual(periodBlueprint.anchor);
        expect(phase.dependencies.previousPhase).toEqual(previousPhase?.anchor);
        expect(phase.input).toEqual({
          previousActivityId: previousPhase?.activity.id ?? null,
          previousHandoffHash: previousPhase?.anchor.hash ?? null,
          knowledge: previousPhase?.handoff.knowledge ?? [], products: previousPhase?.handoff.products ?? [],
          pending: previousPhase?.handoff.pending ?? [], bridge: previousPhase?.handoff.bridge ?? "Mở đầu tiết học.",
        });
        phases.push(phase);
        expectValidPrefix({ input, ...artifacts, phases });
      }
    }
    // 7. Assessment
    const assessmentPayload: Pick<StagedAssessmentArtifact, "assessment" | "alignment"> = {
      assessment: { criteria: objectiveCases.map((objective) => objective.criterion), evidence: ["Phiếu học tập"], comments: [] },
      alignment: objectiveMetadata.map((objective) => {
        const linked = phases.filter((phase) => phase.activity.objectiveIds.includes(objective.id));
        return {
          objectiveId: objective.id, activityIds: linked.map((phase) => phase.activity.id), materialIds: ["mat-1"],
          sourceIds: [...new Set(linked.flatMap((phase) => phase.sourceIds))],
          learningProducts: linked.flatMap((phase) => phase.activity.learningProducts),
          successCriteria: linked.flatMap((phase) => phase.activity.successCriteria),
        };
      }),
    };
    mockReply(assessmentPayload);
    const assessment = await generateStagedAssessment({ input, ...artifacts, phases, strategy: mockStrategy });
    const complete: StagedSectionArtifacts & { input: LessonInput } = { input, ...artifacts, phases, assessment };
    expectValidPrefix(complete);
    expect(validateStagedSections(complete)).toEqual({ passed: true, issues: [] });
    expect(phases).toHaveLength(12);
    expect(fetchAiJsonContent).toHaveBeenCalledTimes(20);
    expect(new Set([
      artifacts.sourceFacts.kind, artifacts.outcomes.kind, artifacts.lessonMap.kind,
      ...artifacts.periodBlueprints.map((blueprint) => blueprint.kind), artifacts.materials.kind,
      ...phases.map((phase) => phase.kind), assessment.kind,
    ]).size).toBe(7);
    expect(new Set(phases.flatMap((phase) => phase.activity.objectiveIds)))
      .toEqual(new Set(objectiveMetadata.map((objective) => objective.id)));
    expect(phases.at(-1)?.activity.objectiveIds).toContain("obj-10");
    expect(assessment.alignment.find((alignment) => alignment.objectiveId === "obj-10")?.activityIds).toEqual(["p3-apply"]);
    expect(artifacts.materials.dependencies.periodBlueprints).toEqual(artifacts.periodBlueprints.map((blueprint) => blueprint.anchor));
    expect(assessment.dependencies.phases).toEqual(phases.map((phase) => phase.anchor));

    const missingQuality = structuredClone(complete);
    const last = missingQuality.phases[11];
    last.activity.objectiveIds = ["obj-9"];
    last.handoff.objectiveIds = ["obj-9"];
    last.anchor = stagedArtifactAnchor(last);
    missingQuality.assessment.dependencies.phases = missingQuality.phases.map((phase) => phase.anchor);
    const validation = validateStagedSections(missingQuality);
    expect(validation.passed).toBe(false);
    expect(validation.issues).toContainEqual(expect.objectContaining({ code: "SEC-OBJ-UNCOVERED", objectiveId: "obj-10" }));
    expect(validation.issues.some((issue) => issue.code === "SEC-HASH-MISMATCH" || issue.code.startsWith("SEC-DEP-"))).toBe(false);
  });
});
