'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { RefinedProduct, PriceRow, SalesStats } from '@/types';
import {
  calcWholesalePrice,
  calcStoreProfit,
  calcDailyshotFee,
  calcDailyshotFeeRate,
  calcRecommendedPrice,
  calcAppPrice,
} from '@/lib/priceCalc';

interface Props {
  products: RefinedProduct[];
}

// 행별 입력 중인 raw 문자열 (즉시 재계산용)
interface RowInput {
  supplyPrice: string;
  margin: string;
  appPrice: string;
}

function fmt(n: number) {
  return n.toLocaleString() + '원';
}

function fmtRate(r: number) {
  return (r * 100).toFixed(1) + '%';
}

function fmtDiff(diff: number) {
  const prefix = diff > 0 ? '+' : '';
  return prefix + diff.toLocaleString() + '원';
}

function applyDSCap(appPrice: number, wholesalePrice: number, storeProfit: number) {
  let fee = calcDailyshotFee(appPrice, wholesalePrice, storeProfit);
  let feeRate = calcDailyshotFeeRate(fee, appPrice);
  let wp = wholesalePrice;

  // DS 수수료율 13.3% 상한 초과시 도매가 상향 조정
  if (feeRate > 0.133) {
    wp = appPrice - storeProfit - appPrice * 0.133;
    fee = calcDailyshotFee(appPrice, wp, storeProfit);
    feeRate = calcDailyshotFeeRate(fee, appPrice);
  }
  return { wholesalePrice: wp, fee, feeRate };
}

function computeRow(base: PriceRow, marginPct: number, overrideAppPrice?: number): PriceRow {
  let wholesalePrice = calcWholesalePrice(base.supplyPrice, marginPct / 100);

  const appPrice = overrideAppPrice !== undefined
    ? overrideAppPrice
    : calcAppPrice(
        base.recommendedPrice === '데이터 없음' ? null : (base.recommendedPrice as number),
        wholesalePrice
      );

  const storeProfit = calcStoreProfit(appPrice);
  const { wholesalePrice: wp, fee, feeRate } = applyDSCap(appPrice, wholesalePrice, storeProfit);

  const priceDiff = base.recommendedPrice !== '데이터 없음'
    ? appPrice - (base.recommendedPrice as number)
    : null;

  return { ...base, wholesaleMargin: marginPct, wholesalePrice: wp, appPrice, storeProfit, dailyshotFee: fee, dailyshotFeeRate: feeRate, priceDiff };
}

export default function PriceTable({ products }: Props) {
  const [rows, setRows] = useState<PriceRow[]>([]);
  const [inputs, setInputs] = useState<Record<string, RowInput>>({});
  const [isLoading, setIsLoading] = useState(false);
  const fetchedNamesRef = useRef<Set<string>>(new Set());

  const fetchStats = useCallback(async (productName: string) => {
    const [res3m, res6m] = await Promise.all([
      fetch(`/api/sales-stats?itemName=${encodeURIComponent(productName)}&months=3`),
      fetch(`/api/sales-stats?itemName=${encodeURIComponent(productName)}&months=6`),
    ]);
    const stats3m: SalesStats = await res3m.json();
    const stats6m: SalesStats = await res6m.json();
    return { stats3m, stats6m };
  }, []);

  useEffect(() => {
    const confirmed = products.filter((p) => p.finalName);
    const newProducts = confirmed.filter(p => !fetchedNamesRef.current.has(p.finalName!));

    if (newProducts.length === 0) return;

    // Ref를 fetch 시작 전에 업데이트 (strict mode 이중 실행 시 중복 fetch 방지)
    newProducts.forEach(p => fetchedNamesRef.current.add(p.finalName!));
    setIsLoading(true);

    Promise.all(
      newProducts.map(async (p) => {
        const name = p.finalName!;
        const { stats3m, stats6m } = await fetchStats(name);
        const margin = 7;
        const wholesalePrice = calcWholesalePrice(p.supplyPrice, margin / 100);

        let recommendedPrice: number | '데이터 없음' = '데이터 없음';
        let recommendedPriceTag: '6m' | null = null;

        if (!stats3m.noData) {
          recommendedPrice = calcRecommendedPrice(stats3m.avgPrice);
        } else if (!stats6m.noData) {
          recommendedPrice = calcRecommendedPrice(stats6m.avgPrice);
          recommendedPriceTag = '6m';
        }

        const appPrice = calcAppPrice(
          recommendedPrice === '데이터 없음' ? null : recommendedPrice,
          wholesalePrice
        );

        const storeProfit = calcStoreProfit(appPrice);
        const { wholesalePrice: wp, fee, feeRate } = applyDSCap(appPrice, wholesalePrice, storeProfit);

        const priceDiff = recommendedPrice !== '데이터 없음'
          ? appPrice - (recommendedPrice as number)
          : null;

        return {
          productName: name,
          supplyPrice: p.supplyPrice,
          wholesaleMargin: margin,
          wholesalePrice: wp,
          storeProfit,
          dailyshotFee: fee,
          dailyshotFeeRate: feeRate,
          recommendedPrice,
          recommendedPriceTag,
          appPrice,
          priceDiff,
          salesStats3m: stats3m.noData ? null : stats3m,
          salesStats6m: stats6m.noData ? null : stats6m,
        } as PriceRow;
      })
    ).then((newRows) => {
      setRows((prev) => [...prev, ...newRows]);
      setInputs((prev) => {
        const updated = { ...prev };
        newRows.forEach(r => {
          updated[r.productName] = { supplyPrice: String(r.supplyPrice), margin: String(r.wholesaleMargin), appPrice: String(r.appPrice) };
        });
        return updated;
      });
      setIsLoading(false);
    });
  }, [products, fetchStats]);

  const handleMarginChange = (productName: string, value: string) => {
    setInputs((prev) => ({ ...prev, [productName]: { ...prev[productName], margin: value } }));

    const marginPct = parseFloat(value);
    if (isNaN(marginPct) || marginPct < 0 || marginPct > 100) return;

    setRows((prev) =>
      prev.map((row) => {
        if (row.productName !== productName) return row;
        const currentAppPrice = parseInt(inputs[productName]?.appPrice?.replace(/,/g, '') ?? '', 10);
        const overrideApp = !isNaN(currentAppPrice) && currentAppPrice > 0 ? currentAppPrice : undefined;
        const updated = computeRow(row, marginPct, overrideApp);
        // 앱 판매가 input도 동기화 (도매수익률 변경 시 앱 판매가가 재계산되므로)
        if (overrideApp === undefined) {
          setInputs((prev2) => ({ ...prev2, [productName]: { ...prev2[productName], margin: value, appPrice: String(updated.appPrice) } }));
        }
        return updated;
      })
    );
  };

  const handleAppPriceChange = (productName: string, value: string) => {
    setInputs((prev) => ({ ...prev, [productName]: { ...prev[productName], appPrice: value } }));

    const appPriceNum = parseInt(value.replace(/,/g, ''), 10);
    if (isNaN(appPriceNum) || appPriceNum <= 0) return;

    setRows((prev) =>
      prev.map((row) => {
        if (row.productName !== productName) return row;
        return computeRow(row, row.wholesaleMargin, appPriceNum);
      })
    );
  };

  const handleSupplyPriceChange = (productName: string, value: string) => {
    setInputs((prev) => ({ ...prev, [productName]: { ...prev[productName], supplyPrice: value } }));

    const supplyPriceNum = parseInt(value.replace(/,/g, ''), 10);
    if (isNaN(supplyPriceNum) || supplyPriceNum <= 0) return;

    setRows((prev) =>
      prev.map((row) => {
        if (row.productName !== productName) return row;
        const currentAppPrice = parseInt(inputs[productName]?.appPrice?.replace(/,/g, '') ?? '', 10);
        const overrideApp = !isNaN(currentAppPrice) && currentAppPrice > 0 ? currentAppPrice : undefined;
        return computeRow({ ...row, supplyPrice: supplyPriceNum }, row.wholesaleMargin, overrideApp);
      })
    );
  };

  const handleDeleteRow = (idx: number, productName: string) => {
    setRows((prev) => prev.filter((_, i) => i !== idx));
    setInputs((prev) => {
      const next = { ...prev };
      delete next[productName];
      return next;
    });
  };

  if (rows.length === 0 && isLoading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 text-center text-gray-400 text-sm">
        가격 데이터 계산 중...
      </div>
    );
  }

  if (rows.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">가격표</h2>

      <div className="overflow-x-auto">
        <table className="w-full text-sm whitespace-nowrap">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left py-2 px-3 text-gray-500 font-medium min-w-[180px]">상품명</th>
              <th className="text-center py-2 px-3 text-gray-500 font-medium min-w-[120px]">공급가</th>
              <th className="text-center py-2 px-3 text-gray-500 font-medium min-w-[100px]">도매수익률</th>
              <th className="text-right py-2 px-3 text-gray-500 font-medium">도매판매가</th>
              <th className="text-right py-2 px-3 text-gray-500 font-medium">매장 순수익</th>
              <th className="text-right py-2 px-3 text-gray-500 font-medium">DS수수료</th>
              <th className="text-right py-2 px-3 text-gray-500 font-medium">DS수수료율</th>
              <th className="text-right py-2 px-3 text-gray-500 font-medium">앱 추천가</th>
              <th className="text-center py-2 px-3 text-gray-500 font-medium min-w-[130px]">앱 판매가</th>
              <th className="text-center py-2 px-3 text-gray-500 font-medium">가격비교</th>
              <th className="py-2 px-2 w-8" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const input = inputs[row.productName] ?? { supplyPrice: String(row.supplyPrice), margin: String(row.wholesaleMargin), appPrice: String(row.appPrice) };
              return (
                <tr key={`${row.productName}_${idx}`} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-3 px-3 font-medium text-gray-800">{row.productName}</td>
                  {/* 공급가 */}
                  <td className="py-3 px-3">
                    <input
                      type="text"
                      value={input.supplyPrice}
                      onChange={(e) => handleSupplyPriceChange(row.productName, e.target.value)}
                      className="w-24 border border-gray-200 rounded-lg px-2 py-1 text-right text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </td>

                  {/* 도매수익률 */}
                  <td className="py-3 px-3">
                    <div className="flex items-center justify-center gap-1">
                      <input
                        type="number"
                        value={input.margin}
                        onChange={(e) => handleMarginChange(row.productName, e.target.value)}
                        min={0}
                        max={100}
                        step={0.1}
                        className="w-14 border border-gray-200 rounded-lg px-2 py-1 text-sm text-center text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="text-gray-400 text-xs">%</span>
                    </div>
                  </td>

                  <td className="py-3 px-3 text-right text-gray-700">{fmt(Math.round(row.wholesalePrice))}</td>
                  <td className="py-3 px-3 text-right text-gray-700">{fmt(row.storeProfit)}</td>
                  <td className="py-3 px-3 text-right text-gray-700">{fmt(Math.round(row.dailyshotFee))}</td>
                  <td className={`py-3 px-3 text-right font-medium ${row.dailyshotFeeRate >= 0.08 ? 'text-green-600' : 'text-red-500'}`}>
                    {fmtRate(row.dailyshotFeeRate)}
                  </td>

                  <td className="py-3 px-3 text-right text-gray-700">
                    {row.recommendedPrice === '데이터 없음'
                      ? <span className="text-gray-400">데이터 없음</span>
                      : (
                        <span>
                          {fmt(row.recommendedPrice as number)}
                          {row.recommendedPriceTag && (
                            <span className="ml-1 text-xs bg-orange-100 text-orange-500 px-1.5 py-0.5 rounded">6m</span>
                          )}
                        </span>
                      )
                    }
                  </td>

                  {/* 앱 판매가 */}
                  <td className="py-3 px-3">
                    <input
                      type="text"
                      value={input.appPrice}
                      onChange={(e) => handleAppPriceChange(row.productName, e.target.value)}
                      className="w-28 border border-gray-200 rounded-lg px-2 py-1 text-right text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </td>

                  {/* 가격비교 */}
                  <td className="py-3 px-3 text-center">
                    {row.priceDiff === null ? (
                      <span className="text-gray-400 text-xs">-</span>
                    ) : (
                      <span className={`text-xs font-medium ${
                        row.priceDiff > 0 ? 'text-red-500' : row.priceDiff < 0 ? 'text-green-600' : 'text-gray-500'
                      }`}>
                        {fmtDiff(row.priceDiff)}
                      </span>
                    )}
                  </td>

                  {/* 삭제 */}
                  <td className="py-3 px-2">
                    <button
                      onClick={() => handleDeleteRow(idx, row.productName)}
                      className="text-gray-300 hover:text-red-400 transition-colors text-base leading-none"
                      title="행 삭제"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
