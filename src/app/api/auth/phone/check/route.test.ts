import { describe, expect, it } from "vitest";
import { isValidPhoneNumber, normalizePhoneNumber } from "@/lib/phone-utils";

describe("phone normalization & validation", () => {
  it("normalizes Vietnamese mobile numbers starting with 0", () => {
    expect(normalizePhoneNumber("0912345678")).toBe("+84912345678");
    expect(normalizePhoneNumber("0342 733 640")).toBe("+84342733640");
    expect(normalizePhoneNumber("098.765.4321")).toBe("+84987654321");
    expect(normalizePhoneNumber("090-123-4567")).toBe("+84901234567");
  });

  it("normalizes numbers already starting with 84 or +84", () => {
    expect(normalizePhoneNumber("84912345678")).toBe("+84912345678");
    expect(normalizePhoneNumber("+84912345678")).toBe("+84912345678");
    expect(normalizePhoneNumber("+84 912 345 678")).toBe("+84912345678");
  });

  it("validates phone number E.164 format correctly", () => {
    expect(isValidPhoneNumber("+84912345678")).toBe(true);
    expect(isValidPhoneNumber("+84342733640")).toBe(true);
    expect(isValidPhoneNumber("0912345678")).toBe(false);
    expect(isValidPhoneNumber("abc")).toBe(false);
    expect(isValidPhoneNumber("")).toBe(false);
    expect(isValidPhoneNumber("+0123")).toBe(false);
  });
});
