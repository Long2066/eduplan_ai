import { NextResponse } from "next/server";
import { activityMinutes, pairedActivityActions } from "@/lib/lesson-format";
import { incrementGenerationUsage, requireUser } from "@/lib/auth-server";
import type { LessonActivity, LessonPlan, PeriodPlan } from "@/types/lesson";

type RefineAction = "better" | "shorten" | "expand" | "digital" | "demo";

type RefineRequest = {
  lesson: LessonPlan;
  action: RefineAction;
};

const actionInstruction: Record<RefineAction, string> = {
  better: "Viết lại giáo án hay hơn, tự nhiên hơn, lời dẫn của giáo viên mượt hơn; tăng độ hấp dẫn ở Khám phá và làm rõ cách tổ chức, nhưng không làm mất cấu trúc.",
  shorten: "Rút gọn giáo án, giảm độ dài câu chữ nhưng giữ đủ phần, đủ hoạt động và bảng GV/HS.",
  expand: "Làm giáo án chi tiết hơn rõ rệt, thêm tình huống có vấn đề, câu hỏi gợi mở, dự kiến câu trả lời, sản phẩm học tập, lời dẫn và cách tổ chức rõ hơn.",
  digital: "Bổ sung năng lực số và hoạt động sử dụng thiết bị số ở mức phù hợp, không gượng ép.",
  demo: "Chuyển giáo án sang phong cách thi giảng/dự giờ: sinh động, chỉn chu, có hoạt động Khám phá nổi bật, lời dẫn tự nhiên và sản phẩm học tập quan sát được.",
};

const qualityInstruction = `Bắt buộc theo CTGDPT 2018: giáo viên tổ chức/hướng dẫn, học sinh chủ động khám phá, luyện tập, vận dụng; phát triển phẩm chất yêu nước, nhân ái, chăm chỉ, trung thực, trách nhiệm và năng lực tự chủ tự học, giao tiếp hợp tác, giải quyết vấn đề sáng tạo ở mức phù hợp bài học.

Chuẩn chất lượng khi tinh chỉnh:
- Không được làm giáo án sơ sài hoặc chỉ ghi tên hoạt động.
- Khởi động luôn là hoạt động toàn lớp 3-5 phút, tạo hứng thú cho đa số học sinh và bám nội dung bài; không được chỉ viết "GV giới thiệu bài".
- Khởi động phải chọn hình thức phù hợp bài học: hát/vận động, trò chơi nhanh, câu đố, ô chữ, quan sát tranh/video, đồ vật thật, thí nghiệm mini, đóng vai hoặc thử thách ngắn. Chỉ dùng nhãn STEM/STEAM nếu hoạt động thật sự có yếu tố thiết kế, thử nghiệm, giải quyết vấn đề hoặc tạo sản phẩm đúng bản chất.
- Khởi động bắt buộc có tên hấp dẫn, đồ dùng, luật chơi/cách tổ chức, câu hỏi dẫn dắt, dự kiến phản hồi của học sinh và lời chốt chuyển vào bài.
- Với Toán/Khoa học/Công nghệ/Tin học ưu tiên thử thách STEM ngắn; với Tiếng Việt/Ngữ văn ưu tiên tranh, âm thanh, câu đố, nhân vật bí mật, ghép từ khóa; với Đạo đức/GDCD/Trải nghiệm ưu tiên tình huống/đóng vai/bình chọn hành vi; với Âm nhạc/Mĩ thuật ưu tiên cảm thụ, vận động, quan sát, sáng tạo nhanh.
- Mỗi hoạt động nên có lời dẫn/câu hỏi/giao nhiệm vụ/tổ chức/chốt kiến thức ở phía GV và thao tác học tập tương ứng ở phía HS.
- Khám phá/hình thành kiến thức phải có tình huống có vấn đề hoặc trò chơi/quan sát tranh/ngữ liệu, câu hỏi gợi mở, dự kiến câu trả lời và lời chốt.
- Luyện tập có nhiệm vụ cụ thể; Vận dụng gắn đời sống; Đánh giá có tiêu chí và minh chứng quan sát được.
- Mỗi tiết phải có đủ 4 phần chính theo thứ tự: Khởi động, Khám phá, Luyện tập, Vận dụng; không được thiếu dù là môn nào hoặc bao nhiêu tiết.
- Mỗi hoạt động phải có durationMinutes và learningProducts rõ; tổng thời lượng mỗi tiết xấp xỉ 35 phút.
- Kiểm soát độ dài theo tiết 35 phút: chi tiết ở đáp án/chốt/cách làm, không kéo dài số bước. Khởi động 3-5 phút chỉ 2-3 cặp GV/HS; Khám phá 15-17 phút khoảng 4-6 cặp; Luyện tập 8-10 phút khoảng 3-4 cặp; Vận dụng 3-5 phút khoảng 2-3 cặp.
- Với Vận dụng 3-5 phút, chỉ yêu cầu lập ý nhanh, chia sẻ miệng, viết nháp 2-3 câu, cam kết hoặc giao hoàn thiện ở nhà; chỉ yêu cầu viết đoạn hoàn chỉnh nếu bố trí 8-10 phút.
- Đáp án dự kiến, dữ liệu địa phương, lỗi sai thường gặp và lời chốt phải viết ngắn trong đúng cặp GV/HS liên quan; không tách thành nhiều dòng phụ làm giáo án dài.
- teacherActions.length phải bằng studentActions.length tuyệt đối. Mỗi gạch bên giáo viên tương ứng đúng một gạch bên học sinh ở cùng index; không thừa, không thiếu, không để trống.
- Mọi teacherActions phải bắt đầu bằng "GV ..." và mọi studentActions phải bắt đầu bằng "HS ..."; không để dòng cụt chủ ngữ như "Phân tích...", "Đọc...", "Hướng dẫn...".
- Mỗi cặp cùng index phải đồng bộ trực tiếp: GV giao nhiệm vụ nào thì HS thực hiện đúng nhiệm vụ đó; GV hỏi gì thì HS trả lời/thảo luận đúng câu hỏi; GV hướng dẫn thao tác nào thì HS thao tác tương ứng; GV chốt gì thì HS ghi nhớ/nhắc lại/vận dụng.
- Không để cột HS chỉ "HS lắng nghe/quan sát" khi cột GV đang giao nhiệm vụ tìm, viết, tính, thảo luận, trình bày, đóng vai hoặc hoàn thành phiếu; HS phải có hành động học tập và sản phẩm/đáp án dự kiến.
- Không dùng câu máy móc "HS thực hiện nhiệm vụ tương ứng..." hoặc "HS phản hồi theo hướng dẫn..." nếu không nêu rõ nhiệm vụ. Với dòng GV chốt/chuyển ý/giới thiệu hoạt động tiếp theo, cột HS nên là "HS lắng nghe, ghi nhớ và sẵn sàng chuyển sang hoạt động tiếp theo" hoặc câu tương đương tự nhiên.
- Yêu cầu cần đạt phải chi tiết theo bài học, gắn hành vi quan sát được; không liệt kê ngắn cụt như "Tự chủ và tự học".
- Với bài nhiều tiết, mục tiêu/trọng tâm từng tiết phải riêng, không lặp máy móc. Outcomes cần gọn, đúng trọng tâm và tránh câu lặp.
- Nếu LessonPlan có nhiều periodPlans, mỗi periodPlan nên có outcomes riêng phù hợp đúng trọng tâm tiết đó; không dùng nguyên một bộ Yêu cầu cần đạt cho mọi tiết.
- Với mọi môn có bài tập/câu hỏi/thực hành/sản phẩm, phải có đáp án dự kiến, cách làm, lỗi sai thường gặp, lời chốt hoặc tiêu chí đánh giá tương ứng; không chỉ ghi chung chung "HS làm bài".
- Hoạt động được phép sáng tạo, thực tế, sinh động, không cần sao chép y nguyên SGK; nhưng phải đúng mục tiêu, phù hợp độ tuổi, không sa đà trò chơi làm loãng kiến thức.
- Tùy chọn môi trường học, cơ sở vật chất, đối tượng học sinh và địa phương phải thể hiện rõ trong thiết bị, cách tổ chức và hành động GV/HS. Có thiết bị số thì nêu cách chiếu/tương tác; nông thôn/vùng núi/thiếu thiết bị thì ưu tiên hoạt động thực tế, vật thật, tranh in, phiếu học tập.
- Giữ JSON schema LessonPlan, không Markdown.`;

function extractJson(text: string) {
  try {
    return JSON.parse(text) as LessonPlan;
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("OpenAI không trả về JSON hợp lệ.");
    return JSON.parse(match[0]) as LessonPlan;
  }
}

function normalizeActivity(activity: LessonActivity, index: number): LessonActivity {
  const pairs = pairedActivityActions(activity);
  return {
    ...activity,
    durationMinutes: activity.durationMinutes || activityMinutes(activity, index),
    teacherActions: pairs.map((pair) => pair.teacher),
    studentActions: pairs.map((pair) => pair.student),
    learningProducts: activity.learningProducts || [],
  };
}

function normalizePeriods(periods?: PeriodPlan[], fallbackPeriods?: PeriodPlan[]) {
  return periods?.map((period) => ({
    ...period,
    outcomes: period.outcomes || fallbackPeriods?.find((fallback) => fallback.periodNumber === period.periodNumber)?.outcomes,
    activities: (period.activities || []).map(normalizeActivity),
  }));
}

function normalizeLesson(lesson: LessonPlan, refined: LessonPlan, model: string): LessonPlan {
  const mergedPeriodPlans = normalizePeriods(refined.periodPlans || lesson.periodPlans, lesson.periodPlans);
  const mergedActivities = mergedPeriodPlans?.length
    ? mergedPeriodPlans.flatMap((period) => period.activities)
    : (refined.activities || lesson.activities || []).map(normalizeActivity);

  return {
    ...lesson,
    ...refined,
    generalInfo: { ...lesson.generalInfo, ...refined.generalInfo },
    outcomes: { ...lesson.outcomes, ...refined.outcomes },
    materials: { ...lesson.materials, ...refined.materials },
    assessment: { ...lesson.assessment, ...refined.assessment },
    adjustments: { ...lesson.adjustments, ...refined.adjustments },
    contextFit: { ...lesson.contextFit, ...refined.contextFit },
    activities: mergedActivities,
    periodPlans: mergedPeriodPlans,
    meta: {
      ...lesson.meta,
      ...refined.meta,
      modelUsed: model,
      createdAt: new Date().toISOString(),
    },
  };
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    if (!user.emailVerified) {
      return NextResponse.json({ error: "Bạn cần xác minh email trước khi tinh chỉnh giáo án." }, { status: 403 });
    }
    if (user.remainingGenerations <= 0) {
      return NextResponse.json({ error: "Bạn đã hết lượt tạo/tinh chỉnh giáo án miễn phí." }, { status: 403 });
    }

    const { lesson, action } = (await request.json()) as RefineRequest;
    if (!lesson || !action) {
      return NextResponse.json({ error: "Thiếu giáo án hoặc thao tác tinh chỉnh." }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("Thiếu OPENAI_API_KEY trong file .env.");

    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
    console.info("[EduPlan AI] OpenAI refine started", { model, action });

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        response_format: { type: "json_object" },
        temperature: 0.6,
        messages: [
          { role: "system", content: "Bạn chỉ trả JSON hợp lệ, đúng schema LessonPlan, không Markdown. Ưu tiên giáo án chi tiết, sinh động, dạy thật được." },
          {
            role: "user",
            content: `Hãy tinh chỉnh LessonPlan dưới đây.\n\nYêu cầu: ${actionInstruction[action]}\n\n${qualityInstruction}\n\nBắt buộc giữ nguyên JSON schema, đủ các phần, activities vẫn có teacherActions và studentActions. Với bài nhiều tiết, periodPlans nên có outcomes riêng cho từng tiết.\n\nLessonPlan hiện tại:\n${JSON.stringify(lesson)}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || `OpenAI refine failed with ${response.status}`);
    }

    const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("OpenAI không trả về nội dung tinh chỉnh.");

    const refined = normalizeLesson(lesson, extractJson(content), model);
    await incrementGenerationUsage(user.uid);
    console.info("[EduPlan AI] OpenAI refine completed", { model, action });
    return NextResponse.json({ lesson: refined });
  } catch (error) {
    const status = error instanceof Error && error.name === "UNAUTHENTICATED" ? 401 : 500;
    return NextResponse.json(
      { error: error instanceof Error ? `Lỗi OpenAI refine: ${error.message}` : "Không thể tinh chỉnh giáo án lúc này." },
      { status },
    );
  }
}
