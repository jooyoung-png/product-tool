import { NextRequest, NextResponse } from 'next/server';
import { getSalesDots } from '@/lib/mixpanel';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const itemName = searchParams.get('itemName');
  const months = Number(searchParams.get('months') || '3') as 3 | 6 | 12;

  if (!itemName) {
    return NextResponse.json({ error: 'itemName required' }, { status: 400 });
  }

  try {
    const dots = await getSalesDots(itemName, months);
    return NextResponse.json({ dots });
  } catch (err) {
    console.error('sales-dots error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
