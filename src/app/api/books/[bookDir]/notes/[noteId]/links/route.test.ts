// input: links route requests with real temporary SQLite books, notes, and annotations
// output: URL-book ownership regression coverage for atomic annotation transfer
// pos: API integration test for note annotation links
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { NextRequest } from "next/server";

let tmpDir: string;
let db: typeof import("@/lib/db");
let POST: typeof import("./route").POST;

beforeAll(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "readpilot-links-route-"));
  process.env.READPILOT_DATA_DIR = tmpDir;
  vi.resetModules();
  db = await import("@/lib/db");
  ({ POST } = await import("./route"));
});

afterAll(() => {
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* Windows file lock */ }
});

describe("POST note annotation links ownership", () => {
  it("rejects a note addressed through another bookDir without changing note or links", async () => {
    const owner = db.createBook({ title: "Owner" }, "owner-dir");
    db.createBook({ title: "Other" }, "other-dir");
    const note = db.createNote(owner.id, "chapter-1", "", "original", "");
    const annotation = db.createAnnotation(owner.id, { pageId: "chapter-1", quote: "quote" });
    const request = new NextRequest("http://localhost/api/books/other-dir/notes/x/links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ annotationId: annotation.id, section: "notes" }),
    });

    const response = await POST(request, { params: Promise.resolve({ bookDir: "other-dir", noteId: note.id }) });

    expect(response.status).toBe(404);
    expect(db.getNote(note.id)?.notes).toBe("original");
    expect(db.getLinksByNote(note.id)).toEqual([]);
  });
});
