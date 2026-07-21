// input: 预置旧 schema（semantic_type 带 7 值 CHECK）的临时 SQLite 数据库
// output: annotations 表 CHECK 约束重建迁移的单元测试
// pos: 测试层 — 保证旧库升级后可写入 观点/事实 且旧数据无损
// 声明：一旦我被更新，务必更新我的开头注释以及所属文件夹的 md。

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import os from 'os';
import path from 'path';

let tmpDir: string;
let db: typeof import('./db');

const OLD_SCHEMA = `
  CREATE TABLE books (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    author TEXT NOT NULL DEFAULT '',
    genre TEXT NOT NULL DEFAULT '',
    data_dir TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE annotations (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL,
    page_id TEXT,
    locator_json TEXT NOT NULL DEFAULT '{}',
    quote TEXT NOT NULL DEFAULT '',
    quote_prefix TEXT NOT NULL DEFAULT '',
    quote_suffix TEXT NOT NULL DEFAULT '',
    visual_style TEXT NOT NULL DEFAULT 'highlight' CHECK(visual_style IN ('highlight','straight','wavy','none')),
    color TEXT,
    semantic_type TEXT CHECK(semantic_type IS NULL OR semantic_type IN ('case','quote','question','resonance','objection','action','insight')),
    body TEXT NOT NULL DEFAULT '',
    tags_json TEXT NOT NULL DEFAULT '[]',
    origin TEXT NOT NULL DEFAULT 'local' CHECK(origin IN ('local','weread')),
    external_id TEXT,
    source_hash TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT,
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
  );
`;

beforeAll(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'readpilot-annot-mig-'));
  // 预置旧 schema 数据库 + 一条旧语义类型数据
  const raw = new Database(path.join(tmpDir, 'readpilot.db'));
  raw.exec(OLD_SCHEMA);
  raw.prepare(
    "INSERT INTO books (id, title, data_dir) VALUES ('b1', '旧书', 'dir-old')"
  ).run();
  raw.prepare(
    "INSERT INTO annotations (id, book_id, page_id, quote, semantic_type) VALUES ('a1', 'b1', 'chap-01', '旧划线', 'insight')"
  ).run();
  raw.close();

  process.env.READPILOT_DATA_DIR = tmpDir;
  vi.resetModules();
  db = await import('./db');
});

afterAll(() => {
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* windows 文件锁忽略 */ }
});

describe('annotations CHECK 约束迁移', () => {
  it('旧库初始化后 CHECK 被移除，旧数据无损', () => {
    const sql = (db.getDb().prepare(
      "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'annotations'"
    ).get() as any).sql as string;
    expect(sql).not.toContain('semantic_type TEXT CHECK');

    const old = db.getAnnotation('a1')!;
    expect(old.quote).toBe('旧划线');
    expect(old.semanticType).toBe('insight');
  });

  it('迁移后可写入观点/事实', () => {
    const ann = db.createAnnotation('b1', { pageId: 'chap-01', quote: '新划线', semanticType: 'viewpoint' });
    expect(ann.semanticType).toBe('viewpoint');
    expect(db.updateAnnotation(ann.id, { semanticType: 'fact' })!.semanticType).toBe('fact');
  });

  it('迁移是幂等的（再次检测不再触发重建）', () => {
    const sql = (db.getDb().prepare(
      "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'annotations'"
    ).get() as any).sql as string;
    expect(sql).not.toContain('semantic_type TEXT CHECK');
    expect(db.getAnnotationsByBook('b1').length).toBeGreaterThanOrEqual(2);
  });
});
