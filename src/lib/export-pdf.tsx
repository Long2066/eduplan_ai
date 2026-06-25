import { join } from "node:path";
import React from "react";
import { Document, Font, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { lessonHeadingTitle } from "@/lib/lesson-format";
import { activityDocumentBlock, gradeLabel, normalizedPeriods } from "@/lib/lesson-document-model";
import type { LessonActivity, LessonPlan, PeriodPlan } from "@/types/lesson";

const BLUE = "#1F4E79";
const BRIGHT_BLUE = "#0070C0";
const RED = "#C00000";
const BLACK = "#000000";
const BORDER = "#000000";
const TABLE_HEADER = "#D9EAF7";
const FONT_FAMILY = "TinosEduPlan";

let fontsRegistered = false;

function registerFonts() {
  if (fontsRegistered) return;
  const fontDir = join(process.cwd(), "public", "fonts");

  Font.register({
    family: FONT_FAMILY,
    fonts: [
      { src: join(fontDir, "Tinos-Regular.ttf"), fontWeight: "normal" },
      { src: join(fontDir, "Tinos-Bold.ttf"), fontWeight: "bold" },
      { src: join(fontDir, "Tinos-Italic.ttf"), fontStyle: "italic" },
      { src: join(fontDir, "Tinos-BoldItalic.ttf"), fontWeight: "bold", fontStyle: "italic" },
    ],
  });
  Font.registerHyphenationCallback((word) => [word]);
  fontsRegistered = true;
}

function listItems(items: string[]) {
  return (items?.length ? items : ["........................................................"]).map((item, index) => (
    <Text key={`${item}-${index}`} style={styles.paragraph}>
      - {item}
    </Text>
  ));
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

function SubTitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.subTitle}>{children}</Text>;
}

function ActivityIntro({ activity, index }: { activity: LessonActivity; index: number }) {
  const block = activityDocumentBlock(activity, index);
  return (
    <View>
      <Text style={styles.boldText}>
        {block.heading}
      </Text>
      <Text style={styles.paragraph}>
        <Text style={styles.boldText}>* Mục tiêu: </Text>
        <Text style={styles.italicText}>{block.objective}</Text>
      </Text>
      <Text style={styles.paragraph}>
        <Text style={styles.boldText}>* Sản phẩm/đánh giá: </Text>
        <Text style={styles.italicText}>{block.products}</Text>
      </Text>
      <Text style={[styles.paragraph, styles.blueItalic]}>
        <Text style={styles.boldText}>* Cách tiến hành:</Text>
      </Text>
    </View>
  );
}

function TableCell({ children, header = false, bottomBorder = false }: { children?: React.ReactNode; header?: boolean; bottomBorder?: boolean }) {
  const cellStyle = header
    ? [styles.tableCell, styles.tableHeaderCell, styles.tableHorizontalBorder]
    : bottomBorder
      ? [styles.tableCell, styles.tableHorizontalBorder]
      : styles.tableCell;

  return <View style={cellStyle}>{children}</View>;
}

function ActionRow({ teacher, student, isActivityEnd }: { teacher: string; student: string; isActivityEnd: boolean }) {
  return (
    <View style={styles.tableRow}>
      <TableCell bottomBorder={isActivityEnd}>
        <Text style={styles.tableText}>- {teacher}</Text>
      </TableCell>
      <TableCell bottomBorder={isActivityEnd}>
        <Text style={styles.tableText}>- {student}</Text>
      </TableCell>
    </View>
  );
}

function ActivitiesTable({ activities }: { activities: LessonActivity[] }) {
  return (
    <View style={styles.table}>
      <View style={styles.tableRow} fixed>
        <TableCell header>
          <Text style={styles.tableHeaderText}>Hoạt động của giáo viên</Text>
        </TableCell>
        <TableCell header>
          <Text style={styles.tableHeaderText}>Hoạt động của học sinh</Text>
        </TableCell>
      </View>
      {activities.map((activity, index) => {
        const block = activityDocumentBlock(activity, index);
        return (
          <React.Fragment key={`${activity.phase}-${activity.title}-${index}`}>
            <View style={styles.tableRow} wrap={false}>
              <TableCell>
                <ActivityIntro activity={activity} index={index} />
              </TableCell>
              <TableCell />
            </View>
            {block.actionPairs.map((pair, pairIndex) => (
              <ActionRow key={`${activity.phase}-${index}-${pairIndex}`} teacher={pair.teacher} student={pair.student} isActivityEnd={pairIndex === block.actionPairs.length - 1} />
            ))}
          </React.Fragment>
        );
      })}
    </View>
  );
}

function PeriodPage({ lesson, period }: { lesson: LessonPlan; period: PeriodPlan }) {
  const outcomes = period.outcomes || lesson.outcomes;

  return (
    <Page size="A4" style={styles.page}>
      <Text style={styles.leftLine}>
        <Text style={styles.boldText}>TRƯỜNG: </Text>
        ................................
      </Text>
      <Text style={styles.leftLine}>
        <Text style={styles.boldText}>Lớp: </Text>
        {lesson.generalInfo.grade} <Text style={styles.boldText}>Sĩ số: </Text>
        ............................. <Text style={styles.boldText}>Thời lượng: </Text>
        {lesson.generalInfo.duration} phút
      </Text>
      <Text style={[styles.leftLine, styles.adminBottom]}>
        <Text style={styles.boldText}>Người dạy: </Text>
        ............................. <Text style={styles.boldText}>Môn: </Text>
        {lesson.generalInfo.subject}
      </Text>

      <Text style={styles.mainTitle}>
        GIÁO ÁN MÔN {lesson.generalInfo.subject.toUpperCase()} {gradeLabel(lesson.generalInfo.grade).toUpperCase()}
      </Text>
      <Text style={styles.lessonTitle}>{lessonHeadingTitle(lesson.generalInfo.lessonTitle)}</Text>
      <Text style={styles.periodTitle}>(TIẾT {period.periodNumber})</Text>
      <Text style={styles.dateLine}>Ngày ........ tháng ........ năm ........</Text>

      <SectionTitle>I. YÊU CẦU CẦN ĐẠT</SectionTitle>
      <SubTitle>1. Kiến thức, kĩ năng:</SubTitle>
      {listItems(outcomes.knowledgeAndSkills)}
      <SubTitle>2. Năng lực chung:</SubTitle>
      {listItems(outcomes.generalCompetencies)}
      <SubTitle>3. Năng lực đặc thù môn học:</SubTitle>
      {listItems(outcomes.specificCompetencies)}
      <SubTitle>4. Năng lực số:</SubTitle>
      {listItems([
        "Nhận biết và khai thác thông tin từ ảnh/video/tài liệu số do giáo viên trình chiếu để phục vụ học tập.",
        "Tham gia tương tác học tập trên thiết bị số ở mức phù hợp lứa tuổi theo hướng dẫn của giáo viên.",
      ])}
      <SubTitle>5. Phẩm chất:</SubTitle>
      {listItems(outcomes.qualities)}

      <SectionTitle>II. THIẾT BỊ DẠY HỌC VÀ HỌC LIỆU</SectionTitle>
      <SubTitle>1. Giáo viên:</SubTitle>
      {listItems(lesson.materials.teacher)}
      <SubTitle>2. Học sinh:</SubTitle>
      {listItems(lesson.materials.students)}

      <SectionTitle>III. TIẾN TRÌNH DẠY HỌC</SectionTitle>
      <ActivitiesTable activities={period.activities} />

      <SectionTitle>IV. ĐIỀU CHỈNH SAU BÀI DẠY</SectionTitle>
      <Text style={styles.blankLine}>........................................................................................................................................</Text>
      <Text style={styles.blankLine}>........................................................................................................................................</Text>
      <Text style={styles.blankLine}>........................................................................................................................................</Text>
      <Text style={styles.blankLine}>........................................................................................................................................</Text>
    </Page>
  );
}

function LessonPdfDocument({ lesson }: { lesson: LessonPlan }) {
  return (
    <Document title={lesson.generalInfo.lessonTitle || "Giáo án EduPlan AI"} author="EduPlan AI">
      {normalizedPeriods(lesson).map((period) => (
        <PeriodPage key={period.periodNumber} lesson={lesson} period={period} />
      ))}
    </Document>
  );
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 51,
    paddingBottom: 51,
    paddingLeft: 45,
    paddingRight: 45,
    fontFamily: FONT_FAMILY,
    fontSize: 14,
    lineHeight: 1.25,
    color: BLACK,
  },
  leftLine: {
    marginBottom: 4,
    textAlign: "left",
  },
  adminBottom: {
    marginBottom: 14,
  },
  mainTitle: {
    marginBottom: 8,
    color: BLUE,
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "center",
    textTransform: "uppercase",
  },
  lessonTitle: {
    marginBottom: 2,
    color: BRIGHT_BLUE,
    fontSize: 17,
    fontWeight: "bold",
    textAlign: "center",
    textTransform: "uppercase",
  },
  periodTitle: {
    marginBottom: 8,
    color: RED,
    fontSize: 17,
    fontWeight: "bold",
    textAlign: "center",
  },
  dateLine: {
    marginBottom: 13,
    paddingRight: 68,
    fontStyle: "italic",
    textAlign: "right",
  },
  sectionTitle: {
    marginTop: 8,
    marginBottom: 5,
    color: BLUE,
    fontSize: 15,
    fontWeight: "bold",
  },
  subTitle: {
    marginTop: 2,
    marginBottom: 2,
    fontWeight: "bold",
  },
  paragraph: {
    marginBottom: 3,
    textAlign: "justify",
  },
  blankLine: {
    marginBottom: 3,
  },
  boldText: {
    fontWeight: "bold",
  },
  italicText: {
    fontStyle: "italic",
  },
  blueText: {
    color: BLUE,
  },
  blueItalic: {
    color: BRIGHT_BLUE,
    fontStyle: "italic",
  },
  table: {
    width: "100%",
    marginTop: 4,
    marginBottom: 8,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderColor: BORDER,
  },
  tableRow: {
    flexDirection: "row",
  },
  tableCell: {
    width: "50%",
    padding: 6,
    borderRightWidth: 1,
    borderColor: BORDER,
  },
  tableHeaderCell: {
    backgroundColor: TABLE_HEADER,
  },
  tableHorizontalBorder: {
    borderBottomWidth: 1,
  },
  tableHeaderText: {
    fontWeight: "bold",
    textAlign: "center",
  },
  tableText: {
    fontSize: 14,
    lineHeight: 1.25,
    textAlign: "justify",
  },
});

export async function renderLessonPdfToBuffer(lesson: LessonPlan) {
  registerFonts();
  return renderToBuffer(<LessonPdfDocument lesson={lesson} />);
}
