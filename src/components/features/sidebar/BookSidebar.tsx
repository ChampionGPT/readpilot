/**
 * input: useBookStore, ImportModal, BookshelfPanel, AnalysisPanel, SessionListPanel
 * output: 左侧栏导航枢纽 — 资料库 / 当前书 / 文章输入三组入口 + 动态面板
 * pos: 三栏布局左栏，负责全局导航、当前书工作区入口和导入操作
 *
 * 导航原则：
 * - 资料库：跨书管理视图（书库、笔记、合集）
 * - 当前书：只有选中书后出现（工作台、洞察、对话）
 * - 输入：外部内容进入 ReadPilot（文章、导入文章）
 *
 * 声明：一旦我被更新，务必更新我的开头注释以及所属文件夹的 md。
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  Library,
  MessageSquare,
  NotebookPen,
  PanelTop,
  Plus,
  ScrollText,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useBookStore } from "@/store/useBookStore";
import { ImportModal } from "@/components/features/library/ImportModal";
import { PageInputModal } from "@/components/features/library/PageInputModal";
import { BookshelfPanel } from "./BookshelfPanel";
import { AnalysisPanel } from "./AnalysisPanel";
import { SessionListPanel } from "./SessionListPanel";
import { ArticlesPanel } from "@/components/features/articles/ArticlesPanel";
import { ArticleImportModal } from "@/components/features/articles/ArticleImportModal";

function ProgressRing({ percent, size = 32 }: { percent: number; size?: number }) {
  const r = (size - 4) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (percent / 100) * c;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg className="-rotate-90" width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="transparent" stroke="#E5DFD6" strokeWidth={2} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="transparent"
          stroke="#D94F30"
          strokeWidth={2}
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-[stroke-dashoffset] duration-500 ease-out"
        />
      </svg>
      <span className="absolute text-[7px] font-bold text-[#2C2A28]">{percent}%</span>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 pb-1 pt-3 text-[10px] font-bold uppercase tracking-[0.18em] text-[#8A8177]">
      {children}
    </div>
  );
}

function NavButton({
  icon,
  label,
  active,
  disabled,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={`flex h-10 w-full items-center gap-3 rounded-md px-3 text-sm font-semibold transition-colors ${
        active
          ? "bg-white text-[#D94F30] shadow-sm"
          : disabled
          ? "cursor-not-allowed text-stone-300"
          : "text-stone-600 hover:bg-white/60 hover:text-stone-900"
      }`}
    >
      <span className="flex h-5 w-5 shrink-0 items-center justify-center">{icon}</span>
      <span className="truncate">{label}</span>
    </button>
  );
}

function CurrentBookPreview() {
  const router = useRouter();
  const { selectedBookDir, progress, books, setViewMode, setCurrentPage, setIsPageInputOpen } = useBookStore();
  if (!selectedBookDir || !progress) return null;

  const book = books.find((b) => b.dir === selectedBookDir);
  if (!book) return null;

  const chapters = progress.pages.filter((page) => page.type === "chapter");
  const completed = chapters.filter((page) => page.status === "completed").length;
  const percent = chapters.length > 0 ? Math.round((completed / chapters.length) * 100) : 0;

  const handleContinueReading = () => {
    const targetPage = chapters.find((p) => p.status === "in-progress") || chapters[0];
    if (targetPage) {
      router.push("/");
      setCurrentPage(targetPage);
      setViewMode("page");
    }
  };

  return (
    <div className="border-t border-stone-200/80 px-4 py-3">
      <span className="mb-2 block text-[9px] font-bold uppercase tracking-widest text-[#8A8177]">
        当前阅读
      </span>
      <button
        type="button"
        onClick={handleContinueReading}
        className="group flex w-full gap-3 rounded-md border border-[#D94F30]/20 bg-white/80 p-3 text-left transition-colors hover:border-[#D94F30]/40"
      >
        <div className="flex h-16 w-12 shrink-0 items-center justify-center rounded bg-gradient-to-br from-stone-500 to-stone-700 shadow-md">
          <span className="text-xl font-black text-white/30">{book.title.charAt(0)}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="line-clamp-1 text-xs font-bold text-[#2C2A28] transition-colors group-hover:text-[#D94F30]">{book.title}</p>
          <p className="mt-0.5 line-clamp-1 text-[10px] text-[#6B6560]">{progress.book.author || "未知作者"}</p>
          <div className="mt-2 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-stone-200">
              <div className="h-full rounded-full bg-[#D94F30]" style={{ width: `${percent}%` }} />
            </div>
            <ProgressRing percent={percent} size={26} />
          </div>
        </div>
      </button>
      <button
        type="button"
        onClick={() => setIsPageInputOpen(true)}
        className="mt-2 text-[11px] font-semibold text-[#D94F30] hover:underline"
      >
        设置页码进度
      </button>
    </div>
  );
}

export function BookSidebar() {
  const router = useRouter();
  const {
    selectedBookDir,
    sidebarNav,
    setSidebarNav,
    viewMode,
    setViewMode,
    isImportOpen,
    isPageInputOpen,
    setIsPageInputOpen,
    progress,
    books,
    setIsImportOpen,
    setSelectedBookDir,
    currentSessionId,
    setCurrentSessionId,
  } = useBookStore();

  const [showAiPanel, setShowAiPanel] = useState(false);
  const [isArticleImportOpen, setIsArticleImportOpen] = useState(false);
  const selectedBookId = books.find((b) => b.dir === selectedBookDir)?.id || "";
  const hasBook = Boolean(selectedBookDir && progress);

  const showBookshelf = () => {
    setShowAiPanel(false);
    setSidebarNav("bookshelf");
  };

  const showMainContent = () => {
    router.push("/");
  };

  const goLibrary = () => {
    showMainContent();
    showBookshelf();
    setViewMode("library");
    setSelectedBookDir(null);
  };

  const goReadingNotes = () => {
    showMainContent();
    showBookshelf();
    setViewMode("readingnotes");
  };

  const goArticles = () => {
    showMainContent();
    setShowAiPanel(false);
    setSidebarNav("articles");
    setViewMode("articles");
  };

  const goHub = () => {
    if (!hasBook) return;
    showMainContent();
    setShowAiPanel(false);
    setSidebarNav("analysis");
    setViewMode("hub");
  };

  const goInsights = () => {
    if (!hasBook) return;
    showMainContent();
    setShowAiPanel(false);
    setSidebarNav("analysis");
  };

  const goSessions = () => {
    if (!hasBook) return;
    showMainContent();
    setSidebarNav("bookshelf");
    setShowAiPanel(true);
  };

  return (
    <div className="flex h-full flex-col bg-[#f0ede9]">
      <div className="shrink-0 px-6 py-5">
        <h1
          className="cursor-pointer text-2xl font-serif italic leading-none text-primary transition-opacity hover:opacity-80"
          onClick={goLibrary}
        >
          ReadPilot
        </h1>
        <p className="mt-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-[#6B6560]">
          Reading Workspace
        </p>
      </div>

      <nav className="shrink-0 space-y-1 px-3 pb-2">
        <SectionLabel>资料库</SectionLabel>
        <NavButton
          icon={<Library size={17} />}
          label="书库"
          active={sidebarNav === "bookshelf" && !showAiPanel && viewMode === "library"}
          onClick={goLibrary}
        />
        <NavButton
          icon={<NotebookPen size={17} />}
          label="笔记"
          active={sidebarNav === "bookshelf" && !showAiPanel && (viewMode === "readingnotes" || viewMode === "readingnotes-detail")}
          onClick={goReadingNotes}
        />
        {hasBook && (
          <>
            <SectionLabel>当前书</SectionLabel>
            <NavButton
              icon={<PanelTop size={17} />}
              label="工作台"
              active={viewMode === "hub"}
              onClick={goHub}
            />
            <NavButton
              icon={<BarChart3 size={17} />}
              label="洞察"
              active={sidebarNav === "analysis" && viewMode !== "hub"}
              onClick={goInsights}
            />
            <NavButton
              icon={<MessageSquare size={17} />}
              label="对话"
              active={showAiPanel}
              onClick={goSessions}
            />
          </>
        )}

        <SectionLabel>输入</SectionLabel>
        <NavButton
          icon={<ScrollText size={17} />}
          label="文章"
          active={sidebarNav === "articles" && viewMode !== "article-read"}
          onClick={goArticles}
        />
        <NavButton
          icon={<Plus size={17} />}
          label="导入文章"
          onClick={() => setIsArticleImportOpen(true)}
        />
      </nav>

      <ScrollArea className="min-h-0 flex-1 px-4 readpilot-scroll">
        {showAiPanel && hasBook && selectedBookId && (
          <SessionListPanel
            bookId={selectedBookId}
            currentSessionId={currentSessionId}
            onSelectSession={(sessionId) => setCurrentSessionId(sessionId)}
          />
        )}
        {!showAiPanel && sidebarNav === "bookshelf" && <BookshelfPanel />}
        {!showAiPanel && sidebarNav === "articles" && <ArticlesPanel />}
        {!showAiPanel && sidebarNav === "analysis" && <AnalysisPanel />}
      </ScrollArea>

      <CurrentBookPreview />

      <div className="shrink-0 border-t border-stone-200 p-4">
        <button
          type="button"
          onClick={() => setIsImportOpen(true)}
          className="flex w-full items-center justify-center gap-2 rounded-md bg-[#D94F30] py-2.5 text-sm font-bold text-white shadow-md shadow-[#D94F30]/20 transition-transform active:scale-[0.98]"
        >
          <Plus size={17} />
          <span>导入书籍</span>
        </button>
      </div>

      <ImportModal isOpen={isImportOpen} onClose={() => setIsImportOpen(false)} />
      {selectedBookDir && (
        <PageInputModal
          isOpen={isPageInputOpen}
          bookDir={selectedBookDir}
          bookTitle={progress?.book?.title || books.find((b) => b.dir === selectedBookDir)?.title || ''}
          initialTotalPages={progress?.book?.totalPages ?? null}
          initialCurrentPage={progress?.book?.currentPage ?? null}
          onClose={() => setIsPageInputOpen(false)}
          onSave={() => {}}
        />
      )}
      <ArticleImportModal
        isOpen={isArticleImportOpen}
        onClose={() => setIsArticleImportOpen(false)}
        onSuccess={() => window.dispatchEvent(new Event("refresh_articles"))}
      />
    </div>
  );
}
