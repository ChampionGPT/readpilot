/**
 * input: children, Sidebar, ChatPanel components, useBookStore
 * output: 包含左中右三栏的核心全局布局应用容器
 * pos: 全局布局入口骨架，处理整体的主题和三栏状态
 * 
 * 架构说明：接管所有子路由的容器，固化左侧书架(Library)和右侧智能对话(Chat)，
 * 只允许中间的 children 区块随路由或书目切换无缝平滑重载。一旦所属文件夹有变化，请更新我。
 */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BookOpen, Library, MessageSquare, NotebookPen, PanelLeft, PanelLeftOpen } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BookSidebar } from "@/components/features/sidebar/BookSidebar";
import { ChatPanel } from "@/components/features/chat/ChatPanel";
import { useBookStore, type ViewMode } from "@/store/useBookStore";

// 右侧聊天栏宽度边界 & 持久化 key
const CHAT_MIN = 280;
const CHAT_MAX = 600;
const CHAT_DEFAULT = 350;
const CHAT_WIDTH_KEY = "readpilot.chat.width";

function getStoredChatWidth() {
  if (typeof window === "undefined") return CHAT_DEFAULT;
  const saved = window.localStorage.getItem(CHAT_WIDTH_KEY);
  if (!saved) return CHAT_DEFAULT;
  const width = parseInt(saved, 10);
  return !Number.isNaN(width) && width >= CHAT_MIN && width <= CHAT_MAX
    ? width
    : CHAT_DEFAULT;
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [readerSidebarExpanded, setReaderSidebarExpanded] = useState(false);
  const [chatOpen, setChatOpen] = useState(true);
  const [chatWidth, setChatWidth] = useState(getStoredChatWidth);
  const [isDraggingChat, setIsDraggingChat] = useState(false);
  const chatWidthRef = useRef(chatWidth);

  useEffect(() => {
    chatWidthRef.current = chatWidth;
  }, [chatWidth]);

  // 原生 mouse 事件拖拽 — rAF 节流避免 mousemove 暴击 setState
  const startChatDrag = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingChat(true);
    const startX = e.clientX;
    const startWidth = chatWidthRef.current;
    let pendingWidth = startWidth;
    let rafId = 0;

    const flush = () => {
      rafId = 0;
      setChatWidth(pendingWidth);
    };

    const onMove = (ev: MouseEvent) => {
      // 手柄位于 aside 左缘，鼠标左移则 aside 变宽
      const next = Math.min(CHAT_MAX, Math.max(CHAT_MIN, startWidth + (startX - ev.clientX)));
      pendingWidth = next;
      if (!rafId) rafId = requestAnimationFrame(flush);
    };

    const onUp = () => {
      setIsDraggingChat(false);
      if (rafId) cancelAnimationFrame(rafId);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      setChatWidth(pendingWidth);
      window.localStorage.setItem(CHAT_WIDTH_KEY, String(pendingWidth));
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  // 细粒度 selector — 避免 store 任一字段变化都重渲染整个三栏
  const books = useBookStore((s) => s.books);
  const selectedBookDir = useBookStore((s) => s.selectedBookDir);
  const progress = useBookStore((s) => s.progress);
  const currentPage = useBookStore((s) => s.currentPage);
  const viewMode = useBookStore((s) => s.viewMode);
  const theme = useBookStore((s) => s.theme);
  const setBooks = useBookStore((s) => s.setBooks);
  const setSelectedBookDir = useBookStore((s) => s.setSelectedBookDir);
  const setProgress = useBookStore((s) => s.setProgress);
  const setViewMode = useBookStore((s) => s.setViewMode);
  const setCurrentPage = useBookStore((s) => s.setCurrentPage);

  // Fetch available books on mount
  useEffect(() => {
    fetch("/api/books")
      .then((r) => r.json())
      .then((data) => {
        setBooks(data);
      })
      .catch(console.error);
  }, [setBooks]);

  // Fetch progress when book changes (pure data fetch — no navigation side-effects)
  useEffect(() => {
    if (!selectedBookDir) {
      setProgress(null);
      return;
    }

    const controller = new AbortController();
    let reloadTimer: number | null = null;

    const fetchProgress = () => {
      fetch(`/api/books/${encodeURIComponent(selectedBookDir)}/progress`, { signal: controller.signal })
        .then(async (r) => {
          if (!r.ok) {
            console.warn(`Book directory ${selectedBookDir} not found, resetting selection.`);
            setSelectedBookDir(null);
            setProgress(null);
            setViewMode("library");
            return;
          }
          const data = await r.json();
          setProgress(data);
        })
        .catch((err) => {
          if (err?.name !== "AbortError") console.error(err);
        });
    };

    fetchProgress();

    const scheduleProgressRefresh = () => {
      if (reloadTimer !== null) window.clearTimeout(reloadTimer);
      reloadTimer = window.setTimeout(() => {
        reloadTimer = null;
        fetchProgress();
      }, 350);
    };

    // Allow silent refresh via global event (e.g. Agent generated pages)
    window.addEventListener('reload_book_progress', scheduleProgressRefresh);
    return () => {
      if (reloadTimer !== null) window.clearTimeout(reloadTimer);
      controller.abort();
      window.removeEventListener('reload_book_progress', scheduleProgressRefresh);
    };
  }, [selectedBookDir, setProgress, setSelectedBookDir, setViewMode]);

  const isReadingMode = viewMode === "page";
  const selectedBook = books.find(b => b.dir === selectedBookDir);
  const sidebarWidthClass = isReadingMode
    ? readerSidebarExpanded ? "w-[280px]" : "w-14"
    : sidebarOpen ? "w-[280px]" : "w-0 overflow-hidden border-none";

  const goLibrary = () => {
    setViewMode("library");
    setSelectedBookDir(null);
    setCurrentPage(null);
  };

  const goHub = () => {
    if (!selectedBookDir) return;
    setViewMode("hub");
    setCurrentPage(null);
  };

  const goChapterNotes = () => {
    if (!selectedBookDir) return;
    setViewMode("readingnotes-detail");
  };

  const chatContext = {
    viewMode,
    bookId: selectedBook?.id,
    bookDir: selectedBookDir,
    bookTitle: progress?.book?.title || selectedBook?.title || null,
    pageId: currentPage?.id ?? null,
    pageTitle: currentPage?.title ?? null,
    pageType: currentPage?.type ?? null,
  };

  return (
    <div className={`h-screen w-screen overflow-hidden flex bg-surface text-on-surface theme-${theme}`}>
      {/* Left: Library Sidebar */}
      <aside
        className={`h-full flex flex-col shrink-0 bg-surface-container border-r border-outline-variant/20 transition-[width] duration-200 ease-out z-40 ${sidebarWidthClass}`}
      >
        {isReadingMode && !readerSidebarExpanded ? (
          <ReadingIconRail
            activeView={viewMode}
            bookTitle={progress?.book?.title || selectedBook?.title || ""}
            onExpand={() => setReaderSidebarExpanded(true)}
            onLibrary={goLibrary}
            onHub={goHub}
            onNotes={goChapterNotes}
            hasBook={!!selectedBookDir}
          />
        ) : (
          <BookSidebar />
        )}
      </aside>

      {/* Center: Reading Content */}
      <main className="flex-1 h-full min-w-0 flex flex-col relative bg-surface">
        <header className="z-10 flex h-16 w-full shrink-0 items-center justify-between border-b border-outline-variant/10 bg-surface/85 px-6 backdrop-blur-md">
          <div className="flex items-center gap-6">
            <button
              onClick={() => {
                if (isReadingMode) {
                  setReaderSidebarExpanded((v) => !v);
                } else {
                  setSidebarOpen(!sidebarOpen);
                }
              }}
              aria-pressed={isReadingMode ? readerSidebarExpanded : sidebarOpen}
              title={isReadingMode ? (readerSidebarExpanded ? "收起为阅读栏" : "展开书架") : (sidebarOpen ? "收起书架" : "展开书架")}
              className="p-2 hover:bg-surface-container rounded-lg transition-colors text-on-surface-variant flex items-center justify-center cursor-pointer"
            >
              <PanelLeft className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
          <div className="flex items-center gap-2 text-on-surface-variant">
            <button
               onClick={() => setChatOpen(!chatOpen)}
               aria-pressed={chatOpen}
               title={chatOpen ? "收起对话" : "展开对话"}
               className="p-2 hover:bg-surface-container rounded-lg transition-colors flex items-center justify-center cursor-pointer"
            >
              <MessageSquare className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </header>

        {viewMode === "page" ? (
          <section className="flex-1 min-h-0 overflow-hidden">
            {children}
          </section>
        ) : (
          <ScrollArea className="flex-1 min-h-0 readpilot-scroll pt-4">
            {children}
          </ScrollArea>
        )}
      </main>

      {/* Right: AI ChatPanel */}
      <aside
        className={`h-full flex flex-col shrink-0 bg-surface-container-low border-l border-outline-variant/20 z-30 relative ${
          !isDraggingChat ? "transition-[width] duration-200 ease-out" : ""
        } ${chatOpen ? "" : "w-0 overflow-hidden border-none"}`}
        style={chatOpen ? { width: chatWidth } : undefined}
      >
        {chatOpen && (
          <div
            onMouseDown={startChatDrag}
            role="separator"
            aria-orientation="vertical"
            aria-label="拖拽调整对话栏宽度"
            className={`absolute left-0 top-0 bottom-0 w-1 cursor-col-resize z-40 group hover:bg-[#D94F30]/20 ${
              isDraggingChat ? "bg-[#D94F30]/40" : ""
            } transition-colors`}
          >
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-12 bg-stone-300/60 group-hover:bg-[#D94F30] rounded-r transition-colors" />
          </div>
        )}
        <ChatPanel
          contextMeta={chatContext}
          bookTitle={progress?.book?.title || "Library"}
          bookId={books.find(b => b.dir === selectedBookDir)?.id}
        />
      </aside>
    </div>
  );
}

function ReadingIconRail({
  activeView,
  bookTitle,
  hasBook,
  onExpand,
  onLibrary,
  onHub,
  onNotes,
}: {
  activeView: ViewMode;
  bookTitle: string;
  hasBook: boolean;
  onExpand: () => void;
  onLibrary: () => void;
  onHub: () => void;
  onNotes: () => void;
}) {
  const iconButton = "flex h-10 w-10 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-white/70 hover:text-[#D94F30] disabled:cursor-not-allowed disabled:opacity-35";

  return (
    <div className="flex h-full w-14 flex-col items-center bg-[#f0ede9] py-3">
      <button className={iconButton} onClick={onExpand} title={bookTitle ? `展开书架：${bookTitle}` : "展开书架"}>
        <PanelLeftOpen className="h-5 w-5" aria-hidden="true" />
      </button>
      <div className="my-3 h-px w-8 bg-stone-300/70" />
      <nav className="flex flex-1 flex-col items-center gap-2">
        <button className={iconButton} onClick={onLibrary} title="书库">
          <Library className="h-5 w-5" aria-hidden="true" />
        </button>
        <button
          className={`${iconButton} ${activeView === "hub" ? "bg-white text-[#D94F30] shadow-sm" : ""}`}
          onClick={onHub}
          disabled={!hasBook}
          title="当前书 Hub"
        >
          <BookOpen className="h-5 w-5" aria-hidden="true" />
        </button>
        <button
          className={`${iconButton} ${activeView === "readingnotes-detail" ? "bg-white text-[#D94F30] shadow-sm" : ""}`}
          onClick={onNotes}
          disabled={!hasBook}
          title="当前章节笔记"
        >
          <NotebookPen className="h-5 w-5" aria-hidden="true" />
        </button>
      </nav>
      <div className="mb-1 h-2 w-2 rounded-full bg-[#D94F30]" title="阅读模式" />
    </div>
  );
}
