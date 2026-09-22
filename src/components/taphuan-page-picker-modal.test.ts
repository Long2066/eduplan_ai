import { describe, expect, it } from "vitest";
import { parsePageRange } from "./taphuan-page-picker-modal";

describe("parsePageRange", () => {
  it("handles single page number", () => {
    expect(parsePageRange("156", 200)).toEqual([156]);
  });

  it("handles page range with hyphen", () => {
    expect(parsePageRange("156-158", 200)).toEqual([156, 157, 158]);
  });

  it("handles multiple comma-separated pages and ranges", () => {
    expect(parsePageRange("10, 12-14, 20", 200)).toEqual([10, 12, 13, 14, 20]);
  });

  it("clamps to maxPages and ignores invalid inputs", () => {
    expect(parsePageRange("198-205", 200)).toEqual([198, 199, 200]);
    expect(parsePageRange("abc, -5, 0", 200)).toEqual([]);
    expect(parsePageRange("", 200)).toEqual([]);
  });
});
