import fs from 'fs';
import path from 'path';
import { SalesStats, SalesDot } from '@/types';

const DATA_DIR = path.join(process.cwd(), 'data');
const STATS_PATH = path.join(DATA_DIR, 'price_stats.json');

// ─── JSON 타입 ────────────────────────────────────────────────────────────────
interface StatsEntry {
  count: number;
  minPrice: number;
  avgPrice: number;
  medianPrice: number;
  maxPrice: number;
  dots: [string, number, string][]; // [date, price, serviceType]
}

interface PriceStatsFile {
  meta: {
    generatedAt: string;
    fromDate: string;
    toDate: string;
    totalRows: number;
  };
  items: Record<string, StatsEntry>;
}

export interface PriceHistoryMeta {
  updatedAt: string;
  originalName: string;
  fromDate?: string;
  toDate?: string;
}

// ─── JSON 인메모리 캐시 ───────────────────────────────────────────────────────
let _stats: PriceStatsFile | null = null;

function loadStats(): PriceStatsFile | null {
  if (_stats) return _stats;
  if (!fs.existsSync(STATS_PATH)) return null;
  try {
    _stats = JSON.parse(fs.readFileSync(STATS_PATH, 'utf-8')) as PriceStatsFile;
    return _stats;
  } catch {
    return null;
  }
}

/** 캐시 초기화 (파일 교체 후 호출용 — 로컬 개발 환경 전용) */
export function invalidateCache() {
  _stats = null;
}

// ─── 메타 ────────────────────────────────────────────────────────────────────
export function getPriceHistoryMeta(): PriceHistoryMeta | null {
  const stats = loadStats();
  if (!stats) return null;
  const { generatedAt, fromDate, toDate } = stats.meta;
  return {
    updatedAt: generatedAt,
    originalName: 'price_stats.json',
    fromDate,
    toDate,
  };
}

export function savePriceHistoryMeta(_meta: PriceHistoryMeta) {
  // JSON 방식에서는 메타가 price_stats.json에 포함됨 — 별도 저장 불필요
}

export function daysSincePriceHistoryUpdate(): number | null {
  const meta = getPriceHistoryMeta();
  if (!meta) return null;
  const diff = Date.now() - new Date(meta.updatedAt).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

// ─── 통계 / dots ──────────────────────────────────────────────────────────────
export function getSalesStatsFromFile(itemName: string): SalesStats {
  const stats = loadStats();
  const entry = stats?.items[itemName];

  if (!entry || entry.count === 0) {
    return { period: '3m', itemName, count: 0, minPrice: 0, avgPrice: 0, medianPrice: 0, maxPrice: 0, noData: true };
  }

  return {
    period: '3m',
    itemName,
    count: entry.count,
    minPrice: entry.minPrice,
    avgPrice: entry.avgPrice,
    medianPrice: entry.medianPrice,
    maxPrice: entry.maxPrice,
    noData: false,
  };
}

export function getSalesDotsFromFile(itemName: string): SalesDot[] {
  const stats = loadStats();
  const entry = stats?.items[itemName];
  if (!entry) return [];

  return entry.dots.map(([date, price, serviceType]) => ({ date, price, serviceType }));
}

/** price_stats.json 존재 여부 */
export function hasPriceHistoryFile(): boolean {
  return fs.existsSync(STATS_PATH);
}
