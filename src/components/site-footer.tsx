import Image from "next/image";
import { APP_VERSION, APP_VERSION_LABEL } from "@/lib/defaults";

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
            <div className="flex items-center gap-2">
              <strong>EduPlan AI</strong>
              <span className="inline-flex items-center rounded-md bg-blue-50 px-1.5 py-0.5 text-[11px] font-bold text-blue-700 ring-1 ring-inset ring-blue-700/15">
                {APP_VERSION}
              </span>
            </div>
            <span>SOẠN GIÁO ÁN THÔNG MINH</span>
            <p>Tạo kế hoạch bài dạy theo Công văn 2345 bằng AI, nhanh và dễ chỉnh sửa.</p>
          </div>
        </div>

        <div className="site-footer-right flex flex-col items-start sm:items-end gap-1.5 w-full sm:w-auto">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100/90 px-3 py-1 text-xs font-bold text-slate-700 border border-slate-200/80 shadow-2xs">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" aria-hidden="true" />
            {APP_VERSION_LABEL}
          </span>
          <p className="site-footer-copyright">© {currentYear} EduPlan AI</p>
        </div>
      </div>
    </footer>
  );
}
