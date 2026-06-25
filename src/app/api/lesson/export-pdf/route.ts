import { NextResponse } from "next/server";
import { renderLessonPdfToBuffer } from "@/lib/export-pdf";
import type { LessonPlan } from "@/types/lesson";

export const runtime = "nodejs";

function safeFileName(value?: string) {
  return (value || "giao-an-eduplan-ai").replace(/[\\/:*?"<>|]/g, "-").slice(0, 80);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { lesson?: LessonPlan; fileName?: string };
    if (!body.lesson) {
      return NextResponse.json({ error: "Thiếu dữ liệu giáo án để xuất PDF." }, { status: 400 });
    }

    const fileName = safeFileName(body.fileName || body.lesson.generalInfo?.lessonTitle);
    const pdfBytes = await renderLessonPdfToBuffer(body.lesson);

    return new NextResponse(new Uint8Array(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(fileName)}.pdf"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không thể tạo PDF.";
    return NextResponse.json(
      {
        error: `Không thể xuất PDF. Chi tiết: ${message}`,
      },
      { status: 500 },
    );
  }
}
