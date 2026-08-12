import { getPedagogyProfile, gradeBandFor } from "./pedagogy-profiles";
import { getNaturalSocialPedagogyProfile } from "./natural-social-pedagogy";
import { formatNaturalSocialStartupPromptBlock, selectNaturalSocialStartup } from "./natural-social-startup";
import { classifyVietnameseLesson, vietnameseLessonTypeProfiles } from "./vietnamese-pedagogy";
import type {
  LessonInput,
  LessonPlan,
  LessonOutcomes,
  MathLessonBlueprint,
  MathPeriodBlueprint,
  MathPeriodChunk,
  NaturalSocialClassification,
  NaturalSocialLessonBlueprint,
  NaturalSocialPeriodBlueprint,
  NaturalSocialPeriodChunk,
  NaturalSocialSourceInventory,
  VietnameseLessonBlueprint,
  VietnameseLessonClassification,
  VietnamesePeriodBlueprint,
  VietnamesePeriodChunk,
} from "@/types/lesson";

export const curriculumGuidance = `Can cu CTGDPT 2018:
- Muc tieu la phat trien pham chat va nang luc, khong day theo loi truyen thu mot chieu.
- Pham chat chu yeu can gan dung bai hoc: yeu nuoc, nhan ai, cham chi, trung thuc, trach nhiem.
- Nang luc chung can the hien qua hoat dong: tu chu va tu hoc; giao tiep va hop tac; giai quyet van de va sang tao.
- Hoat dong hoc tap phai co: kham pha van de, luyen tap, thuc hanh/van dung vao doi song; co the dung tro choi, dong vai, du an nho, thao luan nhom, quan sat tranh/ngu lieu, san pham hoc tap.
- Giao vien dong vai tro to chuc, huong dan, tao tinh huong co van de; hoc sinh duoc tu thuc hien nhiem vu, trao doi, bao cao, phan hoi.
- Danh gia dua tren qua trinh va san pham hoc tap, ket hop tu danh gia, danh gia dong dang va nhan xet cua giao vien.`;

export const startupGuidance = `Quy tac bat buoc cho hoat dong Khoi dong:
- Khoi dong luon la hoat dong toan lop, tao hung thu cho da so hoc sinh; khong duoc chi viet "GV gioi thieu bai".
- Phai chon mot hinh thuc sinh dong phu hop noi dung bai: hat/van dong theo nhip, tro choi nhanh, cau do, o chu, nghe am thanh, quan sat tranh/video ngan, do vat that, thi nghiem mini, dong vai. Chi dung ten STEM/STEAM neu hoat dong thuc su co yeu to thiet ke/giai quyet van de/thu nghiem san pham phu hop mon hoc.
- Duoc lay hoc lieu ngoai SGK cho Khoi dong neu sat nhat voi trong tam bai va gay hung thu; neu dung ngoai SGK phai ghi ro do la tranh/video/am thanh/tro choi goi mo, khong gan nham thanh tranh SGK va khong thay the cac nhiem vu SGK bat buoc o Kham pha/Luyen tap/Van dung.
- Hoat dong phai dan tu nhien vao bai hoc, khong vui cho co.
- Bat buoc co: ten hoat dong hap dan, hinh thuc toan lop, thoi luong 3-5 phut, do dung, luat choi/cach to chuc, cau hoi goi mo, du kien cau tra loi cua hoc sinh, loi chot chuyen y cua giao vien.
- Neu la Toan/Khoa hoc/Cong nghe/Tin hoc, uu tien thu thach STEM ngan, du doan hien tuong/ket qua, ghep the, do nhanh, tim quy luat hoac giai ma.
- Neu la Tieng Viet/Ngu van/Ngoai ngu, uu tien tranh, am thanh, cau do, nhan vat bi mat, doc dien cam, ghep tu khoa hoac tro choi ngon ngu.
- Neu la Dao duc/GDCD/Hoat dong trai nghiem, uu tien tinh huong, dong vai, binh chon hanh vi, the cam xuc hoac goc y kien.
- Neu la Am nhac/Mi thuat, uu tien cam thu, van dong, quan sat, sang tao nhanh.
- Tuyet doi khong tao tro choi tach roi bai hoc hoac chi vui ma khong phuc vu muc tieu bai.`;

export const creativeTeachingGuidance = `Che do Giao an sang tao/du gio:
- Giao an phai co chat luong tuong duong giao an thi giang/du gio, khong viet kieu hanh chinh so sai.
- Duoc phep sang tao hoc lieu ngoai SGK như video AI ngan, tranh dong, nhan vat hoat hinh, hop bi mat, the tin hieu, tro choi van dong, tinh huong dong vai, slide tuong tac, thu thach STEM/STEAM dung ban chat, mien la bam muc tieu bai hoc va phu hop lua tuoi.
- Anh SGK/trang sach user upload la noi dung loi; hoat dong co the mo rong bang tinh huong doi song, tro choi, hinh anh, cau chuyen, video hoac nhiem vu trai nghiem.
- Moi hoat dong phai viet nhu kich ban day that: GV noi gi, chieu gi, hoi gi, giao nhiem vu gi; HS quan sat/lam gi/tra loi ra sao; GV nhan xet va chot gi.
- Khong dung cau chung chung nhu "GV to chuc tro choi", "HS thao luan", "GV nhan xet". Phai neu ro ten tro choi, luat choi, cau hoi, du kien cau tra loi va ket luan.
- Voi lop nho, uu tien hoat dong co cam xuc, cu chi, tin hieu co the, tranh/video, cau noi de nho.
- Moi bai can co it nhat mot diem sang tao noi bat giup giao vien co the dung khi du gio.`;

export const deepTeachingScriptGuidance = `Tieu chuan viet giao an level cao:
- Khong viet theo kieu khung hanh chinh ngan gon. Moi hoat dong phai la kich ban day hoc co the cam len day ngay.
- Moi hoat dong phai co 3 lop noi dung: tinh huong/mo neo cam xuc, cach to chuc tung buoc, va loi chot/chuyen y cua giao vien.
- Moi hoat dong phai dung it nhat 1 ky thuat day hoc cu the phu hop: tro choi co ten va luat, khan trai ban, manh ghep, phong tranh, the tin hieu, dong vai, du doan, thu thach nhom, phieu nhiem vu, hop bi mat, goc y kien, tranh/video kich thich; chi goi STEM/STEAM khi dung ban chat hoat dong.
- Khong duoc ghi chung chung: "GV to chuc", "HS thao luan", "GV nhan xet". Phai viet ro GV noi/hoi/chieu/phat/giao viec gi; HS du kien noi/lam/ghi/san pham gi.
- Moi pha phai co cau hoi goi mo, du kien cau tra loi dung/sai thuong gap, cach GV xu ly sai lech va loi chot kien thuc.
- Luyen tap phai co bai tap/nhiem vu/luat choi cu the bam noi dung anh SGK/trang sach; Van dung phai gan voi doi song that cua hoc sinh; Danh gia phai co tieu chi quan sat duoc va minh chung.
- Giua cac tiet khong lap lai mot cong thuc khoi dong; moi tiet can mot cach vao bai rieng, co bat ngo hoac moi cam xuc.`;

export function qualityGuidance(input: LessonInput) {
  if (input.style === "Cơ bản") {
    return `Phong cach: Co ban. Giao an gon, de dung, du cau truc CV2345; moi hoat dong co muc tieu, cach to chuc ro, san pham hoc tap va toi thieu 4 cap GV/HS dong bo.`;
  }
  if (input.style === "Sáng tạo, sinh động") {
    return `Phong cach: Sang tao, sinh dong. Giao an can giau y tuong, co tro choi/hoc lieu/ky thuat day hoc hap dan, tinh huong gan doi song, cau hoi goi mo, du kien phan hoi va loi chot ro.\n${deepTeachingScriptGuidance}`;
  }
  return `Phong cach: Day that tren lop. Giao an thuc te, de trien khai, viet theo kich ban GV/HS vua du sau; moi hoat dong co tinh huong, cach to chuc tung buoc, cau hoi goi mo, du kien phan hoi va loi chot.`;
}

export function bookContext(input: LessonInput) {
  const volume = input.bookVolume && input.bookVolume !== "auto" ? ` - ${input.bookVolume}` : "";
  return `${input.book || "Chưa rõ"}${volume}`;
}

export function localityContext(input: LessonInput) {
  const province = input.hometownProvince && input.hometownProvince !== "auto" ? input.hometownProvince : "Auto - không cá nhân hóa theo tỉnh";
  const note = input.localityNote?.trim() ? `; ghi chú địa phương: ${input.localityNote.trim()}` : "";
  return `${province}${note}`;
}

export function isLocalLessonContext(input: LessonInput, ocrText: string) {
  return /địa phương|dia phuong|quê hương|que huong|tỉnh em|tinh em|quê em|que em|nơi em sống|noi em song/i.test(
    `${input.subject} ${input.lessonTitle} ${input.specialRequest} ${ocrText}`,
  );
}

export function elementaryLocalityGuidance(input: LessonInput, ocrText: string) {
  const hasProvince = Boolean(input.hometownProvince && input.hometownProvince !== "auto");
  const localLesson = isLocalLessonContext(input, ocrText);
  const intensity = localLesson ? "sâu" : hasProvince ? "vừa phải" : "tự nhiên khi phù hợp";
  const provinceRule = hasProvince
    ? `- Tỉnh/thành phố của học sinh là ${input.hometownProvince}. Không dùng ví dụ thuộc tỉnh/thành phố khác nếu không có lý do rõ ràng trong bài học.`
    : "- User chưa chọn tỉnh/thành phố; không tự gán một địa phương cụ thể như Cần Thơ, Hà Nội, Huế... nếu ảnh SGK hoặc form không cho biết.";

  return `Quy tắc địa phương hóa bài học Tiểu học:
- Phạm vi tool chỉ dành cho Tiểu học lớp 1-5; mọi hoạt động phải vừa sức học sinh tiểu học và bám thời lượng 35 phút/tiết.
${provinceRule}
- Mức độ địa phương hóa cần áp dụng: ${intensity}. Không biến mọi môn thành bài Địa lí; chỉ dùng địa phương như bối cảnh học tập phù hợp môn, lớp và bài.
- Không bịa số liệu, di tích, lễ hội, nhân vật, đặc sản, sông núi hoặc sản phẩm kinh tế cụ thể nếu không chắc. Khi thiếu dữ liệu, viết dạng mở để giáo viên thay bằng ví dụ thật của địa phương.
- Với Tiếng Việt: gắn nói-nghe, đọc, kể, viết đoạn ngắn về cảnh vật, con người, việc tốt, trường lớp hoặc quê hương ở mức phù hợp lớp.
- Với Toán: dùng tình huống gần gũi như lớp học, chợ, quãng đường, cây trồng, sản phẩm quen thuộc; không làm loãng kiến thức toán.
- Với Đạo đức: dùng tình huống ứng xử trong gia đình, nhà trường, cộng đồng địa phương.
- Với Tự nhiên và Xã hội/Khoa học: liên hệ cây cối, vật nuôi, thời tiết, nguồn nước, môi trường, sức khỏe ở địa phương.
- Với Lịch sử và Địa lí: địa phương hóa sâu hơn, nhất là các bài về "địa phương em", nhưng phải tránh ôm quá nhiều mục tiêu trong một tiết.
- Với Tin học/Công nghệ: gắn sản phẩm, nghề nghiệp, quy trình, dữ liệu hoặc sản phẩm số đơn giản giới thiệu địa phương khi phù hợp.
- Với Âm nhạc/Mĩ thuật/Giáo dục thể chất/Hoạt động trải nghiệm: gắn cảnh vật, trò chơi, âm thanh, sản phẩm, hoạt động cộng đồng quen thuộc ở mức nhẹ và đúng bản chất môn.
- Theo lớp: lớp 1-2 chỉ quan sát, nói, kể, vẽ, chọn đáp án đơn giản; lớp 3 dùng phiếu ngắn và mô tả đơn giản; lớp 4-5 có thể khảo sát nhỏ, viết đoạn, thuyết trình ngắn, đề xuất việc làm bảo vệ quê hương.
${localLesson ? "- Vì đây là bài có dấu hiệu liên quan địa phương, bắt buộc có phiếu/nhiệm vụ học tập cụ thể, tiêu chí đánh giá sản phẩm rõ ràng và phần Vận dụng gắn với địa phương đã chọn hoặc dạng mở an toàn." : ""}
${localLesson && Number(input.periods) > 1 ? "- Với bài địa phương nhiều tiết, không lặp mục tiêu giữa các tiết; mỗi tiết phải có trọng tâm riêng, hoạt động vừa sức và sản phẩm học tập rõ." : ""}`;
}

export function learningContextGuidance(input: LessonInput) {
  const facilities = input.facilities === "auto" ? "AI tự chọn thiết bị vừa đủ, có phương án không cần thiết bị số" : input.facilities.join(", ");
  return `Quy tắc cá nhân hóa theo môi trường học và cơ sở vật chất:
- Môi trường học: ${input.teachingEnvironment}. Đối tượng học sinh: ${input.studentProfile}. Cơ sở vật chất: ${facilities}.
- Các lựa chọn này phải xuất hiện rõ trong materials.teacher/materials.students và trong teacherActions/studentActions, không chỉ ghi ở contextFit.
- Nếu có TV/máy chiếu/wifi/bảng tương tác/loa: ít nhất một hoạt động Khởi động hoặc Khám phá phải nêu cụ thể GV chiếu tranh/video ngắn/bản đồ số/slide câu hỏi/mở âm thanh; HS quan sát, tương tác, trả lời, kéo-thả/đánh dấu/chọn đáp án hoặc hoàn thành phiếu tương ứng. Luôn có phương án thay thế nếu mất mạng.
- Nếu không có thiết bị trình chiếu hoặc môi trường vùng núi/điểm trường lẻ: ưu tiên tranh in, thẻ từ/thẻ màu, vật thật, bảng phụ, phiếu học tập, hoạt động nhóm nhỏ, quan sát cảnh quan/sân trường/vật liệu sẵn có; không phụ thuộc video, mạng hoặc thiết bị số.
- Nếu môi trường nông thôn: ưu tiên tình huống thực tế như ruộng vườn, chợ quê, con đường làng, dòng sông, nghề nghiệp địa phương, quan sát thực tế quanh trường; hoạt động phải làm được trên lớp hoặc sân trường.
- Nếu môi trường thành thị: ưu tiên tình huống giao thông, công viên, khu dân cư, siêu thị, trường học, dữ liệu/hình ảnh số, bản đồ/sơ đồ đô thị ở mức phù hợp.
- Nếu học sinh cần hỗ trợ nhiều/học lực không đồng đều: chia nhiệm vụ nhỏ, có câu hỏi gợi ý, phiếu mẫu, cặp đôi hỗ trợ; nếu học sinh khá giỏi: có nhiệm vụ mở rộng, so sánh, giải thích, đề xuất giải pháp.
- Hoạt động không cần sao chép y nguyên SGK. Dùng ảnh SGK làm căn cứ mục tiêu và phạm vi kiến thức; được thiết kế sinh động, thực tế, sáng tạo vừa phải, miễn đúng mục tiêu bài học và không sa đà trò chơi làm loãng kiến thức.`;
}

function formatGuidanceList(items: string[]) {
  return items.map((item) => `- ${item}`).join("\n");
}

// ─── MATH-SPECIFIC GUIDANCE ───

export const mathLatexPolicy = `CHÍNH SÁCH LATEX BẮT BUỘC CHO NỘI DUNG TOÁN:
- Chỉ bọc biểu thức/ký hiệu toán bằng \\(...\\) khi nằm trong câu và \\[...\\] khi cần đứng riêng; không bọc câu văn hoặc mọi con số đơn lẻ.
- Không dùng $...$, $$...$$, Markdown code fence hoặc HTML.
- Vì output là JSON, mọi dấu gạch chéo ngược trong LaTeX phải được escape thành \\\\ trong chuỗi JSON. Ví dụ JSON phải chứa "\\\\(S = a \\\\times b\\\\)" để sau khi parse nhận được \\(S = a \\times b\\).
- Dùng lệnh chuẩn: \\frac{3}{4}, \\sqrt{25}, x^2, a_1, \\times, \\div, \\leq, \\geq, \\neq, \\pm, 60^\\circ.
- Đơn vị đặt trong \\mathrm và có khoảng cách mảnh: \\(5\\,\\mathrm{cm}\\), \\(20\\,\\mathrm{cm}^2\\), \\(2\\,\\mathrm{kg}\\).
- Phép tính dọc phải dùng display math với array căn phải, ví dụ: \\[\\begin{array}{r}1{,}65\\\\+\;1{,}26\\\\\\hline 2{,}91\\end{array}\\]. Không căn cột bằng khoảng trắng thường.
- Công thức quá dài phải tách thành nhiều display line vừa ô bảng; không dùng macro tự định nghĩa, TikZ, \\include, \\input, URL hoặc HTML.
- Trước khi trả JSON, tự kiểm tra delimiter đóng/mở, ngoặc nhọn, phép tính, đáp án và đơn vị. Công thức phải render được bằng KaTeX/MathJax.`;

export const mathTranscribeGuidance = `Quy tắc bắt buộc – Viết lại nội dung toán cụ thể từ ảnh SGK vào giáo án:
${mathLatexPolicy}
- Phép tính: viết rõ từng phép tính, ví dụ \\(2 + 3 = \\ldots\\), \\(15 - 7 = \\ldots\\), \\(6 + 3 < 10 - 3\\). KHÔNG viết "HS làm bài tập trong SGK".
- Bài toán có lời văn: viết rõ đề bài, dữ kiện, câu hỏi vào teacherActions; chỉ phần biểu thức được bọc LaTeX.
- Công thức: viết rõ, ví dụ \\(S = a \\times b\\), \\(P = (a + b) \\times 2\\). KHÔNG chỉ nói "GV chốt công thức".
- Hình học: mô tả hình kèm nhãn và kích thước, ví dụ "Hình chữ nhật ABCD, chiều dài \\(5\\,\\mathrm{cm}\\), chiều rộng \\(3\\,\\mathrm{cm}\\)".
- Bài giải mẫu: viết từng bước với số liệu cụ thể từ SGK; đáp án dự kiến phải có kết quả, không viết "HS tính ra kết quả".
- Nối/ghép: liệt kê rõ các phép tính và kết quả tương ứng.
- Nếu bài yêu cầu "đặt tính rồi tính", bắt buộc dùng \\[\\begin{array}{r}...\\end{array}\\] để hàng đơn vị, dấu phẩy và gạch ngang thẳng cột.
- KHÔNG chỉ tham chiếu "xem SGK trang X" hoặc "HS làm bài 1, 2, 3". Mọi nội dung toán phải được viết lại vào đúng teacherActions, studentActions hoặc learningProducts.`;

export function mathGradeBandGuidance(input: LessonInput) {
  const profile = getPedagogyProfile("Toán");
  if (!profile) return "";
  const gradeBand = gradeBandFor(input.grade);
  const adjustments = profile.gradeBandAdjustments[gradeBand] || [];
  if (!adjustments.length) return "";
  return `Điều chỉnh bắt buộc theo cụm lớp ${gradeBand}:\n${formatGuidanceList(adjustments)}`;
}

function mathPedagogyCompact(input: LessonInput) {
  const profile = getPedagogyProfile("Toán");
  if (!profile) return "";
  const gradeBand = gradeBandFor(input.grade);
  const adjustments = profile.gradeBandAdjustments[gradeBand] || [];
  return `Logic sư phạm Toán (${gradeBand}):
- ${profile.purpose}

Trọng tâm:\n${formatGuidanceList(profile.coreTeachingFocus)}

Hoạt động đặc trưng:\n${formatGuidanceList(profile.signatureActivities)}

Phân hóa:\n${formatGuidanceList(profile.differentiationMoves)}

Vận dụng:\n${formatGuidanceList(profile.applicationMoves)}

Điều cần tránh:\n${formatGuidanceList(profile.avoid)}

${adjustments.length ? `Cụm lớp ${gradeBand}:\n${formatGuidanceList(adjustments)}` : ""}

Checklist chất lượng:\n${formatGuidanceList(profile.qualityChecks)}`;
}

export function pedagogyProfileGuidance(input: LessonInput) {
  const profile = getPedagogyProfile(input.subject);
  if (!profile) {
    return `Logic sư phạm theo môn:
- Chưa có Pedagogy Profile riêng cho môn "${input.subject}". Hãy bám CTGDPT 2018, đặc trưng môn học và nội dung SGK; không dùng hoạt động chung chung.`;
  }

  const gradeBand = gradeBandFor(input.grade);
  const gradeAdjustments = profile.gradeBandAdjustments[gradeBand] || [];

  return `Logic sư phạm chuyên biệt cho môn ${profile.subject} (${gradeBand}):
Mục đích dạy học của môn:
- ${profile.purpose}

Trọng tâm phải giữ:
${formatGuidanceList(profile.coreTeachingFocus)}

Hoạt động đặc trưng nên xuất hiện khi phù hợp:
${formatGuidanceList(profile.signatureActivities)}

Lỗi/ngộ nhận học sinh dễ mắc, cần dự kiến và xử lý:
${formatGuidanceList(profile.commonMisconceptions)}

Câu hỏi gỡ khó nên dùng cho học sinh lúng túng:
${formatGuidanceList(profile.supportQuestions)}

Tiêu chí đánh giá theo môn:
${formatGuidanceList(profile.assessmentCriteria)}

Phân hóa học sinh:
${formatGuidanceList(profile.differentiationMoves)}

Vận dụng đúng bản chất môn:
${formatGuidanceList(profile.applicationMoves)}

Điều cần tránh:
${formatGuidanceList(profile.avoid)}

Điều chỉnh theo cụm lớp ${gradeBand}:
${gradeAdjustments.length ? formatGuidanceList(gradeAdjustments) : "- Không có điều chỉnh riêng; giữ mức độ vừa sức lớp đã chọn."}

Checklist chất lượng riêng của môn, phải tự soi trước khi trả JSON:
${formatGuidanceList(profile.qualityChecks)}

Gợi ý tự sửa nếu giáo án bị lệch logic môn:
${formatGuidanceList(profile.repairHints)}`;
}

export function buildSubjectSystemRole(input: LessonInput): string {
  const subject = (input.subject || "").trim();
  if (/^(toán|toan)$/i.test(subject)) {
    return "Bạn là chuyên gia Toán tiểu học. Chỉ trả JSON hợp lệ. Quy trình bắt buộc: biểu diễn/tóm tắt trực quan → phân tích dữ kiện, quan hệ → chọn phép tính/quy trình có lý do → giải → kiểm tra ngược bằng dữ kiện ban đầu. Viết rõ mọi phép tính, công thức, hình học, bài giải mẫu và đáp án dự kiến vào giáo án; không tham chiếu SGK chung chung. Đặc biệt, với các bài toán yêu cầu đặt tính rồi tính (phép tính dọc như cộng, trừ, nhân, chia số tự nhiên/thập phân), hãy thể hiện dạng dọc bằng cách sử dụng các dòng mới và khoảng trắng căn lề để các chữ số, dấu phẩy thẳng cột, ví dụ:\n  5,4\n+ 3,9\n-----\n 8,13\n(đảm bảo các chữ số và dấu gạch ngang được xếp thẳng cột tương ứng).";
  }
  if (/^(tiếng\s*việt|tieng\s*viet)$/i.test(subject)) {
    return "Bạn là chuyên gia Tiếng Việt tiểu học. Chỉ trả JSON hợp lệ. Bám chính xác nội dung/thứ tự SGK; YCCĐ chỉ 4-6 câu ngắn với động từ đo được: Đọc, Hiểu, Tìm, Xác định, Sắp xếp, Nêu, Lựa chọn, Đặt câu, Viết, Tự sửa; cấm câu máy móc và lỗi '.:'. Mỗi hoạt động có 1 sản phẩm chính, tiêu chí đúng loại sản phẩm, teacherActions/studentActions khớp từng bước. Chỉ phân hóa ở 1-2 hoạt động trọng tâm, học liệu phải lọc theo hoạt động, đáp án/ngữ liệu phải chép cụ thể khi ảnh SGK cung cấp. Tự rà soát trùng nhiệm vụ, độ tuổi, thời gian và độ dài trước khi xuất.";
  }
  if (/^(tự\s*nhiên\s*và\s*xã\s*hội|tu\s*nhien\s*va\s*xa\s*hoi|tnxh)$/i.test(subject)) {
    return "Bạn là chuyên gia Tự nhiên và Xã hội tiểu học lớp 1-3. Chỉ trả JSON hợp lệ. Quy trình bắt buộc: quan sát/trải nghiệm gần gũi → mô tả đặc điểm → so sánh hoặc phân loại theo tiêu chí → rút kết luận đơn giản → thực hành hành vi/vận dụng ở nhà, trường hoặc địa phương. Không dạy kiểu học thuộc định nghĩa, không bịa dữ liệu địa phương, không tổ chức hoạt động thiếu an toàn.";
  }
  return "Bạn chỉ trả JSON hợp lệ theo schema được yêu cầu. Soạn giáo án chi tiết, có thể dạy thật, theo định hướng phát triển phẩm chất và năng lực của CTGDPT 2018.";
}

export function buildSubjectPrompt(input: LessonInput, ocrText: string): string {
  return buildDefaultPrompt(input, ocrText);
}

export function buildSubjectRepairPrompt(lesson: LessonPlan, input: LessonInput, ocrText: string, subjectPedagogyRepairGuidanceStr: string): string {
  return buildDefaultRepairPrompt(lesson, input, ocrText, subjectPedagogyRepairGuidanceStr);
}

function buildDefaultPrompt(input: LessonInput, ocrText: string): string {
  const style = input.style || "Dạy thật trên lớp";
  const facilities = input.facilities === "auto" ? "AI tự chọn theo bối cảnh" : input.facilities.join(", ");
  const creativeMode = style === "Sáng tạo, sinh động";

  return `Bạn là chuyên gia giáo dục phổ thông, am hiểu Công văn 2345/BGDĐT-GDTH và Chương trình GDPT 2018.

Nhiệm vụ: Từ thông tin form và nội dung trích xuất từ ảnh SGK user upload, hãy soạn Kế hoạch bài dạy (KHBD) hoàn chỉnh, chi tiết, đúng cấu trúc mẫu giáo án Việt Nam. Giáo án phải đủ dùng để giáo viên cầm lên dạy thật, không viết chung chung.

Khung định hướng bắt buộc:
${curriculumGuidance}

Luật thiết kế Khởi động bắt buộc:
${startupGuidance}

Tiêu chuẩn chất lượng bắt buộc:
${qualityGuidance(input)}

${elementaryLocalityGuidance(input, ocrText)}

${learningContextGuidance(input)}

${pedagogyProfileGuidance(input)}

${creativeMode ? `Luật sáng tạo khi soạn giáo án:\n${creativeTeachingGuidance}` : ""}

Thông tin form:
- Môn học: ${input.subject}
- Lớp: ${input.grade}
- Tên bài do user nhập: ${input.lessonTitle || "Để trống - hãy tự nhận diện từ ảnh SGK/trang sách"}
- Bộ sách: ${bookContext(input)}
- Tập sách: ${input.bookVolume && input.bookVolume !== "auto" ? input.bookVolume : "Không xác định"}
- Số tiết: ${input.periods}
- Thời lượng: ${input.duration} phút/tiết
- Quê hương/địa phương của học sinh: ${localityContext(input)}
- Đối tượng học sinh: ${input.studentProfile}
- Môi trường học: ${input.teachingEnvironment}
- Cơ sở vật chất: ${facilities}
- Phong cách giáo án: ${style}
- Yêu cầu đặc biệt: ${input.specialRequest || "Không có"}
- Cho phép AI tự suy luận phần thiếu: ${input.allowAiInference ? "Có" : "Không"}

Nội dung trích xuất từ ảnh SGK user upload:
${ocrText}

Yêu cầu output:
- Chỉ trả về JSON hợp lệ, không Markdown, không giải thích.
- JSON phải khớp cấu trúc LessonPlan.
- Không tự tạo bảng, không viết các tiêu đề "Hoạt động của giáo viên" hoặc "Hoạt động của học sinh" trong nội dung text. App sẽ tự render bảng giáo án theo mẫu Công văn 2345.
- Với mỗi activity, chỉ cung cấp dữ liệu sạch: phase, title, objective, durationMinutes, teacherActions, studentActions, learningProducts. Renderer sẽ tự đặt "* Mục tiêu", "* Sản phẩm/đánh giá", "* Cách tiến hành".
- Tuyệt đối không được dùng từ "OCR" trong bất kỳ nội dung nào của giáo án trả về. Khi cần nhắc nguồn học liệu, dùng "ảnh SGK", "tranh trong SGK", "tình huống/tranh trang ..." hoặc "trang sách đã quan sát".
- Nếu trong nội dung trích xuất có số trang SGK, phải gọi đúng là "tranh/ảnh/tình huống trang ...". Nếu không thấy số trang, dùng "tranh/ảnh trong SGK"; không viết "theo OCR".
- lessonTitle phải chép đúng số bài, tên bài và dấu phân cách thể hiện trên ảnh SGK/trang sách; chỉ chuẩn hóa khoảng trắng, không tự đổi tên hoặc thêm/bỏ từ. Ví dụ ảnh ghi "Bài 9. Chăm sóc và giúp đỡ em nhỏ" thì phải giữ đúng cấu trúc đó.
- Nếu tên user nhập khác với tiêu đề đọc rõ trên ảnh SGK, ưu tiên tiêu đề trên ảnh SGK. Nếu ảnh không đủ rõ mới dùng tên user nhập hoặc suy luận theo lựa chọn của user.
- Mỗi tiết bắt buộc có đúng và đủ 4 hoạt động chính theo thứ tự: 1. Khởi động, 2. Khám phá, 3. Luyện tập, 4. Vận dụng. Không được thiếu bất kỳ phần nào, bất kể môn học hoặc số tiết.
- Nếu số tiết lớn hơn 1, bắt buộc tạo thêm "periodPlans" đủ đúng ${input.periods} tiết. Mỗi tiết trong periodPlans phải có periodNumber, focus, outcomes và activities riêng; mỗi tiết đều có đủ 4 phần Khởi động, Khám phá, Luyện tập, Vận dụng phù hợp trọng tâm tiết đó. Không chia kiểu tiết 1 chỉ Khám phá, tiết 2 chỉ Luyện tập.
- Mỗi periodPlan là một giáo án tiết hoàn chỉnh khi render: bắt đầu từ BÀI: ... (TIẾT X), sau đó có đủ I. Yêu cầu cần đạt, II. Thiết bị dạy học và học liệu, III. Tiến trình dạy học, IV. Điều chỉnh sau bài dạy.
- Khởi động của từng tiết phải khác nhau, sinh động/sáng tạo, không lặp máy móc giữa các tiết.
- Trường "activities" vẫn phải có để tương thích, nhưng khi có nhiều tiết hãy đặt activities là danh sách gộp từ toàn bộ periodPlans theo thứ tự tiết.
- Mỗi activity phải có title, objective, durationMinutes, teacherActions, studentActions, learningProducts. durationMinutes phải là số phút; tổng 4 hoạt động trong mỗi tiết xấp xỉ ${input.duration} phút.
- teacherActions và studentActions phải đi theo từng cặp tương ứng. Số bước không cố định; hãy viết vừa đủ để đạt mục tiêu của hoạt động, phù hợp môn học, độ tuổi, thời lượng, số tiết và phong cách giáo án.
- Kiểm soát độ dài theo thời lượng ${input.duration} phút/tiết: chi tiết ở đáp án/chốt/ngữ liệu cần dạy, không kéo dài số bước. Khởi động 3-5 phút chỉ 2-3 cặp GV/HS; Khám phá 15-17 phút khoảng 4-6 cặp; Luyện tập 8-10 phút khoảng 3-4 cặp; Vận dụng 3-5 phút khoảng 2-3 cặp.
- Với Vận dụng 3-5 phút, chỉ yêu cầu nêu ý tưởng, lập ý nhanh, chia sẻ 2-3 câu, cam kết hoặc giao hoàn thiện ở nhà; không bắt HS viết đoạn/bài hoàn chỉnh ngay trên lớp nếu không bố trí 8-10 phút.
- Đáp án dự kiến, dữ liệu địa phương, lỗi sai thường gặp và lời chốt phải viết ngắn gọn trong đúng cặp GV/HS liên quan; không tách thành nhiều dòng phụ làm giáo án phình dài.
- Bắt buộc mọi phần tử teacherActions phải bắt đầu bằng "GV ..." và mọi phần tử studentActions phải bắt đầu bằng "HS ...". Không viết câu cụt như "Phân tích...", "Đọc...", "Hướng dẫn..."; không dùng "Giáo viên"/"Học sinh" thay cho GV/HS ở đầu dòng.
- teacherActions[i] và studentActions[i] phải là một cặp dạy - học ăn khớp trực tiếp: GV giao nhiệm vụ nào thì HS thực hiện đúng nhiệm vụ đó; GV hỏi gì thì HS trả lời/thảo luận đúng câu hỏi đó; GV hướng dẫn thao tác nào thì HS thao tác tương ứng; GV chốt gì thì HS ghi nhớ/nhắc lại/vận dụng nội dung đó.
- Không để cột HS chỉ ghi "HS lắng nghe/quan sát" khi cột GV đang giao bài, yêu cầu tìm/viết/tính/thảo luận hoặc đặt câu hỏi. HS phải có hành động học tập, sản phẩm hoặc phản hồi dự kiến rõ.
- Không dùng câu máy móc "HS thực hiện nhiệm vụ tương ứng..." hoặc "HS phản hồi theo hướng dẫn..." nếu không nói rõ nhiệm vụ. Với dòng GV chốt/chuyển ý/giới thiệu hoạt động tiếp theo, cột HS chỉ cần: "HS lắng nghe, ghi nhớ và sẵn sàng chuyển sang hoạt động tiếp theo" hoặc biến thể tự nhiên phù hợp.
- Khởi động thường ngắn gọn; Khám phá thường cần nhiều bước hơn để hình thành kiến thức; Luyện tập/Vận dụng cần đủ bước để giao nhiệm vụ, hỗ trợ, kiểm tra và chốt sản phẩm.
- Mỗi activity phải viết thành kịch bản dạy học sâu: có tình huống mở, cách tổ chức từng bước, kỹ thuật dạy học cụ thể, câu hỏi gợi mở, dự kiến phản hồi HS, xử lý sai lệch, lời chốt GV và sản phẩm học tập.
- teacherActions phải có câu chữ đủ cụ thể để giáo viên dùng được trên lớp: lời dẫn, câu hỏi, hướng dẫn thao tác, phân hóa/hỗ trợ, nhận xét và chuyển ý.
- studentActions must have a real response: HS quan sát/suy nghĩ/trao đổi/trả lời đúng-sai thường gặp/tạo sản phẩm/nhận xét bạn/tự đánh giá.
- Phần Khởi động bắt buộc là hoạt động toàn lớp trong 3-5 phút, có tên hấp dẫn, luật chơi/cách tổ chức rõ, câu hỏi dẫn dắt, dự kiến phản hồi HS và lời chốt chuyển vào bài; phải đúng mục tiêu bài và sinh động, không vui rời rạc.
- teacherActions phải cụ thể theo trình tự dạy học: lời dẫn của GV, tình huống/câu hỏi gợi mở, giao nhiệm vụ, tổ chức cá nhân/nhóm, dự kiến phản hồi của HS, chốt kiến thức, chuyển ý.
- studentActions phải tương ứng từng bước: quan sát/đọc/nghe, suy nghĩ cá nhân, trao đổi cặp/nhóm, trả lời dự kiến, nhận xét bạn, ghi nhớ/chốt vào vở, tạo sản phẩm.
- Phần Khám phá/hình thành kiến thức bắt buộc phải hấp dẫn: có tình huống có vấn đề gần đời sống hoặc trò chơi/quan sát tranh/đọc ngữ liệu, ít nhất 4 câu hỏi gợi mở, dự kiến câu trả lời đúng/sai thường gặp và lời chốt kiến thức của GV.
- ${creativeMode ? "- Với phong cách Sáng tạo, sinh động, mỗi tiết phải có ít nhất 2 kỹ thuật/học liệu sáng tạo khác nhau, không lặp công thức giữa các tiết." : "- Ưu tiên tính thực tế, dễ dạy; không cần thêm học liệu cầu kỳ nếu không phù hợp bối cảnh."}
- Phần Luyện tập/thực hành phải có bài tập/nhiệm vụ cụ thể theo mục tiêu bài, có cách kiểm tra nhanh, không nói chung chung kiểu "HS làm bài tập".
- Phần Vận dụng phải gắn với đời sống gia đình, lớp học, địa phương hoặc trải nghiệm cá nhân của học sinh.
- Nếu user chọn quê hương/tỉnh, phần Vận dụng và contextFit.notes phải thể hiện cách gắn với địa phương đó hoặc gợi ý mở để giáo viên điền ví dụ thật; tuyệt đối không đưa ví dụ lệch tỉnh/thành phố.
- Với bài học có nội dung "địa phương em/quê hương em/tỉnh em", phải có nhiệm vụ học tập hoặc phiếu học tập cụ thể, sản phẩm rõ và tiêu chí đánh giá sản phẩm; không chỉ ghi chung chung "tìm hiểu địa phương".
- Với bài địa phương nhiều tiết, mục tiêu từng tiết phải khác nhau và gọn: không bê nguyên yêu cầu cần đạt, thiết bị, phẩm chất giống nhau giữa các tiết.
- Với mọi bài nhiều tiết, Yêu cầu cần đạt và trọng tâm từng tiết phải khác nhau rõ ràng; không dùng một bộ mục tiêu chung lặp y nguyên cho các tiết.
- Yêu cầu cần đạt phải gọn, đúng trọng tâm, không lặp câu máy móc. Mỗi nhóm outcomes nên viết ít ý nhưng sắc: kiến thức/kĩ năng, năng lực, phẩm chất đều gắn hành vi quan sát được trong bài.
- learningProducts phải nêu sản phẩm quan sát được cho từng hoạt động: câu trả lời, phiếu học tập, bảng nhóm, đoạn viết, bài giải, tranh/sơ đồ, cam kết/hành động. Không được để rỗng.
- outcomes phải gắn với bài học cụ thể và dùng đúng hệ phẩm chất/năng lực CTGDPT 2018; không liệt kê quá rộng. Không được viết sơ sài kiểu "- Tự chủ và tự học"; phải viết thành hành vi quan sát được trong bài.
- Phần phẩm chất không được chỉ liệt kê từ khóa như "Nhân ái", "Trách nhiệm". Mỗi phẩm chất phải viết thành một câu/nhiều ý cụ thể gắn với hành vi trong bài học, ví dụ: "Biết quan tâm, lắng nghe và chủ động giúp đỡ em nhỏ bằng lời nói, việc làm phù hợp trong gia đình và ở lớp".
- materials phải phù hợp với cơ sở vật chất, môi trường học và vùng miền user chọn. Nếu vùng núi/điểm trường lẻ/không có thiết bị trình chiếu, ưu tiên tranh in, thẻ màu, vật thật, phiếu học tập đơn giản; không mặc định slide/video/máy chiếu. Nếu có TV/máy chiếu/wifi, có thể dùng slide/video ngắn nhưng vẫn cần phương án thay thế.
- assessment phải có tiêu chí quan sát được, minh chứng cụ thể và nhận xét/hỗ trợ học sinh.
- Với mọi môn có bài tập, câu hỏi, thực hành hoặc sản phẩm học tập, phải nêu đáp án dự kiến/cách làm/chốt kiến thức/tiêu chí đánh giá tương ứng ngay trong teacherActions, studentActions hoặc learningProducts; không chỉ ghi "HS làm bài" hay "GV nhận xét".
- Có năng lực số ở mức phù hợp, không gượng ép.
- Nếu thiếu thông tin trường/người dạy/ngày dạy thì không đưa vào JSON; preview sẽ để dòng chấm.
- Tuyệt đối tránh giáo án sơ sài, rỗng ý, lặp câu, hoặc chỉ ghi tên hoạt động mà không có cách tổ chức.
- ${creativeMode ? "- Bắt buộc có ít nhất một điểm sáng tạo nổi bật trong bài học và ghi rõ cách giáo viên triển khai điểm sáng tạo đó." : ""}

Schema JSON cần trả:
{
  "generalInfo": { "subject": string, "grade": string, "lessonTitle": string, "book": string, "periods": number, "duration": number },
  "outcomes": { "generalCompetencies": string[], "specificCompetencies": string[], "qualities": string[], "knowledgeAndSkills": string[] },
  "materials": { "teacher": string[], "students": string[] },
  "activities": [{ "phase": string, "title": string, "objective": string, "durationMinutes": number, "teacherActions": string[], "studentActions": string[], "learningProducts": string[] }],
  "periodPlans": [{ "periodNumber": number, "focus": string, "outcomes": { "generalCompetencies": string[], "specificCompetencies": string[], "qualities": string[], "knowledgeAndSkills": string[] }, "activities": [{ "phase": string, "title": string, "objective": string, "durationMinutes": number, "teacherActions": string[], "studentActions": string[], "learningProducts": string[] }] }],
  "assessment": { "criteria": string[], "evidence": string[], "comments": string[] },
  "adjustments": { "suitablePoints": string[], "pointsToAdjust": string[], "nextLessonDirection": string[] },
  "contextFit": { "notes": string[] },
  "meta": { "style": string, "modelUsed": string, "createdAt": string }
}`;
}

function buildDefaultRepairPrompt(lesson: LessonPlan, input: LessonInput, ocrText: string, subjectPedagogyRepairGuidanceStr: string): string {
  const style = input.style || "Dạy thật trên lớp";
  const creativeMode = style === "Sáng tạo, sinh động";

  return `LessonPlan sau vẫn còn sơ sài hoac chua dat phong cach ${style}. Hay sua lai nhung giu dung JSON schema.

Khung định hướng CTGDPT 2018:
${curriculumGuidance}

Luật thiết kế Khởi động:
${startupGuidance}

Tiêu chuẩn chất lượng bắt buộc:
${qualityGuidance(input)}

${elementaryLocalityGuidance(input, ocrText)}

${learningContextGuidance(input)}

${pedagogyProfileGuidance(input)}

${creativeMode ? `Luật sáng tạo khi sửa giáo án:\n${creativeTeachingGuidance}` : ""}

Bắt buộc sửa:
Các lỗi sư phạm theo môn đang phát hiện được:
${subjectPedagogyRepairGuidanceStr}

- Làm lại phần Khởi động thành hoạt động toàn lớp 3-5 phút, có hứng thú và bám bài: hát/trò chơi/câu đố/quan sát/tình huống/thử thách phù hợp môn học; chỉ gọi STEM-STEAM khi hoạt động thật sự đúng bản chất; có luật chơi, câu hỏi dẫn dắt, dự kiến phản hồi và lời chốt chuyển bài.
- Làm phần Khám phá/hình thành kiến thức sinh động, có tình huống có vấn đề, câu hỏi gợi mở, dự kiến câu trả lời và lời chốt kiến thức.
- Mỗi tiết bắt buộc có đủ 4 phần theo thứ tự: Khởi động, Khám phá, Luyện tập, Vận dụng. Bất kể 1 tiết hay nhiều tiết, mỗi tiết đều đủ 4 phần này.
- Mỗi hoạt động phải có durationMinutes; tổng thời lượng 4 hoạt động trong mỗi tiết xấp xỉ ${input.duration} phút.
- teacherActions và studentActions phải đi theo từng cặp tương ứng, nhưng không cố định số cặp. Viết số bước vừa đủ để đạt mục tiêu bài học, phù hợp môn học, độ tuổi, số tiết, thời lượng và phong cách ${style}.
- Nếu hoạt động đang quá dài, hãy gộp/rút số cặp GV/HS theo nhịp thời gian: Khởi động 3-5 phút 2-3 cặp; Khám phá 15-17 phút 4-6 cặp; Luyện tập 8-10 phút 3-4 cặp; Vận dụng 3-5 phút 2-3 cặp. Giữ đáp án/chốt ngắn trong từng cặp, không thêm dòng phụ.
- Với Vận dụng chỉ 3-5 phút, sửa yêu cầu thành lập ý nhanh/chia sẻ miệng/viết nháp 2-3 câu/giao hoàn thiện ở nhà; chỉ yêu cầu viết đoạn hoàn chỉnh nếu durationMinutes từ 8 phút trở lên.
- Bắt buộc mọi teacherActions bắt đầu bằng "GV ..." và mọi studentActions bắt đầu bằng "HS ..."; không để câu cụt kiểu "Phân tích...", "Đọc...", "Hướng dẫn...".
- Sửa từng cặp cùng index cho ăn khớp: GV giao nhiệm vụ/câu hỏi/thao tác/chốt kiến thức nào thì HS thực hiện/trả lời/thao tác/ghi nhớ đúng nội dung đó. Không để GV một đằng, HS một nẻo.
- Nếu GV yêu cầu tìm, viết, tính, thảo luận, trình bày, đóng vai hoặc hoàn thành phiếu thì HS phải có hành động tương ứng và sản phẩm/đáp án dự kiến; không được chỉ ghi "HS lắng nghe" hoặc "HS quan sát" chung chung.
- Xóa và thay mọi câu máy móc như "HS thực hiện nhiệm vụ tương ứng..." hoặc "HS phản hồi theo hướng dẫn..." nếu không nêu rõ nhiệm vụ. Nếu GV đang chốt/chuyển sang hoạt động mới, HS phải là "HS lắng nghe, ghi nhớ và sẵn sàng chuyển sang hoạt động tiếp theo" hoặc câu tương đương tự nhiên.
- Với Khám phá, thường cần nhiều bước hơn Khởi động/Luyện tập/Vận dụng để học sinh quan sát, nêu dự đoán, trao đổi, hình thành kiến thức và chốt bài. Với môn/tiết đơn giản, không kéo dài máy móc.
- Mỗi hoạt động phải có kỹ thuật dạy học hoặc học liệu cụ thể ở mức phù hợp. Với phong cách Sáng tạo, sinh động, ưu tiên thêm điểm nhấn hấp dẫn nhưng không làm loãng mục tiêu.
- Viet lai teacherActions/studentActions thanh kich ban day hoc that: GV noi gi, hoi gi, chieu/phat/lam mau/giao viec gi; HS du kien thuc hien gi, tra loi dung/sai ra sao, san pham nao; GV xu ly sai lech va chot kien thuc the nao.
- Tuyet doi xoa tu "OCR" khoi giao an. Neu dang viet "tranh/SGK/OCR" hay "theo OCR", doi thanh "tranh trong SGK", "anh SGK", "tinh huong trang ..." neu nhan dien duoc so trang.
- Neu ten bai thieu so bai nhung anh SGK co so bai, bo sung vao lessonTitle theo dang "Bai X. Ten bai".
- Viet lai phan Pham chat thanh cac cau cu the gan hanh vi hoc sinh trong bai, khong chi liet ke ten pham chat.
- Dieu chinh materials theo dung co so vat chat, moi truong hoc, vung mien cua user; khong mac dinh thiet bi hien dai neu user chon vung nui/diem truong le/khong co trinh chieu.
- Nếu số tiết lớn hơn 1, phải sửa thành đủ periodPlans theo đúng số tiết; mỗi tiết có đầy đủ Khởi động, Khám phá, Luyện tập, Vận dụng riêng, trọng tâm không lặp y nguyên.
- Với bài nhiều tiết, mỗi periodPlan phải có outcomes riêng gồm kiến thức/kĩ năng, năng lực chung, năng lực đặc thù và phẩm chất phù hợp đúng trọng tâm tiết đó; không lặp nguyên outcomes chung.
- Mỗi periodPlan sẽ được render như một tiết riêng biệt trên bản in giáo án; cần đảm bảo format và trường dữ liệu nhất quán với periodPlan schema.`;
}



export function digitalCompetencyInstruction(input: LessonInput) {
  if (!input.enableDigitalCompetency) return "";
  return `\nTÍCH HỢP NĂNG LỰC SỐ (Theo Thông tư 02/2025/TT-BGDĐT Bậc 1 - Tiểu học):
Vì người dùng bật tùy chọn tích hợp Năng lực số, bạn bắt buộc phải chọn 1-2 năng lực số Bậc 1 phù hợp nhất từ Khung năng lực số người học cấp Tiểu học dưới đây để đưa vào mảng "digitalCompetencies" trong "outcomes". Không tự tạo mã mới và không trả về mảng rỗng.
Các năng lực số Bậc 1 có thể chọn:
- 1.1. Duyệt, tìm kiếm và lọc: Nhận biết nhu cầu, tìm kiếm và truy cập dữ liệu/nội dung số đơn giản dưới sự hướng dẫn.
- 1.2. Đánh giá: Phát hiện độ tin cậy và chính xác của nguồn dữ liệu ở mức cơ bản dưới sự hướng dẫn.
- 1.3. Quản lý: Tổ chức, lưu trữ và truy xuất dữ liệu đơn giản dưới sự hướng dẫn.
- 2.1. Tương tác: Lựa chọn công nghệ số đơn giản để tương tác dưới sự hướng dẫn.
- 2.2. Chia sẻ: Nhận biết công nghệ số đơn giản để chia sẻ; biết tham chiếu, ghi chú nguồn cơ bản dưới sự hướng dẫn.
- 2.3. Trách nhiệm công dân số: Biết sử dụng công nghệ số để tham gia dịch vụ công cộng đơn giản.
- 2.4. Hợp tác: Chọn công cụ số đơn giản để hợp tác, làm việc nhóm trực tuyến dưới sự hướng dẫn.
- 2.5. Nghi thức số: Phân biệt chuẩn mực hành vi ứng xử đơn giản và an toàn trong môi trường số.
- 2.6. Quản lý danh tính số: Xác định danh tính số bản thân; biết bảo vệ danh tiếng trực tuyến đơn giản của mình.
- 3.1. Phát triển nội dung số: Tạo và chỉnh sửa nội dung/phương tiện số đơn giản ở các định dạng cơ bản dưới sự hướng dẫn.
- 3.2. Tích hợp và tái tạo: Sửa đổi, tích hợp đơn giản nội dung số có sẵn thành nội dung mới.
- 3.3. Bản quyền/Giấy phép: Xác định quy tắc đơn giản về bản quyền và giấy phép áp dụng cho dữ liệu/nội dung số.
- 3.4. Lập trình: Liệt kê câu lệnh đơn giản để máy tính giải quyết vấn đề đơn giản.
- 4.1. Bảo vệ thiết bị: Nhận biết cách bảo vệ thiết bị/nội dung số; nhận diện rủi ro/đe dọa đơn giản trong môi trường số.
- 4.2. Bảo vệ dữ liệu cá nhân: Biết lựa chọn cách bảo vệ dữ liệu/quyền riêng tư và chia sẻ thông tin cá nhân an toàn.
- 4.3. Bảo vệ sức khỏe: Tránh rủi ro/đe dọa đến thể chất, tinh thần khi dùng công nghệ; phòng chống bắt nạt trên mạng.
- 4.4. Bảo vệ môi trường: Nhận biết tác động cơ bản của công nghệ số đối với môi trường.
- 5.1. Vấn đề kỹ thuật: Xác định vấn đề kỹ thuật đơn giản khi vận hành thiết bị; tìm giải pháp đơn giản dưới sự hướng dẫn.
- 5.2. Nhu cầu/Giải pháp: Xác định nhu cầu công cụ số và giải pháp công nghệ đơn giản dưới sự hướng dẫn.
- 5.3. Sử dụng sáng tạo: Dùng công cụ số đơn giản để tạo tri thức, đổi mới quy trình/sản phẩm, giải quyết vấn đề.
- 5.4. Cải thiện năng lực số: Nhận ra phần năng lực số của bản thân cần cải thiện dưới sự hướng dẫn.
- 6.1. Hiểu biết về AI: Xác định khái niệm AI cơ bản; nhớ các ứng dụng AI đơn giản trong đời sống.
- 6.2. Sử dụng AI: Nhận diện công cụ AI đơn giản; thực hiện thao tác cơ bản để dùng công cụ AI dưới sự hướng dẫn.
- 6.3. Đánh giá AI: Nhận diện yếu tố cơ bản của hệ thống AI cần đánh giá dưới sự hướng dẫn.

Mỗi năng lực số lựa chọn phải được viết cụ thể gắn với hoạt động của bài học. Học sinh phải trực tiếp thao tác với thiết bị, phần mềm, học liệu số hoặc tạo/chia sẻ sản phẩm số; đồng thời teacherActions/studentActions, học liệu hoặc sản phẩm học tập phải thể hiện thao tác tương ứng. Việc GV trình chiếu ảnh, GV mở video, GV dùng máy chiếu hoặc HS chỉ quan sát màn chiếu không đủ căn cứ. Định dạng chuỗi trong mảng: "Năng lực số ([Mã năng lực]): [Yêu cầu cụ thể]". Ví dụ: "Năng lực số (4.1): Nhận biết cách tắt máy tính đúng cách để bảo vệ thiết bị khỏi bị hỏng hóc."`;
}

export function buildMathBlueprintPrompt(input: LessonInput, ocrText: string) {
  const style = input.style || "Dạy thật trên lớp";
  const facilities = input.facilities === "auto" ? "AI tự chọn theo bối cảnh" : input.facilities.join(", ");
  return `Bạn là chuyên gia thiết kế bài học môn Toán tiểu học. Hãy tạo "bản đồ bài học" trước khi soạn giáo án chi tiết.

Mục tiêu của bước này:
- Chỉ phân tích và khóa logic bài Toán; chưa viết giáo án đầy đủ.
- Bản đồ này sẽ được dùng cho các request sau để sinh từng tiết/từng hoạt động, nên phải đủ rõ để giữ mạch liền nhau.
- Phải giảm rủi ro timeout: output ngắn, có cấu trúc, không lan man.

Khung định hướng:
${curriculumGuidance}
${digitalCompetencyInstruction(input)}

Logic sư phạm môn Toán:
${pedagogyProfileGuidance(input)}

${mathTranscribeGuidance}

${mathGradeBandGuidance(input)}

Quy tắc cá nhân hóa:
${elementaryLocalityGuidance(input, ocrText)}

${learningContextGuidance(input)}

Thông tin form:
- Môn học: ${input.subject}
- Lớp: ${input.grade}
- Tên bài user nhập: ${input.lessonTitle || "Để trống - tự nhận diện từ ảnh SGK"}
- Bộ sách: ${bookContext(input)}
- Tập sách: ${input.bookVolume && input.bookVolume !== "auto" ? input.bookVolume : "Không xác định"}
- Số tiết: ${input.periods}
- Thời lượng: ${input.duration} phút/tiết
- Quê hương/địa phương của học sinh: ${localityContext(input)}
- Đối tượng học sinh: ${input.studentProfile}
- Môi trường học: ${input.teachingEnvironment}
- Cơ sở vật chất: ${facilities}
- Phong cách giáo án: ${style}
- Yêu cầu đặc biệt: ${input.specialRequest || "Không có"}
- Cho phép AI tự suy luận phần thiếu: ${input.allowAiInference ? "Có" : "Không"}

Nội dung trích xuất từ ảnh SGK user upload:
${promptOcrContext(ocrText)}

Yêu cầu blueprint:
- Nhận diện và chép đúng số bài, tên bài, dấu phân cách từ ảnh SGK vào lessonTitle; chỉ chuẩn hóa khoảng trắng. Nếu tên user nhập khác tiêu đề đọc rõ trên ảnh, ưu tiên ảnh SGK.
- Chỉ trả JSON hợp lệ, không Markdown.
- Không dùng từ "OCR"; dùng "ảnh SGK", "tranh trong SGK" hoặc "trang sách".
- periodPlans phải đủ đúng ${input.periods} tiết; mỗi tiết có 4 pha theo thứ tự: Khởi động, Khám phá, Luyện tập, Vận dụng.
- Mỗi tiết có trọng tâm riêng, không lặp nguyên mục tiêu.
- Mỗi pha cần có handoffToNext để request sau nối mạch.
- mathCore phải nêu rõ dạng toán, kiến thức trọng tâm, biểu diễn/tóm tắt, lỗi sai thường gặp và cách kiểm tra ngược.
- Nội dung toán cụ thể từ ảnh SGK (phép tính, bài toán, công thức, hình) phải được ghi nhận vào mathCore.knowledgeFocus và periods[].activities[].mathFocus để các bước sau viết rõ vào giáo án.
- Lập continuityPlan trước khi chia hoạt động: mỗi ví dụ, bài tập, bài toán có lời văn, hình/bảng/sơ đồ và quy tắc trọng tâm là một sourceUnit có unitId ổn định.
- Gom các sourceUnit phụ thuộc nhau thành cluster không được cắt ngang; ví dụ đề bài - phân tích - phép tính/lời giải - kiểm tra kết quả phải cùng cluster.
- Mỗi sourceUnit bắt buộc chỉ thuộc một cluster, trừ khi allowReuse=true. Mỗi cluster phải gán vào đúng một periodNumber trong ${input.periods} tiết.
- periods[].activities phải khai báo sourceUnitIds và sourceClusterIds tương ứng; không dùng cùng cluster để lấp nội dung cho nhiều tiết.

Schema JSON cần trả:
{
  "lessonTitle": string,
  "lessonOverview": string,
  "mathCore": {
    "problemType": string,
    "knowledgeFocus": string[],
    "representations": string[],
    "commonMisconceptions": string[],
    "checkStrategies": string[],
    "continuityRules": string[]
  },
  "outcomes": ${input.enableDigitalCompetency ? `{ "generalCompetencies": string[], "specificCompetencies": string[], "qualities": string[], "knowledgeAndSkills": string[], "digitalCompetencies": string[], "objectiveMetadata": [{ "id": string, "category": string, "statement": string, "evidence": { "activityIds": string[], "learningProducts": string[], "successCriteria": string[] } }] }` : `{ "generalCompetencies": string[], "specificCompetencies": string[], "qualities": string[], "knowledgeAndSkills": string[], "objectiveMetadata": [{ "id": string, "category": string, "statement": string, "evidence": { "activityIds": string[], "learningProducts": string[], "successCriteria": string[] } }] }`},
  "materials": { "teacher": string[], "students": string[] },
  "assessment": { "criteria": string[], "evidence": string[], "comments": string[] },
  "contextFit": { "notes": string[] },
  "continuityPlan": {
    "sourceUnits": [{ "unitId": string, "label": string, "kind": string, "page": string, "required": boolean, "allowReuse": boolean, "preferredPeriodNumber": number, "estimatedMinutes": number, "sourceEvidence": string[] }],
    "clusters": [{ "clusterId": string, "label": string, "sourceUnitIds": string[], "periodNumber": number, "mustStayTogether": boolean, "prerequisiteClusterIds": string[], "estimatedMinutes": number, "expectedProduct": string }],
    "warnings": string[]
  },
  "periods": [{
    "periodNumber": number,
    "focus": string,
    "objectives": string[],
    "prerequisite": string,
    "targetKnowledge": string,
    "continuityIn": string,
    "continuityOut": string,
    "activities": [{ "phase": string, "title": string, "objective": string, "durationMinutes": number, "mathFocus": string, "handoffToNext": string, "sourceUnitIds": string[], "sourceClusterIds": string[] }]
  }]
}`;
}

export function buildMathPeriodPrompt(
  input: LessonInput,
  ocrText: string,
  blueprint: MathLessonBlueprint,
  period: MathPeriodBlueprint,
  previousHandoff: MathPeriodChunk["handoff"] | null,
) {
  const style = input.style || "Dạy thật trên lớp";
  const creativeMode = style === "Sáng tạo, sinh động";
  return `Bạn là chuyên gia soạn giáo án Toán tiểu học. Hãy sinh riêng một tiết theo blueprint đã khóa.

Quy tắc quan trọng:
- Chỉ trả JSON hợp lệ cho một PeriodPlan, không Markdown, không giải thích.
- Không tự nghĩ lại mục tiêu bài từ đầu; phải bám blueprint.
- Phải giữ mạch từ previousHandoff/continuityIn sang continuityOut.
- Chỉ sử dụng sourceUnitIds/sourceClusterIds đã gán cho tiết trong blueprint; không kéo source unit của tiết khác sang.
- Mọi source unit bắt buộc của tiết phải xuất hiện trong ít nhất một activity và cluster mustStayTogether không được chia sang tiết khác.
- Không dùng từ "OCR"; dùng "ảnh SGK", "tranh trong SGK" hoặc "trang sách".
- Mỗi tiết có đúng 4 hoạt động theo thứ tự: Khởi động, Khám phá, Luyện tập, Vận dụng.
- teacherActions và studentActions phải đi theo từng cặp tương ứng; mọi teacherActions bắt đầu bằng "GV ...", mọi studentActions bắt đầu bằng "HS ...".
- Kiểm soát độ dài theo 35 phút: Khởi động 2-3 cặp, Khám phá 4-6 cặp, Luyện tập 3-4 cặp, Vận dụng 2-3 cặp.
- Với Toán, mỗi tiết phải có: biểu diễn/tóm tắt trực quan, phân tích dữ kiện/yêu cầu/quan hệ, lý do chọn phép tính hoặc quy trình, lỗi sai thường gặp, kiểm tra/đối chiếu kết quả và đơn vị nếu có.
- Khởi động không được lộ đáp án bài chính; chỉ ôn kiến thức nền hoặc tạo tình huống dẫn vào.
- Khám phá phải đi từ tình huống/tranh/bài toán đến mô hình hóa, thao tác/biểu diễn, câu hỏi gợi mở, dự kiến đúng/sai và lời chốt.
- Luyện tập phải có nhiệm vụ/bài tập cụ thể, đáp án/cách làm dự kiến và cách hỗ trợ học sinh yếu.
- Vận dụng 3-5 phút chỉ yêu cầu nêu cách làm, đặt đề nhanh, giải một bước trọng tâm hoặc giao hoàn thiện ở nhà.
${creativeMode ? "- Có ít nhất một điểm nhấn sáng tạo vừa sức, nhưng không làm loãng logic toán." : "- Ưu tiên thực tế, dễ dạy, không thêm hoạt động cầu kỳ nếu không cần."}

Quy tắc ghi nội dung và công thức Toán:
${mathTranscribeGuidance}

Khung CTGDPT 2018:
${curriculumGuidance}
${digitalCompetencyInstruction(input)}

Luật Khởi động:
${startupGuidance}

Tiêu chuẩn chất lượng:
${qualityGuidance(input)}

Logic sư phạm Toán:
${pedagogyProfileGuidance(input)}

Blueprint toàn bài đã khóa:
${JSON.stringify(blueprint)}

Tiết cần sinh:
${JSON.stringify(period)}

Kết quả bàn giao từ tiết/hoạt động trước:
${previousHandoff ? JSON.stringify(previousHandoff) : period.continuityIn || "Đây là tiết mở đầu, cần dẫn từ trải nghiệm và kiến thức nền của học sinh."}

Nội dung ảnh SGK để đối chiếu khi cần:
${promptOcrContext(ocrText, 10000)}

Schema JSON cần trả:
{
  "periodNumber": number,
  "focus": string,
  "outcomes": ${input.enableDigitalCompetency ? `{ "generalCompetencies": string[], "specificCompetencies": string[], "qualities": string[], "knowledgeAndSkills": string[], "digitalCompetencies": string[] }` : `{ "generalCompetencies": string[], "specificCompetencies": string[], "qualities": string[], "knowledgeAndSkills": string[] }`},
  "activities": [{ "phase": string, "title": string, "objective": string, "durationMinutes": number, "teacherActions": string[], "studentActions": string[], "learningProducts": string[], "sourceUnitIds": string[], "sourceClusterIds": string[] }],
  "handoff": { "learned": string, "unresolvedRisks": string[], "nextBridge": string }
}`;
}

export function buildMathPeriodRepairPrompt(input: LessonInput, blueprint: MathLessonBlueprint, period: MathPeriodChunk, issues: string[]) {
  return `PeriodPlan môn Toán sau chưa đạt. Hãy sửa riêng tiết này, không viết lại toàn bộ bài.

Chỉ trả JSON hợp lệ theo schema PeriodPlan + handoff. Không Markdown.

Blueprint toàn bài:
${JSON.stringify(blueprint)}

Các lỗi cần sửa:
${issues.map((issue) => `- ${issue}`).join("\n")}

Yêu cầu sửa:
- Giữ periodNumber và focus.
- Giữ nguyên sourceUnitIds/sourceClusterIds của blueprint; lỗi continuity phải sửa bằng cách gắn đúng ID vào activity, không đổi cluster sang tiết khác.
- Có đúng 4 hoạt động: Khởi động, Khám phá, Luyện tập, Vận dụng.
- teacherActions/studentActions đi theo từng cặp, bắt đầu bằng "GV ..." và "HS ...".
- Thêm rõ biểu diễn/tóm tắt, dữ kiện-yêu cầu-quan hệ, phép tính/quy trình, lỗi sai thường gặp và kiểm tra kết quả.
- Rút số bước nếu quá dài: Khởi động 2-3 cặp, Khám phá 4-6 cặp, Luyện tập 3-4 cặp, Vận dụng 2-3 cặp.
- Không dùng từ "OCR".
- Sửa toàn bộ lỗi LaTeX được liệt kê, giữ nguyên ý nghĩa toán học và đáp án đúng.
${mathLatexPolicy}
- Cá nhân hóa theo bối cảnh: ${JSON.stringify({ grade: input.grade, environment: input.teachingEnvironment, facilities: input.facilities, locality: localityContext(input), style: input.style })}
${digitalCompetencyInstruction(input)}

PeriodPlan cần sửa:
${JSON.stringify(period)}

Schema JSON:
{
  "periodNumber": number,
  "focus": string,
  "outcomes": ${input.enableDigitalCompetency ? `{ "generalCompetencies": string[], "specificCompetencies": string[], "qualities": string[], "knowledgeAndSkills": string[], "digitalCompetencies": string[] }` : `{ "generalCompetencies": string[], "specificCompetencies": string[], "qualities": string[], "knowledgeAndSkills": string[] }`},
  "activities": [{ "phase": string, "title": string, "objective": string, "durationMinutes": number, "teacherActions": string[], "studentActions": string[], "learningProducts": string[], "sourceUnitIds": string[], "sourceClusterIds": string[] }],
  "handoff": { "learned": string, "unresolvedRisks": string[], "nextBridge": string }
}`;
}

function promptOcrContext(ocrText: string, maxLength = 15000) {
  const text = (ocrText || "").trim();
  if (text.length <= maxLength) return text;
  const headLength = Math.floor(maxLength * 0.68);
  const tailLength = maxLength - headLength;
  return `${text.slice(0, headLength)}

...[Đã rút gọn phần giữa của nội dung ảnh SGK để giảm timeout; giữ phần đầu và phần cuối để đối chiếu mạch bài]...

${text.slice(-tailLength)}`;
}

// ─── NATURAL & SOCIAL STUDIES-SPECIFIC PROMPTS ───

export function naturalSocialLessonTypeGuidance(classification: NaturalSocialClassification): string {
  const profile = getNaturalSocialPedagogyProfile(classification);
  return `Chủ đề TNXH đã nhận diện: ${profile.label} (confidence: ${classification.confidence}).
${classification.topicFocus ? `Trọng tâm hẹp đã khóa: ${classification.topicFocus}.` : ""}
Bằng chứng: ${classification.evidence.join("; ")}.
${classification.uncertainties.length ? `Lưu ý: ${classification.uncertainties.join("; ")}` : ""}

Chuỗi dạy học bắt buộc:
${profile.inquirySequence.map((step, index) => `${index + 1}. ${step}`).join("\n")}

Đối tượng quan sát nên dùng:
${profile.observationTargets.map((item) => `- ${item}`).join("\n")}

Sản phẩm học tập mong đợi:
${profile.learningProducts.map((item) => `- ${item}`).join("\n")}

Ngộ nhận/lỗi học sinh dễ mắc:
${profile.commonMisconceptions.map((item) => `- ${item}`).join("\n")}

Tiêu chí đánh giá:
${profile.assessmentCriteria.map((item) => `- ${item}`).join("\n")}

Vận dụng đúng bản chất môn:
${profile.applicationMoves.map((item) => `- ${item}`).join("\n")}`;
}

export const naturalSocialStrictGuidance = `QUY TẮC BẮT BUỘC KHI SOẠN GIÁO ÁN TỰ NHIÊN VÀ XÃ HỘI:
1. Phạm vi chính là lớp 1-3; hoạt động phải vừa sức, dựa vào quan sát, mô tả, so sánh/phân loại và hành động thực tế.
2. Không kết luận trước khi học sinh quan sát. Mỗi tiết phải có đối tượng quan sát cụ thể: tranh SGK, vật thật an toàn, mô hình, lớp học, sân trường, gia đình hoặc môi trường gần gũi.
3. Khám phá phải có câu hỏi/vấn đề rõ: con thấy gì, đặc điểm nào, giống/khác gì, phân loại theo tiêu chí nào, vì sao cần làm việc đó.
4. Phải có bằng chứng học tập quan sát được, nhưng chọn hình thức đúng tuổi và đúng nhiệm vụ: lời nói, chỉ/chọn thẻ, thao tác, tranh vẽ, phiếu rất ngắn hoặc sản phẩm SGK yêu cầu. Không mặc định mọi bài đều cần bảng hai cột hay cam kết.
5. Vận dụng phải gắn trực tiếp với yêu cầu cần đạt và nhiệm vụ vừa học. Không tự chèn việc nhà, an toàn, vệ sinh, cam kết hoặc nội dung của bài khác chỉ vì cùng chủ đề gia đình/trường học.
6. Không bịa số liệu, địa danh, lễ hội, nghề truyền thống, đặc sản hoặc đặc điểm địa phương nếu ảnh SGK/form không cung cấp. Khi thiếu dữ liệu, viết dạng mở để GV thay bằng ví dụ thật.
7. An toàn là bắt buộc: không cho HS nếm/ngửi/chạm vật lạ, dùng lửa/hóa chất/dao sắc, leo trèo, bắt côn trùng hoặc ra đường một mình. Nếu cần minh họa rủi ro, dùng tranh, mô hình hoặc GV làm mẫu an toàn.
8. Học liệu phải phù hợp cơ sở vật chất. Nếu không có thiết bị số, dùng tranh in, thẻ, vật thật an toàn, bảng phụ, phiếu ngắn.
9. Mỗi hoạt động có đúng một sản phẩm chính, 1-2 tiêu chí thành công ngắn, lỗi/ngộ nhận thường gặp và cách GV gợi mở sửa sai.
10. Không biến TNXH thành môn học thuộc định nghĩa hoặc bài giảng một chiều.
11. Phân biệt bốn tầng nội dung: yêu cầu cần đạt chương trình; nhiệm vụ SGK; chi tiết nhân vật/tranh; nội dung mở rộng. Tên nhân vật, địa chỉ giả định và chi tiết riêng của tranh chỉ là ngữ liệu, không được nâng thành yêu cầu cần đạt.
12. Với địa chỉ nhà: HS cần biết/nêu được địa chỉ nơi gia đình ở ở mức phù hợp, nhưng không buộc đọc địa chỉ thật đầy đủ trước lớp hoặc ghi lên sản phẩm trưng bày. Có thể kiểm tra riêng, theo cặp tin cậy, phối hợp phụ huynh hoặc dùng địa chỉ giả định trên sản phẩm công khai.
13. Mỗi yêu cầu cần đạt phải nối được tới objectiveId/activityId, nhiệm vụ học sinh, một sản phẩm và tiêu chí đánh giá. Hoạt động không phục vụ yêu cầu nào hoặc yêu cầu không có bằng chứng phải được loại/sửa.
14. Giữ thứ tự nhiệm vụ SGK và quan hệ tiên quyết trong continuityPlan. Chỉ đổi thứ tự khi có lí do sư phạm rõ và không làm đứt quan sát - kết luận - luyện tập - vận dụng.
15. Không để lộ ký hiệu nội bộ S1/V2/Q1/L1, source ID, câu đuôi máy, dấu “.:”, “.;” hoặc câu bỏ lửng trong nội dung hiển thị/Word.`;

function naturalSocialGradeBandGuidance(input: LessonInput): string {
  const gradeBand = gradeBandFor(input.grade);
  if (gradeBand === "Lớp 1-2") {
    return `Điều chỉnh bắt buộc cho ${gradeBand}:
- Trọng tâm: gọi tên, quan sát, mô tả, chọn hành vi đúng và thực hành thao tác rất ngắn.
- Câu hỏi ngắn, có tranh/vật thật/thẻ lựa chọn; không yêu cầu giải thích dài.
- Sản phẩm phù hợp: chỉ tranh, nói 1-2 câu, tô/đánh dấu, ghép thẻ, thực hành một thao tác an toàn/vệ sinh.`;
  }
  return `Điều chỉnh bắt buộc cho ${gradeBand}:
- Tăng điều tra nhỏ, bảng ghi nhận, so sánh theo tiêu chí và trình bày kết quả.
- Có thể yêu cầu học sinh nêu nguyên nhân - kết quả đơn giản nhưng vẫn phải dựa vào quan sát/bằng chứng.
- Sản phẩm phù hợp: phiếu quan sát, bảng phân loại, sơ đồ đơn giản, báo cáo nhóm ngắn, kế hoạch hành động nhỏ.`;
}

function naturalSocialActivitySourceIds(period: NaturalSocialPeriodBlueprint) {
  const activities = Array.isArray(period.activities) ? period.activities : [];
  return {
    taskIds: new Set(activities.flatMap((activity) => activity.sourceTaskIds || []).filter(Boolean)),
    visualIds: new Set(activities.flatMap((activity) => activity.sourceVisualIds || []).filter(Boolean)),
  };
}

function naturalSocialTaskBelongsToPeriod(task: { taskId?: string; periodNumber?: number }, periodNumber: number, taskIds: Set<string>) {
  return task.periodNumber === periodNumber || (task.taskId ? taskIds.has(task.taskId) : false) || task.periodNumber === undefined;
}

function naturalSocialVisualBelongsToPeriod(visual: { visualId?: string }, visualIds: Set<string>) {
  return !visualIds.size || (visual.visualId ? visualIds.has(visual.visualId) : true);
}

function compactNaturalSocialSourceInventory(
  sourceInventory: NaturalSocialSourceInventory | undefined,
  period?: NaturalSocialPeriodBlueprint,
): NaturalSocialSourceInventory | undefined {
  if (!sourceInventory) return undefined;
  if (!period) return sourceInventory;
  const periodNumber = Number(period.periodNumber || 1);
  const { taskIds, visualIds } = naturalSocialActivitySourceIds(period);
  return {
    visuals: (sourceInventory.visuals || []).filter((visual) => naturalSocialVisualBelongsToPeriod(visual, visualIds)),
    questions: (sourceInventory.questions || []).filter((task) => naturalSocialTaskBelongsToPeriod(task, periodNumber, taskIds)),
    procedures: (sourceInventory.procedures || []).filter((task) => naturalSocialTaskBelongsToPeriod(task, periodNumber, taskIds)),
    practiceTasks: (sourceInventory.practiceTasks || []).filter((task) => naturalSocialTaskBelongsToPeriod(task, periodNumber, taskIds)),
    situations: (sourceInventory.situations || []).filter((task) => naturalSocialTaskBelongsToPeriod(task, periodNumber, taskIds)),
    classificationTasks: (sourceInventory.classificationTasks || []).filter((task) => naturalSocialTaskBelongsToPeriod(task, periodNumber, taskIds)),
    personalTasks: (sourceInventory.personalTasks || []).filter((task) => naturalSocialTaskBelongsToPeriod(task, periodNumber, taskIds)),
    safetyConstraints: sourceInventory.safetyConstraints,
    requiredTasks: (sourceInventory.requiredTasks || []).filter((task) => naturalSocialTaskBelongsToPeriod(task, periodNumber, taskIds)),
    uncertain: sourceInventory.uncertain,
  };
}

function compactNaturalSocialBlueprintForPeriod(
  blueprint: NaturalSocialLessonBlueprint,
  period: NaturalSocialPeriodBlueprint,
) {
  return {
    lessonTitle: blueprint.lessonTitle,
    classification: blueprint.classification,
    naturalSocialCore: blueprint.naturalSocialCore,
    outcomes: blueprint.outcomes,
    materials: blueprint.materials,
    assessment: blueprint.assessment,
    contextFit: blueprint.contextFit,
    sourceInventory: compactNaturalSocialSourceInventory(blueprint.sourceInventory, period),
    continuityPlan: blueprint.continuityPlan,
    periods: (blueprint.periods || []).map((item) => ({
      periodNumber: item.periodNumber,
      focus: item.focus,
      lessonType: item.lessonType,
      inquiryQuestion: item.inquiryQuestion,
      evidencePlan: item.evidencePlan,
      actionFocus: item.actionFocus,
      continuityIn: item.continuityIn,
      continuityOut: item.continuityOut,
      activities: item.periodNumber === period.periodNumber ? item.activities : undefined,
    })),
  };
}

export function buildNaturalSocialBlueprintPrompt(
  input: LessonInput,
  ocrText: string,
  classification: NaturalSocialClassification,
  cachedSourceInventory?: NaturalSocialSourceInventory,
): string {
  const sourceInventoryContext = cachedSourceInventory
    ? `\nSourceInventory SGK da luu tu lan xu ly truoc (tai su dung id/trang/ten cu the, chi bo sung neu OCR moi cho thay thieu ro rang):\n${JSON.stringify(cachedSourceInventory)}\n`
    : "";
  const ocrContextLimit = cachedSourceInventory ? 8000 : 15000;
  const style = input.style || "Dạy thật trên lớp";
  const facilities = input.facilities === "auto" ? "AI tự chọn theo bối cảnh" : input.facilities.join(", ");

  return `Bạn là chuyên gia thiết kế bài học môn Tự nhiên và Xã hội tiểu học. Hãy tạo blueprint (bản đồ bài học) trước khi soạn giáo án chi tiết.

Mục tiêu bước này:
- Khóa chủ đề, sourceInventory SGK, đối tượng quan sát, câu hỏi khám phá, bằng chứng học tập và hành động vận dụng.
- Chưa viết giáo án đầy đủ; output ngắn gọn, có cấu trúc.
- Blueprint sẽ dùng cho các request sau sinh từng tiết.

${naturalSocialStrictGuidance}

Khung CTGDPT 2018:
${curriculumGuidance}
${digitalCompetencyInstruction(input)}

Logic sư phạm TNXH:
${pedagogyProfileGuidance(input)}

${naturalSocialGradeBandGuidance(input)}

${naturalSocialLessonTypeGuidance(classification)}

Quy tắc cá nhân hóa:
${elementaryLocalityGuidance(input, ocrText)}

${learningContextGuidance(input)}

Thông tin form:
- Môn học: ${input.subject}
- Lớp: ${input.grade}
- Tên bài: ${input.lessonTitle || "Để trống - tự nhận diện từ ảnh SGK"}
- Bộ sách: ${bookContext(input)}
- Số tiết: ${input.periods}
- Thời lượng: ${input.duration} phút/tiết
- Quê hương/địa phương: ${localityContext(input)}
- Đối tượng HS: ${input.studentProfile}
- Môi trường học: ${input.teachingEnvironment}
- Cơ sở vật chất: ${facilities}
- Phong cách: ${style}
- Yêu cầu đặc biệt: ${input.specialRequest || "Không có"}
- Cho phép AI suy luận: ${input.allowAiInference ? "Có" : "Không"}

Phân loại tự động:
- Chủ đề chính: ${classification.primaryType}
- Trọng tâm hẹp: ${classification.topicFocus || "không khóa"}
- Chủ đề phụ: ${classification.secondaryTypes.join(", ") || "không"}
- Độ tin cậy: ${classification.confidence}
- Bằng chứng: ${classification.evidence.join("; ")}
${classification.uncertainties.length ? "- Lưu ý: " + classification.uncertainties.join("; ") : ""}

Nội dung ảnh SGK:
${promptOcrContext(ocrText, ocrContextLimit)}
${sourceInventoryContext}

Yêu cầu blueprint:
- Nhận diện và chép đúng số bài, tên bài, dấu phân cách từ ảnh SGK vào lessonTitle; chỉ chuẩn hóa khoảng trắng. Nếu tên user nhập khác tiêu đề đọc rõ trên ảnh, ưu tiên ảnh SGK.
- Trước khi chia tiết, lập sourceInventory dùng chung cho mọi bài TNXH: đầy đủ tranh/hình, câu hỏi SGK, quy trình/sắp xếp, nhiệm vụ thực hành/tạo sản phẩm, tình huống giao tiếp, phân loại, liên hệ bản thân và lưu ý an toàn nếu có.
- Nếu đã có SourceInventory SGK đã lưu, phải tái dùng id/trang/tên cụ thể/nơi sống/môi trường sống từ đó; không tự đổi id hoặc viết lại thành thông tin mơ hồ.
- Mỗi item trong sourceInventory phải có id ổn định: visualId hoặc taskId và page/số trang nếu ảnh SGK có. Không được bỏ qua tranh/câu hỏi/quy trình chỉ vì khó tổ chức.
- Với tranh động vật, thực vật, người/vật cụ thể: bảo toàn tên loài/tên đối tượng cụ thể trong specificName. Ví dụ nếu ảnh là "rùa biển" thì ghi "rùa biển", không rút thành "rùa".
- Khi bài yêu cầu nơi sống/môi trường sống, tách habitatPlace/nơi sống cụ thể (ao, hồ, biển, rừng, đồng cỏ, chuồng nuôi...) và environmentCategory/nhóm môi trường (trên cạn, dưới nước, vừa trên cạn vừa dưới nước). Không dùng hai khái niệm này thay thế cho nhau.
- Nếu SGK yêu cầu làm/cắt/dán/trang trí/tạo sản phẩm, ghi vào practiceTasks; không thay bằng nói/vẽ/cam kết.
- Nếu tất cả tranh nguồn đều là hành vi/việc làm tích cực, không tạo phân loại có cột "chưa nên/chưa giúp/không nên" trừ khi ghi rõ có tranh bổ sung của GV.
- Khởi động có thể dùng học liệu ngoài SGK thật sát bài như âm thanh, video ngắn, câu đố, trò chơi vận động hoặc tranh gợi mở để gây hứng thú. Nhưng Khởi động không được gắn sai số trang/nội dung SGK và không thay thế nhiệm vụ SGK bắt buộc đã khóa trong sourceInventory.
- Chỉ trả JSON hợp lệ, không Markdown.
- periods phải đủ đúng ${input.periods} tiết.
- Mỗi tiết có đúng 4 pha: Khởi động, Khám phá, Luyện tập, Vận dụng.
- Tạo continuityPlan từ chính taskId/visualId trong sourceInventory. Không tạo ID mới cho cùng một nguồn.
- Gom tranh - câu hỏi - quan sát - bằng chứng - kết luận hoặc quy trình - thực hành - sản phẩm thành cluster mustStayTogether khi không được phép cắt ngang.
- Mỗi source unit bắt buộc phải thuộc cluster; chỉ visual dùng lại có chủ ý mới đặt allowReuse=true.
- naturalSocialCore phải nêu rõ topic, domain, observationObjects, inquiryQuestions, evidenceToCollect, comparisonOrClassificationCriteria, actionApplications, safetyNotes và localConnectionRules.
- Mỗi tiết có trọng tâm riêng; không lặp nguyên mục tiêu giữa các tiết.
- Mỗi hoạt động blueprint phải có observationTarget hoặc inquiryFocus, sản phẩm chính, handoffToNext, sourceTaskIds/sourceVisualIds, sourceUnitIds/sourceClusterIds và coveragePurpose.
- Mỗi YCCĐ phải có id ổn định trong outcomes.objectiveMetadata; mỗi activity có id dạng ns-p{tiết}-a{thứ tự} và dùng objectiveIds để liên kết YCCĐ với nhiệm vụ, learningProducts và successCriteria. Không biến chi tiết nhân vật/tranh thành YCCĐ.
- Tiết 35 phút chỉ phân bổ 32-33 phút hoạt động chính, để chừa 2-3 phút dự phòng cho phát/thu học liệu, chuyển nhóm và xử lí tình huống.
- Không dùng từ "OCR"; dùng "ảnh SGK", "tranh trong SGK" hoặc "trang sách".
- Không bịa dữ liệu địa phương. Nếu bài cần địa phương mà chưa có tỉnh/nguồn cụ thể, ghi localConnectionRules dạng mở an toàn.
- Với lớp 1-2, tránh thuật ngữ trừu tượng như quang hợp, hệ sinh thái, kinh tuyến/vĩ tuyến, áp suất khí quyển.

Schema JSON:
{
  "lessonTitle": string,
  "lessonOverview": string,
  "classification": { "primaryType": string, "topicFocus": string, "secondaryTypes": string[], "confidence": string, "evidence": string[], "gradeBand": string, "uncertainties": string[] },
  "sourceInventory": {
    "visuals": [{ "visualId": string, "label": string, "page": string, "description": string, "specificName": string, "habitatPlace": string, "environmentCategory": string, "expectedObservation": string, "effectOrReason": string, "isPositiveExample": boolean, "required": boolean, "sourceEvidence": string[] }],
    "questions": [{ "taskId": string, "question": string, "expectedAnswer": string, "visualIds": string[], "periodNumber": number, "required": boolean, "sourceEvidence": string[] }],
    "procedures": [{ "taskId": string, "label": string, "steps": string[], "visualIds": string[], "periodNumber": number, "required": boolean, "sourceEvidence": string[] }],
    "practiceTasks": [{ "taskId": string, "label": string, "materials": string[], "steps": string[], "expectedProduct": string, "periodNumber": number, "required": boolean, "safetyNotes": string[], "sourceEvidence": string[] }],
    "situations": [{ "taskId": string, "label": string, "characters": string[], "prompt": string, "expectedResponse": string, "periodNumber": number, "required": boolean, "sourceEvidence": string[] }],
    "classificationTasks": [{ "taskId": string, "label": string, "categories": string[], "itemLabels": string[], "visualIds": string[], "periodNumber": number, "required": boolean, "requiresSupplementalExamples": boolean, "sourceEvidence": string[] }],
    "personalTasks": [{ "taskId": string, "label": string, "prompt": string, "periodNumber": number, "required": boolean, "sourceEvidence": string[] }],
    "safetyConstraints": string[],
    "requiredTasks": [{ "taskId": string, "label": string, "taskType": string, "periodNumber": number, "required": boolean, "productKind": string, "sourceText": string, "expectedAnswer": string, "criteria": string[], "sourceEvidence": string[] }],
    "uncertain": string[]
  },
  "continuityPlan": {
    "sourceUnits": [{ "unitId": string, "label": string, "kind": string, "page": string, "required": boolean, "allowReuse": boolean, "preferredPeriodNumber": number, "estimatedMinutes": number, "sourceEvidence": string[] }],
    "clusters": [{ "clusterId": string, "label": string, "sourceUnitIds": string[], "periodNumber": number, "mustStayTogether": boolean, "prerequisiteClusterIds": string[], "estimatedMinutes": number, "expectedProduct": string }],
    "warnings": string[]
  },
  "naturalSocialCore": {
    "topic": string,
    "domain": string,
    "observationObjects": string[],
    "inquiryQuestions": string[],
    "evidenceToCollect": string[],
    "comparisonOrClassificationCriteria": string[],
    "actionApplications": string[],
    "safetyNotes": string[],
    "localConnectionRules": string[]
  },
  "outcomes": ${input.enableDigitalCompetency ? `{ "generalCompetencies": string[], "specificCompetencies": string[], "qualities": string[], "knowledgeAndSkills": string[], "digitalCompetencies": string[], "objectiveMetadata": [{ "id": string, "category": string, "statement": string, "evidence": { "activityIds": string[], "learningProducts": string[], "successCriteria": string[] } }] }` : `{ "generalCompetencies": string[], "specificCompetencies": string[], "qualities": string[], "knowledgeAndSkills": string[], "objectiveMetadata": [{ "id": string, "category": string, "statement": string, "evidence": { "activityIds": string[], "learningProducts": string[], "successCriteria": string[] } }] }`},
  "materials": { "teacher": string[], "students": string[] },
  "assessment": { "criteria": string[], "evidence": string[], "comments": string[] },
  "contextFit": { "notes": string[] },
  "periods": [{
    "periodNumber": number,
    "focus": string,
    "lessonType": string,
    "objectives": string[],
    "observationTargets": string[],
    "inquiryQuestion": string,
    "evidencePlan": string,
    "comparisonCriteria": string[],
    "safetyNotes": string[],
    "actionFocus": string,
    "continuityIn": string,
    "continuityOut": string,
    "activities": [{ "id": string, "phase": string, "title": string, "objective": string, "durationMinutes": number, "inquiryFocus": string, "observationTarget": string, "product": string, "handoffToNext": string, "objectiveIds": string[], "sourceTaskIds": string[], "sourceVisualIds": string[], "sourceUnitIds": string[], "sourceClusterIds": string[], "coveragePurpose": string }]
  }]
}`;
}

export function buildNaturalSocialPeriodPrompt(
  input: LessonInput,
  ocrText: string,
  blueprint: NaturalSocialLessonBlueprint,
  period: NaturalSocialPeriodBlueprint,
  previousHandoff: NaturalSocialPeriodChunk["handoff"] | null,
): string {
  const style = input.style || "Dạy thật trên lớp";
  const creativeMode = style === "Sáng tạo, sinh động";
  const lessonType = period.lessonType || blueprint.classification?.primaryType || "mixed";
  const profile = getNaturalSocialPedagogyProfile({
    primaryType: lessonType,
    topicFocus: blueprint.classification?.topicFocus,
  });
  const compactBlueprint = compactNaturalSocialBlueprintForPeriod(blueprint, period);
  const periodOcrContextLimit = blueprint.sourceInventory ? 4000 : 7000;
  const startupSuggestion = selectNaturalSocialStartup({
    input,
    lessonType,
    topicFocus: blueprint.classification?.topicFocus,
    periodNumber: Number(period.periodNumber || 1),
    lessonTitle: blueprint.lessonTitle || input.lessonTitle,
    focus: period.focus,
    inquiryQuestion: period.inquiryQuestion,
    observationTargets: period.observationTargets,
    sourceInventory: blueprint.sourceInventory,
  });

  return `Bạn là chuyên gia soạn giáo án Tự nhiên và Xã hội tiểu học. Hãy sinh riêng một tiết theo blueprint đã khóa.

${naturalSocialStrictGuidance}

Quy tắc quan trọng:
- Chỉ trả JSON hợp lệ cho một PeriodPlan, không Markdown.
- Bám blueprint; không nghĩ lại mục tiêu từ đầu.
- Giữ mạch từ previousHandoff/continuityIn sang continuityOut.
- Không dùng từ "OCR".
- Mỗi tiết có đúng 4 hoạt động: Khởi động, Khám phá, Luyện tập, Vận dụng.
- teacherActions/studentActions đi theo từng cặp; mọi teacherActions bắt đầu "GV ...", studentActions bắt đầu "HS ...".
- Tiết 35 phút chỉ ghi tổng durationMinutes 32-33 phút để chừa 2-3 phút dự phòng. Gợi ý: Khởi động 3, Khám phá 14, Luyện tập 10, Vận dụng 6.
- Khởi động 2-3 cặp, Khám phá 4-6 cặp, Luyện tập 3-4 cặp, Vận dụng 2-3 cặp.
- Khởi động được phép dùng học liệu ngoài SGK nếu sát bài và hấp dẫn (âm thanh con vật, câu đố, video 15-20 giây, thẻ bí mật, vận động mô phỏng...), nhưng phải ghi rõ là học liệu gợi mở ngoài SGK; không được gọi nhầm là tranh SGK hoặc lấy sai trang. Sau Khởi động phải quay về sourceInventory SGK ở Khám phá/Luyện tập.
- Khám phá bắt buộc có quan sát, câu hỏi gợi mở, dự kiến câu trả lời đúng/sai thường gặp, cách GV gợi mở sửa sai và lời chốt.
- Luyện tập bắt buộc có nhiệm vụ mô tả, so sánh, phân loại, thực hành hoặc xử lí tình huống với tiêu chí rõ.
- Vận dụng phải hoàn thành/áp dụng đúng trọng tâm vừa học; không tự thêm việc nhà, an toàn, vệ sinh hoặc cam kết nếu sourceInventory và YCCĐ không yêu cầu.
- Phải bao phủ đúng sourceInventory của blueprint: dùng sourceTaskIds/sourceVisualIds/coveragePurpose trong từng activity, không bỏ sót tranh/câu hỏi/quy trình/sản phẩm/tình huống đã khóa.
- Đồng thời dùng sourceUnitIds/sourceClusterIds đúng continuityPlan; cluster mustStayTogether chỉ được xuất hiện trong tiết đã khóa.
- Nếu sourceInventory có practiceTasks, activity tương ứng phải cho HS làm/thực hành/hoàn thiện sản phẩm thật hoặc ghi rõ hoàn thiện ở nhà cùng người lớn; không thay bằng chỉ nói/vẽ/cam kết.
- Nếu sourceInventory chỉ có tranh tích cực, không tự tạo phân loại có nhóm "chưa nên/không nên" nếu không thêm tranh bổ sung của GV.
- Nếu sourceInventory.visuals có page/số trang, teacherActions phải dùng đúng trang; không gắn con vật/hình ở trang này sang trang khác.
- Nếu sourceInventory.visuals có specificName, phải dùng đúng tên cụ thể; không rút gọn làm sai phân loại.
- Nếu sourceInventory.visuals có habitatPlace và environmentCategory, hoạt động phải thể hiện đủ cả nơi sống cụ thể và nhóm môi trường sống.
- Mỗi activity có đúng 1 learningProducts chính, 1-2 successCriteria, expectedAnswer/acceptableResponses khi có câu hỏi hoặc tình huống.
- Chỉ điền supportForStudentsNeedingHelp/extensionForEarlyFinishers ở Khám phá và Luyện tập; hoạt động còn lại để mảng rỗng nếu không cần.
${creativeMode ? "- Có ít nhất một điểm nhấn sáng tạo vừa sức: thẻ quan sát, trạm khám phá, phóng viên nhí, góc hành động hoặc mini thử thách an toàn." : "- Ưu tiên thực tế, dễ dạy, học liệu dễ chuẩn bị."}

Chủ đề tiết này: ${profile?.label || period.lessonType || "mixed"}
${profile ? `Chuỗi dạy học nên giữ:
${profile.inquirySequence.map((step, index) => `${index + 1}. ${step}`).join("\n")}

Lỗi/ngộ nhận cần dự kiến:
${profile.commonMisconceptions.map((item) => `- ${item}`).join("\n")}` : ""}

Khung CTGDPT 2018:
${curriculumGuidance}
${digitalCompetencyInstruction(input)}

Luật Khởi động:
${startupGuidance}

${formatNaturalSocialStartupPromptBlock(startupSuggestion)}

Tiêu chuẩn chất lượng:
${qualityGuidance(input)}

Logic sư phạm TNXH:
${pedagogyProfileGuidance(input)}

${naturalSocialGradeBandGuidance(input)}

Blueprint toàn bài đã khóa:
${JSON.stringify(compactBlueprint)}

Lõi TNXH đã khóa:
${JSON.stringify(blueprint.naturalSocialCore || {})}

Tiết cần sinh:
${JSON.stringify(period)}

Kết quả bàn giao từ tiết trước:
${previousHandoff ? JSON.stringify(previousHandoff) : period.continuityIn || "Đây là tiết mở đầu, cần dẫn từ trải nghiệm gần gũi của học sinh."}

Nội dung ảnh SGK:
${promptOcrContext(ocrText, periodOcrContextLimit)}

Schema JSON:
{
  "periodNumber": number,
  "focus": string,
  "outcomes": ${input.enableDigitalCompetency ? `{ "generalCompetencies": string[], "specificCompetencies": string[], "qualities": string[], "knowledgeAndSkills": string[], "digitalCompetencies": string[] }` : `{ "generalCompetencies": string[], "specificCompetencies": string[], "qualities": string[], "knowledgeAndSkills": string[] }`},
  "activities": [{
    "id": string,
    "phase": string,
    "title": string,
    "objective": string,
    "durationMinutes": number,
    "teacherActions": string[],
    "studentActions": string[],
    "inputOrMaterials": string[],
    "organization": "individual" | "pair" | "group" | "whole_class",
    "learningProducts": string[],
    "successCriteria": string[],
    "expectedAnswer": string,
    "acceptableResponses": string[],
    "commonErrors": string[],
    "teacherFeedback": string[],
    "supportForStudentsNeedingHelp": string[],
    "extensionForEarlyFinishers": string[],
    "objectiveIds": string[],
    "sourceTaskIds": string[],
    "sourceVisualIds": string[],
    "sourceUnitIds": string[],
    "sourceClusterIds": string[],
    "coveragePurpose": string,
    "timeBreakdown": { "instructionMinutes": number, "distributionMinutes": number, "thinkingMinutes": number, "workingMinutes": number, "presentationMinutes": number, "feedbackMinutes": number, "consolidationMinutes": number, "transitionMinutes": number, "flexibleMinutes": number }
  }],
  "handoff": { "learned": string, "unresolvedRisks": string[], "nextBridge": string }
}`;
}

export function buildNaturalSocialPeriodRepairPrompt(
  input: LessonInput,
  blueprint: NaturalSocialLessonBlueprint,
  period: NaturalSocialPeriodChunk,
  issues: string[],
): string {
  const periodBlueprint = blueprint.periods?.find((item) => item.periodNumber === period.periodNumber);
  const lessonType = periodBlueprint?.lessonType || blueprint.classification?.primaryType || "mixed";
  const profile = getNaturalSocialPedagogyProfile({
    primaryType: lessonType,
    topicFocus: blueprint.classification?.topicFocus,
  });
  const compactBlueprint = compactNaturalSocialBlueprintForPeriod(blueprint, periodBlueprint || { periodNumber: period.periodNumber, focus: period.focus });
  const startupSuggestion = selectNaturalSocialStartup({
    input,
    lessonType,
    topicFocus: blueprint.classification?.topicFocus,
    periodNumber: Number(period.periodNumber || 1),
    lessonTitle: blueprint.lessonTitle || input.lessonTitle,
    focus: period.focus,
    sourceInventory: blueprint.sourceInventory,
  });

  return `PeriodPlan Tự nhiên và Xã hội sau chưa đạt. Hãy sửa riêng tiết này, không viết lại toàn bộ bài.

${naturalSocialStrictGuidance}

Chỉ trả JSON hợp lệ theo schema PeriodPlan + handoff. Không Markdown.

Blueprint toàn bài:
${JSON.stringify(compactBlueprint)}

Lõi TNXH:
${JSON.stringify(blueprint.naturalSocialCore || {})}

Các lỗi cần sửa:
${issues.map((issue) => `- ${issue}`).join("\n")}

Yêu cầu sửa:
- Giữ periodNumber và focus.
- Có đúng 4 hoạt động: Khởi động, Khám phá, Luyện tập, Vận dụng.
- Nếu sửa Khởi động, dùng đúng khung do hệ thống đã chọn dưới đây hoặc chỉ tinh chỉnh câu chữ cho khớp bài; không đổi thành "GV giới thiệu bài".
- teacherActions/studentActions đi theo từng cặp, bắt đầu "GV ..." và "HS ...".
- Giữ objectiveIds và dùng sourceTaskIds/sourceVisualIds/coveragePurpose để nối YCCĐ - nhiệm vụ - sản phẩm - tiêu chí và bao phủ đúng sourceInventory trong blueprint.
- Giữ sourceUnitIds/sourceClusterIds đúng continuityPlan; không chuyển cluster sang tiết khác và không tách cluster mustStayTogether.
- Bổ sung đối tượng quan sát cụ thể, câu hỏi khám phá, nhiệm vụ mô tả/so sánh/phân loại, bằng chứng học tập và hành động vận dụng.
- Nếu lỗi liên quan sourceInventory, phải sửa đúng nhiệm vụ SGK bị thiếu: tranh/hình, câu hỏi, quy trình, tình huống, liên hệ bản thân hoặc sản phẩm thực hành.
- Nếu SGK yêu cầu làm/cắt/dán/trang trí/tạo sản phẩm, phải có thao tác thực hành/sản phẩm thật hoặc giao hoàn thiện có kiểm chứng; không thay bằng nói/vẽ/cam kết.
- Nếu lỗi do sai trang, nhầm tên loài cụ thể, hoặc thiếu phân biệt nơi sống/môi trường sống, sửa trực tiếp trong teacherActions/studentActions/expectedAnswer; không chỉ thêm câu chốt chung.
- Nếu lỗi do lặp phân loại, đổi hoạt động trùng thành liên hệ địa phương, sơ đồ mở rộng, hỏi đáp theo tranh mới hoặc xử lí tình huống SGK.
- Tiết 35 phút chỉ ghi tổng durationMinutes 32-33 phút để chừa 2-3 phút dự phòng.
- Nếu thiếu tiêu chí, thêm 1-2 successCriteria gắn với sản phẩm chính của hoạt động.
- Nếu có nguy cơ thiếu an toàn, thay bằng tranh, mô hình, vật thật an toàn hoặc GV làm mẫu.
- Không bịa dữ liệu địa phương; dùng ví dụ mở nếu chưa có nguồn.
- Rút số bước nếu quá dài: Khởi động 2-3 cặp, Khám phá 4-6 cặp, Luyện tập 3-4 cặp, Vận dụng 2-3 cặp.
- Không dùng từ "OCR".
${profile ? `- Chủ đề: ${profile.label}. Giữ chuỗi: ${profile.inquirySequence.join(" → ")}.` : ""}
${digitalCompetencyInstruction(input)}
- Cá nhân hóa: ${JSON.stringify({ grade: input.grade, environment: input.teachingEnvironment, facilities: input.facilities, locality: localityContext(input), style: input.style })}

${formatNaturalSocialStartupPromptBlock(startupSuggestion)}

PeriodPlan cần sửa:
${JSON.stringify(period)}

Schema JSON:
{
  "periodNumber": number,
  "focus": string,
  "outcomes": ${input.enableDigitalCompetency ? `{ "generalCompetencies": string[], "specificCompetencies": string[], "qualities": string[], "knowledgeAndSkills": string[], "digitalCompetencies": string[], "objectiveMetadata": [{ "id": string, "category": string, "statement": string, "evidence": { "activityIds": string[], "learningProducts": string[], "successCriteria": string[] } }] }` : `{ "generalCompetencies": string[], "specificCompetencies": string[], "qualities": string[], "knowledgeAndSkills": string[], "objectiveMetadata": [{ "id": string, "category": string, "statement": string, "evidence": { "activityIds": string[], "learningProducts": string[], "successCriteria": string[] } }] }`},
  "activities": [{
    "id": string,
    "phase": string,
    "title": string,
    "objective": string,
    "durationMinutes": number,
    "teacherActions": string[],
    "studentActions": string[],
    "inputOrMaterials": string[],
    "organization": "individual" | "pair" | "group" | "whole_class",
    "learningProducts": string[],
    "successCriteria": string[],
    "expectedAnswer": string,
    "acceptableResponses": string[],
    "commonErrors": string[],
    "teacherFeedback": string[],
    "supportForStudentsNeedingHelp": string[],
    "extensionForEarlyFinishers": string[],
    "objectiveIds": string[],
    "sourceTaskIds": string[],
    "sourceVisualIds": string[],
    "sourceUnitIds": string[],
    "sourceClusterIds": string[],
    "coveragePurpose": string,
    "timeBreakdown": { "instructionMinutes": number, "distributionMinutes": number, "thinkingMinutes": number, "workingMinutes": number, "presentationMinutes": number, "feedbackMinutes": number, "consolidationMinutes": number, "transitionMinutes": number, "flexibleMinutes": number }
  }],
  "handoff": { "learned": string, "unresolvedRisks": string[], "nextBridge": string }
}`;
}

// ─── VIETNAMESE-SPECIFIC PROMPTS ───

function vietnameseGradeBandGuidance(input: LessonInput): string {
  const gradeBand = gradeBandFor(input.grade);
  if (gradeBand === "Lớp 1-2") {
    return `Điều chỉnh bắt buộc cho ${gradeBand}:
- Trọng tâm: đọc đúng, viết đúng, nói rõ, nghe hiểu; câu lệnh ngắn, có mẫu.
- Lớp 1 phải nhận diện riêng bài âm/chữ/vần, không dùng quy trình đọc hiểu lớp lớn cho bài học vần.
- Ngữ liệu, từ/câu, mẫu chữ phải được chép rõ; không chỉ ghi "làm bài trong SGK".
- Dùng tranh, thẻ tiếng/từ, thao tác ghép, đọc đồng thanh/cá nhân có mục đích.
- Sản phẩm ngắn: tiếng/từ đọc đúng, chữ viết đúng mẫu, 1-3 câu nói/viết.`;
  }
  return `Điều chỉnh bắt buộc cho ${gradeBand}:
- Tăng đọc hiểu dựa trên bằng chứng trong văn bản.
- Viết theo quy trình: xác định yêu cầu → tìm/lập ý → viết → đọc soát/chỉnh sửa.
- Luyện từ và câu phải đi từ ngữ liệu đến quy tắc, sau đó dùng trong ngữ cảnh.
- Nói và nghe có tiêu chí về nội dung, trình tự, giọng điệu, lượt lời.`;
}

export function vietnameseLessonTypeGuidance(classification: VietnameseLessonClassification): string {
  const profile = vietnameseLessonTypeProfiles[classification.primaryType];
  if (!profile || classification.primaryType === "mixed") {
    return `Kiểu bài: Tích hợp/Chưa xác định rõ (confidence: ${classification.confidence}).
- Mỗi tiết trong blueprint phải được gán kiểu bài chính riêng.
- Checker sẽ chỉ kiểm tra năng lực có bằng chứng.
${classification.uncertainties.length ? "Lưu ý: " + classification.uncertainties.join("; ") : ""}`;
  }

  const gradeChecks = profile.gradeNotes[classification.gradeBand] || [];
  return `Kiểu bài đã nhận diện: ${profile.label} (confidence: ${classification.confidence}).
Bằng chứng: ${classification.evidence.join("; ")}.

Chuỗi dạy học bắt buộc theo kiểu bài:
${profile.mandatorySequence.map((s, i) => `${i + 1}. ${s}`).join("\n")}

Sản phẩm học tập mong đợi:
${profile.learningProducts.map(p => `- ${p}`).join("\n")}

Lỗi thường gặp cần dự kiến:
${profile.commonErrors.map(e => `- ${e}`).join("\n")}

Tiêu chí đánh giá:
${profile.assessmentCriteria.map(c => `- ${c}`).join("\n")}

${gradeChecks.length ? `Lưu ý theo cụm lớp ${classification.gradeBand}:\n${gradeChecks.map(n => `- ${n}`).join("\n")}` : ""}

Không được thêm kĩ năng không phải trọng tâm:
${profile.checkerNotRequired.map(n => `- KHÔNG bắt buộc: ${n}`).join("\n")}`;
}

export const vietnameseStrictGuidance = `QUY TẮC BẮT BUỘC KHI SOẠN GIÁO ÁN TIẾNG VIỆT TIỂU HỌC:
1. SGK & bảng kiểm ngữ liệu: Phải bám chính xác nội dung và thứ tự nhiệm vụ trong ảnh SGK. Trước khi soạn phải khóa bảng kiểm gồm: bài đọc/đoạn đọc, từ khó, câu dài, câu hỏi, đoạn chính tả, bài âm-vần, câu dấu câu, yêu cầu viết, đáp án, mọi nhiệm vụ bắt buộc và phần chưa chắc. Không ghi "chốt theo SGK", "đối chiếu theo SGK" hoặc "làm bài trong SGK" nếu chưa chép nội dung cụ thể.
2. YCCĐ: Mỗi tiết chỉ có 4–6 yêu cầu ngắn, mỗi yêu cầu là một dòng độc lập, không thêm câu giải thích sau từng yêu cầu. Ưu tiên động từ đo được: Đọc; Hiểu; Tìm; Xác định; Sắp xếp; Nêu; Lựa chọn; Đặt câu; Viết; Tự sửa. Cấm các cụm máy móc: "thực hiện được qua", "sử dụng kiến thức, kĩ năng đặc thù", "kiến thức đặc thù", "nội dung học tập đặc thù", "được hình thành qua", và lỗi dấu câu ".:".
3. Kiến thức - năng lực: Kiến thức, kĩ năng nêu HS làm được gì. Năng lực chung chỉ nêu 1–2 biểu hiện thật có trong hoạt động. Năng lực đặc thù khái quát đọc/viết/nói-nghe hoặc năng lực ngôn ngữ, không chép lại từng bài tập trong kiến thức, kĩ năng.
4. Đọc lớp 1–2: Hướng dẫn luyện đọc phải có câu dài nguyên văn, đánh dấu chỗ ngắt bằng "/", giọng đọc, tốc độ phù hợp, tiếng/từ dễ đọc sai và từ cần nhấn. Không yêu cầu phân tích sâu kiểu lớp trên.
5. Đáp án và ngữ liệu bắt buộc: Bài ch/tr, c/k, ac/at, dấu câu, gọi tên đồ vật, viết câu theo tranh phải có nguyên văn từ/cụm/câu hoặc danh sách đồ vật dự kiến kèm đáp án/chấp nhận. Nếu ảnh không đủ rõ, ghi phần chưa chắc vào sourceInventory.uncertain để hệ thống lưu nội bộ, không bịa đáp án và không đưa các cụm thô như "cần GV xác minh", "OCR chưa rõ", "kiểm tra lại SGK" vào giáo án/Word. Khi cần nhắc chuẩn bị, dùng câu trung tính: "Ghi chú chuẩn bị: GV đối chiếu ảnh SGK trước giờ dạy." Tuyệt đối không chặn xuất Word chỉ vì còn mục cần đối chiếu.
5b. Bao phủ nhiệm vụ SGK: Mọi dòng có số thứ tự, dấu sao, biểu tượng nhiệm vụ, chữ nhỏ dưới câu hỏi hoặc yêu cầu như "Học thuộc lòng...", "Đọc mở rộng...", "Viết vào vở...", "Đặt 2 câu..." đều phải đưa vào sourceInventory.requiredTasks. Mỗi requiredTask ghi taskType, periodNumber dự kiến, productKind, expectedAnswer nếu có và tiêu chí ngắn. Ma trận này chỉ dùng để kiểm tra nội bộ, không in ra Word.
6. Phân hóa: Chỉ phân hóa ở 1–2 hoạt động trọng tâm mỗi tiết. Phân hóa phải theo nhiệm vụ thật: hỗ trợ bằng gợi ý hoặc khung câu ngắn; đạt là hoàn thành yêu cầu chính; hoàn thành tốt là mở rộng một ý vừa sức. Không dùng một mẫu phân hóa cho mọi hoạt động.
7. Tiêu chí theo loại sản phẩm: Đọc = đúng tiếng, rõ lời, ngắt nghỉ. Trả lời = đúng ý, có chi tiết liên quan. Chính tả = đủ đoạn, đúng chữ, đúng dấu, trình bày sạch. Âm/vần = điền đúng, đọc được từ. Nói = đủ ý, rõ câu. Viết = đủ số câu, trọn ý, đúng dấu câu. Không dùng một tiêu chí cho mọi dạng nhiệm vụ.
8. Trùng hoạt động: Trong cùng một tiết, không để hai hoạt động hỏi cùng một câu, yêu cầu cùng một sản phẩm và cùng mức nhận thức. Vận dụng phải tạo giá trị mới như liên hệ, cảm nhận, dùng từ/câu vào tình huống gần gũi.
9. Thời lượng: Với tiết 35 phút, tổng durationMinutes của 4 hoạt động chỉ 32–33 phút để chừa 2–3 phút dự phòng. Định mức tối thiểu khi là trọng tâm: đọc thành tiếng lớp 2–3 từ 10–14 phút; nghe-viết 10–13 phút; viết 3–5 câu 13–16 phút; sáu câu dấu câu ít nhất 8–10 phút; bài nối đơn giản khoảng 6–9 phút.
10. Học liệu: Học liệu phải được chọn riêng cho từng tiết và từng hoạt động; mọi học liệu liệt kê phải được dùng trong tiến trình của chính hoạt động đó. Không bê toàn bộ danh sách học liệu của cả bài vào từng tiết.
11. Kho ngữ liệu đã xác minh nếu có chỉ là dữ liệu SGK sạch (câu hỏi, đáp án, bài đọc, bài tập), không phải giáo án mẫu. Mỗi lần vẫn phải sinh mới kịch bản GV/HS, cách dẫn dắt, tổ chức hoạt động và vận dụng phù hợp.
12. Rà soát chất lượng: Trước khi trả JSON, tự xóa câu lặp/máy móc, sửa ".:", rút số bước thừa, kiểm tra cặp GV-HS khớp trình tự, bảng hai cột không lệch hàng, đáp án cụ thể, học liệu đúng tiết và độ dài mỗi tiết khoảng 3–4 trang Word.`;

export function buildVietnameseBlueprintPrompt(
  input: LessonInput,
  ocrText: string,
  classification: VietnameseLessonClassification,
): string {
  const style = input.style || "Dạy thật trên lớp";
  const facilities = input.facilities === "auto" ? "AI tự chọn theo bối cảnh" : input.facilities.join(", ");

  return `Bạn là chuyên gia thiết kế bài học môn Tiếng Việt tiểu học. Hãy tạo blueprint (bản đồ bài học) trước khi soạn giáo án chi tiết.

Mục tiêu bước này:
- Phân tích bài, khóa kiểu bài, ngữ liệu, mạch các tiết.
- Chưa viết giáo án đầy đủ; output ngắn gọn có cấu trúc.
- Blueprint sẽ dùng cho các request sau sinh từng tiết.

${vietnameseStrictGuidance}

Khung CTGDPT 2018:
${curriculumGuidance}
${digitalCompetencyInstruction(input)}

Logic sư phạm Tiếng Việt:
${pedagogyProfileGuidance(input)}

${vietnameseGradeBandGuidance(input)}

${vietnameseLessonTypeGuidance(classification)}

Quy tắc bắt buộc:
- Bám đúng văn bản, từ ngữ, câu hỏi, mẫu chữ hoặc nhiệm vụ trong ảnh SGK.
- Khi ảnh SGK không đủ rõ, dùng mô tả trung tính và ghi phần chưa chắc vào sourceInventory.uncertain; không bịa chi tiết, không đưa cụm xác minh thô vào nội dung giáo án/Word.
- Không dùng từ "OCR"; dùng "ảnh SGK", "tranh trong SGK".
- Mỗi tiết trong blueprint phải có kiểu bài riêng (có thể khác kiểu bài chính).
- Nếu nhiều tiết, gán trọng tâm kĩ năng riêng; không lặp nguyên mục tiêu.
- Tạo sourceInventory trước khi chia tiết: ghi rõ đoạn đọc, từ khó, câu dài, câu hỏi, đoạn chính tả, bài tập âm/vần, câu dấu câu, yêu cầu viết, đáp án dự kiến, học liệu theo từng tiết và requiredTasks bao phủ toàn bộ nhiệm vụ SGK.
- sourceInventory là dữ liệu bắt buộc để sinh giáo án; phần nào chưa đọc chắc từ ảnh phải đưa vào uncertain, không được thay bằng "theo SGK".
- requiredTasks phải có đủ các nhiệm vụ trong SGK, kể cả dấu sao/chữ nhỏ. Ví dụ: "Học thuộc lòng 2 khổ thơ em thích" là taskType "memorization", productKind "memorized"; "Đặt 2 câu" là taskType "sentence-writing" nếu có tiêu chí viết hoa/dấu câu thì productKind bắt buộc là "written".
- Tạo continuityPlan từ taskId của requiredTasks. Mỗi nhiệm vụ bắt buộc là sourceUnit; gom các nhiệm vụ không được tách như ngữ liệu đọc-câu hỏi-chốt, đoạn chính tả-nghe viết-soát lỗi, yêu cầu viết-tìm ý-viết-tự sửa thành cluster mustStayTogether.
- Mỗi sourceUnit chỉ thuộc một cluster, trừ nhiệm vụ được đánh dấu allowReuse=true. Cluster phải gán đúng một periodNumber trong ${input.periods} tiết.
- Kiến thức, kĩ năng chỉ nêu HS làm được gì; năng lực chung chỉ 1–2 biểu hiện hoạt động thật; năng lực đặc thù khái quát đọc/viết/nói-nghe, không chép lại từng YCCĐ.
- Khi phát hiện hai hoạt động cùng câu hỏi, cùng sản phẩm và cùng mức nhận thức, phải đổi hoạt động sau thành liên hệ/cảm nhận/vận dụng từ-câu phù hợp lứa tuổi.

${elementaryLocalityGuidance(input, ocrText)}

${learningContextGuidance(input)}

Thông tin form:
- Môn học: ${input.subject}
- Lớp: ${input.grade}
- Tên bài: ${input.lessonTitle || "Để trống - tự nhận diện từ ảnh SGK"}
- Bộ sách: ${bookContext(input)}
- Tập sách: ${input.bookVolume && input.bookVolume !== "auto" ? input.bookVolume : "Không xác định"}
- Số tiết: ${input.periods}
- Thời lượng: ${input.duration} phút/tiết
- Quê hương: ${localityContext(input)}
- Đối tượng HS: ${input.studentProfile}
- Môi trường học: ${input.teachingEnvironment}
- Cơ sở vật chất: ${facilities}
- Phong cách: ${style}
- Yêu cầu đặc biệt: ${input.specialRequest || "Không có"}
- Cho phép AI suy luận: ${input.allowAiInference ? "Có" : "Không"}

Phân loại tự động (classifier hệ thống):
- Kiểu bài chính: ${classification.primaryType}
- Kiểu phụ: ${classification.secondaryTypes.join(", ") || "không"}
- Độ tin cậy: ${classification.confidence}
- Bằng chứng: ${classification.evidence.join("; ")}
${classification.uncertainties.length ? "- Lưu ý: " + classification.uncertainties.join("; ") : ""}

Nội dung ảnh SGK:
${promptOcrContext(ocrText)}

Yêu cầu blueprint:
- Nhận diện và chép đúng số bài, tên bài, dấu phân cách từ ảnh SGK vào lessonTitle; chỉ chuẩn hóa khoảng trắng. Nếu tên user nhập khác tiêu đề đọc rõ trên ảnh, ưu tiên ảnh SGK.
- Chỉ trả JSON hợp lệ, không Markdown.
- periods phải đủ đúng ${input.periods} tiết.
- Mỗi tiết có: lessonType, focus, objectives, sourceEvidence, targetSkills, continuityIn/Out, activities 4 pha.
- sourceEvidence: ngữ liệu/nhiệm vụ cụ thể từ sourceInventory; phần chưa chắc chỉ ghi trong sourceInventory.uncertain, còn sourceEvidence dùng mô tả phạm vi trung tính để không làm bẩn giáo án Word.
- Nếu tiết 35 phút, tổng durationMinutes của 4 activities trong từng tiết phải là 32 hoặc 33 phút; để trống 2–3 phút dự phòng ngoài activities.
- Objectives cấp tiết phải 4–6 câu ngắn, mỗi câu bắt đầu bằng một động từ đo được trong danh sách: Đọc; Hiểu; Tìm; Xác định; Sắp xếp; Nêu; Lựa chọn; Đặt câu; Viết; Tự sửa. Không dùng cụm "thực hiện được qua", "sử dụng kiến thức, kĩ năng đặc thù", "kiến thức đặc thù", "nội dung học tập đặc thù".
- Mỗi hoạt động trong blueprint chỉ có một sản phẩm chính dự kiến; không gộp nhiều sản phẩm vào một hoạt động. Mỗi requiredTask bắt buộc phải có ít nhất một hoạt động dự kiến trong periods.activities.
- Mỗi hoạt động phải khai báo sourceTaskIds, sourceUnitIds và sourceClusterIds đúng với continuityPlan; không kéo ngữ liệu hoặc cluster của tiết khác sang.
- Mỗi tiết chỉ nêu học liệu/ngữ liệu riêng của tiết đó trong sourceEvidence và activities; không đưa văn bản, tranh, phiếu của tiết khác vào tiết hiện tại.
- Với bài luyện từ/câu về đồng nghĩa hoặc trường nghĩa, ghi rõ nhóm nghĩa đúng theo SGK; không gán "ban mai/sáng sớm/bình minh" vào âm thanh và không gán "khuân/vác/lôi" vào âm thanh.
- Với lớp 1–3, nếu có đọc thành tiếng, sourceInventory.longSentences phải có câu nguyên văn và bản ngắt nghỉ bằng "/".

Schema JSON:
{
  "lessonTitle": string,
  "lessonOverview": string,
  "classification": { "primaryType": string, "secondaryTypes": string[], "confidence": string, "evidence": string[], "gradeBand": string, "uncertainties": string[] },
  "sourceInventory": {
    "readingText": string[],
    "readingVocabulary": string[],
    "longSentences": [{ "sentence": string, "pauseMarked": string, "note": string }],
    "readingQuestions": [{ "question": string, "expectedAnswer": string, "evidence": string[] }],
    "spellingText": string,
    "phonicsTasks": [{ "prompt": string, "items": string[], "answers": string[] }],
    "punctuationSentences": [{ "sentence": string, "answer": string }],
    "writingPrompt": { "sentenceCount": string, "objectNames": string[], "prompts": string[] },
    "materialsByPeriod": [{ "periodNumber": number, "materials": string[] }],
    "requiredTasks": [{
      "taskId": string,
      "label": string,
      "taskType": "startup" | "reading-fluency" | "reading-question" | "memorization" | "vocabulary" | "phonics" | "spelling" | "punctuation" | "sentence-writing" | "composition" | "language-knowledge" | "speaking" | "listening" | "extension" | "other",
      "periodNumber": number,
      "sourceText": string,
      "required": boolean,
      "productKind": "oral" | "written" | "reading" | "memorized" | "answer" | "classification" | "spelling" | "phonics" | "punctuation" | "other",
      "expectedAnswer": string,
      "criteria": string[],
      "sourceEvidence": string[]
    }],
    "uncertain": string[]
  },
  "continuityPlan": {
    "sourceUnits": [{ "unitId": string, "label": string, "kind": string, "page": string, "required": boolean, "allowReuse": boolean, "preferredPeriodNumber": number, "estimatedMinutes": number, "sourceEvidence": string[] }],
    "clusters": [{ "clusterId": string, "label": string, "sourceUnitIds": string[], "periodNumber": number, "mustStayTogether": boolean, "prerequisiteClusterIds": string[], "estimatedMinutes": number, "expectedProduct": string }],
    "warnings": string[]
  },
  "outcomes": ${input.enableDigitalCompetency ? `{ "generalCompetencies": string[], "specificCompetencies": string[], "qualities": string[], "knowledgeAndSkills": string[], "digitalCompetencies": string[] }` : `{ "generalCompetencies": string[], "specificCompetencies": string[], "qualities": string[], "knowledgeAndSkills": string[] }`},
  "materials": { "teacher": string[], "students": string[] },
  "assessment": { "criteria": string[], "evidence": string[], "comments": string[] },
  "contextFit": { "notes": string[] },
  "periods": [{
    "periodNumber": number,
    "focus": string,
    "lessonType": string,
    "objectives": string[],
    "sourceEvidence": string,
    "targetSkills": string[],
    "continuityIn": string,
    "continuityOut": string,
    "activities": [{ "phase": string, "title": string, "objective": string, "durationMinutes": number, "focusSkills": string[], "handoffToNext": string, "sourceTaskIds": string[], "sourceUnitIds": string[], "sourceClusterIds": string[] }]
  }]
}`;
}

export function buildVietnamesePeriodPrompt(
  input: LessonInput,
  ocrText: string,
  blueprint: VietnameseLessonBlueprint,
  period: VietnamesePeriodBlueprint,
  previousHandoff: VietnamesePeriodChunk["handoff"] | null,
): string {
  const style = input.style || "Dạy thật trên lớp";
  const creativeMode = style === "Sáng tạo, sinh động";
  const typeProfile = vietnameseLessonTypeProfiles[period.lessonType || "mixed"];

  return `Bạn là chuyên gia soạn giáo án Tiếng Việt tiểu học. Hãy sinh riêng một tiết theo blueprint đã khóa.

${vietnameseStrictGuidance}

Quy tắc quan trọng:
- Chỉ trả JSON hợp lệ cho một PeriodPlan, không Markdown.
- Bám blueprint; không nghĩ lại mục tiêu.
- Giữ mạch từ previousHandoff sang continuityOut.
- Không dùng từ "OCR".
- Mỗi tiết có đúng 4 hoạt động: Khởi động, Khám phá, Luyện tập, Vận dụng.
- teacherActions/studentActions đi theo từng cặp; mọi teacherActions bắt đầu "GV ...", studentActions bắt đầu "HS ...".
- Kiểm soát độ dài theo ${input.duration} phút: tổng durationMinutes của 4 hoạt động phải là 32 hoặc 33 phút để còn 2–3 phút dự phòng. Gợi ý: 4+15+10+4=33 hoặc 4+14+10+4=32.
- Khởi động 2-3 cặp, Khám phá 4-6 cặp, Luyện tập 3-4 cặp, Vận dụng 2-3 cặp; không thêm hoạt động phụ ngoài 4 pha.

Kiểu bài tiết này: ${typeProfile?.label || period.lessonType || "mixed"}
${typeProfile ? `Chuỗi dạy học bắt buộc:
${typeProfile.mandatorySequence.map((s, i) => `${i + 1}. ${s}`).join("\n")}` : ""}

Quy tắc đặc thù kiểu bài:
- Bắt buộc chép cụ thể ngữ liệu/nhiệm vụ vào giáo án; không chỉ ghi "theo SGK".
- Bắt buộc bao phủ các nhiệm vụ trong sourceInventory.requiredTasks thuộc tiết này; không được bỏ sót nhiệm vụ có dấu sao/chữ nhỏ như học thuộc lòng, đặt câu, viết vào vở hoặc đọc mở rộng.
- Mỗi activity phải gắn sourceTaskIds/sourceUnitIds/sourceClusterIds đúng continuityPlan. Không dùng source unit của tiết khác và không cắt cluster mustStayTogether.
- Đáp án dự kiến, lỗi ngôn ngữ thường gặp và cách sửa phải viết rõ.
- Với đọc hiểu/luyện từ và câu, expectedAnswer phải có ý cốt lõi kèm bằng chứng từ văn bản/câu hỏi nếu ảnh SGK cung cấp; acceptableResponses ghi các cách diễn đạt khác được chấp nhận.
- Mỗi hoạt động chỉ có đúng 1 learningProducts chính, tối đa 2 successCriteria ngắn, không dùng sản phẩm mơ hồ như "bảng tổng hợp" nếu không thật sự lập bảng.
- Mỗi activity.inputOrMaterials chỉ liệt kê học liệu thật sự dùng trong hoạt động đó; không lặp học liệu của tiết khác.
- Chỉ điền supportForStudentsNeedingHelp/extensionForEarlyFinishers ở 1–2 hoạt động trọng tâm (thường Khám phá hoặc Luyện tập); hoạt động không trọng tâm để mảng rỗng.
- Phân hóa phải ngắn và đúng nhiệm vụ: hỗ trợ bằng gợi ý/khung câu; đạt là hoàn thành yêu cầu chính; hoàn thành tốt là mở rộng một ý vừa sức. Không lặp cùng một câu phân hóa ở nhiều hoạt động.
- successCriteria phải đúng loại sản phẩm: đọc đúng-rõ-ngắt nghỉ; trả lời đúng ý-có chi tiết liên quan; chính tả đủ đoạn-đúng chữ-đúng dấu-sạch; âm/vần điền đúng-đọc được; nói đủ ý-rõ câu; viết đủ số câu-trọn ý-đúng dấu câu.
- Không tự động yêu cầu HS lớp 1–2 phân tích hiệu quả nghệ thuật, nhịp, phép lặp hoặc hình ảnh; nếu SGK thật sự cần thì ghi là nhiệm vụ tùy chọn cho rất ít HS.
- Nếu là đọc lớp 1–2, phải có inputOrMaterials chứa câu dài nguyên văn đã đánh dấu "/", giọng đọc, tốc độ đọc, tiếng dễ đọc sai và từ cần nhấn.
- Nếu có bài ch/tr, c/k, ac/at, 6 câu dấu câu hoặc gọi tên đồ vật, expectedAnswer phải ghi đủ từ/cụm/câu/tên đồ vật và đáp án; không viết "GV chốt theo SGK".
- Nếu bài có nhiệm vụ mở rộng ngoài SGK hoặc suy luận thêm của GV, phải ghi rõ "Hoạt động mở rộng của giáo viên:" hoặc "Thực hiện khi còn thời gian:"; không biến nhiệm vụ mở rộng thành yêu cầu cốt lõi của SGK.
- Nếu requiredTask có productKind "written" hoặc taskType "sentence-writing", hoạt động phải thể hiện HS viết vào vở/bảng con/phiếu; nếu chỉ nói miệng thì không dùng tiêu chí viết hoa, dấu câu hoặc chính tả.
- Với tiết nói và nghe/kể chuyện lớp 3, phải có ít nhất hai lượt nghe hoặc kể mẫu phù hợp: lượt 1 nghe/kể để nắm nội dung, lượt 2 nghe/kể để chú ý trình tự, giọng kể hoặc chi tiết chính.
- Sản phẩm học tập phải quan sát được.
${typeProfile ? `- Lỗi thường gặp kiểu bài này:
${typeProfile.commonErrors.map(e => `  + ${e}`).join("\n")}` : ""}
${creativeMode ? "- Có ít nhất một điểm nhấn sáng tạo phù hợp bản chất môn, không làm loãng kĩ năng trọng tâm." : "- Ưu tiên thực tế, dễ dạy."}

Gợi ý cân thời lượng trong 35 phút:
- Đọc thành tiếng lớp 2–3: 10–14 phút cho phần luyện đọc.
- Nghe-viết: 10–13 phút cho phần viết chính; giảm chuẩn bị/kiểm tra chéo nếu cần.
- Viết 3–5 câu: 13–16 phút cho phần lập ý nhanh và viết.
- Sáu câu dấu chấm/dấu chấm hỏi: ít nhất 8–10 phút.
- Bài nối đơn giản: khoảng 6–9 phút.

Khung CTGDPT 2018:
${curriculumGuidance}
${digitalCompetencyInstruction(input)}

Luật Khởi động:
${startupGuidance}

Tiêu chuẩn chất lượng:
${qualityGuidance(input)}

Logic sư phạm Tiếng Việt:
${pedagogyProfileGuidance(input)}

${vietnameseGradeBandGuidance(input)}

Blueprint toàn bài đã khóa:
${JSON.stringify(blueprint)}

Bảng kiểm ngữ liệu SGK đã khóa:
${JSON.stringify(blueprint.sourceInventory || {})}

Tiết cần sinh:
${JSON.stringify(period)}

Kết quả bàn giao từ tiết trước:
${previousHandoff ? JSON.stringify(previousHandoff) : period.continuityIn || "Đây là tiết mở đầu."}

Nội dung ảnh SGK:
${promptOcrContext(ocrText, 10000)}

Schema JSON:
{
  "periodNumber": number,
  "focus": string,
  "outcomes": ${input.enableDigitalCompetency ? `{ "generalCompetencies": string[], "specificCompetencies": string[], "qualities": string[], "knowledgeAndSkills": string[], "digitalCompetencies": string[] }` : `{ "generalCompetencies": string[], "specificCompetencies": string[], "qualities": string[], "knowledgeAndSkills": string[] }`},
  "activities": [{
    "phase": string,
    "title": string,
    "objective": string,
    "durationMinutes": number,
    "teacherActions": string[],
    "studentActions": string[],
    "inputOrMaterials": string[],
    "organization": "individual" | "pair" | "group" | "whole_class",
    "learningProducts": string[],
    "successCriteria": string[],
    "expectedAnswer": string,
    "acceptableResponses": string[],
    "commonErrors": string[],
    "teacherFeedback": string[],
    "supportForStudentsNeedingHelp": string[],
    "extensionForEarlyFinishers": string[],
    "sourceTaskIds": string[],
    "sourceUnitIds": string[],
    "sourceClusterIds": string[],
    "timeBreakdown": { "instructionMinutes": number, "distributionMinutes": number, "thinkingMinutes": number, "workingMinutes": number, "presentationMinutes": number, "feedbackMinutes": number, "consolidationMinutes": number, "transitionMinutes": number, "flexibleMinutes": number }
  }],
  "handoff": { "learned": string, "unresolvedRisks": string[], "nextBridge": string }
}`;
}

export function buildVietnamesePeriodRepairPrompt(
  input: LessonInput,
  blueprint: VietnameseLessonBlueprint,
  period: VietnamesePeriodChunk,
  issues: string[],
): string {
  const typeProfile = vietnameseLessonTypeProfiles[
    blueprint.periods?.find(p => p.periodNumber === period.periodNumber)?.lessonType || "mixed"
  ];

  return `PeriodPlan Tiếng Việt sau chưa đạt. Hãy sửa riêng tiết này, không viết lại toàn bộ bài.

${vietnameseStrictGuidance}

Chỉ trả JSON hợp lệ theo schema PeriodPlan + handoff. Không Markdown.

Blueprint toàn bài:
${JSON.stringify(blueprint)}

Bảng kiểm ngữ liệu SGK:
${JSON.stringify(blueprint.sourceInventory || {})}

Các lỗi cần sửa:
${issues.map(issue => `- ${issue}`).join("\n")}

Yêu cầu sửa:
- Giữ periodNumber và focus.
- Giữ ngữ liệu và bài tập cụ thể; không thay đổi kiểu bài.
- Giữ sourceTaskIds/sourceUnitIds/sourceClusterIds đúng continuityPlan; không chuyển cluster sang tiết khác và không tách cluster mustStayTogether.
- Có đúng 4 hoạt động: Khởi động, Khám phá, Luyện tập, Vận dụng.
- teacherActions/studentActions đi theo từng cặp, bắt đầu "GV ..." và "HS ...".
- Rút số bước nếu quá dài.
- Không dùng từ "OCR".
- Chỉ sửa đúng lỗi được liệt kê; không nhồi thêm kĩ năng không liên quan.
- YCCĐ knowledgeAndSkills nếu phải sửa thì dùng 4–6 câu ngắn, bắt đầu bằng động từ đo được: Đọc; Hiểu; Tìm; Xác định; Sắp xếp; Nêu; Lựa chọn; Đặt câu; Viết; Tự sửa.
- Năng lực chung chỉ 1–2 biểu hiện thật trong hoạt động; năng lực đặc thù khái quát đọc/viết/nói-nghe, không chép lại kiến thức, kĩ năng.
- Mỗi hoạt động giữ đúng 1 sản phẩm chính; nếu learningProducts rỗng hoặc mơ hồ, thay bằng sản phẩm quan sát được gắn với nhiệm vụ.
- Nếu lỗi TV-COVERAGE báo thiếu nhiệm vụ SGK, phải sửa trong 4 hoạt động hiện có bằng cách thêm/chỉnh bước GV-HS, sản phẩm và tiêu chí; không tạo bảng ma trận trong Word và không đổi form giáo án.
- Nếu thiếu học thuộc lòng, thêm hoạt động hoặc bước luyện thuộc: đọc nhẩm, nhìn từ khóa, che dần dòng, luyện theo cặp, đọc thuộc trước lớp.
- Nếu thiếu câu hỏi/đáp án, chép nguyên văn câu hỏi và đáp án dự kiến vào bước đọc hiểu/chốt đáp án.
- Chỉ giữ phân hóa ở 1–2 hoạt động trọng tâm; hoạt động còn lại để supportForStudentsNeedingHelp và extensionForEarlyFinishers là mảng rỗng.
- Tiêu chí phải theo đúng sản phẩm: đọc, trả lời, chính tả, âm/vần, nói hoặc viết; không dùng cùng một tiêu chí cho mọi nhiệm vụ.
- Nếu lỗi liên quan học liệu/đáp án, phải chép rõ từ/cụm/câu/tên đồ vật/đáp án cụ thể từ sourceInventory hoặc ảnh SGK. Nếu chưa chắc, không bịa và không dùng các cụm "cần GV xác minh", "OCR chưa rõ", "kiểm tra lại SGK"; dùng ghi chú trung tính "Ghi chú chuẩn bị: GV đối chiếu ảnh SGK trước giờ dạy." khi thật sự cần.
- Với lớp 1–2, bỏ yêu cầu phân tích sâu hiệu quả nghệ thuật/nhịp/phép lặp nếu không có trong SGK.
${typeProfile ? `- Kiểu bài: ${typeProfile.label}. Không thêm ${typeProfile.checkerNotRequired.join(", ")} nếu không phải trọng tâm.` : ""}
${digitalCompetencyInstruction(input)}
- Cá nhân hóa: ${JSON.stringify({ grade: input.grade, environment: input.teachingEnvironment, facilities: input.facilities, locality: localityContext(input), style: input.style })}

PeriodPlan cần sửa:
${JSON.stringify(period)}

Schema JSON:
{
  "periodNumber": number,
  "focus": string,
  "outcomes": ${input.enableDigitalCompetency ? `{ "generalCompetencies": string[], "specificCompetencies": string[], "qualities": string[], "knowledgeAndSkills": string[], "digitalCompetencies": string[] }` : `{ "generalCompetencies": string[], "specificCompetencies": string[], "qualities": string[], "knowledgeAndSkills": string[] }`},
  "activities": [{
    "phase": string,
    "title": string,
    "objective": string,
    "durationMinutes": number,
    "teacherActions": string[],
    "studentActions": string[],
    "inputOrMaterials": string[],
    "organization": "individual" | "pair" | "group" | "whole_class",
    "learningProducts": string[],
    "successCriteria": string[],
    "expectedAnswer": string,
    "acceptableResponses": string[],
    "commonErrors": string[],
    "teacherFeedback": string[],
    "supportForStudentsNeedingHelp": string[],
    "extensionForEarlyFinishers": string[],
    "sourceTaskIds": string[],
    "sourceUnitIds": string[],
    "sourceClusterIds": string[],
    "timeBreakdown": { "instructionMinutes": number, "distributionMinutes": number, "thinkingMinutes": number, "workingMinutes": number, "presentationMinutes": number, "feedbackMinutes": number, "consolidationMinutes": number, "transitionMinutes": number, "flexibleMinutes": number }
  }],
  "handoff": { "learned": string, "unresolvedRisks": string[], "nextBridge": string }
}`;
}
