export interface InputProduct {
  name: string;
  supplyPrice: number;
  // 선택 필드 (파일 업로드에서만 채워짐)
  bottlesPerBox?: number;
  purpose?: string;
  stock?: number;
  code?: string;
  volume?: string;
  // 도매사 코드 검색용 (단건 입력에서만 채워짐)
  wholesaleCode?: string;
}

export interface WholesaleItem {
  id: number;
  name: string;
  status: string;
  supplyPrice: number;
  wholesalePrice: number;
  appPrice: number;
}

export interface NameCandidate {
  name: string;
  matchRate: number;
  wholesale?: WholesaleItem; // 도매사 코드 검색 결과일 때만 채워짐
}

export interface RefinedProduct {
  originalName: string;
  supplyPrice: number;
  candidates: NameCandidate[];
  selectedName: string | null; // 체크박스로 선택된 이름
  customName: string; // 직접 입력
  finalName: string | null; // 최종 확정명
  // 선택 필드 pass-through
  bottlesPerBox?: number;
  purpose?: string;
  stock?: number;
  code?: string;
  volume?: string;
}

export interface SalesStats {
  period: '3m';
  itemName: string;
  count: number;
  minPrice: number;
  avgPrice: number;
  medianPrice: number;
  maxPrice: number;
  noData: boolean;
  rateLimited?: boolean; // true: rate limit으로 조회 실패 (데이터 없음과 구분)
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
  appPrice: number; // 앱 내 판매가 (유저 수정 가능)
  priceDiff: number | null; // 앱 판매가 - 추천가 (null if 데이터 없음)
  salesStats: SalesStats | null;
  rateLimited?: boolean; // true: rate limit으로 Mixpanel 조회 실패
  // 선택 필드 pass-through
  bottlesPerBox?: number;
  purpose?: string;
  stock?: number;
  code?: string;
  volume?: string;
}

export interface SavedSession {
  id: string;
  title: string;
  savedAt: string; // ISO timestamp
  refinedProducts: RefinedProduct[];
  savedRows?: PriceRow[];                        // 저장 시점의 가격표 (Mixpanel 데이터 포함)
  savedStatsMap?: Record<string, SalesStats>;    // 저장 시점의 판매 통계 (rateLimited 제외)
}
