# library components

This folder owns the library, collection, import, and reading-notes surfaces.

- `LibraryView.tsx`: Main bookshelf view driven by local book progress data and delete/import actions.
- `BookCard.tsx`: Fixed-size book card with progress, WeRead binding entry, and stable hover behavior.
- `ImportModal.tsx`: EPUB import entry; consumes the import SSE stream and selects the new book when finished.
- `ImportProgress.tsx`: Compact visual progress for import stages, including companion profile compilation.
- `ReadingNotesOverview.tsx`: Book-level notes overview.
- `BookNotesView.tsx`: Chapter-first notes workspace. The left rail prioritizes chapter notes, then companion pages and independent notes. The center editor opens the active chapter note, and the right rail shows related companion material.
- `NoteEditor.tsx`: Cornell-style editor with Notes, Cues, Summary, hidden autosave, page context chips, review mode, source-page jump, and delete confirmation.
- `note-constants.ts`: Shared page type labels and colors for notes and reader timeline surfaces.
- `WereadBindDialog.tsx`: WeRead book binding flow.
- `WereadMarksPanel.tsx`: WeRead marks and reviews panel used inside the notes workspace.

## WeRead integration

`BookNotesView.tsx` still supports WeRead bindings:

- bound with marks: shows a bottom marks panel under the editor;
- bound without marks: shows a small connected-but-empty status bar;
- unbound: keeps the notes editor full height.
