/**
 * input: useBookStore, notes API, annotations API, optional WeRead bindings
 * output: Chapter-first notes workspace with locked flush-before-organize flow, atomic annotation inbox, and visible mutation errors
 * pos: Center panel view for viewMode="readingnotes-detail".
 */
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Circle,
  FileDown,
  FileText,
  Layers3,
  NotebookPen,
  Plus,
} from "lucide-react";
import { useBookStore } from "@/store/useBookStore";
import { useWereadStore } from "@/store/useWereadStore";
import type { Annotation, BookNote, CornellSection } from "@/types/progress";
import type { ProgressPage } from "@/types/progress-data";
import { NoteEditor, type NoteEditorHandle } from "./NoteEditor";
import { PAGE_TYPE_COLORS } from "./note-constants";
import { AnnotationInbox } from "./AnnotationInbox";

function getStatusMeta(status: ProgressPage["status"]) {
  if (status === "completed") {
    return { icon: CheckCircle2, label: "已读", className: "text-emerald-700 bg-emerald-50 border-emerald-100" };
  }
  if (status === "in-progress") {
    return { icon: BookOpen, label: "阅读中", className: "text-[#D94F30] bg-[#D94F30]/10 border-[#D94F30]/20" };
  }
  return { icon: Circle, label: "未读", className: "text-stone-500 bg-stone-100 border-stone-200" };
}

function notePreview(note: BookNote) {
  const text = note.summary || note.cue || note.notes;
  return text.replace(/\s+/g, " ").trim().slice(0, 42) || "空白笔记";
}

function pageLabel(page: ProgressPage) {
  return PAGE_TYPE_COLORS[page.type]?.label || page.type;
}

export function BookNotesView() {
  const {
    selectedBookDir,
    progress,
    books,
    setViewMode,
    openPage: openReadingPage,
  } = useBookStore();
  const wereadBookId = useWereadStore((state) => (selectedBookDir ? state.byLocalDir[selectedBookDir] : undefined));
  const wereadSummary = useWereadStore((state) => (wereadBookId ? state.byBookId[wereadBookId] : undefined));
  const fetchSummary = useWereadStore((state) => state.fetchSummary);

  const [notes, setNotes] = useState<BookNote[]>([]);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [activePageId, setActivePageId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [creatingPageId, setCreatingPageId] = useState<string | null>(null);
  const [asideTab, setAsideTab] = useState<"inbox" | "related">("inbox");
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const noteEditorRef = useRef<NoteEditorHandle>(null);
  const [organizing, setOrganizing] = useState(false);
  const [organizingError, setOrganizingError] = useState<string | null>(null);

  const bookTitle = progress?.book?.title || books.find((book) => book.dir === selectedBookDir)?.title || "";
  const pages = useMemo(() => progress?.pages || [], [progress?.pages]);
  const chapterPages = useMemo(() => pages.filter((page) => page.type === "chapter"), [pages]);
  const supportPages = useMemo(() => pages.filter((page) => page.type !== "chapter"), [pages]);
  const defaultPage = useMemo(
    () => chapterPages.find((page) => page.status === "in-progress") || chapterPages[0] || pages[0],
    [chapterPages, pages]
  );

  const notesByPageId = useMemo(() => {
    const map = new Map<string, BookNote[]>();
    for (const note of notes) {
      if (!note.pageId) continue;
      const pageNotes = map.get(note.pageId) || [];
      pageNotes.push(note);
      map.set(note.pageId, pageNotes);
    }
    return map;
  }, [notes]);

  const independentNotes = useMemo(() => notes.filter((note) => !note.pageId), [notes]);
  const selectedNote = notes.find((note) => note.id === selectedNoteId);
  const selectedPage = selectedNote?.pageId ? pages.find((page) => page.id === selectedNote.pageId) : undefined;
  const activeListPage = pages.find((page) => page.id === activePageId) || defaultPage;
  const activePage = selectedNote ? selectedPage : activeListPage;
  const activePageNotes = activePage ? notesByPageId.get(activePage.id) || [] : [];
  const chaptersWithNotes = chapterPages.filter((chapter) => (notesByPageId.get(chapter.id)?.length || 0) > 0).length;
  const completedChapters = chapterPages.filter((chapter) => chapter.status === "completed").length;
  const boundButEmpty = !!(wereadBookId && wereadSummary && wereadSummary.bookmarkCount === 0);

  const relatedPages = useMemo(() => {
    if (!activePage) return [];
    if (activePage.type !== "chapter") {
      return supportPages.filter((page) => page.id !== activePage.id).slice(0, 4);
    }
    return supportPages.filter((page) => page.relatedChapters.includes(activePage.title));
  }, [activePage, supportPages]);

  useEffect(() => {
    if (wereadBookId && !wereadSummary) {
      fetchSummary(wereadBookId).catch(() => {
        /* WeRead marks are optional in this view. */
      });
    }
  }, [wereadBookId, wereadSummary, fetchSummary]);

  useEffect(() => {
    setSelectedNoteId(null);
    setActivePageId(defaultPage?.id || null);
  }, [selectedBookDir, defaultPage?.id]);

  useEffect(() => {
    if (!selectedBookDir) {
      setNotes([]);
      return;
    }

    setLoading(true);
    fetch(`/api/books/${encodeURIComponent(selectedBookDir)}/notes`)
      .then((response) => (response.ok ? response.json() : []))
      .then((data: BookNote[]) => setNotes(data))
      .catch(() => setNotes([]))
      .finally(() => setLoading(false));
  }, [selectedBookDir]);

  useEffect(() => {
    if (selectedNoteId && notes.some((note) => note.id === selectedNoteId)) return;
    const activeNote = activePageId ? notes.find((note) => note.pageId === activePageId) : undefined;
    setSelectedNoteId(activeNote?.id || null);
  }, [activePageId, notes, selectedNoteId]);

  const handleCreateNote = useCallback(
    async (pageId?: string | null) => {
      if (!selectedBookDir) return;
      const normalizedPageId = pageId || null;
      setCreatingPageId(normalizedPageId || "independent");

      try {
        const response = await fetch(`/api/books/${encodeURIComponent(selectedBookDir)}/notes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pageId: normalizedPageId, cue: "", notes: "", summary: "" }),
        });
        if (!response.ok) throw new Error(`Save failed (${response.status})`);

        const newNote: BookNote = await response.json();
        setNotes((prev) => [newNote, ...prev]);
        setSelectedNoteId(newNote.id);
        setActivePageId(normalizedPageId);
      } catch (error) {
        console.error("Failed to create note:", error);
      } finally {
        setCreatingPageId(null);
      }
    },
    [selectedBookDir]
  );

  const handleSaveNote = useCallback(
    async (noteId: string, fields: Partial<BookNote>) => {
      if (!selectedBookDir) return;
      try {
        const response = await fetch(`/api/books/${encodeURIComponent(selectedBookDir)}/notes/${noteId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(fields),
        });
        if (!response.ok) throw new Error(`Save failed (${response.status})`);

        const updated: BookNote = await response.json();
        setNotes((prev) => prev.map((note) => (note.id === noteId ? updated : note)));
      } catch (error) {
        console.error("Failed to save note:", error);
        throw error;
      }
    },
    [selectedBookDir]
  );

  const handleDeleteNote = useCallback(
    async (noteId: string) => {
      if (!selectedBookDir) return;

      const previous = notes;
      setNotes((prev) => prev.filter((note) => note.id !== noteId));
      if (selectedNoteId === noteId) setSelectedNoteId(null);

      try {
        const response = await fetch(`/api/books/${encodeURIComponent(selectedBookDir)}/notes/${noteId}`, {
          method: "DELETE",
        });
        if (!response.ok) throw new Error("Delete failed");
      } catch {
        setNotes(previous);
      }
    },
    [notes, selectedBookDir, selectedNoteId]
  );

  const selectPageNote = (page: ProgressPage) => {
    setActivePageId(page.id);
    setSelectedNoteId(notesByPageId.get(page.id)?.[0]?.id || null);
  };

  const openPage = (page: ProgressPage) => {
    // 从笔记工作台进入阅读：返回时回到这里而不是 Hub
    openReadingPage(page, "readingnotes-detail");
  };

  /** 采集箱 → 康奈尔分区：追加文本 + 建立引用关系 */
  const handleSendToCornell = useCallback(
    async (annotation: Annotation, section: CornellSection) => {
      if (!selectedBookDir || !selectedNoteId) return;
      const note = notes.find((n) => n.id === selectedNoteId);
      if (!note) return;
      setOrganizing(true);
      setOrganizingError(null);
      try {
        await noteEditorRef.current?.flush();
        const response = await fetch(`/api/books/${encodeURIComponent(selectedBookDir)}/notes/${note.id}/links`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ annotationId: annotation.id, section }),
        });
        if (!response.ok) throw new Error(`Organize failed (${response.status})`);
        const result = await response.json() as { created: boolean; note: BookNote };
        setNotes((current) => current.map((item) => item.id === result.note.id ? result.note : item));
        noteEditorRef.current?.applyExternalNote(result.note);
      } catch (error) {
        setOrganizingError(error instanceof Error ? error.message : "未知错误");
        throw error;
      } finally {
        setOrganizing(false);
      }
    },
    [selectedBookDir, selectedNoteId, notes]
  );

  /** 采集箱 → 回到原文：打开阅读页并请求 annotator 滚动定位 */
  const handleOpenAnnotationSource = useCallback(
    (annotation: Annotation) => {
      const page = pages.find((p) => p.id === annotation.pageId);
      if (!page) return;
      (window as unknown as { __rpPendingScroll?: string }).__rpPendingScroll = annotation.id;
      openPage(page);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pages, openReadingPage]
  );

  if (!selectedBookDir) {
    return (
      <div className="flex h-full flex-1 items-center justify-center bg-[#FAF7F2]">
        <button
          type="button"
          onClick={() => setViewMode("readingnotes")}
          className="inline-flex items-center gap-2 rounded-md border border-stone-200 bg-white px-4 py-2 text-sm font-semibold text-stone-700 shadow-sm hover:border-stone-300"
        >
          <ArrowLeft size={16} />
          返回笔记概览
        </button>
      </div>
    );
  }

  const noteSlot = selectedNote ? (
    <NoteEditor
      key={selectedNote.id}
      ref={noteEditorRef}
      note={selectedNote}
      linkedPage={selectedPage}
      bookDir={selectedBookDir}
      bookTitle={bookTitle}
      onSave={handleSaveNote}
      onDelete={handleDeleteNote}
      onOpenPage={openPage}
      mutationPending={organizing}
    />
  ) : (
    <div className="flex h-full min-h-0 items-center justify-center bg-[#FBF7F0] px-6">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-stone-200 bg-white text-[#D94F30] shadow-sm">
          <NotebookPen size={24} />
        </div>
        <h2 className="mb-2 text-xl font-semibold text-stone-900">
          {activePage ? "开始本页笔记" : "选择一个章节"}
        </h2>
        <p className="mb-6 text-sm leading-6 text-stone-500">
          {activePage ? activePage.title : "章节笔记会作为这本书的主要笔记入口。"}
        </p>
        <div className="flex justify-center gap-3">
          {activePage && (
            <button
              type="button"
              onClick={() => handleCreateNote(activePage.id)}
              disabled={creatingPageId === activePage.id}
              className="inline-flex items-center gap-2 rounded-md bg-stone-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-transform active:scale-[0.98] disabled:opacity-60"
            >
              <Plus size={16} />
              创建笔记
            </button>
          )}
          <button
            type="button"
            onClick={() => handleCreateNote(null)}
            disabled={creatingPageId === "independent"}
            className="inline-flex items-center gap-2 rounded-md border border-stone-200 bg-white px-4 py-2 text-sm font-semibold text-stone-700 shadow-sm hover:border-stone-300 disabled:opacity-60"
          >
            <FileText size={16} />
            独立笔记
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-[#FAF7F2]">
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-stone-200/70 bg-[#FFFDF8] px-6 py-4">
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-2 text-xs text-stone-500">
            <button
              type="button"
              onClick={() => setViewMode("readingnotes")}
              className="inline-flex items-center gap-1 font-semibold text-stone-500 hover:text-stone-900"
            >
              <ArrowLeft size={14} />
              笔记
            </button>
            <span>/</span>
            <span className="truncate">{bookTitle}</span>
          </div>
          <h1 className="truncate text-2xl font-semibold text-stone-950">章节笔记</h1>
        </div>
        <div className="hidden items-center gap-3 md:flex">
          <div className="rounded-md border border-stone-200 bg-white px-3 py-2 text-sm text-stone-600">
            <span className="font-semibold text-stone-900">{chaptersWithNotes}</span>/{chapterPages.length} 章有笔记
          </div>
          <div className="rounded-md border border-stone-200 bg-white px-3 py-2 text-sm text-stone-600">
            已读 <span className="font-semibold text-stone-900">{completedChapters}</span> 章
          </div>
          <div className="relative">
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={exportMenuOpen}
              onClick={() => setExportMenuOpen((open) => !open)}
              className="inline-flex items-center gap-2 rounded-md border border-stone-200 bg-white px-3 py-2 text-sm font-semibold text-stone-700 shadow-sm hover:border-[#D94F30]/40 hover:text-[#B3402A]"
              title="导出康奈尔笔记与标注为 Markdown"
            >
              <FileDown size={15} />
              导出 MD
            </button>
            {exportMenuOpen && (
              <>
                <button
                  type="button"
                  aria-label="关闭导出菜单"
                  onClick={() => setExportMenuOpen(false)}
                  className="fixed inset-0 z-30 cursor-default"
                  tabIndex={-1}
                />
                <div role="menu" className="absolute right-0 top-[calc(100%+6px)] z-40 w-60 rounded-lg border border-stone-200 bg-white p-1.5 shadow-lg">
                  {activePage ? (
                    <a
                      role="menuitem"
                      href={`/api/books/${encodeURIComponent(selectedBookDir)}/notes/export?pageId=${encodeURIComponent(activePage.id)}`}
                      download
                      onClick={() => setExportMenuOpen(false)}
                      className="block rounded-md px-3 py-2 text-sm text-stone-700 hover:bg-stone-100"
                    >
                      <span className="block font-semibold">导出本章</span>
                      <span className="mt-0.5 block truncate text-xs text-stone-500">{activePage.title}</span>
                    </a>
                  ) : (
                    <div className="rounded-md px-3 py-2 text-sm text-stone-400">
                      <span className="block font-semibold">导出本章</span>
                      <span className="mt-0.5 block text-xs">先在左侧选择一个章节</span>
                    </div>
                  )}
                  <a
                    role="menuitem"
                    href={`/api/books/${encodeURIComponent(selectedBookDir)}/notes/export`}
                    download
                    onClick={() => setExportMenuOpen(false)}
                    className="block rounded-md px-3 py-2 text-sm text-stone-700 hover:bg-stone-100"
                  >
                    <span className="block font-semibold">导出全书</span>
                    <span className="mt-0.5 block text-xs text-stone-500">全部章节笔记、标注与独立笔记</span>
                  </a>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <aside className="flex w-[310px] shrink-0 flex-col border-r border-stone-200/70 bg-[#F3EEE6]">
          <div className="border-b border-stone-200/70 p-4">
            <button
              type="button"
              onClick={() => activePage && openPage(activePage)}
              disabled={!activePage}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-[#D94F30] px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-[#D94F30]/20 transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <BookOpen size={16} />
              阅读当前章节
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
            <div className="mb-3 px-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
              章节
            </div>
            <div className="space-y-1">
              {chapterPages.map((chapter, index) => {
                const pageNotes = notesByPageId.get(chapter.id) || [];
                const active = activePage?.id === chapter.id;
                const statusMeta = getStatusMeta(chapter.status);
                const StatusIcon = statusMeta.icon;

                return (
                  <button
                    key={chapter.id}
                    type="button"
                    onClick={() => selectPageNote(chapter)}
                    className={`group flex w-full items-start gap-3 rounded-md border px-3 py-3 text-left transition-colors ${
                      active
                        ? "border-[#D94F30]/30 bg-white shadow-sm"
                        : "border-transparent text-stone-700 hover:bg-white/70"
                    }`}
                  >
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-xs font-semibold text-stone-500 ring-1 ring-stone-200">
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 text-sm font-semibold leading-5 text-stone-900">{chapter.title}</span>
                      <span className="mt-2 flex items-center gap-2">
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusMeta.className}`}>
                          <StatusIcon size={11} />
                          {statusMeta.label}
                        </span>
                        {pageNotes.length > 0 && (
                          <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-semibold text-stone-600">
                            {pageNotes.length} 条
                          </span>
                        )}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>

            {supportPages.length > 0 && (
              <>
                <div className="mb-3 mt-6 px-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
                  全书与伴读
                </div>
                <div className="space-y-1">
                  {supportPages.map((page) => {
                    const pageNotes = notesByPageId.get(page.id) || [];
                    const typeInfo = PAGE_TYPE_COLORS[page.type] || PAGE_TYPE_COLORS.overview;
                    const active = activePage?.id === page.id;

                    return (
                      <button
                        key={page.id}
                        type="button"
                        onClick={() => selectPageNote(page)}
                        className={`flex w-full items-center gap-3 rounded-md border px-3 py-2.5 text-left transition-colors ${
                          active ? "border-[#D94F30]/30 bg-white shadow-sm" : "border-transparent hover:bg-white/70"
                        }`}
                      >
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: typeInfo.dot }} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-stone-800">{page.title}</span>
                          <span className="text-[11px] text-stone-500">{typeInfo.label}</span>
                        </span>
                        {pageNotes.length > 0 && (
                          <span className="rounded bg-white px-1.5 py-0.5 text-[10px] font-semibold text-stone-500 ring-1 ring-stone-200">
                            {pageNotes.length}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {independentNotes.length > 0 && (
              <>
                <div className="mb-3 mt-6 px-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
                  独立笔记
                </div>
                <div className="space-y-1">
                  {independentNotes.map((note) => (
                    <button
                      key={note.id}
                      type="button"
                      onClick={() => {
                        setActivePageId(null);
                        setSelectedNoteId(note.id);
                      }}
                      className={`w-full rounded-md border px-3 py-2.5 text-left transition-colors ${
                        selectedNoteId === note.id
                          ? "border-[#D94F30]/30 bg-white shadow-sm"
                          : "border-transparent hover:bg-white/70"
                      }`}
                    >
                      <span className="line-clamp-2 text-sm font-medium text-stone-800">{notePreview(note)}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="border-t border-stone-200/70 p-3">
            <button
              type="button"
              onClick={() => handleCreateNote(null)}
              className="flex w-full items-center justify-center gap-2 rounded-md border border-stone-200 bg-white px-3 py-2 text-sm font-semibold text-stone-700 shadow-sm hover:border-stone-300"
            >
              <Plus size={15} />
              新建独立笔记
            </button>
          </div>
        </aside>

        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {activePage && (
            <div className="flex shrink-0 items-center justify-between gap-4 border-b border-stone-200/70 bg-[#FFFDF8] px-5 py-3">
              <div className="min-w-0">
                <div className="mb-1 flex items-center gap-2">
                  <span className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${PAGE_TYPE_COLORS[activePage.type]?.bg} ${PAGE_TYPE_COLORS[activePage.type]?.text}`}>
                    {pageLabel(activePage)}
                  </span>
                  {loading && <span className="text-[11px] text-stone-400">同步中...</span>}
                </div>
                <h2 className="truncate text-base font-semibold text-stone-900">{activePage.title}</h2>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {activePageNotes.length > 1 && (
                  <select
                    value={selectedNoteId || ""}
                    onChange={(event) => setSelectedNoteId(event.target.value || null)}
                    className="h-9 rounded-md border border-stone-200 bg-white px-2 text-sm text-stone-700 focus:outline-none"
                  >
                    {activePageNotes.map((note, index) => (
                      <option key={note.id} value={note.id}>
                        笔记 {index + 1} · {notePreview(note)}
                      </option>
                    ))}
                  </select>
                )}
                <button
                  type="button"
                  onClick={() => handleCreateNote(activePage.id)}
                  disabled={creatingPageId === activePage.id}
                  className="inline-flex h-9 items-center gap-2 rounded-md border border-stone-200 bg-white px-3 text-sm font-semibold text-stone-700 shadow-sm hover:border-stone-300 disabled:opacity-60"
                >
                  <Plus size={15} />
                  新笔记
                </button>
              </div>
            </div>
          )}

          <div className="flex min-h-0 flex-1 overflow-hidden">
            <section className="min-h-0 min-w-0 flex-1 overflow-hidden">{noteSlot}</section>
            <aside className="hidden w-[300px] shrink-0 border-l border-stone-200/70 bg-[#F6F1EA] xl:flex xl:flex-col">
              <div className="flex shrink-0 border-b border-stone-200/70">
                {([["inbox", "标注采集箱"], ["related", "关联材料"]] as const).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setAsideTab(key)}
                    className={`flex-1 px-3 py-2.5 text-xs font-semibold transition-colors ${
                      asideTab === key
                        ? "border-b-2 border-[#D94F30] text-stone-900"
                        : "text-stone-500 hover:text-stone-800"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {asideTab === "inbox" ? (
                <AnnotationInbox
                  bookDir={selectedBookDir}
                  pages={pages}
                  activePageId={activePage?.id ?? null}
                  hasWereadBinding={!!wereadBookId}
                  wereadBookId={wereadBookId ?? null}
                  activeNoteId={selectedNote?.id ?? null}
                  onSendTo={handleSendToCornell}
                  onOpenSource={handleOpenAnnotationSource}
                />
              ) : (
                <>
              <div className="border-b border-stone-200/70 px-4 py-4">
                <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-stone-900">
                  <Layers3 size={16} />
                  关联材料
                </div>
                <p className="text-xs leading-5 text-stone-500">{activePage ? "与当前页面相关的伴读内容。" : "选择章节后显示关联内容。"}</p>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-3">
                {relatedPages.length === 0 ? (
                  <div className="rounded-md border border-dashed border-stone-300 bg-white/50 px-3 py-4 text-sm text-stone-500">
                    暂无关联材料
                  </div>
                ) : (
                  <div className="space-y-2">
                    {relatedPages.map((page) => {
                      const typeInfo = PAGE_TYPE_COLORS[page.type] || PAGE_TYPE_COLORS.overview;
                      const pageNotes = notesByPageId.get(page.id) || [];

                      return (
                        <button
                          key={page.id}
                          type="button"
                          onClick={() => selectPageNote(page)}
                          className="w-full rounded-md border border-stone-200 bg-white px-3 py-3 text-left shadow-sm transition-colors hover:border-[#D94F30]/30"
                        >
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <span className={`rounded px-2 py-0.5 text-[10px] font-semibold ${typeInfo.bg} ${typeInfo.text}`}>
                              {typeInfo.label}
                            </span>
                            {pageNotes.length > 0 && (
                              <span className="text-[10px] font-semibold text-stone-500">{pageNotes.length} 条笔记</span>
                            )}
                          </div>
                          <div className="line-clamp-2 text-sm font-semibold leading-5 text-stone-900">{page.title}</div>
                          {page.description && (
                            <div className="mt-1 line-clamp-2 text-xs leading-5 text-stone-500">{page.description}</div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
                </>
              )}
            </aside>
          </div>

          {organizingError && (
            <div role="alert" className="shrink-0 border-t border-red-200 bg-red-50 px-5 py-2 text-xs text-red-700">
              整理标注失败：{organizingError}
            </div>
          )}

          {boundButEmpty && (
            <div className="shrink-0 border-t border-amber-200 bg-amber-50 px-5 py-2 text-xs text-amber-800">
              微信读书已连接，暂未同步到划线。
            </div>
          )}

        </main>
      </div>
    </div>
  );
}
