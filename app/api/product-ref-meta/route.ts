import { NextResponse } from 'next/server';
import { getMeta, daysSinceUpdate } from '@/lib/productRef';

export async function GET() {
  const meta = getMeta();
  const days = daysSinceUpdate();
  return NextResponse.json({ meta, daysSinceUpdate: days });
}
