#!/usr/bin/env node
// input: MCP tool calls over stdio
// output: read-only ReadPilot context payloads
// pos: Thin MCP adapter over src/lib/agent-context; business logic stays in Context Service
import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import * as z from 'zod/v4';
import { getBook, getBooks } from '../../lib/db';
import {
  getCompanionIndexPayload,
  getCurrentBookPayload,
  getCurrentPageExcerptPayload,
  getNotesPayload,
  getProgressPayload,
  getReaderProfilePayload,
  getWereadMemoryPayload,
  searchSourceChunksPayload,
  type ChatContextMeta,
  type ContextBookRef,
} from '../../lib/agent-context';

const optionalBookRefSchema = {
  bookId: z.string().optional().describe('ReadPilot book id. Use this when available.'),
  bookDir: z.string().optional().describe('ReadPilot local book directory under data/books.'),
  bookTitle: z.string().optional().describe('Optional display title fallback.'),
};

const bookRefSchema = {
  ...optionalBookRefSchema,
};

function asStructuredContent(payload: unknown): Record<string, unknown> {
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    return payload as Record<string, unknown>;
  }
  return { value: payload };
}

function toolResult(payload: unknown) {
  return {
    content: [{
      type: 'text' as const,
      text: JSON.stringify(payload, null, 2),
    }],
    structuredContent: asStructuredContent(payload),
  };
}

function jsonResource(uri: URL | string, payload: unknown) {
  return {
    contents: [{
      uri: uri.toString(),
      mimeType: 'application/json',
      text: JSON.stringify(payload, null, 2),
    }],
  };
}

function errorPayload(message: string) {
  return {
    ok: false,
    error: 'missing_book_ref',
    message,
  };
}

function resolveBookRef(args: { bookId?: string; bookDir?: string; bookTitle?: string }): ContextBookRef | null {
  if (args.bookId) {
    const book = getBook(args.bookId);
    if (book) {
      return { bookId: book.id, bookDataDir: book.dataDir, bookTitle: book.title };
    }
  }

  if (args.bookDir) {
    const book = getBooks().find((candidate) => candidate.dataDir === args.bookDir);
    return {
      bookId: book?.id ?? args.bookId,
      bookDataDir: book?.dataDir ?? args.bookDir,
      bookTitle: book?.title ?? args.bookTitle,
    };
  }

  return null;
}

function contextMetaFromArgs(args: {
  bookId?: string;
  bookDir?: string;
  bookTitle?: string;
  viewMode?: string;
  pageId?: string;
  pageTitle?: string;
  pageType?: string;
  noteId?: string;
  articleId?: string;
}, ref: ContextBookRef): ChatContextMeta {
  return {
    viewMode: args.viewMode,
    bookId: ref.bookId ?? args.bookId ?? null,
    bookDir: ref.bookDataDir,
    bookTitle: ref.bookTitle ?? args.bookTitle ?? null,
    pageId: args.pageId ?? null,
    pageTitle: args.pageTitle ?? null,
    pageType: args.pageType ?? null,
    noteId: args.noteId ?? null,
    articleId: args.articleId ?? null,
  };
}

function requireBookRef(args: { bookId?: string; bookDir?: string; bookTitle?: string }): ContextBookRef | ReturnType<typeof errorPayload> {
  return resolveBookRef(args) ?? errorPayload('Provide bookId or bookDir.');
}

function isErrorPayload(value: ContextBookRef | ReturnType<typeof errorPayload>): value is ReturnType<typeof errorPayload> {
  return 'ok' in value && value.ok === false;
}

function stringVariable(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

function encodedBookDir(bookDir: string): string {
  return encodeURIComponent(bookDir);
}

function listBookResources(kind: 'current' | 'progress' | 'companion-index' | 'notes' | 'weread-memory') {
  return {
    resources: getBooks().map((book) => ({
      uri: `readpilot://book/${encodedBookDir(book.dataDir)}/${kind}`,
      name: `${book.title} ${kind}`,
      title: `${book.title} ${kind}`,
      description: `ReadPilot ${kind} context for ${book.title}`,
      mimeType: 'application/json',
    })),
  };
}

function registerContextResources(server: McpServer): void {
  const bookDirCompletion = () => getBooks().map((book) => book.dataDir);
  const pageIdCompletion = (value: string, context?: { arguments?: Record<string, string> }) => {
    const bookDir = context?.arguments?.bookDir;
    if (!bookDir) return [];
    const progress = getProgressPayload(bookDir);
    if (!progress.ok || !('pages' in progress)) return [];
    const pages = progress.pages ?? [];
    return pages
      .map((page) => page.id)
      .filter((pageId) => pageId.toLowerCase().includes(value.toLowerCase()));
  };

  server.registerResource('readpilot.tools', 'readpilot://tools', {
    title: 'ReadPilot context tools',
    description: 'Tool names exposed by the ReadPilot context MCP server.',
    mimeType: 'application/json',
  }, async (uri) => jsonResource(uri, {
    tools: [
      'readpilot.get_current_book',
      'readpilot.get_progress',
      'readpilot.get_current_page_excerpt',
      'readpilot.get_companion_index',
      'readpilot.search_source_chunks',
      'readpilot.get_notes',
      'readpilot.get_weread_memory',
      'readpilot.get_reader_profile',
    ],
  }));

  server.registerResource('readpilot.book.current', new ResourceTemplate('readpilot://book/{bookDir}/current', {
    list: () => listBookResources('current'),
    complete: { bookDir: bookDirCompletion },
  }), {
    title: 'ReadPilot current book',
    description: 'Current book metadata and local artifact availability.',
    mimeType: 'application/json',
  }, async (uri, variables) => {
    const bookDir = stringVariable(variables.bookDir);
    const ref = requireBookRef({ bookDir });
    return jsonResource(uri, isErrorPayload(ref) ? ref : await getCurrentBookPayload(ref));
  });

  server.registerResource('readpilot.book.progress', new ResourceTemplate('readpilot://book/{bookDir}/progress', {
    list: () => listBookResources('progress'),
    complete: { bookDir: bookDirCompletion },
  }), {
    title: 'ReadPilot progress',
    description: 'Compact progress.json view for a ReadPilot book.',
    mimeType: 'application/json',
  }, async (uri, variables) => {
    const bookDir = stringVariable(variables.bookDir);
    return jsonResource(uri, getProgressPayload(bookDir));
  });

  server.registerResource('readpilot.book.companion-index', new ResourceTemplate('readpilot://book/{bookDir}/companion-index', {
    list: () => listBookResources('companion-index'),
    complete: { bookDir: bookDirCompletion },
  }), {
    title: 'ReadPilot companion index',
    description: 'Compiled companion book/chapter/topic index context.',
    mimeType: 'application/json',
  }, async (uri, variables) => {
    const bookDir = stringVariable(variables.bookDir);
    return jsonResource(uri, getCompanionIndexPayload(bookDir));
  });

  server.registerResource('readpilot.book.notes', new ResourceTemplate('readpilot://book/{bookDir}/notes', {
    list: () => listBookResources('notes'),
    complete: { bookDir: bookDirCompletion },
  }), {
    title: 'ReadPilot notes',
    description: 'Local ReadPilot notes for a book.',
    mimeType: 'application/json',
  }, async (uri, variables) => {
    const bookDir = stringVariable(variables.bookDir);
    const ref = requireBookRef({ bookDir });
    return jsonResource(uri, isErrorPayload(ref) ? ref : getNotesPayload({ bookId: ref.bookId }));
  });

  server.registerResource('readpilot.book.weread-memory', new ResourceTemplate('readpilot://book/{bookDir}/weread-memory', {
    list: () => listBookResources('weread-memory'),
    complete: { bookDir: bookDirCompletion },
  }), {
    title: 'ReadPilot WeRead memory',
    description: 'Cached WeRead highlights, thoughts, and progress for a book.',
    mimeType: 'application/json',
  }, async (uri, variables) => {
    const bookDir = stringVariable(variables.bookDir);
    return jsonResource(uri, getWereadMemoryPayload(bookDir));
  });

  server.registerResource('readpilot.book.page-excerpt', new ResourceTemplate('readpilot://book/{bookDir}/page/{pageId}/excerpt', {
    list: undefined,
    complete: {
      bookDir: bookDirCompletion,
      pageId: pageIdCompletion,
    },
  }), {
    title: 'ReadPilot page excerpt',
    description: 'Plain-text excerpt for a page in a ReadPilot book.',
    mimeType: 'application/json',
  }, async (uri, variables) => {
    const bookDir = stringVariable(variables.bookDir);
    const pageId = stringVariable(variables.pageId);
    const ref = requireBookRef({ bookDir });
    if (isErrorPayload(ref)) return jsonResource(uri, ref);
    return jsonResource(uri, await getCurrentPageExcerptPayload({
      bookDataDir: ref.bookDataDir,
      contextMeta: contextMetaFromArgs({ pageId }, ref),
    }));
  });

  server.registerResource('readpilot.book.source-search', new ResourceTemplate('readpilot://book/{bookDir}/source-search/{query}', {
    list: undefined,
    complete: { bookDir: bookDirCompletion },
  }), {
    title: 'ReadPilot source search',
    description: 'Search source.jsonl chunks by query.',
    mimeType: 'application/json',
  }, async (uri, variables) => {
    const bookDir = stringVariable(variables.bookDir);
    const query = stringVariable(variables.query);
    const ref = requireBookRef({ bookDir });
    if (isErrorPayload(ref)) return jsonResource(uri, ref);
    return jsonResource(uri, await searchSourceChunksPayload({ ...ref, query }));
  });
}

export function createReadPilotContextMcpServer(): McpServer {
  const server = new McpServer({
    name: 'readpilot-context',
    version: '0.1.0',
  });

  registerContextResources(server);

  server.registerTool('readpilot.get_current_book', {
    title: 'Get current ReadPilot book',
    description: 'Return current book metadata and available local artifacts.',
    inputSchema: optionalBookRefSchema,
  }, async (args) => {
    const ref = requireBookRef(args);
    return toolResult(isErrorPayload(ref) ? ref : await getCurrentBookPayload(ref));
  });

  server.registerTool('readpilot.get_progress', {
    title: 'Get ReadPilot progress',
    description: 'Return a compact progress.json view for the current book.',
    inputSchema: {
      ...bookRefSchema,
      pageLimit: z.number().optional().describe('Maximum number of page records to return.'),
    },
  }, async (args) => {
    const ref = requireBookRef(args);
    return toolResult(isErrorPayload(ref) ? ref : getProgressPayload(ref.bookDataDir, args.pageLimit));
  });

  server.registerTool('readpilot.get_current_page_excerpt', {
    title: 'Get current page excerpt',
    description: 'Return plain-text excerpt for a current page id or title.',
    inputSchema: {
      ...bookRefSchema,
      pageId: z.string().optional(),
      pageTitle: z.string().optional(),
      pageType: z.string().optional(),
      viewMode: z.string().optional(),
      noteId: z.string().optional(),
      articleId: z.string().optional(),
      charLimit: z.number().optional(),
    },
  }, async (args) => {
    const ref = requireBookRef(args);
    if (isErrorPayload(ref)) return toolResult(ref);
    return toolResult(await getCurrentPageExcerptPayload({
      bookDataDir: ref.bookDataDir,
      contextMeta: contextMetaFromArgs(args, ref),
      pageCharLimit: args.charLimit,
    }));
  });

  server.registerTool('readpilot.get_companion_index', {
    title: 'Get companion index',
    description: 'Return ReadPilot companion book/chapter/topic index context.',
    inputSchema: {
      ...bookRefSchema,
      charLimit: z.number().optional(),
    },
  }, async (args) => {
    const ref = requireBookRef(args);
    return toolResult(isErrorPayload(ref) ? ref : getCompanionIndexPayload(ref.bookDataDir, args.charLimit));
  });

  server.registerTool('readpilot.search_source_chunks', {
    title: 'Search source chunks',
    description: 'Search source.jsonl chunks by query and/or chapter.',
    inputSchema: {
      ...bookRefSchema,
      query: z.string().optional(),
      chapter: z.string().optional(),
      limit: z.number().optional(),
      maxCharsPerChunk: z.number().optional(),
    },
  }, async (args) => {
    const ref = requireBookRef(args);
    if (isErrorPayload(ref)) return toolResult(ref);
    return toolResult(await searchSourceChunksPayload({
      ...ref,
      query: args.query,
      chapter: args.chapter,
      limit: args.limit,
      maxCharsPerChunk: args.maxCharsPerChunk,
    }));
  });

  server.registerTool('readpilot.get_notes', {
    title: 'Get reading notes',
    description: 'Return local ReadPilot notes for the current book or page.',
    inputSchema: {
      ...bookRefSchema,
      pageId: z.string().optional(),
      limit: z.number().optional(),
    },
  }, async (args) => {
    const ref = requireBookRef(args);
    return toolResult(isErrorPayload(ref) ? ref : getNotesPayload({
      bookId: ref.bookId,
      pageId: args.pageId,
      limit: args.limit,
    }));
  });

  server.registerTool('readpilot.get_weread_memory', {
    title: 'Get WeRead memory',
    description: 'Return cached WeRead highlights, thoughts, and progress for the current book.',
    inputSchema: bookRefSchema,
  }, async (args) => {
    const ref = requireBookRef(args);
    return toolResult(isErrorPayload(ref) ? ref : getWereadMemoryPayload(ref.bookDataDir));
  });

  server.registerTool('readpilot.get_reader_profile', {
    title: 'Get reader profile',
    description: 'Return durable reader profile when implemented.',
    inputSchema: {},
  }, async () => toolResult(getReaderProfilePayload()));

  return server;
}

export async function startReadPilotContextMcpServer(): Promise<void> {
  const server = createReadPilotContextMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('ReadPilot context MCP server running on stdio');
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === currentFile) {
  startReadPilotContextMcpServer().catch((error: unknown) => {
    console.error('ReadPilot context MCP server failed:', error);
    process.exit(1);
  });
}
