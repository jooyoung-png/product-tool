/**
 * 유의어 사전
 * 각 그룹의 첫 번째 항목이 정규 형태(canonical)입니다.
 * 같은 그룹 내 모든 표현은 동일한 것으로 취급합니다.
 */
export const SYNONYM_GROUPS: string[][] = [
  // ── 품종: 소비뇽 블랑 ──────────────────────────────
  ['소비뇽블랑', '소비뇽 블랑', '쇼비농블랑', '쇼비뇽블랑', '쇼블', '소블', '쏘블', '소비뇽', 'sauvignon blanc', 'sauvignonblanc'],

  // ── 품종: 메를로 ──────────────────────────────────
  ['메를로', '멜롯', '멜럿', '메를로우', 'merlot'],

  // ── 품종: 카베르네 소비뇽 ─────────────────────────
  ['카베르네소비뇽', '카베르네 소비뇽', '카베소', '카소', '까베르네', 'cabernet sauvignon', 'cabernetsauvignon', 'cab sauv', 'cabsauv'],

  // ── 품종: 피노 누아 ───────────────────────────────
  ['피노누아', '피노 누아', '피노누와', '피누아', 'pinot noir', 'pinotnoir'],

  // ── 품종: 샤르도네 ───────────────────────────────
  ['샤르도네', '샤도네이', '샤도네', '샤르도내', 'chardonnay'],

  // ── 품종: 리슬링 ─────────────────────────────────
  ['리슬링', '리즐링', '리에슬링', 'riesling'],

  // ── 품종: 말벡 ──────────────────────────────────
  ['말벡', '말베크', '말바', 'malbec'],

  // ── 품종: 시라 / 쉬라즈 ─────────────────────────
  ['시라', '쉬라즈', '쉬라', '시라즈', 'syrah', 'shiraz'],

  // ── 품종: 그르나슈 ──────────────────────────────
  ['그르나슈', '가르나차', '그라나차', 'grenache', 'garnacha'],

  // ── 품종: 템프라니요 ─────────────────────────────
  ['템프라니요', '떼빠니요', '뗌쁘라니요', '템프라닐로', 'tempranillo'],

  // ── 품종: 모스카토 / 뮈스카 ──────────────────────
  ['모스카토', '무스카토', '뮈스카', '무스카', '모스까또', 'moscato', 'muscat'],

  // ── 품종: 게뷔르츠트라미너 ──────────────────────
  ['게뷔르츠트라미너', '게뷔르츠', '게부르츠', '거비쯔', 'gewurztraminer', 'gewürztraminer'],

  // ── 품종: 피노 그리 / 그리지오 ──────────────────
  ['피노그리', '피노 그리', '피노그리지오', '피노 그리지오', 'pinot gris', 'pinot grigio', 'pinotgrigio'],

  // ── 품종: 산지오베제 ─────────────────────────────
  ['산지오베제', '산지오베세', '산지오베지', 'sangiovese'],

  // ── 품종: 진판델 ─────────────────────────────────
  ['진판델', '쥬판델', '진판달', 'zinfandel'],

  // ── 품종: 네비올로 ──────────────────────────────
  ['네비올로', '네비오로', 'nebbiolo'],

  // ── 품종: 비오니에 ──────────────────────────────
  ['비오니에', '비오니에르', 'viognier'],

  // ── 와인 타입 ────────────────────────────────────
  ['로제', '로지', 'rose', 'rosé'],
  ['스파클링', '발포성', 'sparkling'],
  ['프로세코', '프로쎄코', 'prosecco'],
  ['크레망', '크레만', 'cremant', 'crémant'],

  // ── 지역: 프랑스 ─────────────────────────────────
  ['부르고뉴', '버건디', 'burgundy', 'bourgogne'],
  ['샴페인', '샴페뉴', 'champagne'],
  ['보르도', 'bordeaux'],
  ['론', '론밸리', '로느', 'rhone', 'rhône'],
  ['루아르', 'loire'],
  ['알자스', 'alsace'],
  ['랑그독', '랑그독루시용', 'languedoc'],
  ['프로방스', 'provence'],
  ['남프랑스', '남부프랑스'],

  // ── 지역: 이탈리아 ──────────────────────────────
  ['토스카나', '투스카니', 'tuscany', 'toscana'],
  ['피에몬테', '피에드몬트', 'piedmont', 'piemonte'],
  ['베네토', 'veneto'],
  ['시칠리아', '시실리', 'sicily', 'sicilia'],

  // ── 지역: 스페인 ─────────────────────────────────
  ['리오하', 'rioja'],
  ['리베라델두에로', '리베라 델 두에로', 'ribera del duero', 'riberadel duero'],
  ['프리오라트', 'priorat'],

  // ── 지역: 신세계 ─────────────────────────────────
  ['나파밸리', '나파 밸리', '나파', 'napa valley', 'napa'],
  ['소노마', 'sonoma'],
  ['말보로', '말버러', 'marlborough'],
  ['바로사밸리', '바로사 밸리', 'barossa valley', 'barossa'],
  ['맥라렌베일', '맥라렌 베일', 'mclaren vale'],
  ['마이포', '마이포밸리', 'maipo', 'maipo valley'],
  ['콜차구아', 'colchagua'],
  ['멘도사', 'mendoza'],

  // ── 등급/타입 ────────────────────────────────────
  ['그랑크뤼', '그랑 크뤼', 'grand cru'],
  ['프리미에크뤼', '프리미에 크뤼', '1er cru', 'premier cru'],
  ['크뤼부르주아', 'cru bourgeois'],
  ['리제르바', '리세르바', 'riserva', 'reserva'],
];

/** 정규화: 소문자 + 공백 제거 */
export function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, '');
}

/** 유의어 정규화된 매핑 캐시 */
let _normGroupsCache: { canonical: string; variants: string[] }[] | null = null;

function getNormGroups() {
  if (!_normGroupsCache) {
    _normGroupsCache = SYNONYM_GROUPS.map(group => ({
      canonical: normalize(group[0]),
      variants: group.map(normalize),
    }));
  }
  return _normGroupsCache;
}

/**
 * 공백 제거 + 유의어를 canonical로 치환한 문자열 반환
 * ex) "쇼블" → "소비뇽블랑", "멜럿" → "메를로"
 */
export function normalizeWithSynonyms(s: string): string {
  let result = normalize(s);
  for (const { canonical, variants } of getNormGroups()) {
    for (const variant of variants) {
      if (variant !== canonical && result.includes(variant)) {
        result = result.split(variant).join(canonical);
      }
    }
  }
  return result;
}
