import json
import sys
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tools'))
from validate_lesson import validate
from check_skills import check

class SkillTests(unittest.TestCase):
    def read(self,n):
        return json.loads((ROOT/'samples'/n).read_text(encoding='utf-8'))

    def test_skill_structure(self):
        self.assertEqual(check(),[])

    def test_grade1_valid(self):
        errors,warnings=validate(self.read('grade1-valid.json'))
        self.assertEqual(errors,[],warnings)

    def test_grade4_valid(self):
        errors,_=validate(self.read('grade4-valid.json'))
        self.assertEqual(errors,[])

    def test_invalid_blocked(self):
        errors,_=validate(self.read('grade1-invalid.json'))
        self.assertGreaterEqual(len(errors),4)
        self.assertTrue(any('tổng phút' in x for x in errors))
        self.assertTrue(any('mục tiêu lạ' in x for x in errors))
        self.assertTrue(any('nguồn không tồn tại' in x for x in errors))

    def test_source_conflict_block(self):
        data=self.read('grade4-valid.json')
        data['status']='approved'
        data['human_approval']=True
        data['source_conflicts']=['Bài chưa rõ']
        errs,_=validate(data)
        self.assertTrue(any('mâu thuẫn nguồn' in e for e in errs))

    def test_nls_required(self):
        data=self.read('grade4-valid.json')
        data['digital_integration']={'is_applicable':True,'student_action':'Nhìn TV'}
        errs,_=validate(data)
        self.assertTrue(any('NLS' in e for e in errs))

    def test_grade_route(self):
        data=self.read('grade4-valid.json')
        data['metadata']['lesson_type']='grade1_phonics'
        errs,_=validate(data)
        self.assertTrue(any('route' in e for e in errs))

if __name__ == '__main__':
    unittest.main()
