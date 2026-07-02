'use client';

import { useState, useEffect, useRef } from 'react';
import { SalesStats } from '@/types';
import SalesChartModal from '@/components/SalesChartModal';

interface Props {
  productNames: string[];
  initialStatsMap?: Record<string, SalesStats>;      // 세션 로드 시 미리 채워진 통계
  onStatsMapChange?: (map: Record<string, SalesStats>) => void; // 저장용 콜백
}

function fmt(n: number) {
  return n.toLocaleString() + '원';
}

export default function SalesDataTable({ productNames, initialStatsMap, onStatsMapChange }: Props) {
  const [statsMap, setStatsMap] = useState<Record<string, SalesStats>>(() => initialStatsMap ?? {});
  const [loadingNames, setLoadingNames] = useState<string[]>([]);
  const [modalName, setModalName] = useState<string | null>(null);
  // 세션 로드 시: rateLimited가 아닌 항목은 이미 있으므로 fetch 생략
  const fetchedRef = useRef<Set<string>>(new Set(
    Object.entries(initialStatsMap ?? {})
      .filter(([, s]) => !s.rateLimited)
      .map(([name]) => name)
  ));

  // statsMap 변경 시 부모에 알림 (저장용)
  useEffect(() => {
    if (Object.keys(statsMap).length > 0) onStatsMapChange?.(statsMap);
  }, [statsMap, onStatsMapChange]);

  useEffect(() => {
    if (productNames.length === 0) return;

    const newNames = productNames.filter(n => !fetchedRef.current.has(n));
    if (newNames.length === 0) return;

    newNames.forEach(n => fetchedRef.current.add(n));
    setLoadingNames(prev => [...prev, ...newNames]);

    Promise.all(
      newNames.map(async (name) => {
        const res = await fetch(`/api/sales-stats?itemName=${encodeURIComponent(name)}`);
        if (!res.ok) {
          const fallback: SalesStats = { noData: true, count: 0, minPrice: 0, avgPrice: 0, medianPrice: 0, maxPrice: 0, period: '3m', itemName: name };
          return [name, fallback] as [string, SalesStats];
        }
        const data: SalesStats = await res.json();
        if ('error' in data) {
          const fallback: SalesStats = { noData: true, count: 0, minPrice: 0, avgPrice: 0, medianPrice: 0, maxPrice: 0, period: '3m', itemName: name };
          return [name, fallback] as [string, SalesStats];
        }
        return [name, data] as [string, SalesStats];
      })
    ).then((entries) => {
      setStatsMap(prev => ({ ...prev, ...Object.fromEntries(entries) }));
      setLoadingNames(prev => prev.filter(n => !newNames.includes(n)));
    });
  }, [productNames]);

  return (
    <>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800">Mixpanel 판매 데이터 <span className="text-sm font-normal text-gray-400">(최근 3개월)</span></h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-2 px-3 text-gray-500 font-medium w-64">상품명</th>
                <th className="text-right py-2 px-3 text-gray-500 font-medium">판매 수량</th>
                <th className="text-right py-2 px-3 text-gray-500 font-medium">최저가</th>
                <th className="text-right py-2 px-3 text-gray-500 font-medium">평균가</th>
                <th className="text-right py-2 px-3 text-gray-500 font-medium">중위값</th>
                <th className="text-right py-2 px-3 text-gray-500 font-medium">최고가</th>
              </tr>
            </thead>
            <tbody>
              {productNames.map((name) => {
                const s = statsMap[name];
                const isLoading = loadingNames.includes(name);
                if (isLoading || !s) {
                  return (
                    <tr key={name} className="border-b border-gray-50">
                      <td className="py-3 px-3 text-gray-800">{name}</td>
                      <td colSpan={5} className="py-3 px-3 text-center text-gray-400 text-xs">
                        {isLoading ? '불러오는 중...' : ''}
                      </td>
                    </tr>
                  );
                }
                if (s.rateLimited) {
                  return (
                    <tr key={name} className="border-b border-gray-50">
                      <td className="py-3 px-3 font-medium text-gray-500">{name}</td>
                      <td colSpan={5} className="py-3 px-3 text-center">
                        <span className="inline-flex items-center gap-1.5 text-xs text-amber-500">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          조회 대기중 (rate limit)
                        </span>
                      </td>
                    </tr>
                  );
                }
                if (s.noData) {
                  return (
                    <tr key={name} className="border-b border-gray-50">
                      <td className="py-3 px-3 font-medium text-gray-500">{name}</td>
                      <td colSpan={5} className="py-3 px-3 text-center text-gray-400">데이터 없음</td>
                    </tr>
                  );
                }
                return (
                  <tr key={name} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-3 px-3">
                      <button
                        onClick={() => setModalName(name)}
                        className="text-blue-600 hover:underline font-medium text-left"
                      >
                        {name}
                      </button>
                    </td>
                    <td className="py-3 px-3 text-right text-gray-700">{(s.count ?? 0).toLocaleString()}건</td>
                    <td className="py-3 px-3 text-right text-gray-700">{fmt(s.minPrice ?? 0)}</td>
                    <td className="py-3 px-3 text-right font-medium text-gray-800">{fmt(s.avgPrice ?? 0)}</td>
                    <td className="py-3 px-3 text-right text-gray-700">{fmt(s.medianPrice ?? 0)}</td>
                    <td className="py-3 px-3 text-right text-gray-700">{fmt(s.maxPrice ?? 0)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {modalName && (
        <SalesChartModal name={modalName} onClose={() => setModalName(null)} />
      )}
    </>
  );
}
