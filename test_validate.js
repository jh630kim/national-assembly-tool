// 회신·접수대장 점검과 보완·확정 상태 전이를 가상 자료로 시험한다.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Check = require('./docs/check.js');
const Validate = require('./docs/validate.js');
const Flow = require('./docs/flow.js');
const Engine = require('./docs/engine.js');
const org = require('./docs/api/org.json');

let passed = 0;
function test(name, fn) { fn(); passed += 1; process.stdout.write(`PASS ${name}\n`); }

const item = { 파일명: '요구서.pdf', 위원회: '기획재정위원회', 의원: '의원K', 문항번호: '1', 요구내용: '최근 2년간 예산 현황', 제출기한: '2026-10-12',
  주관과: '산업정책과', 협조과: ['안전정책과'], 상태: '회신중', id: '요구서.pdf#1' };
const table = [
  ['의원K 문항1 최근 2년간 예산 현황'],
  ['연도', '예산(천원)', '집행액(천원)', '비고'],
  [2025, 100, 120, ''],
  ['합계', 90, 120, ''],
];
test('회신 1행·2행과 연도·집행액·합계 점검, 원본 유지', () => {
  const before = JSON.stringify(table);
  const result = Check.inspect(table, item);
  assert.deepEqual(new Set(result.확인필요.map((entry) => entry.항목)), new Set(['연도 누락', '집행액 초과', '합계 불일치']));
  assert.equal(JSON.stringify(table), before);
});
test('회신 요구 표시와 머리글 오류', () => {
  const result = Check.inspect([['다른 의원 문항2'], ['연도'], [2025]], item);
  assert(result.확인필요.some((entry) => entry.항목 === '요구 표시'));
  assert(result.확인필요.some((entry) => entry.항목 === '열 구성'));
});
test('접수대장 120행 점검과 원본 유지', () => {
  const csv = fs.readFileSync('data/검증용_접수대장_120건.csv', 'utf8').replace(/^\uFEFF/, '');
  const rows = Engine.parseCsv(csv);
  const before = JSON.stringify(rows);
  const result = Validate.inspectLedger(rows, org, '2026-11-11');
  assert.equal(rows.length, 120);
  assert(result.확인필요.length > 0);
  assert(result.점검불가.some((entry) => entry.includes('합계 불일치')));
  assert.equal(JSON.stringify(rows), before);
});
test('접수대장 필수 항목·중복·조직도·기간·기한·표기', () => {
  const rows = [
    { 접수번호: '2026-0001', 문항번호: '1', 요구내용: '최근 2년 현황', 요구기간_시작: '2021', 요구기간_끝: '2026', 접수일: '2026-11-01', 제출기한: '2026-10-01', 배분과: '없는과', 위원회: ' 기획재정위원회' },
    { 접수번호: '2026-0001', 문항번호: '1', 요구내용: '현황', 요구기간_시작: '2026', 요구기간_끝: '2025', 접수일: '2026-10-01', 제출기한: '2026-10-02', 배분과: '산업정책과' },
    { 접수번호: '2026-0002', 문항번호: '', 요구내용: '', 요구기간_시작: '', 요구기간_끝: '', 배분과: '' },
  ];
  const checks = new Set(Validate.inspectLedger(rows, org, '2026-10-01').확인필요.map((entry) => entry.항목));
  for (const name of ['문항 누락', '요구기간 연도 누락', '조직도 밖 부서명', '기간 역전', '기한 경과', '중복 접수', '표기 불일치']) assert(checks.has(name), name);
});
test('과별 확인필요와 미회신 과 표시', () => {
  const checks = Validate.inspectCase({ ...item, 회신: { 산업정책과: { 확인필요: [{ 항목: '연도 누락', 내용: '2026년 없음' }] } } });
  assert(checks.some((entry) => entry.항목 === '문항 회신 누락'));
  assert(checks.some((entry) => entry.과 === '산업정책과'));
});
test('보완요청은 대상 과만 재회신하고 이력을 보존', () => {
  const record = { ...item, 상태: '회신완료', 회신: { 산업정책과: { 확인필요: [] }, 안전정책과: { 확인필요: [] } } };
  const db = { cases: [record], log: [] };
  const request = { 작업: '보완요청', id: item.id, 과: '산업정책과', 사유: '숫자 확인' };
  assert.equal(Flow.apply(db, request, org).code, 200);
  assert.equal(record.상태, '보완요청');
  assert.equal(Flow.apply(db, { 작업: '회신', id: item.id, 과: '안전정책과', 파일명: 'a.xlsx', 행: [] }, org).code, 403);
  assert.equal(Flow.apply(db, { 작업: '회신', id: item.id, 과: '산업정책과', 파일명: 'b.xlsx', 행: [], 확인필요: [] }, org).code, 200);
  assert.equal(record.상태, '회신완료');
  assert.equal(record.보완.length, 1);
});
test('확정은 코멘트가 필요하고 회신완료에서만 가능', () => {
  const record = { ...item, 상태: '회신완료' };
  const db = { cases: [record], log: [] };
  assert.equal(Flow.apply(db, { 작업: '확정', id: item.id, 코멘트: '' }, org).code, 400);
  assert.equal(Flow.apply(db, { 작업: '확정', id: item.id, 코멘트: '원본 대조 완료' }, org).code, 200);
  assert.equal(record.확정코멘트, '원본 대조 완료');
  assert.equal(record.상태, '확정');
  assert.equal(Flow.apply(db, { 작업: '확정', id: item.id, 코멘트: '다시' }, org).code, 409);
});
process.stdout.write(`통과 ${passed} / 전체 ${passed}\n`);
