/**
 * input: useBookStore, EpubReaderHeader, ChapterTimeline
 * output: ReaderApp center content area with stable panel navigation and two-slot iframe crossfades
 * pos: Shows library-level views, the fixed book Hub, and chapter reading pages.
 */
"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
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
import { AnnotationDrawer } from "./AnnotationDrawer";
import { ReadingUtilityRail, type ReadingPanel } from "./ReadingUtilityRail";
import { ShareComposer } from "./ShareComposer";
import type { ShareContent } from "./share-card";

interface ReaderFrameProps {
  iframeSrc: string;
  pages: ProgressPage[];
  onBackToHub: () => void;
  onNavigatePage: (page: ProgressPage) => void;
  onActiveFrame?: (iframe: HTMLIFrameElement) => void;
}

export function isTrustedShareMessage(event: MessageEvent, activeFrameWindow: Window | null | undefined, currentPageId: string | undefined) {
  const data = event.data as { source?: string; type?: string; payload?: { quote?: string; pageId?: string } };
  return event.origin === window.location.origin
    && event.source === activeFrameWindow
    && data?.source === "rp-annotator"
    && data.type === "rp-share"
    && Boolean(data.payload?.quote?.trim())
    && data.payload?.pageId === currentPageId;
}

function ReaderFrame({ iframeSrc, pages, onBackToHub, onNavigatePage, onActiveFrame }: ReaderFrameProps) {
  const [requestedSlot, setRequestedSlot] = useState({ src: iframeSrc, generation: 0 });
  const latestRequestRef = useRef(requestedSlot);
  const [activeSlot, setActiveSlot] = useState(requestedSlot);
  const [retiringSlot, setRetiringSlot] = useState<typeof activeSlot | null>(null);
  const [entering, setEntering] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const retireTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const enterFrameRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    setRequestedSlot((current) => {
      if (current.src === iframeSrc) return current;
      const next = { src: iframeSrc, generation: current.generation + 1 };
      latestRequestRef.current = next;
      return next;
    });
  }, [iframeSrc]);

  useEffect(() => () => {
    if (retireTimerRef.current) clearTimeout(retireTimerRef.current);
    if (enterFrameRef.current !== null) cancelAnimationFrame(enterFrameRef.current);
  }, []);

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

  const clearRetiring = useCallback(() => {
    setRetiringSlot(null);
    if (retireTimerRef.current) clearTimeout(retireTimerRef.current);
    retireTimerRef.current = null;
  }, []);

  const handleFrameLoad = useCallback((iframe: HTMLIFrameElement, slot: typeof activeSlot) => {
    try {
      bindIframeLinks(iframe);
    } catch (error) {
      console.error("Iframe event binding failed", error);
    }

    if (slot.src !== latestRequestRef.current.src || slot.generation !== latestRequestRef.current.generation) return;
    setInitialLoaded(true);
    if (slot.generation !== activeSlot.generation) {
      if (retireTimerRef.current) clearTimeout(retireTimerRef.current);
      if (enterFrameRef.current !== null) cancelAnimationFrame(enterFrameRef.current);
      setRetiringSlot(activeSlot);
      setActiveSlot(slot);
      setEntering(true);
      enterFrameRef.current = requestAnimationFrame(() => {
        enterFrameRef.current = null;
        if (slot.generation !== latestRequestRef.current.generation) return;
        setEntering(false);
        retireTimerRef.current = setTimeout(clearRetiring, 170);
      });
    }
    onActiveFrame?.(iframe);
  }, [activeSlot, bindIframeLinks, clearRetiring, onActiveFrame]);

  const pendingSlot = activeSlot.generation === requestedSlot.generation ? null : requestedSlot;
  const frameSlots = [retiringSlot, activeSlot, pendingSlot].filter((slot): slot is typeof activeSlot => Boolean(slot))
    .filter((slot, index, slots) => slots.findIndex((candidate) => candidate.generation === slot.generation) === index);

  return (
    <div className="relative min-h-0 flex-1 overflow-hidden bg-[#FAF7F2]">
      {frameSlots.map((slot) => {
        const isActive = slot.generation === activeSlot.generation;
        const isRetiring = slot.generation === retiringSlot?.generation;
        const visible = (isActive && !entering) || (isRetiring && entering);
        return (
        <iframe
          key={slot.generation}
          src={slot.src}
          title="ReadPilot reading page"
          aria-hidden={!isActive}
          data-frame-state={isActive ? "front" : "back"}
          className={`absolute inset-0 z-0 h-full w-full border-none bg-[#FAF7F2] transition-opacity duration-150 ease-out ${
            visible ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
          onLoad={(event) => handleFrameLoad(event.currentTarget, slot)}
          onTransitionEnd={(event) => {
            if (isRetiring && event.propertyName === "opacity" && !entering) clearRetiring();
          }}
        />
      );})}
      {(!initialLoaded || pendingSlot) && (
        <div data-testid="frame-loading-indicator" className="pointer-events-none absolute bottom-4 left-1/2 z-10 -translate-x-1/2 rounded-full bg-[#FFFDF9]/92 p-2 shadow-sm" aria-label="正在加载阅读页" role="status">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-stone-200 border-t-[#D94F30]" />
        </div>
      )}
    </div>
  );
}

function isSourceChapter(page: ProgressPage): boolean {
  return page.type === "chapter" && /^chap-\d+$/i.test(page.id);
}

const FONT_SIZE_STORAGE_KEY = "rp-reader-font-size";
const FONT_SIZE_MIN = 15;
const FONT_SIZE_MAX = 28;

export function ReaderApp() {
  const { progress, viewMode, currentPage, selectedBookDir, setViewMode, setCurrentPage, openPage: openReadingPage, closePage, pageReturnView, setProgress, theme, setTheme } = useBookStore();
  const activeFrameRef = useRef<HTMLIFrameElement | null>(null);
  const [activePanel, setActivePanel] = useState<ReadingPanel | null>(null);
  const [shareContent, setShareContent] = useState<ShareContent | null>(null);
  // Hub 章节路径的笔记/标注计数（pageId → counts）
  const [pageStats, setPageStats] = useState<Record<string, { notes: number; annotations: number }>>({});
  // 正文字号（px）；null = 跟随主题默认。持久化到 localStorage。
  const [fontSize, setFontSize] = useState<number | null>(null);
  const fontSizeRef = useRef<number | null>(null);
  const closeShareComposer = useCallback(() => setShareContent(null), []);

  const applyFontSize = useCallback((iframe: HTMLIFrameElement | null, size: number | null) => {
    const rootEl = iframe?.contentDocument?.documentElement;
    if (!rootEl) return;
    if (size == null) rootEl.style.removeProperty("--rp-font-size");
    else rootEl.style.setProperty("--rp-font-size", `${size}px`);
  }, []);

  useEffect(() => {
    const raw = window.localStorage.getItem(FONT_SIZE_STORAGE_KEY);
    const parsed = raw == null ? NaN : Number(raw);
    if (Number.isFinite(parsed)) {
      const clamped = Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, parsed));
      fontSizeRef.current = clamped;
      setFontSize(clamped);
    }
  }, []);

  useEffect(() => {
    fontSizeRef.current = fontSize;
    applyFontSize(activeFrameRef.current, fontSize);
    if (fontSize == null) window.localStorage.removeItem(FONT_SIZE_STORAGE_KEY);
    else window.localStorage.setItem(FONT_SIZE_STORAGE_KEY, String(fontSize));
  }, [fontSize, applyFontSize]);

  const navigateToPage = useCallback((page: ProgressPage) => {
    setActivePanel(null);
    setCurrentPage(page);
  }, [setCurrentPage]);

  /** 更新章节阅读状态并落盘（PATCH 全量 pages，成功后同步 store） */
  const markPageStatus = useCallback(async (pageId: string, status: "in-progress" | "completed") => {
    const prog = useBookStore.getState().progress;
    if (!selectedBookDir || !prog) return;
    const target = prog.pages.find((page) => page.id === pageId);
    if (!target || target.status === status) return;
    if (status === "in-progress" && target.status === "completed") return; // 重读不降级
    const pages = prog.pages.map((page) => page.id === pageId
      ? { ...page, status, completedAt: status === "completed" ? new Date().toISOString() : page.completedAt }
      : page);
    try {
      const res = await fetch(`/api/books/${encodeURIComponent(selectedBookDir)}/progress`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pages }),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data?.progress) setProgress(data.progress);
    } catch { /* 静默：下次进入章节会重试 */ }
  }, [selectedBookDir, setProgress]);

  // 打开章节即标记「阅读中」
  useEffect(() => {
    if (viewMode !== "page" || !currentPage || currentPage.type !== "chapter") return;
    if (currentPage.status === "new") markPageStatus(currentPage.id, "in-progress");
  }, [viewMode, currentPage, markPageStatus]);

  // annotator 报告读到章节底部 → 标记「已读」
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.source !== activeFrameRef.current?.contentWindow) return;
      const data = event.data as { source?: string; type?: string; payload?: { pageId?: string } };
      if (data?.source !== "rp-annotator" || data.type !== "rp-read-complete") return;
      if (!currentPage || data.payload?.pageId !== currentPage.id) return;
      markPageStatus(currentPage.id, "completed");
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [currentPage, markPageStatus]);

  // Hub 章节路径：同步每章的笔记与标注数量
  useEffect(() => {
    if (viewMode !== "hub" || !selectedBookDir) return;
    let cancelled = false;
    const load = async () => {
      try {
        const [notesRes, annRes] = await Promise.all([
          fetch(`/api/books/${encodeURIComponent(selectedBookDir)}/notes`),
          fetch(`/api/books/${encodeURIComponent(selectedBookDir)}/annotations`),
        ]);
        const notes = notesRes.ok ? await notesRes.json() : [];
        const annData = annRes.ok ? await annRes.json() : { annotations: [] };
        if (cancelled) return;
        const stats: Record<string, { notes: number; annotations: number }> = {};
        for (const note of notes as Array<{ pageId: string | null; cue: string; notes: string; summary: string }>) {
          if (!note.pageId) continue;
          if (!(note.cue?.trim() || note.notes?.trim() || note.summary?.trim())) continue;
          (stats[note.pageId] ??= { notes: 0, annotations: 0 }).notes += 1;
        }
        for (const ann of (annData.annotations ?? []) as Array<{ pageId: string | null }>) {
          if (!ann.pageId) continue;
          (stats[ann.pageId] ??= { notes: 0, annotations: 0 }).annotations += 1;
        }
        setPageStats(stats);
      } catch { /* Hub 统计失败静默，不阻塞浏览 */ }
    };
    load();
    window.addEventListener("reload_book_progress", load);
    return () => {
      cancelled = true;
      window.removeEventListener("reload_book_progress", load);
    };
  }, [viewMode, selectedBookDir]);

  useEffect(() => setActivePanel(null), [selectedBookDir, currentPage?.id]);
  useLayoutEffect(() => { activeFrameRef.current = null; }, [selectedBookDir, currentPage?.id]);
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (!isTrustedShareMessage(event, activeFrameRef.current?.contentWindow, currentPage?.id)) return;
      const data = event.data as { source?: string; type?: string; payload?: { quote?: string; body?: string; pageId?: string } };
      const payload = data.payload;
      if (!payload?.quote) return;
      setShareContent({
        quote: payload.quote.trim(),
        thought: payload.body || "",
        bookTitle: progress?.book.title || "未命名书籍",
        author: progress?.book.author || "",
        chapter: currentPage?.title || payload.pageId || "",
      });
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [currentPage?.id, currentPage?.title, progress?.book.author, progress?.book.title]);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = document.activeElement;
      if (target instanceof HTMLElement && (target.matches("input, textarea, select") || target.isContentEditable)) return;
      if (event.key === "Escape") {
        if (shareContent) return;
        if (activePanel) { setActivePanel(null); return; }
        if (viewMode === "page") closePage();
        return;
      }
      if (viewMode !== "page" || !currentPage || currentPage.type !== "chapter" || !progress) return;
      const chapters = progress.pages.filter(isSourceChapter);
      const index = chapters.findIndex((page) => page.id === currentPage.id);
      if (event.key === "ArrowLeft" && index > 0) navigateToPage(chapters[index - 1]);
      if (event.key === "ArrowRight" && index >= 0 && index < chapters.length - 1) navigateToPage(chapters[index + 1]);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activePanel, closePage, currentPage, navigateToPage, progress, setCurrentPage, setViewMode, shareContent, viewMode]);

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
          backLabel={pageReturnView === "readingnotes-detail" ? "返回笔记" : "返回工作台"}
          onBack={closePage}
          onPageChange={navigateToPage}
        />
        <div className="@container relative flex min-h-0 flex-1 overflow-hidden">
          <div className="flex min-w-0 flex-1 flex-col">
            <ReaderFrame
              iframeSrc={iframeSrc}
              pages={progress.pages}
              onBackToHub={closePage}
              onNavigatePage={navigateToPage}
              onActiveFrame={(iframe) => {
                activeFrameRef.current = iframe;
                applyFontSize(iframe, fontSizeRef.current);
              }}
            />
          </div>
          <ReadingUtilityRail
            activePanel={activePanel}
            pages={progress.pages}
            currentPage={currentPage}
            bookTitle={progress.book.title}
            bookAuthor={progress.book.author}
            theme={theme}
            onPanelChange={setActivePanel}
            onPageChange={navigateToPage}
            onThemeChange={setTheme}
            fontSize={fontSize}
            onFontSizeChange={setFontSize}
            annotationPanel={currentPage.type === "chapter" ? (
              <AnnotationDrawer key={`${selectedBookDir}:${currentPage.id}`}
                bookDir={selectedBookDir}
                pageId={currentPage.id}
                pages={progress.pages}
                getActiveFrame={() => activeFrameRef.current}
                onClose={() => setActivePanel(null)}
                onOpenAnnotation={(annotation) => {
                  const page = progress.pages.find((p) => p.id === annotation.pageId);
                  if (!page) return;
                  (window as unknown as { __rpPendingScroll?: string }).__rpPendingScroll = annotation.id;
                  navigateToPage(page);
                }}
              />
            ) : (
              <aside aria-label="标注面板" className="p-4 text-sm text-stone-500">伴读页暂无章节标注。</aside>
            )}
          />
        </div>
        {shareContent && <ShareComposer key={`${currentPage.id}:${shareContent.quote}`} open content={shareContent} onClose={closeShareComposer} />}
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
    openReadingPage(page, "hub");
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
            <ChapterTimeline pages={progress.pages} onPageClick={openPage} pageStats={pageStats} />
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
