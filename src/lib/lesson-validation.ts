import type { FormErrors, LessonInput } from "@/types/lesson";
import { gradeOptions, subjectOptionsByGrade } from "@/lib/defaults";
import { isSpecificLessonTitle } from "@/lib/lesson-title";

export function validateLessonInput(input: LessonInput): FormErrors {
  const errors: FormErrors = {};

  if (!input.subject.trim()) errors.subject = "Vui lòng nhập môn học.";
  if (!input.grade.trim()) errors.grade = "Vui lòng nhập lớp.";
  if (input.grade && !gradeOptions.includes(input.grade as (typeof gradeOptions)[number])) {
    errors.grade = "Chỉ hỗ trợ lớp 1 đến lớp 5.";
  }
  if (!errors.grade && input.subject) {
    const validSubjects = subjectOptionsByGrade[input.grade as (typeof gradeOptions)[number]];
    if (validSubjects && !validSubjects.includes(input.subject)) {
      errors.subject = "Môn học chưa phù hợp với lớp đã chọn.";
    }
  }
  if (!input.book.trim()) errors.book = "Nên nhập bộ sách để AI bám đúng ngữ cảnh.";
  if (!Number.isFinite(input.periods) || input.periods <= 0) {
    errors.periods = "Số tiết phải lớn hơn 0.";
  }
  const assets = Array.isArray(input.uploadedAssets) ? input.uploadedAssets : [];
  if (!assets.length && !isSpecificLessonTitle(input.lessonTitle, input.subject)) {
    errors.lessonTitle = "Không có ảnh SGK: vui lòng nhập tên bài cụ thể, ví dụ “Bài 2. Ô nhiễm, xói mòn đất và bảo vệ môi trường đất”.";
  }

  return errors;
}

export function hasBlockingErrors(errors: FormErrors) {
  return Boolean(
    errors.subject || errors.grade || errors.lessonTitle || errors.periods || errors.uploadedAssets,
  );
}
