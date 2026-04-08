import { NextRequest, NextResponse } from 'next/server';
import { getWholesaleByCode } from '@/lib/wholesaleRef';

export async function POST(req: NextRequest) {
  try {
    const { wholesaleCode } = await req.json();
    if (!wholesaleCode || typeof wholesaleCode !== 'string') {
      return NextResponse.json({ error: 'wholesaleCode required' }, { status: 400 });
    }

    const items = getWholesaleByCode(wholesaleCode);
    return NextResponse.json({ items });
  } catch (err) {
    console.error('wholesale-search error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
