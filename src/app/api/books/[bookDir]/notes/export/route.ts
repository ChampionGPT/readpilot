// input: bookDir (URL param), 可选 ?pageId=（章节范围）, db.ts (notes + annotations), files.ts (readProgress), notes-exporter
// output: GET — 整本书或单章读书笔记的 Markdown 附件下载
// pos: 读书笔记导出 API
// 声明：一旦我被更新，务必更新我的开头注释以及所属文件夹的 md。

import { NextRequest, NextResponse } from 'next/server';
import { getBookByDataDir, getNotesByBook, getAnnotationsByBook } from '@/lib/db';
import { readProgress } from '@/lib/files';
import { buildNotesMarkdown, notesExportFileName } from '@/lib/notes-exporter';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ bookDir: string }> }
) {
  const { bookDir } = await params;
  const dir = decodeURIComponent(bookDir);
  const book = getBookByDataDir(dir);
  if (!book) {
    return NextResponse.json({ error: 'Book not found' }, { status: 404 });
  }
  try {
    const progress = readProgress(dir);
    const allPages = progress.kind === 'ok' ? progress.data.pages : [];
    const pageId = new URL(req.url).searchParams.get('pageId');

    let pages = allPages;
    let notes = getNotesByBook(book.id);
    let annotations = getAnnotationsByBook(book.id);
    let chapterTitle: string | undefined;

    if (pageId) {
      const page = allPages.find((p) => p.id === pageId);
      if (!page) {
        return NextResponse.json({ error: 'Page not found' }, { status: 404 });
      }
      pages = [page];
      notes = notes.filter((note) => note.pageId === pageId);
      annotations = annotations.filter((ann) => ann.pageId === pageId);
      chapterTitle = page.title;
    }

    const now = new Date();
    const markdown = buildNotesMarkdown({
      bookTitle: book.title,
      author: book.author,
      pages,
      notes,
      annotations,
      exportedAt: now,
      chapterTitle,
    });
    const fileName = notesExportFileName(book.title, now, chapterTitle);
    return new NextResponse(markdown, {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': `attachment; filename="notes.md"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      },
    });
  } catch (err: any) {
    console.error('API /notes/export GET error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
