/**
 * input: NoteEditor note changes, rapid Cornell field edits, note switches, and unmounts
 * output: Regression coverage for merged debounced snapshots and pending-save flushes
 * pos: Focused behavior tests for the Cornell note editor
 */
import "@testing-library/jest-dom/vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BookNote } from "@/types/progress";
import { NoteEditor, type NoteEditorHandle } from "./NoteEditor";

const note = (id: string): BookNote => ({
  id,
  bookId: "book-1",
  pageId: null,
  cue: "old cue",
  notes: "old notes",
  summary: "old summary",
  createdAt: "2026-07-19T00:00:00.000Z",
  updatedAt: "2026-07-19T00:00:00.000Z",
});

describe("NoteEditor autosave", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    localStorage.clear();
  });

  it("saves one complete Cornell snapshot after rapid edits across Notes, Cues, and Summary", () => {
    const onSave = vi.fn();
    render(<NoteEditor note={note("note-1")} bookDir="book" onSave={onSave} onDelete={vi.fn()} />);
    const [notes, cue, summary] = screen.getAllByRole("textbox");

    fireEvent.change(notes, { target: { value: "new notes" } });
    fireEvent.change(cue, { target: { value: "new cue" } });
    fireEvent.change(summary, { target: { value: "new summary" } });
    act(() => vi.advanceTimersByTime(800));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith("note-1", {
      cue: "new cue",
      notes: "new notes",
      summary: "new summary",
    });
  });

  it("flushes the current note snapshot before switching to another note", () => {
    const onSave = vi.fn();
    const view = render(<NoteEditor note={note("note-1")} bookDir="book" onSave={onSave} onDelete={vi.fn()} />);
    fireEvent.change(screen.getAllByRole("textbox")[0], { target: { value: "pending notes" } });

    view.rerender(<NoteEditor note={note("note-2")} bookDir="book" onSave={onSave} onDelete={vi.fn()} />);

    expect(onSave).toHaveBeenCalledWith("note-1", {
      cue: "old cue",
      notes: "pending notes",
      summary: "old summary",
    });
  });

  it("flushes the current snapshot when the editor unmounts", () => {
    const onSave = vi.fn();
    const view = render(<NoteEditor note={note("note-1")} bookDir="book" onSave={onSave} onDelete={vi.fn()} />);
    fireEvent.change(screen.getAllByRole("textbox")[2], { target: { value: "pending summary" } });

    view.unmount();

    expect(onSave).toHaveBeenCalledWith("note-1", {
      cue: "old cue",
      notes: "old notes",
      summary: "pending summary",
    });
  });

  it("serializes saves and sends the latest snapshot after an earlier request resolves", async () => {
    let resolveFirst!: () => void;
    const firstRequest = new Promise<void>((resolve) => { resolveFirst = resolve; });
    const onSave = vi.fn()
      .mockImplementationOnce(() => firstRequest)
      .mockResolvedValue(undefined);
    render(<NoteEditor note={note("note-1")} bookDir="book" onSave={onSave} onDelete={vi.fn()} />);
    const [notes, cue] = screen.getAllByRole("textbox");

    fireEvent.change(notes, { target: { value: "first draft" } });
    act(() => vi.advanceTimersByTime(800));
    expect(onSave).toHaveBeenCalledTimes(1);

    fireEvent.change(cue, { target: { value: "new cue while pending" } });
    fireEvent.change(notes, { target: { value: "latest draft" } });
    act(() => vi.advanceTimersByTime(800));
    expect(onSave).toHaveBeenCalledTimes(1);

    await act(async () => resolveFirst());
    expect(onSave).toHaveBeenCalledTimes(2);
    expect(onSave).toHaveBeenLastCalledWith("note-1", {
      cue: "new cue while pending",
      notes: "latest draft",
      summary: "old summary",
    });
  });

  it("does not reset an edited draft when the same note receives an older server echo", () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const view = render(<NoteEditor note={note("note-1")} bookDir="book" onSave={onSave} onDelete={vi.fn()} />);
    const notes = screen.getAllByRole("textbox")[0];
    fireEvent.change(notes, { target: { value: "local newest draft" } });

    view.rerender(<NoteEditor note={{ ...note("note-1"), notes: "older server echo" }} bookDir="book" onSave={onSave} onDelete={vi.fn()} />);

    expect(notes).toHaveValue("local newest draft");
  });

  it("keeps independent FIFO save chains when A is pending and the editor switches to B", async () => {
    let resolveA!: () => void;
    const pendingA = new Promise<void>((resolve) => { resolveA = resolve; });
    const saves: Array<{ id: string; fields: Partial<BookNote> }> = [];
    const onSave = vi.fn((id: string, fields: Partial<BookNote>) => {
      saves.push({ id, fields });
      return id === "note-a" && saves.filter((save) => save.id === "note-a").length === 1
        ? pendingA
        : Promise.resolve();
    });
    const view = render(<NoteEditor note={note("note-a")} bookDir="book" onSave={onSave} onDelete={vi.fn()} />);

    fireEvent.change(screen.getAllByRole("textbox")[0], { target: { value: "A first" } });
    act(() => vi.advanceTimersByTime(800));
    fireEvent.change(screen.getAllByRole("textbox")[0], { target: { value: "A final" } });
    view.rerender(<NoteEditor note={note("note-b")} bookDir="book" onSave={onSave} onDelete={vi.fn()} />);
    fireEvent.change(screen.getAllByRole("textbox")[0], { target: { value: "B final" } });
    act(() => vi.advanceTimersByTime(800));

    expect(saves.some((save) => save.id === "note-b" && save.fields.notes === "B final")).toBe(true);
    expect(saves.filter((save) => save.id === "note-a")).toHaveLength(1);
    await act(async () => resolveA());
    expect(saves.filter((save) => save.id === "note-a")).toHaveLength(2);
    expect(saves.at(-1)).toEqual({
      id: "note-a",
      fields: { cue: "old cue", notes: "A final", summary: "old summary" },
    });
  });

  it("keeps a failed revision dirty, exposes an accessible error, and retries the same draft", async () => {
    const onSave = vi.fn()
      .mockRejectedValueOnce(new Error("save failed"))
      .mockResolvedValue(undefined);
    render(<NoteEditor note={note("note-1")} bookDir="book" onSave={onSave} onDelete={vi.fn()} />);
    const notes = screen.getAllByRole("textbox")[0];
    fireEvent.change(notes, { target: { value: "must survive failure" } });
    await act(async () => {
      vi.advanceTimersByTime(800);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByRole("alert")).toHaveTextContent("保存失败");
    expect(notes).toHaveValue("must survive failure");
    fireEvent.click(screen.getByRole("button", { name: "重试保存" }));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(onSave).toHaveBeenCalledTimes(2);
    expect(onSave).toHaveBeenLastCalledWith("note-1", {
      cue: "old cue", notes: "must survive failure", summary: "old summary",
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("restores note A from local storage after its switch-to-B flush fails", async () => {
    const onSave = vi.fn().mockRejectedValue(new Error("offline"));
    const view = render(<NoteEditor note={note("note-a")} bookDir="book" onSave={onSave} onDelete={vi.fn()} />);
    fireEvent.change(screen.getAllByRole("textbox")[0], { target: { value: "A local draft" } });

    view.rerender(<NoteEditor note={note("note-b")} bookDir="book" onSave={onSave} onDelete={vi.fn()} />);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    view.rerender(<NoteEditor note={note("note-a")} bookDir="book" onSave={onSave} onDelete={vi.fn()} />);

    expect(screen.getAllByRole("textbox")[0]).toHaveValue("A local draft");
    expect(screen.getByRole("alert")).toHaveTextContent("未保存");
  });

  it("restores a draft after unmount flush fails and the editor remounts", async () => {
    const onSave = vi.fn().mockRejectedValue(new Error("offline"));
    const view = render(<NoteEditor note={note("note-a")} bookDir="book" onSave={onSave} onDelete={vi.fn()} />);
    fireEvent.change(screen.getAllByRole("textbox")[2], { target: { value: "summary survives" } });
    view.unmount();
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });

    render(<NoteEditor note={note("note-a")} bookDir="book" onSave={onSave} onDelete={vi.fn()} />);

    expect(screen.getAllByRole("textbox")[2]).toHaveValue("summary survives");
    expect(screen.getByRole("alert")).toHaveTextContent("未保存");
  });

  it("reuses the existing promise when flush sees the same revision already in flight", async () => {
    let resolveSave!: () => void;
    const pending = new Promise<void>((resolve) => { resolveSave = resolve; });
    const onSave = vi.fn().mockReturnValue(pending);
    const ref = createRef<NoteEditorHandle>();
    render(<NoteEditor ref={ref} note={note("note-a")} bookDir="book" onSave={onSave} onDelete={vi.fn()} />);
    fireEvent.change(screen.getAllByRole("textbox")[0], { target: { value: "one revision" } });
    act(() => vi.advanceTimersByTime(800));

    const flushPromise = ref.current!.flush();
    expect(onSave).toHaveBeenCalledTimes(1);
    await act(async () => resolveSave());
    await flushPromise;
    expect(onSave).toHaveBeenCalledTimes(1);
  });
});
