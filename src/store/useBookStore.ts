/**
 * input: zustand
 * output: useBookStore - 全局书籍与进度状态机
 * pos: 全局状态管理 — 所有 UI 面板的唯一真相源
 *
 * 架构说明：
 *   viewMode → 中央面板的唯一驱动（library/collections/readingnotes/hub/page/articles）
 *   selectedBookDir → 纯数据状态，无副作用
 *   sidebarNav → 仅控制左侧栏面板切换
 *   selectBook(dir) → 显式组合操作（选书 + 切视图 + 切侧边栏）
 *
 * 一旦更新状态结构，请更新我。
 */
import { create } from "zustand";
import type { ProgressData, ProgressPage } from "@/types/progress-data";

export type BookInfo = { id: string; title: string; dir: string };

export type ViewMode =
  | "library"            // 全局书架首页
  | "collections"        // 按 genre 分组浏览
  | "readingnotes"       // 按书聚合笔记概览
  | "readingnotes-detail" // 某本书的笔记编辑
  | "hub"                // 某本书的 Dashboard
  | "page"               // iframe 阅读伴读页面
  | "articles"           // 文章列表（Phase 2）
  | "article-read";      // 文章阅读（Phase 2）

export type ThemeMode = "classic" | "modern" | "magazine";
export type SidebarNavMode = "bookshelf" | "articles" | "analysis";

interface BookState {
  books: BookInfo[];
  selectedBookDir: string | null;
  progress: ProgressData | null;
  viewMode: ViewMode;
  theme: ThemeMode;
  sidebarNav: SidebarNavMode;
  isImportOpen: boolean;
  isPageInputOpen: boolean;
  currentSessionId: string | null;
  currentPage: ProgressPage | null;
  currentArticleId: string | null;
  corruptError: {
    dir: string;
    line: number;
    col: number;
    message: string;
    rawSnippet: string;
  } | null;

  // Actions
  setBooks: (books: BookInfo[]) => void;
  setSelectedBookDir: (dir: string | null) => void;  // 纯数据，无副作用
  selectBook: (dir: string) => void;                  // 组合操作：选书 + hub + content
  setProgress: (progress: ProgressData | null) => void;
  setViewMode: (mode: ViewMode) => void;
  setTheme: (theme: ThemeMode) => void;
  setSidebarNav: (nav: SidebarNavMode) => void;
  setIsImportOpen: (open: boolean) => void;
  setIsPageInputOpen: (open: boolean) => void;
  setCurrentSessionId: (sessionId: string | null) => void;
  setCurrentPage: (page: ProgressPage | null) => void;
  openPage: (page: ProgressPage) => void;
  setCurrentArticleId: (id: string | null) => void;
  openArticle: (id: string) => void;                  // 组合操作：选文章 + article-read
  setCorruptError: (e: BookState['corruptError']) => void;
  removeBookOptimistic: (dir: string) => void;
  resetContentState: () => void;
}

export const useBookStore = create<BookState>((set) => ({
  books: [],
  selectedBookDir: null,
  progress: null,
  viewMode: "library",
  theme: "classic",
  sidebarNav: "bookshelf",
  isImportOpen: false,
  isPageInputOpen: false,
  currentSessionId: null,
  currentPage: null,
  currentArticleId: null,
  corruptError: null,

  setBooks: (books) => set({ books }),

  // 纯数据操作 — 不触发导航副作用
  setSelectedBookDir: (dir) => set({ selectedBookDir: dir }),

  // 显式组合操作 — 选中书并跳转到 Hub Dashboard
  selectBook: (dir) => set({
    selectedBookDir: dir,
    viewMode: "hub",
    currentPage: null,
  }),

  setProgress: (progress) => set((state: BookState) => {
    if (!progress) return { progress: null };

    const currentPage = state.currentPage
      ? progress.pages.find((page) => page.id === state.currentPage?.id)
        ?? progress.pages.find((page) => page.file === state.currentPage?.file)
        ?? state.currentPage
      : state.currentPage;

    return { progress, currentPage };
  }),
  setViewMode: (mode) => set({ viewMode: mode }),
  setTheme: (theme) => set({ theme }),
  setSidebarNav: (nav) => set((state: BookState) => {
    // Strict Guard: Prevent access to analysis without an active book
    if (nav === "analysis" && !state.selectedBookDir) {
      return {};
    }
    return { sidebarNav: nav };
  }),
  setIsImportOpen: (open) => set({ isImportOpen: open }),
  setIsPageInputOpen: (open) => set({ isPageInputOpen: open }),
  setCurrentSessionId: (sessionId) => set({ currentSessionId: sessionId }),
  setCurrentPage: (page) => set({ currentPage: page }),
  openPage: (page) => set({ currentPage: page, viewMode: "page" }),
  setCurrentArticleId: (id) => set({ currentArticleId: id }),

  setCorruptError: (e) => set({ corruptError: e }),

  // 乐观删除：从书架移除；如删除的是当前选中书，重置上下文回 library
  removeBookOptimistic: (dir: string) => set((state: BookState) => {
    const next: Partial<BookState> = { books: state.books.filter((b) => b.dir !== dir) };
    if (state.selectedBookDir === dir) {
      next.selectedBookDir = null;
      next.progress = null;
      next.viewMode = "library";
      next.currentPage = null;
      next.corruptError = null;
      next.currentSessionId = null;
    }
    return next;
  }),

  // 组合操作 — 选中文章并跳到阅读视图
  openArticle: (id) => set({
    currentArticleId: id,
    viewMode: "article-read",
    sidebarNav: "articles",
  }),

  resetContentState: () => set({ viewMode: "hub", currentPage: null, currentArticleId: null }),
}));
