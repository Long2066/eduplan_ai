export type SelectOrAuto = "auto" | string;
export type LessonStyle = "Cơ bản" | "Dạy thật trên lớp" | "Sáng tạo, sinh động";

export type LessonInput = {
  subject: string;
  grade: string;
  lessonTitle: string;
  book: string;
  bookVolume: SelectOrAuto;
  periods: number;
  duration: 35;
  hometownProvince: SelectOrAuto;
  localityNote: string;
  studentProfile: SelectOrAuto;
  teachingEnvironment: SelectOrAuto;
  facilities: string[] | "auto";
  style: LessonStyle;
  specialRequest: string;
  allowAiInference: boolean;
  uploadedAssets: UploadedAsset[];
};

export type UploadedAsset = {
  id: string;
  name: string;
  type: "image" | "pdf" | "file";
  order?: number;
  previewUrl?: string;
  dataUrl?: string;
  mimeType?: string;
};

export type LessonActivity = {
  phase: string;
  title: string;
  objective: string;
  durationMinutes?: number;
  teacherActions: string[];
  studentActions: string[];
  learningProducts?: string[];
};

export type LessonOutcomes = {
  generalCompetencies: string[];
  specificCompetencies: string[];
  qualities: string[];
  knowledgeAndSkills: string[];
};

export type PeriodPlan = {
  periodNumber: number;
  focus: string;
  outcomes?: LessonOutcomes;
  activities: LessonActivity[];
};

export type LessonPlan = {
  generalInfo: {
    subject: string;
    grade: string;
    lessonTitle: string;
    book?: string;
    periods: number;
    duration: number;
  };
  outcomes: LessonOutcomes;
  materials: {
    teacher: string[];
    students: string[];
  };
  activities: LessonActivity[];
  periodPlans?: PeriodPlan[];
  assessment: {
    criteria: string[];
    evidence: string[];
    comments: string[];
  };
  adjustments: {
    suitablePoints: string[];
    pointsToAdjust: string[];
    nextLessonDirection: string[];
  };
  contextFit: {
    notes: string[];
  };
  meta: {
    style: string;
    modelUsed: string;
    createdAt: string;
  };
};

export type PedagogyAudit = {
  subject: string;
  grade: string;
  status: "passed" | "repaired" | "needs-review";
  issues: string[];
  checks: string[];
  repairApplied: boolean;
  checkedAt: string;
};

export type FormErrors = Partial<Record<keyof LessonInput, string>>;
