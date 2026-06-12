import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { ProgressData } from '@/types/progress-data';
import { buildCompanionArtifacts, computeCompanionSourceHash, readCompanionContext } from './companion-compiler';
import type { JsonlChunk } from './jsonl-to-pages';

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'readpilot-companion-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function sampleProgress(): ProgressData {
  return {
    book: {
      title: '测试书',
      author: '作者',
      genre: '',
      totalChapters: 2,
      startDate: '2026-06-12',
      structure: [],
      totalPages: null,
      currentPage: null,
    },
    pages: [],
    themes: [],
    glossary: {},
    currentFocus: null,
    nextRecommendation: null,
    readingLog: [],
  };
}

function sampleChunks(): JsonlChunk[] {
  return [
    { loc: { item_index: 0, chunk_index: 0 }, chapter: '第一章 方法', text: '系统 方法 框架 系统 方法 决策。' },
    { loc: { item_index: 0, chunk_index: 1 }, chapter: '第一章 方法', text: '框架 帮助 决策，方法 帮助 理解。' },
    { loc: { item_index: 1, chunk_index: 0 }, chapter: '第二章 实践', text: '实践 反馈 迭代 实践 反馈。' },
  ];
}

describe('companion-compiler', () => {
  it('computes a stable source hash', () => {
    expect(computeCompanionSourceHash(sampleChunks())).toBe(computeCompanionSourceHash(sampleChunks()));
  });

  it('writes companion artifacts and exposes bounded context', () => {
    const dir = makeTempDir();
    const manifest = buildCompanionArtifacts(dir, sampleProgress(), sampleChunks(), {
      sourceFileName: 'source.epub',
    });

    expect(manifest.source.chapterCount).toBe(2);
    expect(fs.existsSync(path.join(dir, 'companion', 'manifest.json'))).toBe(true);
    expect(fs.existsSync(path.join(dir, 'companion', 'book-profile.md'))).toBe(true);
    expect(fs.existsSync(path.join(dir, 'companion', 'chapter-index.md'))).toBe(true);
    expect(fs.existsSync(path.join(dir, 'companion', 'topic-index.md'))).toBe(true);

    const chapterIndex = fs.readFileSync(path.join(dir, 'companion', 'chapter-index.md'), 'utf-8');
    expect(chapterIndex).toContain('\n| # | 章节 | 文本块 | 字符数 | 关键词线索 | 开头摘录 |');

    const context = readCompanionContext(dir, 500);
    expect(context).toContain('book-profile.md');
    expect(context.length).toBeLessThanOrEqual(540);
  });
});
