import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const INDEX_PATH = path.join(process.cwd(), 'data', 'wholesale_index.json');

export async function GET() {
  if (!fs.existsSync(INDEX_PATH)) {
    return NextResponse.json({ meta: null, daysSinceUpdate: null });
  }
  const raw = fs.readFileSync(INDEX_PATH, 'utf-8');
  const parsed = JSON.parse(raw);
  const meta = parsed.meta ?? null;

  let daysSinceUpdate: number | null = null;
  if (meta?.generatedAt) {
    const diff = Date.now() - new Date(meta.generatedAt).getTime();
    daysSinceUpdate = Math.floor(diff / (1000 * 60 * 60 * 24));
  }

  return NextResponse.json({ meta, daysSinceUpdate });
}
