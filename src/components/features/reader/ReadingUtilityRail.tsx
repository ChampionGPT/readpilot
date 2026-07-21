/**
 * input: active reader panel, chapter pages, current page, theme, and parent callbacks
 * output: Right-side reading utility rail plus a persistent, accessibility-isolated auxiliary panel shell
 * pos: ReaderApp page-mode utility navigation beside the reading canvas
 */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, FileText, Highlighter, ListTree, Search, Type, X } from "lucide-react";
import type { ThemeMode } from "@/store/useBookStore";
import type { ProgressPage } from "@/types/progress-data";

export type ReadingPanel = "toc" | "annotations" | "typography";

interface Props {
  activePanel: ReadingPanel | null;
  pages: ProgressPage[];
  currentPage: ProgressPage;
  bookTitle: string;
  bookAuthor: string;
  theme: ThemeMode;
  onPanelChange: (panel: ReadingPanel | null) => void;
  onPageChange: (page: ProgressPage) => void;
  onThemeChange: (theme: ThemeMode) => void;
  /** 正文字号（px）；null = 跟随主题默认 */
  fontSize: number | null;
  onFontSizeChange: (size: number | null) => void;
  annotationPanel: React.ReactNode;
}

const THEMES: { value: ThemeMode; label: string; description: string }[] = [
  { value: "classic", label: "书页", description: "温暖纸张与舒展排版" },
  { value: "modern", label: "清爽", description: "干净明快的现代阅读" },
  { value: "magazine", label: "杂志", description: "更鲜明的编辑式层次" },
];

const TOOLS = [
  { panel: "toc" as const, label: "目录", icon: ListTree },
  { panel: "annotations" as const, label: "标注", icon: Highlighter },
  { panel: "typography" as const, label: "排版", icon: Type },
];

const FONT_SIZE_MIN = 15;
const FONT_SIZE_MAX = 28;
const FONT_SIZE_DEFAULT = 19;

function isSourceChapter(page: ProgressPage): boolean {
  return page.type === "chapter" && /^chap-\d+$/i.test(page.id);
}

export function ReadingUtilityRail({ activePanel, pages, currentPage, bookTitle, bookAuthor, theme, onPanelChange, onPageChange, onThemeChange, fontSize, onFontSizeChange, annotationPanel }: Props) {
  const chapters = pages.filter(isSourceChapter);
  const [query, setQuery] = useState("");
  const [renderedPanel, setRenderedPanel] = useState<ReadingPanel | null>(activePanel);
  const unmountTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const triggerRefs = useRef<Partial<Record<ReadingPanel, HTMLButtonElement>>>({});
  const previousPanelRef = useRef<ReadingPanel | null>(null);
  const visibleChapters = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return normalized ? chapters.filter((chapter) => chapter.title.toLocaleLowerCase().includes(normalized)) : chapters;
  }, [chapters, query]);
  const relatedPages = currentPage.type === "chapter"
    ? pages.filter((page) => page.type !== "chapter" && page.relatedChapters.includes(currentPage.title))
    : currentPage.relatedChapters.map((title) => chapters.find((chapter) => chapter.title === title)).filter((page): page is ProgressPage => Boolean(page));

  useEffect(() => {
    if (activePanel) {
      previousPanelRef.current = activePanel;
      closeRef.current?.focus();
    } else if (previousPanelRef.current) {
      triggerRefs.current[previousPanelRef.current]?.focus();
    }
  }, [activePanel]);

  useEffect(() => {
    if (unmountTimerRef.current) clearTimeout(unmountTimerRef.current);
    if (activePanel) {
      setRenderedPanel(activePanel);
      return;
    }
    unmountTimerRef.current = setTimeout(() => {
      setRenderedPanel(null);
      unmountTimerRef.current = null;
    }, 200);
    return () => {
      if (unmountTimerRef.current) clearTimeout(unmountTimerRef.current);
    };
  }, [activePanel]);

  const panelHeader = (title: string) => (
    <div className="flex items-center justify-between border-b border-stone-200/80 px-6 py-4">
      <h2 className="text-base font-semibold text-stone-900">{title}</h2>
      <button ref={closeRef} type="button" aria-label={`关闭${title}面板`} onClick={() => onPanelChange(null)} className="flex h-9 w-9 items-center justify-center rounded-full text-stone-400 hover:bg-stone-100 hover:text-stone-700 focus-visible:outline-2 focus-visible:outline-[#D94F30]"><X size={17} /></button>
    </div>
  );

  return (
    <>
        <div
          data-testid="reading-panel-shell"
          aria-hidden={activePanel ? "false" : "true"}
          inert={!activePanel}
          className={`absolute inset-y-0 right-0 z-20 overflow-hidden bg-[#FFFDF9]/98 transition-[width,opacity,transform] duration-200 ease-out @min-[900px]:static @min-[900px]:shrink-0 ${activePanel ? "w-[min(33.5rem,calc(100cqw-1rem))] translate-x-0 border-l border-stone-200/80 opacity-100 shadow-[-16px_0_40px_rgba(82,65,49,0.12)] @min-[900px]:w-[33.5rem]" : "pointer-events-none w-0 translate-x-4 opacity-0 @min-[900px]:w-0"}`}
        >
          {renderedPanel === "toc" && (
            <aside aria-label="目录面板" className="flex h-full w-full flex-col">
              <div className="space-y-4 border-b border-stone-200/80 px-6 pb-5 pt-6">
                <div className="flex items-center gap-2"><label className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-xl border border-stone-200 bg-white/80 px-3 text-stone-400 shadow-sm transition-colors duration-200 focus-within:border-[#D94F30]/40 focus-within:ring-2 focus-within:ring-[#D94F30]/10"><Search size={17} /><input type="search" aria-label="搜索章节" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索章节" className="min-w-0 flex-1 bg-transparent text-sm text-stone-800 outline-none placeholder:text-stone-400" /></label><button ref={closeRef} type="button" aria-label="关闭目录面板" onClick={() => onPanelChange(null)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-stone-400 hover:bg-stone-100 hover:text-stone-700 focus-visible:outline-2 focus-visible:outline-[#D94F30]"><X size={17} /></button></div>
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-10 shrink-0 items-center justify-center rounded-lg bg-[#D94F30]/10 text-[#B3402A]"><BookOpen size={20} /></div>
                  <div className="min-w-0">
                    <h2 className="truncate text-base font-semibold text-stone-900">{bookTitle || "未命名书籍"}</h2>
                    <p className="mt-0.5 truncate text-xs text-stone-500">{bookAuthor || "未知作者"}</p>
                  </div>
                </div>
              </div>
              <div className="hide-scrollbar flex-1 overflow-y-auto px-3 py-2">
                {visibleChapters.map((chapter) => (
                  <button key={chapter.id} type="button" aria-current={chapter.id === currentPage.id ? "page" : undefined} onClick={() => onPageChange(chapter)} className={`flex min-h-14 w-full items-center rounded-lg border-b border-stone-200/70 px-4 text-left text-sm transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#D94F30] ${chapter.id === currentPage.id ? "bg-[#D94F30]/9 font-semibold text-[#A83B27]" : "text-stone-700 hover:bg-stone-100/80 hover:text-stone-950"}`}>
                    <span className="line-clamp-2">{chapter.title}</span>
                  </button>
                ))}
                {visibleChapters.length === 0 && <p className="px-4 py-10 text-center text-sm text-stone-400">没有匹配的章节</p>}
                {relatedPages.length > 0 && <div className="mt-4 border-t border-stone-200/80 pt-3"><h3 className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-stone-400">{currentPage.type === "chapter" ? "相关解读" : "回到原文"}</h3>{relatedPages.map((page) => <button key={page.id} type="button" onClick={() => onPageChange(page)} className="flex min-h-12 w-full items-center gap-3 rounded-lg px-4 text-left text-sm text-stone-700 hover:bg-stone-100"><FileText size={15} className="text-[#B3402A]" /><span>{page.title}</span></button>)}</div>}
              </div>
            </aside>
          )}
          {renderedPanel === "annotations" && <div className="h-full w-full">{annotationPanel}</div>}
          {renderedPanel === "typography" && (
            <aside aria-label="排版面板" className="flex h-full w-full flex-col">
              {panelHeader("排版")}
              <div className="space-y-5 p-3">
                <section>
                  <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-stone-400">主题</h3>
                  <div className="space-y-2">
                    {THEMES.map((option) => (
                      <button key={option.value} type="button" aria-pressed={theme === option.value} onClick={() => onThemeChange(option.value)} className={`w-full rounded-lg border px-3 py-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D94F30] ${theme === option.value ? "border-[#D94F30]/40 bg-[#D94F30]/5 text-[#B3402A]" : "border-stone-200 bg-white text-stone-700 hover:border-stone-300"}`}>
                        <span className="block text-sm font-semibold">{option.label}</span>
                        <span className="mt-0.5 block text-xs text-stone-500">{option.description}</span>
                      </button>
                    ))}
                  </div>
                </section>
                <section>
                  <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-stone-400">正文字号</h3>
                  <div className="rounded-lg border border-stone-200 bg-white px-3 py-3">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        aria-label="减小字号"
                        disabled={(fontSize ?? FONT_SIZE_DEFAULT) <= FONT_SIZE_MIN}
                        onClick={() => onFontSizeChange(Math.max(FONT_SIZE_MIN, (fontSize ?? FONT_SIZE_DEFAULT) - 1))}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-stone-200 text-sm font-semibold text-stone-600 hover:border-stone-300 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-[#D94F30]"
                      >
                        A-
                      </button>
                      <input
                        type="range"
                        aria-label="正文字号"
                        min={FONT_SIZE_MIN}
                        max={FONT_SIZE_MAX}
                        step={1}
                        value={fontSize ?? FONT_SIZE_DEFAULT}
                        onChange={(event) => onFontSizeChange(Number(event.target.value))}
                        className="min-w-0 flex-1 accent-[#D94F30]"
                      />
                      <button
                        type="button"
                        aria-label="增大字号"
                        disabled={(fontSize ?? FONT_SIZE_DEFAULT) >= FONT_SIZE_MAX}
                        onClick={() => onFontSizeChange(Math.min(FONT_SIZE_MAX, (fontSize ?? FONT_SIZE_DEFAULT) + 1))}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-stone-200 text-base font-semibold text-stone-600 hover:border-stone-300 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-[#D94F30]"
                      >
                        A+
                      </button>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs text-stone-500">
                      <span>{fontSize == null ? "跟随主题默认" : `${fontSize}px`}</span>
                      {fontSize != null && (
                        <button type="button" onClick={() => onFontSizeChange(null)} className="font-semibold text-[#B3402A] hover:underline focus-visible:outline-2 focus-visible:outline-[#D94F30]">
                          恢复默认
                        </button>
                      )}
                    </div>
                  </div>
                </section>
              </div>
            </aside>
          )}
        </div>
      <div
        role="toolbar"
        aria-label="阅读工具"
        className={`absolute top-1/2 z-30 flex -translate-y-1/2 flex-col items-center gap-3.5 transition-[right] duration-200 ease-out ${
          activePanel ? "right-[calc(min(33.5rem,100cqw-1rem)+0.75rem)]" : "right-4"
        }`}
      >
        {TOOLS.map(({ panel, label, icon: Icon }) => {
          const selected = activePanel === panel;
          return (
            <button ref={(node) => { triggerRefs.current[panel] = node ?? undefined; }} key={panel} type="button" title={label} aria-label={label} aria-pressed={selected} onClick={() => onPanelChange(selected ? null : panel)} className={`flex h-11 w-11 items-center justify-center rounded-full border transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[#D94F30] ${selected ? "border-[#D94F30]/25 bg-[#D94F30] text-white shadow-[0_8px_22px_rgba(217,79,48,0.24)]" : "border-stone-200/80 bg-[#FFFDF9]/88 text-stone-500 shadow-[0_5px_18px_rgba(82,65,49,0.10)] backdrop-blur-sm hover:-translate-y-0.5 hover:border-stone-300 hover:bg-white hover:text-stone-800"}`}>
              <Icon size={18} />
            </button>
          );
        })}
      </div>
    </>
  );
}
