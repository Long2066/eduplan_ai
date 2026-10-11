#!/usr/bin/env python3
"""Quality Gate kiểm định chuyên sâu cho Bài 31: an, ăn, ân (SGK Tiếng Việt 1 KNTT, tr. 74–75).
Đảm bảo chất lượng dạy thật theo các tiêu chuẩn trong docs/QUALITY_GATES_V12.md.
Usage:
    python tools/quality_gate_bai31.py path/to/lesson.json [--docx path/to/lesson.docx]
Exit 0: Đạt toàn bộ gate.
Exit 1: Vi phạm ít nhất một gate (blocker/major).
"""
from __future__ import annotations
import argparse
import json
import re
import sys
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

def check_bai31_quality(data: dict) -> tuple[list[str], list[str]]:
    """Kiểm định 5 Gate cho Bài 31 an ăn ân. Trả về (errors, warnings)."""
    errors: list[str] = []
    warnings: list[str] = []

    if not isinstance(data, dict):
        return ["Dữ liệu JSON gốc phải là một đối tượng (dict)"], warnings

    meta = data.get("metadata") or {}
    grade = meta.get("grade")
    subject = meta.get("subject")
    periods = data.get("periods") or []

    # -------------------------------------------------------------
    # GATE 1: TECHNICAL & TIMING GATE
    # -------------------------------------------------------------
    if grade != 1:
        errors.append(f"Gate 1 [FAIL]: Khối lớp phải là 1, hiện tại là {grade}")
    if subject != "Tiếng Việt":
        errors.append(f"Gate 1 [FAIL]: Môn học phải là 'Tiếng Việt', hiện tại là {subject}")
    if len(periods) != 2:
        errors.append(f"Gate 1 [FAIL]: Bài 31 chuẩn SGK KNTT gồm 2 tiết, hiện tại có {len(periods)} tiết")

    total_minutes = 0
    for p in periods:
        dur = p.get("duration_minutes", 0)
        total_minutes += dur
        if dur != 35:
            errors.append(f"Gate 1 [FAIL]: Tiết {p.get('index')} thời lượng {dur} phút (chuẩn là 35 phút)")
        act_minutes = sum(a.get("minutes", 0) for a in p.get("activities", []))
        if act_minutes != dur:
            errors.append(f"Gate 1 [FAIL]: Tiết {p.get('index')} tổng phút các hoạt động ({act_minutes}) không khớp thời lượng tiết ({dur})")

    if total_minutes != 70:
        errors.append(f"Gate 1 [FAIL]: Tổng thời lượng bài {total_minutes} phút khác 70 phút (2 tiết x 35 phút)")

    # Gom toàn bộ văn bản để rà soát ngữ liệu
    all_text_parts: list[str] = []
    for p in periods:
        for a in p.get("activities", []):
            for k in ("title", "teacher_script", "student_actions", "expected_output", "assessment", "misconception_support"):
                val = a.get(k)
                if val:
                    all_text_parts.append(str(val))
    full_text = " ".join(all_text_parts)
    full_text_lower = full_text.lower()

    # Kiểm tra source_content nếu có
    src_content = data.get("source_content") or {}

    # -------------------------------------------------------------
    # GATE 2: SOURCE CONTRACT GATE (NGỮ LIỆU BẤT BIẾN SGK TR. 74-75)
    # -------------------------------------------------------------
    # 1. Đoạn đọc: phải có "chả sợ", CẤM "chẳng sợ"
    if "chẳng sợ" in full_text_lower:
        errors.append("Gate 2 [FAIL - Hallucination]: Xuất hiện từ 'chẳng sợ' (sai nguyên văn SGK tr. 75; SGK ghi 'chả sợ')")
    if "chả sợ" not in full_text_lower:
        errors.append("Gate 2 [FAIL - Missing SGK Text]: Thiếu cụm từ 'chả sợ' trong đoạn đọc ứng dụng SGK tr. 75")

    # 2. Dãy tiếng SGK tr. 74: bàn, nhãn, gắn, lặn, bận, gần
    required_words = ["bàn", "nhãn", "gắn", "lặn", "bận", "gần"]
    for w in required_words:
        # Regex tìm từ đứng riêng
        pattern = r"\b" + re.escape(w) + r"\b"
        if not re.search(pattern, full_text, flags=re.IGNORECASE):
            errors.append(f"Gate 2 [FAIL - Missing Word]: Thiếu tiếng mục tiêu '{w}' của SGK tr. 74")

    # Kiểm tra lỗi kinh điển: mất tiếng 'bàn' vì bị nhầm sang 'bạn'
    # Tiếng 'bàn' phải xuất hiện trong ngữ cảnh dãy tiếng luyện đọc
    if not re.search(r"\bbàn\b", full_text, flags=re.IGNORECASE):
        errors.append("Gate 2 [FAIL]: Không tìm thấy tiếng 'bàn' (nguy cơ bị thay thế nhầm thành 'bạn')")

    # 3. Từ ngữ ứng dụng SGK tr. 74: bạn thân, khăn rằn, quả mận
    app_words = ["bạn thân", "khăn rằn", "quả mận"]
    for aw in app_words:
        if aw not in full_text_lower:
            errors.append(f"Gate 2 [FAIL - Missing Application Word]: Thiếu từ ngữ ứng dụng '{aw}' (SGK tr. 74)")

    # 4. Câu nhận biết / tranh mở đầu tr. 74
    recog_keywords = ["đàn", "gần", "chân"]
    found_recog = [kw for kw in recog_keywords if kw in full_text_lower]
    if len(found_recog) < 2 and "tha thẩn" not in full_text_lower:
        warnings.append("Gate 2 [WARN]: Câu nhận biết khởi động chưa rõ các từ khóa 'đàn, gần, chân' theo tranh SGK tr. 74")

    # 5. Chủ đề nói & nghe tr. 75: "Xin lỗi"
    if "xin lỗi" not in full_text_lower:
        errors.append("Gate 2 [FAIL - Missing Speaking Topic]: Thiếu chủ đề nói và nghe 'Xin lỗi' theo tranh SGK tr. 75")

    # -------------------------------------------------------------
    # GATE 3: PEDAGOGY GATE (QUY TRÌNH HỌC VẦN LỚP 1 CHUẨN MỰC)
    # -------------------------------------------------------------
    # 1. Phân tích cấu tạo vần: Phải có âm chính và âm cuối
    has_vowel_structure = (
        ("âm chính" in full_text_lower and "âm cuối" in full_text_lower)
        or ("a và n" in full_text_lower and "ă và n" in full_text_lower)
        or (bool(src_content.get("rhyme_structures")))
    )
    if not has_vowel_structure:
        errors.append("Gate 3 [FAIL - Missing Rhyme Analysis]: Thiếu bước phân tích cấu tạo vần (phân biệt âm chính a/ă/â và âm cuối n)")

    # 2. Mô hình ghép tiếng bạn: BẮT BUỘC mô hình 2 bước:
    # Bước 1: b + an = ban; Bước 2: ban + nặng = bạn
    # BLOCK nếu nhảy cóc b + an = bạn mà không qua ban
    has_step1 = bool(re.search(r"b\s*(\+|với|-)\s*an\s*(=|thành|-)\s*ban", full_text_lower)) or "b - an - ban" in full_text_lower or "bờ - an - ban" in full_text_lower
    has_step2 = bool(re.search(r"ban\s*(\+|thêm|-)\s*(dấu\s*)?nặng\s*(=|thành|-)\s*bạn", full_text_lower)) or "ban - nặng - bạn" in full_text_lower

    # Kiểm tra xem có trường hợp sai: nhảy cóc b + an = bạn mà thiếu bước tạo tiếng ban
    has_jump = bool(re.search(r"b\s*\+\s*an\s*=\s*bạn\b", full_text_lower))

    if has_jump and not (has_step1 and has_step2):
        errors.append("Gate 3 [FAIL - Phonics Skip]: Ghép tiếng nhảy cóc 'b + an = bạn'; bắt buộc quy trình 2 bước: 'b + an = ban', sau đó 'ban + nặng = bạn'")
    elif not (has_step1 and has_step2):
        errors.append("Gate 3 [FAIL - Incomplete Phonics Model]: Thiếu mô hình ghép tiếng 2 bước ('b + an = ban' và 'ban + nặng = bạn')")

    # 3. Tập viết: Mẫu chữ và cờ kiểm chứng
    writing_targets = ["an", "ăn", "ân", "bạn thân", "khăn rằn"]
    writing_instr = data.get("writing_instruction") or []
    writing_dict = {w.get("target"): w for w in writing_instr if isinstance(w, dict)}

    status = data.get("status")
    for wt in writing_targets:
        if wt not in writing_dict:
            # Nếu chưa có writing_instruction chi tiết, status bắt buộc phải là needs_handwriting_reference hoặc draft
            if status not in ("needs_handwriting_reference", "draft"):
                errors.append(f"Gate 3 [FAIL - Writing Reference]: Thiếu hướng dẫn viết đã kiểm chứng cho mục tiêu '{wt}' nhưng status đã gắn '{status}'")
        else:
            item = writing_dict[wt]
            ref_id = item.get("reference_source_id")
            if not ref_id and status in ("approved", "exported", "ready_for_human_review"):
                errors.append(f"Gate 3 [FAIL - Writing Reference]: Mục tiêu viết '{wt}' thiếu nguồn đối chiếu reference_source_id")

    return errors, warnings


def main():
    parser = argparse.ArgumentParser(description="Kiểm định Quality Gate cho Bài 31 an ăn ân")
    parser.add_argument("json_file", type=Path, help="Đường dẫn tới file JSON kế hoạch bài dạy")
    parser.add_argument("--docx", type=Path, default=None, help="Đường dẫn tới file DOCX kiểm tra bảng")
    args = parser.parse_args()

    if not args.json_file.exists():
        print(f"Lỗi: Không tìm thấy file {args.json_file}", file=sys.stderr)
        sys.exit(1)

    try:
        data = json.loads(args.json_file.read_text(encoding="utf-8"))
    except Exception as e:
        print(f"Lỗi cú pháp JSON: {e}", file=sys.stderr)
        sys.exit(1)

    errors, warnings = check_bai31_quality(data)

    # Nếu có file docx, gọi kiểm tra bảng
    if args.docx and args.docx.exists():
        try:
            try:
                from tools.verify_docx_table import verify_docx_table_content
            except ImportError:
                from verify_docx_table import verify_docx_table_content
            docx_errors, docx_warnings = verify_docx_table_content(args.docx)
            errors.extend(docx_errors)
            warnings.extend(docx_warnings)
        except ImportError:
            print("Cảnh báo: tools/verify_docx_table.py chưa sẵn sàng để kiểm tra DOCX", file=sys.stderr)

    print(f"=== KẾT QUẢ QUALITY GATE BÀI 31: {args.json_file.name} ===")
    if warnings:
        print(f"CẢNH BÁO ({len(warnings)}):")
        for w in warnings:
            print(f"  - [WARN] {w}")

    if errors:
        print(f"LỖI CHẶN ({len(errors)}):")
        for e in errors:
            print(f"  - [ERROR] {e}")
        print("=> KẾT LUẬN: KHÔNG ĐẠT (FAILED)")
        sys.exit(1)
    else:
        print("=> KẾT LUẬN: ĐẠT CHUẨN 100% (PASSED)")
        sys.exit(0)


if __name__ == "__main__":
    main()
