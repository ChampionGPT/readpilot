"use client";
import { useState } from 'react';
import { fontMonoStyle } from '../chat-tokens';
import type { DiagnosticBlock as DB } from '@/types/chat-blocks';

export function DiagnosticBlock({ block }: { block: DB }) {
  const [expanded, setExpanded] = useState(false);
  if (!block.text) return null;
  const lineCount = block.text.split('\n').length;

  return (
    <div className="my-1 text-[10px] text-stone-400" style={fontMonoStyle}>
      <button onClick={() => setExpanded(!expanded)} className="hover:text-stone-600">
        ⚠ stderr · {lineCount} 行 {expanded ? '收起' : '展开'}
      </button>
      {expanded && (
        <pre className="mt-1 px-2 py-1 bg-stone-50 border border-stone-200/50 rounded overflow-x-auto whitespace-pre-wrap">
          {block.text}
        </pre>
      )}
    </div>
  );
}
