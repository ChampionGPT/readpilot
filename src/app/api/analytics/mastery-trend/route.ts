// input: Query params - bookId, days (default 30)
// output: Mastery score trends over time
// pos: [掌握度趋势 API] 返回各页面的掌握分数变化趋势
import { NextRequest, NextResponse } from "next/server";
import { getMasteryTrend } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const bookId = searchParams.get('bookId') || undefined;
    const days = parseInt(searchParams.get('days') || '30', 10);

    const trend = getMasteryTrend(bookId, days);

    return NextResponse.json({ trend });
  } catch (error: any) {
    console.error("API /analytics/mastery-trend GET error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}