/**
 * input: BookNote, optional linked page/book context, save/delete callbacks
 * output: Cornell editor with local draft recovery, revision-safe per-note autosave, retry errors, mutation lock, and imperative flush/external apply
 * pos: Loaded by BookNotesView as the primary note editing surface.
 */
"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { ExternalLink, Eye, EyeOff, Loader2, Pencil, Sparkles, Trash2 } from "lucide-react";
import type { BookNote } from "@/types/progress";
import type { ProgressPage } from "@/types/progress-data";
import { extractPageContext, type PageContextData } from "@/lib/extract-page-context";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { MarkdownContent } from "@/components/features/chat/blocks/MarkdownContent";
import { CONTEXT_LABELS, PAGE_TYPE_COLORS } from "./note-constants";

interface NoteEditorProps {
  note: BookNote;
  linkedPage?: ProgressPage;
  bookDir: string;
  bookTitle?: string;
  onSave: (id: string, fields: Partial<BookNote>) => void | Promise<unknown>;
  onDelete: (id: string) => void;
  onOpenPage?: (page: ProgressPage) => void;
  mutationPending?: boolean;
}

type CornellDraft = Pick<BookNote, "cue" | "notes" | "summary">;

function draftStorageKey(bookDir: string, noteId: string) {
  return `readpilot:cornell-draft:${encodeURIComponent(bookDir)}:${noteId}`;
}

function readStoredDraft(bookDir: string, noteId: string): { snapshot: CornellDraft; revision: number } | null {
  try {
    const raw = localStorage.getItem(draftStorageKey(bookDir, noteId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeStoredDraft(bookDir: string, noteId: string, snapshot: CornellDraft, revision: number) {
  try {
    localStorage.setItem(draftStorageKey(bookDir, noteId), JSON.stringify({ snapshot, revision }));
  } catch {
    /* Autosave still operates when storage is unavailable. */
  }
}

function clearStoredDraftThrough(bookDir: string, noteId: string, revision: number) {
  const stored = readStoredDraft(bookDir, noteId);
  if (stored && stored.revision <= revision) localStorage.removeItem(draftStorageKey(bookDir, noteId));
}

export interface NoteEditorHandle {
  flush: () => Promise<void>;
  applyExternalNote: (note: BookNote) => void;
}

export const NoteEditor = forwardRef<NoteEditorHandle, NoteEditorProps>(function NoteEditor({
  note,
  linkedPage,
  bookDir,
  bookTitle,
  onSave,
  onDelete,
  onOpenPage,
  mutationPending = false,
}: NoteEditorProps, ref) {
  const [cue, setCue] = useState(note.cue);
  const [notes, setNotes] = useState(note.notes);
  const [summary, setSummary] = useState(note.summary);
  const [contextData, setContextData] = useState<PageContextData>({ items: [], aiCues: [] });
  const [contextLoading, setContextLoading] = useState(false);
  const [contextExpanded, setContextExpanded] = useState(true);
  const [reviewMode, setReviewMode] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftRef = useRef({ cue: note.cue, notes: note.notes, summary: note.summary });
  const dirtyRef = useRef(false);
  const noteIdRef = useRef(note.id);
  const onSaveRef = useRef(onSave);
  const saveChainsRef = useRef(new Map<string, Promise<unknown>>());
  const highestQueuedRevisionsRef = useRef(new Map<string, number>());
  const editRevisionsRef = useRef(new Map<string, number>([[note.id, 0]]));
  const savedRevisionsRef = useRef(new Map<string, number>([[note.id, 0]]));
  const [saveError, setSaveError] = useState<string | null>(null);
  const isFirstLoad = useRef(true);

  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  const enqueueSave = useCallback((noteId: string, snapshot: CornellDraft, revision: number) => {
    const previous = saveChainsRef.current.get(noteId);
    if (previous && (highestQueuedRevisionsRef.current.get(noteId) ?? -1) >= revision) return previous;
    const save = () => Promise.resolve(onSaveRef.current(noteId, snapshot)).then((result) => {
      savedRevisionsRef.current.set(noteId, Math.max(savedRevisionsRef.current.get(noteId) ?? 0, revision));
      clearStoredDraftThrough(bookDir, noteId, revision);
      if (noteIdRef.current === noteId) setSaveError(null);
      return result;
    }).catch((error) => {
      if (noteIdRef.current === noteId) setSaveError(error instanceof Error ? error.message : "保存失败");
      throw error;
    });
    const next = previous
      ? previous.catch(() => undefined).then(save)
      : save();
    saveChainsRef.current.set(noteId, next);
    highestQueuedRevisionsRef.current.set(noteId, revision);
    void next.then(() => {
      if (saveChainsRef.current.get(noteId) === next) {
        saveChainsRef.current.delete(noteId);
        highestQueuedRevisionsRef.current.delete(noteId);
      }
    }, () => {
      if (saveChainsRef.current.get(noteId) === next) {
        saveChainsRef.current.delete(noteId);
        highestQueuedRevisionsRef.current.delete(noteId);
      }
    });
    return next;
  }, [bookDir]);

  const flushPendingSave = useCallback((): Promise<void> => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const noteId = noteIdRef.current;
    const revision = editRevisionsRef.current.get(noteId) ?? 0;
    if (dirtyRef.current || revision > (savedRevisionsRef.current.get(noteId) ?? 0)) {
      enqueueSave(noteId, { ...draftRef.current }, revision);
    }
    return Promise.resolve(saveChainsRef.current.get(noteId)).then(() => {
      if (noteIdRef.current === noteId && (savedRevisionsRef.current.get(noteId) ?? 0) >= (editRevisionsRef.current.get(noteId) ?? 0)) {
        dirtyRef.current = false;
      }
    });
  }, [enqueueSave]);

  useImperativeHandle(ref, () => ({
    flush: flushPendingSave,
    applyExternalNote: (externalNote) => {
      if (externalNote.id !== noteIdRef.current) return;
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      draftRef.current = { cue: externalNote.cue, notes: externalNote.notes, summary: externalNote.summary };
      dirtyRef.current = false;
      const revision = (editRevisionsRef.current.get(externalNote.id) ?? 0) + 1;
      editRevisionsRef.current.set(externalNote.id, revision);
      savedRevisionsRef.current.set(externalNote.id, revision);
      clearStoredDraftThrough(bookDir, externalNote.id, revision);
      setSaveError(null);
      setCue(externalNote.cue);
      setNotes(externalNote.notes);
      setSummary(externalNote.summary);
    },
  }), [bookDir, flushPendingSave]);

  const debouncedSave = useCallback(
    (fields: Partial<BookNote>) => {
      draftRef.current = { ...draftRef.current, ...fields };
      dirtyRef.current = true;
      const revision = (editRevisionsRef.current.get(noteIdRef.current) ?? 0) + 1;
      editRevisionsRef.current.set(noteIdRef.current, revision);
      writeStoredDraft(bookDir, noteIdRef.current, draftRef.current, revision);
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => { void flushPendingSave().catch(() => undefined); }, 800);
    },
    [bookDir, flushPendingSave],
  );

  useEffect(() => {
    noteIdRef.current = note.id;
    if (!editRevisionsRef.current.has(note.id)) editRevisionsRef.current.set(note.id, 0);
    if (!savedRevisionsRef.current.has(note.id)) savedRevisionsRef.current.set(note.id, 0);
    const stored = readStoredDraft(bookDir, note.id);
    const initialDraft = stored?.snapshot ?? { cue: note.cue, notes: note.notes, summary: note.summary };
    draftRef.current = initialDraft;
    if (stored) editRevisionsRef.current.set(note.id, stored.revision);
    dirtyRef.current = !!stored;
    setSaveError(stored ? "检测到未保存草稿" : null);
    setCue(initialDraft.cue);
    setNotes(initialDraft.notes);
    setSummary(initialDraft.summary);

    return () => { void flushPendingSave().catch(() => undefined); };
    // Server echoes for the same note must never replace a newer local draft.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookDir, note.id, flushPendingSave]);

  useEffect(() => {
    if (!linkedPage?.file || !bookDir) return;

    let cancelled = false;
    Promise.resolve().then(() => {
      if (!cancelled) setContextLoading(true);
    });

    fetch(`/api/books/${encodeURIComponent(bookDir)}/pages/${encodeURIComponent(linkedPage.file)}`)
      .then((response) => (response.ok ? response.text() : ""))
      .then((html) => {
        if (cancelled) return;
        const extracted = extractPageContext(html);
        setContextData(extracted);

        if (extracted.aiCues.length > 0 && !note.cue.trim() && isFirstLoad.current) {
          const autoCue = extracted.aiCues.map((item) => `- ${item}`).join("\n");
          setCue(autoCue);
          debouncedSave({ cue: autoCue });
          isFirstLoad.current = false;
        }
      })
      .catch(() => {
        if (!cancelled) setContextData({ items: [], aiCues: [] });
      })
      .finally(() => {
        if (!cancelled) setContextLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [linkedPage?.file, bookDir, note.id, note.cue, debouncedSave]);

  const pageColors = linkedPage ? PAGE_TYPE_COLORS[linkedPage.type] || PAGE_TYPE_COLORS.chapter : null;
  const updatedAt = new Date(note.updatedAt).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const noteChars = notes.trim().length;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#FBF7F0]">
      <div className="flex h-12 shrink-0 items-center justify-between gap-4 border-b border-stone-200/70 bg-[#FFFDF8] px-5">
        <div className="flex min-w-0 items-center gap-2 text-xs text-stone-500">
          {linkedPage ? (
            <span className={`shrink-0 rounded-md border border-stone-200 px-2 py-0.5 text-[11px] font-semibold ${pageColors?.bg} ${pageColors?.text}`}>
              {pageColors?.label || linkedPage.type}
            </span>
          ) : (
            <span className="shrink-0 rounded-md border border-stone-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-stone-500">
              独立笔记
            </span>
          )}
          <span className="truncate">{bookTitle || "读书笔记"}</span>
          <span className="shrink-0 text-stone-400">{updatedAt}</span>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setPreviewMode((value) => !value)}
            className={`inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-semibold transition-colors ${
              previewMode
                ? "border-stone-900 bg-stone-900 text-white"
                : "border-stone-200 bg-white text-stone-600 hover:border-stone-300 hover:text-stone-900"
            }`}
            title={previewMode ? "切回编辑" : "预览 Markdown"}
          >
            {previewMode ? <Pencil size={14} /> : <Eye size={14} />}
            {previewMode ? "编辑" : "预览"}
          </button>

          {linkedPage && onOpenPage && (
            <button
              type="button"
              onClick={() => onOpenPage(linkedPage)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-stone-200 bg-white text-stone-600 transition-colors hover:border-[#D94F30]/40 hover:text-[#D94F30]"
              title="打开原文"
            >
              <ExternalLink size={15} />
            </button>
          )}
          <button
            type="button"
            onClick={() => setReviewMode((value) => !value)}
            className={`inline-flex h-8 w-8 items-center justify-center rounded-md border transition-colors ${
              reviewMode
                ? "border-[#1F2937] bg-[#1F2937] text-white"
                : "border-stone-200 bg-white text-stone-600 hover:border-stone-300 hover:text-stone-900"
            }`}
            title={reviewMode ? "显示笔记" : "复习模式"}
          >
            {reviewMode ? <Eye size={15} /> : <EyeOff size={15} />}
          </button>
          <button
            type="button"
            onClick={() => setDeleteModalOpen(true)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-stone-200 bg-white text-stone-500 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600"
            title="删除笔记"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {(mutationPending || saveError) && (
        <div className="shrink-0 border-b border-stone-200 bg-white px-5 py-2 text-xs">
          {mutationPending && <span className="font-medium text-stone-600">正在整理标注</span>}
          {saveError && !mutationPending && (
            <div role="alert" className="flex items-center justify-between gap-3 text-red-700">
              <span>保存失败：{saveError}</span>
              <button type="button" onClick={() => { void flushPendingSave().catch(() => undefined); }} className="font-semibold underline">重试保存</button>
            </div>
          )}
        </div>
      )}

      {(linkedPage || contextLoading) && (
        <div className="shrink-0 border-b border-stone-200/70 bg-white">
          <button
            type="button"
            onClick={() => setContextExpanded((value) => !value)}
            className="flex w-full items-center justify-between px-5 py-2 text-left transition-colors hover:bg-stone-50"
          >
            <div className="flex min-w-0 items-center gap-2">
              {contextLoading ? (
                <Loader2 size={14} className="animate-spin text-stone-400" />
              ) : (
                <Sparkles size={14} className="text-[#D94F30]" />
              )}
              <span className="text-xs font-semibold text-stone-700">页面上下文</span>
              <span className="rounded bg-stone-100 px-1.5 py-0.5 text-[10px] font-medium text-stone-500">
                {contextData.items.length}
              </span>
            </div>
            <span className="text-[11px] text-stone-400">{contextExpanded ? "收起" : "展开"}</span>
          </button>

          {contextExpanded && contextData.items.length > 0 && (
            <div className="flex max-h-20 gap-2 overflow-x-auto px-5 pb-3">
              {contextData.items.slice(0, 10).map((item, index) => (
                <span
                  key={`${item.type}-${index}`}
                  className="inline-flex max-w-[320px] shrink-0 items-center gap-2 rounded-md border border-stone-200 bg-[#FBF7F0] px-3 py-1.5 text-xs text-stone-600"
                  title={item.content}
                >
                  <span className="font-semibold text-stone-400">{CONTEXT_LABELS[item.type] || item.type}</span>
                  <span className="truncate">{item.content}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <section className="flex min-w-0 flex-1 flex-col border-r border-stone-200/70 bg-[#FFFDF8]">
          <div className="flex h-12 shrink-0 items-center justify-between px-5">
            <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
              {previewMode ? "Markdown Preview" : "Markdown"}
            </label>
            <span className="text-[11px] text-stone-400">{noteChars} 字</span>
          </div>

          <div className="relative min-h-0 flex-1 px-5 pb-5">
            {previewMode ? (
              <div className="h-full min-h-0 overflow-y-auto rounded-md border border-stone-200/70 bg-[#FFFDF8] px-5 py-4 text-stone-800 shadow-sm">
                {notes.trim() ? (
                  <MarkdownContent text={notes} />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-stone-400">
                    没有可预览的 Markdown 内容
                  </div>
                )}
              </div>
            ) : (
              <textarea
                value={notes}
                readOnly={mutationPending}
                onChange={(event) => {
                  if (mutationPending) return;
                  setNotes(event.target.value);
                  debouncedSave({ notes: event.target.value });
                }}
                placeholder={"用 Markdown 记录理解、疑问、推论和可引用的细节...\n\n## 一个想法\n- 关键概念\n- 我的疑问\n\n> 可以摘录短句并写下解释"}
                className="h-full min-h-0 w-full resize-none overflow-y-auto rounded-md border border-stone-200/70 bg-white px-4 py-3 text-[15px] leading-7 text-stone-900 placeholder:text-stone-300 shadow-sm focus:border-[#D94F30]/40 focus:outline-none"
              />
            )}

            {reviewMode && (
              <div className="absolute inset-5 z-10 flex items-center justify-center rounded-lg border border-stone-200 bg-[#FFFDF8]/95 backdrop-blur-sm">
                <button
                  type="button"
                  onClick={() => setReviewMode(false)}
                  className="rounded-md bg-stone-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-transform active:scale-[0.98]"
                >
                  显示笔记
                </button>
              </div>
            )}
          </div>
        </section>

        <aside className="flex w-[320px] shrink-0 flex-col overflow-hidden bg-[#FBF7F0]">
          <section className="flex min-h-0 flex-[2] flex-col border-b border-stone-200/70">
            <div className="h-12 shrink-0 px-5 pt-4">
              <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
                Cues
              </label>
            </div>
            <div className="min-h-0 flex-1 px-5 pb-4">
              <textarea
                value={cue}
                readOnly={mutationPending}
                onChange={(event) => {
                  if (mutationPending) return;
                  setCue(event.target.value);
                  debouncedSave({ cue: event.target.value });
                }}
                placeholder={"- 核心问题\n- 关键概念\n- 可复习线索"}
                className="h-full w-full resize-none rounded-md border border-stone-200/80 bg-white px-3 py-3 text-sm leading-7 text-stone-800 placeholder:text-stone-300 shadow-sm focus:border-[#D94F30]/40 focus:outline-none"
              />
            </div>
          </section>

          <section className="flex min-h-0 flex-1 flex-col px-5 py-4">
            <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
              Summary
            </label>
            <textarea
              value={summary}
              readOnly={mutationPending}
              onChange={(event) => {
                if (mutationPending) return;
                setSummary(event.target.value);
                debouncedSave({ summary: event.target.value });
              }}
              placeholder="一句话提炼本章收获..."
              className="min-h-0 flex-1 resize-none rounded-md border border-stone-200/80 bg-white px-3 py-3 text-sm leading-6 text-stone-800 placeholder:text-stone-300 shadow-sm focus:border-[#D94F30]/40 focus:outline-none"
            />
          </section>
        </aside>
      </div>

      <ConfirmDialog
        isOpen={deleteModalOpen}
        title="删除笔记"
        message={`确定删除「${linkedPage?.title || "独立笔记"}」吗？`}
        confirmLabel="删除"
        cancelLabel="取消"
        destructive
        onConfirm={() => {
          setDeleteModalOpen(false);
          onDelete(note.id);
        }}
        onCancel={() => setDeleteModalOpen(false)}
      />
    </div>
  );
});
