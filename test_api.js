// /api/app을 가짜 저장소로 시험한다. 실제 Vercel Blob에는 접속하지 않는다.
// 실행: node test_api.js
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const org = require('./docs/api/org.json');
const flow = require('./docs/flow.js');

const results = [];

function check(name, ok, detail = '') {
  results.push({ 시험: name, 결과: ok ? 'PASS' : 'FAIL', 상세: ok ? '' : detail });
}

// 메모리에 두는 가짜 저장소. 읽기·쓰기 횟수를 센다.
function fakeStore(initial = null) {
  const store = {
    data: initial, reads: 0, writes: 0, fail: false,
    async read() {
      if (store.fail) throw new Error('접속 정보: 비밀값이 들어 있는 오류 메시지');
      store.reads += 1;
      return store.data ? JSON.parse(JSON.stringify(store.data)) : null;
    },
    async write(db) {
      store.writes += 1;
      store.data = JSON.parse(JSON.stringify(db));
    },
  };
  return store;
}

async function main() {
  const { createHandler } = await import(pathToFileURL(path.join(__dirname, 'docs', 'server.mjs')).href);
  const store = fakeStore();
  const handle = createHandler(store, org);
  const call = async (method, body, raw) => {
    const request = new Request('http://localhost/api/app', {
      method, ...(method === 'POST' ? { body: raw ?? JSON.stringify(body), headers: { 'Content-Type': 'application/json' } } : {}),
    });
    const response = await handle(request);
    return { code: response.status, body: await response.json(), headers: response.headers };
  };
  const post = (body) => call('POST', body);
  const writesBefore = () => store.writes;
  const expectError = async (name, body, code, expectedWrites = writesBefore()) => {
    const r = await post(body);
    check(name, r.code === code && store.writes === expectedWrites && typeof r.body.error === 'string',
      `응답 ${r.code} ${JSON.stringify(r.body)} / 쓰기 ${store.writes}`);
    return r;
  };

  const base = { 파일명: '요구서_K.pdf', 위원회: '기획재정위원회', 의원: '의원K', 제출기한: '2026-10-13', 요구내용: '신산업 관련 현황', 세부항목: '', 비고: '' };
  const intake = (extra = {}) => ({
    작업: '접수',
    문항: [
      { ...base, 문항번호: '1', 후보: [{ 과: '산업정책과', 점수: 2.3, 근거키워드: '신산업' }], 확인필요: '', ...extra },
      { ...base, 문항번호: '2', 요구내용: '교량 관련 현황', 후보: [], 확인필요: '미매칭' },
    ],
  });
  const id1 = '요구서_K.pdf#1';
  const id2 = '요구서_K.pdf#2';

  // ---- 조회·접수 ----
  let r = await call('GET');
  check('빈 저장소 GET → 빈 기록', r.code === 200 && r.body.cases.length === 0 && r.body.log.length === 0, JSON.stringify(r.body));
  check('응답은 캐시하지 않음', r.headers.get('cache-control') === 'no-store');

  r = await post(intake({ 이름: '홍길동', 연락처: '010-0000-0000', 주민번호: '000000-0000000' }));
  check('접수 200: 2문항 등록', r.code === 200 && r.body.등록 === 2 && r.body.건너뜀 === 0, JSON.stringify(r.body));
  const stored = (await call('GET')).body.cases[0];
  check('design.md에 없는 값(이름·연락처)은 저장하지 않음',
    !('이름' in stored) && !('연락처' in stored) && !('주민번호' in stored) && stored.상태 === '접수' && stored.id === id1,
    JSON.stringify(stored));
  const w = store.writes;
  r = await post(intake());
  check('같은 문항 다시 접수 → 건너뜀(저장 내용 유지)', r.code === 200 && r.body.등록 === 0 && r.body.건너뜀 === 2, JSON.stringify(r.body));

  await expectError('접수: 문항 목록 없음 400', { 작업: '접수' }, 400);
  await expectError('접수: 요구내용 없음 400', { 작업: '접수', 문항: [{ ...base, 문항번호: '9', 요구내용: '' }] }, 400);
  await expectError('접수: 후보에 조직도 밖 과 400', { 작업: '접수', 문항: [{ ...base, 문항번호: '9', 후보: [{ 과: '없는과' }] }] }, 400);

  // ---- 배분 ----
  await expectError('접수 상태에서 회신 → 409', { 작업: '회신', id: id1, 과: '산업정책과', 파일명: 'a.xlsx', 행: [] }, 409);
  await expectError('접수 상태에서 재배정요청 → 409', { 작업: '재배정요청', id: id1, 과: '산업정책과', 사유: '소관 아님' }, 409);
  await expectError('배분: 조직도 밖 주관 과 400', { 작업: '배분', id: id1, 주관과: '없는과', 협조과: [], 확정방법: '규칙' }, 400);
  await expectError('배분: 조직도 밖 협조 과 400', { 작업: '배분', id: id1, 주관과: '산업정책과', 협조과: ['없는과'], 확정방법: '규칙' }, 400);
  await expectError('배분: 주관 과 없음 400', { 작업: '배분', id: id1, 협조과: [], 확정방법: '규칙' }, 400);
  await expectError('배분: 확정방법 없음 400', { 작업: '배분', id: id1, 주관과: '산업정책과', 협조과: [] }, 400);
  await expectError('배분: 확정방법이 규칙·AI·수정이 아니면 400', { 작업: '배분', id: id1, 주관과: '산업정책과', 협조과: [], 확정방법: '임의' }, 400);
  await expectError('배분: 없는 문항 404', { 작업: '배분', id: '없는문항', 주관과: '산업정책과', 협조과: [], 확정방법: '규칙' }, 404);

  r = await post({ 작업: '배분', id: id1, 주관과: '산업정책과', 협조과: ['안전정책과', '산업정책과', '안전정책과'], 확정방법: '규칙' });
  check('배분 200: 배분확정, 협조 과에서 주관 과·중복 제거',
    r.code === 200 && r.body.상태 === '배분확정' && JSON.stringify(r.body.문항.협조과) === JSON.stringify(['안전정책과']) && r.body.문항.확정방법 === '규칙',
    JSON.stringify(r.body));
  r = await post({ 작업: '배분', id: id1, 주관과: '산업정책과', 협조과: ['안전정책과'], 확정방법: '수정' });
  check('배분확정 상태에서 다시 배분(재확정) 가능', r.code === 200 && r.body.문항.확정방법 === '수정');

  // ---- 회신 ----
  const reply = (dept, extra = {}) => ({ 작업: '회신', id: id1, 과: dept, 파일명: `${dept}.xlsx`, 머리글: ['연도', '예산(천원)'], 행: [[2025, 100]], 메모: '', 확인필요: [], ...extra });
  await expectError('담당 아닌 과의 회신 → 403', reply('지역정책과'), 403);
  const forbidden = await post(reply('지역정책과'));
  check('403 메시지에 과 이름 포함', forbidden.body.error === '지역정책과는 이 문항의 담당 과가 아님', forbidden.body.error);
  await expectError('회신: 조직도 밖 과 400', reply('없는과'), 400);
  await expectError('회신: 파일명 없음 400', reply('산업정책과', { 파일명: '' }), 400);
  await expectError('회신: 행 형식 오류 400', reply('산업정책과', { 행: '문자열' }), 400);

  r = await post(reply('산업정책과', { 메모: '자료 없음', 확인필요: [{ 항목: '연도 누락', 내용: '2023년 행이 없습니다.', 이름: '홍길동' }] }));
  check('일부 과만 회신하면 회신중', r.code === 200 && r.body.상태 === '회신중', JSON.stringify(r.body));
  check('회신 내용의 이름 같은 값은 버림', !('이름' in r.body.문항.회신.산업정책과.확인필요[0]) && r.body.문항.회신.산업정책과.메모 === '자료 없음');
  await expectError('회신중 상태에서 배분 → 409', { 작업: '배분', id: id1, 주관과: '산업정책과', 협조과: [], 확정방법: '규칙' }, 409);
  r = await post(reply('안전정책과'));
  check('모든 과가 회신하면 회신완료', r.code === 200 && r.body.상태 === '회신완료', JSON.stringify(r.body));
  await expectError('회신완료 상태에서 회신 → 409', reply('산업정책과'), 409);
  await expectError('회신완료 상태에서 재배정요청 → 409', { 작업: '재배정요청', id: id1, 과: '산업정책과', 사유: '소관 아님' }, 409);

  // ---- 재배정요청·재배분 ----
  await post({ 작업: '배분', id: id2, 주관과: '시설안전과', 협조과: [], 확정방법: '수정' });
  const re = (extra) => ({ 작업: '재배정요청', id: id2, 과: '시설안전과', 사유: '소관 아님', 희망과: '재난대응과', ...extra });
  await expectError('재배정요청: 사유 없음 400', re({ 사유: '  ' }), 400);
  await expectError('재배정요청: 조직도 밖 희망 과 400', re({ 희망과: '없는과' }), 400);
  await expectError('재배정요청: 담당 아닌 과 403', re({ 과: '재난대응과' }), 403);
  r = await post(re());
  check('재배정요청 200: 상태 재배정요청, 사유·희망 과 기록',
    r.code === 200 && r.body.상태 === '재배정요청' && r.body.문항.재배정[0].사유 === '소관 아님' && r.body.문항.재배정[0].희망과 === '재난대응과');
  r = await post({ 작업: '배분', id: id2, 주관과: '재난대응과', 협조과: [], 확정방법: '수정' });
  check('재배정요청 후 다시 배분 가능, 재배정 이력은 남음', r.code === 200 && r.body.상태 === '배분확정' && r.body.문항.재배정.length === 1);

  // ---- 그 밖의 거부 ----
  for (const action of ['보완요청', '확정']) {
    await expectError(`'${action}'은 아직 지원하지 않음 400`, { 작업: action, id: id1 }, 400);
  }
  // OpenAI 응답을 가짜로 주입해 실제 네트워크·Blob에 연결하지 않고 세 결과를 확인한다.
  const aiStore = fakeStore();
  let sent;
  let fakeContent = '';
  const aiHandle = createHandler(aiStore, org, {
    apiKey: 'fake-test-key',
    fetch: async (url, init) => {
      sent = { url, init };
      return { ok: true, json: async () => ({ choices: [{ message: { content: fakeContent } }] }) };
    },
  });
  const aiPost = async (handler) => {
    const response = await handler(new Request('http://localhost/api/app', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 작업: 'AI추천', 요구내용: '신산업 현황' }),
    }));
    return { code: response.status, body: await response.json() };
  };
  fakeContent = JSON.stringify({ 후보: [{ 과: '산업정책과', 근거: '신산업 정책을 담당합니다.' }, { 과: '안전정책과', 근거: '안전 정책을 담당합니다.' }], 해당없음: false });
  let ai = await aiPost(aiHandle);
  const payload = JSON.parse(sent.init.body);
  check('AI추천: 조직도 안 후보·Chat Completions 설정', ai.code === 200 && ai.body.후보.length === 2 && !ai.body.해당없음
    && sent.url.endsWith('/chat/completions') && payload.model === 'gpt-4o-mini' && payload.temperature === 0
    && payload.response_format.type === 'json_object' && aiStore.reads === 0 && aiStore.writes === 0, JSON.stringify(ai.body));
  fakeContent = JSON.stringify({ 후보: [{ 과: '없는과', 근거: '잘못된 과입니다.' }, { 과: '산업정책과', 근거: '신산업 정책을 담당합니다.' }, { 과: '산업정책과', 근거: '중복입니다.' }], 해당없음: false });
  ai = await aiPost(aiHandle);
  check('AI추천: 조직도 밖 과·중복 제거', ai.code === 200 && ai.body.후보.length === 1 && ai.body.후보[0].과 === '산업정책과', JSON.stringify(ai.body));
  fakeContent = JSON.stringify({ 후보: [], 해당없음: true });
  ai = await aiPost(aiHandle);
  check('AI추천: 후보 없으면 해당없음', ai.code === 200 && ai.body.후보.length === 0 && ai.body.해당없음 === true, JSON.stringify(ai.body));
  ai = await aiPost(createHandler(aiStore, org, { apiKey: '' }));
  check('AI추천: 환경변수 없으면 500과 안내', ai.code === 500 && ai.body.error.includes('OPENAI_API_KEY'), JSON.stringify(ai.body));
  await expectError('알 수 없는 작업 400', { 작업: '삭제', id: id1 }, 400);
  await expectError('작업 없음 400', { id: id1 }, 400);
  const before = store.writes;
  r = await call('POST', null, '{깨진 JSON');
  check('JSON이 아닌 본문 400', r.code === 400 && store.writes === before);
  r = await call('DELETE');
  check('GET·POST 외 방식 405', r.code === 405 && r.headers.get('allow') === 'GET, POST');

  // ---- 저장소 오류 ----
  const broken = fakeStore();
  broken.fail = true;
  const brokenHandle = createHandler(broken, org);
  const response = await brokenHandle(new Request('http://localhost/api/app', { method: 'GET' }));
  const body = await response.json();
  check('저장소 오류 500, 오류 상세는 응답에 넣지 않음', response.status === 500 && !JSON.stringify(body).includes('비밀값'), JSON.stringify(body));

  // ---- flow.apply 직접 ----
  const db = { cases: [], log: [] };
  const t0 = '2026-10-01T09:00:00.000Z';
  flow.apply(db, { 작업: '접수', 문항: [{ ...base, 문항번호: '1' }] }, org, { now: t0 });
  flow.apply(db, { 작업: '배분', id: id1, 주관과: '산업정책과', 협조과: [], 확정방법: '규칙' }, org, { now: t0 });
  let direct = flow.apply(db, { 작업: '재배정요청', id: id1, 과: '산업정책과', 사유: '소관 아님' }, org, { now: '2026-10-01T09:30:00.000Z' });
  check('배분 후 2시간 이내 재배정요청: 경과 false', direct.code === 200 && direct.body.문항.재배정[0].경과 === false);
  db.cases[0].상태 = '배분확정';
  direct = flow.apply(db, { 작업: '재배정요청', id: id1, 과: '산업정책과', 사유: '소관 아님' }, org, { now: '2026-10-01T12:00:00.000Z' });
  check('2시간이 지난 재배정요청: 막지 않고 경과 true로 기록', direct.code === 200 && direct.body.문항.재배정[1].경과 === true);
  check('조직도는 과 이름 목록으로도 받음', flow.apply({ cases: [], log: [] }, { 작업: '접수', 문항: [{ ...base, 문항번호: '1', 후보: [{ 과: 'A과' }] }] }, ['A과']).code === 200);

  console.table(results);
  const failed = results.filter((item) => item.결과 === 'FAIL');
  console.log(`통과 ${results.length - failed.length} / 전체 ${results.length}`);
  if (failed.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
