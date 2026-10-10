type PreviewToolbarProps = {
  onExportWord: () => void;
  inline?: boolean;
};

export function PreviewToolbar({ onExportWord, inline = false }: PreviewToolbarProps) {
  return (
    <div className={inline ? "flex shrink-0 justify-end" : "mt-3 flex shrink-0 justify-end"}>
      <div className="flex w-full sm:w-auto items-center justify-between sm:justify-end gap-2.5 rounded-xl border border-emerald-100 bg-emerald-50/50 p-2 sm:px-3 sm:py-1.5 shadow-sm">
        <span className="hidden sm:inline px-1 text-[11px] font-bold uppercase tracking-wider text-emerald-700">
          Xuất file
        </span>
        <button
          id="export-word-button"
          type="button"
          onClick={onExportWord}
          className="flex min-h-[44px] sm:min-h-[38px] w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs sm:text-[13px] font-bold text-white shadow-sm shadow-emerald-600/25 transition-all duration-200 hover:bg-emerald-700 active:scale-[0.98]"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          <span>Xuất Word (.docx)</span>
        </button>
      </div>
    </div>
  );
}
