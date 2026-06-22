import fs from 'fs';
import os from 'os';
import path from 'path';
import { DATA_DIR } from './constants';

export type NativeProvider = 'claude' | 'codex';

export interface NativeSessionRemoval {
  provider: NativeProvider;
  sessionId: string;
  source?: string;
  trash?: string;
  removed: boolean;
  reason?: string;
}

function nativeHome(provider: NativeProvider): string {
  if (provider === 'claude') {
    return process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
  }
  return process.env.CODEX_HOME || path.join(os.homedir(), '.codex');
}

function isInside(root: string, target: string): boolean {
  const rel = path.relative(path.resolve(root), path.resolve(target));
  return !!rel && !rel.startsWith('..') && !path.isAbsolute(rel);
}

function walkJsonl(root: string, match: (file: string) => boolean): string | null {
  if (!fs.existsSync(root)) return null;
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop()!;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.isFile() && entry.name.endsWith('.jsonl') && match(full)) return full;
    }
  }
  return null;
}

function findNativeSessionFile(provider: NativeProvider, sessionId: string): string | null {
  const home = nativeHome(provider);
  if (provider === 'claude') {
    return walkJsonl(path.join(home, 'projects'), (file) => path.basename(file) === `${sessionId}.jsonl`);
  }

  // ponytail: Codex filenames include the rollout/thread UUID; delete only exact filename matches.
  return walkJsonl(path.join(home, 'sessions'), (file) => path.basename(file, '.jsonl').endsWith(sessionId));
}

function moveToTrash(provider: NativeProvider, source: string, sessionId: string): string {
  const trashDir = path.join(DATA_DIR, 'native-session-trash', provider);
  fs.mkdirSync(trashDir, { recursive: true });
  const target = path.join(trashDir, `${new Date().toISOString().replace(/[:.]/g, '-')}-${sessionId}.jsonl`);
  try {
    fs.renameSync(source, target);
  } catch {
    fs.copyFileSync(source, target);
    fs.unlinkSync(source);
  }
  return target;
}

export function removeNativeSession(provider: NativeProvider, sessionId: string): NativeSessionRemoval {
  if (!sessionId || sessionId.length < 8) {
    return { provider, sessionId, removed: false, reason: 'missing_session_id' };
  }

  const home = nativeHome(provider);
  const file = findNativeSessionFile(provider, sessionId);
  if (!file) return { provider, sessionId, removed: false, reason: 'not_found' };
  if (!isInside(home, file)) return { provider, sessionId, source: file, removed: false, reason: 'outside_native_home' };

  const trash = moveToTrash(provider, file, sessionId);
  return { provider, sessionId, source: file, trash, removed: true };
}
