"use client";

import { useEffect, useState } from "react";
import type { TaphuanTextbook } from "@/lib/taphuan-catalog";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  book: TaphuanTextbook;
  remainingSlots: number;
  onPagesSelected: (files: File[]) => Promise<void>;
};

export function parsePageRange(input: string, maxPages: number): number[] {
  const cleaned = input.trim();
  if (!cleaned) return [];

  const results: number[] = [];
  const parts = cleaned.split(/[,;\s]+/);

  for (const part of parts) {
    if (!part) continue;
    if (part.includes("-")) {
      const [startStr, endStr] = part.split("-");
      const start = Number.parseInt(startStr, 10);
      const end = Number.parseInt(endStr, 10);
      if (!Number.isNaN(start) && !Number.isNaN(end) && start > 0 && end >= start) {
        for (let i = start; i <= Math.min(end, maxPages); i += 1) {
          if (!results.includes(i)) results.push(i);
        }
      }
    } else {
      const page = Number.parseInt(part, 10);
      if (!Number.isNaN(page) && page > 0 && page <= maxPages) {
        if (!results.includes(page)) results.push(page);
      }
    }
  }

  return results.sort((a, b) => a - b);
}

export function TaphuanPagePickerModal({
  isOpen,
  onClose,
  book,
  remainingSlots,
  onPagesSelected,
}: Props) {
  const [totalPages, setTotalPages] = useState<number | null>(null);
  const [isLoadingBook, setIsLoadingBook] = useState(false);
  const [bookError, setBookError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedPages, setSelectedPages] = useState<number[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setIsLoadingBook(true);
    setBookError("");
    setSubmitError("");
    setSelectedPages([]);
    setCurrentPage(1);
    setSearchQuery("");

    async function loadPages() {
      try {
        const res = await fetch(`/api/taphuan/pages?bookKey=${encodeURIComponent(book.key)}`);
        const data = (await res.json()) as { totalPages?: number; error?: string };
        if (!res.ok || !data.totalPages) {
          throw new Error(data.error || "Không thể tải danh mục trang SGK từ taphuan.nxbgd.vn");
        }
        if (isMounted) {
          setTotalPages(data.totalPages);
        }
      } catch (err) {
        if (isMounted) {
          setBookError(err instanceof Error ? err.message : "Lỗi kết nối tới taphuan.nxbgd.vn");
        }
      } finally {
        if (isMounted) {
          setIsLoadingBook(false);
        }
      }
    }

    void loadPages();

    return () => {
      isMounted = false;
    };
  }, [isOpen, book.key]);

  if (!isOpen) return null;

  function togglePage(page: number) {
    if (selectedPages.includes(page)) {
      setSelectedPages((prev) => prev.filter((p) => p !== page));
    } else {
      if (selectedPages.length >= remainingSlots) {
        setSubmitError(`Mỗi lần tạo chỉ dùng tối đa 10 ảnh. Bạn chỉ còn ${remainingSlots} slot.`);
        return;
      }
      setSubmitError("");
      setSelectedPages((prev) => [...prev, page].sort((a, b) => a - b));
    }
  }

  function handleQuickSearch() {
    if (!totalPages || !searchQuery.trim()) return;
    const parsed = parsePageRange(searchQuery, totalPages);
    if (parsed.length === 0) {
      setSubmitError(`Vui lòng nhập số trang từ 1 đến ${totalPages}.`);
      return;
    }
    setSubmitError("");
    setCurrentPage(parsed[0]);

    if (parsed.length > 1) {
      const availableCount = remainingSlots;
      const pagesToAdd = parsed.slice(0, availableCount);
      setSelectedPages((prev) => {
        const combined = Array.from(new Set([...prev, ...pagesToAdd])).sort((a, b) => a - b);
        return combined.slice(0, availableCount);
      });
      if (parsed.length > availableCount) {
        setSubmitError(`Đã chọn tối đa ${availableCount} trang theo giới hạn còn lại.`);
      }
    }
  }

  async function handleConfirm() {
    if (selectedPages.length === 0) return;
    setIsSubmitting(true);
    setSubmitError("");

    try {
      const files: File[] = [];
      for (const page of selectedPages) {
        const imgUrl = `/api/taphuan/page-image?bookKey=${encodeURIComponent(book.key)}&page=${page}`;
        const res = await fetch(imgUrl);
        if (!res.ok) {
          throw new Error(`Không thể tải trang ${page} từ taphuan.nxbgd.vn (HTTP ${res.status})`);
        }
        const blob = await res.blob();
        const fileName = `${book.title} - Trang ${page}.png`;
        const file = new File([blob], fileName, { type: "image/png", lastModified: Date.now() });
        files.push(file);
      }

      await onPagesSelected(files);
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Lỗi khi nạp ảnh trang SGK.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const isCurrentSelected = selectedPages.includes(currentPage);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in"
    >
      <div className="flex flex-col w-full max-w-2xl max-h-[92vh] overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-900/10">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4 bg-slate-50/80">
          <div>
            <span className="inline-block rounded-md bg-brand-50 px-2 py-0.5 text-[11px] font-bold text-brand-700">
              Bộ sách Thống nhất
            </span>
            <h2 id="modal-title" className="mt-1 text-base sm:text-lg font-bold text-slate-900">
              Chọn trang SGK bài dạy
            </h2>
            <p className="mt-0.5 text-[12px] text-slate-500 line-clamp-1">
              {book.title} &bull; Nguồn: {book.source}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Đóng"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors active:scale-95 disabled:opacity-50"
          >
            <span className="text-xl font-bold leading-none">&times;</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {isLoadingBook ? (
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
              <p className="text-sm font-medium text-slate-600">
                Đang kết nối reader taphuan.nxbgd.vn...
              </p>
            </div>
          ) : bookError ? (
            <div className="rounded-xl border border-red-200 bg-red-50/70 p-4 text-center">
              <p className="text-sm font-semibold text-red-700">{bookError}</p>
              <button
                type="button"
                onClick={() => {
                  setBookError("");
                  setIsLoadingBook(true);
                }}
                className="mt-3 inline-flex min-h-[44px] items-center justify-center rounded-xl bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50"
              >
                Thử lại
              </button>
            </div>
          ) : totalPages ? (
            <>
              {/* Search / Jump Bar */}
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleQuickSearch()}
                    placeholder={`Nhập số trang hoặc dải (ví dụ: 156 hoặc 156-157)...`}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleQuickSearch}
                  className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-slate-100 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-200 active:scale-[0.98] transition-colors"
                >
                  Xem & Chọn trang
                </button>
              </div>

              {/* Page Preview Box */}
              <div className="flex flex-col items-center rounded-2xl border border-slate-100 bg-slate-50/60 p-3 sm:p-4">
                <div className="relative flex items-center justify-center w-full min-h-[260px] max-h-[380px] overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-900/5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    key={currentPage}
                    src={`/api/taphuan/page-image?bookKey=${encodeURIComponent(book.key)}&page=${currentPage}`}
                    alt={`Trang ${currentPage} - ${book.title}`}
                    className="max-h-[380px] w-auto object-contain transition-opacity duration-200"
                    loading="lazy"
                  />
                  {isCurrentSelected ? (
                    <div className="absolute top-2 right-2 rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white shadow-md flex items-center gap-1">
                      <span>✓ Đã chọn</span>
                    </div>
                  ) : null}
                </div>

                {/* Page Navigation Controls */}
                <div className="mt-3 flex w-full items-center justify-between gap-2">
                  <button
                    type="button"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 active:scale-95 disabled:opacity-40"
                  >
                    &larr; Trang trước
                  </button>

                  <div className="text-center">
                    <span className="text-sm font-bold text-slate-800 tabular-nums font-mono">
                      Trang {currentPage} / {totalPages}
                    </span>
                  </div>

                  <button
                    type="button"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 active:scale-95 disabled:opacity-40"
                  >
                    Trang sau &rarr;
                  </button>
                </div>

                {/* Toggle Current Page Button */}
                <div className="mt-2.5 w-full">
                  <button
                    type="button"
                    onClick={() => togglePage(currentPage)}
                    className={`w-full inline-flex min-h-[44px] items-center justify-center rounded-xl py-2.5 px-4 text-xs font-bold transition-all active:scale-[0.98] ${
                      isCurrentSelected
                        ? "bg-red-50 text-red-600 border border-red-200 hover:bg-red-100"
                        : "bg-brand-600 text-white shadow-sm hover:bg-brand-700 shadow-brand-500/20"
                    }`}
                  >
                    {isCurrentSelected ? `✕ Bỏ chọn trang ${currentPage}` : `+ Chọn trang ${currentPage}`}
                  </button>
                </div>
              </div>

              {/* Selected Pages Tray */}
              <div className="rounded-xl border border-slate-100 bg-white p-3 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-600 font-medium">
                  <span>
                    Các trang đã chọn: <strong>{selectedPages.length}</strong> (còn trống {Math.max(0, remainingSlots - selectedPages.length)} slot)
                  </span>
                  {selectedPages.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => setSelectedPages([])}
                      className="text-[11px] text-red-500 hover:underline"
                    >
                      Xóa tất cả
                    </button>
                  ) : null}
                </div>

                {selectedPages.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">
                    Chưa chọn trang nào. Nhập số trang ở trên hoặc duyệt qua các trang để chọn.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedPages.map((page) => (
                      <span
                        key={page}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700 border border-brand-100"
                      >
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={() => setCurrentPage(page)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setCurrentPage(page);
                            }
                          }}
                          className="cursor-pointer hover:underline"
                        >
                          Trang {page}
                        </span>
                        <button
                          type="button"
                          onClick={() => togglePage(page)}
                          className="text-brand-400 hover:text-red-500 font-bold ml-0.5"
                          title="Bỏ chọn"
                        >
                          &times;
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : null}

          {/* Inline Feedback / Warning */}
          {submitError ? (
            <p className="text-xs font-medium text-red-600 animate-slide-up">{submitError}</p>
          ) : null}

          {/* Copyright Note */}
          <div className="rounded-xl bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-500">
            <span className="font-semibold text-slate-700">Nguồn dữ liệu:</span> {book.source}.{" "}
            Bản quyền SGK thuộc về <strong>{book.copyright}</strong>. Phục vụ mục đích soạn giáo án cá nhân của giáo viên theo quy định.
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/80 px-5 py-3.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-200/60 active:scale-95 transition-colors disabled:opacity-50"
          >
            Hủy
          </button>
          <button
            type="button"
            disabled={selectedPages.length === 0 || isSubmitting}
            onClick={handleConfirm}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-brand-700 active:scale-[0.98] shadow-brand-500/20 transition-all disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                <span>Đang nạp ảnh SGK...</span>
              </>
            ) : (
              <span>Nạp {selectedPages.length} trang vào bài dạy</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
