import { getPedagogyProfile, gradeBandFor } from "./pedagogy-profiles";
import type {
  LessonInput,
  LessonPlan,
  LessonOutcomes,
  MathLessonBlueprint,
  MathPeriodBlueprint,
  MathPeriodChunk,
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
- Phai chon mot hinh thuc sinh dong phu hop noi dung bai: hat/van dong theo nhip, tro choi nhanh, cau do, o chu, quan sat tranh/video, do vat that, thi nghiem mini, dong vai. Chi dung ten STEM/STEAM neu hoat dong thuc su co yeu to thiet ke/giai quyet van de/thu nghiem san pham phu hop mon hoc.
- Hoat dong phai bam noi dung anh SGK/trang sach da upload va dan tu nhien vao bai hoc, khong vui cho co.
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

export const mathTranscribeGuidance = `Quy tắc bắt buộc – Viết lại nội dung toán cụ thể từ ảnh SGK vào giáo án:
- Phép tính: viết rõ từng phép tính, ví dụ "2 + 3 = ...", "15 - 7 = ...", "6 + 3 ... 10 - 3" (so sánh). KHÔNG viết "HS làm bài tập trong SGK".
- Bài toán có lời văn: viết rõ đề bài, dữ kiện, câu hỏi vào teacherActions.
- Công thức: viết rõ công thức toán, ví dụ "S = a × b", "P = (a + b) × 2". KHÔNG chỉ nói "GV chốt công thức".
- Hình học: mô tả hình kèm nhãn và kích thước. VD: "Hình chữ nhật ABCD, chiều dài 5 cm, chiều rộng 3 cm".
- Bài giải mẫu: viết từng bước giải với số liệu cụ thể từ SGK vào teacherActions/studentActions.
- Đáp án dự kiến: ghi rõ kết quả số. KHÔNG viết "HS tính ra kết quả".
- Nối/ghép: liệt kê rõ các phép tính và kết quả tương ứng.
- ĐẶT TÍNH VÀ PHÉP TÍNH DỌC: Nếu SGK sử dụng phép tính dọc (đặt tính thẳng cột) hoặc bài học yêu cầu "đặt tính rồi tính", giáo án bắt buộc phải ghi rõ phép tính dọc đó bằng cách sử dụng các dòng mới (\\n) và các khoảng trắng thụt lề để căn chỉnh thẳng hàng thẳng cột chữ số ở các hàng (hàng đơn vị thẳng hàng đơn vị, dấu phẩy thẳng dấu phẩy, đường gạch ngang thay cho dấu bằng). Đảm bảo hiển thị giống hệt trong sách. Ví dụ:
  1,65
+ 1,26
------
  2,91
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
  if (/^(toán|toan)$/i.test((input.subject || "").trim())) {
    return "Bạn là chuyên gia Toán tiểu học. Chỉ trả JSON hợp lệ. Quy trình bắt buộc: biểu diễn/tóm tắt trực quan → phân tích dữ kiện, quan hệ → chọn phép tính/quy trình có lý do → giải → kiểm tra ngược bằng dữ kiện ban đầu. Viết rõ mọi phép tính, công thức, hình học, bài giải mẫu và đáp án dự kiến vào giáo án; không tham chiếu SGK chung chung. Đặc biệt, với các bài toán yêu cầu đặt tính rồi tính (phép tính dọc như cộng, trừ, nhân, chia số tự nhiên/thập phân), hãy thể hiện dạng dọc bằng cách sử dụng các dòng mới và khoảng trắng căn lề để các chữ số, dấu phẩy thẳng cột, ví dụ:\n  5,4\n+ 3,9\n-----\n 8,13\n(đảm bảo các chữ số và dấu gạch ngang được xếp thẳng cột tương ứng).";
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
- Nếu user để trống tên bài, hãy tự nhận diện đầy đủ số bài và tên bài từ ảnh SGK/trang sách. Ví dụ phải ghi "Bài 9. Chăm sóc và giúp đỡ em nhỏ" nếu ảnh thể hiện Bài 9; không được bỏ số bài khi ảnh có số bài.
- Nếu user có nhập tên bài nhưng thiếu số bài, hãy bổ sung số bài từ ảnh SGK nếu nhận diện được.
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
  return `\nTÍCH HỢP NĂNG LỰC SỐ (Theo Thông tư 02/2026/TT-BGDĐT Bậc 1 - Tiểu học):
Vì người dùng bật tùy chọn tích hợp Năng lực số, bạn bắt buộc phải chọn 1-2 năng lực số Bậc 1 phù hợp nhất từ Khung năng lực số người học cấp Tiểu học dưới đây để đưa vào mảng "digitalCompetencies" trong "outcomes" (nếu không chọn được năng lực nào phù hợp thì trả về mảng rỗng).
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

Mỗi năng lực số lựa chọn phải được viết cụ thể gắn với hoạt động của bài học. Định dạng chuỗi trong mảng: "Năng lực số ([Mã năng lực]): [Yêu cầu cụ thể]". Ví dụ: "Năng lực số (4.1): Nhận biết cách tắt máy tính đúng cách để bảo vệ thiết bị khỏi bị hỏng hóc."`;
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
- Nhận diện đầy đủ số bài và tên bài nếu ảnh SGK có thể hiện.
- Chỉ trả JSON hợp lệ, không Markdown.
- Không dùng từ "OCR"; dùng "ảnh SGK", "tranh trong SGK" hoặc "trang sách".
- periodPlans phải đủ đúng ${input.periods} tiết; mỗi tiết có 4 pha theo thứ tự: Khởi động, Khám phá, Luyện tập, Vận dụng.
- Mỗi tiết có trọng tâm riêng, không lặp nguyên mục tiêu.
- Mỗi pha cần có handoffToNext để request sau nối mạch.
- mathCore phải nêu rõ dạng toán, kiến thức trọng tâm, biểu diễn/tóm tắt, lỗi sai thường gặp và cách kiểm tra ngược.
- Nội dung toán cụ thể từ ảnh SGK (phép tính, bài toán, công thức, hình) phải được ghi nhận vào mathCore.knowledgeFocus và periods[].activities[].mathFocus để các bước sau viết rõ vào giáo án.

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
  "outcomes": ${input.enableDigitalCompetency ? `{ "generalCompetencies": string[], "specificCompetencies": string[], "qualities": string[], "knowledgeAndSkills": string[], "digitalCompetencies": string[] }` : `{ "generalCompetencies": string[], "specificCompetencies": string[], "qualities": string[], "knowledgeAndSkills": string[] }`},
  "materials": { "teacher": string[], "students": string[] },
  "assessment": { "criteria": string[], "evidence": string[], "comments": string[] },
  "contextFit": { "notes": string[] },
  "periods": [{
    "periodNumber": number,
    "focus": string,
    "objectives": string[],
    "prerequisite": string,
    "targetKnowledge": string,
    "continuityIn": string,
    "continuityOut": string,
    "activities": [{ "phase": string, "title": string, "objective": string, "durationMinutes": number, "mathFocus": string, "handoffToNext": string }]
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
  "activities": [{ "phase": string, "title": string, "objective": string, "durationMinutes": number, "teacherActions": string[], "studentActions": string[], "learningProducts": string[] }],
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
- Có đúng 4 hoạt động: Khởi động, Khám phá, Luyện tập, Vận dụng.
- teacherActions/studentActions đi theo từng cặp, bắt đầu bằng "GV ..." và "HS ...".
- Thêm rõ biểu diễn/tóm tắt, dữ kiện-yêu cầu-quan hệ, phép tính/quy trình, lỗi sai thường gặp và kiểm tra kết quả.
- Rút số bước nếu quá dài: Khởi động 2-3 cặp, Khám phá 4-6 cặp, Luyện tập 3-4 cặp, Vận dụng 2-3 cặp.
- Không dùng từ "OCR".
- Cá nhân hóa theo bối cảnh: ${JSON.stringify({ grade: input.grade, environment: input.teachingEnvironment, facilities: input.facilities, locality: localityContext(input), style: input.style })}
${digitalCompetencyInstruction(input)}

PeriodPlan cần sửa:
${JSON.stringify(period)}

Schema JSON:
{
  "periodNumber": number,
  "focus": string,
  "outcomes": ${input.enableDigitalCompetency ? `{ "generalCompetencies": string[], "specificCompetencies": string[], "qualities": string[], "knowledgeAndSkills": string[], "digitalCompetencies": string[] }` : `{ "generalCompetencies": string[], "specificCompetencies": string[], "qualities": string[], "knowledgeAndSkills": string[] }`},
  "activities": [{ "phase": string, "title": string, "objective": string, "durationMinutes": number, "teacherActions": string[], "studentActions": string[], "learningProducts": string[] }],
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
