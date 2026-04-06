import { SalesStats, SalesDot } from '@/types';

const PROJECT_ID = 2773336;

// 서버 프로세스 내 인메모리 캐시 (rate limit 방어)
const statsCache = new Map<string, { data: SalesStats; expiry: number }>();
const dotsCache = new Map<string, { data: SalesDot[]; expiry: number }>();
const CACHE_TTL = 10 * 60 * 1000; // 10분

function getDateRange(months: number): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setMonth(from.getMonth() - months);
  const fmt = (d: Date) => d.toISOString().split('T')[0];
  return { from: fmt(from), to: fmt(to) };
}

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

  return res.json();
}

export async function getSalesStats(
  itemName: string,
  months: 3 | 6 | 12
): Promise<SalesStats> {
  const cacheKey = `${itemName}|${months}`;
  const cached = statsCache.get(cacheKey);
  if (cached && cached.expiry > Date.now()) return cached.data;

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
    statsCache.set(cacheKey, { data: noData, expiry: Date.now() + CACHE_TTL });
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
  statsCache.set(cacheKey, { data: stats, expiry: Date.now() + CACHE_TTL });
  return stats;
}

export async function getSalesDots(itemName: string, months: 3 | 6 | 12): Promise<SalesDot[]> {
  const cacheKey = `dots|${itemName}|${months}`;
  const cached = dotsCache.get(cacheKey);
  if (cached && cached.expiry > Date.now()) return cached.data;

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
  dotsCache.set(cacheKey, { data: dots, expiry: Date.now() + CACHE_TTL });
  return dots;
}
