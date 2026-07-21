# library components

This folder owns the library, collection, import, and reading-notes surfaces.

- `LibraryView.tsx`: Main bookshelf view driven by local book progress data and delete/import actions.
- `BookCard.tsx`: Fixed-size book card with progress, WeRead binding entry, and stable hover behavior.
- `ImportModal.tsx`: EPUB import entry; consumes the import SSE stream and selects the new book when finished.
- `ImportProgress.tsx`: Compact visual progress for import stages, including companion profile compilation.
- `ReadingNotesOverview.tsx`: Book-level notes overview.
- `BookNotesView.tsx`: Chapter-first notes workspace. Atomic annotation transfer sets a full-duration organizing lock, awaits the active editor's `flush()`, aborts POST on save failure, displays an accessible organizing error, then explicitly applies the returned external note mutation.
- `NoteEditor.tsx`: Cornell editor with merged 800ms snapshots, edit revisions, and independent per-note Promise chains. Every edit writes a full localStorage recovery draft keyed by book + note; only successful persistence of that revision clears it. Failed switch/unmount flushes therefore recover on reopen with an accessible unsaved/retry state. Same-revision flushes reuse the in-flight Promise instead of issuing duplicate PUTs. Its ref exposes `flush(): Promise<void>` and `applyExternalNote(note)`; `mutationPending` makes every textarea read-only while an external atomic update is in flight.
- `note-constants.ts`: Shared page type labels and colors for notes and reader timeline surfaces.
- `WereadBindDialog.tsx`: WeRead book binding flow.
- `WereadMarksPanel.tsx`: Legacy standalone WeRead marks/reviews panel retained for compatibility; the notes workspace no longer renders it.
- `AnnotationInbox.tsx`: 笔记工作区唯一素材入口 — 默认当前章节（微信标注以 quotePrefix 匹配章节）、可切全书；计数跟随范围，引用状态按当前 note+annotation+section 判定，并提供本地回原文或微信读书书籍级外跳。

## WeRead integration

`BookNotesView.tsx` routes synced WeRead marks into `AnnotationInbox.tsx`. A bound-but-empty book still shows a small connection status bar; no separate bottom marks panel is rendered.

## Draft recovery

Cornell drafts use `readpilot:cornell-draft:{bookDir}:{noteId}` localStorage entries containing the complete Cue/Notes/Summary snapshot and edit revision. A matching successful save or explicit external atomic note application removes only drafts at or below the persisted revision.
