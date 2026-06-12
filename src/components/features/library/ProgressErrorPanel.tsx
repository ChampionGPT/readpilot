/**
 * input: useBookStore.corruptError
 * output: 损坏 progress.json 的可视化错误面板 + 「从备份恢复」按钮
 * pos: ReaderApp 在 corruptError 不为 null 时渲染（替代 hub）
 */
"use client";
import { useState } from 'react';
import { useBookStore } from '@/store/useBookStore';

export function ProgressErrorPanel() {
  const { corruptError, setCorruptError, selectedBookDir } = useBookStore();
  const [busy, setBusy] = useState(false);
  const [restoreErr, setRestoreErr] = useState<string | null>(null);

  if (!corruptError || !selectedBookDir) return null;

  const restore = async () => {
    setBusy(true);
    setRestoreErr(null);
    try {
      const res = await fetch(`/api/books/${encodeURIComponent(selectedBookDir)}/restore-progress`, { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setRestoreErr(typeof body.error === 'string' ? body.error : `HTTP ${res.status}`);
        return;
      }
      setCorruptError(null);
      window.dispatchEvent(new Event('reload_book_progress'));
    } finally {
      setBusy(false);
    }
  };

  const copyError = () => {
    const text = `progress.json 解析失败\nLine ${corruptError.line} Col ${corruptError.col}\n${corruptError.message}\n\n上下文：\n${corruptError.rawSnippet}`;
    navigator.clipboard?.writeText(text).catch(() => { /* noop */ });
  };

  return (
    <div className="flex-1 overflow-y-auto px-8 py-10 bg-[#FAF7F2]">
      <div className="max-w-2xl mx-auto bg-white rounded-2xl border border-red-200 p-8 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 text-xl">⚠</div>
          <div>
            <h2 className="text-lg font-bold text-stone-800">进度文件损坏</h2>
            <p className="text-sm text-stone-500">progress.json 解析失败，无法加载这本书的阅读状态</p>
          </div>
        </div>
        <div className="text-sm text-stone-700 mb-3">
          <div><span className="font-bold">位置：</span>Line {corruptError.line} · Col {corruptError.col}</div>
          <div className="mt-1"><span className="font-bold">错误：</span>{corruptError.message}</div>
        </div>
        <pre className="bg-stone-50 border border-stone-200 rounded p-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap mb-4">{corruptError.rawSnippet}</pre>
        {restoreErr && (
          <div className="text-xs text-red-700 bg-red-50 rounded p-2 mb-3">恢复失败：{restoreErr}</div>
        )}
        <div className="flex gap-3">
          <button onClick={restore} disabled={busy} className="px-4 py-2 bg-[#D94F30] text-white rounded-lg text-sm font-bold disabled:opacity-40 cursor-pointer">
            {busy ? '恢复中…' : '从备份恢复'}
          </button>
          <button onClick={copyError} className="px-4 py-2 bg-stone-100 text-stone-700 rounded-lg text-sm cursor-pointer">复制错误</button>
        </div>
      </div>
    </div>
  );
}
