"use client";

import { useEffect, type ReactNode } from "react";

interface GuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const guideImages = {
  authLogin: "/huong-dan/guide-00-dang-nhap.png",
  authRegister: "/huong-dan/guide-00-dang-ky.png",
  authPhone: "/huong-dan/guide-00-sdt-khoi-phuc.png",
  lessonInfo: "/huong-dan/guide-01-thong-tin-bai-hoc.png",
  sgkSection: "/huong-dan/guide-02-chon-trang-sgk-nxbgd.png",
  sgkModal: "/huong-dan/guide-03-mo-kho-sgk-modal.png",
  sgkSelectRange: "/huong-dan/guide-04-nhap-dai-trang-nap.png",
  uploadPc: "/huong-dan/guide-03-tai-len-tu-pc.png",
  chooseImage: "/huong-dan/guide-04-chon-anh-bai-hoc.png",
  uploadedImage: "/huong-dan/guide-05-anh-da-tai-len.png",
  screenshotSgk: "/huong-dan/guide-08-chup-sgk-dien-tu.png",
  pastedImage: "/huong-dan/guide-09-dan-anh-vao-eduplan.png",
  advancedToggle: "/huong-dan/guide-06-mo-rong-tuy-chon.png",
  advancedFields: "/huong-dan/guide-07-nang-luc-so-va-ca-nhan-hoa.png",
  generationProcess: "/huong-dan/guide-08-tao-giao-an-tien-trinh.png",
  previewExport: "/huong-dan/guide-09-xem-truoc-xuat-word.png",
  tipsBanner: "/huong-dan/guide-10-luu-y-quan-trong.png",
};

function StepBadge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-brand-600 text-sm font-black text-white shadow-lg shadow-brand-600/25">
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
        <header className="guide-modal-header">
          <div className="min-w-0">
            <span className="guide-kicker">EduPlan AI • Hướng dẫn toàn diện</span>
            <h2 id="guide-modal-title">Hướng dẫn sử dụng EduPlan AI từ A đến Z</h2>
            <p>Quy trình trọn vẹn từ tạo tài khoản đến khi xuất file Word chuẩn Công văn 2345/BGDĐT-GDTH.</p>
          </div>
          <button type="button" className="guide-close-button" onClick={onClose} aria-label="Đóng hướng dẫn">
            ×
          </button>
        </header>

        <div className="guide-modal-body">
          <article className="guide-document">
            {/* HERO BANNER */}
            <section className="guide-hero">
              <div>
                <p className="guide-eyebrow">Quy trình sử dụng công cụ</p>
                <h1>Soạn giáo án thông minh với EduPlan AI</h1>
                <p>
                  Tài liệu hướng dẫn chi tiết dành cho thầy/cô giáo tiểu học: từ đăng ký tài khoản,
                  chọn sách số hóa từ NXB Giáo Dục, tùy chỉnh sư phạm, cho đến khi tải file Word (.docx) hoàn chỉnh.
                </p>
              </div>
              <div className="guide-quick-card" aria-label="5 bước nhanh">
                <div><strong>1</strong><span>Đăng ký & Đăng nhập</span></div>
                <div><strong>2</strong><span>Thông tin bài dạy</span></div>
                <div><strong>3</strong><span>Nạp trang SGK</span></div>
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
                  <h3>Đăng ký & Đăng nhập tài khoản EduPlan AI</h3>
                </div>
              </div>
              <p>
                Để sử dụng công cụ và lưu trữ lịch sử giáo án của mình, thầy/cô cần có tài khoản EduPlan AI.
                Hệ thống hỗ trợ 3 hình thức thuận tiện:
              </p>

              <div className="guide-method-card">
                <h4>Cách 1: Đăng nhập / Đăng ký bằng Email</h4>
                <ol>
                  <li>Chọn tab <strong>Email</strong>, bấm <strong>Đăng ký</strong> nếu chưa có tài khoản.</li>
                  <li>Điền <strong>Họ tên</strong>, <strong>Email</strong> và <strong>Mật khẩu</strong> (tối thiểu 6 ký tự).</li>
                  <li>Tích chọn đồng ý Điều khoản sử dụng và bấm <strong>Tạo tài khoản</strong>.</li>
                  <li>Hệ thống gửi thư xác minh về hòm mail. Thầy/cô bấm vào liên kết trong thư, sau đó quay lại công cụ bấm <strong>Tôi đã xác minh</strong>.</li>
                </ol>
              </div>

              <div className="guide-method-card guide-method-card-soft mt-3">
                <h4>Cách 2: Đăng nhập / Đăng ký bằng Số điện thoại</h4>
                <ol>
                  <li>Chọn tab <strong>Số điện thoại</strong>, bấm <strong>Đăng ký</strong>.</li>
                  <li>Nhập <strong>Họ tên</strong>, <strong>Số điện thoại</strong> (10 chữ số) và <strong>Mật khẩu</strong>.</li>
                  <li>
                    <strong>Đặc biệt lưu ý:</strong> Nhập và ghi nhớ <strong>Mã code khôi phục 6 số</strong>.
                    Mã code này giúp thầy/cô tự đặt lại mật khẩu mới nếu chẳng may quên mật khẩu sau này.
                  </li>
                  <li>Sau khi tạo, thầy/cô đăng nhập ngay bằng Số điện thoại và Mật khẩu vừa tạo.</li>
                </ol>
              </div>

              <div className="guide-method-card mt-3">
                <h4>Cách 3: Đăng nhập nhanh với Google</h4>
                <p>
                  Thầy/cô chỉ cần bấm nút <strong>“Tiếp tục với Google”</strong> để đăng nhập tức thì bằng tài khoản Google sẵn có trên trình duyệt.
                </p>
              </div>

              <div className="guide-image-grid mt-3">
                <GuideImage src={guideImages.authLogin} alt="Màn hình Đăng nhập với nút Hướng dẫn sử dụng bên ngoài" />
                <GuideImage src={guideImages.authRegister} alt="Màn hình Đăng ký tài khoản EduPlan AI" />
                <GuideImage src={guideImages.authPhone} alt="Đăng ký Số điện thoại và Mã code khôi phục 6 số" wide />
              </div>
            </section>

            {/* BƯỚC 2: THÔNG TIN BÀI HỌC */}
            <section className="guide-section">
              <div className="guide-section-title">
                <StepBadge>2</StepBadge>
                <div>
                  <p>Mục 1 trên màn hình</p>
                  <h3>Nhập thông tin bài dạy để AI nắm bắt yêu cầu</h3>
                </div>
              </div>
              <p>
                Tại mục <strong>“1. Thông tin bài học”</strong>, thầy/cô điền các nội dung cơ bản:
              </p>
              <ul className="guide-check-list">
                <li><strong>Môn học:</strong> Tiếng Việt, Toán, Đạo đức, Tự nhiên và Xã hội...</li>
                <li><strong>Lớp:</strong> Khối lớp từ Lớp 1 đến Lớp 5.</li>
                <li><strong>Tên bài học:</strong> Ghi rõ tên bài (Ví dụ: <em>Bài 8. Xử lí bất hoà với bạn bè</em>, <em>Bài 12: Bảng nhân 2</em>).</li>
                <li><strong>Thời lượng / Số tiết:</strong> Lựa chọn số tiết dạy (Mặc định 35 phút/tiết).</li>
                <li><strong>Yêu cầu cần đạt / Định hướng riêng:</strong> Điền thêm nếu thầy/cô có yêu cầu chuyên môn cụ thể.</li>
              </ul>
              <GuideImage src={guideImages.lessonInfo} alt="Màn hình nhập thông tin bài học" wide />
            </section>

            {/* BƯỚC 3: NẠP TRANG SGK BÀI DẠY */}
            <section className="guide-section">
              <div className="guide-section-title">
                <StepBadge>3</StepBadge>
                <div>
                  <p>Mục 2 trên màn hình</p>
                  <h3>Nạp nội dung SGK bài dạy vào EduPlan AI</h3>
                </div>
              </div>
              <p>
                Để AI bám sát chính xác nội dung sách giáo khoa Kết nối tri thức, thầy/cô có thể đưa nội dung bài học vào theo 1 trong 3 cách:
              </p>

              {/* Cách 1: Kho SGK taphuan.nxbgd.vn */}
              <div className="guide-method-card border-brand-200 bg-brand-50/40">
                <div className="flex items-center gap-2 font-bold text-brand-900">
                  <span className="rounded-md bg-brand-600 px-2 py-0.5 text-xs text-white">Khuyên dùng</span>
                  <h4>Cách 1: Chọn trực tiếp từ kho SGK số hóa NXB Giáo Dục (taphuan.nxbgd.vn)</h4>
                </div>
                <p className="mt-1">
                  Cách thuận tiện nhất: Sau khi chọn Môn và Lớp ở Bước 2, hệ thống tự động tải bộ sách giáo khoa điện tử tương ứng.
                </p>
                <ol className="mt-2">
                  <li>Tại mục <strong>“2. Trang SGK bài dạy”</strong>, bấm nút <strong>“+ Chọn trang SGK bài dạy”</strong>.</li>
                  <li>
                    Cửa sổ duyệt sách hiển thị: Tại ô <em>“Nhảy trang hoặc chọn dải trang”</em>, thầy/cô nhập số trang (ví dụ: <kbd>12</kbd> hoặc dải trang <kbd>12-17</kbd>) rồi nhấn <strong>“Xem & Chọn”</strong>.
                  </li>
                  <li>Xem trang hiển thị bên trái, bấm nút <strong>“+ Chọn trang ... vào bài dạy”</strong>.</li>
                  <li>Sau khi đã chọn đủ các trang cần dạy, bấm nút <strong>“Nạp x trang vào bài dạy”</strong> ở góc dưới bên phải.</li>
                </ol>
                <div className="guide-image-grid mt-3">
                  <GuideImage src={guideImages.sgkSection} alt="Mục Trang SGK bài dạy với nút Chọn trang" />
                  <GuideImage src={guideImages.sgkModal} alt="Cửa sổ duyệt sách giáo khoa điện tử taphuan.nxbgd.vn" />
                  <GuideImage src={guideImages.sgkSelectRange} alt="Chọn dải trang 12-17 và nạp thành công vào bài dạy" wide />
                </div>
              </div>

              {/* Cách 2: Tải lên từ máy tính */}
              <div className="guide-method-card mt-4">
                <h4>Cách 2: Tải ảnh có sẵn từ máy tính (Tải lên từ PC)</h4>
                <p>Dùng khi thầy/cô đã lưu sẵn ảnh chụp SGK trong máy:</p>
                <ol>
                  <li>Nhấn nút <strong>“Tải lên từ PC”</strong>.</li>
                  <li>Chọn một hoặc nhiều file ảnh bài học từ thiết bị.</li>
                  <li>Hệ thống sẽ nạp và hiển thị danh sách ảnh xem trước.</li>
                </ol>
                <div className="guide-image-grid guide-image-grid-two mt-3">
                  <GuideImage src={guideImages.uploadPc} alt="Chọn tải ảnh lên từ máy tính" />
                  <GuideImage src={guideImages.uploadedImage} alt="Ảnh SGK hiển thị trong EduPlan AI" />
                </div>
              </div>

              {/* Cách 3: Dán ảnh Win+Shift+S */}
              <div className="guide-method-card guide-method-card-soft mt-4">
                <h4>Cách 3: Chụp & Dán ảnh nhanh từ SGK điện tử (Ctrl + V)</h4>
                <p>Dùng khi thầy/cô đang mở SGK điện tử trên trình duyệt:</p>
                <ol>
                  <li>Mở trang sách cần soạn trên màn hình.</li>
                  <li>Nhấn tổ hợp phím <kbd>Windows</kbd> + <kbd>Shift</kbd> + <kbd>S</kbd> và quét chọn vùng trang sách.</li>
                  <li>Quay lại giao diện EduPlan AI và nhấn <kbd>Ctrl</kbd> + <kbd>V</kbd> để dán ảnh tức thì.</li>
                </ol>
                <div className="guide-image-grid guide-image-grid-two mt-3">
                  <GuideImage src={guideImages.screenshotSgk} alt="Chụp vùng trang bài học bằng Win+Shift+S" />
                  <GuideImage src={guideImages.pastedImage} alt="Dán ảnh vào EduPlan AI bằng Ctrl+V" />
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
              <p>
                Nếu muốn kế hoạch bài dạy sát thực tế giảng dạy và đặc thù học sinh hơn nữa, thầy/cô nhấn <strong>“Mở rộng”</strong> tại mục <strong>“Tùy chọn nâng cao”</strong>:
              </p>
              <ul className="guide-check-list">
                <li>
                  <strong>Tích hợp Năng lực số (Thông tư 02/2025/TT-BGDĐT):</strong> Tự động chèn Yêu cầu cần đạt về năng lực số Bậc 1 phù hợp với môn học và nội dung bài.
                </li>
                <li>
                  <strong>Phong cách giáo án:</strong> Lựa chọn <em>“Dạy thật trên lớp”</em> (lời thoại GV-HS chi tiết, thực tế), <em>“Cơ bản”</em> (gọn gàng, chuẩn cấu trúc), hoặc <em>“Sáng tạo, sinh động”</em> (nhiều trò chơi, học liệu khởi động).
                </li>
                <li>
                  <strong>Đối tượng & Môi trường học:</strong> Tùy chọn học sinh đại trà, học sinh vùng khó, điểm trường lẻ, trường chuẩn...
                </li>
                <li>
                  <strong>Địa phương hóa:</strong> Nhập Tỉnh/Thành phố và Ghi chú địa phương để AI lồng ghép ví dụ gần gũi với quê hương học sinh.
                </li>
              </ul>
              <p className="guide-note">
                Sau khi điều chỉnh, thầy/cô bấm <strong>“Lưu tùy chọn”</strong>. Nếu không có yêu cầu riêng, có thể để mặc định.
              </p>
              <div className="guide-image-grid guide-image-grid-two mt-3">
                <GuideImage src={guideImages.advancedToggle} alt="Nút Mở rộng phần Tùy chọn nâng cao" />
                <GuideImage src={guideImages.advancedFields} alt="Giao diện Tích hợp Năng lực số và Cá nhân hóa giáo án" />
              </div>
            </section>

            {/* BƯỚC 5: TẠO VÀ XUẤT GIÁO ÁN */}
            <section className="guide-section guide-final-section">
              <div className="guide-section-title">
                <StepBadge>5</StepBadge>
                <div>
                  <p>Hoàn thiện</p>
                  <h3>Nhấn tạo giáo án, kiểm tra nội dung và tải file Word</h3>
                </div>
              </div>

              <div className="guide-two-column">
                <div>
                  <h4>1. Tạo giáo án bằng AI</h4>
                  <ol>
                    <li>Nhấn nút <strong>“Tạo giáo án ngay”</strong>.</li>
                    <li>Chờ khoảng <strong>3–5 phút</strong> để hệ thống xử lý đa tầng.</li>
                    <li>
                      AI tự động xây dựng tiến trình bài dạy chuẩn 4 hoạt động Công văn 2345/BGDĐT-GDTH:
                      <strong> Khởi động &rarr; Khám phá &rarr; Luyện tập &rarr; Vận dụng</strong>.
                    </li>
                    <li>Bảng 2 cột chi tiết: <strong>Hoạt động của giáo viên</strong> và <strong>Hoạt động của học sinh</strong>.</li>
                  </ol>
                </div>
                <div>
                  <h4>2. Xem trước và Xuất file Word</h4>
                  <ol>
                    <li>Xem trước trực tiếp trên khung giấy khổ A4 chuẩn lề.</li>
                    <li>Kiểm tra, đọc soát lại các nội dung bài dạy.</li>
                    <li>
                      Nhấn nút <strong>“Xuất Word”</strong> ở góc trên bên phải màn hình.
                    </li>
                    <li>File <strong>.docx</strong> chuẩn in sẽ được tải ngay về máy tính để thầy/cô in ấn hoặc nộp chuyên môn.</li>
                  </ol>
                </div>
              </div>

              <div className="mt-4 space-y-4">
                <GuideImage src={guideImages.generationProcess} alt="Quy trình Tạo giáo án và Xuất file Word" wide />
                <GuideImage src={guideImages.previewExport} alt="Màn hình xem trước khổ A4 và nút Xuất Word góc trên bên phải" wide />
              </div>
            </section>

            {/* BƯỚC 6: LƯU Ý QUAN TRỌNG */}
            <section className="guide-tips">
              <h3>Lưu ý quan trọng để giáo án đạt chất lượng tốt nhất</h3>
              <GuideImage src={guideImages.tipsBanner} alt="Các lưu ý để giáo án tạo ra tốt hơn" wide />
              <div className="guide-tip-grid mt-3">
                <p><strong>Ảnh rõ nét:</strong> Nên dùng ảnh SGK sắc nét hoặc chọn trực tiếp từ kho sách số hóa để AI nhận diện chữ và bài tập chính xác 100%.</p>
                <p><strong>Chọn đủ trang:</strong> Nên chọn đủ các trang của bài học (ví dụ trang 12 đến 17) để tiến trình bài dạy liền mạch.</p>
                <p><strong>Cá nhân hóa:</strong> Tận dụng mục "Tùy chọn nâng cao" để giáo án mang dấu ấn riêng và phù hợp với thực tế lớp học của thầy/cô.</p>
                <p><strong>Chỉnh sửa linh hoạt:</strong> File Word xuất ra có định dạng chuẩn lề và bảng biểu, thầy/cô hoàn toàn có thể chỉnh sửa thêm trước khi in.</p>
              </div>
            </section>
          </article>
        </div>

        <footer className="guide-modal-footer">
          <span>Chúc thầy/cô sử dụng EduPlan AI hiệu quả và có những tiết dạy thành công!</span>
          <button type="button" className="btn-primary" onClick={onClose}>Đã hiểu</button>
        </footer>
      </section>
    </div>
  );
}
