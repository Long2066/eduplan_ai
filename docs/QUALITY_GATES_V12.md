# QUALITY GATES V12: ĐẶC TẢ KIỂM ĐỊNH CHẤT LƯỢNG GIÁO ÁN TIẾNG VIỆT 1–5 KNTT

## 1. Mục đích
Hệ thống kiểm định 5 tầng (5-Gate Architecture) đảm bảo kế hoạch bài dạy (KHBD) Tiếng Việt tiểu học bộ Kết nối tri thức có thể mang ra **dạy thật trên lớp**, không sinh nội dung giả vờ bám SGK, bảo vệ 100% cấu trúc bảng hai cột CV 2345.

---

## 2. Kiến trúc 5 Gate Kiểm định

### Gate 1: Technical Gate (Kỹ thuật & Cấu trúc Dữ liệu)
- **JSON Schema**: Khớp hoàn toàn `schemas/lesson-plan.schema.json`.
- **Cấu trúc Tiết**: Mỗi tiết có thời lượng chính xác `35 phút`. Tổng thời lượng bài = `periods * 35 phút`.
- **Hoạt động**: Mỗi hoạt động có đầy đủ:
  - `id`, `title`, `minutes` (> 0).
  - `teacher_script` (hoặc `teacherActions`): Lời giảng/hành động cụ thể của GV.
  - `student_actions` (hoặc `studentActions`): Hành động quan sát được của HS (cấm chỉ ghi 'HS lắng nghe').
  - `expected_output` (hoặc `learningProducts`): Sản phẩm học tập đo lường được.
  - `assessment`: Hình thức và tiêu chí đánh giá.
  - `misconception_support` (hoặc `supportForStudentsNeedingHelp`): Lỗi dự kiến và biện pháp hỗ trợ.

### Gate 2: Source Contract Gate (Hợp đồng Ngữ liệu SGK Bất biến)
- **Single Source of Truth**: Toàn bộ từ ngữ, câu nhận biết, đoạn đọc, từ ứng dụng, mục viết, chủ đề nói lấy chính xác từ SGK đã xác minh (`official_verified`).
- **Chống bịa chữ / Hallucination**:
  - Dãy tiếng Bài 31 phải là: `bàn, nhãn, gắn, lặn, bận, gần` (chặn tuyệt đối việc đổi `bàn` thành `bạn`).
  - Từ ngữ ứng dụng Bài 31: `bạn thân, khăn rằn, quả mận`.
  - Đoạn đọc Bài 31: Phải có cụm nguyên văn `chả sợ gì lũ quạ dữ` (chặn tuyệt đối việc tự ý đổi thành `chẳng sợ`).
  - Câu nhận biết Bài 31: Chứa tiếng mang vần mới `đàn`, `gần`, `chân`.
- **Bắt buộc Anchor**: Mọi nguồn `verified: true` phải có `anchor` rõ số trang (ví dụ: `trang 74-75`).

### Gate 3: Pedagogy Gate (Logic Sư phạm Lớp 1–5)
- **Chuỗi học vần Lớp 1 chuẩn 8 bước tuần tự**:
  1. *Khởi động/Ôn tiền đề*: Nhận diện kiến thức đã học, kết nối tranh.
  2. *Nhận biết*: Tranh SGK → câu hỏi gợi mở → câu nhận biết → rút âm/vần mới.
  3. *Phân tích cấu tạo vần*: Phân tích âm chính và âm cuối (ví dụ: `an` gồm âm chính `a`, âm cuối `n`; phân biệt `an` với `ăn`, `ân`).
  4. *Đánh vần & Đọc trơn*: Mẫu chính xác → học sinh đọc theo nhịp cá nhân/nhóm/cả lớp.
  5. *Mô hình ghép tiếng 2 bước*:
     - Bước 1: Âm đầu + vần → tiếng cơ sở (ví dụ: `b + an = ban`).
     - Bước 2: Tiếng cơ sở + thanh điệu → tiếng có thanh (ví dụ: `ban + nặng = bạn`).
     - **BLOCK**: Nhảy cóc 1 bước `b + an = bạn`.
  6. *Đọc từ ngữ ứng dụng*: Đọc trơn, phân tích tiếng chứa vần mới, giải nghĩa ngắn bằng hình ảnh.
  7. *Tập viết*: Kích hoạt quy chuẩn nét viết; viết bảng con trước, viết vở sau.
  8. *Đọc câu/đoạn ứng dụng & Nói nghe* (Tiết 2): Đọc đúng ngắt nghỉ, hiểu nội dung chính; thực hành nói theo chủ đề tranh SGK.
- **Tập viết không bịa nét**:
  - Từng chữ/vần phải có mẫu chữ xác minh bằng tài liệu/ảnh chuẩn.
  - Nếu thiếu ảnh đối chiếu trực quan, bắt buộc gán trạng thái `needs_handwriting_reference`, không tự phán tọa độ/độ cao tùy tiện.

### Gate 4: DOCX Structure Gate (Cấu trúc Văn bản CV 2345)
- **100% Nội dung Mục III nằm trong Bảng Hai Cột**:
  - Toàn bộ lời GV, nhiệm vụ HS, câu trả lời dự kiến, hướng dẫn viết ô li, đánh giá, hỗ trợ HS thuộc Mục III phải nằm hoàn toàn trong các ô bảng.
  - Cấm để phụ lục hướng dẫn viết ở ngoài bảng.
  - Tiêu đề `(TIẾT 1)`, `(TIẾT 2)` phải nằm ngay trong bảng (dòng tiêu đề phân tiết của bảng), không đặt thành paragraph tự do ngoài bảng.
  - Giữa tiêu đề `III. TIẾN TRÌNH DẠY HỌC` và `IV. ĐIỀU CHỈNH SAU BÀI DẠY` có **0** đoạn văn bản ngoài bảng.
- **Mục I, II, IV**: Nằm ngoài bảng theo đúng khuôn mẫu CV 2345.

### Gate 5: Visual QA Gate (Thẩm định Trực quan & In ấn)
- Font Times New Roman chuẩn khổ A4, lề chuẩn (trên/dưới 1.8cm, trái/phải 1.6cm).
- Bảng có tiêu đề lặp lại hoặc phân định tiết rõ ràng, không gãy dòng cụt, không lỗi font Unicode Tiếng Việt.
- Có công cụ parse lại DOCX bằng `tools/verify_docx_table.py` để kiểm tra tự động.
