import { createReadStream } from 'fs';
import { writeFile } from 'fs/promises';
import { createInterface } from 'readline';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const CSV_PATH = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(DATA_DIR, 'product_distribution.csv');
const OUT_PATH = path.join(DATA_DIR, 'wholesale_index.json');

// 기대 헤더: 상품 ID,상품 이름,유통사 이름,code,status,공급가(vat별도),도매 판매가(vat포함),판매가
const HEADER_MAP = {
  id: '상품 ID',
  name: '상품 이름',
  distributor: '유통사 이름',
  code: 'code',
  status: 'status',
  supply: '공급가(vat별도)',
  wholesale: '도매 판매가(vat포함)',
  app: '판매가',
};

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

  const byCode = {};
  let totalRows = 0;
  let skippedRows = 0;
  let IDX = null;

  for await (const line of rl) {
    if (!IDX) {
      const header = parseCsvLine(line.replace(/^﻿/, '').trim());
      IDX = {};
      for (const [key, label] of Object.entries(HEADER_MAP)) {
        IDX[key] = header.indexOf(label);
      }
      const missing = Object.entries(IDX).filter(([, i]) => i === -1).map(([k]) => k);
      if (missing.length > 0) {
        throw new Error(`CSV 헤더에서 컬럼을 찾지 못했습니다: ${missing.join(', ')} (헤더: ${header.join(',')})`);
      }
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
