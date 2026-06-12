// input: 路径参数 bookId
// output: GET 返回 { bound, chapters: WereadChapterMarks[], totalBookmarks, totalReviews }
// pos: 单本书划线+想法聚合 API — WereadMarksPanel + wereadContextBuilder 共用
// 声明：一旦我被更新，务必更新我的开头注释以及所属文件夹的 md。

import { NextRequest, NextResponse } from 'next/server';
import { getBindingByBookId } from '@/lib/db';
import { getChapterMarks } from '@/lib/wereadCache';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ bookId: string }> }) {
  const { bookId } = await params;
  if (!bookId) {
    return NextResponse.json({ error: '缺少 bookId' }, { status: 400 });
  }

  const binding = getBindingByBookId(bookId);
  if (!binding) {
    return NextResponse.json({ bound: false, chapters: [], totalBookmarks: 0, totalReviews: 0 });
  }

  const chapters = getChapterMarks(bookId);
  const totalBookmarks = chapters.reduce((n, c) => n + c.bookmarks.length, 0);
  const totalReviews = chapters.reduce((n, c) => n + c.reviews.length, 0);

  return NextResponse.json({ bound: true, chapters, totalBookmarks, totalReviews });
}
