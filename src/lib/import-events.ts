// input: 服务端 emit / 客户端 parse 的 SSE 事件
// output: 编码/解码工具 + 事件类型定义
// pos: 导入流的协议层 — 服务端与客户端共享
// 声明：一旦我被更新，务必更新我的开头注释以及所属文件夹的 md。

export type ImportStage =
  | 'upload_received'
  | 'python_spawning'
  | 'python_running'
  | 'parsing_jsonl'
  | 'rendering_pages'
  | 'writing_progress'
  | 'building_companion'
  | 'committing'
  | 'done';

export interface ImportProgressData {
  stage: ImportStage;
  message: string;
  current?: number;
  total?: number;
}

export interface ImportDoneData {
  id: string;
  dir: string;
  title: string;
  author: string;
  chapterCount: number;
}

export type ImportErrorData =
  | { kind: 'validation'; message: string }
  | { kind: 'python_missing' }
  | { kind: 'dependency_missing'; pkg: string }
  | { kind: 'timeout' }
  | { kind: 'empty_output' }
  | { kind: 'script_failure'; stderr: string; exitCode: number }
  | { kind: 'internal'; message: string };

export type ImportEvent =
  | { type: 'progress'; data: ImportProgressData }
  | { type: 'done'; data: ImportDoneData }
  | { type: 'error'; data: ImportErrorData };

export function encodeImportEvent(event: ImportEvent): string {
  const envelope = {
    type: event.type,
    data: JSON.stringify(event.data),
  };
  return `data: ${JSON.stringify(envelope)}\n\n`;
}

export function parseImportEventChunk(chunk: string): ImportEvent[] {
  const events: ImportEvent[] = [];
  const blocks = chunk.split('\n\n');
  for (const block of blocks) {
    if (!block.startsWith('data: ')) continue;
    const raw = block.slice('data: '.length).trim();
    if (!raw) continue;
    try {
      const envelope = JSON.parse(raw) as { type: string; data: string };
      if (!envelope.type || typeof envelope.data !== 'string') continue;
      const inner = JSON.parse(envelope.data);
      if (envelope.type === 'progress' || envelope.type === 'done' || envelope.type === 'error') {
        events.push({ type: envelope.type, data: inner } as ImportEvent);
      }
    } catch {
      // malformed line — skip
    }
  }
  return events;
}
