#!/usr/bin/env python3
"""Kiểm tra cơ học KHBD JSON: không thay đánh giá sư phạm hoặc jsonschema đầy đủ.
Usage: python tools/validate_lesson.py path/to/lesson.json
Exit 0: không có blocker cơ học; exit 1: có lỗi.
"""
from __future__ import annotations
import json
from pathlib import Path
import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

VALID_STATES = {'draft','needs_source_review','needs_handwriting_reference','blocked_pedagogy','ready_for_human_review','approved','exported','visual_qa_pending'}


def validate(data: dict) -> tuple[list[str], list[str]]:
    errors, warnings = [], []
    if not isinstance(data, dict):
        return ['JSON root phải là object'], warnings
    meta = data.get('metadata') or {}
    grade = meta.get('grade')
    if grade not in (1, 2, 3, 4, 5):
        errors.append('metadata.grade phải thuộc 1..5')
    minutes = meta.get('minutes_per_period')
    if not isinstance(minutes, int) or minutes <= 0:
        errors.append('metadata.minutes_per_period phải là số phút > 0')
    if meta.get('subject') != 'Tiếng Việt':
        errors.append('metadata.subject phải là Tiếng Việt')
    if not str(meta.get('lesson_title','')).strip():
        errors.append('Thiếu metadata.lesson_title')
    sources = data.get('sources') or []
    source_ids = {s.get('source_id') for s in sources if isinstance(s, dict) and s.get('source_id')}
    if len(sources) == 0 or len(source_ids) != len(sources):
        errors.append('Phải có nguồn và source_id duy nhất')
    for s in sources:
        if not isinstance(s, dict):
            errors.append('Nguồn không phải object')
            continue
        if s.get('verified') and not str(s.get('anchor', '')).strip():
            errors.append(f"Nguồn {s.get('source_id')} verified nhưng không có anchor")
        if s.get('source_type') == 'official_verified' and not s.get('verified'):
            errors.append(f"Nguồn {s.get('source_id')} gắn official_verified khi chưa verified")
    objectives = data.get('objectives') or []
    objective_ids = {o.get('id') for o in objectives if isinstance(o,dict) and o.get('id')}
    if not objectives or len(objective_ids) != len(objectives):
        errors.append('Thiếu mục tiêu hoặc mục tiêu ID trùng')
    period_indexes = set()
    activity_ids = set()
    covered_objectives = set()
    periods = data.get('periods') or []
    if not periods:
        errors.append('Không có tiết học')
    for period in periods:
        index = period.get('index')
        if index in period_indexes:
            errors.append(f'Tiết index {index} bị lặp')
        period_indexes.add(index)
        activities = period.get('activities') or []
        if not activities:
            errors.append(f'Tiết {index} không có hoạt động')
        used = 0
        for a in activities:
            aid=a.get('id')
            if aid in activity_ids:
                errors.append(f'Hoạt động ID bị trùng: {aid}')
            activity_ids.add(aid)
            m=a.get('minutes')
            if not isinstance(m,int) or m<=0:
                errors.append(f'Hoạt động {aid} phút không hợp lệ')
            else:
                used += m
            for key in ('title','teacher_script','student_actions','expected_output','assessment','misconception_support'):
                if not str(a.get(key,'')).strip():
                    errors.append(f'Hoạt động {aid} thiếu {key}')
            if str(a.get('student_actions','')).strip().lower() in ('hs lắng nghe','học sinh lắng nghe','lắng nghe','quan sát, lắng nghe'):
                warnings.append(f'Hoạt động {aid}: HS chỉ nghe, cần nhiệm vụ quan sát được')
            for objid in a.get('objective_ids') or []:
                covered_objectives.add(objid)
                if objid not in objective_ids:
                    errors.append(f'Hoạt động {aid} tham chiếu mục tiêu lạ {objid}')
            for sid in a.get('source_ids') or []:
                if sid not in source_ids:
                    errors.append(f'Hoạt động {aid} tham chiếu nguồn không tồn tại {sid}')
        if used != period.get('duration_minutes'):
            errors.append(f'Tiết {index}: tổng phút HĐ {used} khác thời lượng tiết {period.get("duration_minutes")}')
        if minutes and period.get('duration_minutes') != minutes:
            errors.append(f'Tiết {index}: {period.get("duration_minutes")} khác minutes_per_period={minutes}')
    if objective_ids - covered_objectives:
        errors.append('Có mục tiêu chưa gắn hoạt động: '+', '.join(sorted(objective_ids-covered_objectives)))
    state = data.get('status')
    if state not in VALID_STATES:
        errors.append(f'Status không hợp lệ: {state}')
    if data.get('source_conflicts') and state in ('ready_for_human_review','approved','exported'):
        errors.append('Có mâu thuẫn nguồn nhưng status đã cho duyệt/xuất')
    if state in ('approved','exported') and not data.get('human_approval'):
        errors.append('Không thể approved/exported khi human_approval chưa có')
    if (meta.get('lesson_type') in ('grade1_phonics','handwriting') and grade == 1):
        if not data.get('writing_instruction') and state in ('ready_for_human_review','approved','exported'):
            errors.append('Lớp 1 có mục tiêu viết nhưng thiếu hướng dẫn viết; phải có nguồn mẫu hoặc status needs_handwriting_reference')
    for w in data.get('writing_instruction') or []:
        sid=w.get('reference_source_id')
        if sid not in source_ids:
            errors.append(f'Writing target {w.get("target")}: nguồn mẫu {sid} không tồn tại')
        elif not any(s.get('source_id')==sid and s.get('verified') for s in sources):
            errors.append(f'Writing target {w.get("target")}: nguồn nét chưa verified')
        if not w.get('reference_anchor') or not w.get('strokes'):
            errors.append(f'Writing target {w.get("target")} thiếu hình nguồn hoặc cấu tạo nét')
    digital=data.get('digital_integration') or {}
    if digital.get('is_applicable'):
        for key in ('indicator_reference','student_action','digital_tool','product','assessment','offline_fallback'):
            if not str(digital.get(key,'')).strip():
                errors.append(f'NLS được bật nhưng thiếu {key}')
    if (grade and grade>1) and meta.get('lesson_type') == 'grade1_phonics':
        errors.append('Bài âm-vần lớp 1 không thể route vào lớp 2–5')
    if not sources or not any(s.get('verified') and s.get('source_type') in ('official_verified','user_material') for s in sources):
        if state in ('ready_for_human_review','approved','exported'):
            errors.append('Chưa có nguồn nội dung verified mà đã cho xuất/duyệt')
        else:
            warnings.append('Chưa có nguồn nội dung verified; cần nguồn SGK/SGV')
    return errors, warnings


def main() -> int:
    if len(sys.argv)!=2 or sys.argv[1] in ('-h','--help'):
        print(__doc__)
        return 0 if len(sys.argv)==2 else 2
    path=Path(sys.argv[1])
    try:
        data=json.loads(path.read_text(encoding='utf-8'))
    except (OSError, ValueError) as exc:
        print(f'BLOCK: Không đọc được JSON: {exc}')
        return 1
    errors,warnings=validate(data)
    for warning in warnings:
        print('WARNING:',warning)
    for error in errors:
        print('BLOCK:',error)
    print(f'QA: {len(errors)} blocker(s), {len(warnings)} warning(s)')
    return 1 if errors else 0

if __name__=='__main__':
    raise SystemExit(main())
