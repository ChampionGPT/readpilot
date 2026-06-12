/**
 * input: SQLite (books + book_notes tables)
 * output: 每本书的笔记统计数据 [{ bookId, bookDir, bookTitle, noteCount, latestCue, latestUpdatedAt }]
 * pos: ReadingNotesOverview 的数据源 API
 *
 * 声明：一旦我被更新，务必更新我的开头注释以及所属文件夹的 md。
 */
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  try {
    const db = getDb();
    const rows = db.prepare(`
      SELECT
        b.id AS bookId,
        b.data_dir AS bookDir,
        b.title AS bookTitle,
        COUNT(bn.id) AS noteCount,
        (SELECT cue FROM book_notes WHERE book_id = b.id ORDER BY updated_at DESC LIMIT 1) AS latestCue,
        (SELECT updated_at FROM book_notes WHERE book_id = b.id ORDER BY updated_at DESC LIMIT 1) AS latestUpdatedAt
      FROM books b
      LEFT JOIN book_notes bn ON bn.book_id = b.id
      GROUP BY b.id
      ORDER BY noteCount DESC, b.title ASC
    `).all();

    return NextResponse.json(rows);
  } catch (error: any) {
    console.error("API /notes/summary GET error:", error);
    return NextResponse.json([], { status: 500 });
  }
}

