// 과거 접수대장에서 비슷한 요구를 찾는다. 참고 정보일 뿐 배분 결과에는 관여하지 않는다.
(function (root) {
  'use strict';

  // 접수대장 요구내용은 정해진 문형에 주제어만 바뀐다. 문장 전체로 비교하면 주제가 달라도
  // 문형이 같은 건이 나오므로, 문형을 걷어 낸 주제어로 비교한다.
  const TEMPLATES = [
    /최근\s*\d+\s*년간/g, /\d{4}\s*년\s*이후/g, /\(최근\s*\d+\s*년\)/g,
    /\(계약명, 금액, 업체, 기간\)/g, /\(세부 항목 포함\)/g,
    /관련 위탁·용역 계약 현황/g, /관련 언론 보도에 대한 부처 입장 및 사실관계/g,
    /관련 내부 검토 문서 및 향후 계획/g, /관련 현황을 연도별로 제출/g,
    /관련 민원·지적사항과 조치 결과/g, /추진 실적 및 예산 집행 내역 일체/g,
    /성과지표 달성도와 미달 사유/g, /담당 인력 현황 및 변동 내역/g,
    /내역을 과별로 구분하여 제출/g, /^부처 내\s+/, /^실·국별\s+/, /\s*내역$/,
  ];
  // 이 점수(0이 완전 일치) 이하만 비슷한 요구로 본다.
  const THRESHOLD = 0.3;
  const SEARCH_LIMIT = 30;
  const RECENT_COUNT = 5;

  let rows = [];
  let fuse = null;

  function topicOf(text) {
    let topic = text;
    for (const pattern of TEMPLATES) topic = topic.replace(pattern, ' ');
    topic = topic.replace(/\s+/g, ' ').trim();
    // 문형이 하나도 맞지 않으면 문장 전체를 주제로 쓴다.
    return topic || text;
  }

  // FuseClass는 Fuse.js 생성자이다. 브라우저는 ES 모듈로, Node는 CommonJS로 불러와 넘긴다.
  function init(ledgerRows, FuseClass) {
    rows = ledgerRows.map((row) => ({ ...row, 주제: topicOf(row.요구내용) }));
    fuse = new FuseClass(rows, {
      keys: ['주제'], includeScore: true, threshold: THRESHOLD, ignoreLocation: true,
    });
  }

  // 비슷한 과거 요구의 건수, 가장 많이 배분된 과, 최근 접수 5건을 돌려준다. 없으면 건수 0이다.
  function find(text) {
    if (!fuse) throw new Error('접수대장을 init()으로 먼저 읽어야 합니다.');
    const topic = topicOf(text);
    const found = fuse.search(topic, { limit: SEARCH_LIMIT }).map((result) => result.item);
    if (!found.length) return { 주제: topic, 건수: 0, 주로: null, 최근: [] };
    const counts = new Map();
    for (const item of found) counts.set(item.배분과, (counts.get(item.배분과) || 0) + 1);
    const [과, 건수] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    const recent = [...found]
      .sort((a, b) => b.접수일.localeCompare(a.접수일) || b.접수번호.localeCompare(a.접수번호))
      .slice(0, RECENT_COUNT);
    return { 주제: topic, 건수: found.length, 주로: { 과, 건수 }, 최근: recent };
  }

  const api = { init, find, topicOf };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PastRequests = api;
})(globalThis);
