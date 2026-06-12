/**
 * input: ToolUseBlock 块（含 name / input / variant / status）
 * output: 内联工具调用小卡 — 读/写箭头 + 状态圆点 + 工具名 + 一行参数预览
 * pos: BlockRouter 下游，由 ChatPanel 在 block.kind === 'tool_use' 时渲染
 * 声明：一旦我被更新，务必更新我的开头注释以及所属文件夹的 md。
 */
"use client";

import { fontMonoStyle, toolPalette } from '../chat-tokens';
import type { ToolUseBlock as TB, ToolVariant } from '@/types/chat-blocks';

const variantColor: Record<ToolVariant, string> = {
  generic: toolPalette.inkMute,
  read: toolPalette.info,
  write: toolPalette.warn,
  edit: toolPalette.warn,
  bash: toolPalette.ok,
  todo_write: toolPalette.info,
  skill: '#9A6FD6',
  task: toolPalette.info,
};

const variantGlyph: Record<ToolVariant, { symbol: string; label: string }> = {
  generic: { symbol: '•', label: '工具' },
  read: { symbol: '↑', label: '读取' },
  write: { symbol: '↓', label: '写入' },
  edit: { symbol: '↓', label: '编辑' },
  bash: { symbol: '$', label: '命令' },
  todo_write: { symbol: '↓', label: '计划' },
  skill: { symbol: '◇', label: '技能' },
  task: { symbol: '•', label: '任务' },
};

function previewInput(name: string, input: Record<string, unknown>): string {
  if (!input || typeof input !== 'object') return '';
  if (typeof input.command === 'string') {
    return input.command.length > 90 ? input.command.slice(0, 90) + '…' : input.command;
  }
  if (typeof input.file_path === 'string') {
    const fp = input.file_path;
    const slim = fp.length > 60 ? '…' + fp.slice(-60) : fp;
    return slim;
  }
  if (typeof input.path === 'string') return input.path;
  if (typeof input.pattern === 'string') return input.pattern;
  if (typeof input.query === 'string') return input.query.slice(0, 90);
  if (typeof input.description === 'string') return input.description.slice(0, 90);
  // Fallback: 取第一个字符串值
  for (const v of Object.values(input)) {
    if (typeof v === 'string' && v) {
      return v.length > 90 ? v.slice(0, 90) + '…' : v;
    }
  }
  return '';
}

export function ToolUseBlock({ block }: { block: TB }) {
  const isStreaming = block.status === 'streaming';
  const color = variantColor[block.variant] ?? toolPalette.inkMute;
  const glyph = variantGlyph[block.variant] ?? variantGlyph.generic;
  const preview = previewInput(block.name, block.input);

  return (
    <div
      className="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs"
      style={{
        background: toolPalette.bg,
        borderColor: isStreaming ? toolPalette.borderRun : toolPalette.border,
        ...fontMonoStyle,
      }}
    >
      <span
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
        style={{ background: `${color}18`, color }}
        title={glyph.label}
        aria-label={glyph.label}
      >
        {glyph.symbol}
      </span>
      {isStreaming ? (
        <span
          className="w-2 h-2 rounded-full animate-pulse shrink-0"
          style={{ background: color }}
        />
      ) : (
        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
      )}
      <span className="font-bold shrink-0" style={{ color: toolPalette.ink }}>
        {block.name}
      </span>
      {preview && (
        <span
          className="truncate flex-1 min-w-0"
          style={{ color: toolPalette.inkMute }}
          title={preview}
        >
          {preview}
        </span>
      )}
      {isStreaming && (
        <span className="text-[9px] opacity-60 shrink-0" style={{ color: toolPalette.inkMute }}>
          运行中
        </span>
      )}
    </div>
  );
}
