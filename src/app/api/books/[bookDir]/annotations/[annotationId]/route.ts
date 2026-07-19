// input: bookDir + annotationId (URL params), db.ts (updateAnnotation, softDeleteAnnotation)
// output: PATCH (更新/恢复标注), DELETE (软删除)
// pos: 单条标注 API
// 声明：一旦我被更新，务必更新我的开头注释以及所属文件夹的 md。

import { NextRequest, NextResponse } from 'next/server';
import { getAnnotation, updateAnnotation, softDeleteAnnotation } from '@/lib/db';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ bookDir: string; annotationId: string }> }
) {
  const { annotationId } = await params;
  try {
    const body = await req.json();
    if (!getAnnotation(annotationId)) {
      return NextResponse.json({ error: 'Annotation not found' }, { status: 404 });
    }
    const updated = updateAnnotation(annotationId, body);
    return NextResponse.json(updated);
  } catch (err: any) {
    console.error('API /annotations PATCH error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ bookDir: string; annotationId: string }> }
) {
  const { annotationId } = await params;
  const ok = softDeleteAnnotation(annotationId);
  if (!ok) {
    return NextResponse.json({ error: 'Annotation not found' }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
