// 시작·배분·현업 회신 화면이 함께 쓰는 기록 읽기·저장, 자료 읽기, 이동 단추
// 저장 위치: *.vercel.app이면 서버(/api/app), 그 밖에는 이 브라우저(localStorage).
(function (root) {
  'use strict';

  const STORAGE_KEY = '국회요구자료.처리기록.v1';
  const API_PATH = '/api/app';
  const STATUSES = ['접수', '배분확정', '회신중', '회신완료', '확정', '재배정요청', '보완요청'];
  const PAGES = [
    { label: '시작 화면', href: 'index.html' },
    { label: '배분', href: 'assign.html' },
    { label: '현업 회신', href: 'dept.html' },
    { label: '취합', href: null },
  ];
  const MODE_NOTE = {
    server: '저장 위치: 서버(Vercel Blob) · 이 주소를 여는 모든 사람이 같은 기록을 봅니다.',
    local: '저장 위치: 이 브라우저(localStorage) · 이 브라우저에만 저장되며 다른 사람에게 보이지 않습니다.',
  };

  const STYLE = `
    :root { --ink:#1f2933; --muted:#5f6c7b; --line:#d5dbe3; --bg:#f4f6f9; --panel:#fff;
      --brand:#1f4e79; --brand-soft:#e6eef6; --ok:#1d6b45; --ok-soft:#e2f2ea;
      --warn:#8a5a00; --warn-soft:#fdf1d8; --bad:#a32020; --bad-soft:#fbe6e6; }
    * { box-sizing:border-box; }
    body { margin:0; background:var(--bg); color:var(--ink); line-height:1.5;
      font:15px/1.5 "Malgun Gothic","Apple SD Gothic Neo",system-ui,sans-serif; }
    main { max-width:1280px; margin:0 auto; padding:24px 20px 56px; }
    h1 { font-size:22px; margin:0 0 4px; }
    h2 { font-size:17px; margin:0 0 12px; }
    .lead { color:var(--muted); margin:0 0 20px; }
    .nav { display:flex; flex-wrap:wrap; gap:4px; padding:10px 20px; background:var(--brand); }
    .nav a, .nav span { padding:6px 14px; border-radius:6px; color:#fff; text-decoration:none; font-size:14px; }
    .nav a:hover { background:rgba(255,255,255,.16); }
    .nav a[aria-current=page] { background:#fff; color:var(--brand); font-weight:700; }
    .nav span { opacity:.6; }
    .store-note { padding:6px 20px; font-size:13px; border-bottom:1px solid var(--line); }
    .store-note.server { background:var(--ok-soft); color:var(--ok); }
    .store-note.local { background:var(--warn-soft); color:var(--warn); }
    .panel { background:var(--panel); border:1px solid var(--line); border-radius:8px; padding:18px 20px; margin-bottom:18px; }
    button, .file-button { font:inherit; font-size:14px; padding:6px 14px; border-radius:6px; cursor:pointer;
      border:1px solid var(--brand); background:var(--brand); color:#fff; display:inline-block; }
    button.ghost, .file-button { background:#fff; color:var(--brand); }
    .file-button input { position:absolute; width:1px; height:1px; opacity:0; }
    .file-button:focus-within { outline:2px solid #e08a00; outline-offset:1px; }
    button:disabled { border-color:var(--line); background:#eceff3; color:#8a94a0; cursor:not-allowed; }
    :focus-visible { outline:2px solid #e08a00; outline-offset:1px; }
    table { width:100%; border-collapse:collapse; font-size:14px; background:var(--panel); }
    th, td { border-bottom:1px solid var(--line); padding:8px 10px; text-align:left; vertical-align:top; }
    th { background:var(--brand-soft); white-space:nowrap; font-weight:700; }
    .table-wrap { overflow-x:auto; }
    .badge { display:inline-block; padding:1px 8px; border-radius:10px; font-size:12px; white-space:nowrap;
      background:var(--brand-soft); color:var(--brand); }
    .badge.ok { background:var(--ok-soft); color:var(--ok); }
    .badge.warn { background:var(--warn-soft); color:var(--warn); }
    .badge.bad { background:var(--bad-soft); color:var(--bad); }
    .message { margin:10px 0 0; min-height:1.5em; color:var(--muted); }
    .message.error { color:var(--bad); font-weight:700; }
  `;

  // ?storage=server 또는 ?storage=local로 저장 위치를 바꿔 시험할 수 있다(로컬에서 서버 모드 확인용).
  function storageMode() {
    const forced = new URLSearchParams(location.search).get('storage');
    if (forced === 'server' || forced === 'local') return forced;
    return /\.vercel\.app$/i.test(location.hostname) ? 'server' : 'local';
  }

  const mode = storageMode();
  let orgPromise = null;

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]
    ));
  }

  async function readCsv(path) {
    const response = await fetch(path);
    if (!response.ok) throw new Error(`CSV 읽기 실패: ${path} (${response.status})`);
    return root.ClassificationEngine.parseCsv(await response.text());
  }

  // 조직도(과 이름 목록). 브라우저 저장 모드에서 flow.apply가 쓴다.
  function loadOrg() {
    orgPromise = orgPromise || readCsv('data/A부_조직도_26개과.csv');
    return orgPromise;
  }

  async function callApi(method, body) {
    let response;
    try {
      response = await fetch(API_PATH, {
        method,
        ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
      });
    } catch (error) {
      throw new Error(`서버에 연결하지 못했습니다: ${error.message}`);
    }
    let data = null;
    try {
      data = await response.json();
    } catch {
      data = null;
    }
    return { code: response.status, body: data };
  }

  // 기록 전체({cases, log})를 읽는다. 실패하면 오류를 던진다.
  async function load() {
    if (mode === 'server') {
      const { code, body } = await callApi('GET');
      if (code !== 200 || !body || !Array.isArray(body.cases)) {
        throw new Error((body && body.error) || `서버 응답 오류 (${code})`);
      }
      return body;
    }
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : { cases: [], log: [] };
  }

  // 요청 1건을 처리하고 {code, body}를 돌려준다. 서버 모드는 /api/app에, 브라우저 저장 모드는
  // 같은 flow.apply에 맡기므로 두 방식의 상태 규칙과 오류 코드가 같다.
  async function dispatch(request) {
    if (mode === 'server') return callApi('POST', request);
    const db = await load();
    const org = await loadOrg();
    const result = root.Flow.apply(db, JSON.parse(JSON.stringify(request)), org);
    if (result.code === 200) localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    return result;
  }

  function renderNav(current) {
    const style = document.createElement('style');
    style.textContent = STYLE;
    document.head.append(style);
    const links = PAGES.map((page) => {
      if (!page.href) return `<span title="준비 중">${page.label} (준비 중)</span>`;
      const mark = page.href === current ? ' aria-current="page"' : '';
      return `<a href="${page.href}${mode === 'local' && !location.search.includes('storage=') ? '' : location.search}"${mark}>${page.label}</a>`;
    }).join('');
    document.body.insertAdjacentHTML('afterbegin',
      `<nav class="nav" aria-label="화면 이동">${links}</nav>`
      + `<div class="store-note ${mode}" role="status">${MODE_NOTE[mode]}</div>`);
  }

  root.Common = { mode, STATUSES, load, dispatch, readCsv, escapeHtml, renderNav };
})(globalThis);
