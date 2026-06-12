---
name: reading-companion
description: Generate or update ReadPilot companion pages for a book only when the user explicitly asks to create, generate, update, or turn content into an interactive HTML companion page, chapter page, theme page, deep-dive page, synthesis page, or Hub/progress update. Do not use for ordinary chapter explanations, summaries, quiz questions, note taking, or lightweight Q&A; answer those directly in chat.
---

# Reading Companion

Use this skill to turn a reader's explicit page-generation request into one focused ReadPilot companion page.

## Boundary

Default to chat-only answers unless the user clearly asks to generate or update a page.

Do not generate pages for:

- "Help me understand this chapter"
- "Summarize this section"
- "What does this concept mean?"
- "Give me a few questions"
- "I finished chapter X"

Generate a page only for requests like:

- "Generate a companion page for chapter X"
- "Turn this concept into a deep-dive page"
- "Create a theme page comparing X and Y"
- "Update the Hub / progress.json"
- "Make an interactive HTML page for this section"

## ReadPilot Data Contract

Work inside one book directory:

```text
data/books/<book-slug>/
  progress.json
  index.html
  source.jsonl
  companion/
    book-profile.md
    chapter-index.md
    topic-index.md
  pages/
```

Before writing, read `progress.json` and the relevant `companion/*.md` files. Read only the target chapter or relevant source chunks from `source.jsonl`; do not reprocess the whole book unless the user explicitly asks to rebuild the companion profile.

## Workflow

1. Classify the request as `chapter`, `deepdive`, `theme`, `synthesis`, `overview`, or `hub-update`.
2. Read the current book state from `progress.json`.
3. Read the relevant companion indexes.
4. Read only the source material needed for the requested page.
5. Generate one self-contained HTML page under `pages/`.
6. Add or update the corresponding record in `progress.json`.
7. Update `index.html` so the new page appears in the Hub.
8. Report the changed files and the intended next reading action.

## Page Rules

- Create one page per request.
- Keep original quotations short and exact.
- Prefer structure, diagrams, comparison, checks, and interaction over long prose.
- Include a small mastery check when the page teaches a concept.
- Make `relatedChapters` explicit for chapter, deep-dive, and theme pages.
- Do not copy large passages from copyrighted books.

## Progress Record Shape

Use this shape when registering a generated page:

```json
{
  "id": "stable-page-id",
  "type": "chapter",
  "title": "Page title",
  "description": "Short description of what this page helps the reader do",
  "file": "pages/page-file.html",
  "status": "new",
  "masteryScore": null,
  "createdAt": "2026-06-12T00:00:00.000Z",
  "completedAt": null,
  "relatedChapters": ["Chapter title"]
}
```

Use `relatedChapters: []` only for whole-book overview or synthesis pages.

## Output To The User

Keep the final response short:

- Name the generated or updated page.
- List changed files.
- Suggest the next useful reading action.
