import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';
import { SalesStats, SalesDot } from '@/types';

const DATA_DIR = path.join(process.cwd(), 'data');
const CSV_PATH = path.join(DATA_DIR, 'price_history.csv');
const META_PATH = path.join(DATA_DIR, 'price_history_meta.json');

export interface PriceHistoryMeta {
  updatedAt: string;   // YYYY-MM-DD
  originalName: string;
  fromDate?: string;
  toDate?: string;
}

interface RawRow {
  event: string;
  time: string;        // ISO string
  item_name: string;
  service_type: string;
  amount: number;
  quantity: number;
}

// ─── 메타 ────────────────────────────────────────────────────────────────────
export function getPriceHistoryMeta(): PriceHistoryMeta | null {
  try {
    return JSON.parse(fs.readFileSync(META_PATH, 'utf-8'));
  } catch {
    return null;
  }
}

export function savePriceHistoryMeta(meta: PriceHistoryMeta) {
  fs.writeFileSync(META_PATH, JSON.stringify(meta, null, 2), 'utf-8');
}

export function daysSincePriceHistoryUpdate(): number | null {
  const meta = getPriceHistoryMeta();
  if (!meta) return null;
  const diff = Date.now() - new Date(meta.updatedAt).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

// ─── CSV 로드 (프로세스당 인메모리 캐시) ─────────────────────────────────────
let _rows: RawRow[] | null = null;
let _cachedPath: string | null = null; // 파일 경로 변경 감지용

function loadRows(): RawRow[] {
  if (_rows && _cachedPath === CSV_PATH) return _rows;
  if (!fs.existsSync(CSV_PATH)) return [];

  const raw = fs.readFileSync(CSV_PATH, 'utf-8');
  const result = Papa.parse<Record<string, string>>(raw, {
    header: true,
    skipEmptyLines: true,
    transformHeader: h => h.replace(/^\uFEFF/, '').trim(),
  });

  _rows = result.data
    .filter(r => r.event === 'payment_success') // 판매 완료만
    .map(r => ({
      event:        r.event ?? '',
      time:         r.time  ?? '',
      item_name:    r.item_name ?? '',
      service_type: r.service_type ?? '',
      amount:       Number(r.amount)   || 0,
      quantity:     Number(r.quantity) || 1,
    }))
    .filter(r => r.item_name && r.amount > 0);

  _cachedPath = CSV_PATH;
  return _rows;
}

/** 캐시 초기화 (파일 업로드 후 호출) */
export function invalidateCache() {
  _rows = null;
  _cachedPath = null;
}

// ─── 통계 계산 ────────────────────────────────────────────────────────────────
function unitPrice(r: RawRow): number {
  return Math.round(r.amount / Math.max(r.quantity, 1));
}

export function getSalesStatsFromFile(itemName: string): SalesStats {
  const rows = loadRows();
  const matched = rows.filter(r => r.item_name === itemName);
  const prices = matched.map(unitPrice).filter(p => p > 0);

  if (prices.length === 0) {
    return { period: '3m', itemName, count: 0, minPrice: 0, avgPrice: 0, medianPrice: 0, maxPrice: 0, noData: true };
  }

  const sorted = [...prices].sort((a, b) => a - b);
  const avg = Math.round(prices.reduce((s, v) => s + v, 0) / prices.length);
  const median = sorted[Math.floor(sorted.length / 2)];

  return {
    period: '3m',
    itemName,
    count: prices.length,
    minPrice: sorted[0],
    avgPrice: avg,
    medianPrice: median,
    maxPrice: sorted[sorted.length - 1],
    noData: false,
  };
}

export function getSalesDotsFromFile(itemName: string): SalesDot[] {
  const rows = loadRows();
  return rows
    .filter(r => r.item_name === itemName)
    .map(r => ({
      date: r.time.split('T')[0],
      price: unitPrice(r),
      serviceType: r.service_type,
    }))
    .filter(d => d.price > 0);
}

/** 파일 존재 여부 */
export function hasPriceHistoryFile(): boolean {
  return fs.existsSync(CSV_PATH);
}
