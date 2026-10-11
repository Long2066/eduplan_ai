#!/usr/bin/env python3
"""Kiểm tra cấu trúc file DOCX xuất ra:
Đảm bảo 100% nội dung Mục III (Tiến trình dạy học) nằm trọn vẹn trong bảng 2 cột GV-HS,
không có bất kỳ đoạn văn bản nào rơi ra ngoài bảng giữa Mục III và Mục IV.
Usage:
    python tools/verify_docx_table.py path/to/lesson.docx
Exit 0: Hợp lệ 100%.
Exit 1: Có lỗi cấu trúc (ví dụ: chữ ngoài bảng Mục III, thiếu bảng, hoặc bảng sai cấu trúc).
"""
from __future__ import annotations
import argparse
import sys
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")


def verify_docx_table_content(docx_path: Path | str) -> tuple[list[str], list[str]]:
    """Kiểm tra cấu trúc file DOCX. Trả về (errors, warnings)."""
    errors: list[str] = []
    warnings: list[str] = []

    docx_path = Path(docx_path)
    if not docx_path.exists():
        return [f"Không tìm thấy file DOCX: {docx_path}"], warnings

    try:
        import docx
        from docx.oxml.text.paragraph import CT_P
        from docx.oxml.table import CT_Tbl
        from docx.table import Table
        from docx.text.paragraph import Paragraph
    except ImportError:
        return ["Thư viện python-docx chưa được cài đặt (yêu cầu 'pip install python-docx')"], warnings

    try:
        doc = docx.Document(str(docx_path))
    except Exception as e:
        return [f"Không thể mở file DOCX {docx_path}: {e}"], warnings

    body = doc.element.body
    inside_section_iii = False
    section_iii_found = False
    section_iv_found = False
    tables_in_section_iii = 0
    non_table_paragraphs_in_section_iii: list[str] = []

    for element in body:
        if isinstance(element, CT_P):
            p = Paragraph(element, doc)
            text = (p.text or "").strip()
            if not text:
                continue

            # Kiểm tra tiêu đề Mục III
            if "III." in text and "TIẾN TRÌNH DẠY HỌC" in text.upper():
                inside_section_iii = True
                section_iii_found = True
                continue

            # Kiểm tra tiêu đề Mục IV
            if "IV." in text and "ĐIỀU CHỈNH SAU BÀI DẠY" in text.upper():
                inside_section_iii = False
                section_iv_found = True
                continue

            # Nếu đang trong Mục III mà gặp paragraph (không phải tiêu đề III)
            if inside_section_iii:
                non_table_paragraphs_in_section_iii.append(text)

        elif isinstance(element, CT_Tbl):
            if inside_section_iii:
                tables_in_section_iii += 1
                table = Table(element, doc)
                # Kiểm tra số cột của bảng
                if len(table.columns) < 2:
                    errors.append(f"Bảng trong Mục III chỉ có {len(table.columns)} cột (yêu cầu bảng 2 cột GV-HS)")
                # Kiểm tra có dòng hoạt động
                if len(table.rows) < 2:
                    warnings.append("Bảng trong Mục III có quá ít hàng")

    if not section_iii_found:
        errors.append("Không tìm thấy tiêu đề 'III. TIẾN TRÌNH DẠY HỌC' trong file DOCX")
    if not section_iv_found:
        warnings.append("Không tìm thấy tiêu đề 'IV. ĐIỀU CHỈNH SAU BÀI DẠY' trong file DOCX")

    if tables_in_section_iii == 0 and section_iii_found:
        errors.append("Mục III không chứa bất kỳ bảng dạy học nào")

    # KIỂM TRA QUAN TRỌNG: 100% nội dung Mục III phải ở trong bảng
    if non_table_paragraphs_in_section_iii:
        for p_text in non_table_paragraphs_in_section_iii:
            errors.append(f"Mục III phát hiện đoạn văn bản ngoài bảng: \"{p_text}\" (100% nội dung Mục III phải nằm trong bảng 2 cột)")

    return errors, warnings


def main():
    parser = argparse.ArgumentParser(description="Kiểm tra cấu trúc bảng hai cột trong file DOCX")
    parser.add_argument("docx_file", type=Path, help="Đường dẫn file DOCX cần kiểm tra")
    args = parser.parse_args()

    errors, warnings = verify_docx_table_content(args.docx_file)

    print(f"=== KẾT QUẢ KIỂM TRA BẢNG DOCX: {args.docx_file.name} ===")
    if warnings:
        print(f"CẢNH BÁO ({len(warnings)}):")
        for w in warnings:
            print(f"  - [WARN] {w}")

    if errors:
        print(f"LỖI CẤU TRÚC ({len(errors)}):")
        for e in errors:
            print(f"  - [ERROR] {e}")
        print("=> KẾT LUẬN: KHÔNG ĐẠT (FAILED)")
        sys.exit(1)
    else:
        print("=> KẾT LUẬN: ĐẠT CHUẨN 100% (PASSED - 100% nội dung Mục III nằm trong bảng)")
        sys.exit(0)


if __name__ == "__main__":
    main()
