import { NextRequest, NextResponse } from 'next/server';
import { getSalesDots } from '@/lib/mixpanel';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const itemName = searchParams.get('itemName');

  if (!itemName) {
    return NextResponse.json({ error: 'itemName required' }, { status: 400 });
  }

  try {
    const dots = await getSalesDots(itemName);
    return NextResponse.json({ dots });
  } catch (err) {
    console.error('sales-dots error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
