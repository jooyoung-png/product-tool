import { NextRequest, NextResponse } from 'next/server';
import { loadProductNames, searchCandidates } from '@/lib/productRef';

export async function POST(req: NextRequest) {
  try {
    const { productName } = await req.json();
    if (!productName || typeof productName !== 'string') {
      return NextResponse.json({ error: 'productName required' }, { status: 400 });
    }

    const allNames = loadProductNames();
    const candidates = searchCandidates(productName, allNames);

    if (candidates.length === 0) {
      return NextResponse.json({ candidates: [] });
    }

    // matchRate 계산: 매칭 토큰 수 + 길이 유사도 기반
    const queryTokens = productName
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length >= 1);

    const withRate = candidates.map((name) => {
      const lower = name.toLowerCase();
      let matchedCount = 0;
      for (const t of queryTokens) {
        if (lower.includes(t)) matchedCount++;
      }
      // 토큰 완전 일치율 * 80 + 길이 유사도 * 20
      const tokenRate = queryTokens.length > 0 ? matchedCount / queryTokens.length : 0;
      const lenSimilarity = Math.max(0, 1 - Math.abs(name.length - productName.length) / Math.max(name.length, productName.length));
      const matchRate = Math.round(tokenRate * 80 + lenSimilarity * 20);
      return { name, matchRate };
    });

    // matchRate 내림차순 정렬, 상위 5개만
    withRate.sort((a, b) => b.matchRate - a.matchRate);
    return NextResponse.json({ candidates: withRate.slice(0, 5) });
  } catch (err) {
    console.error('refine-name error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
