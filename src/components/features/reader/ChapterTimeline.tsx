/**
 * input: progress pages and page click callback
 * output: Chapter-first timeline with companion reading pages attached to chapters
 * pos: Main content section of the book Hub.
 */
"use client";

import { BookOpen, CheckCircle2, Circle, Clock3, FileText } from "lucide-react";
import type { ProgressPage } from "@/types/progress-data";
import { PAGE_TYPE_COLORS } from "@/components/features/library/note-constants";

interface Props {
  pages: ProgressPage[];
  onPageClick: (page: ProgressPage) => void;
}

function StatusBadge({ status }: { status: ProgressPage["status"] }) {
  if (status === "completed") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-100">
        <CheckCircle2 size={12} />
        已读
      </span>
    );
  }

  if (status === "in-progress") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#D94F30]/10 px-2 py-1 text-[11px] font-semibold text-[#D94F30] ring-1 ring-[#D94F30]/20">
        <Clock3 size={12} />
        阅读中
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2 py-1 text-[11px] font-semibold text-stone-500 ring-1 ring-stone-200">
      <Circle size={12} />
      未读
    </span>
  );
}

function chapterDisplayTitle(chapter: ProgressPage, index: number): string {
  if (chapter.title && chapter.title !== "（無標題）") return chapter.title;
  return `未命名片段 ${index + 1}`;
}

export function ChapterTimeline({ pages, onPageClick }: Props) {
  const overviews = pages.filter((page) => page.type === "overview" || page.type === "synthesis");
  const chapters = pages.filter((page) => page.type === "chapter");
  const companionPages = pages.filter((page) => page.type !== "chapter");

  return (
    <div className="space-y-8">
      {overviews.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between border-b border-stone-200 pb-2">
            <h2 className="text-sm font-semibold text-stone-900">全书入口</h2>
            <span className="text-xs text-stone-500">{overviews.length} 个概览</span>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {overviews.map((page) => {
              const typeInfo = PAGE_TYPE_COLORS[page.type] || PAGE_TYPE_COLORS.overview;
              return (
                <button
                  key={page.id}
                  type="button"
                  onClick={() => onPageClick(page)}
                  className="rounded-md border border-stone-200 bg-white p-4 text-left transition-colors hover:border-[#D94F30]/40"
                >
                  <div className="mb-2 flex items-center gap-2">
                    <span className={`rounded px-2 py-0.5 text-[11px] font-semibold ${typeInfo.bg} ${typeInfo.text}`}>
                      {typeInfo.label}
                    </span>
                  </div>
                  <div className="line-clamp-1 font-semibold text-stone-900">{page.title}</div>
                  {page.description && <div className="mt-1 line-clamp-2 text-sm leading-6 text-stone-500">{page.description}</div>}
                </button>
              );
            })}
          </div>
        </section>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between border-b border-stone-200 pb-2">
          <h2 className="text-sm font-semibold text-stone-900">章节路径</h2>
          <span className="text-xs text-stone-500">{chapters.length} 章</span>
        </div>
        <div className="space-y-3">
          {chapters.map((chapter, index) => {
            const related = companionPages.filter((page) => page.relatedChapters.includes(chapter.title));
            const active = chapter.status === "in-progress";
            const title = chapterDisplayTitle(chapter, index);

            return (
              <article
                key={chapter.id}
                className={`rounded-md border bg-white ${
                  active ? "border-[#D94F30]/35 ring-2 ring-[#D94F30]/10" : "border-stone-200"
                }`}
              >
                <button
                  type="button"
                  onClick={() => onPageClick(chapter)}
                  className="flex w-full items-start gap-4 p-4 text-left transition-colors hover:bg-stone-50"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F6F1EA] text-sm font-semibold text-stone-700 ring-1 ring-stone-200">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="mb-1 flex items-center gap-2">
                      <BookOpen size={15} className="text-stone-400" />
                      <span className="truncate font-semibold text-stone-900">{title}</span>
                    </span>
                    {chapter.description && <span className="line-clamp-2 text-sm leading-6 text-stone-500">{chapter.description}</span>}
                  </span>
                  <StatusBadge status={chapter.status} />
                </button>

                <div className="border-t border-stone-100 px-4 py-3">
                  {related.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {related.map((page) => {
                        const typeInfo = PAGE_TYPE_COLORS[page.type] || PAGE_TYPE_COLORS.overview;
                        return (
                          <button
                            key={page.id}
                            type="button"
                            onClick={() => onPageClick(page)}
                            className="inline-flex max-w-full items-center gap-2 rounded-md border border-stone-200 bg-[#FBF7F0] px-3 py-1.5 text-sm text-stone-700 transition-colors hover:border-[#D94F30]/40 hover:bg-white"
                          >
                            <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${typeInfo.bg} ${typeInfo.text}`}>
                              {typeInfo.label}
                            </span>
                            <span className="truncate">{page.title}</span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-xs text-stone-400">
                      <FileText size={13} />
                      <span>暂无伴读页</span>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
