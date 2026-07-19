// input: better-sqlite3 模块与本地 db 路径
// output: getDb(), books CRUD, sessions CRUD, messages CRUD, notes CRUD, annotations CRUD + 康奈尔引用, articles CRUD, weread bindings + caches
// pos: 后端核心持久化层 — 所有数据的唯一真相源
// 声明：一旦我被更新，务必更新我的开头注释以及所属文件夹的 md。

import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type {
  Book, BookCreateInput, ChatSession, Message, BookNote, Article, ArticleCreateInput,
  Annotation, AnnotationLocator, AnnotationVisualStyle, AnnotationColor,
  AnnotationSemanticType, AnnotationOrigin, NoteAnnotationLink, CornellSection,
} from '@/types/progress';
import { DB_PATH } from './constants';

let db: Database.Database | null = null;
// hot reload reset helper

/** 获取或初始化单例数据库连接 */
export function getDb(): Database.Database {
  if (!db) {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initDb(db);
  }
  return db;
}

function initDb(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS books (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      author TEXT NOT NULL DEFAULT '',
      genre TEXT NOT NULL DEFAULT '',
      data_dir TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS chat_sessions (
      id TEXT PRIMARY KEY,
      book_id TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT 'New Chat',
      sdk_session_id TEXT NOT NULL DEFAULT '',
      provider TEXT NOT NULL DEFAULT 'claude',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS chat_session_providers (
      session_id TEXT NOT NULL,
      provider TEXT NOT NULL,
      provider_session_id TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (session_id, provider),
      FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
      content TEXT NOT NULL,
      provider TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS book_notes (
      id TEXT PRIMARY KEY,
      book_id TEXT NOT NULL,
      page_id TEXT,
      cue TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      summary TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS annotations (
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
    CREATE INDEX IF NOT EXISTS idx_annotations_book ON annotations(book_id);
    CREATE INDEX IF NOT EXISTS idx_annotations_page ON annotations(book_id, page_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_annotations_external ON annotations(origin, external_id) WHERE external_id IS NOT NULL;

    CREATE TABLE IF NOT EXISTS note_annotation_links (
      note_id TEXT NOT NULL,
      annotation_id TEXT NOT NULL,
      section TEXT NOT NULL CHECK(section IN ('cue','notes','summary')),
      sort_order INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (note_id, annotation_id, section),
      FOREIGN KEY (note_id) REFERENCES book_notes(id) ON DELETE CASCADE,
      FOREIGN KEY (annotation_id) REFERENCES annotations(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_note_annotation_links_annotation ON note_annotation_links(annotation_id);

    CREATE TABLE IF NOT EXISTS articles (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      source_url TEXT NOT NULL DEFAULT '',
      summary TEXT NOT NULL DEFAULT '',
      content TEXT NOT NULL DEFAULT '',
      author TEXT NOT NULL DEFAULT '',
      tags TEXT NOT NULL DEFAULT '[]',
      read_status TEXT NOT NULL DEFAULT 'unread' CHECK(read_status IN ('unread','reading','completed')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_book_id ON chat_sessions(book_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_updated_at ON chat_sessions(updated_at);
    CREATE INDEX IF NOT EXISTS idx_books_updated_at ON books(updated_at);
    CREATE INDEX IF NOT EXISTS idx_book_notes_book_id ON book_notes(book_id);
    CREATE INDEX IF NOT EXISTS idx_book_notes_page_id ON book_notes(page_id);
    CREATE INDEX IF NOT EXISTS idx_articles_updated_at ON articles(updated_at);
    CREATE INDEX IF NOT EXISTS idx_articles_read_status ON articles(read_status);

    CREATE TABLE IF NOT EXISTS weread_bindings (
      local_book_dir   TEXT PRIMARY KEY,
      weread_book_id   TEXT NOT NULL UNIQUE,
      bound_at         INTEGER NOT NULL,
      last_synced_at   INTEGER
    );

    CREATE TABLE IF NOT EXISTS weread_books (
      book_id      TEXT PRIMARY KEY,
      title        TEXT,
      author       TEXT,
      cover        TEXT,
      intro        TEXT,
      category     TEXT,
      word_count   INTEGER,
      new_rating   INTEGER,
      raw_json     TEXT,
      fetched_at   INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS weread_bookmarks (
      bookmark_id   TEXT PRIMARY KEY,
      book_id       TEXT NOT NULL,
      chapter_uid   INTEGER NOT NULL,
      chapter_title TEXT,
      mark_text     TEXT NOT NULL,
      range_str     TEXT NOT NULL,
      range_start   INTEGER,
      color_style   INTEGER,
      created_at    INTEGER NOT NULL,
      fetched_at    INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_weread_bookmarks_book ON weread_bookmarks(book_id, chapter_uid, range_start);

    CREATE TABLE IF NOT EXISTS weread_reviews (
      review_id    TEXT PRIMARY KEY,
      book_id      TEXT NOT NULL,
      chapter_uid  INTEGER,
      chapter_name TEXT,
      abstract     TEXT,
      content      TEXT NOT NULL,
      range_str    TEXT,
      star         INTEGER,
      is_finish    INTEGER,
      created_at   INTEGER NOT NULL,
      fetched_at   INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_weread_reviews_book ON weread_reviews(book_id, chapter_uid);

    CREATE TABLE IF NOT EXISTS weread_hot_bookmarks (
      book_id       TEXT NOT NULL,
      bookmark_id   TEXT NOT NULL,
      chapter_uid   INTEGER NOT NULL,
      mark_text     TEXT NOT NULL,
      range_str     TEXT NOT NULL,
      total_count   INTEGER NOT NULL,
      fetched_at    INTEGER NOT NULL,
      PRIMARY KEY(book_id, bookmark_id)
    );

    CREATE TABLE IF NOT EXISTS weread_progress (
      book_id              TEXT PRIMARY KEY,
      progress_percent     INTEGER,
      chapter_uid          INTEGER,
      chapter_offset       INTEGER,
      reading_time_sec     INTEGER,
      finish_time          INTEGER,
      is_start_reading     INTEGER,
      weread_update_time   INTEGER,
      fetched_at           INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS weread_shelf_snapshot (
      id           INTEGER PRIMARY KEY CHECK (id = 1),
      total_count  INTEGER,
      raw_json     TEXT NOT NULL,
      fetched_at   INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS weread_readdata (
      mode             TEXT NOT NULL,
      base_time        INTEGER NOT NULL,
      total_read_sec   INTEGER,
      read_days        INTEGER,
      day_average_sec  INTEGER,
      compare_pct      REAL,
      raw_json         TEXT NOT NULL,
      fetched_at       INTEGER NOT NULL,
      PRIMARY KEY(mode, base_time)
    );
  `);

  // ── Idempotent migration: messages.blocks_json (added 2026-05-22) ──
  const messagesCols = db.prepare(`PRAGMA table_info(messages)`).all() as any[];
  const hasBlocksJson = messagesCols.some(c => c.name === 'blocks_json');
  if (!hasBlocksJson) {
    db.exec(`ALTER TABLE messages ADD COLUMN blocks_json TEXT`);
  }

  const hasMessageProvider = messagesCols.some(c => c.name === 'provider');
  if (!hasMessageProvider) {
    db.exec(`ALTER TABLE messages ADD COLUMN provider TEXT`);
  }

  const sessionCols = db.prepare(`PRAGMA table_info(chat_sessions)`).all() as any[];
  const hasSessionProvider = sessionCols.some(c => c.name === 'provider');
  if (!hasSessionProvider) {
    db.exec(`ALTER TABLE chat_sessions ADD COLUMN provider TEXT NOT NULL DEFAULT 'claude'`);
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS chat_session_providers (
      session_id TEXT NOT NULL,
      provider TEXT NOT NULL,
      provider_session_id TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (session_id, provider),
      FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
    );
  `);

  db.exec(`
    INSERT OR IGNORE INTO chat_session_providers (session_id, provider, provider_session_id, updated_at)
    SELECT id, 'claude', sdk_session_id, updated_at
    FROM chat_sessions
    WHERE sdk_session_id <> ''
  `);
}

// ── Books CRUD ──

export function createBook(input: BookCreateInput, dataDir: string): Book {
  const db = getDb();
  const id = crypto.randomBytes(16).toString('hex');
  const now = new Date().toISOString();
  db.prepare(
    'INSERT INTO books (id, title, author, genre, data_dir, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(id, input.title, input.author || '', input.genre || '', dataDir, now, now);
  return getBook(id)!;
}

export function upsertBook(id: string, title: string, dataDir: string): Book {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO books (id, title, data_dir, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET title = excluded.title, updated_at = excluded.updated_at
  `).run(id, title, dataDir, now, now);
  return getBook(id)!;
}

export function getBooks(): Book[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM books ORDER BY updated_at DESC').all() as any[];
  return rows.map(mapBookRow);
}

export function getBook(id: string): Book | undefined {
  const db = getDb();
  const row = db.prepare('SELECT * FROM books WHERE id = ?').get(id) as any;
  if (!row) return undefined;
  return mapBookRow(row);
}

export function deleteBook(id: string): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM books WHERE id = ?').run(id);
  return result.changes > 0;
}

function mapBookRow(row: any): Book {
  return {
    id: row.id,
    title: row.title,
    author: row.author,
    genre: row.genre,
    dataDir: row.data_dir,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ── Chat Sessions CRUD ──

export function createSession(bookId: string, title?: string, provider: ChatSession['provider'] = 'claude'): ChatSession {
  const db = getDb();
  const id = crypto.randomBytes(16).toString('hex');
  const now = new Date().toISOString();
  db.prepare(
    'INSERT INTO chat_sessions (id, book_id, title, provider, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, bookId, title || 'New Reading Session', provider, now, now);
  return getSession(id)!;
}

/** 获取或创建书籍的最新会话（24小时内活跃的会话会被复用） */
export function getOrCreateLatestSession(bookId: string): ChatSession {
  const db = getDb();
  // 尝试获取最新的会话（最近24小时内更新的）
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const recentSession = db.prepare(`
    SELECT * FROM chat_sessions
    WHERE book_id = ? AND updated_at > ?
    ORDER BY updated_at DESC
    LIMIT 1
  `).get(bookId, oneDayAgo) as any;

  if (recentSession) {
    return mapSessionRow(recentSession);
  }

  // 没有最近的会话，创建新的
  return createSession(bookId, `阅读对话 ${new Date().toLocaleDateString('zh-CN')}`);
}

export function getSession(id: string): ChatSession | undefined {
  const db = getDb();
  const row = db.prepare('SELECT * FROM chat_sessions WHERE id = ?').get(id) as any;
  if (!row) return undefined;
  return mapSessionRow(row);
}

export function getSessionsByBook(bookId: string): ChatSession[] {
  const db = getDb();
  const rows = db.prepare(
    'SELECT * FROM chat_sessions WHERE book_id = ? ORDER BY updated_at DESC'
  ).all(bookId) as any[];
  return rows.map(mapSessionRow);
}

export function updateSessionSdkId(id: string, sdkSessionId: string): void {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare('UPDATE chat_sessions SET sdk_session_id = ?, updated_at = ? WHERE id = ?')
    .run(sdkSessionId, now, id);

  const provider = sdkSessionId.startsWith('codex:') ? 'codex' : 'claude';
  const providerSessionId = sdkSessionId.startsWith('codex:') ? sdkSessionId.slice('codex:'.length) : sdkSessionId;
  if (providerSessionId) {
    updateProviderSessionId(id, provider, providerSessionId);
  }
}

export function updateSessionProvider(id: string, provider: ChatSession['provider']): boolean {
  const db = getDb();
  const now = new Date().toISOString();
  const result = db.prepare('UPDATE chat_sessions SET provider = ?, updated_at = ? WHERE id = ?')
    .run(provider, now, id);
  return result.changes > 0;
}

export function getProviderSessionId(sessionId: string, provider: ChatSession['provider']): string | undefined {
  const db = getDb();
  const row = db.prepare(
    'SELECT provider_session_id FROM chat_session_providers WHERE session_id = ? AND provider = ?'
  ).get(sessionId, provider) as { provider_session_id?: string } | undefined;
  return row?.provider_session_id || undefined;
}

export function getProviderSessionIds(sessionId: string): Array<{ provider: ChatSession['provider']; providerSessionId: string }> {
  const db = getDb();
  const rows = db.prepare(
    'SELECT provider, provider_session_id FROM chat_session_providers WHERE session_id = ? AND provider_session_id <> ?'
  ).all(sessionId, '') as Array<{ provider: ChatSession['provider']; provider_session_id: string }>;
  return rows.map((row) => ({ provider: row.provider, providerSessionId: row.provider_session_id }));
}

export function updateProviderSessionId(sessionId: string, provider: ChatSession['provider'], providerSessionId: string): void {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO chat_session_providers (session_id, provider, provider_session_id, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(session_id, provider) DO UPDATE SET
      provider_session_id = excluded.provider_session_id,
      updated_at = excluded.updated_at
  `).run(sessionId, provider, providerSessionId, now);

  if (provider === 'claude') {
    db.prepare('UPDATE chat_sessions SET sdk_session_id = ?, updated_at = ? WHERE id = ?')
      .run(providerSessionId, now, sessionId);
  } else if (provider === 'codex') {
    db.prepare('UPDATE chat_sessions SET sdk_session_id = ?, updated_at = ? WHERE id = ?')
      .run(`codex:${providerSessionId}`, now, sessionId);
  }
}

export function updateSessionTitle(id: string, title: string): boolean {
  const db = getDb();
  const now = new Date().toISOString();
  const result = db.prepare('UPDATE chat_sessions SET title = ?, updated_at = ? WHERE id = ?')
    .run(title, now, id);
  return result.changes > 0;
}

export function deleteSessionsByBook(bookId: string): void {
  const db = getDb();
  db.prepare('DELETE FROM chat_sessions WHERE book_id = ?').run(bookId);
}

function mapSessionRow(row: any): ChatSession {
  return {
    id: row.id,
    bookId: row.book_id,
    title: row.title,
    sdkSessionId: row.sdk_session_id,
    provider: row.provider ?? 'claude',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ── Messages CRUD ──

export function addMessage(
  sessionId: string,
  role: string,
  content: string,
  blocksJson?: string | null,
  provider?: ChatSession['provider'] | null,
): Message {
  const db = getDb();
  const id = crypto.randomBytes(16).toString('hex');
  const now = new Date().toISOString();
  db.prepare(
    'INSERT INTO messages (id, session_id, role, content, blocks_json, provider, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(id, sessionId, role, content, blocksJson ?? null, provider ?? null, now);

  db.prepare('UPDATE chat_sessions SET updated_at = ? WHERE id = ?').run(now, sessionId);

  return {
    id, sessionId, role: role as 'user' | 'assistant', content,
    blocksJson: blocksJson ?? null, provider: provider ?? undefined, createdAt: now,
  };
}

export function getMessages(sessionId: string): Message[] {
  const db = getDb();
  const rows = db.prepare(
    'SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC'
  ).all(sessionId) as any[];
  return rows.map(row => ({
    id: row.id,
    sessionId: row.session_id,
    role: row.role as 'user' | 'assistant',
    content: row.content,
    blocksJson: row.blocks_json ?? null,
    provider: row.provider ?? undefined,
    createdAt: row.created_at,
  }));
}

export function deleteSession(id: string): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM chat_sessions WHERE id = ?').run(id);
  return result.changes > 0;
}

/**
 * 回退到 fromIndex 之前 — 删除 fromIndex (含) 之后的所有 messages，
 * 并清空 sdk_session_id 强制下一次开新会话。
 * expectedContent 做防御性校验，避免前端 stale state 导致误删别人的消息。
 * 返回删掉的条数；fromIndex 越界或内容不匹配 → 抛错。
 */
export function rewindMessages(
  sessionId: string,
  fromIndex: number,
  expectedContent: string,
): { deleted: number } {
  const db = getDb();
  const rows = db.prepare(
    'SELECT id, role, content, created_at FROM messages WHERE session_id = ? ORDER BY created_at ASC'
  ).all(sessionId) as Array<{ id: string; role: string; content: string; created_at: string }>;

  if (fromIndex < 0 || fromIndex >= rows.length) {
    throw new Error(`fromIndex ${fromIndex} out of range (0..${rows.length - 1})`);
  }
  const target = rows[fromIndex];
  if (target.role !== 'user') {
    throw new Error(`message at index ${fromIndex} is role='${target.role}', not user`);
  }
  if (target.content !== expectedContent) {
    throw new Error('content mismatch — frontend state is stale');
  }

  const tx = db.transaction(() => {
    const del = db.prepare('DELETE FROM messages WHERE session_id = ? AND created_at >= ?').run(sessionId, target.created_at);
    db.prepare('UPDATE chat_sessions SET sdk_session_id = ?, updated_at = ? WHERE id = ?')
      .run('', new Date().toISOString(), sessionId);
    db.prepare('DELETE FROM chat_session_providers WHERE session_id = ?').run(sessionId);
    return del.changes;
  });
  return { deleted: tx() };
}

export function rewindMessagesFromUser(
  sessionId: string,
  expectedContent: string,
  options: { messageId?: string; userOrdinal?: number },
): { deleted: number } {
  const db = getDb();
  const rows = db.prepare(
    'SELECT id, role, content, created_at FROM messages WHERE session_id = ? ORDER BY created_at ASC'
  ).all(sessionId) as Array<{ id: string; role: string; content: string; created_at: string }>;

  let target: { id: string; role: string; content: string; created_at: string } | undefined;
  if (options.messageId) {
    target = rows.find((row) => row.id === options.messageId);
  } else if (typeof options.userOrdinal === 'number') {
    target = rows.filter((row) => row.role === 'user')[options.userOrdinal];
  }

  if (!target) {
    throw new Error('target user message not found');
  }
  if (target.role !== 'user') {
    throw new Error(`target message is role='${target.role}', not user`);
  }
  if (target.content !== expectedContent) {
    throw new Error('content mismatch - frontend state is stale');
  }

  const tx = db.transaction(() => {
    const del = db.prepare('DELETE FROM messages WHERE session_id = ? AND created_at >= ?').run(sessionId, target.created_at);
    db.prepare('UPDATE chat_sessions SET sdk_session_id = ?, updated_at = ? WHERE id = ?')
      .run('', new Date().toISOString(), sessionId);
    db.prepare('DELETE FROM chat_session_providers WHERE session_id = ?').run(sessionId);
    return del.changes;
  });
  return { deleted: tx() };
}

// ── Book Notes CRUD (Cornell note-taking) ──

export function createNote(bookId: string, pageId: string | null, cue: string, notes: string, summary: string): BookNote {
  const db = getDb();
  const id = crypto.randomBytes(16).toString('hex');
  const now = new Date().toISOString();
  db.prepare(
    'INSERT INTO book_notes (id, book_id, page_id, cue, notes, summary, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(id, bookId, pageId, cue, notes, summary, now, now);
  return getNote(id)!;
}

export function getNote(id: string): BookNote | undefined {
  const db = getDb();
  const row = db.prepare('SELECT * FROM book_notes WHERE id = ?').get(id) as any;
  if (!row) return undefined;
  return mapNoteRow(row);
}

export function getNotesByBook(bookId: string): BookNote[] {
  const db = getDb();
  const rows = db.prepare(
    'SELECT * FROM book_notes WHERE book_id = ? ORDER BY updated_at DESC'
  ).all(bookId) as any[];
  return rows.map(mapNoteRow);
}

export function getNotesByPage(bookId: string, pageId: string): BookNote[] {
  const db = getDb();
  const rows = db.prepare(
    'SELECT * FROM book_notes WHERE book_id = ? AND page_id = ? ORDER BY updated_at DESC'
  ).all(bookId, pageId) as any[];
  return rows.map(mapNoteRow);
}

export function updateNote(id: string, fields: { cue?: string; notes?: string; summary?: string; pageId?: string | null }): BookNote | undefined {
  const db = getDb();
  const now = new Date().toISOString();
  const sets: string[] = ['updated_at = ?'];
  const params: any[] = [now];
  if (fields.cue !== undefined) { sets.push('cue = ?'); params.push(fields.cue); }
  if (fields.notes !== undefined) { sets.push('notes = ?'); params.push(fields.notes); }
  if (fields.summary !== undefined) { sets.push('summary = ?'); params.push(fields.summary); }
  if (fields.pageId !== undefined) { sets.push('page_id = ?'); params.push(fields.pageId); }
  params.push(id);
  db.prepare(`UPDATE book_notes SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  return getNote(id);
}

export function deleteNote(id: string): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM book_notes WHERE id = ?').run(id);
  return result.changes > 0;
}

function mapNoteRow(row: any): BookNote {
  return {
    id: row.id,
    bookId: row.book_id,
    pageId: row.page_id,
    cue: row.cue,
    notes: row.notes,
    summary: row.summary,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ── Annotations CRUD (阅读标注) ──

export interface AnnotationCreateInput {
  pageId?: string | null;
  locator?: AnnotationLocator;
  quote: string;
  quotePrefix?: string;
  quoteSuffix?: string;
  visualStyle?: AnnotationVisualStyle;
  color?: AnnotationColor | null;
  semanticType?: AnnotationSemanticType | null;
  body?: string;
  tags?: string[];
  origin?: AnnotationOrigin;
  externalId?: string | null;
  sourceHash?: string | null;
}

export interface AnnotationUpdateInput {
  pageId?: string | null;
  locator?: AnnotationLocator;
  quote?: string;
  quotePrefix?: string;
  quoteSuffix?: string;
  visualStyle?: AnnotationVisualStyle;
  color?: AnnotationColor | null;
  semanticType?: AnnotationSemanticType | null;
  body?: string;
  tags?: string[];
  deletedAt?: string | null;
}

export function createAnnotation(bookId: string, input: AnnotationCreateInput): Annotation {
  const db = getDb();
  const id = crypto.randomBytes(16).toString('hex');
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO annotations (
      id, book_id, page_id, locator_json, quote, quote_prefix, quote_suffix,
      visual_style, color, semantic_type, body, tags_json, origin, external_id,
      source_hash, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, bookId, input.pageId ?? null, JSON.stringify(input.locator ?? {}),
    input.quote, input.quotePrefix ?? '', input.quoteSuffix ?? '',
    input.visualStyle ?? 'highlight', input.color ?? null, input.semanticType ?? null,
    input.body ?? '', JSON.stringify(input.tags ?? []), input.origin ?? 'local',
    input.externalId ?? null, input.sourceHash ?? null, now, now
  );
  return getAnnotation(id)!;
}

export function getAnnotation(id: string): Annotation | undefined {
  const db = getDb();
  const row = db.prepare('SELECT * FROM annotations WHERE id = ?').get(id) as any;
  return row ? mapAnnotationRow(row) : undefined;
}

export function getAnnotationsByBook(bookId: string, opts?: { includeDeleted?: boolean }): Annotation[] {
  const db = getDb();
  const where = opts?.includeDeleted ? '' : 'AND deleted_at IS NULL';
  const rows = db.prepare(
    `SELECT * FROM annotations WHERE book_id = ? ${where} ORDER BY created_at DESC`
  ).all(bookId) as any[];
  return rows.map(mapAnnotationRow);
}

export function getAnnotationsByPage(bookId: string, pageId: string): Annotation[] {
  const db = getDb();
  const rows = db.prepare(
    'SELECT * FROM annotations WHERE book_id = ? AND page_id = ? AND deleted_at IS NULL ORDER BY created_at ASC'
  ).all(bookId, pageId) as any[];
  return rows.map(mapAnnotationRow);
}

export function updateAnnotation(id: string, fields: AnnotationUpdateInput): Annotation | undefined {
  const db = getDb();
  const sets: string[] = ['updated_at = ?'];
  const params: any[] = [new Date().toISOString()];
  if (fields.pageId !== undefined) { sets.push('page_id = ?'); params.push(fields.pageId); }
  if (fields.locator !== undefined) { sets.push('locator_json = ?'); params.push(JSON.stringify(fields.locator)); }
  if (fields.quote !== undefined) { sets.push('quote = ?'); params.push(fields.quote); }
  if (fields.quotePrefix !== undefined) { sets.push('quote_prefix = ?'); params.push(fields.quotePrefix); }
  if (fields.quoteSuffix !== undefined) { sets.push('quote_suffix = ?'); params.push(fields.quoteSuffix); }
  if (fields.visualStyle !== undefined) { sets.push('visual_style = ?'); params.push(fields.visualStyle); }
  if (fields.color !== undefined) { sets.push('color = ?'); params.push(fields.color); }
  if (fields.semanticType !== undefined) { sets.push('semantic_type = ?'); params.push(fields.semanticType); }
  if (fields.body !== undefined) { sets.push('body = ?'); params.push(fields.body); }
  if (fields.tags !== undefined) { sets.push('tags_json = ?'); params.push(JSON.stringify(fields.tags)); }
  if (fields.deletedAt !== undefined) { sets.push('deleted_at = ?'); params.push(fields.deletedAt); }
  params.push(id);
  db.prepare(`UPDATE annotations SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  return getAnnotation(id);
}

/** 软删除，返回是否命中；恢复用 updateAnnotation({ deletedAt: null }) */
export function softDeleteAnnotation(id: string): boolean {
  const db = getDb();
  const result = db.prepare(
    'UPDATE annotations SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL'
  ).run(new Date().toISOString(), new Date().toISOString(), id);
  return result.changes > 0;
}

function mapAnnotationRow(row: any): Annotation {
  return {
    id: row.id,
    bookId: row.book_id,
    pageId: row.page_id,
    locator: safeParseJson(row.locator_json, {}),
    quote: row.quote,
    quotePrefix: row.quote_prefix,
    quoteSuffix: row.quote_suffix,
    visualStyle: row.visual_style,
    color: row.color,
    semanticType: row.semantic_type,
    body: row.body,
    tags: safeParseJson(row.tags_json, []),
    origin: row.origin,
    externalId: row.external_id,
    sourceHash: row.source_hash,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

function safeParseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}

// ── 标注 ↔ 康奈尔笔记引用 ──

export function linkAnnotationToNote(noteId: string, annotationId: string, section: CornellSection, sortOrder = 0): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO note_annotation_links (note_id, annotation_id, section, sort_order)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(note_id, annotation_id, section) DO UPDATE SET sort_order = excluded.sort_order
  `).run(noteId, annotationId, section, sortOrder);
}

export function unlinkAnnotationFromNote(noteId: string, annotationId: string, section: CornellSection): boolean {
  const db = getDb();
  const result = db.prepare(
    'DELETE FROM note_annotation_links WHERE note_id = ? AND annotation_id = ? AND section = ?'
  ).run(noteId, annotationId, section);
  return result.changes > 0;
}

export function getLinksByNote(noteId: string): NoteAnnotationLink[] {
  const db = getDb();
  const rows = db.prepare(
    'SELECT * FROM note_annotation_links WHERE note_id = ? ORDER BY section, sort_order'
  ).all(noteId) as any[];
  return rows.map(mapLinkRow);
}

export function getLinksByAnnotations(annotationIds: string[]): NoteAnnotationLink[] {
  if (annotationIds.length === 0) return [];
  const db = getDb();
  const placeholders = annotationIds.map(() => '?').join(',');
  const rows = db.prepare(
    `SELECT * FROM note_annotation_links WHERE annotation_id IN (${placeholders})`
  ).all(...annotationIds) as any[];
  return rows.map(mapLinkRow);
}

function mapLinkRow(row: any): NoteAnnotationLink {
  return { noteId: row.note_id, annotationId: row.annotation_id, section: row.section, sortOrder: row.sort_order };
}

// ── 微信读书划线 → annotations 映射（幂等） ──

const WEREAD_COLOR_MAP: Record<number, AnnotationColor> = { 0: 'red', 1: 'yellow', 2: 'blue', 3: 'green', 4: 'yellow', 5: 'blue' };

/** 将 weread_bookmarks / weread_reviews 聚合进 annotations，以 (origin='weread', external_id) 幂等去重 */
export function importWereadAnnotations(localBookId: string, wereadBookId: string): { imported: number; updated: number } {
  const db = getDb();
  let imported = 0, updated = 0;
  const upsert = db.transaction(() => {
    const bookmarks = db.prepare(
      'SELECT * FROM weread_bookmarks WHERE book_id = ? ORDER BY chapter_uid, range_start'
    ).all(wereadBookId) as any[];
    for (const bm of bookmarks) {
      const externalId = `bookmark:${bm.bookmark_id}`;
      const existing = db.prepare(
        "SELECT id FROM annotations WHERE origin = 'weread' AND external_id = ?"
      ).get(externalId) as any;
      if (existing) {
        db.prepare('UPDATE annotations SET quote = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL')
          .run(bm.mark_text, new Date().toISOString(), existing.id);
        updated++;
      } else {
        createAnnotation(localBookId, {
          quote: bm.mark_text,
          quotePrefix: bm.chapter_title ?? '',
          visualStyle: 'highlight',
          color: WEREAD_COLOR_MAP[bm.color_style as number] ?? 'yellow',
          origin: 'weread',
          externalId,
        });
        imported++;
      }
    }
    const reviews = db.prepare(
      'SELECT * FROM weread_reviews WHERE book_id = ? ORDER BY chapter_uid, created_at'
    ).all(wereadBookId) as any[];
    for (const rv of reviews) {
      const externalId = `review:${rv.review_id}`;
      const existing = db.prepare(
        "SELECT id FROM annotations WHERE origin = 'weread' AND external_id = ?"
      ).get(externalId) as any;
      if (existing) {
        db.prepare('UPDATE annotations SET quote = ?, body = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL')
          .run(rv.abstract ?? '', rv.content, new Date().toISOString(), existing.id);
        updated++;
      } else {
        createAnnotation(localBookId, {
          quote: rv.abstract ?? '',
          quotePrefix: rv.chapter_name ?? '',
          visualStyle: 'none',
          body: rv.content,
          origin: 'weread',
          externalId,
        });
        imported++;
      }
    }
  });
  upsert();
  return { imported, updated };
}

// ── Analytics ──

export interface ReadingStats {
  totalReadingTime: number;
  totalPages: number;
  totalSessions: number;
  booksCount: number;
}

export interface MasteryTrendItem {
  date: string;
  pageNum: number;
  masteryScore: number;
}

export interface ProgressSummary {
  completed: number;
  inProgress: number;
  notStarted: number;
}

export function getReadingStats(bookId?: string, _startDate?: string, _endDate?: string): ReadingStats {
  const db = getDb();

  let sessionQuery = 'SELECT COUNT(*) as count FROM chat_sessions';
  const bookQuery = 'SELECT COUNT(*) as count FROM books';
  const params: string[] = [];

  if (bookId) {
    sessionQuery += ' WHERE book_id = ?';
    params.push(bookId);
  }

  const totalSessions = (db.prepare(sessionQuery).get(...params) as any)?.count || 0;
  const booksCount = (db.prepare(bookQuery).get() as any)?.count || 0;

  return {
    totalReadingTime: totalSessions * 15, // Estimate 15 min per session
    totalPages: 0, // Would need progress.json parsing
    totalSessions,
    booksCount,
  };
}

export function getMasteryTrend(_bookId?: string, _days: number = 30): MasteryTrendItem[] {
  // For now, return empty array - would need progress.json analysis
  // In a full implementation, this would parse progress.json files
  return [];
}

export function getProgressSummary(_bookId?: string): ProgressSummary {
  const db = getDb();

  const query = `
    SELECT
      (SELECT COUNT(*) FROM books) as totalBooks,
      (SELECT COUNT(DISTINCT session_id) FROM messages) as activeSessions
  `;

  const result = db.prepare(query).get() as any;

  return {
    completed: 0, // Would need progress.json analysis
    inProgress: result.activeSessions || 0,
    notStarted: (result.totalBooks || 0) - (result.activeSessions || 0),
  };
}

// ── Settings ──

export function getSetting(key: string): string | undefined {
  const db = getDb();
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as any;
  return row?.value;
}

export function setSetting(key: string, value: string): void {
  const db = getDb();
  db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  ).run(key, value);
}

// ── Articles CRUD ──

export function createArticle(input: ArticleCreateInput): Article {
  const db = getDb();
  const id = crypto.randomBytes(16).toString('hex');
  const now = new Date().toISOString();
  const tags = JSON.stringify(input.tags || []);
  db.prepare(
    'INSERT INTO articles (id, title, source_url, summary, content, author, tags, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(id, input.title, input.sourceUrl || '', input.summary || '', input.content, input.author || '', tags, now, now);
  return getArticle(id)!;
}

export function getArticles(): Article[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM articles ORDER BY updated_at DESC').all() as any[];
  return rows.map(mapArticleRow);
}

export function getArticle(id: string): Article | undefined {
  const db = getDb();
  const row = db.prepare('SELECT * FROM articles WHERE id = ?').get(id) as any;
  if (!row) return undefined;
  return mapArticleRow(row);
}

export function updateArticle(id: string, data: Partial<Pick<Article, 'title' | 'content' | 'summary' | 'readStatus'>>): boolean {
  const db = getDb();
  const now = new Date().toISOString();
  const sets: string[] = ['updated_at = ?'];
  const values: any[] = [now];

  if (data.title !== undefined) { sets.push('title = ?'); values.push(data.title); }
  if (data.content !== undefined) { sets.push('content = ?'); values.push(data.content); }
  if (data.summary !== undefined) { sets.push('summary = ?'); values.push(data.summary); }
  if (data.readStatus !== undefined) { sets.push('read_status = ?'); values.push(data.readStatus); }

  values.push(id);
  const result = db.prepare(`UPDATE articles SET ${sets.join(', ')} WHERE id = ?`).run(...values);
  return result.changes > 0;
}

export function deleteArticle(id: string): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM articles WHERE id = ?').run(id);
  return result.changes > 0;
}

function mapArticleRow(row: any): Article {
  let tags: string[] = [];
  try { tags = JSON.parse(row.tags || '[]'); } catch { tags = []; }
  return {
    id: row.id,
    title: row.title,
    sourceUrl: row.source_url,
    summary: row.summary,
    content: row.content,
    author: row.author,
    tags,
    readStatus: row.read_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ── WeRead Bindings ──

export interface WereadBinding {
  localBookDir: string;
  wereadBookId: string;
  boundAt: number;
  lastSyncedAt: number | null;
}

function mapBindingRow(row: any): WereadBinding {
  return {
    localBookDir: row.local_book_dir,
    wereadBookId: row.weread_book_id,
    boundAt: row.bound_at,
    lastSyncedAt: row.last_synced_at ?? null,
  };
}

export function createBinding(localBookDir: string, wereadBookId: string): WereadBinding {
  const db = getDb();
  const now = Math.floor(Date.now() / 1000);
  db.prepare(
    'INSERT INTO weread_bindings (local_book_dir, weread_book_id, bound_at, last_synced_at) VALUES (?, ?, ?, NULL)'
  ).run(localBookDir, wereadBookId, now);
  return getBindingByDir(localBookDir)!;
}

export function getBindingByDir(localBookDir: string): WereadBinding | undefined {
  const db = getDb();
  const row = db.prepare('SELECT * FROM weread_bindings WHERE local_book_dir = ?').get(localBookDir) as any;
  return row ? mapBindingRow(row) : undefined;
}

export function getBindingByBookId(wereadBookId: string): WereadBinding | undefined {
  const db = getDb();
  const row = db.prepare('SELECT * FROM weread_bindings WHERE weread_book_id = ?').get(wereadBookId) as any;
  return row ? mapBindingRow(row) : undefined;
}

export function getAllBindings(): WereadBinding[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM weread_bindings').all() as any[];
  return rows.map(mapBindingRow);
}

export function updateBindingSyncedAt(localBookDir: string, ts: number): void {
  const db = getDb();
  db.prepare('UPDATE weread_bindings SET last_synced_at = ? WHERE local_book_dir = ?').run(ts, localBookDir);
}

export function deleteBinding(localBookDir: string): boolean {
  const db = getDb();
  const r = db.prepare('DELETE FROM weread_bindings WHERE local_book_dir = ?').run(localBookDir);
  return r.changes > 0;
}

/** 检查某 local_book_dir 是否在 books 表里仍然存活；用于识别孤儿 binding */
export function isLocalBookDirAlive(localBookDir: string): boolean {
  const db = getDb();
  const row = db.prepare('SELECT 1 FROM books WHERE data_dir = ? LIMIT 1').get(localBookDir);
  return !!row;
}
