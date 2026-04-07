import { NextRequest, NextResponse } from 'next/server';
import { getSalesStatsFromFile, hasPriceHistoryFile } from '@/lib/priceHistory';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const itemName = searchParams.get('itemName');

  if (!itemName) {
    return NextResponse.json({ error: 'itemName required' }, { status: 400 });
  }

  if (!hasPriceHistoryFile()) {
    return NextResponse.json({ error: '과거 판매가 이력 파일이 없습니다.' }, { status: 503 });
  }

  try {
    const stats = getSalesStatsFromFile(itemName);
    return NextResponse.json(stats);
  } catch (err) {
    console.error('sales-stats error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
