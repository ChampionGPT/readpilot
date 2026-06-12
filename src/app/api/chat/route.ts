// input: 客户端 POST 提交的聊天 payload { prompt, sessionId, bookId, contextMeta }
// output: HttpResponse 传递 SSE 数据流；轻量问答注入隐藏页面摘录并保持纯文本模式
// pos: 与客户端连接的边界层 API Route — 对话入口
// 声明：一旦我被更新，务必更新我的开头注释以及所属文件夹的 md。

import { NextRequest } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';
import { streamClaude } from '@/lib/claude-client';
import { getSession, addMessage, getBook, upsertBook, getOrCreateLatestSession, getMessages } from '@/lib/db';
import { BOOKS_DIR } from '@/lib/constants';
import { shouldAllowFileMutationTools } from '@/lib/chat-tool-policy';
import type { ProgressData, ProgressPage } from '@/types/progress-data';

interface ChatContextMeta {
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

const PAGE_CONTEXT_CHAR_LIMIT = 6000;

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
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/\s+\n/g, '\n')
    .replace(/\n\s+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function isSafeChildPath(root: string, target: string): boolean {
  const relative = path.relative(root, target);
  return !!relative && !relative.startsWith('..') && !path.isAbsolute(relative);
}

async function buildCurrentPageExcerpt(contextMeta: ChatContextMeta | undefined, bookDataDir: string): Promise<string> {
  if (!contextMeta?.pageId && !contextMeta?.pageTitle) return '';

  try {
    const bookRoot = path.resolve(BOOKS_DIR, bookDataDir);
    const progressPath = path.join(bookRoot, 'progress.json');
    if (!isSafeChildPath(path.resolve(BOOKS_DIR), progressPath)) return '';

    const progress = JSON.parse(await readFile(progressPath, 'utf-8')) as ProgressData;
    const page = progress.pages.find((item: ProgressPage) => {
      if (contextMeta.pageId && item.id === contextMeta.pageId) return true;
      if (contextMeta.pageTitle && item.title === contextMeta.pageTitle) return true;
      return false;
    });

    if (!page?.file) return '';

    const pagePath = path.resolve(bookRoot, page.file);
    if (!isSafeChildPath(bookRoot, pagePath)) return '';

    const html = await readFile(pagePath, 'utf-8');
    const plainText = htmlToPlainText(html).slice(0, PAGE_CONTEXT_CHAR_LIMIT);
    if (!plainText) return '';

    return `\n\n## 当前页面内容摘录（系统内部，不要复述）\n标题：${page.title}\n类型：${page.type}\n\n${plainText}\n\n请基于这段摘录回答当前章节/页面相关问题；除非用户明确要求生成页面，否则只输出普通文字回答。`;
  } catch {
    return '';
  }
}

async function buildHiddenContext(contextMeta: ChatContextMeta | undefined, bookDataDir: string): Promise<string> {
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

  if (rows.length === 0) return '';

  const pageExcerpt = await buildCurrentPageExcerpt(contextMeta, bookDataDir);

  return `\n\n## 当前界面上下文（系统内部，不要复述）\n${rows
    .map(([key, value]) => `- ${key}: ${value}`)
    .join('\n')}\n\n使用这些上下文理解用户问题，但不要把这些字段当作用户消息内容，也不要在回答开头复述“你正在...”这类状态说明。${pageExcerpt}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prompt, sessionId, bookId, contextMeta } = body as {
      prompt?: string;
      sessionId?: string;
      bookId?: string;
      contextMeta?: ChatContextMeta;
    };

    if (!prompt) {
      return new Response('Missing prompt', { status: 400 });
    }

    if (!bookId) {
      return new Response('Missing bookId', { status: 400 });
    }

    let book = getBook(bookId);
    if (!book) {
      // If the book does not exist in DB (e.g. database cleared, or no prior fetch), auto-sync it.
      // bookId is treated as the directory here.
      book = upsertBook(bookId, bookId, bookId);
    }

    // Session 管理逻辑：
    // 1. 如果前端传了 sessionId，尝试使用它
    // 2. 如果没有传或 session 不存在，获取或创建最新会话
    let session = sessionId ? getSession(sessionId) : undefined;
    if (!session) {
      session = getOrCreateLatestSession(bookId);
    }

    const recentMessages = getMessages(session.id).slice(-8);
    const allowFileMutationTools = shouldAllowFileMutationTools(prompt, contextMeta, recentMessages);

    addMessage(session.id, 'user', prompt);

    const abortController = new AbortController();
    req.signal.addEventListener('abort', () => abortController.abort());

    const stream = streamClaude({
      prompt,
      sessionId: session.id,
      sdkSessionId: session.sdkSessionId,
      bookDataDir: book.dataDir,
      bookTitle: book.title,
      abortController,
      systemPromptAppend: await buildHiddenContext(contextMeta, book.dataDir),
      allowTools: allowFileMutationTools,
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Session-Id': session.id,
      },
    });
  } catch (error: unknown) {
    console.error('API /chat error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
