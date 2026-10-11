#!/usr/bin/env python3
"""Validate Antigravity skill folders/frontmatter; no dependency required."""
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
SKILLS = ROOT / '.agents' / 'skills'
EXPECTED = {
    'tv-build-lesson-app','tv-source-audit','tv-route-curriculum',
    'tv-grade1-phonics','tv-grade1-reading','tv-grade1-review-story','tv-grade1-handwriting','tv-grade2','tv-grade3',
    'tv-grade4','tv-grade5','tv-digital-integration','tv-pedagogy-audit',
    'tv-docx-export'
}


def check() -> list[str]:
    errors=[]
    for name in sorted(EXPECTED):
        doc=SKILLS/name/'SKILL.md'
        if not doc.exists():
            errors.append(f'Missing {doc}')
            continue
        text=doc.read_text(encoding='utf-8')
        match=re.match(r'^---\s*\n(.*?)\n---\s*\n',text,re.S)
        if not match:
            errors.append(f'{name}: missing YAML frontmatter')
            continue
        fm=match.group(1)
        named=re.search(r'^name:\s*([^\n]+)',fm,re.M)
        desc=re.search(r'^description:\s*([^\n]+)',fm,re.M)
        if not named or named.group(1).strip() != name:
            errors.append(f'{name}: name khác folder')
        if not desc or len(desc.group(1).strip())<30:
            errors.append(f'{name}: description quá ngắn/thiếu')
        if len(text)<450:
            errors.append(f'{name}: thiếu hướng dẫn nghiệp vụ')
    return errors

if __name__=='__main__':
    errs=check()
    for e in errs: print('ERROR:',e)
    print('Skills checked:',len(EXPECTED),'errors:',len(errs))
    sys.exit(1 if errs else 0)
