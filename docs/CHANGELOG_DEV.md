# EduPlan AI - Development Changelog

## Phien hien tai

### Tai lieu va ke hoach

- Tao `docs/EDUPLAN_AI_SRS.md` lam dac ta yeu cau.
- Tao `docs/EDUPLAN_AI_OVERVIEW_DIAGRAM.md` bang Mermaid.
- Tao `docs/EDUPLAN_AI_SO_DO_TONG_QUAN.docx`.
- Tao `docs/BẢN KẾ HOẠCH THIẾT KẾ CHUẨN V1.1 VỀ TOOL.docx`.

### Khoi tao web app

- Tao Next.js + TypeScript + Tailwind.
- Tao layout 2 cot.
- Tao form, preview, toolbar.
- Them autosave localStorage.

### UI/UX

- Thiet ke form theo huong gon.
- Chia form thanh nhom logic.
- Tao CTA `Tao giao an ngay` noi bat.
- Them drag/drop va paste anh.
- Preview anh upload.
- Tao preview A4 WYSIWYG theo mau giao an nguoi dung dua.
- Header sticky, thu gon theo feedback.
- Them billboard text luan phien 5s.
- Them demo user online.
- Tren man hinh lon, khoa vung preview ben phai va cho cot form ben trai cuon rieng de thao tac nhap lieu khong lam mat preview.
- Doi preview thanh cac to A4 noi tiep theo tung tiet trong `.a4-document`, co khoang cach nho nhu xem giay that, khong dung vach cat ngang noi dung.
- Them schema `periodPlans` va prompt yeu cau soan du tung tiet khi user chon nhieu tiet; moi tiet co du BAI, I, II, III, IV va du tien trinh rieng.
- Cap nhat PDF/Word export de uu tien `periodPlans`; nhieu tiet van xuat chung mot file.
- Sua preview/Word: dong ngay thang nam rut ngan va can phai; bo dong `TIET X: ...` ngay sau muc `III. TIEN TRINH DAY HOC` de bang tien trinh hien ngay; tranh lap chu `LOP LOP ...` trong tieu de.

### Input thay doi theo yeu cau

- Bo input thoi luong, mac dinh 35 phut/tiet.
- Noi dung bai hoc lay tu anh OCR.
- Yeu cau can dat do AI suy luan neu OCR khong co.
- Ten bai co the de trong, AI tu nhan dien.
- Upload chi nhan JPG/JPEG/PNG.
- Gemini key user nhap tren giao dien, ho tro nhieu key.
- Advanced options chi ap dung khi bam `Luu tuy chon`.
- Them checkbox nang cao `Giao an sang tao/du gio` de bat che do soan giao an kieu kich ban day hoc, cho phep sang tao hoc lieu/tinh huong ngoai SGK phu hop muc tieu bai.
- Them tuy chon nang cao `Cap do chat luong giao an` gom Co ban, Chi tiet, Du gio / Thi giang, Sang tao cao; mac dinh la Sang tao cao.

### API that

- Them `.env.local.example` va `.env.local` placeholder.
- Them icon app tu `icon.png`.
- Tao `/api/gemini/test-key`.
- Tao `/api/lesson/generate` gom:
  - Gemini OCR.
  - OpenAI generate.
  - Normalize LessonPlan.
- Doi Gemini OCR tu moi anh mot request sang gom nhieu anh trong mot request de tranh vuot quota free tier khi upload nhieu anh; them thong bao loi quota de hieu hon.
- Dieu chinh lai Gemini OCR tu gom tat ca anh/request sang batch nho 2 anh/request, xoay key theo tung batch de giam ca `429` lan `400 Bad Request`.
- Them fallback khi batch Gemini bi `400`: tu tach batch thanh tung anh de retry va thong bao anh nghi ngo neu mot anh cu the van loi.
- Them retry ngan cho loi Gemini tam thoi `503 UNAVAILABLE`/high demand.
- Sua phan loai loi Gemini: `400 Bad Request` khong con danh dau key la invalid; chi cac loi `API_KEY_INVALID`, `API Key not found`, `PERMISSION_DENIED` moi danh dau key loi.
- Doi co che Gemini key sang pool xoay vong: uu tien key it dung hon, bo qua key invalid/quota_exceeded, tra key status ve UI sau generate.
- Doi UI Gemini key: bo radio chon active, them nut `Test tat ca key`, them thanh tien do tung key va thong bao key het quota/de xoa.
- Tao `/api/lesson/refine` cho cac nut refine.
- Chuan hoa loi OpenAI 5xx/Cloudflare, dac biet `520 Web server is returning an unknown error`, de UI khong hien nguyen HTML loi; them retry ngan cho OpenAI generate/repair khi gap loi tam thoi.
- Nang cap prompt generate theo Chuong trinh tong the CTGDPT 2018: phat trien pham chat/nang luc, hoc sinh chu dong kham pha - luyen tap - van dung, danh gia bang qua trinh va san pham.
- Nang prompt generate/repair len dang `kich ban day hoc` sang tao: moi hoat dong can tinh huong mo, ky thuat day hoc/hoc lieu cu the, cau hoi goi mo, du kien phan hoi dung/sai, xu ly sai lech, loi chot GV va san pham hoc tap.
- Siết quality gate cho cap do cao: toi thieu 7 buoc GV/HS moi hoat dong, rieng Kham pha toi thieu 10 buoc GV/HS, co dau hieu ky thuat day hoc/sang tao; neu chua dat se vao repair.
- Doi model OpenAI mac dinh tu `gpt-4o-mini` sang `gpt-5.5` va them `OPENAI_REASONING_EFFORT=high` cho che do thinking theo yeu cau user.
- Kiem tra docs OpenAI: model moi/flagship hien tai la `gpt-5.5`; sua generate API de neu model bat dau bang `gpt-5` thi goi Responses API `/v1/responses` voi structured JSON va reasoning high, tranh phu thuoc Chat Completions cho model moi.
- Xu ly loi OpenAI `fetch failed` sau thoi gian dai: them timeout request OpenAI qua `OPENAI_REQUEST_TIMEOUT_MS`, chuan hoa thong bao loi mang/timeout, va fallback tu `OPENAI_MODEL` sang `OPENAI_FALLBACK_MODEL=gpt-5.4-mini` khi model chinh bi timeout/rot ket noi/5xx.
- Theo quyet dinh san pham moi, ban free tam thoi chi dung `gpt-5.4-mini` voi `OPENAI_REASONING_EFFORT=medium`; `gpt-5.5` de danh cho ban pro/premium sau nay.
- Them `creativeTeachingGuidance` vao prompt generate/repair khi bat che do sang tao hoac chon style thi giang/sang tao.
- Them guard phat hien giao an so sai va goi OpenAI repair 1 lan neu hoat dong qua ngan/thieu buoc GV-HS.
- Nang cap prompt refine de nut `Viet hay hon`, `Chi tiet hon`, `Thi giang` uu tien Khai pha sinh dong, cau hoi goi mo, du kien tra loi va loi chot kien thuc.
- Them luat Khoi dong bat buoc cho generate/refine: toan lop, 3-5 phut, bam bai, co hinh thuc hap dan theo mon hoc nhu hat/tro choi/cau do/quan sat/tinh huong/mini STEM-STEAM, co luat choi, cau hoi dan dat, du kien phan hoi va loi chot chuyen bai.
- Them quy tac cam tu `OCR` trong noi dung giao an; thay bang `anh SGK`, `tranh trong SGK`, `tinh huong/tranh trang ...` neu co so trang. Them sanitize sau OpenAI de thay cac cum `OCR` con sot.
- Yeu cau lessonTitle giu du so bai neu anh SGK co so bai, vi du `Bai 9. Cham soc va giup do em nho`.
- Siết phan Pham chat thanh cau chi tiet gan hanh vi hoc sinh; phan chuan bi GV/HS phai phu hop co so vat chat, vung mien va moi truong hoc user chon.

### Toolbar

- Gan handler cho:
  - Viet hay hon.
  - Rut gon.
  - Chi tiet hon.
  - Them nang luc so.
  - Thi giang.
  - Xuat Word.
  - Xuat PDF.
  - Copy toan bo.

### Export

- PDF xuat bang `html2pdf.js` de tai truc tiep file `.pdf` xuong may, khong con dung hop thoai print.
- Can deu 2 ben noi dung than giao an trong preview/PDF bang CSS va trong Word `.docx` bang paragraph alignment `JUSTIFIED`, trong khi tieu de/header bang van giu alignment rieng.
- Word ban dau loi format, da sua bang cach clone A4 page va inline styles truoc khi tao file `.doc`.
- Cai `docx` va thay Word export bang `.docx` native co the chinh sua.
- Them `src/lib/export-docx.ts` de dung truc tiep `LessonPlan` tao file Word voi A4, Times New Roman, tieu de xanh/do, bang GV/HS 2 cot va header bang xanh nhat.
- Nut `Xuat Word` trong toolbar nay tai file `.docx` thay vi `.doc` HTML.
- Sua Word `.docx` cho phep hang bang tach qua trang, tranh viec Word day ca hang sang trang sau tao khoang trang lon.

### Kiem tra

- Da chay `npm run build` nhieu lan, lan gan nhat build thanh cong sau khi nang prompt chat luong cao va doi model OpenAI mac dinh.
