// input: 分享原文、想法、书籍信息、模板与比例
// output: 安全 SVG、PNG Blob 与本地文件名
// pos: 阅读器分享卡片的纯生成层

export type ShareTemplate = 'paper' | 'editorial' | 'ink';
export type ShareRatio = 'landscape' | 'portrait';
export interface ShareContent { quote: string; thought: string; bookTitle: string; author: string; chapter: string; }
export interface ShareCardOptions { template: ShareTemplate; ratio: ShareRatio; includeThought: boolean; watermark: boolean; }

function graphemes(value: string) {
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
    return Array.from(segmenter.segment(value), (item) => item.segment);
  }
  return Array.from(value);
}

export function truncateShareText(value: string, limit: number) {
  const chars = graphemes(value.trim());
  return chars.length <= limit ? chars.join('') : `${chars.slice(0, Math.max(0, limit - 1)).join('')}…`;
}

export function splitShareLines(value: string, lineCapacity: number, maxLines: number) {
  const paragraphs = value.trim().replace(/\r\n?/g, '\n').split('\n');
  const result: string[] = [];
  let truncated = false;
  for (const paragraph of paragraphs) {
    const chars = graphemes(paragraph);
    do {
      if (result.length >= maxLines) { truncated = true; break; }
      result.push(chars.splice(0, lineCapacity).join(''));
    } while (chars.length);
    if (chars.length || result.length >= maxLines && paragraph !== paragraphs[paragraphs.length - 1]) truncated = true;
    if (truncated) break;
  }
  if (truncated && result.length) {
    const last = graphemes(result[result.length - 1]);
    result[result.length - 1] = `${last.slice(0, Math.max(0, lineCapacity - 1)).join('')}…`;
  }
  return result;
}

function esc(value: string) { return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]!); }
function textLines(lines: string[], x: number, y: number, lineHeight: number) { return `<text x="${x}" y="${y}">${lines.map((line, i) => `<tspan x="${x}" dy="${i ? lineHeight : 0}">${esc(line)}</tspan>`).join('')}</text>`; }
function watermark(width: number, height: number, enabled: boolean, color: string) { return enabled ? `<text data-role="watermark" x="${width - 64}" y="${height - 42}" text-anchor="end" fill="${color}" font-size="18" font-family="Arial, sans-serif">ReadPilot</text>` : ''; }

function paper(content: ShareContent, options: ShareCardOptions, width: number, height: number, portrait: boolean) {
  const quote = splitShareLines(content.quote, portrait ? 18 : 31, options.includeThought && content.thought ? (portrait ? 9 : 5) : (portrait ? 10 : 6));
  const thought = splitShareLines(content.thought, portrait ? 24 : 38, portrait ? 5 : 3);
  const x = portrait ? 122 : 172, y = portrait ? 290 : 165;
  return `<g data-template="paper"><rect width="100%" height="100%" fill="#F7F0E5"/><rect data-role="paper-anchor" x="${portrait ? 76 : 108}" y="${portrait ? 208 : 105}" width="8" height="96" fill="#D94F30"/><g fill="#292521" font-size="${portrait ? 54 : 42}" font-family="Georgia, serif">${textLines(quote, x, y, portrait ? 86 : 68)}</g>${options.includeThought && content.thought ? `<line x1="${x}" y1="${portrait ? 1020 : 485}" x2="${width - x}" y2="${portrait ? 1020 : 485}" stroke="#D8CCBC"/><g fill="#756B62" font-size="25" font-family="Arial, sans-serif">${textLines(thought, x, portrait ? 1080 : 530, 38)}</g>` : ''}<g data-role="footer-meta" font-family="Arial, sans-serif"><text x="${portrait ? 76 : 108}" y="${height - 82}" fill="#292521" font-size="24">${esc(truncateShareText(content.bookTitle, 42))}</text><text x="${portrait ? 76 : 108}" y="${height - 48}" fill="#756B62" font-size="18">${esc([content.author, content.chapter].filter(Boolean).join(' · '))}</text></g>${watermark(width, height, options.watermark, '#756B62')}</g>`;
}

function editorial(content: ShareContent, options: ShareCardOptions, width: number, height: number, portrait: boolean) {
  const quote = splitShareLines(content.quote, portrait ? 18 : 22, portrait ? 9 : 6);
  const thought = splitShareLines(content.thought, portrait ? 25 : 24, portrait ? 4 : 3);
  const quoteX = portrait ? 92 : 450;
  return `<g data-template="editorial" data-layout="${portrait ? 'portrait-masthead' : 'columns-34-66'}"><rect width="100%" height="100%" fill="#FBF8F2"/><rect x="0" y="0" width="${portrait ? width : 408}" height="${portrait ? 175 : height}" fill="#171717"/><text x="${portrait ? 76 : 58}" y="${portrait ? 74 : 92}" fill="#FBF8F2" font-size="22" font-family="Arial">READPILOT / EDITION</text><text x="${portrait ? 76 : 58}" y="${portrait ? 128 : 150}" fill="#D94F30" font-size="18" font-family="Arial">BOOK</text><text x="${portrait ? 170 : 58}" y="${portrait ? 128 : 188}" fill="#FBF8F2" font-size="22" font-family="Arial">${esc(truncateShareText(content.bookTitle, 24))}</text><text x="${portrait ? 590 : 58}" y="${portrait ? 128 : 244}" fill="#D94F30" font-size="18" font-family="Arial">AUTHOR</text><text x="${portrait ? 720 : 58}" y="${portrait ? 128 : 282}" fill="#FBF8F2" font-size="20" font-family="Arial">${esc(truncateShareText(content.author, 20))}</text><line x1="408" y1="0" x2="408" y2="${height}" stroke="#D94F30" stroke-width="3"/><g fill="#171717" font-size="${portrait ? 50 : 39}" font-family="Georgia, serif">${textLines(quote, quoteX, portrait ? 300 : 135, portrait ? 78 : 61)}</g>${options.includeThought && content.thought ? `<g data-role="editorial-note"><rect x="${portrait ? 76 : 438}" y="${portrait ? 1035 : 485}" width="${portrait ? 928 : 700}" height="${portrait ? 250 : 145}" fill="#EEE8DE"/><text x="${portrait ? 108 : 466}" y="${portrait ? 1082 : 525}" fill="#D94F30" font-size="17" font-family="Arial">NOTE</text><g fill="#817A72" font-size="23" font-family="Arial">${textLines(thought, portrait ? 108 : 540, portrait ? 1130 : 525, 34)}</g></g>` : ''}${watermark(width, height, options.watermark, '#817A72')}</g>`;
}

function ink(content: ShareContent, options: ShareCardOptions, width: number, height: number, portrait: boolean) {
  const quote = splitShareLines(content.quote, portrait ? 18 : 29, options.includeThought && content.thought ? (portrait ? 9 : 5) : (portrait ? 10 : 6));
  const thought = splitShareLines(content.thought, portrait ? 23 : 37, portrait ? 5 : 3);
  const x = portrait ? 126 : 176;
  return `<g data-template="ink"><rect width="100%" height="100%" fill="#171513"/><rect x="${portrait ? 58 : 88}" y="${portrait ? 150 : 72}" width="${width - (portrait ? 116 : 176)}" height="${height - (portrait ? 300 : 144)}" fill="#1B1816"/><rect x="${portrait ? 92 : 126}" y="${portrait ? 225 : 120}" width="5" height="120" fill="#E25A3B"/><g fill="#F4EEE5" font-size="${portrait ? 52 : 41}" font-family="Georgia, serif">${textLines(quote, x, portrait ? 300 : 165, portrait ? 82 : 65)}</g>${options.includeThought && content.thought ? `<g data-role="ink-thought"><rect x="${portrait ? 92 : 126}" y="${portrait ? 1030 : 475}" width="${portrait ? 896 : 948}" height="${portrait ? 230 : 135}" fill="#211E1B"/><g fill="#B8AEA3" font-size="24" font-family="Arial">${textLines(thought, portrait ? 126 : 162, portrait ? 1080 : 520, 36)}</g></g>` : ''}<text x="${portrait ? 92 : 126}" y="${height - 60}" fill="#B8AEA3" font-size="20" font-family="Arial">${esc([content.bookTitle, content.author, content.chapter].filter(Boolean).join(' / '))}</text>${watermark(width, height, options.watermark, '#B8AEA3')}</g>`;
}

function paperPortrait(content: ShareContent, options: ShareCardOptions) {
  const quote = splitShareLines(content.quote, 18, options.includeThought && content.thought ? 9 : 10);
  const thought = splitShareLines(content.thought, 24, 5);
  return `<g data-template="paper"><rect width="1080" height="1440" fill="#F7F0E5"/><rect data-role="paper-anchor" x="76" y="208" width="8" height="96" fill="#D94F30"/><g fill="#292521" font-size="54" font-family="Georgia, serif">${textLines(quote, 122, 290, 86)}</g>${options.includeThought && content.thought ? `<line x1="122" y1="1020" x2="958" y2="1020" stroke="#D8CCBC"/><g fill="#756B62" font-size="25" font-family="Arial">${textLines(thought, 122, 1080, 38)}</g>` : ''}<text data-role="portrait-title" x="76" y="1310" fill="#292521" font-size="24">${esc(truncateShareText(content.bookTitle, 30))}</text><text data-role="portrait-detail" x="76" y="1355" fill="#756B62" font-size="18">${esc([truncateShareText(content.author, 18), truncateShareText(content.chapter, 18)].filter(Boolean).join(' · '))}</text>${options.watermark ? '<text data-role="watermark" x="1016" y="1410" text-anchor="end" fill="#756B62" font-size="18">ReadPilot</text>' : ''}</g>`;
}

function editorialPortrait(content: ShareContent, options: ShareCardOptions) {
  const quote = splitShareLines(content.quote, 18, 9);
  const thought = splitShareLines(content.thought, 25, 4);
  return `<g data-template="editorial" data-layout="portrait-masthead"><rect width="1080" height="1440" fill="#FBF8F2"/><rect width="1080" height="175" fill="#171717"/><text data-role="portrait-title" x="76" y="74" fill="#FBF8F2" font-size="22">READPILOT / EDITION</text><text x="76" y="128" fill="#D94F30" font-size="18">BOOK</text><text data-role="editorial-book" x="170" y="128" fill="#FBF8F2" font-size="22">${esc(truncateShareText(content.bookTitle, 18))}</text><text x="590" y="128" fill="#D94F30" font-size="18">AUTHOR</text><text data-role="editorial-author" x="720" y="128" fill="#FBF8F2" font-size="20">${esc(truncateShareText(content.author, 15))}</text><line data-role="masthead-rule" x1="76" y1="175" x2="1004" y2="175" stroke="#D94F30" stroke-width="3"/><g fill="#171717" font-size="50" font-family="Georgia, serif">${textLines(quote, 92, 300, 78)}</g>${options.includeThought && content.thought ? `<g data-role="editorial-note"><rect x="76" y="1035" width="928" height="250" fill="#EEE8DE"/><text x="108" y="1082" fill="#D94F30" font-size="17">NOTE</text><g fill="#817A72" font-size="23">${textLines(thought, 108, 1130, 34)}</g></g>` : ''}<text data-role="portrait-detail" x="76" y="1355" fill="#817A72" font-size="18">${esc(truncateShareText(content.chapter, 24))}</text>${options.watermark ? '<text data-role="watermark" x="1016" y="1410" text-anchor="end" fill="#817A72" font-size="18">ReadPilot</text>' : ''}</g>`;
}

function inkPortrait(content: ShareContent, options: ShareCardOptions) {
  const quote = splitShareLines(content.quote, 18, options.includeThought && content.thought ? 9 : 10);
  const thought = splitShareLines(content.thought, 23, 5);
  return `<g data-template="ink"><rect width="1080" height="1440" fill="#171513"/><rect x="58" y="150" width="964" height="1140" fill="#1B1816"/><rect x="92" y="225" width="5" height="120" fill="#E25A3B"/><g fill="#F4EEE5" font-size="52" font-family="Georgia, serif">${textLines(quote, 126, 300, 82)}</g>${options.includeThought && content.thought ? `<g data-role="ink-thought"><rect x="92" y="1030" width="896" height="230" fill="#211E1B"/><g fill="#B8AEA3" font-size="24">${textLines(thought, 126, 1080, 36)}</g></g>` : ''}<text data-role="portrait-title" x="92" y="1310" fill="#F4EEE5" font-size="20">${esc(truncateShareText(content.bookTitle, 24))}</text><text data-role="portrait-detail" x="92" y="1355" fill="#B8AEA3" font-size="18">${esc([truncateShareText(content.author, 16), truncateShareText(content.chapter, 16)].filter(Boolean).join(' / '))}</text>${options.watermark ? '<text data-role="watermark" x="1016" y="1410" text-anchor="end" fill="#B8AEA3" font-size="18">ReadPilot</text>' : ''}</g>`;
}

export function buildShareSvg(content: ShareContent, options: ShareCardOptions) {
  const portrait = options.ratio === 'portrait'; const [width, height] = portrait ? [1080, 1440] : [1200, 675];
  const safeContent = { ...content, bookTitle: truncateShareText(content.bookTitle, 28), author: truncateShareText(content.author, 18), chapter: truncateShareText(content.chapter, 18) };
  const rawBody = portrait
    ? options.template === 'paper' ? paperPortrait(content, options) : options.template === 'editorial' ? editorialPortrait(content, options) : inkPortrait(content, options)
    : options.template === 'paper' ? paper(safeContent, options, width, height, false) : options.template === 'editorial' ? editorial(safeContent, options, width, height, false) : ink(safeContent, options, width, height, false);
  const geometry = options.template === 'paper'
    ? { bottom: portrait ? 978 : 437, thought: portrait ? 1020 : 485 }
    : options.template === 'editorial' ? { bottom: portrait ? 924 : 440, thought: portrait ? 1035 : 485 }
    : { bottom: portrait ? 956 : 425, thought: portrait ? 1030 : 475 };
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><g data-quote-bottom="${geometry.bottom}" data-thought-top="${geometry.thought}">${rawBody}</g></svg>`;
}

export interface RasterEnvironment {
  createObjectURL(blob: Blob): string; revokeObjectURL(url: string): void;
  createImage(): { src: string; naturalWidth: number; naturalHeight: number; decode?: () => Promise<void>; onload?: (() => void) | null; onerror?: (() => void) | null };
  createCanvas(): { width: number; height: number; getContext(type: '2d'): CanvasRenderingContext2D | null; toBlob(callback: (blob: Blob | null) => void, type: string): void };
}
export async function svgToPngBlob(svg: string, environment?: RasterEnvironment): Promise<Blob> {
  const env = environment ?? { createObjectURL: URL.createObjectURL.bind(URL), revokeObjectURL: URL.revokeObjectURL.bind(URL), createImage: () => new Image(), createCanvas: () => document.createElement('canvas') };
  const source = env.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const image = env.createImage();
    if (image.decode) { image.src = source; await image.decode(); }
    else await new Promise<void>((resolve, reject) => { image.onload = resolve; image.onerror = () => reject(new Error('SVG 图片加载失败')); image.src = source; });
    if (!image.naturalWidth || !image.naturalHeight) throw new Error('SVG 图片尺寸无效');
    const canvas = env.createCanvas(); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d'); if (!context) throw new Error('无法创建 Canvas'); context.drawImage(image as CanvasImageSource, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png')); if (!blob) throw new Error('无法生成 PNG'); return blob;
  } finally { env.revokeObjectURL(source); }
}

export function shareFileName(bookTitle: string, date = new Date()) {
  let safe = bookTitle.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '').replace(/[. ]+$/g, '').trim();
  if (/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i.test(safe)) safe = '';
  safe = safe || '摘录';
  const stamp = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  return `ReadPilot-${safe}-${stamp}.png`;
}
