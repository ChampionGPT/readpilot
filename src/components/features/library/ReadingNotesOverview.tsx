/**
 * input: useBookStore (books), /api/notes/summary
 * output: 按书聚合的全局读书笔记概览视图 — 书籍卡片 + 笔记统计 + 最近摘要预览
 * pos: 中央面板的 ReadingNotes 入口 — 展示所有书的笔记数量，点击进入详情
 *
 * 声明：一旦我被更新，务必更新我的开头注释以及所属文件夹的 md。
 */
"use client";

import { useEffect, useState } from "react";
import { useBookStore } from "@/store/useBookStore";

interface NoteSummary {
  bookId: string;
  bookDir: string;
  bookTitle: string;
  noteCount: number;
  latestCue?: string;
  latestUpdatedAt?: string;
}

/** 从书名生成确定性渐变色 */
function titleToGradient(title: string): [string, string] {
  const palettes: [string, string][] = [
    ["#44403c", "#78716c"], // stone
    ["#92400e", "#78716c"], // amber → stone
    ["#065f46", "#44403c"], // emerald → stone
    ["#1e3a5f", "#44403c"], // indigo → stone
    ["#5b21b6", "#44403c"], // violet → stone
    ["#9f1239", "#78716c"], // rose → stone
  ];
  let hash = 0;
  for (let i = 0; i < title.length; i++) hash = title.charCodeAt(i) + ((hash << 5) - hash);
  return palettes[Math.abs(hash) % palettes.length];
}

function formatRelativeTime(dateStr?: string): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "今天";
  if (days === 1) return "昨天";
  if (days < 7) return `${days} 天前`;
  if (days < 30) return `${Math.floor(days / 7)} 周前`;
  return `${Math.floor(days / 30)} 月前`;
}

export function ReadingNotesOverview() {
  const { books, setSelectedBookDir, setViewMode } = useBookStore();
  const [summaries, setSummaries] = useState<NoteSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/notes/summary")
      .then(r => r.ok ? r.json() : [])
      .then((data: NoteSummary[]) => setSummaries(data))
      .catch(() => setSummaries([]))
      .finally(() => setLoading(false));
  }, []);

  const booksWithNotes = books.map(book => {
    const summary = summaries.find(s => s.bookDir === book.dir);
    return {
      ...book,
      noteCount: summary?.noteCount || 0,
      latestCue: summary?.latestCue || "",
      latestUpdatedAt: summary?.latestUpdatedAt || "",
    };
  });

  const totalNotes = booksWithNotes.reduce((sum, b) => sum + b.noteCount, 0);
  const booksWithNotesFirst = [...booksWithNotes].sort((a, b) => b.noteCount - a.noteCount);

  const handleEnterBook = (dir: string) => {
    setSelectedBookDir(dir);
    setViewMode("readingnotes-detail");
  };

  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto px-8 py-10 hide-scrollbar bg-[#FAF7F2]">
        <div className="max-w-4xl mx-auto animate-pulse space-y-6">
          <div className="h-10 bg-stone-200 rounded w-64" />
          <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
            {[1, 2, 3].map(i => <div key={i} className="h-44 bg-stone-200 rounded-2xl" />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-8 py-10 hide-scrollbar bg-[#FAF7F2]">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <header className="mb-10">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#D94F30] mb-3 font-bold">
            ReadPilot · Reading Notes
          </p>
          <h1 className="text-4xl md:text-5xl font-serif font-bold text-stone-700 tracking-tight mb-3">读书笔记</h1>

          {/* Stats Bar */}
          <div className="flex items-center gap-4 text-sm">
            <span className="text-stone-500">
              康奈尔笔记法
            </span>
            <span className="w-1 h-1 rounded-full bg-stone-300" />
            <span className="text-stone-500 font-medium">{totalNotes} 条笔记</span>
            <span className="w-1 h-1 rounded-full bg-stone-300" />
            <span className="text-stone-500">{books.length} 本书</span>
          </div>
        </header>

        {books.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-stone-200/60 shadow-sm">
            <div className="w-16 h-16 rounded-2xl bg-stone-100 flex items-center justify-center mx-auto mb-5">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#9E9790" strokeWidth="1.5">
                <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
            </div>
            <p className="text-stone-500 font-medium mb-2">还没有书籍</p>
            <p className="text-sm text-stone-400">导入第一本书后即可开始做笔记</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {booksWithNotesFirst.map((book) => {
              const [from, to] = titleToGradient(book.title);
              const hasNotes = book.noteCount > 0;

              return (
                <button
                  key={book.id}
                  onClick={() => handleEnterBook(book.dir)}
                  className="group text-left bg-white rounded-2xl border border-stone-200/60 overflow-hidden shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer"
                >
                  {/* Cover Strip */}
                  <div
                    className="h-28 flex items-end justify-between p-4 relative"
                    style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
                  >
                    {/* Big initial letter */}
                    <span className="text-white/10 text-7xl font-serif font-black absolute top-2 left-4 select-none leading-none">
                      {book.title.charAt(0)}
                    </span>

                    {/* Note Count Badge */}
                    <div className="relative z-[1] bg-white/90 backdrop-blur-sm rounded-lg px-2.5 py-1.5 flex items-center gap-1.5 shadow-sm ml-auto">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#D94F30" strokeWidth="2.5">
                        <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                      </svg>
                      <span className="text-[11px] font-bold text-[#D94F30]">{book.noteCount}</span>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-4">
                    <h3 className="text-sm font-serif font-bold text-stone-700 line-clamp-1 group-hover:text-[#D94F30] transition-colors mb-1.5">
                      {book.title}
                    </h3>

                    {hasNotes && book.latestCue ? (
                      <p className="text-[11px] text-stone-400 line-clamp-2 leading-relaxed mb-2 italic">
                        &quot;{book.latestCue.slice(0, 60)}&quot;
                      </p>
                    ) : null}

                    <div className="flex items-center justify-between">
                      <p className="text-[10px] text-stone-400">
                        {hasNotes ? `${book.noteCount} 条笔记` : "暂无笔记"}
                      </p>
                      {book.latestUpdatedAt && (
                        <span className="text-[9px] text-stone-300 font-mono">
                          {formatRelativeTime(book.latestUpdatedAt)}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
