// input: URL bookDir param
// output: 删除状态 — 区分 db / 文件夹 是否被实际删除，对完全不存在的 dir 返回 404
// pos: [书籍资源 API] 删除给定的书籍目录和其相关的数据库记录
// 声明：一旦我被更新，务必更新我的开头注释以及所属文件夹的 md。

import { NextRequest, NextResponse } from "next/server";
import { getBooks, deleteBook, deleteBinding } from "@/lib/db";
import { resolveBookDir } from "@/lib/files";
import fs from "fs";

export async function DELETE(
    req: NextRequest,
    context: { params: Promise<{ bookDir: string }> }
) {
    try {
        const { bookDir } = await context.params;
        const decodedDir = decodeURIComponent(bookDir);

        // 1. DB: 通过 dataDir 反查
        const book = getBooks().find(b => b.dataDir === decodedDir);
        const dbDeleted = book ? deleteBook(book.id) : false;

        // 2. 文件夹: 不再无脑 rmSync，先确认存在
        const resolvedDir = resolveBookDir(decodedDir);
        let folderDeleted = false;
        if (resolvedDir && fs.existsSync(resolvedDir)) {
            fs.rmSync(resolvedDir, { recursive: true, force: true });
            folderDeleted = true;
        }

        // 3. 顺手清理 weread_bindings 中可能存在的绑定（避免孤儿 binding 占用 weread_book_id UNIQUE 约束）
        //    无 binding 时 deleteBinding 是 no-op；不影响 dbDeleted/folderDeleted 的判定
        const bindingDeleted = deleteBinding(decodedDir);

        // 4. 三者都没动 → 这个 dir 既不在 DB 也没文件夹也没绑定 → 404
        if (!dbDeleted && !folderDeleted && !bindingDeleted) {
            return NextResponse.json(
                {
                    success: false,
                    error: "not_found",
                    message: `没有找到目录为「${decodedDir}」的书籍记录或文件夹`,
                    dbDeleted: false,
                    folderDeleted: false,
                    bindingDeleted: false,
                },
                { status: 404 },
            );
        }

        // 5. 部分删除 → 200 但显式标注（前端可据此提示用户）
        const partial = !dbDeleted || !folderDeleted;
        return NextResponse.json({
            success: true,
            partial,
            dbDeleted,
            folderDeleted,
            bindingDeleted,
            message: partial
                ? (dbDeleted ? "数据库记录已删除，但本地文件夹未找到" : "本地文件夹已删除，但数据库无对应记录")
                : "删除成功",
        });
    } catch (error: any) {
        console.error("API /books/[dir] DELETE error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
