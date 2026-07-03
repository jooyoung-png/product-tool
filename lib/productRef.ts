import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';
import { normalize, normalizeWithSynonyms } from './synonyms';

const DATA_DIR = path.join(process.cwd(), 'data');
const CSV_PATH = path.join(DATA_DIR, 'products.csv');
const META_PATH = path.join(DATA_DIR, 'meta.json');

/** 상품명별 정규화 결과 캐시 (검색마다 재계산하지 않도록) */
interface NameEntry {
  normName: string;
  synName: string;
  tokens: { normNt: string; synNt: string }[];
}
const _nameEntryCache = new Map<string, NameEntry>();

function getNameEntry(name: string): NameEntry {
  let entry = _nameEntryCache.get(name);
  if (!entry) {
    const nameTokens = name.split(/\s+/).filter((t) => t.length >= 1);
    entry = {
      normName: normalize(name),
      synName: normalizeWithSynonyms(name),
      tokens: nameTokens.map((nt) => ({ normNt: normalize(nt), synNt: normalizeWithSynonyms(nt) })),
    };
    _nameEntryCache.set(name, entry);
  }
  return entry;
}

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

let _namesCache: string[] | null = null;

/** products.csv가 갱신된 뒤(업로드 등) 호출해 검색 캐시를 무효화 */
export function invalidateProductNamesCache() {
  _namesCache = null;
  _nameEntryCache.clear();
}

/** 상품명 리스트 로드 (name 컬럼) — 프로세스 생애주기 동안 캐싱 */
export function loadProductNames(): string[] {
  if (_namesCache) return _namesCache;
  if (!fs.existsSync(CSV_PATH)) return [];
  const raw = fs.readFileSync(CSV_PATH, 'utf-8');
  const result = Papa.parse<Record<string, string>>(raw, { header: true, skipEmptyLines: true });
  _namesCache = result.data
    .map((row) => (row['name'] || '').trim())
    .filter(Boolean);
  return _namesCache;
}

/** 상품명 → 상위상품 id 매핑 (name, id 컬럼) */
export function loadProductIdMap(): Record<string, string> {
  if (!fs.existsSync(CSV_PATH)) return {};
  const raw = fs.readFileSync(CSV_PATH, 'utf-8');
  const result = Papa.parse<Record<string, string>>(raw, { header: true, skipEmptyLines: true });
  const map: Record<string, string> = {};
  for (const row of result.data) {
    const name = (row['name'] || '').trim();
    const id = (row['id'] || '').trim();
    if (name && id) map[name] = id;
  }
  return map;
}

interface ScoredName {
  name: string;
  score: number;
  matchRate: number;
}

/** "750", "750ml", "1.75L", "1.75리터" 등에서 용량을 ml 단위로 추출 (여러 개 가능) */
function extractVolumesMl(text: string): number[] {
  const results: number[] = [];
  const re = /(\d+(?:\.\d+)?)\s*(ml|㎖|l|리터)?/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const num = parseFloat(m[1]);
    if (!Number.isFinite(num) || num <= 0) continue;
    const unit = (m[2] || '').toLowerCase();
    // 단위 없이 숫자만 있는 경우, 병 용량으로 보기 애매한 값(연도/도수 등)은 제외
    if (!unit && (num < 50 || num > 5000)) continue;
    const ml = unit === 'l' || unit === '리터' ? num * 1000 : num;
    results.push(ml);
  }
  return results;
}

/** 사용자가 입력한 용량값(예: "750", "750ml", "0.75L") 하나를 ml로 정규화 */
function normalizeQueryVolume(volume: string): number | null {
  const found = extractVolumesMl(volume);
  return found.length > 0 ? found[0] : null;
}

/**
 * 쿼리와 유사한 상품명 후보 추출 + matchRate 계산
 *
 * 점수 체계:
 *  1. 공백 제거 후 직접 포함 여부 (띄어쓰기 무시)
 *  2. 유의어 정규화 후 포함 여부
 *  3. 원본 토큰 각각의 부분 매칭 (fallback)
 *  4. 역방향: 상품명 토큰이 쿼리에 포함되는지
 *  5. 용량(volume)이 주어지면: 상품명에 같은 용량이 있으면 가산점, 다른 용량이 명시돼 있으면 감점
 *     (대부분의 상위상품명에는 용량이 없으므로 그 경우는 가/감점 없음)
 */
export function searchWithScores(query: string, names: string[], volume?: string): ScoredName[] {
  const queryVolumeMl = volume ? normalizeQueryVolume(volume) : null;
  // 쿼리에 &가 없으면, &가 포함된 상품명은 후순위 처리
  const queryHasAmpersand = query.includes('&');

  const normQuery = normalize(query);
  const synQuery = normalizeWithSynonyms(query);

  // 원본 토큰 (공백 분리) — 쿼리에만 의존하므로 루프 밖에서 한 번만 정규화
  const queryTokens = query
    .replace(/[^\wㄱ-힣a-zA-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 1)
    .map((t) => t.toLowerCase());
  const queryTokensNorm = queryTokens.map((token) => ({
    token,
    normToken: normalize(token),
    synToken: normalizeWithSynonyms(token),
  }));

  const scored = names.map((name) => {
    const { normName, synName, tokens: nameTokens } = getNameEntry(name);

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
    for (const { normToken, synToken } of queryTokensNorm) {
      if (
        normName.includes(normToken) ||
        synName.includes(synToken)
      ) {
        score += normToken.length * 3;
        tokenMatchCount++;
      }
    }

    // ── 4. 역방향: 상품명의 각 토큰이 쿼리에 포함되는지 ─────────
    for (const { normNt, synNt } of nameTokens) {
      if (normNt.length >= 2 && (normQuery.includes(normNt) || synQuery.includes(synNt))) {
        score += normNt.length * 2;
      }
    }

    // ── & 후순위 패널티 (쿼리에 &가 없을 때만) ─────────────────────
    const ampersandPenalty = !queryHasAmpersand && name.includes('&');
    if (ampersandPenalty) score = Math.max(0, score - 80);

    // ── 5. 용량 가/감점 (상품명에 용량이 명시된 경우에만 적용) ─────
    let volumeBonus = 0;
    if (queryVolumeMl !== null) {
      const nameVolumesMl = extractVolumesMl(name);
      if (nameVolumesMl.length > 0) {
        const hasMatch = nameVolumesMl.some((v) => Math.abs(v - queryVolumeMl) < 0.01);
        volumeBonus = hasMatch ? 60 : -60;
        score = Math.max(0, score + volumeBonus);
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
      // & 패널티를 matchRate에도 반영 (최종 정렬 기준)
      if (ampersandPenalty) matchRate = Math.max(0, matchRate - 30);
      // 용량 가/감점을 matchRate에도 반영
      if (volumeBonus !== 0) matchRate = Math.min(100, Math.max(0, matchRate + volumeBonus / 2));
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
