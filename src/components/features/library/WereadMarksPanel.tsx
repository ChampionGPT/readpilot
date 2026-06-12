/**
 * input: props { bookDir, wereadBookId }
 * output: 紧凑版微读划线面板 — 顶部章节下拉 + 全宽划线/想法 feed
 * pos: BookNotesView 右下方分屏（PanelGroup 的 ResizablePanel）；读 /api/weread/book/[id]/marks
 * 声明：一旦我被更新，务必更新我的开头注释以及所属文件夹的 md。
 */
'use client';

import React, { useEffect, useMemo, useState } from 'react';

interface MarkItem {
  bookmarkId: string;
  markText: string;
  range: string;
  createTime: number;
}

interface ReviewItem {
  reviewId: string;
  abstract: string | null;
  content: string;
  range: string | null;
  star: number | null;
  createTime: number;
}

interface Chapter {
  chapterUid: number;
  chapterTitle: string;
  bookmarks: MarkItem[];
  reviews: ReviewItem[];
}

interface Props {
  bookDir: string;
  wereadBookId: string;
}

function fmtDate(unixSec: number): string {
  if (!unixSec) return '';
  const d = new Date(unixSec * 1000);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function deepLink(wereadBookId: string, chapterUid: number, range: string): string {
  const [start, end] = range.split('-');
  return `weread://bestbookmark?bookId=${wereadBookId}&chapterUid=${chapterUid}&rangeStart=${start}&rangeEnd=${end ?? start}`;
}

function chapterLabel(c: Chapter): string {
  if (c.chapterUid === 0 && !c.chapterTitle) return '整本书评';
  return c.chapterTitle || `第 ${c.chapterUid} 节`;
}

export function WereadMarksPanel({ bookDir, wereadBookId }: Props) {
  void bookDir;
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [activeChapterUid, setActiveChapterUid] = useState<number | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    if (!wereadBookId) return;
    setLoading(true);
    setErr(null);
    fetch(`/api/weread/book/${encodeURIComponent(wereadBookId)}/marks`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((j: { bound: boolean; chapters: Chapter[] }) => {
        setChapters(j.chapters ?? []);
        if (j.chapters?.[0]) setActiveChapterUid(j.chapters[0].chapterUid);
      })
      .catch((e) => setErr(e?.message ?? '加载失败'))
      .finally(() => setLoading(false));
  }, [wereadBookId]);

  const totalMarks = useMemo(() => chapters.reduce((n, c) => n + c.bookmarks.length, 0), [chapters]);
  const totalReviews = useMemo(() => chapters.reduce((n, c) => n + c.reviews.length, 0), [chapters]);
  const activeChapter = chapters.find((c) => c.chapterUid === activeChapterUid);

  if (loading) {
    return <div className="h-full flex items-center justify-center text-sm text-stone-500">加载微读划线中…</div>;
  }
  if (err) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-red-600 px-8 text-center">
        加载微读划线失败：{err}
      </div>
    );
  }
  if (chapters.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-center px-8">
        <div className="max-w-sm">
          <h3 className="text-base font-serif font-bold text-stone-800 mb-1">暂无微读划线</h3>
          <p className="text-xs text-stone-500 leading-relaxed">
            在微信读书 App 阅读时长按文本添加划线，下次同步后会出现在这里。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#FDFBF7]">
      {/* 顶部章节选择条 */}
      <div className="shrink-0 border-b border-stone-200 bg-white/85 backdrop-blur-sm px-5 py-2.5 flex items-center gap-3">
        <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-stone-400">微读</span>
        <div className="relative">
          <button
            type="button"
            onClick={() => setPickerOpen((v) => !v)}
            className="flex items-center gap-1.5 text-sm font-bold text-stone-800 hover:text-stone-600 px-2 py-1 rounded hover:bg-stone-100"
          >
            <span className="max-w-[280px] truncate">
              {activeChapter ? chapterLabel(activeChapter) : '选择章节'}
            </span>
            {activeChapter && (
              <span className="text-[10px] bg-stone-100 text-stone-500 px-1.5 py-0.5 rounded-sm font-bold border border-stone-200">
                {activeChapter.bookmarks.length + activeChapter.reviews.length}
              </span>
            )}
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className={`transition-transform ${pickerOpen ? 'rotate-180' : ''}`}>
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          {pickerOpen && (
            <div className="absolute top-full left-0 mt-1 z-30 max-h-[300px] overflow-y-auto bg-white border border-stone-200 rounded-lg shadow-lg min-w-[260px]">
              {chapters.map((c) => {
                const count = c.bookmarks.length + c.reviews.length;
                const active = c.chapterUid === activeChapterUid;
                return (
                  <button
                    key={c.chapterUid}
                    onClick={() => { setActiveChapterUid(c.chapterUid); setPickerOpen(false); }}
                    className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-stone-50 ${active ? 'bg-stone-100 font-bold' : 'text-stone-700'}`}
                  >
                    <span className="truncate flex-1 font-serif">{chapterLabel(c)}</span>
                    <span className="text-[10px] text-stone-500 shrink-0">{count}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <div className="ml-auto text-xs text-stone-500">
          共 {totalMarks} 划线 · {totalReviews} 想法
        </div>
      </div>

      {/* 章节内容流 */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {!activeChapter ? (
          <div className="text-sm text-stone-400">选择章节查看划线</div>
        ) : (
          <div className="max-w-3xl mx-auto">
            {activeChapter.bookmarks.map((b) => {
              const inlineReviews = activeChapter.reviews.filter((r) => r.range === b.range);
              return (
                <div key={b.bookmarkId} className="mb-4 group">
                  <blockquote className="border-l-4 border-yellow-400/60 bg-yellow-50/40 px-4 py-2.5 rounded-r-md text-stone-800 leading-relaxed font-serif text-sm">
                    {b.markText}
                  </blockquote>
                  <div className="flex items-center gap-3 mt-1 px-1 text-[10px] text-stone-400">
                    <span>{fmtDate(b.createTime)}</span>
                    <a
                      href={deepLink(wereadBookId, activeChapter.chapterUid, b.range)}
                      className="hover:text-primary underline-offset-2 hover:underline"
                    >
                      在微读 App 中打开 →
                    </a>
                  </div>
                  {inlineReviews.map((r) => (
                    <div key={r.reviewId} className="mt-1.5 ml-5 pl-3 py-1.5 border-l-2 border-stone-300 bg-stone-50/60 rounded-r-sm">
                      <div className="text-[9px] uppercase tracking-wider text-stone-400 mb-0.5 font-bold">💭 想法</div>
                      <div className="text-xs text-stone-700 leading-relaxed whitespace-pre-wrap">{r.content}</div>
                    </div>
                  ))}
                </div>
              );
            })}

            {activeChapter.reviews
              .filter((r) => !r.range || !activeChapter.bookmarks.some((b) => b.range === r.range))
              .map((r) => (
                <div key={r.reviewId} className="mb-4 pl-3 py-2 border-l-2 border-stone-400 bg-stone-50 rounded-r-md">
                  <div className="flex items-center gap-2 text-[9px] uppercase tracking-wider text-stone-500 mb-0.5 font-bold">
                    <span>💭 {activeChapter.chapterUid === 0 ? '整本书评' : '章节想法'}</span>
                    {r.star != null && r.star >= 0 && <span>· {'★'.repeat(Math.max(1, Math.round(r.star)))}</span>}
                    <span>· {fmtDate(r.createTime)}</span>
                  </div>
                  {r.abstract && (
                    <blockquote className="text-[11px] text-stone-500 border-l-2 border-stone-300 pl-2 mb-1 italic">
                      {r.abstract}
                    </blockquote>
                  )}
                  <div className="text-xs text-stone-700 leading-relaxed whitespace-pre-wrap">{r.content}</div>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
