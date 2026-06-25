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
   - Tiep theo neu can nang cap V2: gom checker thanh module rieng, them diem so/rubric, luu audit vao lich su giao an, va cho refine cap nhat audit.

1. Kiem thu pipeline OCR that voi anh SGK ro net va nhieu anh.
   - Nhap Gemini key dung.
   - Dam bao `.env.local` co OpenAI key.
   - Upload anh JPG/PNG, dac biet case 5-8 anh.
   - Tao giao an.
   - Xem log terminal de xac nhan OCR chay theo batch 2 anh/request va OpenAI chi chay sau khi OCR thanh cong.
   - Neu gap `400 Bad Request`, kiem tra thong bao co chi ra anh nghi ngo hay khong; thu nen/xoa/upload lai anh do.
   - Neu gap `503 UNAVAILABLE`/high demand, thu lai sau it phut vi day la loi tai dich vu Gemini.
   - Neu gap loi OpenAI `520`/Cloudflare/5xx, xac nhan UI chi hien thong bao ngan gon va co the tao lai sau it phut.

2. Kiem thu chat luong prompt generate moi.
   - Kiem tra `Cap do chat luong giao an` trong tuy chon nang cao, mac dinh `Sang tao cao`.
   - Kiem tra phan Khoi dong co dung tinh chat toan lop, 3-5 phut, hap dan va bam bai khong.
   - Tao giao an voi anh SGK that va kiem tra phan Khai pha/hinh thanh kien thuc co hap dan khong.
   - Kiem tra moi hoat dong co du buoc GV-HS, cau hoi goi mo, san pham hoc tap, tieu chi danh gia.
   - Kiem tra moi hoat dong co du tinh chat `kich ban day hoc`: tinh huong mo, ky thuat day hoc/hoc lieu cu the, du kien phan hoi dung/sai, xu ly sai lech va loi chot GV.
   - Kiem tra giao an khong con tu `OCR`; neu anh co so trang thi hoat dong nen ghi `tranh/tinh huong trang ...`, neu khong co so trang thi ghi `tranh trong SGK`.
   - Kiem tra ten bai co day du so bai neu anh SGK co so bai.
   - Kiem tra pham chat va chuan bi GV/HS da chi tiet va phu hop vung mien/co so vat chat.
   - Kiem tra `gpt-5.4-mini`/`OPENAI_REASONING_EFFORT=medium` cho ban free co du chat luong va on dinh khong. Tam thoi khong dung `gpt-5.5` cho ban free vi chi phi cao.
   - Kiem tra lai case OpenAI `fetch failed`: ky vong app timeout sau 120 giay voi thong bao ro hon hoac tu fallback sang `gpt-5.4-mini`.
   - Tiep tuc tang do giong mau giao an nguoi dung dua neu output van chung chung.
   - Kiem tra neu `periods > 1` thi output co `periodPlans` du so tiet, moi tiet co du Khoi dong - Kham pha - Luyen tap - Van dung - Danh gia.
   - Kiem tra tuy chon nang cao `Giao an sang tao/du gio` co tao diem sang tao noi bat nhung van dung muc tieu bai hoc khong.

3. Kiem thu Preview/PDF/Word export.
   - Preview hien la cac to A4 noi tiep theo tung tiet trong `.a4-document`, co khoang cach nho nhu xem giay that; can kiem tra co sat A4 that khong.
   - Kiem tra noi dung than giao an da can deu 2 ben trong preview, PDF va Word; tieu de/header bang van can giua/can trai dung mau.
   - Kiem tra dong ngay thang nam ngan va can phai; sau `III. TIEN TRINH DAY HOC` la bang luon, khong co dong `TIET X: ...` chen vao.
   - PDF tai truc tiep ve may bang `html2pdf.js`; can kiem tra moi tiet co sang trang dung va con ngat trang xau/bat ngo trong bang dai khong.
   - Mo file Word va so sanh voi preview A4.
   - Voi bai nhieu tiet, Word/PDF phai van nam trong cung mot tep va co du tung tiet.
   - Kiem tra kha nang sua noi dung, bang GV/HS, mau tieu de va margin.
   - Neu can giong preview hon nua, tinh them tuy chon Word dang anh rieng, nhung khong chinh sua text truc tiep.

4. Them quality check/repair loop.
   - Kiem tra LessonPlan co du activities.
   - Kiem tra teacherActions/studentActions khong rong.
   - Neu loi, goi OpenAI repair 1 lan.

## Uu Tien Sau

5. Luu lich su giao an local hoac database.
6. Tao Admin Tool:
   - Dashboard user.
   - Usage/cost.
   - Logs.
   - Prompt/model settings.
7. Them auth/login.
8. Them export PDF server-side neu can deploy production.
9. Them refine version history.
10. Neu OCR van gap quota nhieu, them tuy chon UI cho user chon kich thuoc batch OCR hoac nen anh client-side truoc khi gui.

## Lenh Kiem Tra

```bash
npm run build
npm run dev
```

## Can Nho

- Khong bao gio hien thi API key trong chat.
- `.env.local` la file local, khong commit.
- Gemini key cua user nam trong UI/localStorage.
- OpenAI key nam server.
- `400 Bad Request` cua Gemini khong mac dinh la key sai; thuong lien quan den anh/request qua lon hoac du lieu anh khong hop le.
