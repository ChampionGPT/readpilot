/**
 * input: useBookStore (progress, navigation actions)
 * output: 当前书洞察面板 — 只使用 progress.json 中的真实进度、主题、术语和日志
 * pos: 左侧栏 current-book insights 视图，替代早期 mock analysis
 *
 * 声明：一旦我被更新，务必更新我的开头注释以及所属文件夹的 md。
 */
"use client";

import { ArrowRight, BarChart3, BookOpen, FileText, ListChecks, NotebookPen, Tags } from "lucide-react";
import { useBookStore } from "@/store/useBookStore";

function StatItem({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-stone-200/70 bg-white/70 px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-400">{label}</div>
      <div className="mt-1 text-lg font-semibold text-stone-900">{value}</div>
    </div>
  );
}

export function AnalysisPanel() {
  const { progress, setViewMode, setCurrentPage } = useBookStore();

  if (!progress) {
    return (
      <div className="my-10 rounded-md border border-stone-200/70 bg-white/60 px-4 py-6 text-center">
        <BarChart3 className="mx-auto mb-3 h-8 w-8 text-stone-300" />
        <p className="text-xs font-medium text-stone-500">选择一本书后显示洞察。</p>
      </div>
    );
  }

  const chapters = progress.pages.filter((page) => page.type === "chapter");
  const completed = chapters.filter((page) => page.status === "completed").length;
  const inProgress = chapters.find((page) => page.status === "in-progress") || chapters[0] || null;
  const companionPages = progress.pages.filter((page) => page.type !== "chapter");
  const percent = chapters.length > 0 ? Math.round((completed / chapters.length) * 100) : 0;
  const pagePercent = progress.book.totalPages && progress.book.currentPage
    ? Math.min(100, Math.round((progress.book.currentPage / progress.book.totalPages) * 100))
    : null;
  const glossaryEntries = Object.entries(progress.glossary || {}).slice(0, 4);
  const recentLogs = (progress.readingLog || []).slice(-3).reverse();

  const openPage = () => {
    if (!inProgress) return;
    setCurrentPage(inProgress);
    setViewMode("page");
  };

  return (
    <div className="space-y-5 pb-4 pt-2">
      <section>
        <div className="mb-3 flex items-center justify-between px-1">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#6B6560]">
            当前书洞察
          </span>
          <BarChart3 size={15} className="text-stone-400" />
        </div>

        <div className="rounded-md border border-stone-200/70 bg-white/70 p-4">
          <p className="line-clamp-2 text-sm font-semibold leading-snug text-stone-900">{progress.book.title}</p>
          {progress.book.author && <p className="mt-1 text-xs text-stone-500">{progress.book.author}</p>}
          <div className="mt-4">
            <div className="mb-1 flex items-center justify-between text-xs text-stone-500">
              <span>章节完成度</span>
              <span>{percent}%</span>
            </div>
            <div className="h-2 rounded-full bg-stone-200">
              <div className="h-full rounded-full bg-[#D94F30]" style={{ width: `${percent}%` }} />
            </div>
          </div>
          {pagePercent !== null && (
            <div className="mt-3">
              <div className="mb-1 flex items-center justify-between text-xs text-stone-500">
                <span>页码进度</span>
                <span>{progress.book.currentPage}/{progress.book.totalPages}</span>
              </div>
              <div className="h-1.5 rounded-full bg-stone-200">
                <div className="h-full rounded-full bg-stone-700" style={{ width: `${pagePercent}%` }} />
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="grid grid-cols-2 gap-2">
        <StatItem label="已读章节" value={`${completed}/${chapters.length}`} />
        <StatItem label="伴读页" value={companionPages.length} />
        <StatItem label="主题" value={progress.themes.length} />
        <StatItem label="日志" value={progress.readingLog.length} />
      </section>

      <section className="space-y-2">
        <button
          type="button"
          onClick={openPage}
          disabled={!inProgress}
          className="flex w-full items-center justify-between rounded-md bg-[#D94F30] px-3 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span className="inline-flex items-center gap-2"><BookOpen size={15} />继续阅读</span>
          <ArrowRight size={15} />
        </button>
        <button
          type="button"
          onClick={() => setViewMode("hub")}
          className="flex w-full items-center justify-between rounded-md border border-stone-200 bg-white/70 px-3 py-2 text-sm font-semibold text-stone-700 hover:border-stone-300"
        >
          <span className="inline-flex items-center gap-2"><ListChecks size={15} />阅读工作台</span>
          <ArrowRight size={15} />
        </button>
        <button
          type="button"
          onClick={() => setViewMode("readingnotes-detail")}
          className="flex w-full items-center justify-between rounded-md border border-stone-200 bg-white/70 px-3 py-2 text-sm font-semibold text-stone-700 hover:border-stone-300"
        >
          <span className="inline-flex items-center gap-2"><NotebookPen size={15} />章节笔记</span>
          <ArrowRight size={15} />
        </button>
      </section>

      <section>
        <div className="mb-2 flex items-center gap-2 px-1 text-[10px] font-bold uppercase tracking-widest text-[#6B6560]">
          <Tags size={13} />
          主题
        </div>
        {progress.themes.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {progress.themes.slice(0, 10).map((theme) => (
              <span key={theme} className="rounded-md border border-stone-200 bg-white/70 px-2 py-1 text-[11px] text-stone-700">
                {theme}
              </span>
            ))}
          </div>
        ) : (
          <p className="px-1 text-xs text-stone-400">暂无主题。</p>
        )}
      </section>

      <section>
        <div className="mb-2 flex items-center gap-2 px-1 text-[10px] font-bold uppercase tracking-widest text-[#6B6560]">
          <FileText size={13} />
          术语
        </div>
        {glossaryEntries.length > 0 ? (
          <div className="space-y-2">
            {glossaryEntries.map(([term, desc]) => (
              <div key={term} className="rounded-md border border-stone-200/70 bg-white/70 px-3 py-2">
                <div className="text-xs font-semibold text-stone-900">{term}</div>
                <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-stone-500">{desc}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="px-1 text-xs text-stone-400">暂无术语。</p>
        )}
      </section>

      <section>
        <div className="mb-2 px-1 text-[10px] font-bold uppercase tracking-widest text-[#6B6560]">最近记录</div>
        {recentLogs.length > 0 ? (
          <div className="space-y-2">
            {recentLogs.map((log, index) => (
              <div key={`${log.date}-${index}`} className="border-l border-stone-300 pl-3 text-xs leading-5">
                <div className="font-semibold text-stone-700">{log.date}</div>
                <p className="text-stone-500">{log.note}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="px-1 text-xs text-stone-400">暂无记录。</p>
        )}
      </section>
    </div>
  );
}
