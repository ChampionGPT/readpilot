// input: SSE 事件流 + chatReducer + hidden context metadata
// output: { messages, isLoading, error, sendMessage, stop, replaceMessages }
// pos: 对话面板 React 侧的状态入口 — 把 SSE 解码并交 reducer 处理
// 声明：一旦我被更新，务必更新我的开头注释以及所属文件夹的 md。

import { useReducer, useRef, useCallback } from 'react';
import { chatReducer, initialState, deriveStage, type ChatAction, type DerivedStatus } from './chat-reducer';
import type { ChatMessage } from '@/types/chat-blocks';

export type { ChatMessage } from '@/types/chat-blocks';
export type { DerivedStatus } from './chat-reducer';

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

export function useSSEStream(apiUrl: string = '/api/chat') {
  const [state, dispatch] = useReducer(chatReducer, initialState);
  const abortControllerRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(async (prompt: string, sessionId?: string, bookId?: string, contextMeta?: ChatContextMeta) => {
    if (!prompt.trim() || state.isLoading) return;

    dispatch({ type: 'user_send', prompt });

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, sessionId, bookId, contextMeta }),
        signal: controller.signal,
      });

      if (!response.ok) throw new Error(`Request failed: ${response.status}`);
      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() ?? '';

        for (const evt of events) {
          if (!evt.startsWith('data: ')) continue;
          try {
            const parsed = JSON.parse(evt.slice(6));
            const action = mapSseToAction(parsed.type, parsed.data);
            if (action) dispatch(action);
          } catch (e) {
            console.warn('[useSSEStream] parse error', e, evt);
          }
        }
      }

      dispatch({ type: 'complete' });
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('[useSSEStream] error:', err);
        dispatch({ type: 'error', payload: { userMessage: err.message } });
      }
    } finally {
      abortControllerRef.current = null;
    }
  }, [apiUrl, state.isLoading]);

  const stop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      dispatch({ type: 'abort' });
    }
  }, []);

  const replaceMessages = useCallback((messages: ChatMessage[]) => {
    dispatch({ type: 'replace_all', messages });
  }, []);

  const submitInteractiveAnswer = useCallback(async (
    permissionRequestId: string,
    answers: Record<string, string>,
  ) => {
    // 找到该 block 的 questions（用于回传完整 input shape）
    const last = state.messages[state.messages.length - 1];
    let questions: any[] | undefined;
    if (last && last.role === 'assistant') {
      const blk = last.blocks.find(
        b => b.kind === 'interactive_question' && b.permissionRequestId === permissionRequestId,
      );
      if (blk && blk.kind === 'interactive_question') {
        questions = blk.questions;
      }
    }

    const res = await fetch('/api/chat/permission', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        permissionRequestId,
        decision: {
          behavior: 'allow',
          updatedInput: { questions: questions ?? [], answers },
        },
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      throw new Error(err.error || `提交失败 (${res.status})`);
    }

    dispatch({ type: 'permission_resolved', payload: { permissionRequestId, answers } });
  }, [state.messages]);

  const rewindTo = useCallback((messageIndex: number) => {
    dispatch({ type: 'rewind_to', messageIndex });
  }, []);

  return {
    messages: state.messages,
    isLoading: state.isLoading,
    error: state.error,
    status: deriveStage(state),
    sendMessage,
    stop,
    replaceMessages,
    submitInteractiveAnswer,
    rewindTo,
  };
}

function mapSseToAction(type: string, dataStr: any): ChatAction | null {
  const data = typeof dataStr === 'string' ? JSON.parse(dataStr) : dataStr;
  switch (type) {
    case 'session_init':       return { type: 'session_init',  payload: data };
    case 'block_start':         return { type: 'block_start',   payload: data };
    case 'block_delta':         return { type: 'block_delta',   payload: data };
    case 'block_end':           return { type: 'block_end',     payload: data };
    case 'tool_use':            return { type: 'tool_use',      payload: data };
    case 'tool_result':         return { type: 'tool_result',   payload: data };
    case 'permission_request':  return { type: 'permission_request', payload: data };
    case 'metrics':             return { type: 'metrics',       payload: data };
    case 'result':              return { type: 'result',        payload: data };
    case 'error':               return { type: 'error',         payload: data };
    case 'complete':            return { type: 'complete' };
    default: return null;
  }
}
