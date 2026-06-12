/**
 * input: 外部传入的 BookInfo 资源 + 可选 onDelete + 可选 onOpenBind
 * output: 渲染稳定尺寸的单本书籍卡片（hover 出现删除按钮 + 阅读箭头）+ 微读绑定 + 微读元信息副标题
 * pos: 书架管理的核心 UI 组件 — 第二个职责：透出微读绑定/进度
 *
 * 架构说明：外层为 div + role=button。微读相关数据来自 useWereadStore（按需 fetch）。
 * 卡片仅显示，不直接调用微读 API。一旦属性变动，请更新这里及同目录 README.md。
 */
'use client';

import React, { useEffect } from 'react';
import { getCoverGradient } from '@/lib/title-gradient';
import { useWereadStore } from '@/store/useWereadStore';

interface BookCardProps {
  title: string;
  dir: string;
  onClick: () => void;
  onDelete?: () => void;
  /** 父组件管理的"本地书→微读 bookId"映射；空表示未绑定。点 🔗 时调用 onOpenBind */
  wereadBookId?: string;
  onOpenBind?: () => void;
  /** 点 "查看 N 条划线 →"  时调用；典型实现：选中该书 + 切到笔记视图 + 把微读 Tab 设为 active */
  onOpenWereadMarks?: () => void;
}

function getInitial(title: string) {
  if (!title) return 'B';
  const first = title.charAt(0);
  return /[a-zA-Z]/.test(first) ? first.toUpperCase() : first;
}

function formatHours(sec: number | undefined): string {
  if (!sec) return '';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h${m}m`;
}

export function BookCard({ title, dir, onClick, onDelete, wereadBookId, onOpenBind, onOpenWereadMarks }: BookCardProps) {
  const gradient = getCoverGradient(title);
  const initial = getInitial(title);

  const summary = useWereadStore((s) => (wereadBookId ? s.byBookId[wereadBookId] : undefined));
  const fetchSummary = useWereadStore((s) => s.fetchSummary);

  useEffect(() => {
    if (wereadBookId && !summary) {
      fetchSummary(wereadBookId).catch(() => { /* swallow — UI just won't show subtitle */ });
    }
  }, [wereadBookId, summary, fetchSummary]);

  const bound = !!wereadBookId;
  const progressPct = summary?.progress?.progressPercent;
  const marks = summary?.bookmarkCount ?? 0;
  const hours = formatHours(summary?.progress?.readingTimeSec);
  const finished = progressPct === 100;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
      className="relative group flex h-[260px] w-full flex-col items-start overflow-hidden rounded-2xl border border-outline-variant/10 bg-surface-container-low text-left shadow-sm transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-outline-variant/30 hover:shadow-lg cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/40"
    >
      {/* 封面占位符 */}
      <div className={`w-full h-40 bg-gradient-to-br ${gradient} flex items-center justify-center p-6 transition-transform duration-300 group-hover:scale-[1.03]`}>
        <div className="w-16 h-20 bg-surface/50 backdrop-blur-md rounded shadow-sm border border-white/50 flex items-center justify-center">
          <span className="font-serif text-3xl font-bold text-on-surface-variant/50 mix-blend-multiply">{initial}</span>
        </div>
      </div>

      {/* 卡片信息区 */}
      <div className="p-5 flex-1 w-full bg-surface-container-lowest z-10 flex flex-col justify-between">
        <div>
          <h3 className="font-serif text-base font-bold text-on-surface mb-1 line-clamp-2 leading-tight">
            {title}
            {finished && <span className="ml-1.5 text-sm" title="已读完">🏁</span>}
          </h3>
          <p className="font-mono text-[10px] text-on-surface-variant truncate">{dir}</p>
          {bound && summary && (
            <div className="mt-2 space-y-1">
              <p className="text-xs font-semibold text-primary truncate">
                微读 {progressPct ?? 0}% · {marks} 划线{hours && ` · ${hours}`}
              </p>
              {marks > 0 && onOpenWereadMarks && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onOpenWereadMarks(); }}
                  className="text-[11px] text-primary/80 hover:text-primary underline-offset-2 hover:underline cursor-pointer"
                >
                  查看 {marks} 条划线 →
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 删除按钮 */}
      {onDelete && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          title="删除这本书"
          className="absolute top-3 left-3 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-white/95 opacity-0 shadow-md backdrop-blur-sm transition-[opacity,transform,background-color] duration-150 hover:scale-105 hover:bg-red-50 active:scale-95 group-hover:opacity-100 cursor-pointer"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D94F30" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
          </svg>
        </button>
      )}

      {/* 微读绑定 🔗 — 绑定状态：实心绿点；未绑定：虚线轮廓 */}
      {onOpenBind && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onOpenBind(); }}
          title={bound ? `已关联微读${summary?.lastSyncedAt ? '（已同步）' : ''}` : '关联微信读书'}
          className={`absolute bottom-3 left-3 z-20 flex h-8 w-8 items-center justify-center rounded-full shadow-md backdrop-blur-sm transition-[opacity,transform,background-color,border-color] duration-150 hover:scale-105 active:scale-95 cursor-pointer ${
            bound
              ? 'bg-green-500/90 text-white opacity-100'
              : 'bg-white/90 text-on-surface-variant opacity-0 group-hover:opacity-100 border border-dashed border-outline-variant/60'
          }`}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.72-1.71" />
          </svg>
        </button>
      )}

      {/* 悬浮阅读箭头 */}
      <div className="pointer-events-none absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-on-primary opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14M12 5l7 7-7 7"/>
        </svg>
      </div>
    </div>
  );
}
