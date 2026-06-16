// input: GET /api/context/[tool]?bookId=...&bookDir=...
// output: JSON payload from the ReadPilot Context Service
// pos: Read-only debug/API surface for future readpilot.* MCP tools
import { NextRequest, NextResponse } from 'next/server';
import { getBook, getBooks } from '@/lib/db';
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
} from '@/lib/agent-context';

type RouteParams = { params: Promise<{ tool: string }> };

function normalizeToolName(value: string): string {
  return decodeURIComponent(value).trim().toLowerCase().replace(/^readpilot\./, '').replace(/-/g, '_');
}

function numberParam(searchParams: URLSearchParams, key: string): number | undefined {
  const raw = searchParams.get(key);
  if (!raw) return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function resolveBookRef(searchParams: URLSearchParams): ContextBookRef | null {
  const bookId = searchParams.get('bookId') || undefined;
  const bookDir = searchParams.get('bookDir') || undefined;
  const bookTitle = searchParams.get('bookTitle') || undefined;

  if (bookId) {
    const book = getBook(bookId);
    if (book) {
      return { bookId: book.id, bookDataDir: book.dataDir, bookTitle: book.title };
    }
  }

  if (bookDir) {
    const book = getBooks().find((candidate) => candidate.dataDir === bookDir);
    return {
      bookId: book?.id ?? bookId,
      bookDataDir: book?.dataDir ?? bookDir,
      bookTitle: book?.title ?? bookTitle,
    };
  }

  return null;
}

function buildContextMeta(searchParams: URLSearchParams, ref: ContextBookRef): ChatContextMeta {
  return {
    viewMode: searchParams.get('viewMode') || undefined,
    bookId: ref.bookId ?? searchParams.get('bookId') ?? null,
    bookDir: ref.bookDataDir,
    bookTitle: ref.bookTitle ?? searchParams.get('bookTitle') ?? null,
    pageId: searchParams.get('pageId'),
    pageTitle: searchParams.get('pageTitle'),
    pageType: searchParams.get('pageType'),
    noteId: searchParams.get('noteId'),
    articleId: searchParams.get('articleId'),
  };
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const { tool } = await params;
  const toolName = normalizeToolName(tool);
  const searchParams = req.nextUrl.searchParams;

  const needsBook = toolName !== 'get_reader_profile' && toolName !== 'reader_profile';
  const ref = resolveBookRef(searchParams);
  if (needsBook && !ref) {
    return NextResponse.json({
      ok: false,
      error: 'missing_book_ref',
      message: 'Provide bookId or bookDir.',
    }, { status: 400 });
  }

  switch (toolName) {
    case 'get_current_book':
    case 'current_book':
      return NextResponse.json(await getCurrentBookPayload(ref!));

    case 'get_progress':
    case 'progress':
      return NextResponse.json(getProgressPayload(ref!.bookDataDir, numberParam(searchParams, 'pageLimit')));

    case 'get_current_page_excerpt':
    case 'current_page_excerpt':
      return NextResponse.json(await getCurrentPageExcerptPayload({
        bookDataDir: ref!.bookDataDir,
        contextMeta: buildContextMeta(searchParams, ref!),
        pageCharLimit: numberParam(searchParams, 'charLimit'),
      }));

    case 'get_companion_index':
    case 'companion_index':
      return NextResponse.json(getCompanionIndexPayload(ref!.bookDataDir, numberParam(searchParams, 'charLimit')));

    case 'search_source_chunks':
    case 'source_search':
      return NextResponse.json(await searchSourceChunksPayload({
        ...ref!,
        query: searchParams.get('query') ?? undefined,
        chapter: searchParams.get('chapter') ?? undefined,
        limit: numberParam(searchParams, 'limit'),
        maxCharsPerChunk: numberParam(searchParams, 'maxCharsPerChunk'),
      }));

    case 'get_notes':
    case 'notes':
      return NextResponse.json(getNotesPayload({
        bookId: ref!.bookId,
        pageId: searchParams.get('pageId'),
        limit: numberParam(searchParams, 'limit'),
      }));

    case 'get_weread_memory':
    case 'weread_memory':
      return NextResponse.json(getWereadMemoryPayload(ref!.bookDataDir));

    case 'get_reader_profile':
    case 'reader_profile':
      return NextResponse.json(getReaderProfilePayload());

    default:
      return NextResponse.json({
        ok: false,
        error: 'unknown_context_tool',
        tool: toolName,
      }, { status: 404 });
  }
}
