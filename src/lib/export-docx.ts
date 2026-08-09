import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  PageBreak,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from "docx";
import { docxMathParts, injectMathIntoDocx } from "@/lib/docx-math";
import { lessonHeadingTitle, safeStringArray } from "@/lib/lesson-format";
import { activityDocumentBlock, gradeLabel, normalizedPeriods } from "@/lib/lesson-document-model";
import type { ActivityDocumentOptions } from "@/lib/lesson-document-model";
import type { LessonActivity, LessonPlan, PeriodPlan } from "@/types/lesson";

const BLUE = "1F4E79";
const BRIGHT_BLUE = "0070C0";
const RED = "C00000";
const BLACK = "000000";
const TABLE_HEADER = "D9EAF7";

const cm = (value: number) => Math.round(value * 567);
const singleBorder = { style: BorderStyle.SINGLE, size: 8, color: BLACK };
const noBorder = { style: BorderStyle.NONE, size: 0, color: BLACK };

function text(content: string, options: { bold?: boolean; italic?: boolean; color?: string; size?: number } = {}) {
  return new TextRun({
    text: content,
    font: "Times New Roman",
    size: options.size || 28,
    bold: options.bold,
    italics: options.italic,
    color: options.color || BLACK,
  });
}

function paragraph(
  children: TextRun[] | string,
  options: { alignment?: (typeof AlignmentType)[keyof typeof AlignmentType]; spacingAfter?: number } = {},
) {
  return new Paragraph({
    children: typeof children === "string" ? mathRuns(children) : children,
    alignment: options.alignment || AlignmentType.JUSTIFIED,
    spacing: { after: options.spacingAfter ?? 60 },
  });
}

function mathRuns(
  content: string,
  options: { bold?: boolean; italic?: boolean; color?: string; size?: number; breakFirst?: boolean } = {},
) {
  return docxMathParts(content).map((part, index) =>
    new TextRun({
      text: part.type === "text" ? part.value : part.marker,
      font: "Times New Roman",
      size: options.size || 28,
      bold: options.bold,
      italics: options.italic,
      color: options.color || BLACK,
      break: options.breakFirst && index === 0 ? 1 : undefined,
    }),
  );
}

function paragraphWithBreaks(
  content: string,
  options: { alignment?: (typeof AlignmentType)[keyof typeof AlignmentType]; spacingAfter?: number; bold?: boolean; italic?: boolean; color?: string; size?: number } = {},
) {
  return new Paragraph({
    children: content.split("\n").flatMap((line, idx) => mathRuns(line, {
      size: options.size,
      bold: options.bold,
      italic: options.italic,
      color: options.color,
      breakFirst: idx > 0,
    })),
    alignment: options.alignment || AlignmentType.JUSTIFIED,
    spacing: { after: options.spacingAfter ?? 50 },
  });
}

function sectionTitle(title: string) {
  return paragraph([text(title, { bold: true, color: BLUE, size: 30 })], { spacingAfter: 80 });
}

function subTitle(title: string) {
  return paragraph([text(title, { bold: true })], { spacingAfter: 40 });
}

function dashList(items: unknown) {
  return safeStringArray(items).map((item) => paragraph([text("- "), ...mathRuns(item)], { spacingAfter: 25 }));
}

function blankLine() {
  return paragraph("........................................................................................................................................", { spacingAfter: 20 });
}

function cell(children: (Paragraph | Table)[], options: { header?: boolean; topBorder?: boolean; bottomBorder?: boolean } = {}) {
  return new TableCell({
    children,
    verticalAlign: VerticalAlign.TOP,
    width: { size: 50, type: WidthType.PERCENTAGE },
    margins: { top: 120, bottom: 120, left: 120, right: 120 },
    shading: options.header ? { type: ShadingType.CLEAR, fill: TABLE_HEADER } : undefined,
    borders: {
      top: options.topBorder === false ? noBorder : singleBorder,
      bottom: options.bottomBorder === false ? noBorder : singleBorder,
      left: singleBorder,
      right: singleBorder,
    },
  });
}

function activityCellTeacher(activity: LessonActivity, index: number, displayOptions: ActivityDocumentOptions = {}) {
  const block = activityDocumentBlock(activity, index, displayOptions);
  return [
    paragraph(mathRuns(block.heading, { bold: true }), { spacingAfter: 50 }),
    metadataParagraph("* Mục tiêu", block.objective),
    ...(block.products
      ? [metadataParagraph("* Sản phẩm/đánh giá", block.products, "1F4E79")]
      : []),
    ...activityDetailParagraphs(block),
    new Paragraph({
      children: [text("* Cách tiến hành:", { bold: true, italic: true, color: BRIGHT_BLUE })],
      spacing: { after: 50 },
    }),
  ];
}

function metadataParagraph(
  label: string,
  value: string,
  color = "263746",
) {
  return new Paragraph({
    spacing: { after: 45 },
    children: [
      text(`${label}: `, { bold: true, color }),
      ...mathRuns(value, { color }),
    ],
  });
}

function activityDetailParagraphs(block: ReturnType<typeof activityDocumentBlock>) {
  const colors = {
    neutral: "263746",
    success: "1E5A45",
    support: "7A4D12",
    extension: "604289",
  } as const;
  return block.details.map((detail) => metadataParagraph(detail.label, detail.text, colors[detail.tone]));
}

function activitiesTable(activities: LessonActivity[], displayOptions: ActivityDocumentOptions = {}) {
  const activityRows = activities.flatMap((activity, index) => {
    const block = activityDocumentBlock(activity, index, displayOptions);
    const rows = [
      new TableRow({
        children: [cell(activityCellTeacher(activity, index, displayOptions), { topBorder: false, bottomBorder: false }), cell([paragraph("")], { topBorder: false, bottomBorder: false })],
      }),
      ...block.actionPairs.map(
        (pair, pairIndex) =>
          new TableRow({
            children: [
              cell([paragraphWithBreaks(`- ${pair.teacher}`, { spacingAfter: 25 })], {
                topBorder: false,
                bottomBorder: pairIndex === block.actionPairs.length - 1,
              }),
              cell([paragraphWithBreaks(`- ${pair.student}`, { spacingAfter: 25 })], {
                topBorder: false,
                bottomBorder: pairIndex === block.actionPairs.length - 1,
              }),
            ],
          }),
      ),
    ];

    return rows;
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        tableHeader: true,
        children: [
          cell([paragraph([text("Hoạt động của giáo viên", { bold: true })], { alignment: AlignmentType.CENTER })], { header: true }),
          cell([paragraph([text("Hoạt động của học sinh", { bold: true })], { alignment: AlignmentType.CENTER })], { header: true }),
        ],
      }),
      ...activityRows,
    ],
  });
}

function pageBreak() {
  return new Paragraph({ children: [new PageBreak()] });
}

function periodChildren(lesson: LessonPlan, period: PeriodPlan) {
  const outcomes = period.outcomes || lesson.outcomes;
  const compact = lesson.meta?.plan === "free";
  const displayOptions: ActivityDocumentOptions = {
    compact,
    concise: true,
  };

  return [
    paragraph([text("TRƯỜNG: ", { bold: true }), text("................................")], { alignment: AlignmentType.LEFT, spacingAfter: 60 }),
    paragraph(
      [
        text("Lớp: ", { bold: true }),
        text(`${lesson.generalInfo.grade} `),
        text("Sĩ số: ", { bold: true }),
        text("............................. "),
        text("Thời lượng: ", { bold: true }),
        text(`${lesson.generalInfo.duration} phút`),
      ],
      { alignment: AlignmentType.LEFT, spacingAfter: 60 },
    ),
    paragraph([text("Người dạy: ", { bold: true }), text("............................. "), text("Môn: ", { bold: true }), text(lesson.generalInfo.subject)], {
      alignment: AlignmentType.LEFT,
      spacingAfter: 140,
    }),
    paragraph([text(`GIÁO ÁN MÔN ${lesson.generalInfo.subject.toUpperCase()} ${gradeLabel(lesson.generalInfo.grade).toUpperCase()}`, { bold: true, color: BLUE, size: 36 })], {
      alignment: AlignmentType.CENTER,
      spacingAfter: 90,
    }),
    paragraph([text(lessonHeadingTitle(lesson.generalInfo.lessonTitle), { bold: true, color: BRIGHT_BLUE, size: 34 })], {
      alignment: AlignmentType.CENTER,
      spacingAfter: 20,
    }),
    paragraph([text(`(TIẾT ${period.periodNumber})`, { bold: true, color: RED, size: 34 })], { alignment: AlignmentType.CENTER, spacingAfter: 70 }),
    paragraph([text("Ngày ........ tháng ........ năm ........", { italic: true })], {
      alignment: AlignmentType.RIGHT,
      spacingAfter: 120,
    }),

    sectionTitle("I. YÊU CẦU CẦN ĐẠT"),
    subTitle("1. Kiến thức, kĩ năng:"),
    ...dashList(outcomes.knowledgeAndSkills),
    subTitle("2. Năng lực chung:"),
    ...dashList(outcomes.generalCompetencies),
    subTitle("3. Năng lực đặc thù môn học:"),
    ...dashList(outcomes.specificCompetencies),
    ...(outcomes.digitalCompetencies && outcomes.digitalCompetencies.length > 0 ? [
      subTitle("4. Năng lực số:"),
      ...dashList(outcomes.digitalCompetencies),
      subTitle("5. Phẩm chất:"),
    ] : [
      subTitle("4. Phẩm chất:"),
    ]),
    ...dashList(outcomes.qualities),

    sectionTitle("II. THIẾT BỊ DẠY HỌC VÀ HỌC LIỆU"),
    subTitle("1. Giáo viên:"),
    ...dashList(lesson.materials.teacher),
    subTitle("2. Học sinh:"),
    ...dashList(lesson.materials.students),

    sectionTitle("III. TIẾN TRÌNH DẠY HỌC"),
    activitiesTable(period.activities, displayOptions),

    sectionTitle("IV. ĐIỀU CHỈNH SAU BÀI DẠY"),
    blankLine(),
    blankLine(),
    blankLine(),
    blankLine(),
  ];
}

export function buildLessonDocxDocument(lesson: LessonPlan) {
  const periods = normalizedPeriods(lesson);
  const children = periods.flatMap((period, index) => (index === 0 ? periodChildren(lesson, period) : [pageBreak(), ...periodChildren(lesson, period)]));

  return new Document({
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: cm(1.8), bottom: cm(1.8), left: cm(1.6), right: cm(1.6) },
          },
        },
        children,
      },
    ],
  });
}

export async function exportLessonToDocx(lesson: LessonPlan, fileName: string) {
  const doc = buildLessonDocxDocument(lesson);
  const packedBlob = await Packer.toBlob(doc);
  const blob = await injectMathIntoDocx(packedBlob);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${fileName}.docx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
