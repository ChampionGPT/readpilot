"use client";
import { toolPalette } from '../chat-tokens';
import type { ErrorBlock as EB } from '@/types/chat-blocks';

export function ErrorBlock({ block, onRetry }: { block: EB; onRetry?: () => void }) {
  return (
    <div className="my-2 p-3 rounded-xl border" style={{ borderColor: toolPalette.err, background: '#FAF0EC' }}>
      <div className="text-sm font-medium" style={{ color: toolPalette.err }}>
        ⚠ {block.userMessage}
      </div>
      {block.actionHint && (
        <div className="text-xs mt-1 text-stone-600">{block.actionHint}</div>
      )}
      {block.retryable && onRetry && (
        <button onClick={onRetry} className="mt-2 text-xs px-3 py-1 rounded-full bg-white border hover:bg-stone-50"
                style={{ borderColor: toolPalette.err, color: toolPalette.err }}>
          重试
        </button>
      )}
    </div>
  );
}
