// input: 构造的书籍/页面/笔记/标注数据
// output: buildNotesMarkdown 与 notesExportFileName 的单元测试
// pos: 测试层 — 读书笔记 Markdown 导出的行为契约
// 声明：一旦我被更新，务必更新我的开头注释以及所属文件夹的 md。

import { describe, expect, it } from 'vitest';
import { buildNotesMarkdown, notesExportFileName } from './notes-exporter';
import type { Annotation, BookNote } from '@/types/progress';
import type { ProgressPage } from '@/types/progress-data';

const exportedAt = new Date(2026, 6, 21);

function page(id: string, title: string): ProgressPage {
  return {
    id, title, type: 'chapter', description: '', file: `pages/${id}.html`,
    status: 'new', masteryScore: null, relatedChapters: [], createdAt: '', completedAt: null,
  };
}

function note(overrides: Partial<BookNote>): BookNote {
  return {
    id: 'n1', bookId: 'b1', pageId: 'chap-01', cue: '', notes: '', summary: '',
    createdAt: '', updatedAt: '', ...overrides,
  };
}

function annotation(overrides: Partial<Annotation>): Annotation {
  return {
    id: 'a1', bookId: 'b1', pageId: 'chap-01', locator: {}, quote: '原文片段',
    quotePrefix: '', quoteSuffix: '', visualStyle: 'highlight', color: 'yellow',
    semanticType: null, body: '', tags: [], origin: 'local', externalId: null,
    sourceHash: null, createdAt: '', updatedAt: '', deletedAt: null, ...overrides,
  };
}

describe('buildNotesMarkdown', () => {
  it('按章节组织：先康奈尔三区，后标注（含语义标签、想法、来源）', () => {
    const md = buildNotesMarkdown({
      bookTitle: '时间的秩序', author: '卡洛·罗韦利',
      pages: [page('chap-01', '第一章 统一性的消失'), page('chap-02', '第二章 方向的消失')],
      notes: [note({ pageId: 'chap-01', cue: '什么是时间？', notes: '时间不是均匀流动的。', summary: '时间是关系。' })],
      annotations: [
        annotation({ pageId: 'chap-01', quote: '低处的时间比高处的少。', semanticType: 'insight', body: '和引力有关！' }),
        annotation({ id: 'a2', pageId: 'chap-02', quote: '熵增给了时间方向。', origin: 'weread' }),
      ],
      exportedAt,
    });

    expect(md).toContain('# 《时间的秩序》读书笔记');
    expect(md).toContain('作者：卡洛·罗韦利 · 导出：2026-07-21');
    expect(md).toContain('## 第一章 统一性的消失');
    expect(md).toContain('**线索 Cue**\n\n什么是时间？');
    expect(md).toContain('**笔记 Notes**\n\n时间不是均匀流动的。');
    expect(md).toContain('**总结 Summary**\n\n时间是关系。');
    expect(md).toContain('> 低处的时间比高处的少。');
    expect(md).toContain('💭 和引力有关！');
    expect(md).toContain('#洞察');
    expect(md).toContain('## 第二章 方向的消失');
    expect(md).toContain('来源：微信读书');
    // 章节顺序遵循 pages 顺序
    expect(md.indexOf('第一章')).toBeLessThan(md.indexOf('第二章'));
  });

  it('空章节跳过；未定位标注与独立笔记有独立分节', () => {
    const md = buildNotesMarkdown({
      bookTitle: '书', author: '',
      pages: [page('chap-01', '有内容的章'), page('chap-02', '空章')],
      notes: [
        note({ pageId: 'chap-01', notes: '有笔记' }),
        note({ id: 'n2', pageId: null, summary: '独立总结' }),
        note({ id: 'n3', pageId: 'chap-02' }), // 全空笔记不导出
      ],
      annotations: [annotation({ pageId: null, quote: '未定位划线', quotePrefix: '某一章' })],
      exportedAt,
    });

    expect(md).toContain('## 有内容的章');
    expect(md).not.toContain('## 空章');
    expect(md).toContain('## 其他标注（1）');
    expect(md).toContain('**某一章**');
    expect(md).toContain('> 未定位划线');
    expect(md).toContain('## 独立笔记');
    expect(md).toContain('独立总结');
  });

  it('多行原文以引用块逐行输出，多行想法压成单行', () => {
    const md = buildNotesMarkdown({
      bookTitle: '书', author: '',
      pages: [page('chap-01', '章')],
      notes: [],
      annotations: [annotation({ quote: '第一行\n第二行', body: '想法一\n想法二' })],
      exportedAt,
    });
    expect(md).toContain('> 第一行 第二行');
    expect(md).toContain('💭 想法一 想法二');
  });

  it('章节范围：文档头标注范围，且不输出其他标注/独立笔记分节', () => {
    const md = buildNotesMarkdown({
      bookTitle: '书', author: '作者',
      pages: [page('chap-01', '第一章')],
      notes: [
        note({ pageId: 'chap-01', notes: '本章笔记' }),
        note({ id: 'n2', pageId: null, summary: '独立总结不应出现' }),
      ],
      annotations: [
        annotation({ pageId: 'chap-01', quote: '本章划线' }),
        annotation({ id: 'a2', pageId: null, quote: '未定位划线不应出现' }),
      ],
      exportedAt,
      chapterTitle: '第一章',
    });
    expect(md).toContain('范围：第一章');
    expect(md).toContain('本章笔记');
    expect(md).toContain('> 本章划线');
    expect(md).not.toContain('独立笔记');
    expect(md).not.toContain('其他标注');
  });
});

describe('notesExportFileName', () => {
  it('清理非法字符并带日期戳', () => {
    expect(notesExportFileName('时间的秩序', exportedAt)).toBe('ReadPilot-时间的秩序-笔记-20260721.md');
    expect(notesExportFileName('a/b:c?', exportedAt)).toBe('ReadPilot-abc-笔记-20260721.md');
  });

  it('章节范围拼入清理后的章节名并截断到 12 字', () => {
    expect(notesExportFileName('时间的秩序', exportedAt, '第一章')).toBe('ReadPilot-时间的秩序-第一章-笔记-20260721.md');
    expect(notesExportFileName('书', exportedAt, '一二三四五六七八九十一二三四五'))
      .toBe('ReadPilot-书-一二三四五六七八九十一二-笔记-20260721.md');
  });

  it('规避 Windows 保留名与空标题', () => {
    expect(notesExportFileName('CON', exportedAt)).toBe('ReadPilot-读书笔记-笔记-20260721.md');
    expect(notesExportFileName('', exportedAt)).toBe('ReadPilot-读书笔记-笔记-20260721.md');
  });
});
