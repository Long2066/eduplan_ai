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

  // Keyboard navigation for page flipping (ArrowLeft / ArrowRight)
  useEffect(() => {
    if (!isOpen || !totalPages) return;
    const maxPage = totalPages;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setCurrentPage((p) => Math.max(1, p - 1));
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setCurrentPage((p) => Math.min(maxPage, p + 1));
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, totalPages]);

  const isCurrentSelected = selectedPages.includes(currentPage);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in"
    >
      <div className="flex flex-col w-full max-w-6xl h-[94vh] max-h-[96vh] overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-900/10">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-4 sm:px-6 py-3.5 bg-slate-50/90 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-block rounded-md bg-brand-50 px-2 py-0.5 text-[11px] font-bold text-brand-700">
                Bộ sách Thống nhất
              </span>
              <span className="hidden sm:inline-block text-[11px] font-medium text-slate-400">
                • Dùng phím ← / → để lật trang
              </span>
            </div>
            <h2 id="modal-title" className="mt-0.5 text-base sm:text-lg font-bold text-slate-900">
              Chọn trang SGK bài dạy
            </h2>
            <p className="text-[12px] text-slate-500 line-clamp-1">
              {book.title} &bull; Nguồn: {book.source}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Đóng"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 transition-colors active:scale-95 disabled:opacity-50"
          >
            <span className="text-2xl font-bold leading-none">&times;</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {isLoadingBook ? (
            <div className="flex flex-col items-center justify-center h-full py-16 text-center space-y-3">
              <div className="h-9 w-9 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
              <p className="text-sm font-semibold text-slate-600">
                Đang kết nối kho SGK số hóa taphuan.nxbgd.vn...
              </p>
            </div>
          ) : bookError ? (
            <div className="flex flex-col items-center justify-center h-full p-6 text-center">
              <div className="max-w-md rounded-2xl border border-red-200 bg-red-50/80 p-6">
                <p className="text-sm font-semibold text-red-700">{bookError}</p>
                <button
                  type="button"
                  onClick={() => {
                    setBookError("");
                    setIsLoadingBook(true);
                  }}
                  className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-xl bg-white px-5 py-2.5 text-xs font-bold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 active:scale-95 transition-all"
                >
                  Thử lại kết nối
                </button>
              </div>
            </div>
          ) : totalPages ? (
            <div className="flex flex-col md:flex-row h-full overflow-y-auto md:overflow-hidden">
              {/* LEFT COLUMN: 9:16 Portrait Book Reader */}
              <div className="flex flex-col w-full md:w-[58%] lg:w-[62%] h-auto md:h-full bg-slate-900/5 p-3 sm:p-4 border-b md:border-b-0 md:border-r border-slate-200/80 shrink-0">
                {/* Book Page Frame (Portrait 9:16 / 3:4 Fit) */}
                <div className="relative flex-1 min-h-[320px] md:min-h-0 flex items-center justify-center rounded-xl bg-slate-800/5 p-2 overflow-hidden shadow-inner">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    key={currentPage}
                    src={`/api/taphuan/page-image?bookKey=${encodeURIComponent(book.key)}&page=${currentPage}`}
                    alt={`Trang ${currentPage} - ${book.title}`}
                    className="h-full w-auto max-w-full max-h-[46vh] md:max-h-[72vh] object-contain rounded-lg shadow-lg bg-white transition-opacity duration-200"
                    loading="lazy"
                  />
                  {isCurrentSelected ? (
                    <div className="absolute top-4 right-4 rounded-xl bg-emerald-600/95 backdrop-blur-sm px-3 py-1.5 text-xs font-bold text-white shadow-lg flex items-center gap-1.5 animate-scale-in">
                      <span className="text-sm">✓</span>
                      <span>Đã chọn trang này</span>
                    </div>
                  ) : null}
                </div>

                {/* Reader Controls: Navigation */}
                <div className="mt-3 flex items-center justify-between gap-3 shrink-0 bg-white rounded-xl p-2 shadow-sm ring-1 ring-slate-900/5">
                  <button
                    type="button"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="inline-flex min-h-[42px] min-w-[100px] items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 active:scale-95 disabled:opacity-35 transition-all"
                  >
                    <span>&larr;</span>
                    <span>Trang trước</span>
                  </button>

                  <div className="flex items-center gap-1 text-center">
                    <span className="text-xs text-slate-500 font-medium">Trang</span>
                    <span className="text-base font-black text-brand-700 tabular-nums font-mono px-1">
                      {currentPage}
                    </span>
                    <span className="text-xs text-slate-400 font-medium">/ {totalPages}</span>
                  </div>

                  <button
                    type="button"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    className="inline-flex min-h-[42px] min-w-[100px] items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 active:scale-95 disabled:opacity-35 transition-all"
                  >
                    <span>Trang sau</span>
                    <span>&rarr;</span>
                  </button>
                </div>
              </div>

              {/* RIGHT COLUMN: Action & Selection Panel */}
              <div className="flex flex-col flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 bg-white">
                <div className="space-y-4 flex-1">
                  {/* Select Current Page Action Button */}
                  <div>
                    <button
                      type="button"
                      onClick={() => togglePage(currentPage)}
                      className={`w-full inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl py-3 px-4 text-sm font-black transition-all active:scale-[0.98] shadow-sm ${
                        isCurrentSelected
                          ? "bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100"
                          : "bg-brand-600 text-white hover:bg-brand-700 shadow-brand-500/25"
                      }`}
                    >
                      {isCurrentSelected ? (
                        <>
                          <span className="text-base font-bold">&times;</span>
                          <span>Bỏ chọn trang {currentPage}</span>
                        </>
                      ) : (
                        <>
                          <span className="text-base font-bold">+</span>
                          <span>Chọn trang {currentPage} vào bài dạy</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Search / Jump Range */}
                  <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 space-y-2">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Nhảy trang hoặc chọn dải trang
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleQuickSearch()}
                        placeholder={`Ví dụ: 15 hoặc 15-17...`}
                        className="flex-1 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs sm:text-sm text-slate-800 placeholder-slate-400 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                      />
                      <button
                        type="button"
                        onClick={handleQuickSearch}
                        className="inline-flex min-h-[40px] items-center justify-center rounded-xl bg-slate-900 text-white px-3.5 py-2 text-xs font-bold hover:bg-slate-800 active:scale-95 transition-all"
                      >
                        Xem & Chọn
                      </button>
                    </div>
                  </div>

                  {/* Selected Pages Tray */}
                  <div className="rounded-xl border border-slate-100 bg-white p-3.5 space-y-2.5 shadow-sm">
                    <div className="flex items-center justify-between text-xs text-slate-600">
                      <span className="font-semibold text-slate-700">
                        Đã chọn: <strong className="text-brand-700 text-sm font-black">{selectedPages.length}</strong> trang
                        <span className="text-slate-400 font-normal"> (còn trống {Math.max(0, remainingSlots - selectedPages.length)} slot)</span>
                      </span>
                      {selectedPages.length > 0 ? (
                        <button
                          type="button"
                          onClick={() => setSelectedPages([])}
                          className="text-[11px] font-bold text-rose-600 hover:underline"
                        >
                          Xóa tất cả
                        </button>
                      ) : null}
                    </div>

                    {selectedPages.length === 0 ? (
                      <p className="text-xs text-slate-400 italic py-2">
                        Chưa chọn trang nào. Bấm nút chọn ở trên hoặc nhập số trang để chọn.
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5 max-h-[160px] overflow-y-auto pr-1">
                        {selectedPages.map((page) => (
                          <span
                            key={page}
                            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
                              page === currentPage
                                ? "bg-brand-600 text-white shadow-sm ring-2 ring-brand-300"
                                : "bg-brand-50 text-brand-700 border border-brand-100 hover:bg-brand-100/70"
                            }`}
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
                              className="cursor-pointer"
                              title="Bấm để xem lại trang này"
                            >
                              Trang {page}
                            </span>
                            <button
                              type="button"
                              onClick={() => togglePage(page)}
                              className={`font-black ml-0.5 ${page === currentPage ? "text-white/80 hover:text-white" : "text-brand-400 hover:text-rose-600"}`}
                              title="Bỏ chọn trang này"
                            >
                              &times;
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Inline Feedback / Warning */}
                  {submitError ? (
                    <div className="rounded-xl border border-rose-200 bg-rose-50/80 p-3 text-xs font-semibold text-rose-700 animate-slide-up">
                      {submitError}
                    </div>
                  ) : null}

                  {/* Copyright Note */}
                  <div className="rounded-xl bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-500">
                    <span className="font-semibold text-slate-700">Nguồn:</span> {book.source}.{" "}
                    Bản quyền thuộc <strong>{book.copyright}</strong>. Phục vụ soạn giáo án cá nhân theo quy định.
                  </div>
                </div>

                {/* Footer Confirm Actions in Right Column */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5 shrink-0">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={isSubmitting}
                    className="inline-flex min-h-[44px] items-center justify-center rounded-xl px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 active:scale-95 transition-all disabled:opacity-50"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    disabled={selectedPages.length === 0 || isSubmitting}
                    onClick={handleConfirm}
                    className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 py-2 text-xs sm:text-sm font-bold text-white shadow-sm hover:bg-brand-700 active:scale-[0.98] shadow-brand-500/20 transition-all disabled:cursor-not-allowed disabled:opacity-50"
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
          ) : null}
        </div>
      </div>
    </div>
  );
}
