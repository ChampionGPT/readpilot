// input: POST body { permissionRequestId, decision }
// output: 解析 in-memory pending permission，让 canUseTool 那侧的 Promise resolve
// pos: 前端 InteractiveQuestionBlock 提交答案的后端 endpoint
// 声明：一旦我被更新，务必更新我的开头注释以及所属文件夹的 md。

import { NextRequest, NextResponse } from 'next/server';
import { resolvePending, getPending } from '@/lib/permission-registry';
import type { PermissionResult } from '@anthropic-ai/claude-agent-sdk';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RequestBody {
  permissionRequestId: string;
  decision: {
    behavior: 'allow' | 'deny';
    updatedInput?: Record<string, unknown>;
    message?: string;
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as RequestBody;
    const { permissionRequestId, decision } = body;

    if (!permissionRequestId || !decision?.behavior) {
      return NextResponse.json(
        { error: 'permissionRequestId and decision.behavior are required' },
        { status: 400 },
      );
    }

    const pending = getPending(permissionRequestId);
    if (!pending) {
      return NextResponse.json(
        { error: 'Permission request not found or already resolved', code: 'NOT_FOUND' },
        { status: 404 },
      );
    }

    let result: PermissionResult;
    if (decision.behavior === 'allow') {
      result = decision.updatedInput
        ? { behavior: 'allow', updatedInput: decision.updatedInput, updatedPermissions: [] }
        : { behavior: 'allow', updatedInput: pending.toolInput, updatedPermissions: [] };
    } else {
      result = { behavior: 'deny', message: decision.message ?? 'User denied' };
    }

    const ok = resolvePending(permissionRequestId, result);
    if (!ok) {
      return NextResponse.json(
        { error: 'Permission request gone (waiter expired)', code: 'WAITER_GONE' },
        { status: 410 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[POST /api/chat/permission] error:', err);
    return NextResponse.json({ error: err?.message ?? 'Internal error' }, { status: 500 });
  }
}
