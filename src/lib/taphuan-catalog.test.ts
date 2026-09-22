import { describe, expect, it } from "vitest";
import {
  findTaphuanBook,
  getTaphuanBookByKey,
  taphuanCatalog,
  UNIFIED_BOOK_LABEL,
  TAPHUAN_SOURCE_LABEL,
  TAPHUAN_COPYRIGHT_LABEL,
} from "./taphuan-catalog";

describe("taphuan-catalog", () => {
  it("defines standard labels for Unified Textbook and NXBGDVN copyright", () => {
    expect(UNIFIED_BOOK_LABEL).toBe("Bộ sách Thống nhất");
    expect(TAPHUAN_SOURCE_LABEL).toBe("taphuan.nxbgd.vn");
    expect(TAPHUAN_COPYRIGHT_LABEL).toContain("Nhà xuất bản Giáo dục Việt Nam (NXBGDVN)");
  });

  it("finds Tiếng Việt 1 Tập một and Tập hai correctly", () => {
    const tv1Vol1 = findTaphuanBook("Lớp 1", "Tiếng Việt", "Tập một");
    expect(tv1Vol1).not.toBeNull();
    expect(tv1Vol1?.title).toContain("Tiếng Việt 1, tập một");
    expect(tv1Vol1?.readerUrl).toContain("https://taphuan.nxbgd.vn/");

    const tv1Vol2 = findTaphuanBook("Lớp 1", "Tiếng Việt", "Tập hai");
    expect(tv1Vol2).not.toBeNull();
    expect(tv1Vol2?.title).toContain("Tiếng Việt 1, tập hai");
  });

  it("finds subjects without volume correctly", () => {
    const tnxh1 = findTaphuanBook("Lớp 1", "Tự nhiên và Xã hội");
    expect(tnxh1).not.toBeNull();
    expect(tnxh1?.title).toContain("Tự nhiên và Xã hội 1");

    const tinHoc3 = findTaphuanBook("Lớp 3", "Tin học");
    expect(tinHoc3).not.toBeNull();
    expect(tinHoc3?.title).toContain("Tin học 3");

    const lsDl4 = findTaphuanBook("Lớp 4", "Lịch sử và Địa lí");
    expect(lsDl4).not.toBeNull();
    expect(lsDl4?.title).toContain("Lịch sử và Địa lí 4");
  });

  it("retrieves book by key", () => {
    const book = getTaphuanBookByKey("lop-1-tieng-viet-tap-1");
    expect(book).not.toBeNull();
    expect(book?.grade).toBe("Lớp 1");
    expect(book?.subject).toBe("Tiếng Việt");
  });

  it("covers all elementary grades from Lớp 1 to Lớp 5", () => {
    const grades = new Set(taphuanCatalog.map((item) => item.grade));
    expect(grades.has("Lớp 1")).toBe(true);
    expect(grades.has("Lớp 2")).toBe(true);
    expect(grades.has("Lớp 3")).toBe(true);
    expect(grades.has("Lớp 4")).toBe(true);
    expect(grades.has("Lớp 5")).toBe(true);
  });
});
