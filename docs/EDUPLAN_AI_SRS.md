# EduPlan AI - Software Requirements Specification

## 1. Tong Quan

EduPlan AI la web app ho tro giao vien tao ke hoach bai day theo tinh than Cong van 2345/BGDDT-GDTH. He thong cho phep giao vien nhap thong tin bai hoc, tai anh SGK/PDF scan, xu ly OCR, sinh giao an bang AI, xem truoc tren web, chinh sua va xuat file DOCX/PDF voi dinh dang dep, on dinh.

Muc tieu cua ban MVP la tao duoc san pham demo dung that voi giao vien, uu tien chat luong noi dung giao an, giao dien dep, file xuat khong vo layout va de mo rong thanh san pham thuong mai.

## 2. Muc Tieu San Pham

- Xay web app giup giao vien tao ke hoach bai day dung khung CV2345.
- Sinh giao an co noi dung tu nhien, phu hop cap tieu hoc, khong may moc.
- Dau ra dep tren preview web va file DOCX/PDF.
- File tai ve giu format gan giong preview, khong vo bang, khong loi font tieng Viet.
- Cho phep tinh chinh nhanh: rut gon, chi tiet hon, thi giang, them nang luc so.
- Ho tro OCR anh SGK/PDF scan va cho nguoi dung ra soat truoc khi sinh giao an.
- Co quality guardrails de dam bao dau ra du 5 phan va bang 2 cot GV/HS.

## 3. Pham Vi MVP

### 3.1. Bat Buoc Co

- Form nhap thong tin bai hoc.
- Upload anh SGK/PDF scan.
- OCR tai lieu bang Gemini Vision.
- Hien thi text OCR de giao vien sua truoc khi tao giao an.
- Goi AI sinh giao an theo JSON schema chuan.
- Preview giao an dep voi mau sac, tieu de noi bat, bang 2 cot ro rang.
- Chinh sua noi dung truc tiep theo tung phan.
- Toolbar refine: tao lai hay hon, rut gon, chi tiet hon, them nang luc so, chuyen sang thi giang.
- Xuat DOCX.
- Xuat PDF.
- Copy toan bo noi dung.
- Luu nhap tu dong tren trinh duyet.
- Quan ly version noi dung da sinh.

### 3.2. Ngoai Pham Vi MVP

- Tai khoan nguoi dung va dong bo da thiet bi.
- Thu vien giao an dung chung toan truong.
- Mobile app native.
- Cham diem giao an bang rubric nang cao.
- He thong thanh toan.
- Phan quyen quan tri nhieu cap.

## 4. Doi Tuong Nguoi Dung

- Giao vien tieu hoc can tao giao an nhanh, dung mau.
- Sinh vien su pham can nop giao an cho giang vien.
- Giao vien can giao an thi giang/du gio co hinh thuc dep.
- Can bo chuyen mon muon tham khao mau ke hoach bai day.

## 5. Use Cases Chinh

### UC-01: Tao Giao An Tu Form

- Nguoi dung mo trang chinh.
- Nhap mon hoc, lop, ten bai, bo sach, so tiet, thoi luong.
- Nhap noi dung bai hoc, yeu cau can dat, doi tuong hoc sinh, boi canh giang day.
- Chon phong cach giao an.
- Bam `Tao giao an`.
- He thong validate input.
- He thong goi AI sinh giao an.
- He thong hien preview dep.

Dieu kien thanh cong:
- Giao an du 5 phan I-V.
- Co bang 2 cot: Hoat dong cua giao vien va Hoat dong cua hoc sinh.
- Noi dung phu hop boi canh day hoc da nhap.

### UC-02: Tao Giao An Tu Anh SGK/PDF Scan

- Nguoi dung upload anh/PDF.
- He thong OCR va tra text.
- Nguoi dung ra soat, sua text OCR neu can.
- Nguoi dung bam `Tao giao an`.
- He thong dung text OCR da xac nhan de sinh giao an.

Dieu kien thanh cong:
- He thong khong dung truc tiep OCR chua duoc hien thi cho nguoi dung.
- Neu OCR chat luong thap, he thong canh bao ro.

### UC-03: Tinh Chinh Giao An

- Nguoi dung co ban preview.
- Chon mot hanh dong refine: rut gon, chi tiet hon, thi giang, them nang luc so, tao lai hay hon.
- He thong gui JSON hien tai va yeu cau refine len AI.
- He thong tao version moi.
- Nguoi dung co the quay lai version cu.

Dieu kien thanh cong:
- Cau truc CV2345 khong bi mat sau refine.
- Bang 2 cot van dung dinh dang.

### UC-04: Chinh Sua Inline

- Nguoi dung click vao mot phan trong preview.
- Sua noi dung truc tiep.
- He thong cap nhat JSON noi dung.
- He thong autosave ban nhap.

Dieu kien thanh cong:
- Noi dung sua khong mat khi reload trang trong cung trinh duyet.
- File export lay theo noi dung da sua moi nhat.

### UC-05: Xuat DOCX/PDF

- Nguoi dung bam `Xuat Word` hoac `Xuat PDF`.
- He thong chay quality check truoc khi xuat.
- Neu pass, he thong tao file va tai ve.
- Neu fail, he thong hien canh bao va goi y sua.

Dieu kien thanh cong:
- DOCX/PDF giu font tieng Viet.
- Tieu de co mau nhan.
- Bang 2 cot khong vo layout tren A4.

## 6. Yeu Cau Chuc Nang

### FR-01: Form Nhap Lieu

Form can co cac truong:

- Mon hoc.
- Lop.
- Ten bai.
- Bo sach.
- So tiet.
- Thoi luong moi tiet.
- Noi dung bai hoc.
- Upload anh SGK/PDF scan.
- Yeu cau can dat.
- Doi tuong hoc sinh.
- Moi truong hoc: vung nui, nong thon, thanh pho, ban tru, diem truong le.
- Co so vat chat: day du, trung binh, thieu thiet bi, co may chieu, co internet, khong co internet.
- Phong cach giao an: chuan nop giang vien, day that tren lop, thi giang/du gio.
- Yeu cau dac biet.

### FR-02: Validate Du Lieu

Bat buoc validate cac truong:

- `subject`: khong rong.
- `grade`: khong rong.
- `lessonTitle`: khong rong.
- `periods`: so duong.
- `duration`: so duong.

He thong can hien loi gan voi tung truong, vi du: `Vui long nhap ten bai hoc`.

### FR-03: OCR Tai Lieu

- Chap nhan anh JPG, PNG, WEBP.
- Chap nhan PDF scan trong gioi han dung luong MVP.
- Goi Gemini Vision de trich xuat text.
- Tra ve text theo tung trang neu co nhieu trang.
- Hien thi OCR preview de nguoi dung sua.
- Canh bao neu text OCR co qua nhieu ky tu la hoac qua ngan.

### FR-04: Lam Sach OCR

- Goi model nano de sua loi OCR.
- Chi duoc chuan hoa dau cau, xuong dong, tu sai do OCR.
- Khong duoc tu them kien thuc moi.
- Tra ve text sach va danh dau phan khong chac chan neu co.

### FR-05: Sinh Giao An

- Goi model mini de sinh giao an mac dinh.
- Goi model full neu che do thi giang/demo cao cap hoac quality check fail 2 lan.
- Output bat buoc la JSON theo schema.
- Neu AI tra sai schema, he thong retry voi prompt sua cau truc.

### FR-06: Preview Dep

- Render giao an thanh layout co mau sac.
- Tieu de I-V co mau thuong hieu.
- Cac khoi quan trong co nen mau nhat.
- Bang GV/HS co header mau, border ro, spacing de doc.
- Ho tro chen hinh user upload vao cot GV neu hinh lien quan toi noi dung hoat dong.

### FR-07: Refine Noi Dung

He thong can ho tro cac refine action:

- `regenerate_better`: tao lai hay hon, tu nhien hon, dung boi canh hon.
- `shorten`: rut gon nhung giu du cau truc.
- `expand`: chi tiet hon, them cau hoi goi mo va san pham hoc tap.
- `add_digital_competency`: them nang luc so o muc phu hop.
- `convert_to_demo`: chuyen sang giao an thi giang/du gio.

### FR-08: Export DOCX

- Dung font Times New Roman.
- Co chu body mac dinh 13.
- Khoang cach sau doan 3pt.
- Tieu de phan co mau nhan.
- Bang 2 cot co do rong on dinh.
- Header bang co nen mau nhat.
- Khong de cot GV/HS bi lech qua trang mot cach kho doc.

### FR-09: Export PDF

- PDF render tu HTML/CSS cung style voi preview.
- Kho giay A4.
- Can le phu hop in an.
- Dong goi font tieng Viet.
- Giu mau tieu de va bang.

### FR-10: Autosave Va Version

- Tu dong luu form input.
- Tu dong luu lesson output moi nhat.
- Moi lan generate/refine tao mot version.
- Cho phep chon version cu de xem lai.

## 7. Yeu Cau Phi Chuc Nang

### NFR-01: Hieu Nang

- Thoi gian tu bam tao den preview trung binh duoi 60 giay.
- OCR anh don nen duoi 20 giay trong dieu kien binh thuong.
- UI khong bi treo khi dang goi AI.

### NFR-02: Do On Dinh

- Neu mot API loi, he thong hien thong bao ro va cho thu lai.
- Co timeout cho moi provider.
- Co retry co gioi han.

### NFR-03: Bao Mat

- API key chi nam o server.
- Khong dua key vao frontend.
- Khong log noi dung nhay cam khong can thiet.
- Gioi han upload va validate MIME type.
- Rate limit theo IP/session.

### NFR-04: Kha Nang Mo Rong

- Tach ro AI service, OCR service, export service.
- Routing model cau hinh duoc qua environment/config.
- Schema output co version.

### NFR-05: Kha Nang In An

- DOCX/PDF phai doc tot tren A4.
- Mau sac khong qua dam de tiet kiem muc in.
- Body text uu tien den/xam dam, tieu de dung mau nhan.

## 8. Kien Truc De Xuat

### 8.1. Stack

- Frontend: Next.js, TypeScript, Tailwind CSS, shadcn/ui.
- Backend MVP: Next.js API routes.
- OCR: Gemini 2.5 Flash Vision.
- AI: GPT nano/mini/full theo routing policy.
- DOCX: thu vien `docx`.
- PDF: Puppeteer render HTML.
- State local: localStorage/IndexedDB cho draft/version.

### 8.2. Thu Muc Du Kien

```text
src/
  app/
    page.tsx
    layout.tsx
    api/
      ocr/route.ts
      lesson/generate/route.ts
      lesson/refine/route.ts
      export/docx/route.ts
      export/pdf/route.ts
      quality-check/route.ts
  components/
    lesson-form.tsx
    lesson-preview.tsx
    preview-toolbar.tsx
    export-buttons.tsx
    quality-checklist.tsx
    ocr-review.tsx
  lib/
    prompts/cv2345.ts
    validators/lesson-schema.ts
    renderers/lesson-html.ts
    quality/lesson-quality-check.ts
    model-routing.ts
  services/
    ai-service.ts
    ocr-service.ts
    export-word.ts
    export-pdf.ts
  styles/
    theme.css
  types/
    lesson.ts
```

## 9. Model Routing Policy

### 9.1. OCR

- Provider: Gemini 2.5 Flash Vision.
- Input: anh/PDF.
- Output: text theo trang.

### 9.2. Clean OCR

- Model: GPT nano.
- Muc tieu: sua loi OCR, chuan hoa cau truc text.
- Cam: tu them noi dung, tu suy dien kien thuc.

### 9.3. Generate Lesson

- Model mac dinh: GPT mini.
- Model nang cao: GPT full.
- Dieu kien dung full: user chon thi giang/demo hoac output fail quality check 2 lan.

### 9.4. Refine

- Rut gon/viet lai cau chu: nano.
- Chi tiet hon/thi giang: mini hoac full tuy che do.
- Neu refine lam mat cau truc, retry bang mini/full.

## 10. Input Schema

```ts
export type LessonInput = {
  subject: string;
  grade: string;
  lessonTitle: string;
  book?: string;
  periods: number;
  duration: number;
  content?: string;
  ocrText?: string;
  requirements?: string;
  studentProfile?: string;
  teachingContext?: {
    area?: 'mountain' | 'rural' | 'urban' | 'boarding' | 'satellite_school' | 'other';
    facilities?: string[];
    notes?: string;
  };
  style: 'standard_submission' | 'real_classroom' | 'demo_contest';
  specialRequest?: string;
  uploadedAssets?: UploadedAsset[];
};

export type UploadedAsset = {
  id: string;
  name: string;
  type: 'image' | 'pdf';
  url?: string;
  extractedText?: string;
  pageNumber?: number;
};
```

## 11. Output Schema

```ts
export type LessonPlan = {
  schemaVersion: '1.0';
  generalInfo: {
    subject: string;
    grade: string;
    lessonTitle: string;
    periods: number;
    duration: number;
    book?: string;
  };
  outcomes: {
    generalCompetencies: string[];
    specificCompetencies: string[];
    qualities: string[];
    knowledgeAndSkills: string[];
  };
  materials: {
    teacher: string[];
    students: string[];
  };
  activities: LessonActivity[];
  assessment: {
    criteria: string[];
    evidence: string[];
    teacherComments: string[];
  };
  adjustments: {
    suitablePoints: string[];
    pointsToAdjust: string[];
    nextLessonDirection: string[];
  };
  contextFit: {
    teachingContextSummary: string;
    adaptationNotes: string[];
  };
  meta: {
    style: 'standard_submission' | 'real_classroom' | 'demo_contest';
    modelUsed: string;
    createdAt: string;
    qualityStatus: 'pass' | 'warning' | 'fail';
  };
};

export type LessonActivity = {
  phase: 'warm_up' | 'explore' | 'practice' | 'apply' | 'assessment';
  title: string;
  durationMinutes?: number;
  objective: string;
  teacherActions: string[];
  studentActions: string[];
  learningProducts?: string[];
  suggestedAssets?: string[];
};
```

## 12. API Noi Bo

### POST /api/ocr

Muc dich: OCR anh/PDF.

Input:
- Multipart file.

Output:
```json
{
  "pages": [
    { "pageNumber": 1, "text": "...", "confidence": 0.86 }
  ],
  "warnings": []
}
```

### POST /api/lesson/generate

Muc dich: sinh giao an moi.

Input:
- `LessonInput`.

Output:
- `LessonPlan`.

### POST /api/lesson/refine

Muc dich: tinh chinh giao an hien co.

Input:
```ts
{
  lesson: LessonPlan;
  action: 'regenerate_better' | 'shorten' | 'expand' | 'add_digital_competency' | 'convert_to_demo';
  note?: string;
}
```

Output:
- `LessonPlan` moi.

### POST /api/quality-check

Muc dich: kiem tra chat luong cau truc/noi dung.

Input:
- `LessonPlan`.

Output:
```ts
{
  status: 'pass' | 'warning' | 'fail';
  checks: Array<{
    id: string;
    label: string;
    status: 'pass' | 'warning' | 'fail';
    message?: string;
  }>;
}
```

### POST /api/export/docx

Muc dich: xuat file Word.

Input:
- `LessonPlan`.

Output:
- File `.docx`.

### POST /api/export/pdf

Muc dich: xuat file PDF.

Input:
- `LessonPlan` hoac HTML da render.

Output:
- File `.pdf`.

## 13. Quality Guardrails

He thong can kiem tra:

- Co du phan I. Thong tin chung.
- Co du phan II. Yeu cau can dat.
- Co du phan III. Do dung day hoc.
- Co du phan IV. Cac hoat dong day hoc chu yeu.
- Co du phan V. Dieu chinh sau bai day.
- Moi activity co `teacherActions` va `studentActions`.
- Bang hoat dong chi co 2 cot GV/HS khi render.
- Co it nhat cac pha: khoi dong, kham pha/hinh thanh kien thuc, luyen tap/thuc hanh, van dung, danh gia.
- Co danh gia hoc sinh ro tieu chi va minh chung.
- Co dieu chinh sau bai day.
- Co noi dung phu hop boi canh giang day.
- Khong qua chung chung.
- Khong mat dau tieng Viet nghiem trong.
- OCR khong co ty le ky tu loi qua cao.

Neu fail:
- Khong cho xuat file.
- Hien danh sach loi.
- Cho phep `Tu dong sua cau truc` bang AI.

## 14. Quy Tac Render Preview

### 14.1. Tong The

- Nen trang hoac xanh rat nhat.
- Container noi dung mau trang, bo goc nhe.
- Typography ro cap bac.
- Khoang cach giua cac phan thoang.

### 14.2. Mau Sac De Xuat

- Primary: xanh hoc thuat `#2563EB`.
- Accent: cam am `#F97316`.
- Success/Highlight: xanh la nhe `#10B981`.
- Nen highlight: `#EFF6FF`, `#FFF7ED`, `#ECFDF5`.
- Text chinh: `#111827`.
- Text phu: `#4B5563`.

### 14.3. Section

- Tieu de I-V dung primary.
- Co vien trai 4px mau primary/accent.
- Phan quan trong co nen mau nhat.
- Khong dung qua nhieu mau trong cung mot section.

### 14.4. Bang GV/HS

- Header nen primary nhat hoac xanh rat nhat.
- Chu header dam.
- Border xam nhat.
- Cot GV va HS moi cot 50%.
- Moi activity co title rieng truoc bang.
- Neu co hinh minh hoa, chen trong cot GV tai vi tri lien quan, kich thuoc vua phai.

## 15. Quy Tac Xuat DOCX

- Font mac dinh: Times New Roman.
- Co chu body: 13.
- Tieu de lon: 16, dam, mau primary.
- Tieu de phan: 14, dam, mau primary.
- Khoang cach sau doan: 3pt.
- Can le A4: tren 2cm, duoi 2cm, trai 2.5cm, phai 2cm.
- Bang GV/HS: 2 cot bang nhau.
- Header bang co nen xanh nhat.
- Border bang mau xam.
- Tranh tach dong header khoi noi dung neu co the.
- Footer: ten bai, lop, ngay tao.

Luu y: DOCX khong the dam bao giong pixel-perfect voi web nhu PDF. Muc tieu la giu nhan dien, mau sac, cau truc, bang va font on dinh.

## 16. Quy Tac Xuat PDF

- PDF phai bam sat preview web nhat.
- Render HTML bang CSS in an rieng.
- Kho giay A4.
- Dong goi font ho tro tieng Viet.
- Tranh ngat trang giua header activity va bang.
- Cho phep lap lai header bang khi bang dai qua trang neu kha thi.
- Mau sac can de in duoc, khong qua dam.

## 17. Prompt Strategy

### 17.1. Prompt Sinh Giao An

Prompt can ep model:

- Dong vai chuyen gia giao duc tieu hoc.
- Am hieu GDPT 2018 va Cong van 2345.
- Sinh theo JSON schema.
- Khong tra Markdown tu do.
- Hoat dong phai cu the, co loi dan/cau hoi goi mo/san pham hoc tap.
- Phu hop boi canh giang day: vung mien, co so vat chat, doi tuong hoc sinh.
- Tich hop nang luc so vua phai, khong guong ep.

### 17.2. Prompt Clean OCR

Prompt can ep model:

- Chi sua loi OCR.
- Khong them kien thuc.
- Giu nguyen y nghia.
- Danh dau phan nghi ngo bang ghi chu.

### 17.3. Prompt Refine

Prompt can ep model:

- Giu schema.
- Giu du 5 phan.
- Giu bang 2 cot.
- Chi thay doi theo action duoc yeu cau.

## 18. UI Screens

### 18.1. Main Screen

- Header: ten app, mo ta ngan, nut cai dat/API neu can.
- Left panel: form nhap lieu.
- Right panel: preview giao an.
- Sticky action bar: tao giao an, xuat file, copy.

### 18.2. OCR Review Modal/Panel

- Hien file da upload.
- Hien text OCR theo trang.
- Cho phep sua text.
- Nut `Dung noi dung nay de tao giao an`.

### 18.3. Preview Toolbar

- Tao lai hay hon.
- Rut gon.
- Chi tiet hon.
- Them nang luc so.
- Thi giang.
- Chon version.

### 18.4. Export Panel

- Xuat Word.
- Xuat PDF.
- Copy toan bo.
- Hien trang thai quality check truoc khi xuat.

## 19. Environment Variables

```env
OPENAI_API_KEY=
GEMINI_API_KEY=
NEXT_PUBLIC_APP_NAME=EduPlan AI
MAX_UPLOAD_MB=20
RATE_LIMIT_PER_MIN=10
DOCX_THEME_NAME=default-academic
AI_DEFAULT_GENERATE_MODEL=gpt-mini
AI_ADVANCED_GENERATE_MODEL=gpt-full
AI_CLEAN_MODEL=gpt-nano
OCR_MODEL=gemini-2.5-flash-vision
```

## 20. Logging Va Monitoring MVP

Can log:

- Request id.
- Endpoint.
- Provider/model.
- Latency.
- Ket qua pass/warning/fail.
- So lan retry.
- Loi ky thuat neu co.

Khong nen log:

- API key.
- File goc day du neu khong can.
- Thong tin ca nhan nhay cam.

## 21. Tieu Chi Nghiem Thu MVP

- Tao duoc giao an dung CV2345 cho toi thieu 10 case.
- 100% output co du 5 phan.
- 100% activity render bang 2 cot GV/HS.
- DOCX doc tot tren Microsoft Word.
- PDF giong preview web ve mau sac va bo cuc chinh.
- Khong loi font tieng Viet.
- Thoi gian tao preview trung binh duoi 60 giay.
- Co canh bao neu OCR kem chat luong.
- Co autosave form va version output.
- Pilot giao vien danh gia hai long toi thieu 80%.

## 22. Ke Hoach Trien Khai 6 Tuan

### Tuan 1

- Khoi tao project Next.js TypeScript.
- Cau hinh Tailwind, shadcn/ui.
- Xay design tokens.
- Xay LessonForm.
- Xay validate schema.
- Luu draft form local.

### Tuan 2

- Xay upload file.
- Tich hop Gemini Vision OCR.
- Xay OCR review.
- Xay clean OCR bang nano.
- Them canh bao OCR chat luong thap.

### Tuan 3

- Xay prompt CV2345.
- Xay aiService.
- Xay model routing.
- Sinh LessonPlan JSON.
- Xay quality check co ban.
- Render preview co ban.

### Tuan 4

- Hoan thien preview dep.
- Them inline edit.
- Them toolbar refine.
- Them version history.
- Them checklist chat luong.

### Tuan 5

- Xay export DOCX.
- Xay export PDF.
- Dong goi font tieng Viet.
- Test layout A4.
- Fix vo bang/ngat trang.

### Tuan 6

- Test 10 case mau.
- Toi uu prompt.
- Toi uu latency va retry.
- Sua bug.
- Chot ban demo pilot.

## 23. Cac Diem Can Duyet Tiep

- Duyet palette mau va style preview.
- Duyet JSON schema final.
- Duyet mau giao an preview.
- Duyet template DOCX/PDF.
- Duyet text prompt production.
- Duyet gioi han upload va chinh sach chi phi model.
