/**
* input: useBookStore (books, selectedBookDir, sidebarNav)
* output: 书架面板 — 稳定尺寸的书籍封面卡片网格 + 进度圆环 + 当前书快捷操作
* pos: 侧边栏的 bookshelf 视图，展示已导入的书籍列表（带封面和进度）
*
* 设计参考: Ui/references/1.HTML — 书籍封面 aspect-[3/4] 网格展示
* 声明：一旦我被更新，务必更新我的开头注释以及所属文件夹的 md。
*/
"use client";

import { useBookStore } from "@/store/useBookStore";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { getThumbnailGradient } from "@/lib/title-gradient";
import { useBookDelete } from "@/hooks/useBookDelete";

/** SVG 圆环进度指示器 */
function ProgressRing({ percent, size = 32 }: { percent: number; size?: number }) {
  const r = (size - 4) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (percent / 100) * c;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg className="-rotate-90" width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="transparent" stroke="#E5DFD6" strokeWidth={2} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="transparent"
          stroke="#D94F30" strokeWidth={2}
          strokeDasharray={c} strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-[stroke-dashoffset] duration-500 ease-out"
        />
      </svg>
      <span className="absolute text-[7px] font-bold text-[#2C2A28]">{percent}%</span>
    </div>
  );
}

export function BookshelfPanel() {
  const {
    books,
    selectedBookDir,
    progress,
    setIsImportOpen,
    setIsPageInputOpen,
    selectBook,
  } = useBookStore();

  const { pendingDelete, deleteError, requestDelete, cancelDelete, confirmDelete, dismissError } =
    useBookDelete();

  // 计算当前书籍的阅读进度
  const getProgressPercent = () => {
    if (!progress?.book) return 0;
    const { totalPages, currentPage } = progress.book;
    if (!totalPages || !currentPage || totalPages <= 0) return 0;
    return Math.min(100, Math.round((currentPage / totalPages) * 100));
  };

  const percent = selectedBookDir ? getProgressPercent() : 0;

  const handleSelectBook = (dir: string) => {
    selectBook(dir);
  };

  const handleDeleteBook = (e: React.MouseEvent, book: { dir: string; title: string }) => {
    e.stopPropagation();
    requestDelete(book);
  };

  return (
    <div className="pt-2 pb-4">
      {/* Section Header */}
      <div className="flex justify-between items-center mb-4 px-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-[#6B6560]">
          Your Library
        </span>
        <button
          onClick={() => setIsImportOpen(true)}
          className="text-[#D94F30] hover:text-[#C4432A] transition-colors cursor-pointer"
          title="Add New Book"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" />
          </svg>
        </button>
      </div>

      {/* Book Cards Grid */}
      {books.length === 0 ? (
        <div className="text-center py-8 px-3">
          <div className="w-16 h-20 mx-auto mb-3 rounded bg-stone-200/60 flex items-center justify-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9E9790" strokeWidth="1.5">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
            </svg>
          </div>
          <p className="text-[11px] text-stone-400 font-sans">
            No books yet.
          </p>
          <button
            onClick={() => setIsImportOpen(true)}
            className="mt-2 text-[11px] text-[#D94F30] font-bold hover:underline cursor-pointer"
          >
            Import your first book
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {books.map((book) => {
            const isCurrent = selectedBookDir === book.dir;
  // 使用真实进度（当前选中书籍）或 0（非选中书籍）
  const bookPercent = isCurrent ? percent : 0;
  // 检查是否已设置页数
  const hasPageData = isCurrent && progress?.book?.totalPages && progress?.book?.currentPage;

            const gradient = getThumbnailGradient(book.title);

            return (
              <div
                key={book.id}
                role="button"
                tabIndex={0}
                onClick={() => handleSelectBook(book.dir)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleSelectBook(book.dir);
                  }
                }}
                className={`group cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D94F30]/40 rounded-lg transition-opacity duration-150 ${
                  isCurrent ? "" : "opacity-70 hover:opacity-100"
                }`}
              >
                {/* Book Cover */}
                <div
                  className={`relative aspect-[3/4] w-full mb-2 rounded-lg overflow-hidden shadow-md transition-[transform,box-shadow] duration-200 group-hover:-translate-y-0.5 group-hover:shadow-lg ${
                    isCurrent
                      ? "ring-2 ring-[#D94F30] ring-offset-2 ring-offset-[#f0ede9]"
                      : ""
                  }`}
                >
                  {/* Generated Book Cover */}
                  <div className={`w-full h-full bg-gradient-to-br ${gradient} flex flex-col items-center justify-center p-3 text-center`}>
                    <span className="text-white/20 text-4xl font-serif font-black leading-none mb-1">
                      {book.title.charAt(0)}
                    </span>
                    <span className="text-white/80 text-[9px] font-bold uppercase tracking-widest line-clamp-2">
                      {book.title}
                    </span>
                  </div>

                  {/* Progress Circle Overlay */}
                  {bookPercent > 0 && (
                    <div className="absolute bottom-2 right-2 bg-white/90 backdrop-blur-sm rounded-full p-0.5 border border-stone-200/50">
                      <ProgressRing percent={bookPercent} size={28} />
                    </div>
                  )}

                  {/* Hover Overlay */}
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-center justify-center">
                    <div className="w-9 h-9 bg-white/90 rounded-full flex items-center justify-center shadow-lg">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D94F30" strokeWidth="2.5">
                        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                      </svg>
                    </div>
                  </div>

                  {/* Delete button — top-right, hover only */}
                  <button
                    onClick={(e) => handleDeleteBook(e, book)}
                    title="删除这本书"
                    className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-white/95 backdrop-blur-sm shadow-md flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:scale-105 active:scale-95 transition-[opacity,transform,background-color] duration-150 cursor-pointer z-20"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#D94F30" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                    </svg>
                  </button>
                </div>

                {/* Book Info */}
                <p className={`text-xs font-serif font-bold line-clamp-1 transition-colors ${
                  isCurrent ? "text-[#D94F30]" : "text-[#2C2A28] group-hover:text-[#D94F30]"
                }`}>
                  {book.title}
                </p>
                {isCurrent && (
                  <div className="mt-1 flex min-h-5 items-center gap-1.5">
                    <span className="shrink-0 rounded bg-[#D94F30]/10 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-[#D94F30]">
                      Reading
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsPageInputOpen(true);
                      }}
                      className="min-w-0 truncate text-[8px] font-bold text-primary hover:underline cursor-pointer"
                    >
                      {hasPageData ? "更新页数" : "+ 设置页数"}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

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
    </div>
  );
}
