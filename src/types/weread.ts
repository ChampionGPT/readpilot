// input: WeRead gateway JSON responses + DB rows
// output: WereadSearchResult, WereadBookmark, WereadReview, WereadHotBookmark, WereadProgress, WereadBookSummary, WereadBindingDTO
// pos: 类型定义层 — 微信读书数据在 API/DB/UI 之间流转的契约
// 声明：一旦我被更新，务必更新我的开头注释以及所属文件夹的 md。

/** /store/search 结果项（裁剪） */
export interface WereadSearchResult {
  bookId: string;
  title: string;
  author: string;
  cover: string;
  intro?: string;
  category?: string;
  newRating?: number;       // 0-100
  newRatingCount?: number;
  readingCount?: number;
  soldout?: number;
}

/** /book/info 裁剪 */
export interface WereadBookInfo {
  bookId: string;
  title: string;
  author: string;
  cover?: string;
  intro?: string;
  category?: string;
  wordCount?: number;
  newRating?: number;
}

/** /book/bookmarklist 单条 */
export interface WereadBookmark {
  bookmarkId: string;
  bookId: string;
  chapterUid: number;
  chapterTitle?: string;
  markText: string;
  range: string;            // "900-2004"
  createTime: number;       // unix sec
  colorStyle?: number;
}

/** /review/list/mine 单条 */
export interface WereadReview {
  reviewId: string;
  bookId: string;
  chapterUid?: number;
  chapterName?: string;
  abstract?: string;
  content: string;
  range?: string;
  star?: number;            // 0-5, -1=无评分
  isFinish?: number;
  createTime: number;
}

/** /book/bestbookmarks 单条 */
export interface WereadHotBookmark {
  bookId: string;
  bookmarkId: string;
  chapterUid: number;
  markText: string;
  range: string;
  totalCount: number;       // 划线人数
}

/** /book/getprogress */
export interface WereadProgress {
  bookId: string;
  progressPercent: number;  // 0-100, 100 = 读完
  chapterUid?: number;
  chapterOffset?: number;
  readingTimeSec?: number;
  finishTime?: number;
  isStartReading?: number;
  wereadUpdateTime?: number;
}

/** GET /api/weread/book/[bookId] 聚合返回 */
export interface WereadBookSummary {
  bookId: string;
  bound: boolean;
  info?: WereadBookInfo;
  progress?: WereadProgress;
  bookmarkCount: number;
  reviewCount: number;
  lastSyncedAt: number | null;
}

/** /api/weread/bind POST body */
export interface WereadBindRequest {
  localBookDir: string;
  wereadBookId: string;
}

/** /api/weread/sync POST body */
export interface WereadSyncRequest {
  localBookDir: string;
  force?: boolean;
  scope?: Array<'info' | 'progress' | 'marks' | 'reviews' | 'hot'>;
}
