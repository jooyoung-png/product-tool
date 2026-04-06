'use client';

import { useState, useEffect, useRef } from 'react';
import { SalesStats, SalesDot } from '@/types';
import SalesScatterChart from '@/components/ScatterChart';

interface Props {
  productNames: string[];
}

function fmt(n: number) {
  return n.toLocaleString() + '원';
}

// 모달: 특정 상품의 판매가 분포 팝업
function ChartModal({ name, onClose }: { name: string; onClose: () => void }) {
  const [dots, setDots] = useState<SalesDot[]>([]);
  const [stats, setStats] = useState<SalesStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/sales-dots?itemName=${encodeURIComponent(name)}`).then(r => r.json()),
      fetch(`/api/sales-stats?itemName=${encodeURIComponent(name)}`).then(r => r.json()),
    ]).then(([dotsData, statsData]) => {
      setDots(dotsData.dots ?? []);
      setStats(statsData);
      setLoading(false);
    });
  }, [name]);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold text-gray-800">{name}</h2>
            <p className="text-xs text-gray-400 mt-0.5">판매 가격 분포 분석 (최근 3개월)</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>

        {/* 통계 카드 */}
        {stats && !stats.noData && (
          <div className="grid grid-cols-5 gap-3 px-6 pt-4">
            {[
              { label: '판매 건수', value: `${(stats.count ?? 0).toLocaleString()}건` },
              { label: '최저가', value: fmt(stats.minPrice ?? 0) },
              { label: '평균가', value: fmt(stats.avgPrice ?? 0) },
              { label: '중위값', value: fmt(stats.medianPrice ?? 0) },
              { label: '최고가', value: fmt(stats.maxPrice ?? 0) },
            ].map(item => (
              <div key={item.label} className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-400 mb-1">{item.label}</p>
                <p className="font-semibold text-gray-800 text-sm">{item.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* 차트 */}
        <div className="flex-1 px-6 py-4 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
              <span className="animate-spin inline-block w-5 h-5 border-2 border-gray-300 border-t-blue-500 rounded-full mr-2" />
              데이터 불러오는 중...
            </div>
          ) : stats?.noData ? (
            <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
              판매 데이터가 없습니다.
            </div>
          ) : (
            <SalesScatterChart dots={dots} itemName={name} />
          )}
        </div>
      </div>
    </div>
  );
}

export default function SalesDataTable({ productNames }: Props) {
  const [statsMap, setStatsMap] = useState<Record<string, SalesStats>>({});
  const [loadingNames, setLoadingNames] = useState<string[]>([]);
  const [modalName, setModalName] = useState<string | null>(null);
  const fetchedRef = useRef<Set<string>>(new Set());

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
        <ChartModal name={modalName} onClose={() => setModalName(null)} />
      )}
    </>
  );
}
