import { NextRequest, NextResponse } from 'next/server';
import { getSalesStats } from '@/lib/mixpanel';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const itemName = searchParams.get('itemName');

  if (!itemName) {
    return NextResponse.json({ error: 'itemName required' }, { status: 400 });
  }

  try {
    const stats = await getSalesStats(itemName);
    return NextResponse.json(stats);
  } catch (err) {
    console.error('sales-stats error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
