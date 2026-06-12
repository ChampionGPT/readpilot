// input: POST { localBookDir, force?, scope? }
// output: SyncResult { bookId, ran[], skipped[], errors[] }
// pos: 手动/绑定后同步入口 — UI "立即同步" 按钮 + bind 路由的内部调用方
// 声明：一旦我被更新，务必更新我的开头注释以及所属文件夹的 md。

import { NextRequest, NextResponse } from 'next/server';
import { getBindingByDir } from '@/lib/db';
import { syncBook, type SyncScope } from '@/lib/wereadCache';
import { WereadAuthError, WereadApiError } from '@/lib/wereadClient';
import type { WereadSyncRequest } from '@/types/weread';

export async function POST(req: NextRequest) {
  let body: WereadSyncRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }
  if (!body.localBookDir) {
    return NextResponse.json({ error: '缺少 localBookDir' }, { status: 400 });
  }
  const binding = getBindingByDir(body.localBookDir);
  if (!binding) {
    return NextResponse.json({ error: '该本地书尚未绑定微读' }, { status: 404 });
  }

  try {
    const result = await syncBook(binding.localBookDir, binding.wereadBookId, {
      force: body.force ?? false,
      scope: body.scope as SyncScope[] | undefined,
    });
    return NextResponse.json({ result });
  } catch (e: any) {
    if (e instanceof WereadAuthError) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    if (e instanceof WereadApiError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: 502 });
    }
    console.error('[/api/weread/sync] error:', e);
    return NextResponse.json({ error: e?.message ?? '同步失败' }, { status: 500 });
  }
}
