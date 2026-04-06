'use client';

import { useState, useRef } from 'react';
import { InputProduct } from '@/types';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';

interface Props {
  onSubmit: (products: InputProduct[]) => void;
  loading: boolean;
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

  const parseFile = (file: File) => {
    setFileError('');
    const ext = file.name.split('.').pop()?.toLowerCase();

    if (ext === 'csv') {
      Papa.parse<string[]>(file, {
        complete: (results) => {
          const products = extractProducts(results.data as string[][]);
          if (products.length === 0) {
            setFileError('파일에서 상품 데이터를 찾을 수 없습니다. (A열: 상품명, B열: 공급가)');
            return;
          }
          onSubmit(products);
        },
        skipEmptyLines: true,
      });
    } else if (ext === 'xlsx' || ext === 'xls') {
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });
        const products = extractProducts(rows as string[][]);
        if (products.length === 0) {
          setFileError('파일에서 상품 데이터를 찾을 수 없습니다. (A열: 상품명, B열: 공급가)');
          return;
        }
        onSubmit(products);
      };
      reader.readAsArrayBuffer(file);
    } else {
      setFileError('.xlsx, .xls, .csv 파일만 지원합니다.');
    }
  };

  const extractProducts = (rows: (string | number)[][]): InputProduct[] => {
    const products: InputProduct[] = [];
    // 첫 행이 헤더인지 확인
    const startRow = rows.length > 0 && isNaN(Number(rows[0][1])) ? 1 : 0;
    for (let i = startRow; i < rows.length; i++) {
      const row = rows[i];
      const name = String(row[0] ?? '').trim();
      const price = parseInt(String(row[1] ?? '').replace(/,/g, ''), 10);
      if (name && !isNaN(price) && price > 0) {
        products.push({ name, supplyPrice: price });
      }
    }
    return products;
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
        <p className="text-xs text-gray-400">A열: 상품명 &nbsp;|&nbsp; B열: 공급가</p>
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
