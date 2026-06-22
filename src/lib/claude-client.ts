// input: @anthropic-ai/claude-agent-sdk 的 query 方法
// output: ReadableStream 将结果转发至前端；区分纯文本伴读问答和页面生成工具流
// pos: 后端大模型驱动核心 — 封装 Claude Agent SDK 为 SSE 流
// 声明：一旦我被更新，务必更新我的开头注释以及所属文件夹的 md。

import { query } from '@anthropic-ai/claude-agent-sdk';
import { updateSessionSdkId, addMessage } from './db';
import { classifyError } from './error-classifier';
import fs from 'fs';
import { join } from 'path';
import { BOOKS_DIR, DATA_DIR } from './constants';
import { findClaudeBinary, resolveScriptFromCmd, getExpandedPath, findGitBash } from './platform';
import os from 'os';
import path from 'path';
import { classifyTool } from './tool-classifier';
import { registerPending } from './permission-registry';
import { buildBookAgentContextSection } from './agent-context';
import { ensureReadPilotAgentSkills } from './agent-skills';

// ============================================================
// 环境变量清理函数 - 防止 Windows spawn EINVAL 错误
// ============================================================

/**
 * Sanitize a string for use as an environment variable value.
 * Removes null bytes and control characters that cause spawn EINVAL.
 */
function sanitizeEnvValue(value: string): string {
  return value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

/**
 * Sanitize all values in an env record so child_process.spawn won't
 * throw EINVAL due to invalid characters or non-string values.
 * On Windows, spawn is strict: every env value MUST be a string.
 */
function sanitizeEnv(env: Record<string, string>): Record<string, string> {
  const clean: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    if (typeof value === 'string') {
      clean[key] = sanitizeEnvValue(value);
    }
  }
  return clean;
}

// ============================================================

function formatSSE(event: { type: string; data: any }): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

/**
 * 创建一个对发送 SSE 事件 + 维护后端 blocks 镜像的双向工具集合
 */
function createBlockEmitter(controller: ReadableStreamDefaultController<Uint8Array>) {
  const encoder = new TextEncoder();
  const blocks: any[] = [];
  const openBlocks = new Map<string, any>();

  const sendRaw = (type: string, data: any) => {
    controller.enqueue(encoder.encode(formatSSE({ type, data })));
  };

  return {
    sendRaw,
    blocks,
    openBlocks,
    closeStreamingTextual(now: number) {
      for (const [id, blk] of openBlocks.entries()) {
        if (blk.status === 'streaming' && ['thinking', 'text', 'diagnostic'].includes(blk.kind)) {
          blk.status = 'complete';
          blk.endedAt = now;
          sendRaw('block_end', { id, endedAt: now });
          openBlocks.delete(id);
        }
      }
    },
    closeAll(now: number) {
      for (const [id, blk] of openBlocks.entries()) {
        blk.status = 'complete';
        blk.endedAt = now;
        sendRaw('block_end', { id, endedAt: now });
      }
      openBlocks.clear();
    },
  };
}

export interface ClaudeStreamOptions {
  prompt: string;
  sessionId: string;
  sdkSessionId?: string;
  bookId?: string;
  bookDataDir: string;
  abortController: AbortController;
  systemPromptAppend?: string;
  bookTitle?: string;
  /** Controls mutating tools. Read-only tools may still be allowed for context lookup. */
  allowTools?: boolean;
}

const READ_ONLY_TOOLS = new Set(['Read', 'LS', 'Glob', 'Grep']);
const PROJECT_ROOT = process.cwd();
const RUNTIME_MODULES_DIR = process.env.READPILOT_RUNTIME_MODULES_DIR || path.join(PROJECT_ROOT, 'node_modules');
const READPILOT_CONTEXT_MCP_SERVER = 'readpilot-context';

function isReadOnlyTool(toolName: string): boolean {
  return READ_ONLY_TOOLS.has(toolName) || toolName.startsWith(`mcp__${READPILOT_CONTEXT_MCP_SERVER}__readpilot.`);
}

function buildReadPilotMcpServers(baseEnv: Record<string, string>): Record<string, unknown> {
  if (process.env.READPILOT_CONTEXT_MCP_ENABLED === '0') return {};

  return {
    [READPILOT_CONTEXT_MCP_SERVER]: {
      type: 'stdio',
      command: process.execPath,
      args: [
        path.join(RUNTIME_MODULES_DIR, 'tsx', 'dist', 'cli.mjs'),
        path.join(PROJECT_ROOT, 'src', 'server', 'mcp', 'readpilot-context-server.ts'),
      ],
      env: {
        ...baseEnv,
        READPILOT_DATA_DIR: DATA_DIR,
        READPILOT_BOOKS_DIR: BOOKS_DIR,
      },
    },
  };
}

/**
 * 伴读系统提示词 - 定义AI的角色、能力和行为边界
 */
async function buildSystemPrompt(bookTitle?: string, bookDataDir?: string, bookId?: string): Promise<string> {
  const readPilotContext = bookDataDir
    ? buildBookAgentContextSection({ bookId, bookDataDir, bookTitle })
    : '';

  return `你是 ReadPilot 的智能伴读助手，一个专业的阅读分析伙伴。

## 核心身份
- 你是一个深度阅读理解专家，专注于帮助用户理解文学作品的深层含义
- 你的风格是温暖、专业、有洞察力的，像一个博学的图书管理员朋友

## 伴读方法
- 借鉴 book-to-skill 的思想：先形成全书级理解档案，再按当前章节或主题按需深化。
- 全书级理解要提炼结构、核心框架、概念索引、作者判断和反复出现的主题，不要把原文整本塞进每次对话。
- 章节问答优先使用当前页面摘录、progress.json、全书伴读档案和读者划线；只回答用户当前问题，不自动生成新页面。
- 当 readpilot.* MCP tools 可用时，优先按需调用工具读取上下文；若工具不可用，再使用当前提示词中的压缩上下文。

## 核心能力
1. **文本分析**: 分析章节主题、人物关系、写作手法、象征意义
2. **知识扩展**: 提供历史背景、作者信息、文学流派等上下文
3. **互动测验**: 在 ChatPanel 中用文字生成理解检测问题，帮助用户巩固阅读
4. **页面生成**: 仅当用户明确要求生成/创建/更新伴读页、阅读课程、交互式 HTML 页面时，使用 /books-to-course skill

## 路由规则

### ChatPanel 纯文本模式（默认）
以下请求只在 ChatPanel 输出文字，不调用 skill，不创建/修改文件，不输出 HTML：
- "这一章想表达什么？"、"帮我理解当前章节"、"解释这个概念"、"我不太理解 X"
- "我读完了第 X 章"、"继续聊这一章"、"总结一下当前章节"
- "给我几道检测题"、"问我几个问题"、"分析人物/论点/主题"

### 页面生成模式（显式触发）
只有当用户明确要求生成、创建、更新或做成页面时，才调用 \`/books-to-course\` skill，例如：
- "把这本书变成阅读课程"、"生成伴读页"、"为当前章节生成交互式 HTML"
- "更新 Hub"、"创建深入页/主题页/综合页"、"把这个概念做成页面"
- "陪我读这本书"仅在语境明确是初始化伴读课程/页面体系时触发；若只是想聊天陪读，保持纯文本模式。

## 行为准则
1. 回答要简洁有深度，避免冗长
2. 使用用户的语言回答（中文问中文答，英文问英文答）
3. 当用户请求生成阅读页面时，直接调用 /books-to-course skill (确保写入目录就在目前的 cwd 中)
4. 主动提供有价值的见解，但不要过度解释
5. 如果用户的问题不清楚，礼貌地请求澄清

## 当前阅读上下文
- 书籍: ${bookTitle || '未选择'}

${readPilotContext}

## 回应风格示例
用户: "这一章想表达什么？"
助手: "这一章通过XX的视角，展现了XX的主题。作者使用了XX手法..."

用户: "帮我生成一个测验"
助手: "可以。下面是 5 道针对当前章节的理解检测题：..."

用户: "把这本书变成阅读课程"
助手: 我来为你生成阅读课程页面。[调用 /books-to-course skill]
`;
}

export function streamClaude(options: ClaudeStreamOptions): ReadableStream<Uint8Array> {
  const { prompt, sessionId, sdkSessionId, bookId, bookDataDir, abortController, bookTitle, systemPromptAppend, allowTools = true } = options;

  return new ReadableStream({
    async start(controller) {
      const emitter = createBlockEmitter(controller);
      const { sendRaw, blocks, openBlocks } = emitter;

      const pushOneShot = (type: string, block: any) => {
        blocks.push(block);
        sendRaw(type, block);
      };

      const openTextual = (kind: 'thinking' | 'text' | 'diagnostic') => {
        const id = crypto.randomUUID();
        const block = { id, kind, text: '', status: 'streaming', startedAt: performance.now() };
        blocks.push(block);
        openBlocks.set(id, block);
        sendRaw('block_start', { id, kind, startedAt: block.startedAt });
        return block;
      };

      const appendTextual = (block: any, delta: string) => {
        block.text += delta;
        sendRaw('block_delta', { id: block.id, delta });
      };

      const getOrOpen = (kind: 'thinking' | 'text' | 'diagnostic') => {
        for (const blk of openBlocks.values()) {
          if (blk.kind === kind) return blk;
        }
        emitter.closeStreamingTextual(performance.now());
        return openTextual(kind);
      };

      try {
        const systemPrompt = `${await buildSystemPrompt(bookTitle, bookDataDir, bookId)}${systemPromptAppend || ''}`;
        const targetCwd = bookDataDir ? join(BOOKS_DIR, bookDataDir) : process.cwd();

        if (!fs.existsSync(targetCwd)) {
          console.log(`[claude-client] Creating missing CWD directory: ${targetCwd}`);
          fs.mkdirSync(targetCwd, { recursive: true });
        }
        if (allowTools !== false) ensureReadPilotAgentSkills(targetCwd);

        const baseEnv: Record<string, string> = { ...process.env as Record<string, string> };
        if ('Path' in baseEnv && baseEnv.Path) {
          baseEnv.PATH = baseEnv.PATH ? `${baseEnv.Path}${path.delimiter}${baseEnv.PATH}` : baseEnv.Path;
          delete baseEnv.Path;
        }
        if (!baseEnv.HOME) baseEnv.HOME = os.homedir();
        if (!baseEnv.USERPROFILE) baseEnv.USERPROFILE = os.homedir();
        baseEnv.PATH = getExpandedPath();
        delete baseEnv.CLAUDECODE;
        delete baseEnv.CODEANY_BASE_URL;
        delete baseEnv.CODEANY_API_KEY;
        delete baseEnv.CODEANY_MODEL;
        delete baseEnv.CODEANY_PERMISSION_MODE;

        if (process.platform === 'win32' && !baseEnv.CLAUDE_CODE_GIT_BASH_PATH) {
          const gitBashPath = findGitBash();
          if (gitBashPath) baseEnv.CLAUDE_CODE_GIT_BASH_PATH = gitBashPath;
        }

        const sdkEnv = sanitizeEnv(baseEnv);

        const queryOptions: any = {
          cwd: targetCwd,
          abortController,
          permissionMode: 'default',
          env: sdkEnv,
          mcpServers: buildReadPilotMcpServers(sdkEnv),
          systemPrompt: { type: 'preset', preset: 'claude_code', append: systemPrompt },
          canUseTool: async (toolName: string, input: Record<string, any>, opts: { signal: AbortSignal }) => {
            if (!allowTools) {
              if (isReadOnlyTool(toolName)) {
                return { behavior: 'allow' as const, updatedInput: input, updatedPermissions: [] };
              }

              return {
                behavior: 'deny' as const,
                message: '当前请求被识别为 ReadPilot ChatPanel 文字伴读模式：可以读取上下文，但不要写入、编辑或生成文件。如用户确实要生成页面，请让用户明确说“生成导读页/伴读页”或“写入 Hub”。',
                interrupt: false,
              };
            }

            // 仅 AskUserQuestion 走交互；其余工具一律透明放行（保留 bypassPermissions 的原体感）
            if (toolName !== 'AskUserQuestion') {
              return { behavior: 'allow' as const, updatedInput: input, updatedPermissions: [] };
            }

            const permissionRequestId = `perm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            const startedAt = performance.now();

            const interactiveBlock = {
              id: `iq-${permissionRequestId}`,
              kind: 'interactive_question' as const,
              permissionRequestId,
              toolName,
              questions: (input?.questions ?? []) as any[],
              startedAt,
              status: 'streaming' as const,
            };
            blocks.push(interactiveBlock);

            emitter.closeStreamingTextual(performance.now());
            sendRaw('permission_request', {
              permissionRequestId,
              toolName,
              toolInput: input,
              startedAt,
            });

            const result = await registerPending(permissionRequestId, input, opts.signal);

            // 把答案同步回后端 blocks，让 result-time 持久化捕获到
            interactiveBlock.status = 'complete' as any;
            (interactiveBlock as any).endedAt = performance.now();
            if (result.behavior === 'allow' && (result as any).updatedInput?.answers) {
              (interactiveBlock as any).answers = (result as any).updatedInput.answers;
            }

            return result;
          },
        };

        const claudePath = findClaudeBinary();
        if (claudePath) {
          const ext = path.extname(claudePath).toLowerCase();
          if (ext === '.cmd' || ext === '.bat') {
            const scriptPath = resolveScriptFromCmd(claudePath);
            if (scriptPath && fs.existsSync(scriptPath)) {
              queryOptions.pathToClaudeCodeExecutable = scriptPath;
            } else {
              queryOptions.pathToClaudeCodeExecutable = claudePath;
            }
          } else {
            queryOptions.pathToClaudeCodeExecutable = claudePath;
          }
        }

        // stderr → DiagnosticBlock with 节流
        let diagnosticBuffer = '';
        let diagnosticFlushTimer: NodeJS.Timeout | null = null;
        const DIAG_BLOCK_MAX = 64 * 1024;

        const flushDiagnostic = () => {
          if (!diagnosticBuffer) return;
          let block = Array.from(openBlocks.values()).find(b => b.kind === 'diagnostic');
          if (!block) block = openTextual('diagnostic');
          const room = DIAG_BLOCK_MAX - (block.text?.length ?? 0);
          if (room <= 0) { diagnosticBuffer = ''; return; }
          const slice = diagnosticBuffer.slice(0, room);
          diagnosticBuffer = diagnosticBuffer.slice(room);
          appendTextual(block, slice);
        };

        queryOptions.stderr = (data: string) => {
          const cleaned = data
            .replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '')
            .replace(/\x1B\][^\x07\x1B]*(?:\x07|\x1B\\)/g, '')
            .replace(/\x1B\([A-Z]/g, '')
            .replace(/\x1B[=>]/g, '')
            .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
            .replace(/\r\n/g, '\n')
            .replace(/\r/g, '\n')
            .trim();
          if (!cleaned) return;
          diagnosticBuffer += cleaned + '\n';
          if (!diagnosticFlushTimer) {
            diagnosticFlushTimer = setTimeout(() => {
              diagnosticFlushTimer = null;
              flushDiagnostic();
            }, 100);
          }
        };

        let conversation;
        if (sdkSessionId) {
          queryOptions.resume = sdkSessionId;
          try {
            const tempConv = query({ prompt, options: queryOptions });
            const iter = tempConv[Symbol.asyncIterator]();
            const first = await iter.next();
            if (first.done) {
              conversation = query({ prompt, options: queryOptions });
            } else {
              conversation = (async function*() {
                yield first.value;
                while (true) {
                  const next = await iter.next();
                  if (next.done) break;
                  yield next.value;
                }
              })();
            }
          } catch (resumeError) {
            console.warn('[claude-client] Resume failed:', resumeError);
            try { updateSessionSdkId(sessionId, ''); } catch {}
            pushOneShot('block_start', {
              id: crypto.randomUUID(),
              kind: 'system',
              subtype: 'resume_fallback',
              message: 'Previous session could not be resumed. Starting fresh conversation.',
              startedAt: performance.now(),
              endedAt: performance.now(),
              status: 'complete',
            });
            delete queryOptions.resume;
            conversation = query({ prompt, options: queryOptions });
          }
        } else {
          conversation = query({ prompt, options: queryOptions });
        }

        let finalAssistantContent = '';

        for await (const rawMsg of conversation) {
          const msg = rawMsg as any;

          if ('session_id' in msg && msg.session_id) {
            updateSessionSdkId(sessionId, msg.session_id);
          }

          switch (msg.type) {
            case 'system': {
              if (msg.subtype === 'init') {
                const initBlock = {
                  id: crypto.randomUUID(),
                  kind: 'system' as const,
                  subtype: 'init' as const,
                  model: msg.model,
                  cwd: msg.cwd,
                  tools: msg.tools || [],
                  mcpServers: msg.mcp_servers || [],
                  slashCommands: Array.isArray(msg.slash_commands) ? msg.slash_commands : [],
                  skills: Array.isArray(msg.skills) ? msg.skills : [],
                  startedAt: performance.now(),
                  endedAt: performance.now(),
                  status: 'complete' as const,
                };
                blocks.push(initBlock);
                sendRaw('session_init', initBlock);
              }
              break;
            }

            case 'partial_assistant': {
              const thinkingPart = msg.content?.find((c: any) => c.type === 'thinking');
              if (thinkingPart) {
                const blk = getOrOpen('thinking');
                const delta = thinkingPart.thinking?.slice(blk.text.length) ?? '';
                if (delta) appendTextual(blk, delta);
              }

              const textPart = msg.content?.find((c: any) => c.type === 'text');
              if (textPart) {
                const blk = getOrOpen('text');
                const delta = textPart.text?.slice(blk.text.length) ?? '';
                if (delta) {
                  appendTextual(blk, delta);
                  finalAssistantContent += delta;
                }
              }

              const toolUsePart = msg.content?.find((c: any) => c.type === 'tool_use');
              if (toolUsePart && allowTools) {
                emitter.closeStreamingTextual(performance.now());
                const id = crypto.randomUUID();
                const toolBlock = {
                  id,
                  kind: 'tool_use' as const,
                  toolUseId: toolUsePart.id,
                  name: toolUsePart.name,
                  input: toolUsePart.input || {},
                  variant: classifyTool(toolUsePart.name),
                  startedAt: performance.now(),
                  status: 'streaming' as const,
                };
                blocks.push(toolBlock);
                openBlocks.set(id, toolBlock);
                sendRaw('tool_use', toolBlock);
              }
              break;
            }

            case 'assistant': {
              const textPart = msg.message?.content?.find((c: any) => c.type === 'text');
              if (textPart) {
                const blk = getOrOpen('text');
                const delta = textPart.text?.slice(blk.text.length) ?? '';
                if (delta) {
                  appendTextual(blk, delta);
                  finalAssistantContent += delta;
                }
              }
              break;
            }

            case 'tool_result':
            case 'user': {
              const toolResults = msg.message?.content?.filter((c: any) => c.type === 'tool_result') ?? [];
              if (!allowTools) break;
              for (const tr of toolResults) {
                emitter.closeStreamingTextual(performance.now());
                const SOFT_LIMIT = 256 * 1024;
                let output = typeof tr.content === 'string' ? tr.content
                            : Array.isArray(tr.content)
                              ? tr.content.map((c: any) => c.text ?? '').join('')
                              : JSON.stringify(tr.content);
                const truncated = output.length > SOFT_LIMIT;
                if (truncated) output = output.slice(0, SOFT_LIMIT) + '\n…[truncated]';

                const matchingUse = Array.from(openBlocks.values()).find(
                  b => b.kind === 'tool_use' && b.toolUseId === tr.tool_use_id
                );
                if (matchingUse) {
                  matchingUse.status = 'complete';
                  matchingUse.endedAt = performance.now();
                  sendRaw('block_end', { id: matchingUse.id, endedAt: matchingUse.endedAt });
                  openBlocks.delete(matchingUse.id);
                }

                const resultBlock = {
                  id: crypto.randomUUID(),
                  kind: 'tool_result' as const,
                  toolUseId: tr.tool_use_id,
                  output,
                  previewLength: 8192,
                  isError: !!tr.is_error,
                  truncated,
                  startedAt: performance.now(),
                  endedAt: performance.now(),
                  status: tr.is_error ? 'error' as const : 'complete' as const,
                };
                blocks.push(resultBlock);
                sendRaw('tool_result', resultBlock);
              }
              break;
            }

            case 'result': {
              emitter.closeStreamingTextual(performance.now());
              if (diagnosticFlushTimer) { clearTimeout(diagnosticFlushTimer); flushDiagnostic(); }
              emitter.closeAll(performance.now());

              sendRaw('result', {
                stopReason: msg.stop_reason,
                durationMs: msg.duration_ms,
                tokensIn: msg.usage?.input_tokens,
                tokensOut: msg.usage?.output_tokens,
                costUSD: msg.total_cost_usd,
              });

              if (finalAssistantContent.trim()) {
                try {
                  const MAX_BLOCKS_JSON = 1024 * 1024;
                  let blocksJson = JSON.stringify(blocks);
                  if (blocksJson.length > MAX_BLOCKS_JSON) {
                    console.warn('[claude-client] blocks_json exceeds 1MB, trimming tool_result outputs');
                    const trimmed = blocks.map((b: any) => {
                      if (b.kind === 'tool_result' && b.output && b.output.length > 16384) {
                        return { ...b, output: b.output.slice(0, 16384) + '\n…[trimmed for storage]', truncated: true };
                      }
                      return b;
                    });
                    blocksJson = JSON.stringify(trimmed);
                  }
                  addMessage(sessionId, 'assistant', finalAssistantContent.trim(), blocksJson, 'claude');
                } catch (dbErr) {
                  console.error('[claude-client] Failed to save assistant message:', dbErr);
                }
              }
              break;
            }

            case 'error_message':
            case 'error': {
              sendRaw('error', msg);
              break;
            }
          }
        }

        sendRaw('complete', {});
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error('[claude-client] Stream error:', err);
          const classified = classifyError({ error: err });
          sendRaw('error', {
            category: classified.category,
            userMessage: classified.userMessage,
            actionHint: classified.actionHint,
            retryable: classified.retryable,
          });
        }
      } finally {
        controller.close();
      }
    }
  });
}
