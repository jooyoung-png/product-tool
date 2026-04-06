'use client';

import { useState, useEffect } from 'react';
import { InputProduct, RefinedProduct, NameCandidate } from '@/types';

interface Props {
  products: InputProduct[];
  onConfirm: (refined: RefinedProduct[]) => void;
  onClose: () => void;
}

interface RefinedState {
  originalName: string;
  supplyPrice: number;
  candidates: NameCandidate[];
  selectedName: string | null;
  customName: string;
  loading: boolean;
  error: string;
}

export default function RefineModal({ products, onConfirm, onClose }: Props) {
  const [states, setStates] = useState<RefinedState[]>([]);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    const initial: RefinedState[] = products.map((p) => ({
      originalName: p.name,
      supplyPrice: p.supplyPrice,
      candidates: [],
      selectedName: null,
      customName: '',
      loading: true,
      error: '',
    }));
    setStates(initial);

    // 각 상품명 Claude API로 정제 (병렬)
    products.forEach((p, idx) => {
      fetch('/api/refine-name', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productName: p.name }),
      })
        .then((r) => r.json())
        .then((data) => {
          const candidates: NameCandidate[] = data.candidates || [];
          setStates((prev) => {
            const next = [...prev];
            next[idx] = {
              ...next[idx],
              candidates,
              selectedName: candidates.length === 1 && candidates[0].matchRate >= 90
                ? candidates[0].name
                : null,
              loading: false,
            };
            return next;
          });
        })
        .catch((err) => {
          setStates((prev) => {
            const next = [...prev];
            next[idx] = { ...next[idx], loading: false, error: String(err) };
            return next;
          });
        });
    });
  }, [products]);

  const updateState = (idx: number, patch: Partial<RefinedState>) => {
    setStates((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  };

  const handleConfirm = () => {
    setConfirming(true);
    const refined: RefinedProduct[] = states.map((s) => {
      let finalName: string | null = null;
      if (s.customName.trim()) {
        finalName = s.customName.trim();
      } else if (s.selectedName) {
        finalName = s.selectedName;
      }
      return {
        originalName: s.originalName,
        supplyPrice: s.supplyPrice,
        candidates: s.candidates,
        selectedName: s.selectedName,
        customName: s.customName,
        finalName,
      };
    });
    onConfirm(refined);
  };

  const allLoaded = states.every((s) => !s.loading);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">상품명 정제</h2>
            <p className="text-xs text-gray-400 mt-0.5">올바른 상품명을 선택하거나 직접 입력해주세요</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>

        {/* 본문 */}
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-6">
          {states.map((s, idx) => (
            <div key={idx} className="border border-gray-100 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">입력</span>
                <span className="font-medium text-gray-800">{s.originalName}</span>
                <span className="text-xs text-gray-400 ml-auto">공급가 {s.supplyPrice.toLocaleString()}원</span>
              </div>

              {s.loading && (
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <span className="animate-spin inline-block w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full" />
                  Claude AI가 상품명을 분석 중입니다...
                </div>
              )}

              {s.error && (
                <p className="text-sm text-red-500">오류: {s.error}</p>
              )}

              {!s.loading && !s.error && s.candidates.length > 0 && (
                <div className="space-y-2 mb-3">
                  <p className="text-xs text-gray-500 mb-1">후보 상품명</p>
                  {s.candidates.map((c) => (
                    <label
                      key={c.name}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        s.selectedName === c.name
                          ? 'border-blue-400 bg-blue-50'
                          : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={s.selectedName === c.name}
                        onChange={(e) => {
                          updateState(idx, {
                            selectedName: e.target.checked ? c.name : null,
                          });
                        }}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="flex-1 text-sm text-gray-800">{c.name}</span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          c.matchRate >= 90
                            ? 'bg-green-100 text-green-600'
                            : c.matchRate >= 70
                            ? 'bg-yellow-100 text-yellow-600'
                            : 'bg-red-100 text-red-500'
                        }`}
                      >
                        일치율 {c.matchRate}%
                      </span>
                    </label>
                  ))}
                </div>
              )}

              {!s.loading && (
                <div>
                  <p className="text-xs text-gray-400 mb-1">
                    {s.candidates.length === 0
                      ? '후보를 찾지 못했습니다. 상품명을 직접 입력해주세요.'
                      : '원하는 상품명이 없으면 직접 입력 (입력 시 우선 적용)'}
                  </p>
                  <input
                    type="text"
                    value={s.customName}
                    onChange={(e) => updateState(idx, { customName: e.target.value })}
                    placeholder="직접 입력..."
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* 푸터 */}
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleConfirm}
            disabled={!allLoaded || confirming}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            {!allLoaded ? '분석 중...' : confirming ? '처리 중...' : '확인'}
          </button>
        </div>
      </div>
    </div>
  );
}
