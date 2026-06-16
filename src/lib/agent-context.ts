// input: book/session UI context plus ReadPilot local stores
// output: compact agent-readable context sections and future tool-shaped read helpers
// pos: Provider-neutral ReadPilot context service shared by Claude, Codex, HTTP APIs, and future MCP tools
import fs from 'fs/promises';
import path from 'path';
import { getBook, getNotesByBook, getNotesByPage } from './db';
import { readProgress, resolveBookDir } from './files';
import { readCompanionContext } from './companion-compiler';
import { buildWereadContextSection } from './wereadContextBuilder';
import type { Book, BookNote } from '@/types/progress';
import type { ProgressData, ProgressPage } from '@/types/progress-data';
import type { JsonlChunk } from './jsonl-to-pages';

export interface ChatContextMeta {
  viewMode?: string;
  bookId?: string | null;
  bookDir?: string | null;
  bookTitle?: string | null;
  pageId?: string | null;
  pageTitle?: string | null;
  pageType?: string | null;
  noteId?: string | null;
  articleId?: string | null;
}

export interface BookAgentContextOptions {
  bookId?: string;
  bookDataDir: string;
  bookTitle?: string;
  companionCharLimit?: number;
  notesLimit?: number;
}

export interface ViewAgentContextOptions {
  contextMeta?: ChatContextMeta;
  bookDataDir: string;
  pageCharLimit?: number;
}

export interface ContextBookRef {
  bookId?: string;
  bookDataDir: string;
  bookTitle?: string;
}

export interface SourceSearchOptions extends ContextBookRef {
  query?: string;
  chapter?: string;
  limit?: number;
  maxCharsPerChunk?: number;
}

export interface NotesContextOptions {
  bookId?: string;
  pageId?: string | null;
  limit?: number;
}

const DEFAULT_COMPANION_CHAR_LIMIT = 8000;
const DEFAULT_PAGE_CHAR_LIMIT = 6000;
const DEFAULT_NOTES_LIMIT = 8;

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCharCode(parseInt(code, 16)));
}

function htmlToPlainText(html: string): string {
  return decodeHtmlEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|section|article|h[1-6]|li|blockquote)>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/\s+\n/g, '\n')
    .replace(/\n\s+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 32)).trim()}\n\n[truncated]`;
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function formatProgressSummary(progress: ProgressData): string {
  const pages = progress.pages.slice(0, 80).map((page) => ({
    id: page.id,
    type: page.type,
    title: page.title,
    status: page.status,
    file: page.file,
    masteryScore: page.masteryScore,
    relatedChapters: page.relatedChapters,
  }));

  return JSON.stringify({
    book: progress.book,
    currentFocus: progress.currentFocus,
    themes: progress.themes,
    nextRecommendation: progress.nextRecommendation,
    pageCount: progress.pages.length,
    pages,
  }, null, 2);
}

function formatNotes(notes: BookNote[], limit: number): string {
  const selected = notes.slice(0, limit);
  if (selected.length === 0) return '';

  return selected.map((note, index) => {
    const parts = [
      `${index + 1}. noteId=${note.id}${note.pageId ? ` pageId=${note.pageId}` : ''}`,
      note.cue ? `cue: ${note.cue}` : '',
      note.notes ? `notes: ${truncate(note.notes, 900)}` : '',
      note.summary ? `summary: ${truncate(note.summary, 500)}` : '',
      `updatedAt: ${note.updatedAt}`,
    ].filter(Boolean);
    return parts.join('\n');
  }).join('\n\n');
}

function compactNote(note: BookNote) {
  return {
    id: note.id,
    bookId: note.bookId,
    pageId: note.pageId,
    cue: note.cue,
    notes: truncate(note.notes, 1600),
    summary: truncate(note.summary, 800),
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
  };
}

function parsePositiveInt(value: number | undefined, fallback: number, max: number): number {
  if (!value || !Number.isFinite(value) || value <= 0) return fallback;
  return Math.min(Math.floor(value), max);
}

function safeJsonlChunk(value: unknown): JsonlChunk | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const loc = record.loc;
  if (!loc || typeof loc !== 'object') return null;
  const locRecord = loc as Record<string, unknown>;
  if (typeof record.chapter !== 'string' || typeof record.text !== 'string') return null;
  if (typeof locRecord.item_index !== 'number' || typeof locRecord.chunk_index !== 'number') return null;
  return {
    loc: {
      item_index: locRecord.item_index,
      chunk_index: locRecord.chunk_index,
    },
    chapter: record.chapter,
    text: record.text,
  };
}

export async function getCurrentBookPayload(ref: ContextBookRef) {
  const bookRoot = resolveBookDir(ref.bookDataDir);
  const book: Book | undefined = ref.bookId ? getBook(ref.bookId) : undefined;
  const artifacts = bookRoot
    ? {
        progress: await pathExists(path.join(bookRoot, 'progress.json')),
        sourceJsonl: await pathExists(path.join(bookRoot, 'source.jsonl')),
        companionManifest: await pathExists(path.join(bookRoot, 'companion', 'manifest.json')),
        indexHtml: await pathExists(path.join(bookRoot, 'index.html')),
        pagesDir: await pathExists(path.join(bookRoot, 'pages')),
      }
    : {
        progress: false,
        sourceJsonl: false,
        companionManifest: false,
        indexHtml: false,
        pagesDir: false,
      };

  return {
    tool: 'readpilot.get_current_book',
    ok: !!bookRoot,
    book: book ?? {
      id: ref.bookId ?? null,
      title: ref.bookTitle ?? ref.bookDataDir,
      dataDir: ref.bookDataDir,
    },
    bookRootAvailable: !!bookRoot,
    artifacts,
  };
}

export function getProgressPayload(bookDataDir: string, pageLimit = 80) {
  const result = readProgress(bookDataDir);
  if (result.kind === 'missing') {
    return { tool: 'readpilot.get_progress', ok: false, status: 'missing' as const };
  }
  if (result.kind === 'corrupt') {
    return { tool: 'readpilot.get_progress', ok: false, status: 'corrupt' as const, error: result.error };
  }

  const limit = parsePositiveInt(pageLimit, 80, 300);
  const pages = result.data.pages.slice(0, limit).map((page) => ({
    id: page.id,
    type: page.type,
    title: page.title,
    description: page.description,
    file: page.file,
    status: page.status,
    masteryScore: page.masteryScore,
    relatedChapters: page.relatedChapters,
    createdAt: page.createdAt,
    completedAt: page.completedAt,
  }));

  return {
    tool: 'readpilot.get_progress',
    ok: true,
    status: 'ok' as const,
    book: result.data.book,
    currentFocus: result.data.currentFocus,
    themes: result.data.themes,
    glossary: result.data.glossary,
    nextRecommendation: result.data.nextRecommendation,
    readingLog: result.data.readingLog.slice(-30),
    pageCount: result.data.pages.length,
    returnedPageCount: pages.length,
    pages,
  };
}

export function getCompanionIndexPayload(bookDataDir: string, charLimit = DEFAULT_COMPANION_CHAR_LIMIT) {
  const text = getCompanionIndexContext(bookDataDir, charLimit);
  return {
    tool: 'readpilot.get_companion_index',
    ok: !!text,
    status: text ? 'ok' as const : 'missing' as const,
    charLimit,
    truncated: text.includes('[companion context truncated]'),
    text,
  };
}

export function getNotesPayload(options: NotesContextOptions) {
  const { bookId, pageId, limit = DEFAULT_NOTES_LIMIT } = options;
  if (!bookId) {
    return { tool: 'readpilot.get_notes', ok: false, status: 'missing_book_id' as const, notes: [] };
  }

  try {
    const cappedLimit = parsePositiveInt(limit, DEFAULT_NOTES_LIMIT, 100);
    const notes = pageId ? getNotesByPage(bookId, pageId) : getNotesByBook(bookId);
    return {
      tool: 'readpilot.get_notes',
      ok: true,
      status: 'ok' as const,
      bookId,
      pageId: pageId ?? null,
      total: notes.length,
      notes: notes.slice(0, cappedLimit).map(compactNote),
    };
  } catch (error) {
    return {
      tool: 'readpilot.get_notes',
      ok: false,
      status: 'error' as const,
      message: error instanceof Error ? error.message : String(error),
      notes: [],
    };
  }
}

export function getWereadMemoryPayload(bookDataDir: string) {
  const text = getWereadMemoryContext(bookDataDir);
  return {
    tool: 'readpilot.get_weread_memory',
    ok: !!text,
    status: text ? 'ok' as const : 'missing_or_unbound' as const,
    text,
  };
}

export async function getCurrentPageExcerptPayload(options: ViewAgentContextOptions) {
  const { contextMeta, bookDataDir, pageCharLimit = DEFAULT_PAGE_CHAR_LIMIT } = options;
  if (!contextMeta?.pageId && !contextMeta?.pageTitle) {
    return { tool: 'readpilot.get_current_page_excerpt', ok: false, status: 'missing_page_ref' as const };
  }

  const bookRoot = resolveBookDir(bookDataDir);
  if (!bookRoot) {
    return { tool: 'readpilot.get_current_page_excerpt', ok: false, status: 'missing_book' as const };
  }

  const progressResult = readProgress(bookDataDir);
  if (progressResult.kind !== 'ok') {
    return { tool: 'readpilot.get_current_page_excerpt', ok: false, status: progressResult.kind };
  }

  const page = progressResult.data.pages.find((item: ProgressPage) => {
    if (contextMeta.pageId && item.id === contextMeta.pageId) return true;
    if (contextMeta.pageTitle && item.title === contextMeta.pageTitle) return true;
    return false;
  });
  if (!page?.file) {
    return { tool: 'readpilot.get_current_page_excerpt', ok: false, status: 'missing_page' as const };
  }

  const pagePath = path.resolve(bookRoot, page.file);
  const relative = path.relative(bookRoot, pagePath);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    return { tool: 'readpilot.get_current_page_excerpt', ok: false, status: 'unsafe_page_path' as const };
  }

  try {
    const html = await fs.readFile(pagePath, 'utf-8');
    const text = truncate(htmlToPlainText(html), pageCharLimit);
    return {
      tool: 'readpilot.get_current_page_excerpt',
      ok: !!text,
      status: text ? 'ok' as const : 'empty' as const,
      page: {
        id: page.id,
        type: page.type,
        title: page.title,
        file: page.file,
      },
      charLimit: pageCharLimit,
      text,
    };
  } catch (error) {
    return {
      tool: 'readpilot.get_current_page_excerpt',
      ok: false,
      status: 'error' as const,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function searchSourceChunksPayload(options: SourceSearchOptions) {
  const bookRoot = resolveBookDir(options.bookDataDir);
  if (!bookRoot) {
    return { tool: 'readpilot.search_source_chunks', ok: false, status: 'missing_book' as const, chunks: [] };
  }

  const sourcePath = path.join(bookRoot, 'source.jsonl');
  if (!await pathExists(sourcePath)) {
    return { tool: 'readpilot.search_source_chunks', ok: false, status: 'missing_source_jsonl' as const, chunks: [] };
  }

  const limit = parsePositiveInt(options.limit, 8, 50);
  const maxCharsPerChunk = parsePositiveInt(options.maxCharsPerChunk, 1200, 5000);
  const query = options.query?.trim().toLowerCase() ?? '';
  const chapter = options.chapter?.trim().toLowerCase() ?? '';

  try {
    const raw = await fs.readFile(sourcePath, 'utf-8');
    const chunks: Array<JsonlChunk & { score: number }> = [];
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const parsed = safeJsonlChunk(JSON.parse(trimmed));
      if (!parsed) continue;

      const chapterMatch = !chapter || parsed.chapter.toLowerCase().includes(chapter);
      const queryMatch = !query || parsed.text.toLowerCase().includes(query) || parsed.chapter.toLowerCase().includes(query);
      if (!chapterMatch || !queryMatch) continue;

      const score = (query && parsed.chapter.toLowerCase().includes(query) ? 2 : 0)
        + (query && parsed.text.toLowerCase().includes(query) ? 1 : 0)
        + (chapter && parsed.chapter.toLowerCase().includes(chapter) ? 1 : 0);
      chunks.push({ ...parsed, text: truncate(parsed.text, maxCharsPerChunk), score });
    }

    chunks.sort((a, b) => b.score - a.score || a.loc.item_index - b.loc.item_index || a.loc.chunk_index - b.loc.chunk_index);

    return {
      tool: 'readpilot.search_source_chunks',
      ok: true,
      status: 'ok' as const,
      query: options.query ?? null,
      chapter: options.chapter ?? null,
      totalMatches: chunks.length,
      chunks: chunks.slice(0, limit).map((chunk) => ({
        loc: chunk.loc,
        chapter: chunk.chapter,
        text: chunk.text,
        score: chunk.score,
      })),
    };
  } catch (error) {
    return {
      tool: 'readpilot.search_source_chunks',
      ok: false,
      status: 'error' as const,
      message: error instanceof Error ? error.message : String(error),
      chunks: [],
    };
  }
}

export function getReaderProfilePayload() {
  return {
    tool: 'readpilot.get_reader_profile',
    ok: false,
    status: 'not_implemented' as const,
    message: 'Reader profile storage is not implemented yet. Use notes and WeRead memory as available reader signals.',
  };
}

export function getProgressContext(bookDataDir: string): string {
  const result = readProgress(bookDataDir);
  if (result.kind === 'ok') return formatProgressSummary(result.data);
  if (result.kind === 'corrupt') return `progress.json is corrupt: ${result.error.message}`;
  return '';
}

export function getCompanionIndexContext(bookDataDir: string, charLimit = DEFAULT_COMPANION_CHAR_LIMIT): string {
  const bookRoot = resolveBookDir(bookDataDir);
  if (!bookRoot) return '';
  return readCompanionContext(bookRoot, charLimit);
}

export function getNotesContext(bookId: string | undefined, limit = DEFAULT_NOTES_LIMIT): string {
  if (!bookId) return '';
  try {
    return formatNotes(getNotesByBook(bookId), limit);
  } catch {
    return '';
  }
}

export function getWereadMemoryContext(bookDataDir: string): string {
  try {
    return buildWereadContextSection(bookDataDir);
  } catch {
    return '';
  }
}

export async function getCurrentPageExcerpt(options: ViewAgentContextOptions): Promise<string> {
  const payload = await getCurrentPageExcerptPayload(options);
  if (!payload.ok || !('text' in payload) || !payload.text) return '';
  const page = 'page' in payload ? payload.page : null;
  return [
    `Title: ${page?.title ?? 'Unknown'}`,
    `Type: ${page?.type ?? 'unknown'}`,
    '',
    payload.text,
  ].join('\n');
}

export function buildBookAgentContextSection(options: BookAgentContextOptions): string {
  const sections: string[] = [];

  sections.push([
    '## ReadPilot book context',
    `Book: ${options.bookTitle || 'Unknown'}`,
    `bookDir: ${options.bookDataDir}`,
    '',
    'Use this context as private reading state. Do not quote internal metadata unless the user asks.',
  ].join('\n'));

  const progress = getProgressContext(options.bookDataDir);
  if (progress) {
    sections.push(`### progress.json summary\n${progress}`);
  }

  const companion = getCompanionIndexContext(options.bookDataDir, options.companionCharLimit);
  if (companion) {
    sections.push(`### companion index\n${companion}`);
  }

  const notes = getNotesContext(options.bookId, options.notesLimit);
  if (notes) {
    sections.push(`### local reading notes\n${notes}`);
  }

  const weread = getWereadMemoryContext(options.bookDataDir);
  if (weread) {
    sections.push(`### WeRead reader memory\n${weread}`);
  }

  return sections.join('\n\n');
}

export async function buildViewAgentContextSection(options: ViewAgentContextOptions): Promise<string> {
  const { contextMeta, bookDataDir } = options;
  if (!contextMeta) return '';

  const rows = [
    ['viewMode', contextMeta.viewMode],
    ['bookTitle', contextMeta.bookTitle],
    ['bookDir', contextMeta.bookDir],
    ['pageTitle', contextMeta.pageTitle],
    ['pageType', contextMeta.pageType],
    ['pageId', contextMeta.pageId],
    ['noteId', contextMeta.noteId],
    ['articleId', contextMeta.articleId],
  ].filter(([, value]) => value);

  const pageExcerpt = await getCurrentPageExcerpt({ contextMeta, bookDataDir });
  if (rows.length === 0 && !pageExcerpt) return '';

  const sections = [
    '## Current ReadPilot UI context',
    rows.map(([key, value]) => `- ${key}: ${value}`).join('\n'),
    '',
    'Use this as private UI state. Do not begin replies by restating these fields.',
  ];

  if (pageExcerpt) {
    sections.push('', '### current page excerpt', pageExcerpt);
  }

  return sections.join('\n');
}
