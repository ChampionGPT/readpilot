// input: sessionId param from URL
// output: Message history for the session
// pos: [消息历史 API] 获取指定会话的所有消息
import { NextRequest, NextResponse } from "next/server";
import { getMessages, getSession } from "@/lib/db";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await context.params;

    // Check if session exists
    const session = getSession(sessionId);
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Get messages for the session
    const messages = getMessages(sessionId);

    return NextResponse.json({ messages });
  } catch (error: any) {
    console.error("API /chat/messages/[sessionId] GET error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}