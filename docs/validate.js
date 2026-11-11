// 제출 전 확인필요 목록. 입력 행과 회신의 원본 값은 바꾸지 않는다.
(function (root) {
  'use strict';

  const FIELDS = ['접수번호', '접수일', '위원회', '요구의원', '문항번호', '요구내용', '요구기간_시작', '요구기간_끝', '제출기한', '배분과'];
  const issue = (행, 항목, 내용) => ({ 행, 항목, 내용 });

  function inspectLedger(rows, org, today = new Date().toISOString().slice(0, 10)) {
    const names = new Set(org.map((entry) => typeof entry === 'string' ? entry : entry.과));
    const seen = new Set();
    const problems = [];
    const groups = new Map();
    rows.forEach((row, index) => {
      const line = index + 2;
      const number = String(row.접수번호 ?? '').trim();
      const question = String(row.문항번호 ?? '').trim();
      const key = `${number}#${question}`;
      const start = Number(row.요구기간_시작);
      const end = Number(row.요구기간_끝);
      if (!number || !question || !String(row.요구내용 ?? '').trim()) problems.push(issue(line, '문항 누락', '접수번호·문항번호·요구내용을 확인하세요.'));
      if (number && question && seen.has(key)) problems.push(issue(line, '중복 접수', `${key}가 중복됩니다.`));
      seen.add(key);
      if (number && /^\d+$/.test(question)) {
        if (!groups.has(number)) groups.set(number, []);
        groups.get(number).push(Number(question));
      }
      if (!Number.isInteger(start) || !Number.isInteger(end)) problems.push(issue(line, '요구기간 연도 누락', '요구기간 시작·끝 연도를 확인하세요.'));
      else if (start > end) problems.push(issue(line, '기간 역전', `${start}년부터 ${end}년까지로 기록되었습니다.`));
      else {
        const recent = /최근\s*(\d+)\s*년/.exec(row.요구내용 || '');
        if (recent && end - start + 1 !== Number(recent[1])) problems.push(issue(line, '요구기간 연도 누락', `최근 ${recent[1]}년 요구와 ${start}~${end}년 기록이 다릅니다.`));
      }
      const dept = String(row.배분과 ?? '').trim();
      if (!names.has(dept)) problems.push(issue(line, '조직도 밖 부서명', dept || '배분과 없음'));
      if (/^\d{4}-\d{2}-\d{2}$/.test(row.제출기한 || '') && row.접수일 > row.제출기한) {
        problems.push(issue(line, '기한 경과', `접수일 ${row.접수일}이 제출기한 ${row.제출기한} 뒤입니다.`));
      } else if (row.제출기한 && row.제출기한 < today && row.처리상태 !== '제출완료') {
        problems.push(issue(line, '기한 경과', `제출기한 ${row.제출기한}이 지났고 제출완료 기록이 없습니다.`));
      }
      for (const field of FIELDS) {
        const value = String(row[field] ?? '');
        if (value && (value !== value.trim() || / {2,}/.test(value))) problems.push(issue(line, '표기 불일치', `${field}의 앞뒤 또는 연속 공백을 확인하세요.`));
      }
    });
    for (const [number, questions] of groups) {
      const unique = [...new Set(questions)].sort((a, b) => a - b);
      for (let n = unique[0]; n <= unique.at(-1); n += 1) {
        if (!unique.includes(n)) problems.push(issue('', '문항 누락', `${number}의 문항 ${n}번이 없습니다.`));
      }
    }
    return { 확인필요: problems, 점검불가: ['합계 불일치: 접수대장에는 금액·합계 행이 없음', '제출기한 준수 여부: 실제 제출일 열이 없음'] };
  }

  function inspectCase(item) {
    const owners = [item.주관과, ...(item.협조과 || [])].filter(Boolean);
    const missing = owners.filter((name) => !item.회신?.[name]);
    return [
      ...missing.map((name) => ({ 항목: '문항 회신 누락', 내용: `${name}의 회신이 없습니다.` })),
      ...owners.flatMap((name) => (item.회신?.[name]?.확인필요 || []).map((entry) => ({ ...entry, 과: name }))),
    ];
  }

  const api = { inspectLedger, inspectCase };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Validate = api;
})(globalThis);
