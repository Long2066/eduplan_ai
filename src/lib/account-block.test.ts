import { describe, expect, it } from "vitest";
import {
  ADMIN_MANUAL_BLOCK_REASON,
  BLOCK_REASON_MAX_LENGTH,
  IP_ACCOUNT_LIMIT_MESSAGE,
  accountBlockedMessage,
  normalizeBlockReasonDetail,
} from "@/lib/account-block";

describe("account block policy", () => {
  it("normalizes whitespace and trims an admin reason", () => {
    expect(normalizeBlockReasonDetail("  Vi phạm   điều khoản\n nhiều lần  ")).toBe("Vi phạm điều khoản nhiều lần");
  });

  it("limits admin reasons to the safe maximum", () => {
    expect(normalizeBlockReasonDetail("a".repeat(BLOCK_REASON_MAX_LENGTH + 20))).toHaveLength(BLOCK_REASON_MAX_LENGTH);
  });

  it("includes the specific admin reason without exposing the internal code", () => {
    const message = accountBlockedMessage(ADMIN_MANUAL_BLOCK_REASON, "Chia sẻ tài khoản trái phép");
    expect(message).toContain("Lý do từ quản trị viên: Chia sẻ tài khoản trái phép");
    expect(message).toContain("0342 733 640");
    expect(message).not.toContain(ADMIN_MANUAL_BLOCK_REASON);
  });

  it("keeps the existing IP-limit message", () => {
    expect(accountBlockedMessage("ip_account_limit", "ignored")).toBe(IP_ACCOUNT_LIMIT_MESSAGE);
  });

  it("uses the support fallback for legacy blocked accounts", () => {
    const message = accountBlockedMessage("", "");
    expect(message).toContain("0342 733 640");
    expect(message).not.toContain("Lý do từ quản trị viên");
  });
});
