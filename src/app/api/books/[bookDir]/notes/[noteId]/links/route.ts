// input: bookDir + noteId (URL params), db.ts (linkAnnotationToNote, unlinkAnnotationFromNote, getLinksByNote)
// output: GET (笔记的标注引用), POST (建立引用), DELETE (解除引用)
// pos: 康奈尔笔记 ↔ 标注引用关系 API
// 声明：一旦我被更新，务必更新我的开头注释以及所属文件夹的 md。

import { NextRequest, NextResponse } from 'next/server';
import { getNote, getAnnotation, linkAnnotationToNote, unlinkAnnotationFromNote, getLinksByNote } from '@/lib/db';

const SECTIONS = ['cue', 'notes', 'summary'] as const;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ bookDir: string; noteId: string }> }
) {
  const { noteId } = await params;
  if (!getNote(noteId)) {
    return NextResponse.json({ error: 'Note not found' }, { status: 404 });
  }
  return NextResponse.json(getLinksByNote(noteId));
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ bookDir: string; noteId: string }> }
) {
  const { noteId } = await params;
  try {
    const { annotationId, section, sortOrder = 0 } = await req.json();
    if (!SECTIONS.includes(section)) {
      return NextResponse.json({ error: 'invalid section' }, { status: 400 });
    }
    if (!getNote(noteId) || !getAnnotation(annotationId)) {
      return NextResponse.json({ error: 'Note or annotation not found' }, { status: 404 });
    }
    linkAnnotationToNote(noteId, annotationId, section, sortOrder);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err: any) {
    console.error('API /notes/links POST error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ bookDir: string; noteId: string }> }
) {
  const { noteId } = await params;
  try {
    const { annotationId, section } = await req.json();
    if (!SECTIONS.includes(section)) {
      return NextResponse.json({ error: 'invalid section' }, { status: 400 });
    }
    const ok = unlinkAnnotationFromNote(noteId, annotationId, section);
    return ok
      ? NextResponse.json({ ok: true })
      : NextResponse.json({ error: 'Link not found' }, { status: 404 });
  } catch (err: any) {
    console.error('API /notes/links DELETE error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
