// 자료요구서의 글자 줄을 문항 행으로 나눈다. split.py와 같은 규칙을 쓴다.
(function (root) {
  'use strict';

  const COLUMNS = ['파일명', '위원회', '의원', '제출기한', '문항번호', '요구내용', '세부항목', '비고'];
  // 같은 줄로 볼 글자 높이 차이(PDF 좌표 단위)
  const SAME_LINE_GAP = 2;
  // 글자 사이가 이만큼 벌어지면 PDF에 공백 글자가 없어도 띄어쓰기로 본다.
  const WORD_GAP = 1;

  // pdf.js의 글자 조각을 화면의 한 줄씩으로 묶는다.
  function itemsToLines(items) {
    const lines = [];
    let current = null;
    for (const item of items) {
      if (!item.str) continue;
      const x = item.transform[4];
      const y = item.transform[5];
      if (!current || Math.abs(current.y - y) > SAME_LINE_GAP) {
        current = { y, end: x, text: '' };
        lines.push(current);
      }
      if (current.text && !current.text.endsWith(' ') && !item.str.startsWith(' ')
        && x - current.end > WORD_GAP) {
        current.text += ' ';
      }
      current.text += item.str;
      current.end = x + item.width;
    }
    return lines.map((line) => line.text.trim()).filter(Boolean);
  }

  function append(row, field, text) {
    row[field] += (row[field] ? ' / ' : '') + text;
  }

  // 요구서 한 건의 줄 목록을 문항 행 목록으로 바꾼다.
  function splitLines(lines, fileName) {
    const header = /^(.+위원회)\s+(.+?)\s+의원실 자료요구서$/.exec(lines[0] || '');
    const receiver = lines.find((line) => line.startsWith('수신:')) || '';
    const deadline = /제출기한:\s*(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\./.exec(receiver);
    if (!header || !deadline) throw new Error(`머리글 또는 제출기한을 읽지 못했습니다: ${fileName}`);

    const date = [deadline[1], deadline[2].padStart(2, '0'), deadline[3].padStart(2, '0')].join('-');
    const common = { 파일명: fileName, 위원회: header[1], 의원: header[2], 제출기한: date };
    const rows = [];
    let field = '요구내용';
    for (const line of lines.slice(1)) {
      if (line.startsWith('수신:') || line.startsWith('담당 보좌관:') || line === '끝.') continue;
      const number = /^(\d+)\.\s*(.*)$/.exec(line);
      const last = rows[rows.length - 1];
      if (number) {
        rows.push({ ...common, 문항번호: number[1], 요구내용: number[2], 세부항목: '', 비고: '' });
        field = '요구내용';
      } else if (!last) {
        throw new Error(`첫 문항 앞에 해석할 수 없는 줄이 있습니다: ${fileName}: ${line}`);
      } else if (/^[가-힣]\.\s*/.test(line)) {
        field = '세부항목';
        append(last, field, line);
      } else if (line.startsWith('※')) {
        field = '비고';
        append(last, field, line.slice(1).trim());
      } else {
        // 새 경계가 없으면 바로 앞 내용, 세부항목 또는 비고의 연속 줄이다.
        last[field] += ` ${line}`;
      }
    }
    return rows;
  }

  // 파일별로 파일명의 문항 수와 뽑은 문항 수·번호 연속 여부를 대조한다.
  function checkCounts(rows) {
    const groups = new Map();
    for (const row of rows) {
      if (!groups.has(row.파일명)) groups.set(row.파일명, []);
      groups.get(row.파일명).push(Number(row.문항번호));
    }
    return [...groups].map(([파일명, numbers]) => {
      const named = /_(\d+)문항\.pdf$/.exec(파일명);
      const 번호연속 = numbers.every((number, index) => number === index + 1);
      const 파일명문항수 = named ? Number(named[1]) : null;
      return {
        파일명,
        파일명문항수,
        뽑은문항수: numbers.length,
        마지막번호: numbers[numbers.length - 1],
        번호연속,
        일치: 번호연속 && numbers.length === 파일명문항수,
      };
    });
  }

  root.QuestionSplit = { COLUMNS, itemsToLines, splitLines, checkCounts };
})(globalThis);
