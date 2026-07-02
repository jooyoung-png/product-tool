import { NextRequest, NextResponse } from 'next/server';
import { loadProductIdMap } from '@/lib/productRef';

export async function POST(req: NextRequest) {
  try {
    const { names } = await req.json();
    if (!Array.isArray(names)) {
      return NextResponse.json({ error: 'names required' }, { status: 400 });
    }

    const idMap = loadProductIdMap();
    const ids: Record<string, string> = {};
    for (const name of names) {
      if (typeof name === 'string' && idMap[name]) ids[name] = idMap[name];
    }

    return NextResponse.json({ ids });
  } catch (err) {
    console.error('product-ref-ids error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
