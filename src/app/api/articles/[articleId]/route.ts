// input: URL articleId param, db.ts (getArticle, updateArticle, deleteArticle)
// output: GET 单篇文章详情, PATCH 更新文章, DELETE 删除文章
// pos: [文章详情 API] 单篇文章的读取、修改、删除
// 声明：一旦我被更新，务必更新我的开头注释以及所属文件夹的 md。

import { NextRequest, NextResponse } from "next/server";
import { getArticle, updateArticle, deleteArticle } from "@/lib/db";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ articleId: string }> }
) {
  try {
    const { articleId } = await context.params;
    const article = getArticle(articleId);
    if (!article) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }
    return NextResponse.json(article);
  } catch (error: any) {
    console.error("API /articles/[articleId] GET error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ articleId: string }> }
) {
  try {
    const { articleId } = await context.params;
    const body = await req.json();
    const updated = updateArticle(articleId, body);
    return NextResponse.json(
      updated ? { success: true } : { error: "Failed to update" },
      { status: updated ? 200 : 500 }
    );
  } catch (error: any) {
    console.error("API /articles/[articleId] PATCH error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ articleId: string }> }
) {
  try {
    const { articleId } = await context.params;
    const deleted = deleteArticle(articleId);
    return NextResponse.json(
      deleted ? { success: true } : { error: "Not found" },
      { status: deleted ? 200 : 404 }
    );
  } catch (error: any) {
    console.error("API /articles/[articleId] DELETE error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
