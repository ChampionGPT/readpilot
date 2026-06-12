# 项目目录说明

本文档说明公开仓库中每个主要目录的用途，以及运行时会生成哪些本地目录。

## 公开仓库结构

```text
ReadPilot/
  README.md                 # 英文主 README
  README.zh-CN.md           # 中文 README
  LICENSE                   # MIT License
  CONTRIBUTING.md           # 贡献指南
  SECURITY.md               # 安全与隐私说明
  .env.example              # 本地环境变量示例
  package.json              # Node 依赖与脚本
  tsconfig.json             # TypeScript 配置
  next.config.ts            # Next.js 配置

  src/
    app/                    # Next.js App Router 页面与 API routes
    components/             # 前端 UI 组件
    hooks/                  # 前端 hooks
    lib/                    # 后端/共享逻辑：DB、文件、Claude、EPUB 转换包装
    store/                  # Zustand 全局状态
    types/                  # TypeScript 类型

  scripts/
    append-page.ts          # 伴读页登记辅助脚本
    ebook-converter/        # EPUB 转 JSONL/HTML 的 Python 转换器

  skills/
    reading-companion/      # 英文 Claude Code skill 入口
    reading-companion-zh/   # 中文 Claude Code skill 入口

  docs/
    SETUP.md                # 安装与运行
    USAGE.md                # 使用旅程
    PROJECT_STRUCTURE.md    # 本文件
    DEPENDENCIES.md         # 依赖说明
    references/             # 伴读页生成参考资料，不是 skill 入口
    assets/                 # README 展示图

  public/                   # Next.js 静态资源
```

## 运行时本地数据

默认情况下，ReadPilot 会把运行数据放在 `data/`。这个目录不应提交到公开仓库。

```text
data/
  .gitkeep
  readpilot.db              # SQLite：聊天、笔记、微信读书绑定等
  readpilot.db-shm
  readpilot.db-wal
  books/
    <book-slug>/
      source.epub           # 原始 EPUB
      source.jsonl          # 转换后的章节文本 chunks
      source-manifest.json  # EPUB HTML 页面 manifest
      progress.json         # 当前书的阅读状态
      companion/
        book-profile.md     # 全书画像/伴读缓存
        chapter-index.md    # 章节索引
        topic-index.md      # 主题索引
      pages/
        *.html              # EPUB 保真章节页或生成的伴读页
```

可以通过 `.env.local` 改数据目录：

```bash
READPILOT_DATA_DIR=./data
READPILOT_BOOKS_DIR=./data/books
```

## Skill 与参考资料的边界

`skills/` 是唯一的 skill 入口位置：

```text
skills/reading-companion/SKILL.md
skills/reading-companion-zh/SKILL.md
```

`docs/references/` 是参考资料位置：

```text
docs/references/companion-methodology.md
docs/references/design.md
docs/references/design-system.md
docs/references/hub-template.md
docs/references/interactive-elements.md
docs/references/progress-schema.md
```

区别是：

- `SKILL.md`：决定何时触发、读写哪些文件、如何完成一次页面生成。
- `docs/references/*`：提供页面设计、交互元素、Hub 模板、数据结构和教学方法论。

其中 `docs/references/companion-methodology.md` 是伴读页生成方法论参考，不是可安装的 skill 入口。

## 不进入公开仓库的内容

以下内容默认不应公开：

```text
data/books/
data/readpilot.db*
.env.local
.claude/
.agent/
.planning/
.marketing/
Ui/
docs/superpowers/
```
