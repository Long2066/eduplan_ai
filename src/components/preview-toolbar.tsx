type PreviewToolbarProps = {
  disabled: boolean;
  isGenerating?: boolean;
  onRefine: (action: RefineAction) => void;
  onExportWord: () => void;
  onExportPdf: () => void;
};

export type RefineAction = "better" | "shorten" | "expand" | "digital" | "demo";

const groups = [
  {
    label: "Tinh chỉnh",
    actions: ["Viết hay hơn", "Rút gọn", "Chi tiết hơn"],
    tone: "brand",
  },
  {
    label: "Nâng cấp",
    actions: ["Thêm năng lực số", "Thi giảng"],
    tone: "mint",
  },
  {
    label: "Xuất file",
    actions: ["Xuất Word", "Xuất PDF"],
    tone: "warm",
  },
] as const;

const toneClass = {
  brand: "border-brand-200 bg-brand-50 text-brand-700 hover:bg-brand-600 hover:text-white hover:border-brand-600",
  mint: "border-mint-200 bg-mint-50 text-mint-600 hover:bg-mint-500 hover:text-white hover:border-mint-500",
  warm: "border-warm-200 bg-warm-50 text-warm-600 hover:bg-warm-500 hover:text-white hover:border-warm-500",
};

const groupBgClass = {
  brand: "border-brand-100/60 bg-brand-50/40",
  mint: "border-mint-100/60 bg-mint-50/40",
  warm: "border-warm-100/60 bg-warm-50/40",
};

const labelClass = {
  brand: "text-brand-500",
  mint: "text-mint-500",
  warm: "text-warm-500",
};

const actionHandlers: Record<string, { kind: "refine"; action: RefineAction } | { kind: "word" } | { kind: "pdf" }> = {
  "Viết hay hơn": { kind: "refine", action: "better" },
  "Rút gọn": { kind: "refine", action: "shorten" },
  "Chi tiết hơn": { kind: "refine", action: "expand" },
  "Thêm năng lực số": { kind: "refine", action: "digital" },
  "Thi giảng": { kind: "refine", action: "demo" },
  "Xuất Word": { kind: "word" },
  "Xuất PDF": { kind: "pdf" },
};

export function PreviewToolbar({ disabled, isGenerating = false, onRefine, onExportWord, onExportPdf }: PreviewToolbarProps) {
  function handleAction(label: string) {
    const handler = actionHandlers[label];
    if (!handler) return;
    if (handler.kind === "refine") onRefine(handler.action);
    if (handler.kind === "word") onExportWord();
    if (handler.kind === "pdf") onExportPdf();
  }

  return (
    <div className="glass-card mb-2 rounded-xl px-3 py-2.5 shadow-sm">
      <div className="flex items-center gap-3 overflow-x-auto whitespace-nowrap">
        <div className="flex min-w-max flex-1 items-center gap-3">
          {groups.map((group) => (
            <div
              key={group.tone}
              className={`flex items-center gap-2 rounded-xl border px-2.5 py-1.5 ${groupBgClass[group.tone]}`}
            >
              <span
                className={`px-1 text-[11px] font-semibold uppercase tracking-wider ${labelClass[group.tone]}`}
              >
                {group.label}
              </span>
              <div className="flex gap-1.5">
                {group.actions.map((action) => (
                  <button
                    key={action}
                    type="button"
                    disabled={disabled || isGenerating}
                    onClick={() => handleAction(action)}
                    className={`min-h-[36px] rounded-lg border px-3 py-1.5 text-[13px] font-semibold shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md disabled:opacity-40 disabled:cursor-not-allowed ${toneClass[group.tone]}`}
                  >
                    {action}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {isGenerating ? (
          <div className="ml-auto shrink-0 animate-pulse-soft rounded-full bg-brand-100 px-4 py-1.5 text-[11px] font-semibold text-brand-700">
            AI đang soạn
          </div>
        ) : null}
      </div>
    </div>
  );
}
