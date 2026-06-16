# 依赖说明

ReadPilot 由五类依赖组成：Next.js 应用、EPUB 转换脚本、本地数据库、agent provider、可选的微信读书集成。

## 运行时依赖

| 依赖 | 用途 |
| --- | --- |
| `next` | App Router、API routes、本地开发和生产构建 |
| `react` / `react-dom` | 前端 UI |
| `@anthropic-ai/claude-agent-sdk` | 通过 Claude Code 执行对话和工具流 |
| `@openai/codex-sdk` | Codex provider adapter |
| `better-sqlite3` | 本地 SQLite，保存聊天、笔记、微信读书绑定等状态 |
| `zustand` | 前端状态管理 |
| `zod` | 数据结构校验 |
| `lucide-react` | UI 图标 |
| `@base-ui/react` | 基础交互组件 |
| `react-resizable-panels` | 可调面板和多栏布局 |
| `framer-motion` | 局部交互动效 |
| `tailwindcss` / `tailwind-merge` | 样式系统 |
| `class-variance-authority` / `clsx` | 组件样式组合 |

## Python 依赖

EPUB 导入由 `scripts/ebook-converter/epub_to_jsonl.py` 完成：

| 依赖 | 用途 |
| --- | --- |
| `ebooklib` | 读取 EPUB spine、metadata 和资源 |
| `beautifulsoup4` | 解析章节 HTML、提取文本、重写资源引用 |

安装：

```bash
pip install ebooklib beautifulsoup4
```

## 本地工具依赖

| 工具 | 用途 |
| --- | --- |
| Node.js 20+ | 运行 Next.js、Vitest、TypeScript |
| npm | 安装和执行项目脚本 |
| Python 3.10+ | 执行 EPUB 转换脚本 |
| Claude Code CLI | Claude provider 的本地执行能力 |
| Codex CLI | Codex provider 的本地执行能力 |
| Git Bash | Windows 下部分 Claude Code 场景可能需要 |

## 开发依赖

| 依赖 | 用途 |
| --- | --- |
| `typescript` | 类型检查 |
| `eslint` / `eslint-config-next` | 代码规范检查 |
| `vitest` / `@vitest/ui` | 单元测试 |
| `@testing-library/react` | React 组件测试 |
| `happy-dom` | 测试 DOM 环境 |
| `@types/*` | TypeScript 类型声明 |

## 许可提示

ReadPilot 本体使用 MIT License。第三方依赖各自遵循其许可证，发布正式版本前建议做一次依赖许可证扫描，并在 release checklist 中记录结果。
