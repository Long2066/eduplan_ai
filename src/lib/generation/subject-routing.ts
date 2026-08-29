import { isNaturalSocialSubjectName } from "@/lib/natural-social-pedagogy";
import { isVietnameseSubjectName } from "@/lib/vietnamese-pedagogy";
import type { LessonInput } from "@/types/lesson";

export function isMathSubject(input: Pick<LessonInput, "subject">) {
  return /^(toán|toan)$/i.test((input.subject || "").trim());
}

export function isVietnameseSubject(input: Pick<LessonInput, "subject">) {
  return isVietnameseSubjectName(input.subject);
}

export function isNaturalSocialSubject(input: Pick<LessonInput, "subject">) {
  return isNaturalSocialSubjectName(input.subject);
}

export function generationSubjectKind(input: Pick<LessonInput, "subject">) {
  if (isMathSubject(input)) return "math" as const;
  if (isVietnameseSubject(input)) return "vietnamese" as const;
  if (isNaturalSocialSubject(input)) return "natural-social" as const;
  return "default" as const;
}
