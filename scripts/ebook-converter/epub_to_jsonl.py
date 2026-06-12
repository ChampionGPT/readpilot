#!/usr/bin/env python3
"""
epub-to-jsonl：EPUB 電子書轉 JSONL

用法：
  python3 epub_to_jsonl.py <input.epub>
  python3 epub_to_jsonl.py <input.epub> <output.jsonl>
  python3 epub_to_jsonl.py <input.epub> --chunk-size 800

輸出 schema 相容 rag-to-skill（item_index / chunk_index / chapter / text）。

依賴：
  pip install ebooklib beautifulsoup4
"""

import sys, json, re, argparse, posixpath
from pathlib import Path
from urllib.parse import quote

try:
    import ebooklib
    from ebooklib import epub
except ImportError:
    sys.exit("缺少 ebooklib，請執行：pip install ebooklib")

try:
    from bs4 import BeautifulSoup, NavigableString
except ImportError:
    sys.exit("缺少 beautifulsoup4，請執行：pip install beautifulsoup4")


# ── 預設切塊大小 ─────────────────────────────────────────────────────────────

DEFAULT_CHUNK_SIZE = 500   # 字元數（中文約 250 字 / 英文約 80-100 字）


# ── HTML → 段落 ───────────────────────────────────────────────────────────────

READPILOT_BOOK_DIR = "__READPILOT_BOOK_DIR__"


def item_name(item):
    getter = getattr(item, "get_name", None)
    name = getattr(item, "file_name", "") or (getter() if getter else "")
    return str(name).replace("\\", "/")


def safe_rel_path(name):
    parts = []
    for part in str(name).replace("\\", "/").split("/"):
        if not part or part in (".", ".."):
            continue
        cleaned = re.sub(r'[<>:"\\|?*\x00-\x1F]', "_", part)
        if cleaned:
            parts.append(cleaned)
    return "/".join(parts) or "asset"


def asset_api_url(rel_path):
    encoded = "/".join(quote(part) for part in safe_rel_path(rel_path).split("/"))
    return f"/api/books/{READPILOT_BOOK_DIR}/assets/{encoded}"


def resolve_asset_ref(current_doc, ref):
    if not ref:
        return None
    value = str(ref).strip()
    if (
        value.startswith("#")
        or value.startswith("data:")
        or value.startswith("http://")
        or value.startswith("https://")
        or value.startswith("mailto:")
        or value.startswith("javascript:")
    ):
        return None
    path_part = re.split(r"[?#]", value, maxsplit=1)[0]
    if not path_part:
        return None
    joined = posixpath.normpath(posixpath.join(posixpath.dirname(current_doc), path_part))
    return safe_rel_path(joined)


def rewrite_resource_links(soup, current_doc):
    for tag in soup.find_all(["img", "image", "audio", "video", "source"]):
        for attr in ("src", "href", "xlink:href"):
            if tag.has_attr(attr):
                rel = resolve_asset_ref(current_doc, tag.get(attr))
                if rel:
                    tag[attr] = asset_api_url(rel)
    for tag in soup.find_all(srcset=True):
        rewritten = []
        for candidate in str(tag.get("srcset", "")).split(","):
            bits = candidate.strip().split()
            if not bits:
                continue
            rel = resolve_asset_ref(current_doc, bits[0])
            bits[0] = asset_api_url(rel) if rel else bits[0]
            rewritten.append(" ".join(bits))
        if rewritten:
            tag["srcset"] = ", ".join(rewritten)


def export_asset_items(book, assets_dir):
    assets_dir.mkdir(parents=True, exist_ok=True)
    for item in book.get_items():
        if item.get_type() == ebooklib.ITEM_DOCUMENT:
            continue
        name = safe_rel_path(item_name(item))
        target = assets_dir / name
        target.parent.mkdir(parents=True, exist_ok=True)
        try:
            target.write_bytes(item.get_content())
        except Exception:
            pass


def render_preserved_html(title, body_html):
    return f"""<!doctype html>
<html lang="zh">
<head><meta charset="utf-8"><title>{title}</title></head>
<body class="epub-chapter epub-original">
<article class="chapter">
<h1 class="chapter-title">{title}</h1>
<div class="chapter-body epub-original-body">
{body_html}
</div>
</article>
</body>
</html>
"""


def normalize_title_text(text):
    return re.sub(r"\s+", "", str(text or "")).strip().lower()


def same_title(a, b):
    left = normalize_title_text(a)
    right = normalize_title_text(b)
    return bool(left and right and left == right)


def first_meaningful_body_text(soup):
    root = soup.body or soup
    for el in root.find_all(["h1", "h2", "h3", "p", "li"], recursive=True):
        text = re.sub(r"\s+", " ", el.get_text(separator=" ", strip=True)).strip()
        if text and len(text) <= 80:
            return text
    return ""


def next_meaningful_child(container):
    for child in list(container.children):
        if isinstance(child, NavigableString):
            if child.strip():
                return child
            child.extract()
            continue

        text = child.get_text(separator=" ", strip=True) if hasattr(child, "get_text") else ""
        has_media = bool(getattr(child, "find", lambda *_: None)(["img", "svg", "table", "audio", "video"]))
        if not text and not has_media:
            child.decompose()
            continue
        return child
    return None


def remove_leading_duplicate_title(soup, title):
    """Remove the first body heading/paragraph when it duplicates the wrapper title."""
    root = soup.body or soup
    first = next_meaningful_child(root)
    if not first or isinstance(first, NavigableString):
        return
    if first.name not in ("h1", "h2", "h3", "p"):
        return
    if same_title(first.get_text(separator=" ", strip=True), title):
        first.decompose()


def write_preserved_pages(book, spine_items, html_dir, manifest_path):
    html_dir = Path(html_dir)
    html_dir.mkdir(parents=True, exist_ok=True)
    export_asset_items(book, html_dir.parent / "epub-assets")

    pages = []
    for idx, item in enumerate(spine_items):
        raw = item.get_content().decode("utf-8", errors="replace")
        soup = BeautifulSoup(raw, "html.parser")
        rewrite_resource_links(soup, item_name(item))
        chapter = extract_chapter_title(item, soup)
        remove_leading_duplicate_title(soup, chapter)
        body = soup.body.decode_contents() if soup.body else str(soup)
        safe_title = safe_rel_path(chapter).replace("/", "_")[:30] or "chapter"
        padded = str(idx + 1).zfill(2)
        file_name = f"chap_{padded}_{safe_title}.html"
        (html_dir / file_name).write_text(render_preserved_html(chapter, body), encoding="utf-8")
        pages.append({
            "title": chapter,
            "file": f"pages/{file_name}",
            "itemIndex": idx,
        })

    if manifest_path:
        Path(manifest_path).write_text(json.dumps({"pages": pages}, ensure_ascii=False, indent=2), encoding="utf-8")


def html_to_paragraphs(html_bytes):
    """將 HTML bytes 轉為 (soup, [段落文字]) 。"""
    html = html_bytes.decode("utf-8", errors="replace")
    soup = BeautifulSoup(html, "html.parser")

    # 移除不需要的節點
    for tag in soup(["script", "style", "img", "nav", "head", "figure"]):
        tag.decompose()

    blocks = []
    for el in soup.find_all(["p", "li", "h1", "h2", "h3", "h4", "h5",
                              "blockquote", "td", "th", "dd", "dt"]):
        text = el.get_text(separator=" ", strip=True)
        text = re.sub(r"\s+", " ", text).strip()
        if text:
            blocks.append(text)

    return soup, blocks


def extract_chapter_title(item, soup):
    """從 HTML 擷取標題，優先 h1 → h2 → h3 → item.title → 首段短文本 → 無標題。"""
    for tag in ["h1", "h2", "h3"]:
        el = soup.find(tag)
        if el:
            t = el.get_text(strip=True)
            if t:
                return t
    title = getattr(item, "title", "") or ""
    if title.strip():
        return title.strip()
    first_text = first_meaningful_body_text(soup)
    return first_text or "（無標題）"


def drop_leading_duplicate_block(blocks, chapter):
    if blocks and same_title(blocks[0], chapter):
        return blocks[1:]
    return blocks


# ── 切塊 ──────────────────────────────────────────────────────────────────────

def chunk_blocks(blocks, max_chars):
    """
    把段落列表合併成 chunks，每個 chunk ≤ max_chars。
    單一段落超長時按句子邊界拆開。
    """
    chunks = []
    buf, buf_len = [], 0

    def flush():
        nonlocal buf, buf_len
        text = "\n".join(buf).strip()
        if text:
            chunks.append(text)
        buf, buf_len = [], 0

    for block in blocks:
        if len(block) > max_chars:
            # 先 flush 現有緩衝
            if buf:
                flush()
            # 按句子邊界切超長段落
            sentences = re.split(r"(?<=[。！？.!?])\s*", block)
            s_buf, s_len = [], 0
            for sent in sentences:
                if s_len + len(sent) > max_chars and s_buf:
                    chunks.append("".join(s_buf).strip())
                    s_buf, s_len = [], 0
                s_buf.append(sent)
                s_len += len(sent)
            if s_buf:
                chunks.append("".join(s_buf).strip())
        else:
            # 加入緩衝
            if buf_len + len(block) + 1 > max_chars and buf:
                flush()
            buf.append(block)
            buf_len += len(block) + 1

    if buf:
        flush()

    return [c for c in chunks if c]


# ── 主轉換邏輯 ────────────────────────────────────────────────────────────────

def epub_to_jsonl(epub_path, output_path, chunk_size, verbose=True, html_dir=None, manifest_path=None):
    book = epub.read_epub(str(epub_path))

    # 書名
    meta_title = book.get_metadata("DC", "title")
    book_title = meta_title[0][0].strip() if meta_title else epub_path.stem

    # 依 spine 順序取 DOCUMENT items（保證閱讀順序）
    spine_items = []
    for spine_id, _linear in book.spine:
        item = book.get_item_with_id(spine_id)
        if item is not None and item.get_type() == ebooklib.ITEM_DOCUMENT:
            spine_items.append(item)

    # fallback：無 spine 資訊時直接取全部文件
    if not spine_items:
        spine_items = list(book.get_items_of_type(ebooklib.ITEM_DOCUMENT))

    if html_dir:
        write_preserved_pages(book, spine_items, html_dir, manifest_path)

    total_items = 0
    total_chunks = 0
    skipped = 0

    with open(output_path, "w", encoding="utf-8") as out:
        for item_index, item in enumerate(spine_items):
            soup, blocks = html_to_paragraphs(item.get_content())

            if not blocks:
                skipped += 1
                continue

            chapter = extract_chapter_title(item, soup)
            blocks = drop_leading_duplicate_block(blocks, chapter)
            chunks = chunk_blocks(blocks, chunk_size)

            if not chunks:
                skipped += 1
                continue

            for chunk_index, text in enumerate(chunks):
                record = {
                    "loc": {
                        "item_index": item_index,
                        "chunk_index": chunk_index,
                    },
                    "chapter": chapter,
                    "text": text,
                }
                out.write(json.dumps(record, ensure_ascii=False) + "\n")
                total_chunks += 1

            total_items += 1

    if verbose:
        print(f"書名     ：{book_title}")
        print(f"spine 項目：{len(spine_items)}（跳過空白 {skipped} 個）")
        print(f"有效章節  ：{total_items}")
        print(f"總 chunks ：{total_chunks}")
        print(f"輸出      ：{output_path}")

    return output_path


# ── CLI ───────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="EPUB → JSONL（rag-to-skill 相容格式）"
    )
    parser.add_argument("epub", type=Path, help="輸入 EPUB 檔案路徑")
    parser.add_argument(
        "output", type=Path, nargs="?", help="輸出 JSONL 路徑（預設：同目錄，副檔名改 .jsonl）"
    )
    parser.add_argument(
        "--chunk-size", type=int, default=DEFAULT_CHUNK_SIZE,
        metavar="N", help=f"每個 chunk 最大字元數（預設 {DEFAULT_CHUNK_SIZE}）"
    )
    parser.add_argument("--html-dir", type=Path, default=None)
    parser.add_argument("--manifest", type=Path, default=None)
    args = parser.parse_args()

    if not args.epub.exists():
        sys.exit(f"找不到檔案：{args.epub}")
    if args.epub.suffix.lower() != ".epub":
        sys.exit(f"不支援的檔案格式（需要 .epub）：{args.epub}")

    output = args.output or args.epub.with_suffix(".jsonl")
    epub_to_jsonl(args.epub, output, args.chunk_size, html_dir=args.html_dir, manifest_path=args.manifest)


if __name__ == "__main__":
    main()
