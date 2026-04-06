export interface InputProduct {
  name: string;
  supplyPrice: number;
}

export interface NameCandidate {
  name: string;
  matchRate: number;
}

export interface RefinedProduct {
  originalName: string;
  supplyPrice: number;
  candidates: NameCandidate[];
  selectedName: string | null; // 체크박스로 선택된 이름
  customName: string; // 직접 입력
  finalName: string | null; // 최종 확정명
}

export interface SalesStats {
  period: '3m' | '6m' | '12m';
  itemName: string;
  count: number;
  minPrice: number;
  avgPrice: number;
  medianPrice: number;
  maxPrice: number;
  noData: boolean;
}

export interface SalesDot {
  date: string;
  price: number;
  serviceType?: string;
}

export interface PriceRow {
  productName: string;
  supplyPrice: number;
  wholesaleMargin: number; // 도매수익률 (기본 7%)
  wholesalePrice: number; // 도매판매가
  storeProfit: number; // 매장 순수익
  dailyshotFee: number; // 데일리샷 수수료
  dailyshotFeeRate: number; // 데일리샷 수수료율
  recommendedPrice: string | number; // 앱 내 추천가 ('데이터 없음' 가능)
  recommendedPriceTag?: '6m' | null; // 6개월 태그
  appPrice: number; // 앱 내 판매가 (유저 수정 가능)
  priceDiff: number | null; // 앱 판매가 - 추천가 (null if 데이터 없음)
  salesStats3m: SalesStats | null;
  salesStats6m: SalesStats | null;
}

export interface SavedSession {
  id: string;
  title: string;
  savedAt: string; // ISO timestamp
  refinedProducts: RefinedProduct[];
}
