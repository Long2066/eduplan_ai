# EduPlan AI - Next Steps

## Uu Tien Gan Nhat

0. `Pedagogy Engine V1` da hoan tat vong nen tang.
   - Da xong: viet profile nen cho du 12 mon KNTT tieu hoc trong `src/lib/pedagogy-profiles.ts`.
   - Da xong: gan `getPedagogyProfile(subject)` vao prompt generate va repair de moi mon co logic rieng khi sinh giao an.
   - Da xong: them checker tin hieu su pham toi thieu theo mon trong `hasQualityIssues`.
   - Da xong: tao checker sau hon cho Toan va Tieng Viet trong `subjectPedagogyIssues`.
   - Da xong: them repair guidance theo loi mon hoc phat hien duoc qua `subjectPedagogyRepairGuidance`.
   - Da xong: mo rong checker sau cho Tu nhien va Xa hoi, Khoa hoc, Lich su va Dia li.
   - Da xong: mo rong checker sau cho Dao duc va Hoat dong trai nghiem.
   - Da xong: mo rong checker sau cho Tin hoc.
   - Da xong: mo rong checker sau cho Cong nghe.
   - Da xong: mo rong checker sau cho Giao duc the chat.
   - Da xong: mo rong checker sau cho Am nhac va Mi thuat.
   - Da xong: them `PedagogyAudit`, API tra `pedagogyAudit`, UI hien checklist chat luong theo mon va log debug repair/audit.
   - Tiep theo neu can nang cap V2: gom checker thanh module rieng, them diem so/rubric, luu audit vao lich su giao an.

1. Kiem thu pipeline OCR OpenAI that voi anh SGK ro net va nhieu anh.
   - Dam bao `.env.local` co OpenAI key.
   - Upload anh JPG/PNG, dac biet case 5-8 anh.
   - Tao giao an.
   - Xem log terminal de xac nhan OCR chay theo `OPENAI_OCR_BATCH_SIZE` va AI detail chi chay sau khi OCR thanh cong.
   - Neu gap `400 Bad Request`, kiem tra thong bao co chi ra anh nghi ngo hay khong; thu nen/xoa/upload lai anh do.
   - Neu gap loi OpenAI `520`/Cloudflare/5xx hoac timeout, xac nhan UI chi hien thong bao ngan gon va co the tao lai sau it phut.

2. Kiem thu chat luong prompt generate moi.
   - Kiem tra `Cap do chat luong giao an` trong tuy chon nang cao, mac dinh `Sang tao cao`.
   - Kiem tra phan Khoi dong co dung tinh chat toan lop, 3-5 phut, hap dan va bam bai khong.
   - Tao giao an voi anh SGK that va kiem tra phan Khai pha/hinh thanh kien thuc co hap dan khong.
   - Kiem tra moi hoat dong co du buoc GV-HS, cau hoi goi mo, san pham hoc tap, tieu chi danh gia.
   - Kiem tra moi hoat dong co du tinh chat `kich ban day hoc`: tinh huong mo, ky thuat day hoc/hoc lieu cu the, du kien phan hoi dung/sai, xu ly sai lech va loi chot GV.
   - Kiem tra giao an khong con tu `OCR`; neu anh co so trang thi hoat dong nen ghi `tranh/tinh huong trang ...`, neu khong co so trang thi ghi `tranh trong SGK`.
   - Kiem tra ten bai co day du so bai neu anh SGK co so bai.
   - Kiem tra pham chat va chuan bi GV/HS da chi tiet va phu hop vung mien/co so vat chat.
   - Kiem tra `FREE_OPENAI_MODEL` cho ban Free va `PLUS_MODEL`/`PRO_MODEL` cho goi tra phi co dung chat luong/chi phi mong muon khong.
   - Kiem tra lai case OpenAI `fetch failed`: ky vong app timeout theo `OPENAI_REQUEST_TIMEOUT_MS` voi thong bao ro hon hoac tu fallback theo plan neu co.
   - Tiep tuc tang do giong mau giao an nguoi dung dua neu output van chung chung.
   - Kiem tra neu `periods > 1` thi output co `periodPlans` du so tiet, moi tiet co du Khoi dong - Kham pha - Luyen tap - Van dung - Danh gia.
   - Kiem tra tuy chon nang cao `Giao an sang tao/du gio` co tao diem sang tao noi bat nhung van dung muc tieu bai hoc khong.

3. Kiem thu Preview/Word export.
   - Preview hien la cac to A4 noi tiep theo tung tiet trong `.a4-document`, co khoang cach nho nhu xem giay that; can kiem tra co sat A4 that khong.
   - Kiem tra noi dung than giao an da can deu 2 ben trong preview va Word; tieu de/header bang van can giua/can trai dung mau.
   - Kiem tra dong ngay thang nam ngan va can phai; sau `III. TIEN TRINH DAY HOC` la bang luon, khong co dong `TIET X: ...` chen vao.
   - Mo file Word va so sanh voi preview A4.
   - Voi bai nhieu tiet, Word phai van nam trong cung mot tep va co du tung tiet.
   - Kiem tra kha nang sua noi dung, bang GV/HS, mau tieu de va margin.
   - Neu can khoi phuc PDF, lam lai co chu dich thay vi dua vao route/lib cu da go bo.

4. Them quality check/repair loop.
   - Kiem tra LessonPlan co du activities.
   - Kiem tra teacherActions/studentActions khong rong.
   - Neu loi, goi OpenAI repair 1 lan.

## Uu Tien Sau

5. Nang cap lich su giao an: luu audit, model routing va version neu can.
6. Hoan thien Admin Tool:
   - Dashboard user/lesson/payment/feedback hien da co nen can tiep tuc polish va phan quyen.
   - Usage/cost.
   - Logs va audit.
   - Prompt/model settings.
7. Them export PDF server-side neu can deploy production.
8. Them refine/version history neu quyet dinh khoi phuc tinh nang refine.
9. Neu OCR van gap loi payload/timeout nhieu, them tuy chon UI cho user chon kich thuoc batch OCR hoac nen anh client-side truoc khi gui.

## Lenh Kiem Tra

```bash
npm run build
npm run dev
```

## Can Nho

- Khong bao gio hien thi API key trong chat.
- `.env.local` la file local, khong commit.
- OpenAI key nam server.
- `400 Bad Request` trong stage OCR khong mac dinh la key sai; thuong lien quan den anh/request qua lon hoac du lieu anh khong hop le.
