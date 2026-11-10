// 부서 회신 표를 처리지침 제4장 기준으로 점검한다. 값은 고치지 않고 「확인필요」로만 남긴다.
(function (root) {
  'use strict';

  const REQUIRED = ['연도', '예산(천원)', '집행액(천원)', '비고'];

  function toNumber(value) {
    const text = String(value ?? '').replace(/,/g, '').trim();
    return text !== '' && Number.isFinite(Number(text)) ? Number(text) : null;
  }

  function isBlank(value) {
    return String(value ?? '').trim() === '';
  }

  // 요구내용의 기간 문구에서 제출해야 할 연도를 구한다. 읽지 못하면 null이다.
  function requiredYears(item) {
    const lastYear = Number(item.제출기한.slice(0, 4));
    const recent = /최근\s*(\d+)\s*년/.exec(item.요구내용);
    const since = /(\d{4})\s*년\s*이후/.exec(item.요구내용);
    let firstYear = null;
    if (recent) firstYear = lastYear - Number(recent[1]) + 1;
    else if (since) firstYear = Number(since[1]);
    if (firstYear === null) return null;
    return Array.from({ length: lastYear - firstYear + 1 }, (_, index) => firstYear + index);
  }

  // 파일 1행의 요구 표시가 이 문항을 가리키는지 본다. 샘플처럼 달라도 막지 않고 알리기만 한다.
  function checkLabel(label, item) {
    const mark = new RegExp(`문항\\s*${item.문항번호}(?!\\d)`).exec(label);
    if (!label.includes(item.의원) || !mark) {
      return `요구 표시의 의원·문항이 이 문항(${item.의원} 문항${item.문항번호})과 다릅니다.`;
    }
    const words = label.slice(mark.index + mark[0].length).split(/\s+/).filter((word) => word.length >= 2);
    const matched = words.filter((word) => item.요구내용.includes(word)).length;
    return matched * 2 < words.length ? '요구 표시의 내용이 이 문항의 요구내용과 다릅니다.' : '';
  }

  function checkHeaders(headers, referenceHeaders) {
    const messages = [];
    const missing = REQUIRED.filter((name) => !headers.includes(name));
    if (missing.length) messages.push(`필수 열이 없습니다: ${missing.join(', ')}`);
    const names = headers.filter((name) => name !== '');
    if (names.length !== headers.length) messages.push('이름이 비어 있는 열이 있습니다.');
    if (new Set(names).size !== names.length) messages.push('이름이 같은 열이 있습니다.');
    if (referenceHeaders && JSON.stringify(headers) !== JSON.stringify(referenceHeaders)) {
      messages.push('먼저 제출된 다른 과의 회신과 열 구성이 다릅니다.');
    }
    return messages;
  }

  function checkYears(item, details, yearIndex) {
    const years = requiredYears(item);
    if (!years) return { 항목: '연도 판정 불가', 내용: '요구내용에서 요구기간을 읽지 못했습니다.' };
    const present = new Set(details.map((row) => toNumber(row[yearIndex])));
    const missing = years.filter((year) => !present.has(year));
    return missing.length ? { 항목: '연도 누락', 내용: `${missing.join(', ')}년 행이 없습니다.` } : null;
  }

  function checkOverspend(details, columns) {
    return details.flatMap((row) => {
      const budget = toNumber(row[columns.예산]);
      const spent = toNumber(row[columns.집행액]);
      if (budget === null || spent === null || spent <= budget || !isBlank(row[columns.비고])) return [];
      return [{ 항목: '집행액 초과', 내용: `${row[columns.연도]}년 집행액 ${spent}이 예산 ${budget}을 넘는데 비고가 없습니다.` }];
    });
  }

  function checkTotals(details, totals, columns) {
    const issues = [];
    for (const total of totals) {
      for (const [name, index] of [['예산', columns.예산], ['집행액', columns.집행액]]) {
        const written = toNumber(total[index]);
        if (index < 0 || written === null) continue;
        const sum = details.reduce((acc, row) => acc + (toNumber(row[index]) ?? 0), 0);
        if (written !== sum) issues.push({ 항목: '합계 불일치', 내용: `${name} 합계 ${written}, 세부 행의 합 ${sum}` });
      }
    }
    return issues;
  }

  // table은 시트의 행 배열이다. 1행은 요구 표시, 2행은 머리글이다(처리지침 별표 3).
  function inspect(table, item, referenceHeaders) {
    const label = String(table[0]?.[0] ?? '').trim();
    const headers = (table[1] ?? []).map((name) => String(name).trim());
    const rows = table.slice(2).filter((row) => row.some((value) => !isBlank(value)));
    const columns = {
      연도: headers.indexOf('연도'),
      예산: headers.indexOf('예산(천원)'),
      집행액: headers.indexOf('집행액(천원)'),
      비고: headers.indexOf('비고'),
    };
    const isTotal = (row) => String(row[columns.연도] ?? '').includes('합계');
    const details = rows.filter((row) => !isTotal(row));
    const totals = rows.filter(isTotal);

    const issues = [];
    const labelMessage = checkLabel(label, item);
    if (labelMessage) issues.push({ 항목: '요구 표시', 내용: labelMessage });
    issues.push(...checkHeaders(headers, referenceHeaders).map((내용) => ({ 항목: '열 구성', 내용 })));
    if (columns.연도 >= 0) {
      const yearIssue = checkYears(item, details, columns.연도);
      if (yearIssue) issues.push(yearIssue);
      issues.push(...checkTotals(details, totals, columns));
    }
    if (Object.values(columns).every((index) => index >= 0)) issues.push(...checkOverspend(details, columns));
    return { 요구표시: label, 머리글: headers, 행: rows, 확인필요: issues };
  }

  const api = { inspect, requiredYears };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ReplyCheck = api;
})(globalThis);
