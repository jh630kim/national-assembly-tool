const path = require('node:path');
const fs = require('node:fs');
const engine = require('./web/engine.js');

async function main() {
  const data = path.join(__dirname, 'data');
  await engine.initialize(
    path.join(data, '배분기준표_소관키워드_304건.csv'),
    path.join(data, 'A부_조직도_26개과.csv'),
  );
  const tests = engine.parseCsv(fs.readFileSync(
    path.join(data, '시험_요구문항_40건.csv'), 'utf8'
  ));
  let first = 0;
  let topThree = 0;
  const wrong = [];
  for (const test of tests) {
    const results = engine.classify(test.요구내용);
    if (results[0]?.과 === test.정답_배분과) first += 1;
    if (results.some((result) => result.과 === test.정답_배분과)) topThree += 1;
    if (results[0]?.과 !== test.정답_배분과) {
      wrong.push({
        시험번호: test.시험번호,
        요구내용: test.요구내용,
        정답: test.정답_배분과,
        '엔진 결과': results.map((result) => result.과).join(' / ') || '확인필요',
      });
    }
  }
  console.log(`1순위 정답 ${first}/${tests.length} · 3순위 안 ${topThree}/${tests.length}`);
  console.table(wrong);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
