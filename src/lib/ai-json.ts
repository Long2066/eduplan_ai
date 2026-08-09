import { jsonrepair } from "jsonrepair";

function stripMarkdownFence(text: string) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return (fenced?.[1] || trimmed).trim();
}

function isolateJsonCandidate(text: string) {
  const cleaned = stripMarkdownFence(text);
  const objectStart = cleaned.indexOf("{");
  const arrayStart = cleaned.indexOf("[");
  const starts = [objectStart, arrayStart].filter((index) => index >= 0);
  if (!starts.length) return cleaned;

  const start = Math.min(...starts);
  const opening = cleaned[start];
  const closing = opening === "{" ? "}" : "]";
  const end = cleaned.lastIndexOf(closing);
  return end > start ? cleaned.slice(start, end + 1) : cleaned.slice(start);
}

export function extractAiJsonValue<T>(text: string): T {
  const candidate = isolateJsonCandidate(text);
  if (!candidate || (!candidate.includes("{") && !candidate.includes("["))) {
    throw new Error("AI trả về dữ liệu chưa đúng cấu trúc JSON sau khi hệ thống tự sửa. Vui lòng thử tạo lại.");
  }

  const parseStructuredValue = (value: string) => {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object") {
      throw new Error("AI JSON root must be an object or array.");
    }
    return parsed as T;
  };

  try {
    return parseStructuredValue(candidate);
  } catch (parseError) {
    try {
      return parseStructuredValue(jsonrepair(candidate));
    } catch (repairError) {
      console.error("[EduPlan AI] AI JSON parsing failed", {
        contentLength: text.length,
        parseMessage: parseError instanceof Error ? parseError.message : "Unknown parse error",
        repairMessage: repairError instanceof Error ? repairError.message : "Unknown repair error",
      });
      throw new Error("AI trả về dữ liệu chưa đúng cấu trúc JSON sau khi hệ thống tự sửa. Vui lòng thử tạo lại.");
    }
  }
}
