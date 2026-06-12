// input: POST { localBookDir, wereadBookId } | DELETE { localBookDir }
// output: POST 创建绑定并触发首次 sync；DELETE 解绑
// pos: 绑定关系 CRUD — WereadBindDialog 的提交目标 + BookCard 解绑按钮的目标
// 声明：一旦我被更新，务必更新我的开头注释以及所属文件夹的 md。

import { NextRequest, NextResponse } from 'next/server';
import { createBinding, getBindingByDir, getBindingByBookId, deleteBinding, isLocalBookDirAlive } from '@/lib/db';
import { syncBook } from '@/lib/wereadCache';
import { WereadAuthError, WereadApiError } from '@/lib/wereadClient';
import type { WereadBindRequest } from '@/types/weread';

export async function POST(req: NextRequest) {
  let body: WereadBindRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }
  const { localBookDir, wereadBookId } = body;
  if (!localBookDir || !wereadBookId) {
    return NextResponse.json({ error: '缺少 localBookDir 或 wereadBookId' }, { status: 400 });
  }

  // 冲突检测 — 命中已有 binding 时先验证它不是孤儿（指向已删除的本地书）。
  // 孤儿 binding 自动清掉，让用户当下就能重新绑；只对仍存活的 binding 报 409。
  const existingByDir = getBindingByDir(localBookDir);
  if (existingByDir) {
    return NextResponse.json({ error: '该本地书已绑定，请先解绑' }, { status: 409 });
  }
  const existingByBookId = getBindingByBookId(wereadBookId);
  if (existingByBookId) {
    if (!isLocalBookDirAlive(existingByBookId.localBookDir)) {
      // 孤儿 binding — 指向的本地书已删除。静默清理，继续绑定。
      console.warn('[/api/weread/bind] cleaning orphan binding:', existingByBookId.localBookDir, '→', wereadBookId);
      deleteBinding(existingByBookId.localBookDir);
    } else {
      return NextResponse.json({ error: '该微读书已绑定到其他本地书' }, { status: 409 });
    }
  }

  const binding = createBinding(localBookDir, wereadBookId);

  let syncResult;
  try {
    syncResult = await syncBook(localBookDir, wereadBookId, { force: true });
  } catch (e: any) {
    if (e instanceof WereadAuthError) {
      return NextResponse.json({ binding, sync: null, warning: 'API Key 未设置，绑定已建立但未同步' }, { status: 200 });
    }
    if (e instanceof WereadApiError) {
      return NextResponse.json({ binding, sync: null, warning: e.message }, { status: 200 });
    }
    console.error('[/api/weread/bind] sync error:', e);
    return NextResponse.json({ binding, sync: null, warning: '同步过程出错，请稍后重试' }, { status: 200 });
  }

  return NextResponse.json({ binding, sync: syncResult });
}

export async function DELETE(req: NextRequest) {
  let body: { localBookDir?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }
  if (!body.localBookDir) {
    return NextResponse.json({ error: '缺少 localBookDir' }, { status: 400 });
  }
  const ok = deleteBinding(body.localBookDir);
  return NextResponse.json({ deleted: ok });
}
