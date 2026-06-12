// input: db.ts, files.ts, BookCreateInput
// output: Endpoint GET/POST 返回书籍列表或创建后的书籍目录
// pos: [书籍资源大盘 API] 给 AppLayout (GET) 和 ImportModal (POST) 提供全局支撑
// 声明：一旦我被更新，务必更新我的开头注释以及所属文件夹的 md。

import { NextRequest, NextResponse } from "next/server";
import { getBooks, createBook } from "@/lib/db";
import { createBookDirectory } from "@/lib/files";
import type { BookCreateInput } from "@/types/progress";

export async function GET() {
    try {
        const books = getBooks();
        const formattedBooks = books.map(b => ({
            id: b.id,
            title: b.title,
            dataDir: b.dataDir, // frontend and Book interface expect dataDir
            dir: b.dataDir, // Keep dir for backwards compatibility temporarily
            author: b.author,
            genre: b.genre,
            updatedAt: b.updatedAt
        }));
        return NextResponse.json(formattedBooks);
    } catch (error: any) {
        console.error("API /books GET error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const body: BookCreateInput = await req.json();
        
        if (!body.title) {
            return NextResponse.json({ error: "Title is required" }, { status: 400 });
        }

        // 短 hash 作为安全目录名
        const fakeId = Math.random().toString(36).substring(2, 10);
        
        // 此步骤会自动创建目录，并初始化 progress.json (符合 ProgressData 结构)
        const activeDirName = createBookDirectory(fakeId, body.title);
        
        // 落库
        const book = createBook(body, activeDirName);
        
        return NextResponse.json({
             id: book.id,
             title: book.title,
             dir: book.dataDir,
             author: book.author,
             genre: book.genre
        }, { status: 201 });
    } catch (error: any) {
        console.error("API /books POST error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
