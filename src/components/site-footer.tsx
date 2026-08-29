import Image from "next/image";

export function SiteFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="site-footer" aria-label="Chân trang EduPlan AI">
      <div className="site-footer-inner">
        <div className="site-footer-brand">
          <span className="site-footer-logo" aria-hidden="true">
            <Image src="/icon.png" alt="" width={52} height={52} sizes="52px" />
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
