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
  initialRows?: PriceRow[];                    // 세션 로드 시 미리 채워진 rows
  onRowsChange?: (rows: PriceRow[]) => void;   // 저장용 콜백
  onDeleteRow?: (productName: string) => void; // 행 삭제 시 부모 동기화
  defaultMargin?: number;                      // 기본 도매마진률 (기본값 7)
  recalculateTrigger?: number;                 // 증가할 때마다 전체 재계산
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

function applyDSCap(appPrice: number, wholesalePrice: number, storeProfit: number, supplyPrice: number) {
  let fee = calcDailyshotFee(appPrice, wholesalePrice, storeProfit);
  let feeRate = calcDailyshotFeeRate(fee, appPrice);
  let wp = wholesalePrice;
  let effectiveMarginPct: number | null = null;

  // DS 수수료율 13.3% 상한 초과시 도매가 상향 조정
  if (feeRate > 0.133) {
    wp = appPrice - storeProfit - appPrice * 0.133;
    // 부동소수점 오차 방지: fee/feeRate를 역산하지 않고 직접 고정
    fee = appPrice * 0.133;
    feeRate = 0.133;
    // 상향된 도매가로 실제 도매수익률 역산: margin = 1 - (공급가 * 1.1) / 도매판매가
    effectiveMarginPct = Math.round((1 - (supplyPrice * 1.1) / wp) * 1000) / 10;
  }
  return { wholesalePrice: wp, fee, feeRate, effectiveMarginPct };
}

// applyCap: 최초 계산 시에만 true — 수동 수정 시에는 cap 미적용
function computeRow(base: PriceRow, marginPct: number, overrideAppPrice?: number, applyCap = false): PriceRow {
  const wholesalePrice = calcWholesalePrice(base.supplyPrice, marginPct / 100);

  const appPrice = overrideAppPrice !== undefined
    ? overrideAppPrice
    : calcAppPrice(
        base.recommendedPrice === '데이터 없음' ? null : (base.recommendedPrice as number),
        wholesalePrice
      );

  const storeProfit = calcStoreProfit(appPrice);
  let wp = wholesalePrice;
  let fee = calcDailyshotFee(appPrice, wp, storeProfit);
  let feeRate = calcDailyshotFeeRate(fee, appPrice);
  let actualMarginPct = marginPct;

  if (applyCap && feeRate > 0.133) {
    const capped = applyDSCap(appPrice, wholesalePrice, storeProfit, base.supplyPrice);
    wp = capped.wholesalePrice;
    fee = capped.fee;
    feeRate = capped.feeRate;
    actualMarginPct = capped.effectiveMarginPct !== null ? capped.effectiveMarginPct : marginPct;
  }

  const priceDiff = base.recommendedPrice !== '데이터 없음'
    ? appPrice - (base.recommendedPrice as number)
    : null;

  return { ...base, wholesaleMargin: actualMarginPct, wholesalePrice: wp, appPrice, storeProfit, dailyshotFee: fee, dailyshotFeeRate: feeRate, priceDiff };
}

export default function PriceTable({ products, initialRows, onRowsChange, onDeleteRow, defaultMargin = 7, recalculateTrigger = 0 }: Props) {
  const [rows, setRows] = useState<PriceRow[]>(() => initialRows ?? []);
  const [inputs, setInputs] = useState<Record<string, RowInput>>(() => {
    const m: Record<string, RowInput> = {};
    (initialRows ?? []).forEach(r => {
      m[r.productName] = { supplyPrice: String(r.supplyPrice), margin: String(r.wholesaleMargin), appPrice: String(r.appPrice) };
    });
    return m;
  });
  const [isLoading, setIsLoading] = useState(false);
  // 세션 로드 시: rateLimited가 아닌 행은 이미 있으므로 fetch 생략
  const fetchedNamesRef = useRef<Set<string>>(new Set(
    (initialRows ?? []).filter(r => !r.rateLimited).map(r => r.productName)
  ));

  // rows 변경 시 부모에 알림 (저장용)
  useEffect(() => {
    if (rows.length > 0) onRowsChange?.(rows);
  }, [rows, onRowsChange]);

  // 재계산 트리거: defaultMargin으로 전체 행 재계산 (앱 판매가도 자동 재산정)
  const prevTriggerRef = useRef(0);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  useEffect(() => {
    if (recalculateTrigger === 0 || recalculateTrigger === prevTriggerRef.current) return;
    prevTriggerRef.current = recalculateTrigger;

    const recalculated = rowsRef.current.map((row) => computeRow(row, defaultMargin));
    setRows(recalculated);
    setInputs((prev) => {
      const updated = { ...prev };
      recalculated.forEach((row) => {
        updated[row.productName] = {
          supplyPrice: String(row.supplyPrice),
          margin: String(row.wholesaleMargin),
          appPrice: String(row.appPrice),
        };
      });
      return updated;
    });
  }, [recalculateTrigger, defaultMargin]);

  const fetchStats = useCallback(async (productName: string) => {
    const res = await fetch(`/api/sales-stats?itemName=${encodeURIComponent(productName)}`);
    const stats: SalesStats = await res.json();
    return stats;
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
        const stats = await fetchStats(name);
        const margin = defaultMargin;
        const wholesalePrice = calcWholesalePrice(p.supplyPrice, margin / 100);

        const recommendedPrice: number | '데이터 없음' = stats.noData
          ? '데이터 없음'
          : calcRecommendedPrice(stats.avgPrice);

        const appPrice = calcAppPrice(
          recommendedPrice === '데이터 없음' ? null : recommendedPrice,
          wholesalePrice
        );

        const storeProfit = calcStoreProfit(appPrice);
        const { wholesalePrice: wp, fee, feeRate, effectiveMarginPct } = applyDSCap(appPrice, wholesalePrice, storeProfit, p.supplyPrice);
        const actualMargin = effectiveMarginPct !== null ? effectiveMarginPct : margin;

        const priceDiff = recommendedPrice !== '데이터 없음'
          ? appPrice - (recommendedPrice as number)
          : null;

        return {
          productName: name,
          supplyPrice: p.supplyPrice,
          wholesaleMargin: actualMargin,
          wholesalePrice: wp,
          storeProfit,
          dailyshotFee: fee,
          dailyshotFeeRate: feeRate,
          recommendedPrice,
          appPrice,
          priceDiff,
          salesStats: stats.noData ? null : stats,
          rateLimited: stats.rateLimited ?? false,
          bottlesPerBox: p.bottlesPerBox,
          purpose: p.purpose,
          stock: p.stock,
          code: p.code,
          volume: p.volume,
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
        return computeRow(row, marginPct, overrideApp);
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
    fetchedNamesRef.current.delete(productName); // 재조회 가능하도록 캐시에서도 제거
    onDeleteRow?.(productName);
  };

  if (rows.length === 0 && isLoading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 text-center text-gray-400 text-sm">
        가격 데이터 계산 중...
      </div>
    );
  }

  const handleExportBulkRegister = () => {
    const headers = [
      '상위 상품명', '쇼핑백 제공 유형', '수입제조사', '용도', '용량',
      '공급가', '도매 마진율', '판매가', '신규 오픈일', '박스 내 병 단위',
      'Distribution', 'Code', '상태', 'Maximum',
    ];
    const csvRows = rows.map(row => [
      row.productName,                // 상위 상품명 = 정제된 상품명
      '',                              // 쇼핑백 제공 유형 = 공란
      '',                              // 수입제조사 = 공란
      row.purpose ?? '',               // 용도
      row.volume ?? '',                // 용량
      row.supplyPrice,                 // 공급가
      row.wholesaleMargin,             // 도매 마진율
      row.appPrice,                    // 판매가 = 앱 판매가
      '',                              // 신규 오픈일 = 공란
      row.bottlesPerBox ?? '',         // 박스 내 병 단위
      '',                              // Distribution = 공란
      row.code ?? '',                  // Code
      '숨김',                          // 상태 = 고정값
      row.stock ?? '',                 // Maximum = 재고
    ]);

    const bom = '\uFEFF';
    const csv = bom + [headers, ...csvRows]
      .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\r\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `일괄등록_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCsv = () => {
    const headers = ['상품명', '공급가', '도매수익률(%)', '도매판매가', '매장순수익', 'DS수수료', 'DS수수료율(%)', '앱추천가', '앱판매가', '가격비교'];
    const csvRows = rows.map(row => [
      row.productName,
      row.supplyPrice,
      row.wholesaleMargin,
      Math.round(row.wholesalePrice),
      row.storeProfit,
      Math.round(row.dailyshotFee),
      (row.dailyshotFeeRate * 100).toFixed(1),
      row.recommendedPrice === '데이터 없음' ? '' : row.recommendedPrice,
      row.appPrice,
      row.priceDiff !== null ? row.priceDiff : '',
    ]);

    const bom = '\uFEFF'; // 한글 깨짐 방지
    const csv = bom + [headers, ...csvRows]
      .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\r\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `가격표_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (rows.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-800">가격표</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportBulkRegister}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            일괄등록 양식 내보내기
          </button>
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            CSV 내보내기
          </button>
        </div>
      </div>

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
                  <td className={`py-3 px-3 text-right font-medium ${
                    row.dailyshotFeeRate > 0.133
                      ? 'text-red-500'
                      : row.dailyshotFeeRate >= 0.08
                      ? 'text-green-600'
                      : 'text-red-500'
                  }`}>
                    {fmtRate(row.dailyshotFeeRate)}
                  </td>

                  <td className="py-3 px-3 text-right text-gray-700">
                    {row.recommendedPrice === '데이터 없음'
                      ? row.rateLimited
                        ? <span className="text-amber-400 text-xs">조회 대기중</span>
                        : <span className="text-gray-400">데이터 없음</span>
                      : <span>{fmt(row.recommendedPrice as number)}</span>
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
