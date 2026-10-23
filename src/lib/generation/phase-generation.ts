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
import {
  generateGrade1WritingInteractionUnits,
  extractTargetVowels,
  extractAppliedWords,
} from "@/lib/vietnamese-stroke-engine";
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
    const mathStrictDialogueRules = `QUY TẮC BẮT BUỘC: KỊCH BẢN ĐỐI THOẠI 1:1 CHI TIẾT MÔN TOÁN LỚP 1-5 (CHUẨN KNTT & CTGDPT 2018):
- TUYỆT ĐỐI KHÔNG VIẾT CHUNG CHUNG (CẤM: "GV hướng dẫn HS tính", "HS lắng nghe và làm bài", "HS làm bài tập 1"). Giáo án phải cầm lên dạy được ngay.
- SỐ LƯỢNG BƯỚC CỦA GV VÀ HS BẮT BUỘC BẰNG NHAU (1:1). Cứ mỗi bước GV hỏi/nêu lệnh thì có đúng 1 bước HS trả lời/thực hiện tương ứng.
1. Cột Hoạt động của giáo viên (teacherActions):
   - Dùng gạch đầu dòng '-' cho hành động dẫn dắt, chiếu tranh, ghi bảng, phát phiếu.
   - Dùng dấu cộng '+' cho câu hỏi gợi mở tư duy toán học cụ thể (Ví dụ: + Bài toán cho biết gì? Bài toán hỏi gì? + Để tìm số xúc tu của 2 con bạch tuộc, ta làm phép tính gì? Vì sao?).
   - Lời nhận xét, chốt kiến thức đặt trong ngoặc kép:
     Ví dụ: "GV nhận xét, kết luận: Mỗi con bạch tuộc có 8 xúc tu, 2 con có \\(8 \\times 2 = 16\\) (xúc tu)."
2. Cột Hoạt động của học sinh (studentActions):
   - Trả lời ĐẦY ĐỦ câu, nêu rõ số liệu, phép tính, kết quả và đơn vị:
     Ví dụ: "HS trả lời: 2 con bạch tuộc có tất cả \\(8 \\times 2 = 16\\) xúc tu."
   - CẤM câu vô hồn như "HS lắng nghe", "HS thực hiện nhiệm vụ theo hướng dẫn".
3. QUY TẮC NỘI DUNG VÀ CÔNG THỨC TOÁN HỌC:
   - MỌI phép tính số học, công thức toán PHẢI bọc trong \\( ... \\), ví dụ: \\(8 \\times 2 = 16\\), \\(16 : 8 = 2\\), \\(8 + 8 = 16\\).
   - Nếu bài 2 tiết (như Bài 11: Bảng nhân 8, bảng chia 8):
     + TIẾT 1 CHỈ dạy BẢNG NHÂN, TUYỆT ĐỐI KHÔNG đưa bảng chia vào Tiết 1.
     + TIẾT 2 MỚI dạy BẢNG CHIA dựa trên mối quan hệ với bảng nhân.
   - CẤM lặp lại cùng một ngữ liệu bài toán (như bài 4 hộp bút chì màu hoặc bạch tuộc) qua các hoạt động hay qua các tiết. Mỗi hoạt động PHẢI có tình huống/bài toán khác nhau từ SGK KNTT (như bài rô-bốt xếp bánh chia đĩa, đếm chân cua, chia đội chơi, đếm cánh hoa...).`;

    subjectGuidance = `${mathLatexPolicy}\n${mathGradeBandGuidance(input)}\n${mathStrictDialogueRules}`;
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
     - BẮT BUỘC tổ chức theo đúng mô hình 7 Đơn vị Tương tác Kết hợp (Hybrid Interaction Units):
       + Đơn vị 1: GV hỏi chi tiết cấu tạo, số nét, độ cao, độ rộng từng chữ cái; HS trả lời tương ứng 1:1.
       + Đơn vị 2: GV nhận xét, chốt kiến thức nguyên văn trong ngoặc kép "GV nhận xét, kết luận: “...”"; HS lắng nghe, ghi nhớ.
       + Đơn vị 3: GV thị phạm viết vần mẫu, mô tả chi tiết từng nét (đặt bút ở ĐK mấy, uốn lượn, lia bút, nối nét, dừng bút ở ĐK mấy); HS chú ý quan sát và mô phỏng nét viết trên không.
       + Đơn vị 4: Luyện viết bảng con vần; GV quan sát uốn nắn, sửa lỗi theo 4 tiêu chí (độ cao, độ rộng, nối nét, trình bày sạch đẹp); HS viết, giơ bảng.
       + Đơn vị 5: Chiếu tranh nhận biết từ ứng dụng -> Phân loại độ cao các con chữ trong từ (nhóm 5 ô li, 4 ô li, 3 ô li, 2,5 ô li, 2 ô li); HS trả lời; GV chốt.
       + Đơn vị 6: GV thị phạm viết từ ứng dụng cực kỳ chi tiết theo lời GV: từng nét con chữ tiếng 1 (đặt bút ĐK, chạm ĐK 6/3/2/1, uốn nét khuyết/thắt, dừng bút, dấu thanh) -> quy định khoảng cách bằng 1 thân con chữ o (khoảng 1,5 ô li) -> từng nét con chữ tiếng 2 -> lời dặn dò chốt chuẩn toàn từ; HS quan sát, luyện viết trên không.
       + Đơn vị 7: Viết bảng con từ -> Viết vở tập viết; GV nhắc tư thế ngồi viết, cách cầm bút; HS viết vở và đổi vở nhận xét chéo theo 4 tiêu chí.
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
    "learningProducts": [string],
    "successCriteria": string[],
    "expectedAnswer": string,
    "commonErrors": string[],
    "teacherFeedback": string[],
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
    expectedAnswer: (parsed.activity as any)?.expectedAnswer || "",
    commonErrors: Array.isArray((parsed.activity as any)?.commonErrors) ? (parsed.activity as any).commonErrors : [],
    teacherFeedback: Array.isArray((parsed.activity as any)?.teacherFeedback) ? (parsed.activity as any).teacherFeedback : [],
    sourceUnitIds: Array.isArray((parsed.activity as any)?.sourceUnitIds) && (parsed.activity as any).sourceUnitIds.length > 0
      ? (parsed.activity as any).sourceUnitIds
      : (phaseBp.sourceUnitIds?.length ? phaseBp.sourceUnitIds : phaseSourceIds),
    sourceClusterIds: Array.isArray((parsed.activity as any)?.sourceClusterIds) && (parsed.activity as any).sourceClusterIds.length > 0
      ? (parsed.activity as any).sourceClusterIds
      : (phaseBp.sourceClusterIds || []),
  };

  // Grade 1 Vietnamese Handwriting Enhancement: Ensure extreme detail & 7 Hybrid Interaction Units
  if (
    parseInt(String(input.grade || "").replace(/\D/g, ""), 10) === 1 &&
    input.subject === "Tiếng Việt" &&
    /viết|tập viết|luyện viết|bảng con|vở/i.test(`${safeActivity.title || ""} ${safeActivity.phase || ""} ${phaseBp.title || ""}`)
  ) {
    const teacherText = (safeActivity.teacherActions || []).join(" ");
    const hasGridLines = /đường kẻ|đk\s*\d|ô li/i.test(teacherText);
    const hasLetterHeights = /cao \d ô li|độ cao/i.test(teacherText);
    const isTooBrief = (safeActivity.teacherActions || []).length < 5;

    if (!hasGridLines || !hasLetterHeights || isTooBrief) {
      const targetVowels = extractTargetVowels(input.lessonTitle);
      const evidenceTexts: string[] = sourceFacts.facts?.sourceEvidence?.map((e: any) => e.text || "") || [];
      const appliedWords = extractAppliedWords(evidenceTexts, input.lessonTitle);
      const canonicalUnits = generateGrade1WritingInteractionUnits(targetVowels, appliedWords);

      safeActivity.teacherActions = canonicalUnits.teacherActions;
      safeActivity.studentActions = canonicalUnits.studentActions;
      if (!safeActivity.learningProducts || safeActivity.learningProducts.length === 0) {
        safeActivity.learningProducts = ["Bảng con viết đúng vần và từ", "Vở Tập viết trình bày sạch đẹp đúng mẫu"];
      }
      if (!safeActivity.successCriteria || safeActivity.successCriteria.length === 0) {
        safeActivity.successCriteria = [
          "Viết đúng độ cao, độ rộng con chữ",
          "Nối nét đúng quy chuẩn",
          "Khoảng cách giữa hai tiếng bằng một thân con chữ o",
          "Trình bày sạch đẹp",
        ];
      }
    }
  }

  // All Subjects Enhancement: Ensure 1:1 action pairing, meaningful student dialogue, and no robotic placeholders
  {
    const tActions = Array.isArray(safeActivity.teacherActions) ? [...safeActivity.teacherActions] : [];
    const sActions = Array.isArray(safeActivity.studentActions) ? [...safeActivity.studentActions] : [];

    if (tActions.length > sActions.length) {
      const alignedSActions: string[] = [];
      let sCursor = 0;
      for (let i = 0; i < tActions.length; i++) {
        const t = tActions[i];
        const tTrimmed = t.trim();
        const isTeacherQuestion = /^\+/.test(tTrimmed) || /\?|bao nhiêu|mấy|như thế nào|tại sao|vì sao|nêu|hãy/i.test(tTrimmed);
        if (isTeacherQuestion && sCursor < sActions.length) {
          alignedSActions.push(sActions[sCursor++]);
        } else if (sCursor < sActions.length && tActions.length - i <= sActions.length - sCursor) {
          alignedSActions.push(sActions[sCursor++]);
        } else if (/^["“]?(?:gv\s+)?(?:nhận xét|chốt|kết luận)/i.test(tTrimmed)) {
          alignedSActions.push("- HS lắng nghe nhận xét của GV, ghi nhớ kiến thức trọng tâm và tự kiểm tra kết quả.");
        } else if (/chiếu|quan sát|tranh|sơ đồ|mô hình|bảng/i.test(tTrimmed)) {
          alignedSActions.push("- HS quan sát hình ảnh/ngữ liệu trên màn hình và nhận diện các thông tin chính.");
        } else if (/phát phiếu|giao nhiệm vụ|tổ chức|thảo luận|cặp đôi|nhóm/i.test(tTrimmed)) {
          alignedSActions.push("- HS nhận nhiệm vụ, trao đổi cùng bạn và hoàn thành yêu cầu trên phiếu/bảng con.");
        } else {
          alignedSActions.push("- HS theo dõi hướng dẫn của GV và chuẩn bị thực hiện bước tiếp theo.");
        }
      }
      while (sCursor < sActions.length && alignedSActions.length > 0) {
        alignedSActions[alignedSActions.length - 1] += ` ${sActions[sCursor++]}`;
      }
      safeActivity.teacherActions = tActions;
      safeActivity.studentActions = alignedSActions;
    } else if (sActions.length > tActions.length) {
      for (let i = tActions.length; i < sActions.length; i++) {
        tActions.push("- GV quan sát, lắng nghe câu trả lời của HS và hướng dẫn điều chỉnh nếu cần.");
      }
      safeActivity.teacherActions = tActions;
      safeActivity.studentActions = sActions;
    }
  }

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

    if (
      parseInt(String(input.grade || "").replace(/\D/g, ""), 10) === 1 &&
      input.subject === "Tiếng Việt" &&
      /viết|tập viết|luyện viết|bảng con|vở/i.test(`${repairedActivity.title || ""} ${repairedActivity.phase || ""}`)
    ) {
      const teacherText = (repairedActivity.teacherActions || []).join(" ");
      const hasGridLines = /đường kẻ|đk\s*\d|ô li/i.test(teacherText);
      const hasLetterHeights = /cao \d ô li|độ cao/i.test(teacherText);
      const isTooBrief = (repairedActivity.teacherActions || []).length < 5;

      if (!hasGridLines || !hasLetterHeights || isTooBrief) {
        const targetVowels = extractTargetVowels(input.lessonTitle);
        const evidenceTexts: string[] = sourceFacts.facts?.sourceEvidence?.map((e: any) => e.text || "") || [];
        const appliedWords = extractAppliedWords(evidenceTexts, input.lessonTitle);
        const canonicalUnits = generateGrade1WritingInteractionUnits(targetVowels, appliedWords);

        repairedActivity.teacherActions = canonicalUnits.teacherActions;
        repairedActivity.studentActions = canonicalUnits.studentActions;
        if (!repairedActivity.learningProducts || repairedActivity.learningProducts.length === 0) {
          repairedActivity.learningProducts = ["Bảng con viết đúng vần và từ", "Vở Tập viết trình bày sạch đẹp đúng mẫu"];
        }
        if (!repairedActivity.successCriteria || repairedActivity.successCriteria.length === 0) {
          repairedActivity.successCriteria = [
            "Viết đúng độ cao, độ rộng con chữ",
            "Nối nét đúng quy chuẩn",
            "Khoảng cách giữa hai tiếng bằng một thân con chữ o",
            "Trình bày sạch đẹp",
          ];
        }
      }
    }

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
