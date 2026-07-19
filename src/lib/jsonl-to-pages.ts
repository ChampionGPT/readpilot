// input: JSONL 已 parse 的 chunks + 目标书籍目录
// output: 写入 pages/*.html + 返回 ProgressPage[]
// pos: 导入链路第 5-6 步 — JSONL 渲染为可阅读的章节 HTML
// 声明：一旦我被更新，务必更新我的开头注释以及所属文件夹的 md。

import fs from 'node:fs';
import path from 'node:path';
import type { ProgressPage } from '@/types/progress-data';

export interface JsonlChunk {
  loc: { item_index: number; chunk_index: number };
  chapter: string;
  text: string;
}

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
}

function normalizeTitleText(s: string): string {
  return s.replace(/\s+/g, '').trim().toLowerCase();
}

function withoutLeadingDuplicateTitle(parts: string[], chapter: string): string[] {
  const [first, ...rest] = parts;
  if (first && normalizeTitleText(first) === normalizeTitleText(chapter)) return rest;
  return parts;
}

function slugify(s: string): string {
  return s
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 30)
    .trim() || 'chapter';
}

function renderHtml(chapter: string, chunks: JsonlChunk[]): string {
  const paragraphParts = chunks
    .flatMap((c) => c.text.split(/\n{2,}/))
    .map((p) => p.trim())
    .filter(Boolean);

  const paragraphs = withoutLeadingDuplicateTitle(paragraphParts, chapter)
    .map((p, i) => `  <p data-rp-block="p-${i}">${escapeHtml(p)}</p>`)
    .join('\n');

  return `<!doctype html>
<html lang="zh">
<head><meta charset="utf-8"><title>${escapeHtml(chapter)}</title></head>
<body class="epub-chapter">
<article class="chapter">
<h1 class="chapter-title">${escapeHtml(chapter)}</h1>
<div class="chapter-body">
${paragraphs}
</div>
</article>
</body>
</html>
`;
}

export function renderJsonlToPages(
  bookDir: string,
  chunks: JsonlChunk[]
): ProgressPage[] {
  if (chunks.length === 0) return [];

  // 按首次出现顺序分组
  const groupOrder: string[] = [];
  const groups = new Map<string, JsonlChunk[]>();
  for (const ch of chunks) {
    if (!groups.has(ch.chapter)) {
      groupOrder.push(ch.chapter);
      groups.set(ch.chapter, []);
    }
    groups.get(ch.chapter)!.push(ch);
  }

  const pagesDir = path.join(bookDir, 'pages');
  fs.mkdirSync(pagesDir, { recursive: true });

  const today = new Date().toISOString();
  const result: ProgressPage[] = [];

  groupOrder.forEach((chapter, idx) => {
    const chunkList = groups.get(chapter)!;
    const padded = String(idx + 1).padStart(2, '0');
    const file = `pages/chap_${padded}_${slugify(chapter)}.html`;
    fs.writeFileSync(
      path.join(bookDir, file),
      renderHtml(chapter, chunkList),
      'utf-8'
    );
    result.push({
      id: `chap-${padded}`,
      type: 'chapter',
      title: chapter,
      description: `第 ${idx + 1} 章原文（${chunkList.length} 段）`,
      file,
      status: 'new',
      masteryScore: null,
      relatedChapters: [chapter],
      createdAt: today,
      completedAt: null,
    });
  });

  return result;
}
