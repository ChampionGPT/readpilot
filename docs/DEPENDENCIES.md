# 依赖说明

ReadPilot 由四部分组成：Next.js 前端与 API、本地 EPUB 转换脚本、Claude Code 对话执行层，以及可选的微信读书集成。

## 运行时依赖

| 依赖 | 用途 |
| --- | --- |
| `next` | App Router、API routes、本地开发和生产构建 |
| `react` / `react-dom` | 前端 UI |
| `@anthropic-ai/claude-agent-sdk` | 通过 Claude Code 执行对话和工具流 |
| `better-sqlite3` | 本地 SQLite 数据库存储聊天、笔记等状态 |
| `zustand` | 前端全局状态 |
| `zod` | 数据结构校验 |
| `lucide-react` | UI 图标 |
| `@base-ui/react` | 基础交互组件 |
| `react-resizable-panels` | 三栏布局和可调面板 |
| `framer-motion` | 局部交互动效 |
| `tailwindcss` / `tailwind-merge` | 样式系统 |
| `class-variance-authority` / `clsx` | 组件样式组合 |

## 可选外部服务

| 服务 | 用途 |
| --- | --- |
| Claude Code / Anthropic | ChatPanel 对话、工具流和页面生成 |
| 微信读书 Skill API | 可选，同步微信读书书架、划线、想法和阅读进度 |

微信读书 API Key 获取入口：https://i.weread.qq.com/skills/agent

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
| Claude Code CLI | 提供 Claude Agent SDK 的本地执行能力 |
| Git Bash | Windows 下部分 Claude Code 执行场景可能需要 |

Claude Code 官方资源：

- Claude Code 文档：https://docs.anthropic.com/en/docs/claude-code/overview
- Claude Code 安装与设置：https://docs.anthropic.com/en/docs/claude-code/setup
- Claude Code SDK 文档：https://docs.anthropic.com/en/docs/claude-code/sdk
- Claude Agent SDK npm 包：https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk

确认 Claude Code 可用：

```bash
claude --version
```

如果未安装，请按官方文档安装。常见 npm 安装方式：

```bash
npm install -g @anthropic-ai/claude-code
```

## 开发依赖

| 依赖 | 用途 |
| --- | --- |
| `typescript` | 类型检查 |
| `eslint` / `eslint-config-next` | 代码规范检查 |
| `vitest` / `@vitest/ui` | 单元测试 |
| `@testing-library/react` | React 组件测试 |
| `happy-dom` | 测试 DOM 环境 |
| `@types/*` | TypeScript 类型声明 |

## 许可证提示

项目本体使用 MIT License。第三方依赖各自遵循其自身许可证，发布正式版本前建议运行一次依赖许可证扫描，并在 release checklist 中记录结果。
