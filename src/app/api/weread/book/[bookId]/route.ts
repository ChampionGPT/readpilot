// input: 路径参数 bookId
// output: GET 返回 WereadBookSummary（info + progress + 计数 + lastSyncedAt）
// pos: 单本书聚合 API — BookCard hover 元信息 + WereadStore 的数据源
// 声明：一旦我被更新，务必更新我的开头注释以及所属文件夹的 md。

import { NextRequest, NextResponse } from 'next/server';
import { getBindingByBookId } from '@/lib/db';
import {
  getCachedBookInfo,
  getCachedProgress,
  countCachedBookmarks,
  countCachedReviews,
} from '@/lib/wereadCache';
import type { WereadBookSummary } from '@/types/weread';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ bookId: string }> }) {
  const { bookId } = await params;
  if (!bookId) {
    return NextResponse.json({ error: '缺少 bookId' }, { status: 400 });
  }

  const binding = getBindingByBookId(bookId);
  if (!binding) {
    const empty: WereadBookSummary = {
      bookId, bound: false, bookmarkCount: 0, reviewCount: 0, lastSyncedAt: null,
    };
    return NextResponse.json(empty);
  }

  const summary: WereadBookSummary = {
    bookId,
    bound: true,
    info: getCachedBookInfo(bookId),
    progress: getCachedProgress(bookId),
    bookmarkCount: countCachedBookmarks(bookId),
    reviewCount: countCachedReviews(bookId),
    lastSyncedAt: binding.lastSyncedAt,
  };
  return NextResponse.json(summary);
}
