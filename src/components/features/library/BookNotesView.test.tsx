/**
 * input: BookNotesView notes/annotations APIs and repeated send-to-Cornell actions
 * output: Regression coverage for the single inbox surface and idempotent note links
 * pos: Focused integration tests for the reading notes workspace
 */
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Annotation, BookNote } from "@/types/progress";
import type { ProgressData, ProgressPage } from "@/types/progress-data";
import { useBookStore } from "@/store/useBookStore";
import { useWereadStore } from "@/store/useWereadStore";
import { BookNotesView } from "./BookNotesView";

vi.mock("./WereadMarksPanel", () => ({ WereadMarksPanel: () => <div>底部微信划线区</div> }));

const page: ProgressPage = {
  id: "chapter-1", type: "chapter", title: "第一章", description: "", file: "chapter-1.html",
  status: "in-progress", masteryScore: null, relatedChapters: [], createdAt: "2026-07-19", completedAt: null,
};
const progress: ProgressData = {
  book: { title: "测试书", author: "作者", genre: "", totalChapters: 1, startDate: "2026-07-19", structure: [], totalPages: null, currentPage: null },
  pages: [page], themes: [], glossary: {}, currentFocus: null, nextRecommendation: null, readingLog: [],
};
const initialNote: BookNote = {
  id: "note-1", bookId: "book-1", pageId: page.id, cue: "", notes: "已有内容", summary: "",
  createdAt: "2026-07-19T00:00:00.000Z", updatedAt: "2026-07-19T00:00:00.000Z",
};
const annotation: Annotation = {
  id: "ann-1", bookId: "book-1", pageId: page.id, locator: {}, quote: "引用原文", quotePrefix: "", quoteSuffix: "",
  visualStyle: "highlight", color: "yellow", semanticType: "quote", body: "", tags: [], origin: "weread",
  externalId: "wx-1", sourceHash: null, createdAt: "2026-07-19T00:00:00.000Z", updatedAt: "2026-07-19T00:00:00.000Z", deletedAt: null,
};
const wereadAnnotation: Annotation = { ...annotation, pageId: null, quotePrefix: "第一章" };
const otherAnnotation: Annotation = { ...annotation, id: "ann-2", pageId: null, quotePrefix: "第二章", quote: "第二章引用", externalId: "wx-2" };

describe("BookNotesView annotation intake", () => {
  const fetchMock = vi.fn();
  let linkCreated = false;
  let savedNote = initialNote;
  let linkedNoteId = "note-1";
  let postGate: Promise<void> | null = null;
  let failNextPut = false;

  beforeEach(() => {
    localStorage.clear();
    linkCreated = false;
    savedNote = initialNote;
    linkedNoteId = "note-1";
    postGate = null;
    failNextPut = false;
    useBookStore.setState({ selectedBookDir: "test-book", progress, books: [{ dir: "test-book", title: "测试书", author: "作者", genre: "" }] });
    useWereadStore.setState({ byLocalDir: { "test-book": "weread-1" }, byBookId: { "weread-1": { bookmarkCount: 2 } } });
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/notes") && !init?.method) return { ok: true, json: async () => [initialNote] };
      if (url.includes("/pages/")) return { ok: true, text: async () => "<article></article>" };
      if (url.includes("/annotations")) return {
        ok: true,
        json: async () => ({
          annotations: [wereadAnnotation, otherAnnotation],
          links: linkCreated ? [{ noteId: linkedNoteId, annotationId: "ann-1", section: "notes", sortOrder: 0 }] : [],
        }),
      };
      if (url.endsWith("/links") && !init?.method) return { ok: true, json: async () => linkCreated ? [{ noteId: "note-1", annotationId: "ann-1", section: "notes", sortOrder: 0 }] : [] };
      if (url.endsWith("/links") && init?.method === "POST") {
        if (postGate) await postGate;
        const created = !linkCreated;
        linkCreated = true;
        const latestPut = fetchMock.mock.calls.filter(([, requestInit]) => requestInit?.method === "PUT").at(-1);
        const persistedFields = latestPut ? JSON.parse(String(latestPut[1]?.body)) : {};
        savedNote = { ...savedNote, ...persistedFields };
        if (created) savedNote = { ...savedNote, notes: `${savedNote.notes}\n\n> 引用原文` };
        return { ok: true, json: async () => ({ created, note: savedNote, links: [{ noteId: "note-1", annotationId: "ann-1", section: "notes", sortOrder: 0 }] }) };
      }
      if (url.includes("/notes/note-1") && init?.method === "PUT") {
        if (failNextPut) {
          failNextPut = false;
          return { ok: false, status: 500, json: async () => ({ error: "save failed" }) };
        }
        const fields = JSON.parse(String(init.body));
        savedNote = { ...savedNote, ...fields };
        return { ok: true, json: async () => savedNote };
      }
      return { ok: true, json: async () => ({}) };
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("does not render the legacy bottom WeRead marks panel", async () => {
    render(<BookNotesView />);
    await screen.findByDisplayValue("已有内容");
    expect(screen.queryByText("底部微信划线区")).not.toBeInTheDocument();
  });

  it("flushes a local draft before atomic send-to and applies the returned external note", async () => {
    render(<BookNotesView />);
    const notes = await screen.findByDisplayValue("已有内容");
    fireEvent.change(notes, { target: { value: "尚未自动保存的输入" } });
    const send = await screen.findByRole("button", { name: "→ Notes" });
    await waitFor(() => expect(send).toBeEnabled());

    fireEvent.click(send);

    await waitFor(() => expect(notes).toHaveValue("尚未自动保存的输入\n\n> 引用原文"));
    const putCall = fetchMock.mock.calls.find(([, init]) => init?.method === "PUT");
    const postCall = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
    expect(putCall).toBeDefined();
    expect(postCall).toBeDefined();
    expect(fetchMock.mock.invocationCallOrder[fetchMock.mock.calls.indexOf(putCall!)]).toBeLessThan(
      fetchMock.mock.invocationCallOrder[fetchMock.mock.calls.indexOf(postCall!)],
    );

    fireEvent.change(notes, { target: { value: "尚未自动保存的输入\n\n> 引用原文\n\n继续编辑" } });
    expect(notes).toHaveValue("尚未自动保存的输入\n\n> 引用原文\n\n继续编辑");
    await waitFor(() => {
      const puts = fetchMock.mock.calls.filter(([, init]) => init?.method === "PUT");
      expect(JSON.parse(String(puts.at(-1)?.[1]?.body))).toEqual({
        cue: "",
        notes: "尚未自动保存的输入\n\n> 引用原文\n\n继续编辑",
        summary: "",
      });
    }, { timeout: 1600 });
  });

  it("locks the editor for the full atomic transfer and ignores edits while POST is pending", async () => {
    let releasePost!: () => void;
    postGate = new Promise<void>((resolve) => { releasePost = resolve; });
    render(<BookNotesView />);
    const notes = await screen.findByDisplayValue("已有内容");
    fireEvent.change(notes, { target: { value: "整理前草稿" } });
    const send = await screen.findByRole("button", { name: "→ Notes" });
    await waitFor(() => expect(send).toBeEnabled());
    fireEvent.click(send);

    await screen.findByText("正在整理标注");
    expect(notes).toHaveAttribute("readonly");
    fireEvent.change(notes, { target: { value: "不应写入" } });
    expect(notes).toHaveValue("整理前草稿");
    releasePost();

    await waitFor(() => expect(notes).toHaveValue("整理前草稿\n\n> 引用原文"));
  });

  it("aborts atomic POST when flush fails, preserves the draft, and succeeds on retry", async () => {
    const unhandled = vi.fn();
    window.addEventListener("unhandledrejection", unhandled);
    failNextPut = true;
    render(<BookNotesView />);
    const notes = await screen.findByDisplayValue("已有内容");
    fireEvent.change(notes, { target: { value: "失败也要保留" } });
    const send = await screen.findByRole("button", { name: "→ Notes" });
    await waitFor(() => expect(send).toBeEnabled());
    fireEvent.click(send);

    expect(await screen.findByText(/整理标注失败：/)).toBeInTheDocument();
    expect(notes).toHaveValue("失败也要保留");
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(0);

    await waitFor(() => expect(send).toBeEnabled());
    fireEvent.click(send);
    await waitFor(() => expect(notes).toHaveValue("失败也要保留\n\n> 引用原文"));
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1);
    expect(unhandled).not.toHaveBeenCalled();
    window.removeEventListener("unhandledrejection", unhandled);
  });

  it("uses the current chapter by default and can expand the inbox to the whole book", async () => {
    render(<BookNotesView />);

    expect(await screen.findByText("引用原文")).toBeInTheDocument();
    expect(screen.queryByText("第二章引用")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "全部 1" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "在微信读书中打开" })).toHaveAttribute("href", "weread://bestbookmark?bookId=weread-1");
    fireEvent.click(screen.getByRole("button", { name: "全书" }));
    expect(await screen.findByText("第二章引用")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "全部 2" })).toBeInTheDocument();
  });

  it("marks links only for the active note and exact Cornell section", async () => {
    linkCreated = true;
    render(<BookNotesView />);

    expect(await screen.findByRole("button", { name: "✓ Notes" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "→ Cue" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "未转入当前笔记 0" })).toBeInTheDocument();
  });

  it("does not treat a link owned by another note as organized for the active note", async () => {
    linkCreated = true;
    linkedNoteId = "other-note";
    render(<BookNotesView />);

    const notesButton = await screen.findByRole("button", { name: "→ Notes" });
    await waitFor(() => expect(notesButton).toBeEnabled());
    expect(screen.getByRole("button", { name: "未转入当前笔记 1" })).toBeInTheDocument();
  });

  it("does not append text or create a second link for the same annotation, note, and section", async () => {
    render(<BookNotesView />);
    const send = await screen.findByRole("button", { name: "→ Notes" });
    await waitFor(() => expect(send).toBeEnabled());

    fireEvent.click(send);
    await waitFor(() => expect(screen.getByRole("button", { name: "✓ Notes" })).toBeDisabled());
    fireEvent.click(screen.getByRole("button", { name: "✓ Notes" }));

    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1);
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "PUT")).toHaveLength(0);
  });
});
