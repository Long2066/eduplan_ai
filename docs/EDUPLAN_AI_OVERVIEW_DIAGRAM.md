# So Do Tong Quan EduPlan AI

File nay mo ta cau truc tong quan cua cong cu EduPlan AI. Co the xem truc tiep tren GitHub/Markdown viewer co ho tro Mermaid.

## 1. So Do Tong Quan De Hieu

```mermaid
flowchart LR
  U["👩‍🏫 Giáo viên<br/>Nhập thông tin bài học<br/>Upload ảnh SGK/PDF"]

  subgraph WEB["🌐 Web App - EduPlan AI"]
    FORM["📝 Lesson Form<br/>Môn, lớp, tên bài<br/>Bộ sách, số tiết<br/>Bối cảnh dạy học"]
    OCRVIEW["🔎 OCR Review<br/>Xem & sửa text OCR"]
    PREVIEW["🎨 Lesson Preview<br/>Giáo án đẹp có màu<br/>Bảng 2 cột GV/HS"]
    TOOLBAR["✨ Công cụ tinh chỉnh<br/>Rút gọn<br/>Chi tiết hơn<br/>Thi giảng<br/>Thêm năng lực số"]
    CHECKLIST["✅ Checklist chất lượng<br/>Đủ 5 phần<br/>Đúng 2 cột<br/>Có đánh giá<br/>Có điều chỉnh"]
  end

  subgraph API["⚙️ Backend API"]
    VALIDATE["🧩 Validate Input<br/>Kiểm tra dữ liệu bắt buộc"]
    OCRAPI["👁️ /api/ocr<br/>Gửi ảnh/PDF đi OCR"]
    CLEAN["🧹 Clean OCR<br/>Sửa lỗi OCR<br/>Không thêm ý mới"]
    GENERATE["🧠 Generate Lesson<br/>Sinh giáo án JSON<br/>Theo CV2345"]
    REFINE["🔁 Refine Lesson<br/>Tạo lại / rút gọn<br/>mở rộng / thi giảng"]
    QUALITY["🛡️ Quality Check<br/>Kiểm tra cấu trúc<br/>Retry nếu lỗi"]
    EXPORT["📦 Export Service<br/>Tạo DOCX/PDF"]
  end

  subgraph AI["🤖 AI Providers"]
    GEMINI["Gemini 2.5 Flash Vision<br/>OCR ảnh SGK/PDF"]
    NANO["GPT-5.4 nano<br/>Làm sạch OCR<br/>Viết lại câu chữ"]
    MINI["GPT-5.4 mini<br/>Hiểu nội dung<br/>Soạn giáo án chính"]
    FULL["GPT-5.4 full<br/>Thi giảng/demo<br/>Fallback chất lượng cao"]
  end

  subgraph OUTPUT["📄 Đầu ra"]
    DOCX["Word .docx<br/>Times New Roman 13<br/>Tiêu đề màu<br/>Bảng đẹp"]
    PDF["PDF<br/>Giống preview web<br/>A4, không lỗi font"]
    COPY["Copy nội dung<br/>Dán sang nơi khác"]
  end

  subgraph LOCAL["💾 Lưu tạm trên trình duyệt"]
    DRAFT["Autosave Draft<br/>Không mất dữ liệu"]
    VERSION["Version History<br/>Bản 1, bản 2<br/>rút gọn, chi tiết"]
  end

  U --> FORM
  FORM --> VALIDATE
  FORM --> OCRVIEW
  OCRVIEW --> OCRAPI
  OCRAPI --> GEMINI
  GEMINI --> OCRVIEW
  OCRVIEW --> CLEAN
  CLEAN --> NANO
  NANO --> GENERATE
  VALIDATE --> GENERATE
  GENERATE --> MINI
  MINI --> QUALITY
  QUALITY -->|Pass| PREVIEW
  QUALITY -->|Fail 2 lần| FULL
  FULL --> QUALITY
  PREVIEW --> TOOLBAR
  TOOLBAR --> REFINE
  REFINE --> NANO
  REFINE --> MINI
  REFINE --> FULL
  REFINE --> QUALITY
  PREVIEW --> CHECKLIST
  PREVIEW --> EXPORT
  EXPORT --> DOCX
  EXPORT --> PDF
  PREVIEW --> COPY
  FORM --> DRAFT
  PREVIEW --> DRAFT
  GENERATE --> VERSION
  REFINE --> VERSION

  classDef user fill:#FEF3C7,stroke:#F59E0B,stroke-width:2px,color:#111827;
  classDef web fill:#EFF6FF,stroke:#2563EB,stroke-width:2px,color:#111827;
  classDef api fill:#F3E8FF,stroke:#7C3AED,stroke-width:2px,color:#111827;
  classDef ai fill:#ECFDF5,stroke:#10B981,stroke-width:2px,color:#111827;
  classDef output fill:#FFF7ED,stroke:#F97316,stroke-width:2px,color:#111827;
  classDef local fill:#F9FAFB,stroke:#6B7280,stroke-width:2px,color:#111827;

  class U user;
  class FORM,OCRVIEW,PREVIEW,TOOLBAR,CHECKLIST web;
  class VALIDATE,OCRAPI,CLEAN,GENERATE,REFINE,QUALITY,EXPORT api;
  class GEMINI,NANO,MINI,FULL ai;
  class DOCX,PDF,COPY output;
  class DRAFT,VERSION local;
```

## 2. Luong Hoat Dong Chinh

```mermaid
sequenceDiagram
  autonumber
  actor T as Giáo viên
  participant W as Web App
  participant B as Backend API
  participant O as Gemini Vision OCR
  participant A as GPT Models
  participant Q as Quality Check
  participant E as Export Service

  T->>W: Nhập thông tin bài học
  T->>W: Upload ảnh SGK/PDF nếu có
  W->>B: Gửi file OCR
  B->>O: Trích xuất text
  O-->>B: Text OCR
  B-->>W: Hiển thị text OCR
  T->>W: Rà soát/sửa text OCR
  W->>B: Gửi input đã chuẩn hóa
  B->>A: Clean OCR bằng nano nếu cần
  B->>A: Sinh giáo án bằng mini
  A-->>B: LessonPlan JSON
  B->>Q: Kiểm tra chất lượng
  Q-->>B: Pass / Warning / Fail
  alt Pass
    B-->>W: Trả preview giáo án đẹp
  else Fail nhiều lần
    B->>A: Nâng lên full để sửa chất lượng
    A-->>B: LessonPlan JSON mới
    B->>Q: Kiểm tra lại
    B-->>W: Trả preview hoặc cảnh báo
  end
  T->>W: Chỉnh sửa / rút gọn / chi tiết / thi giảng
  W->>B: Refine lesson
  B->>A: Xử lý refine
  A-->>W: Version mới
  T->>W: Xuất Word/PDF
  W->>B: Gửi LessonPlan để export
  B->>E: Tạo file DOCX/PDF
  E-->>T: Tải file về
```

## 3. Cach Doc So Do

- Mau vang: nguoi dung giao vien.
- Mau xanh duong: giao dien web ma giao vien thao tac.
- Mau tim: backend xu ly nghiep vu, validate, export, quality check.
- Mau xanh la: cac model AI/OCR ben ngoai.
- Mau cam: file dau ra.
- Mau xam: du lieu luu tam tren trinh duyet.

## 4. Ket Luan Ngan Gon

EduPlan AI gom 5 lop chinh:

1. Lop nhap lieu: giao vien dien form va upload tai lieu.
2. Lop xu ly AI: OCR, lam sach text, sinh giao an, refine.
3. Lop kiem tra chat luong: dam bao dung CV2345 va dung 2 cot GV/HS.
4. Lop hien thi: preview giao an dep, co mau sac va co the chinh sua.
5. Lop xuat file: tao DOCX/PDF dep, giu format on dinh khi tai ve.
