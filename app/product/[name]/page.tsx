'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import SalesScatterChart from '@/components/ScatterChart';
import { SalesDot, SalesStats } from '@/types';

type Period = 3 | 6 | 12;

function fmt(n: number) {
  return n.toLocaleString() + '원';
}

export default function ProductPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = use(params);
  const itemName = decodeURIComponent(name);

  const [period, setPeriod] = useState<Period>(3);
  const [dots, setDots] = useState<SalesDot[]>([]);
  const [stats, setStats] = useState<SalesStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/sales-dots?itemName=${encodeURIComponent(itemName)}&months=${period}`).then((r) => r.json()),
      fetch(`/api/sales-stats?itemName=${encodeURIComponent(itemName)}&months=${period}`).then((r) => r.json()),
    ]).then(([dotsData, statsData]) => {
      setDots(dotsData.dots ?? []);
      setStats(statsData);
      setLoading(false);
    });
  }, [itemName, period]);

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-10">
        {/* 헤더 */}
        <div className="mb-6">
          <Link href="/" className="text-sm text-blue-600 hover:underline flex items-center gap-1 mb-3">
            ← 목록으로
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">{itemName}</h1>
          <p className="text-sm text-gray-400 mt-1">판매 가격 분포 분석</p>
        </div>

        {/* 기간 선택 */}
        <div className="flex gap-1 mb-4">
          {([3, 6, 12] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                period === p
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {p}개월
            </button>
          ))}
        </div>

        {/* 통계 카드 */}
        {stats && !stats.noData && stats.count != null && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
            {[
              { label: '판매 건수', value: `${(stats.count ?? 0).toLocaleString()}건` },
              { label: '최저가', value: fmt(stats.minPrice ?? 0) },
              { label: '평균가', value: fmt(stats.avgPrice ?? 0) },
              { label: '중위값', value: fmt(stats.medianPrice ?? 0) },
              { label: '최고가', value: fmt(stats.maxPrice ?? 0) },
            ].map((item) => (
              <div key={item.label} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                <p className="text-xs text-gray-400 mb-1">{item.label}</p>
                <p className="font-semibold text-gray-800">{item.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* 분포 차트 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-base font-semibold text-gray-700 mb-4">
            최근 {period}개월 판매가 분포
          </h2>
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
            <SalesScatterChart dots={dots} itemName={itemName} />
          )}
        </div>
      </div>
    </main>
  );
}
