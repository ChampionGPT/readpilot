// input: getDb() handle, wereadClient methods
// output: 同步编排（/sync 路由调用）+ 缓存查询（书页/书摘/想法/进度/热门划线）
// pos: 缓存层 — 联系 wereadClient (上游) 和 db.ts (下游) 的业务编排
// 声明：一旦我被更新，务必更新我的开头注释以及所属文件夹的 md。

import { getDb, updateBindingSyncedAt } from './db';
import * as weread from './wereadClient';
import type { WereadBookInfo, WereadProgress, WereadBookmark, WereadReview, WereadHotBookmark } from '@/types/weread';

const SIX_HOURS_SEC = 6 * 60 * 60;

export type SyncScope = 'info' | 'progress' | 'marks' | 'reviews' | 'hot';
const ALL_SCOPES: SyncScope[] = ['info', 'progress', 'marks', 'reviews', 'hot'];

export interface SyncResult {
  bookId: string;
  ran: SyncScope[];
  skipped: SyncScope[];
  errors: Array<{ scope: SyncScope; message: string }>;
}

/** 缓存是否新鲜（默认 6h 阈值）。`force=true` 一律返回 false 触发重拉 */
function isFresh(fetchedAt: number | undefined | null, force: boolean): boolean {
  if (force) return false;
  if (!fetchedAt) return false;
  const now = Math.floor(Date.now() / 1000);
  return (now - fetchedAt) < SIX_HOURS_SEC;
}

// ── per-scope sync ──

async function syncInfo(bookId: string, force: boolean): Promise<'ran' | 'skipped'> {
  const db = getDb();
  const row = db.prepare('SELECT fetched_at FROM weread_books WHERE book_id = ?').get(bookId) as any;
  if (isFresh(row?.fetched_at, force)) return 'skipped';

  const info = await weread.bookInfo(bookId);
  const now = Math.floor(Date.now() / 1000);
  db.prepare(`
    INSERT INTO weread_books (book_id, title, author, cover, intro, category, word_count, new_rating, raw_json, fetched_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(book_id) DO UPDATE SET
      title=excluded.title, author=excluded.author, cover=excluded.cover,
      intro=excluded.intro, category=excluded.category, word_count=excluded.word_count,
      new_rating=excluded.new_rating, raw_json=excluded.raw_json, fetched_at=excluded.fetched_at
  `).run(info.bookId, info.title, info.author, info.cover ?? null, info.intro ?? null, info.category ?? null,
        info.wordCount ?? null, info.newRating ?? null, JSON.stringify(info), now);
  return 'ran';
}

async function syncProgress(bookId: string, force: boolean): Promise<'ran' | 'skipped'> {
  const db = getDb();
  const row = db.prepare('SELECT fetched_at FROM weread_progress WHERE book_id = ?').get(bookId) as any;
  if (isFresh(row?.fetched_at, force)) return 'skipped';

  const p = await weread.progress(bookId);
  const now = Math.floor(Date.now() / 1000);
  db.prepare(`
    INSERT INTO weread_progress (book_id, progress_percent, chapter_uid, chapter_offset, reading_time_sec, finish_time, is_start_reading, weread_update_time, fetched_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(book_id) DO UPDATE SET
      progress_percent=excluded.progress_percent, chapter_uid=excluded.chapter_uid,
      chapter_offset=excluded.chapter_offset, reading_time_sec=excluded.reading_time_sec,
      finish_time=excluded.finish_time, is_start_reading=excluded.is_start_reading,
      weread_update_time=excluded.weread_update_time, fetched_at=excluded.fetched_at
  `).run(p.bookId, p.progressPercent, p.chapterUid ?? null, p.chapterOffset ?? null,
        p.readingTimeSec ?? null, p.finishTime ?? null, p.isStartReading ?? null, p.wereadUpdateTime ?? null, now);
  return 'ran';
}

async function syncMarks(bookId: string, force: boolean): Promise<'ran' | 'skipped'> {
  const db = getDb();
  const row = db.prepare('SELECT MAX(fetched_at) AS f FROM weread_bookmarks WHERE book_id = ?').get(bookId) as any;
  if (isFresh(row?.f, force)) return 'skipped';

  const { marks } = await weread.bookmarkList(bookId);
  const now = Math.floor(Date.now() / 1000);

  const tx = db.transaction((items: WereadBookmark[]) => {
    db.prepare('DELETE FROM weread_bookmarks WHERE book_id = ?').run(bookId);
    const stmt = db.prepare(`
      INSERT INTO weread_bookmarks (bookmark_id, book_id, chapter_uid, chapter_title, mark_text, range_str, range_start, color_style, created_at, fetched_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const m of items) {
      const rangeStart = parseInt((m.range ?? '0').split('-')[0], 10) || 0;
      stmt.run(m.bookmarkId, m.bookId, m.chapterUid, m.chapterTitle ?? null, m.markText,
               m.range, rangeStart, m.colorStyle ?? null, m.createTime, now);
    }
  });
  tx(marks);
  return 'ran';
}

async function syncReviews(bookId: string, force: boolean): Promise<'ran' | 'skipped'> {
  const db = getDb();
  const row = db.prepare('SELECT MAX(fetched_at) AS f FROM weread_reviews WHERE book_id = ?').get(bookId) as any;
  if (isFresh(row?.f, force)) return 'skipped';

  const reviews = await weread.reviewListMine(bookId);
  const now = Math.floor(Date.now() / 1000);

  const tx = db.transaction((items: WereadReview[]) => {
    db.prepare('DELETE FROM weread_reviews WHERE book_id = ?').run(bookId);
    const stmt = db.prepare(`
      INSERT INTO weread_reviews (review_id, book_id, chapter_uid, chapter_name, abstract, content, range_str, star, is_finish, created_at, fetched_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const r of items) {
      stmt.run(r.reviewId, bookId, r.chapterUid ?? null, r.chapterName ?? null, r.abstract ?? null,
               r.content, r.range ?? null, r.star ?? null, r.isFinish ?? null, r.createTime, now);
    }
  });
  tx(reviews);
  return 'ran';
}

async function syncHot(bookId: string, force: boolean): Promise<'ran' | 'skipped'> {
  const db = getDb();
  const row = db.prepare('SELECT MAX(fetched_at) AS f FROM weread_hot_bookmarks WHERE book_id = ?').get(bookId) as any;
  if (isFresh(row?.f, force)) return 'skipped';

  const items = await weread.bestBookmarks(bookId);
  const now = Math.floor(Date.now() / 1000);

  const tx = db.transaction((list: WereadHotBookmark[]) => {
    db.prepare('DELETE FROM weread_hot_bookmarks WHERE book_id = ?').run(bookId);
    const stmt = db.prepare(`
      INSERT INTO weread_hot_bookmarks (book_id, bookmark_id, chapter_uid, mark_text, range_str, total_count, fetched_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    for (const it of list) {
      stmt.run(it.bookId, it.bookmarkId, it.chapterUid, it.markText, it.range, it.totalCount, now);
    }
  });
  tx(items);
  return 'ran';
}

const SYNC_FNS: Record<SyncScope, (id: string, force: boolean) => Promise<'ran' | 'skipped'>> = {
  info: syncInfo,
  progress: syncProgress,
  marks: syncMarks,
  reviews: syncReviews,
  hot: syncHot,
};

/** 主同步编排：按 scope 串行执行，单 scope 失败不阻塞其他 */
export async function syncBook(
  localBookDir: string,
  bookId: string,
  opts: { force?: boolean; scope?: SyncScope[] } = {}
): Promise<SyncResult> {
  const force = opts.force ?? false;
  const scopes = opts.scope ?? ALL_SCOPES;
  const result: SyncResult = { bookId, ran: [], skipped: [], errors: [] };

  for (const s of scopes) {
    try {
      const status = await SYNC_FNS[s](bookId, force);
      if (status === 'ran') result.ran.push(s);
      else result.skipped.push(s);
    } catch (e: any) {
      result.errors.push({ scope: s, message: e?.message ?? String(e) });
    }
  }

  updateBindingSyncedAt(localBookDir, Math.floor(Date.now() / 1000));
  return result;
}

// ── cache reads (for /api/weread/book/[bookId]) ──

export function getCachedBookInfo(bookId: string): WereadBookInfo | undefined {
  const db = getDb();
  const row = db.prepare('SELECT * FROM weread_books WHERE book_id = ?').get(bookId) as any;
  if (!row) return undefined;
  return {
    bookId: row.book_id,
    title: row.title ?? '',
    author: row.author ?? '',
    cover: row.cover ?? undefined,
    intro: row.intro ?? undefined,
    category: row.category ?? undefined,
    wordCount: row.word_count ?? undefined,
    newRating: row.new_rating ?? undefined,
  };
}

export function getCachedProgress(bookId: string): WereadProgress | undefined {
  const db = getDb();
  const row = db.prepare('SELECT * FROM weread_progress WHERE book_id = ?').get(bookId) as any;
  if (!row) return undefined;
  return {
    bookId: row.book_id,
    progressPercent: row.progress_percent ?? 0,
    chapterUid: row.chapter_uid ?? undefined,
    chapterOffset: row.chapter_offset ?? undefined,
    readingTimeSec: row.reading_time_sec ?? undefined,
    finishTime: row.finish_time ?? undefined,
    isStartReading: row.is_start_reading ?? undefined,
    wereadUpdateTime: row.weread_update_time ?? undefined,
  };
}

export function countCachedBookmarks(bookId: string): number {
  const db = getDb();
  const r = db.prepare('SELECT COUNT(*) AS c FROM weread_bookmarks WHERE book_id = ?').get(bookId) as any;
  return r?.c ?? 0;
}

export function countCachedReviews(bookId: string): number {
  const db = getDb();
  const r = db.prepare('SELECT COUNT(*) AS c FROM weread_reviews WHERE book_id = ?').get(bookId) as any;
  return r?.c ?? 0;
}

// ── chapter-aggregated reads (for /api/weread/book/[bookId]/marks) ──

export interface WereadChapterMarks {
  chapterUid: number;
  chapterTitle: string;          // 章节标题；reviews 用 chapter_name；空字符串 fallback
  bookmarks: Array<{
    bookmarkId: string;
    markText: string;
    range: string;
    createTime: number;          // unix sec
  }>;
  reviews: Array<{
    reviewId: string;
    abstract: string | null;     // 关联划线原文（divider 想法时）
    content: string;
    range: string | null;
    star: number | null;
    createTime: number;
  }>;
}

/** 单本书所有划线 + 想法按章节分组；按 chapter_uid 升序，同章节内按 range_start 升序 */
export function getChapterMarks(bookId: string): WereadChapterMarks[] {
  const db = getDb();
  const bookmarks = db.prepare(`
    SELECT bookmark_id, chapter_uid, chapter_title, mark_text, range_str, created_at
    FROM weread_bookmarks
    WHERE book_id = ?
    ORDER BY chapter_uid ASC, range_start ASC
  `).all(bookId) as Array<{
    bookmark_id: string; chapter_uid: number; chapter_title: string | null;
    mark_text: string; range_str: string; created_at: number;
  }>;

  const reviews = db.prepare(`
    SELECT review_id, chapter_uid, chapter_name, abstract, content, range_str, star, created_at
    FROM weread_reviews
    WHERE book_id = ?
    ORDER BY chapter_uid ASC, created_at ASC
  `).all(bookId) as Array<{
    review_id: string; chapter_uid: number | null; chapter_name: string | null;
    abstract: string | null; content: string; range_str: string | null;
    star: number | null; created_at: number;
  }>;

  const byChapter = new Map<number, WereadChapterMarks>();
  const ensure = (uid: number, title: string): WereadChapterMarks => {
    let c = byChapter.get(uid);
    if (!c) {
      c = { chapterUid: uid, chapterTitle: title, bookmarks: [], reviews: [] };
      byChapter.set(uid, c);
    }
    if (!c.chapterTitle && title) c.chapterTitle = title;
    return c;
  };

  for (const b of bookmarks) {
    const c = ensure(b.chapter_uid, b.chapter_title ?? '');
    c.bookmarks.push({
      bookmarkId: b.bookmark_id,
      markText: b.mark_text,
      range: b.range_str,
      createTime: b.created_at,
    });
  }

  for (const r of reviews) {
    // 整本书评 chapter_uid 可能为 null —— 单独归到 0 桶（前端按 0 渲染"整本书评"）
    const uid = r.chapter_uid ?? 0;
    const c = ensure(uid, r.chapter_name ?? '');
    c.reviews.push({
      reviewId: r.review_id,
      abstract: r.abstract,
      content: r.content,
      range: r.range_str,
      star: r.star,
      createTime: r.created_at,
    });
  }

  return Array.from(byChapter.values()).sort((a, b) => a.chapterUid - b.chapterUid);
}
