import { normalizeNaturalSocialText } from "./natural-social-pedagogy";
import type {
  LessonActivity,
  LessonInput,
  NaturalSocialLessonType,
  NaturalSocialSourceInventory,
  NaturalSocialTopicFocus,
} from "@/types/lesson";

export const NATURAL_SOCIAL_OUTSIDE_SGK_LABEL = "Học liệu gợi mở ngoài SGK";

export type NaturalSocialStartupSuggestion = {
  id: string;
  title: string;
  sourceLabel: string;
  durationMinutes: number;
  organization: "whole_class";
  materials: string[];
  teacherActions: string[];
  studentActions: string[];
  bridgeQuestion: string;
  learningProduct: string;
  successCriteria: string[];
  expectedAnswer: string;
  acceptableResponses: string[];
  commonErrors: string[];
  teacherFeedback: string[];
  coveragePurpose: string;
};

type NaturalSocialStartupContext = {
  input: LessonInput;
  lessonType: NaturalSocialLessonType;
  topicFocus?: NaturalSocialTopicFocus;
  periodNumber: number;
  lessonTitle: string;
  focus?: string;
  inquiryQuestion?: string;
  sourceInventory?: NaturalSocialSourceInventory;
  observationTargets?: string[];
};

type StartupRuntimeContext = {
  topic: string;
  grade: number;
  periodNumber: number;
  sourceAnchor: string;
  inquiryQuestion: string;
  canUseAudio: boolean;
  canUseProjection: boolean;
};

type StartupTemplate = {
  id: string;
  requiresAudio?: boolean;
  requiresProjection?: boolean;
  textHeavy?: boolean;
  build: (context: StartupRuntimeContext) => NaturalSocialStartupSuggestion;
};

const metadataLabelPattern = /^(hoc lieu\/dau vao|hoc lieu|dau vao|cach to chuc|tieu chi thanh cong|dap an du kien|loi thuong gap|phan hoi cua gv|ho tro hs can giup do|mo rong cho hs hoan thanh som)\s*[:：-]/i;
const outsideStimulusPattern = /video|am thanh|bai hat|nhac|hop bi mat|the bi mat|vat that|mo hinh|tranh goi mo|anh goi mo|hinh anh goi mo|slide goi mo|tro choi goi mo/i;

function gradeNumber(value: string) {
  const match = String(value || "").match(/([1-5])/);
  return match ? Number(match[1]) : 0;
}

function stableHash(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function facilityText(input: LessonInput) {
  return input.facilities === "auto" ? "auto" : input.facilities.join(" ");
}

function facilityProfile(input: LessonInput) {
  const normalized = normalizeNaturalSocialText(facilityText(input));
  const auto = input.facilities === "auto";
  return {
    canUseAudio: auto || /loa|am thanh|speaker|may tinh|laptop|tv|ti vi|man hinh|may chieu|bang tuong tac|wifi/.test(normalized),
    canUseProjection: auto || /tv|ti vi|man hinh|may chieu|projector|bang tuong tac|slide|wifi|may tinh|laptop/.test(normalized),
  };
}

function compactTitle(value: string) {
  return String(value || "")
    .replace(/^bài\s*\d+\s*[:.\-]?\s*/i, "")
    .replace(/^chủ đề\s*\d+\s*[:.\-]?\s*/i, "")
    .replace(/\s+/g, " ")
    .trim() || "bài học";
}

function outsideMaterial(value: string) {
  return `${NATURAL_SOCIAL_OUTSIDE_SGK_LABEL}: ${value}`;
}

function sourceAnchorFromInventory(sourceInventory: NaturalSocialSourceInventory | undefined, periodNumber: number) {
  const periodTask = [
    ...(sourceInventory?.questions || []).map((item) => ({
      periodNumber: item.periodNumber,
      label: item.question,
      visualIds: item.visualIds || [],
    })),
    ...(sourceInventory?.procedures || []).map((item) => ({
      periodNumber: item.periodNumber,
      label: item.label,
      visualIds: item.visualIds || [],
    })),
    ...(sourceInventory?.practiceTasks || []).map((item) => ({
      periodNumber: item.periodNumber,
      label: item.label,
      visualIds: [],
    })),
    ...(sourceInventory?.situations || []).map((item) => ({
      periodNumber: item.periodNumber,
      label: item.label,
      visualIds: [],
    })),
    ...(sourceInventory?.classificationTasks || []).map((item) => ({
      periodNumber: item.periodNumber,
      label: item.label,
      visualIds: item.visualIds || [],
    })),
    ...(sourceInventory?.personalTasks || []).map((item) => ({
      periodNumber: item.periodNumber,
      label: item.label,
      visualIds: [],
    })),
    ...(sourceInventory?.requiredTasks || []).map((item) => ({
      periodNumber: item.periodNumber,
      label: item.label,
      visualIds: [],
    })),
  ].find((item) => !item.periodNumber || Number(item.periodNumber) === Number(periodNumber));

  if (periodTask?.visualIds?.length) {
    const visual = sourceInventory?.visuals?.find((item) => item.visualId && periodTask.visualIds.includes(item.visualId));
    if (visual?.label) return `tranh SGK "${visual.label}"`;
  }
  if (periodTask?.label) return `nhiệm vụ SGK "${periodTask.label}"`;

  const visual = sourceInventory?.visuals?.find((item) => item.required !== false && item.label);
  if (visual?.label) return `tranh SGK "${visual.label}"`;

  return "tranh/nhiệm vụ SGK của bài";
}

function makeSuggestion(context: StartupRuntimeContext, partial: Omit<NaturalSocialStartupSuggestion, "sourceLabel" | "durationMinutes" | "organization" | "coveragePurpose">): NaturalSocialStartupSuggestion {
  return {
    ...partial,
    sourceLabel: NATURAL_SOCIAL_OUTSIDE_SGK_LABEL,
    durationMinutes: 3,
    organization: "whole_class",
    coveragePurpose: `Gợi hứng thú và kích hoạt trải nghiệm ban đầu; không thay thế nhiệm vụ SGK, sau đó quay về ${context.sourceAnchor} ở Khám phá/Luyện tập.`,
  };
}

const homeEnvironmentTemplates: StartupTemplate[] = [
  {
    id: "home-silhouette-guess",
    build: (context) => makeSuggestion(context, {
      id: "home-silhouette-guess",
      title: "Nhìn bóng đoán kiểu nhà",
      materials: [outsideMaterial("2-3 thẻ hình/bóng ngôi nhà quen thuộc, không ghi địa chỉ thật")],
      teacherActions: [
        "GV lần lượt giơ thẻ hình ngôi nhà, cho HS dùng tín hiệu tay để đoán kiểu nhà hoặc nêu một đặc điểm nhìn thấy.",
        "GV mời 2-3 HS nói ngắn: Con dựa vào chi tiết nào để đoán?; chấp nhận cách gọi gần gũi, không so sánh nhà đẹp - xấu hoặc tốt - kém.",
        `GV hỏi cầu nối: "Khi quan sát ${context.sourceAnchor}, con sẽ tìm địa chỉ trong tranh, đặc điểm ngôi nhà và quang cảnh xung quanh bằng chi tiết nào?"`,
      ],
      studentActions: [
        "HS quan sát, chọn bằng tín hiệu tay và nói một đặc điểm như cao/thấp, nhiều tầng, có sân hoặc ở khu vực quen thuộc.",
        "HS nêu căn cứ từ hình, lắng nghe cách gọi khác nhau và tôn trọng sự đa dạng của mỗi ngôi nhà.",
        "HS chuyển sang tranh/nhiệm vụ SGK để kiểm chứng dự đoán.",
      ],
      bridgeQuestion: `Con sẽ dựa vào chi tiết nào trong ${context.sourceAnchor} để nhận ra địa chỉ trong tranh, đặc điểm và kiểu ngôi nhà?`,
      learningProduct: "Dự đoán miệng về kiểu hoặc đặc điểm ngôi nhà",
      successCriteria: ["Nêu được ít nhất một đặc điểm nhìn thấy.", "Không đánh giá nhà đẹp/xấu, tốt/kém."],
      expectedAnswer: "HS có thể nhận ra một số kiểu/đặc điểm nhà dựa vào số tầng, mái, sân, vật liệu hoặc quang cảnh trong hình.",
      acceptableResponses: ["Con thấy ngôi nhà có ...", "Con đoán đây là ... vì ..."],
      commonErrors: ["Đoán theo sở thích mà chưa chỉ ra chi tiết.", "So sánh hoàn cảnh gia đình theo hướng hơn - kém."],
      teacherFeedback: ["GV hỏi: Con nhìn thấy chi tiết nào?", "GV nhắc mỗi kiểu nhà phù hợp với điều kiện và nơi sống khác nhau."],
    }),
  },
  {
    id: "home-room-object-signal",
    build: (context) => makeSuggestion(context, {
      id: "home-room-object-signal",
      title: "Đồ dùng tìm đúng phòng",
      materials: [outsideMaterial("thẻ hình 3-4 đồ dùng quen thuộc và kí hiệu các phòng")],
      teacherActions: [
        "GV giơ lần lượt thẻ đồ dùng; HS dùng tín hiệu tay hoặc chỉ vào kí hiệu phòng mà đồ dùng thường được sử dụng.",
        "GV mời HS nêu lí do ngắn dựa vào công dụng; chấp nhận trường hợp một đồ dùng có thể ở nhiều vị trí nếu giải thích hợp lí.",
        `GV hỏi cầu nối: "Trong ${context.sourceAnchor}, các phòng có đồ dùng nào và chúng giúp nhận ra công dụng của phòng ra sao?"`,
      ],
      studentActions: [
        "HS quan sát thẻ, chọn phòng bằng tín hiệu, không cần viết.",
        "HS nói theo mẫu: Em chọn phòng ... vì đồ dùng này dùng để ...",
        "HS chuyển sang tranh/nhiệm vụ SGK để kiểm chứng và bổ sung.",
      ],
      bridgeQuestion: `Các phòng trong ${context.sourceAnchor} có đồ dùng nào và đồ dùng đó thường dùng để làm gì?`,
      learningProduct: "Lựa chọn miệng/tín hiệu ghép đồ dùng với phòng",
      successCriteria: ["Ghép được đồ dùng với một phòng phù hợp.", "Nêu được lí do ngắn theo công dụng."],
      expectedAnswer: "HS ghép đồ dùng với phòng thường sử dụng và giải thích bằng công dụng gần gũi.",
      acceptableResponses: ["Đồ dùng này thường ở phòng ...", "Nhà em đặt ở chỗ khác nhưng dùng để ..."],
      commonErrors: ["Ghép theo màu hoặc sở thích.", "Cho rằng mọi gia đình phải bố trí phòng và đồ dùng giống nhau."],
      teacherFeedback: ["GV gợi bằng câu hỏi: Đồ dùng này dùng lúc nào?", "GV tôn trọng cách bố trí khác nhau nếu HS giải thích hợp lí."],
    }),
  },
];

const familyTemplates: StartupTemplate[] = [
  {
    id: "family-action-rhythm",
    build: (context) => makeSuggestion(context, {
      id: "family-action-rhythm",
      title: "Nhịp vỗ việc nhà",
      materials: [outsideMaterial("thẻ biểu tượng việc nhà hoặc lời gợi ngắn của GV"), "Bảng lớp để GV ghi 2-3 từ khóa sau khi HS nói"],
      teacherActions: [
        "GV nêu luật trò chơi: nghe một việc quen thuộc ở nhà, HS vỗ một nhịp nếu đã nhìn thấy người thân làm việc đó, vỗ hai nhịp nếu em đã từng phụ giúp.",
        "GV đọc nhanh 3 việc sát bài như nấu ăn, dọn bàn, chăm em, lau bàn hoặc hỏi thăm ông bà; mời cả lớp nói một chi tiết quan sát được bằng mẫu câu ngắn.",
        `GV hỏi cầu nối: "Từ những việc vừa nhắc, khi quan sát ${context.sourceAnchor}, con cần nhìn ai, đang làm gì và việc đó giúp gia đình thế nào?"`,
      ],
      studentActions: [
        "HS tham gia bằng vỗ tay/giơ ngón, không cần viết; mỗi em tự chọn một việc mình từng thấy hoặc từng làm.",
        "HS nói nhanh theo mẫu: Con thấy ... đang ...; Việc đó giúp ...",
        "HS dự đoán trọng tâm bài và sẵn sàng quan sát tranh/nhiệm vụ SGK để kiểm chứng.",
      ],
      bridgeQuestion: `Khi quan sát ${context.sourceAnchor}, con cần nhìn ai, đang làm gì và việc đó giúp gia đình thế nào?`,
      learningProduct: "Câu nói/dự đoán ban đầu về việc làm trong gia đình",
      successCriteria: ["Tham gia bằng tín hiệu toàn lớp.", "Nêu được ít nhất một việc làm hoặc chi tiết nhìn thấy."],
      expectedAnswer: "Con thấy người thân đang nấu ăn/dọn dẹp/chăm sóc nhau; việc đó giúp gia đình sạch sẽ, vui vẻ hoặc an toàn hơn.",
      acceptableResponses: ["Con thấy bố/mẹ/ông/bà/anh/chị đang làm việc nhà.", "Con đoán bài học nói về gia đình và việc làm ở nhà."],
      commonErrors: ["Chỉ nói tên người mà chưa nói việc làm.", "Kể việc không liên quan đến trọng tâm bài."],
      teacherFeedback: ["GV gợi: Con nhìn tay người đó đang làm gì? Việc đó giúp ai?", "GV chốt: Mình dự đoán dựa vào chi tiết nhìn thấy, rồi kiểm chứng bằng tranh/nhiệm vụ SGK."],
    }),
  },
  {
    id: "family-mystery-object",
    build: (context) => makeSuggestion(context, {
      id: "family-mystery-object",
      title: "Đồ vật kể chuyện",
      materials: [outsideMaterial("túi/hộp kín có đồ vật an toàn như khăn nhỏ, thìa nhựa, thẻ ngôi nhà, thẻ trái tim")],
      teacherActions: [
        "GV đưa hộp/túi bí mật, cho HS quan sát một đồ vật được lấy ra và đoán đồ vật đó gợi đến việc gì trong gia đình.",
        "GV cho HS giơ tay theo lựa chọn: đồ vật giúp chăm sóc, giữ sạch, ăn uống hay chia sẻ trong nhà; mời 2-3 HS nêu lí do ngắn.",
        `GV hỏi cầu nối: "Đồ vật vừa xem giúp ta nghĩ đến việc gì? Khi vào ${context.sourceAnchor}, con sẽ tìm chi tiết nào giống hoặc khác?"`,
      ],
      studentActions: [
        "HS quan sát đồ vật an toàn, đoán nhanh việc làm trong gia đình bằng lời nói hoặc cử chỉ.",
        "HS chọn nhóm bằng giơ tay/giơ thẻ màu và nói một lí do đơn giản.",
        "HS nêu dự đoán rồi chuyển sang quan sát SGK với tâm thế tìm bằng chứng.",
      ],
      bridgeQuestion: `Đồ vật vừa xem gợi đến việc gì trong gia đình, và ${context.sourceAnchor} có chi tiết nào liên quan?`,
      learningProduct: "Dự đoán miệng về việc làm/đồ dùng trong gia đình",
      successCriteria: ["Chọn được nhóm phù hợp với đồ vật.", "Nêu được một lí do dựa vào công dụng hoặc việc làm."],
      expectedAnswer: "Đồ vật gợi đến việc giữ sạch, chăm sóc, ăn uống hoặc chia sẻ trong gia đình.",
      acceptableResponses: ["Con đoán đồ vật dùng để ...", "Ở nhà con đã thấy người thân dùng đồ vật này khi ..."],
      commonErrors: ["Đoán theo sở thích, chưa dựa vào công dụng.", "Nói tên đồ vật nhưng chưa nêu việc làm."],
      teacherFeedback: ["GV hỏi thêm: Đồ vật này thường dùng lúc nào? Ai có thể dùng an toàn?", "GV nhắc HS dùng chi tiết quan sát được để dự đoán."],
    }),
  },
];

const schoolTemplates: StartupTemplate[] = [
  {
    id: "school-signal-cards",
    build: (context) => makeSuggestion(context, {
      id: "school-signal-cards",
      title: "Tín hiệu lớp mình",
      materials: [outsideMaterial("thẻ xanh/vàng hoặc kí hiệu mặt cười/mặt suy nghĩ"), "Bảng lớp"],
      teacherActions: [
        "GV nêu 3 tình huống thật nhanh ở lớp/trường; HS giơ thẻ xanh nếu nên làm, thẻ vàng nếu cần suy nghĩ thêm.",
        "GV hỏi một vài HS: Con dựa vào dấu hiệu nào để chọn? Việc đó giúp lớp/trường ra sao?",
        `GV hỏi cầu nối: "Khi quan sát ${context.sourceAnchor}, con cần tìm hành vi, người hoặc khu vực nào liên quan đến lựa chọn vừa nêu?"`,
      ],
      studentActions: [
        "HS cả lớp giơ thẻ theo tình huống, không cần viết.",
        "HS nêu lí do ngắn dựa vào an toàn, vệ sinh, hợp tác hoặc tôn trọng bạn bè.",
        "HS chuyển sang quan sát SGK để kiểm chứng hành vi/khu vực/trách nhiệm ở trường.",
      ],
      bridgeQuestion: `Tình huống vừa chọn giúp con chú ý chi tiết nào khi quan sát ${context.sourceAnchor}?`,
      learningProduct: "Lựa chọn tín hiệu nên làm/cần suy nghĩ ở trường",
      successCriteria: ["Cả lớp tham gia bằng thẻ/tín hiệu.", "Nêu được một lí do gắn với an toàn, vệ sinh hoặc hợp tác."],
      expectedAnswer: "Hành vi nên làm là giữ vệ sinh, giúp bạn, chào hỏi, đi lại an toàn hoặc giữ gìn đồ dùng chung.",
      acceptableResponses: ["Con chọn thẻ xanh vì việc đó giúp lớp sạch/an toàn/vui vẻ.", "Con chọn thẻ vàng vì việc đó có thể gây mất an toàn."],
      commonErrors: ["Chọn theo bạn mà chưa nêu lí do.", "Nói chung chung là tốt/xấu nhưng chưa chỉ ra dấu hiệu."],
      teacherFeedback: ["GV gợi: Việc này ảnh hưởng đến ai? Có an toàn không?", "GV chốt tiêu chí quan sát trước khi vào nhiệm vụ SGK."],
    }),
  },
  {
    id: "school-sound-map",
    requiresAudio: true,
    build: (context) => makeSuggestion(context, {
      id: "school-sound-map",
      title: "Nghe âm thanh đoán góc trường",
      materials: [outsideMaterial("âm thanh ngắn về tiếng trống, tiếng bạn đọc bài, tiếng sân trường; nếu không có loa, GV mô phỏng bằng lời")],
      teacherActions: [
        "GV bật hoặc mô phỏng 2-3 âm thanh quen thuộc ở trường và yêu cầu HS đoán nơi/hoạt động tương ứng.",
        "GV mời HS nói một quy tắc hoặc việc nên làm ở nơi/hoạt động vừa đoán.",
        `GV hỏi cầu nối: "Âm thanh vừa nghe giúp con nghĩ đến khu vực/hoạt động nào trong ${context.sourceAnchor}?"`,
      ],
      studentActions: [
        "HS lắng nghe, giơ tay/giơ thẻ chọn nơi hoặc hoạt động trong trường.",
        "HS nêu một quy tắc ngắn như xếp hàng, giữ trật tự, giữ vệ sinh, chơi an toàn.",
        "HS chuẩn bị quan sát SGK để tìm bằng chứng rõ hơn.",
      ],
      bridgeQuestion: `Âm thanh vừa nghe có liên quan đến chi tiết nào trong ${context.sourceAnchor}?`,
      learningProduct: "Dự đoán nơi/hoạt động ở trường từ âm thanh",
      successCriteria: ["Đoán được nơi/hoạt động phù hợp.", "Nêu được một quy tắc/việc nên làm."],
      expectedAnswer: "Âm thanh gợi đến lớp học, sân trường, giờ ra chơi hoặc sinh hoạt tập thể; cần giữ an toàn, trật tự, vệ sinh và tôn trọng bạn.",
      acceptableResponses: ["Con nghe giống tiếng trống/tiếng lớp học.", "Ở đó chúng ta nên ..."],
      commonErrors: ["Chỉ đoán âm thanh mà chưa liên hệ hành vi.", "Nêu quy tắc quá chung chung."],
      teacherFeedback: ["GV hỏi: Nếu ở nơi đó, con cần làm gì để an toàn/lịch sự?", "GV chuyển từ âm thanh sang tranh/nhiệm vụ SGK."],
    }),
  },
];

const localCommunityTemplates: StartupTemplate[] = [
  {
    id: "community-tool-guess",
    build: (context) => makeSuggestion(context, {
      id: "community-tool-guess",
      title: "Nhìn đồ dùng đoán người giúp cộng đồng",
      materials: [outsideMaterial("thẻ tranh đồ dùng nghề nghiệp/địa điểm công cộng đơn giản"), "Nam châm hoặc bảng lớp"],
      teacherActions: [
        "GV giơ nhanh từng thẻ đồ dùng/địa điểm, HS đoán người hoặc nơi trong cộng đồng liên quan đến thẻ.",
        "GV yêu cầu HS nói một chi tiết làm căn cứ: đồ dùng đó dùng để làm gì, giúp ai, ở đâu.",
        `GV hỏi cầu nối: "Khi quan sát ${context.sourceAnchor}, con sẽ tìm người, nghề, địa điểm hoặc việc làm nào đang giúp cộng đồng?"`,
      ],
      studentActions: [
        "HS cả lớp đoán bằng giơ tay/giơ thẻ, sau đó nghe bạn nêu căn cứ.",
        "HS nói theo mẫu: Con đoán đây là ... vì con thấy ...",
        "HS chuyển sang tranh/nhiệm vụ SGK để kiểm chứng dự đoán.",
      ],
      bridgeQuestion: `Chi tiết nào trong ${context.sourceAnchor} giúp con đoán người/nghề/địa điểm trong cộng đồng?`,
      learningProduct: "Dự đoán có căn cứ về người, nghề hoặc địa điểm cộng đồng",
      successCriteria: ["Chọn được thẻ phù hợp với chi tiết quan sát.", "Nói được ít nhất một căn cứ nhìn thấy/công dụng."],
      expectedAnswer: "Người hoặc địa điểm trong cộng đồng giúp khám chữa bệnh, dạy học, bán hàng, làm ruộng, giữ vệ sinh, bảo vệ an toàn hoặc phục vụ đời sống.",
      acceptableResponses: ["Con đoán đây là nghề ... vì có ...", "Nơi này giúp mọi người ..."],
      commonErrors: ["Chỉ nói tên người mà chưa nói việc làm.", "Chọn thẻ theo cảm tính, chưa dựa vào chi tiết."],
      teacherFeedback: ["GV gợi: Con nhìn tay người đó đang làm gì? Xung quanh có đồ dùng nào giúp con đoán?", "GV nhắc HS đoán dựa vào chi tiết nhìn thấy."],
    }),
  },
  {
    id: "community-class-map",
    build: (context) => makeSuggestion(context, {
      id: "community-class-map",
      title: "Bản đồ sống quanh em",
      materials: [outsideMaterial("3-4 thẻ địa điểm quen thuộc: nhà, trường, chợ/cửa hàng, trạm y tế/công viên; có thể thay bằng lời gợi")],
      teacherActions: [
        "GV đặt thẻ địa điểm ở bốn góc bảng và đọc một việc làm; HS chỉ/giơ tay chọn địa điểm phù hợp.",
        "GV hỏi: Việc đó giúp ai? Khi đến nơi công cộng em cần chú ý điều gì?",
        `GV hỏi cầu nối: "Những địa điểm vừa chọn có điểm nào giống với ${context.sourceAnchor}?"`,
      ],
      studentActions: [
        "HS chọn địa điểm bằng tín hiệu toàn lớp, không cần di chuyển nếu lớp chật.",
        "HS nêu một việc nên làm ở nơi công cộng hoặc nơi em sống.",
        "HS liên hệ với tranh/nhiệm vụ SGK để tìm chi tiết cụ thể hơn.",
      ],
      bridgeQuestion: `Địa điểm/việc làm vừa chọn giúp con chú ý điều gì khi quan sát ${context.sourceAnchor}?`,
      learningProduct: "Lựa chọn địa điểm/việc làm cộng đồng bằng tín hiệu",
      successCriteria: ["Chọn được địa điểm phù hợp.", "Nêu được một việc nên làm ở nơi công cộng/nơi em sống."],
      expectedAnswer: "Ở nơi công cộng hoặc cộng đồng, em cần cư xử lịch sự, giữ vệ sinh, an toàn và biết trân trọng người giúp mình.",
      acceptableResponses: ["Con chọn chợ/cửa hàng vì ở đó có mua bán.", "Con chọn trạm y tế vì nơi đó chăm sóc sức khỏe."],
      commonErrors: ["Gọi tên địa điểm nhưng chưa nêu vai trò.", "Nêu địa danh cụ thể không có căn cứ trong bài."],
      teacherFeedback: ["GV gợi: Nơi đó giúp mọi người việc gì?", "GV tránh gán địa phương cụ thể nếu SGK/form chưa cung cấp."],
    }),
  },
];

const plantsAnimalsTemplates: StartupTemplate[] = [
  {
    id: "animal-sound-guess",
    requiresAudio: true,
    build: (context) => makeSuggestion(context, {
      id: "animal-sound-guess",
      title: "Nghe tiếng đoán bạn sống ở đâu",
      materials: [outsideMaterial("âm thanh con vật quen thuộc hoặc GV mô phỏng bằng tiếng/động tác; không dùng để thay tranh SGK")],
      teacherActions: [
        "GV bật hoặc mô phỏng 2-3 âm thanh con vật quen thuộc, HS đoán con vật bằng thẻ/tín hiệu tay.",
        "GV hỏi nhanh: Con vật đó thường sống ở đâu? Con dựa vào điều gì để đoán?",
        `GV hỏi cầu nối: "Khi quan sát ${context.sourceAnchor}, con cần phân biệt nơi sống cụ thể và nhóm môi trường sống như thế nào?"`,
      ],
      studentActions: [
        "HS nghe âm thanh, đoán con vật bằng giơ tay/giơ thẻ.",
        "HS nêu nơi sống quen thuộc như ao, hồ, biển, rừng, chuồng nuôi, vườn hoặc trong nhà.",
        "HS chuyển sang tranh/nhiệm vụ SGK để kiểm chứng tên con vật và nơi sống.",
      ],
      bridgeQuestion: `Con vật trong ${context.sourceAnchor} sống ở đâu cụ thể và thuộc nhóm môi trường sống nào?`,
      learningProduct: "Dự đoán miệng về con vật/cây và môi trường sống",
      successCriteria: ["Đoán được con vật/cây hoặc đặc điểm liên quan.", "Nêu được một nơi sống/đặc điểm dựa vào tín hiệu."],
      expectedAnswer: "Con vật có nơi sống cụ thể như ao, hồ, biển, rừng, đồng cỏ hoặc chuồng nuôi; cần quan sát tranh SGK để gọi đúng tên và phân loại đúng.",
      acceptableResponses: ["Con đoán là ... vì nghe/nhìn thấy ...", "Con nghĩ con vật sống ở ..."],
      commonErrors: ["Nhầm nơi sống cụ thể với nhóm môi trường sống.", "Gọi tên con vật quá chung hoặc đoán theo sở thích."],
      teacherFeedback: ["GV gợi: Con đang nói nơi cụ thể hay nhóm môi trường sống?", "GV nhắc HS kiểm chứng bằng tranh SGK và tên cụ thể trong bài."],
    }),
  },
  {
    id: "plant-animal-mystery-card",
    build: (context) => makeSuggestion(context, {
      id: "plant-animal-mystery-card",
      title: "Mảnh ghép bí mật của cây/con vật",
      materials: [outsideMaterial("thẻ hình một phần an toàn của cây/con vật: lá, hoa, chân, vây, mỏ hoặc nơi sống"), "Bảng lớp để ghép 2-3 dự đoán"],
      teacherActions: [
        "GV che một phần thẻ hình, mở dần 2-3 chi tiết và yêu cầu HS đoán đối tượng hoặc đặc điểm liên quan.",
        "GV hỏi: Con dựa vào chi tiết nào để đoán? Chi tiết đó nói gì về bộ phận, đặc điểm hoặc nơi sống?",
        `GV hỏi cầu nối: "Khi vào ${context.sourceAnchor}, con sẽ quan sát chi tiết nào trước để tránh đoán cảm tính?"`,
      ],
      studentActions: [
        "HS quan sát chi tiết được hé mở, giơ thẻ/giơ tay để dự đoán.",
        "HS nêu bằng chứng bằng lời nói ngắn: Con thấy ... nên con đoán ...",
        "HS chuyển sang quan sát SGK để kiểm chứng và mô tả chính xác hơn.",
      ],
      bridgeQuestion: `Chi tiết nào trong ${context.sourceAnchor} giúp con gọi tên, mô tả hoặc phân loại đúng?`,
      learningProduct: "Dự đoán có bằng chứng về cây/con vật",
      successCriteria: ["Nêu được ít nhất một chi tiết quan sát.", "Không phân loại theo thích/không thích."],
      expectedAnswer: "Cần dựa vào bộ phận, đặc điểm nhìn thấy hoặc nơi sống để gọi tên/mô tả/phân loại cây, con vật.",
      acceptableResponses: ["Con thấy lá/vây/chân/mỏ nên con đoán ...", "Con cần nhìn thêm tranh SGK để chắc chắn."],
      commonErrors: ["Đoán vội khi mới thấy một chi tiết.", "Phân loại theo cảm tính."],
      teacherFeedback: ["GV gợi: Con nhìn thấy bộ phận nào? Đặc điểm ấy giúp ích gì cho dự đoán?", "GV chốt cách học TNXH: quan sát kĩ rồi mới kết luận."],
    }),
  },
  {
    id: "living-thing-movement",
    build: (context) => makeSuggestion(context, {
      id: "living-thing-movement",
      title: "Cử động bật mí",
      materials: [outsideMaterial("thẻ biểu tượng đi/bơi/bay/mọc/chăm sóc; có thể thay bằng GV làm động tác mẫu")],
      teacherActions: [
        "GV làm hoặc chiếu 3 động tác ngắn như bay, bơi, bò, vươn lá, tưới cây; HS đoán đối tượng hoặc việc chăm sóc phù hợp.",
        "GV hỏi: Động tác đó gợi đặc điểm/nơi sống/nhu cầu nào?",
        `GV hỏi cầu nối: "Từ cử động vừa đoán, khi quan sát ${context.sourceAnchor}, con sẽ tìm dấu hiệu nào để mô tả đúng?"`,
      ],
      studentActions: [
        "HS đoán bằng cử chỉ/tín hiệu, không chen lấn và không bắt chước động tác nguy hiểm.",
        "HS nói một đặc điểm hoặc việc chăm sóc tương ứng.",
        "HS chuyển sang tranh/nhiệm vụ SGK để kiểm chứng bằng chi tiết quan sát được.",
      ],
      bridgeQuestion: `Dấu hiệu nào trong ${context.sourceAnchor} giúp con mô tả cây/con vật chính xác?`,
      learningProduct: "Dự đoán bằng cử chỉ và lời nói về đặc điểm/nơi sống/việc chăm sóc",
      successCriteria: ["Tham gia an toàn bằng tín hiệu/cử chỉ.", "Nêu được một đặc điểm hoặc việc chăm sóc phù hợp."],
      expectedAnswer: "Động tác gợi đến cách di chuyển, nơi sống, bộ phận hoặc nhu cầu chăm sóc của cây/con vật.",
      acceptableResponses: ["Bay liên quan đến chim/côn trùng.", "Bơi liên quan đến cá/con vật sống dưới nước.", "Tưới nước giúp cây sống tốt."],
      commonErrors: ["Bắt chước quá mạnh gây mất trật tự.", "Nói tên con vật/cây nhưng chưa nêu dấu hiệu."],
      teacherFeedback: ["GV nhắc HS dùng động tác nhỏ, an toàn.", "GV hỏi thêm: Dấu hiệu nào trong tranh SGK chứng minh điều con nói?"],
    }),
  },
];

const humanHealthTemplates: StartupTemplate[] = [
  {
    id: "health-signal-vote",
    build: (context) => makeSuggestion(context, {
      id: "health-signal-vote",
      title: "Bác sĩ tí hon ra tín hiệu",
      materials: [outsideMaterial("thẻ xanh/đỏ hoặc kí hiệu nên làm/chưa nên làm về vệ sinh, sức khỏe, an toàn")],
      teacherActions: [
        "GV nêu 3 tình huống rất ngắn về ăn uống, vệ sinh, nghỉ ngơi, vận động hoặc an toàn; HS giơ thẻ xanh/đỏ.",
        "GV hỏi: Con chọn thẻ đó vì điều gì có lợi hoặc có hại cho cơ thể/sức khỏe?",
        `GV hỏi cầu nối: "Khi quan sát ${context.sourceAnchor}, con cần tìm việc nên làm/chưa nên làm nào và lí do gì?"`,
      ],
      studentActions: [
        "HS cả lớp giơ thẻ/tín hiệu theo tình huống, không cần viết.",
        "HS nêu lí do ngắn bằng lời: Việc này giúp ...; Việc này có thể làm ...",
        "HS chuyển sang SGK để quan sát và kiểm chứng thói quen/kĩ năng đúng.",
      ],
      bridgeQuestion: `Tình huống vừa chọn giúp con chú ý việc nào trong ${context.sourceAnchor} để bảo vệ sức khỏe/an toàn?`,
      learningProduct: "Tín hiệu chọn việc nên làm/chưa nên làm cho sức khỏe",
      successCriteria: ["Chọn được tín hiệu phù hợp.", "Nêu được một lí do đơn giản về sức khỏe/an toàn."],
      expectedAnswer: "Việc nên làm giúp cơ thể sạch sẽ, khỏe mạnh, an toàn; việc chưa nên làm có thể gây bẩn, bệnh hoặc nguy hiểm.",
      acceptableResponses: ["Con chọn xanh vì việc đó giúp khỏe/an toàn.", "Con chọn đỏ vì việc đó có thể gây đau/bẩn/nguy hiểm."],
      commonErrors: ["Chọn theo bạn mà chưa nêu lí do.", "Nói 'tốt/xấu' nhưng chưa nêu ảnh hưởng."],
      teacherFeedback: ["GV gợi: Việc đó ảnh hưởng đến bộ phận/cơ thể như thế nào?", "GV chốt: Quyết định phải dựa vào lợi ích hoặc nguy cơ quan sát được."],
    }),
  },
  {
    id: "health-motion-chain",
    build: (context) => makeSuggestion(context, {
      id: "health-motion-chain",
      title: "Chuỗi động tác khỏe mạnh",
      materials: [outsideMaterial("3 tranh/kí hiệu động tác an toàn: rửa tay, che miệng khi ho, đội mũ bảo hiểm, uống nước, vận động nhẹ")],
      teacherActions: [
        "GV làm mẫu 2-3 động tác an toàn, HS đoán tên thói quen/kĩ năng và làm theo ở mức nhẹ.",
        "GV hỏi: Động tác này giúp bảo vệ bộ phận nào hoặc tránh nguy cơ gì?",
        `GV hỏi cầu nối: "Trong ${context.sourceAnchor}, việc nào giống chuỗi động tác vừa làm và cần thực hiện theo bước nào?"`,
      ],
      studentActions: [
        "HS làm theo động tác nhỏ tại chỗ, giữ khoảng cách an toàn.",
        "HS nói tên thói quen/kĩ năng và lợi ích đơn giản.",
        "HS chuyển sang quan sát SGK để tìm quy trình hoặc tình huống đúng.",
      ],
      bridgeQuestion: `Việc nào trong ${context.sourceAnchor} giúp em giữ vệ sinh, sức khỏe hoặc an toàn?`,
      learningProduct: "Tên thói quen/kĩ năng sức khỏe được đoán qua động tác",
      successCriteria: ["Thực hiện động tác an toàn.", "Nêu được thói quen/kĩ năng và lợi ích chính."],
      expectedAnswer: "Các thói quen như rửa tay, che miệng khi ho, ăn uống sạch, vận động, nghỉ ngơi, đội mũ bảo hiểm giúp bảo vệ sức khỏe/an toàn.",
      acceptableResponses: ["Động tác này là rửa tay/che miệng/đội mũ.", "Việc đó giúp không bị bẩn, bệnh hoặc nguy hiểm."],
      commonErrors: ["Làm động tác quá mạnh.", "Nêu tên việc nhưng chưa nêu lợi ích."],
      teacherFeedback: ["GV nhắc HS làm chậm, an toàn.", "GV hỏi: Nếu làm sai/không làm thì điều gì có thể xảy ra?"],
    }),
  },
];

const earthSkyTemplates: StartupTemplate[] = [
  {
    id: "weather-forecast-minute",
    build: (context) => makeSuggestion(context, {
      id: "weather-forecast-minute",
      title: "Dự báo một phút",
      materials: [outsideMaterial("thẻ biểu tượng nắng, mưa, gió, nóng, lạnh hoặc quan sát nhanh bầu trời qua cửa lớp nếu an toàn")],
      teacherActions: [
        "GV cho HS nhìn nhanh bầu trời/biểu tượng thời tiết và chọn thẻ thể hiện thời tiết lúc này hoặc thời tiết trong tình huống GV nêu.",
        "GV hỏi: Con dựa vào dấu hiệu nào để chọn? Thời tiết đó nên mặc/làm gì cho phù hợp?",
        `GV hỏi cầu nối: "Khi quan sát ${context.sourceAnchor}, con sẽ tìm dấu hiệu thời tiết/bầu trời nào trước?"`,
      ],
      studentActions: [
        "HS chọn thẻ/tín hiệu thời tiết bằng cả lớp, không ra khỏi lớp nếu không an toàn.",
        "HS nêu dấu hiệu như nắng, mây, mưa, gió, nóng/lạnh và một việc nên làm.",
        "HS chuyển sang SGK để mô tả, so sánh hoặc sắp xếp hiện tượng đúng hơn.",
      ],
      bridgeQuestion: `Dấu hiệu nào trong ${context.sourceAnchor} giúp con mô tả thời tiết/bầu trời chính xác?`,
      learningProduct: "Tín hiệu dự báo thời tiết/bầu trời ban đầu",
      successCriteria: ["Chọn được biểu tượng phù hợp.", "Nêu được một dấu hiệu quan sát hoặc việc làm phù hợp."],
      expectedAnswer: "Cần dựa vào dấu hiệu như nắng, mưa, mây, gió, nóng/lạnh, sáng/tối để mô tả và chọn trang phục/hoạt động phù hợp.",
      acceptableResponses: ["Con thấy trời nắng/mưa/nhiều mây.", "Khi mưa nên mang áo mưa/đi cẩn thận."],
      commonErrors: ["Nhầm thời tiết hiện tại với mùa.", "Nêu cảm giác nhưng chưa nêu dấu hiệu quan sát."],
      teacherFeedback: ["GV gợi: Con nhìn thấy dấu hiệu nào trên trời hoặc trong tranh?", "GV chốt: Mô tả thời tiết cần dựa vào dấu hiệu quan sát được."],
    }),
  },
  {
    id: "sky-picture-reveal",
    requiresProjection: true,
    build: (context) => makeSuggestion(context, {
      id: "sky-picture-reveal",
      title: "Bức ảnh bầu trời hé mở",
      materials: [outsideMaterial("ảnh/video 10-15 giây về bầu trời, ngày đêm hoặc thời tiết; nếu không có máy chiếu, dùng thẻ tranh in")],
      teacherActions: [
        "GV che/mở từng phần ảnh bầu trời hoặc thời tiết, HS dự đoán hiện tượng bằng tín hiệu tay.",
        "GV hỏi: Dấu hiệu nào giúp con biết đó là ngày/đêm, nắng/mưa/gió hoặc nóng/lạnh?",
        `GV hỏi cầu nối: "Dấu hiệu vừa tìm có xuất hiện trong ${context.sourceAnchor} không?"`,
      ],
      studentActions: [
        "HS quan sát phần ảnh được hé mở và dự đoán hiện tượng.",
        "HS nêu dấu hiệu quan sát được thay vì đoán theo cảm giác.",
        "HS mở SGK/quan sát nhiệm vụ để kiểm chứng và gọi tên đúng hiện tượng.",
      ],
      bridgeQuestion: `Dấu hiệu nào trong ${context.sourceAnchor} giúp con kiểm chứng dự đoán về bầu trời/thời tiết?`,
      learningProduct: "Dự đoán hiện tượng bầu trời/thời tiết có căn cứ",
      successCriteria: ["Nêu được một dấu hiệu quan sát.", "Dự đoán gắn với hiện tượng bài học."],
      expectedAnswer: "Các dấu hiệu như Mặt Trời, Mặt Trăng, mây, mưa, gió, ánh sáng hoặc trang phục giúp nhận biết hiện tượng.",
      acceptableResponses: ["Con thấy có Mặt Trời nên đoán ban ngày/nắng.", "Con thấy mây đen nên đoán trời sắp mưa."],
      commonErrors: ["Đoán quá vội khi chưa đủ dấu hiệu.", "Nhầm hiện tượng với cảm xúc cá nhân."],
      teacherFeedback: ["GV hỏi: Con thấy dấu hiệu nào chứng minh?", "GV chuyển sang tranh/nhiệm vụ SGK để kiểm chứng."],
    }),
  },
];

const mixedTemplates: StartupTemplate[] = [
  {
    id: "mystery-detail",
    build: (context) => makeSuggestion(context, {
      id: "mystery-detail",
      title: "Chi tiết bí mật",
      materials: [outsideMaterial("một thẻ tranh/đồ vật/câu đố ngắn sát chủ đề bài"), "Bảng lớp để ghi 2-3 dự đoán"],
      teacherActions: [
        "GV đưa một chi tiết bí mật liên quan đến bài và yêu cầu HS đoán nhanh đối tượng hoặc vấn đề cần tìm hiểu.",
        "GV hỏi: Con dựa vào chi tiết nào để đoán? Còn điều gì cần quan sát thêm?",
        `GV hỏi cầu nối: "Khi vào ${context.sourceAnchor}, con sẽ kiểm chứng dự đoán bằng chi tiết nào?"`,
      ],
      studentActions: [
        "HS quan sát/nghe chi tiết, giơ tay/giơ thẻ để dự đoán.",
        "HS nêu một bằng chứng nhìn/nghe được và một điều còn băn khoăn.",
        "HS chuyển sang tranh/nhiệm vụ SGK để quan sát và trả lời câu hỏi chính.",
      ],
      bridgeQuestion: `Chi tiết nào trong ${context.sourceAnchor} giúp con kiểm chứng dự đoán?`,
      learningProduct: "Dự đoán ban đầu có bằng chứng",
      successCriteria: ["Nêu được một chi tiết làm căn cứ.", "Biết chuyển từ dự đoán sang quan sát SGK."],
      expectedAnswer: "Cần quan sát chi tiết trong tranh/nhiệm vụ SGK để kiểm chứng dự đoán, không kết luận vội.",
      acceptableResponses: ["Con đoán ... vì thấy/nghe ...", "Con cần xem thêm tranh SGK để biết đúng không."],
      commonErrors: ["Đoán theo cảm tính.", "Không nêu chi tiết làm căn cứ."],
      teacherFeedback: ["GV gợi: Con nhìn/nghe thấy gì?", "GV chốt: Học TNXH bắt đầu bằng quan sát rồi mới kết luận."],
    }),
  },
  {
    id: "quick-choice",
    build: (context) => makeSuggestion(context, {
      id: "quick-choice",
      title: "Chọn nhanh - nói lí do",
      materials: [outsideMaterial("2-3 thẻ lựa chọn bằng tranh/kí hiệu sát trọng tâm bài")],
      teacherActions: [
        "GV đưa 2-3 lựa chọn bằng tranh/kí hiệu và yêu cầu HS chọn nhanh bằng giơ tay/giơ thẻ.",
        "GV hỏi: Con chọn vì thấy dấu hiệu nào? Bạn nào có lựa chọn khác và lí do khác?",
        `GV hỏi cầu nối: "Lựa chọn vừa rồi liên quan đến câu hỏi '${context.inquiryQuestion}' khi quan sát ${context.sourceAnchor} như thế nào?"`,
      ],
      studentActions: [
        "HS cả lớp chọn bằng tín hiệu, không cần viết.",
        "HS nêu lí do ngắn dựa vào dấu hiệu quan sát hoặc trải nghiệm gần gũi.",
        "HS chuyển sang SGK để kiểm chứng lựa chọn và tìm câu trả lời đầy đủ hơn.",
      ],
      bridgeQuestion: `Lựa chọn vừa rồi giúp con trả lời câu hỏi "${context.inquiryQuestion}" bằng chi tiết nào trong ${context.sourceAnchor}?`,
      learningProduct: "Lựa chọn/dự đoán ban đầu kèm lí do",
      successCriteria: ["Chọn được một phương án.", "Nêu được một lí do dựa vào dấu hiệu/trải nghiệm."],
      expectedAnswer: "Có thể chọn nhiều phương án nếu nêu được lí do; sau đó cần kiểm chứng bằng tranh/nhiệm vụ SGK.",
      acceptableResponses: ["Con chọn ... vì ...", "Con chưa chắc nên cần quan sát tranh SGK."],
      commonErrors: ["Chọn theo bạn.", "Nêu lí do ngoài trọng tâm bài."],
      teacherFeedback: ["GV khuyến khích nhiều dự đoán nhưng yêu cầu có căn cứ.", "GV chuyển sang nhiệm vụ quan sát chính của SGK."],
    }),
  },
];

const templateByType: Record<NaturalSocialLessonType, StartupTemplate[]> = {
  family: familyTemplates,
  school: schoolTemplates,
  "local-community": localCommunityTemplates,
  "plants-animals": plantsAnimalsTemplates,
  "human-health": humanHealthTemplates,
  "earth-sky": earthSkyTemplates,
  mixed: mixedTemplates,
};

function templatesFor(type: NaturalSocialLessonType, topicFocus: NaturalSocialTopicFocus | undefined, context: StartupRuntimeContext) {
  const homeContextText = normalizeNaturalSocialText(`${context.topic} ${context.inquiryQuestion} ${context.sourceAnchor}`);
  const templates = type === "family" && topicFocus === "home-environment"
    ? (/phong|do dung/.test(homeContextText) ? [homeEnvironmentTemplates[1]] : [homeEnvironmentTemplates[0]])
    : templateByType[type] || mixedTemplates;
  const candidates = templates.filter((template) => {
    if (context.grade <= 1 && template.textHeavy) return false;
    if (template.requiresAudio && !context.canUseAudio) return false;
    if (template.requiresProjection && !context.canUseProjection) return false;
    return true;
  });
  return candidates.length ? candidates : mixedTemplates;
}

export function selectNaturalSocialStartup(context: NaturalSocialStartupContext): NaturalSocialStartupSuggestion {
  const { input, periodNumber } = context;
  const facilities = facilityProfile(input);
  const topic = compactTitle(context.lessonTitle || input.lessonTitle || context.focus || "bài học");
  const sourceAnchor = sourceAnchorFromInventory(context.sourceInventory, periodNumber);
  const runtimeContext: StartupRuntimeContext = {
    topic,
    grade: gradeNumber(input.grade),
    periodNumber,
    sourceAnchor,
    inquiryQuestion: context.inquiryQuestion || "Con quan sát thấy gì và điều đó giúp con hiểu bài như thế nào?",
    ...facilities,
  };
  const inferredTopicFocus = context.topicFocus || (context.lessonType === "family" && /ngoi nha|nha cua em|dia chi|kieu nha|phong|do dung trong nha/.test(
    normalizeNaturalSocialText(`${context.lessonTitle} ${context.focus || ""} ${context.inquiryQuestion || ""}`),
  ) ? "home-environment" : undefined);
  const candidates = templatesFor(context.lessonType, inferredTopicFocus, runtimeContext);
  const seed = stableHash(`${context.lessonType}|${inferredTopicFocus || ""}|${topic}|${context.focus || ""}|${input.grade}|${facilityText(input)}`);
  const selected = candidates[(seed + Math.max(0, periodNumber - 1)) % candidates.length];
  return selected.build(runtimeContext);
}

function listActivityText(activity: Partial<LessonActivity>) {
  return [
    activity.phase,
    activity.title,
    activity.objective,
    ...(activity.inputOrMaterials || []),
    ...(activity.teacherActions || []),
    ...(activity.studentActions || []),
    ...(activity.learningProducts || []),
    ...(activity.successCriteria || []),
    activity.expectedAnswer,
    ...(activity.acceptableResponses || []),
    ...(activity.commonErrors || []),
    ...(activity.teacherFeedback || []),
    ...(activity.supportForStudentsNeedingHelp || []),
    ...(activity.extensionForEarlyFinishers || []),
    activity.coveragePurpose,
  ].filter(Boolean).map((item) => String(item));
}

function activityText(activity: Partial<LessonActivity>) {
  return listActivityText(activity).join(" ");
}

export function hasNaturalSocialStartupMetadataLeak(activity: Partial<LessonActivity>) {
  const lines = listActivityText(activity).map((line) => normalizeNaturalSocialText(line));
  const metadataHits = lines.filter((line) => metadataLabelPattern.test(line)).length;
  if (metadataHits >= 2) return true;
  const normalized = normalizeNaturalSocialText(activityText(activity));
  return /hoc lieu\/dau vao.*cach to chuc.*tieu chi thanh cong/.test(normalized)
    || /tieu chi thanh cong.*dap an du kien.*loi thuong gap/.test(normalized);
}

export function hasNaturalSocialStartupBridge(activity: Partial<LessonActivity>) {
  const normalized = normalizeNaturalSocialText(activityText(activity));
  return /mo sgk|tranh sgk|anh sgk|nhiem vu sgk|sach giao khoa|kiem chung|chuyen sang|dan vao|vao bai|bai hoc|kham pha|tim hieu/.test(normalized);
}

export function hasNaturalSocialOutsideSgkMislabel(activity: Partial<LessonActivity>) {
  return listActivityText(activity).some((line) => {
    const normalized = normalizeNaturalSocialText(line);
    const hasOutside = outsideStimulusPattern.test(normalized);
    const claimsSgk = /(video|am thanh|bai hat|nhac|hop bi mat|the bi mat|vat that|mo hinh|tranh goi mo|anh goi mo|hinh anh goi mo).{0,40}(sgk|sach giao khoa)|(sgk|sach giao khoa).{0,40}(video|am thanh|bai hat|nhac|hop bi mat|the bi mat|vat that|mo hinh)/.test(normalized);
    const hasSafeLabel = /ngoai sgk|khong goi|khong gan nham|quay ve sgk|mo sgk de|tranh sgk de kiem chung/.test(normalized);
    return hasOutside && claimsSgk && !hasSafeLabel;
  });
}

export function isNaturalSocialGradeOneTextHeavyStartup(activity: Partial<LessonActivity>, grade: number) {
  if (grade > 1) return false;
  const normalized = normalizeNaturalSocialText(activityText(activity));
  return /hs[^.]{0,60}(viet|ghi|doc the chu|hoan thanh phieu|lam phieu|dien tu|doc cau dai|o chu)|phieu[^.]{0,40}(nhieu chu|cau dai|doan)|o chu/.test(normalized);
}

export function isWeakNaturalSocialStartup(activity: Partial<LessonActivity>) {
  const normalized = normalizeNaturalSocialText(activityText(activity));
  if (hasNaturalSocialStartupMetadataLeak(activity)) return true;
  const concreteMethod = /tro choi|the|cau do|am thanh|video|vat that|mo hinh|hop bi mat|giai ma|du doan|quan sat|gio the|tin hieu|van dong|dong vai|bai hat|nghe|nhin|doan|mau sac|bieu tuong|thao tac/.test(normalized);
  const genericIntro = /gv gioi thieu bai|gv dan dat vao bai|on dinh to chuc|hs lang nghe|bai hoc hom nay|gioi thieu noi dung bai/.test(normalized);
  const actionCount = Math.max(activity.teacherActions?.length || 0, activity.studentActions?.length || 0);
  const hasQuestion = /\?|con thay|vi sao|theo em|du doan|dieu gi|can quan sat|dua vao/.test(normalized);
  const hasMaterial = Boolean((activity.inputOrMaterials || []).some((item) => normalizeNaturalSocialText(item).length >= 8))
    || /the|tranh|anh|vat that|am thanh|video|bang lop|hop|bieu tuong/.test(normalized);

  if (genericIntro && !concreteMethod) return true;
  if (actionCount < 2 && !concreteMethod) return true;
  if (!concreteMethod) return true;
  if (!hasQuestion) return true;
  if (!hasMaterial && !/van dong|dong vai|du doan/.test(normalized)) return true;
  return false;
}

export function naturalSocialStartupFingerprint(activity: Partial<LessonActivity>) {
  const normalizedTitle = normalizeNaturalSocialText(activity.title || "");
  if (normalizedTitle && !/^(khoi dong|gioi thieu|hoat dong)$/.test(normalizedTitle)) return normalizedTitle;
  return normalizeNaturalSocialText([
    activity.title || "",
    ...(activity.teacherActions || []).slice(0, 2),
  ].join(" ")).slice(0, 120);
}

export function naturalSocialStartupToActivity(suggestion: NaturalSocialStartupSuggestion): LessonActivity {
  return {
    phase: "Khởi động",
    title: suggestion.title,
    objective: "Tạo hứng thú, kích hoạt trải nghiệm gần gũi và dẫn tự nhiên vào trọng tâm bài học.",
    durationMinutes: suggestion.durationMinutes,
    teacherActions: suggestion.teacherActions,
    studentActions: suggestion.studentActions,
    inputOrMaterials: suggestion.materials,
    organization: suggestion.organization,
    learningProducts: [suggestion.learningProduct],
    successCriteria: suggestion.successCriteria,
    expectedAnswer: suggestion.expectedAnswer,
    acceptableResponses: suggestion.acceptableResponses,
    commonErrors: suggestion.commonErrors,
    teacherFeedback: suggestion.teacherFeedback,
    supportForStudentsNeedingHelp: [],
    extensionForEarlyFinishers: [],
    sourceTaskIds: [],
    sourceVisualIds: [],
    coveragePurpose: suggestion.coveragePurpose,
  };
}

function labelsOutsideMaterial(materials: string[], wholeText: string) {
  const normalized = normalizeNaturalSocialText(wholeText);
  if (!outsideStimulusPattern.test(normalized) || /ngoai sgk|hoc lieu goi mo ngoai sgk/.test(normalized)) return materials;
  if (!materials.length) return [outsideMaterial("học liệu/trò chơi gợi mở sát bài do GV chuẩn bị")];
  return materials.map((item, index) => {
    if (index > 0) return item;
    const normalizedItem = normalizeNaturalSocialText(item);
    if (/sgk|sach giao khoa/.test(normalizedItem)) return item;
    return outsideMaterial(item);
  });
}

export function applyNaturalSocialStartupGuardrails(
  activity: LessonActivity,
  input: LessonInput,
  suggestion: NaturalSocialStartupSuggestion,
): LessonActivity {
  const grade = gradeNumber(input.grade);
  if (
    isWeakNaturalSocialStartup(activity)
    || hasNaturalSocialOutsideSgkMislabel(activity)
    || isNaturalSocialGradeOneTextHeavyStartup(activity, grade)
  ) {
    return naturalSocialStartupToActivity(suggestion);
  }

  const teacherActions = [...(activity.teacherActions || [])];
  const studentActions = [...(activity.studentActions || [])];
  if (!hasNaturalSocialStartupBridge(activity)) {
    const bridgeTeacher = suggestion.teacherActions[suggestion.teacherActions.length - 1];
    const bridgeStudent = suggestion.studentActions[suggestion.studentActions.length - 1];
    if (teacherActions.length >= 3) teacherActions[teacherActions.length - 1] = bridgeTeacher;
    else teacherActions.push(bridgeTeacher);
    if (studentActions.length >= 3) studentActions[studentActions.length - 1] = bridgeStudent;
    else studentActions.push(bridgeStudent);
  }

  const rawMaterials = activity.inputOrMaterials?.length ? activity.inputOrMaterials : suggestion.materials;
  const wholeText = activityText({ ...activity, inputOrMaterials: rawMaterials });

  return {
    ...activity,
    durationMinutes: suggestion.durationMinutes,
    teacherActions,
    studentActions,
    inputOrMaterials: labelsOutsideMaterial(rawMaterials, wholeText).slice(0, 6),
    organization: "whole_class",
    learningProducts: activity.learningProducts?.length ? activity.learningProducts.slice(0, 1) : [suggestion.learningProduct],
    successCriteria: activity.successCriteria?.length ? activity.successCriteria.slice(0, 2) : suggestion.successCriteria,
    expectedAnswer: activity.expectedAnswer || suggestion.expectedAnswer,
    acceptableResponses: activity.acceptableResponses?.length ? activity.acceptableResponses.slice(0, 4) : suggestion.acceptableResponses,
    commonErrors: activity.commonErrors?.length ? activity.commonErrors.slice(0, 3) : suggestion.commonErrors,
    teacherFeedback: activity.teacherFeedback?.length ? activity.teacherFeedback.slice(0, 3) : suggestion.teacherFeedback,
    supportForStudentsNeedingHelp: [],
    extensionForEarlyFinishers: [],
    sourceTaskIds: [],
    sourceVisualIds: [],
    coveragePurpose: activity.coveragePurpose || suggestion.coveragePurpose,
  };
}

export function formatNaturalSocialStartupPromptBlock(suggestion: NaturalSocialStartupSuggestion) {
  return [
    "Khởi động do hệ thống chọn sẵn bằng code, không cần model tự chọn hình thức:",
    `- Tên hoạt động: ${suggestion.title}`,
    `- Thời lượng/cách tổ chức: ${suggestion.durationMinutes} phút, toàn lớp.`,
    `- Học liệu: ${suggestion.materials.join("; ")}`,
    `- GV làm: ${suggestion.teacherActions.join(" | ")}`,
    `- HS làm: ${suggestion.studentActions.join(" | ")}`,
    `- Câu hỏi cầu nối: ${suggestion.bridgeQuestion}`,
    `- Sản phẩm/tín hiệu: ${suggestion.learningProduct}`,
    `- Tiêu chí thành công: ${suggestion.successCriteria.join("; ")}`,
    `- Đáp án dự kiến/ý chấp nhận: ${suggestion.expectedAnswer}`,
    `- Lưu ý bắt buộc: nếu dùng ${suggestion.sourceLabel.toLowerCase()}, phải ghi đúng nhãn này, không gọi nhầm là tranh SGK; hoạt động chỉ tạo hứng thú và phải quay về nhiệm vụ SGK ở Khám phá/Luyện tập.`,
  ].join("\n");
}
