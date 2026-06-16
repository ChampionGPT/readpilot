// input: URL sessionId param
// output: 会话信息及其底下的所有 Messages / 删除会话
// pos: [对话现场恢复 API] 根据 session ID 拉取全套对话记录 / 删除会话
// 声明：一旦我被更新，务必更新我的开头注释以及所属文件夹的 md。

import { NextRequest, NextResponse } from "next/server";
import { getSession, getMessages, deleteSession, updateSessionProvider, updateSessionTitle } from "@/lib/db";

function normalizeProvider(value: unknown): 'claude' | 'codex' | 'hermes' | null {
  if (value === 'claude' || value === 'codex' || value === 'hermes') return value;
  return null;
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await context.params;

    const session = getSession(sessionId);

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const messages = getMessages(sessionId);

    return NextResponse.json({
      session,
      messages
    });
  } catch (error: unknown) {
    console.error("API /chat/sessions/detail/[sessionId] GET error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await context.params;
    const session = getSession(sessionId);
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    const deleted = deleteSession(sessionId);
    return NextResponse.json(deleted ? { success: true } : { error: "Failed to delete" }, { status: deleted ? 200 : 500 });
  } catch (error: unknown) {
    console.error("API /chat/sessions/detail/[sessionId] DELETE error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await context.params;
    const body = await req.json();
    
    const provider = normalizeProvider(body.provider);
    const hasTitle = typeof body.title === 'string';
    if (!hasTitle && !provider) {
      return NextResponse.json({ error: "Invalid patch payload" }, { status: 400 });
    }

    let updated = false;
    if (hasTitle) updated = updateSessionTitle(sessionId, body.title);
    if (provider) updated = updateSessionProvider(sessionId, provider) || updated;
    return NextResponse.json(updated ? { success: true } : { error: "Failed to update" }, { status: updated ? 200 : 500 });
  } catch (error: unknown) {
    console.error("API /chat/sessions/detail/[sessionId] PATCH error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
