export const gradeOptions = ["Lớp 1", "Lớp 2", "Lớp 3", "Lớp 4", "Lớp 5"] as const;

export type ElementaryGrade = (typeof gradeOptions)[number];

export const canonicalSubjectNames = [
  "Tiếng Việt",
  "Toán",
  "Đạo đức",
  "Tự nhiên và Xã hội",
  "Khoa học",
  "Lịch sử và Địa lí",
  "Tin học",
  "Công nghệ",
  "Giáo dục thể chất",
  "Âm nhạc",
  "Mĩ thuật",
  "Hoạt động trải nghiệm",
] as const;

export type CanonicalSubject = (typeof canonicalSubjectNames)[number];

export type SubjectCatalogItem = {
  subject: CanonicalSubject;
  hasBookVolumes?: boolean;
  startsFromGrade?: ElementaryGrade;
  note?: string;
};

export const knttSubjectCatalogByGrade: Record<ElementaryGrade, SubjectCatalogItem[]> = {
  "Lớp 1": [
    { subject: "Tiếng Việt", hasBookVolumes: true },
    { subject: "Toán", hasBookVolumes: true },
    { subject: "Đạo đức" },
    { subject: "Tự nhiên và Xã hội" },
    { subject: "Giáo dục thể chất" },
    { subject: "Âm nhạc" },
    { subject: "Mĩ thuật" },
    { subject: "Hoạt động trải nghiệm" },
  ],
  "Lớp 2": [
    { subject: "Tiếng Việt", hasBookVolumes: true },
    { subject: "Toán", hasBookVolumes: true },
    { subject: "Đạo đức" },
    { subject: "Tự nhiên và Xã hội" },
    { subject: "Giáo dục thể chất" },
    { subject: "Âm nhạc" },
    { subject: "Mĩ thuật" },
    { subject: "Hoạt động trải nghiệm" },
  ],
  "Lớp 3": [
    { subject: "Tiếng Việt", hasBookVolumes: true },
    { subject: "Toán", hasBookVolumes: true },
    { subject: "Đạo đức" },
    { subject: "Tự nhiên và Xã hội" },
    { subject: "Tin học", startsFromGrade: "Lớp 3" },
    { subject: "Công nghệ", startsFromGrade: "Lớp 3" },
    { subject: "Giáo dục thể chất" },
    { subject: "Âm nhạc" },
    { subject: "Mĩ thuật" },
    { subject: "Hoạt động trải nghiệm" },
  ],
  "Lớp 4": [
    { subject: "Tiếng Việt", hasBookVolumes: true },
    { subject: "Toán", hasBookVolumes: true },
    { subject: "Đạo đức" },
    { subject: "Khoa học", startsFromGrade: "Lớp 4" },
    { subject: "Lịch sử và Địa lí", startsFromGrade: "Lớp 4" },
    { subject: "Tin học" },
    { subject: "Công nghệ" },
    { subject: "Giáo dục thể chất" },
    { subject: "Âm nhạc" },
    { subject: "Mĩ thuật" },
    { subject: "Hoạt động trải nghiệm" },
  ],
  "Lớp 5": [
    { subject: "Tiếng Việt", hasBookVolumes: true },
    { subject: "Toán", hasBookVolumes: true },
    { subject: "Đạo đức" },
    { subject: "Khoa học" },
    { subject: "Lịch sử và Địa lí" },
    { subject: "Tin học" },
    { subject: "Công nghệ" },
    { subject: "Giáo dục thể chất" },
    { subject: "Âm nhạc" },
    { subject: "Mĩ thuật" },
    { subject: "Hoạt động trải nghiệm" },
  ],
};

export const subjectOptionsByGrade: Record<ElementaryGrade, string[]> = {
  "Lớp 1": knttSubjectCatalogByGrade["Lớp 1"].map((item) => item.subject),
  "Lớp 2": knttSubjectCatalogByGrade["Lớp 2"].map((item) => item.subject),
  "Lớp 3": knttSubjectCatalogByGrade["Lớp 3"].map((item) => item.subject),
  "Lớp 4": knttSubjectCatalogByGrade["Lớp 4"].map((item) => item.subject),
  "Lớp 5": knttSubjectCatalogByGrade["Lớp 5"].map((item) => item.subject),
};

export const subjectOptions: string[] = Array.from(new Set(gradeOptions.flatMap((grade) => subjectOptionsByGrade[grade])));

export const bookVolumeOptions = [
  "Auto",
  "Tập một",
  "Tập hai",
] as const;

export function subjectSupportsBookVolume(subject: string) {
  return subject === "Toán" || subject === "Tiếng Việt";
}

export function getSubjectCatalogItem(grade: string, subject: string) {
  if (!gradeOptions.includes(grade as ElementaryGrade)) return null;
  return knttSubjectCatalogByGrade[grade as ElementaryGrade].find((item) => item.subject === subject) || null;
}
