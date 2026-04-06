import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { saveMeta } from '@/lib/productRef';

const DATA_DIR = path.join(process.cwd(), 'data');
const CSV_PATH = path.join(DATA_DIR, 'products.csv');

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
      return NextResponse.json({ error: 'file required' }, { status: 400 });
    }

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'csv') {
      return NextResponse.json({ error: 'CSV 파일만 지원합니다.' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(CSV_PATH, buffer);

    // 파일명에서 날짜 추출 시도 (TopProduct-2026-04-03.csv)
    const dateMatch = file.name.match(/(\d{4}-\d{2}-\d{2})/);
    const updatedAt = dateMatch ? dateMatch[1] : new Date().toISOString().split('T')[0];

    saveMeta({ updatedAt, originalName: file.name });

    return NextResponse.json({ ok: true, updatedAt, originalName: file.name });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
