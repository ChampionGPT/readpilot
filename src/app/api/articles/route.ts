// input: db.ts (getArticles, createArticle), ArticleCreateInput type
// output: GET 返回所有文章列表，POST 创建新文章
// pos: [文章资源大盘 API] 文章列表获取与创建入口
// 声明：一旦我被更新，务必更新我的开头注释以及所属文件夹的 md。

import { NextRequest, NextResponse } from "next/server";
import { getArticles, createArticle } from "@/lib/db";
import type { ArticleCreateInput } from "@/types/progress";

export async function GET() {
  try {
    const articles = getArticles();
    return NextResponse.json(articles);
  } catch (error: any) {
    console.error("API /articles GET error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body: ArticleCreateInput = await req.json();

    if (!body.title || !body.content) {
      return NextResponse.json({ error: "Title and content are required" }, { status: 400 });
    }

    const article = createArticle(body);
    return NextResponse.json(article, { status: 201 });
  } catch (error: any) {
    console.error("API /articles POST error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
