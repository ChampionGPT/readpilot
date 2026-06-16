import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  getCurrentPageExcerptPayload,
  getProgressPayload,
  searchSourceChunksPayload,
} from './agent-context';
import type { ProgressData } from '@/types/progress-data';

let tempRoot = '';
let previousBooksDir: string | undefined;

const bookDir = 'book_agent_context';

function writeFixtureBook() {
  const root = path.join(tempRoot, bookDir);
  fs.mkdirSync(path.join(root, 'pages'), { recursive: true });

  const progress: ProgressData = {
    book: {
      title: 'Context Book',
      author: 'ReadPilot',
      genre: 'nonfiction',
      totalChapters: 1,
      startDate: '2026-06-16',
      structure: [],
      totalPages: null,
      currentPage: null,
    },
    pages: [{
      id: 'chap-01',
      type: 'chapter',
      title: 'Chapter One',
      description: 'First chapter',
      file: 'pages/chap_01.html',
      status: 'new',
      masteryScore: null,
      relatedChapters: ['Chapter One'],
      createdAt: '2026-06-16T00:00:00.000Z',
      completedAt: null,
    }],
    themes: ['context'],
    glossary: {},
    currentFocus: 'Chapter One',
    nextRecommendation: null,
    readingLog: [{
      date: '2026-06-16',
      action: 'started',
      note: 'Started',
    }],
  };

  fs.writeFileSync(path.join(root, 'progress.json'), JSON.stringify(progress, null, 2));
  fs.writeFileSync(path.join(root, 'pages', 'chap_01.html'), '<article><h1>Chapter One</h1><p>Useful page excerpt.</p><script>ignored()</script></article>');
  fs.writeFileSync(path.join(root, 'source.jsonl'), [
    JSON.stringify({ loc: { item_index: 1, chunk_index: 0 }, chapter: 'Chapter One', text: 'A useful source chunk about context tools.' }),
    JSON.stringify({ loc: { item_index: 2, chunk_index: 0 }, chapter: 'Chapter Two', text: 'Other material.' }),
  ].join('\n'));
}

beforeEach(() => {
  previousBooksDir = process.env.READPILOT_BOOKS_DIR;
  tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'readpilot-agent-context-'));
  process.env.READPILOT_BOOKS_DIR = tempRoot;
  writeFixtureBook();
});

afterEach(() => {
  if (previousBooksDir === undefined) {
    delete process.env.READPILOT_BOOKS_DIR;
  } else {
    process.env.READPILOT_BOOKS_DIR = previousBooksDir;
  }
  fs.rmSync(tempRoot, { recursive: true, force: true });
});

describe('agent context payloads', () => {
  it('returns compact progress payload', () => {
    const payload = getProgressPayload(bookDir);
    expect(payload.ok).toBe(true);
    expect(payload.status).toBe('ok');
    if (payload.status === 'ok') {
      expect(payload.book.title).toBe('Context Book');
      expect(payload.pageCount).toBe(1);
      expect(payload.pages[0].id).toBe('chap-01');
    }
  });

  it('extracts current page text without scripts', async () => {
    const payload = await getCurrentPageExcerptPayload({
      bookDataDir: bookDir,
      contextMeta: { pageId: 'chap-01' },
    });
    expect(payload.ok).toBe(true);
    if (payload.ok && 'text' in payload) {
      expect(payload.text).toContain('Useful page excerpt.');
      expect(payload.text).not.toContain('ignored');
    }
  });

  it('searches source chunks by query', async () => {
    const payload = await searchSourceChunksPayload({
      bookDataDir: bookDir,
      query: 'context tools',
    });
    expect(payload.ok).toBe(true);
    expect(payload.chunks).toHaveLength(1);
    expect(payload.chunks[0].chapter).toBe('Chapter One');
  });
});
