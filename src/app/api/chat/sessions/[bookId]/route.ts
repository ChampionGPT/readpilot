// input: URL bookId param, body { title?: string }
// output: 新创建的会话信息
// pos: [会话创建 API] 为一本书创建新的对话会话
// 声明：一旦我被更新，务必更新我的开头注释以及所属文件夹的 md。

import { NextRequest, NextResponse } from "next/server";
import { createSession, getSessionsByBook } from "@/lib/db";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ bookId: string }> }
) {
  try {
    const { bookId } = await context.params;
    const body = await req.json().catch(() => ({}));
    const title = body.title || `阅读对话 ${new Date().toLocaleDateString('zh-CN')}`;

    const session = createSession(bookId, title);
    return NextResponse.json(session);
  } catch (error: any) {
    console.error("API /chat/sessions/[bookId] POST error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ bookId: string }> }
) {
  try {
    const { bookId } = await context.params;
    const sessions = getSessionsByBook(bookId);
    return NextResponse.json(sessions);
  } catch (error: any) {
    console.error("API /chat/sessions/[bookId] GET error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
