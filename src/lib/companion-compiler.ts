// input: 导入后的 ProgressData + JsonlChunk[] + 书籍目录
// output: companion/*.md + companion/manifest.json 的确定性伴读档案缓存
// pos: 伴读编译层 — 在导入后先建立可复用的全书结构索引，避免后续反复全书理解
// 声明：一旦我被更新，务必更新我的开头注释以及所属文件夹的 md。

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { ProgressData } from '@/types/progress-data';
import type { JsonlChunk } from './jsonl-to-pages';

const COMPILER_VERSION = 'deterministic-v1';
const MAX_CONTEXT_CHARS_PER_DOC = 24_000;
const COMMON_ENGLISH_WORDS = new Set([
  'about', 'after', 'again', 'against', 'also', 'because', 'before', 'being',
  'between', 'chapter', 'could', 'every', 'first', 'from', 'have', 'into',
  'just', 'more', 'most', 'other', 'over', 'should', 'some', 'such', 'than',
  'that', 'their', 'there', 'these', 'they', 'this', 'through', 'under',
  'when', 'where', 'which', 'while', 'with', 'would', 'your',
]);
const COMMON_CJK_CHARS = new Set('的一是在了和与及中之不有为也这那而就都把被从到以对上更又很或于其并但还个们');

export interface CompanionManifest {
  schemaVersion: 1;
  compilerVersion: string;
  status: 'ready';
  profileKind: 'deterministic-index';
  sourceHash: string;
  source: {
    fileName: string;
    chunkCount: number;
    chapterCount: number;
  };
  generatedAt: string;
  artifacts: {
    bookProfile: string;
    chapterIndex: string;
    topicIndex: string;
  };
}

export interface BuildCompanionOptions {
  sourceFileName?: string;
}

interface ChapterDigest {
  index: number;
  title: string;
  chunkCount: number;
  charCount: number;
  preview: string;
  keywords: string[];
}

function cleanText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function escapePipe(text: string): string {
  return text.replace(/\|/g, '\\|');
}

function truncatePlain(text: string, max: number): string {
  const cleaned = cleanText(text);
  return cleaned.length > max ? `${cleaned.slice(0, max - 1)}…` : cleaned;
}

function normalizeMarkdown(text: string): string {
  return text
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function truncateMarkdown(text: string, max: number): string {
  const normalized = normalizeMarkdown(text);
  return normalized.length > max ? `${normalized.slice(0, max - 1)}…` : normalized;
}

function countMap(items: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of items) {
    counts.set(item, (counts.get(item) ?? 0) + 1);
  }
  return counts;
}

function extractEnglishTerms(text: string): string[] {
  return Array.from(text.toLowerCase().matchAll(/\b[a-z][a-z0-9-]{2,}\b/g))
    .map((match) => match[0])
    .filter((word) => !COMMON_ENGLISH_WORDS.has(word));
}

function extractCjkTerms(text: string): string[] {
  const terms: string[] = [];
  const runs = Array.from(text.matchAll(/[\u4e00-\u9fff]{2,}/g)).map((match) => match[0]);
  for (const run of runs) {
    const limited = run.slice(0, 80);
    for (const size of [2, 3, 4]) {
      for (let i = 0; i <= limited.length - size; i += 1) {
        const term = limited.slice(i, i + size);
        const stopCount = Array.from(term).filter((char) => COMMON_CJK_CHARS.has(char)).length;
        if (stopCount >= size - 1) continue;
        terms.push(term);
      }
    }
  }
  return terms;
}

function extractKeywords(text: string, limit = 8): string[] {
  const terms = [...extractEnglishTerms(text), ...extractCjkTerms(text)];
  const counts = countMap(terms);
  return Array.from(counts.entries())
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh-CN'))
    .slice(0, limit)
    .map(([term]) => term);
}

function groupChunksByChapter(chunks: JsonlChunk[]): Map<string, JsonlChunk[]> {
  const groups = new Map<string, JsonlChunk[]>();
  for (const chunk of chunks) {
    if (!groups.has(chunk.chapter)) groups.set(chunk.chapter, []);
    groups.get(chunk.chapter)!.push(chunk);
  }
  return groups;
}

function buildChapterDigests(chunks: JsonlChunk[]): ChapterDigest[] {
  const groups = groupChunksByChapter(chunks);
  return Array.from(groups.entries()).map(([title, chapterChunks], idx) => {
    const text = chapterChunks.map((chunk) => chunk.text).join('\n\n');
    const previewSource = chapterChunks.find((chunk) => cleanText(chunk.text).length > 20)?.text ?? '';
    return {
      index: idx + 1,
      title,
      chunkCount: chapterChunks.length,
      charCount: cleanText(text).length,
      preview: truncatePlain(previewSource, 220),
      keywords: extractKeywords(`${title}\n${text}`, 8),
    };
  });
}

export function computeCompanionSourceHash(chunks: JsonlChunk[]): string {
  const hash = crypto.createHash('sha256');
  for (const chunk of chunks) {
    hash.update(chunk.chapter);
    hash.update('\0');
    hash.update(chunk.text);
    hash.update('\0');
  }
  return hash.digest('hex');
}

function buildBookProfile(progress: ProgressData, digests: ChapterDigest[], manifest: CompanionManifest): string {
  const book = progress.book;
  const keywords = extractKeywords(digests.map((digest) => `${digest.title} ${digest.keywords.join(' ')}`).join('\n'), 24);
  const longest = [...digests].sort((a, b) => b.charCount - a.charCount).slice(0, 5);
  const chapterLines = digests
    .slice(0, 36)
    .map((digest) => `${digest.index}. ${digest.title}`)
    .join('\n');

  return truncateMarkdown(`# ${book.title || '未命名书籍'} - 伴读档案

生成时间：${manifest.generatedAt}
档案类型：确定性结构索引（未消耗模型 token）
源内容 hash：${manifest.sourceHash}

## 用法

这组文档是 ReadPilot 的全书级伴读缓存。ChatPanel 和页面生成流程应先读取这里，再按需读取目标章节，避免每次重新理解整本书。

## 基本信息

- 标题：${book.title || '未知'}
- 作者：${book.author || '未知'}
- 类型：${book.genre || '未分类'}
- 章节数：${manifest.source.chapterCount}
- 文本块数：${manifest.source.chunkCount}

## 全书结构快照

${chapterLines || '暂无章节。'}

## 高频主题线索

${keywords.length ? keywords.map((keyword) => `- ${keyword}`).join('\n') : '- 暂无稳定高频主题。'}

## 阅读重量较高的章节

${longest.map((digest) => `- 第 ${digest.index} 章：${digest.title}（约 ${digest.charCount} 字符，${digest.chunkCount} 块）`).join('\n') || '- 暂无。'}

## 运行约定

- 普通章节提问：只结合本档案、当前页面摘录和目标章节回答文字。
- 明确要求生成页面：再读取 \`chapter-index.md\` 和目标章节材料，生成一个页面并更新 \`progress.json\`。
- 源内容 hash 未变化时，不要重复建立全书档案。
`, MAX_CONTEXT_CHARS_PER_DOC);
}

function buildChapterIndex(digests: ChapterDigest[]): string {
  const rows = digests.map((digest) => {
    const keywords = digest.keywords.length ? digest.keywords.join(', ') : '待阅读时提炼';
    return `| ${digest.index} | ${escapePipe(digest.title)} | ${digest.chunkCount} | ${digest.charCount} | ${escapePipe(keywords)} | ${escapePipe(digest.preview)} |`;
  });

  return truncateMarkdown(`# 章节索引

本文件用于按需定位章节，生成伴读页时优先读取目标章节，不要重新通读整本书。

| # | 章节 | 文本块 | 字符数 | 关键词线索 | 开头摘录 |
|---|------|--------|--------|------------|----------|
${rows.join('\n')}
`, MAX_CONTEXT_CHARS_PER_DOC);
}

function buildTopicIndex(digests: ChapterDigest[]): string {
  const byTopic = new Map<string, number[]>();
  for (const digest of digests) {
    for (const keyword of digest.keywords) {
      if (!byTopic.has(keyword)) byTopic.set(keyword, []);
      byTopic.get(keyword)!.push(digest.index);
    }
  }

  const topicLines = Array.from(byTopic.entries())
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0], 'zh-CN'))
    .slice(0, 80)
    .map(([topic, indexes]) => `- **${topic}** -> ${Array.from(new Set(indexes)).map((idx) => `第 ${idx} 章`).join('、')}`);

  const chapterTitleLines = digests.map((digest) => `- **第 ${digest.index} 章**：${digest.title}`);

  return truncateMarkdown(`# 主题索引

本文件是自动建立的主题入口。它用于提示后续 AI 去哪个章节深化，而不是替代细读。

## 高频主题到章节

${topicLines.length ? topicLines.join('\n') : '- 暂无稳定主题。'}

## 章节标题索引

${chapterTitleLines.join('\n')}
`, MAX_CONTEXT_CHARS_PER_DOC);
}

function writeUtf8(filePath: string, content: string): void {
  fs.writeFileSync(filePath, `${content.trim()}\n`, 'utf-8');
}

export function buildCompanionArtifacts(
  bookDir: string,
  progress: ProgressData,
  chunks: JsonlChunk[],
  options: BuildCompanionOptions = {},
): CompanionManifest {
  const companionDir = path.join(bookDir, 'companion');
  fs.mkdirSync(companionDir, { recursive: true });

  const digests = buildChapterDigests(chunks);
  const now = new Date().toISOString();
  const manifest: CompanionManifest = {
    schemaVersion: 1,
    compilerVersion: COMPILER_VERSION,
    status: 'ready',
    profileKind: 'deterministic-index',
    sourceHash: computeCompanionSourceHash(chunks),
    source: {
      fileName: options.sourceFileName ?? 'source.jsonl',
      chunkCount: chunks.length,
      chapterCount: digests.length,
    },
    generatedAt: now,
    artifacts: {
      bookProfile: 'companion/book-profile.md',
      chapterIndex: 'companion/chapter-index.md',
      topicIndex: 'companion/topic-index.md',
    },
  };

  writeUtf8(path.join(companionDir, 'book-profile.md'), buildBookProfile(progress, digests, manifest));
  writeUtf8(path.join(companionDir, 'chapter-index.md'), buildChapterIndex(digests));
  writeUtf8(path.join(companionDir, 'topic-index.md'), buildTopicIndex(digests));
  writeUtf8(path.join(companionDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

  return manifest;
}

export function readCompanionContext(bookDir: string, charLimit = 8000): string {
  const companionDir = path.join(bookDir, 'companion');
  const manifestPath = path.join(companionDir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) return '';

  const files = ['book-profile.md', 'chapter-index.md', 'topic-index.md'];
  const sections: string[] = [];
  for (const file of files) {
    const filePath = path.join(companionDir, file);
    if (!fs.existsSync(filePath)) continue;
    sections.push(`### ${file}\n${fs.readFileSync(filePath, 'utf-8').trim()}`);
  }

  const joined = sections.join('\n\n');
  if (!joined) return '';
  return joined.length > charLimit ? `${joined.slice(0, charLimit)}\n\n[companion context truncated]` : joined;
}
