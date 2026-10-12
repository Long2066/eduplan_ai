import { describe, expect, it } from "vitest";
import {
  auditTiengVietDigitalIntegration,
  CV3456_INDICATOR_REGEX,
  findIndicatorByCode,
  getAllCV3456Indicators,
  getBandForGrade,
  getIndicatorsByGrade,
  suggestTiengVietDigitalActivity,
} from "./digital-competency-cv3456";

describe("digital-competency-cv3456", () => {
  it("determines correct band for grades", () => {
    expect(getBandForGrade(1)).toBe("CB1");
    expect(getBandForGrade("Lớp 2")).toBe("CB1");
    expect(getBandForGrade(3)).toBe("CB1");
    expect(getBandForGrade(4)).toBe("CB2");
    expect(getBandForGrade("Lớp 5")).toBe("CB2");
  });

  it("loads CV 3456 indicators matching code regex", () => {
    const indicators = getAllCV3456Indicators();
    expect(indicators.length).toBeGreaterThan(10);
    for (const ind of indicators) {
      expect(CV3456_INDICATOR_REGEX.test(ind.code)).toBe(true);
      expect(ind.tieng_viet_context).toBeTruthy();
    }
  });

  it("filters indicators by grade", () => {
    const cb1List = getIndicatorsByGrade(2);
    expect(cb1List.every((item) => item.band === "CB1")).toBe(true);

    const cb2List = getIndicatorsByGrade(4);
    expect(cb2List.every((item) => item.band === "CB2")).toBe(true);
  });

  it("finds indicator by code", () => {
    const item = findIndicatorByCode("3.1.cb1a");
    expect(item).toBeDefined();
    expect(item?.code).toBe("3.1.CB1a");
    expect(item?.domainName).toContain("Sáng tạo");
  });

  it("generates authentic student task suggestion for grade 1 phonics", () => {
    const suggestion = suggestTiengVietDigitalActivity(1, "phonics", "Bài 31 an ăn ân");
    expect(suggestion.indicatorCode).toBe("3.1.CB1a");
    expect(suggestion.studentAction).toContain("thao tác nút ghi âm");
    expect(suggestion.digitalProduct).toContain("Tệp ghi âm");
  });

  it("generates authentic suggestion for grade 4 composition", () => {
    const suggestion = suggestTiengVietDigitalActivity(4, "composition", "Viết bài văn miêu tả cây cối");
    expect(suggestion.indicatorCode).toBe("3.4.CB2a");
    expect(suggestion.studentAction).toContain("sơ đồ");
  });

  it("detects superficial digital integration when teacher uses screen but student has no digital task", () => {
    const superficialActivity = {
      phase: "Khám phá",
      title: "Khám phá bài đọc",
      objective: "Đọc hiểu",
      teacherActions: ["GV chiếu slide hình ảnh nhân vật lên tivi."],
      studentActions: ["HS quan sát và lắng nghe GV giảng giải."],
    };
    const result = auditTiengVietDigitalIntegration(superficialActivity);
    expect(result.isValid).toBe(false);
    expect(result.hasSuperficialWarning).toBe(true);
    expect(result.message).toContain("Cảnh báo NLS hình thức");
  });

  it("passes authentic digital integration when student actively operates digital tool", () => {
    const authenticActivity = {
      phase: "Luyện tập",
      title: "Thực hành ghi âm bài đọc (3.1.CB1a)",
      objective: "Ghi âm đọc mẫu",
      teacherActions: ["GV hướng dẫn HS sử dụng máy tính bảng để ghi âm."],
      studentActions: ["HS thao tác ghi âm bài đọc và mở nghe lại để kiểm tra giọng đọc."],
    };
    const result = auditTiengVietDigitalIntegration(authenticActivity);
    expect(result.isValid).toBe(true);
    expect(result.hasSuperficialWarning).toBe(false);
    expect(result.code).toBe("3.1.CB1A");
  });
});
