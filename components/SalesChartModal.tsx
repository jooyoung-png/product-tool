'use client';

import { useState, useEffect } from 'react';
import { SalesStats, SalesDot } from '@/types';
import SalesScatterChart from '@/components/ScatterChart';

interface Props {
  name: string;
  onClose: () => void;
}

function fmt(n: number) {
  return n.toLocaleString() + '원';
}

/** 특정 상품의 판매가 분포 팝업 (최근 3개월) */
export default function SalesChartModal({ name, onClose }: Props) {
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
