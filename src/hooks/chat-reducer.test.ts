import { describe, it, expect } from 'vitest';
import { chatReducer, initialState } from './chat-reducer';
import type { ChatState, ChatAction } from './chat-reducer';

const run = (actions: ChatAction[], start: ChatState = initialState) =>
  actions.reduce((s, a) => chatReducer(s, a), start);

describe('chatReducer', () => {
  describe('user_send', () => {
    it('appends user message + opens assistant message + sets loading', () => {
      const s = run([{ type: 'user_send', prompt: 'hello' }]);
      expect(s.messages).toHaveLength(2);
      expect(s.messages[0]).toEqual({ role: 'user', content: 'hello' });
      expect(s.messages[1]).toMatchObject({ role: 'assistant', blocks: [], isStreaming: true });
      expect(s.isLoading).toBe(true);
      expect(s.error).toBeNull();
    });
  });

  describe('block_start + block_delta + block_end', () => {
    it('accumulates text deltas into a thinking block', () => {
      const s = run([
        { type: 'user_send', prompt: 'q' },
        { type: 'block_start', payload: { id: 'b1', kind: 'thinking', startedAt: 1 } },
        { type: 'block_delta', payload: { id: 'b1', delta: 'hmm' } },
        { type: 'block_delta', payload: { id: 'b1', delta: ' let me think' } },
      ]);
      const assistant = s.messages[1] as any;
      expect(assistant.blocks).toHaveLength(1);
      expect(assistant.blocks[0]).toMatchObject({
        id: 'b1', kind: 'thinking', text: 'hmm let me think', status: 'streaming',
      });
    });

    it('marks block complete on block_end', () => {
      const s = run([
        { type: 'user_send', prompt: 'q' },
        { type: 'block_start', payload: { id: 'b1', kind: 'text', startedAt: 1 } },
        { type: 'block_delta', payload: { id: 'b1', delta: 'hi' } },
        { type: 'block_end', payload: { id: 'b1', endedAt: 10 } },
      ]);
      const blocks = (s.messages[1] as any).blocks;
      expect(blocks[0].status).toBe('complete');
      expect(blocks[0].endedAt).toBe(10);
    });

    it('silently drops block_delta with unknown id', () => {
      const s = run([
        { type: 'user_send', prompt: 'q' },
        { type: 'block_delta', payload: { id: 'ghost', delta: 'x' } },
      ]);
      expect((s.messages[1] as any).blocks).toHaveLength(0);
    });
  });

  describe('tool_use + tool_result', () => {
    it('appends both blocks and pairs by toolUseId', () => {
      const s = run([
        { type: 'user_send', prompt: 'q' },
        { type: 'tool_use', payload: {
          id: 'u1', kind: 'tool_use', toolUseId: 'tu_1',
          name: 'Read', input: { file_path: '/a' }, variant: 'read',
          startedAt: 1, status: 'streaming',
        }},
        { type: 'tool_result', payload: {
          id: 'r1', kind: 'tool_result', toolUseId: 'tu_1',
          output: 'file contents', previewLength: 8192, isError: false,
          startedAt: 2, endedAt: 3, status: 'complete',
        }},
      ]);
      const blocks = (s.messages[1] as any).blocks;
      expect(blocks).toHaveLength(2);
      expect(blocks[0]).toMatchObject({ kind: 'tool_use', toolUseId: 'tu_1', variant: 'read' });
      expect(blocks[1]).toMatchObject({ kind: 'tool_result', toolUseId: 'tu_1' });
    });
  });

  describe('complete', () => {
    it('forces all streaming blocks to complete and clears isLoading', () => {
      const s = run([
        { type: 'user_send', prompt: 'q' },
        { type: 'block_start', payload: { id: 'b1', kind: 'text', startedAt: 1 } },
        { type: 'block_delta', payload: { id: 'b1', delta: 'partial' } },
        { type: 'complete' },
      ]);
      expect(s.isLoading).toBe(false);
      const blocks = (s.messages[1] as any).blocks;
      expect(blocks[0].status).toBe('complete');
      expect((s.messages[1] as any).isStreaming).toBe(false);
    });
  });

  describe('abort', () => {
    it('marks all streaming blocks aborted and clears isLoading', () => {
      const s = run([
        { type: 'user_send', prompt: 'q' },
        { type: 'block_start', payload: { id: 'b1', kind: 'text', startedAt: 1 } },
        { type: 'tool_use', payload: {
          id: 'u1', kind: 'tool_use', toolUseId: 'tu_1', name: 'Bash',
          input: { command: 'sleep 999' }, variant: 'bash',
          startedAt: 1, status: 'streaming',
        }},
        { type: 'abort' },
      ]);
      expect(s.isLoading).toBe(false);
      const blocks = (s.messages[1] as any).blocks;
      expect(blocks[0].status).toBe('aborted');
      expect(blocks[1].status).toBe('aborted');
    });
  });

  describe('error', () => {
    it('captures error message and clears loading', () => {
      const s = run([
        { type: 'user_send', prompt: 'q' },
        { type: 'error', payload: { userMessage: 'network', actionHint: 'retry' } },
      ]);
      expect(s.error).toBe('network');
      expect(s.isLoading).toBe(false);
    });
  });

  describe('result + metrics', () => {
    it('stamps metrics onto last assistant', () => {
      const s = run([
        { type: 'user_send', prompt: 'q' },
        { type: 'result', payload: { tokensIn: 100, tokensOut: 50, durationMs: 1200 } },
      ]);
      const assistant = s.messages[1] as any;
      expect(assistant.metrics).toEqual({ tokensIn: 100, tokensOut: 50, durationMs: 1200, costUSD: undefined });
    });
  });

  describe('reset_to_history', () => {
    it('replaces messages and clears loading', () => {
      const s = run([
        { type: 'user_send', prompt: 'q' },
        { type: 'reset_to_history', messages: [
          { role: 'user', content: 'old' },
          { role: 'assistant', isStreaming: false, blocks: [
            { id: 'b', kind: 'text', text: 'reply', status: 'complete', startedAt: 0 }
          ]},
        ]},
      ]);
      expect(s.messages).toHaveLength(2);
      expect(s.isLoading).toBe(false);
    });
  });

  describe('session_init', () => {
    it('appends a system init block onto the assistant message', () => {
      const s = run([
        { type: 'user_send', prompt: 'q' },
        { type: 'session_init', payload: {
          id: 'si', kind: 'system', subtype: 'init',
          model: 'opus-4.7', tools: ['Read','Bash'],
          startedAt: 0, endedAt: 0, status: 'complete',
        }},
      ]);
      const blocks = (s.messages[1] as any).blocks;
      expect(blocks[0]).toMatchObject({ kind: 'system', subtype: 'init', model: 'opus-4.7' });
    });
  });
});
