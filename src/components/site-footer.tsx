export function SiteFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="site-footer" aria-label="Chân trang EduPlan AI">
      <div className="site-footer-inner">
        <div className="site-footer-brand">
          <span className="site-footer-logo" aria-hidden="true">
            <svg viewBox="0 0 48 48" focusable="false">
              <path d="M8.5 15.5c5.8.5 10.2 2.3 13.5 5.2v18.8c-3.8-2.6-8.3-4.1-13.5-4.5V15.5Z" fill="currentColor" />
              <path d="M39.5 15.5c-5.8.5-10.2 2.3-13.5 5.2v18.8c3.8-2.6 8.3-4.1 13.5-4.5V15.5Z" fill="currentColor" />
              <path d="M24 18.8v21" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2.5" opacity="0.8" />
              <path d="m38.5 6 1.7 4.2 4.3 1.8-4.3 1.8-1.7 4.2-1.8-4.2-4.2-1.8 4.2-1.8L38.5 6Z" fill="currentColor" />
            </svg>
          </span>

          <div className="site-footer-identity">
            <strong>EduPlan AI</strong>
            <span>SOẠN GIÁO ÁN THÔNG MINH</span>
            <p>Tạo kế hoạch bài dạy theo Công văn 2345 bằng AI, nhanh và dễ chỉnh sửa.</p>
          </div>
        </div>

        <p className="site-footer-copyright">© {currentYear} EduPlan AI</p>
      </div>
    </footer>
  );
}
