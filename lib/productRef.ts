import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';
import { normalize, normalizeWithSynonyms } from './synonyms';

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

interface ScoredName {
  name: string;
  score: number;
  matchRate: number;
}

/**
 * 쿼리와 유사한 상품명 후보 추출 + matchRate 계산
 *
 * 점수 체계:
 *  1. 공백 제거 후 직접 포함 여부 (띄어쓰기 무시)
 *  2. 유의어 정규화 후 포함 여부
 *  3. 원본 토큰 각각의 부분 매칭 (fallback)
 *  4. 역방향: 상품명 토큰이 쿼리에 포함되는지
 */
export function searchWithScores(query: string, names: string[]): ScoredName[] {
  const normQuery = normalize(query);
  const synQuery = normalizeWithSynonyms(query);

  // 원본 토큰 (공백 분리)
  const queryTokens = query
    .replace(/[^\wㄱ-힣a-zA-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 1)
    .map((t) => t.toLowerCase());

  const scored = names.map((name) => {
    const normName = normalize(name);
    const synName = normalizeWithSynonyms(name);

    let score = 0;

    // ── 1. 공백 무시 직접 매칭 ──────────────────────────────────
    // 쿼리가 상품명 안에 있거나, 상품명이 쿼리 안에 있으면 강한 매칭
    if (normName === normQuery) {
      score += 200;
    } else if (normName.includes(normQuery)) {
      score += 150;
    } else if (normQuery.includes(normName)) {
      score += 120;
    }

    // ── 2. 유의어 정규화 후 매칭 ────────────────────────────────
    if (synName === synQuery) {
      score += 200;
    } else if (synName.includes(synQuery) && synQuery.length >= 2) {
      score += 150;
    } else if (synQuery.includes(synName) && synName.length >= 2) {
      score += 100;
    }

    // ── 3. 토큰별 매칭 (공백 분리 쿼리 대응) ────────────────────
    let tokenMatchCount = 0;
    for (const token of queryTokens) {
      const normToken = normalize(token);
      const synToken = normalizeWithSynonyms(token);
      if (
        normName.includes(normToken) ||
        synName.includes(synToken)
      ) {
        score += normToken.length * 3;
        tokenMatchCount++;
      }
    }

    // ── 4. 역방향: 상품명의 각 토큰이 쿼리에 포함되는지 ─────────
    const nameTokens = name.split(/\s+/).filter((t) => t.length >= 1);
    for (const nt of nameTokens) {
      const normNt = normalize(nt);
      const synNt = normalizeWithSynonyms(nt);
      if (normNt.length >= 2 && (normQuery.includes(normNt) || synQuery.includes(synNt))) {
        score += normNt.length * 2;
      }
    }

    // ── matchRate 계산 (0~100) ───────────────────────────────────
    let matchRate = 0;
    if (score > 0) {
      if (normName === normQuery || synName === synQuery) {
        matchRate = 100;
      } else if (normName.includes(normQuery) || synName.includes(synQuery)) {
        // 쿼리 길이 대비 상품명 길이 보정
        const lenRatio = Math.min(normQuery.length, normName.length) / Math.max(normQuery.length, normName.length);
        matchRate = Math.round(85 + lenRatio * 12);
      } else if (normQuery.includes(normName) || synQuery.includes(synName)) {
        const lenRatio = Math.min(normQuery.length, normName.length) / Math.max(normQuery.length, normName.length);
        matchRate = Math.round(70 + lenRatio * 15);
      } else {
        // 토큰 기반 비율
        const tokenRate = queryTokens.length > 0 ? tokenMatchCount / queryTokens.length : 0;
        const lenSimilarity = Math.max(
          0,
          1 - Math.abs(name.length - query.length) / Math.max(name.length, query.length)
        );
        matchRate = Math.round(tokenRate * 70 + lenSimilarity * 20);
      }
      matchRate = Math.min(100, Math.max(0, matchRate));
    }

    return { name, score, matchRate };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || a.name.length - b.name.length)
    .slice(0, 15);
}

/** 쿼리와 유사한 상품명 후보 추출 (이름만 반환, 하위 호환) */
export function searchCandidates(query: string, names: string[]): string[] {
  return searchWithScores(query, names).map((s) => s.name);
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
