# EduPlan AI - Project Memory

File nay la bo nho du an. Khi bat dau phien moi, hay doc file nay truoc, sau do doc `docs/NEXT_STEPS.md` va `docs/CHANGELOG_DEV.md`.

## Muc Tieu San Pham

EduPlan AI la web app giup giao vien tao Ke hoach bai day (KHBD) theo Cong van 2345. User nhap thong tin co ban, upload/paste anh SGK, tool tu OCR bang Gemini key cua user, goi OpenAI bang key server, sinh giao an va render preview A4. Output can xuat PDF/Word giu dinh dang dep.

## Cong Nghe Hien Tai

- Next.js 15 + TypeScript.
- Tailwind CSS.
- App Router.
- Gemini OCR qua API key user nhap tren giao dien.
- OpenAI API qua `.env.local` tren server.
- Preview A4 bang HTML/CSS.
- PDF export dung print/browser, dang giu format tot.
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
OPENAI_MODEL=gpt-5.4-mini
OPENAI_FALLBACK_MODEL=gpt-5.4-mini
OPENAI_REASONING_EFFORT=medium
OPENAI_REQUEST_TIMEOUT_MS=120000
GEMINI_OCR_MODEL=gemini-2.5-flash
```

## Quyet Dinh San Pham Da Chot

- Lam web app truoc, chua lam EXE/Android.
- Input giu gon, user khong can nhap noi dung bai hoc.
- Chi ho tro upload/paste anh SGK JPG/JPEG/PNG o ban hien tai.
- Ten bai co the de trong; AI se tu nhan dien tu anh OCR.
- Thoi luong mac dinh 35 phut/tiet.
- Gemini key do user nhap, co the them nhieu key.
- OpenAI key do chu app cau hinh trong `.env.local`.
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
  - Cau hinh OCR.
  - Tuy chon nang cao.
- Upload/paste anh JPG/JPEG/PNG.
- Preview thumbnail anh.
- Gemini key nhieu key, co nut test tat ca key, badge trang thai va so luot da dung trong app.
- `usedRequests` cap nhat khi test key va khi tao giao an; OCR tu dong xoay vong key theo key it dung hon, bo qua key invalid/quota_exceeded.
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
  - OCR Gemini: chia anh upload thanh batch nho 2 anh/request de can bang giua viec giam quota va tranh `400 Bad Request` do payload qua lon.
  - Neu batch 2 anh bi `400 Bad Request`, app tu retry tach tung anh de co the xac dinh anh nghi ngo loi/qua lon/khong hop le.
  - Loi `503 UNAVAILABLE`/high demand duoc retry ngan truoc khi thu key khac.
  - `400 Bad Request` khong con bi danh dau la key invalid vi thuong la loi request/anh, khong phai key moi hay cu.
  - Xoay vong nhieu Gemini key theo `usedRequests`; key het quota/key loi duoc tra ve UI de danh dau cho user xoa hoac cho reset.
  - Goi OpenAI.
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
  - Co kiem tra giao an so sai va repair 1 lan neu activities qua ngan/thieu buoc GV-HS.
- API `/api/lesson/refine`:
  - Viet hay hon.
  - Rut gon.
  - Chi tiet hon.
  - Them nang luc so.
  - Thi giang.
- Toolbar AI Control Center da co handler.
- Copy toan bo noi dung A4.
- Xuat PDF tai truc tiep ve may bang `html2pdf.js`, khong con mo hop thoai in.
- Xuat Word `.docx` native co the chinh sua, dung Times New Roman, A4 margin 1.8cm/1.6cm, tieu de xanh/do va bang GV/HS 2 cot; bang cho phep tach hang qua trang de tranh khoang trang lon; paragraph than bai mac dinh can deu 2 ben.
- Build thanh cong sau moi dot sua.

### Chua Lam / Can Lam Tiep

- Chua co export PDF server-side bang Puppeteer.
- Chua co database.
- Chua co admin dashboard.
- Chua co luu lich su giao an.
- Chua co auth/login.
- Chua co quality repair loop nang cao neu OpenAI tra schema kem.
- Chua co test voi nhieu case anh SGK thuc te.

## Luu Y Ky Thuat Quan Trong

- Pipeline generate hien tai chi goi OpenAI sau khi Gemini OCR thanh cong.
- Neu preview bao `Loi OpenAI` kem 5xx/Cloudflare/520 thi thuong la loi tam thoi phia OpenAI/Cloudflare, khong phai loi anh SGK hay Gemini key. App da retry ngan, user co the bam tao lai sau it phut.
- Neu Gemini key sai, se bao loi OCR va chua chay toi OpenAI.
- Neu upload nhieu anh, OCR khong gom tat ca anh vao mot request nua; mac dinh batch 2 anh/request, fallback single-image khi gap `400`.
- Loi `400 Bad Request` cua Gemini nen huong user kiem tra/nen anh, xoa anh nghi ngo hoac upload lai JPG/PNG ro net; khong nen ket luan key moi bi sai neu khong co `API_KEY_INVALID`/`PERMISSION_DENIED`.
- Server co log:
  - `[EduPlan AI] OCR Gemini started`
  - `[EduPlan AI] OCR Gemini batch started`
  - `[EduPlan AI] OCR Gemini batch completed`
  - `[EduPlan AI] OCR Gemini completed`
  - `[EduPlan AI] OpenAI generation started`
  - `[EduPlan AI] OpenAI generation completed`
- refine tuong tu.
- PDF giong preview nhat vi render tu HTML/CSS cua browser.
- Word `.docx` native uu tien tinh chinh sua duoc; khong pixel-perfect 100% nhu preview nhung on dinh hon `.doc` HTML.
- Khoi dong phai la hoat dong toan lop, co hung thu va bam bai; khong chap nhan kieu "GV gioi thieu bai".
- Theo docs OpenAI da kiem tra trong phien nay, model flagship moi nhat la `gpt-5.5`, nhung user da chot ban free tam thoi chi dung `gpt-5.4-mini` de tiet kiem chi phi. Tool hien gan `OPENAI_MODEL=gpt-5.4-mini`, `OPENAI_FALLBACK_MODEL=gpt-5.4-mini`, `OPENAI_REASONING_EFFORT=medium`. Ban pro co the tinh `gpt-5.5` sau.
- User gap loi `Loi OpenAI: fetch failed` sau khi log `OpenAI generation started { model: 'gpt-5.5' }` va request ket thuc sau ~318 giay. Nguyen nhan kha nang cao: ket noi toi OpenAI bi rot/timeout do `gpt-5.5` + reasoning high + output giao an JSON dai. Da them `OPENAI_REQUEST_TIMEOUT_MS=120000`, thong bao loi fetch/timeout ro rang. Sau do user chot ban free chi dung `gpt-5.4-mini` medium de giam chi phi/timeout.
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
