import { createReadStream } from 'fs';
import { writeFile } from 'fs/promises';
import { createInterface } from 'readline';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CSV_PATH = path.join('C:', 'Users', 'jca65', 'Desktop', 'raw data', 'ProductDistribution-2026-04-08.csv');
const OUT_PATH = path.join(__dirname, '..', 'data', 'wholesale_index.json');

// CSV 행 파싱 (따옴표 처리)
function parseCsvLine(line) {
  const fields = [];
  let i = 0;
  while (i < line.length) {
    if (line[i] === '"') {
      // 따옴표로 감싸진 필드
      let val = '';
      i++; // opening "
      while (i < line.length) {
        if (line[i] === '"' && line[i + 1] === '"') {
          val += '"';
          i += 2;
        } else if (line[i] === '"') {
          i++; // closing "
          break;
        } else {
          val += line[i++];
        }
      }
      fields.push(val);
      if (line[i] === ',') i++;
    } else {
      let val = '';
      while (i < line.length && line[i] !== ',') {
        val += line[i++];
      }
      fields.push(val);
      if (line[i] === ',') i++;
    }
  }
  return fields;
}

async function main() {
  const rl = createInterface({
    input: createReadStream(CSV_PATH, { encoding: 'utf-8' }),
    crlfDelay: Infinity,
  });

  // Column indices (from header analysis):
  // 0: 유통사 상품 ID, 1: 상품 ID, 3: 상품 이름, 7: 유통사 이름, 8: code,
  // 9: status, 14: 공급가(vat별도), 16: 도매 판매가(vat포함), 19: 판매가
  const IDX = { id: 1, name: 3, distributor: 7, code: 8, status: 9, supply: 14, wholesale: 16, app: 19 };

  const byCode = {};
  let totalRows = 0;
  let skippedRows = 0;
  let headerSkipped = false;

  for await (const line of rl) {
    // Skip BOM + header
    if (!headerSkipped) {
      headerSkipped = true;
      continue;
    }
    if (!line.trim()) continue;

    const fields = parseCsvLine(line);
    const distributor = (fields[IDX.distributor] || '').trim();

    // 해지_ 유통사 제외
    if (distributor.startsWith('해지_')) {
      skippedRows++;
      continue;
    }

    const code = (fields[IDX.code] || '').trim();
    if (!code || code === '0') {
      skippedRows++;
      continue;
    }

    const id = parseInt(fields[IDX.id] || '0', 10);
    const name = (fields[IDX.name] || '').trim();
    const status = (fields[IDX.status] || '').trim();
    const supplyPrice = parseInt((fields[IDX.supply] || '0').replace(/,/g, ''), 10) || 0;
    const wholesalePrice = parseInt((fields[IDX.wholesale] || '0').replace(/,/g, ''), 10) || 0;
    const appPrice = parseInt((fields[IDX.app] || '0').replace(/,/g, ''), 10) || 0;

    if (!byCode[code]) byCode[code] = [];
    byCode[code].push({ id, name, distributor, status, supplyPrice, wholesalePrice, appPrice });
    totalRows++;
  }

  const result = {
    meta: {
      generatedAt: new Date().toISOString().slice(0, 10),
      totalRows,
      skippedRows,
      uniqueCodes: Object.keys(byCode).length,
    },
    byCode,
  };

  await writeFile(OUT_PATH, JSON.stringify(result), 'utf-8');
  console.log(`Done: ${totalRows} rows, ${Object.keys(byCode).length} unique codes → wholesale_index.json`);
  console.log(`Skipped: ${skippedRows} rows (해지_ distributors)`);
}

main().catch((err) => { console.error(err); process.exit(1); });
