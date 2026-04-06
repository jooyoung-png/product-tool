/**
 * 도매판매가 계산
 * =ROUNDDOWN(((공급가*1.1)/(1-도매마진율)/1.1),-1)*1.1
 */
export function calcWholesalePrice(supplyPrice: number, marginRate: number): number {
  const raw = ((supplyPrice * 1.1) / (1 - marginRate)) / 1.1;
  const rounded = Math.floor(raw / 10) * 10; // ROUNDDOWN(-1) = 10원 단위 내림
  return rounded * 1.1;
}

/**
 * 매장 순수익: 앱 내 판매가 * 7% (max: 10,000)
 */
export function calcStoreProfit(appPrice: number): number {
  return Math.min(Math.round(appPrice * 0.07), 10000);
}

/**
 * 데일리샷 수수료: 앱 내 판매가 - 도매판매가 - 매장 순수익
 */
export function calcDailyshotFee(appPrice: number, wholesalePrice: number, storeProfit: number): number {
  return appPrice - wholesalePrice - storeProfit;
}

/**
 * 데일리샷 수수료율: 데일리샷 수수료 / 앱 내 판매가
 */
export function calcDailyshotFeeRate(fee: number, appPrice: number): number {
  if (appPrice === 0) return 0;
  return fee / appPrice;
}

const VALID_ENDINGS = [400, 500, 900];

/**
 * 가격의 끝자리가 400, 500, 900인지 확인 (100원 단위 기준)
 */
function hasValidEnding(price: number): boolean {
  const mod = Math.round(price) % 1000;
  return VALID_ENDINGS.includes(mod);
}

/**
 * 데일리샷 수수료율이 8%를 넘고 끝자리가 400/500/900인 최저값 계산
 * wholesalePrice를 기반으로 최소 price를 올려가며 찾음
 */
export function calcMinValidAppPrice(wholesalePrice: number): number {
  // 도매판매가 기준으로 위에서 최소값 탐색
  const startPrice = Math.ceil(wholesalePrice / 1000) * 1000;

  for (let price = startPrice; price <= startPrice + 200000; price += 100) {
    if (!hasValidEnding(price)) continue;

    const storeProfit = calcStoreProfit(price);
    const fee = calcDailyshotFee(price, wholesalePrice, storeProfit);
    const feeRate = calcDailyshotFeeRate(fee, price);

    if (feeRate > 0.08) {
      return price;
    }
  }
  return startPrice;
}

/**
 * 앱 내 추천가 계산
 * 3개월 평균가와 유사, 끝자리 400/500/900
 */
export function calcRecommendedPrice(avgPrice: number): number {
  // avgPrice에서 가장 가까운 400/500/900 끝자리 값 찾기
  const base = Math.floor(avgPrice / 1000) * 1000;
  const candidates: number[] = [];

  for (let i = -1; i <= 2; i++) {
    for (const ending of VALID_ENDINGS) {
      candidates.push(base + i * 1000 + ending);
    }
  }

  // avgPrice와 가장 가까운 값
  candidates.sort((a, b) => Math.abs(a - avgPrice) - Math.abs(b - avgPrice));
  return candidates[0];
}

/**
 * 앱 내 판매가 계산
 */
export function calcAppPrice(
  recommendedPrice: number | null,
  wholesalePrice: number
): number {
  if (recommendedPrice !== null) {
    // 추천가로 수익률 계산
    const storeProfit = calcStoreProfit(recommendedPrice);
    const fee = calcDailyshotFee(recommendedPrice, wholesalePrice, storeProfit);
    const feeRate = calcDailyshotFeeRate(fee, recommendedPrice);

    if (feeRate > 0.08) {
      return recommendedPrice;
    }
  }
  // 수익률 8% 초과 + 끝자리 조건 최저값
  return calcMinValidAppPrice(wholesalePrice);
}

/**
 * 가격 평가
 */
export function evalPrice(
  appPrice: number,
  avg3m: number | null,
  median3m: number | null
): '비쌈' | '평균' | '저렴함' | '데이터 없음' {
  if (avg3m === null || median3m === null) return '데이터 없음';

  if (appPrice > avg3m || appPrice > median3m) return '비쌈';
  if (appPrice < avg3m || appPrice < median3m) return '저렴함';
  return '평균';
}
