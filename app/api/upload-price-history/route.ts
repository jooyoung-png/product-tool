import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { savePriceHistoryMeta, invalidateCache } from '@/lib/priceHistory';

const DATA_DIR = path.join(process.cwd(), 'data');
const CSV_PATH = path.join(DATA_DIR, 'price_history.csv');

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'file required' }, { status: 400 });

    if (!file.name.endsWith('.csv')) {
      return NextResponse.json({ error: 'CSV 파일만 지원합니다.' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(CSV_PATH, buffer);

    // 파일명에서 날짜 범위 추출 (mixpanel_export_2026-01-07_2026-04-07.csv)
    const dates = [...file.name.matchAll(/(\d{4}-\d{2}-\d{2})/g)].map(m => m[1]);
    const updatedAt = new Date().toISOString().split('T')[0];
    const fromDate = dates[0];
    const toDate = dates[1] ?? updatedAt;

    savePriceHistoryMeta({ updatedAt, originalName: file.name, fromDate, toDate });
    invalidateCache();

    return NextResponse.json({ ok: true, updatedAt, originalName: file.name, fromDate, toDate });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
