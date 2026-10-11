# Lệnh giao cho Antigravity (dán nguyên văn vào chat của Antigravity)

Bạn hãy sử dụng skill `/tv-build-lesson-app` và phối hợp các skill liên quan tại `.agents/skills/` để xây dựng hoặc cải tiến ứng dụng soạn **kế hoạch bài dạy Tiếng Việt lớp 1–5 bộ Kết nối tri thức với cuộc sống**.

Yêu cầu:
1. Đọc `.agents/AGENTS.md`, `README.md`, `docs/PRODUCT_REQUIREMENTS.md`, `docs/SOURCE_REGISTER.md`, `docs/ACCEPTANCE_TESTS.md`, `schemas/lesson-plan.schema.json` trước khi code. Quét codebase hiện có trước, không phá các chức năng đang chạy.
2. Thiết kế pipeline tải SGK/SGV, giáo án mẫu DOCX/PDF/ảnh → trích xuất có truy vết trang → chọn đúng lớp, dạng bài và số tiết → sinh giáo án JSON có lời GV/HS đủ dạy thật → phản biện logic sư phạm độc lập → sửa có kiểm tra lại → giáo viên xem duyệt → xuất Word hai cột.
3. Dùng `tv-grade1-phonics` + `tv-grade1-handwriting` khi dạy âm/vần, bài đọc và ôn tập lớp 1 dùng skill `tv-grade1-reading`/`tv-grade1-review-story`; lớp 2–5 dùng skill riêng theo từng lớp. Không ép quy trình lớp 1 vào lớp 4, lớp 5.
4. Không bịa câu/đoạn/trang/số bài SGK; khi thiếu nguồn, hiển thị cảnh báo bắt buộc. Phân biệt tài liệu tham khảo với nguồn chính thức.
5. Riêng tập viết: phân tích từng nét, điểm đặt/dừng, độ cao, nét nối, dấu phụ/dấu thanh **chỉ khi có ảnh mẫu xác minh**; nếu thiếu trả trạng thái `needs_handwriting_reference`.
6. Ứng dụng phải có kiểm tra thời lượng từng tiết, liên kết mục tiêu-hoạt động-đánh giá, cảnh báo tích hợp NLS hình thức, và báo cáo lỗi theo độ nghiêm trọng.
7. Xuất Word giống cấu trúc hai cột GV/HS, giữ mẫu nếu được cấp; render để QA. Tách kỹ thuật PASS khỏi sư phạm PASS.
8. Bám stack hiện có; nếu repo trống, trình bày hai phương án ngắn rồi chọn một, viết mã và chạy test thật.
9. Sau khi code, chạy các lệnh trong `README.md` và test từ `docs/ACCEPTANCE_TESTS.md`, báo từng case đã PASS/FAIL/CHƯA TEST. Không báo hoàn thành khi còn blocker.

Bắt đầu bằng kiểm tra repository và lập danh sách tệp cần tạo/chỉnh sửa, sau đó code theo các chặng nhỏ có kiểm chứng.
