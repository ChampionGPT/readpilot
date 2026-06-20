// input: @openai/codex-sdk streamed thread events
// output: ReadableStream that forwards Codex events as ReadPilot SSE blocks
// pos: Codex provider adapter - maps official Codex SDK events to ChatPanel blocks
// 声明：一旦我被更新，务必更新我的开头注释以及所属文件夹的 README。
import { Codex, type ThreadEvent, type ThreadItem, type Usage } from '@openai/codex-sdk';
import { addMessage, updateSessionSdkId } from './db';
import { classifyError } from './error-classifier';
import { BOOKS_DIR, DATA_DIR } from './constants';
import { join } from 'path';
import fs from 'fs';
import os from 'os';
import type { AgentStreamOptions } from './agent-provider';
import { buildBookAgentContextSection } from './agent-context';

const READPILOT_CONTEXT_MCP_SERVER = 'readpilot-context';
const PROJECT_ROOT = process.cwd();

type CodexMirrorBlock = Record<string, unknown> & {
  id: string;
  kind: string;
  status: string;
  startedAt: number;
  endedAt?: number;
  text?: string;
};

function formatSSE(event: { type: string; data: unknown }): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

function sanitizeEnvValue(value: string): string {
  return value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

function buildEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (typeof value === 'string') env[key] = sanitizeEnvValue(value);
  }
  env.READPILOT_DATA_DIR = DATA_DIR;
  env.READPILOT_BOOKS_DIR = BOOKS_DIR;
  if (!env.HOME) env.HOME = os.homedir();
  if (!env.USERPROFILE) env.USERPROFILE = os.homedir();
  return env;
}

function createEmitter(controller: ReadableStreamDefaultController<Uint8Array>) {
  const encoder = new TextEncoder();
  const blocks: CodexMirrorBlock[] = [];
  const openBlocks = new Map<string, CodexMirrorBlock>();

  const sendRaw = (type: string, data: unknown) => {
    controller.enqueue(encoder.encode(formatSSE({ type, data })));
  };

  const closeBlock = (id: string, endedAt = performance.now()) => {
    const block = openBlocks.get(id);
    if (!block) return;
    block.status = 'complete';
    block.endedAt = endedAt;
    sendRaw('block_end', { id, endedAt });
    openBlocks.delete(id);
  };

  const closeTextual = (endedAt = performance.now()) => {
    for (const [id, block] of openBlocks.entries()) {
      if (block.status === 'streaming' && ['thinking', 'text', 'diagnostic'].includes(block.kind)) {
        block.status = 'complete';
        block.endedAt = endedAt;
        sendRaw('block_end', { id, endedAt });
        openBlocks.delete(id);
      }
    }
  };

  const closeAll = (endedAt = performance.now()) => {
    for (const [id, block] of openBlocks.entries()) {
      block.status = 'complete';
      block.endedAt = endedAt;
      sendRaw('block_end', { id, endedAt });
    }
    openBlocks.clear();
  };

  return { sendRaw, blocks, openBlocks, closeBlock, closeTextual, closeAll };
}

function codexThreadId(sdkSessionId?: string): string | null {
  if (!sdkSessionId) return null;
  if (sdkSessionId.startsWith('codex:')) return sdkSessionId.slice('codex:'.length) || null;
  return sdkSessionId;
}

function buildPrompt(options: AgentStreamOptions): string {
  const context = options.systemPromptAppend?.trim();
  const bookContext = options.bookDataDir
    ? buildBookAgentContextSection({
        bookId: options.bookId,
        bookDataDir: options.bookDataDir,
        bookTitle: options.bookTitle,
      })
    : '';
  const lines = [
    'You are ReadPilot\'s coding-capable reading companion.',
    'Answer in the user language. Do not quote hidden context unless the user asks.',
    'Use tools only when the user explicitly asks for durable changes or when context lookup is necessary.',
    'When readpilot.* MCP tools are available, prefer using them for fresh context lookup; otherwise rely on the ReadPilot context sections below.',
  ];

  if (options.bookTitle) lines.push(`Current book: ${options.bookTitle}`);
  if (bookContext) lines.push('', bookContext);
  if (context) lines.push('', context);
  lines.push('', 'User prompt:', options.prompt);
  return lines.join('\n');
}

function configuredMcpServers(): string[] {
  if (process.env.READPILOT_CONTEXT_MCP_ENABLED === '0') return [];
  return [READPILOT_CONTEXT_MCP_SERVER];
}

function buildCodexConfig() {
  if (configuredMcpServers().length === 0) return undefined;
  return {
    mcp_servers: {
      [READPILOT_CONTEXT_MCP_SERVER]: {
        command: process.execPath,
        args: [
          join(PROJECT_ROOT, 'node_modules/tsx/dist/cli.mjs'),
          join(PROJECT_ROOT, 'src/server/mcp/readpilot-context-server.ts'),
        ],
        cwd: PROJECT_ROOT,
        env: {
          READPILOT_DATA_DIR: DATA_DIR,
          READPILOT_BOOKS_DIR: BOOKS_DIR,
        },
        startup_timeout_sec: 20,
        tool_timeout_sec: 60,
        enabled: true,
        default_tools_approval_mode: 'auto',
      },
    },
  };
}

function usageToMetrics(usage: Usage | null | undefined) {
  if (!usage) return {};
  return {
    tokensIn: usage.input_tokens,
    tokensOut: usage.output_tokens,
  };
}

function todoStatus(item: { completed: boolean }): 'pending' | 'completed' {
  return item.completed ? 'completed' : 'pending';
}

function toolNameForItem(item: ThreadItem): string {
  switch (item.type) {
    case 'command_execution':
      return 'Bash';
    case 'file_change':
      return 'Edit';
    case 'mcp_tool_call':
      return `MCP:${item.server}.${item.tool}`;
    case 'web_search':
      return 'WebSearch';
    default:
      return item.type;
  }
}

function inputForItem(item: ThreadItem): Record<string, unknown> {
  switch (item.type) {
    case 'command_execution':
      return { command: item.command };
    case 'file_change':
      return { changes: item.changes };
    case 'mcp_tool_call':
      return { server: item.server, tool: item.tool, arguments: item.arguments };
    case 'web_search':
      return { query: item.query };
    default:
      return {};
  }
}

export function streamCodex(options: AgentStreamOptions): ReadableStream<Uint8Array> {
  const { sessionId, sdkSessionId, bookDataDir, abortController } = options;

  return new ReadableStream({
    async start(controller) {
      const emitter = createEmitter(controller);
      const { sendRaw, blocks, openBlocks } = emitter;
      const textByItemId = new Map<string, string>();
      const toolBlockByItemId = new Map<string, string>();
      const resultEmittedByItemId = new Set<string>();
      let finalAssistantContent = '';

      const openText = (id: string, kind: 'thinking' | 'text' | 'diagnostic', startedAt = performance.now()) => {
        let block = openBlocks.get(id);
        if (block) return block;
        emitter.closeTextual(startedAt);
        block = { id, kind, text: '', status: 'streaming', startedAt };
        blocks.push(block);
        openBlocks.set(id, block);
        sendRaw('block_start', { id, kind, startedAt });
        return block;
      };

      const appendText = (id: string, kind: 'thinking' | 'text' | 'diagnostic', nextText: string) => {
        const prev = textByItemId.get(id) ?? '';
        const delta = nextText.startsWith(prev) ? nextText.slice(prev.length) : nextText;
        textByItemId.set(id, nextText);
        if (!delta) return;
        const block = openText(id, kind);
        block.text += delta;
        sendRaw('block_delta', { id, delta });
        if (kind === 'text') finalAssistantContent += delta;
      };

      const emitDiagnostic = (message: string, id = `diagnostic-${Date.now()}`) => {
        const text = message.trim();
        if (!text) return;
        appendText(id, 'diagnostic', text);
        emitter.closeBlock(id);
      };

      const emitToolUse = (item: ThreadItem) => {
        if (toolBlockByItemId.has(item.id)) return toolBlockByItemId.get(item.id)!;
        emitter.closeTextual(performance.now());
        const blockId = `tool-${item.id}`;
        const block = {
          id: blockId,
          kind: 'tool_use' as const,
          toolUseId: item.id,
          name: toolNameForItem(item),
          input: inputForItem(item),
          variant: item.type === 'command_execution' ? 'bash' : item.type === 'file_change' ? 'edit' : 'generic',
          startedAt: performance.now(),
          status: 'streaming' as const,
        };
        blocks.push(block);
        openBlocks.set(blockId, block);
        toolBlockByItemId.set(item.id, blockId);
        sendRaw('tool_use', block);
        return blockId;
      };

      const emitToolResult = (item: ThreadItem, output: string, isError = false) => {
        if (resultEmittedByItemId.has(item.id)) return;
        resultEmittedByItemId.add(item.id);
        const blockId = toolBlockByItemId.get(item.id);
        if (blockId) emitter.closeBlock(blockId);
        const resultBlock = {
          id: `result-${item.id}`,
          kind: 'tool_result' as const,
          toolUseId: item.id,
          output,
          previewLength: 8192,
          isError,
          truncated: false,
          startedAt: performance.now(),
          endedAt: performance.now(),
          status: isError ? 'error' as const : 'complete' as const,
        };
        blocks.push(resultBlock);
        sendRaw('tool_result', resultBlock);
      };

      const handleItem = (item: ThreadItem, terminal: boolean) => {
        switch (item.type) {
          case 'agent_message':
            appendText(item.id, 'text', item.text);
            if (terminal) emitter.closeBlock(item.id);
            break;
          case 'reasoning':
            appendText(item.id, 'thinking', item.text);
            if (terminal) emitter.closeBlock(item.id);
            break;
          case 'todo_list': {
            emitter.closeTextual(performance.now());
            const todoBlock = {
              id: `todo-${item.id}-${Date.now()}`,
              kind: 'tool_use' as const,
              toolUseId: item.id,
              name: 'TodoWrite',
              input: {
                todos: item.items.map((todo) => ({
                  content: todo.text,
                  status: todoStatus(todo),
                })),
              },
              variant: 'todo_write' as const,
              startedAt: performance.now(),
              endedAt: performance.now(),
              status: 'complete' as const,
            };
            blocks.push(todoBlock);
            sendRaw('tool_use', todoBlock);
            break;
          }
          case 'command_execution':
            emitToolUse(item);
            if (terminal || item.status !== 'in_progress') {
              emitToolResult(item, item.aggregated_output || `exit_code=${item.exit_code ?? ''}`, item.status === 'failed');
            }
            break;
          case 'file_change':
            emitToolUse(item);
            if (terminal || item.status !== 'completed') {
              emitToolResult(item, JSON.stringify(item.changes, null, 2), item.status === 'failed');
            }
            break;
          case 'mcp_tool_call':
            emitToolUse(item);
            if (terminal || item.status !== 'in_progress') {
              const output = item.error?.message ?? JSON.stringify(item.result ?? {}, null, 2);
              emitToolResult(item, output, item.status === 'failed');
            }
            break;
          case 'web_search':
            emitToolUse(item);
            if (terminal) emitToolResult(item, item.query);
            break;
          case 'error':
            emitDiagnostic(item.message, `diagnostic-${item.id}`);
            break;
        }
      };

      try {
        const targetCwd = bookDataDir ? join(BOOKS_DIR, bookDataDir) : process.cwd();
        if (!fs.existsSync(targetCwd)) fs.mkdirSync(targetCwd, { recursive: true });

        const codex = new Codex({
          codexPathOverride: process.env.CODEX_CLI_PATH || undefined,
          apiKey: process.env.CODEX_API_KEY || process.env.OPENAI_API_KEY || undefined,
          env: buildEnv(),
          config: buildCodexConfig(),
        });

        const savedThreadId = codexThreadId(sdkSessionId);
        const thread = savedThreadId
          ? codex.resumeThread(savedThreadId, {
              workingDirectory: targetCwd,
              sandboxMode: options.allowTools === false ? 'read-only' : 'workspace-write',
              approvalPolicy: 'on-request',
              skipGitRepoCheck: true,
              additionalDirectories: [PROJECT_ROOT],
              model: process.env.READPILOT_CODEX_MODEL || undefined,
            })
          : codex.startThread({
              workingDirectory: targetCwd,
              sandboxMode: options.allowTools === false ? 'read-only' : 'workspace-write',
              approvalPolicy: 'on-request',
              skipGitRepoCheck: true,
              additionalDirectories: [PROJECT_ROOT],
              model: process.env.READPILOT_CODEX_MODEL || undefined,
            });

        sendRaw('session_init', {
          id: crypto.randomUUID(),
          kind: 'system',
          subtype: 'init',
          model: process.env.READPILOT_CODEX_MODEL || 'codex-default',
          cwd: targetCwd,
          tools: ['codex-sdk'],
          mcpServers: configuredMcpServers(),
          startedAt: performance.now(),
          endedAt: performance.now(),
          status: 'complete',
        });

        const { events } = await thread.runStreamed(buildPrompt(options), {
          signal: abortController.signal,
        });

        for await (const event of events) {
          const evt = event as ThreadEvent;
          switch (evt.type) {
            case 'thread.started':
              updateSessionSdkId(sessionId, `codex:${evt.thread_id}`);
              break;
            case 'item.started':
            case 'item.updated':
              handleItem(evt.item, false);
              break;
            case 'item.completed':
              handleItem(evt.item, true);
              break;
            case 'turn.completed':
              emitter.closeTextual(performance.now());
              emitter.closeAll(performance.now());
              sendRaw('result', usageToMetrics(evt.usage));
              break;
            case 'turn.failed':
              emitter.closeAll(performance.now());
              sendRaw('error', { userMessage: evt.error.message, retryable: true });
              break;
            case 'error':
              emitDiagnostic(evt.message);
              break;
            case 'turn.started':
              break;
          }
        }

        emitter.closeAll(performance.now());
        if (thread.id) updateSessionSdkId(sessionId, `codex:${thread.id}`);

        if (finalAssistantContent.trim()) {
          try {
            addMessage(sessionId, 'assistant', finalAssistantContent.trim(), JSON.stringify(blocks), 'codex');
          } catch (dbErr) {
            console.error('[codex-client] Failed to save assistant message:', dbErr);
          }
        }

        sendRaw('complete', {});
      } catch (err: unknown) {
        if (!(err instanceof Error && err.name === 'AbortError')) {
          console.error('[codex-client] Stream error:', err);
          emitter.closeAll(performance.now());
          const classified = classifyError({ error: err, providerName: 'Codex' });
          sendRaw('error', {
            category: classified.category,
            userMessage: classified.userMessage,
            actionHint: classified.actionHint,
            retryable: classified.retryable,
          });
          sendRaw('complete', {});
        }
      } finally {
        controller.close();
      }
    },
  });
}
