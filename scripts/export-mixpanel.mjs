/**
 * Mixpanel 이벤트 추출 스크립트
 * 사용법: node scripts/export-mixpanel.mjs [출력파일명.csv]
 *
 * .env.local 에서 MIXPANEL_API_SECRET을 읽거나,
 * 환경변수로 직접 넘길 수 있습니다.
 *   MIXPANEL_API_SECRET=xxx node scripts/export-mixpanel.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

// ── .env.local 파싱 ───────────────────────────────────────────────────────────
function loadEnv() {
  const envPath = path.join(ROOT, '.env.local');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const m = line.match(/^\s*([^#=\s]+)\s*=\s*(.+)\s*$/);
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
loadEnv();

const API_SECRET = process.env.MIXPANEL_API_SECRET;
if (!API_SECRET) {
  console.error('❌  MIXPANEL_API_SECRET 이 설정되지 않았습니다.');
  console.error('   .env.local 파일에 MIXPANEL_API_SECRET=xxx 를 추가하세요.');
  process.exit(1);
}

const PROJECT_ID = 2773336;
const MONTHS = 3;

// ── 날짜 범위 ─────────────────────────────────────────────────────────────────
const to   = new Date();
const from = new Date();
from.setMonth(from.getMonth() - MONTHS);
const fmt  = d => d.toISOString().split('T')[0];

const FROM_DATE = fmt(from);
const TO_DATE   = fmt(to);

console.log(`📅  조회 기간: ${FROM_DATE} ~ ${TO_DATE}`);
console.log(`🔍  이벤트: payment_success, payment_cancel`);

// ── JQL 스크립트 ──────────────────────────────────────────────────────────────
const script = `
function main() {
  return Events({
    from_date: '${FROM_DATE}',
    to_date:   '${TO_DATE}',
    event_selectors: [
      { event: 'payment_success' },
      { event: 'payment_cancel'  }
    ]
  })
  .map(function(e) {
    var p = e.properties;
    return {
      event:        e.name,
      time:         new Date(e.time).toISOString(),
      item_name:    p.item_name    || '',
      service_type: p.service_type || '',
      amount:       p.amount       || 0,
      quantity:     p.quantity     || 1
    };
  });
}
`;

// ── Mixpanel 호출 ─────────────────────────────────────────────────────────────
console.log('⏳  Mixpanel에서 데이터를 가져오는 중... (시간이 걸릴 수 있습니다)');

const encoded = Buffer.from(`${API_SECRET}:`).toString('base64');

const res = await fetch('https://mixpanel.com/api/2.0/jql', {
  method: 'POST',
  headers: {
    Authorization: `Basic ${encoded}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  },
  body: new URLSearchParams({ script, project_id: String(PROJECT_ID) }),
});

if (res.status === 429) {
  console.error('❌  Rate limit 초과. 잠시 후 다시 시도하세요.');
  process.exit(1);
}
if (!res.ok) {
  const text = await res.text();
  console.error(`❌  API 오류 (${res.status}): ${text}`);
  process.exit(1);
}

const data = await res.json();

if (!Array.isArray(data)) {
  console.error('❌  예상치 못한 응답:', JSON.stringify(data).slice(0, 200));
  process.exit(1);
}

console.log(`✅  ${data.length.toLocaleString()}건 추출 완료`);

// ── CSV 생성 ──────────────────────────────────────────────────────────────────
const HEADERS = ['event', 'time', 'item_name', 'service_type', 'amount', 'quantity'];

function escapeCsv(v) {
  const s = String(v ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

const BOM = '\uFEFF';
const rows = [
  HEADERS.join(','),
  ...data.map(r => HEADERS.map(h => escapeCsv(r[h])).join(',')),
];
const csv = BOM + rows.join('\r\n');

// ── 출력 파일 경로 ────────────────────────────────────────────────────────────
const outputName = process.argv[2]
  ?? `mixpanel_export_${FROM_DATE}_${TO_DATE}.csv`;
const outputPath = path.isAbsolute(outputName)
  ? outputName
  : path.join(ROOT, outputName);

fs.writeFileSync(outputPath, csv, 'utf-8');
console.log(`💾  저장 완료: ${outputPath}`);
console.log(`    - payment_success: ${data.filter(r => r.event === 'payment_success').length.toLocaleString()}건`);
console.log(`    - payment_cancel:  ${data.filter(r => r.event === 'payment_cancel').length.toLocaleString()}건`);
