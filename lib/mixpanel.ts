import { SalesStats, SalesDot } from '@/types';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

const PROJECT_ID = 2773336;
const CACHE_TTL = 2 * 60 * 60 * 1000; // 2시간

// ─── 파일 기반 캐시 ────────────────────────────────────────────────────────────
const CACHE_DIR = path.join(os.tmpdir(), 'mixpanel-jql-cache');

function cacheRead<T>(key: string): T | null {
  try {
    const file = path.join(CACHE_DIR, crypto.createHash('md5').update(key).digest('hex') + '.json');
    const { data, expiry } = JSON.parse(fs.readFileSync(file, 'utf-8')) as { data: T; expiry: number };
    if (expiry > Date.now()) return data;
  } catch { /* 파일 없음 or 만료 */ }
  return null;
}

function cacheWrite(key: string, data: unknown): void {
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    const file = path.join(CACHE_DIR, crypto.createHash('md5').update(key).digest('hex') + '.json');
    fs.writeFileSync(file, JSON.stringify({ data, expiry: Date.now() + CACHE_TTL }));
  } catch { /* 캐시 쓰기 실패는 무시 */ }
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

  if (res.status === 429) {
    const err = new Error(`rate_limited`) as Error & { rateLimited: boolean };
    err.rateLimited = true;
    throw err;
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Mixpanel JQL error ${res.status}: ${text}`);
  }
  const json = await res.json();
  if (json && typeof json === 'object' && 'error' in json) {
    throw new Error(`Mixpanel JQL error: ${(json as { error: string }).error}`);
  }
  return json;
}

// ─── Raw 이벤트 타입 ──────────────────────────────────────────────────────────
interface RawEvent {
  time: number;  // ms timestamp
  price: number;
  serviceType: string;
}

// ─── 이벤트 배열에서 통계 계산 (서버사이드) ─────────────────────────────────
function computeStats(events: RawEvent[], itemName: string): SalesStats {
  const prices = events.filter(e => e.price > 0).map(e => e.price);

  if (prices.length === 0) {
    return { period: '3m', itemName, count: 0, minPrice: 0, avgPrice: 0, medianPrice: 0, maxPrice: 0, noData: true };
  }

  const sorted = [...prices].sort((a, b) => a - b);
  const avg = prices.reduce((s, v) => s + v, 0) / prices.length;
  const median = sorted[Math.floor(sorted.length / 2)];

  return {
    period: '3m', itemName,
    count: prices.length,
    minPrice: Math.round(sorted[0]),
    avgPrice: Math.round(avg),
    medianPrice: Math.round(median),
    maxPrice: Math.round(sorted[sorted.length - 1]),
    noData: false,
  };
}

// ─── 상품당 JQL 1회, 3m 데이터만 취득 ────────────────────────────────────────
interface Sales3mData {
  stats: SalesStats;
  dots: RawEvent[];
}

async function getSales3m(itemName: string): Promise<Sales3mData> {
  const cacheKey = `3m|${itemName}`;
  const cached = cacheRead<Sales3mData>(cacheKey);
  if (cached) return cached;

  const { from, to } = getDateRange(3);

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
    return { time: e.time, price: amt / qty, serviceType: e.properties.service_type || '' };
  });
}
`;

  let raw: RawEvent[];
  try {
    raw = await queryMixpanel(script) as RawEvent[];
  } catch (err) {
    // rate limit 시 캐시 저장 없이 rateLimited stats 반환
    if (err instanceof Error && (err as Error & { rateLimited?: boolean }).rateLimited) {
      return {
        stats: { period: '3m', itemName, count: 0, minPrice: 0, avgPrice: 0, medianPrice: 0, maxPrice: 0, noData: true, rateLimited: true },
        dots: [],
      };
    }
    throw err;
  }

  const events = Array.isArray(raw) ? raw : [];
  const result: Sales3mData = {
    stats: computeStats(events, itemName),
    dots: events,
  };
  cacheWrite(cacheKey, result);
  return result;
}

export async function getSalesStats(itemName: string): Promise<SalesStats> {
  const { stats } = await getSales3m(itemName);
  return stats;
}

export async function getSalesDots(itemName: string): Promise<SalesDot[]> {
  const { dots } = await getSales3m(itemName);
  return dots
    .filter(e => e.price > 0)
    .map(e => ({
      date: new Date(e.time).toISOString().split('T')[0],
      price: Math.round(e.price),
      serviceType: e.serviceType,
    }));
}
