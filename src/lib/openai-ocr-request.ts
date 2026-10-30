import "server-only";

export const OCR_PROMPT = `Hãy OCR chuẩn các ảnh SGK tiếng Việt theo đúng thứ tự ảnh. Chỉ trích xuất văn bản nhìn thấy trong ảnh, không suy đoán hoặc thêm nội dung ngoài ảnh.

QUY TẮC BẮT BUỘC CHO TÊN BÀI:
- Bảo toàn chính xác dòng "Bài"/số bài/tên bài và dấu tiếng Việt như trên ảnh.
- Nếu "Bài", số bài và tên bài nằm ở các dòng riêng thì giữ từng dòng riêng; không ghép với câu hỏi hoặc nhiệm vụ phía dưới.
- Phân biệt heading tên bài ở đầu trang với các mục "Bài 1", "Bài 2" trong phần bài tập; không nâng dòng bài tập thành tên bài.
- Không tự tạo số bài hoặc tên bài khi ảnh không đọc được.

Giữ xuống dòng hợp lý, nhận diện yêu cầu cần đạt/nội dung/câu hỏi nếu có. Ngăn cách mỗi ảnh bằng dòng --- HẾT ẢNH ---. Không giải thích.`;

export function usesOcrResponsesApi(model: string) {
  return /^gpt-5/i.test(model);
}

export function buildOpenAiOcrRequest(options: {
  model: string;
  imageDataUrls: string[];
  reasoningEffort: string;
  maxOutputTokens: number;
}) {
  const { model, imageDataUrls, reasoningEffort, maxOutputTokens } = options;
  const useResponsesApi = usesOcrResponsesApi(model);

  if (useResponsesApi) {
    return {
      useResponsesApi,
      body: {
        model,
        input: [{
          role: "user",
          content: [
            { type: "input_text", text: OCR_PROMPT },
            ...imageDataUrls.map((imageUrl) => ({ type: "input_image", image_url: imageUrl, detail: "high" })),
          ],
        }],
        reasoning: { effort: reasoningEffort },
        max_output_tokens: maxOutputTokens,
      },
    };
  }

  return {
    useResponsesApi,
    body: {
      model,
      messages: [{
        role: "user",
        content: [
          { type: "text", text: OCR_PROMPT },
          ...imageDataUrls.map((imageUrl) => ({ type: "image_url", image_url: { url: imageUrl, detail: "high" } })),
        ],
      }],
      max_tokens: maxOutputTokens,
    },
  };
}
