/**
 * 도매사 상품 배포(ProductDistribution) 관리자 페이지 CSV 내보내기 스크립트
 * 사용법: node scripts/export-product-distribution.mjs
 *
 * .env.local 에서 TOPPRODUCT_SESSION_ID를 읽거나, 환경변수로 직접 넘길 수 있습니다.
 * (같은 admin 사이트이므로 TOP PRODUCT 내보내기와 동일한 sessionid 쿠키 사용)
 *   TOPPRODUCT_SESSION_ID=xxx node scripts/export-product-distribution.mjs
 *
 * 세션이 만료되면 관리자 페이지에 다시 로그인해 sessionid 쿠키를 갱신해야 합니다.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const CSV_PATH = path.join(DATA_DIR, 'product_distribution.csv');

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

const SESSION_ID = process.env.TOPPRODUCT_SESSION_ID;
if (!SESSION_ID) {
  console.error('❌  TOPPRODUCT_SESSION_ID 가 설정되지 않았습니다.');
  console.error('   .env.local 파일에 TOPPRODUCT_SESSION_ID=xxx (admin sessionid 쿠키 값)를 추가하세요.');
  process.exit(1);
}

const EXPORT_URL = 'https://dailyshot.co/admin/smartorder_reservation/productdistribution/export/?is_advanced_admin_search_active=1';

function extractCookie(setCookieHeaders, name) {
  for (const raw of setCookieHeaders) {
    if (!raw) continue;
    const m = raw.match(new RegExp(`^${name}=([^;]+)`));
    if (m) return m[1];
  }
  return null;
}

console.log('⏳  내보내기 옵션 페이지 확인 중...');

const getRes = await fetch(EXPORT_URL, {
  headers: { Cookie: `sessionid=${SESSION_ID}` },
  redirect: 'follow',
});

if (!getRes.ok) {
  console.error(`❌  요청 실패 (${getRes.status})`);
  process.exit(1);
}

const setCookieHeaders = getRes.headers.getSetCookie
  ? getRes.headers.getSetCookie()
  : [getRes.headers.get('set-cookie')];
const csrfCookie = extractCookie(setCookieHeaders, 'csrftoken');
const html = await getRes.text();
const csrfTokenMatch = html.match(/name="csrfmiddlewaretoken"\s+value="([^"]+)"/);
const csrfToken = csrfTokenMatch ? csrfTokenMatch[1] : null;

if (html.includes('id="id_username"') || html.includes('name="username"')) {
  console.error('❌  로그인 페이지로 리다이렉트되었습니다. sessionid가 만료되었을 수 있습니다.');
  console.error('   관리자 페이지에 다시 로그인해 sessionid 쿠키를 갱신하세요.');
  process.exit(1);
}
if (!csrfCookie || !csrfToken) {
  console.error('❌  CSRF 토큰을 찾지 못했습니다. 페이지 구조가 변경되었을 수 있습니다.');
  process.exit(1);
}

console.log('⏳  도매사 상품 배포 CSV 내보내는 중... (5만건 이상, 시간이 걸릴 수 있습니다)');

// 5만 건 이상 내보내기 확인(is_large_export) + 필요한 8개 필드만 선택
const postBody = new URLSearchParams({
  csrfmiddlewaretoken: csrfToken,
  file_format: '0', // csv
  is_large_export: 'on',
  resource_product_id: 'on',
  resource_product_name: 'on',
  resource_distribution_name: 'on',
  resource_code: 'on',
  resource_status: 'on',
  resource_supply_price_excluding_vat: 'on',
  resource_new_distribution_price: 'on',
  resource_price: 'on',
});

const res = await fetch(EXPORT_URL, {
  method: 'POST',
  headers: {
    Cookie: `sessionid=${SESSION_ID}; csrftoken=${csrfCookie}`,
    'Content-Type': 'application/x-www-form-urlencoded',
    Origin: 'https://dailyshot.co',
    Referer: EXPORT_URL,
  },
  body: postBody.toString(),
  redirect: 'follow',
});

if (!res.ok) {
  console.error(`❌  요청 실패 (${res.status})`);
  process.exit(1);
}

const contentType = res.headers.get('content-type') ?? '';
const buffer = Buffer.from(await res.arrayBuffer());

const looksLikeHtml =
  contentType.includes('text/html') ||
  buffer.subarray(0, 20).toString('utf-8').trim().toLowerCase().startsWith('<!doctype') ||
  buffer.subarray(0, 20).toString('utf-8').trim().toLowerCase().startsWith('<html');

if (looksLikeHtml) {
  console.error('❌  CSV 대신 HTML 응답을 받았습니다. sessionid가 만료되었거나 폼 구조가 변경되었을 수 있습니다.');
  process.exit(1);
}

if (buffer.length === 0) {
  console.error('❌  빈 응답을 받았습니다.');
  process.exit(1);
}

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
fs.writeFileSync(CSV_PATH, buffer);

console.log(`✅  저장 완료: ${CSV_PATH} (${(buffer.length / 1024 / 1024).toFixed(1)} MB)`);
