/**
 * input: POST 无 body
 * output: 用 progress.json.bak 覆盖 progress.json；返回恢复后的 ProgressData
 * pos: 损坏恢复入口（由 UI ProgressErrorPanel 调用）
 */
import { NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';
import { resolveBookDir } from '@/lib/files';
import { ProgressDataSchema } from '@/lib/schemas/progress-schema';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ bookDir: string }> },
) {
  const { bookDir } = await params;
  const decoded = decodeURIComponent(bookDir);
  const resolved = resolveBookDir(decoded);
  if (!resolved) return NextResponse.json({ error: 'book_not_found' }, { status: 404 });

  const bakPath = path.join(resolved, 'progress.json.bak');
  if (!fs.existsSync(bakPath)) return NextResponse.json({ error: 'no_backup' }, { status: 404 });

  const bakRaw = fs.readFileSync(bakPath, 'utf-8');
  let parsed: any;
  try { parsed = JSON.parse(bakRaw); }
  catch (err) { return NextResponse.json({ error: 'bak_corrupt', message: (err as Error).message }, { status: 422 }); }

  const validated = ProgressDataSchema.safeParse(parsed);
  if (!validated.success) return NextResponse.json({ error: 'bak_schema_invalid', issues: validated.error.issues }, { status: 422 });

  fs.copyFileSync(bakPath, path.join(resolved, 'progress.json'));
  return NextResponse.json({ progress: validated.data });
}
