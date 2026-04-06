import { NextRequest, NextResponse } from 'next/server';
import { loadProductNames, searchWithScores } from '@/lib/productRef';

export async function POST(req: NextRequest) {
  try {
    const { productName } = await req.json();
    if (!productName || typeof productName !== 'string') {
      return NextResponse.json({ error: 'productName required' }, { status: 400 });
    }

    const allNames = loadProductNames();
    const results = searchWithScores(productName, allNames);

    // 상위 5개, matchRate 내림차순
    const candidates = results
      .sort((a, b) => b.matchRate - a.matchRate)
      .slice(0, 5)
      .map(({ name, matchRate }) => ({ name, matchRate }));

    return NextResponse.json({ candidates });
  } catch (err) {
    console.error('refine-name error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
