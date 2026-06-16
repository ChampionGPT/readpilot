// input: POST payload { prompt, sessionId, bookId, contextMeta, provider }
// output: SSE stream from the selected agent provider
// pos: ChatPanel API boundary; resolves session/provider and passes compact ReadPilot context to agent adapters
import { NextRequest } from 'next/server';
import { getAgentProviderId, streamAgent, type AgentProviderId } from '@/lib/agent-provider';
import {
  addMessage,
  getBook,
  getMessages,
  getOrCreateLatestSession,
  getProviderSessionId,
  getSession,
  updateSessionProvider,
  upsertBook,
} from '@/lib/db';
import { shouldAllowFileMutationTools } from '@/lib/chat-tool-policy';
import { buildViewAgentContextSection, type ChatContextMeta } from '@/lib/agent-context';

function normalizeProvider(value: unknown): AgentProviderId {
  if (value === 'claude' || value === 'codex' || value === 'hermes') return value;
  return getAgentProviderId();
}

function legacySdkSessionForProvider(sdkSessionId: string | undefined, provider: AgentProviderId): string | undefined {
  if (!sdkSessionId) return undefined;
  if (provider === 'codex') return sdkSessionId.startsWith('codex:') ? sdkSessionId : undefined;
  if (provider === 'claude') return sdkSessionId.startsWith('codex:') ? undefined : sdkSessionId;
  return undefined;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prompt, sessionId, bookId, contextMeta, provider: requestedProvider } = body as {
      prompt?: string;
      sessionId?: string;
      bookId?: string;
      contextMeta?: ChatContextMeta;
      provider?: AgentProviderId;
    };
    const provider = normalizeProvider(requestedProvider);

    if (!prompt) {
      return new Response('Missing prompt', { status: 400 });
    }

    if (!bookId) {
      return new Response('Missing bookId', { status: 400 });
    }

    let book = getBook(bookId);
    if (!book) {
      // If the DB was reset, treat bookId as the local data directory and recreate the minimal row.
      book = upsertBook(bookId, bookId, bookId);
    }

    let session = sessionId ? getSession(sessionId) : undefined;
    if (!session) {
      session = getOrCreateLatestSession(bookId);
    }

    if (session.provider !== provider) {
      updateSessionProvider(session.id, provider);
      session = getSession(session.id) ?? session;
    }

    const recentMessages = getMessages(session.id).slice(-8);
    const allowFileMutationTools = shouldAllowFileMutationTools(prompt, contextMeta, recentMessages);

    addMessage(session.id, 'user', prompt, null, provider);

    const abortController = new AbortController();
    req.signal.addEventListener('abort', () => abortController.abort());

    const stream = streamAgent({
      prompt,
      sessionId: session.id,
      sdkSessionId: getProviderSessionId(session.id, provider) ?? legacySdkSessionForProvider(session.sdkSessionId, provider),
      bookId: book.id,
      bookDataDir: book.dataDir,
      bookTitle: book.title,
      abortController,
      systemPromptAppend: await buildViewAgentContextSection({ contextMeta, bookDataDir: book.dataDir }),
      allowTools: allowFileMutationTools,
      provider,
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
