"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { lessonHeadingTitle } from "@/lib/lesson-format";
import { activityDocumentBlock, gradeLabel, normalizedPeriods } from "@/lib/lesson-document-model";
import type { LessonActivity, LessonPlan, PeriodPlan } from "@/types/lesson";

type LessonPreviewProps = {
  lesson: LessonPlan | null;
  isGenerating?: boolean;
};

const blank = "................................";
const dateBlank = "........";

function List({ items }: { items: string[] }) {
  return (
    <ul className="a4-list">
      {items.map((item, index) => (
        <li key={`${item}-${index}`}>- {item}</li>
      ))}
    </ul>
  );
}

function A4Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="a4-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function ActivityRow({ activity, index }: { activity: LessonActivity; index: number }) {
  const block = activityDocumentBlock(activity, index);
  const hasActionPairs = block.actionPairs.length > 0;

  return (
    <>
      <tr className={hasActionPairs ? "activity-heading-row" : "activity-heading-row activity-end-row"}>
        <td className="activity-heading-cell">
          <p className="activity-title">
            {block.heading}
          </p>
          <p>
            <strong>* Mục tiêu:</strong> <em>{block.objective}</em>
          </p>
          <p>
            <strong>* Sản phẩm/đánh giá:</strong> <em>{block.products}</em>
          </p>
          <p>
            <strong className="blue-italic">* Cách tiến hành:</strong>
          </p>
        </td>
        <td className="activity-heading-cell activity-heading-empty" />
      </tr>
      {block.actionPairs.map((pair, pairIndex) => (
        <tr
          key={`${activity.phase}-${activity.title}-${pairIndex}`}
          className={`paired-action-row ${pairIndex === block.actionPairs.length - 1 ? "activity-end-row" : ""}`}
        >
          <td>
            <p>- {pair.teacher}</p>
          </td>
          <td>
            <p>- {pair.student}</p>
          </td>
        </tr>
      ))}
    </>
  );
}

function ActivityTable({ activities }: { activities: LessonActivity[] }) {
  return (
    <table className="lesson-table">
      <thead>
        <tr>
          <th>Hoạt động của giáo viên</th>
          <th>Hoạt động của học sinh</th>
        </tr>
      </thead>
      <tbody>
        {activities.map((activity, index) => (
          <ActivityRow key={`${activity.phase}-${activity.title}-${index}`} activity={activity} index={index} />
        ))}
      </tbody>
    </table>
  );
}

function LessonPeriodPage({ lesson, period }: { lesson: LessonPlan; period: PeriodPlan }) {
  const outcomes = period.outcomes || lesson.outcomes;

  return (
    <article className="a4-page period-lesson">
      <header className="lesson-heading avoid-break">
        <div className="admin-grid">
          <p>
            <strong>TRƯỜNG:</strong> {blank}
          </p>
          <p>
            <strong>Lớp:</strong> {lesson.generalInfo.grade} <strong>Sĩ số:</strong> {blank} <strong>Thời lượng:</strong> {lesson.generalInfo.duration} phút
          </p>
          <p>
            <strong>Người dạy:</strong> {blank} <strong>Môn:</strong> {lesson.generalInfo.subject}
          </p>
        </div>
        <h1>GIÁO ÁN MÔN {lesson.generalInfo.subject.toUpperCase()} {gradeLabel(lesson.generalInfo.grade).toUpperCase()}</h1>
        <h3>
          {lessonHeadingTitle(lesson.generalInfo.lessonTitle)}
          <br />
          <span>(TIẾT {period.periodNumber})</span>
        </h3>
        <p className="date-line">Ngày {dateBlank} tháng {dateBlank} năm {dateBlank}</p>
      </header>

      <A4Section title="I. YÊU CẦU CẦN ĐẠT">
        <p className="sub-title">1. Kiến thức, kĩ năng:</p>
        <List items={outcomes.knowledgeAndSkills} />
        <p className="sub-title">2. Năng lực chung:</p>
        <List items={outcomes.generalCompetencies} />
        <p className="sub-title">3. Năng lực đặc thù môn học:</p>
        <List items={outcomes.specificCompetencies} />
        <p className="sub-title">4. Năng lực số:</p>
        <List
          items={[
            "Nhận biết và khai thác thông tin từ ảnh/video/tài liệu số do giáo viên trình chiếu để phục vụ học tập.",
            "Tham gia tương tác học tập trên thiết bị số ở mức phù hợp lứa tuổi theo hướng dẫn của giáo viên.",
          ]}
        />
        <p className="sub-title">5. Phẩm chất:</p>
        <List items={outcomes.qualities} />
      </A4Section>

      <A4Section title="II. THIẾT BỊ DẠY HỌC VÀ HỌC LIỆU">
        <p className="sub-title">1. Giáo viên:</p>
        <List items={lesson.materials.teacher} />
        <p className="sub-title">2. Học sinh:</p>
        <List items={lesson.materials.students} />
      </A4Section>

      <A4Section title="III. TIẾN TRÌNH DẠY HỌC">
        <ActivityTable activities={period.activities} />
      </A4Section>

      <A4Section title="IV. ĐIỀU CHỈNH SAU BÀI DẠY">
        <div className="adjustment-lines">
          <p>........................................................................................................................................</p>
          <p>........................................................................................................................................</p>
          <p>........................................................................................................................................</p>
          <p>........................................................................................................................................</p>
        </div>
      </A4Section>
    </article>
  );
}

function AiLoadingPreview() {
  return (
    <section className="animate-fade-in rounded-2xl border border-surface-200 bg-surface-0 p-5 shadow-soft xl:h-full xl:min-h-0 xl:overflow-hidden">
      <div className="overflow-hidden rounded-2xl border border-brand-100 bg-gradient-to-br from-brand-50 to-brand-100/60 p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-sm font-bold text-white shadow-btn-primary">
            AI
          </span>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-brand-500">
              EduPlan AI
            </p>
            <h2 className="text-lg font-bold text-slate-900">
              Đang soạn giáo án theo chuẩn Công văn 2345.
            </h2>
          </div>
        </div>

        <div className="mt-3 space-y-1">
          <p className="text-xs font-medium text-brand-700/80">
            Phân tích yêu cầu cần đạt &bull; Thiết kế hoạt động dạy học &bull; Định dạng trang A4
          </p>
        </div>

        <div className="mt-4 h-2 overflow-hidden rounded-full bg-brand-100">
          <div className="h-full animate-progress-indeterminate rounded-full bg-gradient-to-r from-brand-500 via-brand-400 to-brand-600" />
        </div>
      </div>

      <div className="a4-preview-shell mt-5">
        <article className="a4-page">
          <div className="skeleton-line animate-shimmer-slow w-1/3" />
          <div className="skeleton-line animate-shimmer-slow w-1/2" />
          <div className="mx-auto mt-8 space-y-3 text-center">
            <div className="skeleton-line animate-shimmer-slow mx-auto h-6 w-2/3" />
            <div className="skeleton-line animate-shimmer-slow mx-auto h-5 w-1/2" />
          </div>
          <div className="mt-10 space-y-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="skeleton-line animate-shimmer-slow" style={{ width: `${index % 2 ? 82 : 96}%` }} />
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}

export function LessonPreview({ lesson, isGenerating = false }: LessonPreviewProps) {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const [previewZoom, setPreviewZoom] = useState(0.7);

  useEffect(() => {
    if (!lesson || !shellRef.current) return;
    const shell = shellRef.current;
    const updateZoom = () => {
      const availableWidth = Math.max(shell.clientWidth - 28, 320);
      const a4Width = 794;
      const nextZoom = Math.min(0.95, Math.max(0.58, availableWidth / a4Width));
      setPreviewZoom(Number(nextZoom.toFixed(3)));
    };
    updateZoom();
    const observer = new ResizeObserver(updateZoom);
    observer.observe(shell);
    return () => observer.disconnect();
  }, [lesson]);

  if (isGenerating) return <AiLoadingPreview />;

  if (!lesson) {
    return (
      <section className="flex min-h-[480px] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-gradient-to-br from-surface-50 to-brand-50/30 p-8 text-center shadow-soft xl:h-full xl:min-h-0">
        <div className="flex max-w-md flex-col items-center">
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-50 to-brand-100 text-lg font-bold text-brand-600 shadow-soft">
            A4
          </div>
          <h2 className="gradient-text text-xl font-bold">
            Bản xem trước giáo án sẽ xuất hiện tại đây
          </h2>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-500">
            Preview đã được thu nhỏ để dễ bao quát bố cục trang.
          </p>
        </div>
      </section>
    );
  }

  const periods = normalizedPeriods(lesson);
  const previewStyle = { "--a4-preview-zoom": String(previewZoom) } as CSSProperties;

  return (
    <div ref={shellRef} className="a4-preview-shell animate-fade-in" style={previewStyle}>
      <div className="a4-document">
        {periods.map((period) => (
          <LessonPeriodPage key={period.periodNumber} lesson={lesson} period={period} />
        ))}
      </div>
    </div>
  );
}
