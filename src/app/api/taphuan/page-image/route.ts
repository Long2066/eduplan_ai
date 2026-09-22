import { NextResponse } from "next/server";
import { getTaphuanBookByKey } from "@/lib/taphuan-catalog";
import { fetchTaphuanPageBuffer, fetchTaphuanReaderPages } from "@/lib/taphuan-reader";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const bookKey = searchParams.get("bookKey");
  const pageParam = searchParams.get("page");

  if (!bookKey || !pageParam) {
    return NextResponse.json({ error: "Thiếu tham số bookKey hoặc page" }, { status: 400 });
  }

  const page = Number.parseInt(pageParam, 10);
  if (Number.isNaN(page) || page <= 0) {
    return NextResponse.json({ error: "Số trang không hợp lệ" }, { status: 400 });
  }

  const book = getTaphuanBookByKey(bookKey);
  if (!book) {
    return NextResponse.json({ error: "Không tìm thấy sách trong danh mục chuẩn" }, { status: 404 });
  }

  try {
    const pages = await fetchTaphuanReaderPages(book.readerUrl);
    if (page > pages.length) {
      return NextResponse.json(
        { error: `Số trang vượt quá tổng số trang của sách (1 - ${pages.length})` },
        { status: 400 },
      );
    }

    const pageUrl = pages[page - 1];
    const { buffer, contentType } = await fetchTaphuanPageBuffer(pageUrl);

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": contentType || "image/png",
        "Cache-Control": "public, max-age=86400, immutable",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Lỗi tải ảnh từ taphuan.nxbgd.vn";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
