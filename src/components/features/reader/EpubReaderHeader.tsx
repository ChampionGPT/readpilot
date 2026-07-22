/**
 * input: pages, current page, back action, and chapter navigation callback
 * output: Lightweight reading identity and previous/next chapter header
 * pos: ReaderApp page-mode header above the reading canvas and utility rail
 */
"use client";

import { ArrowLeft, BookOpen, ChevronLeft, ChevronRight } from "lucide-react";
import type { ProgressPage } from "@/types/progress-data";

interface Props {
  pages: ProgressPage[];
  currentPage: ProgressPage;
  /** 返回按钮的目标描述（随进入来源变化，如「返回工作台」「返回笔记」） */
  backLabel?: string;
  onBack: () => void;
  onPageChange: (page: ProgressPage) => void;
}

function isSourceChapter(page: ProgressPage): boolean {
  return page.type === "chapter" && /^chap-\d+$/i.test(page.id);
}

function HeaderButton({ label, disabled, onClick, children }: { label: string; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-stone-500 transition-colors hover:bg-stone-200/70 hover:text-stone-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D94F30] disabled:cursor-not-allowed disabled:opacity-30">
      {children}
    </button>
  );
}

export function EpubReaderHeader({ pages, currentPage, backLabel = "返回工作台", onBack, onPageChange }: Props) {
  const chapters = pages.filter(isSourceChapter);
  const currentIndex = chapters.findIndex((page) => page.id === currentPage.id);
  const previous = currentIndex > 0 ? chapters[currentIndex - 1] : null;
  const next = currentIndex >= 0 && currentIndex < chapters.length - 1 ? chapters[currentIndex + 1] : null;

  return (
    <header className="border-b border-stone-200 bg-[#FAF7F2]/95 backdrop-blur-sm">
      <div className="grid h-12 grid-cols-[3rem_minmax(0,1fr)_5rem] items-center px-2 md:grid-cols-[10rem_minmax(0,1fr)_10rem] md:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <HeaderButton label={backLabel} onClick={onBack}><ArrowLeft size={18} /></HeaderButton>
          <span className="hidden items-center gap-2 truncate text-xs text-stone-500 md:flex"><BookOpen size={14} />{backLabel.replace("返回", "")}</span>
        </div>
        <div className="min-w-0 text-center">
          <div className="truncate text-sm font-semibold text-stone-900">{currentPage.title}</div>
          <div className="text-[11px] text-stone-500">{currentIndex >= 0 ? `${currentIndex + 1} / ${chapters.length}` : currentPage.type}</div>
        </div>
        <div className="flex justify-end">
          <HeaderButton label="上一章" disabled={!previous} onClick={() => previous && onPageChange(previous)}><ChevronLeft size={18} /></HeaderButton>
          <HeaderButton label="下一章" disabled={!next} onClick={() => next && onPageChange(next)}><ChevronRight size={18} /></HeaderButton>
        </div>
      </div>
    </header>
  );
}
