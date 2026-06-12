// input: 无
// output: Claude CLI / Python 路径检测、PATH 扩展、平台适配函数
// pos: 平台相关的工具函数，处理 Windows .cmd 包装器等问题
// 声明：一旦我被更新，务必更新我的开头注释以及所属文件夹的 md。

import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

export const isWindows = process.platform === 'win32';
export const isMac = process.platform === 'darwin';

/**
 * Whether the given binary path requires shell execution.
 * On Windows, .cmd/.bat files cannot be executed directly by execFileSync.
 */
function needsShell(binPath: string): boolean {
  return isWindows && /\.(cmd|bat)$/i.test(binPath);
}

/**
 * Extra PATH directories to search for Claude CLI and other tools.
 */
export function getExtraPathDirs(): string[] {
  const home = os.homedir();
  if (isWindows) {
    const appData = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
    const localAppData = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');
    return [
      path.join(home, '.local', 'bin'),
      path.join(home, '.claude', 'bin'),
      path.join(home, '.bun', 'bin'),
      path.join(appData, 'npm'),
      path.join(localAppData, 'npm'),
      path.join(home, '.npm-global', 'bin'),
    ];
  }
  return [
    path.join(home, '.local', 'bin'),
    path.join(home, '.claude', 'bin'),
    path.join(home, '.bun', 'bin'),
    '/usr/local/bin',
    '/opt/homebrew/bin',
    '/usr/bin',
    '/bin',
  ];
}

/**
 * Build an expanded PATH string with extra directories, deduped and filtered.
 */
export function getExpandedPath(): string {
  const current = process.env.PATH || '';
  const parts = current.split(path.delimiter).filter(Boolean);
  const seen = new Set(parts);
  for (const p of getExtraPathDirs()) {
    if (p && !seen.has(p)) {
      parts.push(p);
      seen.add(p);
    }
  }
  return parts.join(path.delimiter);
}

/**
 * Claude CLI candidate installation paths.
 * Priority: native install > bun > npm.
 */
function getClaudeCandidatePaths(): string[] {
  const home = os.homedir();
  if (isWindows) {
    const appData = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
    const localAppData = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');
    const exts = ['.cmd', '.exe', '.bat', ''];
    const baseDirs = [
      path.join(home, '.local', 'bin'),
      path.join(home, '.claude', 'bin'),
      path.join(home, '.bun', 'bin'),
      path.join(appData, 'npm'),
      path.join(localAppData, 'npm'),
    ];
    const candidates: string[] = [];
    for (const dir of baseDirs) {
      for (const ext of exts) {
        candidates.push(path.join(dir, 'claude' + ext));
      }
    }
    return candidates;
  }
  // macOS/Linux
  return [
    path.join(home, '.local', 'bin', 'claude'),
    path.join(home, '.claude', 'bin', 'claude'),
    path.join(home, '.bun', 'bin', 'claude'),
    '/opt/homebrew/bin/claude',
    '/usr/local/bin/claude',
  ];
}

// TTL cache for findClaudeBinary
let _cachedBinaryPath: string | undefined | null = null;
let _cachedBinaryTimestamp = 0;
const BINARY_CACHE_TTL = 60_000; // 60 seconds

/**
 * Find and validate the Claude CLI binary.
 * Positive results are cached for 60s; negative results are never cached.
 */
export function findClaudeBinary(): string | undefined {
  const now = Date.now();
  if (_cachedBinaryPath !== null && now - _cachedBinaryTimestamp < BINARY_CACHE_TTL) {
    return _cachedBinaryPath;
  }

  const found = _findClaudeBinaryUncached();
  if (found) {
    _cachedBinaryPath = found;
    _cachedBinaryTimestamp = now;
  } else {
    _cachedBinaryPath = null;
  }
  return found;
}

function _findClaudeBinaryUncached(): string | undefined {
  // Try known candidate paths first
  for (const p of getClaudeCandidatePaths()) {
    try {
      execFileSync(p, ['--version'], {
        timeout: 3000,
        stdio: 'pipe',
        shell: needsShell(p),
      });
      return p;
    } catch {
      // not found, try next
    }
  }

  // Fallback: use `where` (Windows) or `which` (Unix) with expanded PATH
  try {
    const cmd = isWindows ? 'where' : '/usr/bin/which';
    const args = isWindows ? ['claude'] : ['claude'];
    const result = execFileSync(cmd, args, {
      timeout: 3000,
      stdio: 'pipe',
      env: { ...process.env, PATH: getExpandedPath() },
      shell: isWindows,
    });
    const lines = result.toString().trim().split(/\r?\n/);
    for (const line of lines) {
      const candidate = line.trim();
      if (!candidate) continue;
      try {
        execFileSync(candidate, ['--version'], {
          timeout: 3000,
          stdio: 'pipe',
          shell: needsShell(candidate),
        });
        return candidate;
      } catch {
        continue;
      }
    }
  } catch {
    // not found
  }

  return undefined;
}

/**
 * On Windows, npm installs CLI tools as .cmd wrappers that can't be
 * spawned without shell:true. Parse the wrapper to extract the real
 * .js script path so we can pass it to the SDK directly.
 */
export function resolveScriptFromCmd(cmdPath: string): string | undefined {
  try {
    const content = fs.readFileSync(cmdPath, 'utf-8');
    const cmdDir = path.dirname(cmdPath);

    // npm .cmd wrappers typically contain a line like:
    // "%~dp0\node_modules\@anthropic-ai\claude-code\cli.js" %*
    // or: "%dp0%\node_modules\@anthropic-ai\claude-code\cli.js" %*
    //
    // Use multiple patterns to match different .cmd wrapper formats:
    // - Quoted with %~dp0: "%~dp0\...\cli.js"
    // - Unquoted with %~dp0: %~dp0\...\cli.js
    // - Quoted with %dp0%: "%dp0%\...\cli.js"
    const patterns = [
      // Quoted: "%~dp0\...\cli.js"
      /"%~dp0\\([^"]*claude[^"]*\.js)"/i,
      // Unquoted: %~dp0\...\cli.js
      /%~dp0\\(\S*claude\S*\.js)/i,
      // Quoted with %dp0%: "%dp0%\...\cli.js"
      /"%dp0%\\([^"]*claude[^"]*\.js)"/i,
    ];

    for (const re of patterns) {
      const m = content.match(re);
      if (m) {
        const resolved = path.normalize(path.join(cmdDir, m[1]));
        console.log('[resolveScriptFromCmd] Pattern matched, resolved:', resolved);
        if (fs.existsSync(resolved)) return resolved;
      }
    }
  } catch {
    // ignore read errors
  }
  return undefined;
}

/**
 * Find Git Bash (bash.exe) on Windows.
 * Returns the path to bash.exe or null if not found.
 */
export function findGitBash(): string | null {
  const envPath = process.env.CLAUDE_CODE_GIT_BASH_PATH;
  if (envPath && fs.existsSync(envPath)) {
    return envPath;
  }

  const commonPaths = [
    'C:\\Program Files\\Git\\bin\\bash.exe',
    'C:\\Program Files (x86)\\Git\\bin\\bash.exe',
  ];
  for (const p of commonPaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }

  // Try to locate git.exe via `where git` and derive bash.exe path
  try {
    const result = execFileSync('where', ['git'], {
      timeout: 3000,
      stdio: 'pipe',
      shell: true,
    });
    const lines = result.toString().trim().split(/\r?\n/);
    for (const line of lines) {
      const gitExe = line.trim();
      if (!gitExe) continue;
      const gitDir = path.dirname(path.dirname(gitExe));
      const bashPath = path.join(gitDir, 'bin', 'bash.exe');
      if (fs.existsSync(bashPath)) {
        return bashPath;
      }
    }
  } catch {
    // where git failed
  }

  return null;
}

/**
 * Invalidate the cached Claude binary path.
 * Must be called after installation so the next SDK call picks up the new binary.
 */
export function invalidateClaudePathCache(): void {
  _cachedBinaryPath = null;
  _cachedBinaryTimestamp = 0;
}

// ── Python 探测 ─────────────────────────────────────────────────────────────

let _cachedPythonPath: string | undefined | null = null;
let _cachedPythonTimestamp = 0;
const PYTHON_CACHE_TTL = 60_000;

/**
 * Find a usable Python 3 binary by trying `python3` then `python`.
 * Result cached for 60s. Returns undefined if neither responds with --version.
 */
export function findPythonBinary(): string | undefined {
  const now = Date.now();
  if (_cachedPythonPath !== null && now - _cachedPythonTimestamp < PYTHON_CACHE_TTL) {
    return _cachedPythonPath ?? undefined;
  }

  const candidates = isWindows ? ['python', 'python3'] : ['python3', 'python'];
  for (const cmd of candidates) {
    try {
      execFileSync(cmd, ['--version'], {
        timeout: 3000,
        stdio: 'pipe',
        shell: isWindows,
      });
      _cachedPythonPath = cmd;
      _cachedPythonTimestamp = now;
      return cmd;
    } catch {
      // not found, try next
    }
  }

  _cachedPythonPath = null;
  _cachedPythonTimestamp = now;
  return undefined;
}

export function invalidatePythonPathCache(): void {
  _cachedPythonPath = null;
  _cachedPythonTimestamp = 0;
}