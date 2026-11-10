const fs = require('node:fs');
const path = require('node:path');

const source = path.join(__dirname, 'data', 'A부_조직도_26개과.csv');
const output = path.join(__dirname, 'org.json');

function parseCsvLine(line) {
  const cells = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"' && quoted && line[i + 1] === '"') {
      cell += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      cells.push(cell);
      cell = '';
    } else {
      cell += char;
    }
  }
  cells.push(cell);
  return cells;
}

const lines = fs.readFileSync(source, 'utf8').replace(/^\uFEFF/, '').trimEnd().split(/\r?\n/);
const headers = parseCsvLine(lines.shift());
const org = lines.map((line) => {
  const values = parseCsvLine(line);
  const row = Object.fromEntries(headers.map((header, index) => [header, values[index]]));
  return {
    실국: row.실국,
    과: row.과,
    대표키워드: row.대표키워드.split('|').map((keyword) => keyword.trim()),
  };
});

fs.writeFileSync(output, `${JSON.stringify(org, null, 2)}\n`, 'utf8');
console.log(`원소 수: ${org.length}`);
console.log('첫 원소:', org[0]);
