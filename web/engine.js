(function (root) {
  'use strict';

  let rules = null;
  let departments = null;

  function parseCsv(text) {
    const rows = [];
    let row = [];
    let cell = '';
    let quoted = false;
    const source = text.replace(/^\uFEFF/, '');
    for (let i = 0; i < source.length; i += 1) {
      const char = source[i];
      if (char === '"' && quoted && source[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') {
        quoted = !quoted;
      } else if (char === ',' && !quoted) {
        row.push(cell);
        cell = '';
      } else if ((char === '\n' || char === '\r') && !quoted) {
        if (char === '\r' && source[i + 1] === '\n') i += 1;
        row.push(cell);
        if (row.some((value) => value !== '')) rows.push(row);
        row = [];
        cell = '';
      } else {
        cell += char;
      }
    }
    row.push(cell);
    if (row.some((value) => value !== '')) rows.push(row);
    const headers = rows.shift();
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
