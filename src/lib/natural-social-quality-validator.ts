import { activityPhaseKey } from "@/lib/lesson-format";
import {
  classifyNaturalSocialLesson,
  isNaturalSocialSubjectName,
  naturalSocialSourceInventoryText,
  naturalSocialLessonTypeProfiles,
  normalizeNaturalSocialText,
} from "@/lib/natural-social-pedagogy";
import {
  hasNaturalSocialOutsideSgkMislabel,
  hasNaturalSocialStartupBridge,
  isNaturalSocialGradeOneTextHeavyStartup,
  isWeakNaturalSocialStartup,
  naturalSocialStartupFingerprint,
} from "@/lib/natural-social-startup";
import type {
  LessonActivity,
  LessonInput,
  LessonPlan,
  NaturalSocialLessonType,
  PedagogyAuditFinding,
} from "@/types/lesson";

type NaturalSocialRule = {
  code: string;
  severity: PedagogyAuditFinding["severity"];
  autoFixable: boolean;
};

type Scope = {
  periodNumber?: number;
  focus?: string;
  activities: LessonActivity[];
};

type ActivityLocation = {
  activity: LessonActivity;
  activityIndex: number;
  periodNumber?: number;
};

export const naturalSocialQualityRules = {
  missingObservation: { code: "NSXH-QUALITY-01", severity: "error", autoFixable: true },
  missingEvidenceProduct: { code: "NSXH-QUALITY-02", severity: "warning", autoFixable: true },
  missingCompareOrClassify: { code: "NSXH-QUALITY-03", severity: "warning", autoFixable: true },
  missingApplicationAction: { code: "NSXH-QUALITY-04", severity: "warning", autoFixable: true },
  missingInquiryQuestion: { code: "NSXH-QUALITY-05", severity: "warning", autoFixable: true },
  unsafeActivity: { code: "NSXH-QUALITY-06", severity: "error", autoFixable: true },
  gradeOverload: { code: "NSXH-QUALITY-07", severity: "warning", autoFixable: true },
  missingTypeSignal: { code: "NSXH-QUALITY-08", severity: "warning", autoFixable: true },
  missingCriteria: { code: "NSXH-QUALITY-09", severity: "warning", autoFixable: true },
  genericStartup: { code: "NSXH-QUALITY-10", severity: "warning", autoFixable: true },
  startupMissingBridge: { code: "NSXH-QUALITY-11", severity: "warning", autoFixable: true },
  startupOutsideSgkMislabel: { code: "NSXH-QUALITY-12", severity: "error", autoFixable: true },
  startupTooTextHeavyForGrade1: { code: "NSXH-QUALITY-13", severity: "warning", autoFixable: true },
  duplicateStartup: { code: "NSXH-QUALITY-14", severity: "warning", autoFixable: true },
  sourceDetailPromotedToOutcome: { code: "NSXH-QUALITY-15", severity: "error", autoFixable: true },
  offFocusFamilyContent: { code: "NSXH-QUALITY-16", severity: "error", autoFixable: true },
  publicAddressDisclosure: { code: "NSXH-QUALITY-17", severity: "error", autoFixable: true },
  machineTextLeak: { code: "NSXH-QUALITY-18", severity: "error", autoFixable: true },
  gradeOneReadingWritingOverload: { code: "NSXH-QUALITY-19", severity: "warning", autoFixable: true },
  missingOutcomeTaskMap: { code: "NSXH-QUALITY-20", severity: "warning", autoFixable: true },
} as const satisfies Record<string, NaturalSocialRule>;

const observationPattern = /quan sát|tranh|ảnh sgk|vật thật|mô hình|mẫu vật|thẻ hình|sân trường|lớp học|nơi em sống|bầu trời|thời tiết|cây thật|lá|hoa|con vật|cơ thể/i;
const evidencePattern = /phiếu|bảng|ghi lại|đánh dấu|vẽ|sơ đồ|thẻ|tranh|kết quả quan sát|minh chứng|sản phẩm|báo cáo|chia sẻ kết quả/i;
const compareClassifyPattern = /mô tả|so sánh|giống|khác|phân loại|nhóm|tiêu chí|đặc điểm|dấu hiệu|sắp xếp/i;
const applicationPattern = /việc nên làm|việc không nên làm|an toàn|vệ sinh|rửa tay|chăm sóc|bảo vệ|môi trường|sức khỏe|ở nhà|ở trường|nơi công cộng|cam kết|thực hiện|ứng xử|giúp đỡ|chia sẻ/i;
const inquiryPattern = /câu hỏi|dự đoán|con thấy gì|vì sao|điều gì xảy ra|làm thế nào|theo em|nếu|khám phá|tìm hiểu/i;
const unsafePattern = /uống thử|nếm thử|ngửi trực tiếp|chạm vào ổ điện|dao sắc|kéo sắc|hóa chất|đun nóng|lửa|leo trèo|bắt côn trùng|đuổi bắt động vật|ra đường một mình/i;
const gradeOverloadPattern = /quang hợp|hệ sinh thái|chuỗi thức ăn|cấu tạo tế bào|kinh tuyến|vĩ tuyến|áp suất khí quyển|phản ứng hóa học|công thức hóa học|phân tích số liệu phức tạp/i;
const naturalSocialCriteriaPattern = /mô tả được|quan sát được|nêu được|phân loại được|so sánh được|thực hiện được|chọn đúng|đề xuất được|tiêu chí|bằng chứng|hành động/i;
const sourceDetailOutcomePattern = /\btrong tranh\b|\bnhà\s+(?:minh|an|nam|mai|lan|hoa)\b|\bđường\s+hoa ban\b/i;
const offFocusFamilyPattern = /thẻ việc tốt|nhịp vỗ việc nhà|việc nhà|lau bàn|quét nhà|nấu ăn|gấp quần áo|chăm em|giúp gia đình|nhà gọn\s*[-–]\s*nhà an toàn|ổ điện|bếp nóng|hóa chất|vật sắc nhọn/i;
const publicAddressPattern = /(?:đọc|nói|chia sẻ|công khai|viết|ghi).{0,70}(?:địa chỉ nhà|địa chỉ nơi ở).{0,70}(?:thật|đầy đủ|trước lớp|cả lớp|trưng bày)|(?:địa chỉ nhà|địa chỉ nơi ở).{0,70}(?:thật|đầy đủ).{0,70}(?:trước lớp|cả lớp|công khai|trưng bày)/i;
const machineTextPattern = /\b(?:S|V|Q|L)\d+\b|\.\s*[:;]|;\s*[.;]/i;
const gradeOneWritingActionPattern = /viết|ghi|điền|đọc mẫu|đọc bài|đổi (?:phiếu|thiệp|bài)|tự sửa|viết lại|trưng bày/gi;
const gradeOneComplexWritingProductPattern = /thiệp|lời mời|thời gian|địa điểm|địa chỉ|phiếu chữ|bảng nhiều ô|đoạn|ba thành phần|3 thành phần/i;

function finding(rule: NaturalSocialRule, message: string, location: Partial<PedagogyAuditFinding> = {}): PedagogyAuditFinding {
  return { code: rule.code, severity: rule.severity, autoFixable: rule.autoFixable, message, ...location };
}

function scopes(lesson: LessonPlan): Scope[] {
  if (lesson.periodPlans?.length) {
    return lesson.periodPlans.map((period) => ({
      periodNumber: period.periodNumber,
      focus: period.focus,
      activities: period.activities || [],
    }));
  }
  return [{ focus: lesson.generalInfo.lessonTitle, activities: lesson.activities || [] }];
}

function locations(scope: Scope): ActivityLocation[] {
  return scope.activities.map((activity, activityIndex) => ({ activity, activityIndex, periodNumber: scope.periodNumber }));
}

function activityText(activity: LessonActivity) {
  return [
    activity.phase,
    activity.title,
    activity.objective,
    ...(activity.inputOrMaterials || []),
    ...(activity.teacherActions || []),
    ...(activity.studentActions || []),
    ...(activity.learningProducts || []),
    ...(activity.successCriteria || []),
    activity.expectedAnswer || "",
    ...(activity.acceptableResponses || []),
    ...(activity.commonErrors || []),
    ...(activity.teacherFeedback || []),
    ...(activity.errorFeedback || []).flatMap((item) => [item.error, ...item.feedback]),
    ...(activity.supportForStudentsNeedingHelp || []),
    ...(activity.extensionForEarlyFinishers || []),
  ].join(" ");
}

function scopeText(scope: Scope) {
  return [scope.focus || "", ...scope.activities.map(activityText)].join(" ");
}

function scopeLabel(scope: Scope) {
  return scope.periodNumber ? `Tiết ${scope.periodNumber}` : "Giáo án";
}

function gradeNumber(value: string) {
  const match = String(value || "").match(/([1-5])/);
  return match ? Number(match[1]) : 0;
}

function outcomeText(lesson: LessonPlan) {
  const outcomes = [lesson.outcomes, ...(lesson.periodPlans || []).map((period) => period.outcomes).filter(Boolean)];
  return outcomes.flatMap((item) => [
    ...(item?.generalCompetencies || []),
    ...(item?.specificCompetencies || []),
    ...(item?.qualities || []),
    ...(item?.knowledgeAndSkills || []),
    ...(item?.digitalCompetencies || []),
  ]).join(" ");
}

function lessonActivities(lesson: LessonPlan) {
  return lesson.periodPlans?.length
    ? lesson.periodPlans.flatMap((period) => period.activities || [])
    : lesson.activities || [];
}

function outcomeMetadata(lesson: LessonPlan) {
  return [lesson.outcomes, ...(lesson.periodPlans || []).map((period) => period.outcomes).filter(Boolean)]
    .flatMap((outcomes) => outcomes?.objectiveMetadata || []);
}

function typeSignalIssue(type: NaturalSocialLessonType, text: string, label: string, periodNumber?: number) {
  if (type === "mixed") return null;
  const profile = naturalSocialLessonTypeProfiles[type];
  if (!profile || profile.checkerMustHave.test(text) || profile.keywordPattern.test(normalizeNaturalSocialText(text))) return null;
  return finding(
    naturalSocialQualityRules.missingTypeSignal,
    `${label} được nhận diện là chủ đề ${profile.label} nhưng chưa có nội dung/hoạt động đặc trưng của chủ đề này.`,
    { periodNumber },
  );
}

export function validateNaturalSocialLesson(
  lesson: LessonPlan,
  input: LessonInput,
  forcedLessonType?: NaturalSocialLessonType,
): PedagogyAuditFinding[] {
  if (!isNaturalSocialSubjectName(input.subject || lesson.generalInfo.subject)) return [];
  const findings: PedagogyAuditFinding[] = [];
  const grade = gradeNumber(input.grade || lesson.generalInfo.grade);
  const sourceInventory = lesson.meta?.naturalSocialSourceInventory;
  const sourceText = naturalSocialSourceInventoryText(sourceInventory);
  const inferredClassification = classifyNaturalSocialLesson(input, sourceText);
  const classification = forcedLessonType
    ? { ...inferredClassification, primaryType: forcedLessonType }
    : inferredClassification;
  const lessonType = classification.primaryType;
  const startupFingerprints = new Map<string, { label: string; periodNumber?: number; activityIndex: number }>();

  if (sourceDetailOutcomePattern.test(outcomeText(lesson))) {
    findings.push(finding(
      naturalSocialQualityRules.sourceDetailPromotedToOutcome,
      "Yêu cầu cần đạt đang chứa chi tiết nhân vật/địa điểm của tranh SGK; hãy giữ chi tiết đó làm ngữ liệu khám phá và viết mục tiêu thành năng lực có thể chuyển sang tình huống khác.",
    ));
  }

  const sourceContainsOffFocusFamilyContent = offFocusFamilyPattern.test(sourceText);
  const requiredSourceTasks = (sourceInventory?.requiredTasks || []).filter((task) => task.required !== false && task.taskId);
  if (requiredSourceTasks.length) {
    const metadata = outcomeMetadata(lesson);
    const activitiesById = new Map(lessonActivities(lesson).filter((activity) => activity.id).map((activity) => [activity.id as string, activity]));
    const mappedTaskIds = new Set(metadata.flatMap((item) => item.evidence.activityIds)
      .map((activityId) => activitiesById.get(activityId))
      .filter((activity): activity is LessonActivity => Boolean(activity))
      .flatMap((activity) => activity.sourceTaskIds || []));
    const missingTaskIds = requiredSourceTasks.map((task) => task.taskId as string).filter((taskId) => !mappedTaskIds.has(taskId));
    if (!metadata.length || missingTaskIds.length) {
      findings.push(finding(
        naturalSocialQualityRules.missingOutcomeTaskMap,
        !metadata.length
          ? "Bài đã khóa nhiệm vụ SGK nhưng chưa có objectiveMetadata để nối YCCĐ → hoạt động → sản phẩm → tiêu chí."
          : `Các nhiệm vụ SGK bắt buộc chưa được nối tới YCCĐ qua objectiveMetadata/activityId: ${missingTaskIds.join(", ")}.`,
      ));
    }
  }

  scopes(lesson).forEach((scope) => {
    const label = scopeLabel(scope);
    const text = scopeText(scope);
    const normalized = normalizeNaturalSocialText(text);

    if (!observationPattern.test(text)) {
      findings.push(finding(
        naturalSocialQualityRules.missingObservation,
        `${label} thiếu hoạt động quan sát từ tranh, vật thật, mô hình hoặc môi trường gần gũi trước khi kết luận.`,
        { periodNumber: scope.periodNumber },
      ));
    }

    if (!inquiryPattern.test(text)) {
      findings.push(finding(
        naturalSocialQualityRules.missingInquiryQuestion,
        `${label} thiếu câu hỏi/vấn đề khám phá để học sinh nêu dự đoán hoặc phát hiện từ quan sát.`,
        { periodNumber: scope.periodNumber },
      ));
    }

    if (!compareClassifyPattern.test(text)) {
      findings.push(finding(
        naturalSocialQualityRules.missingCompareOrClassify,
        `${label} thiếu nhiệm vụ mô tả, so sánh hoặc phân loại theo tiêu chí đơn giản.`,
        { periodNumber: scope.periodNumber },
      ));
    }

    if (!evidencePattern.test(text)) {
      findings.push(finding(
        naturalSocialQualityRules.missingEvidenceProduct,
        `${label} thiếu bằng chứng/sản phẩm học tập như phiếu quan sát, bảng phân loại, tranh, thẻ hoặc báo cáo ngắn.`,
        { periodNumber: scope.periodNumber },
      ));
    }

    if (!applicationPattern.test(text)) {
      findings.push(finding(
        naturalSocialQualityRules.missingApplicationAction,
        `${label} thiếu hành động vận dụng vào an toàn, vệ sinh, sức khỏe, gia đình, trường học, địa phương hoặc môi trường.`,
        { periodNumber: scope.periodNumber },
      ));
    }

    const criteriaText = [
      ...(lesson.assessment?.criteria || []),
      ...scope.activities.flatMap((activity) => activity.successCriteria || []),
    ].join(" ");
    if (!naturalSocialCriteriaPattern.test(criteriaText)) {
      findings.push(finding(
        naturalSocialQualityRules.missingCriteria,
        `${label} thiếu tiêu chí đánh giá quan sát được cho mô tả, so sánh/phân loại, sản phẩm hoặc hành động vận dụng.`,
        { periodNumber: scope.periodNumber },
      ));
    }

    if (grade <= 3 && gradeOverloadPattern.test(text)) {
      findings.push(finding(
        naturalSocialQualityRules.gradeOverload,
        `${label} có thuật ngữ/nhiệm vụ vượt mức TNXH lớp 1-3; cần chuyển về quan sát, mô tả và giải thích đơn giản.`,
        { periodNumber: scope.periodNumber },
      ));
    }

    const typeIssue = typeSignalIssue(lessonType, text, label, scope.periodNumber);
    if (typeIssue) findings.push(typeIssue);

    locations(scope).forEach(({ activity, activityIndex, periodNumber }) => {
      const activityContent = activityText(activity);
      const phase = activityPhaseKey(activity);
      const location = { periodNumber, activityId: activity.id, activityIndex };

      if (unsafePattern.test(activityContent)) {
        findings.push(finding(
          naturalSocialQualityRules.unsafeActivity,
          `${label}, ${activity.phase || "Hoạt động"} có nguy cơ thiếu an toàn với học sinh lớp 1-3; cần thay bằng tranh, mô hình, vật thật an toàn hoặc GV làm mẫu.`,
          location,
        ));
      }

      if (classification.primaryType === "family"
        && classification.topicFocus === "home-environment"
        && !sourceContainsOffFocusFamilyContent
        && offFocusFamilyPattern.test(activityContent)) {
        findings.push(finding(
          naturalSocialQualityRules.offFocusFamilyContent,
          `${label}, ${activity.phase || "Hoạt động"} tự chèn nội dung việc nhà/an toàn vào bài về ngôi nhà, phòng hoặc đồ dùng dù sourceInventory SGK không yêu cầu.`,
          location,
        ));
      }

      if (publicAddressPattern.test(activityContent)) {
        findings.push(finding(
          naturalSocialQualityRules.publicAddressDisclosure,
          `${label}, ${activity.phase || "Hoạt động"} yêu cầu công khai địa chỉ thật/đầy đủ. HS cần biết địa chỉ nhưng chỉ nên được kiểm tra riêng, theo cặp tin cậy hoặc phối hợp phụ huynh; sản phẩm trưng bày dùng địa chỉ giả định.`,
          location,
        ));
      }

      if (machineTextPattern.test(activityContent)) {
        findings.push(finding(
          naturalSocialQualityRules.machineTextLeak,
          `${label}, ${activity.phase || "Hoạt động"} còn ký hiệu nội bộ hoặc dấu câu lỗi như S1/V2/Q1/L1, “.:” hoặc “.;”; cần làm sạch trước khi xuất giáo án.`,
          location,
        ));
      }

      const writingActionCount = activityContent.match(gradeOneWritingActionPattern)?.length || 0;
      if (grade <= 1
        && Number(activity.durationMinutes || 0) <= 12
        && writingActionCount >= 4
        && gradeOneComplexWritingProductPattern.test(activityContent)) {
        findings.push(finding(
          naturalSocialQualityRules.gradeOneReadingWritingOverload,
          `${label}, ${activity.phase || "Hoạt động"} dồn nhiều bước đọc/viết/sửa sản phẩm trong thời gian ngắn cho lớp 1; cần ưu tiên quan sát → chỉ/chọn → nói → vẽ, dùng mẫu in sẵn hoặc giao hoàn thiện có hỗ trợ.`,
          location,
        ));
      }

      if ((phase === "Khám phá" || phase === "Luyện tập") && /phan loai theo cam tinh|thich hay khong thich|chon theo so thich/i.test(normalized)) {
        findings.push(finding(
          naturalSocialQualityRules.missingCompareOrClassify,
          `${label}, ${activity.phase || "Hoạt động"} cần phân loại theo tiêu chí quan sát được, không theo cảm tính hoặc sở thích.`,
          location,
        ));
      }

      if (phase === "Khởi động") {
        if (isWeakNaturalSocialStartup(activity)) {
          findings.push(finding(
            naturalSocialQualityRules.genericStartup,
            `${label}, Khởi động còn chung chung hoặc lộ nhãn nội bộ; cần có tên hoạt động, học liệu/tín hiệu, luật chơi/cách tổ chức và câu hỏi gợi mở rõ.`,
            location,
          ));
        }

        if (!hasNaturalSocialStartupBridge(activity)) {
          findings.push(finding(
            naturalSocialQualityRules.startupMissingBridge,
            `${label}, Khởi động chưa có câu hỏi/lời chuyển nối tự nhiên sang tranh hoặc nhiệm vụ SGK của bài.`,
            location,
          ));
        }

        if (hasNaturalSocialOutsideSgkMislabel(activity)) {
          findings.push(finding(
            naturalSocialQualityRules.startupOutsideSgkMislabel,
            `${label}, Khởi động dùng học liệu gợi mở ngoài SGK nhưng có dấu hiệu gọi nhầm là học liệu/tranh SGK.`,
            location,
          ));
        }

        if (isNaturalSocialGradeOneTextHeavyStartup(activity, grade)) {
          findings.push(finding(
            naturalSocialQualityRules.startupTooTextHeavyForGrade1,
            `${label}, Khởi động lớp 1 đang nặng đọc/viết/phiếu chữ; cần chuyển sang nhìn, nghe, nói, giơ thẻ hoặc vận động nhẹ.`,
            location,
          ));
        }

        const fingerprint = naturalSocialStartupFingerprint(activity);
        if (scope.periodNumber && fingerprint) {
          const previous = startupFingerprints.get(fingerprint);
          if (previous && previous.periodNumber !== scope.periodNumber) {
            findings.push(finding(
              naturalSocialQualityRules.duplicateStartup,
              `${label}, Khởi động lặp lại gần như cùng hình thức với ${previous.label}; mỗi tiết TNXH nên có cách vào bài riêng sát trọng tâm tiết.`,
              location,
            ));
          } else {
            startupFingerprints.set(fingerprint, { label, periodNumber: scope.periodNumber, activityIndex });
          }
        }
      }
    });
  });

  const seen = new Set<string>();
  return findings.filter((item) => {
    const key = `${item.code}|${item.periodNumber ?? 0}|${item.activityId ?? item.activityIndex ?? -1}|${item.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
