# 项目结构

本文说明公开仓库中的主要目录、运行时数据目录，以及 skill 与参考文档的边界。

## 公开仓库结构

```text
ReadPilot/
  README.md
  README.zh-CN.md
  LICENSE
  CONTRIBUTING.md
  SECURITY.md
  NOTICE.md
  .env.example
  package.json
  next.config.ts
  tsconfig.json

  src/
    app/                    # Next.js App Router 页面与 API routes
    components/             # 前端 UI 组件
    hooks/                  # 前端 hooks
    lib/                    # DB、文件、agent、EPUB、上下文等逻辑
    server/                 # 服务端入口
    store/                  # Zustand 状态
    types/                  # TypeScript 类型

  scripts/
    append-page.ts
    ebook-converter/        # EPUB -> JSONL/HTML 转换器

  skills/
    books-to-course/         # 核心伴读页生成 skill，含 references/

  docs/
    README.md
    SETUP.md
    USAGE.md
    PROJECT_STRUCTURE.md
    DEPENDENCIES.md
    assets/
```

## 运行时数据

默认运行时数据放在 `data/`：

```text
data/
  .gitkeep
  readpilot.db
  readpilot.db-shm
  readpilot.db-wal
  books/
    <book-slug>/
      source.epub
      source.jsonl
      source-manifest.json
      progress.json
      companion/
        book-profile.md
        chapter-index.md
        topic-index.md
      pages/
        *.html
```

这些内容可能包含私有书籍、笔记和聊天记录。公开仓库只保留 `data/.gitkeep`。

## Skill 与参考资料

核心 skill 源文件：

```text
skills/books-to-course/SKILL.md
skills/books-to-course/references/
```

桌面安装包会把它打成：

```text
resources/readpilot-skill-pack/skills/books-to-course/
  SKILL.md
  references/
```

生成方法、设计系统、交互元素、Hub 模板和数据结构参考也随 skill 放在：

```text
skills/books-to-course/references/
```

边界如下：

- `skills/books-to-course/`：agent 执行伴读页生成时读取的完整 skill 包。
- `src/lib/agent-context.ts`：统一读取书籍、进度、笔记、微信读书记忆等上下文。

## 不应进入公开仓库的内容

```text
data/books/
data/readpilot.db*
.env.local
.claude/
.agent/
.codex/ 中除项目示例配置外的本地状态
.npm-cache/
.next/
backups/
```

如果需要展示示例，请使用自有文本或公版文本，不要提交版权书籍原文。
