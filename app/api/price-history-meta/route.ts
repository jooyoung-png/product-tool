import { NextResponse } from 'next/server';
import { getPriceHistoryMeta, daysSincePriceHistoryUpdate, hasPriceHistoryFile } from '@/lib/priceHistory';

export async function GET() {
  const meta = getPriceHistoryMeta();
  const days = daysSincePriceHistoryUpdate();
  const hasFile = hasPriceHistoryFile();
  return NextResponse.json({ meta, daysSinceUpdate: days, hasFile });
}
