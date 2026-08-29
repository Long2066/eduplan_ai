import { gradeBandFor } from "@/lib/pedagogy-profiles";
import type {
  LessonInput,
  NaturalSocialClassification,
  NaturalSocialLessonType,
  NaturalSocialSourceInventory,
  NaturalSocialTopicFocus,
} from "@/types/lesson";

export type NaturalSocialLessonTypeProfile = {
  label: string;
  domain: string;
  keywordPattern: RegExp;
  inquirySequence: string[];
  observationTargets: string[];
  learningProducts: string[];
  commonMisconceptions: string[];
  assessmentCriteria: string[];
  applicationMoves: string[];
  checkerMustHave: RegExp;
};

export function isNaturalSocialSubjectName(subject: unknown): boolean {
  return /^(tự\s*nhiên\s*và\s*xã\s*hội|tu\s*nhien\s*va\s*xa\s*hoi|tnxh)$/i.test(String(subject || "").trim());
}

export function normalizeNaturalSocialText(value: string) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export const naturalSocialLessonTypeProfiles: Record<NaturalSocialLessonType, NaturalSocialLessonTypeProfile> = {
  family: {
    label: "Gia đình",
    domain: "Gia đình",
    keywordPattern: /\b(gia dinh|ong ba|bo me|cha me|anh chi em|nguoi than|viec nha|ngoi nha|nha cua em|nha o|kieu nha|dia chi nha|dia chi noi gia dinh|dia chi noi o|phong khach|phong ngu|phong bep|do dung trong nha|chia se viec)\b/i,
    inquirySequence: [
      "Quan sát tranh, vật thật hoặc kể trải nghiệm gia đình gần gũi đúng trọng tâm bài.",
      "Mô tả người, ngôi nhà, đồ dùng, việc làm hoặc mối quan hệ dựa trên bằng chứng nguồn.",
      "So sánh, sắp xếp hoặc liên hệ bản thân theo tiêu chí mà nhiệm vụ SGK yêu cầu.",
      "Hoàn thành một vận dụng ngắn gắn trực tiếp với yêu cầu cần đạt và nhiệm vụ vừa học.",
    ],
    observationTargets: ["Tranh/ảnh SGK về gia đình hoặc ngôi nhà", "Đồ vật/thẻ hình đúng trọng tâm bài", "Trải nghiệm gia đình phù hợp để chia sẻ"],
    learningProducts: ["Câu trả lời mô tả dựa trên tranh", "Kết quả sắp xếp/so sánh theo nhiệm vụ", "Sản phẩm vận dụng ngắn đúng trọng tâm"],
    commonMisconceptions: [
      "Kể theo kinh nghiệm chung nhưng chưa dựa vào chi tiết quan sát được.",
      "Đưa nội dung việc nhà hoặc an toàn vào bài chỉ vì cùng có từ nhà/gia đình.",
      "Biến tên nhân vật, địa điểm hoặc chi tiết của một tranh SGK thành yêu cầu cần đạt.",
    ],
    assessmentCriteria: [
      "Mô tả được đối tượng gia đình/ngôi nhà bằng chi tiết quan sát được.",
      "Hoàn thành đúng nhiệm vụ so sánh, sắp xếp hoặc liên hệ mà bài yêu cầu.",
      "Tạo được sản phẩm/vận dụng ngắn gắn trực tiếp với trọng tâm bài.",
    ],
    applicationMoves: ["Liên hệ gia đình/ngôi nhà theo đúng nhiệm vụ SGK", "Sản phẩm nói, chỉ, chọn, vẽ hoặc viết rất ngắn", "Chia sẻ riêng tư khi nội dung có dữ liệu cá nhân"],
    checkerMustHave: /gia đình|người thân|ông bà|bố mẹ|cha mẹ|anh chị em|ngôi nhà|kiểu nhà|địa chỉ|phòng|đồ dùng|việc nhà|ở nhà/i,
  },
  school: {
    label: "Trường học",
    domain: "Trường học",
    keywordPattern: /\b(truong hoc|truong em|dia chi truong|lop hoc|ban be|thay co|co giao|noi quy|san truong|phong hoc|hoat dong o truong|giu gin truong lop|an toan o truong)\b/i,
    inquirySequence: [
      "Quan sát tranh/lớp học/sân trường hoặc tình huống ở trường.",
      "Mô tả người, đồ vật, khu vực hoặc hoạt động trong trường.",
      "Phân loại hành vi an toàn, giữ vệ sinh, hợp tác và tôn trọng bạn bè.",
      "Thực hành một quy tắc hoặc cam kết giữ gìn trường lớp.",
    ],
    observationTargets: ["Tranh/lớp học", "Sơ đồ khu vực trường", "Thẻ hành vi ở trường"],
    learningProducts: ["Bảng quan sát trường/lớp", "Thẻ hành vi nên làm", "Cam kết giữ gìn lớp học"],
    commonMisconceptions: [
      "Chỉ nhắc nội quy mà chưa biết tình huống áp dụng.",
      "Nhầm giữa giữ vệ sinh lớp học và trách nhiệm của riêng lao công/giáo viên.",
      "Biết hành vi an toàn nhưng chưa nêu được hậu quả nếu không thực hiện.",
    ],
    assessmentCriteria: [
      "Mô tả được khu vực, người hoặc hoạt động ở trường bằng quan sát cụ thể.",
      "Phân biệt được hành vi nên làm/chưa nên làm ở trường.",
      "Thực hiện hoặc nêu được một việc giữ an toàn, vệ sinh, đoàn kết trong lớp/trường.",
    ],
    applicationMoves: ["Góc lớp sạch đẹp", "Sơ đồ đường đi an toàn trong trường", "Cam kết một việc làm với bạn"],
    checkerMustHave: /trường|lớp|bạn|thầy cô|cô giáo|sân trường|nội quy|giữ gìn|an toàn/i,
  },
  "local-community": {
    label: "Cộng đồng địa phương",
    domain: "Cộng đồng địa phương",
    keywordPattern: /\b(dia phuong|cong dong|lang xom|noi em song|que huong|duong pho|thon xom|phuong xa|nghe nghiep|khu cho|cho que|di cho|o cho|benh vien|tram y te|noi cong cong)\b/i,
    inquirySequence: [
      "Quan sát tranh, ảnh hoặc kể trải nghiệm về nơi em sống.",
      "Mô tả con người, nghề nghiệp, địa điểm công cộng hoặc hoạt động cộng đồng.",
      "So sánh việc nên làm/chưa nên làm khi tham gia sinh hoạt cộng đồng.",
      "Đề xuất hành động nhỏ góp phần giữ gìn nơi em sống.",
    ],
    observationTargets: ["Tranh/ảnh nơi em sống", "Thẻ địa điểm công cộng", "Phiếu điều tra nhỏ về cộng đồng"],
    learningProducts: ["Phiếu mô tả nơi em sống", "Bảng việc nên làm nơi công cộng", "Ý tưởng giữ gìn cộng đồng"],
    commonMisconceptions: [
      "Kể tên địa điểm nhưng chưa nêu vai trò đối với đời sống.",
      "Bịa số liệu, địa danh, nghề truyền thống khi chưa có nguồn.",
      "Chỉ nói yêu quê hương chung chung, chưa có hành động cụ thể.",
    ],
    assessmentCriteria: [
      "Mô tả được một địa điểm, nghề nghiệp hoặc hoạt động cộng đồng gần gũi.",
      "Nêu được cách ứng xử phù hợp ở nơi công cộng.",
      "Đề xuất được việc làm nhỏ để giữ gìn môi trường/cộng đồng địa phương.",
    ],
    applicationMoves: ["Quan sát một địa điểm gần nhà", "Phiếu hỏi người thân", "Một việc giữ sạch đẹp nơi em sống"],
    checkerMustHave: /địa phương|cộng đồng|nơi em sống|quê hương|làng xóm|đường phố|nơi công cộng|nghề/i,
  },
  "plants-animals": {
    label: "Thực vật và động vật",
    domain: "Thực vật và động vật",
    keywordPattern: /\b(cay|hoa|la|than|re|qua|hat|con vat|dong vat|vat nuoi|thu cung|moi truong song|cham soc cay|bao ve dong vat)\b/i,
    inquirySequence: [
      "Quan sát tranh, vật thật, cây/con vật quen thuộc hoặc mô hình.",
      "Mô tả bộ phận, đặc điểm, môi trường sống hoặc nhu cầu sống.",
      "So sánh/phân loại cây, con vật theo tiêu chí đơn giản.",
      "Nêu cách chăm sóc, bảo vệ cây/con vật và môi trường sống.",
    ],
    observationTargets: ["Cây thật/lá/hoa/quả", "Tranh con vật", "Thẻ đặc điểm hoặc môi trường sống"],
    learningProducts: ["Phiếu quan sát cây/con vật", "Bảng phân loại theo tiêu chí", "Việc làm chăm sóc/bảo vệ"],
    commonMisconceptions: [
      "Gọi tên bộ phận theo cảm tính thay vì dựa trên quan sát.",
      "Phân loại theo thích/không thích thay vì tiêu chí đã thống nhất.",
      "Cho rằng mọi cây/con vật cần cùng một cách chăm sóc.",
    ],
    assessmentCriteria: [
      "Mô tả được đặc điểm chính của cây/con vật dựa trên quan sát.",
      "So sánh hoặc phân loại theo một tiêu chí rõ.",
      "Nêu được việc làm phù hợp để chăm sóc hoặc bảo vệ cây/con vật.",
    ],
    applicationMoves: ["Chăm sóc cây ở lớp/nhà", "Quan sát vật nuôi an toàn", "Không bẻ cành, không trêu chọc động vật"],
    checkerMustHave: /cây|hoa|lá|rễ|thân|quả|hạt|con vật|động vật|vật nuôi|môi trường sống|chăm sóc/i,
  },
  "human-health": {
    label: "Con người và sức khỏe",
    domain: "Con người và sức khỏe",
    keywordPattern: /\b(co the|bo phan co the|giac quan|suc khoe|ve sinh|rua tay|an uong|dinh duong|an toan|benh|phong tranh|van dong|nghi ngoi)\b/i,
    inquirySequence: [
      "Quan sát tranh/cơ thể/mô hình hoặc tình huống sức khỏe gần gũi.",
      "Mô tả bộ phận, giác quan, thói quen hoặc biểu hiện an toàn/vệ sinh.",
      "Phân biệt việc nên làm/chưa nên làm đối với sức khỏe.",
      "Thực hành một kĩ năng vệ sinh, an toàn hoặc chăm sóc bản thân.",
    ],
    observationTargets: ["Tranh cơ thể/sức khỏe", "Mô hình/thẻ giác quan", "Quy trình rửa tay hoặc an toàn cá nhân"],
    learningProducts: ["Bảng việc nên làm cho sức khỏe", "Quy trình thực hành vệ sinh/an toàn", "Cam kết chăm sóc bản thân"],
    commonMisconceptions: [
      "Nhớ tên bộ phận nhưng chưa biết chức năng hoặc cách bảo vệ.",
      "Biết việc vệ sinh/an toàn nhưng thực hiện sai trình tự.",
      "Cho rằng chỉ khi bị bệnh mới cần chăm sóc sức khỏe.",
    ],
    assessmentCriteria: [
      "Nêu được bộ phận/thói quen sức khỏe bằng ngôn ngữ vừa sức.",
      "Phân biệt được việc nên làm/chưa nên làm để bảo vệ sức khỏe.",
      "Thực hành hoặc mô tả đúng một kĩ năng vệ sinh/an toàn.",
    ],
    applicationMoves: ["Rửa tay đúng thời điểm", "Chọn đồ ăn/thói quen lành mạnh", "Nhắc người thân một quy tắc an toàn"],
    checkerMustHave: /cơ thể|bộ phận|giác quan|sức khỏe|vệ sinh|rửa tay|ăn uống|an toàn|phòng tránh/i,
  },
  "earth-sky": {
    label: "Trái Đất và bầu trời",
    domain: "Trái Đất và bầu trời",
    keywordPattern: /\b(trai dat|bau troi|mat troi|mat trang|ngoi sao|ngay dem|thoi tiet|mua|gio|mua nang|mua mua|nong lanh|lich|phuong huong)\b/i,
    inquirySequence: [
      "Quan sát tranh, lịch thời tiết, bầu trời hoặc hình ảnh hiện tượng gần gũi.",
      "Mô tả dấu hiệu thời tiết/bầu trời/ngày đêm theo quan sát.",
      "So sánh hoặc sắp xếp hiện tượng theo thời gian, mùa, trạng thái.",
      "Lựa chọn hành vi phù hợp với thời tiết và môi trường.",
    ],
    observationTargets: ["Tranh bầu trời/thời tiết", "Lịch thời tiết lớp học", "Thẻ trang phục/hoạt động theo thời tiết"],
    learningProducts: ["Bảng quan sát thời tiết", "Sơ đồ so sánh hiện tượng", "Lựa chọn trang phục/hành động phù hợp"],
    commonMisconceptions: [
      "Nhầm thời tiết trong ngày với mùa.",
      "Suy đoán hiện tượng mà không dựa vào dấu hiệu quan sát.",
      "Chưa biết chọn trang phục/hoạt động an toàn theo thời tiết.",
    ],
    assessmentCriteria: [
      "Mô tả được dấu hiệu thời tiết/bầu trời hoặc hiện tượng gần gũi.",
      "So sánh/sắp xếp được hiện tượng theo tiêu chí đơn giản.",
      "Nêu được cách ứng xử, trang phục hoặc việc làm phù hợp với thời tiết.",
    ],
    applicationMoves: ["Lịch thời tiết một ngày/tuần", "Chọn trang phục phù hợp", "Nhắc việc an toàn khi mưa/nắng/gió"],
    checkerMustHave: /Trái Đất|bầu trời|Mặt Trời|Mặt Trăng|ngôi sao|ngày đêm|thời tiết|mùa|mưa|nắng|gió/i,
  },
  mixed: {
    label: "Tích hợp/Chưa xác định rõ",
    domain: "Tích hợp",
    keywordPattern: /./i,
    inquirySequence: [
      "Xác định đối tượng quan sát gần gũi từ ảnh SGK.",
      "Mô tả đặc điểm, so sánh hoặc phân loại theo tiêu chí đơn giản.",
      "Rút kết luận vừa sức từ bằng chứng quan sát.",
      "Vận dụng thành việc làm cụ thể ở nhà, trường hoặc địa phương.",
    ],
    observationTargets: ["Tranh/ảnh SGK", "Vật thật hoặc tình huống gần gũi", "Phiếu quan sát ngắn"],
    learningProducts: ["Phiếu/bảng quan sát", "Câu trả lời mô tả hoặc phân loại", "Ý tưởng vận dụng vào đời sống"],
    commonMisconceptions: [
      "Kết luận trước khi quan sát đủ bằng chứng.",
      "Phân loại chưa có tiêu chí rõ.",
      "Vận dụng còn chung chung, chưa thành hành động cụ thể.",
    ],
    assessmentCriteria: [
      "Quan sát và mô tả được đặc điểm chính.",
      "So sánh hoặc phân loại theo tiêu chí đơn giản.",
      "Nêu được việc làm cụ thể gắn với đời sống.",
    ],
    applicationMoves: ["Quan sát ở nhà/trường", "Chia sẻ với người thân", "Thực hiện một hành động an toàn, vệ sinh hoặc bảo vệ môi trường"],
    checkerMustHave: /quan sát|mô tả|so sánh|phân loại|việc nên làm|vận dụng/i,
  },
};

const classificationSignalPatterns: Partial<Record<NaturalSocialLessonType, RegExp>> = {
  family: /\b(gia dinh|nguoi than|ong ba|bo me|cha me|anh chi em|ngoi nha|nha o|phong khach|phong ngu|phong bep|viec nha)\b/i,
  school: /\b(truong hoc|truong em|lop hoc|ban be|thay co|co giao|noi quy|san truong|phong hoc|hoat dong o truong)\b/i,
  "local-community": /\b(dia phuong|cong dong|noi em song|que huong|lang xom|duong pho|noi cong cong|nghe nghiep)\b/i,
  "plants-animals": /\b(cay|cay trong|cay xanh|cay hoa|bong hoa|la cay|than cay|re cay|qua cua cay|hat giong|con vat|dong vat|vat nuoi|thu cung|moi truong song|cham soc cay|bao ve dong vat)\b/i,
  "human-health": /\b(co quan van dong|bo xuong|he co|xuong|khop|co bap|co the|bo phan co the|giac quan|suc khoe|ve sinh|rua tay|an uong|dinh duong|an toan|benh|phong tranh|van dong|nghi ngoi)\b/i,
  "earth-sky": /\b(thoi tiet|bau troi|mat troi|mat trang|ngay dem|trai dat|phuong huong|mua gio|troi mua|troi nang|gio manh)\b/i,
};

function patternHitCount(pattern: RegExp | undefined, value: string) {
  if (!pattern) return 0;
  const flags = Array.from(new Set((pattern.flags + "g").split(""))).join("");
  return Array.from(value.matchAll(new RegExp(pattern.source, flags))).length;
}

export const naturalSocialTopicFocusProfiles: Record<NaturalSocialTopicFocus, NaturalSocialLessonTypeProfile> = {
  "home-environment": {
    label: "Ngôi nhà, địa chỉ, các phòng và đồ dùng",
    domain: "Gia đình - nhà ở",
    keywordPattern: /\b(ngoi nha|nha cua em|nha o|dia chi nha|dia chi noi gia dinh|dia chi noi o|kieu nha|quang canh|xung quanh nha|phong khach|phong ngu|phong bep|do dung trong nha)\b/i,
    inquirySequence: [
      "Quan sát ngôi nhà, địa chỉ giả định/địa chỉ trong tranh, đặc điểm và quang cảnh xung quanh.",
      "Nhận biết sự đa dạng của kiểu nhà hoặc các phòng dựa trên hình ảnh và trải nghiệm gần gũi.",
      "Ghép, so sánh hoặc gọi tên đồ dùng phù hợp với từng phòng khi nguồn SGK yêu cầu.",
      "Liên hệ ngôi nhà của em bằng nói/chỉ/vẽ hoặc sản phẩm ngắn; không buộc công khai địa chỉ thật.",
    ],
    observationTargets: ["Tranh các kiểu nhà và quang cảnh xung quanh", "Tranh các phòng trong nhà", "Thẻ hình đồ dùng trong gia đình"],
    learningProducts: ["Câu mô tả ngắn về ngôi nhà", "Kết quả ghép phòng - đồ dùng", "Thiệp/sơ đồ/tranh nói về nhà theo mẫu vừa sức"],
    commonMisconceptions: [
      "Nhớ địa chỉ hoặc tên nhà của nhân vật trong tranh nhưng chưa liên hệ được yêu cầu chung của bài.",
      "Ghép đồ dùng vào phòng theo sở thích thay vì công dụng thường gặp.",
      "Tự chèn việc nhà, thẻ việc tốt hoặc quy tắc an toàn khi nhiệm vụ SGK không yêu cầu.",
    ],
    assessmentCriteria: [
      "Nêu hoặc nhận biết được địa chỉ nơi gia đình ở theo cách phù hợp, không bắt buộc công khai trước lớp.",
      "Mô tả được một vài đặc điểm của ngôi nhà, kiểu nhà, phòng hoặc quang cảnh dựa trên quan sát.",
      "Gọi tên/ghép được một số đồ dùng với phòng phù hợp khi bài có nhiệm vụ này.",
    ],
    applicationMoves: ["Giới thiệu ngắn về ngôi nhà bằng nói/chỉ/vẽ", "Hoàn thiện thiệp với địa chỉ giả định hoặc kiểm tra địa chỉ thật riêng tư", "Ghép đồ dùng với phòng phù hợp"],
    checkerMustHave: /ngôi nhà|nhà ở|địa chỉ|kiểu nhà|quang cảnh|phòng khách|phòng ngủ|phòng bếp|đồ dùng/i,
  },
  "family-members-care": {
    ...naturalSocialLessonTypeProfiles.family,
    label: "Thành viên và sự quan tâm trong gia đình",
    keywordPattern: /\b(thanh vien|ong ba|bo me|cha me|anh chi em|nguoi than|cham soc|quan tam|yeu thuong)\b/i,
  },
  "family-chores": {
    ...naturalSocialLessonTypeProfiles.family,
    label: "Việc nhà và chia sẻ việc gia đình",
    keywordPattern: /\b(viec nha|lam viec nha|quet nha|lau nha|nau an|gap quan ao|giup do gia dinh|chia se viec)\b/i,
    inquirySequence: [
      "Quan sát việc làm của các thành viên trong gia đình.",
      "Mô tả ai làm việc gì và ích lợi của việc cùng chia sẻ.",
      "Chọn việc nhà vừa sức, phù hợp lứa tuổi.",
      "Thực hiện hoặc theo dõi một việc nhà vừa sức nếu nhiệm vụ bài yêu cầu.",
    ],
    applicationMoves: ["Thẻ việc nhà vừa sức", "Bảng theo dõi một việc giúp gia đình", "Chia sẻ cách phối hợp với người thân"],
  },
  "home-safety": {
    ...naturalSocialLessonTypeProfiles.family,
    label: "An toàn ở nhà",
    keywordPattern: /\b(an toan o nha|phong tranh|o dien|bep nong|hoa chat|vat sac nhon|su dung do dung an toan)\b/i,
    applicationMoves: ["Xử lí tình huống an toàn ở nhà", "Nhận biết vật/khu vực cần tránh", "Nhờ người lớn hỗ trợ đúng lúc"],
  },
  "family-general": naturalSocialLessonTypeProfiles.family,
};

export function isNaturalSocialTopicFocus(value: unknown): value is NaturalSocialTopicFocus {
  return typeof value === "string" && value in naturalSocialTopicFocusProfiles;
}

function familyTopicFocus(input: LessonInput, sourceText: string): NaturalSocialTopicFocus {
  const title = normalizeNaturalSocialText(`${input.lessonTitle || ""} ${input.specialRequest || ""}`);
  const source = normalizeNaturalSocialText(sourceText);
  const scores: Array<{ focus: NaturalSocialTopicFocus; score: number }> = [
    {
      focus: "home-environment",
      score: (/ngoi nha|nha cua em|nha o|dia chi nha|dia chi noi gia dinh|dia chi noi o|kieu nha|quang canh|phong khach|phong ngu|phong bep|do dung trong nha/.test(title) ? 5 : 0)
        + (/ngoi nha|nha minh|dia chi nha|dia chi noi gia dinh|dia chi noi o|kieu nha|quang canh|phong khach|phong ngu|phong bep|do dung/.test(source) ? 2 : 0),
    },
    {
      focus: "family-chores",
      score: (/viec nha|lam viec nha|giup gia dinh|chia se viec/.test(title) ? 5 : 0)
        + (/quet nha|lau nha|lau ban|nau an|gap quan ao|cham em|viec nha|giup gia dinh/.test(source) ? 2 : 0),
    },
    {
      focus: "home-safety",
      score: (/an toan o nha|phong tranh.*o nha|su dung do dung.*an toan/.test(title) ? 5 : 0)
        + (/o dien|bep nong|hoa chat|vat sac nhon|dao keo|an toan o nha/.test(source) ? 2 : 0),
    },
    {
      focus: "family-members-care",
      score: (/thanh vien|gia dinh em|ong ba|bo me|cha me|anh chi em|nguoi than|yeu thuong|quan tam/.test(title) ? 4 : 0)
        + (/thanh vien|ong ba|bo me|cha me|anh chi em|nguoi than|cham soc|quan tam/.test(source) ? 1 : 0),
    },
  ];
  const best = scores.sort((left, right) => right.score - left.score)[0];
  return best && best.score > 0 ? best.focus : "family-general";
}

export function getNaturalSocialPedagogyProfile(classification: Pick<NaturalSocialClassification, "primaryType" | "topicFocus">) {
  if (classification.primaryType === "family" && classification.topicFocus) {
    return naturalSocialTopicFocusProfiles[classification.topicFocus] || naturalSocialLessonTypeProfiles.family;
  }
  return naturalSocialLessonTypeProfiles[classification.primaryType] || naturalSocialLessonTypeProfiles.mixed;
}

export function naturalSocialSourceInventoryText(sourceInventory?: NaturalSocialSourceInventory) {
  if (!sourceInventory) return "";
  return JSON.stringify({
    visuals: sourceInventory.visuals,
    questions: sourceInventory.questions,
    procedures: sourceInventory.procedures,
    practiceTasks: sourceInventory.practiceTasks,
    situations: sourceInventory.situations,
    classificationTasks: sourceInventory.classificationTasks,
    personalTasks: sourceInventory.personalTasks,
    safetyConstraints: sourceInventory.safetyConstraints,
    requiredTasks: sourceInventory.requiredTasks,
  });
}

export function classifyNaturalSocialLesson(input: LessonInput, sourceText = ""): NaturalSocialClassification {
  const titleText = normalizeNaturalSocialText(`${input.lessonTitle || ""} ${input.specialRequest || ""}`);
  const normalizedSourceText = normalizeNaturalSocialText(sourceText || "");
  const text = normalizeNaturalSocialText(`${titleText} ${input.subject || ""} ${normalizedSourceText}`);
  const entries = Object.entries(naturalSocialLessonTypeProfiles)
    .filter(([type]) => type !== "mixed") as Array<[NaturalSocialLessonType, NaturalSocialLessonTypeProfile]>;

  const scoredMatches = entries
    .map(([type, profile], index) => ({
      type,
      profile,
      index,
      score: patternHitCount(classificationSignalPatterns[type], titleText) * 4
        + patternHitCount(classificationSignalPatterns[type], normalizedSourceText),
    }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score || left.index - right.index);
  const matches = scoredMatches.length
    ? scoredMatches
    : entries
      .map(([type, profile], index) => ({ type, profile, index, score: profile.keywordPattern.test(text) ? 1 : 0 }))
      .filter((item) => item.score > 0);

  const primaryType = matches[0]?.type || "mixed";
  const topicFocus = primaryType === "family" ? familyTopicFocus(input, sourceText) : undefined;
  const secondaryTypes = matches.slice(1).map((item) => item.type);
  const confidence: NaturalSocialClassification["confidence"] =
    !matches.length ? "low" : matches.length === 1 ? "high" : "medium";

  return {
    primaryType,
    ...(topicFocus ? { topicFocus } : {}),
    secondaryTypes,
    confidence,
    evidence: matches.length
      ? matches.map((item) => `Có tín hiệu chủ đề ${item.profile.label.toLowerCase()} trong tên bài hoặc ảnh SGK.`)
      : ["Chưa đủ tín hiệu để khóa một chủ đề TNXH duy nhất."],
    gradeBand: gradeBandFor(input.grade),
    uncertainties: matches.length > 1
      ? ["Bài có tín hiệu giao thoa nhiều chủ đề; cần chia trọng tâm theo từng tiết/hoạt động."]
      : [],
  };
}

export function getNaturalSocialChecklist(classification: NaturalSocialClassification): string[] {
  const profile = getNaturalSocialPedagogyProfile(classification);
  return [
    "Có đối tượng quan sát cụ thể từ tranh, vật thật, mô hình hoặc môi trường gần gũi.",
    "Có nhiệm vụ mô tả đặc điểm dựa trên bằng chứng quan sát.",
    "Có so sánh hoặc phân loại theo tiêu chí đơn giản khi phù hợp bài.",
    "Có sản phẩm học tập quan sát được: phiếu, bảng, tranh, thẻ hoặc lời trình bày.",
    "Có hành động vận dụng vào gia đình, trường học, địa phương, sức khỏe, an toàn hoặc môi trường.",
    ...profile.assessmentCriteria,
  ];
}
