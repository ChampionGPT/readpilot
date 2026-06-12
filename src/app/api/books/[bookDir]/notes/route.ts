// input: bookDir (URL param), db.ts (getNotesByBook, createNote), files.ts (resolveBookDir)
// output: GET (列出该书所有笔记), POST (创建新笔记)
// pos: 读书笔记 API — 与 book_notes 表交互
// 声明：一旦我被更新，务必更新我的开头注释以及所属文件夹的 md。

import { NextRequest, NextResponse } from 'next/server';
import { getDb, getNotesByBook, createNote } from '@/lib/db';
import { resolveBookDir } from '@/lib/files';

/** 解析 bookDir 参数为真实的 book.id */
function resolveBookId(bookDir: string): string | null {
  // 确认目录存在
  if (!resolveBookDir(bookDir)) return null;
  const db = getDb();
  const row = db.prepare('SELECT id FROM books WHERE data_dir = ?').get(bookDir) as any;
  return row?.id || null;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ bookDir: string }> }
) {
  const { bookDir } = await params;
  const bookId = resolveBookId(decodeURIComponent(bookDir));
  if (!bookId) {
    return NextResponse.json({ error: 'Book not found' }, { status: 404 });
  }
  const notes = getNotesByBook(bookId);
  return NextResponse.json(notes);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ bookDir: string }> }
) {
  const { bookDir } = await params;
  const bookId = resolveBookId(decodeURIComponent(bookDir));
  if (!bookId) {
    return NextResponse.json({ error: 'Book not found' }, { status: 404 });
  }
  try {
    const body = await req.json();
    const { pageId = null, cue = '', notes = '', summary = '' } = body;
    const note = createNote(bookId, pageId, cue, notes, summary);
    return NextResponse.json(note, { status: 201 });
  } catch (err: any) {
    console.error('API /notes POST error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
