/**
 * input: ToolResultBlock 块（output / previewLength / isError / truncated）
 * output: 折叠的工具结果区，默认收起，展开后显示 mono 风格代码块
 * pos: 跟在 ToolUseBlock 后面，视觉上挂在它的脚下（左侧 1px 米色连接线）
 * 声明：一旦我被更新，务必更新我的开头注释以及所属文件夹的 md。
 */
"use client";

import { useState } from 'react';
import { fontMonoStyle, toolPalette } from '../chat-tokens';
import type { ToolResultBlock as TR } from '@/types/chat-blocks';

export function ToolResultBlock({ block }: { block: TR }) {
  const [expanded, setExpanded] = useState(false);
  const isError = block.isError;
  const chars = block.output?.length ?? 0;
  const lineCount = block.output ? block.output.split('\n').length : 0;
  const previewText = expanded ? block.output : (block.output ?? '').slice(0, block.previewLength ?? 8192);
  const hasMore = !expanded && chars > (block.previewLength ?? 8192);

  return (
    <div
      className="ml-3 -mt-1 border-l-2 pl-3"
      style={{ borderColor: isError ? toolPalette.err : toolPalette.border }}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-2 text-[10px] hover:opacity-80 transition-opacity"
        style={{ color: isError ? toolPalette.err : toolPalette.inkMute, ...fontMonoStyle }}
      >
        <span>{expanded ? '▼' : '▶'}</span>
        <span>↳ 结果</span>
        <span>·</span>
        <span>{chars.toLocaleString()} chars</span>
        {lineCount > 1 && (
          <>
            <span>·</span>
            <span>{lineCount} 行</span>
          </>
        )}
        {block.truncated && (
          <span className="opacity-60">· 已截断</span>
        )}
        {isError && (
          <span className="ml-1 px-1.5 py-0.5 rounded text-[9px] font-bold" style={{ background: toolPalette.err + '20', color: toolPalette.err }}>
            ERR
          </span>
        )}
      </button>
      {expanded && (
        <pre
          className="mt-1 px-3 py-2 rounded-md overflow-auto whitespace-pre-wrap break-all text-[11px] leading-relaxed max-h-[300px]"
          style={{
            background: isError ? '#FAF0EC' : toolPalette.bg,
            color: toolPalette.ink,
            ...fontMonoStyle,
          }}
        >
          {previewText}
          {hasMore && '\n…（点击 ▼ 收起 / 后端已限制预览长度）'}
        </pre>
      )}
    </div>
  );
}
