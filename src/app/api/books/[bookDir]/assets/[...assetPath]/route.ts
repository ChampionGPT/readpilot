import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { resolveBookDir } from "@/lib/files";

const CONTENT_TYPES: Record<string, string> = {
  ".avif": "image/avif",
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".m4a": "audio/mp4",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".otf": "font/otf",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function isInsideDirectory(root: string, target: string) {
  const relative = path.relative(root, target);
  return relative.length > 0 && !relative.startsWith("..") && !path.isAbsolute(relative);
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ bookDir: string; assetPath: string[] }> },
) {
  const { bookDir, assetPath } = await params;
  const decodedDir = decodeURIComponent(bookDir);
  const resolvedDir = resolveBookDir(decodedDir);
  if (!resolvedDir) {
    return NextResponse.json({ error: "Book directory not found" }, { status: 404 });
  }

  const assetsRoot = path.resolve(resolvedDir, "epub-assets");
  const assetFile = path.resolve(assetsRoot, ...assetPath);
  if (!isInsideDirectory(assetsRoot, assetFile) || !fs.existsSync(assetFile)) {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  }

  const ext = path.extname(assetFile).toLowerCase();
  return new NextResponse(new Uint8Array(fs.readFileSync(assetFile)), {
    headers: {
      "Content-Type": CONTENT_TYPES[ext] ?? "application/octet-stream",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
