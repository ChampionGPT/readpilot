# lib 模块声明

**一旦我所属的文件夹有所变化，请更新我。**

包含用于数据通信、格式化、持久化以及 Agent 桥接通讯的核心工具箱逻辑。所有函数尽可能纯净无副作用。

- `db.ts`: [地位：持久化引擎] - [功能：提供基于 SQLite 的结构化查询封装引擎]
- `claude-client.ts`: [地位：CLI通信桥接] - [功能：实例化 @anthropic-ai/claude-agent-sdk；按伴读意图区分 ChatPanel 纯文本问答与 `/books-to-course` 页面生成工具流]
- `chat-tool-policy.ts`: [地位：ChatPanel 工具门禁] - [功能：基于当前 prompt、近期消息和界面上下文判断是否允许写入/编辑文件工具，支持导读页/Hub 生成流程的多轮确认]
- `utils.ts`: [地位：工具库] - [功能：暴露样式合并(cn)等常见轻量纯函数]
- `extract-page-context.ts`: [地位：内容提取器] - [功能：从 HTML 伴读页面提取标题/引用/概念，供康奈尔笔记 Cue 区域自动注入]
- `constants.ts`: [地位：配置层] - [功能：DATA_DIR / BOOKS_DIR / DB_PATH 等路径常量唯一来源]
- `platform.ts`: [地位：平台适配] - [功能：Claude CLI 与 Python 二进制探测、PATH 扩展、Windows .cmd 包装]
- `files.ts`: [地位：书籍文件系统] - [功能：书籍目录 CRUD、progress.json 读写、import 用 staging 目录原子提交]
- `ebook-converter.ts`: [地位：EPUB 导入第 3-4 步] - [功能：spawn vendored Python 转换器、强制 UTF-8 输出、捕获 stderr/stdout 与超时、返回结构化的 JsonlChunk[] 与缺依赖错误]
- `jsonl-to-pages.ts`: [地位：EPUB 导入第 5-6 步] - [功能：按 chapter 分组渲染 pages/*.html 并产出 ProgressPage[]]
- `companion-compiler.ts`: [地位：伴读编译层] - [功能：导入后基于 source.jsonl 生成 `companion/manifest.json`、`book-profile.md`、`chapter-index.md`、`topic-index.md`，并向 ChatPanel 提供可复用全书档案上下文]
- `import-events.ts`: [地位：导入流协议层] - [功能：服务端/客户端共享的 SSE 双 JSON 信封编解码 + 全部事件类型]
- `title-gradient.ts`: [地位：UI 工具] - [功能：基于书名的确定性哈希，提供 cover (浅色) 与 thumbnail (深色) 两套渐变调色板，让同一本书在不同视图获得稳定可识别的颜色]
- `wereadClient.ts`: [地位：微信读书网关客户端] - [功能：所有微读 gateway 调用的唯一服务端出口；自动注入 `Authorization` header + `skill_version: '1.0.3'`；导出 `WereadAuthError` / `WereadApiError`]
- `wereadCache.ts`: [地位：微读缓存层] - [功能：`syncBook` 同步编排（6h 新鲜度阈值 + force 绕过 + 单 scope 失败不阻塞其他）+ `getCachedBookInfo` / `getCachedProgress` / `countCachedBookmarks` / `countCachedReviews` / `getChapterMarks` 缓存读取]
- `wereadContextBuilder.ts`: [地位：AI 上下文注入层] - [功能：`buildWereadContextSection(localBookDir)` 返回追加到伴读 AI system prompt 的 markdown；含划线（限 50 条，最新 30 + 每章首条）+ 想法 + 进度概览；未绑定/无划线返回空串]
- 微读绑定 CRUD + `isLocalBookDirAlive` 在 `db.ts`：`createBinding` / `getBindingByDir` / `getBindingByBookId` / `getAllBindings` / `updateBindingSyncedAt` / `deleteBinding` / `isLocalBookDirAlive`

