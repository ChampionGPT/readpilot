// input: bookDir (URL param), db.ts (annotations CRUD + weread 导入), files.ts (resolveBookDir)
// output: GET (列出该书标注，支持 ?pageId= 与 ?syncWeread=1), POST (创建标注)
// pos: 阅读标注 API — 与 annotations 表交互
// 声明：一旦我被更新，务必更新我的开头注释以及所属文件夹的 md。

import { NextRequest, NextResponse } from 'next/server';
import {
  getDb, getAnnotationsByBook, getAnnotationsByPage, createAnnotation,
  importWereadAnnotations, getLinksByAnnotations,
} from '@/lib/db';
import { resolveBookDir } from '@/lib/files';

/** 解析 bookDir 参数为真实的 book.id */
function resolveBookId(bookDir: string): string | null {
  if (!resolveBookDir(bookDir)) return null;
  const db = getDb();
  const row = db.prepare('SELECT id FROM books WHERE data_dir = ?').get(bookDir) as any;
  return row?.id || null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ bookDir: string }> }
) {
  const { bookDir } = await params;
  const dir = decodeURIComponent(bookDir);
  const bookId = resolveBookId(dir);
  if (!bookId) {
    return NextResponse.json({ error: 'Book not found' }, { status: 404 });
  }
  try {
    const url = new URL(req.url);
    if (url.searchParams.get('syncWeread') === '1') {
      const db = getDb();
      const binding = db.prepare(
        'SELECT weread_book_id FROM weread_bindings WHERE local_book_dir = ?'
      ).get(dir) as any;
      if (binding?.weread_book_id) {
        importWereadAnnotations(bookId, binding.weread_book_id);
      }
    }
    const pageId = url.searchParams.get('pageId');
    const annotations = pageId
      ? getAnnotationsByPage(bookId, pageId)
      : getAnnotationsByBook(bookId);
    const links = getLinksByAnnotations(annotations.map(a => a.id));
    return NextResponse.json({ annotations, links });
  } catch (err: any) {
    console.error('API /annotations GET error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
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
    if (typeof body.quote !== 'string' || !body.quote.trim()) {
      return NextResponse.json({ error: 'quote is required' }, { status: 400 });
    }
    const annotation = createAnnotation(bookId, body);
    return NextResponse.json(annotation, { status: 201 });
  } catch (err: any) {
    console.error('API /annotations POST error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
