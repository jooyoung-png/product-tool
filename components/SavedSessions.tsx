'use client';

import { useState, useEffect, useRef, MutableRefObject } from 'react';
import { RefinedProduct, SavedSession, PriceRow, SalesStats } from '@/types';

const STORAGE_KEY = 'product-tool-sessions';

function loadSessions(): SavedSession[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function persistSessions(sessions: SavedSession[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface Props {
  currentProducts: RefinedProduct[];
  currentRowsRef: MutableRefObject<PriceRow[]>;
  currentStatsMapRef: MutableRefObject<Record<string, SalesStats>>;
  onLoad: (products: RefinedProduct[], savedRows?: PriceRow[], savedStatsMap?: Record<string, SalesStats>, sessionId?: string) => void;
  activeSessionId: string | null;
  autoSaveTrigger: { title: string; counter: number } | null;
  onAutoSaved: (id: string) => void;
}

export default function SavedSessions({
  currentProducts,
  currentRowsRef,
  currentStatsMapRef,
  onLoad,
  activeSessionId,
  autoSaveTrigger,
  onAutoSaved,
}: Props) {
  const [sessions, setSessions] = useState<SavedSession[]>([]);
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setSessions(loadSessions());
  }, []);

  // ── 자동 저장 (파일 업로드 후 최초 rows 완성 시) ──────────────────────────
  const prevAutoSaveCounterRef = useRef(0);
  useEffect(() => {
    if (!autoSaveTrigger) return;
    if (autoSaveTrigger.counter === prevAutoSaveCounterRef.current) return;
    prevAutoSaveCounterRef.current = autoSaveTrigger.counter;

    const id = `${Date.now()}`;
    const savedRows = currentRowsRef.current.filter(r => !r.rateLimited);
    const savedStatsMap: Record<string, SalesStats> = {};
    Object.entries(currentStatsMapRef.current).forEach(([name, s]) => {
      if (!s.rateLimited) savedStatsMap[name] = s;
    });

    const newSession: SavedSession = {
      id,
      title: autoSaveTrigger.title,
      savedAt: new Date().toISOString(),
      refinedProducts: currentProducts,
      savedRows: savedRows.length > 0 ? savedRows : undefined,
      savedStatsMap: Object.keys(savedStatsMap).length > 0 ? savedStatsMap : undefined,
    };

    setSessions(prev => {
      const updated = [newSession, ...prev];
      persistSessions(updated);
      return updated;
    });
    onAutoSaved(id);
  }, [autoSaveTrigger, currentProducts, currentRowsRef, currentStatsMapRef, onAutoSaved]);

  // ── 저장 (신규 or 덮어쓰기) ───────────────────────────────────────────────
  const buildSessionData = () => {
    const savedRows = currentRowsRef.current.filter(r => !r.rateLimited);
    const savedStatsMap: Record<string, SalesStats> = {};
    Object.entries(currentStatsMapRef.current).forEach(([name, s]) => {
      if (!s.rateLimited) savedStatsMap[name] = s;
    });
    return {
      savedRows: savedRows.length > 0 ? savedRows : undefined,
      savedStatsMap: Object.keys(savedStatsMap).length > 0 ? savedStatsMap : undefined,
    };
  };

  const handleOverwrite = () => {
    if (!activeSessionId) return;
    const { savedRows, savedStatsMap } = buildSessionData();
    setSessions(prev => {
      const updated = prev.map(s =>
        s.id === activeSessionId
          ? { ...s, savedAt: new Date().toISOString(), refinedProducts: currentProducts, savedRows, savedStatsMap }
          : s
      );
      persistSessions(updated);
      return updated;
    });
  };

  const handleSaveNew = () => {
    if (!title.trim()) return;
    const { savedRows, savedStatsMap } = buildSessionData();
    const newSession: SavedSession = {
      id: `${Date.now()}`,
      title: title.trim(),
      savedAt: new Date().toISOString(),
      refinedProducts: currentProducts,
      savedRows,
      savedStatsMap,
    };
    setSessions(prev => {
      const updated = [newSession, ...prev];
      persistSessions(updated);
      return updated;
    });
    setTitle('');
    setSaving(false);
  };

  const handleDelete = (id: string) => {
    setSessions(prev => {
      const updated = prev.filter(s => s.id !== id);
      persistSessions(updated);
      return updated;
    });
  };

  const hasConfirmed = currentProducts.filter(p => p.finalName).length > 0;
  const activeSession = sessions.find(s => s.id === activeSessionId);

  return (
    <aside className="w-56 shrink-0 bg-white border-r border-gray-100 h-full flex flex-col">
      <div className="p-4 border-b border-gray-100">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">저장된 세션</p>

        {/* 덮어쓰기 모드 (세션 로드 상태) */}
        {activeSessionId && !saving && (
          <div className="space-y-1.5">
            <p className="text-xs text-gray-400 truncate">현재: {activeSession?.title ?? '불러온 세션'}</p>
            <button
              onClick={handleOverwrite}
              disabled={!hasConfirmed}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-100 disabled:text-gray-400 text-white text-xs py-2 rounded-lg transition-colors"
            >
              덮어쓰기
            </button>
            <button
              onClick={() => setSaving(true)}
              className="w-full text-gray-400 hover:text-gray-600 text-xs py-1 transition-colors"
            >
              새로 저장
            </button>
          </div>
        )}

        {/* 신규 저장 모드 */}
        {(!activeSessionId || saving) && (
          saving ? (
            <div className="space-y-2">
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSaveNew(); if (e.key === 'Escape') setSaving(false); }}
                placeholder="세션 이름 입력"
                autoFocus
                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex gap-1.5">
                <button
                  onClick={handleSaveNew}
                  disabled={!title.trim()}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-xs py-1.5 rounded-lg transition-colors"
                >
                  저장
                </button>
                <button
                  onClick={() => { setSaving(false); setTitle(''); }}
                  className="flex-1 text-gray-500 hover:text-gray-700 text-xs py-1.5 border border-gray-200 rounded-lg transition-colors"
                >
                  취소
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setSaving(true)}
              disabled={!hasConfirmed}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-100 disabled:text-gray-400 text-white text-xs py-2 rounded-lg transition-colors"
            >
              저장하기
            </button>
          )
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {sessions.length === 0 ? (
          <p className="text-xs text-gray-400 text-center mt-4">저장된 세션이 없습니다</p>
        ) : (
          <ul className="space-y-1">
            {sessions.map(s => (
              <li key={s.id}>
                <div
                  className={`group flex items-start gap-1 rounded-lg p-2 cursor-pointer transition-colors ${
                    s.id === activeSessionId
                      ? 'bg-blue-50 border border-blue-100'
                      : 'hover:bg-gray-50'
                  }`}
                  onClick={() => onLoad(s.refinedProducts, s.savedRows, s.savedStatsMap, s.id)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-800 truncate">{s.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{formatDate(s.savedAt)}</p>
                    {s.savedRows && (
                      <p className="text-xs text-green-500 mt-0.5">📦 데이터 저장됨</p>
                    )}
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); handleDelete(s.id); }}
                    className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 text-xs leading-none pt-0.5 transition-opacity"
                    title="삭제"
                  >
                    ✕
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
