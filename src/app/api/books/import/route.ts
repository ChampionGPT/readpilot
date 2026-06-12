// input: multipart/form-data with file=.epub + optional title/author
// output: text/event-stream 推送 ImportEvent；落 data/books/{dir}/source.epub|source.jsonl|progress.json|pages/|companion/
// pos: [书籍导入大盘 API] — Phase 1 EPUB-only 入口
// 声明：一旦我被更新，务必更新我的开头注释以及所属文件夹的 md。

import { NextRequest } from 'next/server';
import path from 'node:path';
import fs from 'node:fs';
import { convertEbook, type ConvertEbookError } from '@/lib/ebook-converter';
import { renderJsonlToPages } from '@/lib/jsonl-to-pages';
import { buildCompanionArtifacts } from '@/lib/companion-compiler';
import {
  createStagingDir,
  commitStagingDir,
  removeStagingDir,
  saveBufferTo,
} from '@/lib/files';
import { createBook } from '@/lib/db';
import { encodeImportEvent, type ImportEvent, type ImportStage } from '@/lib/import-events';
import type { ProgressData } from '@/types/progress-data';

export const maxDuration = 300;
export const runtime = 'nodejs';

const MAX_BYTES = 200 * 1024 * 1024;

function sanitizeSlug(title: string): string {
  return title
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 50)
    .trim() || 'untitled';
}

function progressPagesFromPreserved(
  pages: NonNullable<Awaited<ReturnType<typeof convertEbook>>['preservedPages']>,
): ProgressData['pages'] {
  const today = new Date().toISOString();
  return pages.map((page, idx) => {
    const padded = String(idx + 1).padStart(2, '0');
    return {
      id: `chap-${padded}`,
      type: 'chapter',
      title: page.title,
      description: `第 ${idx + 1} 章原文`,
      file: page.file,
      status: 'new',
      masteryScore: null,
      relatedChapters: [page.title],
      createdAt: today,
      completedAt: null,
    };
  });
}

export async function POST(req: NextRequest | Request): Promise<Response> {
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let stagingDir: string | null = null;
      let closed = false;

      const safeClose = () => {
        if (closed) return;
        closed = true;
        try { controller.close(); } catch { /* already closed */ }
      };
      const emit = (event: ImportEvent) => {
        if (closed) return;
        controller.enqueue(encoder.encode(encodeImportEvent(event)));
      };
      const emitProgress = (
        stage: ImportStage,
        message: string,
        current?: number,
        total?: number,
      ) => {
        emit({ type: 'progress', data: { stage, message, current, total } });
      };
      const fail = (
        data: ConvertEbookError | { kind: 'validation' | 'internal'; message: string },
      ) => {
        emit({ type: 'error', data });
        if (stagingDir) removeStagingDir(stagingDir);
        safeClose();
      };

      // Hook abort
      const abortSignal = (req as NextRequest).signal ?? new AbortController().signal;
      abortSignal.addEventListener('abort', () => {
        if (stagingDir) removeStagingDir(stagingDir);
        safeClose();
      });

      try {
        // 1. Parse multipart
        const form = await req.formData();
        const file = form.get('file');
        const title = (form.get('title') as string | null) ?? '';
        const author = (form.get('author') as string | null) ?? '';

        if (!(file instanceof Blob)) {
          fail({ kind: 'validation', message: '缺少 file 字段' });
          return;
        }
        const fileName = (file as File).name || 'book.epub';
        if (!fileName.toLowerCase().endsWith('.epub')) {
          fail({ kind: 'validation', message: '仅支持 .epub 格式' });
          return;
        }
        const size = file.size;
        if (size > MAX_BYTES) {
          fail({
            kind: 'validation',
            message: `文件超过 ${MAX_BYTES / 1024 / 1024}MB 上限`,
          });
          return;
        }

        // 2. Save to staging
        stagingDir = createStagingDir();
        const buf = Buffer.from(await file.arrayBuffer());
        saveBufferTo(stagingDir, 'source.epub', buf);
        emitProgress('upload_received', `文件已接收 ${(size / 1024).toFixed(0)}KB`);

        // 3. Spawn Python
        emitProgress('python_spawning', '启动转换器…');
        const sourceEpub = path.join(stagingDir, 'source.epub');
        const sourceJsonl = path.join(stagingDir, 'source.jsonl');
        const sourceManifest = path.join(stagingDir, 'source-manifest.json');
        const pagesDir = path.join(stagingDir, 'pages');
        emitProgress('python_running', '解析 EPUB 中…');
        const conv = await convertEbook(sourceEpub, sourceJsonl, {
          signal: abortSignal,
          timeoutMs: 240_000,
          htmlDir: pagesDir,
          manifestPath: sourceManifest,
        });

        // 4. JSONL parsed by convertEbook
        emitProgress('parsing_jsonl', `识别到 ${conv.chapters.length} 个章节`);

        // 5. Render HTML pages
        const pagesAll = conv.preservedPages?.length
          ? progressPagesFromPreserved(conv.preservedPages)
          : renderJsonlToPages(stagingDir, conv.chunks);
        const total = pagesAll.length;
        emitProgress('rendering_pages', `已生成 ${total} 个阅读页`, total, total);

        // 6. Write progress.json
        emitProgress('writing_progress', '保存阅读进度…');
        const resolvedTitle = title.trim() || conv.bookTitle || fileName.replace(/\.epub$/i, '');
        const today = new Date().toISOString().split('T')[0];
        const progress: ProgressData = {
          book: {
            title: resolvedTitle,
            author: author.trim(),
            genre: '',
            totalChapters: conv.chapters.length,
            startDate: today,
            structure: [],
            totalPages: null,
            currentPage: null,
          },
          pages: pagesAll,
          themes: [],
          glossary: {},
          currentFocus: pagesAll[0]?.id ?? null,
          nextRecommendation: null,
          readingLog: [{
            date: today,
            action: 'started',
            note: `从 EPUB 导入：${fileName}`,
          }],
        };
        fs.writeFileSync(
          path.join(stagingDir, 'progress.json'),
          JSON.stringify(progress, null, 2),
          'utf-8',
        );

        // 7. Build reusable companion cache
        emitProgress('building_companion', '建立全书伴读档案…');
        buildCompanionArtifacts(stagingDir, progress, conv.chunks, {
          sourceFileName: fileName,
        });

        // 8. Commit (atomic rename)
        emitProgress('committing', '提交到书架…');
        const fakeId = Math.random().toString(36).substring(2, 10);
        const slug = `${fakeId}_${sanitizeSlug(resolvedTitle)}`;
        commitStagingDir(stagingDir, slug);
        stagingDir = null;

        // 9. DB insert
        const book = createBook({ title: resolvedTitle, author: author.trim() }, slug);

        emitProgress('done', '导入完成');
        emit({
          type: 'done',
          data: {
            id: book.id,
            dir: book.dataDir,
            title: book.title,
            author: book.author,
            chapterCount: conv.chapters.length,
          },
        });
        safeClose();
      } catch (err) {
        if (err && typeof err === 'object' && 'kind' in err) {
          fail(err as ConvertEbookError);
        } else {
          fail({ kind: 'internal', message: (err as Error).message ?? 'unknown error' });
        }
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
