"use client";

import { useState } from "react";

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
import { assetPreviewUrl, optimizeLessonImage } from "@/lib/client-image-processing";
import { findTaphuanBook } from "@/lib/taphuan-catalog";
import { TaphuanPagePickerModal } from "./taphuan-page-picker-modal";
import type { FormErrors, LessonInput, UploadedAsset } from "@/types/lesson";

type LessonFormProps = {
  input: LessonInput;
  errors: FormErrors;
  isGenerating: boolean;
  generationUsageLabel: string;
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

export function LessonForm({ input, errors, isGenerating, generationUsageLabel, onChange, onGenerate }: LessonFormProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [advancedDraft, setAdvancedDraft] = useState<LessonInput | null>(null);
  const [uploadError, setUploadError] = useState("");
  const [isOptimizingImages, setIsOptimizingImages] = useState(false);
  const [isPagePickerOpen, setIsPagePickerOpen] = useState(false);
  const currentTaphuanBook = findTaphuanBook(input.grade, input.subject, input.bookVolume);
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

  async function createAsset(file: File, index: number, order: number): Promise<UploadedAsset> {
    const fallbackName = `Trang SGK ${order}`;
    const dataUrl = await optimizeLessonImage(file);

    return {
      id: `${Date.now()}-${index}-${file.name || fallbackName}`,
      name: file.name || fallbackName,
      type: "image",
      order,
      dataUrl,
      mimeType: "image/jpeg",
    };
  }

  async function addFiles(files: FileList | File[]) {
    const selectedFiles = Array.from(files);
    if (!selectedFiles.length || isOptimizingImages) return;

    const supportedFiles = selectedFiles.filter(isSupportedImage);
    if (!supportedFiles.length) {
      setUploadError("File chưa đúng định dạng. Vui lòng chọn ảnh JPG, JPEG, JFIF hoặc PNG.");
      return;
    }

    const remainingSlots = Math.max(0, 10 - input.uploadedAssets.length);
    if (!remainingSlots) {
      setUploadError("Mỗi lần tạo chỉ được dùng tối đa 10 ảnh SGK.");
      return;
    }

    const acceptedFiles = supportedFiles.slice(0, remainingSlots);
    const warnings: string[] = [];
    if (supportedFiles.length < selectedFiles.length) warnings.push("Đã bỏ qua file không phải JPG/PNG.");
    if (acceptedFiles.length < supportedFiles.length) warnings.push("Chỉ giữ tối đa 10 ảnh SGK.");
    setUploadError(warnings.join(" "));
    setIsOptimizingImages(true);
    try {
      const lastOrder = input.uploadedAssets.reduce((max, asset, index) => Math.max(max, asset.order ?? index + 1), 0);
      const assets: UploadedAsset[] = [];
      for (let index = 0; index < acceptedFiles.length; index += 1) {
        assets.push(await createAsset(acceptedFiles[index], index, lastOrder + index + 1));
      }
      if (assets.length) patch({ uploadedAssets: [...input.uploadedAssets, ...assets] });
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Không thể tối ưu ảnh SGK.");
    } finally {
      setIsOptimizingImages(false);
    }
  }

  function removeAsset(asset: UploadedAsset) {
    patch({ uploadedAssets: input.uploadedAssets.filter((item) => item.id !== asset.id) });
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
              <input
                className="input-field"
                value={input.lessonTitle}
                onChange={(event) => patch({ lessonTitle: event.target.value })}
                placeholder="Ví dụ: Bài 2. Ô nhiễm, xói mòn đất và bảo vệ môi trường đất"
              />
              <p className="mt-1 text-[11px] leading-4 text-slate-400">
                Có ảnh SGK: có thể để trống để OCR nhận diện. Không có ảnh: cần nhập tên bài cụ thể.
              </p>
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

          {/* ── GROUP 2: Trang SGK bài dạy ── */}
          <FormGroup step="2" title="Trang SGK bài dạy" description="Chọn trực tiếp các trang SGK từ kho học liệu taphuan.nxbgd.vn để AI bám sát nội dung bài học.">
            {/* ── Nguồn SGK online từ taphuan.nxbgd.vn ── */}
            {currentTaphuanBook ? (
              <div className="rounded-2xl border border-brand-200/90 bg-gradient-to-br from-brand-50/70 via-white to-surface-50 p-4 shadow-sm ring-1 ring-slate-900/5 transition-all">
                {/* Book header info */}
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="rounded-md bg-brand-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                      Bộ sách Thống nhất
                    </span>
                    <span className="text-[11px] font-semibold text-slate-500">
                      {currentTaphuanBook.grade} • {currentTaphuanBook.subject}
                      {currentTaphuanBook.volume ? ` (${currentTaphuanBook.volume})` : ""}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-slate-900 leading-snug">
                    {currentTaphuanBook.title}
                  </h3>

                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Nguồn: <span className="font-semibold text-slate-600">{currentTaphuanBook.source}</span> • Bản quyền: <span className="font-semibold text-slate-600">{currentTaphuanBook.copyright}</span>
                  </p>
                </div>

                {/* Actions */}
                <div className="mt-3.5 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => setIsPagePickerOpen(true)}
                    disabled={input.uploadedAssets.length >= 10 || isOptimizingImages}
                    className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm shadow-brand-500/25 transition-all hover:bg-brand-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                    <span>Chọn trang SGK bài dạy</span>
                    {input.uploadedAssets.length > 0 && (
                      <span className="rounded-full bg-white/25 px-2 py-0.5 text-[10px] font-extrabold text-white">
                        {input.uploadedAssets.length}/10
                      </span>
                    )}
                  </button>

                  <a
                    href={currentTaphuanBook.readerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm transition-all hover:border-slate-300 hover:bg-slate-50 active:scale-[0.98]"
                  >
                    <span>Mở reader NXBGDVN</span>
                    <span className="text-slate-400">↗</span>
                  </a>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-4 text-center">
                <p className="text-xs leading-relaxed text-slate-500">
                  💡 Chọn <strong>Lớp</strong> và <strong>Môn học</strong> ở trên để mở SGK trực tiếp từ <strong>taphuan.nxbgd.vn</strong>.
                </p>
              </div>
            )}

            {/* ── Danh sách trang đã chọn hoặc Empty State ── */}
            {input.uploadedAssets.length > 0 ? (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between px-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-800">Trang SGK đã chọn</span>
                    <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-bold text-brand-700">
                      {input.uploadedAssets.length}/10 trang
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => patch({ uploadedAssets: [] })}
                    className="text-[11px] font-semibold text-slate-500 hover:text-red-600 transition-colors"
                  >
                    Xóa tất cả
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  {input.uploadedAssets.map((asset, index) => {
                    const displayOrder = asset.order ?? index + 1;
                    return (
                      <div
                        key={asset.id}
                        className="group overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md"
                      >
                        {asset.type === "image" && assetPreviewUrl(asset) ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={assetPreviewUrl(asset)}
                            alt={`Trang SGK ${displayOrder}: ${asset.name}`}
                            className="h-28 w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                          />
                        ) : (
                          <div className="flex h-28 items-center justify-center bg-surface-50 text-xs font-bold text-slate-400">
                            <span className="rounded-lg bg-white px-2.5 py-1 shadow-sm">ẢNH</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between gap-1.5 p-2.5">
                          <div className="flex min-w-0 items-center gap-1.5">
                            <span className="shrink-0 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 px-2 py-0.5 text-[10px] font-bold text-white">
                              #{displayOrder}
                            </span>
                            <p className="min-w-0 truncate text-[11px] font-semibold text-slate-600" title={asset.name}>
                              {asset.name}
                            </p>
                          </div>
                          <button
                            type="button"
                            className="shrink-0 rounded-lg bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-500 transition hover:bg-red-100"
                            onClick={() => removeAsset(asset)}
                          >
                            Xóa
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-4 text-center">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                  </svg>
                </div>
                <p className="mt-2 text-xs font-semibold text-slate-700">Chưa chọn trang SGK nào</p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-slate-400">
                  Bấm <strong>&ldquo;Chọn trang SGK bài dạy&rdquo;</strong> ở trên để chọn các trang bài học trực tiếp từ sách điện tử.
                </p>
                <p className="mt-1 text-[10px] text-slate-400">
                  (Không bắt buộc nếu đã nhập Tên bài cụ thể ở Bước 1)
                </p>
              </div>
            )}

            {isOptimizingImages ? (
              <p className="text-xs font-semibold text-brand-600 animate-pulse">
                Đang tối ưu ảnh SGK để nạp vào bài dạy...
              </p>
            ) : null}

            <FieldError message={uploadError || (input.uploadedAssets.length ? undefined : errors.uploadedAssets)} />
          </FormGroup>

          {/* ── AI inference checkbox ── */}
          <label className="flex gap-3 rounded-2xl border border-mint-200/60 bg-mint-50/50 p-4 text-[13px] leading-5 text-slate-700 transition-all duration-200 hover:border-mint-300 hover:bg-mint-50/80 cursor-pointer">
            <input type="checkbox" className="mt-0.5 accent-brand-600" checked={input.allowAiInference} onChange={(event) => patch({ allowAiInference: event.target.checked })} />
            <span>
              <strong className="text-slate-800">Cho phép AI tự suy luận phần còn thiếu</strong>
              <br />
              <span className="text-slate-500">Nếu OCR không có yêu cầu cần đạt, AI sẽ suy luận phần đó theo nội dung ảnh SGK, môn, lớp và bộ sách; tên bài vẫn phải được nhận diện rõ hoặc do bạn nhập.</span>
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

              {/* Checkbox Năng lực số */}
              <label className="flex gap-3 rounded-xl border border-brand-100 bg-brand-50/20 p-3 text-[12px] leading-5 text-slate-700 transition-all duration-200 hover:border-brand-200 cursor-pointer">
                <input type="checkbox" className="mt-0.5 accent-brand-600 shrink-0" checked={!!advancedInput.enableDigitalCompetency} onChange={(event) => patchAdvanced({ enableDigitalCompetency: event.target.checked })} />
                <span>
                  <strong className="text-slate-800">Tích hợp Năng lực số (TT 02/2025/TT-BGDĐT)</strong>
                  <br />
                  <span className="text-slate-500">Tự động chèn Yêu cầu cần đạt về năng lực số Bậc 1 phù hợp với môn học và nội dung bài.</span>
                </span>
              </label>

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
          disabled={isGenerating || isOptimizingImages}
          className="group relative w-full overflow-hidden rounded-xl bg-gradient-to-r from-brand-700 via-brand-600 to-brand-700 px-5 py-4 text-base font-extrabold text-white shadow-btn-primary transition-all duration-300 hover:-translate-y-0.5 hover:shadow-btn-hover disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
        >
          {/* Shimmer effect */}
          <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-[1.5s] group-hover:translate-x-full" />
          <span className="relative flex items-center justify-center gap-3">
            {isGenerating || isOptimizingImages ? (
              <>
                <span className="h-5 w-5 animate-spin rounded-full border-[2.5px] border-white/30 border-t-white" />
                {isGenerating ? "AI đang soạn giáo án..." : "Đang tối ưu ảnh SGK..."}
              </>
            ) : (
              <span className="flex flex-col items-center leading-tight">
                <span>Tạo giáo án ngay</span>
                <span className="mt-1 text-[11px] font-semibold text-white/80">
                  {generationUsageLabel}
                </span>
              </span>
            )}
          </span>
        </button>
      </div>

      {currentTaphuanBook && isPagePickerOpen ? (
        <TaphuanPagePickerModal
          isOpen={isPagePickerOpen}
          onClose={() => setIsPagePickerOpen(false)}
          book={currentTaphuanBook}
          remainingSlots={Math.max(0, 10 - input.uploadedAssets.length)}
          onPagesSelected={async (files) => {
            await addFiles(files);
          }}
        />
      ) : null}
    </section>
  );
}
