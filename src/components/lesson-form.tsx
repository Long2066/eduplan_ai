"use client";

import { useRef, useState } from "react";

import {
  bookVolumeOptions,
  bookOptions,
  facilityOptions,
  gradeOptions,
  hometownProvinceOptions,
  subjectOptions,
  subjectOptionsByGrade,
  studentProfileOptions,
  styleOptions,
  subjectSupportsBookVolume,
  teachingEnvironmentOptions,
} from "@/lib/defaults";
import type { FormErrors, LessonInput, UploadedAsset } from "@/types/lesson";

type LessonFormProps = {
  input: LessonInput;
  errors: FormErrors;
  isGenerating: boolean;
  onChange: (next: LessonInput) => void;
  onGenerate: () => void;
};

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1.5 text-xs font-medium text-red-600 animate-slide-up">{message}</p>;
}

function Label({ children, required, className = "" }: { children: React.ReactNode; required?: boolean; className?: string }) {
  return (
    <label className={`mb-1.5 block text-[13px] font-semibold leading-5 text-slate-600 ${className}`}>
      {children} {required ? <span className="text-red-500">*</span> : null}
    </label>
  );
}

function FormGroup({ step, title, description, children }: { step: string; title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="group rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition-all duration-300 hover:border-brand-200/60 hover:shadow-md">
      <div className="mb-3.5 flex gap-3 border-b border-slate-100 pb-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-xs font-bold text-white shadow-sm">
          {step}
        </div>
        <div>
          <h2 className="text-[15px] font-bold text-slate-900">{title}</h2>
          <p className="text-[12px] leading-5 text-slate-400">{description}</p>
        </div>
      </div>
      <div className="space-y-3.5">{children}</div>
    </div>
  );
}

export function LessonForm({ input, errors, isGenerating, onChange, onGenerate }: LessonFormProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [advancedDraft, setAdvancedDraft] = useState<LessonInput | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const uploadBoxRef = useRef<HTMLDivElement | null>(null);
  const advancedInput = advancedDraft || input;
  const advancedSelectedFacilities = advancedInput.facilities === "auto" ? [] : advancedInput.facilities;
  const selectedSubjectHasVolumes = subjectSupportsBookVolume(input.subject);
  const currentGradeSubjects = gradeOptions.includes(input.grade as (typeof gradeOptions)[number])
    ? subjectOptionsByGrade[input.grade as (typeof gradeOptions)[number]]
    : subjectOptions;

  function patch(next: Partial<LessonInput>) {
    onChange({ ...input, ...next });
  }

  function changeGrade(grade: string) {
    const nextSubjects = gradeOptions.includes(grade as (typeof gradeOptions)[number])
      ? subjectOptionsByGrade[grade as (typeof gradeOptions)[number]]
      : subjectOptions;
    patch({
      grade,
      subject: nextSubjects.includes(input.subject) ? input.subject : "",
      bookVolume: "auto",
    });
  }

  function cloneInput(value: LessonInput): LessonInput {
    return JSON.parse(JSON.stringify(value)) as LessonInput;
  }

  function patchAdvanced(next: Partial<LessonInput>) {
    setAdvancedDraft((current) => ({ ...(current || cloneInput(input)), ...next }));
  }

  function openAdvanced() {
    setAdvancedDraft(cloneInput(input));
    setShowAdvanced(true);
  }

  function cancelAdvanced() {
    setAdvancedDraft(null);
    setShowAdvanced(false);
  }

  function saveAdvanced() {
    if (advancedDraft) onChange(advancedDraft);
    setAdvancedDraft(null);
    setShowAdvanced(false);
  }

  function toggleAdvancedFacility(value: string) {
    const current = advancedInput.facilities === "auto" ? [] : advancedInput.facilities;
    const exists = current.includes(value);
    patchAdvanced({ facilities: exists ? current.filter((item) => item !== value) : [...current, value] });
  }

  function isSupportedImage(file: File) {
    const name = file.name.toLowerCase();
    return file.type === "image/jpeg" || file.type === "image/png" || name.endsWith(".jpg") || name.endsWith(".jpeg") || name.endsWith(".jfif") || name.endsWith(".png");
  }

  function readFileAsDataUrl(file: File) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  async function createAsset(file: File, index: number, order: number): Promise<UploadedAsset> {
    const fallbackName = `Ảnh dán từ clipboard ${order}`;
    const dataUrl = await readFileAsDataUrl(file);

    return {
      id: `${Date.now()}-${index}-${file.name || fallbackName}`,
      name: file.name || fallbackName,
      type: "image",
      order,
      previewUrl: dataUrl,
      dataUrl,
      mimeType: file.type || (file.name.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg"),
    };
  }

  async function addFiles(files: FileList | File[]) {
    const selectedFiles = Array.from(files);
    if (!selectedFiles.length) return;

    const supportedFiles = selectedFiles.filter(isSupportedImage);
    if (!supportedFiles.length) {
      setUploadError("File chưa đúng định dạng. Vui lòng chọn ảnh JPG, JPEG, JFIF hoặc PNG.");
      return;
    }

    setUploadError(supportedFiles.length < selectedFiles.length ? "Đã bỏ qua file không phải JPG/PNG." : "");
    const lastOrder = input.uploadedAssets.reduce((max, asset, index) => Math.max(max, asset.order ?? index + 1), 0);
    const assets = await Promise.all(supportedFiles.map((file, index) => createAsset(file, index, lastOrder + index + 1)));
    if (!assets.length) return;
    patch({ uploadedAssets: [...input.uploadedAssets, ...assets] });
  }

  function handleFileInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    void addFiles(event.target.files || []);
    event.target.value = "";
  }

  function removeAsset(asset: UploadedAsset) {
    patch({ uploadedAssets: input.uploadedAssets.filter((item) => item.id !== asset.id) });
  }

  function handlePaste(event: React.ClipboardEvent<HTMLDivElement>) {
    const files = Array.from(event.clipboardData.files).filter(isSupportedImage);
    if (!files.length) return;
    event.preventDefault();
    void addFiles(files);
  }

  function handleDragOver(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragActive(true);
  }

  function handleDragLeave(event: React.DragEvent<HTMLDivElement>) {
    if (!event.currentTarget.contains(event.relatedTarget as Node)) {
      setIsDragActive(false);
    }
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragActive(false);
    void addFiles(event.dataTransfer.files);
  }

  return (
    <section className="flex h-full min-h-0 flex-col rounded-2xl border border-slate-100 bg-white/95 shadow-sm">
      <div className="min-h-0 flex-1 overflow-y-auto p-4 pb-3">
        {/* Form header */}
        <div className="mb-4 rounded-2xl border border-slate-100 bg-gradient-to-br from-brand-50/80 via-surface-50 to-mint-50/30 p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-500">EduPlan AI</p>
          <h1 className="mt-1.5 text-xl font-extrabold text-slate-900">Tạo giáo án CV2345</h1>
          <p className="mt-1.5 text-[13px] leading-5 text-slate-500">
            Nhập thông tin ngắn gọn, upload ảnh SGK, AI sẽ dựng giáo án đẹp và đúng cấu trúc.
          </p>
        </div>

        <div className="space-y-3.5">
          {/* ── GROUP 1: Thông tin bài học ── */}
          <FormGroup step="1" title="Thông tin bài học" description="Những dữ liệu tối thiểu để AI xác định đúng bài, lớp và bộ sách.">
            <div className="grid gap-3.5 sm:grid-cols-2">
              <div>
                <Label required>Môn học</Label>
                <select className="input-field" value={input.subject} onChange={(event) => patch({ subject: event.target.value, bookVolume: "auto" })}>
                  <option value="">Chọn môn học</option>
                  {currentGradeSubjects.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                <FieldError message={errors.subject} />
              </div>
              <div>
                <Label required>Lớp</Label>
                <select className="input-field" value={input.grade} onChange={(event) => changeGrade(event.target.value)}>
                  <option value="">Chọn lớp</option>
                  {gradeOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                <FieldError message={errors.grade} />
              </div>
            </div>

            <div>
              <Label>Tên bài</Label>
              <input className="input-field" value={input.lessonTitle} onChange={(event) => patch({ lessonTitle: event.target.value })} placeholder="Tự nhận diện nếu để trống" />
              <FieldError message={errors.lessonTitle} />
            </div>

            <div className="grid gap-3.5 sm:grid-cols-3">
              <div>
                <Label>Bộ sách</Label>
                <select className="input-field" value={input.book} onChange={(event) => patch({ book: event.target.value })}>
                  <option value="">Chọn bộ sách</option>
                  {bookOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                <FieldError message={errors.book} />
              </div>
              <div>
                <Label>Tập sách</Label>
                <select
                  className="input-field"
                  disabled={!selectedSubjectHasVolumes}
                  value={selectedSubjectHasVolumes ? input.bookVolume : "auto"}
                  onChange={(event) => patch({ bookVolume: event.target.value === "Auto" ? "auto" : event.target.value })}
                >
                  {selectedSubjectHasVolumes ? (
                    bookVolumeOptions.map((option) => (
                      <option key={option} value={option === "Auto" ? "auto" : option}>
                        {option === "Auto" ? "Không xác định" : option}
                      </option>
                    ))
                  ) : (
                    <option value="auto">Không áp dụng</option>
                  )}
                </select>
                <p className="mt-1 text-[11px] leading-4 text-slate-400">Chỉ áp dụng với Toán và Tiếng Việt.</p>
              </div>
              <div>
                <Label required>Số tiết</Label>
                <input
                  className="input-field"
                  min={1}
                  type="number"
                  value={input.periods}
                  onChange={(event) => patch({ periods: Number(event.target.value) })}
                />
                <p className="mt-1 text-[11px] leading-4 text-slate-400">Mặc định 35 phút/tiết.</p>
                <FieldError message={errors.periods} />
              </div>
            </div>
          </FormGroup>

          {/* ── GROUP 2: Nội dung đầu vào ── */}
          <FormGroup step="2" title="Nội dung đầu vào" description="Upload hoặc dán ảnh SGK định dạng JPG/PNG để AI lấy nội dung bài học và yêu cầu cần đạt.">
            <div
              className={`rounded-2xl border-2 border-dashed p-4 outline-none transition-all duration-300 focus-within:border-brand-400 focus-within:ring-4 focus-within:ring-brand-50 ${
                isDragActive
                  ? "scale-[1.01] border-brand-500 bg-brand-50/60 shadow-glow"
                  : "border-slate-200 bg-surface-50 hover:border-brand-300 hover:bg-brand-50/20"
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onPaste={handlePaste}
              tabIndex={0}
            >
              <Label required>Ảnh SGK bài học</Label>
              <div ref={uploadBoxRef} className="rounded-xl border border-slate-200 bg-white p-4 text-center shadow-sm" tabIndex={0}>
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-brand-50 to-brand-100 text-sm font-bold text-brand-600">
                  {isDragActive ? "Thả" : "SGK"}
                </div>
                <input
                  ref={uploadInputRef}
                  className="hidden"
                  type="file"
                  multiple
                  accept=".jpg,.jpeg,.jfif,.png,image/jpeg,image/png"
                  onChange={handleFileInputChange}
                />
                <div className="mt-3 flex flex-wrap justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => uploadInputRef.current?.click()}
                    className="btn-secondary px-4 py-2 text-[13px]"
                  >
                    Tải lên từ PC
                  </button>
                  <button
                    type="button"
                    onClick={() => uploadBoxRef.current?.focus()}
                    className="btn-ghost text-[13px]"
                  >
                    Dán
                  </button>
                </div>
                <p className="mt-2.5 text-[11px] leading-4 text-slate-400">Dán ảnh theo thứ tự trang; AI sẽ đọc theo số thứ tự hiển thị bên dưới.</p>
              </div>
              {input.uploadedAssets.length ? (
                <div className="mt-3.5 grid gap-3 sm:grid-cols-2">
                  {input.uploadedAssets.map((asset, index) => {
                    const displayOrder = asset.order ?? index + 1;
                    return (
                    <div key={asset.id} className="group overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md">
                      {asset.type === "image" && asset.previewUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={asset.previewUrl} alt={`Ảnh SGK ${displayOrder}: ${asset.name}`} className="h-32 w-full object-cover transition duration-300 group-hover:scale-[1.02]" />
                      ) : (
                        <div className="flex h-32 items-center justify-center bg-surface-50 text-sm font-bold text-slate-400">
                          <span className="rounded-xl bg-white px-3 py-2 shadow-sm">ẢNH</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between gap-2 p-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="shrink-0 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 px-2.5 py-0.5 text-[11px] font-bold text-white">#{displayOrder}</span>
                          <p className="min-w-0 truncate text-xs font-semibold text-slate-600" title={asset.name}>
                            {asset.name}
                          </p>
                        </div>
                        <button type="button" className="rounded-lg bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-500 transition hover:bg-red-100" onClick={() => removeAsset(asset)}>
                          Xóa
                        </button>
                      </div>
                    </div>
                    );
                  })}
                </div>
              ) : null}
              <FieldError message={uploadError || (input.uploadedAssets.length ? undefined : errors.uploadedAssets)} />
            </div>
          </FormGroup>

          {/* ── AI inference checkbox ── */}
          <label className="flex gap-3 rounded-2xl border border-mint-200/60 bg-mint-50/50 p-4 text-[13px] leading-5 text-slate-700 transition-all duration-200 hover:border-mint-300 hover:bg-mint-50/80 cursor-pointer">
            <input type="checkbox" className="mt-0.5 accent-brand-600" checked={input.allowAiInference} onChange={(event) => patch({ allowAiInference: event.target.checked })} />
            <span>
              <strong className="text-slate-800">Cho phép AI tự suy luận phần còn thiếu</strong>
              <br />
              <span className="text-slate-500">Nếu OCR không có yêu cầu cần đạt hoặc tên bài để trống, AI sẽ suy luận theo ảnh SGK, môn, lớp và bộ sách.</span>
            </span>
          </label>

          {/* ── Advanced toggle ── */}
          <button
            type="button"
            onClick={() => (showAdvanced ? cancelAdvanced() : openAdvanced())}
            className="flex w-full items-center justify-between rounded-2xl border border-slate-100 bg-white px-4 py-3 text-left text-[13px] font-bold text-slate-600 shadow-sm transition-all duration-200 hover:border-brand-200 hover:bg-brand-50/40 hover:text-brand-700"
          >
            <span>Tùy chọn nâng cao</span>
            <span className={`text-xs font-semibold transition-transform duration-300 ${showAdvanced ? "rotate-180" : ""}`}>
              {showAdvanced ? "▲ Đóng" : "▼ Mở rộng"}
            </span>
          </button>

          {/* ── Advanced panel ── */}
          {showAdvanced ? (
            <div className="animate-slide-up space-y-3.5 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <div className="rounded-xl bg-brand-50/60 p-3 text-[12px] leading-5 text-brand-700">
                Các mục này mặc định để Auto. Thay đổi trong phần này chỉ áp dụng sau khi bấm <strong>Lưu tùy chọn</strong>.
              </div>

              <div>
                <Label>Phong cách giáo án</Label>
                <select className="input-field" value={advancedInput.style} onChange={(event) => patchAdvanced({ style: event.target.value as LessonInput["style"] })}>
                  {styleOptions.map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </select>
                <p className="mt-2 text-xs leading-5 text-slate-400">
                  Cơ bản: gọn và đủ cấu trúc. Dạy thật trên lớp: thực tế, có kịch bản GV/HS. Sáng tạo, sinh động: thêm trò chơi, học liệu và kỹ thuật tổ chức hấp dẫn.
                </p>
              </div>

              <div className="grid gap-3.5 sm:grid-cols-2">
                <div>
                  <Label>Đối tượng học sinh</Label>
                  <select className="input-field" value={advancedInput.studentProfile} onChange={(event) => patchAdvanced({ studentProfile: event.target.value === "Auto" ? "auto" : event.target.value })}>
                    {studentProfileOptions.map((option) => (
                      <option key={option}>{option}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>Môi trường học</Label>
                  <select className="input-field" value={advancedInput.teachingEnvironment} onChange={(event) => patchAdvanced({ teachingEnvironment: event.target.value === "Auto" ? "auto" : event.target.value })}>
                    {teachingEnvironmentOptions.map((option) => (
                      <option key={option}>{option}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-3.5 sm:grid-cols-2">
                <div>
                  <Label>Quê hương / Tỉnh</Label>
                  <select className="input-field" value={advancedInput.hometownProvince} onChange={(event) => patchAdvanced({ hometownProvince: event.target.value === "Auto" ? "auto" : event.target.value })}>
                    <option value="auto">Auto</option>
                    {hometownProvinceOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>Ghi chú địa phương</Label>
                  <input
                    className="input-field"
                    value={advancedInput.localityNote}
                    onChange={(event) => patchAdvanced({ localityNote: event.target.value })}
                    placeholder="Xã/phường, làng nghề..."
                  />
                </div>
              </div>

              <div>
                <Label>Cơ sở vật chất</Label>
                <div className="mb-2.5 flex items-center gap-2.5 rounded-xl bg-surface-50 p-3">
                  <input id="facility-auto" type="checkbox" className="accent-brand-600" checked={advancedInput.facilities === "auto"} onChange={(event) => patchAdvanced({ facilities: event.target.checked ? "auto" : [] })} />
                  <label htmlFor="facility-auto" className="text-[13px] font-semibold text-slate-600">
                    Auto – để AI tự chọn theo bối cảnh
                  </label>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {facilityOptions.map((option) => (
                    <label key={option} className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-[12px] transition-all duration-200 cursor-pointer ${
                      advancedSelectedFacilities.includes(option)
                        ? "border-brand-300 bg-brand-50/50 text-brand-700 font-semibold"
                        : "border-slate-100 bg-white text-slate-600 hover:border-slate-200 hover:bg-surface-50"
                    } ${advancedInput.facilities === "auto" ? "opacity-40 pointer-events-none" : ""}`}>
                      <input type="checkbox" className="accent-brand-600" disabled={advancedInput.facilities === "auto"} checked={advancedSelectedFacilities.includes(option)} onChange={() => toggleAdvancedFacility(option)} />
                      {option}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <Label>Yêu cầu đặc biệt</Label>
                <textarea
                  className="input-field min-h-24 resize-y"
                  value={advancedInput.specialRequest}
                  onChange={(event) => patchAdvanced({ specialRequest: event.target.value })}
                  placeholder="Ví dụ: thêm trò chơi, tăng hoạt động nhóm, phù hợp lớp đông..."
                />
              </div>

              <div className="sticky bottom-0 z-10 -mx-4 -mb-4 flex flex-col gap-2 border-t border-slate-100 bg-white/95 p-3.5 backdrop-blur-sm sm:flex-row sm:justify-end">
                <button type="button" onClick={cancelAdvanced} className="btn-ghost">
                  Hủy
                </button>
                <button type="button" onClick={saveAdvanced} className="btn-primary">
                  Lưu tùy chọn
                </button>
              </div>
            </div>
          ) : null}

        </div>
      </div>

      {/* ── CTA Button ── */}
      <div className="shrink-0 px-4 pb-4 pt-3">
        <button
          type="button"
          onClick={onGenerate}
          disabled={isGenerating}
          className="group relative w-full overflow-hidden rounded-xl bg-gradient-to-r from-brand-700 via-brand-600 to-brand-700 px-5 py-4 text-base font-extrabold text-white shadow-btn-primary transition-all duration-300 hover:-translate-y-0.5 hover:shadow-btn-hover disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
        >
          {/* Shimmer effect */}
          <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-[1.5s] group-hover:translate-x-full" />
          <span className="relative flex items-center justify-center gap-3">
            {isGenerating ? (
              <>
                <span className="h-5 w-5 animate-spin rounded-full border-[2.5px] border-white/30 border-t-white" />
                AI đang soạn giáo án...
              </>
            ) : (
              <>Tạo giáo án ngay</>
            )}
          </span>
        </button>
      </div>
    </section>
  );
}
