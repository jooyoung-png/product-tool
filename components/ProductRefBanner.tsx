'use client';

import { useState, useEffect, useRef } from 'react';

interface Meta {
  updatedAt: string;
  originalName: string;
  fromDate?: string;
  toDate?: string;
}

export default function ProductRefBanner() {
  const [days, setDays] = useState<number | null>(null);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const [phDays, setPhDays] = useState<number | null>(null);
  const [phMeta, setPhMeta] = useState<Meta | null>(null);

  const fetchMeta = () => {
    fetch('/api/product-ref-meta')
      .then((r) => r.json())
      .then((data) => {
        setDays(data.daysSinceUpdate);
        setMeta(data.meta);
      });
  };

  const fetchPhMeta = () => {
    fetch('/api/price-history-meta')
      .then((r) => r.json())
      .then((data) => {
        setPhDays(data.daysSinceUpdate);
        setPhMeta(data.meta);
      });
  };

  useEffect(() => {
    fetchMeta();
    fetchPhMeta();
  }, []);

  const handleUpload = async (file: File) => {
    if (!file.name.endsWith('.csv')) {
      setUploadMsg('CSV 파일만 업로드 가능합니다.');
      return;
    }
    setUploading(true);
    setUploadMsg('');
    const form = new FormData();
    form.append('file', file);
    const res = await fetch('/api/upload-products', { method: 'POST', body: form });
    const data = await res.json();
    if (data.ok) {
      setUploadMsg(`업데이트 완료: ${data.originalName} (${data.updatedAt})`);
      fetchMeta();
    } else {
      setUploadMsg(`오류: ${data.error}`);
    }
    setUploading(false);
  };

  const isStale = days !== null && days >= 14;

  return (
    <div className="space-y-2 mb-6">
      {/* 2주 경과 경고 */}
      {isStale && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-300 rounded-xl px-4 py-3">
          <span className="text-amber-500 text-lg">⚠️</span>
          <p className="text-sm font-medium text-amber-700 flex-1">
            TOP PRODUCT 파일 업데이트 D+{days}일. 파일을 업데이트 해주세요.
          </p>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="text-xs bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
          >
            {uploading ? '업로드 중...' : '파일 업데이트'}
          </button>
        </div>
      )}

      {/* 파일 상태 바 (경고 없을 때) */}
      {!isStale && (
        <div className="flex items-center gap-3 bg-gray-50 border border-gray-100 rounded-xl px-4 py-2.5">
          <span className="text-gray-400 text-sm">📦</span>
          <p className="text-xs text-gray-500 flex-1">
            {meta
              ? `상품 레퍼런스: ${meta.originalName} · 업데이트 ${days === 0 ? '오늘' : `${days}일 전`}`
              : '상품 레퍼런스 파일이 없습니다.'}
          </p>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="text-xs text-gray-500 hover:text-gray-700 border border-gray-200 px-3 py-1 rounded-lg transition-colors whitespace-nowrap"
          >
            {uploading ? '업로드 중...' : 'CSV 업데이트'}
          </button>
        </div>
      )}

      {uploadMsg && (
        <p className={`text-xs px-1 ${uploadMsg.startsWith('오류') ? 'text-red-500' : 'text-green-600'}`}>
          {uploadMsg}
        </p>
      )}

      {/* 과거 판매가 이력 */}
      <div className="flex items-center gap-3 bg-gray-50 border border-gray-100 rounded-xl px-4 py-2.5">
        <span className="text-gray-400 text-sm">📈</span>
        <p className="text-xs text-gray-500 flex-1">
          {phMeta
            ? `과거 판매가 이력: ${phMeta.fromDate ?? '?'} ~ ${phMeta.toDate ?? '?'} · 업데이트 ${phDays === 0 ? '오늘' : `${phDays}일 전`}`
            : '과거 판매가 이력 없음 — node scripts/compute-price-stats.mjs 실행 후 git push'}
        </p>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleUpload(file);
          e.target.value = '';
        }}
      />
    </div>
  );
}
