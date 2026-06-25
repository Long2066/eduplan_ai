# EduPlan AI - Pedagogy Engine V1

Tai lieu nay ghi lai dot update logic su pham theo mon.

## 1. Pham vi mon/lop chinh thuc

Pham vi uu tien hien tai: cac mon tieu hoc lop 1-5 theo bo sach Ket noi tri thuc voi Cuoc song ma user da cung cap qua danh sach SGK.

### Lop 1

- Tieng Viet tap 1, tap 2
- Toan tap 1, tap 2
- Dao duc
- Tu nhien va Xa hoi
- Giao duc the chat
- Am nhac
- Mi thuat
- Hoat dong trai nghiem

### Lop 2

- Tieng Viet tap 1, tap 2
- Toan tap 1, tap 2
- Dao duc
- Tu nhien va Xa hoi
- Giao duc the chat
- Am nhac
- Mi thuat
- Hoat dong trai nghiem

### Lop 3

- Tieng Viet tap 1, tap 2
- Toan tap 1, tap 2
- Dao duc
- Tu nhien va Xa hoi
- Tin hoc
- Cong nghe
- Giao duc the chat
- Am nhac
- Mi thuat
- Hoat dong trai nghiem

### Lop 4

- Tieng Viet tap 1, tap 2
- Toan tap 1, tap 2
- Dao duc
- Khoa hoc
- Lich su va Dia li
- Tin hoc
- Cong nghe
- Giao duc the chat
- Am nhac
- Mi thuat
- Hoat dong trai nghiem

### Lop 5

- Tieng Viet tap 1, tap 2
- Toan tap 1, tap 2
- Dao duc
- Khoa hoc
- Lich su va Dia li
- Tin hoc
- Cong nghe
- Giao duc the chat
- Am nhac
- Mi thuat
- Hoat dong trai nghiem

## 2. Ket qua danh gia dropdown hien tai

Dropdown truoc dot update da co lop 1-5 va hau het cac mon can thiet, nhung co 2 diem can chinh:

- `Tieng Anh` dang nam trong danh sach mac dinh, khong thuoc pham vi SGK user vua dua cho dot Pedagogy Engine V1.
- Truong `Tap sach` hien cho moi mon, trong khi chi `Toan` va `Tieng Viet` can tap 1/tap 2.

Dot update nay da tach danh muc mon/lop vao `src/lib/subject-catalog.ts`, de dropdown khong con la mang roi rac trong `defaults.ts`.

## 3. Chuan hoa ten mon

Ten mon chuan trong he thong:

- Tieng Viet
- Toan
- Dao duc
- Tu nhien va Xa hoi
- Khoa hoc
- Lich su va Dia li
- Tin hoc
- Cong nghe
- Giao duc the chat
- Am nhac
- Mi thuat
- Hoat dong trai nghiem

Luu y hien thi trong code van dung dau tieng Viet day du. Tai lieu nay viet khong dau de tranh loi font khi copy qua terminal cu.

## 4. Khung Pedagogy Profile

Moi mon se co ho so su pham gom:

- `purpose`: tinh than day hoc cua mon.
- `coreTeachingFocus`: trong tam can giu khi soan.
- `signatureActivities`: hoat dong dac trung cua mon.
- `commonMisconceptions`: loi hoc sinh thuong mac.
- `supportQuestions`: cau hoi go kho cho hoc sinh yeu/lung tung.
- `assessmentCriteria`: tieu chi danh gia quan sat duoc.
- `differentiationMoves`: phan hoa hoc sinh.
- `applicationMoves`: cach van dung vao doi song.
- `avoid`: dieu can tranh.
- `gradeBandAdjustments`: dieu chinh theo cum lop 1-2, lop 3, lop 4-5.
- `qualityChecks`: diem can soi sau khi AI sinh giao an.
- `repairHints`: cach sua neu checker phat hien loi.

File da tao: `src/lib/pedagogy-profiles.ts`.

## 5. Pedagogy Profile Toan V1

Toan la mon dau tien duoc viet profile vi co loi that da quan sat duoc trong giao an mau: du kien van dung sai logic ti so/hieu.

Toan V1 tap trung vao:

- Hieu ban chat truoc cong thuc.
- Bieu dien bang vat that, bang, hinh ve, so do doan thang.
- Kiem logic du kien bai toan co loi van.
- Kiem so lon/so be, ti so, tong/hieu so phan.
- Kiem moc thoi gian trong bai toan tuoi.
- Kiem doi don vi.
- Co cau hoi go kho hoc sinh yeu.
- Co kiem tra nguoc ket qua.
- Chia luyen tap thanh muc co ban, van dung, van dung cao.
- Kiem soat thoi luong 35 phut.

## 6. Pedagogy Profile du mon V1

Da bo sung profile nen cho tat ca mon trong pham vi KNTT tieu hoc:

- Tieng Viet: doc, viet, noi nghe, luyen tu/cau, cau hoi truoc-trong-sau doc, khung viet va sua loi ngon ngu.
- Toan: hieu ban chat, bieu dien, so do, logic bai toan co loi van, loi sai thuong gap va kiem tra nguoc.
- Dao duc: tinh huong, lua chon hanh vi, cam xuc, hau qua, dong vai va cam ket hanh dong.
- Tu nhien va Xa hoi: quan sat, mo ta, so sanh, phan loai, an toan, ve sinh, moi truong va cong dong.
- Khoa hoc: cau hoi, du doan, quan sat/thi nghiem, bang chung, ket luan va van dung.
- Lich su va Dia li: truc thoi gian, ban do/luoc do, tu lieu, nguyen nhan-ket qua, vi tri-dac diem-doi song.
- Tin hoc: nhiem vu thuc hanh, san pham so, tu duy thuat toan, an toan so va phuong an thieu thiet bi.
- Cong nghe: nhu cau, vat lieu, cong cu, quy trinh, an toan, san pham va cai tien.
- Giao duc the chat: khoi dong, lam mau, tap luyen, tro choi van dong, an toan, sua loi ky thuat va hoi tinh.
- Am nhac: nghe, hat, go dem, van dong, bieu dien, cam thu va sang tao.
- Mi thuat: quan sat, cam nhan, kham pha chat lieu, tao san pham, trung bay va nhan xet tich cuc.
- Hoat dong trai nghiem: trai nghiem, chia se, rut kinh nghiem, van dung/cam ket va tu danh gia.

File chinh: `src/lib/pedagogy-profiles.ts`.

## 7. Gan profile vao generate/repair

Da gan `getPedagogyProfile(subject)` vao pipeline sinh giao an:

- `buildPrompt(...)` chen Logic su pham chuyen biet theo mon va cum lop vao prompt generate.
- `buildRepairPrompt(...)` chen lai profile khi AI can tu sua giao an.
- `hasQualityIssues(...)` co them checker tin hieu su pham theo mon. Neu giao an khong co dau hieu dung ban chat mon, app se kich hoat repair mot luot.

Vi du checker toi thieu:

- Toan can co dau hieu so do/tom tat/du kien/phep tinh/kiem tra logic.
- Tieng Viet can co dau hieu doc-viet-noi-nghe/ngu lieu/tu-cau-doan.
- Khoa hoc can co du doan/thi nghiem/quan sat/bang chung/ket luan.
- Dao duc va Hoat dong trai nghiem can co tinh huong, hanh vi, cam ket/hong dong.
- Cac mon thuc hanh/nang khieu can co thao tac, an toan, san pham va tieu chi.

Trang thai hien tai: profile da tro thanh mot phan that cua tinh nang generate, khong chi la dropdown hay tai lieu.

## 8. Checker sau hon cho Toan va Tieng Viet

Da them checker sau hon trong `subjectPedagogyIssues(...)`:

- Toan:
  - Kiem tra co bieu dien/tom tat truc quan: so do, bang, hinh ve, mo hinh, the, truc so, phan bang nhau.
  - Kiem tra co phan tich du kien, yeu cau, quan he giua dai luong hoac ly do chon phep tinh.
  - Kiem tra co du kien loi sai/kiem tra nguoc/doi chieu ket qua, don vi.
- Tieng Viet:
  - Kiem tra co ngu lieu cu the: van ban, bai doc, doan, cau, tu, tranh.
  - Kiem tra co doc/luyen doc.
  - Kiem tra co viet/luyen tu cau/chinh ta/sua loi ngon ngu.
  - Kiem tra co noi-nghe/chia se/trinh bay.
  - Kiem tra co cau hoi doc hieu dua vao bang chung, chi tiet, y chinh, cam nhan hoac giai nghia tu.

## 9. Repair theo loi su pham cua mon

Da them `subjectPedagogyRepairGuidance(...)` de dua cac loi phat hien duoc vao prompt repair.

Ket qua: khi giao an bi thieu logic mon hoc, repair khong con sua chung chung ma nhan danh sach loi cu the, vi du:

- Toan thieu so do/tom tat.
- Toan thieu phan tich du kien/quan he/phep tinh.
- Toan thieu loi sai/kiem tra nguoc.
- Tieng Viet thieu doc/luyen doc.
- Tieng Viet thieu noi-nghe/viet/sua loi/nghia tu trong ngu canh.

## 10. Checker sau cho Tu nhien va Xa hoi, Khoa hoc, Lich su va Dia li

Da mo rong `subjectPedagogyIssues(...)` cho nhom kham pha - xa hoi:

- Tu nhien va Xa hoi:
  - Kiem tra quan sat tranh/vat that/mo hinh/moi truong gan gui.
  - Kiem tra mo ta, so sanh, phan loai theo tieu chi.
  - Kiem tra lien he hanh vi thuc te: an toan, ve sinh, cham soc ban than, bao ve moi truong.
- Khoa hoc:
  - Kiem tra cau hoi/van de kham pha va du doan.
  - Kiem tra quan sat/thi nghiem/thuc hanh co vat lieu, dung cu, an toan.
  - Kiem tra bang chung/ket qua va ket luan.
  - Kiem tra van dung vao suc khoe, moi truong, tiet kiem, doi song.
- Lich su va Dia li:
  - Kiem tra ban do/luoc do/tranh tu lieu/hinh anh/chu giai/ky hieu.
  - Kiem tra co truc phan tich Lich su hoac Dia li. Khong ep moi bai phai co ca hai neu bai nghieng mot nhanh.
  - Kiem tra lien he hien nay, dia phuong, di san, moi truong hoac trach nhiem hoc sinh.

## 11. Checker sau cho Dao duc va Hoat dong trai nghiem

- Dao duc:
  - Kiem tra tinh huong/cau chuyen/tranh/hanh vi cu the.
  - Kiem tra cam xuc, hau qua, lua chon hanh vi, ly do nen/khong nen.
  - Kiem tra thuc hanh: dong vai, xu li tinh huong, bay to y kien, thao luan.
  - Kiem tra cam ket/hanh dong nho sau bai hoc.
- Hoat dong trai nghiem:
  - Kiem tra trai nghiem ban dau: tro choi, tinh huong, nhiem vu, thu thach nhom.
  - Kiem tra chia se cam xuc, rut kinh nghiem, dieu hoc duoc.
  - Kiem tra cam ket/ke hoach hanh dong, tu danh gia/danh gia dong dang.
  - Kiem tra phan vai, hop tac nhom, quy tac an toan.

## 12. Checker sau cho Tin hoc

- Kiem tra thao tac/doi tuong so cu the: thiet bi, phan mem, tep, thu muc, chuot, ban phim.
- Kiem tra nhiem vu thuc hanh hoac san pham so co tieu chi.
- Kiem tra tu duy thuat toan/trinh tu thao tac/lenh.
- Kiem tra an toan so, thong tin ca nhan, nguon/ban quyen, ung xu van minh khi phu hop.

## 13. Checker sau cho Cong nghe

- Kiem tra nhu cau/van de cong nghe, cong dung hoac san pham.
- Kiem tra vat lieu, cong cu, quy trinh, buoc thuc hanh.
- Kiem tra an toan, tiet kiem vat lieu, ve sinh, phan cong vai tro.
- Kiem tra tieu chi danh gia, kiem tra/thu nghiem, cai tien san pham.

## 14. Checker sau cho Giao duc the chat

- Kiem tra khoi dong an toan va hoi tinh/tha long.
- Kiem tra lam mau, diem ky thuat, huong dan sua dong tac.
- Kiem tra doi hinh, cu ly/khoang cach, san bai, dung cu, an toan.
- Kiem tra tro choi van dong/luat choi gan voi ky nang chinh.

## 15. Checker sau cho Am nhac va Mi thuat

- Am nhac:
  - Kiem tra nghe/cam thu am nhac va cam xuc.
  - Kiem tra hat/luyen hat, cao do, truong do, tiet tau, nhip.
  - Kiem tra go dem, van dong, phu hoa, bieu dien.
  - Kiem tra sang tao, sac thai, phoi hop nhom, nhan xet bieu dien.
- Mi thuat:
  - Kiem tra quan sat/cam nhan tranh, san pham mau, do vat, hinh anh.
  - Kiem tra yeu to tao hinh: net, mau, hinh, bo cuc, dam nhat, chat lieu, ky thuat.
  - Kiem tra tao san pham/phac y tuong bang vat lieu/ky thuat cu the.
  - Kiem tra trung bay, gioi thieu, nhan xet san pham, tieu chi danh gia y tuong/ky thuat.

## 16. Pedagogy Audit object

Da them kieu `PedagogyAudit` trong `src/types/lesson.ts`.

Audit gom:

- `subject`, `grade`
- `status`: `passed`, `repaired`, `needs-review`
- `issues`: cac loi su pham theo mon con phat hien duoc sau generate/repair
- `checks`: checklist chat luong lay tu Pedagogy Profile cua mon
- `repairApplied`: co goi repair va dung ban repaired hay khong
- `checkedAt`: thoi diem kiem tra

## 17. API generate tra ve audit

`/api/lesson/generate` da tra them `pedagogyAudit`.

Sau khi generate/repair, server goi `buildPedagogyAudit(...)` de tao audit tu bai da normalize. Neu con loi, `status = needs-review`; neu repair thanh cong va khong con loi, `status = repaired`; neu khong can repair va dat, `status = passed`.

## 18. UI hien checklist su pham theo mon

Da them `PedagogyAuditCard` trong `src/app/page.tsx`.

Sau khi tao giao an, UI hien mot the nho o vung preview:

- Dat checklist mon hoc
- Da tu repair theo mon
- Can xem lai

Neu con loi, UI liet ke toi da 4 loi dau tien. Neu dat, UI nhac giao vien van nen doc lai truoc khi day that. Co the mo `Xem checklist mon hoc` de xem cac muc checklist cua profile.

## 19. Log debug repair/audit

Server da log:

- Luc bat dau repair: so activity, structuralIssues, qualityIssues, subjectPedagogyIssues.
- Luc hoan tat generate: status audit, repairApplied, issueCount, subject, grade.

Muc dich: khi user bao giao an chua on, co the xem terminal de biet checker da phat hien gi va co repair hay khong.

## 20. Ket thuc Pedagogy Engine V1

Trang thai V1 hien tai:

- Co danh muc mon/lop dung pham vi user dua.
- Co Pedagogy Profile cho du mon.
- Prompt generate va repair deu dung profile theo mon/lop.
- Checker co tin hieu toi thieu va checker sau theo tung nhom mon.
- Repair nhan loi su pham theo mon cu the.
- UI hien audit/checklist sau khi tao giao an.
- TypeScript va production build da pass.
