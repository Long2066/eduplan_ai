import type { LessonPlan } from "@/types/lesson";

export const mathFixtureLesson: LessonPlan = {
  generalInfo: {
    subject: "Toán",
    grade: "Lớp 5",
    lessonTitle: "Ôn tập phân số và số đo",
    book: "Kết nối tri thức",
    periods: 1,
    duration: 35,
  },
  outcomes: {
    knowledgeAndSkills: [String.raw`Tính được \(\frac{3}{4}+\frac{1}{4}=1\) và nhận biết \(\sqrt{25}=5\).`],
    generalCompetencies: ["Tự chủ và tự học trong quá trình giải bài toán."],
    specificCompetencies: [String.raw`Sử dụng biểu diễn toán học với \(x^2\), \(60^\circ\) và đơn vị \(20\,\mathrm{cm}^2\).`],
    qualities: ["Chăm chỉ và trung thực khi kiểm tra kết quả."],
    digitalCompetencies: [],
  },
  materials: {
    teacher: ["Bảng phụ và phiếu học tập"],
    students: ["SGK, vở Toán, bảng con"],
  },
  activities: [],
  periodPlans: [
    {
      periodNumber: 1,
      focus: "Ôn tập công thức và đặt tính",
      activities: [
        {
          phase: "Khởi động",
          title: "Đố vui phân số",
          objective: String.raw`Nhắc lại ý nghĩa của \(\frac{3}{4}\).`,
          durationMinutes: 5,
          teacherActions: [String.raw`GV nêu phép tính \(\frac{3}{4}+\frac{1}{4}=\ldots\).`],
          studentActions: [String.raw`HS trả lời \(\frac{3}{4}+\frac{1}{4}=1\).`],
          learningProducts: [String.raw`Kết quả \(1\).`],
        },
        {
          phase: "Khám phá",
          title: "Đặt tính thẳng cột",
          objective: "Đặt tính đúng hàng và thực hiện phép cộng số thập phân.",
          durationMinutes: 15,
          teacherActions: [String.raw`GV hướng dẫn phép tính \[\begin{array}{r}1{,}65\\+\;1{,}26\\\hline2{,}91\end{array}\]`],
          studentActions: [String.raw`HS đối chiếu và nêu kết quả \(2{,}91\).`],
          learningProducts: [String.raw`Phép tính dọc có kết quả \(2{,}91\).`],
        },
        {
          phase: "Luyện tập",
          title: "Tính và kiểm tra",
          objective: String.raw`Tính được \(\sqrt{25}\) và \(5^2\).`,
          durationMinutes: 10,
          teacherActions: [String.raw`GV giao bài \(\sqrt{25}=\ldots\), \(5^2=\ldots\).`],
          studentActions: [String.raw`HS nêu \(\sqrt{25}=5\), \(5^2=25\).`],
          learningProducts: [String.raw`Đáp án \(5\) và \(25\).`],
        },
        {
          phase: "Vận dụng",
          title: "Tính diện tích",
          objective: "Vận dụng công thức diện tích hình vuông.",
          durationMinutes: 5,
          teacherActions: [String.raw`GV yêu cầu tính diện tích hình vuông cạnh \(5\,\mathrm{cm}\).`],
          studentActions: [String.raw`HS tính \(S=5^2=25\,\mathrm{cm}^2\).`],
          learningProducts: [String.raw`Kết quả \(25\,\mathrm{cm}^2\).`],
        },
      ],
    },
  ],
  assessment: { criteria: [], evidence: [], comments: [] },
  adjustments: { suitablePoints: [], pointsToAdjust: [], nextLessonDirection: [] },
  contextFit: { notes: [] },
  meta: { style: "Dạy thật trên lớp", modelUsed: "fixture", createdAt: "2026-07-23T00:00:00.000Z" },
};
