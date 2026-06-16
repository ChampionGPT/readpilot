// input: 无外部依赖
// output: Book, ChatSession, Message, CourseProgress 等全局共享类型
// pos: 核心类型库 — 所有模块的数据契约
// 声明：一旦我被更新，务必更新我的开头注释以及所属文件夹的 md。

// ── 书籍 ──

export interface Book {
    id: string;
    title: string;
    author: string;
    genre: string;
    dataDir: string;
    createdAt: string;
    updatedAt: string;
}

export interface BookCreateInput {
    title: string;
    author?: string;
    genre?: string;
}

export interface BookImportInput extends BookCreateInput {
    /** 上传文件的原始名（用于 fallback 书名） */
    fileName?: string;
}

// ── 对话 ──

export interface Message {
    id: string;
    sessionId: string;
    role: "user" | "assistant";
    content: string;
    blocksJson: string | null;
    provider?: "claude" | "codex" | "hermes";
    createdAt: string;
}

export interface ChatSession {
    id: string;
    bookId: string;
    title: string;
    sdkSessionId: string;
    provider: "claude" | "codex" | "hermes";
    createdAt: string;
    updatedAt: string;
}

// ── 读书笔记（康奈尔笔记法） ──

export interface BookNote {
    id: string;
    bookId: string;
    pageId: string | null;    // 关联的伴读页面 ID（progress.json pages[].id）
    cue: string;              // 关键词/问题提示列
    notes: string;            // 笔记正文区
    summary: string;          // 总结区
    createdAt: string;
    updatedAt: string;
}

// ── 独立文章（Phase 2） ──

export type ArticleReadStatus = 'unread' | 'reading' | 'completed';

export interface Article {
    id: string;
    title: string;
    sourceUrl: string;
    summary: string;
    content: string;
    author: string;
    tags: string[];
    readStatus: ArticleReadStatus;
    createdAt: string;
    updatedAt: string;
}

export interface ArticleCreateInput {
    title: string;
    sourceUrl?: string;
    content: string;
    summary?: string;
    author?: string;
    tags?: string[];
}
