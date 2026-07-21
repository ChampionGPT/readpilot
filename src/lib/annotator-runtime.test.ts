// input: annotator iframe runtime、独立 happy-dom Window、正文 Selection 与 annotations API mock
// output: 工具栏动作保留并提交所选原文，且测试之间无全局 listener 污染
// pos: 测试层 — 验证 public/annotator/annotator.js 的选区与编辑状态生命周期

import fs from 'fs';
import path from 'path';
import { Window } from 'happy-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

const runtime = fs.readFileSync(path.join(process.cwd(), 'public/annotator/annotator.js'), 'utf8');
const windows: Window[] = [];

type FetchCall = [RequestInfo | URL, RequestInit?];

async function flushRuntime() {
  await new Promise((resolve) => setTimeout(resolve, 20));
}

async function setupRuntime(annotations: object[] = []) {
  const testWindow = new Window({ url: 'http://localhost/chapter.html' });
  windows.push(testWindow);
  const document = testWindow.document;
  document.body.innerHTML = '<main class="chapter-body"><p data-rp-block="p1">前文 这是被选中的原文 后文</p></main>';
  Object.defineProperty(testWindow, '__RP_ANNOT__', {
    configurable: true,
    value: { bookDir: 'demo-book', pageId: 'chapter-1' },
  });
  const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
    if (!init || init.method === 'GET') {
      return { ok: true, json: async () => ({ annotations }) } as Response;
    }
    return {
      ok: true,
      json: async () => init?.body ? ({ id: 'ann-1', ...(JSON.parse(String(init.body)) as object) }) : ({}),
    } as Response;
  });
  Object.defineProperty(testWindow, 'fetch', { configurable: true, value: fetchMock });
  testWindow.eval(runtime);
  document.dispatchEvent(new testWindow.Event('DOMContentLoaded'));
  await flushRuntime();
  return { testWindow, document, fetchMock };
}

function selectQuote(context: Awaited<ReturnType<typeof setupRuntime>>, quote: string) {
  const { document, testWindow } = context;
  const text = document.querySelector('[data-rp-block="p1"]')!.firstChild!;
  const start = text.textContent!.indexOf(quote);
  const range = document.createRange();
  range.setStart(text, start);
  range.setEnd(text, start + quote.length);
  Object.defineProperty(range, 'getBoundingClientRect', {
    value: () => ({ top: 100, bottom: 120, left: 50, width: 120 }),
  });
  const selection = testWindow.getSelection()!;
  selection.removeAllRanges();
  selection.addRange(range);
  document.dispatchEvent(new testWindow.MouseEvent('mouseup', { bubbles: true }));
}

function toolbarButton(context: Awaited<ReturnType<typeof setupRuntime>>, label: string) {
  return Array.from(context.document.querySelectorAll<HTMLButtonElement>('.rp-toolbar button'))
    .find((button) => button.textContent === label)!;
}

function postedBody(fetchMock: ReturnType<typeof vi.fn>) {
  const call = fetchMock.mock.calls.find(([, init]: FetchCall) => init?.method === 'POST') as FetchCall | undefined;
  return call ? JSON.parse(String(call[1]!.body)) : undefined;
}

afterEach(() => {
  windows.splice(0).forEach((testWindow) => testWindow.close());
});

describe('annotator selection runtime', () => {
  it('每次创建运行时都使用独立 document，避免残留 listener 污染', async () => {
    const first = await setupRuntime();
    const second = await setupRuntime();

    expect(first.document).not.toBe(second.document);
  });

  it('高亮会 POST 当前选中的原文', async () => {
    const context = await setupRuntime();
    selectQuote(context, '这是被选中的原文');
    await flushRuntime();

    toolbarButton(context, '高亮').click();
    Array.from(context.document.querySelectorAll<HTMLButtonElement>('.rp-panel button'))
      .find((button) => button.textContent === '高亮')!
      .click();
    await flushRuntime();

    expect(postedBody(context.fetchMock)?.quote).toBe('这是被选中的原文');
  });

  it.each([
    ['案例', 'case'],
    ['金句', 'quote'],
    ['疑问', 'question'],
    ['共鸣', 'resonance'],
    ['反对', 'objection'],
    ['行动', 'action'],
    ['洞察', 'insight'],
  ])('智能标记“%s”会保存 semanticType=%s 与选中的原文', async (label, semanticType) => {
    const context = await setupRuntime();
    selectQuote(context, '这是被选中的原文');
    await flushRuntime();

    toolbarButton(context, '标记').click();
    Array.from(context.document.querySelectorAll<HTMLButtonElement>('.rp-panel button'))
      .find((button) => button.textContent === label)!
      .click();
    await flushRuntime();

    expect(postedBody(context.fetchMock)).toMatchObject({
      quote: '这是被选中的原文',
      semanticType,
    });
  });

  it('问 AI 会发送非空的选中原文', async () => {
    const context = await setupRuntime();
    const postMessage = vi.spyOn(context.testWindow.parent, 'postMessage');
    selectQuote(context, '这是被选中的原文');
    await flushRuntime();

    toolbarButton(context, '问AI').click();

    expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({
      source: 'rp-annotator',
      type: 'rp-ask-ai',
      payload: expect.objectContaining({ quote: '这是被选中的原文' }),
    }), '*');
  });

  it('首层工具栏固定为高亮、想法、标记、复制、问AI、分享', async () => {
    const context = await setupRuntime();
    selectQuote(context, '这是被选中的原文');
    await flushRuntime();

    expect(Array.from(context.document.querySelectorAll('.rp-toolbar button')).map((button) => button.textContent))
      .toEqual(['高亮', '想法', '标记', '复制', '问AI', '分享']);
  });

  it('高亮二级面板收纳线型、颜色、无样式和删除', async () => {
    const context = await setupRuntime();
    selectQuote(context, '这是被选中的原文');
    await flushRuntime();

    toolbarButton(context, '高亮').click();

    const panel = Array.from(context.document.querySelectorAll('.rp-panel button'));
    expect(panel.map((button) => button.textContent)).toEqual(expect.arrayContaining(['直线', '波浪线', '高亮', '无样式']));
    expect(panel.filter((button) => button.querySelector('.rp-swatch'))).toHaveLength(4);
  });

  it('分享发送包含 quote/body/semanticType/pageId 的 rp-share', async () => {
    const context = await setupRuntime();
    const postMessage = vi.spyOn(context.testWindow.parent, 'postMessage');
    selectQuote(context, '这是被选中的原文');
    await flushRuntime();

    toolbarButton(context, '分享').click();

    expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({
      source: 'rp-annotator',
      type: 'rp-share',
      payload: {
        quote: '这是被选中的原文',
        body: '',
        semanticType: null,
        pageId: 'chapter-1',
      },
    }), '*');
  });

  it('已有标注点击后可从高亮面板 PATCH 样式并删除', async () => {
    const annotation = { id: 'ann-old', pageId: 'chapter-1', locator: { blockId: 'p1', startOffset: 3, endOffset: 12 }, quote: '这是被选中的原文', quotePrefix: '前文 ', quoteSuffix: ' 后文', visualStyle: 'highlight', color: 'yellow', semanticType: null, body: '' };
    const context = await setupRuntime([annotation]);
    const span = context.document.querySelector<HTMLElement>('[data-rp-ann="ann-old"]')!;
    Object.defineProperty(span, 'getBoundingClientRect', { value: () => ({ top: 100, bottom: 120, left: 50, width: 120 }) });
    span.click();
    toolbarButton(context, '高亮').click();
    Array.from(context.document.querySelectorAll<HTMLButtonElement>('.rp-panel button')).find((button) => button.textContent === '直线')!.click();
    await flushRuntime();
    expect(context.fetchMock).toHaveBeenCalledWith(expect.stringContaining('/ann-old'), expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ visualStyle: 'straight' }) }));

    context.document.querySelector<HTMLElement>('[data-rp-ann="ann-old"]')!.click();
    toolbarButton(context, '高亮').click();
    Array.from(context.document.querySelectorAll<HTMLButtonElement>('.rp-panel button')).find((button) => button.textContent === '删除标注')!.click();
    await flushRuntime();
    expect(context.fetchMock).toHaveBeenCalledWith(expect.stringContaining('/ann-old'), expect.objectContaining({ method: 'DELETE' }));
  });
});
