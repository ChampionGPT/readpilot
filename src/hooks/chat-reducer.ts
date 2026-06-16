// input: ChatBlock 类型族 + SSE 事件 payload
// output: 纯函数 chatReducer(state, action) -> state；React useReducer 可直接使用
// pos: 对话面板状态管理核心 — 与 React 解耦，便于单测覆盖所有 SSE 状态机分支
// 声明：一旦我被更新，务必更新我的开头注释以及所属文件夹的 md。

import type { ChatBlock, ChatMessage, AssistantMessage, ToolVariant, InteractiveQuestionItem } from '@/types/chat-blocks';

export interface ChatState {
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
}

export type ChatAction =
  | { type: 'user_send'; prompt: string; provider?: 'claude' | 'codex' | 'hermes' }
  | { type: 'assistant_open' }
  | { type: 'session_init'; payload: SessionInitPayload }
  | { type: 'block_start'; payload: BlockStartPayload }
  | { type: 'block_delta'; payload: { id: string; delta: string } }
  | { type: 'block_end'; payload: { id: string; endedAt: number } }
  | { type: 'tool_use'; payload: ToolUsePayload }
  | { type: 'tool_result'; payload: ToolResultPayload }
  | { type: 'permission_request'; payload: PermissionRequestPayload }
  | { type: 'permission_resolved'; payload: { permissionRequestId: string; answers: Record<string, string> } }
  | { type: 'metrics'; payload: MetricsPayload }
  | { type: 'result'; payload: ResultPayload }
  | { type: 'error'; payload: ErrorPayload }
  | { type: 'complete' }
  | { type: 'abort' }
  | { type: 'rewind_to'; messageIndex: number }
  | { type: 'reset_to_history'; messages: ChatMessage[] }
  | { type: 'replace_all'; messages: ChatMessage[] };

export interface SessionInitPayload {
  id: string; kind: 'system'; subtype: 'init';
  model?: string; cwd?: string; tools?: string[]; mcpServers?: string[];
  startedAt: number; endedAt: number; status: 'complete';
}

export interface BlockStartPayload {
  id: string;
  kind: 'thinking' | 'text' | 'diagnostic' | 'system';
  startedAt: number;
  subtype?: 'init' | 'resume_fallback' | 'note';
  message?: string;
  model?: string; cwd?: string; tools?: string[]; mcpServers?: string[];
}

export interface ToolUsePayload {
  id: string; kind: 'tool_use'; toolUseId: string; name: string;
  input: Record<string, unknown>; variant: ToolVariant;
  startedAt: number; status: 'streaming';
}

export interface ToolResultPayload {
  id: string; kind: 'tool_result'; toolUseId: string; output: string;
  previewLength: number; isError: boolean; truncated?: boolean;
  startedAt: number; endedAt: number; status: 'complete' | 'error';
}

export interface PermissionRequestPayload {
  permissionRequestId: string;
  toolName: string;
  toolInput: Record<string, unknown>;
  startedAt: number;
}

export interface MetricsPayload {
  tokensIn?: number; tokensOut?: number; costUSD?: number;
}

export interface ResultPayload {
  stopReason?: string; durationMs?: number;
  tokensIn?: number; tokensOut?: number; costUSD?: number;
}

export interface ErrorPayload {
  category?: string; userMessage?: string; actionHint?: string; retryable?: boolean;
  message?: string;
}

export const initialState: ChatState = {
  messages: [],
  isLoading: false,
  error: null,
};

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'user_send': {
      const userMsg: ChatMessage = { role: 'user', content: action.prompt, ...(action.provider ? { provider: action.provider } : {}) };
      const assistantMsg: AssistantMessage = { role: 'assistant', blocks: [], isStreaming: true, ...(action.provider ? { provider: action.provider } : {}) };
      return {
        ...state,
        messages: [...state.messages, userMsg, assistantMsg],
        isLoading: true,
        error: null,
      };
    }

    case 'assistant_open': {
      const a: AssistantMessage = { role: 'assistant', blocks: [], isStreaming: true };
      return { ...state, messages: [...state.messages, a], isLoading: true };
    }

    case 'session_init': {
      return updateLastAssistant(state, last => ({
        ...last,
        blocks: [...last.blocks, action.payload as ChatBlock],
      }));
    }

    case 'block_start': {
      const newBlock: ChatBlock = {
        id: action.payload.id,
        kind: action.payload.kind,
        text: '',
        startedAt: action.payload.startedAt,
        status: 'streaming',
        ...(action.payload.kind === 'system' ? {
          subtype: action.payload.subtype ?? 'note',
          message: action.payload.message,
          model: action.payload.model,
          cwd: action.payload.cwd,
          tools: action.payload.tools,
          mcpServers: action.payload.mcpServers,
        } : {}),
      } as ChatBlock;
      return updateLastAssistant(state, last => ({
        ...last,
        blocks: [...last.blocks, newBlock],
      }));
    }

    case 'block_delta': {
      return updateLastAssistant(state, last => {
        const idx = last.blocks.findIndex(b => b.id === action.payload.id);
        if (idx < 0) return last;
        const blk = last.blocks[idx];
        if (!('text' in blk)) return last;
        const updated = { ...blk, text: blk.text + action.payload.delta };
        const blocks = [...last.blocks];
        blocks[idx] = updated as ChatBlock;
        return { ...last, blocks };
      });
    }

    case 'block_end': {
      return updateLastAssistant(state, last => {
        const idx = last.blocks.findIndex(b => b.id === action.payload.id);
        if (idx < 0) return last;
        const blocks = [...last.blocks];
        blocks[idx] = { ...blocks[idx], status: 'complete', endedAt: action.payload.endedAt };
        return { ...last, blocks };
      });
    }

    case 'tool_use': {
      return updateLastAssistant(state, last => ({
        ...last,
        blocks: [...last.blocks, action.payload as ChatBlock],
      }));
    }

    case 'tool_result': {
      return updateLastAssistant(state, last => {
        const blocks = last.blocks.map(b => {
          if (b.kind === 'tool_use' && b.toolUseId === action.payload.toolUseId && b.status === 'streaming') {
            return { ...b, status: 'complete' as const, endedAt: action.payload.endedAt };
          }
          return b;
        });
        return { ...last, blocks: [...blocks, action.payload as ChatBlock] };
      });
    }

    case 'permission_request': {
      const p = action.payload;
      const questions = (p.toolInput?.questions ?? []) as InteractiveQuestionItem[];
      const newBlock: ChatBlock = {
        id: `iq-${p.permissionRequestId}`,
        kind: 'interactive_question',
        permissionRequestId: p.permissionRequestId,
        toolName: p.toolName,
        questions,
        startedAt: p.startedAt,
        status: 'streaming',
      };
      return updateLastAssistant(state, last => ({
        ...last,
        blocks: [...last.blocks, newBlock],
      }));
    }

    case 'permission_resolved': {
      return updateLastAssistant(state, last => {
        const blocks = last.blocks.map(b => {
          if (b.kind === 'interactive_question' && b.permissionRequestId === action.payload.permissionRequestId) {
            return {
              ...b,
              status: 'complete' as const,
              endedAt: performance.now(),
              answers: action.payload.answers,
            };
          }
          return b;
        });
        return { ...last, blocks };
      });
    }

    case 'metrics': {
      return updateLastAssistant(state, last => ({
        ...last,
        metrics: { ...(last.metrics ?? {}), ...action.payload },
      }));
    }

    case 'result': {
      return updateLastAssistant(state, last => ({
        ...last,
        metrics: {
          tokensIn: action.payload.tokensIn,
          tokensOut: action.payload.tokensOut,
          durationMs: action.payload.durationMs,
          costUSD: action.payload.costUSD,
        },
      }));
    }

    case 'complete': {
      return {
        ...state,
        isLoading: false,
        error: null,
        messages: state.messages.map((m, i) => {
          if (i !== state.messages.length - 1 || m.role !== 'assistant') return m;
          return {
            ...m,
            isStreaming: false,
            blocks: m.blocks.map(b =>
              b.status === 'streaming'
                ? { ...b, status: 'complete' as const, endedAt: performance.now() }
                : b
            ),
          };
        }),
      };
    }

    case 'abort': {
      return {
        ...state,
        isLoading: false,
        messages: state.messages.map((m, i) => {
          if (i !== state.messages.length - 1 || m.role !== 'assistant') return m;
          return {
            ...m,
            isStreaming: false,
            blocks: m.blocks.map(b =>
              b.status === 'streaming'
                ? { ...b, status: 'aborted' as const, endedAt: performance.now() }
                : b
            ),
          };
        }),
      };
    }

    case 'error': {
      const msg = action.payload.userMessage ?? action.payload.message ?? 'Unknown error';
      const now = performance.now();
      const next = updateLastAssistant(state, last => ({
        ...last,
        isStreaming: false,
        blocks: [
          ...last.blocks.map(b =>
            b.status === 'streaming'
              ? { ...b, status: b.kind === 'tool_use' ? 'error' as const : 'complete' as const, endedAt: now }
              : b
          ),
          {
            id: `err-${now}`,
            kind: 'error',
            category: action.payload.category,
            userMessage: msg,
            actionHint: action.payload.actionHint,
            retryable: action.payload.retryable,
            startedAt: now,
            endedAt: now,
            status: 'error',
          },
        ],
      }));
      return { ...next, isLoading: false, error: msg };
    }

    case 'rewind_to': {
      const idx = action.messageIndex;
      if (idx < 0 || idx >= state.messages.length) return state;
      return {
        ...state,
        messages: state.messages.slice(0, idx),
        isLoading: false,
        error: null,
      };
    }

    case 'reset_to_history':
    case 'replace_all': {
      return { ...state, messages: action.messages, isLoading: false, error: null };
    }
  }
}

function updateLastAssistant(
  state: ChatState,
  updater: (msg: AssistantMessage) => AssistantMessage,
): ChatState {
  const idx = state.messages.length - 1;
  if (idx < 0) return state;
  const last = state.messages[idx];
  if (last.role !== 'assistant') return state;
  const messages = [...state.messages];
  messages[idx] = updater(last);
  return { ...state, messages };
}

export type DerivedStage = 'idle' | 'thinking' | 'calling' | 'streaming' | 'waiting' | 'complete' | 'error';

export interface DerivedStatus {
  stage: DerivedStage;
  message: string;
}

/** 从 ChatState 推断当前对话面板应该显示的状态指示器内容 */
export function deriveStage(state: ChatState): DerivedStatus {
  if (state.error) return { stage: 'error', message: state.error.slice(0, 50) };
  if (!state.isLoading) return { stage: 'idle', message: '' };

  const last = state.messages[state.messages.length - 1];
  if (!last || last.role !== 'assistant') {
    return { stage: 'thinking', message: '准备中…' };
  }

  // 优先检查 pending 的 interactive_question — 它阻塞流，状态比"streaming"重要
  const pendingInteractive = last.blocks.find(
    (b) => b.kind === 'interactive_question' && b.status === 'streaming',
  );
  if (pendingInteractive) {
    return { stage: 'waiting', message: '等待你的回答' };
  }

  // 找最后一个仍在流式的 block，决定状态
  const streamingBlocks = last.blocks.filter((b) => b.status === 'streaming');
  if (streamingBlocks.length === 0) {
    // 已经收到一些 block，但全完成 — 在等下一批
    return { stage: 'thinking', message: '深思中…' };
  }

  const lastStreaming = streamingBlocks[streamingBlocks.length - 1];
  switch (lastStreaming.kind) {
    case 'thinking':
      return { stage: 'thinking', message: '深思中…' };
    case 'tool_use':
      return { stage: 'calling', message: `调用 ${lastStreaming.name}` };
    case 'text':
      return { stage: 'streaming', message: '回应中…' };
    case 'diagnostic':
      return { stage: 'thinking', message: '处理诊断输出…' };
    default:
      return { stage: 'thinking', message: '思考中…' };
  }
}
