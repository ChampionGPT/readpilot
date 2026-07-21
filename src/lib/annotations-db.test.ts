// input: 临时目录中的 SQLite 数据库
// output: annotations / note_annotation_links CRUD、原子转入与 weread 幂等导入的单元测试
// pos: 测试层 — 验证标注数据模型可靠性
// 声明：一旦我被更新，务必更新我的开头注释以及所属文件夹的 md。

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

let tmpDir: string;
let db: typeof import('./db');

beforeAll(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'readpilot-annot-'));
  process.env.READPILOT_DATA_DIR = tmpDir;
  vi.resetModules();
  db = await import('./db');
});

afterAll(() => {
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* windows 文件锁忽略 */ }
});

function makeBook() {
  return db.createBook({ title: '测试书', author: '作者', genre: 'test' }, `dir-${Math.random().toString(36).slice(2)}`);
}

describe('annotations CRUD', () => {
  it('创建并读取标注，视觉样式与语义类型相互独立', () => {
    const book = makeBook();
    const ann = db.createAnnotation(book.id, {
      pageId: 'chap-01',
      locator: { blockId: 'b-3', startOffset: 5, endOffset: 20 },
      quote: '这是一段被选中的原文',
      quotePrefix: '前文',
      quoteSuffix: '后文',
      visualStyle: 'highlight',
      color: 'yellow',
      semanticType: 'question',
      body: '作者是否忽略了组织规模？',
      tags: ['方法论'],
    });
    expect(ann.visualStyle).toBe('highlight');
    expect(ann.semanticType).toBe('question');
    expect(ann.body).toContain('组织规模');
    expect(ann.locator.blockId).toBe('b-3');
    expect(ann.tags).toEqual(['方法论']);
    expect(ann.deletedAt).toBeNull();
  });

  it('修改语义类型不丢失原文、想法和高亮样式', () => {
    const book = makeBook();
    const ann = db.createAnnotation(book.id, {
      pageId: 'chap-01', quote: '原文', body: '想法', visualStyle: 'highlight', color: 'blue', semanticType: 'case',
    });
    const updated = db.updateAnnotation(ann.id, { semanticType: 'insight' })!;
    expect(updated.semanticType).toBe('insight');
    expect(updated.quote).toBe('原文');
    expect(updated.body).toBe('想法');
    expect(updated.visualStyle).toBe('highlight');
    expect(updated.color).toBe('blue');
  });

  it('软删除后默认列表不可见，可恢复', () => {
    const book = makeBook();
    const ann = db.createAnnotation(book.id, { quote: 'x', pageId: 'chap-01' });
    expect(db.softDeleteAnnotation(ann.id)).toBe(true);
    expect(db.getAnnotationsByBook(book.id)).toHaveLength(0);
    expect(db.getAnnotationsByBook(book.id, { includeDeleted: true })).toHaveLength(1);
    db.updateAnnotation(ann.id, { deletedAt: null });
    expect(db.getAnnotationsByBook(book.id)).toHaveLength(1);
  });

  it('新增语义类型 观点/事实 可正常保存与更新', () => {
    const book = makeBook();
    const vp = db.createAnnotation(book.id, { pageId: 'chap-01', quote: '观点原文', semanticType: 'viewpoint' });
    expect(vp.semanticType).toBe('viewpoint');
    const fact = db.updateAnnotation(vp.id, { semanticType: 'fact' })!;
    expect(fact.semanticType).toBe('fact');
    expect(fact.quote).toBe('观点原文');
  });

  it('同页支持至少 20 条独立标注', () => {
    const book = makeBook();
    for (let i = 0; i < 25; i++) {
      db.createAnnotation(book.id, { pageId: 'chap-02', quote: `第 ${i} 条`, locator: { blockId: `b-${i}` } });
    }
    expect(db.getAnnotationsByPage(book.id, 'chap-02')).toHaveLength(25);
  });
});

describe('note_annotation_links', () => {
  it('标注可引用进 cue/notes/summary，删除笔记级联清理', () => {
    const book = makeBook();
    const note = db.createNote(book.id, 'chap-01', '', '', '');
    const ann = db.createAnnotation(book.id, { quote: '引用原文', pageId: 'chap-01' });
    db.linkAnnotationToNote(note.id, ann.id, 'cue', 1);
    db.linkAnnotationToNote(note.id, ann.id, 'notes', 2);
    expect(db.getLinksByNote(note.id)).toHaveLength(2);
    expect(db.getLinksByAnnotations([ann.id])).toHaveLength(2);
    // 重复 link 幂等（更新 sort_order）
    db.linkAnnotationToNote(note.id, ann.id, 'cue', 9);
    const links = db.getLinksByNote(note.id);
    expect(links).toHaveLength(2);
    expect(links.find(l => l.section === 'cue')!.sortOrder).toBe(9);
    db.deleteNote(note.id);
    expect(db.getLinksByAnnotations([ann.id])).toHaveLength(0);
  });

  it('原子转入只在首次追加文本并建立 exact section link', () => {
    const book = makeBook();
    const note = db.createNote(book.id, 'chap-01', '', '已有内容', '');
    const ann = db.createAnnotation(book.id, { quote: '引用原文', pageId: 'chap-01' });

    const first = db.sendAnnotationToNote(note.id, ann.id, 'notes');
    const second = db.sendAnnotationToNote(note.id, ann.id, 'notes');

    expect(first.created).toBe(true);
    expect(first.note.notes).toBe('已有内容\n\n> 引用原文');
    expect(second.created).toBe(false);
    expect(second.note.notes).toBe('已有内容\n\n> 引用原文');
    expect(second.links).toEqual([{ noteId: note.id, annotationId: ann.id, section: 'notes', sortOrder: 0 }]);
  });

  it('跨书转入被拒绝且笔记文本与链接保持不变', () => {
    const noteBook = makeBook();
    const annotationBook = makeBook();
    const note = db.createNote(noteBook.id, 'chap-01', '', '原笔记', '');
    const ann = db.createAnnotation(annotationBook.id, { quote: '另一本文字', pageId: 'chap-01' });

    expect(() => db.sendAnnotationToNote(note.id, ann.id, 'notes')).toThrow('same book');
    expect(db.getNote(note.id)?.notes).toBe('原笔记');
    expect(db.getLinksByNote(note.id)).toEqual([]);
  });

  it('无效 section 在事务写入前失败，不留下部分文本或链接', () => {
    const book = makeBook();
    const note = db.createNote(book.id, 'chap-01', '', '原笔记', '');
    const ann = db.createAnnotation(book.id, { quote: '引用原文', pageId: 'chap-01' });

    expect(() => db.sendAnnotationToNote(note.id, ann.id, 'invalid' as 'notes')).toThrow('section');
    expect(db.getNote(note.id)?.notes).toBe('原笔记');
    expect(db.getLinksByNote(note.id)).toEqual([]);
  });
});

describe('weread 幂等导入', () => {
  it('重复导入不会增加重复记录', () => {
    const book = makeBook();
    const wereadBookId = 'wr-001';
    const conn = db.getDb();
    conn.prepare(`INSERT INTO weread_bookmarks (bookmark_id, book_id, chapter_uid, chapter_title, mark_text, range_str, range_start, color_style, created_at, fetched_at)
      VALUES ('bm1', ?, 1, '第一章', '划线内容', '10-20', 10, 1, 0, 0)`).run(wereadBookId);
    conn.prepare(`INSERT INTO weread_reviews (review_id, book_id, chapter_uid, chapter_name, abstract, content, range_str, star, is_finish, created_at, fetched_at)
      VALUES ('rv1', ?, 1, '第一章', '摘录', '我的想法', '10-20', 0, 0, 0, 0)`).run(wereadBookId);

    const first = db.importWereadAnnotations(book.id, wereadBookId);
    expect(first.imported).toBe(2);
    const second = db.importWereadAnnotations(book.id, wereadBookId);
    expect(second.imported).toBe(0);
    expect(second.updated).toBe(2);
    expect(db.getAnnotationsByBook(book.id)).toHaveLength(2);
  });
});
