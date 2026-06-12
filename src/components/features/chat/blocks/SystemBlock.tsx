"use client";
import { useState } from 'react';
import { fontMonoStyle, toolPalette } from '../chat-tokens';
import type { SystemBlock as SB } from '@/types/chat-blocks';

export function SystemBlock({ block }: { block: SB }) {
  const [expanded, setExpanded] = useState(false);

  if (block.subtype === 'resume_fallback' || block.subtype === 'note') {
    return (
      <div className="my-1 px-3 py-1.5 text-[11px] text-amber-700 bg-amber-50/50 border-l-2 border-amber-300 rounded-r" style={fontMonoStyle}>
        {block.message || '系统提示'}
      </div>
    );
  }

  const toolsCount = block.tools?.length ?? 0;
  const mcpCount = block.mcpServers?.length ?? 0;

  return (
    <div className="my-2 border-l-2 rounded-r overflow-hidden" style={{ borderColor: toolPalette.info, background: '#F4F7FA' }}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-1.5 text-[10px] hover:bg-blue-50/50"
        style={{ color: toolPalette.info, ...fontMonoStyle }}
      >
        <span>─ 会话已初始化 · {toolsCount} tools{mcpCount ? ` · ${mcpCount} mcp` : ''} ─</span>
        <span>{expanded ? '收起' : '展开'}</span>
      </button>
      {expanded && (
        <div className="px-3 py-2 text-[11px] space-y-1" style={{ color: toolPalette.ink, ...fontMonoStyle }}>
          {block.model && <div><span className="opacity-60">model:</span> {block.model}</div>}
          {block.cwd && <div><span className="opacity-60">cwd:</span> {block.cwd}</div>}
          {block.tools && block.tools.length > 0 && (
            <div><span className="opacity-60">tools:</span> {block.tools.join(', ')}</div>
          )}
          {block.mcpServers && block.mcpServers.length > 0 && (
            <div><span className="opacity-60">mcp:</span> {block.mcpServers.join(', ')}</div>
          )}
        </div>
      )}
    </div>
  );
}
