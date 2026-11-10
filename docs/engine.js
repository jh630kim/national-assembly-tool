(function (root) {
  'use strict';

  let rules = null;
  let departments = null;

  // \uBE0C\uB77C\uC6B0\uC800\uB294 \uD398\uC774\uC9C0\uAC00 \uBD88\uB7EC\uC628 \uC804\uC5ED Papa\uB97C, Node\uB294 lib \uD3F4\uB354\uC758 \uAC19\uC740 \uD30C\uC77C\uC744 \uC4F4\uB2E4.
  const Papa = root.Papa || require('./lib/papaparse/papaparse.min.js');

  // Papa Parse\uB85C CSV\uB97C \uC77D\uB294\uB2E4. \uB530\uC634\uD45C \uC548\uC758 \uC27C\uD45C\u00B7\uC904\uBC14\uAFC8\uACFC BOM\uC744 \uCC98\uB9AC\uD558\uACE0, \uBAA8\uB4E0 \uC5F4\uC774 \uC788\uAC8C \uBE48 \uCE78\uC740 ''\uB85C \uCC44\uC6B4\uB2E4.
  function parseCsv(text) {
    const parsed = Papa.parse(text.replace(/^\uFEFF/, ''), { skipEmptyLines: 'greedy' });
    const [headers, ...rows] = parsed.data;
    return rows.map((values) => Object.fromEntries(
      headers.map((header, index) => [header, values[index] ?? ''])
    ));
  }

  async function readText(source) {
    if (typeof window === 'undefined') {
      return require('node:fs/promises').readFile(source, 'utf8');
    }
    const response = await fetch(source);
    if (!response.ok) throw new Error(`CSV 읽기 실패: ${source} (${response.status})`);
    return response.text();
  }

  async function initialize(ruleSource, orgSource) {
    const [ruleText, orgText] = await Promise.all([
      readText(ruleSource), readText(orgSource),
    ]);
    rules = parseCsv(ruleText);
    departments = new Set(parseCsv(orgText).map((row) => row.과));
  }

  function classify(요구내용) {
    if (!rules || !departments) throw new Error('CSV를 먼저 initialize()로 읽어야 합니다.');
    const candidates = new Map();
    for (const rule of rules) {
      if (!departments.has(rule.과) || !rule.키워드 || !요구내용.includes(rule.키워드)) continue;
      const exclusions = rule.제외어.split('|').map((word) => word.trim()).filter(Boolean);
      // 제외어가 하나라도 있으면 해당 규칙의 점수를 계산하지 않는다.
      if (exclusions.some((word) => 요구내용.includes(word))) continue;
      const score = Number(rule.우선순위) + rule.키워드.length / 10;
      const previous = candidates.get(rule.과);
      if (!previous || score > previous.점수) {
        candidates.set(rule.과, { 과: rule.과, 점수: score, 근거키워드: rule.키워드 });
      }
    }
    return [...candidates.values()].sort((a, b) => b.점수 - a.점수).slice(0, 3);
  }

  const engine = { initialize, classify, parseCsv };
  if (typeof module !== 'undefined' && module.exports) module.exports = engine;
  else root.ClassificationEngine = engine;
})(globalThis);
