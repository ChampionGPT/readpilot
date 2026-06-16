// input: ReadPilot chat stream options
// output: selected coding-agent provider stream
// pos: Provider selection layer between /api/chat and concrete agent clients
// 声明：一旦我被更新，务必更新我的开头注释以及所属文件夹的 README。
import { streamClaude } from './claude-client';
import { streamCodex } from './codex-client';

export type AgentProviderId = 'claude' | 'codex' | 'hermes';

export interface AgentStreamOptions {
  prompt: string;
  sessionId: string;
  sdkSessionId?: string;
  bookId?: string;
  bookDataDir: string;
  abortController: AbortController;
  systemPromptAppend?: string;
  bookTitle?: string;
  allowTools?: boolean;
  provider?: AgentProviderId;
}

export function getAgentProviderId(): AgentProviderId {
  const raw = (process.env.READPILOT_AGENT_PROVIDER || 'claude').trim().toLowerCase();
  if (raw === 'codex') return 'codex';
  if (raw === 'hermes') return 'hermes';
  return 'claude';
}

export function streamAgent(options: AgentStreamOptions): ReadableStream<Uint8Array> {
  const provider = options.provider ?? getAgentProviderId();

  if (provider === 'codex') {
    return streamCodex(options);
  }

  if (provider === 'hermes') {
    return streamUnsupportedProvider('Hermes provider is not implemented yet. Use READPILOT_AGENT_PROVIDER=claude or codex.');
  }

  return streamClaude(options);
}

function streamUnsupportedProvider(message: string): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      const send = (type: string, data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type, data })}\n\n`));
      };
      send('error', {
        category: 'configuration',
        userMessage: message,
        actionHint: 'Update READPILOT_AGENT_PROVIDER in .env.local.',
        retryable: false,
      });
      send('complete', {});
      controller.close();
    },
  });
}
