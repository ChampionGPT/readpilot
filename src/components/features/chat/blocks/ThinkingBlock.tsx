"use client";
import { useState } from 'react';
import { fontMonoStyle } from '../chat-tokens';
import type { ThinkingBlock as TB } from '@/types/chat-blocks';

export function ThinkingBlock({ block }: { block: TB }) {
  const isStreaming = block.status === 'streaming';
  const [expanded, setExpanded] = useState(false);

  if (!block.text) return null;

  return (
    <div className="my-1 overflow-hidden rounded-xl border border-stone-200/60 bg-stone-50 shadow-sm shadow-stone-200/20">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-3 py-2 text-[10px] text-stone-500 transition-colors hover:bg-stone-100/60 hover:text-stone-700"
      >
        <div className="flex items-center gap-1.5">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
               className={`transition-transform duration-300 ${expanded ? 'rotate-90' : ''}`}>
            <polyline points="9 18 15 12 9 6" />
          </svg>
          <span className="font-semibold uppercase tracking-wider">思考过程</span>
          {isStreaming && <span className="ml-1 h-1.5 w-1.5 animate-pulse rounded-full bg-[#D94F30]/70" />}
        </div>
        <span className="text-[9px] text-stone-400">{expanded ? '收起' : '展开'}</span>
      </button>

      {expanded && (
        <div className="px-3 pb-3 pt-1 border-t border-stone-200/30 bg-stone-50/50">
          <div className="text-[11px] text-stone-500 italic whitespace-pre-wrap leading-relaxed" style={fontMonoStyle}>
            {block.text}
            {isStreaming && <span className="inline-block w-1.5 h-3 ml-0.5 bg-stone-400 animate-pulse align-middle" />}
          </div>
        </div>
      )}
    </div>
  );
}
