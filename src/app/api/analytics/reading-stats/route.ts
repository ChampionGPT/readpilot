// input: Query params - bookId, startDate, endDate
// output: Reading statistics
// pos: [阅读统计 API] 返回阅读时长、页面数、会话数等统计
import { NextRequest, NextResponse } from "next/server";
import { getReadingStats } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const bookId = searchParams.get('bookId') || undefined;
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;

    const stats = getReadingStats(bookId, startDate, endDate);

    return NextResponse.json(stats);
  } catch (error: any) {
    console.error("API /analytics/reading-stats GET error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}