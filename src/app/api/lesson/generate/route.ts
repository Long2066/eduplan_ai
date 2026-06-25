import { NextResponse } from "next/server";
import { incrementGenerationUsage, lessonExpiresAt, requireUser } from "@/lib/auth-server";
import { getFirebaseDb } from "@/lib/firebase-admin";
import { activityMinutes, pairedActivityActions, phaseKey, requiredActivityPhases } from "@/lib/lesson-format";
import { getPedagogyProfile, gradeBandFor } from "@/lib/pedagogy-profiles";
import type { LessonInput, LessonOutcomes, LessonPlan, PedagogyAudit, UploadedAsset } from "@/types/lesson";

type GenerateResponse = {
  lesson?: LessonPlan;
  lessonId?: string;
  error?: string;
  stage?: "ocr" | "openai" | "unknown";
  ocrTextLength?: number;
  pedagogyAudit?: PedagogyAudit;
  modelRouting?: {
    primaryModel: string;
    modelUsed: string;
    fallbackUsed: boolean;
  };
};

const OPENAI_TRANSIENT_RETRIES = 2;
const OPENAI_OCR_BATCH_SIZE = Number(process.env.OPENAI_OCR_BATCH_SIZE || 3);
const OPENAI_OCR_MODEL = process.env.OPENAI_OCR_MODEL || "gpt-4.1-mini";
const OPENAI_DEFAULT_MODEL = "gpt-5.4-mini";
const OPENAI_FALLBACK_MODEL = process.env.OPENAI_FALLBACK_MODEL || "gpt-5.4-mini";
const OPENAI_REQUEST_TIMEOUT_MS = Number(process.env.OPENAI_REQUEST_TIMEOUT_MS || 120000);

const curriculumGuidance = `Can cu CTGDPT 2018:
- Muc tieu la phat trien pham chat va nang luc, khong day theo loi truyen thu mot chieu.
- Pham chat chu yeu can gan dung bai hoc: yeu nuoc, nhan ai, cham chi, trung thuc, trach nhiem.
- Nang luc chung can the hien qua hoat dong: tu chu va tu hoc; giao tiep va hop tac; giai quyet van de va sang tao.
- Hoat dong hoc tap phai co: kham pha van de, luyen tap, thuc hanh/van dung vao doi song; co the dung tro choi, dong vai, du an nho, thao luan nhom, quan sat tranh/ngu lieu, san pham hoc tap.
- Giao vien dong vai tro to chuc, huong dan, tao tinh huong co van de; hoc sinh duoc tu thuc hien nhiem vu, trao doi, bao cao, phan hoi.
- Danh gia dua tren qua trinh va san pham hoc tap, ket hop tu danh gia, danh gia dong dang va nhan xet cua giao vien.`;

const startupGuidance = `Quy tac bat buoc cho hoat dong Khoi dong:
- Khoi dong luon la hoat dong toan lop, tao hung thu cho da so hoc sinh; khong duoc chi viet "GV gioi thieu bai".
- Phai chon mot hinh thuc sinh dong phu hop noi dung bai: hat/van dong theo nhip, tro choi nhanh, cau do, o chu, quan sat tranh/video, do vat that, thi nghiem mini, dong vai. Chi dung ten STEM/STEAM neu hoat dong thuc su co yeu to thiet ke/giai quyet van de/thu nghiem san pham phu hop mon hoc.
- Hoat dong phai bam noi dung anh SGK/trang sach da upload va dan tu nhien vao bai hoc, khong vui cho co.
- Bat buoc co: ten hoat dong hap dan, hinh thuc toan lop, thoi luong 3-5 phut, do dung, luat choi/cach to chuc, cau hoi goi mo, du kien cau tra loi cua hoc sinh, loi chot chuyen y cua giao vien.
- Neu la Toan/Khoa hoc/Cong nghe/Tin hoc, uu tien thu thach STEM ngan, du doan hien tuong/ket qua, ghep the, do nhanh, tim quy luat hoac giai ma.
- Neu la Tieng Viet/Ngu van/Ngoai ngu, uu tien tranh, am thanh, cau do, nhan vat bi mat, doc dien cam, ghep tu khoa hoac tro choi ngon ngu.
- Neu la Dao duc/GDCD/Hoat dong trai nghiem, uu tien tinh huong, dong vai, binh chon hanh vi, the cam xuc hoac goc y kien.
- Neu la Am nhac/Mi thuat, uu tien cam thu, van dong, quan sat, sang tao nhanh.
- Tuyet doi khong tao tro choi tach roi bai hoc hoac chi vui ma khong phuc vu muc tieu bai.`;

const creativeTeachingGuidance = `Che do Giao an sang tao/du gio:
- Giao an phai co chat luong tuong duong giao an thi giang/du gio, khong viet kieu hanh chinh so sai.
- Duoc phep sang tao hoc lieu ngoai SGK nhu video AI ngan, tranh dong, nhan vat hoat hinh, hop bi mat, the tin hieu, tro choi van dong, tinh huong dong vai, slide tuong tac, thu thach STEM/STEAM dung ban chat, mien la bam muc tieu bai hoc va phu hop lua tuoi.
- Anh SGK/trang sach user upload la noi dung loi; hoat dong co the mo rong bang tinh huong doi song, tro choi, hinh anh, cau chuyen, video hoac nhiem vu trai nghiem.
- Moi hoat dong phai viet nhu kich ban day that: GV noi gi, chieu gi, hoi gi, giao nhiem vu gi; HS quan sat/lam gi/tra loi ra sao; GV nhan xet va chot gi.
- Khong dung cau chung chung nhu "GV to chuc tro choi", "HS thao luan", "GV nhan xet". Phai neu ro ten tro choi, luat choi, cau hoi, du kien cau tra loi va ket luan.
- Voi lop nho, uu tien hoat dong co cam xuc, cu chi, tin hieu co the, tranh/video, cau noi de nho.
- Moi bai can co it nhat mot diem sang tao noi bat giup giao vien co the dung khi du gio.`;

const deepTeachingScriptGuidance = `Tieu chuan viet giao an level cao:
- Khong viet theo kieu khung hanh chinh ngan gon. Moi hoat dong phai la kich ban day hoc co the cam len day ngay.
- Moi hoat dong phai co 3 lop noi dung: tinh huong/mo neo cam xuc, cach to chuc tung buoc, va loi chot/chuyen y cua giao vien.
- Moi hoat dong phai dung it nhat 1 ky thuat day hoc cu the phu hop: tro choi co ten va luat, khan trai ban, manh ghep, phong tranh, the tin hieu, dong vai, du doan, thu thach nhom, phieu nhiem vu, hop bi mat, goc y kien, tranh/video kich thich; chi goi STEM/STEAM khi dung ban chat hoat dong.
- Khong duoc ghi chung chung: "GV to chuc", "HS thao luan", "GV nhan xet". Phai viet ro GV noi/hoi/chieu/phat/giao viec gi; HS du kien noi/lam/ghi/san pham gi.
- Moi pha phai co cau hoi goi mo, du kien cau tra loi dung/sai thuong gap, cach GV xu ly sai lech va loi chot kien thuc.
- Luyen tap phai co bai tap/nhiem vu/luat choi cu the bam noi dung anh SGK/trang sach; Van dung phai gan voi doi song that cua hoc sinh; Danh gia phai co tieu chi quan sat duoc va minh chung.
- Giua cac tiet khong lap lai mot cong thuc khoi dong; moi tiet can mot cach vao bai rieng, co bat ngo hoac moi cam xuc.`;

function qualityGuidance(input: LessonInput) {
  if (input.style === "Cơ bản") {
    return `Phong cach: Co ban. Giao an gon, de dung, du cau truc CV2345; moi hoat dong co muc tieu, cach to chuc ro, san pham hoc tap va toi thieu 4 cap GV/HS dong bo.`;
  }
  if (input.style === "Sáng tạo, sinh động") {
    return `Phong cach: Sang tao, sinh dong. Giao an can giau y tuong, co tro choi/hoc lieu/ky thuat day hoc hap dan, tinh huong gan doi song, cau hoi goi mo, du kien phan hoi va loi chot ro.\n${deepTeachingScriptGuidance}`;
  }
  return `Phong cach: Day that tren lop. Giao an thuc te, de trien khai, viet theo kich ban GV/HS vua du sau; moi hoat dong co tinh huong, cach to chuc tung buoc, cau hoi goi mo, du kien phan hoi va loi chot.`;
}

function bookContext(input: LessonInput) {
  const volume = input.bookVolume && input.bookVolume !== "auto" ? ` - ${input.bookVolume}` : "";
  return `${input.book || "Chưa rõ"}${volume}`;
}

function localityContext(input: LessonInput) {
  const province = input.hometownProvince && input.hometownProvince !== "auto" ? input.hometownProvince : "Auto - không cá nhân hóa theo tỉnh";
  const note = input.localityNote?.trim() ? `; ghi chú địa phương: ${input.localityNote.trim()}` : "";
  return `${province}${note}`;
}

function isLocalLessonContext(input: LessonInput, ocrText: string) {
  return /địa phương|dia phuong|quê hương|que huong|tỉnh em|tinh em|quê em|que em|nơi em sống|noi em song/i.test(
    `${input.subject} ${input.lessonTitle} ${input.specialRequest} ${ocrText}`,
  );
}

function elementaryLocalityGuidance(input: LessonInput, ocrText: string) {
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

function learningContextGuidance(input: LessonInput) {
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

function pedagogyProfileGuidance(input: LessonInput) {
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

function parseDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:(.+);base64,(.+)$/);
  if (!match) return null;
  return { mimeType: match[1], data: match[2] };
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeOpenAiError(raw: string, status?: number) {
  if (status && status >= 500) {
    return "OpenAI đang lỗi tạm thời hoặc quá tải (5xx/Cloudflare). App đã thử lại tự động; vui lòng bấm tạo lại sau ít phút nếu lỗi còn xảy ra.";
  }
  if (/rate.?limit|429/i.test(raw)) {
    return "OpenAI đang bị giới hạn tốc độ/quota. Hãy chờ một lát rồi thử lại hoặc kiểm tra billing/quota của OpenAI key.";
  }
  if (/invalid_api_key|incorrect api key|401|Unauthorized/i.test(raw)) {
    return "OpenAI API key trong .env.local không hợp lệ hoặc không có quyền truy cập model hiện tại.";
  }
  if (/insufficient_quota/i.test(raw)) {
    return "OpenAI key đã hết quota hoặc chưa bật billing. Hãy kiểm tra tài khoản OpenAI.";
  }
  if (/<html|<!DOCTYPE html|cloudflare/i.test(raw)) {
    return "OpenAI trả về trang lỗi HTML từ Cloudflare. Đây thường là lỗi dịch vụ tạm thời, không phải lỗi nội dung giáo án.";
  }
  return raw || `OpenAI failed with ${status || "unknown status"}`;
}

function normalizeOpenAiFetchError(error: unknown, model: string) {
  const message = error instanceof Error ? error.message : String(error || "fetch failed");
  if (/abort|timeout|timed out/i.test(message)) {
    return `OpenAI xử lý quá lâu và đã hết thời gian chờ (${Math.round(OPENAI_REQUEST_TIMEOUT_MS / 1000)} giây) với model ${model}. Nguyên nhân thường là model reasoning cao + giáo án dài. Hãy thử lại, giảm số tiết/ảnh, hoặc dùng fallback model nhanh hơn.`;
  }
  if (/fetch failed|network|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|socket|terminated/i.test(message)) {
    return `Không kết nối ổn định tới OpenAI khi gọi model ${model}. Có thể do mạng/proxy/firewall, OpenAI rớt kết nối, hoặc request quá lâu. Hãy thử lại sau ít phút hoặc đổi sang model nhanh hơn.`;
  }
  return message;
}

type OpenAiMessage = { role: "system" | "user" | "assistant"; content: string };
type OpenAiJsonRequest = {
  model: string;
  temperature: number;
  messages: OpenAiMessage[];
};

function extractResponsesText(data: unknown) {
  const response = data as {
    output_text?: string;
    output?: Array<{ content?: Array<{ text?: string; type?: string }> }>;
  };
  if (response.output_text) return response.output_text;
  return response.output?.flatMap((item) => item.content || []).map((part) => part.text || "").join("\n").trim() || "";
}

async function fetchOpenAiJsonContent(apiKey: string, body: OpenAiJsonRequest) {
  let lastMessage = "OpenAI không phản hồi.";
  for (let attempt = 0; attempt <= OPENAI_TRANSIENT_RETRIES; attempt += 1) {
    const useResponsesApi = /^gpt-5/i.test(body.model);
    const requestBody = useResponsesApi
      ? {
          model: body.model,
          input: body.messages,
          reasoning: { effort: process.env.OPENAI_REASONING_EFFORT || "high" },
          text: { format: { type: "json_object" } },
        }
      : {
          model: body.model,
          response_format: { type: "json_object" },
          temperature: body.temperature,
          messages: body.messages,
        };
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), OPENAI_REQUEST_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(useResponsesApi ? "https://api.openai.com/v1/responses" : "https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });
    } catch (error) {
      lastMessage = normalizeOpenAiFetchError(error, body.model);
      if (attempt < OPENAI_TRANSIENT_RETRIES) {
        await wait(900 * (attempt + 1));
        continue;
      }
      throw new Error(lastMessage);
    } finally {
      clearTimeout(timeout);
    }

    if (response.ok) {
      const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const content = useResponsesApi ? extractResponsesText(data) : data.choices?.[0]?.message?.content || "";
      if (!content) throw new Error("OpenAI không trả về nội dung giáo án.");
      return content;
    }

    const text = await response.text();
    lastMessage = normalizeOpenAiError(text, response.status);
    if (response.status >= 500 && attempt < OPENAI_TRANSIENT_RETRIES) {
      await wait(900 * (attempt + 1));
      continue;
    }
    throw new Error(lastMessage);
  }

  throw new Error(lastMessage);
}

function chunkAssets(assets: UploadedAsset[], size: number) {
  const chunks: UploadedAsset[][] = [];
  for (let index = 0; index < assets.length; index += size) {
    chunks.push(assets.slice(index, index + size));
  }
  return chunks;
}

function imageLabel(asset: UploadedAsset, index: number) {
  return asset.name || `ảnh ${index + 1}`;
}

function sequenceFromFileName(name?: string) {
  const baseName = (name || "").replace(/\.[^.]+$/, "");
  const exactNumber = baseName.match(/^\s*0*(\d+)\s*$/);
  if (exactNumber) return Number(exactNumber[1]);

  const labeledNumber = baseName.match(/(?:^|[\s._-])(?:trang|page|p|sgk|anh|ảnh)?\s*0*(\d+)(?=$|[\s._-])/i);
  return labeledNumber ? Number(labeledNumber[1]) : null;
}

function sortAssetsByFileSequence(assets: UploadedAsset[]) {
  return assets
    .map((asset, uploadIndex) => ({
      asset,
      uploadIndex,
      order: typeof asset.order === "number" && Number.isFinite(asset.order) ? asset.order : null,
      sequence: sequenceFromFileName(asset.name),
    }))
    .sort((a, b) => {
      if (a.order !== null && b.order !== null && a.order !== b.order) return a.order - b.order;
      if (a.order !== null && b.order === null) return -1;
      if (a.order === null && b.order !== null) return 1;
      if (a.sequence !== null && b.sequence !== null && a.sequence !== b.sequence) return a.sequence - b.sequence;
      if (a.sequence !== null && b.sequence === null) return -1;
      if (a.sequence === null && b.sequence !== null) return 1;
      return a.uploadIndex - b.uploadIndex;
    })
    .map((item) => item.asset);
}

function openAiImageContent(asset: UploadedAsset) {
  if (!asset.dataUrl || !parseDataUrl(asset.dataUrl)) return null;
  return {
    type: "input_image",
    image_url: asset.dataUrl,
    detail: "high",
  };
}

async function ocrImagesWithOpenAi(assets: UploadedAsset[], apiKey: string, batchLabel: string) {
  const imageParts = assets.map(openAiImageContent).filter(Boolean);
  if (!imageParts.length) return "";

  let lastMessage = "OpenAI OCR không phản hồi.";
  for (let attempt = 0; attempt <= OPENAI_TRANSIENT_RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), OPENAI_REQUEST_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: OPENAI_OCR_MODEL,
          input: [
            {
              role: "user",
              content: [
                {
                  type: "input_text",
                  text:
                    "Hãy OCR chuẩn các ảnh SGK tiếng Việt theo đúng thứ tự ảnh. Chỉ trích xuất văn bản nhìn thấy trong ảnh, giữ xuống dòng hợp lý, nhận diện tên bài/số bài/yêu cầu cần đạt/nội dung/câu hỏi nếu có. Ngăn cách mỗi ảnh bằng dòng --- HẾT ẢNH ---. Không giải thích và không thêm nội dung ngoài ảnh.",
                },
                ...imageParts,
              ],
            },
          ],
        }),
        signal: controller.signal,
      });
    } catch (error) {
      lastMessage = normalizeOpenAiFetchError(error, OPENAI_OCR_MODEL);
      if (attempt < OPENAI_TRANSIENT_RETRIES) {
        await wait(700 * (attempt + 1));
        continue;
      }
      throw new Error(lastMessage);
    } finally {
      clearTimeout(timeout);
    }

    if (response.ok) {
      const data = await response.json();
      const text = extractResponsesText(data).trim();
      if (text.length >= 20) return text;
      lastMessage = `OpenAI OCR chưa đọc đủ nội dung ở ${batchLabel}. Hãy thử ảnh rõ hơn hoặc crop sát vùng SGK.`;
      throw new Error(lastMessage);
    }

    const text = await response.text();
    lastMessage = normalizeOpenAiError(text, response.status);
    if ((response.status === 429 || response.status >= 500) && attempt < OPENAI_TRANSIENT_RETRIES) {
      await wait(700 * (attempt + 1));
      continue;
    }
    throw new Error(lastMessage);
  }

  throw new Error(lastMessage);
}

async function runOpenAiOcr(input: LessonInput) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Thiếu OPENAI_API_KEY trong file .env.");

  const assets = sortAssetsByFileSequence(input.uploadedAssets.filter((asset) => asset.dataUrl && parseDataUrl(asset.dataUrl)));
  if (!assets.length) return { text: "" };

  const batches = chunkAssets(assets, OPENAI_OCR_BATCH_SIZE);
  const ocrParts: string[] = [];
  console.info("[EduPlan AI] OCR OpenAI started", {
    model: OPENAI_OCR_MODEL,
    imageCount: assets.length,
    batchCount: batches.length,
    order: assets.map((asset, index) => ({ index: index + 1, name: asset.name, order: asset.order, sequence: sequenceFromFileName(asset.name) })),
  });

  for (const [batchIndex, batch] of batches.entries()) {
    const batchLabel = `batch ${batchIndex + 1}/${batches.length}`;
    try {
      console.info("[EduPlan AI] OCR OpenAI batch started", { model: OPENAI_OCR_MODEL, imageCount: batch.length, batchLabel });
      ocrParts.push(await ocrImagesWithOpenAi(batch, apiKey, batchLabel));
    } catch (error) {
      if (batch.length > 1) {
        console.warn("[EduPlan AI] OCR OpenAI batch failed; retrying as single images", { batchLabel, imageCount: batch.length });
        for (const [imageIndex, asset] of batch.entries()) {
          const singleLabel = `${batchLabel} / ${imageLabel(asset, imageIndex)}`;
          try {
            ocrParts.push(await ocrImagesWithOpenAi([asset], apiKey, singleLabel));
          } catch (singleError) {
            const message = singleError instanceof Error ? singleError.message : "OpenAI OCR thất bại với một ảnh.";
            throw new Error(`${message} Ảnh nghi ngờ: ${imageLabel(asset, imageIndex)}.`);
          }
        }
        continue;
      }
      throw error;
    }
  }

  const text = ocrParts.filter(Boolean).join("\n\n--- HẾT BATCH ẢNH ---\n\n").trim();
  if (text.length < 40) {
    throw new Error("OpenAI OCR không đọc được đủ nội dung từ ảnh. Hãy thử ảnh rõ hơn, ít nhiễu hơn hoặc crop sát vùng SGK.");
  }

  console.info("[EduPlan AI] OCR OpenAI completed", { model: OPENAI_OCR_MODEL, textLength: text.length, batchCount: batches.length });
  return { text };
}

function buildPrompt(input: LessonInput, ocrText: string) {
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
- Không dùng câu máy móc "HS thực hiện nhiệm vụ tương ứng..." hoặc "HS phản hồi theo hướng dẫn..." nếu không nói rõ nhiệm vụ nào. Với dòng GV chốt/chuyển ý/giới thiệu hoạt động tiếp theo, cột HS chỉ cần: "HS lắng nghe, ghi nhớ và sẵn sàng chuyển sang hoạt động tiếp theo" hoặc biến thể tự nhiên phù hợp.
- Khởi động thường ngắn gọn; Khám phá thường cần nhiều bước hơn để hình thành kiến thức; Luyện tập/Vận dụng cần đủ bước để giao nhiệm vụ, hỗ trợ, kiểm tra và chốt sản phẩm.
- Mỗi activity phải viết thành kịch bản dạy học sâu: có tình huống mở, cách tổ chức từng bước, kỹ thuật dạy học cụ thể, câu hỏi gợi mở, dự kiến phản hồi HS, xử lý sai lệch, lời chốt GV và sản phẩm học tập.
- teacherActions phải có câu chữ đủ cụ thể để giáo viên dùng được trên lớp: lời dẫn, câu hỏi, hướng dẫn thao tác, phân hóa/hỗ trợ, nhận xét và chuyển ý.
- studentActions phải có phản ứng dự kiến thật: HS quan sát/suy nghĩ/trao đổi/trả lời đúng-sai thường gặp/tạo sản phẩm/nhận xét bạn/tự đánh giá.
- Phần Khởi động bắt buộc là hoạt động toàn lớp trong 3-5 phút, có tên hấp dẫn, luật chơi/cách tổ chức rõ, câu hỏi dẫn dắt, dự kiến phản hồi HS và lời chốt chuyển vào bài; phải đúng mục tiêu bài và sinh động, không vui rời rạc.
- teacherActions phải cụ thể theo trình tự dạy học: lời dẫn của GV, tình huống/câu hỏi gợi mở, giao nhiệm vụ, tổ chức cá nhân/nhóm, dự kiến phản hồi của HS, chốt kiến thức, chuyển ý.
- studentActions phải tương ứng từng bước: quan sát/đọc/nghe, suy nghĩ cá nhân, trao đổi cặp/nhóm, trả lời dự kiến, nhận xét bạn, ghi nhớ/chốt vào vở, tạo sản phẩm.
- Phần Khám phá/hình thành kiến thức bắt buộc phải hấp dẫn: có tình huống có vấn đề gần đời sống hoặc trò chơi/quan sát tranh/đọc ngữ liệu, ít nhất 4 câu hỏi gợi mở, dự kiến câu trả lời đúng/sai thường gặp và lời chốt kiến thức của GV.
${creativeMode ? "- Với phong cách Sáng tạo, sinh động, mỗi tiết phải có ít nhất 2 kỹ thuật/học liệu sáng tạo khác nhau, không lặp công thức giữa các tiết." : "- Ưu tiên tính thực tế, dễ dạy; không cần thêm học liệu cầu kỳ nếu không phù hợp bối cảnh."}
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
${creativeMode ? "- Bắt buộc có ít nhất một điểm sáng tạo nổi bật trong bài học và ghi rõ cách giáo viên triển khai điểm sáng tạo đó." : ""}

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

function periodsForValidation(lesson: LessonPlan) {
  if (lesson.periodPlans?.length) return lesson.periodPlans;
  return [{ periodNumber: 1, focus: "Tiến trình dạy học", activities: lesson.activities || [] }];
}

function periodHasRequiredPhases(activities: LessonPlan["activities"]) {
  const found = new Set(activities.map((activity) => phaseKey(`${activity.phase} ${activity.title}`)).filter(Boolean));
  return requiredActivityPhases.every((phase) => found.has(phase));
}

function hasEqualActionPairs(activity: LessonPlan["activities"][number]) {
  return (
    Array.isArray(activity.teacherActions) &&
    Array.isArray(activity.studentActions) &&
    activity.teacherActions.length === activity.studentActions.length &&
    activity.teacherActions.length > 0
  );
}

function hasWeaklyPairedActions(activity: LessonPlan["activities"][number]) {
  const pairs = pairedActivityActions(activity);
  return pairs.some((pair) => {
    const teacher = pair.teacher.toLowerCase();
    const student = pair.student.toLowerCase();
    const teacherRequiresResponse = /đặt câu hỏi|câu hỏi|yêu cầu|giao nhiệm vụ|hướng dẫn.*(tìm|xác định|viết|làm|thảo luận|trao đổi|đọc|tính|vẽ|lập|hoàn thành)|mời hs|tổ chức.*(thảo luận|trao đổi|làm việc|trình bày)/i.test(teacher);
    const studentHasMatchingAction = /trả lời|nêu|giải thích|chia sẻ|thảo luận|trao đổi|thực hiện|làm|đọc|viết|tìm|xác định|tính|vẽ|lập|hoàn thành|trình bày|báo cáo|nhận xét|ghi|đóng vai|vận dụng/i.test(student);
    const studentOnlyPassive = /^hs\s+(lắng nghe|nghe|quan sát|theo dõi)(\.|$)/i.test(pair.student.trim()) && !studentHasMatchingAction;
    const teacherOnlyCloses = /chốt|kết luận|chuyển\s+(sang|vào|ý)|giới thiệu.*(phần|hoạt động|nội dung)/i.test(teacher);
    const studentUsesGenericFallback = /thực hiện nhiệm vụ tương ứng|phản hồi theo hướng dẫn|trao đổi kết quả và phản hồi/i.test(student);
    return (teacherRequiresResponse && (!studentHasMatchingAction || studentOnlyPassive)) || (teacherOnlyCloses && studentUsesGenericFallback);
  });
}

function maxActionPairsForDuration(activity: LessonPlan["activities"][number], index: number) {
  const minutes = activityMinutes(activity, index);
  const key = phaseKey(`${activity.phase} ${activity.title}`);
  if (key === "Khởi động" || minutes <= 5) return 3;
  if (key === "Vận dụng" && minutes <= 5) return 3;
  if (minutes <= 10) return 4;
  if (minutes <= 17) return 6;
  return 7;
}

function hasTooManyActionPairs(activity: LessonPlan["activities"][number], index: number) {
  return pairedActivityActions(activity).length > maxActionPairsForDuration(activity, index);
}

function hasDetailedOutcomeGroup(outcomes?: Partial<LessonOutcomes>) {
  const groups = [
    outcomes?.knowledgeAndSkills || [],
    outcomes?.generalCompetencies || [],
    outcomes?.specificCompetencies || [],
    outcomes?.qualities || [],
  ];
  return groups.every((items) => items.length > 0 && items.every((item) => item.trim().length >= 34 && /:|biết|thực hiện|trình bày|trao đổi|vận dụng|đề xuất|quan sát|hoàn thành/i.test(item)));
}

function hasDetailedOutcomes(lesson: LessonPlan) {
  return hasDetailedOutcomeGroup(lesson.outcomes);
}

function hasPeriodSpecificOutcomes(lesson: LessonPlan, input?: LessonInput) {
  const expectedPeriods = Number(input?.periods || lesson.generalInfo?.periods || 1);
  if (expectedPeriods <= 1) return true;
  const periods = periodsForValidation(lesson);
  if (periods.length < expectedPeriods) return false;
  const serialized = periods.map((period) => JSON.stringify(period.outcomes || {}));
  const hasMissingOrWeakOutcomes = periods.some((period) => !period.outcomes || !hasDetailedOutcomeGroup(period.outcomes));
  const allSame = new Set(serialized).size <= 1;
  return !hasMissingOrWeakOutcomes && !allSame;
}

function hasLearningContextSignals(lesson: LessonPlan, input: LessonInput) {
  const contextSelected =
    input.teachingEnvironment !== "auto" ||
    input.studentProfile !== "auto" ||
    input.facilities !== "auto" ||
    input.hometownProvince !== "auto" ||
    Boolean(input.localityNote.trim());
  if (!contextSelected) return true;

  const text = JSON.stringify({
    materials: lesson.materials,
    activities: lesson.activities,
    contextFit: lesson.contextFit,
  });
  const facilitySignals =
    /TV|máy chiếu|wifi|bảng tương tác|loa|video|slide|bản đồ số|tranh in|thẻ|vật thật|phiếu học tập|bảng phụ|quan sát thực tế|sân trường|địa phương|nông thôn|thành thị|vùng núi|điểm trường/i;
  return facilitySignals.test(text);
}

function subjectPedagogySignalPattern(subject: string) {
  switch (subject) {
    case "Toán":
      return /sơ đồ|tóm tắt|dữ kiện|phép tính|kiểm tra ngược|đơn vị|phần bằng nhau|bài toán/i;
    case "Tiếng Việt":
      return /đọc|viết|nói|nghe|từ|câu|đoạn|văn bản|ngữ liệu|kể lại|giải nghĩa/i;
    case "Đạo đức":
      return /tình huống|hành vi|ứng xử|đóng vai|cam kết|cảm xúc|hậu quả|việc tốt/i;
    case "Tự nhiên và Xã hội":
      return /quan sát|mô tả|so sánh|phân loại|an toàn|vệ sinh|môi trường|cộng đồng|chăm sóc/i;
    case "Khoa học":
      return /dự đoán|thí nghiệm|quan sát|bằng chứng|kết luận|hiện tượng|kiểm chứng|an toàn/i;
    case "Lịch sử và Địa lí":
      return /bản đồ|lược đồ|tư liệu|thời gian|mốc|sự kiện|địa điểm|vị trí|chú giải|di tích/i;
    case "Tin học":
      return /thực hành|thiết bị|lệnh|tệp|sản phẩm số|an toàn số|thuật toán|thư mục|máy tính/i;
    case "Công nghệ":
      return /vật liệu|công cụ|quy trình|sản phẩm|an toàn|thiết kế|cải tiến|bảo quản|lắp ghép/i;
    case "Giáo dục thể chất":
      return /khởi động|động tác|đội hình|khoảng cách|an toàn|trò chơi vận động|hồi tĩnh|sửa lỗi/i;
    case "Âm nhạc":
      return /nghe|hát|gõ|nhịp|tiết tấu|cao độ|vận động|biểu diễn|cảm xúc/i;
    case "Mĩ thuật":
      return /quan sát|màu|nét|hình|bố cục|chất liệu|sản phẩm|trưng bày|ý tưởng/i;
    case "Hoạt động trải nghiệm":
      return /trải nghiệm|chia sẻ|rút kinh nghiệm|cam kết|tự đánh giá|phân vai|hợp tác|hành động/i;
    default:
      return /tình huống|quan sát|thực hành|sản phẩm|đánh giá|vận dụng/i;
  }
}

function subjectPedagogyText(lesson: LessonPlan) {
  return JSON.stringify({
    outcomes: lesson.outcomes,
    materials: lesson.materials,
    activities: lesson.activities,
    periodPlans: lesson.periodPlans,
    assessment: lesson.assessment,
    contextFit: lesson.contextFit,
  });
}

function subjectPedagogyIssues(lesson: LessonPlan, input: LessonInput) {
  const text = subjectPedagogyText(lesson);
  const issues: string[] = [];

  if (!subjectPedagogySignalPattern(input.subject).test(text)) {
    issues.push(`Giáo án chưa thể hiện rõ dấu hiệu sư phạm đặc trưng của môn ${input.subject}.`);
  }

  if (input.subject === "Toán") {
    if (!/sơ đồ|tóm tắt|bảng|hình vẽ|que tính|mô hình|thẻ|trục số|phần bằng nhau/i.test(text)) {
      issues.push("Môn Toán thiếu biểu diễn/tóm tắt trực quan như sơ đồ, bảng, hình vẽ, mô hình, thẻ hoặc phần bằng nhau.");
    }
    if (!/dữ kiện|yêu cầu|quan hệ|lớn hơn|bé hơn|tổng|hiệu|tỉ số|phép tính|vì sao/i.test(text)) {
      issues.push("Môn Toán thiếu phân tích dữ kiện, yêu cầu, quan hệ giữa các đại lượng hoặc lý do chọn phép tính.");
    }
    if (!/lỗi sai|sai thường gặp|nhầm|kiểm tra|đối chiếu|thử lại|kiểm tra ngược|đơn vị/i.test(text)) {
      issues.push("Môn Toán thiếu dự kiến lỗi sai thường gặp hoặc bước kiểm tra/đối chiếu kết quả, đơn vị.");
    }
  }

  if (input.subject === "Tiếng Việt") {
    if (!/văn bản|ngữ liệu|bài đọc|đoạn|câu|từ|tranh/i.test(text)) {
      issues.push("Môn Tiếng Việt thiếu ngữ liệu cụ thể như văn bản, bài đọc, đoạn, câu, từ hoặc tranh làm điểm tựa.");
    }
    if (!/đọc|đọc mẫu|đọc thầm|đọc nối tiếp|luyện đọc/i.test(text)) {
      issues.push("Môn Tiếng Việt thiếu hoạt động đọc/luyện đọc phù hợp.");
    }
    if (!/viết|đặt câu|viết đoạn|chính tả|luyện từ|dấu câu|sửa lỗi/i.test(text)) {
      issues.push("Môn Tiếng Việt thiếu hoạt động viết, luyện từ/câu, chính tả hoặc sửa lỗi ngôn ngữ.");
    }
    if (!/nói|nghe|trao đổi|kể lại|chia sẻ|trình bày|đóng vai/i.test(text)) {
      issues.push("Môn Tiếng Việt thiếu hoạt động nói-nghe hoặc chia sẻ/trình bày.");
    }
    if (!/bằng chứng|dòng|đoạn|chi tiết|ý chính|cảm nhận|giải nghĩa/i.test(text)) {
      issues.push("Môn Tiếng Việt thiếu câu hỏi đọc hiểu có bằng chứng, chi tiết, ý chính, cảm nhận hoặc giải nghĩa từ trong ngữ cảnh.");
    }
  }

  if (input.subject === "Tự nhiên và Xã hội") {
    if (!/quan sát|tranh|vật thật|mô hình|sân trường|gia đình|trường học|cộng đồng/i.test(text)) {
      issues.push("Môn Tự nhiên và Xã hội thiếu hoạt động quan sát từ tranh, vật thật, mô hình hoặc môi trường gần gũi.");
    }
    if (!/mô tả|so sánh|giống|khác|phân loại|tiêu chí|đặc điểm/i.test(text)) {
      issues.push("Môn Tự nhiên và Xã hội thiếu nhiệm vụ mô tả, so sánh hoặc phân loại theo tiêu chí đơn giản.");
    }
    if (!/an toàn|vệ sinh|chăm sóc|bảo vệ|môi trường|việc nên làm|thực hiện ở nhà|thực hiện ở trường/i.test(text)) {
      issues.push("Môn Tự nhiên và Xã hội thiếu liên hệ hành vi thực tế như an toàn, vệ sinh, chăm sóc bản thân hoặc bảo vệ môi trường.");
    }
  }

  if (input.subject === "Khoa học") {
    if (!/câu hỏi|vấn đề|hiện tượng|dự đoán|phỏng đoán/i.test(text)) {
      issues.push("Môn Khoa học thiếu câu hỏi/vấn đề khám phá hoặc bước dự đoán trước khi kết luận.");
    }
    if (!/thí nghiệm|thực hành|quan sát|kiểm chứng|vật liệu|dụng cụ|an toàn/i.test(text)) {
      issues.push("Môn Khoa học thiếu hoạt động quan sát/thí nghiệm/thực hành có dụng cụ, vật liệu hoặc quy tắc an toàn.");
    }
    if (!/bằng chứng|kết quả|ghi lại|bảng|phiếu|so sánh dự đoán|kết luận/i.test(text)) {
      issues.push("Môn Khoa học thiếu ghi nhận bằng chứng/kết quả và rút ra kết luận dựa trên quan sát hoặc thí nghiệm.");
    }
    if (!/vận dụng|sức khỏe|môi trường|tiết kiệm|đời sống|gia đình|trường học/i.test(text)) {
      issues.push("Môn Khoa học thiếu vận dụng kiến thức vào sức khỏe, môi trường, tiết kiệm hoặc đời sống hằng ngày.");
    }
  }

  if (input.subject === "Lịch sử và Địa lí") {
    const hasHistorySignals = /thời gian|mốc|trước|sau|sự kiện|nhân vật|diễn biến|nguyên nhân|kết quả|ý nghĩa/i.test(text);
    const hasGeographySignals = /vị trí|địa điểm|vùng|miền|đặc điểm|tự nhiên|dân cư|đời sống|môi trường/i.test(text);
    if (!/bản đồ|lược đồ|tranh tư liệu|tư liệu|hình ảnh|chú giải|ký hiệu/i.test(text)) {
      issues.push("Môn Lịch sử và Địa lí thiếu bản đồ/lược đồ/tranh tư liệu hoặc nhiệm vụ đọc ký hiệu, chú giải, tư liệu.");
    }
    if (!hasHistorySignals && !hasGeographySignals) {
      issues.push("Môn Lịch sử và Địa lí thiếu trục phân tích Lịch sử hoặc Địa lí: mốc/sự kiện/ý nghĩa hoặc vị trí/đặc điểm/đời sống.");
    }
    if (!/địa phương|quê hương|hiện nay|trách nhiệm|bảo vệ|di sản|môi trường/i.test(text)) {
      issues.push("Môn Lịch sử và Địa lí thiếu liên hệ hiện nay, địa phương, di sản, môi trường hoặc trách nhiệm của học sinh.");
    }
  }

  if (input.subject === "Đạo đức") {
    if (!/tình huống|câu chuyện|tranh|nhân vật|việc làm|hành vi/i.test(text)) {
      issues.push("Môn Đạo đức thiếu tình huống/câu chuyện/tranh hoặc hành vi cụ thể để học sinh phân tích.");
    }
    if (!/cảm xúc|hậu quả|vì sao|nên|không nên|lựa chọn|ứng xử/i.test(text)) {
      issues.push("Môn Đạo đức thiếu phân tích cảm xúc, hậu quả, lựa chọn hành vi hoặc lý do nên/không nên.");
    }
    if (!/đóng vai|xử lí tình huống|thảo luận|góc ý kiến|bày tỏ|chia sẻ/i.test(text)) {
      issues.push("Môn Đạo đức thiếu hoạt động thực hành như đóng vai, xử lí tình huống, bày tỏ ý kiến hoặc thảo luận.");
    }
    if (!/cam kết|việc làm|hành động nhỏ|thực hiện|ở nhà|ở lớp|ở trường/i.test(text)) {
      issues.push("Môn Đạo đức thiếu cam kết/hành động nhỏ sau bài học gắn với gia đình, lớp hoặc trường.");
    }
  }

  if (input.subject === "Hoạt động trải nghiệm") {
    if (!/trải nghiệm|trò chơi|tình huống|hoạt động nhóm|nhiệm vụ|thử thách/i.test(text)) {
      issues.push("Hoạt động trải nghiệm thiếu hoạt động trải nghiệm ban đầu như trò chơi, tình huống, nhiệm vụ hoặc thử thách nhóm.");
    }
    if (!/chia sẻ|cảm xúc|khó khăn|điều học được|rút kinh nghiệm|lần sau/i.test(text)) {
      issues.push("Hoạt động trải nghiệm thiếu bước chia sẻ cảm xúc, rút kinh nghiệm hoặc nêu điều học được sau trải nghiệm.");
    }
    if (!/cam kết|kế hoạch|hành động|việc làm|tự đánh giá|đánh giá bạn|nhật ký/i.test(text)) {
      issues.push("Hoạt động trải nghiệm thiếu cam kết/kế hoạch hành động và tự đánh giá hoặc đánh giá đồng đẳng.");
    }
    if (!/phân vai|nhóm trưởng|thư ký|báo cáo|hợp tác|quy tắc an toàn/i.test(text)) {
      issues.push("Hoạt động trải nghiệm thiếu phân vai, hợp tác nhóm hoặc quy tắc an toàn khi tổ chức hoạt động.");
    }
  }

  if (input.subject === "Tin học") {
    if (!/thiết bị|máy tính|chuột|bàn phím|phần mềm|tệp|thư mục|màn hình/i.test(text)) {
      issues.push("Môn Tin học thiếu thao tác hoặc đối tượng số cụ thể như thiết bị, phần mềm, tệp, thư mục, chuột, bàn phím.");
    }
    if (!/thực hành|nhiệm vụ|sản phẩm số|tạo|lưu|mở|nhập|kéo thả|kiểm tra sản phẩm/i.test(text)) {
      issues.push("Môn Tin học thiếu nhiệm vụ thực hành hoặc sản phẩm số có tiêu chí kiểm tra.");
    }
    if (!/lệnh|thuật toán|trình tự|bước|lặp|điều kiện|sơ đồ|thẻ lệnh/i.test(text)) {
      issues.push("Môn Tin học thiếu yếu tố tư duy thuật toán hoặc trình tự thao tác/lệnh phù hợp bài học.");
    }
    if (!/an toàn số|thông tin cá nhân|mật khẩu|chia sẻ|nguồn|bản quyền|ứng xử/i.test(text)) {
      issues.push("Môn Tin học thiếu nội dung an toàn số, thông tin cá nhân, nguồn/bản quyền hoặc ứng xử văn minh khi phù hợp.");
    }
  }

  if (input.subject === "Công nghệ") {
    if (!/nhu cầu|vấn đề|công dụng|sản phẩm|đồ dùng|thiết kế/i.test(text)) {
      issues.push("Môn Công nghệ thiếu nhu cầu/vấn đề công nghệ, công dụng hoặc sản phẩm cần thiết kế/sử dụng.");
    }
    if (!/vật liệu|công cụ|dụng cụ|quy trình|bước làm|lắp ghép|chăm sóc|bảo quản/i.test(text)) {
      issues.push("Môn Công nghệ thiếu vật liệu, công cụ, quy trình hoặc bước thực hành cụ thể.");
    }
    if (!/an toàn|tiết kiệm|cẩn thận|vệ sinh|phân công|vai trò/i.test(text)) {
      issues.push("Môn Công nghệ thiếu quy tắc an toàn, tiết kiệm vật liệu, vệ sinh hoặc phân công vai trò.");
    }
    if (!/tiêu chí|đánh giá sản phẩm|kiểm tra|thử nghiệm|cải tiến|trưng bày/i.test(text)) {
      issues.push("Môn Công nghệ thiếu tiêu chí đánh giá, kiểm tra/thử nghiệm hoặc cải tiến sản phẩm.");
    }
  }

  if (input.subject === "Giáo dục thể chất") {
    if (!/khởi động|làm nóng|xoay khớp|ép dẻo|hồi tĩnh|thả lỏng/i.test(text)) {
      issues.push("Môn Giáo dục thể chất thiếu khởi động an toàn hoặc hồi tĩnh/thả lỏng cuối tiết.");
    }
    if (!/làm mẫu|động tác|kỹ thuật|tư thế|tay|chân|thân người|nhịp/i.test(text)) {
      issues.push("Môn Giáo dục thể chất thiếu làm mẫu, điểm kỹ thuật hoặc hướng dẫn sửa động tác.");
    }
    if (!/đội hình|hàng|cự ly|khoảng cách|sân bãi|dụng cụ|an toàn/i.test(text)) {
      issues.push("Môn Giáo dục thể chất thiếu đội hình, cự ly/khoảng cách, sân bãi, dụng cụ hoặc quy tắc an toàn.");
    }
    if (!/trò chơi vận động|luật chơi|lượt chơi|thi đua|hợp tác|cổ vũ/i.test(text)) {
      issues.push("Môn Giáo dục thể chất thiếu trò chơi vận động hoặc luật chơi gắn với kỹ năng chính.");
    }
  }

  if (input.subject === "Âm nhạc") {
    if (!/nghe|nghe mẫu|giai điệu|bài hát|âm thanh|cảm xúc/i.test(text)) {
      issues.push("Môn Âm nhạc thiếu hoạt động nghe/cảm thụ âm nhạc hoặc nêu cảm xúc từ giai điệu/bài hát.");
    }
    if (!/hát|luyện hát|lời ca|cao độ|trường độ|tiết tấu|nhịp/i.test(text)) {
      issues.push("Môn Âm nhạc thiếu luyện hát hoặc xử lý cao độ, trường độ, tiết tấu, nhịp.");
    }
    if (!/gõ đệm|vỗ tay|nhạc cụ|vận động|phụ họa|biểu diễn/i.test(text)) {
      issues.push("Môn Âm nhạc thiếu gõ đệm, vận động, phụ họa hoặc biểu diễn.");
    }
    if (!/sáng tạo|sắc thái|lĩnh xướng|nhóm|nhận xét|tự tin/i.test(text)) {
      issues.push("Môn Âm nhạc thiếu yếu tố sáng tạo/thể hiện sắc thái, phối hợp nhóm hoặc nhận xét biểu diễn.");
    }
  }

  if (input.subject === "Mĩ thuật") {
    if (!/quan sát|cảm nhận|tranh|sản phẩm mẫu|đồ vật|hình ảnh/i.test(text)) {
      issues.push("Môn Mĩ thuật thiếu quan sát/cảm nhận tranh, sản phẩm mẫu, đồ vật hoặc hình ảnh làm điểm tựa.");
    }
    if (!/nét|màu|hình|bố cục|đậm nhạt|chất liệu|kỹ thuật/i.test(text)) {
      issues.push("Môn Mĩ thuật thiếu yếu tố tạo hình trọng tâm như nét, màu, hình, bố cục, đậm nhạt, chất liệu hoặc kỹ thuật.");
    }
    if (!/tạo sản phẩm|vẽ|xé dán|nặn|in|trang trí|phác ý tưởng/i.test(text)) {
      issues.push("Môn Mĩ thuật thiếu hoạt động tạo sản phẩm hoặc phác ý tưởng bằng vật liệu/kỹ thuật cụ thể.");
    }
    if (!/trưng bày|giới thiệu|gallery|nhận xét|góp ý|tiêu chí|ý tưởng/i.test(text)) {
      issues.push("Môn Mĩ thuật thiếu trưng bày, giới thiệu, nhận xét sản phẩm hoặc tiêu chí đánh giá ý tưởng/kỹ thuật.");
    }
  }

  return issues;
}

function subjectPedagogyRepairGuidance(lesson: LessonPlan, input: LessonInput) {
  const issues = subjectPedagogyIssues(lesson, input);
  if (!issues.length) {
    return `- Chưa phát hiện lỗi riêng theo môn ${input.subject}; vẫn phải giữ đúng Pedagogy Profile của môn khi sửa các lỗi khác.`;
  }
  return issues.map((issue) => `- ${issue}`).join("\n");
}

function hasSubjectPedagogySignals(lesson: LessonPlan, input: LessonInput) {
  return subjectPedagogyIssues(lesson, input).length === 0;
}

function buildPedagogyAudit(lesson: LessonPlan, input: LessonInput, repairApplied: boolean): PedagogyAudit {
  const issues = subjectPedagogyIssues(lesson, input);
  const profile = getPedagogyProfile(input.subject);
  const status: PedagogyAudit["status"] = issues.length ? "needs-review" : repairApplied ? "repaired" : "passed";
  return {
    subject: input.subject,
    grade: input.grade,
    status,
    issues,
    checks: profile?.qualityChecks || [],
    repairApplied,
    checkedAt: new Date().toISOString(),
  };
}

function isSparseLesson(lesson: LessonPlan, input?: LessonInput) {
  return hasStructuralIssues(lesson, input) || hasQualityIssues(lesson, input);
}

function hasStructuralIssues(lesson: LessonPlan, input?: LessonInput) {
  if (!Array.isArray(lesson.activities) || lesson.activities.length < 4) return true;
  const periods = periodsForValidation(lesson);
  if (!periods.length || periods.some((period) => !periodHasRequiredPhases(period.activities || []))) return true;
  if (input && Number(input.periods) > 1 && periods.length < Number(input.periods)) return true;
  return false;
}

function hasQualityIssues(lesson: LessonPlan, input?: LessonInput) {
  if (!hasDetailedOutcomes(lesson)) return true;
  if (!hasPeriodSpecificOutcomes(lesson, input)) return true;
  if (input && !hasLearningContextSignals(lesson, input)) return true;
  if (input && !hasSubjectPedagogySignals(lesson, input)) return true;
  const periods = periodsForValidation(lesson);

  const style = input?.style || "Dạy thật trên lớp";
  const highQuality = style === "Sáng tạo, sinh động";
  return periods.some((period) => period.activities.some((activity, index) => {
    const teacherText = (activity.teacherActions || []).join(" ");
    const studentText = (activity.studentActions || []).join(" ");
    const combinedText = `${activity.phase} ${activity.title} ${activity.objective} ${teacherText} ${studentText} ${(activity.learningProducts || []).join(" ")}`;
    const hasTeachingScriptSignals = /tình huống|câu hỏi|dự kiến|chốt|sản phẩm|luật chơi|phiếu|nhóm|đời sống|nhận xét|hỗ trợ/i.test(combinedText);
    const hasCreativeTechnique = !highQuality || /trò chơi|khăn trải bàn|mảnh ghép|phòng tranh|thẻ tín hiệu|đóng vai|dự đoán|thử thách|hộp bí mật|góc ý kiến|STEM|STEAM|video|tranh|phiếu nhiệm vụ/i.test(combinedText);
    return (
      !hasEqualActionPairs(activity) ||
      hasWeaklyPairedActions(activity) ||
      hasTooManyActionPairs(activity, index) ||
      !activity.durationMinutes ||
      activityMinutes(activity, index) <= 0 ||
      !activity.learningProducts?.length ||
      !hasTeachingScriptSignals ||
      !hasCreativeTechnique
    );
  }));
}

function isMissingPeriods(lesson: LessonPlan, expectedPeriods: number) {
  return expectedPeriods > 1 && (!lesson.periodPlans || lesson.periodPlans.length < expectedPeriods);
}

function buildRepairPrompt(lesson: LessonPlan, input: LessonInput, ocrText: string) {
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
${subjectPedagogyRepairGuidance(lesson, input)}

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
- Mỗi periodPlan sẽ được render như một giáo án tiết riêng trong cùng tệp: BÀI ... (TIẾT X), I, II, III, IV. Không được chỉ tạo Tiết 1.
- Luyện tập phải có nhiệm vụ/bài tập cụ thể bám ảnh SGK/trang sách; Vận dụng phải gắn đời sống.
- Nếu user chọn quê hương/tỉnh, sửa mọi ví dụ lệch địa phương; phần Vận dụng/contextFit phải gắn với địa phương đó hoặc dùng gợi ý mở an toàn.
- Với bài có dấu hiệu "địa phương em/quê hương em/tỉnh em", bổ sung phiếu/nhiệm vụ học tập cụ thể, sản phẩm học tập rõ và tiêu chí đánh giá theo mức tiểu học.
- Bổ sung sản phẩm học tập, tiêu chí đánh giá và minh chứng quan sát được.
- Bắt buộc sửa theo Pedagogy Profile của môn ${input.subject}: nếu là Toán phải có biểu diễn/tóm tắt/kiểm tra logic; nếu là Tiếng Việt phải có đọc-viết-nói nghe hoặc ngữ liệu phù hợp; nếu là môn thực hành/năng khiếu phải có thao tác, an toàn, sản phẩm/tiêu chí; nếu là Đạo đức/HĐTN phải có tình huống, lựa chọn, cam kết/hành động; nếu là Khoa học/TNXH/Lịch sử-Địa lí phải có quan sát/bằng chứng/bản đồ-tư liệu hoặc hoạt động khám phá đúng bản chất môn.
- Viết lại Yêu cầu cần đạt cho chi tiết, gắn bài học và hành vi quan sát được; không liệt kê tên năng lực/phẩm chất ngắn cụt.
- Rút gọn các mục tiêu bị lặp máy móc; với bài nhiều tiết, mỗi tiết/trọng tâm phải có mục tiêu riêng, không bê nguyên một bộ mục tiêu cho mọi tiết.
- Với mọi môn có bài tập/câu hỏi/thực hành/sản phẩm, bổ sung đáp án dự kiến, cách làm, lỗi sai thường gặp, lời chốt hoặc tiêu chí đánh giá tương ứng; không viết chung chung.
- Cá nhân hóa rõ theo môi trường học, cơ sở vật chất, đối tượng học sinh và địa phương trong materials và từng hoạt động. Nếu có thiết bị số thì nêu cách GV dùng và HS tương tác; nếu nông thôn/vùng núi/thiếu thiết bị thì dùng hoạt động thực tế, vật thật, tranh in, phiếu học tập.
${creativeMode ? "- Bổ sung ít nhất một điểm sáng tạo nổi bật nhưng vẫn đúng mục tiêu bài học." : "- Ưu tiên tính thực tế, dễ triển khai trên lớp; không thêm hoạt động phức tạp nếu không cần thiết."}
- Không thay đổi tên bài nếu đã đúng; không thêm thông tin ngoài nội dung bài một cách vô căn cứ.
- Không tự tạo bảng hoặc tiêu đề cột trong teacherActions/studentActions. Chỉ viết từng bước hành động cụ thể; app sẽ tự dựng bảng theo mẫu CV2345.

Thông tin form: ${JSON.stringify({ subject: input.subject, grade: input.grade, lessonTitle: input.lessonTitle, book: bookContext(input), bookVolume: input.bookVolume, hometownProvince: input.hometownProvince, localityNote: input.localityNote, periods: input.periods, duration: input.duration })}

Noi dung trich xuat tu anh SGK user upload:
${ocrText}

LessonPlan cần sửa:
${JSON.stringify(lesson)}`;
}

function extractJson(text: string) {
  try {
    return JSON.parse(text) as LessonPlan;
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("OpenAI không trả về JSON hợp lệ.");
    return JSON.parse(match[0]) as LessonPlan;
  }
}

function sanitizeLessonText<T>(value: T): T {
  const raw = JSON.stringify(value)
    .replace(/tranh\s*\/\s*SGK\s*\/\s*OCR/gi, "tranh trong SGK")
    .replace(/SGK\s*\/\s*OCR/gi, "SGK")
    .replace(/theo\s+OCR/gi, "trong ảnh SGK")
    .replace(/từ\s+OCR/gi, "từ ảnh SGK")
    .replace(/nội dung\s+OCR/gi, "nội dung ảnh SGK")
    .replace(/\bOCR\b/g, "ảnh SGK");
  return JSON.parse(raw) as T;
}

function expandQuality(item: string, lessonTitle: string) {
  const trimmed = item.trim();
  if (trimmed.length >= 32) return trimmed;
  const title = lessonTitle || "bài học";
  if (/nhân ái/i.test(trimmed)) return `Nhân ái: biết quan tâm, lắng nghe, chia sẻ và có lời nói, việc làm phù hợp để giúp đỡ người khác trong các tình huống gắn với ${title}.`;
  if (/trách nhiệm/i.test(trimmed)) return `Trách nhiệm: chủ động thực hiện nhiệm vụ học tập, biết nhận phần việc phù hợp và có ý thức vận dụng điều đã học vào hành vi hằng ngày.`;
  if (/chăm chỉ/i.test(trimmed)) return `Chăm chỉ: tích cực quan sát tranh/ảnh trong SGK, tham gia thảo luận, hoàn thành phiếu/nhiệm vụ học tập và mạnh dạn chia sẻ kết quả.`;
  if (/trung thực/i.test(trimmed)) return `Trung thực: nêu đúng suy nghĩ của bản thân, biết nhận xét hành vi đúng - chưa đúng dựa trên tình huống bài học và không nói theo bạn một cách máy móc.`;
  if (/yêu nước/i.test(trimmed)) return `Yêu nước: biết trân trọng những giá trị tốt đẹp trong gia đình, nhà trường và cộng đồng qua nội dung ${title}.`;
  return `${trimmed}: thể hiện bằng hành vi cụ thể trong quá trình học tập, thảo luận, thực hành và vận dụng nội dung ${title} vào đời sống.`;
}

function expandOutcome(item: string, lessonTitle: string, category: "knowledge" | "general" | "specific") {
  const trimmed = item.trim();
  if (trimmed.length >= 40 && /:|biết|thực hiện|trình bày|trao đổi|vận dụng|đề xuất|quan sát|hoàn thành/i.test(trimmed)) return trimmed;
  const title = lessonTitle || "bài học";
  if (category === "knowledge") return `${trimmed}: thực hiện được qua câu trả lời, bài tập hoặc sản phẩm học tập phù hợp với yêu cầu của ${title}.`;
  if (category === "general") return `${trimmed}: chủ động nhận nhiệm vụ, trao đổi với bạn và trình bày kết quả học tập gắn với ${title}.`;
  return `${trimmed}: sử dụng kiến thức, kĩ năng đặc thù của môn học để hoàn thành nhiệm vụ trong ${title} và liên hệ tình huống phù hợp.`;
}

function uniqueItems(items: string[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.toLowerCase().replace(/\s+/g, " ").trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeOutcomes(outcomes: Partial<LessonOutcomes> | undefined, lessonTitle: string): LessonOutcomes {
  return {
    generalCompetencies: uniqueItems((outcomes?.generalCompetencies?.length ? outcomes.generalCompetencies : ["Tự chủ và tự học", "Giao tiếp và hợp tác"]).map((item) => expandOutcome(item, lessonTitle, "general"))),
    specificCompetencies: uniqueItems((outcomes?.specificCompetencies?.length ? outcomes.specificCompetencies : ["Năng lực đặc thù môn học"]).map((item) => expandOutcome(item, lessonTitle, "specific"))),
    qualities: uniqueItems((outcomes?.qualities?.length ? outcomes.qualities : ["Chăm chỉ", "Trách nhiệm"]).map((item) => expandQuality(item, lessonTitle))),
    knowledgeAndSkills: uniqueItems((outcomes?.knowledgeAndSkills?.length ? outcomes.knowledgeAndSkills : ["Hoàn thành yêu cầu học tập trọng tâm"]).map((item) => expandOutcome(item, lessonTitle, "knowledge"))),
  };
}

function fallbackActivityProduct(activity: LessonPlan["activities"][number], index: number) {
  const key = phaseKey(`${activity.phase} ${activity.title}`);
  if (key === "Khởi động") return "Câu trả lời/chia sẻ ban đầu của học sinh";
  if (key === "Khám phá") return "Kết quả quan sát, thảo luận hoặc phiếu học tập của học sinh";
  if (key === "Luyện tập") return "Bài làm hoặc sản phẩm luyện tập của học sinh";
  if (key === "Vận dụng") return "Ý tưởng/ví dụ vận dụng của học sinh gắn với đời sống";
  return `Sản phẩm học tập của hoạt động ${index + 1}`;
}

function balanceActionPairs(activity: LessonPlan["activities"][number], index: number) {
  const pairs = pairedActivityActions(activity);

  return {
    teacherActions: pairs.map((pair, actionIndex) => pair.teacher || `GV hướng dẫn học sinh hoàn thành bước ${actionIndex + 1} của hoạt động ${activity.phase || index + 1}.`),
    studentActions: pairs.map((pair, actionIndex) => pair.student || `HS theo dõi hướng dẫn của GV và tham gia bước ${actionIndex + 1} của hoạt động.`),
  };
}

function normalizeActivity(activity: LessonPlan["activities"][number], index: number) {
  const actionPairs = balanceActionPairs(activity, index);
  return {
    ...activity,
    phase: activity.phase || `Hoạt động ${index + 1}`,
    title: activity.title || activity.phase || `Hoạt động ${index + 1}`,
    objective: activity.objective || "Giúp học sinh hoàn thành mục tiêu học tập của hoạt động.",
    durationMinutes: activity.durationMinutes || activityMinutes(activity, index),
    teacherActions: actionPairs.teacherActions,
    studentActions: actionPairs.studentActions,
    learningProducts: activity.learningProducts?.filter(Boolean).length ? activity.learningProducts.filter(Boolean) : [fallbackActivityProduct(activity, index)],
  };
}

function normalizeLesson(input: LessonInput, lesson: LessonPlan, model: string): LessonPlan {
  lesson = sanitizeLessonText(lesson);
  const title = lesson.generalInfo?.lessonTitle || input.lessonTitle || "bài học";
  const periodPlans = Array.isArray(lesson.periodPlans)
    ? lesson.periodPlans
        .filter((period) => period && Array.isArray(period.activities))
        .map((period, index) => ({
          periodNumber: Number(period.periodNumber || index + 1),
          focus: period.focus || `Tiết ${index + 1}`,
          outcomes: period.outcomes ? normalizeOutcomes(period.outcomes, `${title} - tiết ${Number(period.periodNumber || index + 1)}`) : undefined,
          activities: period.activities.map(normalizeActivity),
        }))
    : undefined;
  const activities = periodPlans?.length ? periodPlans.flatMap((period) => period.activities) : Array.isArray(lesson.activities) ? lesson.activities.map(normalizeActivity) : [];

  return {
    ...lesson,
    generalInfo: {
      subject: lesson.generalInfo?.subject || input.subject,
      grade: lesson.generalInfo?.grade || input.grade,
      lessonTitle: lesson.generalInfo?.lessonTitle || input.lessonTitle || "Bài học",
      book: lesson.generalInfo?.book || bookContext(input),
      periods: Number(lesson.generalInfo?.periods || input.periods || 1),
      duration: Number(lesson.generalInfo?.duration || input.duration || 35),
    },
    outcomes: normalizeOutcomes(lesson.outcomes, title),
    materials: {
      teacher: lesson.materials?.teacher?.length ? lesson.materials.teacher : ["Ảnh SGK/tranh minh họa bài học", "Bảng phụ hoặc phiếu học tập"],
      students: lesson.materials?.students?.length ? lesson.materials.students : ["SGK", "Vở ghi hoặc phiếu học tập"],
    },
    activities,
    periodPlans,
    assessment: {
      criteria: lesson.assessment?.criteria || [],
      evidence: lesson.assessment?.evidence || [],
      comments: lesson.assessment?.comments || [],
    },
    adjustments: {
      suitablePoints: lesson.adjustments?.suitablePoints || ["........................................................................................................................................"],
      pointsToAdjust: lesson.adjustments?.pointsToAdjust || ["........................................................................................................................................"],
      nextLessonDirection: lesson.adjustments?.nextLessonDirection || ["........................................................................................................................................"],
    },
    contextFit: {
      notes: lesson.contextFit?.notes || [],
    },
    meta: {
      style: lesson.meta?.style || input.style,
      modelUsed: model,
      createdAt: new Date().toISOString(),
    },
  };
}

async function generateLessonWithModel(input: LessonInput, ocrText: string, apiKey: string, model: string) {
  console.info("[EduPlan AI] OpenAI generation started", { model, ocrTextLength: ocrText.length });
  const content = await fetchOpenAiJsonContent(apiKey, {
    model,
    temperature: 0.65,
    messages: [
      {
        role: "system",
        content:
          "Bạn chỉ trả JSON hợp lệ theo schema được yêu cầu. Soạn giáo án chi tiết, có thể dạy thật, theo định hướng phát triển phẩm chất và năng lực của CTGDPT 2018.",
      },
      { role: "user", content: buildPrompt(input, ocrText) },
    ],
  });
  let lesson = normalizeLesson(input, extractJson(content), model);
  const originalLesson = lesson;
  let repairApplied = false;
  if (hasStructuralIssues(lesson, input) || hasQualityIssues(lesson, input) || isMissingPeriods(lesson, input.periods)) {
    console.info("[EduPlan AI] OpenAI repair started", {
      model,
      activityCount: lesson.activities.length,
      structuralIssues: hasStructuralIssues(lesson, input) || isMissingPeriods(lesson, input.periods),
      qualityIssues: hasQualityIssues(lesson, input),
      subjectPedagogyIssues: subjectPedagogyIssues(lesson, input),
    });
    try {
      const repairContent = await fetchOpenAiJsonContent(apiKey, {
        model,
        temperature: 0.55,
        messages: [
          {
            role: "system",
            content:
              "Bạn chỉ trả JSON hợp lệ theo schema LessonPlan. Nhiệm vụ là sửa giáo án sơ sài thành giáo án chi tiết, sinh động, bám CTGDPT 2018.",
          },
          { role: "user", content: buildRepairPrompt(lesson, input, ocrText) },
        ],
      });
      const repairedLesson = normalizeLesson(input, extractJson(repairContent), model);
      if (hasStructuralIssues(repairedLesson, input) || isMissingPeriods(repairedLesson, input.periods)) {
        console.warn("[EduPlan AI] OpenAI repair returned structural issues; keeping original lesson", {
          model,
          repairedActivityCount: repairedLesson.activities.length,
          originalActivityCount: originalLesson.activities.length,
        });
        lesson = originalLesson;
      } else {
        lesson = repairedLesson;
        repairApplied = true;
      }
    } catch (repairError) {
      console.warn("[EduPlan AI] OpenAI repair skipped", { message: repairError instanceof Error ? repairError.message : "Unknown repair error" });
      if (hasStructuralIssues(lesson, input) || isMissingPeriods(lesson, input.periods)) {
        throw new Error("Giáo án AI trả về chưa đủ cấu trúc yêu cầu. Vui lòng bấm tạo lại hoặc giảm số ảnh/số tiết để AI xử lý ổn định hơn.");
      }
    }
  }
  if (hasStructuralIssues(lesson, input) || isMissingPeriods(lesson, input.periods)) {
    throw new Error("Giáo án AI trả về chưa đủ cấu trúc yêu cầu sau khi tự sửa. Vui lòng bấm tạo lại hoặc giảm số ảnh/số tiết.");
  }
  const pedagogyAudit = buildPedagogyAudit(lesson, input, repairApplied);
  console.info("[EduPlan AI] OpenAI generation completed", {
    model,
    activityCount: lesson.activities.length,
    qualityIssues: hasQualityIssues(lesson, input),
    pedagogyAudit: {
      status: pedagogyAudit.status,
      repairApplied: pedagogyAudit.repairApplied,
      issueCount: pedagogyAudit.issues.length,
      subject: pedagogyAudit.subject,
      grade: pedagogyAudit.grade,
    },
  });
  return { lesson, pedagogyAudit };
}

async function generateLesson(input: LessonInput, ocrText: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Thiếu OPENAI_API_KEY trong file .env.");

  const model = process.env.OPENAI_MODEL || OPENAI_DEFAULT_MODEL;
  try {
    return await generateLessonWithModel(input, ocrText, apiKey, model);
  } catch (error) {
    const message = error instanceof Error ? error.message : "OpenAI generation failed.";
    const shouldFallback = model !== OPENAI_FALLBACK_MODEL && /quá lâu|Không kết nối ổn định|fetch failed|timeout|5xx|Cloudflare|model.*không/i.test(message);
    if (!shouldFallback) throw error;

    console.warn("[EduPlan AI] OpenAI primary model failed; retrying fallback", { model, fallbackModel: OPENAI_FALLBACK_MODEL, message });
    return generateLessonWithModel(input, ocrText, apiKey, OPENAI_FALLBACK_MODEL);
  }
}

async function saveGeneratedLesson(uid: string, lesson: LessonPlan) {
  const ref = getFirebaseDb().collection("lessons").doc();
  const now = new Date();
  await ref.set({
    ownerId: uid,
    title: lesson.generalInfo?.lessonTitle || "Giáo án chưa đặt tên",
    subject: lesson.generalInfo?.subject || "",
    grade: lesson.generalInfo?.grade || "",
    periods: Number(lesson.generalInfo?.periods || 1),
    lesson,
    createdAt: now,
    updatedAt: now,
    expiresAt: lessonExpiresAt(),
  });
  return ref.id;
}

export async function POST(request: Request) {
  let stage: GenerateResponse["stage"] = "unknown";
  try {
    const user = await requireUser();
    if (!user.emailVerified) {
      return NextResponse.json<GenerateResponse>({ error: "Bạn cần xác minh email trước khi tạo giáo án.", stage }, { status: 403 });
    }
    if (user.remainingGenerations <= 0) {
      return NextResponse.json<GenerateResponse>({ error: "Bạn đã hết lượt tạo giáo án miễn phí.", stage }, { status: 403 });
    }

    const input = (await request.json()) as LessonInput;
    stage = "ocr";
    const ocrResult = await runOpenAiOcr(input);
    stage = "openai";
    const { lesson, pedagogyAudit } = await generateLesson(input, ocrResult.text);
    const lessonId = await saveGeneratedLesson(user.uid, lesson);
    await incrementGenerationUsage(user.uid);
    const primaryModel = process.env.OPENAI_MODEL || OPENAI_DEFAULT_MODEL;
    const modelUsed = lesson.meta.modelUsed;
    return NextResponse.json<GenerateResponse>({
      lesson,
      lessonId,
      pedagogyAudit,
      ocrTextLength: ocrResult.text.length,
      modelRouting: {
        primaryModel,
        modelUsed,
        fallbackUsed: modelUsed !== primaryModel,
      },
    });
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : "Không thể tạo giáo án lúc này.";
    const status = error instanceof Error && error.name === "UNAUTHENTICATED" ? 401 : 500;
    const message = stage === "ocr" ? `Lỗi OCR OpenAI: ${rawMessage}` : stage === "openai" ? `Lỗi OpenAI: ${rawMessage}` : rawMessage;
    return NextResponse.json<GenerateResponse>(
      { error: message, stage },
      { status },
    );
  }
}
