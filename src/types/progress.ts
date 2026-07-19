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

// ── 阅读标注（原子标注，独立于康奈尔笔记） ──

export type AnnotationVisualStyle = 'highlight' | 'straight' | 'wavy' | 'none';
export type AnnotationColor = 'yellow' | 'blue' | 'red' | 'green';
export type AnnotationSemanticType =
    | 'case' | 'quote' | 'question' | 'resonance'
    | 'objection' | 'action' | 'insight';
export type AnnotationOrigin = 'local' | 'weread';

/** 原文定位信息：blockId 优先，quote + 前后文兜底重定位 */
export interface AnnotationLocator {
    blockId?: string;         // pages HTML 中 data-rp-block 值
    startOffset?: number;     // block 内字符偏移
    endOffset?: number;
}

export interface Annotation {
    id: string;
    bookId: string;
    pageId: string | null;    // progress.json pages[].id
    locator: AnnotationLocator;
    quote: string;            // 精确原文
    quotePrefix: string;      // 前文（兜底重定位）
    quoteSuffix: string;      // 后文
    visualStyle: AnnotationVisualStyle;
    color: AnnotationColor | null;
    semanticType: AnnotationSemanticType | null;
    body: string;             // 用户想法
    tags: string[];
    origin: AnnotationOrigin;
    externalId: string | null;  // 微信读书标注 ID
    sourceHash: string | null;  // 页面内容 hash
    createdAt: string;
    updatedAt: string;
    deletedAt: string | null;
}

export type CornellSection = 'cue' | 'notes' | 'summary';

/** 标注 ↔ 康奈尔笔记引用关系 */
export interface NoteAnnotationLink {
    noteId: string;
    annotationId: string;
    section: CornellSection;
    sortOrder: number;
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
