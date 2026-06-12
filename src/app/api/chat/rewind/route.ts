// input: POST body { sessionId, fromIndex, expectedContent }
// output: { success, deleted } — 硬删 fromIndex (含) 之后的 messages，清空 sdk_session_id
// pos: ChatPanel 编辑用户气泡 + 重发流程的后端 endpoint
// 声明：一旦我被更新，务必更新我的开头注释以及所属文件夹的 md。

import { NextRequest, NextResponse } from 'next/server';
import { rewindMessages, rewindMessagesFromUser } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RequestBody {
  sessionId: string;
  fromIndex?: number;
  messageId?: string;
  userOrdinal?: number;
  expectedContent: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as RequestBody;
    const { sessionId, fromIndex, messageId, userOrdinal, expectedContent } = body;

    if (!sessionId || typeof expectedContent !== 'string') {
      return NextResponse.json(
        { error: 'sessionId and expectedContent are required' },
        { status: 400 },
      );
    }

    if (!messageId && typeof userOrdinal !== 'number' && typeof fromIndex !== 'number') {
      return NextResponse.json(
        { error: 'messageId, userOrdinal, or fromIndex is required' },
        { status: 400 },
      );
    }

    const result =
      messageId || typeof userOrdinal === 'number'
        ? rewindMessagesFromUser(sessionId, expectedContent, { messageId, userOrdinal })
        : rewindMessages(sessionId, fromIndex as number, expectedContent);
    return NextResponse.json({ success: true, deleted: result.deleted });
  } catch (err: unknown) {
    console.error('[POST /api/chat/rewind] error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal error' }, { status: 400 });
  }
}
