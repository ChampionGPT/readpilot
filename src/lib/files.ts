// input: 书籍 ID 与标题
// output: 书籍数据目录的创建、查询、删除 + staging 目录管理
// pos: 后端文件系统管理层 — 负责 readpilot-data/books/ 目录结构
// 声明：一旦我被更新，务必更新我的开头注释以及所属文件夹的 md。

import fs from 'fs';
import path from 'path';
import crypto from 'node:crypto';
import type { ProgressData } from '@/types/progress-data';
import { BOOKS_DIR } from './constants';

/** 运行时解析的 BOOKS_DIR（允许测试通过 READPILOT_BOOKS_DIR 覆盖） */
function booksDir(): string {
  return process.env.READPILOT_BOOKS_DIR ?? BOOKS_DIR;
}

/** 将书名清洗为文件系统安全的目录名 */
function sanitizeDirName(title: string): string {
    return title
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
        .replace(/\s+/g, '_')
        .slice(0, 50)
        .trim() || 'untitled';
}

/** 创建书籍数据目录，返回相对 slug（如 abc123_百年孤独）供 URL 和 DB 使用 */
export function createBookDirectory(bookId: string, title: string): string {
    const dirName = `${bookId.slice(0, 8)}_${sanitizeDirName(title)}`;
    const bookDir = path.join(BOOKS_DIR, dirName);

    if (!fs.existsSync(bookDir)) {
        fs.mkdirSync(bookDir, { recursive: true });
    }

    // 初始化 progress.json
    const progressPath = path.join(bookDir, 'progress.json');
    if (!fs.existsSync(progressPath)) {
        const today = new Date().toISOString().split('T')[0];
        const initialProgress: ProgressData = {
            book: {
                title,
                author: "",
                genre: "",
                totalChapters: null,
                startDate: today,
                structure: [],
                totalPages: null,
                currentPage: null,
            },
            pages: [],
            themes: [],
            glossary: {},
            currentFocus: null,
            nextRecommendation: null,
            readingLog: [
                {
                    date: today,
                    action: "started",
                    note: "创建阅读课程"
                }
            ]
        };
        fs.writeFileSync(progressPath, JSON.stringify(initialProgress, null, 2), 'utf-8');
    }

    // 返回相对 slug 而非绝对路径（用于 DB 存储和 URL routing）
    return dirName;
}

/**
 * 将 bookDir slug 解析为磁盘上的绝对路径。
 * 强制约束：所有的书籍数据必须存放在 BOOKS_DIR 下。
 */
export function resolveBookDir(bookDir: string): string | null {
    // 保护：防止传入上级目录导致路径穿越
    if (bookDir.includes('..') || path.isAbsolute(bookDir)) {
        return null;
    }

    // Strict pattern: books must be in data/books/<slug>
    const expectedPath = path.join(booksDir(), bookDir);
    if (fs.existsSync(expectedPath)) {
        return expectedPath;
    }

    return null;
}

/** 获取书籍数据目录路径（已存在则返回，否则返回 null） */
export function getBookDirectory(dataDir: string): string | null {
    return resolveBookDir(dataDir);
}

/** 删除书籍目录及其所有内容 */
export function deleteBookDirectory(dataDir: string): void {
    if (fs.existsSync(dataDir)) {
        fs.rmSync(dataDir, { recursive: true, force: true });
    }
}

export type ReadProgressResult =
  | { kind: 'ok'; data: ProgressData }
  | { kind: 'missing' }
  | { kind: 'corrupt'; raw: string; error: { line: number; col: number; message: string } };

function locateJsonError(raw: string, err: SyntaxError): { line: number; col: number } {
    const m = /position\s+(\d+)/i.exec(err.message);
    if (!m) return { line: 1, col: 1 };
    const pos = Number(m[1]);
    const upto = raw.slice(0, pos);
    const line = (upto.match(/\n/g)?.length ?? 0) + 1;
    const lastNl = upto.lastIndexOf('\n');
    const col = pos - lastNl;
    return { line, col };
}

/** 读取 progress.json；返回 discriminated union 让上层决定如何处理 */
export function readProgress(bookDir: string): ReadProgressResult {
    const resolved = resolveBookDir(bookDir);
    if (!resolved) return { kind: 'missing' };
    const progressPath = path.join(resolved, 'progress.json');
    if (!fs.existsSync(progressPath)) return { kind: 'missing' };
    const raw = fs.readFileSync(progressPath, 'utf-8');
    try {
        return { kind: 'ok', data: JSON.parse(raw) as ProgressData };
    } catch (err) {
        const e = err as SyntaxError;
        const { line, col } = locateJsonError(raw, e);
        return { kind: 'corrupt', raw, error: { line, col, message: e.message } };
    }
}

/** 写入 progress.json（bookDir 可以是 slug 或绝对路径） */
export function writeProgress(bookDir: string, progress: ProgressData): void {
    const resolved = resolveBookDir(bookDir);
    if (!resolved) {
        console.error('[files] Cannot resolve bookDir for write:', bookDir);
        return;
    }
    const progressPath = path.join(resolved, 'progress.json');
    try {
        fs.writeFileSync(progressPath, JSON.stringify(progress, null, 2), 'utf-8');
    } catch (err) {
        console.error('[files] Failed to write progress.json:', err);
    }
}

// ── 导入用 staging 目录管理 ────────────────────────────────────────────────

const STAGING_DIR = path.join(BOOKS_DIR, '.staging');

function sleepSync(ms: number) {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function isSafeSlug(slug: string): boolean {
    return (
        !!slug &&
        !slug.includes('..') &&
        !slug.includes('/') &&
        !slug.includes('\\') &&
        !path.isAbsolute(slug)
    );
}

/** 创建一个唯一的 staging 目录，返回绝对路径 */
export function createStagingDir(): string {
    if (!fs.existsSync(STAGING_DIR)) {
        fs.mkdirSync(STAGING_DIR, { recursive: true });
    }
    const uuid = crypto.randomUUID();
    const dir = path.join(STAGING_DIR, uuid);
    fs.mkdirSync(dir, { recursive: true });
    return dir;
}

/** 将 buffer 保存到 staging dir 下的 fileName */
export function saveBufferTo(stagingDir: string, fileName: string, buf: Buffer): void {
    fs.writeFileSync(path.join(stagingDir, fileName), buf);
}

/** 把 staging dir 原子重命名为 BOOKS_DIR/<slug>，返回最终路径 */
export function commitStagingDir(stagingDir: string, finalSlug: string): string {
    if (!isSafeSlug(finalSlug)) {
        throw new Error(`Invalid slug: ${finalSlug}`);
    }
    const root = booksDir();
    const finalDir = path.join(root, finalSlug);
    const resolvedRoot = path.resolve(root);
    const resolvedFinal = path.resolve(finalDir);
    const relative = path.relative(resolvedRoot, resolvedFinal);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
        throw new Error(`Invalid final path: ${finalSlug}`);
    }
    if (!fs.existsSync(root)) {
        fs.mkdirSync(root, { recursive: true });
    }
    if (fs.existsSync(finalDir)) {
        throw new Error(`Book directory already exists: ${finalSlug}`);
    }

    let lastError: unknown = null;
    for (let attempt = 0; attempt < 5; attempt += 1) {
        try {
            fs.renameSync(stagingDir, finalDir);
            return finalDir;
        } catch (err) {
            lastError = err;
            const code = (err as NodeJS.ErrnoException).code;
            if (!['EPERM', 'EACCES', 'EBUSY'].includes(code ?? '')) break;
            sleepSync(120 * (attempt + 1));
        }
    }

    try {
        fs.cpSync(stagingDir, finalDir, { recursive: true, force: false, errorOnExist: true });
        fs.rmSync(stagingDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 120 });
        return finalDir;
    } catch (copyErr) {
        if (fs.existsSync(finalDir)) {
            try { fs.rmSync(finalDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 120 }); } catch { /* best effort cleanup */ }
        }
        throw lastError ?? copyErr;
    }
}

/** 删除 staging dir（失败回滚用）；不存在时静默忽略 */
export function removeStagingDir(stagingDir: string): void {
    if (fs.existsSync(stagingDir)) {
        fs.rmSync(stagingDir, { recursive: true, force: true });
    }
}
