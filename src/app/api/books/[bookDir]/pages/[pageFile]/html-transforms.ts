// input: HTML 字符串、progress.json 数据
// output: body class 注入 / legacy markup 修复 / 重复标题去除 / chapter-aftermath 拼接 / 转义工具
// pos: page route handler 共享的纯函数集合 — 任何对 HTML 字符串的就地变换都收口到这里
// 声明：一旦我被更新，务必更新我的开头注释以及所属文件夹的 md。

import fs from "fs";
import path from "path";
import type { ProgressData, ProgressPage } from "@/types/progress-data";

/** 为 <body> 添加主题 class */
export function injectBodyClass(html: string, themeClass: string): string {
  return html.replace(/<body([^>]*)>/i, (match, attrs) => {
    if (match.includes('class=')) {
      return match.replace(/class=["']([^"']*)["']/i, `class="$1 ${themeClass}"`);
    }
    return `<body class="${themeClass}"${attrs}>`;
  });
}

/**
 * 老 EPUB 转换器（一期早期版本）输出的 HTML 没有 `.chapter` / `.chapter-title` / `.chapter-body` 结构
 * （只有 `<article><h1>...</h1><div class="prose">...</div></article>`）。
 * 三主题专用 CSS 全部依赖这些 class 才能选中。运行时为老 HTML 补上 class，让选择器生效。
 * 已有正确 class 的新 HTML 不会被改动（class 已包含 'chapter' 时直接跳过）。
 */
export function wrapEpubLegacyMarkup(html: string): string {
  let out = html;
  // 给最外层 <article> 加 .chapter（如未含）
  out = out.replace(/<article(?![^>]*class=["'][^"']*\bchapter\b)([^>]*)>/i, '<article class="chapter"$1>');
  // 给第一个 <h1> 加 .chapter-title
  out = out.replace(/<h1(?![^>]*class=["'][^"']*\bchapter-title\b)([^>]*)>/i, '<h1 class="chapter-title"$1>');
  // 给 <div class="prose"> 改成 .chapter-body；若没有 prose 但 article 内有未包裹的 <p>，也包一层 .chapter-body
  if (/<div[^>]*class=["'][^"']*\bprose\b/i.test(out)) {
    out = out.replace(/<div([^>]*)class=(["'])([^"']*)\bprose\b([^"']*)\2/i, '<div$1class=$2$3chapter-body$4$2');
  }
  return out;
}

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeTitleText(text: string): string {
  return stripTags(text).replace(/\s+/g, '').toLowerCase();
}

function removeLeadingEmptyBlocks(html: string): string {
  let out = html;
  for (let i = 0; i < 6; i += 1) {
    const next = out.replace(/^\s*<p\b[^>]*>\s*(?:&nbsp;|\s|<br\s*\/?>)*<\/p>\s*/i, '');
    if (next === out) return out;
    out = next;
  }
  return out;
}

/**
 * Preserved EPUB pages already have our generated .chapter-title.
 * Some EPUB bodies also start with the same h1/h2/p title; remove that duplicate
 * at render time so old imports do not need to be regenerated.
 */
export function removeDuplicateChapterTitle(html: string): string {
  const titleMatch = html.match(/<h1\b[^>]*class=["'][^"']*\bchapter-title\b[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i);
  const chapterTitle = titleMatch ? normalizeTitleText(titleMatch[1]) : '';
  if (!chapterTitle) return html;

  const bodyMatch = html.match(/<div\b[^>]*class=["'][^"']*\bchapter-body\b[^"']*["'][^>]*>/i);
  if (!bodyMatch || bodyMatch.index === undefined) return html;

  const bodyStart = bodyMatch.index + bodyMatch[0].length;
  const prefix = html.slice(0, bodyStart);
  let rest = removeLeadingEmptyBlocks(html.slice(bodyStart));

  const firstBlock = rest.match(/^\s*<(h[1-6]|p)\b[^>]*>([\s\S]*?)<\/\1>\s*/i);
  if (!firstBlock) return prefix + rest;

  if (normalizeTitleText(firstBlock[2]) !== chapterTitle) return prefix + rest;
  rest = rest.slice(firstBlock[0].length);
  return prefix + rest;
}

const AFTERMATH_HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeForAftermath(s: string): string {
  return s.replace(/[&<>"']/g, (c) => AFTERMATH_HTML_ESCAPES[c]!);
}

/** 读 progress.json；任何错误返回 null（降级，不影响 HTML 渲染） */
export function readProgressForBook(resolvedDir: string): ProgressData | null {
  try {
    const raw = fs.readFileSync(path.join(resolvedDir, "progress.json"), "utf-8");
    return JSON.parse(raw) as ProgressData;
  } catch {
    return null;
  }
}

/** 找当前 pageFile 对应的 chapter page（按 file 字段精确匹配） */
export function findCurrentChapter(progress: ProgressData, pageFile: string): ProgressPage | null {
  return progress.pages.find((p) => p.file === pageFile && p.type === 'chapter') ?? null;
}

/** 生成 chapter-aftermath section HTML */
export function buildAftermathHtml(
  progress: ProgressData,
  currentChapter: ProgressPage,
  bookDir: string,
  theme: string | null,
): string {
  const related = progress.pages.filter(
    (p) => p.type !== 'chapter' && p.relatedChapters.includes(currentChapter.title),
  );
  const themeQs = theme ? `?theme=${encodeURIComponent(theme)}` : '';

  if (related.length === 0) {
    return `
<section class="chapter-aftermath chapter-aftermath-empty">
  <p>想深入这一章？在右侧对话栏告诉 Claude「拆解一下 ${escapeForAftermath(currentChapter.title)}」。</p>
</section>
`;
  }

  const items = related
    .map((p) => {
      const href = `/api/books/${encodeURIComponent(bookDir)}/pages/${encodeURIComponent(p.file)}${themeQs}`;
      return `  <li><a href="${href}">${escapeForAftermath(p.title)} · ${p.type}</a></li>`;
    })
    .join('\n');

  return `
<section class="chapter-aftermath">
  <h2>本章相关解读</h2>
  <ul>
${items}
  </ul>
</section>
`;
}
