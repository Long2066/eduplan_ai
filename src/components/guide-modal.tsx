"use client";

import { useEffect, type ReactNode } from "react";

interface GuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const guideImages = {
  authLogin: "/huong-dan/guide-00-dang-nhap.png",
  lessonInfo: "/huong-dan/guide-01-thong-tin-bai-hoc.png",
  sgkSelectRange: "/huong-dan/guide-04-nhap-dai-trang-nap.png",
  advancedFields: "/huong-dan/guide-07-nang-luc-so-va-ca-nhan-hoa.png",
  previewExport: "/huong-dan/guide-09-xem-truoc-xuat-word.png",
};

function StepBadge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-sm font-black text-white shadow-md shadow-brand-600/25">
      {children}
    </span>
  );
}

function GuideImage({ src, alt }: { src: string; alt: string }) {
  return (
    <figure className="guide-image-card">
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-sm animate-in fade-in duration-200 sm:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="guide-modal-title"
    >
      <section
        className="guide-modal-shell animate-in zoom-in-95 duration-200"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Header */}
        <header className="guide-modal-header">
          <div className="min-w-0">
            <span className="guide-kicker">EduPlan AI • Hướng dẫn nhanh</span>
            <h2 id="guide-modal-title">Hướng dẫn sử dụng EduPlan AI</h2>
            <p>Quy trình 5 bước soạn giáo án chuẩn Công văn 2345/BGDĐT-GDTH từ tạo tài khoản đến xuất file Word.</p>
          </div>
          <button type="button" className="guide-close-button" onClick={onClose} aria-label="Đóng hướng dẫn">
            ×
          </button>
        </header>

        {/* Body */}
        <div className="guide-modal-body">
          <article className="guide-document">
            {/* Quick Hero Banner */}
            <section className="guide-hero">
              <div>
                <p className="guide-eyebrow">Quy trình tinh gọn</p>
                <h1>Soạn giáo án với EduPlan AI</h1>
                <p>
                  Tích hợp trực tiếp kho sách giáo khoa số hóa NXB Giáo Dục Việt Nam, tự động thiết kế tiến trình 4 hoạt động bài dạy chuẩn bảng biểu 2 cột và xuất file Word hoàn chỉnh.
                </p>
              </div>
              <div className="guide-quick-card" aria-label="5 bước nhanh">
                <div><strong>1</strong><span>Đăng ký & Đăng nhập</span></div>
                <div><strong>2</strong><span>Thông tin bài dạy</span></div>
                <div><strong>3</strong><span>Chọn trang SGK</span></div>
                <div><strong>4</strong><span>Tùy chọn nâng cao</span></div>
                <div><strong>5</strong><span>Tạo bài & Xuất Word</span></div>
              </div>
            </section>

            {/* BƯỚC 1: ĐĂNG KÝ & ĐĂNG NHẬP */}
            <section className="guide-section">
              <div className="guide-section-title">
                <StepBadge>1</StepBadge>
                <div>
                  <p>Khởi đầu</p>
                  <h3>Đăng ký & Đăng nhập tài khoản</h3>
                </div>
              </div>

              <div className="guide-step-grid">
                <div>
                  <p>Thầy/cô có thể tạo tài khoản và đăng nhập bằng 3 hình thức thuận tiện:</p>
                  <ul className="guide-check-list">
                    <li>
                      <strong>Email:</strong> Điền Họ tên, Email, Mật khẩu &rarr; Bấm link xác minh trong hộp thư &rarr; Chọn <em>“Tôi đã xác minh”</em>.
                    </li>
                    <li>
                      <strong>Số điện thoại:</strong> Điền SĐT (10 số) và Mật khẩu. <em>Lưu ý quan trọng:</em> Hãy ghi nhớ <strong>Mã code khôi phục 6 số</strong> để tự đặt lại mật khẩu nếu quên.
                    </li>
                    <li>
                      <strong>Google:</strong> Bấm <em>“Tiếp tục với Google”</em> để đăng nhập nhanh 1-chạm.
                    </li>
                  </ul>
                  <p className="guide-note">
                    Nút <strong>“Hướng dẫn sử dụng”</strong> luôn hiển thị sẵn trên màn hình đăng nhập để xem lại bất cứ lúc nào.
                  </p>
                </div>
                <div>
                  <GuideImage src={guideImages.authLogin} alt="Màn hình Đăng nhập với nút Hướng dẫn sử dụng bên ngoài" />
                </div>
              </div>
            </section>

            {/* BƯỚC 2: THÔNG TIN BÀI HỌC */}
            <section className="guide-section">
              <div className="guide-section-title">
                <StepBadge>2</StepBadge>
                <div>
                  <p>Mục 1 trên màn hình</p>
                  <h3>Nhập thông tin bài dạy</h3>
                </div>
              </div>

              <div className="guide-step-grid">
                <div>
                  <p>Tại mục <strong>“1. Thông tin bài học”</strong>, thầy/cô điền các thông số cơ bản:</p>
                  <ul className="guide-check-list">
                    <li><strong>Môn học:</strong> Tiếng Việt, Toán, Đạo đức, Tự nhiên và Xã hội...</li>
                    <li><strong>Lớp:</strong> Khối lớp từ Lớp 1 đến Lớp 5 (Bộ sách Kết nối tri thức).</li>
                    <li><strong>Tên bài học:</strong> Nhập đúng tên bài theo phân phối chương trình (VD: <em>Bài 8. Xử lí bất hoà với bạn bè</em>).</li>
                    <li><strong>Thời lượng / Số tiết:</strong> Chọn số tiết của bài (mặc định 35 phút/tiết).</li>
                    <li><strong>Yêu cầu riêng:</strong> Nhập thêm nếu bài có định hướng đặc thù.</li>
                  </ul>
                </div>
                <div>
                  <GuideImage src={guideImages.lessonInfo} alt="Mục nhập thông tin bài học" />
                </div>
              </div>
            </section>

            {/* BƯỚC 3: CHỌN TRANG SGK BÀI DẠY */}
            <section className="guide-section">
              <div className="guide-section-title">
                <StepBadge>3</StepBadge>
                <div>
                  <p>Mục 2 trên màn hình</p>
                  <h3>Chọn trang SGK từ kho số hóa NXBGD (taphuan.nxbgd.vn)</h3>
                </div>
              </div>

              <div className="guide-step-grid">
                <div>
                  <p>
                    Hệ thống tự động liên kết bộ sách giáo khoa điện tử tương ứng với Môn và Lớp đã chọn. Thầy/cô thao tác theo 3 bước:
                  </p>
                  <ol className="guide-check-list">
                    <li>
                      Bấm nút <strong>“+ Chọn trang SGK bài dạy”</strong> tại Mục 2.
                    </li>
                    <li>
                      Tại ô <em>“Nhảy trang hoặc chọn dải trang”</em>, nhập số trang hoặc dải trang (ví dụ: <kbd>12</kbd> hoặc <kbd>12-17</kbd>) &rarr; bấm <strong>“Xem & Chọn”</strong> &rarr; bấm <strong>“+ Chọn trang ... vào bài dạy”</strong>.
                    </li>
                    <li>
                      Bấm nút <strong>“Nạp x trang vào bài dạy”</strong> ở góc dưới bên phải để nạp dữ liệu sách chuẩn nét vào bài.
                    </li>
                  </ol>
                  <p className="guide-note">
                    Kho sách NXBGD tích hợp sẵn giúp AI bám sát 100% ngữ liệu, hình ảnh và câu hỏi SGK.
                  </p>
                </div>
                <div>
                  <GuideImage src={guideImages.sgkSelectRange} alt="Chọn dải trang 12-17 và nạp thành công vào bài dạy" />
                </div>
              </div>
            </section>

            {/* BƯỚC 4: TÙY CHỌN NÂNG CAO */}
            <section className="guide-section">
              <div className="guide-section-title">
                <StepBadge>4</StepBadge>
                <div>
                  <p>Mục 3 trên màn hình</p>
                  <h3>Cá nhân hóa bài giảng (Tùy chọn nâng cao)</h3>
                </div>
              </div>

              <div className="guide-step-grid">
                <div>
                  <p>Nếu muốn bài dạy mang nét riêng và phù hợp với thực tế lớp học, bấm nút <strong>“Mở rộng”</strong>:</p>
                  <ul className="guide-check-list">
                    <li>
                      <strong>Tích hợp Năng lực số (TT 02/2025/TT-BGDĐT):</strong> Tự động chèn Yêu cầu cần đạt năng lực số Bậc 1 phù hợp bài dạy.
                    </li>
                    <li>
                      <strong>Phong cách giáo án:</strong> Chọn <em>“Dạy thật trên lớp”</em> (kịch bản chi tiết, đối thoại GV–HS thực tế).
                    </li>
                    <li>
                      <strong>Đối tượng HS & Địa phương:</strong> Tùy chọn học sinh đại trà, vùng khó, điểm trường lẻ và nhập Tỉnh thành để ngữ liệu gần gũi với học sinh.
                    </li>
                  </ul>
                  <p className="text-xs text-slate-500">
                    Bấm <strong>“Lưu tùy chọn”</strong> sau khi điều chỉnh. Nếu không cần chỉnh sâu, thầy/cô có thể để mặc định.
                  </p>
                </div>
                <div>
                  <GuideImage src={guideImages.advancedFields} alt="Giao diện Tích hợp Năng lực số và Cá nhân hóa giáo án" />
                </div>
              </div>
            </section>

            {/* BƯỚC 5: TẠO VÀ XUẤT GIÁO ÁN */}
            <section className="guide-section guide-final-section">
              <div className="guide-section-title">
                <StepBadge>5</StepBadge>
                <div>
                  <p>Hoàn thiện</p>
                  <h3>Tạo giáo án và Xuất file Word (.docx)</h3>
                </div>
              </div>

              <div className="guide-step-grid">
                <div>
                  <ol className="guide-check-list">
                    <li>
                      <strong>Nhấn “Tạo giáo án ngay”:</strong> Chờ khoảng <strong>3–5 phút</strong> để AI thiết kế tiến trình 4 hoạt động CV 2345 (<em>Khởi động &rarr; Khám phá &rarr; Luyện tập &rarr; Vận dụng</em>) dưới dạng bảng 2 cột Hoạt động của GV và Hoạt động của HS.
                    </li>
                    <li>
                      <strong>Xem trước khổ A4:</strong> Đọc soát trực tiếp nội dung bài dạy trên khung giấy A4 chuẩn lề, typography rõ ràng.
                    </li>
                    <li>
                      <strong>Nhấn “Xuất Word”:</strong> Nút màu cam/đỏ ở góc trên bên phải màn hình để tải ngay file <strong>.docx</strong> về máy tính.
                    </li>
                  </ol>
                  <p className="guide-note">
                    File Word chuẩn lề in ấn (2cm - 2.5cm), mở bằng Microsoft Word để in hoặc gửi chuyên môn ngay.
                  </p>
                </div>
                <div>
                  <GuideImage src={guideImages.previewExport} alt="Màn hình xem trước khổ A4 và nút Xuất Word góc trên bên phải" />
                </div>
              </div>
            </section>

            {/* GHI CHÚ QUAN TRỌNG */}
            <section className="guide-tips">
              <h3>Lưu ý quan trọng</h3>
              <div className="guide-tip-grid">
                <p><strong>Nạp đủ trang:</strong> Chọn đủ các trang liên tiếp của bài học (VD: 12 đến 17) để tiến trình bài dạy liền mạch.</p>
                <p><strong>Tùy chọn nâng cao:</strong> Tận dụng cá nhân hóa để bài dạy sát với đối tượng học sinh của lớp mình.</p>
                <p><strong>Chỉnh sửa linh hoạt:</strong> File Word xuất ra chuẩn bảng biểu Công văn 2345, thầy/cô thoải mái bổ sung thêm tên trường, người dạy trước khi in.</p>
                <p><strong>Hỗ trợ kỹ thuật:</strong> Nhóm Zalo hỗ trợ luôn sẵn sàng giải đáp thắc mắc và cập nhật tính năng mới.</p>
              </div>
            </section>
          </article>
        </div>

        {/* Footer */}
        <footer className="guide-modal-footer">
          <span>Chúc thầy/cô sử dụng EduPlan AI hiệu quả và có những tiết dạy thành công!</span>
          <button type="button" className="btn-primary" onClick={onClose}>Đã hiểu</button>
        </footer>
      </section>
    </div>
  );
}
