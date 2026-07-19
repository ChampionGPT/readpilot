// input: URL params (bookDir, pageFile, theme)
// output: HTML 页面内容（根据 theme 参数注入对应样式）
// pos: 内容分发层 — 桥接文件系统中的 HTML 页面与前端 iframe
// 声明：一旦我被更新，务必更新我的开头注释以及所属文件夹的 md。

import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { resolveBookDir, readProgress } from "@/lib/files";
import { writeJsonAtomic } from "@/lib/atomic-write";
import { BASE_CSS, CLASSIC_VARS, MODERN_VARS, MAGAZINE_VARS } from "./styles/base";
import { MODERN_CSS, MAGAZINE_CSS, CLASSIC_COMPANION_CSS } from "./styles/companion";
import { CLASSIC_EPUB_CSS, MODERN_EPUB_CSS, MAGAZINE_EPUB_CSS } from "./styles/epub";
import {
  injectBodyClass,
  wrapEpubLegacyMarkup,
  removeDuplicateChapterTitle,
  readProgressForBook,
  findCurrentChapter,
  buildAftermathHtml,
} from "./html-transforms";

function looksRenderable(html: string) {
  const lower = html.toLowerCase();
  return lower.includes("</head>") && lower.includes("</body>") && lower.includes("</html>");
}

async function readRenderableHtml(pagePath: string) {
  let html = "";
  for (let attempt = 0; attempt < 6; attempt += 1) {
    html = fs.readFileSync(pagePath, "utf-8");
    if (looksRenderable(html)) return html;
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
  return html;
}

function injectHeadAssets(html: string, assets: string) {
  if (/<\/head>/i.test(html)) return html.replace(/<\/head>/i, `${assets}</head>`);
  if (/<head[^>]*>/i.test(html)) return html.replace(/<head([^>]*)>/i, `<head$1>${assets}`);
  if (/<html[^>]*>/i.test(html)) return html.replace(/<html([^>]*)>/i, `<html$1><head><meta charset="UTF-8">${assets}</head>`);
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8">${assets}</head><body>${html}</body></html>`;
}

function injectBookAssetBase(html: string, bookDir: string) {
  return html.replaceAll("__READPILOT_BOOK_DIR__", encodeURIComponent(bookDir));
}

function isInsideDirectory(root: string, target: string) {
  const relative = path.relative(root, target);
  return relative.length > 0 && !relative.startsWith("..") && !path.isAbsolute(relative);
}

export async function GET(
  req: NextRequest | Request,
  { params }: { params: Promise<{ bookDir: string; pageFile: string }> }
) {
  const { bookDir, pageFile } = await params;
  const decodedDir = decodeURIComponent(bookDir);
  const decodedFile = decodeURIComponent(pageFile);
  const theme = new URL(req.url).searchParams.get("theme");

  const resolvedDir = resolveBookDir(decodedDir);
  if (!resolvedDir) {
    return NextResponse.json({ error: "Book directory not found" }, { status: 404 });
  }
  const bookRoot = path.resolve(resolvedDir);
  const pagePath = path.resolve(bookRoot, decodedFile);
  if (!isInsideDirectory(bookRoot, pagePath)) {
    return NextResponse.json({ error: "Invalid page path" }, { status: 400 });
  }

  if (!fs.existsSync(pagePath)) {
    return NextResponse.json({ error: "Page not found" }, { status: 404 });
  }

  try {
    let html = await readRenderableHtml(pagePath);

    // 优先用 progress.json 的 page.type 判定（兼容老导入：marker class 缺失）
    const progress = readProgressForBook(resolvedDir);
    const matched = progress ? progress.pages.find((p) => p.file === decodedFile) ?? null : null;
    const hasBodyMarker = /<body[^>]*class="[^"]*\bepub-chapter\b/.test(html);
    const isEpubChapter = hasBodyMarker || matched?.type === 'chapter';

    const vars = theme === "modern" ? MODERN_VARS : theme === "magazine" ? MAGAZINE_VARS : CLASSIC_VARS;

    if (isEpubChapter) {
      // 如老 HTML 缺 class，运行时补上（让 body.epub-chapter 选择器生效）
      if (!hasBodyMarker) html = injectBodyClass(html, "epub-chapter");
      // 老 HTML 没有 .chapter / .chapter-title / .chapter-body 结构，则同时打包结构 class
      html = wrapEpubLegacyMarkup(html);
      html = removeDuplicateChapterTitle(html);

      const themeCss = theme === "modern" ? MODERN_EPUB_CSS : theme === "magazine" ? MAGAZINE_EPUB_CSS : CLASSIC_EPUB_CSS;
      const annotatorAssets = matched
        ? `<link rel="stylesheet" href="/annotator/annotator.css">` +
          `<script>window.__RP_ANNOT__=${JSON.stringify({ bookDir: decodedDir, pageId: matched.id })};</script>` +
          `<script defer src="/annotator/annotator.js"></script>`
        : "";
      html = injectHeadAssets(html, `${BASE_CSS}${vars}${themeCss}${annotatorAssets}`);

      // chapter-aftermath 注入
      if (progress) {
        const currentChapter = matched && matched.type === 'chapter' ? matched : findCurrentChapter(progress, decodedFile);
        if (currentChapter) {
          const aftermath = buildAftermathHtml(progress, currentChapter, decodedDir, theme);
          // 优先注到 </article> 之前；老 HTML 若无 article，注到 </body> 之前
          if (/<\/article>/i.test(html)) {
            html = html.replace(/<\/article>/i, `</article>${aftermath}`);
          } else {
            html = html.replace(/<\/body>/i, `${aftermath}</body>`);
          }
        }
      }
    } else {
      // companion-page 路径（books-to-course skill 输出 / 旧 page 输出兼容）
      const extra = theme === "modern" ? MODERN_CSS : theme === "magazine" ? MAGAZINE_CSS : CLASSIC_COMPANION_CSS;
      html = injectHeadAssets(html, `${BASE_CSS}${vars}${extra}`);
      html = injectBodyClass(html, "companion-page");
      if (theme === "modern") html = injectBodyClass(html, "theme-modern");
      else if (theme === "magazine") html = injectBodyClass(html, "theme-magazine");
    }

    html = injectBookAssetBase(html, decodedDir);

    return new NextResponse(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch {
    return NextResponse.json({ error: "Failed to read page" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest | Request,
  { params }: { params: Promise<{ bookDir: string; pageFile: string }> },
) {
  const { bookDir, pageFile } = await params;
  const decodedDir = decodeURIComponent(bookDir);
  const decodedFile = decodeURIComponent(pageFile);
  const resolved = resolveBookDir(decodedDir);
  if (!resolved) return NextResponse.json({ error: 'book_not_found' }, { status: 404 });

  const r = readProgress(decodedDir);
  if (r.kind === 'missing') return NextResponse.json({ error: 'progress_missing' }, { status: 404 });
  if (r.kind === 'corrupt') return NextResponse.json({ error: 'progress_corrupt', detail: r.error }, { status: 422 });

  const target = r.data.pages.find((p) => p.file === decodedFile);
  if (!target) return NextResponse.json({ error: 'page_not_found', file: decodedFile }, { status: 404 });

  const next = { ...r.data, pages: r.data.pages.filter((p) => p.file !== decodedFile) };
  writeJsonAtomic(path.join(resolved, 'progress.json'), next);

  try { fs.unlinkSync(path.join(resolved, decodedFile)); } catch { /* best-effort */ }

  return NextResponse.json({ progress: next });
}
