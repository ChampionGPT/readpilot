/**
 * input: POST body { page: ProgressPage }
 * output: 201 + 更新后的 ProgressData / 4xx 错误
 * pos: progress.json 写入的唯一 API 入口（追加 page）
 */
import { NextResponse } from 'next/server';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { resolveBookDir, readProgress } from '@/lib/files';
import { ProgressPageSchema } from '@/lib/schemas/progress-schema';
import { writeJsonAtomic } from '@/lib/atomic-write';

function isRenderableHtml(html: string) {
  const lower = html.toLowerCase();
  return lower.includes('</head>') && lower.includes('</body>') && lower.includes('</html>');
}

async function waitForRenderablePage(absPath: string) {
  for (let attempt = 0; attempt < 16; attempt += 1) {
    try {
      const html = await readFile(absPath, 'utf-8');
      if (isRenderableHtml(html)) return true;
    } catch {
      // File may not be visible yet while the agent is still writing.
    }
    await new Promise((resolve) => setTimeout(resolve, 125));
  }
  return false;
}

function isInsideDirectory(root: string, target: string) {
  const relative = path.relative(root, target);
  return relative.length > 0 && !relative.startsWith('..') && !path.isAbsolute(relative);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ bookDir: string }> },
) {
  const { bookDir } = await params;
  const decoded = decodeURIComponent(bookDir);
  const resolved = resolveBookDir(decoded);
  if (!resolved) return NextResponse.json({ error: 'book_not_found' }, { status: 404 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }

  const bodyRecord = typeof body === 'object' && body !== null ? body as { page?: unknown } : null;
  const parsed = ProgressPageSchema.safeParse(bodyRecord?.page);
  if (!parsed.success) return NextResponse.json({ error: 'invalid_page', issues: parsed.error.issues }, { status: 400 });

  const pageAbs = path.resolve(resolved, parsed.data.file);
  const bookRoot = path.resolve(resolved);
  if (!isInsideDirectory(bookRoot, pageAbs)) {
    return NextResponse.json({ error: 'invalid_page_path' }, { status: 400 });
  }
  if (!(await waitForRenderablePage(pageAbs))) {
    return NextResponse.json({ error: 'page_not_ready', file: parsed.data.file }, { status: 409 });
  }

  const r = readProgress(decoded);
  if (r.kind === 'missing') return NextResponse.json({ error: 'progress_missing' }, { status: 404 });
  if (r.kind === 'corrupt') return NextResponse.json({ error: 'progress_corrupt', detail: r.error }, { status: 422 });

  if (r.data.pages.some((p) => p.id === parsed.data.id)) {
    return NextResponse.json({ error: 'duplicate_id', id: parsed.data.id }, { status: 409 });
  }

  const next = { ...r.data, pages: [...r.data.pages, parsed.data] };
  writeJsonAtomic(path.join(resolved, 'progress.json'), next);
  return NextResponse.json({ progress: next }, { status: 201 });
}
