// input: URL sessionId param
// output: 会话信息及其底下的所有 Messages / 删除会话
// pos: [对话现场恢复 API] 根据 session ID 拉取全套对话记录 / 删除会话
// 声明：一旦我被更新，务必更新我的开头注释以及所属文件夹的 md。

import { NextRequest, NextResponse } from "next/server";
import { getSession, getMessages, deleteSession, updateSessionTitle } from "@/lib/db";

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
  } catch (error: any) {
    console.error("API /chat/sessions/detail/[sessionId] GET error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
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
  } catch (error: any) {
    console.error("API /chat/sessions/detail/[sessionId] DELETE error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await context.params;
    const body = await req.json();
    
    if (!body.title || typeof body.title !== 'string') {
      return NextResponse.json({ error: "Invalid title" }, { status: 400 });
    }
    
    
    const updated = updateSessionTitle(sessionId, body.title);
    return NextResponse.json(updated ? { success: true } : { error: "Failed to update" }, { status: updated ? 200 : 500 });
  } catch (error: any) {
    console.error("API /chat/sessions/detail/[sessionId] PATCH error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}