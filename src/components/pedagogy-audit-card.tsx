"use client";

import type { PedagogyAudit } from "@/types/lesson";

type PedagogyAuditCardProps = {
  audit: PedagogyAudit | null;
};

export function PedagogyAuditCard({ audit }: PedagogyAuditCardProps) {
  if (!audit) return null;

  return (
    <section
      id="pedagogy-audit-card"
      className="mb-2.5 shrink-0 rounded-2xl border border-amber-200/90 bg-gradient-to-r from-amber-50 via-white to-orange-50/80 px-5 py-4 text-center shadow-[0_12px_34px_-22px_rgba(15,23,42,0.45)]"
      role="status"
      aria-live="polite"
    >
      <p className="text-sm font-semibold leading-6 text-amber-950">
        Bạn vui lòng xem lại <strong>Nội dung giáo án</strong> và <strong>Một số tiêu chí còn thiếu hoặc chưa đủ rõ (nếu có)</strong> trước khi dạy thật.
      </p>
    </section>
  );
}
