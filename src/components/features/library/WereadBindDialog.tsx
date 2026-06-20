/**
 * input: props { localBookDir, defaultQuery, open, onClose, onBound }
 * output: 模态框 — 搜索微读书目，选定后 POST /api/weread/bind 并回调 onBound
 * pos: 绑定流程的入口 UI — 从 BookCard 🔗 按钮唤起
 * 声明：一旦我被更新，务必更新我的开头注释以及所属文件夹的 md。
 */
'use client';

import React, { useEffect, useState } from 'react';
import type { WereadSearchResult } from '@/types/weread';

interface Props {
  localBookDir: string;
  defaultQuery: string;
  open: boolean;
  onClose: () => void;
  onBound: (wereadBookId: string) => void;
}

export function WereadBindDialog({ localBookDir, defaultQuery, open, onClose, onBound }: Props) {
  const [q, setQ] = useState(defaultQuery);
  const [results, setResults] = useState<WereadSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [binding, setBinding] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setQ(defaultQuery);
      setErr(null);
      setResults([]);
      runSearch(defaultQuery);
    }
  }, [open, defaultQuery]);

  async function runSearch(keyword: string) {
    if (!keyword.trim()) { setResults([]); return; }
    setLoading(true); setErr(null);
    try {
      const r = await fetch(`/api/weread/search?q=${encodeURIComponent(keyword)}&count=10`);
      if (r.status === 401) {
        setErr('请先在 /settings 页填入 WEREAD_API_KEY');
        setResults([]);
        return;
      }
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setErr(j.error ?? `搜索失败 (HTTP ${r.status})`);
        setResults([]);
        return;
      }
      const j = await r.json();
      setResults(j.results ?? []);
    } catch (e: any) {
      setErr(e?.message ?? '网络错误');
    } finally {
      setLoading(false);
    }
  }

  async function bind(wereadBookId: string) {
    setBinding(wereadBookId); setErr(null);
    try {
      const r = await fetch('/api/weread/bind', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ localBookDir, wereadBookId }),
      });
      const j = await r.json();
      if (!r.ok) {
        setErr(j.error ?? `绑定失败 (HTTP ${r.status})`);
        return;
      }
      onBound(wereadBookId);
      onClose();
    } catch (e: any) {
      setErr(e?.message ?? '网络错误');
    } finally {
      setBinding(null);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-surface-container-lowest rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="p-5 border-b border-outline-variant/20">
          <h2 className="font-serif text-xl font-bold text-on-surface">关联微信读书</h2>
          <p className="text-sm text-on-surface-variant mt-1">
            为本地书 <code className="font-mono text-xs">{localBookDir}</code> 选择微读对应书目
          </p>
        </header>

        <div className="p-5 border-b border-outline-variant/20">
          <div className="flex gap-2">
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') runSearch(q); }}
              placeholder="书名或作者"
              className="flex-1 px-3 py-2 rounded-lg border border-outline-variant/40 bg-surface text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <button
              type="button"
              onClick={() => runSearch(q)}
              disabled={loading}
              className="px-4 py-2 rounded-lg bg-primary text-on-primary text-sm hover:opacity-90 disabled:opacity-40"
            >
              {loading ? '搜索中…' : '搜索'}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {err && <div className="text-sm text-red-600 mb-3">{err}</div>}
          {!loading && results.length === 0 && !err && (
            <div className="text-sm text-on-surface-variant py-8 text-center">
              暂无结果。换个关键词试试，或检查 API Key 是否正确。
            </div>
          )}
          <ul className="space-y-2">
            {results.map((b) => (
              <li
                key={b.bookId}
                className="flex gap-3 p-3 rounded-lg border border-outline-variant/20 hover:border-outline-variant/40 hover:bg-surface-container/50 transition-colors"
              >
                {b.cover && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={b.cover} alt="" className="w-12 h-16 object-cover rounded shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-serif text-sm font-bold text-on-surface line-clamp-1">{b.title}</div>
                  <div className="text-xs text-on-surface-variant mt-0.5">{b.author}</div>
                  <div className="text-xs text-on-surface-variant/70 mt-1 flex gap-3">
                    {b.newRating !== undefined && <span>★ {(b.newRating / 10).toFixed(1)}</span>}
                    {b.readingCount !== undefined && <span>{b.readingCount.toLocaleString()} 人在读</span>}
                    {b.category && <span>{b.category}</span>}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => bind(b.bookId)}
                  disabled={binding !== null}
                  className="self-center px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs hover:bg-primary/20 disabled:opacity-40"
                >
                  {binding === b.bookId ? '绑定中…' : '绑定'}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <footer className="p-4 border-t border-outline-variant/20 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-outline-variant/40 text-sm text-on-surface-variant hover:bg-surface-container"
          >
            取消
          </button>
        </footer>
      </div>
    </div>
  );
}
