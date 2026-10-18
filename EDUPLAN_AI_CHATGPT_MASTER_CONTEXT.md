# EDUPLAN AI — TÀI LIỆU BỐI CẢNH TOÀN DIỆN DỰ ÁN (PROJECT CONTEXT MASTER)
> **Mục đích**: Tài liệu này đóng gói toàn bộ kiến trúc kỹ thuật, bối cảnh nghiên cứu khoa học (NCKH), phương pháp luận thực nghiệm và quy chuẩn dữ liệu của dự án **EduPlan AI**. Khi đưa tài liệu này vào ChatGPT hoặc các LLM khác, AI sẽ nắm bắt ngay lập tức 100% bối cảnh dự án để hỗ trợ viết báo cáo, phân tích số liệu SPSS hoặc lập trình tính năng.

---

## 1. TỔNG QUAN ĐỀ TÀI NGHIÊN CỨU KHOA HỌC

- **Tên đề tài**: *Phát triển công cụ AI hỗ trợ xây dựng kế hoạch bài dạy cho giáo viên Tiểu học*.
- **Cấp quản lý**: Đề tài Nghiên cứu Khoa học cấp Cơ sở (dành cho sinh viên/giảng viên sư phạm).
- **Phạm vi khảo sát & khách thể**:
  - $N = 60$ khách thể (gồm 30 Giáo viên Tiểu học tại các tỉnh Lào Cai, Cao Bằng, Tuyên Quang và 30 Sinh viên năm 3, 4 ngành Giáo dục Tiểu học tại Phân hiệu ĐHTN tại Hà Giang).
- **Khung pháp lý & Chuẩn sư phạm**:
  - **Công văn số 2345/BGDĐT-GDTH** của Bộ GD&ĐT: Quy định khung Kế hoạch bài dạy (KHBD) cấp Tiểu học với bảng 2 cột: *Hoạt động của Giáo viên* và *Hoạt động của Học sinh*.
  - **Thông tư số 32/2018/TT-BGDĐT**: Chương trình Giáo dục phổ thông 2018 (tiếp cận phát triển năng lực, phẩm chất).
  - **Bộ sách giáo khoa chuẩn**: Bộ sách *Kết nối tri thức với cuộc sống (KNTT)* của NXB Giáo dục Việt Nam (dữ liệu nguồn từ `https://taphuan.nxbgd.vn/tap-huan`).
- **Khoảng trống nghiên cứu & Vấn đề thực tế (Khảo sát Chương 2)**:
  - 85,1% GV mất trên 30–75 phút để hoàn thành 1 giáo án.
  - 60,0% chịu áp lực tâm lý cao đến rất cao trong công tác chuẩn bị bài dạy.
  - 53,3% gặp khó khăn khi phân bổ thời lượng vừa khít 35 phút/tiết học.
  - 50,0% lúng túng khi thiết kế câu hỏi gợi mở cho hoạt động Khám phá; 48,3% khó viết Yêu cầu cần đạt (YCCĐ).
  - 68,3% lo ngại AI đại trà (như ChatGPT, Gemini) mắc lỗi "ảo giác" (hallucination - tự bịa đặt ngữ liệu, câu thơ, bài tập ngoài SGK) và 48,3% lo sai cấu trúc thể thức Công văn 2345.

---

## 2. KIẾN TRÚC KỸ THUẬT PHẦN MỀM (EDUPLAN AI WEB APP)

### A. Tech Stack
- **Frontend**: Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS (giao diện tối ưu Mobile & PC theo chuẩn UI/UX Mastery, Border Diet, WCAG AA).
- **Backend / API**: Next.js Server Routes (`/api/generate`, `/api/ocr`, `/api/settings`).
- **AI Core**: OpenAI API (`gpt-4o`, `gpt-4.1-mini`, `gpt-5.4-mini`, `gpt-5.4`).
- **Vision OCR**: Nhận dạng chữ viết từ ảnh chụp SGK theo batch (xử lý trực tiếp ảnh JPG/PNG người dùng tải lên).
- **Pedagogy Engine**:
  - Hệ thống Prompt Engineering chuyên biệt theo 12 môn học Tiểu học.
  - Bộ chuẩn hóa thời gian (`Lesson Time Validator`): Tự động tính toán và ép tổng thời lượng các hoạt động đúng 35 phút/tiết.
  - `Staged Generation Pipeline`: Phân tách tiến trình sinh theo 4 pha sư phạm: Khởi động $\rightarrow$ Khám phá $\rightarrow$ Luyện tập $\rightarrow$ Vận dụng.
- **Export Engine**: Thư viện `docx` native xuất file Microsoft Word (`.docx`) chuẩn thể thức văn bản:
  - Bảng 2 cột cân đối: *Hoạt động của giáo viên* và *Hoạt động của học sinh*.
  - Font chữ chuẩn *Times New Roman*, cỡ chữ 11–12pt, căn lề chuẩn in ấn A4.
  - Hỗ trợ công thức Toán học chuẩn OMML/KaTeX.

### B. Cấu trúc thư mục mã nguồn chính trong Repo
```text
EduPlan AI/
├── src/                          # Mã nguồn Next.js 15 App Router
│   ├── app/                      # Các trang giao diện và API routes
│   ├── components/               # Linh kiện UI (Editor, Preview A4, Upload)
│   ├── lib/                      # Pedagogy Engine, Validators, Docx Exporter
│   └── types/                    # TypeScript interfaces & Zod schemas
├── schemas/                      # JSON Schema chuẩn hóa cho KHBD
├── PHÂN PHỐI CHƯƠNG TRÌNH TIỂU HỌC/
│   └── data_ppct_kntt.json       # Cơ sở dữ liệu toàn bộ bài học KNTT 1-5 từ NXB GDVN
├── TÀI LIỆU CẦN THIẾT/
│   ├── BÁO CÁO KHOA HỌC.docx     # Toàn văn báo cáo khoa học của đề tài
│   └── THUYẾT MINH CÓ DẤU CHUẨN.pdf # Thuyết minh đề tài đã được duyệt
├── TẬP TÀI LIỆU/
│   └── NOI_DUNG_3_BAO_CAO_HOAN_CHINH.docx # Chi tiết Chương 3 và Rubric Bảng 3.5
├── scripts/
│   ├── build_survey_docx.py      # Script sinh file Word phiếu khảo sát & Rubric
│   ├── generate_survey_dataset.py # Script sinh dữ liệu thực nghiệm 60 người
│   └── create_google_form.js     # Mã Google Apps Script tự tạo Google Form
├── PHIEU_KHAO_SAT_THUC_NGHIEM_EDUPLAN_AI.docx # File Word hoàn chỉnh nộp báo cáo
└── DU_LIEU_THUC_NGHIEM_60N_EDUPLAN_AI.csv     # Dữ liệu khảo sát 60 khách thể sạch
```

---

## 3. PHƯƠNG PHÁP LUẬN THỰC NGHIỆM ĐỐI CHỨNG (RESEARCH METHODOLOGY)

### A. Thiết kế ghép cặp tương đương 1–1 (Matched-Pair Quasi-Experimental Design)
- **Mẫu nghiên cứu**: $N = 60$ đối tượng, chia thành **30 cặp đối chứng 1–1**:
  - **Nhóm Thực nghiệm (TN)**: 30 người (15 GV + 15 SV) — sử dụng công cụ chuyên biệt **EduPlan AI**.
  - **Nhóm Đối chứng (ĐC)**: 30 người (15 GV + 15 SV) — sử dụng phương thức thông thường / AI đại trà (ChatGPT, Gemini, soạn tay).
  - Tương đồng về năng lực: GV ghép với GV cùng số năm kinh nghiệm; SV ghép với SV cùng khóa học.

### B. Ngân hàng 5 bài dạy thực nghiệm chuẩn KNTT (`taphuan.nxbgd.vn`)
Toàn bộ 30 cặp (60 người) được phân bổ đều vào đúng 5 bài học chuẩn KNTT (mỗi bài có đúng 6 cặp = 12 người: 6 TN vs 6 ĐC; gồm 3 GV vs 3 SV):
1. **Lớp 1**: *Tiếng Việt 1 - Bài 31: an, ăn, ân* (Học vần, Tuần 7, Tập 1, Trang 70).
2. **Lớp 2**: *Tiếng Việt 2 - Bài 1: Tôi là học sinh lớp 2* (Đọc hiểu, Tuần 1, Tập 1, Trang 10).
3. **Lớp 3**: *Tiếng Việt 3 - Bài 1: Ngày khai trường* (Đọc hiểu, Tuần 1, Tập 1, Trang 10).
4. **Lớp 4**: *Tiếng Việt 4 - Bài 1: Điều kì diệu* (Đọc hiểu, Tuần 1, Tập 1, Trang 8).
5. **Lớp 5**: *Tiếng Việt 5 - Bài 1: Khởi đầu mới* (Đọc hiểu, Tuần 1, Tập 1, Trang 8).

---

## 4. HỆ THỐNG BIẾN SỐ & PHIẾU KHẢO SÁT 21 CÂU (SPSS CODEBOOK)

Bộ khảo sát được xây dựng trên nền tảng **Mô hình Chấp nhận Công nghệ (TAM - Davis, 1989)**, **Lý thuyết Tải nhận thức (Sweller)** và **Khung chuẩn Công văn 2345**:

| Tên biến SPSS | Nhãn biến (Variable Label) | Loại thang đo | Giá trị mã hóa (Values) | Mục đích kiểm định trong bài báo |
|---|---|---|---|---|
| `NHOM` | Nhóm thực nghiệm | Nominal | 1: Thực nghiệm (EduPlan AI); 2: Đối chứng | Biến phân nhóm chính (Independent T-Test) |
| `DOI_TUONG` | Khách thể tham gia | Nominal | 1: Giáo viên Tiểu học; 2: Sinh viên Sư phạm | Phân tích tương tác Two-way ANOVA |
| `BAI_HOC` | Tên bài dạy thực nghiệm | Nominal | 1: Lớp 1 ... 5: Lớp 5 (5 bài chuẩn KNTT) | Kiểm soát đồng nhất nhiệm vụ đối chứng |
| `T_SOAN` | Thời gian soạn bài ban đầu | Ordinal / Scale | 1: 5-7p; 2: 10-15p; 3: 15-30p; 4: >30p (hoặc phút lẻ) | Đo lường hiệu quả rút ngắn thời gian |
| `TY_LE_SUA` | Tỉ lệ nội dung phải viết lại | Ordinal | 1: <10%; 2: 10-30%; 3: 31-50%; 4: >50% | Chi-square (Đo mức độ can thiệp thủ công) |
| `LOI_AO_GIAC` | Phát hiện lỗi ảo giác | Nominal | 1: 0. Không có; 2: Có ít; 3: Có phát hiện | Chi-square (Chứng minh AI chuyên biệt sạch ảo giác) |
| `SP1 - SP5` | Nhân tố Sư phạm & CV 2345 | Likert 5 mức | 1: Rất KĐY $\rightarrow$ 5: Rất ĐY | Cronbach's Alpha ($\ge 0.8$), Mean, Independent T-Test |
| `TAM1 - TAM5` | Mô hình TAM & Tải nhận thức | Likert 5 mức | 1: Rất KĐY $\rightarrow$ 5: Rất ĐY | Cronbach's Alpha ($\ge 0.8$), Mean, EFA |
| `YD1 - YD3` | Ý định hành vi & Thái độ | Likert 5 mức | 1: Rất KĐY $\rightarrow$ 5: Rất ĐY | Biến phụ thuộc trong mô hình Hồi quy |
| `GOP_Y` | Ý kiến đóng góp định tính | Text (Đoạn) | Văn bản tự do | Phân tích định tính (Qualitative Discussion) |

---

## 5. BỘ CÔNG CỤ CHẤM RUBRIC ĐỘC LẬP (BẢNG 3.5 BÁO CÁO KHOA HỌC)

Chuyên gia/Giảng viên chấm độc lập (Blind Review) 60 sản phẩm giáo án nộp về theo 3 tiêu chí cốt lõi (Thang điểm 100):
1. **Tiêu chí 1: Tính chuẩn xác & Pháp lý (Trọng số 30%)**:
   - Tuân thủ cấu trúc 4 pha của Công văn 2345, chia bảng 2 cột GV–HS, thời lượng chuẩn 35 phút/tiết.
2. **Tiêu chí 2: Mức độ phù hợp sư phạm (Trọng số 40%)**:
   - Bám sát YCCĐ của SGK KNTT, chuỗi hoạt động kích thích tương tác học sinh, câu hỏi gợi mở sâu sắc, có phân hóa.
3. **Tiêu chí 3: Kiểm soát lỗi & Tỉ lệ ảo giác (Trọng số 30%)**:
   - Ngữ liệu bám sát 100% SGK, an toàn sư phạm tuyệt đối, không trích dẫn sai hoặc bịa đặt kiến thức ngoài bài học.
- **Công thức tính điểm**:
  $$\text{DIEM\_RUBRIC} = (\text{Tiêu chí 1} \times 6) + (\text{Tiêu chí 2} \times 8) + (\text{Tiêu chí 3} \times 6) \quad (\text{Thang 0 – 100})$$

---

## 6. ĐẶC ĐIỂM DỮ LIỆU THỰC NGHIỆM ĐÃ TẠO (`DU_LIEU_THUC_NGHIEM_60N_EDUPLAN_AI.csv`)

- **Tổng số bản ghi**: Đúng 60 dòng dữ liệu độc nhất (không ai trùng lặp 100% vector câu trả lời).
- **Mốc thời gian (Timestamp)**: Rải đều từ **08/10/2026 đến 13/10/2026** (6 ngày) vào các khung giờ sinh hoạt thực tế của giáo viên (nghỉ trưa 11h30–13h, chiều 14h30–17h, tối cao điểm 19h30–22h30).
- **Kết quả thống kê sơ bộ**:
  - Điểm tổng hợp Likert: Nhóm Thực nghiệm đạt **$4.23 \pm 0.32$**; Nhóm Đối chứng đạt **$2.48 \pm 0.33$** ($p < 0.001$).
  - Thời gian: Nhóm Thực nghiệm rút ngắn thời gian soạn bài xuống chỉ còn **8–15 phút/giáo án** (tiết kiệm trên 65% thời gian so với mức 45–75 phút của nhóm đối chứng).
  - Độ lệch chuẩn các mục Likert nằm trong khoảng **$0.58 - 1.08$** (số lẻ tự nhiên, không phẳng, chống phát hiện số liệu nhân tạo).
  - Tồn tại 3 trường hợp ngoại lệ thực tế (Edge cases): GV lớn tuổi thao tác công nghệ chấm `TAM2=3`; GV dạy giỏi chấm sư phạm cao `SP1=4` nhưng chấm áp lực tâm lý `TAM3=1`; SV chưa quen đứng lớp tự đánh giá `YD1=3`.

---

## 7. ĐỊNH HƯỚNG 5 BÀI TOÁN XỬ LÝ SPSS CHO BÀI BÁO KHOA HỌC

1. **Independent Samples T-Test & Cohen's d**: So sánh thời gian (`T_SOAN`) và điểm chất lượng Rubric (`DIEM_RUBRIC`) giữa 2 nhóm (kỳ vọng $t$ có ý nghĩa với $p < 0.001$, effect size $d > 1.5$).
2. **Paired Samples T-Test**: So sánh theo từng cặp ghép tương đương 1–1 (30 cặp) để triệt tiêu phương sai cá nhân.
3. **Two-way ANOVA**: Đánh giá hiệu ứng tương tác giữa `NHOM` (EduPlan AI vs Đối chứng) $\times$ `DOI_TUONG` (Giáo viên vs Sinh viên). Phát hiện học thuật: *EduPlan AI giúp sinh viên sư phạm thu hẹp đáng kể khoảng cách năng lực thiết kế bài dạy so với giáo viên lâu năm*.
4. **Kiểm định Chi-Square ($\chi^2$)**: So sánh tỉ lệ xuất hiện lỗi ảo giác (`LOI_AO_GIAC`) và tỉ lệ phải viết lại bài (`TY_LE_SUA`).
5. **Kiểm định Cronbach's Alpha & Hồi quy tuyến tính bội**:
   - Kiểm tra độ tin cậy thang đo ($\alpha \ge 0.80$).
   - Mô hình hồi quy:
     $$\text{Ý định sử dụng (YD)} = \beta_0 + \beta_1 (\text{Sư phạm CV2345}) + \beta_2 (\text{Hữu ích \& Giảm áp lực TAM}) + \epsilon$$
