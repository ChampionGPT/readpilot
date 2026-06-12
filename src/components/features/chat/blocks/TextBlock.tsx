import type { TextBlock as TB } from '@/types/chat-blocks';
import { MarkdownContent } from './MarkdownContent';

export function TextBlock({ block }: { block: TB }) {
  if (!block.text && block.status !== 'streaming') return null;

  return (
    <div className="min-h-[44px] max-w-full overflow-hidden break-words bg-white border border-[#E5DFD6] shadow-sm shadow-stone-200/30 rounded-2xl rounded-tl-sm px-4 py-3 text-sm leading-relaxed text-[#2C2A28]">
      <MarkdownContent text={block.text} />
      {block.status === 'streaming' && (
        <span className="inline-block w-1.5 h-4 ml-0.5 bg-[#D94F30] animate-pulse align-middle" />
      )}
    </div>
  );
}
