// input: assistant text block content
// output: Safe, lightweight markdown rendering for chat answers
// pos: TextBlock downstream renderer; intentionally avoids raw HTML and new runtime deps
// 声明：一旦我被更新，务必更新我的开头注释以及所属文件夹的 md。

import type React from 'react';
import { fontMonoStyle } from '../chat-tokens';

type MarkdownNode =
  | { kind: 'heading'; depth: number; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'blockquote'; text: string }
  | { kind: 'ul'; items: string[] }
  | { kind: 'ol'; items: string[] }
  | { kind: 'code'; language?: string; text: string }
  | { kind: 'hr' };

const listItemPattern = /^\s*[-*+]\s+(.+)$/;
const orderedItemPattern = /^\s*\d+[.)]\s+(.+)$/;

function isBlockBoundary(line: string): boolean {
  const trimmed = line.trim();
  return (
    trimmed === '' ||
    /^#{1,6}\s+/.test(trimmed) ||
    /^```/.test(trimmed) ||
    /^>\s?/.test(trimmed) ||
    /^-{3,}$/.test(trimmed) ||
    /^_{3,}$/.test(trimmed) ||
    /^\*{3,}$/.test(trimmed) ||
    listItemPattern.test(line) ||
    orderedItemPattern.test(line)
  );
}

function parseBlocks(text: string): MarkdownNode[] {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n');
  const nodes: MarkdownNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i += 1;
      continue;
    }

    const fence = trimmed.match(/^```([\w-]*)\s*$/);
    if (fence) {
      const language = fence[1] || undefined;
      const codeLines: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i += 1;
      }
      if (i < lines.length) i += 1;
      nodes.push({ kind: 'code', language, text: codeLines.join('\n') });
      continue;
    }

    const heading = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      nodes.push({ kind: 'heading', depth: heading[1].length, text: heading[2].trim() });
      i += 1;
      continue;
    }

    if (/^([-_*])\1\1+$/.test(trimmed)) {
      nodes.push({ kind: 'hr' });
      i += 1;
      continue;
    }

    if (/^>\s?/.test(trimmed)) {
      const quoteLines: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i].trim())) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ''));
        i += 1;
      }
      nodes.push({ kind: 'blockquote', text: quoteLines.join('\n') });
      continue;
    }

    if (listItemPattern.test(line)) {
      const items: string[] = [];
      while (i < lines.length) {
        const item = lines[i].match(listItemPattern);
        if (!item) break;
        items.push(item[1].trim());
        i += 1;
      }
      nodes.push({ kind: 'ul', items });
      continue;
    }

    if (orderedItemPattern.test(line)) {
      const items: string[] = [];
      while (i < lines.length) {
        const item = lines[i].match(orderedItemPattern);
        if (!item) break;
        items.push(item[1].trim());
        i += 1;
      }
      nodes.push({ kind: 'ol', items });
      continue;
    }

    const paragraphLines: string[] = [trimmed];
    i += 1;
    while (i < lines.length && !isBlockBoundary(lines[i])) {
      paragraphLines.push(lines[i].trim());
      i += 1;
    }
    nodes.push({ kind: 'paragraph', text: paragraphLines.join(' ') });
  }

  return nodes;
}

function sanitizeHref(href: string): string | null {
  const trimmed = href.trim();
  if (
    trimmed.startsWith('/') ||
    trimmed.startsWith('#') ||
    /^https?:\/\//i.test(trimmed) ||
    /^mailto:/i.test(trimmed)
  ) {
    return trimmed;
  }
  return null;
}

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const pattern = /(`[^`\n]+`|\*\*[^*\n]+\*\*|__[^_\n]+__|\[[^\]\n]+\]\([^)]+\)|\*[^*\n]+\*|_[^_\n]+_)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let index = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));

    const token = match[0];
    const key = `${keyPrefix}-${index}`;

    if (token.startsWith('`')) {
      parts.push(
        <code key={key} className="rounded bg-stone-100 px-1 py-0.5 text-[0.9em] text-stone-700" style={fontMonoStyle}>
          {token.slice(1, -1)}
        </code>,
      );
    } else if (token.startsWith('**') || token.startsWith('__')) {
      parts.push(<strong key={key} className="font-semibold text-stone-900">{renderInline(token.slice(2, -2), `${key}-strong`)}</strong>);
    } else if (token.startsWith('[')) {
      const link = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      const href = link ? sanitizeHref(link[2]) : null;
      parts.push(
        href ? (
          <a key={key} href={href} target={href.startsWith('http') ? '_blank' : undefined} rel="noreferrer" className="font-medium text-[#B4492F] underline decoration-[#D94F30]/30 underline-offset-2 hover:text-[#8F3524]">
            {renderInline(link?.[1] ?? token, `${key}-link`)}
          </a>
        ) : (
          token
        ),
      );
    } else {
      parts.push(<em key={key} className="italic text-stone-700">{renderInline(token.slice(1, -1), `${key}-em`)}</em>);
    }

    index += 1;
    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

export function MarkdownContent({ text }: { text: string }) {
  const nodes = parseBlocks(text);

  return (
    <div className="space-y-3">
      {nodes.map((node, index) => {
        const key = `md-${index}`;
        switch (node.kind) {
          case 'heading': {
            const sizeClass = node.depth <= 1 ? 'text-base' : node.depth === 2 ? 'text-[15px]' : 'text-sm';
            const content = renderInline(node.text, key);
            if (node.depth <= 1) {
              return <h1 key={key} className={`${sizeClass} font-bold leading-snug text-stone-900`}>{content}</h1>;
            }
            if (node.depth === 2) {
              return <h2 key={key} className={`${sizeClass} font-bold leading-snug text-stone-900`}>{content}</h2>;
            }
            if (node.depth === 3) {
              return <h3 key={key} className={`${sizeClass} font-bold leading-snug text-stone-900`}>{content}</h3>;
            }
            return (
              <h4 key={key} className={`${sizeClass} font-bold leading-snug text-stone-900`}>{content}</h4>
            );
          }
          case 'paragraph':
            return <p key={key} className="leading-relaxed">{renderInline(node.text, key)}</p>;
          case 'blockquote':
            return (
              <blockquote key={key} className="border-l-2 border-[#D94F30]/35 pl-3 text-stone-600">
                {node.text.split('\n').map((line, lineIndex) => (
                  <p key={`${key}-${lineIndex}`} className={lineIndex > 0 ? 'mt-1' : undefined}>
                    {renderInline(line, `${key}-${lineIndex}`)}
                  </p>
                ))}
              </blockquote>
            );
          case 'ul':
            return (
              <ul key={key} className="list-disc space-y-1 pl-5">
                {node.items.map((item, itemIndex) => (
                  <li key={`${key}-${itemIndex}`} className="pl-1">{renderInline(item, `${key}-${itemIndex}`)}</li>
                ))}
              </ul>
            );
          case 'ol':
            return (
              <ol key={key} className="list-decimal space-y-1 pl-5">
                {node.items.map((item, itemIndex) => (
                  <li key={`${key}-${itemIndex}`} className="pl-1">{renderInline(item, `${key}-${itemIndex}`)}</li>
                ))}
              </ol>
            );
          case 'code':
            return (
              <div key={key} className="overflow-hidden rounded-lg border border-stone-200 bg-stone-950 text-stone-100">
                {node.language && (
                  <div className="border-b border-white/10 px-3 py-1 text-[10px] uppercase tracking-wide text-stone-400" style={fontMonoStyle}>
                    {node.language}
                  </div>
                )}
                <pre className="max-h-[360px] overflow-auto px-3 py-2 text-[11px] leading-relaxed" style={fontMonoStyle}>
                  <code>{node.text}</code>
                </pre>
              </div>
            );
          case 'hr':
            return <hr key={key} className="border-stone-200" />;
        }
      })}
    </div>
  );
}
