import { describe, expect, it, vi } from "vitest";
import type { PedagogyAuditFinding } from "@/types/lesson";
import {
  findingsForPeriod,
  formatRepairFinding,
  repairableErrorFindings,
  runQualityRepairLoop,
} from "./lesson-repair-policy";

const finding = (
  code: string,
  severity: PedagogyAuditFinding["severity"],
  autoFixable: boolean,
  extra: Partial<PedagogyAuditFinding> = {},
): PedagogyAuditFinding => ({ code, severity, autoFixable, message: code, ...extra });

describe("lesson repair policy", () => {
  it("chỉ chọn error được phép tự sửa", () => {
    const findings = [
      finding("FIX", "error", true),
      finding("SOURCE", "error", false),
      finding("WARN", "warning", true),
      finding("SUGGEST", "suggestion", true),
    ];

    expect(repairableErrorFindings(findings).map((item) => item.code)).toEqual(["FIX"]);
  });

  it("đưa finding toàn bài và finding đúng tiết vào repair của tiết", () => {
    const findings = [
      finding("GLOBAL", "error", true),
      finding("P1", "error", true, { periodNumber: 1 }),
      finding("P2", "error", true, { periodNumber: 2 }),
    ];

    expect(findingsForPeriod(findings, 2).map((item) => item.code)).toEqual(["GLOBAL", "P2"]);
  });

  it("dừng ngay khi không có lỗi bắt buộc", async () => {
    const repair = vi.fn();
    const result = await runQualityRepairLoop({
      initialValue: { valid: true },
      validate: () => [finding("WARN", "warning", true)],
      repair,
    });

    expect(repair).not.toHaveBeenCalled();
    expect(result.roundsAttempted).toBe(0);
    expect(result.repairApplied).toBe(false);
  });

  it("cho phép caller lọc nhóm lỗi cần repair bằng AI", async () => {
    const repair = vi.fn(async () => ({ version: 1 }));
    const result = await runQualityRepairLoop({
      initialValue: { version: 0 },
      validate: () => [
        finding("MECHANICAL", "error", true),
        finding("AI", "error", true),
      ],
      repairableFindings: (findings) => findings.filter((item) => item.code === "AI"),
      repair,
    });

    expect(repair).toHaveBeenCalledTimes(2);
    const calls = repair.mock.calls as unknown as Array<[unknown, PedagogyAuditFinding[]]>;
    expect(calls[0]?.[1].map((item) => item.code)).toEqual(["AI"]);
    expect(result.remainingFindings.map((item) => item.code)).toEqual(["AI"]);
  });

  it("kiểm tra lại và dừng sớm khi vòng đầu sửa hết lỗi", async () => {
    const repair = vi.fn(async () => ({ errors: 0 }));
    const result = await runQualityRepairLoop({
      initialValue: { errors: 1 },
      validate: (value) => value.errors ? [finding("FIX", "error", true)] : [],
      repair,
    });

    expect(repair).toHaveBeenCalledTimes(1);
    expect(result.roundsAttempted).toBe(1);
    expect(result.remainingFindings).toEqual([]);
  });

  it("khóa cứng tối đa hai vòng dù caller yêu cầu nhiều hơn", async () => {
    const repair = vi.fn(async (value: { version: number }) => ({ version: value.version + 1 }));
    const result = await runQualityRepairLoop({
      initialValue: { version: 0 },
      validate: () => [finding("FIX", "error", true)],
      repair,
      maxRounds: 10,
    });

    expect(repair).toHaveBeenCalledTimes(2);
    expect(result.roundsAttempted).toBe(2);
    expect(result.value.version).toBe(2);
    expect(result.remainingFindings).toHaveLength(1);
  });

  it("dừng an toàn khi model repair thất bại", async () => {
    const result = await runQualityRepairLoop({
      initialValue: "original",
      validate: () => [finding("FIX", "error", true)],
      repair: async () => null,
    });

    expect(result.value).toBe("original");
    expect(result.roundsAttempted).toBe(1);
    expect(result.repairApplied).toBe(false);
  });

  it("định dạng mã và vị trí để model sửa chính xác", () => {
    expect(formatRepairFinding(finding("LQ-ACTIVITY-02", "error", true, {
      periodNumber: 2,
      activityIndex: 1,
      objectiveId: "OBJ-3",
      message: "Câu mẫu rỗng.",
    }))).toBe("[LQ-ACTIVITY-02] (Tiết 2, hoạt động 2, mục tiêu OBJ-3): Câu mẫu rỗng.");
  });
});
