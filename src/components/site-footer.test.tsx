import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SiteFooter } from "./site-footer";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

describe("SiteFooter", () => {
  it("renders only the approved brand identity and copyright content", () => {
    const markup = renderToStaticMarkup(<SiteFooter />);

    expect(markup).toContain("<footer");
    expect(markup).toContain('aria-label="Chân trang EduPlan AI"');
    expect(markup).toContain("<img");
    expect(markup).toMatch(/(?:%2F|\/)icon\.png/);
    expect(markup).not.toContain("<svg");
    expect(markup).toContain("SOẠN GIÁO ÁN THÔNG MINH");
    expect(markup).toContain("Tạo kế hoạch bài dạy theo Công văn 2345 bằng AI, nhanh và dễ chỉnh sửa.");
    expect(markup).toContain(`© ${new Date().getFullYear()} EduPlan AI`);
    expect(markup).not.toContain("<a");
    expect(markup).not.toContain("<button");
    expect(markup).not.toMatch(/Zalo|điện thoại|Gửi góp ý|Hướng dẫn|Giới thiệu/i);
  });
});
