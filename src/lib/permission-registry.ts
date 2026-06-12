// input: 无外部依赖（仅 SDK 类型）
// output: registerPending(id, toolInput, signal) -> Promise<PermissionResult>; resolvePending(id, result) -> boolean
// pos: 后端 canUseTool 与 POST /api/chat/permission 之间的内存通道；用 globalThis Map 防 Next.js dev 多实例
// 声明：一旦我被更新，务必更新我的开头注释以及所属文件夹的 md。

import type { PermissionResult } from '@anthropic-ai/claude-agent-sdk';

interface PendingPermission {
  resolve: (r: PermissionResult) => void;
  toolInput: Record<string, unknown>;
  createdAt: number;
  timer: ReturnType<typeof setTimeout>;
}

const TIMEOUT_MS = 5 * 60 * 1000;
const KEY = '__readpilot_pendingPermissions__' as const;

function mapInstance(): Map<string, PendingPermission> {
  const g = globalThis as Record<string, unknown>;
  if (!g[KEY]) g[KEY] = new Map<string, PendingPermission>();
  return g[KEY] as Map<string, PendingPermission>;
}

export function registerPending(
  id: string,
  toolInput: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<PermissionResult> {
  const map = mapInstance();
  return new Promise<PermissionResult>((resolve) => {
    const timer = setTimeout(() => {
      if (map.delete(id)) {
        resolve({ behavior: 'deny', message: 'Permission request timed out after 5 minutes' });
      }
    }, TIMEOUT_MS);

    map.set(id, { resolve, toolInput, createdAt: Date.now(), timer });

    if (signal) {
      const onAbort = () => {
        if (map.delete(id)) {
          clearTimeout(timer);
          resolve({ behavior: 'deny', message: 'Aborted by user' });
        }
      };
      if (signal.aborted) onAbort();
      else signal.addEventListener('abort', onAbort, { once: true });
    }
  });
}

export function resolvePending(id: string, result: PermissionResult): boolean {
  const map = mapInstance();
  const pending = map.get(id);
  if (!pending) return false;
  clearTimeout(pending.timer);
  map.delete(id);
  pending.resolve(result);
  return true;
}

export function getPending(id: string): { toolInput: Record<string, unknown> } | null {
  const map = mapInstance();
  const p = map.get(id);
  return p ? { toolInput: p.toolInput } : null;
}
