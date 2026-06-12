// input: 无（POST 端点固定为 /api/books/import）
// output: importBook(file, meta) + 暴露 stage / current / total / done / error
// pos: ImportModal 专用的 SSE 上传消费 hook
// 声明：一旦我被更新，务必更新我的开头注释以及所属文件夹的 md。

import { useState, useRef, useCallback } from 'react';
import {
  parseImportEventChunk,
  type ImportEvent,
  type ImportProgressData,
  type ImportDoneData,
  type ImportErrorData,
} from '@/lib/import-events';

export interface ImportState {
  status: 'idle' | 'uploading' | 'done' | 'error' | 'cancelled';
  progress: ImportProgressData | null;
  result: ImportDoneData | null;
  error: ImportErrorData | null;
}

const INITIAL: ImportState = {
  status: 'idle',
  progress: null,
  result: null,
  error: null,
};

export function useImportStream() {
  const [state, setState] = useState<ImportState>(INITIAL);
  const abortRef = useRef<AbortController | null>(null);
  const finalizedRef = useRef(false);

  const applyEvent = useCallback((event: ImportEvent) => {
    if (finalizedRef.current && event.type === 'progress') return;

    if (event.type === 'done') {
      if (finalizedRef.current) return;
      finalizedRef.current = true;
      setState((prev) => ({ ...prev, status: 'done', result: event.data }));
      return;
    }

    if (event.type === 'error') {
      if (finalizedRef.current) return;
      finalizedRef.current = true;
      setState((prev) => ({ ...prev, status: 'error', error: event.data }));
      return;
    }

    setState((prev) => {
      const prevProgress = prev.progress;
      if (
        prevProgress?.stage === event.data.stage &&
        prevProgress?.current === event.data.current &&
        prevProgress?.total === event.data.total &&
        prevProgress?.message === event.data.message
      ) {
        return prev;
      }
      return { ...prev, progress: event.data };
    });
  }, []);

  const importBook = useCallback(
    async (file: File, meta: { title?: string; author?: string } = {}) => {
      finalizedRef.current = false;
      const controller = new AbortController();
      abortRef.current = controller;

      setState({ ...INITIAL, status: 'uploading' });

      const form = new FormData();
      form.append('file', file);
      if (meta.title) form.append('title', meta.title);
      if (meta.author) form.append('author', meta.author);

      try {
        const res = await fetch('/api/books/import', {
          method: 'POST',
          body: form,
          signal: controller.signal,
        });
        if (!res.body) throw new Error('empty response body');

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = '';
        const consume = (chunk: string) => {
          for (const event of parseImportEventChunk(chunk)) {
            applyEvent(event);
          }
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            buf += decoder.decode();
            if (buf.trim()) consume(buf.includes('\n\n') ? buf : `${buf}\n\n`);
            break;
          }
          buf += decoder.decode(value, { stream: true });
          const lastBreak = buf.lastIndexOf('\n\n');
          if (lastBreak < 0) continue;
          const ready = buf.slice(0, lastBreak + 2);
          buf = buf.slice(lastBreak + 2);
          consume(ready);
        }

        if (!finalizedRef.current) {
          finalizedRef.current = true;
          setState((s) => ({
            ...s,
            status: 'error',
            error: { kind: 'internal', message: '导入流已结束，但没有收到完成事件。请刷新书库确认导入结果。' },
          }));
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') {
          setState((s) => ({ ...s, status: 'cancelled' }));
        } else if (!finalizedRef.current) {
          finalizedRef.current = true;
          setState((s) => ({
            ...s,
            status: 'error',
            error: { kind: 'internal', message: (err as Error)?.message ?? 'unknown' },
          }));
        }
      } finally {
        abortRef.current = null;
      }
    },
    [applyEvent],
  );

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    finalizedRef.current = false;
    setState(INITIAL);
  }, []);

  return { state, importBook, cancel, reset };
}
