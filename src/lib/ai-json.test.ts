import { describe, expect, it } from "vitest";
import { extractAiJsonValue } from "./ai-json";

describe("extractAiJsonValue", () => {
  it("parses valid JSON", () => {
    expect(extractAiJsonValue<{ periods: number }>('{"periods":4}')).toEqual({ periods: 4 });
  });

  it("extracts JSON from a markdown fence", () => {
    expect(extractAiJsonValue<{ subject: string }>('```json\n{"subject":"Tiếng Việt"}\n```')).toEqual({ subject: "Tiếng Việt" });
  });

  it("repairs a missing comma between array elements", () => {
    expect(extractAiJsonValue<{ items: string[] }>('{"items":["một" "hai", "ba"]}')).toEqual({ items: ["một", "hai", "ba"] });
  });

  it("repairs trailing commas and missing closing brackets", () => {
    expect(extractAiJsonValue<{ items: string[] }>('Lời dẫn {"items":["một","hai",]}')).toEqual({ items: ["một", "hai"] });
  });

  it("returns a safe public error for irreparable text", () => {
    expect(() => extractAiJsonValue("không có dữ liệu JSON")).toThrow("AI trả về dữ liệu chưa đúng cấu trúc JSON sau khi hệ thống tự sửa. Vui lòng thử tạo lại.");
  });
});
