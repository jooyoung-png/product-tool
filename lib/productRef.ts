import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';

const DATA_DIR = path.join(process.cwd(), 'data');
const CSV_PATH = path.join(DATA_DIR, 'products.csv');
const META_PATH = path.join(DATA_DIR, 'meta.json');

export interface ProductRefMeta {
  updatedAt: string; // YYYY-MM-DD
  originalName: string;
}

export function getMeta(): ProductRefMeta | null {
  try {
    const raw = fs.readFileSync(META_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveMeta(meta: ProductRefMeta) {
  fs.writeFileSync(META_PATH, JSON.stringify(meta, null, 2), 'utf-8');
}

/** 상품명 리스트 로드 (name 컬럼) */
export function loadProductNames(): string[] {
  if (!fs.existsSync(CSV_PATH)) return [];
  const raw = fs.readFileSync(CSV_PATH, 'utf-8');
  const result = Papa.parse<Record<string, string>>(raw, { header: true, skipEmptyLines: true });
  return result.data
    .map((row) => (row['name'] || '').trim())
    .filter(Boolean);
}

/** 쿼리와 유사한 상품명 후보 추출 */
export function searchCandidates(query: string, names: string[]): string[] {
  const queryTokens = query
    .replace(/[^\wㄱ-힣a-zA-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 1)
    .map((t) => t.toLowerCase());

  if (queryTokens.length === 0) return [];

  const scored = names.map((name) => {
    const lower = name.toLowerCase();
    let score = 0;
    let matchedCount = 0;
    for (const token of queryTokens) {
      if (lower.includes(token)) {
        score += token.length;
        matchedCount++;
      }
    }
    return { name, score, matchedCount };
  });

  return scored
    .filter((s) => s.score > 0)
    // 1순위: 매칭된 토큰 수 (많을수록 우선)
    // 2순위: 총 점수 (길이 합)
    // 3순위: 이름 길이 (짧을수록 우선 — 더 구체적인 이름 방지)
    .sort((a, b) =>
      b.matchedCount - a.matchedCount ||
      b.score - a.score ||
      a.name.length - b.name.length
    )
    .slice(0, 15)
    .map((s) => s.name);
}

/** 업데이트 후 경과 일수 */
export function daysSinceUpdate(): number | null {
  const meta = getMeta();
  if (!meta) return null;
  const updated = new Date(meta.updatedAt);
  const now = new Date();
  const diff = Math.floor((now.getTime() - updated.getTime()) / (1000 * 60 * 60 * 24));
  return diff;
}
