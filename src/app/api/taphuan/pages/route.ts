import { NextResponse } from "next/server";
import { getTaphuanBookByKey } from "@/lib/taphuan-catalog";
import { fetchTaphuanReaderPages } from "@/lib/taphuan-reader";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const bookKey = searchParams.get("bookKey");

  if (!bookKey) {
    return NextResponse.json({ error: "Thiếu tham số bookKey" }, { status: 400 });
  }

  const book = getTaphuanBookByKey(bookKey);
  if (!book) {
    return NextResponse.json({ error: "Không tìm thấy sách trong danh mục chuẩn" }, { status: 404 });
  }

  try {
    const pages = await fetchTaphuanReaderPages(book.readerUrl);
    return NextResponse.json({
      book: {
        key: book.key,
        title: book.title,
        grade: book.grade,
        subject: book.subject,
        volume: book.volume,
        readerUrl: book.readerUrl,
        source: book.source,
        copyright: book.copyright,
      },
      totalPages: pages.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Lỗi đọc dữ liệu từ taphuan.nxbgd.vn";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
