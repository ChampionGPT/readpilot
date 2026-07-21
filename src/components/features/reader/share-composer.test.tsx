// input: ShareComposer、SVG 纯函数与可注入的分享能力
// output: 模板/比例/内容控制、安全 SVG 与降级动作断言
// pos: 测试层 — 本地分享卡片的行为契约

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ShareComposer } from './ShareComposer';
import { buildShareSvg, shareFileName, splitShareLines, svgToPngBlob, truncateShareText } from './share-card';

const content = { quote: '<script>alert(1)</script> 这是原文', thought: '我的想法', bookTitle: '测试书', author: '作者', chapter: '第一章' };

describe('share card SVG', () => {
  it('切换模板和比例会改变 SVG 外观与尺寸', () => {
    const paper = buildShareSvg(content, { template: 'paper', ratio: 'landscape', includeThought: true, watermark: true });
    const editorial = buildShareSvg(content, { template: 'editorial', ratio: 'landscape', includeThought: true, watermark: true });
    expect(paper).toContain('data-template="paper"');
    expect(paper).toContain('data-role="paper-anchor"');
    expect(paper).toContain('data-role="footer-meta"');
    expect(editorial).toContain('data-layout="columns-34-66"');
    expect(editorial).toContain('x1="408"');
    expect(editorial).toContain('>BOOK<');
    expect(editorial).toContain('>AUTHOR<');
    expect(editorial).toContain('>NOTE<');
    expect(buildShareSvg(content, { template: 'ink', ratio: 'portrait', includeThought: true, watermark: true })).toContain('width="1080" height="1440"');
    expect(buildShareSvg(content, { template: 'ink', ratio: 'portrait', includeThought: true, watermark: true })).toContain('data-role="ink-thought"');
  });

  it('转义 SVG 文本并按比例截断长内容', () => {
    const svg = buildShareSvg(content, { template: 'paper', ratio: 'landscape', includeThought: true, watermark: true });
    expect(svg).not.toContain('<script>');
    expect(svg).toContain('&lt;script&gt;');
    expect(truncateShareText('字'.repeat(200), 120)).toBe(`${'字'.repeat(119)}…`);
  });

  it('按 grapheme 和实际行容量截断 ZWJ、组合字符、换行与极长文本', () => {
    expect(truncateShareText('👨‍👩‍👧‍👦'.repeat(3), 2)).toBe('👨‍👩‍👧‍👦…');
    expect(truncateShareText('e\u0301e\u0301', 2)).toBe('e\u0301e\u0301');
    expect(splitShareLines('甲乙\n丙丁戊', 2, 2)).toEqual(['甲乙', '丙…']);
    const svg = buildShareSvg({ ...content, quote: '极'.repeat(5000) }, { template: 'paper', ratio: 'landscape', includeThought: false, watermark: false });
    expect((svg.match(/<tspan/g) || []).length).toBeLessThanOrEqual(6);
    expect(svg).toContain('…');
  });

  it.each(['paper', 'editorial', 'ink'] as const)('%s 满容量 quote+thought 不越过想法区且元信息按列宽省略', (template) => {
    const svg = buildShareSvg({ quote: '原'.repeat(5000), thought: '想'.repeat(2000), bookTitle: '书'.repeat(200), author: '作'.repeat(200), chapter: '章'.repeat(200) }, { template, ratio: 'landscape', includeThought: true, watermark: true });
    const bottom = Number(svg.match(/data-quote-bottom="(\d+)"/)?.[1]);
    const thoughtTop = Number(svg.match(/data-thought-top="(\d+)"/)?.[1]);
    expect(bottom).toBeLessThan(thoughtTop);
    expect(svg).toContain('…');
    expect(svg).not.toContain('书'.repeat(80));
  });

  it('过滤 XML 1.0 非法控制字符', () => {
    const svg = buildShareSvg({ ...content, quote: '合法\u0001文本\u000B' }, { template: 'paper', ratio: 'landscape', includeThought: false, watermark: false });
    expect(svg).not.toContain('\u0001');
    expect(svg).not.toContain('\u000B');
    expect(svg).toContain('合法文本');
  });

  it.each(['paper', 'editorial', 'ink'] as const)('%s portrait 元信息与水印使用独立安全区', (template) => {
    const svg = buildShareSvg({ quote: '原文', thought: '', bookTitle: 'Long English Book Title '.repeat(8) + '中文书名'.repeat(20), author: 'Very Long Author 作者名字'.repeat(10), chapter: 'Chapter 123 超长章节'.repeat(10) }, { template, ratio: 'portrait', includeThought: false, watermark: true });
    const titleY = Number(svg.match(/data-role="portrait-title"[^>]*y="(\d+)"/)?.[1]);
    const detailY = Number(svg.match(/data-role="portrait-detail"[^>]*y="(\d+)"/)?.[1]);
    const watermarkY = Number(svg.match(/data-role="watermark"[^>]*y="(\d+)"/)?.[1]);
    expect(detailY - titleY).toBeGreaterThanOrEqual(40);
    expect(watermarkY - detailY).toBeGreaterThanOrEqual(40);
    expect(svg).toContain('…');
  });

  it('editorial portrait BOOK 文本不侵入 AUTHOR 列', () => {
    const svg = buildShareSvg({ ...content, bookTitle: '全角书名'.repeat(30), author: '作者'.repeat(30) }, { template: 'editorial', ratio: 'portrait', includeThought: false, watermark: true });
    const book = svg.match(/data-role="editorial-book"[^>]*x="170"[^>]*>(.*?)<\/text>/)?.[1] || '';
    expect(Array.from(book).length).toBeLessThanOrEqual(18);
    expect(book).toContain('…');
    expect(svg).toContain('data-role="editorial-author" x="720"');
    expect(590 - 170).toBeGreaterThanOrEqual(400);
  });

  it('editorial portrait 使用报头底线而非 x=408 贯穿分栏线', () => {
    const svg = buildShareSvg(content, { template: 'editorial', ratio: 'portrait', includeThought: true, watermark: true });
    expect(svg).toContain('data-role="masthead-rule"');
    expect(svg).not.toContain('x1="408" y1="0" x2="408" y2="1440"');
  });

  it.each(['CON', 'prn.', 'AUX ', 'NUL', 'COM1', 'lpt9'])('规避 Windows 保留文件名 %s', (title) => {
    expect(shareFileName(title, new Date(2026, 6, 19))).toBe('ReadPilot-摘录-20260719.png');
  });

  it('内容开关可以移除想法和水印', () => {
    const svg = buildShareSvg(content, { template: 'editorial', ratio: 'landscape', includeThought: false, watermark: false });
    expect(svg).not.toContain('我的想法');
    expect(svg).not.toContain('ReadPilot');
  });
});

describe('ShareComposer', () => {
  it('支持模板、比例、内容开关和可编辑想法', () => {
    render(<ShareComposer open onClose={() => {}} content={content} />);
    fireEvent.click(screen.getByRole('radio', { name: '墨迹' }));
    fireEvent.click(screen.getByRole('radio', { name: /竖版/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: '附上想法' }));
    fireEvent.change(screen.getByLabelText('想法内容'), { target: { value: '更新后的想法' } });
    const preview = decodeURIComponent(screen.getByTestId('share-preview').getAttribute('src')!);
    expect(preview).toContain('#171513');
    expect(preview).toContain('width="1080"');
    expect(preview).not.toContain('更新后的想法');
  });

  it('复制原文使用文本剪贴板并显示状态', async () => {
    const copyText = vi.fn().mockResolvedValue(undefined);
    render(<ShareComposer open onClose={() => {}} content={content} capabilities={{ copyText }} />);
    fireEvent.click(screen.getByRole('button', { name: '复制原文' }));
    expect(copyText).toHaveBeenCalledWith(expect.stringContaining('这是原文'));
    await waitFor(() => expect(screen.getAllByRole('status').some((node) => node.textContent?.includes('已复制原文'))).toBe(true));
  });

  it('图片能力不可用时隐藏图片动作并保留复制原文降级', () => {
    render(<ShareComposer open onClose={() => {}} content={content} capabilities={{ copyText: vi.fn() }} />);
    expect(screen.queryByRole('button', { name: '系统分享' })).toBeNull();
    expect(screen.queryByRole('button', { name: '复制图片' })).toBeNull();
    expect(screen.queryByRole('button', { name: '保存 PNG' })).toBeNull();
    expect(screen.getByRole('button', { name: '复制原文' })).not.toBeNull();
  });

  it('保存 PNG 使用可控栅格化结果和安全文件名', async () => {
    const blob = new Blob(['png'], { type: 'image/png' });
    const download = vi.fn();
    render(<ShareComposer open onClose={() => {}} content={content} capabilities={{ rasterize: vi.fn().mockResolvedValue(blob), download, copyText: vi.fn() }} />);
    await waitFor(() => expect(screen.getByRole('button', { name: '保存 PNG' }).hasAttribute('disabled')).toBe(false));
    fireEvent.click(screen.getByRole('button', { name: '保存 PNG' }));
    await waitFor(() => expect(download).toHaveBeenCalledWith(blob, expect.stringMatching(/^ReadPilot-测试书-\d{8}\.png$/)));
  });

  it('系统分享失败时显示 alert，仍保留下载与文本降级', async () => {
    const blob = new Blob(['png'], { type: 'image/png' });
    render(<ShareComposer open onClose={() => {}} content={content} capabilities={{
      rasterize: vi.fn().mockResolvedValue(blob),
      shareFile: vi.fn().mockRejectedValue(new Error('分享不可用')),
      download: vi.fn(),
      copyText: vi.fn(),
    }} />);
    await waitFor(() => expect(screen.getByRole('button', { name: '系统分享' }).hasAttribute('disabled')).toBe(false));
    fireEvent.click(screen.getByRole('button', { name: '系统分享' }));
    expect((await screen.findByRole('alert')).textContent).toContain('系统分享失败');
  });

  it('预生成并缓存 PNG，点击系统分享不再次栅格化', async () => {
    const blob = new Blob(['png'], { type: 'image/png' });
    const rasterize = vi.fn().mockResolvedValue(blob);
    const shareFile = vi.fn().mockResolvedValue(undefined);
    render(<ShareComposer open onClose={() => {}} content={content} capabilities={{ rasterize, shareFile, copyText: vi.fn() }} />);
    await waitFor(() => expect(rasterize).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByRole('button', { name: '系统分享' }).hasAttribute('disabled')).toBe(false));
    fireEvent.click(screen.getByRole('button', { name: '系统分享' }));
    await waitFor(() => expect(shareFile).toHaveBeenCalledTimes(1));
    expect(rasterize).toHaveBeenCalledTimes(1);
  });

  it('系统分享失败显示 alert 且不自动调用 clipboard/download/text', async () => {
    const blob = new Blob(['png'], { type: 'image/png' });
    const calls: string[] = [];
    render(<ShareComposer open onClose={() => {}} content={content} capabilities={{
      rasterize: vi.fn().mockResolvedValue(blob),
      shareFile: vi.fn(async () => { calls.push('share'); throw new Error('no'); }),
      copyImage: vi.fn(async () => { calls.push('clipboard'); throw new Error('no'); }),
      download: vi.fn(() => { calls.push('download'); throw new Error('no'); }),
      copyText: vi.fn(async () => { calls.push('text'); }),
    }} />);
    await waitFor(() => expect(screen.getByRole('button', { name: '系统分享' }).hasAttribute('disabled')).toBe(false));
    fireEvent.click(screen.getByRole('button', { name: '系统分享' }));
    expect((await screen.findByRole('alert')).textContent).toContain('系统分享失败');
    expect(calls).toEqual(['share']);
  });

  it('AbortError 静默取消且不继续 fallback', async () => {
    const copyImage = vi.fn();
    render(<ShareComposer open onClose={() => {}} content={content} capabilities={{ rasterize: vi.fn().mockResolvedValue(new Blob()), shareFile: vi.fn().mockRejectedValue(new DOMException('cancel', 'AbortError')), copyImage, copyText: vi.fn() }} />);
    await waitFor(() => expect(screen.getByRole('button', { name: '系统分享' }).hasAttribute('disabled')).toBe(false));
    fireEvent.click(screen.getByRole('button', { name: '系统分享' }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(copyImage).not.toHaveBeenCalled();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('新 content 会同步 thought 与附上想法', () => {
    const { rerender } = render(<ShareComposer open onClose={() => {}} content={content} capabilities={{ copyText: vi.fn() }} />);
    rerender(<ShareComposer open onClose={() => {}} content={{ ...content, quote: '新原文', thought: '' }} capabilities={{ copyText: vi.fn() }} />);
    expect((screen.getByLabelText('想法内容') as HTMLTextAreaElement).value).toBe('');
    expect((screen.getByRole('checkbox', { name: '附上想法' }) as HTMLInputElement).checked).toBe(false);
  });

  it('管理焦点、Escape、overlay close 与焦点返回', () => {
    const opener = document.createElement('button'); document.body.appendChild(opener); opener.focus();
    const onClose = vi.fn();
    const { unmount } = render(<ShareComposer open onClose={onClose} content={content} capabilities={{ copyText: vi.fn() }} />);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '关闭' }));
    fireEvent.keyDown(window, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '复制原文' }));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
    fireEvent.mouseDown(screen.getByTestId('share-overlay'));
    expect(onClose).toHaveBeenCalledTimes(2);
    unmount(); expect(document.activeElement).toBe(opener); opener.remove();
  });

  it('预览与双栏容器限制溢出并使用 object-contain', () => {
    render(<ShareComposer open onClose={() => {}} content={content} capabilities={{ copyText: vi.fn() }} />);
    expect(screen.getByRole('dialog').className).toContain('min-w-0');
    expect(screen.getByTestId('preview-stage').className).toContain('overflow-hidden');
    expect(screen.getByTestId('share-preview').className).toContain('object-contain');
  });

  it('快速切换只接受最后一次 PNG 生成结果', async () => {
    const pending: Array<(blob: Blob) => void> = [];
    const rasterize = vi.fn(() => new Promise<Blob>((resolve) => pending.push(resolve)));
    const download = vi.fn();
    render(<ShareComposer open onClose={() => {}} content={content} capabilities={{ rasterize, download, copyText: vi.fn() }} />);
    await waitFor(() => expect(rasterize).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('radio', { name: '墨迹' }));
    await waitFor(() => expect(rasterize).toHaveBeenCalledTimes(2));
    const oldBlob = new Blob(['old']); const latestBlob = new Blob(['latest']);
    pending[0](oldBlob); pending[pending.length - 1](latestBlob);
    await waitFor(() => expect(screen.getByRole('button', { name: '保存 PNG' }).hasAttribute('disabled')).toBe(false));
    fireEvent.click(screen.getByRole('button', { name: '保存 PNG' }));
    await waitFor(() => expect(download).toHaveBeenCalledWith(latestBlob, expect.any(String)));
  });

  it('切换模板后旧 blob 保留但导出按钮禁用，直到当前版本 ready', async () => {
    const pending: Array<(blob: Blob) => void> = [];
    const rasterize = vi.fn(() => new Promise<Blob>((resolve) => pending.push(resolve)));
    render(<ShareComposer open onClose={() => {}} content={content} capabilities={{ rasterize, download: vi.fn(), copyText: vi.fn() }} />);
    await waitFor(() => expect(rasterize).toHaveBeenCalledTimes(1)); pending[0](new Blob(['paper']));
    await waitFor(() => expect(screen.getByRole('button', { name: '保存 PNG' }).hasAttribute('disabled')).toBe(false));
    fireEvent.click(screen.getByRole('radio', { name: '墨迹' }));
    expect(screen.getByRole('button', { name: '保存 PNG' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('status').textContent).toContain('正在更新图片');
    await waitFor(() => expect(rasterize).toHaveBeenCalledTimes(2)); pending[1](new Blob(['ink']));
    await waitFor(() => expect(screen.getByRole('button', { name: '保存 PNG' }).hasAttribute('disabled')).toBe(false));
  });

  it('移动短屏结构具备 min-h-0、设置滚动和 sticky 底栏', () => {
    render(<ShareComposer open onClose={() => {}} content={content} capabilities={{ copyText: vi.fn() }} />);
    expect(screen.getByTestId('composer-grid').className).toContain('min-h-0');
    expect(screen.getByTestId('settings-panel').className).toContain('overflow-y-auto');
    expect(screen.getByTestId('composer-actions').className).toContain('sticky');
  });
});

describe('svgToPngBlob', () => {
  const svg = '<svg width="10" height="10" />';
  it.each([
    ['decode', { decode: vi.fn().mockRejectedValue(new Error('decode')), width: 10, height: 10, context: {}, blob: new Blob() }],
    ['zero size', { decode: vi.fn().mockResolvedValue(undefined), width: 0, height: 10, context: {}, blob: new Blob() }],
    ['null context', { decode: vi.fn().mockResolvedValue(undefined), width: 10, height: 10, context: null, blob: new Blob() }],
    ['null blob', { decode: vi.fn().mockResolvedValue(undefined), width: 10, height: 10, context: {}, blob: null }],
  ])('throws on %s and revokes object URL', async (_name, setup) => {
    const revoke = vi.fn();
    await expect(svgToPngBlob(svg, {
      createObjectURL: () => 'blob:test', revokeObjectURL: revoke,
      createImage: () => ({ decode: setup.decode, naturalWidth: setup.width, naturalHeight: setup.height, set src(_value: string) {} }),
      createCanvas: () => ({ width: 0, height: 0, getContext: () => setup.context as CanvasRenderingContext2D | null, toBlob: (cb) => cb(setup.blob) }),
    })).rejects.toThrow();
    expect(revoke).toHaveBeenCalledWith('blob:test');
  });

  it('rejects image onerror and revokes object URL', async () => {
    const revoke = vi.fn();
    await expect(svgToPngBlob(svg, {
      createObjectURL: () => 'blob:error', revokeObjectURL: revoke,
      createImage: () => ({ naturalWidth: 10, naturalHeight: 10, set src(_value: string) { queueMicrotask(() => this.onerror?.()); }, onerror: null, onload: null }),
      createCanvas: () => ({ width: 0, height: 0, getContext: () => null, toBlob: () => {} }),
    })).rejects.toThrow('SVG 图片加载失败');
    expect(revoke).toHaveBeenCalledWith('blob:error');
  });
});
