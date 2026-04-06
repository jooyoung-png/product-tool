'use client';

import { useState, useCallback, useRef } from 'react';
import InputSection from '@/components/InputSection';
import RefineModal from '@/components/RefineModal';
import PriceTable from '@/components/PriceTable';
import SalesDataTable from '@/components/SalesDataTable';
import ProductRefBanner from '@/components/ProductRefBanner';
import SavedSessions from '@/components/SavedSessions';
import { InputProduct, RefinedProduct, PriceRow, SalesStats } from '@/types';

export default function Home() {
  const [inputProducts, setInputProducts] = useState<InputProduct[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [refinedProducts, setRefinedProducts] = useState<RefinedProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [retryProduct, setRetryProduct] = useState<InputProduct | null>(null);
  const [sessionKey, setSessionKey] = useState(0);

  // Mixpanel 데이터 수집 (저장용) — ref로 관리해 리렌더 방지
  const currentRowsRef = useRef<PriceRow[]>([]);
  const currentStatsMapRef = useRef<Record<string, SalesStats>>({});

  // 세션 로드 시 초기값 (API 재호출 없이 렌더)
  const [initialRows, setInitialRows] = useState<PriceRow[] | undefined>(undefined);
  const [initialStatsMap, setInitialStatsMap] = useState<Record<string, SalesStats> | undefined>(undefined);

  const handleInput = (products: InputProduct[]) => {
    setInputProducts(products);
    setShowModal(true);
    setLoading(true);
  };

  const handleConfirm = (refined: RefinedProduct[]) => {
    // 새 상품 추가 시 initialRows/initialStatsMap 초기화 (신규 fetch)
    setInitialRows(undefined);
    setInitialStatsMap(undefined);
    setRefinedProducts((prev) => {
      const existingNames = new Set(prev.map(p => p.finalName).filter(Boolean));
      const toAdd = refined.filter(p => !p.finalName || !existingNames.has(p.finalName));
      return [...prev, ...toAdd];
    });
    setShowModal(false);
    setLoading(false);
  };

  const handleClose = () => {
    setShowModal(false);
    setLoading(false);
  };

  const handleRetryConfirm = useCallback((refined: RefinedProduct[]) => {
    const retried = refined[0];
    setRefinedProducts((prev) =>
      prev.map(p =>
        p.originalName === retried.originalName && !p.finalName ? retried : p
      )
    );
    setRetryProduct(null);
  }, []);

  const handleLoadSession = useCallback((
    products: RefinedProduct[],
    savedRows?: PriceRow[],
    savedStatsMap?: Record<string, SalesStats>,
  ) => {
    setRefinedProducts(products);
    setInitialRows(savedRows);
    setInitialStatsMap(savedStatsMap);
    currentRowsRef.current = savedRows ?? [];
    currentStatsMapRef.current = savedStatsMap ?? {};
    setSessionKey(k => k + 1);
  }, []);

  const confirmedProducts = refinedProducts.filter((p) => p.finalName);
  const excludedProducts = refinedProducts.filter((p) => !p.finalName);
  const confirmedNames = confirmedProducts.map((p) => p.finalName!);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* 사이드바 */}
      <SavedSessions
        currentProducts={refinedProducts}
        currentRowsRef={currentRowsRef}
        currentStatsMapRef={currentStatsMapRef}
        onLoad={handleLoadSession}
      />

      {/* 메인 콘텐츠 */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-4 py-10">
          {/* 헤더 */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900">상품 등록 데이터 생성기</h1>
            <p className="text-sm text-gray-500 mt-1">상품명과 공급가를 입력하면 가격 분석 데이터를 자동으로 생성합니다.</p>
          </div>

          {/* 상품 레퍼런스 파일 상태 배너 */}
          <ProductRefBanner />

          {/* 입력 섹션 */}
          <div className="mb-8">
            <InputSection onSubmit={handleInput} loading={loading} />
          </div>

          {/* 결과 섹션 */}
          {refinedProducts.length > 0 && (
            <div className="space-y-6">
              {/* 가격표 */}
              <PriceTable
                key={`price-${sessionKey}`}
                products={refinedProducts}
                initialRows={initialRows}
                onRowsChange={r => { currentRowsRef.current = r; }}
              />

              {/* Mixpanel 판매 데이터 */}
              {confirmedNames.length > 0 && (
                <SalesDataTable
                  key={`sales-${sessionKey}`}
                  productNames={confirmedNames}
                  initialStatsMap={initialStatsMap}
                  onStatsMapChange={m => { currentStatsMapRef.current = m; }}
                />
              )}

              {/* 상품명 미선택 섹터 */}
              {excludedProducts.length > 0 && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                  <h2 className="text-base font-semibold text-gray-700 mb-3">
                    상품명 미선택으로 제외된 상품들
                  </h2>
                  <p className="text-xs text-gray-400 mb-3">상품명을 클릭하면 다시 선택할 수 있습니다.</p>
                  <ul className="space-y-1">
                    {excludedProducts.map((p, i) => (
                      <li key={i} className="text-sm text-gray-500 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-gray-300 inline-block" />
                        <button
                          className="text-blue-500 hover:underline"
                          onClick={() => setRetryProduct({ name: p.originalName, supplyPrice: p.supplyPrice })}
                        >
                          {p.originalName}
                        </button>
                        <span className="text-gray-400 text-xs">({p.supplyPrice.toLocaleString()}원)</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* 상품명 정제 모달 (신규 입력) */}
      {showModal && (
        <RefineModal
          products={inputProducts}
          onConfirm={handleConfirm}
          onClose={handleClose}
        />
      )}

      {/* 제외 상품 재시도 모달 */}
      {retryProduct && (
        <RefineModal
          products={[retryProduct]}
          onConfirm={handleRetryConfirm}
          onClose={() => setRetryProduct(null)}
        />
      )}
    </div>
  );
}
