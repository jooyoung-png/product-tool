import { NextRequest, NextResponse } from 'next/server';
import { getSalesDotsFromFile, hasPriceHistoryFile } from '@/lib/priceHistory';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const itemName = searchParams.get('itemName');

  if (!itemName) {
    return NextResponse.json({ error: 'itemName required' }, { status: 400 });
  }

  if (!hasPriceHistoryFile()) {
    return NextResponse.json({ dots: [] });
  }

  try {
    const dots = getSalesDotsFromFile(itemName);
    return NextResponse.json({ dots });
  } catch (err) {
    console.error('sales-dots error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
