import "server-only";

export const OCR_PROMPT = "Hãy OCR chuẩn các ảnh SGK tiếng Việt theo đúng thứ tự ảnh. Chỉ trích xuất văn bản nhìn thấy trong ảnh, giữ xuống dòng hợp lý, nhận diện tên bài/số bài/yêu cầu cần đạt/nội dung/câu hỏi nếu có. Ngăn cách mỗi ảnh bằng dòng --- HẾT ẢNH ---. Không giải thích và không thêm nội dung ngoài ảnh.";

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
