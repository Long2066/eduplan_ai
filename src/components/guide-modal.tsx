"use client";

import { useEffect, type ReactNode } from "react";

interface GuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const guideImages = {
  lessonInfo: "/huong-dan/guide-01-thong-tin-bai-hoc.png",
  inputArea: "/huong-dan/guide-02-noi-dung-dau-vao.png",
  uploadPc: "/huong-dan/guide-03-tai-len-tu-pc.png",
  chooseImage: "/huong-dan/guide-04-chon-anh-bai-hoc.png",
  uploadedImage: "/huong-dan/guide-05-anh-da-tai-len.png",
  advancedToggle: "/huong-dan/guide-06-tuy-chon-nang-cao.png",
  advancedFields: "/huong-dan/guide-07-ca-nhan-hoa-giao-an.png",
  screenshotSgk: "/huong-dan/guide-08-chup-sgk-dien-tu.png",
  pastedImage: "/huong-dan/guide-09-dan-anh-vao-eduplan.png",
  exportWord: "/huong-dan/guide-10-xuat-word.png",
};

function StepBadge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-sm font-black text-white shadow-lg shadow-emerald-600/25">
      {children}
    </span>
  );
}

function GuideImage({ src, alt, wide = false }: { src: string; alt: string; wide?: boolean }) {
  return (
    <figure className={`guide-image-card ${wide ? "guide-image-card-wide" : ""}`}>
      <img src={src} alt={alt} loading="lazy" />
      <figcaption>{alt}</figcaption>
    </figure>
  );
}

export function GuideModal({ isOpen, onClose }: GuideModalProps) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-3 backdrop-blur-sm animate-in fade-in duration-200 sm:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="guide-modal-title"
    >
      <section
        className="guide-modal-shell animate-in zoom-in-95 duration-200"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="guide-modal-header">
          <div className="min-w-0">
            <span className="guide-kicker">EduPlan AI</span>
            <h2 id="guide-modal-title">Hướng dẫn sử dụng EduPlan AI</h2>
            <p>Tạo giáo án nhanh từ ảnh SGK theo 3 bước: nhập thông tin, thêm nội dung, tạo và xuất Word.</p>
          </div>
          <button type="button" className="guide-close-button" onClick={onClose} aria-label="Đóng hướng dẫn">
            ×
          </button>
        </header>

        <div className="guide-modal-body">
          <article className="guide-document">
            <section className="guide-hero">
              <div>
                <p className="guide-eyebrow">Bản hướng dẫn nhanh</p>
                <h1>Soạn giáo án với EduPlan AI</h1>
                <p>
                  Tài liệu này giúp thầy/cô nắm ngay quy trình sử dụng công cụ: điền thông tin bài học,
                  đưa ảnh SGK vào hệ thống, tạo giáo án và tải file Word về máy.
                </p>
              </div>
              <div className="guide-quick-card" aria-label="Quy trình nhanh">
                <div><strong>1</strong><span>Nhập thông tin bài học</span></div>
                <div><strong>2</strong><span>Tải hoặc dán ảnh SGK</span></div>
                <div><strong>3</strong><span>Tạo giáo án và xuất Word</span></div>
              </div>
            </section>

            <section className="guide-section">
              <div className="guide-section-title">
                <StepBadge>1</StepBadge>
                <div>
                  <p>Thông tin bài học</p>
                  <h3>Nhập thông tin để AI hiểu yêu cầu soạn giáo án</h3>
                </div>
              </div>
              <p>
                Tại mục <strong>“Thông tin bài học”</strong>, thầy/cô điền các nội dung cần thiết như môn học,
                lớp, tên bài học, thời lượng hoặc số tiết dạy. Nếu có yêu cầu riêng, hãy nhập thêm để giáo án sát nhu cầu hơn.
              </p>
              <ul className="guide-check-list">
                <li>Môn học, lớp, tên bài học.</li>
                <li>Thời lượng hoặc số tiết dạy.</li>
                <li>Yêu cầu/định hướng riêng nếu có.</li>
              </ul>
              <GuideImage src={guideImages.lessonInfo} alt="Màn hình nhập thông tin bài học" />
            </section>

            <section className="guide-section">
              <div className="guide-section-title">
                <StepBadge>2</StepBadge>
                <div>
                  <p>Nội dung đầu vào</p>
                  <h3>Thêm ảnh SGK vào EduPlan AI</h3>
                </div>
              </div>
              <p>
                Thầy/cô có thể thêm ảnh bài học bằng một trong hai cách: tải ảnh có sẵn từ máy tính hoặc dán ảnh vừa chụp từ SGK điện tử.
              </p>

              <div className="guide-method-card">
                <h4>Cách 1: Tải ảnh từ máy tính</h4>
                <p>Dùng khi thầy/cô đã có sẵn ảnh bài học trong máy.</p>
                <ol>
                  <li>Nhấn <strong>“Tải lên từ PC”</strong>.</li>
                  <li>Chọn một hoặc nhiều ảnh bài học cần soạn.</li>
                  <li>Kiểm tra ảnh đã hiển thị trong công cụ.</li>
                </ol>
                <div className="guide-image-grid">
                  <GuideImage src={guideImages.inputArea} alt="Khu vực thêm nội dung đầu vào" />
                  <GuideImage src={guideImages.uploadPc} alt="Chọn tải ảnh lên từ máy tính" />
                  <GuideImage src={guideImages.chooseImage} alt="Chọn ảnh bài học từ thiết bị" />
                  <GuideImage src={guideImages.uploadedImage} alt="Ảnh SGK sau khi tải lên thành công" />
                </div>
              </div>

              <div className="guide-method-card guide-method-card-soft">
                <h4>Cách 2: Dán ảnh từ SGK điện tử</h4>
                <p>Dùng khi thầy/cô đang mở SGK điện tử hoặc tài liệu bài học trên máy tính.</p>
                <ol>
                  <li>Mở SGK điện tử đến trang bài học cần soạn.</li>
                  <li>Nhấn <kbd>Windows</kbd> + <kbd>Shift</kbd> + <kbd>S</kbd> để chụp vùng nội dung cần dùng.</li>
                  <li>Quét chọn vùng ảnh bài học, sau đó quay lại EduPlan AI.</li>
                  <li>Nhấn <kbd>Ctrl</kbd> + <kbd>V</kbd> để dán ảnh vào công cụ.</li>
                </ol>
                <GuideImage src={guideImages.screenshotSgk} alt="Chụp vùng nội dung bài học từ SGK điện tử" wide />
                <GuideImage src={guideImages.pastedImage} alt="Ảnh sau khi dán vào EduPlan AI" />
              </div>
            </section>

            <section className="guide-section">
              <div className="guide-section-title">
                <StepBadge>3</StepBadge>
                <div>
                  <p>Cá nhân hóa</p>
                  <h3>Mở tùy chọn nâng cao nếu muốn giáo án sát yêu cầu hơn</h3>
                </div>
              </div>
              <p>
                Nếu muốn điều chỉnh sâu hơn, thầy/cô nhấn <strong>“Mở rộng”</strong> tại phần <strong>“Tùy chọn nâng cao”</strong>.
                Có thể bổ sung mục tiêu, phương pháp dạy học, hoạt động mong muốn hoặc yêu cầu riêng.
              </p>
              <p className="guide-note">Nếu không cần chỉnh thêm, thầy/cô có thể bỏ qua phần này.</p>
              <div className="guide-image-grid guide-image-grid-two">
                <GuideImage src={guideImages.advancedToggle} alt="Nút mở rộng phần Tùy chọn nâng cao" />
                <GuideImage src={guideImages.advancedFields} alt="Các thông tin có thể cá nhân hóa trong Tùy chọn nâng cao" />
              </div>
            </section>

            <section className="guide-section guide-final-section">
              <div className="guide-section-title">
                <StepBadge>4</StepBadge>
                <div>
                  <p>Tạo và xuất giáo án</p>
                  <h3>Nhấn tạo giáo án, kiểm tra nội dung và tải file Word</h3>
                </div>
              </div>
              <div className="guide-two-column">
                <div>
                  <h4>Tạo giáo án</h4>
                  <ol>
                    <li>Nhấn <strong>“Tạo giáo án ngay”</strong>.</li>
                    <li>Chờ khoảng <strong>3–5 phút</strong> để hệ thống xử lý.</li>
                    <li>Kiểm tra lại nội dung giáo án sau khi hoàn thành.</li>
                  </ol>
                </div>
                <div>
                  <h4>Xuất file Word</h4>
                  <ol>
                    <li>Nhấn <strong>“Xuất Word”</strong>.</li>
                    <li>Chờ vài giây để hệ thống tạo file.</li>
                    <li>File Word sẽ được tải về thiết bị của thầy/cô.</li>
                  </ol>
                </div>
              </div>
              <GuideImage src={guideImages.exportWord} alt="Nút Xuất Word để tải giáo án về máy" wide />
            </section>

            <section className="guide-tips">
              <h3>Lưu ý để giáo án tạo ra tốt hơn</h3>
              <div className="guide-tip-grid">
                <p>Nên dùng ảnh rõ nét, không bị mờ hoặc mất chữ.</p>
                <p>Có thể tải nhiều ảnh nếu bài học có nhiều trang.</p>
                <p>Nên chụp đúng phần nội dung bài học cần soạn.</p>
                <p>Muốn giáo án sát yêu cầu hơn, hãy điền thêm “Tùy chọn nâng cao”.</p>
              </div>
            </section>
          </article>
        </div>

        <footer className="guide-modal-footer">
          <span>Chúc thầy/cô sử dụng EduPlan AI hiệu quả!</span>
          <button type="button" className="btn-primary" onClick={onClose}>Đã hiểu</button>
        </footer>
      </section>
    </div>
  );
}
