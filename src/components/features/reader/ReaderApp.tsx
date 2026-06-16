/**
 * input: useBookStore, EpubReaderHeader, ChapterTimeline
 * output: ReaderApp center content area
 * pos: Shows library-level views, the fixed book Hub, and chapter reading pages.
 */
"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { ArrowRight, BookOpen, CalendarDays, FileText, ListChecks, NotebookPen, Sparkles, Tags } from "lucide-react";
import { useBookStore } from "@/store/useBookStore";
import { LibraryView } from "@/components/features/library/LibraryView";
import { CollectionsView } from "@/components/features/library/CollectionsView";
import { BookNotesView } from "@/components/features/library/BookNotesView";
import { ReadingNotesOverview } from "@/components/features/library/ReadingNotesOverview";
import { ArticlesListView } from "@/components/features/articles/ArticlesListView";
import { ArticleReadView } from "@/components/features/articles/ArticleReadView";
import type { ProgressPage } from "@/types/progress-data";
import { EpubReaderHeader } from "./EpubReaderHeader";
import { ChapterTimeline } from "./ChapterTimeline";

interface ReaderFrameProps {
  iframeSrc: string;
  pages: ProgressPage[];
  onBackToHub: () => void;
  onNavigatePage: (page: ProgressPage) => void;
}

function ReaderFrame({ iframeSrc, pages, onBackToHub, onNavigatePage }: ReaderFrameProps) {
  const [activeSrc, setActiveSrc] = useState(iframeSrc);
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const requestedSrcRef = useRef(iframeSrc);

  useLayoutEffect(() => {
    requestedSrcRef.current = iframeSrc;
  }, [iframeSrc]);

  const bindIframeLinks = useCallback((iframe: HTMLIFrameElement) => {
    const iframeWindow = iframe.contentWindow;
    if (!iframeWindow) return;

    iframeWindow.document.body.addEventListener("click", (event) => {
      const anchor = (event.target as HTMLElement).closest("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("http://") || href.startsWith("https://")) return;

      event.preventDefault();
      if (href.includes("index.html")) {
        onBackToHub();
        return;
      }

      const match = href.match(/\/api\/books\/[^/]+\/pages\/([^?]+)/);
      if (!match) return;

      const fileFromHref = decodeURIComponent(match[1]);
      const target = pages.find((page) => page.file === fileFromHref);
      if (target) onNavigatePage(target);
    });
  }, [onBackToHub, onNavigatePage, pages]);

  const handleFrameLoad = useCallback((iframe: HTMLIFrameElement, src: string) => {
    try {
      bindIframeLinks(iframe);
    } catch (error) {
      console.error("Iframe event binding failed", error);
    }

    if (src !== requestedSrcRef.current) return;
    setLoadedSrc(src);
    setActiveSrc(src);
  }, [bindIframeLinks]);

  const isLoading = loadedSrc !== iframeSrc;
  const frameSrcs = activeSrc === iframeSrc ? [activeSrc] : [activeSrc, iframeSrc];

  return (
    <div className="relative min-h-0 flex-1 overflow-hidden bg-[#FAF7F2]">
      {frameSrcs.map((src) => (
        <iframe
          key={src}
          src={src}
          title="ReadPilot reading page"
          aria-hidden={src !== activeSrc}
          className={`absolute inset-0 h-full w-full border-none bg-[#FAF7F2] transition-opacity duration-150 ease-out ${
            src === activeSrc ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
          onLoad={(event) => handleFrameLoad(event.currentTarget, src)}
        />
      ))}
      {isLoading && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-[#FAF7F2]/70 backdrop-blur-[1px]">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-stone-200 border-t-[#D94F30]" />
        </div>
      )}
    </div>
  );
}

function isSourceChapter(page: ProgressPage): boolean {
  return page.type === "chapter" && /^chap-\d+$/i.test(page.id);
}

export function ReaderApp() {
  const { progress, viewMode, currentPage, selectedBookDir, setViewMode, setCurrentPage, openPage: openReadingPage, theme, setTheme } = useBookStore();

  if (viewMode === "library") return <LibraryView />;
  if (viewMode === "collections") return <CollectionsView />;
  if (viewMode === "readingnotes") return <ReadingNotesOverview />;
  if (viewMode === "articles") return <ArticlesListView />;
  if (viewMode === "article-read") return <ArticleReadView />;
  if (viewMode === "readingnotes-detail") return <BookNotesView />;

  if (!progress) {
    return <LibraryView />;
  }

  if (viewMode === "page" && currentPage && selectedBookDir) {
    const iframeSrc = `/api/books/${encodeURIComponent(selectedBookDir)}/pages/${encodeURIComponent(currentPage.file)}?theme=${theme}`;

    return (
      <div className="flex h-full w-full flex-col">
        <EpubReaderHeader
          pages={progress.pages}
          currentPage={currentPage}
          theme={theme}
          onBack={() => {
            setViewMode("hub");
            setCurrentPage(null);
          }}
          onPageChange={(page) => setCurrentPage(page)}
          onThemeChange={setTheme}
        />
        <ReaderFrame
          iframeSrc={iframeSrc}
          pages={progress.pages}
          onBackToHub={() => {
            setViewMode("hub");
            setCurrentPage(null);
          }}
          onNavigatePage={(page) => setCurrentPage(page)}
        />
      </div>
    );
  }

  const chapters = progress.pages.filter(isSourceChapter);
  const completed = chapters.filter((page) => page.status === "completed").length;
  const total = chapters.length;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  const companionCount = progress.pages.filter((page) => !isSourceChapter(page)).length;
  const currentReadingPage = progress.pages.find((page) => page.status === "in-progress" && isSourceChapter(page)) || chapters[0];
  const overviewPage = progress.pages.find((page) => page.type === "overview") || progress.pages.find((page) => page.type === "synthesis");
  const focusPage = progress.currentFocus
    ? progress.pages.find((page) => page.id === progress.currentFocus || page.title === progress.currentFocus)
    : null;
  const focusText = focusPage?.title || progress.nextRecommendation?.title || currentReadingPage?.title || "选择章节开始阅读";
  const startDate = progress.book.startDate ? new Date(progress.book.startDate).toLocaleDateString("zh-CN") : "未记录";
  const glossaryEntries = Object.entries(progress.glossary || {}).slice(0, 6);
  const recentLogs = (progress.readingLog || []).slice(-3).reverse();

  const openPage = (page: ProgressPage) => {
    openReadingPage(page);
  };

  return (
    <div className="hide-scrollbar flex-1 overflow-y-auto bg-[#F8F5EF] px-5 py-6 lg:px-9">
      <div className="mx-auto max-w-6xl">
        <section className="border-b border-stone-200 pb-6">
          <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-stone-500">
            <span className="uppercase tracking-[0.18em] text-[#D94F30]">ReadPilot</span>
            <span>{progress.book.author || "未知作者"}</span>
            <span>{startDate}</span>
          </div>
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <h1 className="max-w-4xl text-3xl font-semibold leading-tight text-stone-950 md:text-4xl">
                {progress.book.title || "Untitled"}
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-stone-600">{focusText}</p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <button
                type="button"
                onClick={() => currentReadingPage && openPage(currentReadingPage)}
                disabled={!currentReadingPage}
                className="inline-flex h-10 items-center gap-2 rounded-md bg-[#D94F30] px-4 text-sm font-semibold text-white shadow-sm shadow-[#D94F30]/20 transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <BookOpen size={16} />
                {completed > 0 ? "继续阅读" : "开始阅读"}
              </button>
              <button
                type="button"
                onClick={() => setViewMode("readingnotes-detail")}
                className="inline-flex h-10 items-center gap-2 rounded-md border border-stone-200 bg-white px-4 text-sm font-semibold text-stone-700 hover:border-stone-300"
              >
                <NotebookPen size={16} />
                章节笔记
              </button>
              {overviewPage && (
                <button
                  type="button"
                  onClick={() => openPage(overviewPage)}
                  className="inline-flex h-10 items-center gap-2 rounded-md border border-stone-200 bg-white px-4 text-sm font-semibold text-stone-700 hover:border-stone-300"
                >
                  <FileText size={16} />
                  全书概览
                </button>
              )}
            </div>
          </div>

          <div className="mt-6 grid gap-4 border-t border-stone-200 pt-4 md:grid-cols-4">
            <div>
              <div className="mb-1 flex items-center gap-2 text-xs font-semibold text-stone-500">
                <ListChecks size={14} />
                章节进度
              </div>
              <div className="text-xl font-semibold text-stone-950">{completed}/{total}</div>
            </div>
            <div>
              <div className="mb-1 flex items-center gap-2 text-xs font-semibold text-stone-500">
                <FileText size={14} />
                伴读材料
              </div>
              <div className="text-xl font-semibold text-stone-950">{companionCount}</div>
            </div>
            <div>
              <div className="mb-1 flex items-center gap-2 text-xs font-semibold text-stone-500">
                <Tags size={14} />
                主题
              </div>
              <div className="text-xl font-semibold text-stone-950">{progress.themes.length}</div>
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between text-xs font-semibold text-stone-500">
                <span>完成度</span>
                <span>{percent}%</span>
              </div>
              <div className="h-2 rounded-full bg-stone-200">
                <div className="h-full rounded-full bg-[#D94F30]" style={{ width: `${percent}%` }} />
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-8 py-7 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0">
            <ChapterTimeline pages={progress.pages} onPageClick={openPage} />
          </div>

          <aside className="space-y-6">
            {progress.nextRecommendation && (
              <section className="border-l-2 border-[#D94F30] pl-4">
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#D94F30]">
                  <Sparkles size={14} />
                  下一步
                </div>
                <h2 className="text-base font-semibold leading-snug text-stone-950">{progress.nextRecommendation.title}</h2>
                <p className="mt-2 text-sm leading-6 text-stone-600">{progress.nextRecommendation.description}</p>
              </section>
            )}

            <section>
              <div className="mb-3 flex items-center justify-between border-b border-stone-200 pb-2">
                <h2 className="text-sm font-semibold text-stone-950">主题索引</h2>
                <span className="text-xs text-stone-500">{progress.themes.length}</span>
              </div>
              {progress.themes.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {progress.themes.slice(0, 10).map((themeName) => (
                    <span key={themeName} className="rounded-md border border-stone-200 bg-white px-2.5 py-1 text-xs text-stone-700">
                      {themeName}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-stone-500">暂无主题。</p>
              )}
            </section>

            <section>
              <div className="mb-3 flex items-center justify-between border-b border-stone-200 pb-2">
                <h2 className="text-sm font-semibold text-stone-950">术语</h2>
                <span className="text-xs text-stone-500">{Object.keys(progress.glossary || {}).length}</span>
              </div>
              {glossaryEntries.length > 0 ? (
                <div className="space-y-3">
                  {glossaryEntries.map(([term, desc]) => (
                    <div key={term}>
                      <div className="text-sm font-semibold text-stone-900">{term}</div>
                      <p className="mt-1 line-clamp-3 text-xs leading-5 text-stone-600">{desc}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-stone-500">暂无术语。</p>
              )}
            </section>

            <section>
              <div className="mb-3 flex items-center justify-between border-b border-stone-200 pb-2">
                <h2 className="text-sm font-semibold text-stone-950">最近记录</h2>
                <CalendarDays size={14} className="text-stone-400" />
              </div>
              {recentLogs.length > 0 ? (
                <div className="space-y-3">
                  {recentLogs.map((log, index) => (
                    <div key={`${log.date}-${index}`} className="text-xs leading-5">
                      <div className="font-semibold text-stone-700">{log.date}</div>
                      <p className="mt-0.5 text-stone-500">{log.note}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-stone-500">暂无记录。</p>
              )}
            </section>

            {focusPage && (
              <button
                type="button"
                onClick={() => openPage(focusPage)}
                className="inline-flex w-full items-center justify-between rounded-md border border-stone-200 bg-white px-3 py-2 text-left text-sm font-semibold text-stone-700 hover:border-[#D94F30]/40"
              >
                <span className="line-clamp-1">{focusPage.title}</span>
                <ArrowRight size={15} className="shrink-0 text-stone-400" />
              </button>
            )}
          </aside>
        </section>
      </div>
    </div>
  );
}
