// input: URL bookDir param (GET) / PATCH body partial (PATCH) / POST body 全量 (POST 保留兼容)
// output: 完整 ProgressData (GET 200) / 404 missing / 422 corrupt / PATCH 200 + zod 校验
// pos: [书籍进度资源 API] 唯一允许向 progress.json 顶层字段写入的入口
// 声明：一旦我被更新，务必更新我的开头注释以及所属文件夹的 md。

import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { resolveBookDir, readProgress, writeProgress } from "@/lib/files";
import { ProgressDataSchema } from "@/lib/schemas/progress-schema";
import { writeJsonAtomic } from "@/lib/atomic-write";
import type { ProgressData, ProgressPage } from "@/types/progress-data";

/**
 * 扫描磁盘上的 pages/*.html，把没在 progress.pages 里登记的「孤儿」html
 * 当作 deepdive 类型推断出来（运行时合并到 GET 响应里，不写回磁盘）。
 * 让 Claude Code 通过 chat 侧栏直接生成、但没走 POST /pages 注册流程的文件
 * 也能在 Hub Timeline 里出现 —— 否则 UI 找不到入口。
 */
function discoverOrphanPages(resolvedDir: string, known: ProgressPage[]): ProgressPage[] {
    const pagesDir = path.join(resolvedDir, 'pages');
    if (!fs.existsSync(pagesDir)) return [];

    const knownFiles = new Set(known.map((p) => p.file));
    const chapterTitles = known.filter((p) => p.type === 'chapter').map((p) => p.title);
    const today = new Date().toISOString();
    const out: ProgressPage[] = [];

    for (const name of fs.readdirSync(pagesDir)) {
        if (!name.toLowerCase().endsWith('.html')) continue;
        const file = `pages/${name}`;
        if (knownFiles.has(file)) continue;

        // 推断 title：抓 <title>...</title>；fallback 文件名
        let title = name.replace(/\.html$/i, '');
        let head = '';
        try {
            head = fs.readFileSync(path.join(pagesDir, name), 'utf-8').slice(0, 8192);
            const m = /<title>([^<]+)<\/title>/i.exec(head);
            if (m) title = m[1].replace(/\s+/g, ' ').trim();
        } catch { /* keep filename fallback */ }

        // 推断 relatedChapters：在 title / 文件首段 里搜任一已登记 chapter title 子串
        const haystack = `${title}\n${head}`;
        const related = chapterTitles.filter((c) => c.length >= 3 && haystack.includes(c));

        // 把开头的数字/章节号也尝试匹配：'01_财富起源...' → 章节 title 以 '01' 开头
        if (related.length === 0) {
            const prefix = /^(\d+)/.exec(name)?.[1];
            if (prefix) {
                const guess = chapterTitles.find((c) => new RegExp(`^0*${prefix}[^\\d]`).test(c));
                if (guess) related.push(guess);
            }
        }

        out.push({
            id: `orphan-${name.replace(/\W+/g, '_').slice(0, 48)}`,
            type: 'deepdive',
            title,
            description: '由 Claude Code 直接生成（未通过 API 登记）',
            file,
            status: 'new',
            masteryScore: null,
            relatedChapters: related,
            createdAt: today,
            completedAt: null,
        });
    }
    return out;
}

export async function GET(
    req: NextRequest,
    context: { params: Promise<{ bookDir: string }> }
) {
    try {
        const { bookDir } = await context.params;
        const decodedDir = decodeURIComponent(bookDir);

        const r = readProgress(decodedDir);
        if (r.kind === 'missing') {
            return NextResponse.json({ error: "missing" }, { status: 404 });
        }
        if (r.kind === 'corrupt') {
            const lines = r.raw.split('\n');
            const start = Math.max(0, r.error.line - 6);
            const end = Math.min(lines.length, r.error.line + 5);
            const rawSnippet = lines.slice(start, end).join('\n');
            return NextResponse.json({ error: { ...r.error, rawSnippet } }, { status: 422 });
        }

        const resolved = resolveBookDir(decodedDir);
        const orphans = resolved ? discoverOrphanPages(resolved, r.data.pages) : [];
        const augmented = orphans.length > 0
            ? { ...r.data, pages: [...r.data.pages, ...orphans] }
            : r.data;

        return NextResponse.json(augmented);
    } catch (error: any) {
        console.error("API /progress GET error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PATCH(
    req: NextRequest,
    context: { params: Promise<{ bookDir: string }> }
) {
    try {
        const { bookDir } = await context.params;
        const decodedDir = decodeURIComponent(bookDir);
        const resolved = resolveBookDir(decodedDir);
        if (!resolved) return NextResponse.json({ error: 'book_not_found' }, { status: 404 });

        let body: any;
        try { body = await req.json(); } catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }

        const r = readProgress(decodedDir);
        if (r.kind === 'missing') return NextResponse.json({ error: 'progress_missing' }, { status: 404 });
        if (r.kind === 'corrupt') return NextResponse.json({ error: 'progress_corrupt', detail: r.error }, { status: 422 });

        const merged = { ...r.data, ...body };
        const parsed = ProgressDataSchema.safeParse(merged);
        if (!parsed.success) return NextResponse.json({ error: 'invalid_progress', issues: parsed.error.issues }, { status: 400 });

        writeJsonAtomic(path.join(resolved, 'progress.json'), parsed.data);
        return NextResponse.json({ progress: parsed.data });
    } catch (error: any) {
        console.error("API /progress PATCH error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// 兼容旧 POST 路径（早期 UI 用 POST 做全量替换）。新代码应使用 PATCH。
export async function POST(
    req: NextRequest,
    context: { params: Promise<{ bookDir: string }> }
) {
    try {
        const { bookDir } = await context.params;
        const decodedDir = decodeURIComponent(bookDir);

        const body = await req.json();

        const cr = readProgress(decodedDir);
        if (cr.kind !== 'ok') {
             return NextResponse.json({ error: "Cannot patch. Progress not found" }, { status: 404 });
        }

        const newProgress: ProgressData = {
           ...cr.data,
           ...body
        };

        writeProgress(decodedDir, newProgress);

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("API /progress POST error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
