import { activityPhaseKey, safeStringArray } from "@/lib/lesson-format";
import {
  genericActivityPatterns,
  genericOutcomePatterns,
  lessonQualityRules,
  observableOutcomeVerbPattern,
  stigmatizingStudentLabelPattern,
  type LessonQualityRule,
} from "@/lib/lesson-quality-rules";
import type { LessonActivity, LessonOutcomeMetadata, LessonOutcomes, LessonPlan, PedagogyAuditFinding } from "@/types/lesson";

type ActivityLocation = {
  activity: LessonActivity;
  activityIndex: number;
  periodNumber?: number;
};

const outcomeGroups = ["generalCompetencies", "specificCompetencies", "qualities", "knowledgeAndSkills", "digitalCompetencies"] as const;

function finding(rule: LessonQualityRule, message: string, location: Partial<PedagogyAuditFinding> = {}): PedagogyAuditFinding {
  return { code: rule.code, severity: rule.severity, autoFixable: rule.autoFixable, message, ...location };
}

function outcomeEntries(outcomes?: Partial<LessonOutcomes>) {
  return outcomeGroups.flatMap((category) => (outcomes?.[category] || []).map((statement, index) => ({ category, statement, index })));
}

function lessonActivities(lesson: LessonPlan): ActivityLocation[] {
  if (lesson.periodPlans?.length) {
    return lesson.periodPlans.flatMap((period) =>
      (period.activities || []).map((activity, activityIndex) => ({ activity, activityIndex, periodNumber: period.periodNumber })),
    );
  }
  return (lesson.activities || []).map((activity, activityIndex) => ({ activity, activityIndex }));
}

function activityLabel(location: ActivityLocation) {
  const prefix = location.periodNumber ? `Tiết ${location.periodNumber}, ` : "";
  return `${prefix}${location.activity.phase || "Hoạt động"} ${location.activity.title || location.activityIndex + 1}`;
}

function isCoreActivity(activity: LessonActivity) {
  const phase = activityPhaseKey(activity);
  return phase === "Khám phá" || phase === "Luyện tập";
}

function hasAnyText(value: unknown) {
  return safeStringArray(value).some((item) => item.trim());
}

function hasLegacyDifferentiation(activity: LessonActivity, kind: "support" | "extension") {
  const text = JSON.stringify(activity);
  return kind === "support"
    ? /học sinh cần hỗ trợ|học sinh còn gặp khó khăn|hs cần hỗ trợ|từ khóa|khung câu|chia nhỏ nhiệm vụ|câu hỏi gợi/i.test(text)
    : /hoàn thành sớm|mở rộng|nâng cao|thử thách|ví dụ mới|giải thích lí do|giải thích lý do/i.test(text);
}

function validateOutcomeMetadata(metadata: LessonOutcomeMetadata[] | undefined, activityIds: Set<string>) {
  if (!metadata?.length) return [];
  return metadata.flatMap((item) => {
    const hasActivity = item.evidence.activityIds.length > 0 && item.evidence.activityIds.some((id) => activityIds.has(id));
    const hasProducts = hasAnyText(item.evidence.learningProducts);
    const hasCriteria = hasAnyText(item.evidence.successCriteria);
    if (hasActivity && hasProducts && hasCriteria) return [];
    return [finding(
      lessonQualityRules.missingOutcomeEvidence,
      `Mục tiêu ${item.id} chưa liên kết đủ hoạt động tồn tại, sản phẩm và tiêu chí đánh giá.`,
      { objectiveId: item.id },
    )];
  });
}

export function validateLessonQuality(lesson: LessonPlan): PedagogyAuditFinding[] {
  const findings: PedagogyAuditFinding[] = [];
  const activities = lessonActivities(lesson);
  const activityIds = new Set(activities.map(({ activity }) => activity.id).filter((id): id is string => Boolean(id)));
  const outcomeSets = [lesson.outcomes, ...(lesson.periodPlans || []).map((period) => period.outcomes)];

  outcomeSets.forEach((outcomes, outcomeSetIndex) => {
    outcomeEntries(outcomes).forEach(({ category, statement, index }) => {
      const location = outcomeSetIndex > 0 ? { periodNumber: lesson.periodPlans?.[outcomeSetIndex - 1]?.periodNumber } : {};
      if (genericOutcomePatterns.some((pattern) => pattern.test(statement))) {
        findings.push(finding(lessonQualityRules.genericOutcome, `Yêu cầu ${category} ${index + 1} là câu chung chung: “${statement}”.`, location));
      } else if (!observableOutcomeVerbPattern.test(statement)) {
        findings.push(finding(lessonQualityRules.unobservableOutcome, `Yêu cầu ${category} ${index + 1} chưa nêu hành vi quan sát được: “${statement}”.`, location));
      }
    });
    findings.push(...validateOutcomeMetadata(outcomes?.objectiveMetadata, activityIds));
  });

  activities.forEach((location) => {
    const { activity, activityIndex, periodNumber } = location;
    const auditLocation = { activityId: activity.id, activityIndex, periodNumber };
    const label = activityLabel(location);
    const actionText = [...(activity.teacherActions || []), ...(activity.studentActions || [])].join("\n");

    if (!activity.objective?.trim() || genericOutcomePatterns.some((pattern) => pattern.test(activity.objective))) {
      findings.push(finding(lessonQualityRules.missingActivityObjective, `${label} thiếu mục tiêu cụ thể.`, auditLocation));
    }
    if (genericActivityPatterns.some((pattern) => pattern.test(actionText))) {
      findings.push(finding(lessonQualityRules.genericActivity, `${label} chứa câu mẫu rỗng, chưa nêu rõ GV hỏi/giao việc gì và HS thực hiện gì.`, auditLocation));
    }
    if (!hasAnyText(activity.learningProducts)) {
      findings.push(finding(lessonQualityRules.missingProduct, `${label} thiếu sản phẩm học tập cụ thể.`, auditLocation));
    } else if (!hasAnyText(activity.successCriteria)) {
      findings.push(finding(lessonQualityRules.missingSuccessCriteria, `${label} có sản phẩm nhưng chưa có tiêu chí thành công quan sát được.`, auditLocation));
    }
    if (isCoreActivity(activity) && !hasAnyText(activity.supportForStudentsNeedingHelp) && !hasLegacyDifferentiation(activity, "support")) {
      findings.push(finding(lessonQualityRules.missingSupport, `${label} chưa có hỗ trợ cụ thể cho học sinh cần trợ giúp.`, auditLocation));
    }
    if (isCoreActivity(activity) && !hasAnyText(activity.extensionForEarlyFinishers) && !hasLegacyDifferentiation(activity, "extension")) {
      findings.push(finding(lessonQualityRules.missingExtension, `${label} chưa có nhiệm vụ mở rộng cho học sinh hoàn thành sớm.`, auditLocation));
    }
  });

  if (stigmatizingStudentLabelPattern.test(JSON.stringify(lesson))) {
    findings.push(finding(lessonQualityRules.stigmatizingLabel, "Giáo án dùng nhãn “học sinh yếu”; hãy dùng “học sinh cần hỗ trợ” hoặc “học sinh còn gặp khó khăn”."));
  }

  const seen = new Set<string>();
  return findings.filter((item) => {
    const key = `${item.code}|${item.periodNumber || 0}|${item.activityId || item.activityIndex || 0}|${item.objectiveId || ""}|${item.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
