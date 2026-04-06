import { NextRequest, NextResponse } from 'next/server';
import { getSalesStats } from '@/lib/mixpanel';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const itemName = searchParams.get('itemName');
  const months = Number(searchParams.get('months') || '3') as 3 | 6 | 12;

  if (!itemName) {
    return NextResponse.json({ error: 'itemName required' }, { status: 400 });
  }
  if (![3, 6, 12].includes(months)) {
    return NextResponse.json({ error: 'months must be 3, 6, or 12' }, { status: 400 });
  }

  try {
    const stats = await getSalesStats(itemName, months);
    return NextResponse.json(stats);
  } catch (err) {
    console.error('sales-stats error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
