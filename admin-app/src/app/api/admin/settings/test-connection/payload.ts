// A single, deterministic image checks image-message transport, not document OCR quality.
// Blue 32px PNG; require the visible color so an empty acknowledgement cannot pass.
export const TEST_IMAGE = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAIAAAD8GO2jAAAAK0lEQVR4nGPgj3pIU8QwasGoBaMWjFowasGoBaMWjFowasGoBaMWRA0RCwAY7yhM5oDNRwAAAABJRU5ErkJggg==";
export type TestMode = "text" | "vision";

export function makeTestPayload(model: string, mode: TestMode, gateway: boolean) {
  return {
    model,
    stream: false,
    ...(gateway ? { reasoning_effort: "low" } : {}),
    max_tokens: 128,
    messages: [{
      role: "user",
      content: mode === "vision" ? [
        { type: "text", text: "Hãy nhìn ảnh đính kèm và trả lời màu của nó bằng một từ. Không suy đoán nếu không thấy ảnh." },
        { type: "image_url", image_url: { url: TEST_IMAGE } },
      ] : "Ping EduPlan AI. Hãy trả lời ngắn gọn: OK",
    }],
  };
}

export function readableReply(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) return value.filter((part) => part?.type === "text" && typeof part.text === "string").map((part) => part.text).join(" ").trim();
  return "";
}

export function confirmsBlueImage(reply: string): boolean {
  return /\bblue\b|\bxanh\b/i.test(reply);
}
