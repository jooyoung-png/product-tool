'use client';

import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { SalesDot } from '@/types';

interface Props {
  dots: SalesDot[];
  itemName: string;
}

interface ChartPoint {
  x: number; // timestamp
  y: number; // price
  date: string;
  serviceType: string;
}

const SERVICE_GROUPS = [
  { key: 'partner', label: '파트너', color: '#f97316' },
  { key: 'store', label: '스토어', color: '#3b82f6' },
  { key: 'cu', label: 'CU', color: '#a855f7' },
  { key: 'emart24', label: '이마트24', color: '#eab308' },
  { key: 'other', label: '기타', color: '#9ca3af' },
];

function classifyServiceType(serviceType: string | undefined): string {
  if (!serviceType) return 'other';
  const s = serviceType.toLowerCase();
  if (s.includes('파트너') || s === 'partner') return 'partner';
  if (s.includes('스토어') || s === 'store') return 'store';
  if (s.startsWith('cu') || s.includes(' cu')) return 'cu';
  if (s.includes('이마트24') || s.includes('emart24')) return 'emart24';
  return 'other';
}

const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: ChartPoint }> }) => {
  if (active && payload && payload.length > 0) {
    const d = payload[0].payload;
    const group = SERVICE_GROUPS.find(g => g.key === classifyServiceType(d.serviceType));
    return (
      <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm shadow-md">
        <p className="text-gray-500">{d.date}</p>
        <p className="font-semibold text-gray-800">{d.y.toLocaleString()}원</p>
        {d.serviceType && (
          <p className="text-xs mt-0.5" style={{ color: group?.color ?? '#9ca3af' }}>{d.serviceType}</p>
        )}
      </div>
    );
  }
  return null;
};

export default function SalesScatterChart({ dots, itemName }: Props) {
  if (dots.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
        판매 데이터가 없습니다.
      </div>
    );
  }

  const allPoints: ChartPoint[] = dots.map((d) => ({
    x: new Date(d.date).getTime(),
    y: d.price,
    date: d.date,
    serviceType: d.serviceType ?? '',
  }));

  // Group points by service type category
  const grouped: Record<string, ChartPoint[]> = {};
  for (const g of SERVICE_GROUPS) grouped[g.key] = [];
  for (const pt of allPoints) {
    const key = classifyServiceType(pt.serviceType);
    grouped[key].push(pt);
  }

  // Only render groups that have data
  const activeGroups = SERVICE_GROUPS.filter(g => grouped[g.key].length > 0);

  const minY = Math.min(...allPoints.map((d) => d.y));
  const maxY = Math.max(...allPoints.map((d) => d.y));
  const padding = (maxY - minY) * 0.1 || 5000;

  const formatDate = (ts: number) =>
    new Date(ts).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });

  const formatPrice = (v: number) => `${(v / 1000).toFixed(0)}K`;

  return (
    <div>
      {activeGroups.length > 1 && (
        <div className="flex gap-3 mb-3 flex-wrap">
          {activeGroups.map(g => (
            <div key={g.key} className="flex items-center gap-1.5 text-xs text-gray-600">
              <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: g.color }} />
              {g.label}
            </div>
          ))}
        </div>
      )}
      <ResponsiveContainer width="100%" height={320}>
        <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="x"
            type="number"
            domain={['auto', 'auto']}
            scale="time"
            tickFormatter={formatDate}
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            tickLine={false}
            axisLine={false}
            label={{ value: '날짜', position: 'insideBottomRight', offset: -10, fontSize: 11, fill: '#9ca3af' }}
          />
          <YAxis
            dataKey="y"
            type="number"
            domain={[Math.max(0, minY - padding), maxY + padding]}
            tickFormatter={formatPrice}
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            tickLine={false}
            axisLine={false}
            label={{ value: '가격 (원)', angle: -90, position: 'insideLeft', offset: 10, fontSize: 11, fill: '#9ca3af' }}
          />
          <Tooltip content={<CustomTooltip />} />
          {activeGroups.map(g => (
            <Scatter
              key={g.key}
              name={g.label}
              data={grouped[g.key]}
              fill={g.color}
              opacity={0.7}
            />
          ))}
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
