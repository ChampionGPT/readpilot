/**
 * input: isOpen, onClose - 用于控制面板开关
 * output: 拖拽 EPUB → SSE 流式导入 → 完成态二选一（开始阅读 / 留在书架）
 * pos: 书架页面的附属功能弹窗
 *
 * 架构说明：useImportStream 是纯状态机，本组件根据 state.status 渲染：
 *   uploading → 拖拽完成 / 5 步进度
 *   done → 完成态卡片 + 双按钮
 *   error → 错误面板 + 重试
 *   idle → 拖拽区
 * done 状态不自动导航，由用户点击「开始阅读」才调 selectBook(dir)。
 * 注：worktree 的 useBookStore 用 selectBook（自动切 sidebarNav→content）；
 *     主目录的 useBookStore 用 selectBook（切 viewMode→hub）。两个 API 都存在；
 *     这里调用对应分支的 API，主目录同步时改 selectBook 即可。
 */
import React, { useRef, useState } from 'react';
import { useBookStore } from '@/store/useBookStore';
import { useImportStream, type ImportState } from '@/hooks/useImportStream';
import { ImportProgress } from './ImportProgress';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const MAX_MB = 200;

function errorMessage(error: NonNullable<ImportState['error']>): string {
  switch (error.kind) {
    case 'validation': return error.message;
    case 'python_missing': return '未检测到 Python，请安装 Python 3.8+ 后重试。';
    case 'dependency_missing': return `缺少 Python 依赖 ${error.pkg}。请在终端运行：pip install -r scripts/ebook-converter/requirements.txt`;
    case 'timeout': return '转换超时（>60 秒），可能是文件过大或损坏。';
    case 'empty_output': return '未能从 EPUB 中提取到任何章节，文件可能已损坏。';
    case 'script_failure': return `转换脚本失败：${error.stderr.slice(0, 200) || '未知错误'}`;
    case 'internal': return `内部错误：${error.message}`;
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function ImportModal({ isOpen, onClose }: ImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [legacyTitle, setLegacyTitle] = useState('');
  const [legacyBusy, setLegacyBusy] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { state, importBook, cancel, reset } = useImportStream();
  const { setBooks, selectBook } = useBookStore();

  if (!isOpen) return null;

  const onFile = (f: File | null) => {
    if (!f) return;
    if (!f.name.toLowerCase().endsWith('.epub')) { alert('仅支持 .epub 文件'); return; }
    if (f.size > MAX_MB * 1024 * 1024) { alert(`文件不能超过 ${MAX_MB}MB`); return; }
    setFile(f);
    if (!title) setTitle(f.name.replace(/\.epub$/i, ''));
  };

  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragOver(true); };
  const onDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragOver(false); };
  const onDrop = (e: React.DragEvent) => { e.preventDefault(); setIsDragOver(false); onFile(e.dataTransfer.files[0] ?? null); };

  const submit = async () => {
    if (!file) return;
    await importBook(file, { title: title.trim(), author: author.trim() });
  };

  const finishAndOpen = async () => {
    if (!state.result || finalizing) return;
    setFinalizing(true);
    try {
      const listRes = await fetch('/api/books');
      if (listRes.ok) setBooks(await listRes.json());
      selectBook(state.result.dir);
    } finally {
      reset();
      setFile(null); setTitle(''); setAuthor('');
      setFinalizing(false);
      onClose();
    }
  };

  const finishAndStay = async () => {
    if (finalizing) return;
    setFinalizing(true);
    try {
      const listRes = await fetch('/api/books');
      if (listRes.ok) setBooks(await listRes.json());
    } finally {
      reset();
      setFile(null); setTitle(''); setAuthor('');
      setFinalizing(false);
      onClose();
    }
  };

  const submitLegacy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!legacyTitle.trim()) return;
    setLegacyBusy(true);
    try {
      const res = await fetch('/api/books', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: legacyTitle }) });
      const newBook = await res.json();
      if (res.ok) {
        const listRes = await fetch('/api/books');
        setBooks(await listRes.json());
        selectBook(newBook.dir);
        setLegacyTitle('');
        onClose();
      }
    } finally { setLegacyBusy(false); }
  };

  const inProgress = state.status === 'uploading';
  const hasError = state.status === 'error';
  const isDone = state.status === 'done' && state.result;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-scrim/40 backdrop-blur-sm transition-opacity" onClick={() => !inProgress && !isDone && onClose()} />

      <div className="relative bg-surface-container-lowest w-[600px] max-w-[92vw] rounded-3xl shadow-2xl overflow-hidden border border-outline-variant/20 animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-5 border-b border-outline-variant/10 flex justify-between items-center">
          <div>
            <h2 className="font-serif text-xl font-bold text-on-surface">导入电子书</h2>
            <p className="text-xs text-on-surface-variant mt-0.5">拖入 EPUB 文件，自动解析章节并生成阅读进度</p>
          </div>
          <button type="button" onClick={onClose} disabled={inProgress} className="p-1.5 rounded-full hover:bg-surface-container disabled:opacity-30 transition-colors text-on-surface-variant cursor-pointer">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>

        <div className="p-7 space-y-5">
          {/* 进行中 */}
          {inProgress && (
            <>
              <div className="rounded-2xl bg-surface-container p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-xl">📖</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-on-surface truncate">{file?.name}</div>
                  <div className="text-xs text-on-surface-variant">{file ? formatSize(file.size) : ''}</div>
                </div>
              </div>
              <ImportProgress state={state} />
              <button onClick={cancel} className="w-full px-6 py-3 bg-surface-container-low text-on-surface rounded-xl text-sm hover:bg-surface-container cursor-pointer">取消导入</button>
            </>
          )}

          {/* 完成态 */}
          {isDone && state.result && (
            <div className="space-y-5 py-4">
              <div className="flex flex-col items-center text-center space-y-3">
                <div className="w-14 h-14 rounded-full bg-primary/15 flex items-center justify-center text-primary">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <div>
                  <div className="text-lg font-bold text-on-surface">导入完成</div>
                  <div className="text-sm text-on-surface-variant mt-1">《{state.result.title}》</div>
                  <div className="text-xs text-on-surface-variant mt-0.5">{state.result.chapterCount} 章已就绪</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={finishAndStay} disabled={finalizing} className="px-4 py-3 bg-surface-container-low text-on-surface rounded-xl text-sm hover:bg-surface-container disabled:opacity-40 cursor-pointer">留在书架</button>
                <button onClick={finishAndOpen} disabled={finalizing} className="px-4 py-3 bg-primary text-on-primary font-bold rounded-xl text-sm hover:brightness-110 disabled:opacity-40 cursor-pointer">开始阅读</button>
              </div>
            </div>
          )}

          {/* 错误态 */}
          {hasError && state.error && (
            <>
              <div className="rounded-2xl bg-error-container/30 p-5 text-sm text-on-error-container">
                <div className="flex items-center gap-2 font-bold mb-2">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  导入失败
                </div>
                <div className="opacity-80 leading-relaxed">{errorMessage(state.error)}</div>
              </div>
              <button onClick={reset} className="w-full px-6 py-3 bg-primary text-on-primary font-bold rounded-xl text-sm hover:brightness-110 cursor-pointer">重试</button>
            </>
          )}

          {/* 空闲态 */}
          {!inProgress && !hasError && !isDone && (
            <>
              <div onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop} onClick={() => fileInputRef.current?.click()}
                   className={`relative border-2 border-dashed rounded-2xl px-6 py-10 text-center cursor-pointer transition-all ${
                     isDragOver ? 'border-primary bg-primary/10 scale-[1.01]' : file ? 'border-primary/50 bg-primary/5' : 'border-outline-variant hover:border-primary/60 hover:bg-surface-container-low'
                   }`}>
                <input ref={fileInputRef} type="file" accept=".epub,application/epub+zip" className="hidden" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
                {file ? (
                  <div className="flex items-center justify-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center text-2xl">📖</div>
                    <div className="text-left min-w-0">
                      <div className="text-sm font-bold text-on-surface truncate max-w-[360px]">{file.name}</div>
                      <div className="text-xs text-on-surface-variant mt-0.5">{formatSize(file.size)} · <span className="text-primary">点击替换</span></div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="mx-auto w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                      </svg>
                    </div>
                    <div className="text-sm font-bold text-on-surface">{isDragOver ? '松开以上传' : '拖入 .epub 文件到此处'}</div>
                    <div className="text-xs text-on-surface-variant">或<span className="text-primary font-bold mx-1">点击选择</span>· 最大 {MAX_MB}MB · 仅支持 EPUB</div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-bold text-on-surface mb-1.5">书名</label><input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-outline-variant/50 bg-surface focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm" placeholder="留空自动识别" /></div>
                <div><label className="block text-xs font-bold text-on-surface mb-1.5">作者</label><input type="text" value={author} onChange={(e) => setAuthor(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-outline-variant/50 bg-surface focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm" placeholder="可选" /></div>
              </div>

              <button disabled={!file} onClick={submit} className="w-full px-6 py-3.5 bg-primary text-on-primary font-bold rounded-xl text-sm hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-all shadow-sm cursor-pointer flex items-center justify-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                {file ? '导入并解析' : '请先选择文件'}
              </button>

              <details className="pt-1 border-t border-outline-variant/10">
                <summary className="cursor-pointer text-xs text-on-surface-variant hover:text-on-surface pt-3 select-none">没有 EPUB？仅创建空书占位 →</summary>
                <form onSubmit={submitLegacy} className="mt-3 flex gap-2">
                  <input type="text" value={legacyTitle} onChange={(e) => setLegacyTitle(e.target.value)} placeholder="书名" className="flex-1 px-3 py-2 rounded-lg border border-outline-variant/50 bg-surface focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm" />
                  <button type="submit" disabled={legacyBusy || !legacyTitle.trim()} className="px-4 py-2 bg-surface-container-low text-on-surface rounded-lg text-sm disabled:opacity-40 cursor-pointer">创建</button>
                </form>
              </details>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
