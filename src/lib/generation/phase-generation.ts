import "server-only";
import { extractAiJsonValue } from "@/lib/ai-json";
import { fetchAiJsonContent } from "@/lib/generation/ai-json-client";
import { stagedArtifactAnchor } from "@/lib/generation/section-validation";
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
  buildDeepScriptBlock,
  getHandwritingGuidanceBlock,
  getDigitalCompetencyPromptBlock,
} from "@/lib/subject-prompts";
import {
  classifyVietnameseLesson,
  getVietnameseGradeWorkflow,
} from "@/lib/vietnamese-pedagogy";
import type { LessonActivity, VietnameseLessonClassification } from "@/types/lesson";

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
    sourceIds: [],
    sourceUnitIds: [],
    sourceClusterIds: [],
    learningProducts: ["Sản phẩm học tập của học sinh"],
    handoffToNext: "",
    pedagogyFocus: "",
  };

  const phaseInput: StagedPhaseInput = {
    previousActivityId: previousPhase ? previousPhase.activity.id : null,
    previousHandoffHash: previousPhase ? previousPhase.anchor.hash : null,
    knowledge: previousPhase ? previousPhase.handoff.knowledge : [],
    products: previousPhase ? previousPhase.handoff.products : [],
    pending: previousPhase ? previousPhase.handoff.pending : [],
    bridge: previousPhase ? previousPhase.handoff.bridge : "Mở đầu tiết học.",
  };

  let subjectGuidance = "";
  if (sourceFacts.subjectKind === "math") {
    subjectGuidance = `${mathLatexPolicy}\n${mathGradeBandGuidance(input)}`;
  } else if (sourceFacts.subjectKind === "vietnamese") {
    const vtClassification = (sourceFacts.classification as VietnameseLessonClassification)
      || classifyVietnameseLesson(input, sourceFacts.facts.coreContent?.join(" ") || "");
    const vtWorkflow = getVietnameseGradeWorkflow(input, vtClassification);
    const effectiveLessonType = periodBlueprint.periodBlueprint.lessonType || vtClassification.primaryType || "mixed";
    const phaseFocusContext = `${periodBlueprint.periodBlueprint.focus || ""} ${phaseBp.title || ""} ${phaseBp.pedagogyFocus || ""}`;
    const deepScript = buildDeepScriptBlock(input, effectiveLessonType, phaseFocusContext, periodNumber);

    const dummyBlueprint = {
      sourceInventory: sourceFacts.sourceInventory as any,
      classification: vtClassification,
    } as any;
    const dummyPeriod = {
      periodNumber,
      lessonType: effectiveLessonType,
      focus: phaseFocusContext,
    } as any;
    const handwritingGuidance = getHandwritingGuidanceBlock(input, dummyBlueprint, dummyPeriod);
    const digitalBlock = getDigitalCompetencyPromptBlock(input, effectiveLessonType);

    const mandatoryDialogueRules = `QUY TẮC BẮT BUỘC: KỊCH BẢN ĐỐI THOẠI 1:1 CHI TIẾT (CHUẨN MẪU BÀI 32 AN ĂN ÂN & QUY TRÌNH KNTT):
- TUYỆT ĐỐI KHÔNG VIẾT TÓM TẮT HÀNH CHÍNH (CẤM: "GV viết mẫu lên bảng, nhắc HS quan sát", "GV hướng dẫn HS đọc", "HS lắng nghe và thực hiện", "HS làm bài theo yêu cầu"). Viết như vậy giáo viên KHÔNG THỂ CẦM DẠY NGAY ĐƯỢC.
- Mọi hoạt động dạy học PHẢI được chi tiết hóa thành kịch bản đối thoại chi tiết, sinh viên năm 2 cầm giáo án dạy được ngay:
  1. Cột Hoạt động của giáo viên (teacherActions):
     - Dùng gạch đầu dòng '-' cho hành động của giáo viên (chiếu hình ảnh, viết bảng mẫu, chia nhóm, quan sát sửa sai).
     - Dùng dấu cộng '+' cho TỪNG CÂU HỎI CỤ THỂ, LỜI NÓI NGUYÊN VĂN CỦA GV (Ví dụ:
       + Để viết vần an, chúng ta sẽ viết chữ nào trước?
       + Chữ a gồm mấy nét? Là những nét nào?
       + Chữ a cao mấy ô li? Rộng mấy ô li?).
     - Lời nhận xét, chốt kiến thức của GV PHẢI ĐẶT TRONG NGOẶC KÉP:
       - GV nhận xét, kết luận: “Chữ a cao 2 ô li, rộng 2,5 ô li. Chữ a gồm 2 nét: nét 1 là nét cong kín và nét 2 là nét móc ngược phải.”
  2. Cột Hoạt động của học sinh (studentActions):
     - Dùng gạch đầu dòng '-' cho hành động của học sinh (quan sát, đọc nối tiếp, viết bảng con, trao đổi nhóm).
     - Dùng dấu cộng '+' cho TỪNG CÂU TRẢ LỜI CỤ THỂ tương ứng 1:1 với câu hỏi của giáo viên (Ví dụ:
       + Viết chữ a trước, viết chữ n sau.
       + Chữ a gồm 2 nét (nét cong kín, nét móc ngược phải).
       + Chữ a rộng 2,5 ô li, cao 2 ô li).
     - HS lắng nghe nhận xét, ghi nhớ và thực hành.
  3. Với phần Tập viết / Hướng dẫn viết (bảng con hoặc vở):
     - Xác định nét chữ: GV hỏi từng nét, độ cao, độ rộng; HS trả lời; GV chốt lời trong ngoặc kép.
     - Quy trình viết từng li từng tí: mô tả rõ điểm đặt bút (dưới đường kẻ mấy - ĐK ...), hướng viết từng nét, điểm dừng bút, điểm lia bút, cách nối nét.
     - Viết từ ngữ ứng dụng: GV hỏi độ cao các con chữ trong từ (chữ 5 ô li: b, h, k, l, g, y; chữ 3 ô li: t; chữ 2,5 ô li: r, s; chữ 2 ô li: a, ă, â, n, m, o, ô, ơ, e, ê, u, ư, c, v, x); HS trả lời chi tiết; GV chốt.
     - Nhận xét sản phẩm viết theo đúng 4 tiêu chí: 1. Độ cao; 2. Độ rộng; 3. Nối nét; 4. Trình bày sạch đẹp.
  4. Với phần Đọc / Khám phá ngữ liệu / Nói và nghe:
     - Trích xuất nguyên văn câu nhận biết, từ ngữ, câu văn/đoạn đọc từ SGK; đánh dấu gạch chéo '/' chỗ ngắt nghỉ; ghi rõ tiếng dễ đọc sai.
     - Tổ chức đọc đa dạng: đọc mẫu, cá nhân, cặp đôi, nhóm, đồng thanh cả lớp.
     - Dự kiến ít nhất 1 lỗi sai thường gặp của HS và cách GV hướng dẫn sửa cụ thể.`;

    const workflowBlock = vtWorkflow ? `QUY TRÌNH BẮT BUỘC KHỐI LỚP (${vtWorkflow.label}):
- Trọng tâm sư phạm:
${vtWorkflow.pedagogicalFocus.map((f) => `  * ${f}`).join("\n")}
- Tiến trình chuẩn:
${vtWorkflow.stepsSummary.map((s) => `  * ${s}`).join("\n")}` : "";

    subjectGuidance = [
      vietnameseStrictGuidance,
      workflowBlock,
      mandatoryDialogueRules,
      deepScript,
      handwritingGuidance,
      digitalBlock,
    ].filter(Boolean).join("\n\n");
  } else if (sourceFacts.subjectKind === "natural-social") {
    subjectGuidance = naturalSocialStrictGuidance;
  } else {
    subjectGuidance = pedagogyProfileGuidance(input);
  }

  const feedbackInstruction = options.feedback
    ? `\nPHẢN HỒI CẦN SỬA ĐỔI TỪ LẦN TRƯỚC:\n${options.feedback}\nBẮT BUỘC: Sửa triệt để các vấn đề trên; đảm bảo hoạt động triển khai đầy đủ các mục tiêu phân bổ. Tuyệt đối KHÔNG bỏ sót bất kỳ mục tiêu nào.`
    : "";

  const prompt = `Soạn CHI TIẾT ĐƠN VỊ PHA: ${phaseLabel.toUpperCase()} (ID: "${activityId}").
Bài: "${identity.lessonTitle}" - Tiết ${periodNumber}/${identity.periods} - Thời lượng pha: ~${phaseBp.durationMinutes} phút.
Môn: ${input.subject} - Lớp: ${input.grade}.

NGỮ CẢNH BÀN GIAO TỪ PHA TRƯỚC:
${JSON.stringify(phaseInput)}

DỮ LIỆU ĐÃ KHÓA BẮT BUỘC TUÂN THỦ:
- YCCĐ phân bổ bắt buộc triển khai: ${JSON.stringify(outcomes.outcomes.objectiveMetadata.filter((o) => (phaseBp.objectiveIds || []).includes(o.id)).map((o) => ({ id: o.id, statement: o.statement, category: o.category })))}
- Đồ dùng có sẵn (Mục II): ${JSON.stringify(materials.items.map((m) => ({ id: m.id, label: m.label })))}
- Dữ kiện SGK/Nguồn: ${JSON.stringify(sourceFacts.facts.sourceEvidence.map((s) => ({ id: s.id, label: s.label, text: s.text })))}

QUY TẮC SƯ PHẠM:
${subjectGuidance}
${learningContextGuidance(input)}

YÊU CẦU ĐẦU RA:
1. Chỉ trả về duy nhất hoạt động này, đầy đủ các bước thực tế (teacherActions, studentActions) dùng dạy thật trên lớp.
2. BẮT BUỘC: Kịch bản đối thoại chi tiết theo cặp GV-HS:
   - teacherActions: Từng hành động bắt đầu bằng '-', câu hỏi chi tiết hoặc hướng dẫn cụ thể bắt đầu bằng '+', lời nhận xét/chốt trong ngoặc kép "GV nhận xét, kết luận: “...”". Tối thiểu 3-5 bước chi tiết.
   - studentActions: Tương ứng 1:1 với GV, câu trả lời chi tiết của HS bắt đầu bằng '+'.
   - Tuyệt đối CẤM viết tóm tắt hành chính ngắn 1-2 câu chung chung. Phải viết kịch bản chi tiết để giáo viên cầm giáo án có thể dạy được ngay.
3. BẮT BUỘC: Mỗi YCCĐ phân bổ PHẢI được hoạt động triển khai thực chất và gán đủ trong objectiveIds của pha này. Có thể bổ sung objectiveId hợp lệ khác nếu có tích hợp thực tế. Tuyệt đối KHÔNG bỏ sót bất kỳ mục tiêu nào.
4. Gán các materialIds ("mat-1",...), sourceIds ("src-1",...) THỰC TẾ được dùng trong pha này.
5. Sinh khối handoff: knowledge (kiến thức đã chốt), products (sản phẩm hoàn thành), pending (nhiệm vụ chuyển tiếp), bridge (câu nối sang pha sau).${feedbackInstruction}

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
    "successCriteria": string[],
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

  const phaseSourceIds = Array.isArray(parsed.sourceIds) ? parsed.sourceIds : [];
  const safeActivity = {
    ...parsed.activity,
    id: activityId,
    phase: phaseLabel,
    durationMinutes: (parsed.activity?.durationMinutes && parsed.activity.durationMinutes > 0)
      ? parsed.activity.durationMinutes
      : phaseBp.durationMinutes,
    objectiveIds: parsed.activity?.objectiveIds ?? [],
    learningProducts: parsed.activity?.learningProducts || phaseBp.learningProducts || [],
    successCriteria: (parsed.activity as any)?.successCriteria || [],
    sourceUnitIds: Array.isArray((parsed.activity as any)?.sourceUnitIds) && (parsed.activity as any).sourceUnitIds.length > 0
      ? (parsed.activity as any).sourceUnitIds
      : (phaseBp.sourceUnitIds?.length ? phaseBp.sourceUnitIds : phaseSourceIds),
    sourceClusterIds: Array.isArray((parsed.activity as any)?.sourceClusterIds) && (parsed.activity as any).sourceClusterIds.length > 0
      ? (parsed.activity as any).sourceClusterIds
      : (phaseBp.sourceClusterIds || []),
  };

  const payload = {
    activity: safeActivity,
    materialIds: parsed.materialIds || [],
    sourceIds: phaseSourceIds,
    handoff: parsed.handoff || {
      activityId,
      knowledge: [],
      products: safeActivity.learningProducts,
      pending: [],
      bridge: `Chuyển tiếp sau pha ${phaseLabel}.`,
      objectiveIds: safeActivity.objectiveIds || [],
      sourceIds: phaseSourceIds,
      materialIds: parsed.materialIds || [],
    },
  };

  const artifact: StagedPhaseArtifact = {
    version: 2,
    kind: "period-phase",
    subjectKind: sourceFacts.subjectKind,
    identity,
    anchor: { revision: 1, hash: "" },
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
  artifact.anchor = stagedArtifactAnchor(artifact);
  return artifact;
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
- GIỮ NGUYÊN HOẶC NÂNG CẤP cấu trúc kịch bản đối thoại chi tiết (câu hỏi '+', câu trả lời '+', lời GV chốt trong ngoặc kép “...”), tuyệt đối không tóm tắt ngắn gọn thành câu hành chính.
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
      sourceUnitIds: (parsed.activity as any)?.sourceUnitIds || currentPhase.activity.sourceUnitIds,
      sourceClusterIds: (parsed.activity as any)?.sourceClusterIds || currentPhase.activity.sourceClusterIds,
    };

    const payload = {
      activity: repairedActivity,
      materialIds: parsed.materialIds || currentPhase.materialIds,
      sourceIds: parsed.sourceIds || currentPhase.sourceIds,
      handoff: parsed.handoff || currentPhase.handoff,
    };

    const nextRevision = currentPhase.anchor.revision + 1;
    const artifact: StagedPhaseArtifact = {
      ...currentPhase,
      anchor: { revision: nextRevision, hash: "" },
      model: res.model,
      provider: res.provider,
      fallbackUsed: res.fallbackUsed,
      activity: payload.activity,
      materialIds: payload.materialIds,
      sourceIds: payload.sourceIds,
      handoff: payload.handoff,
    };
    artifact.anchor = stagedArtifactAnchor(artifact, nextRevision);
    return { artifact, repaired: true, issues: [] };
  } catch (err) {
    return { artifact: currentPhase, repaired: false, issues };
  }
}
