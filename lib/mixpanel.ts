import { SalesStats, SalesDot } from '@/types';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

const PROJECT_ID = 2773336;
const CACHE_TTL = 2 * 60 * 60 * 1000; // 2시간

// ─── 파일 기반 캐시 (서버 재시작 후에도 유지) ──────────────────────────────
const CACHE_DIR = path.join(os.tmpdir(), 'mixpanel-jql-cache');

function cacheRead<T>(key: string): T | null {
  try {
    const file = path.join(CACHE_DIR, crypto.createHash('md5').update(key).digest('hex') + '.json');
    const { data, expiry } = JSON.parse(fs.readFileSync(file, 'utf-8')) as { data: T; expiry: number };
    if (expiry > Date.now()) return data;
  } catch {
    // 파일 없음 or 만료
  }
  return null;
}

function cacheWrite(key: string, data: unknown): void {
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    const file = path.join(CACHE_DIR, crypto.createHash('md5').update(key).digest('hex') + '.json');
    fs.writeFileSync(file, JSON.stringify({ data, expiry: Date.now() + CACHE_TTL }));
  } catch {
    // 캐시 쓰기 실패는 무시
  }
}

// ─── 날짜 유틸 ────────────────────────────────────────────────────────────────
function getDateRange(months: number): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setMonth(from.getMonth() - months);
  const fmt = (d: Date) => d.toISOString().split('T')[0];
  return { from: fmt(from), to: fmt(to) };
}

// ─── Mixpanel JQL 호출 ────────────────────────────────────────────────────────
async function queryMixpanel(script: string): Promise<unknown> {
  const apiSecret = process.env.MIXPANEL_API_SECRET;
  if (!apiSecret) throw new Error('MIXPANEL_API_SECRET not set');

  const encoded = Buffer.from(`${apiSecret}:`).toString('base64');

  const res = await fetch('https://mixpanel.com/api/2.0/jql', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${encoded}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ script, project_id: String(PROJECT_ID) }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Mixpanel JQL error ${res.status}: ${text}`);
  }

  const json = await res.json();
  // Mixpanel이 200이지만 error 필드를 반환하는 경우 (rate limit 등)
  if (json && typeof json === 'object' && 'error' in json) {
    throw new Error(`Mixpanel JQL error: ${(json as { error: string }).error}`);
  }
  return json;
}

// ─── 판매 통계 ────────────────────────────────────────────────────────────────
export async function getSalesStats(
  itemName: string,
  months: 3 | 6 | 12
): Promise<SalesStats> {
  const cacheKey = `stats|${itemName}|${months}`;
  const cached = cacheRead<SalesStats>(cacheKey);
  if (cached) return cached;

  const { from, to } = getDateRange(months);
  const period = `${months}m` as '3m' | '6m' | '12m';

  const script = `
function main() {
  return Events({
    from_date: '${from}',
    to_date: '${to}',
    event_selectors: [{ event: 'payment_success' }]
  })
  .filter(function(e) {
    return e.properties.item_name === ${JSON.stringify(itemName)};
  })
  .map(function(e) {
    var qty = e.properties.quantity || 1;
    var amt = e.properties.amount || 0;
    return amt / qty;
  })
  .reduce([
    mixpanel.reducer.numeric_summary(),
    mixpanel.reducer.numeric_percentiles([1, 50, 99])
  ]);
}
`;

  const raw = await queryMixpanel(script) as Array<[
    { count: number; avg: number },
    Array<{ percentile: number; value: number }>
  ]>;

  const row = Array.isArray(raw) && raw[0] ? raw[0] : null;
  const summary = row ? row[0] : null;
  const percentiles = row ? row[1] : null;

  if (!summary || !summary.count || summary.count === 0) {
    const noData: SalesStats = { period, itemName, count: 0, minPrice: 0, avgPrice: 0, medianPrice: 0, maxPrice: 0, noData: true };
    cacheWrite(cacheKey, noData);
    return noData;
  }

  const getPercentile = (p: number) => percentiles?.find(x => x.percentile === p)?.value ?? 0;

  const stats: SalesStats = {
    period,
    itemName,
    count: summary.count,
    minPrice: Math.round(getPercentile(1)),
    avgPrice: Math.round(summary.avg),
    medianPrice: Math.round(getPercentile(50)),
    maxPrice: Math.round(getPercentile(99)),
    noData: false,
  };
  cacheWrite(cacheKey, stats);
  return stats;
}

// ─── 판매 점 데이터 ────────────────────────────────────────────────────────────
export async function getSalesDots(itemName: string, months: 3 | 6 | 12): Promise<SalesDot[]> {
  const cacheKey = `dots|${itemName}|${months}`;
  const cached = cacheRead<SalesDot[]>(cacheKey);
  if (cached) return cached;

  const { from, to } = getDateRange(months);

  const script = `
function main() {
  return Events({
    from_date: '${from}',
    to_date: '${to}',
    event_selectors: [{ event: 'payment_success' }]
  })
  .filter(function(e) {
    return e.properties.item_name === ${JSON.stringify(itemName)};
  })
  .map(function(e) {
    var qty = e.properties.quantity || 1;
    var amt = e.properties.amount || 0;
    return { date: e.time, price: amt / qty, serviceType: e.properties.service_type || '' };
  });
}
`;

  const raw = await queryMixpanel(script) as Array<{ date: number; price: number; serviceType: string }>;
  if (!Array.isArray(raw)) return [];

  const dots = raw.map((r) => ({
    date: new Date(r.date).toISOString().split('T')[0],
    price: Math.round(r.price),
    serviceType: r.serviceType,
  }));
  cacheWrite(cacheKey, dots);
  return dots;
}
