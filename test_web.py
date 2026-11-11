"""시작 화면의 처리 기록 필터와 엑셀 행 수를 검증한다.

입력: docs/index.html의 실제 화면 스크립트와 가상 처리 기록.
반환: unittest 성공·실패 결과.
"""

import json
import subprocess
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parent
HARNESS = r"""
const fs = require('node:fs');
const vm = require('node:vm');
const XLSX = require('./docs/lib/xlsx.full.min.js');
const html = fs.readFileSync('docs/index.html', 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const nodes = new Map();
const element = (id) => {
  if (!nodes.has(id)) nodes.set(id, {
    value: '', innerHTML: '', textContent: '', className: '', listeners: {},
    addEventListener(name, callback) { this.listeners[name] = callback; },
    setAttribute() {},
  });
  return nodes.get(id);
};
const db = { cases: [
  { id: '요구서A.pdf#1', 상태: '확정' },
  { id: '요구서A.pdf#2', 상태: '회신중' },
  { id: '요구서B.pdf#1', 상태: '접수' },
], log: [
  { 일시: '2026-11-10T00:00:00.000Z', 작업: '배분', 문항: '요구서A.pdf#1', 과: '산업정책과' },
  { 일시: '2026-11-10T01:00:00.000Z', 작업: '회신', 문항: '요구서A.pdf#2', 과: '산업정책과' },
  { 일시: '2026-11-10T02:00:00.000Z', 작업: '회신', 문항: '요구서A.pdf#1', 과: '안전정책과' },
  { 일시: '2026-11-10T03:00:00.000Z', 작업: '접수', 문항: '요구서B.pdf#1', 과: '' },
] };
let saved;
const context = {
  document: { getElementById: element },
  Common: { STATUSES: ['접수', '회신중', '확정'], renderNav() {},
    load: async () => db,
    escapeHtml: (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
  },
  Chart: function () {},
  XLSX: { utils: XLSX.utils, writeFile(book, filename) { saved = { book, filename }; } },
};
vm.runInNewContext(script, context);
setImmediate(() => {
  element('log-dept').value = '산업정책과';
  element('log-dept').listeners.change();
  const department = { count: element('log-count').textContent,
    tableRows: (element('log-body').innerHTML.match(/<tr>/g) || []).length };
  element('log-export').listeners.click();
  department.excelRows = XLSX.utils.sheet_to_json(saved.book.Sheets['처리 기록'], { header: 1 }).length - 1;
  department.filename = saved.filename;
  department.firstTime = XLSX.utils.sheet_to_json(saved.book.Sheets['처리 기록'], { header: 1 })[1][0];
  element('log-dept').value = '';
  element('log-case').value = '요구서A.pdf#1';
  element('log-case').listeners.input();
  const prefix = { count: element('log-count').textContent,
    tableRows: (element('log-body').innerHTML.match(/<tr>/g) || []).length,
    hasOtherQuestion: element('log-body').innerHTML.includes('요구서A.pdf#2') };
  process.stdout.write(JSON.stringify({ department, prefix }));
});
"""


class WebLogTest(unittest.TestCase):
    """실제 시작 화면 스크립트를 가상 DOM에서 실행한다."""

    @classmethod
    def setUpClass(cls):
        """Node에서 화면 스크립트를 실행하고 결과를 읽는다.

        매개변수: cls는 시험 클래스.
        반환값: 없음. 실행 결과는 cls.result에 보관한다.
        """
        completed = subprocess.run(
            ["node", "-e", HARNESS], cwd=ROOT, capture_output=True, text=True, encoding="utf-8", check=True
        )
        cls.result = json.loads(completed.stdout)

    def test_department_filter_matches_excel_rows(self):
        """산업정책과 필터의 화면 건수와 엑셀 데이터 행 수를 대조한다.

        매개변수: self는 시험 인스턴스.
        반환값: 없음.
        """
        result = self.result["department"]
        self.assertEqual(result["count"], "2건 / 전체 4건")
        self.assertEqual(result["tableRows"], result["excelRows"])
        self.assertEqual(result["filename"], "처리기록_국회요구자료.xlsx")
        self.assertIn("09:00:00", result["firstTime"])

    def test_question_prefix_filter(self):
        """문항 ID 앞부분 일치 필터가 다른 문항을 제외하는지 확인한다.

        매개변수: self는 시험 인스턴스.
        반환값: 없음.
        """
        result = self.result["prefix"]
        self.assertEqual(result["count"], "2건 / 전체 4건")
        self.assertEqual(result["tableRows"], 2)
        self.assertFalse(result["hasOtherQuestion"])


if __name__ == "__main__":
    unittest.main()
