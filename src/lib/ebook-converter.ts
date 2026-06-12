// input: 输入 epub 路径、输出 jsonl 路径、可选 chunkSize/timeout/signal/htmlDir/manifestPath
// output: 解析好的 chunks + chapters + bookTitle + preservedPages，或抛结构化 ConvertEbookError
// pos: 导入链路第 3-4 步 — spawn Python + UTF-8 stderr/stdout + 解析 JSONL/HTML manifest
// 声明：一旦我被更新，务必更新我的开头注释以及所属文件夹的 md。

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { findPythonBinary, isWindows } from './platform';
import type { JsonlChunk } from './jsonl-to-pages';

export type { JsonlChunk };

export interface ConvertEbookOptions {
  chunkSize?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
  htmlDir?: string;
  manifestPath?: string;
}

export type ConvertEbookError =
  | { kind: 'python_missing' }
  | { kind: 'dependency_missing'; pkg: string }
  | { kind: 'timeout' }
  | { kind: 'empty_output' }
  | { kind: 'script_failure'; stderr: string; exitCode: number };

export interface JsonlResult {
  jsonlPath: string;
  chunks: JsonlChunk[];
  chapters: string[];
  bookTitle: string | null;
  preservedPages?: Array<{
    title: string;
    file: string;
    itemIndex: number;
  }>;
}

const SCRIPT_PATH = path.join(
  process.cwd(),
  'scripts',
  'ebook-converter',
  'epub_to_jsonl.py'
);

const MODULE_ERROR_RE = /No module named '([^']+)'/;
const TITLE_LINE_RE = /^書名\s*[：:]\s*(.+)$/m;

function detectMissingDependency(output: string): ConvertEbookError | null {
  const normalized = output.toLowerCase();
  const moduleMatch = output.match(MODULE_ERROR_RE);
  if (moduleMatch) {
    return { kind: 'dependency_missing', pkg: moduleMatch[1] };
  }
  if (normalized.includes('ebooklib')) {
    return { kind: 'dependency_missing', pkg: 'ebooklib' };
  }
  if (normalized.includes('beautifulsoup4') || normalized.includes('bs4')) {
    return { kind: 'dependency_missing', pkg: 'beautifulsoup4' };
  }
  return null;
}

export function convertEbook(
  inputPath: string,
  outputPath: string,
  opts: ConvertEbookOptions = {}
): Promise<JsonlResult> {
  return new Promise((resolve, reject) => {
    const python = findPythonBinary();
    if (!python) {
      reject({ kind: 'python_missing' } as ConvertEbookError);
      return;
    }

    const args = [
      SCRIPT_PATH,
      inputPath,
      outputPath,
      '--chunk-size',
      String(opts.chunkSize ?? 500),
    ];
    if (opts.htmlDir) {
      args.push('--html-dir', opts.htmlDir);
    }
    if (opts.manifestPath) {
      args.push('--manifest', opts.manifestPath);
    }

    const child = spawn(python, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: isWindows,
      env: {
        ...process.env,
        PYTHONUTF8: '1',
        PYTHONIOENCODING: 'utf-8',
      },
    });

    let stderrBuf = '';
    let stdoutBuf = '';
    let settled = false;

    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      opts.signal?.removeEventListener('abort', onAbort);
      fn();
    };

    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      settle(() => reject({ kind: 'timeout' } as ConvertEbookError));
    }, opts.timeoutMs ?? 60_000);

    const onAbort = () => {
      child.kill('SIGTERM');
    };
    opts.signal?.addEventListener('abort', onAbort);

    child.stderr.on('data', (chunk: Buffer) => {
      stderrBuf += chunk.toString('utf-8');
    });
    child.stdout.on('data', (chunk: Buffer) => {
      stdoutBuf += chunk.toString('utf-8');
    });

    child.on('close', (code: number | null) => {
      if (code !== 0) {
        const missingDependency = detectMissingDependency(`${stderrBuf}\n${stdoutBuf}`);
        if (missingDependency) {
          settle(() => reject(missingDependency));
        } else {
          settle(() => reject({
            kind: 'script_failure',
            stderr: stderrBuf,
            exitCode: code ?? -1,
          } as ConvertEbookError));
        }
        return;
      }

      // Parse output
      try {
        const raw = fs.readFileSync(outputPath, 'utf-8');
        const chunks: JsonlChunk[] = [];
        const seen = new Set<string>();
        const chapters: string[] = [];
        for (const line of raw.split('\n')) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          const obj = JSON.parse(trimmed) as JsonlChunk;
          chunks.push(obj);
          if (!seen.has(obj.chapter)) {
            seen.add(obj.chapter);
            chapters.push(obj.chapter);
          }
        }
        if (chunks.length === 0) {
          settle(() => reject({ kind: 'empty_output' } as ConvertEbookError));
          return;
        }
        const titleMatch = stdoutBuf.match(TITLE_LINE_RE);
        let preservedPages: JsonlResult['preservedPages'];
        if (opts.manifestPath && fs.existsSync(opts.manifestPath)) {
          const manifest = JSON.parse(fs.readFileSync(opts.manifestPath, 'utf-8')) as {
            pages?: JsonlResult['preservedPages'];
          };
          if (Array.isArray(manifest.pages)) preservedPages = manifest.pages;
        }

        settle(() => resolve({
          jsonlPath: outputPath,
          chunks,
          chapters,
          bookTitle: titleMatch ? titleMatch[1].trim() : null,
          preservedPages,
        }));
      } catch {
        settle(() => reject({ kind: 'empty_output' } as ConvertEbookError));
      }
    });

    child.on('error', () => {
      settle(() => reject({
        kind: 'script_failure',
        stderr: stderrBuf,
        exitCode: -1,
      } as ConvertEbookError));
    });
  });
}
