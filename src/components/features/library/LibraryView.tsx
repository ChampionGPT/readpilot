/**
 * input: books (来自全局 useBookStore)
 * output: 瀑布流书架大厅视图
 * pos: 阅读器在未选定书籍时的前台核心主界面
 * 
 * 架构说明：接管 ReaderApp 中的 Empty State。
 * 当全局书籍存在，展示瀑布流书籍卡片；否则，展示诱导导入的新手空白引导页。一旦改动请更新我。
 */
import React, { useEffect, useState } from 'react';
import { Boxes, Library } from 'lucide-react';
import { BookCard } from './BookCard';
import { ImportModal } from './ImportModal';
import { WereadBindDialog } from './WereadBindDialog';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useBookStore } from '@/store/useBookStore';
import { useBookDelete } from '@/hooks/useBookDelete';
import { useWereadStore } from '@/store/useWereadStore';

export function LibraryView() {
  const { books, selectBook, setSelectedBookDir, setViewMode } = useBookStore();
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [libraryMode, setLibraryMode] = useState<'all' | 'collections'>('all');
  const [bookMeta, setBookMeta] = useState<Record<string, { genre: string; author: string }>>({});
  const [nowMs, setNowMs] = useState(() => Date.now());
  const { pendingDelete, deleteError, requestDelete, cancelDelete, confirmDelete, dismissError } =
    useBookDelete();

  const [bindTarget, setBindTarget] = useState<{ dir: string; title: string } | null>(null);
  const wereadByDir = useWereadStore((s) => s.byLocalDir);
  const setWereadBinding = useWereadStore((s) => s.setBinding);
  const syncAll = useWereadStore((s) => s.syncAll);
  const syncAllProgress = useWereadStore((s) => s.syncAllProgress);
  const lastSyncAllAt = useWereadStore((s) => s.lastSyncAllAt);

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!books.length) {
      return;
    }

    Promise.all(
      books.map(async (book) => {
        try {
          const res = await fetch(`/api/books/${encodeURIComponent(book.dir)}/progress`);
          if (!res.ok) return [book.dir, { genre: "未分类", author: "" }] as const;
          const progress = await res.json();
          return [book.dir, {
            genre: progress?.book?.genre || "未分类",
            author: progress?.book?.author || "",
          }] as const;
        } catch {
          return [book.dir, { genre: "未分类", author: "" }] as const;
        }
      }),
    ).then((entries) => {
      if (!cancelled) setBookMeta(Object.fromEntries(entries));
    });

    return () => {
      cancelled = true;
    };
  }, [books]);

  const handleOpenWereadMarks = (dir: string) => {
    setSelectedBookDir(dir);
    setViewMode('readingnotes-detail');
  };

  const handleSyncAll = () => {
    syncAll().catch((e) => console.warn('[LibraryView] syncAll error:', e));
  };

  function fmtRel(ts: number | null): string {
    if (!ts) return '从未';
    if (!nowMs) return '刚刚';
    const sec = Math.max(0, Math.floor((nowMs - ts) / 1000));
    if (sec < 60) return '刚刚';
    if (sec < 3600) return `${Math.floor(sec / 60)} 分钟前`;
    if (sec < 86400) return `${Math.floor(sec / 3600)} 小时前`;
    return `${Math.floor(sec / 86400)} 天前`;
  }

  // 首屏 hydrate：把已有 binding 灌入 store，让 BookCard 立即显示绿色 🔗
  useEffect(() => {
    fetch('/api/weread/bindings')
      .then((r) => (r.ok ? r.json() : { bindings: [] }))
      .then((d: { bindings?: Array<{ localBookDir: string; wereadBookId: string }> }) => {
        for (const b of d.bindings ?? []) setWereadBinding(b.localBookDir, b.wereadBookId);
      })
      .catch(() => { /* swallow */ });
  }, [setWereadBinding]);

  // 空状态引导
  if (!books || books.length === 0) {
    return (
      <div className="w-full h-full min-h-[500px] flex flex-col items-center justify-center p-8 text-center bg-surface">
        <div className="w-24 h-24 bg-surface-container-high rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-sm">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-primary" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
          </svg>
        </div>
        <h1 className="font-serif text-4xl font-bold text-on-surface mb-4">你的数字图书馆是空的</h1>
        <p className="text-on-surface-variant text-base leading-relaxed max-w-lg mx-auto mb-8">
          点击下方按钮或在项目根目录放置包含 <code className="px-1.5 py-0.5 bg-surface-container rounded text-primary text-sm font-mono">progress.json</code> 的实体文件夹即可开启专属阅读解析旅程。
        </p>
        <button 
          onClick={() => setIsImportOpen(true)}
          className="flex items-center gap-2 whitespace-nowrap px-8 py-3.5 bg-primary text-on-primary font-bold rounded-full text-base hover:brightness-110 active:scale-95 transition-[background-color,filter,box-shadow,transform] shadow-md cursor-pointer"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          导入我的第一本书
        </button>

        <ImportModal isOpen={isImportOpen} onClose={() => setIsImportOpen(false)} />
      </div>
    );
  }

  // 大厅视图
  const groupedBooks = books.reduce<Record<string, typeof books>>((acc, book) => {
    const genre = bookMeta[book.dir]?.genre || "未分类";
    if (!acc[genre]) acc[genre] = [];
    acc[genre].push(book);
    return acc;
  }, {});

  const renderBookCard = (book: (typeof books)[number]) => (
    <BookCard
      key={book.id}
      title={book.title}
      dir={book.dir}
      onClick={() => selectBook(book.dir)}
      onDelete={() => requestDelete({ dir: book.dir, title: book.title })}
      wereadBookId={wereadByDir[book.dir]}
      onOpenBind={() => setBindTarget({ dir: book.dir, title: book.title })}
      onOpenWereadMarks={() => handleOpenWereadMarks(book.dir)}
    />
  );

  return (
    <div className="w-full max-w-6xl mx-auto px-8 py-10 animate-in fade-in duration-500">
       <header className="mb-12 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
         <div className="min-w-0">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary mb-3">
              ReadPilot Archive
            </p>
            <h1 className="font-serif text-5xl font-bold text-on-surface tracking-tight">
              书 架
            </h1>
         </div>
         <div className="flex flex-wrap items-center gap-3">
           <div className="hidden h-10 items-center gap-1 rounded-xl border border-outline-variant/20 bg-surface-container p-1 md:flex">
             <button
               type="button"
               onClick={() => setLibraryMode('all')}
               aria-pressed={libraryMode === 'all'}
               className={`inline-flex h-8 items-center gap-2 whitespace-nowrap rounded-lg px-3 text-sm font-bold transition-colors ${
                 libraryMode === 'all'
                   ? 'bg-white text-primary shadow-sm'
                   : 'text-on-surface-variant hover:text-on-surface'
               }`}
             >
               <Library size={15} />
               全部
             </button>
             <button
               type="button"
               onClick={() => setLibraryMode('collections')}
               aria-pressed={libraryMode === 'collections'}
               className={`inline-flex h-8 items-center gap-2 whitespace-nowrap rounded-lg px-3 text-sm font-bold transition-colors ${
                 libraryMode === 'collections'
                   ? 'bg-white text-primary shadow-sm'
                   : 'text-on-surface-variant hover:text-on-surface'
               }`}
             >
               <Boxes size={15} />
               合集
             </button>
           </div>
           {Object.keys(wereadByDir).length > 0 && (
             <button
                type="button"
                onClick={handleSyncAll}
                disabled={syncAllProgress !== null}
                title={`上次同步：${fmtRel(lastSyncAllAt)}`}
                className="flex items-center gap-2 whitespace-nowrap px-4 py-2.5 bg-primary/10 text-primary font-bold rounded-xl text-sm hover:bg-primary/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
             >
               <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={syncAllProgress ? 'animate-spin' : ''}>
                 <path d="M21 12a9 9 0 1 1-3-6.7L21 8" /><path d="M21 3v5h-5" />
               </svg>
               {syncAllProgress
                 ? `同步中 ${syncAllProgress.done}/${syncAllProgress.total}`
                 : `同步微读 · ${fmtRel(lastSyncAllAt)}`}
             </button>
           )}
           <button
              onClick={() => setIsImportOpen(true)}
              className="flex items-center gap-2 whitespace-nowrap px-5 py-2.5 bg-surface-container-high text-on-surface-variant font-bold rounded-xl text-sm hover:bg-surface-container-highest hover:text-on-surface transition-colors cursor-pointer"
           >
             <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
             导入书籍
           </button>
         </div>
       </header>

       <div className="mb-6 flex h-10 items-center gap-1 rounded-xl border border-outline-variant/20 bg-surface-container p-1 md:hidden">
         <button
           type="button"
           onClick={() => setLibraryMode('all')}
           aria-pressed={libraryMode === 'all'}
           className={`inline-flex h-8 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 text-sm font-bold transition-colors ${
             libraryMode === 'all' ? 'bg-white text-primary shadow-sm' : 'text-on-surface-variant'
           }`}
         >
           <Library size={15} />
           全部
         </button>
         <button
           type="button"
           onClick={() => setLibraryMode('collections')}
           aria-pressed={libraryMode === 'collections'}
           className={`inline-flex h-8 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 text-sm font-bold transition-colors ${
             libraryMode === 'collections' ? 'bg-white text-primary shadow-sm' : 'text-on-surface-variant'
           }`}
         >
           <Boxes size={15} />
           合集
         </button>
       </div>

       {libraryMode === 'all' ? (
         <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
           {books.map(renderBookCard)}
         </div>
       ) : (
         <div className="space-y-10">
           {Object.entries(groupedBooks).map(([genre, genreBooks]) => (
             <section key={genre}>
               <div className="mb-4 flex items-center gap-3 border-b border-outline-variant/15 pb-2">
                 <h2 className="text-lg font-serif font-bold text-on-surface">{genre}</h2>
                 <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-xs font-bold text-on-surface-variant">
                   {genreBooks.length}
                 </span>
               </div>
               <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                 {genreBooks.map(renderBookCard)}
               </div>
             </section>
           ))}
         </div>
       )}

       <ImportModal isOpen={isImportOpen} onClose={() => setIsImportOpen(false)} />

       <ConfirmDialog
         isOpen={pendingDelete !== null}
         title="删除这本书？"
         message={pendingDelete ? `《${pendingDelete.title}》将被永久删除，包含书籍目录、阅读进度与聊天记录。\n此操作不可撤销。` : ''}
         confirmLabel="删除"
         cancelLabel="保留"
         destructive
         onConfirm={confirmDelete}
         onCancel={cancelDelete}
       />

       <ConfirmDialog
         isOpen={deleteError !== null}
         title="删除失败"
         message={deleteError ?? ''}
         confirmLabel="知道了"
         cancelLabel="关闭"
         onConfirm={dismissError}
         onCancel={dismissError}
       />

       {bindTarget && (
         <WereadBindDialog
           localBookDir={bindTarget.dir}
           defaultQuery={bindTarget.title}
           open={true}
           onClose={() => setBindTarget(null)}
           onBound={(wereadBookId) => setWereadBinding(bindTarget.dir, wereadBookId)}
         />
       )}
    </div>
  );
}
