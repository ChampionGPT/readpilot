// input: bookDir + noteId (URL params), db.ts (updateNote, deleteNote)
// output: PUT (更新笔记), DELETE (删除笔记)
// pos: 单条读书笔记 API — CRUD 操作
// 声明：一旦我被更新，务必更新我的开头注释以及所属文件夹的 md。

import { NextRequest, NextResponse } from 'next/server';
import { updateNote, deleteNote, getNote } from '@/lib/db';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ bookDir: string; noteId: string }> }
) {
  const { noteId } = await params;
  try {
    const body = await req.json();
    const updated = updateNote(noteId, {
      cue: body.cue,
      notes: body.notes,
      summary: body.summary,
      pageId: body.pageId,
    });
    if (!updated) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (err: any) {
    console.error('API /notes/[noteId] PUT error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ bookDir: string; noteId: string }> }
) {
  const { noteId } = await params;
  const success = deleteNote(noteId);
  if (!success) {
    return NextResponse.json({ error: 'Note not found' }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
