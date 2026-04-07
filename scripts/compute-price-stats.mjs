/**
 * 가격 통계 사전 계산 스크립트
 *
 * 사용법:
 *   node scripts/compute-price-stats.mjs [CSV경로]
 *
 * - 기본 입력: data/price_history.csv
 * - 출력:      data/price_stats.json
 *
 * 이후 git commit & push하면 Vercel에 자동 반영됩니다.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const CSV_PATH = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(DATA_DIR, 'price_history.csv');
const OUT_PATH = path.join(DATA_DIR, 'price_stats.json');

// ── CSV 파싱 ──────────────────────────────────────────────────────────────────
function parseCsvLine(line) {
  const result = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (ch === ',' && !inQ) {
      result.push(cur); cur = '';
    } else {
      cur += ch;
    }
  }
  result.push(cur);
  return result;
}

// ── 메인 ──────────────────────────────────────────────────────────────────────
if (!fs.existsSync(CSV_PATH)) {
  console.error(`❌  파일 없음: ${CSV_PATH}`);
  console.error('    먼저 node scripts/export-mixpanel.mjs 를 실행하세요.');
  process.exit(1);
}

console.log(`📂  읽는 중: ${CSV_PATH}`);
const raw = fs.readFileSync(CSV_PATH, 'utf-8').replace(/^\uFEFF/, '');
const lines = raw.split('\n');
const headers = parseCsvLine(lines[0].trim()).map(h => h.trim());

const iEvent = headers.indexOf('event');
const iTime = headers.indexOf('time');
const iName = headers.indexOf('item_name');
const iType = headers.indexOf('service_type');
const iAmt = headers.indexOf('amount');
const iQty = headers.indexOf('quantity');

if ([iEvent, iTime, iName, iAmt, iQty].includes(-1)) {
  console.error('❌  CSV 컬럼 누락:', headers);
  process.exit(1);
}

console.log(`📊  파싱 중... (${(lines.length - 1).toLocaleString()}행)`);

// items[itemName] = { prices: number[], dots: [date, price, svcType][] }
const items = Object.create(null);
let totalSuccess = 0;
let minDate = '9999-12-31';
let maxDate = '0000-01-01';

for (let i = 1; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;

  const cols = parseCsvLine(line);
  if (cols[iEvent] !== 'payment_success') continue;

  const itemName = cols[iName]?.trim();
  if (!itemName) continue;

  const amount = Number(cols[iAmt]) || 0;
  const qty = Math.max(Number(cols[iQty]) || 1, 1);
  const price = Math.round(amount / qty);
  if (price <= 0) continue;

  const timeStr = cols[iTime] ?? '';
  const date = timeStr.slice(0, 10); // YYYY-MM-DD
  const svcType = cols[iType]?.trim() ?? '';

  if (date < minDate) minDate = date;
  if (date > maxDate) maxDate = date;

  if (!items[itemName]) items[itemName] = { prices: [], dots: [] };
  items[itemName].prices.push(price);
  items[itemName].dots.push([date, price, svcType]);
  totalSuccess++;
}

console.log(`✅  payment_success: ${totalSuccess.toLocaleString()}건`);
console.log(`📦  상품 종류: ${Object.keys(items).length.toLocaleString()}개`);
console.log(`📅  기간: ${minDate} ~ ${maxDate}`);

// ── 통계 계산 ─────────────────────────────────────────────────────────────────
console.log('🔢  통계 계산 중...');

const statsMap = Object.create(null);
for (const [name, { prices, dots }] of Object.entries(items)) {
  const sorted = [...prices].sort((a, b) => a - b);
  const n = sorted.length;
  const avg = Math.round(sorted.reduce((s, v) => s + v, 0) / n);
  const median = sorted[Math.floor(n / 2)];
  statsMap[name] = {
    count: n,
    minPrice: sorted[0],
    avgPrice: avg,
    medianPrice: median,
    maxPrice: sorted[n - 1],
    dots, // [date, price, serviceType][]
  };
}

// ── JSON 출력 ─────────────────────────────────────────────────────────────────
const output = {
  meta: {
    generatedAt: new Date().toISOString().split('T')[0],
    fromDate: minDate === '9999-12-31' ? '' : minDate,
    toDate: maxDate === '0000-01-01' ? '' : maxDate,
    totalRows: totalSuccess,
  },
  items: statsMap,
};

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
fs.writeFileSync(OUT_PATH, JSON.stringify(output), 'utf-8');

const sizeMB = (fs.statSync(OUT_PATH).size / 1024 / 1024).toFixed(1);
console.log(`💾  저장 완료: ${OUT_PATH} (${sizeMB} MB)`);
console.log('');
console.log('다음 단계:');
console.log('  git add data/price_stats.json');
console.log('  git commit -m "chore: update price stats"');
console.log('  git push');
