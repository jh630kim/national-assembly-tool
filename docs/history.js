// 과거 접수대장에서 1순위 근거 키워드가 든 요구를 찾는다. 참고 정보일 뿐 배분 결과에는 관여하지 않는다.
(function (root) {
  'use strict';

  const RECENT_COUNT = 5;

  let fuse = null;

  // FuseClass는 Fuse.js 생성자이다. 브라우저는 ES 모듈로, Node는 CommonJS로 불러와 넘긴다.
  // 확장 검색의 「'」 연산자는 키워드가 그대로 들어 있는 요구만 찾는다(threshold 0).
  function init(ledgerRows, FuseClass) {
    fuse = new FuseClass(ledgerRows, {
      keys: ['요구내용'], useExtendedSearch: true, threshold: 0, ignoreLocation: true,
    });
  }

  // 키워드가 든 과거 요구의 건수, 가장 많이 배분된 과, 최근 접수 5건을 돌려준다. 없으면 건수 0이다.
  // 건수가 많은 키워드(문형에도 쓰이는 말)는 「주로」 과의 건수가 전체에 비해 작게 나온다.
  function find(keyword) {
    if (!fuse) throw new Error('접수대장을 init()으로 먼저 읽어야 합니다.');
    const word = String(keyword || '').replace(/"/g, '').trim();
    if (!word) return { 키워드: '', 건수: 0, 주로: null, 최근: [] };
    const found = fuse.search(`'"${word}"`).map((result) => result.item);
    if (!found.length) return { 키워드: word, 건수: 0, 주로: null, 최근: [] };
    const counts = new Map();
    for (const item of found) counts.set(item.배분과, (counts.get(item.배분과) || 0) + 1);
    const [과, 건수] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    const recent = [...found]
      .sort((a, b) => b.접수일.localeCompare(a.접수일) || b.접수번호.localeCompare(a.접수번호))
      .slice(0, RECENT_COUNT);
    return { 키워드: word, 건수: found.length, 주로: { 과, 건수 }, 최근: recent };
  }

  const api = { init, find };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PastRequests = api;
})(globalThis);
