import { activityMinutes } from "@/lib/lesson-format";
import type { LessonActivity, LessonActivityTimeBreakdown, LessonPlan, PedagogyAuditFinding } from "@/types/lesson";

type TimeRule = {
  code: string;
  severity: PedagogyAuditFinding["severity"];
  autoFixable: boolean;
};

type PeriodScope = {
  periodNumber?: number;
  activities: LessonActivity[];
  expectedMinutes: number;
  minActivityMinutes: number;
  maxActivityMinutes: number;
};

type ActivityLocation = {
  activity: LessonActivity;
  activityIndex: number;
  periodNumber?: number;
};

export const lessonTimeRules = {
  periodTotalMismatch: { code: "LQ-TIME-01", severity: "error", autoFixable: true },
  breakdownMismatch: { code: "LQ-TIME-02", severity: "warning", autoFixable: true },
  missingOperationTime: { code: "LQ-TIME-03", severity: "warning", autoFixable: true },
  insufficientWritingTime: { code: "LQ-TIME-04", severity: "warning", autoFixable: true },
  insufficientGroupTime: { code: "LQ-TIME-05", severity: "warning", autoFixable: true },
  excessiveProducts: { code: "LQ-TIME-06", severity: "warning", autoFixable: true },
  excessiveSteps: { code: "LQ-TIME-07", severity: "warning", autoFixable: true },
  overloadedPeriod: { code: "LQ-TIME-08", severity: "warning", autoFixable: true },
  missingTransitionReserve: { code: "LQ-TIME-09", severity: "suggestion", autoFixable: true },
  invalidMinutes: { code: "LQ-TIME-10", severity: "error", autoFixable: true },
} as const satisfies Record<string, TimeRule>;

function finding(rule: TimeRule, message: string, location: Partial<PedagogyAuditFinding> = {}): PedagogyAuditFinding {
  return { code: rule.code, severity: rule.severity, autoFixable: rule.autoFixable, message, ...location };
}

function isVietnameseLesson(lesson: LessonPlan) {
  return /tiếng\s*việt|tieng\s*viet/i.test(lesson.generalInfo.subject || "");
}

function isNaturalSocialLesson(lesson: LessonPlan) {
  return /tự\s*nhiên\s*và\s*xã\s*hội|tu\s*nhien\s*va\s*xa\s*hoi|tnxh/i.test(lesson.generalInfo.subject || "");
}

function activityMinuteRange(lesson: LessonPlan, fullMinutes: number, periodCount = 1) {
  if (isVietnameseLesson(lesson) || isNaturalSocialLesson(lesson)) {
    return {
      minActivityMinutes: Math.max(0, fullMinutes - 3 * periodCount),
      maxActivityMinutes: Math.max(0, fullMinutes - 2 * periodCount),
    };
  }
  return {
    minActivityMinutes: fullMinutes,
    maxActivityMinutes: fullMinutes,
  };
}

function periodScopes(lesson: LessonPlan): PeriodScope[] {
  const expectedPerPeriod = lesson.generalInfo.duration;
  if (lesson.periodPlans?.length) {
    return lesson.periodPlans.map((period) => ({
      periodNumber: period.periodNumber,
      activities: period.activities || [],
      expectedMinutes: expectedPerPeriod,
      ...activityMinuteRange(lesson, expectedPerPeriod),
    }));
  }
  const periodCount = Math.max(1, lesson.generalInfo.periods || 1);
  const expectedMinutes = expectedPerPeriod * periodCount;
  return [{
    activities: lesson.activities || [],
    expectedMinutes,
    ...activityMinuteRange(lesson, expectedMinutes, periodCount),
  }];
}

function locationFor(activity: LessonActivity, activityIndex: number, periodNumber?: number): Partial<PedagogyAuditFinding> {
  return { activityId: activity.id, activityIndex, periodNumber };
}

function activityLabel({ activity, activityIndex, periodNumber }: ActivityLocation) {
  return `${periodNumber ? `Tiết ${periodNumber}, ` : ""}${activity.phase || "Hoạt động"} ${activity.title || activityIndex + 1}`;
}

function validActivityMinutes(activity: LessonActivity, index: number) {
  return typeof activity.durationMinutes === "number" && Number.isFinite(activity.durationMinutes) && activity.durationMinutes >= 0
    ? activity.durationMinutes
    : activityMinutes(activity, index);
}

function breakdownEntries(breakdown?: LessonActivityTimeBreakdown) {
  return Object.entries(breakdown || {}) as Array<[keyof LessonActivityTimeBreakdown, number | undefined]>;
}

function breakdownValues(breakdown?: LessonActivityTimeBreakdown) {
  return breakdownEntries(breakdown)
    .map(([, value]) => value)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
}

function breakdownTotal(breakdown?: LessonActivityTimeBreakdown) {
  return breakdownValues(breakdown).reduce((sum, value) => sum + value, 0);
}

function positiveBreakdownValue(breakdown: LessonActivityTimeBreakdown | undefined, key: keyof LessonActivityTimeBreakdown) {
  const value = breakdown?.[key];
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function activityText(activity: LessonActivity) {
  return [
    activity.phase,
    activity.title,
    activity.objective,
    ...(activity.teacherActions || []),
    ...(activity.studentActions || []),
    ...(activity.learningProducts || []),
  ].join(" ");
}

function operationalTimeGaps(activity: LessonActivity) {
  const text = activityText(activity);
  const breakdown = activity.timeBreakdown;
  const operations: Array<{ label: string; pattern: RegExp; keys: Array<keyof LessonActivityTimeBreakdown> }> = [
    { label: "phát/thu phiếu hoặc đồ dùng", pattern: /phát (phiếu|thẻ|đồ dùng)|thu (phiếu|bài|sản phẩm)|chia (phiếu|đồ dùng)/i, keys: ["distributionMinutes"] },
    { label: "học sinh suy nghĩ", pattern: /suy nghĩ|đọc thầm|chuẩn bị ý/i, keys: ["thinkingMinutes"] },
    { label: "làm bài hoặc viết", pattern: /làm bài|viết|điền|ghi|hoàn thành phiếu|thực hành/i, keys: ["workingMinutes"] },
    { label: "trình bày hoặc báo cáo", pattern: /trình bày|báo cáo|chia sẻ trước lớp/i, keys: ["presentationMinutes"] },
    { label: "nhận xét hoặc chữa bài", pattern: /nhận xét|góp ý|chữa bài|sửa bài|phản hồi/i, keys: ["feedbackMinutes"] },
    { label: "giáo viên chốt", pattern: /giáo viên chốt|gv chốt|kết luận|khái quát/i, keys: ["consolidationMinutes"] },
    { label: "chuyển hoạt động", pattern: /chuyển (hoạt động|sang)|ổn định|thu dọn/i, keys: ["transitionMinutes", "flexibleMinutes"] },
  ];
  const detected = operations.filter((operation) => operation.pattern.test(text));
  if (!detected.length) return [];
  if (!breakdown || !breakdownValues(breakdown).length) {
    return detected.length >= 2 ? detected.map((operation) => operation.label) : [];
  }
  return detected
    .filter((operation) => !operation.keys.some((key) => positiveBreakdownValue(breakdown, key)))
    .map((operation) => operation.label);
}

function isFiveToSevenSentenceWriting(activity: LessonActivity) {
  const text = activityText(activity);
  return /(viết|hoàn thành|chỉnh sửa).{0,60}(đoạn|bài).{0,50}(5\s*(?:[-–—]|đến)\s*7|năm\s+đến\s+bảy)\s*câu|(đoạn|bài).{0,50}(5\s*(?:[-–—]|đến)\s*7|năm\s+đến\s+bảy)\s*câu/i.test(text);
}

function isGroupDiscussion(activity: LessonActivity) {
  return activity.organization === "group" || /thảo luận nhóm|làm việc nhóm|trao đổi trong nhóm/i.test(activityText(activity));
}

function majorTaskKinds(activities: LessonActivity[]) {
  const text = activities.map(activityText).join(" ");
  const kinds = [
    /viết (đoạn|bài)/i,
    /thảo luận nhóm|làm việc nhóm/i,
    /đóng vai/i,
    /thực hành|thí nghiệm/i,
    /tạo (sản phẩm|poster|sơ đồ|tranh)/i,
    /hoàn thành phiếu|phiếu học tập/i,
  ];
  return kinds.filter((pattern) => pattern.test(text)).length;
}

export function validateLessonTime(lesson: LessonPlan): PedagogyAuditFinding[] {
  const findings: PedagogyAuditFinding[] = [];

  periodScopes(lesson).forEach((scope) => {
    const periodLabel = scope.periodNumber ? `Tiết ${scope.periodNumber}` : "Giáo án";
    const totalMinutes = scope.activities.reduce((sum, activity, index) => sum + validActivityMinutes(activity, index), 0);
    const totalMismatch = totalMinutes < scope.minActivityMinutes || totalMinutes > scope.maxActivityMinutes;
    if (totalMismatch) {
      const expectedText = scope.minActivityMinutes === scope.maxActivityMinutes
        ? `phải bằng ${scope.expectedMinutes} phút`
        : `phải trong khoảng ${scope.minActivityMinutes}–${scope.maxActivityMinutes} phút để chừa ${scope.expectedMinutes - scope.maxActivityMinutes}–${scope.expectedMinutes - scope.minActivityMinutes} phút dự phòng`;
      findings.push(finding(
        lessonTimeRules.periodTotalMismatch,
        `${periodLabel} có tổng ${totalMinutes} phút, ${expectedText}.`,
        { periodNumber: scope.periodNumber },
      ));
    }

    const reserveMinutes = scope.activities.reduce((sum, activity) =>
      sum + Number(activity.timeBreakdown?.transitionMinutes || 0) + Number(activity.timeBreakdown?.flexibleMinutes || 0), 0);
    const hasExplicitTransition = scope.activities.some((activity) => /chuyển (hoạt động|sang)|ổn định|thu dọn/i.test(activityText(activity)));
    const unallocatedReserveMinutes = Math.max(0, scope.expectedMinutes - totalMinutes);
    if (reserveMinutes < 1 && !hasExplicitTransition && unallocatedReserveMinutes < 1) {
      findings.push(finding(
        lessonTimeRules.missingTransitionReserve,
        `${periodLabel} chưa dành ít nhất 1 phút linh hoạt/chuyển tiếp và chưa mô tả rõ việc chuyển hoạt động.`,
        { periodNumber: scope.periodNumber },
      ));
    }

    if (majorTaskKinds(scope.activities) >= 4) {
      findings.push(finding(
        lessonTimeRules.overloadedPeriod,
        `${periodLabel} có từ 4 loại nhiệm vụ lớn trở lên; cần giảm hoặc chuyển một phần sang tiết khác.`,
        { periodNumber: scope.periodNumber },
      ));
    }

    scope.activities.forEach((activity, activityIndex) => {
      const location = locationFor(activity, activityIndex, scope.periodNumber);
      const label = activityLabel({ activity, activityIndex, periodNumber: scope.periodNumber });
      const rawMinutes = activity.durationMinutes;
      const duration = validActivityMinutes(activity, activityIndex);
      if (typeof rawMinutes !== "number" || !Number.isFinite(rawMinutes) || rawMinutes <= 0) {
        findings.push(finding(lessonTimeRules.invalidMinutes, `${label} có durationMinutes thiếu hoặc không hợp lệ.`, location));
      }

      const entries = breakdownEntries(activity.timeBreakdown);
      if (entries.some(([, value]) => typeof value === "number" && (!Number.isFinite(value) || value < 0))) {
        findings.push(finding(lessonTimeRules.invalidMinutes, `${label} có timeBreakdown chứa số phút âm hoặc không hợp lệ.`, location));
      }
      if (breakdownValues(activity.timeBreakdown).length && breakdownTotal(activity.timeBreakdown) !== duration) {
        findings.push(finding(
          lessonTimeRules.breakdownMismatch,
          `${label} có timeBreakdown ${breakdownTotal(activity.timeBreakdown)} phút, không bằng durationMinutes ${duration} phút.`,
          location,
        ));
      }

      const gaps = operationalTimeGaps(activity);
      if (gaps.length) {
        findings.push(finding(
          lessonTimeRules.missingOperationTime,
          `${label} chưa thể hiện thời gian cho: ${gaps.join(", ")}.`,
          location,
        ));
      }

      if (isFiveToSevenSentenceWriting(activity)) {
        const writingMinutes = activity.timeBreakdown && breakdownValues(activity.timeBreakdown).length
          ? Number(activity.timeBreakdown.workingMinutes || 0)
          : duration;
        if (writingMinutes < 12) {
          findings.push(finding(
            lessonTimeRules.insufficientWritingTime,
            `${label} yêu cầu viết đoạn 5–7 câu nhưng chỉ dành ${writingMinutes} phút viết; cần tối thiểu khoảng 12 phút.`,
            location,
          ));
        }
      }

      if (isGroupDiscussion(activity)) {
        const workingMinutes = Number(activity.timeBreakdown?.workingMinutes || 0) + Number(activity.timeBreakdown?.thinkingMinutes || 0);
        const presentationMinutes = Number(activity.timeBreakdown?.presentationMinutes || 0);
        const breakdownProvided = breakdownValues(activity.timeBreakdown).length > 0;
        if (duration < 6 || (breakdownProvided && (workingMinutes < 3 || presentationMinutes < 1))) {
          findings.push(finding(
            lessonTimeRules.insufficientGroupTime,
            `${label} chưa đủ thời gian tổ chức thảo luận nhóm, làm việc và báo cáo.`,
            location,
          ));
        }
      }

      const productCount = (activity.learningProducts || []).filter((product) => product.trim()).length;
      if (productCount >= 3 && duration < 5) {
        findings.push(finding(
          lessonTimeRules.excessiveProducts,
          `${label} yêu cầu ${productCount} sản phẩm trong ${duration} phút; khối lượng chưa khả thi.`,
          location,
        ));
      }

      const actionStepCount = Math.max(activity.teacherActions?.length || 0, activity.studentActions?.length || 0);
      if (actionStepCount >= 4 && duration < actionStepCount * 2) {
        findings.push(finding(
          lessonTimeRules.excessiveSteps,
          `${label} có ${actionStepCount} bước hành động trong ${duration} phút; cần giảm bước hoặc tăng thời gian.`,
          location,
        ));
      }
    });
  });

  return findings;
}
