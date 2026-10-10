import { describe, expect, it } from "vitest";
import {
  isInternalPhoneEmail,
  isValidPhoneNumber,
  isValidVietnamesePhoneNumber,
  normalizePhoneNumber,
  phoneToInternalEmail,
} from "@/lib/phone-utils";

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

  it("validates Vietnamese carrier prefixes correctly", () => {
    // Valid Viettel, Vinaphone, Mobifone, Vietnamobile, Wintel, Itelecom
    expect(isValidVietnamesePhoneNumber("0912345678")).toBe(true);
    expect(isValidVietnamesePhoneNumber("0342733640")).toBe(true);
    expect(isValidVietnamesePhoneNumber("0868123456")).toBe(true);
    expect(isValidVietnamesePhoneNumber("0771234567")).toBe(true);
    expect(isValidVietnamesePhoneNumber("0581234567")).toBe(true);
    expect(isValidVietnamesePhoneNumber("+84912345678")).toBe(true);
    expect(isValidVietnamesePhoneNumber("+84 342 733 640")).toBe(true);

    // Invalid numbers: landline, wrong length, fake prefixes
    expect(isValidVietnamesePhoneNumber("0123456789")).toBe(false); // 01 obsolete
    expect(isValidVietnamesePhoneNumber("02431234567")).toBe(false); // landline Hanoi
    expect(isValidVietnamesePhoneNumber("091234567")).toBe(false); // 9 digits
    expect(isValidVietnamesePhoneNumber("09123456789")).toBe(false); // 11 digits
    expect(isValidVietnamesePhoneNumber("abcdefghij")).toBe(false);
  });

  it("converts phone numbers to internal emails and recognizes them", () => {
    const email = phoneToInternalEmail("+84912345678");
    expect(email).toBe("phone_84912345678@phone.eduplan.vn");
    expect(isInternalPhoneEmail(email)).toBe(true);
    expect(isInternalPhoneEmail("user@gmail.com")).toBe(false);
    expect(isInternalPhoneEmail(null)).toBe(false);
  });
});
