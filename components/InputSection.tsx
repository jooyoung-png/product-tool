'use client';

import { useState, useRef } from 'react';
import { InputProduct } from '@/types';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';

interface Props {
  onSubmit: (products: InputProduct[]) => void;
  loading: boolean;
}

// ── 헤더명 별칭 테이블 ──────────────────────────────────────────────────────────
const HEADER_ALIASES: Record<keyof Omit<InputProduct, 'name' | 'supplyPrice'> | 'name' | 'supplyPrice', string[]> = {
  name:          ['상품명', '품명', 'item_name', 'item name', '상품 명'],
  supplyPrice:   ['공급가', '공급 가격', '공급가(원)', 'supply_price', 'supply price'],
  bottlesPerBox: ['박스 내 병 단위', '박스단위', '병수', 'bottles_per_box', '박스내병단위'],
  purpose:       ['용도', 'purpose'],
  stock:         ['재고', 'stock', 'maximum'],
  code:          ['코드', 'code'],
  volume:        ['용량', 'volume'],
};

function detectColumnIndices(headerRow: (string | number)[]): Record<string, number> {
  const map: Record<string, number> = {};
  headerRow.forEach((cell, i) => {
    const normalized = String(cell).trim().toLowerCase();
    for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
      if (map[field] !== undefined) continue; // 이미 찾은 필드는 skip
      if (aliases.some(a => a.toLowerCase() === normalized)) {
        map[field] = i;
      }
    }
  });
  return map;
}

export default function InputSection({ onSubmit, loading }: Props) {
  const [productName, setProductName] = useState('');
  const [supplyPrice, setSupplyPrice] = useState('');
  const [fileError, setFileError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleSingle = () => {
    const name = productName.trim();
    const price = parseInt(supplyPrice.replace(/,/g, ''), 10);
    if (!name || isNaN(price)) {
      alert('상품명과 공급가를 입력해주세요.');
      return;
    }
    onSubmit([{ name, supplyPrice: price }]);
  };

  const extractProducts = (rows: (string | number)[][]): InputProduct[] | null => {
    if (rows.length === 0) return [];

    // 첫 행을 헤더로 파싱
    const colMap = detectColumnIndices(rows[0]);

    if (colMap.name === undefined || colMap.supplyPrice === undefined) {
      setFileError('헤더에 "상품명"과 "공급가" 열이 필요합니다.');
      return null;
    }

    const products: InputProduct[] = [];
    let hasBlank = false;

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      // 완전히 빈 행은 skip
      if (row.every(cell => String(cell ?? '').trim() === '')) continue;

      const name = String(row[colMap.name] ?? '').trim();
      const rawPrice = String(row[colMap.supplyPrice] ?? '').replace(/,/g, '').trim();
      const price = parseInt(rawPrice, 10);

      if (!name || isNaN(price) || price <= 0) {
        hasBlank = true;
        break;
      }

      const get = (field: string) => {
        const idx = colMap[field];
        return idx !== undefined ? String(row[idx] ?? '').trim() : undefined;
      };

      const bottlesPerBoxRaw = get('bottlesPerBox');
      const stockRaw = get('stock');

      products.push({
        name,
        supplyPrice: price,
        bottlesPerBox: bottlesPerBoxRaw ? (parseInt(bottlesPerBoxRaw, 10) || undefined) : undefined,
        purpose: get('purpose') || undefined,
        stock: stockRaw ? (parseInt(stockRaw, 10) || undefined) : undefined,
        code: get('code') || undefined,
        volume: get('volume') || undefined,
      });
    }

    if (hasBlank) {
      setFileError('상품명 혹은 공급가가 공란인 데이터가 있습니다.');
      return null;
    }

    return products;
  };

  const parseFile = (file: File) => {
    setFileError('');
    const ext = file.name.split('.').pop()?.toLowerCase();

    if (ext === 'csv') {
      Papa.parse<(string | number)[]>(file, {
        complete: (results) => {
          const products = extractProducts(results.data as (string | number)[][]);
          if (products === null) return; // 에러 메시지 이미 set됨
          if (products.length === 0) {
            setFileError('파일에서 상품 데이터를 찾을 수 없습니다.');
            return;
          }
          onSubmit(products);
        },
        skipEmptyLines: false,
      });
    } else if (ext === 'xlsx' || ext === 'xls') {
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rowsRaw = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, { header: 1, defval: '' });
        const products = extractProducts(rowsRaw);
        if (products === null) return;
        if (products.length === 0) {
          setFileError('파일에서 상품 데이터를 찾을 수 없습니다.');
          return;
        }
        onSubmit(products);
      };
      reader.readAsArrayBuffer(file);
    } else {
      setFileError('.xlsx, .xls, .csv 파일만 지원합니다.');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) parseFile(file);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
      <h2 className="text-lg font-semibold text-gray-800 mb-6">상품 정보 입력</h2>

      {/* 단건 입력 */}
      <div className="flex gap-3 mb-6">
        <div className="flex-1">
          <label className="block text-sm text-gray-500 mb-1">상품명</label>
          <input
            type="text"
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            placeholder="예) 조니 블루"
            className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            onKeyDown={(e) => e.key === 'Enter' && handleSingle()}
          />
        </div>
        <div className="w-40">
          <label className="block text-sm text-gray-500 mb-1">공급가 (원)</label>
          <input
            type="text"
            value={supplyPrice}
            onChange={(e) => setSupplyPrice(e.target.value)}
            placeholder="예) 150000"
            className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            onKeyDown={(e) => e.key === 'Enter' && handleSingle()}
          />
        </div>
        <div className="flex items-end">
          <button
            onClick={handleSingle}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            {loading ? '처리 중...' : '조회'}
          </button>
        </div>
      </div>

      {/* 구분선 */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex-1 border-t border-gray-100" />
        <span className="text-xs text-gray-400">또는 파일 업로드</span>
        <div className="flex-1 border-t border-gray-100" />
      </div>

      {/* 파일 업로드 */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => fileRef.current?.click()}
        className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
      >
        <div className="text-3xl mb-2">📄</div>
        <p className="text-sm text-gray-500 mb-1">
          Excel(.xlsx) 또는 CSV 파일을 끌어다 놓거나 클릭하여 업로드
        </p>
        <p className="text-xs text-gray-400">
          필수: 상품명, 공급가 &nbsp;|&nbsp; 선택: 박스 내 병 단위, 용도, 재고, 코드, 용량
        </p>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) parseFile(file);
            e.target.value = '';
          }}
        />
      </div>

      {fileError && (
        <p className="mt-2 text-sm text-red-500">{fileError}</p>
      )}
    </div>
  );
}
