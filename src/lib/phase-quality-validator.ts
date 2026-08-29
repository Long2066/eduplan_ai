import { activityPhaseKey, safeStringArray } from "@/lib/lesson-format";
import type { LessonActivity, LessonInput, LessonPlan, PedagogyAuditFinding, PeriodPlan } from "@/types/lesson";

type PhaseQualityRule = {
  code: string;
  severity: PedagogyAuditFinding["severity"];
  autoFixable: boolean;
};

const phaseQualityRules = {
  startupPassive: { code: "PHASE-QUALITY-01", severity: "warning", autoFixable: true },
  discoveryNotEvidenced: { code: "PHASE-QUALITY-02", severity: "warning", autoFixable: true },
  practiceNotPractice: { code: "PHASE-QUALITY-03", severity: "warning", autoFixable: true },
  applicationNotApplied: { code: "PHASE-QUALITY-04", severity: "warning", autoFixable: true },
  repeatedDiscoveryPattern: { code: "PHASE-QUALITY-05", severity: "warning", autoFixable: true },
} as const satisfies Record<string, PhaseQualityRule>;

type ActivityLocation = {
  activity: LessonActivity;
  activityIndex: number;
  periodNumber?: number;
};

function normalizeVietnamese(value: string) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function activityText(activity: LessonActivity) {
  return [
    activity.phase,
    activity.title,
    activity.objective,
    ...safeStringArray(activity.inputOrMaterials),
    ...safeStringArray(activity.teacherActions),
    ...safeStringArray(activity.studentActions),
    ...safeStringArray(activity.learningProducts),
    ...safeStringArray(activity.successCriteria),
    activity.expectedAnswer || "",
    ...safeStringArray(activity.acceptableResponses),
    ...safeStringArray(activity.commonErrors),
    ...safeStringArray(activity.teacherFeedback),
  ].join(" ");
}

function periodsForLesson(lesson: LessonPlan): Array<Pick<PeriodPlan, "periodNumber" | "activities">> {
  if (lesson.periodPlans?.length) {
    return lesson.periodPlans.map((period, index) => ({
      periodNumber: period.periodNumber || index + 1,
      activities: period.activities || [],
    }));
  }
  return [{ periodNumber: 1, activities: lesson.activities || [] }];
}

function finding(
  rule: PhaseQualityRule,
  message: string,
  location: Partial<PedagogyAuditFinding> = {},
): PedagogyAuditFinding {
  return { code: rule.code, severity: rule.severity, autoFixable: rule.autoFixable, message, ...location };
}

function hasAnyText(value: unknown) {
  return safeStringArray(value).some((item) => item.trim());
}

function signalCount(text: string, patterns: RegExp[]) {
  return patterns.reduce((count, pattern) => count + (pattern.test(text) ? 1 : 0), 0);
}

const activeLearningPatterns = [
  /\b(quan sat|doc|nghe|tim|xac dinh|chi ra|gach|viet|tinh|giai|ve|lap|do|dem|thu|thao tac|thuc hanh|sap xep|phan loai|so sanh|mo ta|phong van|khao sat|trao doi|thao luan|trinh bay|tao|hoan thanh)\b/,
];

const startupActivePatterns = [
  /\b(tro choi|cau do|du doan|tra loi|chon|chia se|neu y kien|quan sat|van dong|hat|ghep the|the tin hieu|binh chon|dong vai|thu thach|hoi dap)\b/,
];

const discoveryEvidencePatterns = [
  /\b(tranh|anh|sgk|van ban|ngu lieu|doan|cau|bai toan|du kien|du lieu|hinh|bang|so do|ban do|luoc do|vat that|mo hinh|thi nghiem|tinh huong|nguon|bang chung|phieu quan sat|ki vat|hien vat)\b/,
];

const discoveryProcessPatterns = [
  /\b(cau hoi|van de|du doan|vi sao|lam the nao|nhiem vu|thu thach|phat hien|rut ra|ket luan|chot|hinh thanh|quy tac|cach lam|dac diem|moi quan he|giai thich)\b/,
];

const practiceTaskPatterns = [
  /\b(luyen|luyen tap|thuc hanh|bai tap|lam bai|viet|doc|tinh|giai|ghep|dien|noi|phan loai|sap xep|dong vai|xu li|trinh bay|hoan thanh|ap dung cach|sua loi|soat loi|cung co)\b/,
];

const feedbackOrAnswerPatterns = [
  /\b(dap an|tieu chi|dung|sai|kiem tra|doi chieu|nhan xet|sua|gop y|loi|cach lam|ket qua|minh chung)\b/,
];

const realWorldPatterns = [
  /\b(doi song|thuc te|hang ngay|gia dinh|o nha|lop|truong|san truong|dia phuong|cong dong|ban than|ban be|nguoi than|cho|duong|que|noi em song|tinh huong|ung xu|viec lam|hanh dong|ke hoach|loi khuyen|checklist|poster|chia se voi|xung quanh|giao tiep)\b/,
];

const appliedProductPatterns = [
  /\b(xu li|de xuat|lap|tao|viet|noi|trinh bay|thuc hien|ap dung|van dung|thiet ke|giai quyet|chon cach|loi khuyen|ke hoach|vi du|bai toan|doan|cau|poster|phieu|checklist|san pham|cam ket)\b/,
];

const genericApplicationPatterns = [
  /\b(on bai|hoc bai|chuan bi bai sau|nhac lai kien thuc|em se co gang|co gang hoc tap|dan do)\b/,
];

function validateStartup(location: ActivityLocation) {
  const text = normalizeVietnamese(activityText(location.activity));
  const introOnly = /\b(gioi thieu bai|neu muc tieu|dan dat vao bai)\b/.test(text)
    && !startupActivePatterns.some((pattern) => pattern.test(text));
  if (!introOnly) return [];
  return [finding(
    phaseQualityRules.startupPassive,
    "Khởi động đang thiên về giới thiệu một chiều; cần có tình huống/trò chơi/câu hỏi kích hoạt để HS phản hồi và nối tự nhiên vào Khám phá.",
    { activityId: location.activity.id, activityIndex: location.activityIndex, periodNumber: location.periodNumber },
  )];
}

function validateDiscovery(location: ActivityLocation) {
  const text = normalizeVietnamese(activityText(location.activity));
  const signals = signalCount(text, [
    ...activeLearningPatterns,
    ...discoveryEvidencePatterns,
    ...discoveryProcessPatterns,
  ]);
  if (signals >= 3) return [];
  return [finding(
    phaseQualityRules.discoveryNotEvidenced,
    "Khám phá chưa thể hiện rõ quá trình HS hình thành kiến thức/kĩ năng mới từ nguồn, bằng chứng hoặc thao tác; cần viết lại thành nhiệm vụ khám phá có vấn đề, sản phẩm phát hiện, sửa sai và lời chốt.",
    { activityId: location.activity.id, activityIndex: location.activityIndex, periodNumber: location.periodNumber },
  )];
}

function validatePractice(location: ActivityLocation) {
  const activity = location.activity;
  const text = normalizeVietnamese(activityText(activity));
  const looksLikeNewDiscovery = /\b(kham pha|hinh thanh kien thuc moi|rut ra quy tac|phat hien kien thuc moi)\b/.test(text)
    && !/\b(luyen|thuc hanh|cung co|ap dung cach vua hoc)\b/.test(text);
  const hasPracticeTask = practiceTaskPatterns.some((pattern) => pattern.test(text));
  const hasCheck = hasAnyText(activity.successCriteria)
    || hasAnyText(activity.teacherFeedback)
    || hasAnyText(activity.commonErrors)
    || Boolean(activity.expectedAnswer?.trim())
    || feedbackOrAnswerPatterns.some((pattern) => pattern.test(text));

  if (!looksLikeNewDiscovery && hasPracticeTask && hasCheck && hasAnyText(activity.learningProducts)) return [];

  return [finding(
    phaseQualityRules.practiceNotPractice,
    "Luyện tập chưa đúng vai trò củng cố kiến thức/kĩ năng vừa hình thành; cần có nhiệm vụ luyện cụ thể, sản phẩm/đáp án hoặc tiêu chí phản hồi để HS sửa lỗi.",
    { activityId: activity.id, activityIndex: location.activityIndex, periodNumber: location.periodNumber },
  )];
}

function validateApplication(location: ActivityLocation) {
  const activity = location.activity;
  const text = normalizeVietnamese(activityText(activity));
  const hasRealWorld = realWorldPatterns.some((pattern) => pattern.test(text));
  const hasAppliedProduct = hasAnyText(activity.learningProducts) && appliedProductPatterns.some((pattern) => pattern.test(text));
  const genericOnly = genericApplicationPatterns.some((pattern) => pattern.test(text))
    && !hasRealWorld;

  if (!genericOnly && hasRealWorld && hasAppliedProduct) return [];

  return [finding(
    phaseQualityRules.applicationNotApplied,
    "Vận dụng chưa phải là ứng dụng thật/gần thật có sản phẩm hoặc hành động kiểm chứng được; cần gắn kiến thức vừa học với bối cảnh đời sống, lớp học, gia đình, địa phương hoặc trải nghiệm cá nhân.",
    { activityId: activity.id, activityIndex: location.activityIndex, periodNumber: location.periodNumber },
  )];
}

function discoveryMethodSignature(activity: LessonActivity) {
  const text = normalizeVietnamese(activityText(activity));
  const markers = [
    ["observe-picture", /\b(quan sat).{0,80}\b(tranh|anh|hinh|sgk)\b|\b(tranh|anh|hinh|sgk).{0,80}\b(quan sat)\b/],
    ["worksheet-card", /\b(phieu|the|bang nhom|bang phu)\b/],
    ["interview", /\b(phong van|hoi dap|phong vien|dieu tra|khao sat)\b/],
    ["experiment", /\b(thi nghiem|du doan|kiem chung|thu nghiem)\b/],
    ["station", /\b(tram|goc|phong tranh|xoay vong)\b/],
    ["roleplay", /\b(dong vai|tinh huong|xu li)\b/],
    ["map-timeline", /\b(ban do|luoc do|dong thoi gian|moc thoi gian|so do)\b/],
    ["reading-evidence", /\b(doc|van ban|ngu lieu|chi tiet|bang chung)\b/],
    ["math-model", /\b(bai toan|du kien|phep tinh|mo hinh|so do|tom tat)\b/],
  ] as const;
  const found = markers.filter(([, pattern]) => pattern.test(text)).map(([marker]) => marker);
  return found.length ? found.join("+") : "generic";
}

const repeatedGenericDiscoveryPattern = /\b(quan sat tranh|quan sat anh|phieu hoc tap|the tranh).{0,120}\b(thao luan|trao doi).{0,120}\b(trinh bay|bao cao)\b/;

function keywordSet(text: string) {
  const stopWords = new Set(["giao", "vien", "hoc", "sinh", "hoat", "dong", "nhiem", "vu", "trong", "bang", "theo", "cua", "voi", "sau", "truoc"]);
  return new Set(normalizeVietnamese(text).split(" ").filter((word) => word.length >= 4 && !stopWords.has(word)));
}

function jaccard(left: Set<string>, right: Set<string>) {
  if (!left.size || !right.size) return 0;
  const intersection = [...left].filter((word) => right.has(word)).length;
  const union = new Set([...left, ...right]).size;
  return intersection / union;
}

function duplicateDiscoveryFindings(periods: Array<Pick<PeriodPlan, "periodNumber" | "activities">>) {
  const explorations = periods.flatMap((period) => (period.activities || [])
    .map((activity, activityIndex) => ({ activity, activityIndex, periodNumber: period.periodNumber }))
    .filter((location) => activityPhaseKey(location.activity) === "Khám phá"));
  const findings: PedagogyAuditFinding[] = [];

  explorations.forEach((current, index) => {
    const currentText = normalizeVietnamese(activityText(current.activity));
    const currentSignature = discoveryMethodSignature(current.activity);
    const currentWords = keywordSet(currentText);
    for (let previousIndex = 0; previousIndex < index; previousIndex += 1) {
      const previous = explorations[previousIndex];
      const previousText = normalizeVietnamese(activityText(previous.activity));
      const sameSignature = currentSignature === discoveryMethodSignature(previous.activity);
      const repeatedGeneric = repeatedGenericDiscoveryPattern.test(currentText) && repeatedGenericDiscoveryPattern.test(previousText);
      const tooSimilar = jaccard(currentWords, keywordSet(previousText)) >= 0.62;
      if (sameSignature && (repeatedGeneric || tooSimilar)) {
        findings.push(finding(
          phaseQualityRules.repeatedDiscoveryPattern,
          `Khám phá tiết ${current.periodNumber} đang lặp mô típ với tiết ${previous.periodNumber}; cần đổi tình huống, học liệu, cách tổ chức hoặc sản phẩm phát hiện nhưng vẫn bám mục tiêu tiết.`,
          { activityId: current.activity.id, activityIndex: current.activityIndex, periodNumber: current.periodNumber },
        ));
        break;
      }
    }
  });

  return findings;
}

export function validatePhaseQuality(lesson: LessonPlan, _input?: LessonInput): PedagogyAuditFinding[] {
  const periods = periodsForLesson(lesson);
  const findings = periods.flatMap((period) => (period.activities || []).flatMap((activity, activityIndex) => {
    const location = { activity, activityIndex, periodNumber: period.periodNumber };
    const phase = activityPhaseKey(activity);
    if (phase === "Khởi động") return validateStartup(location);
    if (phase === "Khám phá") return validateDiscovery(location);
    if (phase === "Luyện tập") return validatePractice(location);
    if (phase === "Vận dụng") return validateApplication(location);
    return [];
  }));

  findings.push(...duplicateDiscoveryFindings(periods));

  const seen = new Set<string>();
  return findings.filter((item) => {
    const key = `${item.code}|${item.periodNumber || 0}|${item.activityId || item.activityIndex || 0}|${item.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
