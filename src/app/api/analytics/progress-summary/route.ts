// input: Query params - bookId
// output: Progress summary
// pos: [进度汇总 API] 返回完成百分比、正在阅读、待开始的数量
import { NextRequest, NextResponse } from "next/server";
import { getProgressSummary } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const bookId = searchParams.get('bookId') || undefined;

    const summary = getProgressSummary(bookId);

    return NextResponse.json(summary);
  } catch (error: any) {
    console.error("API /analytics/progress-summary GET error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}