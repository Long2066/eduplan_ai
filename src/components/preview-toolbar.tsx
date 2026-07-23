type PreviewToolbarProps = {
  onExportWord: () => void;
  onExportPdf: () => void;
};

export function PreviewToolbar({ onExportWord, onExportPdf }: PreviewToolbarProps) {

  return (
    <div className="mt-3 flex shrink-0 justify-end">
      <div className="inline-flex items-center gap-2 rounded-xl border border-warm-100/60 bg-warm-50/40 px-2.5 py-1.5 shadow-sm">
        <span className="px-1 text-[11px] font-semibold uppercase tracking-wider text-warm-500">
          Xuất file
        </span>
        <button
          id="export-word-button"
          type="button"
          onClick={onExportWord}
          className="min-h-[36px] rounded-lg border border-warm-200 bg-warm-50 px-3 py-1.5 text-[13px] font-semibold text-warm-600 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-warm-500 hover:bg-warm-500 hover:text-white hover:shadow-md"
        >
          Xuất Word
        </button>
        <button
          id="export-pdf-button"
          type="button"
          onClick={onExportPdf}
          className="min-h-[36px] rounded-lg border border-warm-200 bg-warm-50 px-3 py-1.5 text-[13px] font-semibold text-warm-600 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-warm-500 hover:bg-warm-500 hover:text-white hover:shadow-md"
        >
          Xuất PDF
        </button>
      </div>
    </div>
  );
}
