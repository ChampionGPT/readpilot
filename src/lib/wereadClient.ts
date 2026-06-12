// input: WEREAD_API_KEY (来自 settings 表) + 各业务参数
// output: 微信读书 gateway 调用的唯一服务端出口；裁剪后的领域对象
// pos: 网关客户端 — 所有微读接口的统一进出口；处理 auth/upgrade_info/errcode
// 声明：一旦我被更新，务必更新我的开头注释以及所属文件夹的 md。

import { getSetting } from './db';
import type {
  WereadSearchResult,
  WereadBookInfo,
  WereadBookmark,
  WereadReview,
  WereadHotBookmark,
  WereadProgress,
} from '@/types/weread';

const GATEWAY_URL = 'https://i.weread.qq.com/api/agent/gateway';
const SKILL_VERSION = '1.0.3';

export class WereadAuthError extends Error {
  constructor(msg = 'WEREAD_API_KEY 未设置') {
    super(msg);
    this.name = 'WereadAuthError';
  }
}

export class WereadApiError extends Error {
  constructor(public code: number, msg: string) {
    super(`[weread:${code}] ${msg}`);
    this.name = 'WereadApiError';
  }
}

async function callGateway<T = any>(apiName: string, body: Record<string, unknown> = {}): Promise<T> {
  const apiKey = getSetting('weread_api_key');
  if (!apiKey || apiKey.trim() === '') {
    throw new WereadAuthError();
  }

  const res = await fetch(GATEWAY_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      api_name: apiName,
      skill_version: SKILL_VERSION,
      ...body,
    }),
  });

  if (!res.ok) {
    throw new WereadApiError(res.status, `HTTP ${res.status} ${res.statusText}`);
  }

  const json = await res.json() as any;

  if (json.upgrade_info) {
    console.warn('[wereadClient] upgrade_info:', json.upgrade_info.message ?? json.upgrade_info);
  }

  if (typeof json.errcode === 'number' && json.errcode !== 0) {
    throw new WereadApiError(json.errcode, json.errmsg ?? '微读接口错误');
  }

  return json as T;
}

// ── Search ──

export async function search(keyword: string, opts: { scope?: number; count?: number } = {}): Promise<WereadSearchResult[]> {
  const body: Record<string, unknown> = {
    keyword,
    scope: opts.scope ?? 10,
  };
  if (opts.count !== undefined) body.count = opts.count;

  const raw = await callGateway('/store/search', body);
  const results: WereadSearchResult[] = [];
  for (const group of raw?.results ?? []) {
    for (const item of group.books ?? []) {
      const bi = item.bookInfo ?? {};
      results.push({
        bookId: bi.bookId,
        title: bi.title ?? '',
        author: bi.author ?? '',
        cover: bi.cover ?? '',
        intro: bi.intro,
        category: bi.category,
        newRating: item.newRating,
        newRatingCount: item.newRatingCount,
        readingCount: item.readingCount,
        soldout: bi.soldout,
      });
    }
  }
  return results;
}

// ── Book info / progress ──

export async function bookInfo(bookId: string): Promise<WereadBookInfo> {
  const raw = await callGateway('/book/info', { bookId });
  return {
    bookId: raw.bookId,
    title: raw.title ?? '',
    author: raw.author ?? '',
    cover: raw.cover,
    intro: raw.intro,
    category: raw.category,
    wordCount: raw.wordCount,
    newRating: raw.newRating,
  };
}

export async function progress(bookId: string): Promise<WereadProgress> {
  const raw = await callGateway('/book/getprogress', { bookId });
  const b = raw?.book ?? {};
  return {
    bookId: raw.bookId ?? bookId,
    progressPercent: b.progress ?? 0,
    chapterUid: b.chapterUid,
    chapterOffset: b.chapterOffset,
    readingTimeSec: b.recordReadingTime,
    finishTime: b.finishTime,
    isStartReading: b.isStartReading,
    wereadUpdateTime: b.updateTime,
  };
}

// ── Marks / reviews / hot ──

export async function bookmarkList(bookId: string): Promise<{ marks: WereadBookmark[]; chaptersByUid: Record<number, string> }> {
  const raw = await callGateway('/book/bookmarklist', { bookId });
  const chaptersByUid: Record<number, string> = {};
  for (const c of raw?.chapters ?? []) {
    chaptersByUid[c.chapterUid] = c.title ?? '';
  }
  const marks: WereadBookmark[] = (raw?.updated ?? []).map((m: any) => ({
    bookmarkId: m.bookmarkId,
    bookId: m.bookId,
    chapterUid: m.chapterUid,
    chapterTitle: chaptersByUid[m.chapterUid],
    markText: m.markText ?? '',
    range: m.range ?? '',
    createTime: m.createTime ?? 0,
    colorStyle: m.colorStyle,
  }));
  return { marks, chaptersByUid };
}

export async function reviewListMine(bookId: string): Promise<WereadReview[]> {
  // /review/list/mine uses lowercase bookid (per notes.md)
  const out: WereadReview[] = [];
  let synckey = 0;
  for (let safety = 0; safety < 50; safety++) {
    const raw = await callGateway('/review/list/mine', { bookid: bookId, synckey, count: 50 });
    for (const r of raw?.reviews ?? []) {
      const rv = r.review ?? {};
      out.push({
        reviewId: rv.reviewId,
        bookId,
        chapterUid: rv.chapterUid,
        chapterName: rv.chapterName,
        abstract: rv.abstract,
        content: rv.content ?? '',
        range: rv.range,
        star: rv.star,
        isFinish: rv.isFinish,
        createTime: rv.createTime ?? 0,
      });
    }
    if (!raw?.hasMore) break;
    synckey = raw.synckey ?? synckey;
    if (!synckey) break;
  }
  return out;
}

export async function bestBookmarks(bookId: string): Promise<WereadHotBookmark[]> {
  const raw = await callGateway('/book/bestbookmarks', { bookId });
  return (raw?.items ?? []).map((it: any) => ({
    bookId: it.bookId,
    bookmarkId: it.bookmarkId,
    chapterUid: it.chapterUid,
    markText: it.markText ?? '',
    range: it.range ?? '',
    totalCount: it.totalCount ?? 0,
  }));
}
