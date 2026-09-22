import { describe, expect, it } from "vitest";
import { extractDownloadBookPagesUrls } from "./taphuan-reader";

describe("taphuan-reader parser", () => {
  it("extracts valid taphuan image URLs correctly", () => {
    const html = `
      <html>
        <script>
          var download_book_pages_urls = [
            "https://taphuan.nxbgd.vn/storage/upload/taphuan/2026/0413/4695822132-page-2-1776050277449.png",
            "https://taphuan.nxbgd.vn/storage/upload/taphuan/2026/0413/4695822132-page-3-1776050279394.png"
          ];
        </script>
      </html>
    `;

    const pages = extractDownloadBookPagesUrls(html);
    expect(pages).toHaveLength(2);
    expect(pages[0]).toBe("https://taphuan.nxbgd.vn/storage/upload/taphuan/2026/0413/4695822132-page-2-1776050277449.png");
    expect(pages[1]).toBe("https://taphuan.nxbgd.vn/storage/upload/taphuan/2026/0413/4695822132-page-3-1776050279394.png");
  });

  it("strictly discards malicious URLs not belonging to taphuan storage", () => {
    const html = `
      var download_book_pages_urls = [
        "https://evil.com/fake.png",
        "https://taphuan.nxbgd.vn/storage/upload/taphuan/real.png",
        "javascript:alert(1)"
      ];
    `;

    const pages = extractDownloadBookPagesUrls(html);
    expect(pages).toHaveLength(1);
    expect(pages[0]).toBe("https://taphuan.nxbgd.vn/storage/upload/taphuan/real.png");
  });

  it("returns empty array when marker is missing or invalid", () => {
    expect(extractDownloadBookPagesUrls("<html><body>No pages here</body></html>")).toEqual([]);
    expect(extractDownloadBookPagesUrls("download_book_pages_urls: not-an-array")).toEqual([]);
  });
});
