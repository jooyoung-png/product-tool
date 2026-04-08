import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const INDEX_PATH = path.join(DATA_DIR, 'wholesale_index.json');

export interface WholesaleItem {
  id: number;
  name: string;
  status: string;
  supplyPrice: number;
  wholesalePrice: number;
  appPrice: number;
}

interface WholesaleIndex {
  meta: { generatedAt: string; totalRows: number; uniqueCodes: number };
  byCode: Record<string, WholesaleItem[]>;
}

let _index: WholesaleIndex | null = null;

function loadIndex(): WholesaleIndex {
  if (_index) return _index;
  const raw = fs.readFileSync(INDEX_PATH, 'utf-8');
  _index = JSON.parse(raw) as WholesaleIndex;
  return _index;
}

export function getWholesaleByCode(code: string): WholesaleItem[] {
  const index = loadIndex();
  return index.byCode[code.trim()] ?? [];
}
