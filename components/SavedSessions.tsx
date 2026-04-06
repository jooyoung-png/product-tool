'use client';

import { useState, useEffect } from 'react';
import { RefinedProduct, SavedSession } from '@/types';

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
  onLoad: (products: RefinedProduct[]) => void;
}

export default function SavedSessions({ currentProducts, onLoad }: Props) {
  const [sessions, setSessions] = useState<SavedSession[]>([]);
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setSessions(loadSessions());
  }, []);

  const handleSave = () => {
    if (!title.trim()) return;
    const newSession: SavedSession = {
      id: `${Date.now()}`,
      title: title.trim(),
      savedAt: new Date().toISOString(),
      refinedProducts: currentProducts,
    };
    const updated = [newSession, ...sessions];
    setSessions(updated);
    persistSessions(updated);
    setTitle('');
    setSaving(false);
  };

  const handleDelete = (id: string) => {
    const updated = sessions.filter(s => s.id !== id);
    setSessions(updated);
    persistSessions(updated);
  };

  return (
    <aside className="w-56 shrink-0 bg-white border-r border-gray-100 min-h-screen flex flex-col">
      <div className="p-4 border-b border-gray-100">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">저장된 세션</p>

        {saving ? (
          <div className="space-y-2">
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setSaving(false); }}
              placeholder="세션 이름 입력"
              autoFocus
              className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex gap-1.5">
              <button
                onClick={handleSave}
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
            disabled={currentProducts.filter(p => p.finalName).length === 0}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-100 disabled:text-gray-400 text-white text-xs py-2 rounded-lg transition-colors"
          >
            저장하기
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {sessions.length === 0 ? (
          <p className="text-xs text-gray-400 text-center mt-4">저장된 세션이 없습니다</p>
        ) : (
          <ul className="space-y-1">
            {sessions.map(s => (
              <li key={s.id}>
                <div className="group flex items-start gap-1 rounded-lg hover:bg-gray-50 p-2 cursor-pointer" onClick={() => onLoad(s.refinedProducts)}>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-800 truncate">{s.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{formatDate(s.savedAt)}</p>
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
