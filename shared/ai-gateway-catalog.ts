export type AiRoutingMode = "hybrid" | "gateway_only" | "openai_only";

export type GatewayModelProvider = "ANTIGRAVITY" | "OPENAI" | "OTHER";

export type GatewayModelItem = {
  id: string;
  name: string;
  provider: GatewayModelProvider;
  category: "text" | "ocr";
  description?: string;
};

export type AiGatewaySettings = {
  enabled: boolean;
  baseUrl: string;
  apiKey: string;
  routingMode: AiRoutingMode;
  freeModel: string;
  freeOcrModel: string;
  plusModel: string;
  plusOcrModel: string;
  openaiApiKey?: string;
  openaiModel?: string;
  openaiFreeModel?: string;
  openaiFreeOcrModel?: string;
  openaiPlusModel?: string;
  openaiPlusOcrModel?: string;
};

export const GATEWAY_TEXT_MODELS: GatewayModelItem[] = [
  // Antigravity Models (from CLIProxy / Antigravity Gateway)
  { id: "claude-opus-5-5-high", name: "Claude Opus 5.5 (High)", provider: "ANTIGRAVITY", category: "text" },
  { id: "claude-sonnet-5-5-high", name: "Claude Sonnet 5.5 (High)", provider: "ANTIGRAVITY", category: "text" },
  { id: "claude-opus-4-6-thinking", name: "Claude Opus 4.6 (Thinking)", provider: "ANTIGRAVITY", category: "text" },
  { id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6 (Thinking)", provider: "ANTIGRAVITY", category: "text" },
  { id: "gemini-4-argon-high", name: "Gemini 4 Argon", provider: "ANTIGRAVITY", category: "text" },
  { id: "gemini-3.8-flash-high", name: "Gemini 3.8 Flash (High)", provider: "ANTIGRAVITY", category: "text" },
  { id: "gemini-3-flash", name: "Gemini 3 Flash", provider: "ANTIGRAVITY", category: "text" },
  { id: "gpt-oss-120b-medium", name: "GPT-OSS 120B (Medium)", provider: "ANTIGRAVITY", category: "text" },
  { id: "gemini-3.1-flash-lite", name: "Gemini 3.1 Flash Lite (Siêu tốc)", provider: "ANTIGRAVITY", category: "text" },
  { id: "gemini-3.5-flash-lite", name: "Gemini 3.5 Flash Lite (Siêu tốc)", provider: "ANTIGRAVITY", category: "text" },

  // OpenAI Models (from CLIProxy / OpenAI Hub)
  { id: "gpt-6.1-terra", name: "GPT 6.1 Terra", provider: "OPENAI", category: "text" },
  { id: "gpt-6.1-sol", name: "GPT 6.1 Sol", provider: "OPENAI", category: "text" },
  { id: "gpt-6-astra", name: "GPT 6.0 Astra", provider: "OPENAI", category: "text" },
  { id: "gpt-6-sol", name: "GPT 6.0 Sol", provider: "OPENAI", category: "text" },
  { id: "gpt-6-luna", name: "GPT 6.0 Luna", provider: "OPENAI", category: "text" },
  { id: "gpt-5.6-terra", name: "GPT 5.6 Terra (Chuẩn EduPlan)", provider: "OPENAI", category: "text" },
  { id: "gpt-5.6-sol", name: "GPT 5.6 Sol", provider: "OPENAI", category: "text" },
  { id: "gpt-5.6-luna", name: "GPT 5.6 Luna", provider: "OPENAI", category: "text" },
  { id: "codex-auto-review", name: "Codex Auto Review", provider: "OPENAI", category: "text" },
  { id: "gpt-5.4-mini", name: "GPT 5.4 Mini", provider: "OPENAI", category: "text" },
];

export const GATEWAY_OCR_MODELS: GatewayModelItem[] = [
  // Antigravity Vision
  { id: "gemini-3.1-flash-image", name: "Gemini 3.1 Flash Image (Chuyên quét ảnh)", provider: "ANTIGRAVITY", category: "ocr" },
  { id: "gemini-3.8-flash-high", name: "Gemini 3.8 Flash High (De xuat OCR)", provider: "ANTIGRAVITY", category: "ocr" },
  { id: "gemini-3-flash", name: "Gemini 3 Flash (Nhanh, on dinh)", provider: "ANTIGRAVITY", category: "ocr" },

  // OpenAI Vision
  { id: "gpt-image-1.5", name: "GPT Image 1.5 (Chuyên quét ảnh)", provider: "OPENAI", category: "ocr" },
  { id: "gpt-5.6-terra", name: "GPT 5.6 Terra (Multimodal)", provider: "OPENAI", category: "ocr" },
];

export const OPENAI_TEXT_MODELS: GatewayModelItem[] = [
  { id: "gpt-5.4-mini", name: "GPT 5.4 Mini (Khuyên dùng gói Miễn phí)", provider: "OPENAI", category: "text" },
  { id: "gpt-4.1-mini", name: "GPT 4.1 Mini (Ổn định, tiết kiệm)", provider: "OPENAI", category: "text" },
  { id: "gpt-4o-mini", name: "GPT 4o Mini (Phổ biến)", provider: "OPENAI", category: "text" },
  { id: "gpt-5.6-terra", name: "GPT 5.6 Terra (Chuẩn EduPlan VIP)", provider: "OPENAI", category: "text" },
  { id: "gpt-5.6-sol", name: "GPT 5.6 Sol", provider: "OPENAI", category: "text" },
  { id: "gpt-5.6-luna", name: "GPT 5.6 Luna", provider: "OPENAI", category: "text" },
  { id: "gpt-6.1-terra", name: "GPT 6.1 Terra", provider: "OPENAI", category: "text" },
  { id: "gpt-6.1-sol", name: "GPT 6.1 Sol", provider: "OPENAI", category: "text" },
  { id: "gpt-6-astra", name: "GPT 6.0 Astra", provider: "OPENAI", category: "text" },
  { id: "gpt-6-sol", name: "GPT 6.0 Sol", provider: "OPENAI", category: "text" },
  { id: "gpt-6-luna", name: "GPT 6.0 Luna", provider: "OPENAI", category: "text" },
  { id: "codex-auto-review", name: "Codex Auto Review", provider: "OPENAI", category: "text" },
  { id: "gpt-4.1", name: "GPT 4.1 (Chi tiết cao)", provider: "OPENAI", category: "text" },
  { id: "gpt-4o", name: "GPT 4o (Đa năng mạnh mẽ)", provider: "OPENAI", category: "text" },
];

export const OPENAI_OCR_MODELS: GatewayModelItem[] = [
  { id: "gpt-5.4-mini", name: "GPT 5.4 Mini (Multimodal)", provider: "OPENAI", category: "ocr" },
  { id: "gpt-image-1.5", name: "GPT Image 1.5 (Chuyên quét ảnh SGK)", provider: "OPENAI", category: "ocr" },
  { id: "gpt-5.6-terra", name: "GPT 5.6 Terra (Multimodal cao cấp)", provider: "OPENAI", category: "ocr" },
  { id: "gpt-4.1-mini", name: "GPT 4.1 Mini (Vision)", provider: "OPENAI", category: "ocr" },
  { id: "gpt-4o-mini", name: "GPT 4o Mini (Vision)", provider: "OPENAI", category: "ocr" },
  { id: "gpt-4o", name: "GPT 4o (Vision độ nét cao)", provider: "OPENAI", category: "ocr" },
];

export const DEFAULT_AI_GATEWAY_SETTINGS: AiGatewaySettings = {
  enabled: false,
  baseUrl: "",
  apiKey: "",
  routingMode: "hybrid",
  freeModel: "gemini-3.5-flash-lite",
  freeOcrModel: "gemini-3.8-flash-high",
  plusModel: "gpt-5.6-terra",
  plusOcrModel: "gemini-3.8-flash-high",
  openaiApiKey: "",
  openaiModel: "gpt-5.4-mini",
  openaiFreeModel: "gpt-5.4-mini",
  openaiFreeOcrModel: "gpt-5.4-mini",
  openaiPlusModel: "gpt-5.6-terra",
  openaiPlusOcrModel: "gpt-image-1.5",
};

export function normalizeAiGatewaySettings(raw: unknown): AiGatewaySettings {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_AI_GATEWAY_SETTINGS };
  const data = raw as Record<string, unknown>;
  const routingMode: AiRoutingMode =
    data.routingMode === "gateway_only" || data.routingMode === "openai_only" ? data.routingMode : "hybrid";

  return {
    enabled: Boolean(data.enabled),
    baseUrl: typeof data.baseUrl === "string" ? data.baseUrl.trim() : "",
    apiKey: typeof data.apiKey === "string" ? data.apiKey.trim() : "",
    routingMode,
    freeModel: typeof data.freeModel === "string" && data.freeModel.trim() ? data.freeModel.trim() : DEFAULT_AI_GATEWAY_SETTINGS.freeModel,
    freeOcrModel: typeof data.freeOcrModel === "string" && data.freeOcrModel.trim() ? data.freeOcrModel.trim() : DEFAULT_AI_GATEWAY_SETTINGS.freeOcrModel,
    plusModel: typeof data.plusModel === "string" && data.plusModel.trim() ? data.plusModel.trim() : DEFAULT_AI_GATEWAY_SETTINGS.plusModel,
    plusOcrModel: typeof data.plusOcrModel === "string" && data.plusOcrModel.trim() ? data.plusOcrModel.trim() : DEFAULT_AI_GATEWAY_SETTINGS.plusOcrModel,
    openaiApiKey: typeof data.openaiApiKey === "string" ? data.openaiApiKey.trim() : "",
    openaiModel: typeof data.openaiModel === "string" && data.openaiModel.trim() ? data.openaiModel.trim() : DEFAULT_AI_GATEWAY_SETTINGS.openaiModel,
    openaiFreeModel: typeof data.openaiFreeModel === "string" && data.openaiFreeModel.trim() ? data.openaiFreeModel.trim() : DEFAULT_AI_GATEWAY_SETTINGS.openaiFreeModel,
    openaiFreeOcrModel: typeof data.openaiFreeOcrModel === "string" && data.openaiFreeOcrModel.trim() ? data.openaiFreeOcrModel.trim() : DEFAULT_AI_GATEWAY_SETTINGS.openaiFreeOcrModel,
    openaiPlusModel: typeof data.openaiPlusModel === "string" && data.openaiPlusModel.trim() ? data.openaiPlusModel.trim() : DEFAULT_AI_GATEWAY_SETTINGS.openaiPlusModel,
    openaiPlusOcrModel: typeof data.openaiPlusOcrModel === "string" && data.openaiPlusOcrModel.trim() ? data.openaiPlusOcrModel.trim() : DEFAULT_AI_GATEWAY_SETTINGS.openaiPlusOcrModel,
  };
}
