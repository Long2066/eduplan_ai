# EduPlan AI - Project Memory

File nay la bo nho du an. Khi bat dau phien moi, hay doc file nay truoc, sau do doc `docs/NEXT_STEPS.md` va `docs/CHANGELOG_DEV.md`.

## Muc Tieu San Pham

EduPlan AI la web app giup giao vien tao Ke hoach bai day (KHBD) theo Cong van 2345. User nhap thong tin co ban, upload/paste anh SGK, server OCR bang OpenAI, goi AI theo goi Free/Plus/Pro, sinh giao an, render preview A4 va xuat Word `.docx`.

## Cong Nghe Hien Tai

- Next.js 15 + TypeScript.
- Tailwind CSS.
- App Router.
- OpenAI OCR va OpenAI generation qua `.env.local` tren server.
- Firebase Auth, Firestore va Storage cho login, profile, history, payment proof, admin.
- Preview A4 bang HTML/CSS.
- Word export dung `.docx` native bang package `docx`, co the chinh sua duoc trong Microsoft Word va bam sat preview bang font/margin/bang/mau native.

## File Cau Hinh API

Khong doc, khong hien thi API key trong chat.

File dung cho key:

```text
.env.local
```

Noi dung mau:

```env
OPENAI_API_KEY=...
OPENAI_OCR_MODEL=gpt-4.1-mini
OPENAI_OCR_BATCH_SIZE=3
FREE_OPENAI_MODEL=gpt-4.1-mini
FREE_OPENAI_FALLBACK_MODEL=gpt-4.1-mini
PLUS_MODEL=gpt-5.4-mini
PLUS_FALLBACK_MODEL=gpt-5.4-mini
PRO_MODEL=gpt-5.4
PRO_FALLBACK_MODEL=gpt-5.4
OPENAI_REASONING_EFFORT=medium
OPENAI_REQUEST_TIMEOUT_MS=240000
```

## Quyet Dinh San Pham Da Chot

- Lam web app truoc, chua lam EXE/Android.
- Input giu gon, user khong can nhap noi dung bai hoc.
- Chi ho tro upload/paste anh SGK JPG/JPEG/PNG o ban hien tai.
- Ten bai co the de trong; AI se tu nhan dien tu anh OCR.
- Thoi luong mac dinh 35 phut/tiet.
- OpenAI key do chu app cau hinh trong `.env.local`; user khong nhap AI key tren giao dien.
- Khong can man review OCR trung gian; pipeline chay mot mach.
- Neu thong tin hanh chinh thieu trong giao an thi de dong cham cho user tu dien.
- Preview phai la trang A4 giong ban xuat.

## Trang Thai Tinh Nang Hien Tai

### Da Lam

- Da bat dau dot `Pedagogy Engine V1` de chuyen tool tu "chon mon/lop" sang logic su pham theo mon:
  - Them `src/lib/subject-catalog.ts` lam danh muc chuan lop 1-5 theo KNTT cho cac mon user cung cap.
  - Chuan hoa danh sach mon: Tieng Viet, Toan, Dao duc, Tu nhien va Xa hoi, Khoa hoc, Lich su va Dia li, Tin hoc, Cong nghe, Giao duc the chat, Am nhac, Mi thuat, Hoat dong trai nghiem.
  - Truong Tap sach chi con ap dung voi Toan va Tieng Viet; cac mon khac hien `Khong ap dung`.
  - Them `src/lib/pedagogy-profiles.ts` voi khung PedagogyProfile.
  - Da co profile su pham nen cho du 12 mon KNTT tieu hoc: Tieng Viet, Toan, Dao duc, Tu nhien va Xa hoi, Khoa hoc, Lich su va Dia li, Tin hoc, Cong nghe, Giao duc the chat, Am nhac, Mi thuat, Hoat dong trai nghiem.
  - Moi profile co muc dich, trong tam, hoat dong dac trung, loi sai thuong gap, cau hoi go kho, tieu chi danh gia, phan hoa, van dung, dieu can tranh, dieu chinh theo cum lop, qualityChecks va repairHints.
  - Da gan `getPedagogyProfile(subject)` vao prompt generate va repair trong `src/app/api/lesson/generate/route.ts`, nen khi user chon mon/lop, AI nhan logic su pham rieng cua mon do.
  - Da them checker tin hieu su pham theo mon trong `hasQualityIssues`; neu giao an thieu dau hieu ban chat mon, app se kich hoat repair mot luot.
  - Da them checker sau hon cho Toan va Tieng Viet bang `subjectPedagogyIssues`: Toan soi bieu dien/tom tat, phan tich du kien-quan he-phep tinh, loi sai/kiem tra nguoc; Tieng Viet soi ngu lieu, doc/luyen doc, viet/luyen tu cau/sua loi, noi-nghe va doc hieu co bang chung.
  - Da mo rong checker sau cho tat ca mon con lai:
    - Tu nhien va Xa hoi/Khoa hoc/Lich su va Dia li: soi quan sat, thuc hanh/thi nghiem, bang chung, ban do/tu lieu, lien he doi song/dia phuong.
    - Dao duc/Hoat dong trai nghiem: soi tinh huong, hanh vi, cam xuc, hau qua, dong vai, trai nghiem, rut kinh nghiem, cam ket/ke hoach hanh dong.
    - Tin hoc/Cong nghe: soi thao tac thuc hanh, san pham so/san pham cong nghe, thuat toan/quy trinh, an toan, tieu chi/cai tien.
    - Giao duc the chat/Am nhac/Mi thuat: soi khoi dong-hoi tinh, ky thuat/an toan, nghe-hat-go dem, tao hinh-chat lieu, san pham, bieu dien/trung bay/nhan xet.
  - Da them `subjectPedagogyRepairGuidance` de dua loi su pham theo mon vao prompt repair, giup AI sua dung loi thay vi sua chung chung.
  - Da them `PedagogyAudit` trong `src/types/lesson.ts`; API generate tra `pedagogyAudit` gom status, issues, checks, repairApplied, checkedAt.
  - UI `src/app/page.tsx` da hien `PedagogyAuditCard` o vung preview sau khi tao giao an, giup user thay giao an dat checklist mon hoc, da repair hay can xem lai.
  - Server log repair/audit de debug: repair start co `subjectPedagogyIssues`; generation completed co audit status, issueCount, subject, grade.
  - Them `docs/PEDAGOGY_ENGINE_V1.md` ghi lai pham vi, danh muc va profile du mon V1.
- UI tong the 2 cot: form trai, preview phai; tren man hinh lon, form trai cuon rieng va preview phai duoc giu co dinh trong khung lam viec.
- Header sticky, billboard text luan phien moi 5 giay.
- Demo user online tren header.
- Form nhap lieu da gom nhom:
  - Thong tin bai hoc.
  - Noi dung dau vao.
  - Tuy chon nang cao.
- Upload/paste anh JPG/JPEG/PNG.
- Preview thumbnail anh.
- Checkbox `Cho phep AI tu suy luan phan con thieu` nam o form co ban.
- Tuy chon nang cao co checkbox `Giao an sang tao/du gio`; khi bat, prompt cho phep sang tao hoc lieu/tinh huong ngoai SGK nhu video AI, tranh dong, hop bi mat, the tin hieu, tro choi, dong vai, mini STEM/STEAM nhung phai bam muc tieu bai hoc.
- Tuy chon nang cao co `Cap do chat luong giao an`: Co ban, Chi tiet, Du gio / Thi giang, Sang tao cao. Mac dinh moi la `Sang tao cao`.
- Preview A4 theo mau giao an:
  - Times New Roman.
  - Tieu de xanh/do.
  - Bang 2 cot GV/HS.
  - Noi dung than bai can can deu 2 ben; tieu de va header bang giu can giua/can trai theo mau.
  - Dong ngay/thang/nam ngan `Ngay ........ thang ........ nam ........`, can lech phai.
  - Sau muc `III. TIEN TRINH DAY HOC` la bang tien trinh luon; khong render them dong `TIET X: ...` truoc bang.
  - Header tieu de tranh lap `LOP LOP 1` neu user nhap lop dang `Lop 1`.
  - Dong cham cho truong/ngay/nguoi day.
  - Preview hien render thanh cac to A4 noi tiep theo tung tiet trong `.a4-document`, co khoang cach nho nhu xem giay that; moi tiet bat dau tu BAI ... (TIET X) va co du I, II, III, IV.
- API `/api/lesson/generate`:
  - OCR OpenAI: chia anh upload thanh batch theo `OPENAI_OCR_BATCH_SIZE`, mac dinh 3 anh/request.
  - Neu batch nhieu anh loi, app retry tach tung anh de chi ra anh nghi ngo loi/qua lon/khong hop le.
  - Goi AI detail/repair theo `getPlanModelStrategy` dua tren subscription plan.
  - Loi OpenAI 5xx/Cloudflare nhu `520 Web server is returning an unknown error` duoc retry ngan va chuan hoa thanh thong bao ngan gon, khong hien nguyen HTML loi len preview.
  - Tra LessonPlan JSON.
  - Prompt da neo theo CTGDPT 2018: pham chat, nang luc, giao vien to chuc/huong dan, hoc sinh chu dong kham pha/luyen tap/van dung, danh gia qua qua trinh va san pham.
  - Prompt co luat Khoi dong: luon toan lop 3-5 phut, tao hung thu bang hat/tro choi/cau do/quan sat/tinh huong/mini STEM-STEAM phu hop mon hoc, co luat choi, cau hoi dan dat, du kien phan hoi va loi chot chuyen bai.
  - Prompt da duoc nang thanh che do viet `kich ban day hoc`: moi hoat dong phai co tinh huong mo, ky thuat day hoc/hoc lieu cu the, cau hoi goi mo, du kien phan hoi dung/sai, cach GV xu ly sai lech, loi chot va san pham hoc tap.
  - Quality gate/repair da siết manh hon: cap do cao yeu cau toi thieu 7 buoc GV/HS moi hoat dong, rieng Kham pha toi thieu 10 buoc GV/HS va co tin hieu sang tao/ky thuat day hoc cu the.
  - Neu `periods > 1`, prompt yeu cau `periodPlans` du so tiet; moi tiet co du Khoi dong, Kham pha, Luyen tap, Van dung, Danh gia va duoc render/xuat trong cung mot tep.
  - Prompt cam dung tu `OCR` trong noi dung giao an. Khi can nhac hoc lieu, phai viet `anh SGK`, `tranh trong SGK`, `tinh huong/tranh trang ...` neu nhan dien duoc so trang. Co sanitize sau OpenAI de thay cac cum `OCR` con sot.
  - Neu anh SGK co so bai, lessonTitle phai giu day du dang `Bai X. Ten bai`, khong duoc chi ghi ten bai.
  - Phan Pham chat phai viet thanh cau cu the gan hanh vi hoc sinh trong bai, khong chi liet ke tu khoa ngan.
  - Phan Thiet bi day hoc va hoc lieu phai bam co so vat chat, moi truong hoc, vung mien user chon; vung nui/diem truong le/khong co trinh chieu thi uu tien tranh in, the mau, vat that, phieu hoc tap don gian thay vi mac dinh slide/video.
  - Co kiem tra giao an so sai va repair neu activities qua ngan/thieu buoc GV-HS.
- Toolbar hien tai giu xuat Word `.docx`; cac route refine/PDF cu da duoc go khoi code dang chay.
- Xuat Word `.docx` native co the chinh sua, dung Times New Roman, A4 margin 1.8cm/1.6cm, tieu de xanh/do va bang GV/HS 2 cot; bang cho phep tach hang qua trang de tranh khoang trang lon; paragraph than bai mac dinh can deu 2 ben.
- Build thanh cong sau moi dot sua.

### Chua Lam / Can Lam Tiep

- Chua co export PDF trong UI hien tai; neu can thi lam lai co chu dich, uu tien server-side Puppeteer hoac browser export moi.
- Chua co refine/version history trong UI hien tai.
- Chua co quality repair loop nang cao neu AI tra schema kem.
- Chua co test voi nhieu case anh SGK thuc te.

## Luu Y Ky Thuat Quan Trong

- Pipeline generate hien tai OCR OpenAI truoc, sau do moi goi AI detail/repair.
- Neu preview bao `Loi AI` kem 5xx/Cloudflare/520 thi thuong la loi tam thoi phia OpenAI/Cloudflare. App da retry ngan, user co the bam tao lai sau it phut.
- Neu upload nhieu anh, OCR khong gom tat ca anh vao mot request nua; mac dinh batch 3 anh/request, fallback single-image khi batch loi.
- Loi `400 Bad Request` trong stage OCR nen huong user kiem tra/nen anh, xoa anh nghi ngo hoac upload lai JPG/PNG ro net.
- Server co log:
  - `[EduPlan AI] OCR OpenAI started`
  - `[EduPlan AI] OCR OpenAI batch started`
  - `[EduPlan AI] OCR OpenAI completed`
  - `[EduPlan AI] AI stage completed`
- Word `.docx` native uu tien tinh chinh sua duoc; khong pixel-perfect 100% nhu preview nhung on dinh hon `.doc` HTML.
- Khoi dong phai la hoat dong toan lop, co hung thu va bam bai; khong chap nhan kieu "GV gioi thieu bai".
- Model routing hien tai: Free dung `FREE_OPENAI_MODEL` mac dinh `gpt-4.1-mini`; Plus dung `PLUS_MODEL` mac dinh `gpt-5.4-mini`; Pro dung `PRO_MODEL` mac dinh `gpt-5.4`; OCR dung `OPENAI_OCR_MODEL`.
- Da them `OPENAI_REQUEST_TIMEOUT_MS`, thong bao loi fetch/timeout ro rang va fallback theo plan neu co cau hinh.
- Chat luong giao an can uu tien: Khai pha/hinh thanh kien thuc phai co tinh huong co van de, cau hoi goi mo, du kien tra loi, loi chot; Luyen tap co nhiem vu cu the; Van dung gan doi song; Danh gia co tieu chi/minh chung quan sat duoc.

## Lenh Hay Dung

```bash
npm run dev
npm run build
```

## Cach Tiep Tuc Phien Moi

Neu user noi: "doc file lich su va ke hoach roi tiep tuc cong viec", can doc cac file:

```text
docs/PROJECT_MEMORY.md
docs/NEXT_STEPS.md
docs/CHANGELOG_DEV.md
```

Sau do tiep tuc theo muc uu tien trong `NEXT_STEPS.md`.
