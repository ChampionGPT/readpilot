/**
 * input: pages, currentPage, onBack, onPageChange, theme controls
 * output: Reading toolbar with stable icon controls, TOC menu, related-page menu, and theme segmented control
 * pos: ReaderApp 在 viewMode='page' 时挂载于 iframe 上方
 * 声明：一旦我被更新，务必更新我的开头注释以及所属文件夹的 md。
 */
"use client";

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, BookOpen, ChevronLeft, ChevronRight, FileText, ListTree, Palette, Sparkles } from 'lucide-react';
import type { ProgressPage } from '@/types/progress-data';
import type { ThemeMode } from '@/store/useBookStore';

interface Props {
  pages: ProgressPage[];
  currentPage: ProgressPage;
  theme: ThemeMode;
  onBack: () => void;
  onPageChange: (p: ProgressPage) => void;
  onThemeChange: (theme: ThemeMode) => void;
}

const THEME_OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: 'classic', label: '书页' },
  { value: 'modern', label: '清爽' },
  { value: 'magazine', label: '杂志' },
];

function ToolbarButton({
  children,
  label,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface disabled:cursor-not-allowed disabled:opacity-30"
    >
      {children}
    </button>
  );
}

function MenuPanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute right-0 z-30 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-md border border-outline-variant/30 bg-surface-container-lowest shadow-xl">
      {children}
    </div>
  );
}

export function EpubReaderHeader({ pages, currentPage, theme, onBack, onPageChange, onThemeChange }: Props) {
  const isChapter = currentPage.type === 'chapter';
  const chapters = pages.filter((p) => p.type === 'chapter');
  const currentChapterIndex = chapters.findIndex((p) => p.id === currentPage.id);
  const prevChapter = currentChapterIndex > 0 ? chapters[currentChapterIndex - 1] : null;
  const nextChapter =
    currentChapterIndex >= 0 && currentChapterIndex < chapters.length - 1
      ? chapters[currentChapterIndex + 1]
      : null;

  const related = isChapter
    ? pages.filter((p) => p.type !== 'chapter' && p.relatedChapters.includes(currentPage.title))
    : [];
  const linkedChapters = !isChapter
    ? currentPage.relatedChapters
        .map((title) => chapters.find((c) => c.title === title))
        .filter((c): c is ProgressPage => c !== undefined)
    : [];

  const [openMenu, setOpenMenu] = useState<'toc' | 'related' | null>(null);
  const tocRef = useRef<HTMLDivElement>(null);
  const relatedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (document.activeElement?.tagName ?? '').toUpperCase();
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'Escape') {
        if (openMenu) {
          setOpenMenu(null);
          return;
        }
        onBack();
        return;
      }
      if (!isChapter) return;
      if (e.key === 'ArrowLeft' && prevChapter) onPageChange(prevChapter);
      if (e.key === 'ArrowRight' && nextChapter) onPageChange(nextChapter);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isChapter, nextChapter, onBack, onPageChange, openMenu, prevChapter]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (openMenu === 'toc' && tocRef.current && !tocRef.current.contains(target)) setOpenMenu(null);
      if (openMenu === 'related' && relatedRef.current && !relatedRef.current.contains(target)) setOpenMenu(null);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [openMenu]);

  return (
    <div className="sticky top-0 z-10 border-b border-outline-variant/15 bg-surface/90 backdrop-blur-md">
      <div className="grid h-14 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-3 md:px-4">
        <div className="flex min-w-0 items-center gap-1">
          <ToolbarButton label="回到 Hub" onClick={onBack}>
            <ArrowLeft size={18} />
          </ToolbarButton>
          <div className="hidden min-w-0 items-center gap-2 text-xs text-on-surface-variant md:flex">
            <BookOpen size={14} />
            <span className="truncate">{isChapter ? '原文阅读' : '伴读页'}</span>
          </div>
        </div>

        <div className="min-w-0 text-center">
          <div className="truncate text-sm font-semibold text-on-surface">{currentPage.title}</div>
          <div className="truncate text-[11px] text-on-surface-variant">
            {isChapter ? `${Math.max(currentChapterIndex + 1, 1)} / ${chapters.length}` : currentPage.type}
          </div>
        </div>

        <div className="flex min-w-0 items-center justify-end gap-1">
          <div className="hidden h-8 shrink-0 items-center gap-1 rounded-md border border-outline-variant/20 bg-surface-container p-1 lg:flex">
            <Palette size={14} className="ml-1 text-on-surface-variant" />
            {THEME_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onThemeChange(opt.value)}
                aria-pressed={theme === opt.value}
                className={`h-6 rounded px-2 text-[11px] font-semibold transition-colors ${
                  theme === opt.value
                    ? 'bg-surface-container-lowest text-primary shadow-sm'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {isChapter ? (
            <>
              <ToolbarButton label="上一章" disabled={!prevChapter} onClick={() => prevChapter && onPageChange(prevChapter)}>
                <ChevronLeft size={18} />
              </ToolbarButton>
              <ToolbarButton label="下一章" disabled={!nextChapter} onClick={() => nextChapter && onPageChange(nextChapter)}>
                <ChevronRight size={18} />
              </ToolbarButton>

              <div className="relative" ref={tocRef}>
                <ToolbarButton label="目录" onClick={() => setOpenMenu(openMenu === 'toc' ? null : 'toc')}>
                  <ListTree size={18} />
                </ToolbarButton>
                {openMenu === 'toc' && (
                  <MenuPanel>
                    <div className="max-h-96 overflow-y-auto py-1">
                      {chapters.map((chapter, index) => (
                        <button
                          key={chapter.id}
                          type="button"
                          onClick={() => {
                            onPageChange(chapter);
                            setOpenMenu(null);
                          }}
                          className={`grid w-full grid-cols-[2rem_minmax(0,1fr)] items-start gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-surface-container ${
                            chapter.id === currentPage.id ? 'text-primary' : 'text-on-surface'
                          }`}
                        >
                          <span className="text-right text-xs text-on-surface-variant">{index + 1}</span>
                          <span className="line-clamp-2">{chapter.title}</span>
                        </button>
                      ))}
                    </div>
                  </MenuPanel>
                )}
              </div>

              <div className="relative" ref={relatedRef}>
                <ToolbarButton
                  label="相关解读"
                  disabled={related.length === 0}
                  onClick={() => setOpenMenu(openMenu === 'related' ? null : 'related')}
                >
                  <Sparkles size={18} />
                </ToolbarButton>
                {openMenu === 'related' && related.length > 0 && (
                  <MenuPanel>
                    <div className="max-h-80 overflow-y-auto py-1">
                      {related.map((page) => (
                        <button
                          key={page.id}
                          type="button"
                          onClick={() => {
                            onPageChange(page);
                            setOpenMenu(null);
                          }}
                          className="grid w-full grid-cols-[1.25rem_minmax(0,1fr)] items-start gap-2 px-3 py-2 text-left text-sm text-on-surface transition-colors hover:bg-surface-container"
                        >
                          <FileText size={14} className="mt-0.5 text-on-surface-variant" />
                          <span>
                            <span className="block line-clamp-1">{page.title}</span>
                            <span className="block text-[11px] uppercase tracking-wide text-on-surface-variant">{page.type}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </MenuPanel>
                )}
              </div>
            </>
          ) : linkedChapters.length > 0 ? (
            <div className="relative" ref={relatedRef}>
              <ToolbarButton
                label="回到原文"
                onClick={() => {
                  if (linkedChapters.length === 1) onPageChange(linkedChapters[0]);
                  else setOpenMenu(openMenu === 'related' ? null : 'related');
                }}
              >
                <BookOpen size={18} />
              </ToolbarButton>
              {openMenu === 'related' && linkedChapters.length > 1 && (
                <MenuPanel>
                  <div className="py-1">
                    {linkedChapters.map((chapter) => (
                      <button
                        key={chapter.id}
                        type="button"
                        onClick={() => {
                          onPageChange(chapter);
                          setOpenMenu(null);
                        }}
                        className="w-full px-3 py-2 text-left text-sm text-on-surface transition-colors hover:bg-surface-container"
                      >
                        {chapter.title}
                      </button>
                    ))}
                  </div>
                </MenuPanel>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
