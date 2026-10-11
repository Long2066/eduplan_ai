import {
  AlignmentType,
  BorderStyle,
  Document,
  ImageRun,
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
import { lessonHeadingTitle, safeStringArray, sanitizeMaterialList } from "@/lib/lesson-format";
import { assertSpecificLessonTitle } from "@/lib/lesson-title";
import { activityDocumentBlock, lessonDocumentHeading, normalizedPeriods } from "@/lib/lesson-document-model";
import { lessonNeedsAdjustment, lessonValidationLabel } from "@/lib/lesson-validation-status";
import type { ActivityDocumentOptions, LessonDocumentHeading } from "@/lib/lesson-document-model";
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

function teacherVisualParagraphs(activity: LessonActivity): Paragraph[] {
  if (!activity.teacherVisuals?.length) return [];
  const paragraphs: Paragraph[] = [];

  for (const vis of activity.teacherVisuals) {
    if (!vis.dataUrl) continue;
    const match = vis.dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) continue;
    try {
      const buffer = Buffer.from(match[2], "base64");
      const targetWidth = Math.min(vis.widthPx || 240, 240);
      const aspect = (vis.heightPx && vis.widthPx) ? vis.heightPx / vis.widthPx : 0.65;
      const targetHeight = Math.round(targetWidth * aspect);

      paragraphs.push(
        metadataParagraph("* Ảnh học liệu SGK minh họa", vis.caption || "Hình ảnh trích xuất từ SGK", "1F4E79"),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 50 },
          children: [
            new ImageRun({
              data: buffer,
              type: "png",
              transformation: {
                width: targetWidth,
                height: targetHeight,
              },
            }),
          ],
        }),
      );
    } catch {
      // Bỏ qua nếu buffer hỏng, giữ text nguyên vẹn
    }
  }

  return paragraphs;
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
    ...teacherVisualParagraphs(activity),
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
  const heading = lessonDocumentHeading(lesson, period);
  const compact = lesson.meta?.plan === "free";
  const displayOptions: ActivityDocumentOptions = {
    compact,
    concise: true,
  };

  return [
    ...(lessonNeedsAdjustment(lesson)
      ? [paragraph([text(lessonValidationLabel(lesson), { bold: true, color: RED })], {
          alignment: AlignmentType.CENTER,
          spacingAfter: 80,
        })]
      : []),
    paragraph([text(heading.documentTitle, { bold: true, color: BLUE, size: 36 })], {
      alignment: AlignmentType.CENTER,
      spacingAfter: 90,
    }),
    paragraph([text(`${heading.schoolLabel} `, { bold: true }), text("................................")], { alignment: AlignmentType.LEFT, spacingAfter: 60 }),
    paragraph(
      [
        text("Lớp: ", { bold: true }),
        text(`${heading.grade} `),
        text("Sĩ số: ", { bold: true }),
        text("............................. "),
        text("Thời lượng: ", { bold: true }),
        text(`${heading.durationMinutes} phút`),
      ],
      { alignment: AlignmentType.LEFT, spacingAfter: 60 },
    ),
    paragraph([text("Người dạy: ", { bold: true }), text("............................. "), text("Môn: ", { bold: true }), text(heading.subject)], {
      alignment: AlignmentType.LEFT,
      spacingAfter: 90,
    }),
    paragraph([text(lessonHeadingTitle(heading.lessonTitle), { bold: true, color: BRIGHT_BLUE, size: 34 })], {
      alignment: AlignmentType.CENTER,
      spacingAfter: 20,
    }),
    paragraph([text(heading.periodLabel, { bold: true, color: RED, size: 34 })], { alignment: AlignmentType.CENTER, spacingAfter: 70 }),
    paragraph([text(heading.dateLabel, { italic: true })], {
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
    ...dashList(sanitizeMaterialList(lesson.materials?.teacher)),
    subTitle("2. Học sinh:"),
    ...dashList(sanitizeMaterialList(lesson.materials?.students)),

    sectionTitle("III. TIẾN TRÌNH DẠY HỌC"),
    activitiesTable(period.activities, displayOptions),

    sectionTitle("IV. ĐIỀU CHỈNH SAU BÀI DẠY"),
    blankLine(),
    blankLine(),
    blankLine(),
    blankLine(),
  ];
}

function buildPeriodsTable(periods: PeriodPlan[], displayOptions: ActivityDocumentOptions = {}, heading?: LessonDocumentHeading) {
  const isMultiPeriod = periods.length > 1;
  const allRows: TableRow[] = [];

  periods.forEach((period) => {
    if (isMultiPeriod) {
      allRows.push(
        new TableRow({
          children: [
            new TableCell({
              columnSpan: 2,
              children: [
                ...(period.periodNumber > 1 && heading ? [
                  paragraph(
                    [text(lessonHeadingTitle(heading.lessonTitle), { bold: true, color: BRIGHT_BLUE, size: 26 })],
                    { alignment: AlignmentType.CENTER, spacingAfter: 15 }
                  )
                ] : []),
                paragraph(
                  [text(`(TIẾT ${period.periodNumber})${period.focus ? `: ${period.focus.toUpperCase()}` : ""}`, { bold: true, color: RED, size: 28 })],
                  { alignment: AlignmentType.CENTER, spacingAfter: 30 }
                ),
              ],
              shading: { type: ShadingType.CLEAR, fill: "F2F4F7" },
              verticalAlign: VerticalAlign.CENTER,
              margins: { top: 100, bottom: 100, left: 120, right: 120 },
              borders: {
                top: singleBorder,
                bottom: singleBorder,
                left: singleBorder,
                right: singleBorder,
              },
            }),
          ],
        }),
      );
    }

    allRows.push(
      new TableRow({
        tableHeader: true,
        children: [
          cell([paragraph([text("Hoạt động của giáo viên", { bold: true })], { alignment: AlignmentType.CENTER })], { header: true }),
          cell([paragraph([text("Hoạt động của học sinh", { bold: true })], { alignment: AlignmentType.CENTER })], { header: true }),
        ],
      }),
    );

    const activityRows = period.activities.flatMap((activity, index) => {
      const block = activityDocumentBlock(activity, index, displayOptions);
      return [
        new TableRow({
          children: [
            cell(activityCellTeacher(activity, index, displayOptions), { topBorder: false, bottomBorder: false }),
            cell([paragraph("")], { topBorder: false, bottomBorder: false }),
          ],
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
    });

    allRows.push(...activityRows);
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: allRows,
  });
}

export function buildLessonDocxDocument(lesson: LessonPlan) {
  const lessonTitle = assertSpecificLessonTitle(
    lesson.generalInfo?.lessonTitle,
    lesson.generalInfo?.subject,
  );
  const documentLesson: LessonPlan = {
    ...lesson,
    generalInfo: { ...lesson.generalInfo, lessonTitle },
  };
  const periods = normalizedPeriods(documentLesson);
  const isMultiPeriod = periods.length > 1;
  const firstPeriod = periods[0];
  const heading = lessonDocumentHeading(documentLesson, firstPeriod);
  const outcomes = documentLesson.outcomes;
  const displayOptions: ActivityDocumentOptions = {
    compact: documentLesson.meta?.plan === "free",
    concise: true,
  };

  const children: Array<Paragraph | Table> = [];

  // 1. Header block
  if (lessonNeedsAdjustment(documentLesson)) {
    children.push(paragraph([text(lessonValidationLabel(documentLesson), { bold: true, color: RED })], {
      alignment: AlignmentType.CENTER,
      spacingAfter: 80,
    }));
  }
  children.push(
    paragraph([text(heading.documentTitle, { bold: true, color: BLUE, size: 36 })], {
      alignment: AlignmentType.CENTER,
      spacingAfter: 90,
    }),
    paragraph([text(`${heading.schoolLabel} `, { bold: true }), text("................................")], { alignment: AlignmentType.LEFT, spacingAfter: 60 }),
    paragraph(
      [
        text("Lớp: ", { bold: true }),
        text(`${heading.grade} `),
        text("Sĩ số: ", { bold: true }),
        text("............................. "),
        text("Thời lượng: ", { bold: true }),
        text(`${heading.durationMinutes} phút${isMultiPeriod ? ` (${periods.length} tiết)` : ""}`),
      ],
      { alignment: AlignmentType.LEFT, spacingAfter: 60 },
    ),
    paragraph([text("Người dạy: ", { bold: true }), text("............................. "), text("Môn: ", { bold: true }), text(heading.subject)], {
      alignment: AlignmentType.LEFT,
      spacingAfter: 90,
    }),
    paragraph([text(lessonHeadingTitle(heading.lessonTitle), { bold: true, color: BRIGHT_BLUE, size: 34 })], {
      alignment: AlignmentType.CENTER,
      spacingAfter: 20,
    }),
    paragraph([text(isMultiPeriod ? `(TIẾT 1)` : heading.periodLabel, { bold: true, color: RED, size: 34 })], {
      alignment: AlignmentType.CENTER,
      spacingAfter: 70,
    }),
    paragraph([text(heading.dateLabel, { italic: true })], {
      alignment: AlignmentType.RIGHT,
      spacingAfter: 120,
    }),

    // I. YÊU CẦU CẦN ĐẠT (duy nhất 1 lần cho toàn bài)
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

    // II. THIẾT BỊ DẠY HỌC VÀ HỌC LIỆU (duy nhất 1 lần cho toàn bài)
    sectionTitle("II. THIẾT BỊ DẠY HỌC VÀ HỌC LIỆU"),
    subTitle("1. Giáo viên:"),
    ...dashList(sanitizeMaterialList(documentLesson.materials?.teacher)),
    subTitle("2. Học sinh:"),
    ...dashList(sanitizeMaterialList(documentLesson.materials?.students)),

    // III. TIẾN TRÌNH DẠY HỌC (Toàn bộ 100% nằm trong bảng)
    sectionTitle("III. TIẾN TRÌNH DẠY HỌC"),
    buildPeriodsTable(periods, displayOptions, heading),

    // IV. ĐIỀU CHỈNH SAU BÀI DẠY (duy nhất 1 lần ở cuối bài dạy)
    sectionTitle("IV. ĐIỀU CHỈNH SAU BÀI DẠY"),
    blankLine(),
    blankLine(),
    blankLine(),
    blankLine(),
  );

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
