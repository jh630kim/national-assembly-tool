// 문항 처리 상태 규칙(design.md). 브라우저 저장과 서버(api/app)가 같은 파일을 쓴다.
// apply(db, 요청, 조직도)가 db를 바꾸고 {code, body}를 돌려준다. 검증을 모두 마친 뒤에만 db를 바꾼다.
(function (root) {
  'use strict';

  // design.md에 있는 값만 저장한다. 이름·연락처처럼 여기 없는 값은 버린다.
  // id, 확인필요(동순위·미매칭 표시), 회신.머리글(과별 열 구성 비교)은 화면이 쓰는 값이라 함께 둔다.
  const INTAKE_FIELDS = ['파일명', '위원회', '의원', '제출기한', '문항번호', '요구내용', '세부항목', '비고'];
  const METHODS = ['규칙', 'AI', '수정'];
  const CHECK_MARKS = ['', '동순위', '미매칭'];
  // design.md 상태표: 작업마다 허용되는 현재 상태
  const ASSIGNABLE = ['접수', '재배정요청', '배분확정'];
  const REPLYABLE = ['배분확정', '회신중', '보완요청'];
  const REASSIGNABLE = ['배분확정', '회신중', '보완요청'];
  // 이후 단계(S7·S8)에서 같은 파일에 추가한다.
  const LATER_STAGE = ['AI추천'];
  const TWO_HOURS = 2 * 60 * 60 * 1000;
  const MAX_INTAKE = 500;
  const MAX_ROWS = 5000;

  function fail(code, error) {
    return { code, body: { error } };
  }

  function text(value) {
    return typeof value === 'string' ? value.trim() : '';
  }

  function orgNames(org) {
    return new Set((org || []).map((item) => (typeof item === 'string' ? item : item.과)));
  }

  function copy(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function owners(item) {
    return [item.주관과, ...item.협조과].filter(Boolean);
  }

  // 후보는 {과, 점수, 근거키워드}만 남긴다. 조직도 밖 과가 있으면 null을 돌려준다.
  function cleanCandidates(list, names) {
    if (list === undefined) return [];
    if (!Array.isArray(list)) return null;
    const cleaned = [];
    for (const entry of list) {
      if (!entry || !names.has(text(entry.과))) return null;
      cleaned.push({ 과: text(entry.과), 점수: Number(entry.점수) || 0, 근거키워드: text(entry.근거키워드) });
    }
    return cleaned;
  }

  function intake(db, request, names, now) {
    const list = request.문항;
    if (!Array.isArray(list) || !list.length) return fail(400, '문항 목록이 필요합니다.');
    if (list.length > MAX_INTAKE) return fail(400, `한 번에 ${MAX_INTAKE}문항까지 접수할 수 있습니다.`);
    const known = new Set(db.cases.map((item) => item.id));
    const staged = [];
    for (const [index, row] of list.entries()) {
      if (!row || !text(row.파일명) || !text(String(row.문항번호 ?? '')) || !text(row.요구내용)) {
        return fail(400, `${index + 1}번째 문항에 파일명·문항번호·요구내용이 필요합니다.`);
      }
      const candidates = cleanCandidates(row.후보, names);
      if (!candidates) return fail(400, `${index + 1}번째 문항의 후보에 조직도 밖 과가 있습니다.`);
      const item = {};
      for (const field of INTAKE_FIELDS) item[field] = String(row[field] ?? '').trim();
      item.id = `${item.파일명}#${item.문항번호}`;
      Object.assign(item, {
        상태: '접수', 주관과: '', 협조과: [], 확정방법: '', 후보: candidates,
        확인필요: CHECK_MARKS.includes(row.확인필요) ? row.확인필요 : '', 일시: now,
      });
      staged.push(item);
    }
    let added = 0;
    for (const item of staged) {
      if (known.has(item.id)) continue;
      known.add(item.id);
      db.cases.push(item);
      db.log.push({ 일시: now, 작업: '접수', 문항: item.id, 과: '' });
      added += 1;
    }
    return { code: 200, body: { ok: true, 등록: added, 건너뜀: staged.length - added } };
  }

  // 요청에서 문항을 찾는다. 없으면 오류 결과를 돌려준다.
  function findCase(db, request) {
    const id = text(request.id);
    if (!id) return { error: fail(400, '문항 id가 필요합니다.') };
    const item = db.cases.find((entry) => entry.id === id);
    return item ? { item } : { error: fail(404, `문항을 찾을 수 없습니다: ${id}`) };
  }

  function wrongState(item, action, allowed) {
    return allowed.includes(item.상태) ? null
      : fail(409, `현재 상태(${item.상태})에서는 ${action}할 수 없습니다.`);
  }

  function assign(db, request, names, now) {
    const found = findCase(db, request);
    if (found.error) return found.error;
    const item = found.item;
    const main = text(request.주관과);
    if (!main) return fail(400, '주관 과가 필요합니다.');
    if (!names.has(main)) return fail(400, `조직도에 없는 과입니다: ${main}`);
    if (request.협조과 !== undefined && !Array.isArray(request.협조과)) return fail(400, '협조과는 목록이어야 합니다.');
    const helpers = [...new Set((request.협조과 || []).map(text).filter(Boolean))];
    const outside = helpers.find((name) => !names.has(name));
    if (outside) return fail(400, `조직도에 없는 과입니다: ${outside}`);
    if (!METHODS.includes(request.확정방법)) return fail(400, `확정방법은 ${METHODS.join('·')} 중 하나여야 합니다.`);
    const state = wrongState(item, '배분', ASSIGNABLE);
    if (state) return state;
    item.주관과 = main;
    item.협조과 = helpers.filter((name) => name !== main);
    item.확정방법 = request.확정방법;
    item.상태 = '배분확정';
    item.일시 = now;
    // 재배분 이력과 이전 회신은 지우지 않는다(처리지침 제3장 제5조).
    db.log.push({ 일시: now, 작업: '배분', 문항: item.id, 과: main, 협조과: item.협조과, 확정방법: item.확정방법 });
    return { code: 200, body: { ok: true, 상태: item.상태, 문항: copy(item) } };
  }

  function cleanChecks(list) {
    if (!Array.isArray(list)) return [];
    return list.map((entry) => ({ 항목: text(entry && entry.항목), 내용: text(entry && entry.내용) }));
  }

  function reply(db, request, names, now) {
    const found = findCase(db, request);
    if (found.error) return found.error;
    const item = found.item;
    const dept = text(request.과);
    if (!dept) return fail(400, '회신하는 과가 필요합니다.');
    if (!names.has(dept)) return fail(400, `조직도에 없는 과입니다: ${dept}`);
    if (!text(request.파일명)) return fail(400, '회신 파일명이 필요합니다.');
    if (!Array.isArray(request.행) || request.행.length > MAX_ROWS) return fail(400, `회신 행은 ${MAX_ROWS}행 이하의 목록이어야 합니다.`);
    const state = wrongState(item, '회신', REPLYABLE);
    if (state) return state;
    if (!owners(item).includes(dept)) return fail(403, `${dept}는 이 문항의 담당 과가 아님`);
    if (item.상태 === '보완요청' && item.보완대상 !== dept) return fail(403, `${dept}는 보완 요청 대상 과가 아님`);
    item.회신 = item.회신 || {};
    item.회신[dept] = {
      파일명: text(request.파일명),
      머리글: Array.isArray(request.머리글) ? request.머리글.map((name) => String(name)) : [],
      행: copy(request.행),
      메모: text(request.메모),
      확인필요: cleanChecks(request.확인필요),
      일시: now,
    };
    // 주관·협조로 지정된 과가 모두 회신해야 회신완료가 된다.
    item.상태 = owners(item).every((name) => item.회신[name]) ? '회신완료' : '회신중';
    if (item.보완대상 === dept) item.보완대상 = '';
    item.일시 = now;
    db.log.push({ 일시: now, 작업: '회신', 문항: item.id, 과: dept, 파일명: item.회신[dept].파일명, 확인필요: item.회신[dept].확인필요.length });
    return { code: 200, body: { ok: true, 상태: item.상태, 문항: copy(item) } };
  }

  function reassign(db, request, names, now) {
    const found = findCase(db, request);
    if (found.error) return found.error;
    const item = found.item;
    const dept = text(request.과);
    if (!dept) return fail(400, '요청하는 과가 필요합니다.');
    if (!names.has(dept)) return fail(400, `조직도에 없는 과입니다: ${dept}`);
    const reason = text(request.사유);
    if (!reason) return fail(400, '재배정 사유가 필요합니다.');
    const wish = text(request.희망과);
    if (wish && !names.has(wish)) return fail(400, `조직도에 없는 과입니다: ${wish}`);
    const state = wrongState(item, '재배정을 요청', REASSIGNABLE);
    if (state) return state;
    if (!owners(item).includes(dept)) return fail(403, `${dept}는 이 문항의 담당 과가 아님`);
    // 배분 후 2시간이 지났는지 기록한다(막지는 않는다).
    const assigned = db.log.filter((entry) => entry.작업 === '배분' && entry.문항 === item.id).at(-1);
    const late = Boolean(assigned) && new Date(now) - new Date(assigned.일시) > TWO_HOURS;
    item.재배정 = item.재배정 || [];
    item.재배정.push({ 과: dept, 사유: reason, 희망과: wish, 일시: now, 경과: late });
    item.상태 = '재배정요청';
    item.일시 = now;
    db.log.push({ 일시: now, 작업: '재배정요청', 문항: item.id, 과: dept, 사유: reason, 희망과: wish });
    return { code: 200, body: { ok: true, 상태: item.상태, 문항: copy(item) } };
  }

  function supplement(db, request, names, now) {
    const found = findCase(db, request);
    if (found.error) return found.error;
    const item = found.item;
    const state = wrongState(item, '보완을 요청', ['회신중', '회신완료']);
    if (state) return state;
    const dept = text(request.과);
    const reason = text(request.사유);
    if (!names.has(dept) || !owners(item).includes(dept) || !item.회신?.[dept]) return fail(400, '회신한 담당 과를 선택하세요.');
    if (!reason) return fail(400, '보완 사유가 필요합니다.');
    item.보완 = item.보완 || [];
    item.보완.push({ 과: dept, 사유: reason, 일시: now });
    item.보완대상 = dept;
    item.상태 = '보완요청';
    item.일시 = now;
    db.log.push({ 일시: now, 작업: '보완요청', 문항: item.id, 과: dept, 사유: reason });
    return { code: 200, body: { ok: true, 상태: item.상태, 문항: copy(item) } };
  }

  function confirm(db, request, names, now) {
    const found = findCase(db, request);
    if (found.error) return found.error;
    const item = found.item;
    const state = wrongState(item, '확정', ['회신완료']);
    if (state) return state;
    const comment = text(request.코멘트);
    if (!comment) return fail(400, '확정 코멘트가 필요합니다.');
    item.확정코멘트 = comment;
    item.상태 = '확정';
    item.일시 = now;
    db.log.push({ 일시: now, 작업: '확정', 문항: item.id, 과: '', 코멘트: comment });
    return { code: 200, body: { ok: true, 상태: item.상태, 문항: copy(item) } };
  }

  const ACTIONS = { 접수: intake, 배분: assign, 회신: reply, 재배정요청: reassign, 보완요청: supplement, 확정: confirm };

  // db: {cases, log}, 요청: {작업, ...}, 조직도: 과 이름 목록 또는 {과} 목록, 옵션.now: 시험용 현재 시각
  function apply(db, request, org, options) {
    if (!db || !Array.isArray(db.cases)) return fail(500, '저장된 기록의 형식이 올바르지 않습니다.');
    db.log = Array.isArray(db.log) ? db.log : [];
    if (!request || typeof request !== 'object') return fail(400, '요청이 필요합니다.');
    const action = text(request.작업);
    if (LATER_STAGE.includes(action)) return fail(400, `'${action}'은(는) 아직 지원하지 않는 작업입니다.`);
    if (!ACTIONS[action]) return fail(400, `알 수 없는 작업입니다: ${action || '(없음)'}`);
    const now = new Date((options && options.now) || Date.now()).toISOString();
    return ACTIONS[action](db, request, orgNames(org), now);
  }

  const api = { apply, ASSIGNABLE, REPLYABLE, METHODS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Flow = api;
})(globalThis);
